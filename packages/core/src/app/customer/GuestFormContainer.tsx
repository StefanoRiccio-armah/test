import { type Cart,type Address, type FormField } from '@bigcommerce/checkout-sdk';
import React from 'react';

import { useCheckout } from '@bigcommerce/checkout/contexts';
import { shouldUseStripeLinkByMinimumAmount } from '@bigcommerce/checkout/instrument-utils';
import { PaymentMethodId } from '@bigcommerce/checkout/payment-integration-api';
import { isPayPalFastlaneMethod } from '@bigcommerce/checkout/paypal-fastlane-integration';

import type CheckoutStepStatus from '../checkout/CheckoutStepStatus';
import getProviderWithCustomCheckout from '../payment/getProviderWithCustomCheckout';

import CheckoutButtonList from './CheckoutButtonList';
import GuestForm, { type GuestFormValues } from './GuestForm';
import StripeGuestForm from './StripeGuestForm';

interface GuestFormContainerProps {
    email?: string;
    isFloatingLabelEnabled?: boolean;
    isWalletButtonsOnTop: boolean;
    isSubscribed: boolean;
    step: CheckoutStepStatus;
    checkEmbeddedSupport?(methodIds: string[]): void;
    handleChangeEmail(email: string): void;
    handleContinueAsGuest(formValues: GuestFormValues): void;
    handleShowLogin(): void;
    onWalletButtonClick?(methodName: string): void;
    onUnhandledError?(error: Error): void;
    shippingAddress?: Address;
    shippingAddressFields?: FormField[];
    // NUOVE PROPS
    onBillingSameAsShippingChange?(isSame: boolean): void;
    isBillingSameAsShipping?: boolean;
}

function shouldRenderStripeForm(cart: Cart, providerWithCustomCheckout?: string) {
    return providerWithCustomCheckout === PaymentMethodId.StripeUPE
        && shouldUseStripeLinkByMinimumAmount(cart);
}

export const GuestFormContainer: React.FC<GuestFormContainerProps> = ({
    email,
    isFloatingLabelEnabled,
    isWalletButtonsOnTop,
    isSubscribed,
    step,
    checkEmbeddedSupport,
    handleChangeEmail,
    handleContinueAsGuest,
    handleShowLogin,
    onWalletButtonClick,
    onUnhandledError,
    shippingAddress,
    shippingAddressFields = [],
    // Destruttura
    onBillingSameAsShippingChange,
    isBillingSameAsShipping,
}) => {
    const { checkoutState, checkoutService } = useCheckout();
    const { data: { isPaymentDataRequired, getConfig, getCart }, statuses: { isInitializingCustomer, isContinuingAsGuest, isExecutingPaymentMethodCheckout } } = checkoutState;
    const { deinitializeCustomer, initializeCustomer } = checkoutService;
    const config = getConfig();
    const cart = getCart();
    const isLoadingGuestForm = isContinuingAsGuest() || isExecutingPaymentMethodCheckout();

    if (!config || !cart) { return null; }

    // Estrai le impostazioni dal file di configurazione
    const {
        checkoutSettings: {
            // Rinomina la variabile originale per evitare conflitti
            privacyPolicyUrl: originalPrivacyPolicyUrl,
            requiresMarketingConsent,
            remoteCheckoutProviders: checkoutButtonIds,
            providerWithCustomCheckout,
            isExpressPrivacyPolicy
        },
        shopperConfig: {
            showNewsletterSignup: canSubscribe
        }
    } = config;

    // Crea una nuova variabile per l'URL della privacy policy.
    // Se l'URL dal backend (originalPrivacyPolicyUrl) esiste, usa quello.
    // Altrimenti, usa l'URL hardcodato come fallback.
    // Cambia 'https://www.tuo-sito.com/privacy' con il tuo URL effettivo.
    const privacyPolicyUrl = originalPrivacyPolicyUrl || 'https://www.petroneonline.com/privacy-policy';

    const customCheckoutProvider = getProviderWithCustomCheckout(providerWithCustomCheckout);
    const checkoutButtons = isWalletButtonsOnTop || !isPaymentDataRequired() ? null : <CheckoutButtonList checkEmbeddedSupport={checkEmbeddedSupport} deinitialize={deinitializeCustomer} initialize={initializeCustomer} isInitializing={isInitializingCustomer()} methodIds={checkoutButtonIds} onClick={onWalletButtonClick} onError={onUnhandledError} />;

    if (shouldRenderStripeForm(cart, customCheckoutProvider)) {
        return <StripeGuestForm
            canSubscribe={canSubscribe}
            checkoutButtons={checkoutButtons}
            continueAsGuestButtonLabelId="customer.continue"
            defaultShouldSubscribe={isSubscribed}
            deinitialize={deinitializeCustomer}
            email={email}
            initialize={initializeCustomer}
            isExpressPrivacyPolicy={isExpressPrivacyPolicy}
            isLoading={isContinuingAsGuest() || isInitializingCustomer() || isExecutingPaymentMethodCheckout()}
            onChangeEmail={handleChangeEmail}
            onContinueAsGuest={handleContinueAsGuest}
            onShowLogin={handleShowLogin}
            // Usa la nuova variabile che ha sempre un valore
            privacyPolicyUrl={privacyPolicyUrl}
            requiresMarketingConsent={requiresMarketingConsent}
            step={step}
        />;
    }

    return <GuestForm
        canSubscribe={canSubscribe}
        checkoutButtons={checkoutButtons}
        continueAsGuestButtonLabelId="customer.continue"
        defaultShouldSubscribe={isSubscribed}
        email={email}
        isBillingSameAsShipping={isBillingSameAsShipping}
        isExpressPrivacyPolicy={isExpressPrivacyPolicy}
        isFloatingLabelEnabled={isFloatingLabelEnabled}
        isLoading={isLoadingGuestForm}
        onBillingSameAsShippingChange={onBillingSameAsShippingChange}
        onChangeEmail={handleChangeEmail}
        onContinueAsGuest={handleContinueAsGuest}
        onShowLogin={handleShowLogin}
        // Usa la nuova variabile che ha sempre un valore
        privacyPolicyUrl={privacyPolicyUrl}
        requiresMarketingConsent={requiresMarketingConsent}
        shippingAddress={shippingAddress}
        shippingAddressFields={shippingAddressFields}
        shouldShowEmailWatermark={isPayPalFastlaneMethod(customCheckoutProvider)}
    />
};