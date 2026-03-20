import type{Address,Cart,CheckoutParams,CheckoutSelectors,CheckoutStoreSelector,Consignment,EmbeddedCheckoutMessenger,
EmbeddedCheckoutMessengerOptions,FlashMessage,PaymentMethod,Promotion,RequestOptions} from '@bigcommerce/checkout-sdk/essential';
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
import {type CustomerSignOutEvent,CustomerViewType,} from '../customer';
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
import { BACKEND_URL, GLS_PARCEL_SHOP_METHOD_NAME } from '../custom/api/config';
import { getGLSShopSelection, clearGLSSelection } from '../custom/api/glsShippingMethod';

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
    showInvoiceFields?: boolean;
    additionalActions?: ReactNode;
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

const getStoredPaymentMethodName = (): string | null => {
    try {
        return localStorage.getItem('selectedPaymentMethodName');
    } catch (e) {
        console.warn('Errore lettura selectedPaymentMethodName da localStorage:', e);
        return null;
    }
};

const setStoredPaymentMethodName = (name: string): void => {
    try {
        localStorage.setItem('selectedPaymentMethodName', name);
    } catch (e) {
        console.warn('Errore salvataggio selectedPaymentMethodName in localStorage:', e);
    }
};

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
        showInvoiceFields: false,
    });
    const [selectedPaymentMethodName, setSelectedPaymentMethodName] = useState<string | undefined>();
    const stepsRef = useRef<CheckoutStepStatus[]>(steps);
    const embeddedMessenger = useRef<EmbeddedCheckoutMessenger>();
    const stateRef = useRef<{
        hasSelectedShippingOptions: boolean;
        activeStepType?: CheckoutStepType;
        defaultStepType?: CheckoutStepType;
    }>({
        hasSelectedShippingOptions: state.hasSelectedShippingOptions,
    });

    const handleToggleInvoiceFields = useCallback((show: boolean): void => {
        setState(prevState => ({ ...prevState, showInvoiceFields: show }));
    }, []);

    const navigateToStep = useCallback((type: CheckoutStepType, options?: { isDefault?: boolean }): void => {
        const step = find(stepsRef.current, { type });
        if (!step) { return; }
        if (state.activeStepType === step.type) { return; }
        if (options && options.isDefault) {
            setState(prevState => ({ ...prevState, defaultStepType: step.type }));
        } else {
            setState(prevState => ({ ...prevState, activeStepType: step.type }));
        }
        if (error) { clearError(error); }
    }, [state.activeStepType, error, clearError]);

    // ─── Flusso: Dati Personali → Spedizione → Fatturazione → Pagamento ──────
    // navigateToNextIncompleteStep segue l'ordine degli step senza saltare
    // Spedizione anche quando c'è già un'opzione pre-selezionata.
    const navigateToNextIncompleteStep = useCallback((options?: { isDefault?: boolean }): void => {
        // Cerca il primo step incompleto
        const nextIncompleteStep = find(stepsRef.current, { isComplete: false });

        if (!nextIncompleteStep) {
            // Tutti completi → vai a Payment
            const paymentStep = find(stepsRef.current, { type: CheckoutStepType.Payment });
            if (paymentStep) { navigateToStep(CheckoutStepType.Payment, options); return; }
            const lastStep = stepsRef.current[stepsRef.current.length - 1];
            if (lastStep) { navigateToStep(lastStep.type, options); }
            return;
        }

        // ✅ RIMOSSO il check su availableShippingOptions che causava il bounce:
        // prima rimandava a Shipping perché le opzioni non erano ancora caricate,
        // poi ci tornava di nuovo dopo il caricamento → doppio render visibile.
        // Ora si segue sempre l'ordine naturale degli step.

        const previousStepIndex = findIndex(stepsRef.current, { type: nextIncompleteStep.type }) - 1;
        if (previousStepIndex >= 0) {
            analyticsTracker.trackStepCompleted(stepsRef.current[previousStepIndex].type);
        }

        navigateToStep(nextIncompleteStep.type, options);
    }, [analyticsTracker, navigateToStep]);

    const handleSetBillingSameAsShipping = useCallback((isSame: boolean): void => {
        setState(prevState => ({ ...prevState, isBillingSameAsShipping: isSame }));
    }, []);

    const handleShippingNextStep = useCallback((): void => {
        if (state.isBillingSameAsShipping) {
            navigateToNextIncompleteStep();
        } else {
            navigateToStep(CheckoutStepType.Billing);
        }
    }, [navigateToNextIncompleteStep, navigateToStep, state.isBillingSameAsShipping]);

    const handleToggleMultiShipping = useCallback((): void => {
        setState((prevState) => ({ ...prevState, isMultiShippingMode: !prevState.isMultiShippingMode }));
    }, []);

    const navigateToOrderConfirmation = useCallback(async (orderId?: number): Promise<void> => {
        analyticsTracker.trackStepCompleted(stepsRef.current[stepsRef.current.length - 1].type);
        if (embeddedMessenger.current) { embeddedMessenger.current.postComplete(); }
        SubscribeSessionStorage.removeSubscribeStatus();

        try {
            localStorage.removeItem('selectedPaymentMethodId');
            localStorage.removeItem('selectedPaymentMethodName');
        } catch (e) {
            console.warn('Errore pulizia localStorage:', e);
        }

        // ── GLS: salva metafields se spedizione GLS Parcel Shop ──────────────
        if (orderId) {
            const consignment = data.getConsignments()?.[0];
            const selectedOption = consignment?.selectedShippingOption;
            const isGLS = selectedOption?.description === GLS_PARCEL_SHOP_METHOD_NAME;

            if (isGLS) {
                const shopSelection = getGLSShopSelection();
                if (shopSelection) {
                    try {
                        await fetch(`${BACKEND_URL}/gls/save-shop-selection`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                orderId,
                                partnerId: shopSelection.partnerId,
                                parcelShopId: shopSelection.parcelShopId,
                            })
                        });
                        console.log('[GLS] Metafields salvati per ordine:', orderId);
                    } catch (e) {
                        console.warn('[GLS] Errore salvataggio metafields:', e);
                    }
                    clearGLSSelection();
                }
            }
        }
        // ─────────────────────────────────────────────────────────────────────

        setState(prevState => ({ ...prevState, isRedirecting: true }));
        void navigateToOrderConfirmationUtility(orderId);
    }, [analyticsTracker, data]);

    const checkEmbeddedSupport = useCallback((methodIds: string[]): boolean => {
        return embeddedSupport.isSupported(...methodIds);
    }, [embeddedSupport]);

    const setCustomerViewType = useCallback((customerViewType: CustomerViewType): void => {
        if (customerViewType === CustomerViewType.CreateAccount && isEmbedded()) {
            if (window.top) { window.top.location.replace(createAccountUrl); }
            return;
        }
        navigateToStep(CheckoutStepType.Customer);
        setState(prevState => ({ ...prevState, customerViewType }));
    }, [createAccountUrl, navigateToStep]);

    const handleCartChangedError = useCallback((): void => {
        navigateToStep(CheckoutStepType.Shipping);
    }, [navigateToStep]);

    const handleConsignmentsUpdated = ({ data }: CheckoutSelectors): void => {
        const { hasSelectedShippingOptions: prevHasSelectedShippingOptions, activeStepType, defaultStepType } = stateRef.current;
        const newHasSelectedShippingOptions = hasSelectedShippingOptions(data.getConsignments() || []);
        const isDefaultStepPaymentOrBilling = !activeStepType && (defaultStepType === CheckoutStepType.Payment || defaultStepType === CheckoutStepType.Billing);
        const isShippingStepFinished =
            findIndex(stepsRef.current, { type: CheckoutStepType.Shipping }) <
            findIndex(stepsRef.current, { type: activeStepType }) ||
            isDefaultStepPaymentOrBilling;

        if (prevHasSelectedShippingOptions && !newHasSelectedShippingOptions && isShippingStepFinished) {
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
    }, [analyticsTracker]);

    const handleError = useCallback((error: Error): void => {
        if (isErrorWithType(error) && error.type === 'empty_cart') {
            setState(prevState => ({ ...prevState, error }));
            return;
        }
        errorLogger.log(error);
        if (embeddedMessenger.current) { embeddedMessenger.current.postError(error); }
    }, [errorLogger]);

    const handlePaymentMethodSelect = useCallback((method?: PaymentMethod): void => {
        const displayName = method?.config.displayName;
        if (displayName) {
            setStoredPaymentMethodName(displayName);
        }
        setSelectedPaymentMethodName(displayName);
    }, []);

    const handleUnhandledError = useCallback((error: Error): void => {
        handleError(error);
        setState(prevState => ({ ...prevState, error }));
    }, [handleError]);

    const handleEditStep = useCallback((type: CheckoutStepType): void => {
        navigateToStep(type);
    }, [navigateToStep]);

    const handleReady = useCallback((): void => {
        navigateToNextIncompleteStep({ isDefault: true });
    }, [navigateToNextIncompleteStep]);

    const handleNewsletterSubscription = useCallback((subscribed: boolean): void => {
        setState(prevState => ({ ...prevState, isSubscribed: subscribed }));
    }, []);

    const handleSignOut = useCallback(({ isCartEmpty }: CustomerSignOutEvent): void => {
        if (isPriceHiddenFromGuests && window.top) { window.top.location.href = cartUrl; return; }
        if (embeddedMessenger.current) { embeddedMessenger.current.postSignedOut(); }
        if (isGuestEnabled) { setCustomerViewType(CustomerViewType.Guest); }
        if (isCartEmpty) {
            setState(prevState => ({ ...prevState, isCartEmpty: true }));
            if (!isEmbedded() && window.top) { window.top.location.assign(loginUrl); return; }
        }
        navigateToStep(CheckoutStepType.Customer);
    }, [loginUrl, cartUrl, isPriceHiddenFromGuests, isGuestEnabled, setCustomerViewType, navigateToStep]);

    const handleShippingSignIn = useCallback((): void => { setCustomerViewType(CustomerViewType.Login); }, [setCustomerViewType]);
    const handleShippingCreateAccount = useCallback((): void => { setCustomerViewType(CustomerViewType.CreateAccount); }, [setCustomerViewType]);
    const handleBeforeExit = useCallback((): void => { analyticsTracker.exitCheckout(); }, [analyticsTracker]);
    const handleWalletButtonClick = useCallback((methodName: string): void => { analyticsTracker.walletButtonClick(methodName); }, [analyticsTracker]);
    const reloadWindow = useCallback((): void => { setState(prevState => ({ ...prevState, error: undefined })); window.location.reload(); }, []);
    const handleSetIsMultishippingMode = useCallback((value: boolean): void => { setState(prevState => ({ ...prevState, isMultiShippingMode: value })); }, []);

    // ✅ handleCustomerContinue: forza SEMPRE Shipping come step successivo,
    // anche se il metodo di spedizione è già pre-selezionato (isComplete = true).
    // Questo evita che navigateToNextIncompleteStep salti Shipping e vada
    // direttamente a Billing/Payment causando il bounce.
    const handleCustomerContinue = useCallback((): void => {
        analyticsTracker.trackStepCompleted(CheckoutStepType.Customer);
        navigateToStep(CheckoutStepType.Shipping);
    }, [navigateToStep, analyticsTracker]);

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
                    isBillingSameAsShipping={isBillingSameAsShipping}
                    isSubscribed={isSubscribed}
                    isWalletButtonsOnTop={isShowingWalletButtonsOnTop}
                    onAccountCreated={navigateToNextIncompleteStep}
                    onBillingSameAsShippingChange={handleSetBillingSameAsShipping}
                    onChangeViewType={setCustomerViewType}
                    onContinueAsGuest={handleCustomerContinue}
                    onContinueAsGuestError={handleError}
                    onEdit={handleEditStep}
                    onExpanded={handleExpanded}
                    onReady={handleReady}
                    key={step.type}
                    onSignIn={handleCustomerContinue}
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
                    isBillingSameAsShipping={isBillingSameAsShipping}
                    isMultiShippingMode={isMultiShippingMode}
                    isShippingDiscountDisplayEnabled={isShippingDiscountDisplayEnabled}
                    navigateNextStep={handleShippingNextStep}
                    onCreateAccount={handleShippingCreateAccount}
                    onEdit={handleEditStep}
                    key={step.type}
                    onExpanded={handleExpanded}
                    onReady={handleReady}
                    onSignIn={handleShippingSignIn}
                    onToggleMultiShipping={handleToggleMultiShipping}
                    onUnhandledError={handleUnhandledError}
                    setIsMultishippingMode={handleSetIsMultishippingMode}
                    step={step}
                />;

            case CheckoutStepType.Billing:
                return <BillingStep
                    billingAddress={billingAddress}
                    navigateNextStep={navigateToNextIncompleteStep}
                    onEdit={handleEditStep}
                    onExpanded={handleExpanded}
                    onReady={handleReady}
                    key={step.type}
                    onUnhandledError={handleUnhandledError}
                    step={step}
                    showInvoiceFields={state.showInvoiceFields}
                    onToggleInvoiceFields={handleToggleInvoiceFields}
                />;

            case CheckoutStepType.Payment:
                console.log('Dati del checkout nella fase di pagamento:', data.getCheckout());
                return <PaymentStep
                    cart={cart}
                    checkEmbeddedSupport={checkEmbeddedSupport}
                    consignments={consignments}
                    errorLogger={errorLogger}
                    isEmbedded={isEmbedded()}
                    isUsingMultiShipping={cart && consignments ? isUsingMultiShipping(consignments, cart.lineItems) : false}
                    onCartChangedError={handleCartChangedError}
                    onEdit={handleEditStep}
                    key={step.type}
                    onExpanded={handleExpanded}
                    onFinalize={navigateToOrderConfirmation}
                    onPaymentMethodSelect={handlePaymentMethodSelect}
                    onReady={handleReady}
                    onSubmit={navigateToOrderConfirmation}
                    onSubmitError={handleError}
                    onUnhandledError={handleUnhandledError}
                    step={step}
                />;

            default:
                return null;
        }
    };

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

    // ── useEffect principale: inizializzazione ────────────────────────────────
    useEffect(() => {
        const unsubscribeFromConsignments = subscribeToConsignments(handleConsignmentsUpdatedRef.current);
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
                        })
                    }));
                }
                const { links: { siteLink = '' } = {} } = data.getConfig() || {};
                const messenger = createEmbeddedMessenger({ parentOrigin: siteLink });
                messenger.receiveStyles((styles) => embeddedStylesheet.append(styles));
                messenger.postFrameLoaded({ contentId: containerId });
                messenger.postLoaded();
                embeddedMessenger.current = messenger;
                if (document.prerendering) {
                    document.addEventListener('prerenderingchange', () => { analyticsTracker.checkoutBegin(); }, { once: true });
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

                // ✅ All'init partiamo sempre da Customer (o dal primo step incompleto),
                // NON saltiamo mai direttamente a Shipping/Payment.
                handleReady();
            } catch (error) {
                if (error instanceof Error) { handleUnhandledError(error); }
            }
        };
        void init();
        return (): void => {
            if (unsubscribeFromConsignments) { unsubscribeFromConsignments(); }
            window.removeEventListener('beforeunload', handleBeforeExitRef.current);
            handleBeforeExitRef.current();
        };
    }, [analyticsTracker, containerId, createEmbeddedMessenger, data, embeddedStylesheet, handleReady, handleUnhandledError, language, loadPaymentMethodByIds, subscribeToConsignments]);

    // ── useEffect: ripristino metodo pagamento da localStorage ───────────────
    useEffect(() => {
        const storedPaymentMethodName = getStoredPaymentMethodName();
        if (storedPaymentMethodName) {
            setSelectedPaymentMethodName(storedPaymentMethodName);
        }
    }, []);

    if (state.isRedirecting) { return <OrderConfirmationPageSkeleton />; }

    let errorModal = null;
    if (state.error) {
        if (isCustomError(state.error)) {
            errorModal = (<ErrorModal error={state.error} onClose={handleCloseErrorModal} title={state.error.title} />);
        } else {
            const { message, action } = mapCheckoutComponentErrorMessage(state.error, language.translate.bind(language));
            errorModal = <ErrorModal error={state.error} message={message} onClose={action === 'reload' ? reloadWindow : handleCloseErrorModal} />;
        }
    }

    return (
        <div
            className={classNames('remove-checkout-step-numbers', { 'is-embedded': isEmbedded() }, { 'themeV2': themeV2 })}
            data-test="checkout-page-container"
            id="checkout-page-container"
        >
            <div className="layout optimizedCheckout-contentPrimary">
                {state.isCartEmpty
                    ? <EmptyCartMessage loginUrl={loginUrl} waitInterval={3000} />
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
                                    .map((step) => {
                                        const isActive = state.activeStepType
                                            ? state.activeStepType === step.type
                                            : state.defaultStepType === step.type;

                                        // Billing e Payment vengono renderizzati insieme
                                        if (step.type === CheckoutStepType.Billing) {
                                            const paymentStep = stepsRef.current.find(s => s.type === CheckoutStepType.Payment);

                                            if (!paymentStep) {
                                                return renderStep({ ...step, isActive, isBusy: isPending });
                                            }

                                            const isBillingActive = state.activeStepType
                                                ? state.activeStepType === CheckoutStepType.Billing
                                                : state.defaultStepType === CheckoutStepType.Billing;

                                            const isPaymentActive = state.activeStepType
                                                ? state.activeStepType === CheckoutStepType.Payment
                                                : state.defaultStepType === CheckoutStepType.Payment;

                                            return (
                                                <React.Fragment key="billing-payment-fragment">
                                                    {renderStep({ ...step, isActive: isBillingActive, isBusy: isPending })}
                                                    {renderStep({ ...paymentStep, isActive: isPaymentActive, isBusy: isPending })}
                                                </React.Fragment>
                                            );
                                        }

                                        // Payment è già renderizzato dentro il blocco Billing
                                        if (step.type === CheckoutStepType.Payment) {
                                            return null;
                                        }

                                        return renderStep({ ...step, isActive, isBusy: isPending });
                                    })}
                            </ol>
                        </div>
                    </>
                }
                <CartSummary
                    isMultiShippingMode={state.isMultiShippingMode}
                    selectedPaymentMethodName={selectedPaymentMethodName}
                />
            </div>
            {errorModal}
        </div>
    );
};

export default withExtension(withAnalytics(withLanguage(withCheckout(mapToCheckoutProps)(Checkout))));
