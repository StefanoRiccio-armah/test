import {
    type Address,
    type Cart,
    type CheckoutParams,
    type CheckoutSelectors,
    type CheckoutStoreSelector,
    type Consignment,
    type CheckoutService,
    type EmbeddedCheckoutMessenger,
    type EmbeddedCheckoutMessengerOptions,
    type FlashMessage,
    type PaymentMethod,
    type Promotion,
    type RequestOptions,
} from '@bigcommerce/checkout-sdk/essential';
import classNames from 'classnames';
import { find, findIndex } from 'lodash';
import React, {
    type ReactElement,
    type ReactNode,
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';

import { type AnalyticsContextProps, type ExtensionContextProps, withExtension } from '@bigcommerce/checkout/contexts';
import { type ErrorLogger } from '@bigcommerce/checkout/error-handling-utils';
import { withLanguage, type WithLanguageProps } from '@bigcommerce/checkout/locale';
import { OrderConfirmationPageSkeleton } from '@bigcommerce/checkout/ui';
import { navigateToOrderConfirmation as navigateToOrderConfirmationUtility } from '@bigcommerce/checkout/utility';

import { withAnalytics } from '../analytics';
import { EmptyCartMessage } from '../cart';
import { withCheckout } from '../checkout';
import { CustomError, ErrorModal, isCustomError, isErrorWithType } from '../common/error';
import {
    type CustomerSignOutEvent,
    CustomerViewType,
} from '../customer';
import { getSupportedMethodIds } from '../customer/getSupportedMethods';
import { SubscribeSessionStorage } from '../customer/SubscribeSessionStorage';
import { type EmbeddedCheckoutStylesheet, isEmbedded } from '../embeddedCheckout';
import { hasSelectedShippingOptions, isUsingMultiShipping } from '../shipping';
import { ShippingOptionExpiredError } from '../shipping/shippingOption';

import type CheckoutStepStatus from './CheckoutStepStatus';
import CheckoutStepType from './CheckoutStepType';
import type CheckoutSupport from './CheckoutSupport';
import { BillingStep, CartSummary, CheckoutHeader, CustomerStep, PaymentStep, ShippingStep } from './components';
import { mapCheckoutComponentErrorMessage } from './mapErrorMessage';
import mapToCheckoutProps from './mapToCheckoutProps';
import { hasDeductibleProduct } from '../custom/utils/minsan-checker';
import CustomerAndShippingStep from '../custom/step/CustomerAndShippingStep';

export interface CheckoutProps {
    checkoutId: string;
    containerId: string;
    data?: CheckoutStoreSelector;
    embeddedStylesheet: EmbeddedCheckoutStylesheet;
    embeddedSupport: CheckoutSupport;
    errorLogger: ErrorLogger;
    themeV2?: boolean;
    createEmbeddedMessenger(options: EmbeddedCheckoutMessengerOptions): EmbeddedCheckoutMessenger;
}

export interface CheckoutState {
    activeStepType?: CheckoutStepType;
    isBillingSameAsShipping: boolean;
    customerViewType?: CustomerViewType;
    defaultStepType?: CheckoutStepType;
    error?: Error;
    flashMessages?: FlashMessage[];
    isMultiShippingMode: boolean;
    isCartEmpty: boolean;
    isRedirecting: boolean;
    hasSelectedShippingOptions: boolean;
    isSubscribed: boolean;
    buttonConfigs: PaymentMethod[];
}

export interface WithCheckoutProps {
    billingAddress?: Address;
    cart?: Cart;
    consignments?: Consignment[];
    data: CheckoutStoreSelector;
    error?: Error;
    hasCartChanged: boolean;
    flashMessages?: FlashMessage[];
    isGuestEnabled: boolean;
    isLoadingCheckout: boolean;
    isPending: boolean;
    isPriceHiddenFromGuests: boolean;
    checkoutService: CheckoutService;
    isShowingWalletButtonsOnTop: boolean;
    isShippingDiscountDisplayEnabled: boolean;
    loginUrl: string;
    cartUrl: string;
    createAccountUrl: string;
    promotions?: Promotion[];
    steps: CheckoutStepStatus[];
    clearError(error?: Error): void;
    loadCheckout(id: string, options?: RequestOptions<CheckoutParams>): Promise<CheckoutSelectors>;
    loadPaymentMethodByIds(methodIds: string[]): Promise<CheckoutSelectors>;
    subscribeToConsignments(subscriber: (state: CheckoutSelectors) => void): () => void;
}

type CheckoutPageProps = CheckoutProps &
    WithCheckoutProps &
    WithLanguageProps &
    AnalyticsContextProps &
    ExtensionContextProps;

const Checkout = ({
    createAccountUrl,
    createEmbeddedMessenger,
    embeddedSupport,
    billingAddress,
    consignments,
    cart,
    data,
    errorLogger,
    isGuestEnabled,
    checkoutService,
    isShowingWalletButtonsOnTop,
    hasCartChanged,
    isShippingDiscountDisplayEnabled,
    clearError,
    error,
    steps,
    analyticsTracker,
    loginUrl,
    language,
    cartUrl,
    isPending,
    isPriceHiddenFromGuests,
    containerId,
    embeddedStylesheet,
    loadPaymentMethodByIds,
    subscribeToConsignments,
    themeV2
}: CheckoutPageProps): ReactElement => {
    console.log("CheckoutPage: Rendering with props", { isPending, steps });

    const stepsRef = useRef<CheckoutStepStatus[]>(steps);
    const handleConsignmentsUpdatedRef = useRef<(selectors: CheckoutSelectors) => void>();
    const embeddedMessenger = useRef<EmbeddedCheckoutMessenger>();
    const shouldShowCodiceFiscale = hasDeductibleProduct(cart);

    const [state, setState] = useState<CheckoutState>({
        isBillingSameAsShipping: true,
        isCartEmpty: false,
        isRedirecting: false,
        isMultiShippingMode: false,
        hasSelectedShippingOptions: false,
        isSubscribed: false,
        buttonConfigs: [],
    });

    console.log("CheckoutPage: Current state", state);

    const navigateToStep = useCallback((type: CheckoutStepType, options?: { isDefault?: boolean }): void => {
        console.log(`CheckoutPage: navigateToStep called for type: ${type}`, options);
        const step = find(stepsRef.current, { type });

        if (!step) {
            console.warn(`CheckoutPage: Step type ${type} not found.`);
            return;
        }

        if (state.activeStepType === step.type) {
            console.log(`CheckoutPage: Already on active step ${type}.`);
            return;
        }

        if (options && options.isDefault) {
            console.log(`CheckoutPage: Setting default step to ${type}.`);
            setState(prevState => ({
                ...prevState,
                defaultStepType: step.type,
            }));
        } else {
            console.log(`CheckoutPage: Setting active step to ${type}.`);
            setState(prevState => ({
                ...prevState,
                activeStepType: step.type,
            }));
        }

        if (error) {
            console.log("CheckoutPage: Clearing existing error on step navigation.");
            clearError(error);
        }
    }, [state.activeStepType, error, clearError]);

    const navigateToNextIncompleteStep = useCallback((options?: { isDefault?: boolean }): void => {
        console.log("CheckoutPage: navigateToNextIncompleteStep called", options);
        const activeStepIndex = findIndex(stepsRef.current, { isActive: true });
        const activeStep = activeStepIndex >= 0 && stepsRef.current[activeStepIndex];

        if (!activeStep) {
            console.warn("CheckoutPage: No active step found.");
            return;
        }

        const previousStep = stepsRef.current[Math.max(activeStepIndex - 1, 0)];

        if (previousStep) {
            console.log(`CheckoutPage: Tracking completion of previous step: ${previousStep.type}`);
            analyticsTracker.trackStepCompleted(previousStep.type);
        }

        navigateToStep(activeStep.type, options);
    }, [analyticsTracker, navigateToStep]);

    const handleToggleMultiShipping = useCallback((): void => {
        console.log("CheckoutPage: handleToggleMultiShipping called.");
        setState((prevState) => ({ ...prevState, isMultiShippingMode: !prevState.isMultiShippingMode }));
    }, []);

    const navigateToOrderConfirmation = useCallback((orderId?: number): void => {
        console.log("CheckoutPage: navigateToOrderConfirmation called", { orderId });
        analyticsTracker.trackStepCompleted(stepsRef.current[stepsRef.current.length - 1].type);

        if (embeddedMessenger.current) {
            embeddedMessenger.current.postComplete();
        }

        SubscribeSessionStorage.removeSubscribeStatus();

        setState(prevState => ({ ...prevState, isRedirecting: true }));

        void navigateToOrderConfirmationUtility(orderId);
    }, [analyticsTracker]);

    const checkEmbeddedSupport = useCallback((methodIds: string[]): boolean => {
        return embeddedSupport.isSupported(...methodIds);
    }, [embeddedSupport]);

    const setCustomerViewType = useCallback((customerViewType: CustomerViewType): void => {
        console.log(`CheckoutPage: setCustomerViewType called with: ${customerViewType}`);
        if (customerViewType === CustomerViewType.CreateAccount && isEmbedded()) {
            if (window.top) {
                window.top.location.replace(createAccountUrl);
            }
            return;
        }

        navigateToStep(CheckoutStepType.Customer);
        setState(prevState => ({ ...prevState, customerViewType }));
    }, [createAccountUrl, navigateToStep]);

    const handleCartChangedError = useCallback((): void => {
        console.log("CheckoutPage: handleCartChangedError called, navigating to shipping.");
        navigateToStep(CheckoutStepType.Shipping);
    }, [navigateToStep]);

    const handleConsignmentsUpdated = useCallback(({ data }: CheckoutSelectors): void => {
        console.log("CheckoutPage: handleConsignmentsUpdated called.");
        const { hasSelectedShippingOptions: prevHasSelectedShippingOptions, activeStepType, defaultStepType } = state;
        const newHasSelectedShippingOptions = hasSelectedShippingOptions(data.getConsignments() || []);

        const isDefaultStepPaymentOrBilling = !activeStepType && (defaultStepType === CheckoutStepType.Payment || defaultStepType === CheckoutStepType.Billing);
        const isShippingStepFinished = findIndex(stepsRef.current, { type: CheckoutStepType.Shipping }) < findIndex(stepsRef.current, { type: activeStepType }) || isDefaultStepPaymentOrBilling;

        if (prevHasSelectedShippingOptions && !newHasSelectedShippingOptions && isShippingStepFinished) {
            console.log("CheckoutPage: Shipping options expired, navigating back to shipping.");
            navigateToStep(CheckoutStepType.Shipping);
            setState(prevState => ({ ...prevState, error: new ShippingOptionExpiredError() }));
        }

        setState(prevState => ({ ...prevState, hasSelectedShippingOptions: newHasSelectedShippingOptions }));
    }, [state, navigateToStep]);

    const handleCloseErrorModal = useCallback((): void => {
        console.log("CheckoutPage: handleCloseErrorModal called.");
        setState(prevState => ({ ...prevState, error: undefined }));
    }, []);

    const handleExpanded = useCallback((type: CheckoutStepType): void => {
        console.log(`CheckoutPage: handleExpanded called for step: ${type}`);
        analyticsTracker.trackStepViewed(type);
    }, [analyticsTracker]);

    const handleError = useCallback((error: Error): void => {
        console.error("CheckoutPage: handleError called", error);
        if (isErrorWithType(error) && error.type === 'empty_cart') {
            setState(prevState => ({ ...prevState, error }));
            return;
        }

        errorLogger.log(error);

        if (embeddedMessenger.current) {
            embeddedMessenger.current.postError(error);
        }
        setState(prevState => ({ ...prevState, error }));
    }, [errorLogger]);

    const handleUnhandledError = useCallback((error: Error): void => {
        console.error("CheckoutPage: handleUnhandledError called", error);
        handleError(error);
        setState(prevState => ({ ...prevState, error }));
    }, [handleError]);

    const handleEditStep = useCallback((type: CheckoutStepType): void => {
        console.log(`CheckoutPage: handleEditStep called for step: ${type}`);
        navigateToStep(type);
    }, [navigateToStep]);

    const handleReady = useCallback((): void => {
        console.log("CheckoutPage: handleReady called, navigating to next incomplete step.");
        navigateToNextIncompleteStep({ isDefault: true });
    }, [navigateToNextIncompleteStep]);

    const handleNewsletterSubscription = useCallback((subscribed: boolean): void => {
        setState(prevState => ({ ...prevState, isSubscribed: subscribed }));
    }, []);

    const handleSignOut = useCallback(({ isCartEmpty }: CustomerSignOutEvent): void => {
        console.log("CheckoutPage: handleSignOut called", { isCartEmpty });
        if (isPriceHiddenFromGuests && window.top) {
            window.top.location.href = cartUrl;
            return;
        }

        if (embeddedMessenger.current) {
            embeddedMessenger.current.postSignedOut();
        }

        if (isGuestEnabled) {
            setCustomerViewType(CustomerViewType.Guest);
        }

        if (isCartEmpty) {
            setState(prevState => ({ ...prevState, isCartEmpty: true }));
            if (!isEmbedded() && window.top) {
                window.top.location.assign(loginUrl);
                return;
            }
        }

        navigateToStep(CheckoutStepType.Customer);
    }, [loginUrl, cartUrl, isPriceHiddenFromGuests, isGuestEnabled, setCustomerViewType, navigateToStep]);

    const handleShippingNextStep = useCallback((isBillingSameAsShipping: boolean): void => {
        console.log("CheckoutPage: handleShippingNextStep called", { isBillingSameAsShipping });
        setState(prev => ({ ...prev, isBillingSameAsShipping }));

        if (isBillingSameAsShipping) {
            navigateToNextIncompleteStep();
        } else {
            navigateToStep(CheckoutStepType.Billing);
        }
    }, [navigateToNextIncompleteStep, navigateToStep]);

    const handleShippingSignIn = useCallback((): void => {
        setCustomerViewType(CustomerViewType.Login);
    }, [setCustomerViewType]);

    const handleShippingCreateAccount = useCallback((): void => {
        setCustomerViewType(CustomerViewType.CreateAccount);
    }, [setCustomerViewType]);

    const handleBeforeExit = useCallback((): void => {
        console.log("CheckoutPage: handleBeforeExit called.");
        analyticsTracker.exitCheckout();
    }, [analyticsTracker]);

    const handleWalletButtonClick = useCallback((methodName: string): void => {
        analyticsTracker.walletButtonClick(methodName);
    }, [analyticsTracker]);

    const reloadWindow = useCallback((): void => {
        console.log("CheckoutPage: reloadWindow called.");
        setState(prevState => ({ ...prevState, error: undefined }));
        window.location.reload();
    }, []);

    const handleAddressSaved = useCallback(() => {
        console.log("CheckoutPage: handleAddressSaved called. Navigating to SHIPPING step.");
        navigateToStep(CheckoutStepType.Shipping);
    }, [navigateToStep]);

    const renderStep = (step: CheckoutStepStatus): ReactNode => {
        console.log(`CheckoutPage: Rendering step: ${step.type}`, step);

        switch (step.type) {
            // ++ MODIFICA INIZIO ++
            // Lo step 'Customer' usa il tuo componente custom.
            // Nota che NON passiamo più 'onStepFinished'.
            case CheckoutStepType.Customer:
                const shippingAddressFields = data.getShippingAddressFields(
                    data.getShippingAddress()?.countryCode || data.getConfig()?.storeProfile.storeCountryCode || ''
                )

                return <CustomerAndShippingStep
                    step={step}
                     key={step.type} 
                    isPending={isPending}
                    formFields={shippingAddressFields}
                    shouldShowCodiceFiscale={shouldShowCodiceFiscale}
                    onError={handleError}
                    onAddressSaved={handleAddressSaved}
                    onEdit={handleEditStep}
                    onExpanded={() => handleExpanded(step.type)}  // OK, resta così
                    onReady={handleReady}
                    email={data.getCustomer()?.email}
                    shippingAddress={data.getShippingAddress()}
                />

            // Riattiviamo lo step di spedizione standard di BigCommerce.
            // Apparirà automaticamente dopo che il CustomerStep avrà salvato l'indirizzo.
            case CheckoutStepType.Shipping:
                return <ShippingStep
                    cart={cart}
                     key={step.type} 
                    cartHasChanged={hasCartChanged}
                    consignments={consignments || []}
                    isBillingSameAsShipping={state.isBillingSameAsShipping}
                    isMultiShippingMode={state.isMultiShippingMode}
                    isShippingDiscountDisplayEnabled={isShippingDiscountDisplayEnabled}
                    navigateNextStep={handleShippingNextStep}
                    onCreateAccount={handleShippingCreateAccount}
                    onEdit={handleEditStep}
                    onExpanded={handleExpanded}
                    onReady={handleReady}
                    onSignIn={handleShippingSignIn}
                    onToggleMultiShipping={handleToggleMultiShipping}
                    onUnhandledError={handleUnhandledError}
                    setIsMultishippingMode={(value: boolean) => {
                        setState(prevState => ({ ...prevState, isMultiShippingMode: value }));
                    }}
                    step={step}
                />;
            // ++ MODIFICA FINE ++

            case CheckoutStepType.Billing:
                return <BillingStep
                 key={step.type} 
                    billingAddress={billingAddress}
                    navigateNextStep={navigateToNextIncompleteStep}
                    onEdit={handleEditStep}
                    onExpanded={handleExpanded}
                    onReady={handleReady}
                    onUnhandledError={handleUnhandledError}
                    step={step}
                />;

            case CheckoutStepType.Payment:
                return <PaymentStep
                    cart={cart}
                    
                    checkEmbeddedSupport={checkEmbeddedSupport}
                    consignments={consignments}
                    errorLogger={errorLogger}
                    isEmbedded={isEmbedded()}
                    isUsingMultiShipping={
                        cart && consignments
                            ? isUsingMultiShipping(consignments, cart.lineItems)
                            : false
                    }
                    onCartChangedError={handleCartChangedError}
                    onEdit={handleEditStep}
                    onExpanded={handleExpanded}
                    onFinalize={navigateToOrderConfirmation}
                    onReady={handleReady}
                    onSubmit={navigateToOrderConfirmation}
                    onSubmitError={handleError}
                    onUnhandledError={handleUnhandledError}
                    step={step}
                />

            default:
                return null;
        }
    }
    stepsRef.current = steps;
    handleConsignmentsUpdatedRef.current = handleConsignmentsUpdated;

    useEffect(() => {
        console.log("CheckoutPage: Main useEffect fired (init).");
        const unsubscribeFromConsignments = subscribeToConsignments(
            (state) => handleConsignmentsUpdatedRef.current && handleConsignmentsUpdatedRef.current(state)
        );

        const init = async () => {
            try {
                console.log("CheckoutPage: init() started.");
                const providers = data.getConfig()?.checkoutSettings?.remoteCheckoutProviders || [];
                const supportedProviders = getSupportedMethodIds(providers);

                if (providers.length > 0) {
                    const configs = await loadPaymentMethodByIds(supportedProviders);
                    setState(prevState => ({
                        ...prevState,
                        buttonConfigs: configs.data.getPaymentMethods() || [],
                    }));
                }

                const errorFlashMessages = data.getFlashMessages('error') || [];
                if (errorFlashMessages.length) {
                    setState(prevState => ({
                        ...prevState,
                        error: new CustomError({
                            title: errorFlashMessages[0].title || language.translate('common.error_heading'),
                            message: errorFlashMessages[0].message,
                            data: {},
                            name: 'default',
                        }),
                    })
                    );
                }

                const { links: { siteLink = '' } = {} } = data.getConfig() || {};
                const messenger = createEmbeddedMessenger({ parentOrigin: siteLink });
                messenger.receiveStyles((styles) => embeddedStylesheet.append(styles));
                messenger.postFrameLoaded({ contentId: containerId });
                messenger.postLoaded();
                embeddedMessenger.current = messenger;

                if (document.prerendering) {
                    document.addEventListener('prerenderingchange', () => analyticsTracker.checkoutBegin(), { once: true });
                } else {
                    analyticsTracker.checkoutBegin();
                }

                const consignments = data.getConsignments();
                const cart = data.getCart();
                const hasMultiShippingEnabled = data.getConfig()?.checkoutSettings.hasMultiShippingEnabled;
                const checkoutBillingSameAsShippingEnabled = data.getConfig()?.checkoutSettings.checkoutBillingSameAsShippingEnabled ?? true;
                const defaultNewsletterSignupOption = data.getConfig()?.shopperConfig.defaultNewsletterSignup ?? false;
                const isMultiShippingMode = !!cart && !!consignments && hasMultiShippingEnabled && isUsingMultiShipping(consignments, cart.lineItems);

                setState(prevState => ({
                    ...prevState,
                    isBillingSameAsShipping: checkoutBillingSameAsShippingEnabled,
                    isSubscribed: defaultNewsletterSignupOption,
                }));

                if (isMultiShippingMode) {
                    setState(prevState => ({ ...prevState, isMultiShippingMode }));
                }

                window.addEventListener('beforeunload', handleBeforeExit);
                console.log("CheckoutPage: init() completed. Calling handleReady.");
                handleReady();
            } catch (error) {
                if (error instanceof Error) {
                    handleUnhandledError(error);
                }
            }
        };

        void init();

        return (): void => {
            console.log("CheckoutPage: Main useEffect cleanup running (deInit).");
            const deInit = () => {
                unsubscribeFromConsignments();
                window.removeEventListener('beforeunload', handleBeforeExit);
                handleBeforeExit();
            }
            deInit();
        };
    }, []);

    if (state.isRedirecting) {
        return <OrderConfirmationPageSkeleton />;
    }

    let errorModal = null;
    if (state.error) {
        if (isCustomError(state.error)) {
            errorModal = <ErrorModal error={state.error} onClose={handleCloseErrorModal} title={state.error.title} />;
        } else {
            const { message, action } = mapCheckoutComponentErrorMessage(state.error, language.translate.bind(language));
            errorModal = <ErrorModal error={state.error} message={message} onClose={action === 'reload' ? reloadWindow : handleCloseErrorModal} />;
        }
    }

    return (
        <div className={classNames('remove-checkout-step-numbers', { 'is-embedded': isEmbedded() }, { 'themeV2': themeV2 })} data-test="checkout-page-container" id="checkout-page-container">
            <div className="layout optimizedCheckout-contentPrimary">
                {state.isCartEmpty ?
                    <EmptyCartMessage loginUrl={loginUrl} waitInterval={3000} />
                    : <>
                        <div className="layout-main">
                            <CheckoutHeader
                                activeStepType={state.activeStepType}
                                buttonConfigs={state.buttonConfigs}
                                checkEmbeddedSupport={checkEmbeddedSupport}
                                defaultStepType={state.defaultStepType}
                                onUnhandledError={handleUnhandledError}
                                onWalletButtonClick={handleWalletButtonClick}
                            />
                            <ol className="checkout-steps">
                                {stepsRef.current
                                    .filter((step) => step.isRequired)
                                    .map((step) =>
                                        renderStep({
                                            ...step,
                                            isActive: state.activeStepType
                                                ? state.activeStepType === step.type
                                                : state.defaultStepType === step.type,
                                            isBusy: isPending,
                                        }),
                                    )}
                            </ol>
                        </div>
                    </>
                }
                <CartSummary isMultiShippingMode={state.isMultiShippingMode} />
            </div>
            {errorModal}
        </div>
    );
};

export default withExtension(
    withAnalytics(withLanguage(withCheckout(mapToCheckoutProps)(Checkout))),
);