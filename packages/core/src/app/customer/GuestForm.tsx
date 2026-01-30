import classNames from 'classnames';
import { type FieldProps, type FormikProps, withFormik } from 'formik';
import React, { type FunctionComponent, memo, type ReactNode, useCallback, useEffect } from 'react';
import { object, string, lazy } from 'yup';
import { useCheckout, useThemeContext } from '@bigcommerce/checkout/contexts';
import { TranslatedString, withLanguage, type WithLanguageProps } from '@bigcommerce/checkout/locale';
import { PayPalFastlaneWatermark } from '@bigcommerce/checkout/paypal-fastlane-integration';
import { getPrivacyPolicyValidationSchema, PrivacyPolicyField } from '../privacyPolicy';
import { Button, ButtonVariant } from '../ui/button';
import { BasicFormField, CheckboxFormField, Fieldset, Form, Legend } from '../ui/form';
import { AddressForm, AddressType } from '../address';
import { hasDeductibleProduct } from '../custom/minsan-checker';
import type { Address } from '@bigcommerce/checkout-sdk';
import EmailField from './EmailField';
import SubscribeField from './SubscribeField';
import { SubscribeSessionStorage } from './SubscribeSessionStorage';
import { isCodiceFiscaleValid } from '../custom/codice-fiscale-validator';

function getShouldSubscribeValue(requiresMarketingConsent: boolean, defaultShouldSubscribe: boolean) {
    if (SubscribeSessionStorage.getSubscribeStatus()) { return true; }
    return requiresMarketingConsent ? false : defaultShouldSubscribe
}

export interface GuestFormProps {
    canSubscribe: boolean;
    checkoutButtons?: ReactNode;
    continueAsGuestButtonLabelId: string;
    requiresMarketingConsent: boolean;
    defaultShouldSubscribe: boolean;
    email?: string;
    isLoading: boolean;
    privacyPolicyUrl?: string;
    isExpressPrivacyPolicy: boolean;
    isFloatingLabelEnabled?: boolean;
    shouldShowEmailWatermark: boolean;
    shippingAddress?: Address;
    shippingAddressFields?: any[];
    onChangeEmail(email: string): void;
    onContinueAsGuest(data: GuestFormValues): void;
    onShowLogin(): void;
    shouldShowCodiceFiscale?: boolean;
    onBillingSameAsShippingChange?(isSame: boolean): void;
    isBillingSameAsShipping?: boolean;
}

export interface GuestFormValues {
    email: string;
    shouldSubscribe: boolean;
    shippingAddress?: any;
    privacyPolicy?: boolean;
    isBillingSameAsShipping: boolean;
    shouldShowCodiceFiscale?: boolean;
}

const GuestForm: FunctionComponent<
    GuestFormProps & WithLanguageProps & FormikProps<GuestFormValues>
