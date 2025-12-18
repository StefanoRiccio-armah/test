import React, { type ComponentType, type FunctionComponent } from 'react';
import { type OrderSummaryProps, type OrderSummarySubtotalsProps } from '../order';
import { type WithCheckoutCartSummaryProps } from './CartSummary';
import mapToOrderSummarySubtotalsProps from './mapToOrderSummarySubtotalsProps';
import Redeemable from './Redeemable';



export default function withRedeemable(
    OriginalComponent: ComponentType<OrderSummaryProps & OrderSummarySubtotalsProps>,
): FunctionComponent<WithCheckoutCartSummaryProps & { headerLink?: any, paymentMethodName?:string }> {
    return (props) => {
        const {
            checkout,
            storeCurrency,
            shopperCurrency,
            headerLink,
            onRemovedCoupon,
            onRemovedGiftCertificate,
            storeCreditAmount,
            isShippingDiscountDisplayEnabled,
            paymentMethodName,
            ...redeemableProps
        } = props;
      
 
     return (
            <OriginalComponent
                {...mapToOrderSummarySubtotalsProps(checkout, isShippingDiscountDisplayEnabled)}
                additionalLineItems={
                    <Redeemable
                        {...{
                            ...redeemableProps,
                            onRemovedCoupon,
                            onRemovedGiftCertificate,
                        }}
                    />
                }
                headerLink={headerLink}
                lineItems={checkout.cart.lineItems}
                onRemovedCoupon={onRemovedCoupon}
                onRemovedGiftCertificate={onRemovedGiftCertificate}
                shopperCurrency={shopperCurrency}
                storeCreditAmount={storeCreditAmount}
                storeCurrency={storeCurrency}
                paymentMethodName={paymentMethodName}
                total={checkout.outstandingBalance}
            />
        );
    };
}