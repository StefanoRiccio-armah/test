// packages/core/src/app/customer/GuestForm.tsx
// (Sostituisci l'intero file)

import classNames from 'classnames';
import { type FieldProps, type FormikProps, withFormik } from 'formik';
import React, { type FunctionComponent, memo, type ReactNode, useCallback, useEffect } from 'react';
import { object, string } from 'yup';

import { useCheckout, useThemeContext } from '@bigcommerce/checkout/contexts';
import { TranslatedString, withLanguage, type WithLanguageProps } from '@bigcommerce/checkout/locale';
import { PayPalFastlaneWatermark } from '@bigcommerce/checkout/paypal-fastlane-integration';

import { getPrivacyPolicyValidationSchema, PrivacyPolicyField } from '../privacyPolicy';
import { Button, ButtonVariant } from '../ui/button';
import { BasicFormField, CheckboxFormField, Fieldset, Form, Legend } from '../ui/form';
import { AddressForm, AddressType } from '../address';
import type { Address } from '@bigcommerce/checkout-sdk';

import EmailField from './EmailField';
import SubscribeField from './SubscribeField';
import { SubscribeSessionStorage } from './SubscribeSessionStorage';

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
    // NUOVE PROPS
    onBillingSameAsShippingChange?(isSame: boolean): void;
    isBillingSameAsShipping?: boolean;
}

export interface GuestFormValues {
    email: string;
    shouldSubscribe: boolean;
    shippingAddress?: any;
    privacyPolicy?: boolean;
    isBillingSameAsShipping: boolean;
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
    // Destruttura
    onBillingSameAsShippingChange = () => {},
}) => {
    const { checkoutState: { data: { getConfig } } } = useCheckout();
    const { themeV2 } = useThemeContext();

    const config = getConfig();

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
    
    // NUOVO HANDLER per il checkbox
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
                        <EmailField isFloatingLabelEnabled={isFloatingLabelEnabled} onChange={onChangeEmail} />
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
                    </div>
                </div>

                <Fieldset legend={<Legend>Dati Personali e Indirizzo di Spedizione</Legend>}>
                    <AddressForm
                        countryCode={values.shippingAddress?.countryCode || shippingAddress?.countryCode}
                        fieldName="shippingAddress"
                        formFields={shippingAddressFields}
                        shouldShowSaveAddress={false}
                        type={AddressType.Shipping}
                    />
                </Fieldset>
                
                {/* NUOVO COMPONENTE: Il Checkbox per la fatturazione */}
                <CheckboxFormField
                    labelContent={<TranslatedString id="billing.use_shipping_address_label" />}
                    name="isBillingSameAsShipping"
                    onChange={handleBillingSameAsShippingChange}
                />
                
                {privacyPolicyUrl && (<PrivacyPolicyField isExpressPrivacyPolicy={isExpressPrivacyPolicy} url={privacyPolicyUrl} />)}

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
            isBillingSameAsShipping = true, // Usa il valore passato come prop
        }) => ({
            email,
            shouldSubscribe: getShouldSubscribeValue(requiresMarketingConsent, defaultShouldSubscribe),
            privacyPolicy: false,
            shippingAddress: shippingAddress || {},
            isBillingSameAsShipping, // Imposta il valore iniziale per Formik
        }),
        handleSubmit: (values, { props: { onContinueAsGuest } }) => {
            onContinueAsGuest(values);
        },
        validationSchema: ({ language, privacyPolicyUrl, isExpressPrivacyPolicy }: GuestFormProps & WithLanguageProps) => {
            const email = string().email(language.translate('customer.email_invalid_error')).max(256).required(language.translate('customer.email_required_error'));
            const baseSchema = object({ email });
            if (privacyPolicyUrl && !isExpressPrivacyPolicy) {
                return baseSchema.concat(getPrivacyPolicyValidationSchema({ isRequired: !!privacyPolicyUrl, language }));
            }
            return baseSchema;
        },
    })(memo(GuestForm)),
);