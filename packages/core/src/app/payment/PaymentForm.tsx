import { ExtensionRegion, type PaymentMethod } from '@bigcommerce/checkout-sdk/essential';
import { type FormikProps, type FormikState, withFormik, type WithFormikConfig } from 'formik';
import { isNil, noop, omitBy } from 'lodash';
import React, { type FunctionComponent, memo, useCallback, useContext, useMemo, useState } from 'react';
import { type ObjectSchema } from 'yup';
import { debounce } from 'lodash';

import { useCheckout } from '@bigcommerce/checkout/contexts';
import { Extension } from '@bigcommerce/checkout/checkout-extension';
import { TranslatedString, withLanguage, type WithLanguageProps } from '@bigcommerce/checkout/locale';
import { type PaymentFormValues } from '@bigcommerce/checkout/payment-integration-api';
import { FormContext } from '@bigcommerce/checkout/ui';

import { TermsConditions } from '../termsConditions';
import { Fieldset, Form, Legend } from '../ui/form';

import getPaymentValidationSchema from './getPaymentValidationSchema';
import {
    getPaymentMethodName,
    getUniquePaymentMethodId,
    PaymentMethodId,
    PaymentMethodList,
} from './paymentMethod';
import PaymentRedeemables from './PaymentRedeemables';
import PaymentSubmitButton from './PaymentSubmitButton';
import SpamProtectionField from './SpamProtectionField';
import { StoreCreditField, StoreCreditOverlay } from './storeCredit';

export interface PaymentFormProps {
    availableStoreCredit?: number;
    defaultGatewayId?: string;
    defaultMethodId: string;
    didExceedSpamLimit?: boolean;
    isEmbedded?: boolean;
    isInitializingPayment?: boolean;
    isTermsConditionsRequired?: boolean;
    isUsingMultiShipping?: boolean;
    isStoreCreditApplied: boolean;
    methods: PaymentMethod[];
    selectedMethod?: PaymentMethod;
    shouldShowStoreCredit?: boolean;
    shouldDisableSubmit?: boolean;
    shouldHidePaymentSubmitButton?: boolean;
    shouldExecuteSpamCheck?: boolean;
    termsConditionsText?: string;
    termsConditionsUrl?: string;
    usableStoreCredit?: number;
    validationSchema?: ObjectSchema<Partial<PaymentFormValues>>;
    isPaymentDataRequired(): boolean;
    onMethodSelect?(method: PaymentMethod): void;
    onStoreCreditChange?(useStoreCredit?: boolean): void;
    onSubmit?(values: PaymentFormValues): void;
    onUnhandledError?(error: Error): void;
}

const PaymentForm: FunctionComponent<
    PaymentFormProps & FormikProps<PaymentFormValues> & WithLanguageProps
