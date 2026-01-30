import { noop } from 'lodash';
import React, { useCallback, useEffect, useState,useRef } from 'react';
import { AddressFormSkeleton } from '@bigcommerce/checkout/ui';
import type CheckoutStepStatus from '../checkout/CheckoutStepStatus';
import { useShipping } from './hooks/useShipping';
import ShippingMethodForm from './ShippingMethodForm';

export interface ShippingProps {
    isBillingSameAsShipping: boolean;
    cartHasChanged: boolean;
    isMultiShippingMode: boolean;
    step: CheckoutStepStatus;
    onCreateAccount(): void;
    onToggleMultiShipping(): void;
    onReady?(): void;
    onUnhandledError(error: Error): void;
    onSignIn(): void;
    navigateNextStep(isBillingSameAsShipping: boolean): void;
    setIsMultishippingMode(isMultiShippingMode: boolean): void;
}

function Shipping({
        cartHasChanged,
        navigateNextStep,
        onReady = noop,
        onUnhandledError = noop,
        isBillingSameAsShipping,
    }: ShippingProps) {
    const [isInitializing, setIsInitializing] = useState(true);

    const { 
        customerMessage,
        loadShippingOptions,
        shippingAddress,
        updateCheckout,
    } = useShipping();

const hasInitialized = useRef(false);

useEffect(() => {
    if (hasInitialized.current) {
        return;
    }

    hasInitialized.current = true;

    const initializeShipping = async () => {
        try {
            await loadShippingOptions();
            onReady();
        } catch (error) {
            if (error instanceof Error) {
                onUnhandledError(error);
            }
        } finally {
            setIsInitializing(false);
        }
    };

    void initializeShipping();
}, []);


    const handleSubmit = useCallback(async (orderComment?: string) => {
        try {
            // Salva eventuali commenti all'ordine
            if (orderComment && customerMessage !== orderComment) {
                await updateCheckout({ customerMessage: orderComment });
            }

            // Procedi al prossimo step
            navigateNextStep(isBillingSameAsShipping);
        } catch (error) {
            if (error instanceof Error) {
                onUnhandledError(error);
            }
        }
    }, [customerMessage, updateCheckout, navigateNextStep, isBillingSameAsShipping, onUnhandledError]);

    if (isInitializing) {
        return <AddressFormSkeleton isLoading={true} />;
    }

    return (
        <div className="checkout-form">
            {/* Mostra un riepilogo dell'indirizzo di spedizione */}
            {shippingAddress && (
                <div className="shipping-address-summary">
                    <address>
                        <div>{shippingAddress.firstName} {shippingAddress.lastName}</div>
                        <div>{shippingAddress.address1}</div>
                        {shippingAddress.address2 && <div>{shippingAddress.address2}</div>}
                        <div>
                            {shippingAddress.city}, {shippingAddress.stateOrProvinceCode} {shippingAddress.postalCode}
                        </div>
                        <div>{shippingAddress.countryCode}</div>
                    </address>
                </div>
            )}

            {/* Form SOLO per la selezione del metodo di spedizione */}
            <ShippingMethodForm
                cartHasChanged={cartHasChanged}
                isLoading={isInitializing}
                onSubmit={handleSubmit}
                onUnhandledError={onUnhandledError}
            />
        </div>
    );
}

export default Shipping;