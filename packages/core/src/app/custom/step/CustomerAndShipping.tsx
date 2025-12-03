// CustomerAndShipping.tsx
import React, { type FunctionComponent, useEffect, useCallback } from 'react';
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
import CheckoutStepType from '../../checkout/CheckoutStepType';

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
    onError(error: Error): void;
    onEdit(type: CheckoutStepType): void;
    onExpanded(): void;          // <<< senza argomenti
    onReady(): void;
    onAddressSaved(): void;
}

const CustomerAndShipping: FunctionComponent<CustomerAndShippingProps> = ({
    step,
    isPending,
    shouldShowCodiceFiscale,
    formFields,
    onError,
    onAddressSaved,
    onEdit,
    onExpanded,
    onReady,
    email: initialEmail,
    shippingAddress: initialShippingAddress,
}) => {
    const { checkoutService } = useCheckout();
    const { language } = useLocale();

    useEffect(() => {
        onReady();
    }, [onReady]);

    useEffect(() => {
        if (step.isActive) {
            onExpanded();
        }
    }, [step.isActive, onExpanded]);

    const formik = useFormik<CustomerShippingFormValues>({
        initialValues: {
            email: initialEmail || '',
            shippingAddress: initialShippingAddress || {
                firstName: '',
                lastName: '',
                company: '',
                phone: '',
                address1: '',
                address2: '',
                city: '',
                stateOrProvince: '',
                stateOrProvinceCode: '',
                postalCode: '',
                country: '',
                countryCode: '',
                customFields: [],
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
                    then: (schema: ArraySchema<any[]>) =>
                        schema.test(
                            'codice-fiscale-validation',
                            'Codice Fiscale o P.IVA non valido',
                            (
                                customFields:
                                    | Array<{ fieldId: string; fieldValue: any }>
                                    | undefined,
                            ) => {
                                if (!customFields) return true;
                                const cfField = customFields.find(
                                    (field) => field.fieldId === 'field_29',
                                );
                                if (!cfField || !cfField.fieldValue) return true;
                                const value = cfField.fieldValue.toString();
                                return (
                                    isCodiceFiscaleValid(value) ||
                                    isPartitaIvaValid(value)
                                );
                            },
                        ),
                }),
            }),
        }),

        onSubmit: async (values, { setSubmitting }) => {
            try {
                const shippingAddressPayload = {
                    ...values.shippingAddress,
                    customFields: (values.shippingAddress.customFields || [])
                        .filter(
                            (field) =>
                                field.fieldValue !== null &&
                                field.fieldValue !== undefined,
                        )
                        .map((field) => ({
                            ...field,
                            fieldValue: String(field.fieldValue),
                        })),
                };

                await checkoutService.continueAsGuest({ email: values.email });

                await checkoutService.updateShippingAddress(
                    shippingAddressPayload,
                );

                if (values.shouldSubscribe) {
                    await checkoutService.updateSubscriptions({
                        email: values.email,
                        acceptsMarketingNewsletter: true,
                        acceptsAbandonedCartEmails: false,
                    });
                }

                onAddressSaved();
            } catch (error) {
                onError(error as Error);
            } finally {
                setSubmitting(false);
            }
        },
    });

    const { values, setFieldValue, handleSubmit } = formik;

    const handleAddressFormChange = useCallback(
        (fieldName: string, value: string | string[]) => {
            const isCustom = formFields.some(
                (field) => field.name === fieldName && field.custom,
            );

            if (isCustom) {
                const newCustomFields = [
                    ...(values.shippingAddress.customFields || []),
                ];
                const fieldIndex = newCustomFields.findIndex(
                    (field) => field.fieldId === fieldName,
                );
                const fieldValue = Array.isArray(value) ? value[0] : value;

                if (fieldIndex > -1) {
                    newCustomFields[fieldIndex].fieldValue = fieldValue;
                } else {
                    newCustomFields.push({ fieldId: fieldName, fieldValue });
                }

                setFieldValue(
                    'shippingAddress.customFields',
                    newCustomFields,
                );
            } else {
                setFieldValue(`shippingAddress.${fieldName}`, value);
            }
        },
        [formFields, setFieldValue, values.shippingAddress.customFields],
    );

    const handleEditEmail = useCallback(() => {
        onEdit(step.type);
    }, [onEdit, step.type]);

    const filteredFormFields = formFields.filter(
        (field) => field.name !== 'address2' && field.name !== 'company',
    );

    return (
        <FormikProvider value={formik}>
            <div className="checkout-form" id="checkout-customer-shipping">
                <Form onSubmit={handleSubmit}>
                    <Fieldset>
                        <div className="form-field">
                            <EmailField
                                isFloatingLabelEnabled={false}
                                onChange={(email) =>
                                    setFieldValue('email', email)
                                }
                            />
                            {initialEmail && (
                                <div style={{ marginTop: '0.5rem' }}>
                                    <strong>
                                        <TranslatedString id="customer.email_label" />:
                                    </strong>{' '}
                                    {values.email}
                                    <a
                                        onClick={handleEditEmail}
                                        style={{
                                            marginLeft: '1rem',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        (
                                        <TranslatedString id="common.edit_action" />
                                        )
                                    </a>
                                </div>
                            )}
                        </div>
                    </Fieldset>

                    <Fieldset
                        legend={
                            <Legend>
                                <TranslatedString id="shipping.shipping_address_heading" />
                            </Legend>
                        }
                    >
                        <AddressForm
                            fieldName="shippingAddress"
                            formFields={filteredFormFields}
                            onChange={handleAddressFormChange}
                            shouldShowCodiceFiscale={shouldShowCodiceFiscale}
                            type={AddressType.Shipping}
                        />
                    </Fieldset>

                    <div className="form-actions">
                        <Button
                            isLoading={isPending}
                            testId="shipping-continue-button"
                            type="submit"
                        >
                            <TranslatedString id="common.continue_action" />
                        </Button>
                    </div>
                </Form>
            </div>
        </FormikProvider>
    );
};

export default CustomerAndShipping;