> = ({
    availableStoreCredit = 0,
    didExceedSpamLimit,
    isEmbedded,
    isInitializingPayment,
    isPaymentDataRequired,
    isTermsConditionsRequired,
    isStoreCreditApplied,
    isUsingMultiShipping,
    language,
    methods,
    onMethodSelect,
    onStoreCreditChange,
    onUnhandledError,
    resetForm,
    selectedMethod,
    shouldDisableSubmit,
    shouldHidePaymentSubmitButton,
    shouldExecuteSpamCheck,
    termsConditionsText = '',
    termsConditionsUrl,
    usableStoreCredit = 0,
    values,
}) => {
    const selectedMethodId = useMemo(() => {
        if (!selectedMethod) {
            return;
        }

        switch (selectedMethod.id) {
            case PaymentMethodId.AmazonPay:
                if (selectedMethod.initializationData.paymentToken) {
                    return;
                }

                return selectedMethod.id;

            default:
                return selectedMethod.id;
        }
    }, [selectedMethod]);

    const brandName = useMemo(() => {
        if (!selectedMethod) {
            return;
        }

        return (
            selectedMethod.initializationData?.payPalCreditProductBrandName?.credit ||
            selectedMethod.initializationData?.payPalCreditProductBrandName
        );
    }, [selectedMethod]);

    if (shouldExecuteSpamCheck) {
        return (
            <SpamProtectionField
                didExceedSpamLimit={didExceedSpamLimit}
                onUnhandledError={onUnhandledError}
            />
        );
    }

    return (
        <Form className="checkout-form" testId="payment-form">
            {usableStoreCredit > 0 && (
                <StoreCreditField
                    availableStoreCredit={availableStoreCredit}
                    isStoreCreditApplied={isStoreCreditApplied}
                    name="useStoreCredit"
                    onChange={onStoreCreditChange}
                    usableStoreCredit={usableStoreCredit}
                />
            )}

            <PaymentMethodListFieldset
                isEmbedded={isEmbedded}
                isInitializingPayment={isInitializingPayment}
                isPaymentDataRequired={isPaymentDataRequired}
                isUsingMultiShipping={isUsingMultiShipping}
                methods={methods}
                onMethodSelect={onMethodSelect}
                onUnhandledError={onUnhandledError}
                resetForm={resetForm}
                values={values}
            />

            <PaymentRedeemables />

            {isTermsConditionsRequired && (
                <TermsConditions
                    termsConditionsText={termsConditionsText}
                    termsConditionsUrl={termsConditionsUrl}
                />
            )}

            <div className="form-actions">
                {shouldHidePaymentSubmitButton ? (
                    <PaymentMethodSubmitButtonContainer />
                ) : (
                    <PaymentSubmitButton
                        brandName={brandName}
                        initialisationStrategyType={
                            selectedMethod && selectedMethod.initializationStrategy?.type
                        }
                        isComplete={!!selectedMethod?.initializationData?.isComplete}
                        isDisabled={shouldDisableSubmit}
                        methodGateway={selectedMethod && selectedMethod.gateway}
                        methodId={selectedMethodId}
                        methodName={
                            selectedMethod && getPaymentMethodName(language)(selectedMethod)
                        }
                        methodType={selectedMethod && selectedMethod.method}
                    />
                )}
            </div>
        </Form>
    );
};

const PaymentMethodSubmitButtonContainer: FunctionComponent = () => {
    return <div className="submitButtonContainer" id="checkout-payment-continue" />;
};

interface PaymentMethodListFieldsetProps {
    isEmbedded?: boolean;
    isInitializingPayment?: boolean;
    isUsingMultiShipping?: boolean;
    methods: PaymentMethod[];
    values: PaymentFormValues;
    isPaymentDataRequired(): boolean;
    onMethodSelect?(method: PaymentMethod): void;
    onUnhandledError?(error: Error): void;
    resetForm(nextValues?: Partial<FormikState<PaymentFormValues>>): void;
}

