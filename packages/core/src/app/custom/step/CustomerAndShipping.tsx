// /custom/step/CustomerAndShipping.tsx

import React, { type FunctionComponent, useState } from 'react';
import { useFormik, FormikProvider, Form } from 'formik';
import { type ArraySchema, object, string, array } from 'yup';
import { type Address, type FormField } from '@bigcommerce/checkout-sdk/essential';

import { useCheckout, useLocale } from '@bigcommerce/checkout/contexts';
import { TranslatedString } from '@bigcommerce/checkout/locale';
import { isCodiceFiscaleValid, isPartitaIvaValid } from '../utils/codice-fiscale-validator';

import { Fieldset, Legend } from '../../ui/form';
import { Button } from '../../ui/button';
import EmailField from '../../customer/EmailField';
import { AddressForm, AddressType } from '../../address';
import type CheckoutStepStatus from '../../checkout/CheckoutStepStatus';

// --- TIPI (invariati) ---

export interface CustomerShippingFormValues {
    email: string;
    shippingAddress: Address;
    shouldSubscribe: boolean;
}

export interface CustomerAndShippingProps {
    step: CheckoutStepStatus;
    formFields: FormField[];
    shouldShowCodiceFiscale: boolean;
    email?: string;
    shippingAddress?: Address;
    isPending: boolean;
    onStepFinished(): void;
    onError(error: Error): void;
}

// --- COMPONENTE PRINCIPALE ---

const CustomerAndShipping: FunctionComponent<CustomerAndShippingProps> = ({
    isPending,
    shouldShowCodiceFiscale,
    formFields,
    onStepFinished,
    onError,
    email: initialEmail,
    shippingAddress: initialShippingAddress,
}) => {
    const [subStep, setSubStep] = useState<'email' | 'address'>('email');
    const { checkoutService } = useCheckout();
    const { language } = useLocale();

    const formik = useFormik<CustomerShippingFormValues>({
        initialValues: {
            email: initialEmail || '',
            shippingAddress: initialShippingAddress || {
                firstName: '', lastName: '', company: '', phone: '', address1: '', address2: '',
                city: '', stateOrProvince: '', stateOrProvinceCode: '', postalCode: '',
                country: '', countryCode: '', customFields: [],
            },
            shouldSubscribe: false,
        },
        
        validationSchema: object({
            email: string()
                .email(language.translate('customer.email_invalid_error'))
                .required(language.translate('customer.email_required_error')),
            
            shippingAddress: object().shape({
                customFields: array().when([], {
                    is: () => shouldShowCodiceFiscale,
                    then: (schema: ArraySchema<any[]>) => schema.test(
                        'codice-fiscale-validation',
                        'Codice Fiscale o P.IVA non valido',
                        (customFields: Array<{ fieldId: string; fieldValue: any }> | undefined) => {
                            if (!customFields) return true;
                            const cfField = customFields.find((field) => field.fieldId === 'field_29');
                            if (!cfField || !cfField.fieldValue) return true;
                            const value = cfField.fieldValue.toString();
                            return isCodiceFiscaleValid(value) || isPartitaIvaValid(value);
                        }
                    ),
                }),
            }),
        }),
        
        onSubmit: async (values) => {
            console.log("onSubmit CHIAMATO!", values); // Aggiungiamo un log qui per la conferma finale
            try {
                await checkoutService.updateShippingAddress(values.shippingAddress);
                
                if (values.shouldSubscribe) {
                     await checkoutService.updateSubscriptions({
                        email: values.email,
                        acceptsMarketingNewsletter: true,
                        acceptsAbandonedCartEmails: false,
                    });
                }
                onStepFinished();
            } catch (error) {
                onError(error as Error);
            }
        },
    });

    const { values, setFieldValue, validateForm, handleSubmit } = formik;

    // ++ INIZIO MODIFICA ++
    // Questa funzione speciale gestirà i cambiamenti provenienti da AddressForm.
    const handleAddressFormChange = (fieldName: string, value: string | string[]) => {
        // Controlliamo se il campo è un custom field cercandolo nell'array originale dei formFields.
        const isCustom = formFields.some(field => field.name === fieldName && field.custom);

        if (isCustom) {
            // Se è un custom field, lo gestiamo nel formato ARRAY corretto.
            const newCustomFields = [...(values.shippingAddress.customFields || [])];
            const fieldIndex = newCustomFields.findIndex(field => field.fieldId === fieldName);
            const fieldValue = Array.isArray(value) ? value[0] : value;

            if (fieldIndex > -1) {
                newCustomFields[fieldIndex].fieldValue = fieldValue;
            } else {
                newCustomFields.push({ fieldId: fieldName, fieldValue });
            }
            
            setFieldValue('shippingAddress.customFields', newCustomFields);
        } else {
            // Se è un campo standard, lo aggiorniamo normalmente.
            setFieldValue(`shippingAddress.${fieldName}`, value);
        }
    };
    // ++ FINE MODIFICA ++

    const handleContinueToAddress = async () => {
        const validationErrors = await validateForm();
        if (validationErrors.email) { return; }

        try {
            await checkoutService.continueAsGuest({ email: values.email });
            setSubStep('address');
        } catch (error) {
            onError(error as Error);
        }
    };

    const filteredFormFields = formFields.filter(field => 
        field.name !== 'address2' && field.name !== 'company'
    );

    return (
        <FormikProvider value={formik}>
            <div className="checkout-form" id="checkout-customer-shipping">
                <Form onSubmit={handleSubmit}>
                    <Fieldset legend={<Legend><TranslatedString id="customer.guest_customer_text" /></Legend>}>
                        {subStep === 'email' && (
                            <EmailField isFloatingLabelEnabled={false} onChange={(email) => setFieldValue('email', email)} />
                        )}
                        {subStep === 'address' && (
                            <div className="form-field">
                                <strong><TranslatedString id="customer.email_label" />:</strong> {values.email}
                                <a onClick={() => setSubStep('email')} style={{ marginLeft: '1rem', cursor: 'pointer' }}>
                                    (<TranslatedString id="common.edit_action" />)
                                </a>
                            </div>
                        )}
                    </Fieldset>

                    {subStep === 'address' && (
                        <Fieldset legend={<Legend><TranslatedString id="shipping.shipping_address_heading" /></Legend>}>
                            <AddressForm
                                fieldName="shippingAddress"
                                formFields={filteredFormFields}
                                // ++ INIZIO MODIFICA ++
                                // Rimuoviamo setFieldValue e passiamo la nostra funzione custom a 'onChange'.
                                onChange={handleAddressFormChange}
                                // ++ FINE MODIFICA ++
                                shouldShowCodiceFiscale={shouldShowCodiceFiscale}
                                type={AddressType.Shipping}
                            />
                        </Fieldset>
                    )}

                    <div className="form-actions">
                        {subStep === 'email' && (
                            <Button
                                isLoading={isPending}
                                onClick={handleContinueToAddress}
                                testId="customer-continue-button"
                                type="button"
                            >
                                <TranslatedString id="common.continue_action" />
                            </Button>
                        )}
                        {subStep === 'address' && (
                            <Button
                                isLoading={isPending}
                                testId="shipping-continue-button"
                                type="submit"
                            >
                                <TranslatedString id="common.continue_action" />
                            </Button>
                        )}
                    </div>
                </Form>
            </div>
        </FormikProvider>
    );
};

export default CustomerAndShipping;