> = ({
    canSubscribe,
    checkoutButtons,
    defaultShouldSubscribe,
    isLoading,
    onChangeEmail,
    onShowLogin,
    privacyPolicyUrl,
    requiresMarketingConsent,
    isExpressPrivacyPolicy,
    isFloatingLabelEnabled,
    shouldShowEmailWatermark,
    shippingAddress,
    shippingAddressFields = [],
    setFieldValue,
    values,
    onBillingSameAsShippingChange = () => { },
}) => {
        const { checkoutState: { data: { getConfig, getCart } } } = useCheckout();
        const { themeV2 } = useThemeContext();
        const config = getConfig();
        const cart = getCart();
        const shouldShowCodiceFiscale = hasDeductibleProduct(cart);
        const renderField = useCallback((fieldProps: FieldProps<boolean>) => (
            <SubscribeField {...fieldProps} requiresMarketingConsent={requiresMarketingConsent} />
        ), [requiresMarketingConsent]);

        useEffect(() => {
            void setFieldValue('shouldSubscribe', getShouldSubscribeValue(requiresMarketingConsent, defaultShouldSubscribe));
        }, [requiresMarketingConsent, defaultShouldSubscribe, setFieldValue]);

        const handleLogin = () => {
            const { checkoutSettings: { shouldRedirectToStorefrontForAuth }, links: { checkoutLink, loginLink } } = config || { checkoutSettings: {}, links: {} };
            if (shouldRedirectToStorefrontForAuth) {
                window.location.assign(`${loginLink}?redirectTo=${checkoutLink}`);
            } else {
                onShowLogin();
            }
        };

            const handleShippingAddressChange = useCallback(
        (fieldName: string, value: string | string[]) => {
            setFieldValue(`shippingAddress.${fieldName}`, value);
        },
        [setFieldValue],
    );
    
        const handleBillingSameAsShippingChange = useCallback((isChecked: boolean) => {
            setFieldValue('isBillingSameAsShipping', isChecked);
            onBillingSameAsShippingChange(isChecked);
        }, [setFieldValue, onBillingSameAsShippingChange]);

        if (!config) { return null; }

        return (
            <Form className="checkout-form" id="checkout-customer-guest" testId="checkout-customer-guest">
                <Fieldset legend={<Legend hidden><TranslatedString id="customer.guest_customer_text" /></Legend>}>
                    <div className="customerEmail-container">
                        <div className="customerEmail-body">
                            <EmailField isFloatingLabelEnabled={isFloatingLabelEnabled} onChange={onChangeEmail} value={values.email || ''} />
                            {shouldShowEmailWatermark && <PayPalFastlaneWatermark />}
                            <div className="link-order">
                                {(canSubscribe || requiresMarketingConsent) && (<BasicFormField name="shouldSubscribe" render={renderField} />)}

                                {!isLoading && (
                                    <p className={classNames('customer-login-link', { 'body-regular': themeV2 })}>
                                        <TranslatedString id="customer.login_text" />{' '}
                                        <a data-test="customer-continue-button" id="checkout-customer-login" onClick={handleLogin} role="button" tabIndex={0}>
                                            <TranslatedString id="customer.login_action" />
                                        </a>
                                    </p>
                                )}
                                {checkoutButtons}
                            </div>
                            {privacyPolicyUrl && (<PrivacyPolicyField isExpressPrivacyPolicy={isExpressPrivacyPolicy} url={privacyPolicyUrl} />)}
                        </div>
                    </div>

                    <Fieldset legend={<Legend><TranslatedString id="shipping.shipping_address_heading" /></Legend>}>
                        <AddressForm
 countryCode={values.shippingAddress?.countryCode || shippingAddress?.countryCode}
                        fieldName="shippingAddress"
                        formFields={shippingAddressFields}
                        /* Passa la funzione `setFieldValue` direttamente per l'autocomplete */
                        setFieldValue={setFieldValue}
                        /* Usa il nostro "ponte" per i campi individuali */
                        onChange={handleShippingAddressChange}
                        shouldShowCodiceFiscale={shouldShowCodiceFiscale}
                        shouldShowSaveAddress={false}
                        type={AddressType.Shipping}
                         addressValues={values.shippingAddress || shippingAddress}
                        />
                    </Fieldset>
                    <CheckboxFormField
                        labelContent={<TranslatedString id="billing.use_shipping_address_label" />}
                        name="isBillingSameAsShipping"
                        onChange={handleBillingSameAsShippingChange}
                    />
                    <div className="form-actions">
                        <Button className={classNames({ 'body-bold': themeV2 })} id="checkout-customer-continue" isLoading={isLoading} testId="customer-continue-as-guest-button" type="submit" variant={ButtonVariant.Primary}>
                            <TranslatedString id="common.continue_action" />
                        </Button>
                    </div>
                </Fieldset>
            </Form>
        );
    };

