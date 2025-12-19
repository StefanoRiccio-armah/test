import { type Checkout, type ShopperCurrency, type StoreCurrency } from '@bigcommerce/checkout-sdk';
import React, { type FunctionComponent } from 'react';

import { withCheckout } from '../checkout';
import OrderSummary from '../order/OrderSummary';

import EditLink from './EditLink';
import mapToCartSummaryProps from './mapToCartSummaryProps';
import { type RedeemableProps } from './Redeemable';
import withRedeemable from './withRedeemable';

export type WithCheckoutCartSummaryProps = {
    checkout: Checkout;
    cartUrl: string;
    storeCurrency: StoreCurrency;
    shopperCurrency: ShopperCurrency;
    storeCreditAmount?: number;
    isBuyNowCart: boolean;
    isShippingDiscountDisplayEnabled: boolean;
} & RedeemableProps;

const CartSummary: FunctionComponent<
    WithCheckoutCartSummaryProps & {
        isMultiShippingMode: boolean;
        selectedPaymentMethodName?: string; // <-- 1. MODIFICA QUI
    }
> = ({ 
    cartUrl, 
    isMultiShippingMode, 
    isBuyNowCart, 
    selectedPaymentMethodName, // <-- 2. MODIFICA QUI
    ...props 
}) => {
    const headerLink = isBuyNowCart ? null : (
        <EditLink
            isMultiShippingMode={isMultiShippingMode}
            url={cartUrl}
        />
    );

    return withRedeemable(OrderSummary)({
        ...props,
        cartUrl,
        isBuyNowCart,
        headerLink,
        paymentMethodName: selectedPaymentMethodName, // <-- 3. MODIFICA QUI
    });
};

export default withCheckout(mapToCartSummaryProps)(CartSummary);