const PaymentMethodListFieldset: FunctionComponent<PaymentMethodListFieldsetProps> = ({
    isEmbedded,
    isInitializingPayment,
    isPaymentDataRequired,
    isUsingMultiShipping,
    methods,
    onMethodSelect = noop,
    onUnhandledError,
    resetForm,
    values,
}) => {
    const { setSubmitted } = useContext(FormContext);
    const { checkoutState, checkoutService } = useCheckout();

    // 1. Aggiungiamo il nostro stato per bloccare l'UI
    const [isUpdatingFee, setIsUpdatingFee] = useState(false);

    // 2. Definiamo la funzione che fa il lavoro pesante (chiamata API + refresh)
    const updateFeeAndRefresh = async (method: PaymentMethod) => {
        const checkoutId = checkoutState.data.getCheckout()?.id;
        if (!checkoutId) {
            console.log('ID Checkout non trovato, impossibile aggiornare la fee.');
            return;
        }

        console.log(`Inizio aggiornamento fee per metodo: ${method.id}`);
        setIsUpdatingFee(true); // Blocca l'UI

        try {
            const apiUrl = 'https://glucosic-dylan-ectoblastic.ngrok-free.dev/handle-payment-change';
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    checkoutId,
                    selectedPaymentMethodId: method.id,
                }),
            });

            console.log('Risposta dal server di gestione fee:', response.status);

            if (response.ok) {
                // Il server ha fatto il suo lavoro, ora aggiorniamo il frontend
                await checkoutService.loadCheckout(checkoutId);
                console.log('Stato del checkout del frontend aggiornato.');
            } else {
                console.error('Il server ha risposto con un errore:', await response.text());
            }
        } catch (error) {
            console.error('Errore di rete durante l-aggiornamento della fee:', error);
        } finally {
            console.log(`Fine aggiornamento fee per metodo: ${method.id}`);
            setIsUpdatingFee(false); // Sblocca l'UI in ogni caso (successo o fallimento)
        }
    };

    // 3. Creiamo la versione "debounced" della nostra funzione
    // Usiamo `useCallback` per evitare di ricrearla ad ogni render.
    // Il timer di 300ms parte solo dopo che l'utente ha smesso di cliccare.
    const debouncedUpdate = useCallback(debounce(updateFeeAndRefresh, 300), [
        checkoutState,
        checkoutService,
    ]);

    // 4. Questa è la funzione che viene chiamata ad ogni click
    const handlePaymentMethodSelect = useCallback(
        (method: PaymentMethod) => {
            // Se un'operazione è già in corso, ignoriamo i nuovi click.
            if (isUpdatingFee) {
                console.log('Aggiornamento già in corso, click ignorato.');
                return;
            }

            // Aggiorna la UI istantaneamente (selezione del radio e reset form)
            onMethodSelect(method);

            const updatedValues = {
                ...values,
                ccCustomerCode: '',
                ccCvv: '',
                ccDocument: '',
                customerEmail: '',
                customerMobile: '',
                ccExpiry: '',
                ccName: '',
                ccNumber: '',
                instrumentId: '',
                paymentProviderRadio: getUniquePaymentMethodId(method.id, method.gateway),
                shouldCreateAccount: true,
                shouldSaveInstrument: false,
            };

            resetForm({ values: updatedValues });
            setSubmitted(false);

            // "Programma" l'esecuzione della nostra logica pesante
            debouncedUpdate(method);
        },
        [
            isUpdatingFee, // Dipende dallo stato di loading
            onMethodSelect,
            resetForm,
            values,
            setSubmitted,
            debouncedUpdate, // Dipende dalla funzione debounced
        ],
    );


    return (
        <Fieldset
            legend={
                <Legend hidden>
                    <TranslatedString id="payment.payment_methods_text" />
                </Legend>
            }
        >
            {!isPaymentDataRequired() && <StoreCreditOverlay />}

            <Extension region={ExtensionRegion.PaymentPaymentMethodListBefore}/>

            <PaymentMethodList
                isEmbedded={isEmbedded}
                isInitializingPayment={isInitializingPayment}
                isUsingMultiShipping={isUsingMultiShipping}
                methods={methods}
                onSelect={handlePaymentMethodSelect}
                onUnhandledError={onUnhandledError}
            />
        </Fieldset>
    );
};

const paymentFormConfig: WithFormikConfig<PaymentFormProps & WithLanguageProps, PaymentFormValues> =
    {
       mapPropsToValues: ({ defaultGatewayId, defaultMethodId, selectedMethod }) => {
            // Se c'è un metodo SELEZIONATO passato dalle props (la scelta dell'utente),
            // usiamo quello. Altrimenti, usiamo il metodo di default.
            const activeMethod = selectedMethod || { id: defaultMethodId, gateway: defaultGatewayId };

            return {
                ccCustomerCode: '',
                ccCvv: '',
                ccDocument: '',
                customerEmail: '',
                customerMobile: '',
                ccExpiry: '',
                ccName: '',
                ccNumber: '',
                // Usa l'ID del metodo attivo (scelta utente o default) per impostare il radio button
                paymentProviderRadio: getUniquePaymentMethodId(activeMethod.id, activeMethod.gateway),
                instrumentId: '',
                shouldCreateAccount: true,
                shouldSaveInstrument: false,
                terms: false,
                hostedForm: {
                    cardType: '',
                    errors: {
                        cardCode: '',
                        cardCodeVerification: '',
                        cardExpiry: '',
                        cardName: '',
                        cardNumber: '',
                        cardNumberVerification: '',
                    },
                },
                accountNumber: '',
                routingNumber: '',
            };
        },
        handleSubmit: (values, { props: { onSubmit = noop } }) => {
            onSubmit(
                omitBy(
                    values,
                    (value, key) => isNil(value) || value === '' || key === 'hostedForm',
                ),
            );
        },

        validationSchema: ({
            language,
            isTermsConditionsRequired = false,
            validationSchema,
        }: PaymentFormProps & WithLanguageProps) =>
            getPaymentValidationSchema({
                additionalValidation: validationSchema,
                isTermsConditionsRequired,
                language,
            }),
             
        enableReinitialize: true, // Questo è già corretto
    };

export default withLanguage(withFormik(paymentFormConfig)(memo(PaymentForm)));