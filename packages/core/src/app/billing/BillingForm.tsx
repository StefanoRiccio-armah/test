import {
    type Address,
    type FormField,
} from '@bigcommerce/checkout-sdk';
import { type FormikProps, withFormik } from 'formik';
import React, { type RefObject, useRef, useState } from 'react';
import * as Yup from 'yup';
import { isCodiceFiscaleValid, isPartitaIvaValid } from '../custom/codice-fiscale-validator';

import { useCheckout, useThemeContext } from '@bigcommerce/checkout/contexts';
import { TranslatedString, withLanguage, type WithLanguageProps } from '@bigcommerce/checkout/locale';
import { usePayPalFastlaneAddress } from '@bigcommerce/checkout/paypal-fastlane-integration';
import { AddressFormSkeleton, LoadingOverlay } from '@bigcommerce/checkout/ui';

import {
  AddressForm,
  type AddressFormValues,
  AddressSelect,
  AddressType,
  getAddressFormFieldsValidationSchema,
  getTranslateAddressError,
  isValidCustomerAddress,
  mapAddressToFormValues,
} from '../address';
import { getCustomFormFieldsValidationSchema } from '../formFields';
import { OrderComments } from '../orderComments';
import { getShippableItemsCount } from '../shipping';
import { Button, ButtonVariant } from '../ui/button';
import { Fieldset, Form } from '../ui/form';

import { hasDeductibleProduct } from '../custom/minsan-checker'
import StaticBillingAddress from './StaticBillingAddress';

export type BillingFormValues = AddressFormValues & { orderComment: string, wantsInvoice: boolean; };

export interface BillingFormProps {
    methodId?: string;
    billingAddress?: Address;
    customerMessage: string;
    navigateNextStep(): void;
    onSubmit(values: BillingFormValues): void;
    onUnhandledError(error: Error): void;
    getFields(countryCode?: string): FormField[];
}

const BillingForm = ({
    methodId,
    getFields,
    billingAddress,
    setFieldValue,
    values,
    onUnhandledError,
}: BillingFormProps & WithLanguageProps & FormikProps<BillingFormValues>) => {
    const [isResettingAddress, setIsResettingAddress] = useState(false);
    const addressFormRef: RefObject<HTMLFieldSetElement> = useRef(null);
    const { isPayPalFastlaneEnabled, paypalFastlaneAddresses } = usePayPalFastlaneAddress();

    const { themeV2 } = useThemeContext();
    const { checkoutService, checkoutState } = useCheckout();

    const {
        data: { getCustomer, getConfig, getCart },
        statuses: { isUpdatingBillingAddress, isUpdatingCheckout },
    } = checkoutState;

    const customer = getCustomer();
    const config = getConfig();
    const cart = getCart();
    const shouldShowCodiceFiscale = hasDeductibleProduct(cart);

    if (!config || !customer || !cart) {
        throw new Error('checkout data is not available');
    }

    const isGuest = customer.isGuest;
    const addresses = customer.addresses;
    const shouldRenderStaticAddress = methodId === 'amazonpay';
    const allFormFields = getFields(values.countryCode);
    const customFormFields = allFormFields.filter(({ custom }) => custom);
    const hasCustomFormFields = customFormFields.length > 0;
    const editableFormFields =
        shouldRenderStaticAddress && hasCustomFormFields ? customFormFields : allFormFields;
    const billingAddresses = isGuest && isPayPalFastlaneEnabled ? paypalFastlaneAddresses : addresses;
    const hasAddresses = billingAddresses?.length > 0;
    const hasValidCustomerAddress =
        billingAddress &&
        isValidCustomerAddress(
            billingAddress,
            billingAddresses,
            getFields(billingAddress.countryCode),
        );
    const isUpdating  = isUpdatingBillingAddress() || isUpdatingCheckout();
    const { enableOrderComments } = config.checkoutSettings;
    const shouldShowOrderComments  = enableOrderComments && getShippableItemsCount(cart) < 1;

    const handleSelectAddress = async (address: Partial<Address>) => {
        setIsResettingAddress(true);

        try {
            await checkoutService.updateBillingAddress(address);
        } catch (error) {
            console.error('updateBillingAddress failed', error);
            if (error instanceof Error) {
                onUnhandledError(error);
            }
        } finally {
            setIsResettingAddress(false);
        }
    };

    const handleUseNewAddress = () => {
        void handleSelectAddress({});
    };

    const handleToggleInvoice = () => {
        setFieldValue('wantsInvoice', !values.wantsInvoice);
    };

    const invoiceFieldNames = ['company', 'field_29', 'field_31', 'field_33', 'field_35', 'field_37'];
    const regularAddressFields = editableFormFields.filter(field => !invoiceFieldNames.includes(field.name));
    const invoiceAddressFields = editableFormFields.filter(field => invoiceFieldNames.includes(field.name));

    return (
        <Form autoComplete="on">
            {shouldRenderStaticAddress && billingAddress && (
                <div className="form-fieldset">
                    <StaticBillingAddress address={billingAddress} />
                </div>
            )}

            {/* Checkbox "Vuoi la fattura?" */}
            <Fieldset>
                <div className="checkbox-billing">
                    <input
                        id="wantsInvoice"
                        type="checkbox"
                        checked={values.wantsInvoice}
                        onChange={handleToggleInvoice}
                    />
                    <label htmlFor="wantsInvoice">Vuoi la fattura?</label>
                </div>
            </Fieldset>

            {/* Sezione Fattura */}
            {values.wantsInvoice && (
                <div className="invoice-section">
                    <AddressForm
                        countryCode={values.countryCode}
                        formFields={invoiceAddressFields}
                        setFieldValue={setFieldValue}
                        shouldShowCodiceFiscale={shouldShowCodiceFiscale}
                        type={AddressType.Billing}
                          addressValues={values}
                    />
                </div>
            )}

            <Fieldset id="checkoutBillingAddress" ref={addressFormRef}>
                {hasAddresses && !shouldRenderStaticAddress && (
                    <Fieldset id="billingAddresses">
                        <LoadingOverlay isLoading={isResettingAddress}>
                            <AddressSelect
                                addresses={billingAddresses}
                                onSelectAddress={handleSelectAddress}
                                onUseNewAddress={handleUseNewAddress}
                                selectedAddress={hasValidCustomerAddress ? billingAddress : undefined}
                                type={AddressType.Billing}
                                
                            />
                        </LoadingOverlay>
                    </Fieldset>
                )}

                {!hasValidCustomerAddress && (
                    <AddressFormSkeleton isLoading={isResettingAddress}>
                        <AddressForm
                            countryCode={values.countryCode}
                            formFields={regularAddressFields}
                            setFieldValue={setFieldValue}
                            shouldShowSaveAddress={!isGuest}
                            type={AddressType.Billing}
                            shouldShowCodiceFiscale={shouldShowCodiceFiscale}
                              addressValues={values}
                        />
                    </AddressFormSkeleton>
                )}
            </Fieldset>

            {shouldShowOrderComments && <OrderComments />}

            <div className="form-actions">
                <Button
                    className={themeV2 ? 'body-bold' : ''}
                    disabled={isUpdating || isResettingAddress}
                    id="checkout-billing-continue"
                    isLoading={isUpdating || isResettingAddress}
                    type="submit"
                    variant={ButtonVariant.Primary}
                >
                    <TranslatedString id="common.continue_action" />
                </Button>
            </div>
        </Form>
    );
};

