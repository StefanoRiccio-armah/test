import { type Cart, type Consignment } from '@bigcommerce/checkout-sdk/essential';
import React, { type FC, useCallback, useEffect, useRef } from 'react';

import CheckoutStepType from '../CheckoutStepType';
import { ShippingSummary } from '../../shipping';
import ShippingFormFooter from '../../shipping/ShippingFormFooter';
import CheckoutStep from '../CheckoutStep';
import type CheckoutStepStatus from '../CheckoutStepStatus';
import hasSelectedShippingOptions from '../../shipping/hasSelectedShippingOptions';

export interface ShippingMethodStepProps {
    step: CheckoutStepStatus;
    consignments: Consignment[];
    cart?: Cart;
    isBillingSameAsShipping: boolean;
    isShippingDiscountDisplayEnabled?: boolean;
    navigateNextStep(): void;
    onEdit(type: CheckoutStepType): void;
    onExpanded(type: CheckoutStepType): void;
    navigateToStep(type: CheckoutStepType): void;
    // La prop è stata cambiata: ora riceve la funzione orchestratore
    onSelectShippingOption(consignmentId: string, optionId: string): Promise<void>;
}

const ShippingMethodStep: FC<ShippingMethodStepProps> = ({
    step,
    consignments,
    cart,
    navigateNextStep,
    onEdit,
    onExpanded,
    isShippingDiscountDisplayEnabled,
    navigateToStep,
    onSelectShippingOption, // Usiamo la nuova prop
}) => {
    const didSync = useRef(false);

    const handleGoBackToShipping = useCallback(() => {
        navigateToStep(CheckoutStepType.Shipping);
    }, [navigateToStep]);

    useEffect(() => {
        if (!step.isActive || didSync.current) {
            return;
        }

        const consignment = consignments && consignments[0];
        
        if (!consignment || !consignment.availableShippingOptions || consignment.availableShippingOptions.length === 0) {
            handleGoBackToShipping();
            return;
        }
        
        didSync.current = true;

        const availableOptions = consignment.availableShippingOptions;
        const selectedOption = consignment.selectedShippingOption;

        // La logica è semplificata: se non c'è una selezione, la facciamo fare al genitore.
        if (!selectedOption) {
            const firstOption = availableOptions[0];
            if (firstOption) {
                console.log(`[ShippingMethodStep] Nessuna selezione, chiamo onSelectShippingOption per: "${firstOption.description}".`);
                void onSelectShippingOption(consignment.id, firstOption.id);
            }
        }
    }, [
        step.isActive, 
        consignments, 
        onSelectShippingOption,
        handleGoBackToShipping
    ]);
    
    if (!step) {
        return null;
    }

    const isSelectionComplete = hasSelectedShippingOptions(consignments);

    const handleSubmit = useCallback((event: React.FormEvent) => {
        event.preventDefault();
        navigateNextStep();
    }, [navigateNextStep]);

    return (
        <CheckoutStep
            {...step}
            key={step.type}
            onEdit={() => onEdit(CheckoutStepType.Shipping)}
            onExpanded={() => onExpanded(step.type)}
            summary={isSelectionComplete && consignments[0]?.selectedShippingOption ? <div>{consignments[0].selectedShippingOption.description}</div> : null}
            heading="Metodo di Spedizione"
        >
            <form onSubmit={handleSubmit}>
                <div className="checkout-step-summary">
                    { cart && <ShippingSummary
                        cart={cart}
                        consignments={consignments}
                        isMultiShippingMode={false}
                        isShippingDiscountDisplayEnabled={!!isShippingDiscountDisplayEnabled}
                    /> }
                </div>
                <hr />
                <ShippingFormFooter
                    cartHasChanged={false}
                    isInitialValueLoaded
                    isLoading={step.isBusy}
                    isMultiShippingMode={false}
                    shouldDisableSubmit={!isSelectionComplete || step.isBusy}
                    shouldShowOrderComments={false}
                    shouldShowShippingOptions
                />
            </form>
        </CheckoutStep>
    );
};

export default ShippingMethodStep;