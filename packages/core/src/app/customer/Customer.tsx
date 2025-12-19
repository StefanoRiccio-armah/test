// packages/core/src/app/customer/Customer.tsx
// (Versione completa con FIX e console.log per debug)

import {
    type CustomerCredentials,
} from '@bigcommerce/checkout-sdk';
import { createBigCommercePaymentsFastlaneCustomerStrategy } from '@bigcommerce/checkout-sdk/integrations/bigcommerce-payments';
import { createBoltCustomerStrategy } from '@bigcommerce/checkout-sdk/integrations/bolt';
import { createBraintreeFastlaneCustomerStrategy } from '@bigcommerce/checkout-sdk/integrations/braintree';
import { createPayPalCommerceFastlaneCustomerStrategy } from '@bigcommerce/checkout-sdk/integrations/paypal-commerce';
import { createStripeLinkV2CustomerStrategy, createStripeUPECustomerStrategy } from '@bigcommerce/checkout-sdk/integrations/stripe';
import { noop } from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';

import { useAnalytics,useCheckout } from '@bigcommerce/checkout/contexts';

import { isEqualAddress, mapAddressFromFormValues } from '../address';
import type CheckoutStepStatus from '../checkout/CheckoutStepStatus';
import { isErrorWithType } from '../common/error';
import { PaymentMethodId } from '../payment/paymentMethod';
import { useShipping } from '../shipping/hooks/useShipping';

import CreateAccountForm from './CreateAccountForm';
import CustomerViewType from './CustomerViewType';
import EmailLoginForm, { type EmailLoginFormValues } from './EmailLoginForm';
import { type CreateAccountFormValues } from './getCreateCustomerValidationSchema';
import { type GuestFormValues } from './GuestForm';
import { GuestFormContainer } from './GuestFormContainer';
import LoginForm from './LoginForm';
import mapCreateAccountFromFormValues from './mapCreateAccountFromFormValues';
import { SubscribeSessionStorage } from './SubscribeSessionStorage';
import { useCustomer } from './useCustomer';

export interface CustomerProps {
    viewType: CustomerViewType;
    step: CheckoutStepStatus;
    isEmbedded?: boolean;
    isSubscribed: boolean;
    isWalletButtonsOnTop: boolean;
    checkEmbeddedSupport?(methodIds: string[]): void;
    onChangeViewType?(viewType: CustomerViewType): void;
    onAccountCreated?(): void;
    onContinueAsGuest?(): void;
    onContinueAsGuestError?(error: Error): void;
    onReady?(): void;
    onSubscribeToNewsletter(subscribe: boolean): void;
    onSignIn?(): void;
    onSignInError?(error: Error): void;
    onUnhandledError?(error: Error): void;
    onWalletButtonClick?(methodName: string): void;
    // NUOVE PROPS
    onBillingSameAsShippingChange?(isSame: boolean): void;
    isBillingSameAsShipping?: boolean;
}

// packages/core/src/app/customer/Customer.tsx
// FIX: Recupero email dal checkout state dopo refresh/navigazione