export default withLanguage(
    withFormik<BillingFormProps & WithLanguageProps, BillingFormValues>({
        // ✅ SOLUZIONE: Rimuovi il custom handleSubmit e torna alla versione semplice
        handleSubmit: (values, { props: { onSubmit } }) => {
            // Il componente padre (Billing.tsx) gestisce già:
            // 1. La trasformazione di customFields da oggetto ad array
            // 2. La navigazione al prossimo step
            // 3. La gestione degli errori
            onSubmit(values);
        },
        
        mapPropsToValues: ({ getFields, customerMessage, billingAddress }) => {
            const initialValues = {
                ...mapAddressToFormValues(
                    getFields(billingAddress && billingAddress.countryCode),
                    billingAddress,
                ),
                orderComment: customerMessage,
                wantsInvoice: false,
            };
            return initialValues;
        },
        validateOnMount: true,
        validationSchema: ({
            language,
            getFields,
            methodId,
        }: BillingFormProps & WithLanguageProps) =>
            Yup.lazy<BillingFormValues>((values) => {
                const errorMessages = {
                    it: {
                        INVOICE_REQUIRED_MESSAGE: 'Inserire la Partita IVA o il Codice Fiscale.',
                        CF_ERROR: 'Il Codice Fiscale non è valido',
                        PIVA_ERROR: 'La Partita IVA non è valida',
                    },
                    en: {
                        INVOICE_REQUIRED_MESSAGE: 'Please enter your VAT number or Fiscal Code.',
                        CF_ERROR: 'The Fiscal Code is not valid',
                        PIVA_ERROR: 'The VAT number is not valid',
                    },
                };
                const browserLanguage = navigator.language.slice(0, 2);
                const messages = browserLanguage === 'it' ? errorMessages.it : errorMessages.en;

                let baseSchema: any;
                if (methodId === 'amazonpay') {
                    baseSchema = getCustomFormFieldsValidationSchema({
                        translate: getTranslateAddressError(language),
                        formFields: getFields(values.countryCode),
                    });
                } else {
                    baseSchema = getAddressFormFieldsValidationSchema({
                        language,
                        formFields: getFields(values.countryCode),
                    });
                }

                const extendedFields = {
                    ...baseSchema.fields,
                    wantsInvoice: Yup.boolean(),
                    customFields: Yup.object()
                        .shape({
                            field_29: Yup.string()
                                .nullable()
                                .test('cf-valid', messages.CF_ERROR, (value) => !value || isCodiceFiscaleValid(value)),
                            field_37: Yup.string()
                                .nullable()
                                .test('piva-valid', messages.PIVA_ERROR, (value) => !value || isPartitaIvaValid(value)),
                        })
                        .test(
                            'at-least-one-required-for-invoice',
                            messages.INVOICE_REQUIRED_MESSAGE,
                            function (value) {
                                const { wantsInvoice } = this.parent;
                                const { field_29, field_37 } = value || {};
                                if (!wantsInvoice) return true;
                                const cf = field_29?.trim();
                                const piva = field_37?.trim();
                                if (!cf && !piva) {
                                    return this.createError({
                                        path: `${this.path}.field_37`,
                                        message: messages.INVOICE_REQUIRED_MESSAGE,
                                    });
                                }
                                if (cf && !isCodiceFiscaleValid(cf)) {
                                    return this.createError({
                                        path: `${this.path}.field_29`,
                                        message: messages.CF_ERROR,
                                    });
                                }
                                if (piva && !isPartitaIvaValid(piva)) {
                                    return this.createError({
                                        path: `${this.path}.field_37`,
                                        message: messages.PIVA_ERROR,
                                    });
                                }
                                return true;
                            }
                        ),
                };
                return Yup.object(extendedFields);
            }),
        enableReinitialize: true,
    })(BillingForm),
);