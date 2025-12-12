import classNames from 'classnames';
import { type FieldProps, type FormikProps, withFormik } from 'formik';
import React, { type FunctionComponent, memo, type ReactNode, useCallback, useEffect, useState } from 'react';
import { object, string } from 'yup';

import { useCheckout, useThemeContext } from '@bigcommerce/checkout/contexts';
import { TranslatedString, withLanguage, type WithLanguageProps } from '@bigcommerce/checkout/locale';
import { PayPalFastlaneWatermark } from '@bigcommerce/checkout/paypal-fastlane-integration';

import { PrivacyPolicyField } from '../privacyPolicy';
import { BasicFormField, Fieldset, Form, Legend } from '../ui/form';

import EmailField from './EmailField';
import SubscribeField from './SubscribeField';
import { SubscribeSessionStorage } from './SubscribeSessionStorage';


function getShouldSubscribeValue(requiresMarketingConsent: boolean, defaultShouldSubscribe: boolean) {
    if (SubscribeSessionStorage.getSubscribeStatus()) {
        return true;
    }

    return requiresMarketingConsent ? false : defaultShouldSubscribe;
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
    onChangeEmail(email: string): void;
    onContinueAsGuest(data: GuestFormValues): void;
    onShowLogin(): void;
}

export interface GuestFormValues {
    email: string;
    shouldSubscribe: boolean;
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
    isFloatingLabelEnabled,
    shouldShowEmailWatermark,
    isExpressPrivacyPolicy,
    setFieldValue,
    handleSubmit,
    values:formValues,
    errors:formErrors,
}) => {
    const {
        checkoutState: {
            data: { getConfig },
        },
    } = useCheckout();
    
    const { themeV2 } = useThemeContext();
    const config = getConfig();

    const [hasUserTyped, setHasUserTyped] = useState(false);

    useEffect(() => {
        const isEmailValid = !!formValues.email && !formErrors.email;

        if (!hasUserTyped || !isEmailValid) {
            return;
        }

        const timerId = setTimeout(() => {
            handleSubmit();
        }, 3000);

        return () => {
            clearTimeout(timerId);
        };
    }, [formValues.email, formErrors.email, handleSubmit, hasUserTyped]);

    const handleEmailChange = useCallback((email: string) => {
        onChangeEmail(email);
        setHasUserTyped(true);
    }, [onChangeEmail]);

    const renderField = useCallback(
        (fieldProps: FieldProps<boolean>) => (
            <SubscribeField {...fieldProps} requiresMarketingConsent={requiresMarketingConsent} />
        ),
        [requiresMarketingConsent],
    );

    useEffect(() => {
        void setFieldValue(
            'shouldSubscribe',
            getShouldSubscribeValue(requiresMarketingConsent, defaultShouldSubscribe),
        );
    }, [requiresMarketingConsent, defaultShouldSubscribe]);

    if (!config) {
        return null;
    }

    const {
        checkoutSettings: { shouldRedirectToStorefrontForAuth },
        links: { checkoutLink, loginLink },
    } = config;

    const handleLogin: () => void = () => {
        if (shouldRedirectToStorefrontForAuth) {
            window.location.assign(`${loginLink}?redirectTo=${checkoutLink}`);
            return;
        }
        return onShowLogin();
    };

return (
    <Form className="checkout-form" id="checkout-customer-guest" testId="checkout-customer-guest">
        <Fieldset
            legend={
                <Legend hidden>
                    <TranslatedString id="customer.guest_customer_text" />
                </Legend>
            }
        >
            <div className="form-body">
                <EmailField
                    isFloatingLabelEnabled={isFloatingLabelEnabled}
                    onChange={handleEmailChange}
                />
                {shouldShowEmailWatermark && <PayPalFastlaneWatermark />}

               <div className="privacy-login-container">
                <div className="first-row">
                    {privacyPolicyUrl && (
                        <PrivacyPolicyField isExpressPrivacyPolicy={isExpressPrivacyPolicy} url={privacyPolicyUrl} />
                    )}
                    
                {(canSubscribe || requiresMarketingConsent) && (
                    <div className="form-field">
                        <BasicFormField name="shouldSubscribe" render={renderField} />
                    </div>
                )}
                </div>

                    {!isLoading && (
                        <p
                            className={classNames('customer-login-link', {
                                'body-regular': themeV2,
                            })}
                        >
                            <TranslatedString id="customer.login_text" />{' '}
                            <a
                                data-test="customer-continue-button"
                                id="checkout-customer-login"
                                onClick={handleLogin}
                                role="button"
                                tabIndex={0}
                            >
                                <TranslatedString id="customer.login_action" />
                            </a>
                        </p>
                    )}
                </div>
                    {checkoutButtons}

            </div>
        </Fieldset>
    </Form>
);
};

export default withLanguage(
    withFormik<GuestFormProps & WithLanguageProps, GuestFormValues>({
        mapPropsToValues: ({ email = '', defaultShouldSubscribe = false, requiresMarketingConsent }) => ({
            email,
            shouldSubscribe: getShouldSubscribeValue(requiresMarketingConsent, defaultShouldSubscribe),
        }),
        handleSubmit: (values, { props: { onContinueAsGuest } }) => {
            onContinueAsGuest(values);
        },
        validationSchema: ({ language }: GuestFormProps & WithLanguageProps) => {
            const email = string()
                .email(language.translate('customer.email_invalid_error'))
                .max(256)
                .required(language.translate('customer.email_required_error'));
            
            return object({ email });
        },
    })(memo(GuestForm)),
);