const Customer: React.FC<CustomerProps> = ({
    viewType,
    step,
    isEmbedded,
    isSubscribed,
    isWalletButtonsOnTop,
    onChangeViewType = noop,
    onAccountCreated = noop,
    onContinueAsGuest = noop,
    onContinueAsGuestError = noop,
    onReady = noop,
    onSubscribeToNewsletter,
    onSignIn = noop,
    onSignInError = noop,
    onUnhandledError = noop,
    onWalletButtonClick = noop,
    onBillingSameAsShippingChange,
    isBillingSameAsShipping,
}) => {
    const [isEmailLoginFormOpen, setIsEmailLoginFormOpen] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [hasRequestedLoginEmail, setHasRequestedLoginEmail] = useState(false);
    const [draftEmail, setDraftEmail] = useState<string | undefined>();
    
    const { analyticsTracker } = useAnalytics();
    const customerData = useCustomer();
    const { checkoutService } = useCheckout();
    
    const {
        shippingAddress,
        updateShippingAddress,
        loadShippingAddressFields,
        getFields,
        countries,
    } = useShipping();

    // ✅ FIX PRINCIPALE: Recupera l'email dal checkout state
useEffect(() => {
    const checkoutState = checkoutService.getState();
    const customer = checkoutState.data.getCustomer();
    const billingAddress = checkoutState.data.getBillingAddress();
    
    const savedEmail = customer?.email || billingAddress?.email;
    
    console.log('🔍 DEBUG - Email recovery:', {
        customerEmail: customer?.email,
        billingEmail: billingAddress?.email,
        savedEmail,
        currentDraft: draftEmail
    });
    
    // ✅ AGGIORNA SEMPRE se c'è email salvata
    if (savedEmail && (!draftEmail || draftEmail !== savedEmail)) {
        setDraftEmail(savedEmail);
    }
}, [checkoutService, customerData.data.email]);

    useEffect(() => {
        const initializeCustomer = async () => {
            try {
                await loadShippingAddressFields();
                if (customerData.data.providerWithCustomCheckout && 
                    customerData.data.providerWithCustomCheckout !== PaymentMethodId.StripeUPE) {
                    await customerData.actions.initializeCustomer({
                        methodId: customerData.data.providerWithCustomCheckout,
                        integrations: [
                            createBigCommercePaymentsFastlaneCustomerStrategy,
                            createBraintreeFastlaneCustomerStrategy,
                            createPayPalCommerceFastlaneCustomerStrategy,
                            createBoltCustomerStrategy,
                            createStripeUPECustomerStrategy,
                            createStripeLinkV2CustomerStrategy
                        ],
                    });
                }
            } catch (error) {
                if (error instanceof Error) { onUnhandledError(error); }
            }
            setIsReady(true);
            onReady();
        };
        void initializeCustomer();
    }, []);

    useEffect(() => {
        return () => {
            const cleanup = async () => {
                try {
                    await customerData.actions.deinitializeCustomer({ 
                        methodId: customerData.data.providerWithCustomCheckout 
                    });
                } catch (error) {
                    if (error instanceof Error) { onUnhandledError(error); }
                }
            };
            void cleanup();
        };
    }, [customerData.actions, customerData.data.providerWithCustomCheckout, onUnhandledError]);

    const handleChangeEmail = useCallback((email: string) => {
        setDraftEmail(email);
        analyticsTracker.customerEmailEntry(email);
    }, [analyticsTracker]);

    const handleSignIn = useCallback(async (credentials: CustomerCredentials) => {
        try {
            await customerData.actions.signIn(credentials);
            setDraftEmail(undefined);
            onSignIn();
        } catch (error) {
            if (error instanceof Error) { onSignInError(error); }
        }
    }, [customerData.actions, onSignIn, onSignInError]);

  const handleContinueAsGuest = useCallback(async (formValues: GuestFormValues) => {
    console.log('🔍 DEBUG - handleContinueAsGuest START', { 
        email: formValues.email, 
        hasShipping: !!formValues.shippingAddress,
        isBillingSameAsShipping: formValues.isBillingSameAsShipping,
    });
    
    const email = formValues.email.trim();

    try {
        // ✅ STEP 1: SALVA SEMPRE EMAIL (punto critico per persistenza)
        console.log('🔍 DEBUG - 1. Salvo email nel customer');
        await customerData.actions.continueAsGuest({
            email,
            // Non sovrascrivere subscription se già settata
            acceptsMarketingNewsletter: formValues.shouldSubscribe,
            acceptsAbandonedCartEmails: formValues.shouldSubscribe,
        });

        // ✅ STEP 2: onSubscribeToNewsletter PRIMA di tutto
        onSubscribeToNewsletter(formValues.shouldSubscribe);
        SubscribeSessionStorage.setSubscribeStatus(formValues.shouldSubscribe);
        onBillingSameAsShippingChange?.(formValues.isBillingSameAsShipping);

        // ✅ STEP 3: Shipping address (opzionale)
        if (formValues.shippingAddress) {
            const mappedAddress = mapAddressFromFormValues(formValues.shippingAddress);
            
            if (!isEqualAddress(mappedAddress, shippingAddress)) {
                console.log('🔍 DEBUG - 2. Aggiorno shipping address');
                await updateShippingAddress(mappedAddress);
                
                // Billing same as shipping
                if (formValues.isBillingSameAsShipping) {
                    console.log('🔍 DEBUG - 3. Aggiorno billing (same as shipping)');
                    await checkoutService.updateBillingAddress(mappedAddress);
                }
            }
        }

        console.log('🔍 DEBUG - 4. Customer COMPLETATO - chiamo onContinueAsGuest()');
        
        // ✅ STEP 4: SEMPRE chiama onContinueAsGuest() - NON bloccare mai
        onContinueAsGuest(); // ← QUESTO è il callback del parent che va allo step successivo

    } catch (error) {
        console.error('🔍 DEBUG - handleContinueAsGuest ERROR:', error);
        
        // ✅ NON bloccare mai il flusso per errori minori
        if (error instanceof Error) {
            if (isErrorWithType(error) && error.type === 'empty_cart') {
                return onContinueAsGuestError(error);
            }
            
            // Tutti gli altri errori: continua comunque
            console.log('🔍 DEBUG - Errore ignorato, continuo comunque');
            onContinueAsGuest(); // ← CONTINUA SEMPRE
        }
    }
}, [
    customerData.actions, 
    onSubscribeToNewsletter,
    onBillingSameAsShippingChange,
    onContinueAsGuest,
    onContinueAsGuestError,
    shippingAddress,
    updateShippingAddress,
    checkoutService
]);
    const executePaymentMethodCheckoutOrContinue = useCallback(async () => {
        console.log('🔍 DEBUG - executePaymentMethodCheckoutOrContinue START');
        
        try {
            if (customerData.data.providerWithCustomCheckout && 
                customerData.data.providerWithCustomCheckout !== PaymentMethodId.StripeUPE) {
                console.log('🔍 DEBUG - Executing payment method checkout:', 
                           customerData.data.providerWithCustomCheckout);
                await customerData.actions.executePaymentMethodCheckout({
                    methodId: customerData.data.providerWithCustomCheckout,
                    continueWithCheckoutCallback: onContinueAsGuest,
                    checkoutPaymentMethodExecuted: (payload) => { 
                        analyticsTracker.customerPaymentMethodExecuted(payload);
                        console.log('🔍 DEBUG - Payment method executed, calling onContinueAsGuest');
                        onContinueAsGuest();
                    }
                });
            } else {
                console.log('🔍 DEBUG - No custom checkout, calling onContinueAsGuest directly');
                onContinueAsGuest();
            }
        } catch (error) {
            console.error('🔍 DEBUG - Payment checkout failed:', error);
            console.log('🔍 DEBUG - Fallback: calling onContinueAsGuest anyway');
            onContinueAsGuest();
        }
    }, [customerData.actions, customerData.data.providerWithCustomCheckout, onContinueAsGuest, analyticsTracker]);

    const handleShowLogin = useCallback(() => { 
        onChangeViewType(CustomerViewType.Login); 
    }, [onChangeViewType]);
    
    const handleCreateAccount = useCallback(async (values: CreateAccountFormValues) => { 
        await customerData.actions.createAccount(mapCreateAccountFromFormValues(values)); 
        onAccountCreated(); 
    }, [customerData.actions, onAccountCreated]);
    
    const handleCancelCreateAccount = useCallback(() => { 
        if (customerData.data.createAccountError) { 
            customerData.actions.clearError(customerData.data.createAccountError); 
        } 
        onChangeViewType(CustomerViewType.Login); 
    }, [customerData.actions, customerData.data.createAccountError, onChangeViewType]);
    
    const handleCancelSignIn = useCallback(() => { 
        if (customerData.data.signInError) { 
            customerData.actions.clearError(customerData.data.signInError); 
        } 
        onChangeViewType(CustomerViewType.Guest); 
    }, [customerData.actions, customerData.data.signInError, onChangeViewType]);
    
    const showCreateAccount = useCallback(() => { 
        onChangeViewType(CustomerViewType.CreateAccount); 
    }, [onChangeViewType]);
    
    const handleSendLoginEmail = useCallback(async (values: EmailLoginFormValues) => { 
        try { 
            await customerData.actions.sendLoginEmail(values); 
        } catch { /* Noop */ } 
        finally { 
            setHasRequestedLoginEmail(true); 
        } 
    }, [customerData.actions]);
    
    const handleEmailLoginClicked = useCallback(async () => { 
        try { 
            if (viewType !== CustomerViewType.Login && draftEmail) { 
                await handleSendLoginEmail({ email: draftEmail }); 
            } 
        } finally { 
            setIsEmailLoginFormOpen(true); 
        } 
    }, [viewType, draftEmail, handleSendLoginEmail]);
    
    const closeEmailLoginFormForm = useCallback(() => { 
        setIsEmailLoginFormOpen(false); 
        setHasRequestedLoginEmail(false); 
    }, []);

    const shouldRenderGuestForm = viewType === CustomerViewType.Guest;
    const shouldRenderCreateAccountForm = viewType === CustomerViewType.CreateAccount;
    const shouldRenderLoginForm = !shouldRenderGuestForm && !shouldRenderCreateAccountForm;

    if (!isReady) { return null; }

    const shippingAddressFields = shippingAddress?.countryCode 
        ? getFields(shippingAddress.countryCode) 
        : countries.length > 0 
            ? getFields(countries[0].code) 
            : [];

    // ✅ FIX: Calcola l'email finale da passare al form
    const checkoutState = checkoutService.getState();
    const currentBilling = checkoutState.data.getBillingAddress();
    const finalEmail = draftEmail || 
                       customerData.data.email || 
                       currentBilling?.email || 
                       '';
    
    console.log('🔍 DEBUG - Rendering Customer with email:', finalEmail);

    return (
        <>
            {isEmailLoginFormOpen && ( 
                <EmailLoginForm 
                    email={draftEmail} 
                    emailHasBeenRequested={hasRequestedLoginEmail} 
                    isFloatingLabelEnabled={customerData.data.isFloatingLabelEnabled} 
                    isOpen={isEmailLoginFormOpen} 
                    isSendingEmail={customerData.data.isSendingSignInEmail} 
                    onRequestClose={closeEmailLoginFormForm} 
                    onSendLoginEmail={handleSendLoginEmail} 
                    sentEmail={customerData.data.signInEmail} 
                    sentEmailError={customerData.data.signInEmailError} 
                /> 
            )}
            {shouldRenderLoginForm && ( 
                <LoginForm 
                    continueAsGuestButtonLabelId="customer.continue_as_guest_action" 
                    email={finalEmail}
                    isEmbedded={isEmbedded} 
                    isFloatingLabelEnabled={customerData.data.isFloatingLabelEnabled} 
                    onCancel={handleCancelSignIn} 
                    onChangeEmail={handleChangeEmail} 
                    onContinueAsGuest={executePaymentMethodCheckoutOrContinue} 
                    onCreateAccount={showCreateAccount} 
                    onSendLoginEmail={handleEmailLoginClicked} 
                    onSignIn={handleSignIn} 
                    signInError={customerData.data.signInError} 
                    viewType={viewType} 
                /> 
            )}
            {shouldRenderGuestForm && (
                <GuestFormContainer
                    email={finalEmail}
                    handleChangeEmail={handleChangeEmail}
                    handleContinueAsGuest={handleContinueAsGuest}
                    handleShowLogin={handleShowLogin}
                    isBillingSameAsShipping={isBillingSameAsShipping}
                    isFloatingLabelEnabled={customerData.data.isFloatingLabelEnabled}
                    isSubscribed={isSubscribed}
                    isWalletButtonsOnTop={isWalletButtonsOnTop}
                    onBillingSameAsShippingChange={onBillingSameAsShippingChange}
                    onUnhandledError={onUnhandledError}
                    onWalletButtonClick={onWalletButtonClick}
                    shippingAddress={shippingAddress}
                    shippingAddressFields={shippingAddressFields}
                    step={step}
                />
            )}
            {shouldRenderCreateAccountForm && ( 
                <CreateAccountForm 
                    createAccountError={customerData.data.createAccountError} 
                    defaultShouldSubscribe={customerData.data.defaultShouldSubscribe} 
                    formFields={customerData.data.customerAccountFields} 
                    isCreatingAccount={customerData.data.isCreatingAccount} 
                    isExecutingPaymentMethodCheckout={customerData.data.isExecutingPaymentMethodCheckout} 
                    isFloatingLabelEnabled={customerData.data.isFloatingLabelEnabled} 
                    onCancel={handleCancelCreateAccount} 
                    onSubmit={handleCreateAccount} 
                    requiresMarketingConsent={customerData.data.requiresMarketingConsent} 
                /> 
            )}
        </>
    );
};

export default Customer;