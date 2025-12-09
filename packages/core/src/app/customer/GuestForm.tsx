import classNames from 'classnames';
import { type FieldProps, type FormikProps, withFormik } from 'formik';
// Riga modificata: aggiunto 'useState' agli import di React
import React, { type FunctionComponent, memo, type ReactNode, useCallback, useEffect, useState } from 'react';
import { object, string } from 'yup';

import { useCheckout, useThemeContext } from '@bigcommerce/checkout/contexts';
import { TranslatedString, withLanguage, type WithLanguageProps } from '@bigcommerce/checkout/locale';
import { PayPalFastlaneWatermark } from '@bigcommerce/checkout/paypal-fastlane-integration';

import { getPrivacyPolicyValidationSchema, PrivacyPolicyField } from '../privacyPolicy';
//import { Button, ButtonVariant } from '../ui/button';
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
    isExpressPrivacyPolicy,
    isFloatingLabelEnabled,
    shouldShowEmailWatermark,
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

    // NUOVA LOGICA: Stato per tracciare l'interazione dell'utente.
    // Inizia come 'false' e diventa 'true' solo quando l'utente digita.
    // Viene resettato a 'false' ogni volta che il componente si rimonta.
    const [hasUserTyped, setHasUserTyped] = useState(false);

    // BLOCCO useEffect MODIFICATO
    useEffect(() => {
        const isEmailValid = !!formValues.email && !formErrors.email;

        // CONDIZIONE CHIAVE: Il submit parte solo se l'utente ha GIÀ digitato
        // E l'email risultante è valida.
        if (!hasUserTyped || !isEmailValid) {
            return;
        }

        const timerId = setTimeout(() => {
            console.log('Debounced submit innescato dopo interazione utente:', formValues.email);
            handleSubmit();
        }, 5000);

        return () => {
            clearTimeout(timerId);
        };
    // Aggiungiamo 'hasUserTyped' all'array delle dipendenze.
    }, [formValues.email, formErrors.email, handleSubmit, hasUserTyped]);

    // NUOVA FUNZIONE: Questo handler si attiva ad ogni cambiamento nell'input email.
    // Esegue due azioni: aggiorna il form (tramite la prop) e imposta il nostro
    // stato di interazione a 'true'.
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
                <div className="customerEmail-container">
                    <div className="customerEmail-body">
                        {/* MODIFICA: Usiamo il nostro nuovo handler 'handleEmailChange' */}
                        <EmailField
                            isFloatingLabelEnabled={isFloatingLabelEnabled}
                            onChange={handleEmailChange}
                        />
                        {shouldShowEmailWatermark && <PayPalFastlaneWatermark />}

                        {(canSubscribe || requiresMarketingConsent) && (
                            <div className="subscribe-login-row">
                                {!isLoading && (
                                    <p
                                        className={classNames('customer-login-link-inline', {
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
                                  <BasicFormField name="shouldSubscribe" render={renderField} />
                            </div>
                        )}
                    </div>
                </div>

                {privacyPolicyUrl && (
                    <PrivacyPolicyField
                        isExpressPrivacyPolicy={isExpressPrivacyPolicy}
                        url={privacyPolicyUrl}
                    />
                )}

                {checkoutButtons}
            </Fieldset>
        </Form>
    );
};

export default withLanguage(
    withFormik<GuestFormProps & WithLanguageProps, GuestFormValues>({
        mapPropsToValues: ({ email = '', defaultShouldSubscribe = false, requiresMarketingConsent }) => ({
            email,
            shouldSubscribe: getShouldSubscribeValue(requiresMarketingConsent, defaultShouldSubscribe),
            privacyPolicy: false,
        }),
        handleSubmit: (values, { props: { onContinueAsGuest } }) => {
            console.log('GuestForm onContinueAsGuest', values);
            onContinueAsGuest(values);
        },
        validationSchema: ({ language, privacyPolicyUrl, isExpressPrivacyPolicy }: GuestFormProps & WithLanguageProps) => {
            const email = string()
                .email(language.translate('customer.email_invalid_error'))
                .max(256)
                .required(language.translate('customer.email_required_error'));

            const baseSchema = object({ email });

            if (privacyPolicyUrl && !isExpressPrivacyPolicy) {
                return baseSchema.concat(
                    getPrivacyPolicyValidationSchema({
                        isRequired: !!privacyPolicyUrl,
                        language,
                    }),
                );
            }

            return baseSchema;
        },
    })(memo(GuestForm)),
);