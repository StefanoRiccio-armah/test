import {
    type LineItemMap,
    type ShopperCurrency as ShopperCurrencyType,
    type StoreCurrency,
} from '@bigcommerce/checkout-sdk';
import React, { type FunctionComponent, type ReactNode } from 'react';

import { TranslatedString } from '@bigcommerce/checkout/locale';

import { ShopperCurrency } from '../currency';

import OrderModalSummarySubheader from './OrderModalSummarySubheader';
import OrderSummaryItems from './OrderSummaryItems';
import OrderSummaryPrice from './OrderSummaryPrice';
import OrderSummarySection from './OrderSummarySection';
import OrderSummarySubtotals, { type OrderSummarySubtotalsProps } from './OrderSummarySubtotals';
import OrderSummaryTotal from './OrderSummaryTotal';

export interface OrderSummaryAccordionContentProps
    extends OrderSummarySubtotalsProps {
    additionalLineItems?: ReactNode;
    items: LineItemMap;
    total: number;
    storeCurrency: StoreCurrency;
    shopperCurrency: ShopperCurrencyType;
}

const OrderSummaryAccordionContent: FunctionComponent<OrderSummaryAccordionContentProps> = ({
    additionalLineItems,
    isTaxIncluded,
    taxes,
    storeCurrency,
    shopperCurrency,
    items,
    total,
    ...orderSummarySubtotalsProps
}) => {
    const displayInclusiveTax = isTaxIncluded && taxes && taxes.length > 0;

    const subHeaderText = (
        <OrderModalSummarySubheader
            amountWithCurrency={<ShopperCurrency amount={total} />}
            items={items}
            shopperCurrencyCode={shopperCurrency.code}
            storeCurrencyCode={storeCurrency.code}
        />
    );

    return (
        <div className="orderSummaryAccordionContent">
            {/* Header tipo modal, ma senza overlay */}
            <div className="orderSummaryAccordionHeader">
                <div>
                    <h3 className="cart-modal-title optimizedCheckout-headingSecondary">
                        <TranslatedString id="cart.cart_heading" />
                    </h3>
                    <div className="cart-heading-subheader">{subHeaderText}</div>
                </div>
            </div>

            <OrderSummarySection>
                <OrderSummaryItems displayLineItemsCount={false} items={items} />
            </OrderSummarySection>

            <OrderSummarySection>
                <OrderSummarySubtotals
                    isTaxIncluded={isTaxIncluded}
                    taxes={taxes}
                    {...orderSummarySubtotalsProps}
                />
                {additionalLineItems}
            </OrderSummarySection>

            <OrderSummarySection>
                <OrderSummaryTotal
                    orderAmount={total}
                    shopperCurrencyCode={shopperCurrency.code}
                    storeCurrencyCode={storeCurrency.code}
                />
            </OrderSummarySection>

            {displayInclusiveTax && (
                <OrderSummarySection>
                    <h5
                        className="cart-taxItem cart-taxItem--subtotal optimizedCheckout-contentPrimary"
                        data-test="tax-text"
                    >
                        <TranslatedString id="tax.inclusive_label" />
                    </h5>
                    {(taxes || []).map((tax, index) => (
                        <OrderSummaryPrice
                            amount={tax.amount}
                            key={index}
                            label={tax.name}
                            testId="cart-taxes"
                        />
                    ))}
                </OrderSummarySection>
            )}
        </div>
    );
};

export default OrderSummaryAccordionContent;