export default withLanguage(
    withFormik<GuestFormProps & WithLanguageProps, GuestFormValues>({
        mapPropsToValues: ({
            email = '',
            defaultShouldSubscribe = false,
            requiresMarketingConsent,
            shippingAddress,
            isBillingSameAsShipping = true,
            shouldShowCodiceFiscale = false,
        }) => ({
            email: email || '',
            shouldSubscribe: getShouldSubscribeValue(requiresMarketingConsent, defaultShouldSubscribe),
            privacyPolicy: false,
            shouldShowCodiceFiscale,
            shippingAddress: {
                ...shippingAddress,
                countryCode: shippingAddress?.countryCode || '',
                customFields: (shippingAddress?.customFields ?? []).reduce((acc, f) => {
                    const value = Array.isArray(f.fieldValue)
                        ? f.fieldValue.join(',')
                        : String(f.fieldValue || '');
                    acc[f.fieldId] = value;
                    return acc;
                }, {} as Record<string, string>),
            },
            isBillingSameAsShipping,
        }),

        handleSubmit: (values, { props: { onContinueAsGuest } }) => {
            onContinueAsGuest(values);
        },

     validationSchema: ({
    language,
    privacyPolicyUrl,
    isExpressPrivacyPolicy,
}: GuestFormProps & WithLanguageProps) =>
    lazy((values: any) => {
        /* =======================
         *  LINGUA (browser → messaggi errore)
         * ======================= */
        const errorMessages = {
            it: {
                REQUIRED: 'Inserire il Codice Fiscale.',
                INVALID: 'Codice Fiscale non valido.',
                FIRST_NAME_REQUIRED: 'Inserire il nome.',
                LAST_NAME_REQUIRED: 'Inserire il cognome.',
                PHONE_REQUIRED: 'Inserire il numero di telefono.',
                PHONE_INVALID: 'Numero di telefono non valido.',
                ADDRESS1_REQUIRED: 'Inserire l\'indirizzo.',
                ADDRESS2_REQUIRED: 'Inserire il numero civico.',
                CITY_REQUIRED: 'Inserire la città.',
                POSTAL_CODE_REQUIRED: 'Inserire il codice postale.',
                COUNTRY_REQUIRED: 'Selezionare un paese.',
                STATE_REQUIRED: 'Selezionare una provincia.',
            },
            en: {
                REQUIRED: 'Please enter your Fiscal Code.',
                INVALID: 'The Fiscal Code is not valid.',
                FIRST_NAME_REQUIRED: 'Please enter your first name.',
                LAST_NAME_REQUIRED: 'Please enter your last name.',
                PHONE_REQUIRED: 'Please enter your phone number.',
                PHONE_INVALID: 'Invalid phone number.',
                ADDRESS1_REQUIRED: 'Please enter your address.',
                ADDRESS2_REQUIRED: 'Please enter your street number.',
                CITY_REQUIRED: 'Please enter your city.',
                POSTAL_CODE_REQUIRED: 'Please enter your postal code.',
                COUNTRY_REQUIRED: 'Please select a country.',
                STATE_REQUIRED: 'Please select a state/province.',
            },
        };

        const browserLanguage =
            typeof navigator !== 'undefined'
                ? navigator.language.toLowerCase()
                : 'en';

        const lang = browserLanguage.startsWith('it') ? 'it' : 'en';
        const messages = errorMessages[lang];

        /* =======================
         *  EMAIL (BigCommerce)
         * ======================= */
        const email = string()
            .email(language.translate('customer.email_invalid_error'))
            .max(256)
            .required(language.translate('customer.email_required_error'));

        /* =======================
         *  CALCOLA shouldShowCodiceFiscale
         * ======================= */
        const shouldShowCodiceFiscale = values.shouldShowCodiceFiscale || false;

        /* =======================
         *  CUSTOM FIELDS (Codice Fiscale)
         * ======================= */
        const customFieldsValidation = shouldShowCodiceFiscale
            ? object().shape({
                field_29: string()
                    .required(messages.REQUIRED)
                    .test(
                        'cf-valid',
                        messages.INVALID,
                        (value) => !value || isCodiceFiscaleValid(value)
                    ),
            })
            : object().shape({
                field_29: string()
                    .nullable()
                    .test(
                        'cf-valid',
                        messages.INVALID,
                        (value) => !value || isCodiceFiscaleValid(value)
                    ),
            });

        /* =======================
         *  SHIPPING ADDRESS (TUTTI I CAMPI)
         * ======================= */
        const shippingAddress = object({
            // Nome
            firstName: string()
                .trim()
                .required(messages.FIRST_NAME_REQUIRED)
                .max(100, lang === 'it' ? 'Il nome è troppo lungo (max 100 caratteri)' : 'First name is too long (max 100 characters)'),
            
            // Cognome
            lastName: string()
                .trim()
                .required(messages.LAST_NAME_REQUIRED)
                .max(100, lang === 'it' ? 'Il cognome è troppo lungo (max 100 caratteri)' : 'Last name is too long (max 100 characters)'),
            
            // Telefono
            phone: string()
                .trim()
                .required(messages.PHONE_REQUIRED)
                .matches(
                    /^[\d\s\-\+\(\)]+$/,
                    messages.PHONE_INVALID
                )
                .min(6, lang === 'it' ? 'Il numero di telefono è troppo corto' : 'Phone number is too short')
                .max(20, lang === 'it' ? 'Il numero di telefono è troppo lungo' : 'Phone number is too long'),
            
            // Indirizzo (address1)
            address1: string()
                .trim()
                .required(messages.ADDRESS1_REQUIRED)
                .max(255, lang === 'it' ? 'L\'indirizzo è troppo lungo' : 'Address is too long'),
            
            // Numero civico (address2)
            address2: string()
                .trim()
                .required(messages.ADDRESS2_REQUIRED)
                .max(255, lang === 'it' ? 'Il numero civico è troppo lungo' : 'Street number is too long'),
            
            // Città
            city: string()
                .trim()
                .required(messages.CITY_REQUIRED)
                .max(100, lang === 'it' ? 'Il nome della città è troppo lungo' : 'City name is too long'),
            
            // Codice postale
            postalCode: string()
                .trim()
                .required(messages.POSTAL_CODE_REQUIRED)
                .max(20, lang === 'it' ? 'Il codice postale è troppo lungo' : 'Postal code is too long'),
            
            // Paese
            countryCode: string()
                .required(messages.COUNTRY_REQUIRED),
            
            // Provincia/Stato
            stateOrProvinceCode: string()
                .required(messages.STATE_REQUIRED),
            
            // Custom Fields (Codice Fiscale)
            customFields: customFieldsValidation,
        });

        let schema = object({
            email,
            shippingAddress,
        });

        /* =======================
         *  PRIVACY POLICY
         * ======================= */
        if (privacyPolicyUrl && !isExpressPrivacyPolicy) {
            schema = schema.concat(
                getPrivacyPolicyValidationSchema({
                    isRequired: true,
                    language,
                }),
            );
        }

        return schema;
    }),

    })(memo(GuestForm)),
);