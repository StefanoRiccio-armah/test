import type { Cart, Consignment } from '@bigcommerce/checkout-sdk/essential';
import React, { type FC, useCallback } from 'react';
import { ShippingSummary } from '../../shipping';
import ShippingFormFooter from '../../shipping/ShippingFormFooter';
import CheckoutStep from '../CheckoutStep';
import type CheckoutStepStatus from '../CheckoutStepStatus';
import hasSelectedShippingOptions from '../../shipping/hasSelectedShippingOptions';
import CheckoutStepType from '../CheckoutStepType';



export interface ShippingMethodStepProps {
    step: CheckoutStepStatus;
    consignments: Consignment[];
    cart?: Cart;
    isBillingSameAsShipping: boolean;
    isShippingDiscountDisplayEnabled?: boolean;
    navigateNextStep(): void;
    onEdit(type: CheckoutStepType): void;
    onExpanded(type: CheckoutStepType): void;
}

const ShippingMethodStep: FC<ShippingMethodStepProps> = ({
    step,
    consignments,
    cart,
    navigateNextStep,
    onEdit,
    onExpanded,
    isShippingDiscountDisplayEnabled,
}) => {
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
            onExpanded={onExpanded}
            summary={
                isSelectionComplete && consignments[0].selectedShippingOption ? (
                    <div>{consignments[0].selectedShippingOption.description}</div>
                ) : null
            }
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
                    shouldDisableSubmit={!isSelectionComplete}
                    shouldShowOrderComments={false}
                    shouldShowShippingOptions
                />
            </form>
        </CheckoutStep>
    );
};

export default ShippingMethodStep;