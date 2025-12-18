import { ExtensionRegion } from '@bigcommerce/checkout-sdk/essential';
import React, { lazy } from 'react';

import { Extension } from '@bigcommerce/checkout/checkout-extension';
import { CartSummarySkeleton, LazyContainer } from '@bigcommerce/checkout/ui';

import { retry } from '../../common/utility';
import { MobileView } from '../../ui/responsive';

const CartSummaryComponent = lazy(() =>
    retry(
        () =>
            import(
                /* webpackChunkName: "cart-summary" */
                '../../cart/CartSummary'
            ),
    ),
);

const CartSummaryDrawerAccordion = lazy(() =>
    retry(
        () =>
            import(
                /* webpackChunkName: "cart-summary-accordion" */
                '../../cart/CartSummaryDrawerAccordion'
            ),
    ),
);

export interface CartSummaryProps {
    isMultiShippingMode: boolean;
    selectedPaymentMethodName?:string
}

export const CartSummary: React.FC<CartSummaryProps> = ({ isMultiShippingMode,selectedPaymentMethodName}) => {    
    return (
        <MobileView>
            {(matched) => {
                if (matched) {
                    return (
                        <LazyContainer loadingSkeleton={<></>}>
                            <Extension region={ExtensionRegion.SummaryAfter} />
                           <CartSummaryDrawerAccordion isMultiShippingMode={isMultiShippingMode}     selectedPaymentMethodName={selectedPaymentMethodName} />
                        </LazyContainer>
                    );
                }

                return (
                    <LazyContainer loadingSkeleton={<CartSummarySkeleton />}>
                        <aside aria-label="Cart Summary" className="layout-cart">
                            <CartSummaryComponent isMultiShippingMode={isMultiShippingMode}     selectedPaymentMethodName={selectedPaymentMethodName} />
                            <Extension region={ExtensionRegion.SummaryAfter} />
                        </aside>
                    </LazyContainer>
                );
            }}
        </MobileView>
    );
};

export default CartSummary;
