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
                language={language}
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
    language: WithLanguageProps['language'];
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
    language,
}) => {
    const { setSubmitted } = useContext(FormContext);
    const { checkoutState, checkoutService } = useCheckout();

    const [isUpdatingFee, setIsUpdatingFee] = useState(false);

    const savePaymentMethodSelection = useCallback((methodId: string) => {
        try {
            localStorage.setItem('selectedPaymentMethodId', methodId);
        } catch (e) {
            console.warn('Errore salvataggio localStorage:', e);
        }
    }, []);

    const updateFeeAndRefresh = async (method: PaymentMethod) => {
        const checkoutId = checkoutState.data.getCheckout()?.id;
        if (!checkoutId) {
            return;
        }
        setIsUpdatingFee(true);

        

        try {
            const currentLanguage = language.getLocale().split('-')[0] || 'it';

            console.log(`Pronto a fare fetch al backend`, {
  checkoutId,
  selectedPaymentMethodId: method.id,
  language: currentLanguage,
});
            
            //cambiare con proprio url backend
       const apiUrl = 'https://contrassegno.onrender.com/payment/handle-payment-change';

            
            console.log(`Invio richiesta di aggiornamento fee per lingua: ${currentLanguage}`);

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    checkoutId,
                    selectedPaymentMethodId: method.id,
                    language: currentLanguage,
                }),
            });


            if (response.ok) {
                await checkoutService.loadCheckout(checkoutId);
            } else {
                console.error('Il server ha risposto con un errore:', await response.text());
            }
        } catch (error) {
            console.error('Errore di rete durante l\'aggiornamento della fee:', error);
        } finally {
            setIsUpdatingFee(false);
        }
    };

    const debouncedUpdate = useCallback(debounce(updateFeeAndRefresh, 100), [
        checkoutState,
        checkoutService,
        language,
    ]);

    const handlePaymentMethodSelect = useCallback(
        
    (method: PaymentMethod) => {
         console.log('handlePaymentMethodSelect chiamato', method.id);
        if (isUpdatingFee) {
            return;
        }

        const methodId = getUniquePaymentMethodId(method.id, method.gateway);
        savePaymentMethodSelection(methodId);
        
        try {
            const displayName = method.config.displayName;
            if (displayName) {
                localStorage.setItem('selectedPaymentMethodName', displayName);
            }
        } catch (e) {
            console.warn('Errore salvataggio displayName in localStorage:', e);
        }

        onMethodSelect?.(method);

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
            paymentProviderRadio: methodId,
            shouldCreateAccount: true,
            shouldSaveInstrument: false,
        };

        resetForm({ values: updatedValues });
        setSubmitted(false);

        debouncedUpdate(method);
    },
    [isUpdatingFee, onMethodSelect, resetForm, values, setSubmitted, debouncedUpdate, savePaymentMethodSelection],
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

            <Extension region={ExtensionRegion.PaymentPaymentMethodListBefore} />

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

const paymentFormConfig: WithFormikConfig<PaymentFormProps & WithLanguageProps, PaymentFormValues> = {
    mapPropsToValues: ({ defaultGatewayId, defaultMethodId, methods }) => {
        let savedMethodId: string | null = null;
        try {
            savedMethodId = localStorage.getItem('selectedPaymentMethodId');
        } catch (e) {
            console.warn('Errore lettura localStorage:', e);
        }

        let activeMethodId = defaultMethodId;
        if (savedMethodId) {
            const methodMatch = methods.find(method => 
                getUniquePaymentMethodId(method.id, method.gateway) === savedMethodId
            );
            if (methodMatch) {
                activeMethodId = methodMatch.id;
            }
        }

        return {
            ccCustomerCode: '',
            ccCvv: '',
            ccDocument: '',
            customerEmail: '',
            customerMobile: '',
            ccExpiry: '',
            ccName: '',
            ccNumber: '',
            paymentProviderRadio: getUniquePaymentMethodId(activeMethodId, defaultGatewayId),
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
    enableReinitialize: true,
};

export default withLanguage(withFormik(paymentFormConfig)(memo(PaymentForm)));