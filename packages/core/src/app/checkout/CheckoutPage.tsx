// File: packages/core/src/app/checkout/CheckoutPage.tsx

import {
    type Address,
    type Cart,
    type CheckoutParams,
    type CheckoutSelectors,
    type CheckoutStoreSelector,
    type Consignment,
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
import { BillingStep, CartSummary, CheckoutHeader, CustomerStep, PaymentStep, ShippingStep, ShippingMethodStep } from './components';
import { mapCheckoutComponentErrorMessage } from './mapErrorMessage';
import mapToCheckoutProps from './mapToCheckoutProps';



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
    const [state, setState] = useState<CheckoutState>({
        isBillingSameAsShipping: true,
        isCartEmpty: false,
        isRedirecting: false,
        isMultiShippingMode: false,
        hasSelectedShippingOptions: false,
        isSubscribed: false,
        buttonConfigs: [],
    });


     const [isBillingFormSubmitted, setIsBillingFormSubmitted] = useState(false); // <-- AGGIUNGI QUESTA RIGA
    const stepsRef = useRef<CheckoutStepStatus[]>(steps);
    const embeddedMessenger = useRef<EmbeddedCheckoutMessenger>();
    const stateRef = useRef<{
        hasSelectedShippingOptions: boolean;
        activeStepType?: CheckoutStepType;
        defaultStepType?: CheckoutStepType;
    }>({
        hasSelectedShippingOptions: state.hasSelectedShippingOptions,
    });

    const navigateToStep = useCallback((type: CheckoutStepType, options?: { isDefault?: boolean }): void => {
        const allPossibleSteps = [...stepsRef.current, { type: CheckoutStepType.ShippingMethod, isRequired: true, isBusy: false }];
        const step = find(allPossibleSteps, { type });

        if (!step) {
            return;
        }

        if (state.activeStepType === type) {
            return;
        }

        if (options && options.isDefault) {
            setState(prevState => ({ ...prevState, defaultStepType: type }));
        } else {
            setState(prevState => ({ ...prevState, activeStepType: type }));
        }

        if (error) {
            clearError(error);
        }
    }, [state.activeStepType, error, clearError]);

const navigateToNextIncompleteStep = useCallback((options?: { isDefault?: boolean }): void => {
    const { activeStepType } = stateRef.current;

    // prendi solo gli step richiesti nell’ordine giusto
    const orderedSteps = stepsRef.current.filter(step => step.isRequired);

    const currentIndex = activeStepType
        ? findIndex(orderedSteps, { type: activeStepType })
        : -1;

    // prossimo step dopo quello attuale
    const nextStep =
        orderedSteps[currentIndex + 1] ??
        orderedSteps[currentIndex]; // fallback, nel dubbio resta sull’ultimo

    if (!nextStep) {
        return;
    }

    // tracci lo step precedente come completato
    if (activeStepType) {
        analyticsTracker.trackStepCompleted(activeStepType);
    }

    navigateToStep(nextStep.type, options);
}, [analyticsTracker, navigateToStep]);

    const handleToggleMultiShipping = useCallback((): void => {
        setState((prevState) => ({ ...prevState, isMultiShippingMode: !prevState.isMultiShippingMode }));
    }, []);

    const navigateToOrderConfirmation = useCallback((orderId?: number): void => {
        analyticsTracker.trackStepCompleted(stepsRef.current[stepsRef.current.length - 1].type);

        if (embeddedMessenger.current) {
            embeddedMessenger.current.postComplete();
        }

        SubscribeSessionStorage.removeSubscribeStatus();

        setState(prevState => ({ ...prevState, isRedirecting: true }));

        void navigateToOrderConfirmationUtility(orderId);
    }, []);

    const checkEmbeddedSupport = useCallback((methodIds: string[]): boolean => {
        return embeddedSupport.isSupported(...methodIds);
    }, [embeddedSupport]);

    const setCustomerViewType = useCallback((customerViewType: CustomerViewType): void => {
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
        navigateToStep(CheckoutStepType.Shipping);
    }, [navigateToStep]);



    const handleConsignmentsUpdated = ({ data }: CheckoutSelectors): void => {
        const { hasSelectedShippingOptions: prevHasSelectedShippingOptions, activeStepType, defaultStepType } =
            stateRef.current;

        const newHasSelectedShippingOptions = hasSelectedShippingOptions(
            data.getConsignments() || [],
        );

        const isDefaultStepPaymentOrBilling =
            !activeStepType &&
            (defaultStepType === CheckoutStepType.Payment ||
                defaultStepType === CheckoutStepType.Billing);

        const isShippingStepFinished =
            findIndex(stepsRef.current, { type: CheckoutStepType.Shipping }) <
            findIndex(stepsRef.current, { type: activeStepType }) || isDefaultStepPaymentOrBilling;

        if (
            prevHasSelectedShippingOptions &&
            !newHasSelectedShippingOptions &&
            isShippingStepFinished
        ) {
            navigateToStep(CheckoutStepType.Shipping);
            setState(prevState => ({ ...prevState, error: new ShippingOptionExpiredError() }));
        }

        setState(prevState => ({ ...prevState, hasSelectedShippingOptions: newHasSelectedShippingOptions }));
    };

    const handleCloseErrorModal = useCallback((): void => {
        setState(prevState => ({ ...prevState, error: undefined }));
    }, []);

    const handleExpanded = useCallback((type: CheckoutStepType): void => {
        analyticsTracker.trackStepViewed(type);
    }, []);

    const handleError = useCallback((error: Error): void => {
        if (isErrorWithType(error) && error.type === 'empty_cart') {
            setState(prevState => ({ ...prevState, error }));

            return;
        }

        errorLogger.log(error);

        if (embeddedMessenger.current) {
            embeddedMessenger.current.postError(error);
        }
    }, []);

    const handleUnhandledError = useCallback((error: Error): void => {
        handleError(error);
        setState(prevState => ({ ...prevState, error }));
    }, []);

const handleEditStep = useCallback((type: CheckoutStepType): void => {
    // Se l'utente sta modificando lo step di fatturazione, resettiamo il nostro stato
    // per permettere al form di riaprirsi.
    if (type === CheckoutStepType.Billing) {
        setIsBillingFormSubmitted(false);
    }

    navigateToStep(type);
}, [navigateToStep]);

    const handleReady = useCallback((): void => {
        navigateToNextIncompleteStep({ isDefault: true });
    }, [navigateToNextIncompleteStep]);

    const handleBillingContinue = useCallback((): void => {
        setIsBillingFormSubmitted(true);
        // Tracciamo il completamento ma non navighiamo via
        analyticsTracker.trackStepCompleted(CheckoutStepType.Billing);
    }, [analyticsTracker]);
    
    const handleNewsletterSubscription = useCallback((subscribed: boolean): void => {
        setState(prevState => ({ ...prevState, isSubscribed: subscribed }));
    }, []);

    const handleSignOut = useCallback(({ isCartEmpty }: CustomerSignOutEvent): void => {
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
    }, [
        loginUrl, cartUrl, isPriceHiddenFromGuests, isGuestEnabled, setCustomerViewType, navigateToStep
    ]);

    const handleShippingNextStep = useCallback((isBillingSameAsShipping: boolean): void => {
        setState(prev => ({ ...prev, isBillingSameAsShipping }));
        navigateToStep(CheckoutStepType.ShippingMethod);
    }, [navigateToStep]);

    const handleShippingMethodNextStep = useCallback((): void => {
        navigateToStep(CheckoutStepType.Billing);
    }, [navigateToStep]);

    const handleShippingSignIn = useCallback((): void => {
        setCustomerViewType(CustomerViewType.Login);
    }, [setCustomerViewType]);

    const handleShippingCreateAccount = useCallback((): void => {
        setCustomerViewType(CustomerViewType.CreateAccount);
    }, [setCustomerViewType]);

    const handleBeforeExit = useCallback((): void => {
        analyticsTracker.exitCheckout();
    }, []);

    const handleWalletButtonClick = useCallback((methodName: string): void => {
        analyticsTracker.walletButtonClick(methodName);
    }, []);

    const reloadWindow = useCallback((): void => {
        setState(prevState => ({ ...prevState, error: undefined }));
        window.location.reload();
    }, []);

    const handleSetIsMultishippingMode = useCallback((value: boolean): void => {
        setState(prevState => ({ ...prevState, isMultiShippingMode: value }));
    }, []);

    const renderStep = (step: CheckoutStepStatus): ReactNode => {
        const {
            customerViewType = isGuestEnabled ? CustomerViewType.Guest : CustomerViewType.Login,
            isSubscribed,
            isBillingSameAsShipping,
            isMultiShippingMode,
        } = state;

        switch (step.type) {
            case CheckoutStepType.Customer:
                return <CustomerStep
                    checkEmbeddedSupport={checkEmbeddedSupport}
                    key={step.type}
                    isSubscribed={isSubscribed}
                    isWalletButtonsOnTop={isShowingWalletButtonsOnTop}
                    onAccountCreated={navigateToNextIncompleteStep}
                    onChangeViewType={setCustomerViewType}
                    onContinueAsGuest={navigateToNextIncompleteStep}
                    onContinueAsGuestError={handleError}
                    onEdit={handleEditStep}
                    onExpanded={handleExpanded}
                    onReady={handleReady}
                    onSignIn={navigateToNextIncompleteStep}
                    onSignInError={handleError}
                    onSignOut={handleSignOut}
                    onSignOutError={handleError}
                    onSubscribeToNewsletter={handleNewsletterSubscription}
                    onUnhandledError={handleUnhandledError}
                    onWalletButtonClick={handleWalletButtonClick}
                    step={step}
                    viewType={customerViewType}
                />;

            case CheckoutStepType.Shipping:
                return <ShippingStep
                    cart={cart}
                    cartHasChanged={hasCartChanged}
                    consignments={consignments || []}
                    key={step.type}
                    isBillingSameAsShipping={isBillingSameAsShipping}
                    isMultiShippingMode={isMultiShippingMode}
                    isShippingDiscountDisplayEnabled={isShippingDiscountDisplayEnabled}
                    navigateNextStep={handleShippingNextStep}
                    onCreateAccount={handleShippingCreateAccount}
                    onEdit={handleEditStep}
                    onExpanded={handleExpanded}
                    onReady={handleReady}
                    onSignIn={handleShippingSignIn}
                    onToggleMultiShipping={handleToggleMultiShipping}
                    onUnhandledError={handleUnhandledError}
                    setIsMultishippingMode={handleSetIsMultishippingMode}
                    step={step}
                />;

            case CheckoutStepType.ShippingMethod:
                return <ShippingMethodStep
                    cart={cart}
                    consignments={consignments || []}
                    isBillingSameAsShipping={isBillingSameAsShipping}
                    isShippingDiscountDisplayEnabled={isShippingDiscountDisplayEnabled}
                    key={step.type}
                    navigateNextStep={handleShippingMethodNextStep}
                    onEdit={handleEditStep}
                    onExpanded={handleExpanded}
                    step={step}
                />;

            case CheckoutStepType.Billing:
                return <BillingStep
                    billingAddress={billingAddress}
                    navigateNextStep={handleBillingContinue}
                    onEdit={handleEditStep}
                    key={step.type}
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
                    key={step.type}
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
                />;

            default:
                return null;
        }
    }

    const handleConsignmentsUpdatedRef = useRef<(selectors: CheckoutSelectors) => void>(handleConsignmentsUpdated);
    const handleBeforeExitRef = useRef<() => void>(handleBeforeExit);

    stepsRef.current = steps;
    stateRef.current = {
        hasSelectedShippingOptions: state.hasSelectedShippingOptions,
        activeStepType: state.activeStepType,
        defaultStepType: state.defaultStepType,
    };
    handleConsignmentsUpdatedRef.current = handleConsignmentsUpdated;
    handleBeforeExitRef.current = handleBeforeExit;

    useEffect(() => {
        const unsubscribeFromConsignments = subscribeToConsignments(
            handleConsignmentsUpdatedRef.current,
        );

        const init = async () => {
            try {
                const providers = data.getConfig()?.checkoutSettings?.remoteCheckoutProviders || [];
                const supportedProviders = getSupportedMethodIds(providers);

                if (providers.length > 0) {
                    const configs = await loadPaymentMethodByIds(supportedProviders);
                    setState(prevState => ({ ...prevState, buttonConfigs: configs.data.getPaymentMethods() || [] }));
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
                    }));
                }

                const { links: { siteLink = '' } = {} } = data.getConfig() || {};
                const messenger = createEmbeddedMessenger({ parentOrigin: siteLink });
                messenger.receiveStyles((styles) => embeddedStylesheet.append(styles));
                messenger.postFrameLoaded({ contentId: containerId });
                messenger.postLoaded();
                embeddedMessenger.current = messenger;

                if (document.prerendering) {
                    document.addEventListener('prerenderingchange', () => {
                        analyticsTracker.checkoutBegin();
                    }, { once: true });
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

                window.addEventListener('beforeunload', handleBeforeExitRef.current);
                handleReady();
            } catch (error) {
                if (error instanceof Error) {
                    handleUnhandledError(error);
                }
            }
        };

        void init();

        return (): void => {
            const deInit = () => {
                if (unsubscribeFromConsignments) {
                    unsubscribeFromConsignments();
                }
                window.removeEventListener('beforeunload', handleBeforeExitRef.current);
                handleBeforeExitRef.current();
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
                                {(() => {
                                    const allSteps: CheckoutStepStatus[] = [];
                                    const originalSteps = stepsRef.current;

                                    originalSteps.forEach(step => {
                                        allSteps.push(step);

                                        if (step.type === CheckoutStepType.Shipping) {
                                            allSteps.push({
                                                type: CheckoutStepType.ShippingMethod,
                                                isComplete: hasSelectedShippingOptions(consignments || []),
                                                isEditable: true,
                                                isRequired: true,
                                                isActive: false,
                                                isBusy: isPending,
                                            });
                                        }
                                    });

                                    return allSteps
                                        .filter((step) => step.isRequired)
                                        .map((step) => {
                                            const { activeStepType } = state;
                                            const currentStepType = step.type;

                                            const isActive = (() => {
                                                // 1. LOGICA ORIGINALE PER CUSTOMER E SHIPPING (INVARIATA)
                                                if (
                                                    currentStepType === CheckoutStepType.Customer ||
                                                    currentStepType === CheckoutStepType.Shipping
                                                ) {
                                                    return !activeStepType || activeStepType === CheckoutStepType.Customer || activeStepType === CheckoutStepType.Shipping;
                                                }

                                                // 2. LOGICA MODIFICATA PER BILLING E PAYMENT
                                                if (
                                                    currentStepType === CheckoutStepType.Billing ||
                                                    currentStepType === CheckoutStepType.Payment
                                                ) {
                                                    // Se siamo nello step di Fatturazione o Pagamento...
                                                    const isBillingOrPaymentStep = activeStepType === CheckoutStepType.Billing || activeStepType === CheckoutStepType.Payment;

                                                    if (!isBillingOrPaymentStep) return false;

                                                    // Se lo step corrente è BILLING, è "attivo" (mostra il form) SOLO se non è ancora stato sottomesso.
                                                    if (currentStepType === CheckoutStepType.Billing) {
                                                        return !isBillingFormSubmitted;
                                                    }

                                                    // Se lo step corrente è PAYMENT, è sempre attivo durante questa fase.
                                                    if (currentStepType === CheckoutStepType.Payment) {
                                                        return true;
                                                    }
                                                }

                                                // 3. LOGICA ORIGINALE DI DEFAULT (INVARIATA)
                                                return activeStepType === currentStepType;
                                            })();

                                            // Un passo è completo o se lo era già, o se abbiamo appena sottomesso il form di fatturazione
                                            const isComplete = (currentStepType === CheckoutStepType.Billing)
                                                ? step.isComplete || isBillingFormSubmitted
                                                : step.isComplete;

                                            const newStepProps = {
                                                ...step,
                                                isActive,
                                                isComplete, // Usiamo il valore calcolato
                                                isBusy: isPending,
                                            };

                                            return renderStep(newStepProps);
                                        });
                                })()}
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