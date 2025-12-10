import React, { type FunctionComponent, memo, useState } from 'react';

// HOC checkout
import { withCheckout } from '../checkout';

// Tipi & componenti usati da withRedeemable
import  {
    type OrderSummaryProps,
} from '../order/OrderSummary';
import OrderSummaryAccordionContent, {
    type OrderSummaryAccordionContentProps,
} from '../order/OrderSummaryAccordionContent';

import { type WithCheckoutCartSummaryProps } from './CartSummary';
import EditLink from './EditLink';
import mapToCartSummaryProps from './mapToCartSummaryProps';
import withRedeemable from './withRedeemable';

// Icone SVG inline
const ChevronDownIcon = () => (
    <svg width="16" height="16" fill="currentColor" aria-hidden="true" viewBox="0 0 16 16">
        <path d="M4.646 6.646a.5.5 0 0 1 .708 0L8 9.293l2.646-2.647a.5.5 0 1 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 0 1 0-.708z" />
    </svg>
);

const ChevronUpIcon = () => (
    <svg width="16" height="16" fill="currentColor" aria-hidden="true" viewBox="0 0 16 16">
        <path d="M11.354 9.354a.5.5 0 0 1-.708 0L8 6.707 5.354 9.354a.5.5 0 1 1-.708-.708l3-3a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708z" />
    </svg>
);

// -------- ADAPTER --------
//
// withRedeemable si aspetta un componente che accetti
// OrderSummaryProps & OrderSummarySubtotalsProps (i tipi già usati da OrderSummary).
// Questo adapter prende quelle props, estrae ciò che serve a
// OrderSummaryAccordionContent e gliele passa nel formato giusto.
//
type OrderSummaryAdapterProps = OrderSummaryProps & {
    // qui possono esserci anche le props aggiunte da withRedeemable (coupons, taxes, ecc.)
    // non serve tipizzarle tutte a mano: usiamo "any" in destrutturazione per non litigare con TS.
};

const OrderSummaryAccordionAdapter: FunctionComponent<OrderSummaryAdapterProps> = (props) => {
    // NB: la shape esatta dipende da OrderSummaryProps.
    // Nella maggior parte dei checkout BigCommerce trovi:
    // lineItems, total, storeCurrency, shopperCurrency, additionalLineItems, ecc.
    const {
        lineItems,
        total,
        storeCurrency,
        shopperCurrency,
        additionalLineItems,
        // tutto il resto (coupons, taxes, isTaxIncluded, ecc.) va a Subtotals
        ...subtotalsProps
    } = props as any;

    const accordionProps: OrderSummaryAccordionContentProps = {
        items: lineItems,
        total,
        storeCurrency,
        shopperCurrency,
        additionalLineItems,
        ...subtotalsProps,
    };

    return <OrderSummaryAccordionContent {...accordionProps} />;
};

// -------- COMPONENTE PRINCIPALE --------

interface CartSummaryAccordionProps extends WithCheckoutCartSummaryProps {
    isMultiShippingMode: boolean;
    className?: string;
}

const CartSummaryDrawerAccordion: FunctionComponent<CartSummaryAccordionProps> = ({
    cartUrl,
    isMultiShippingMode,
    isBuyNowCart,
    className = '',
    ...props
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const toggleAccordion = () => {
        setIsExpanded((prev) => !prev);
    };

    const headerLink = isBuyNowCart
        ? null
        : (
            <EditLink
                className="modal-header-link cart-modal-link accordion-edit-link"
                isMultiShippingMode={isMultiShippingMode}
                url={cartUrl}
            />
        );

    return (
        <div className={`cart-summary-accordion ${className}`}>
            <div
                className="accordion-header"
                onClick={toggleAccordion}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleAccordion();
                    }
                }}
                aria-expanded={isExpanded}
                aria-controls="cart-summary-accordion-content"
            >
                <div
                    className="accordion-title-section"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}
                >
                    <span
                        className="accordion-title"
                        style={{ fontWeight: 600, fontSize: '1rem', color: '#1a1a1a' }}
                    >
                        Riepilogo Carrello
                    </span>
                    {headerLink && (
                        <div className="accordion-edit-section" style={{ marginLeft: 'auto' }}>
                            {headerLink}
                        </div>
                    )}
                </div>
                <button
                    type="button"
                    className="accordion-toggle-icon"
                    aria-label={isExpanded ? 'Chiudi riepilogo' : 'Apri riepilogo'}
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleAccordion();
                    }}
                    onKeyDown={(e) => e.stopPropagation()}
                    style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        color: '#555',
                    }}
                >
                    {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                </button>
            </div>

            {isExpanded && (
                <div
                    id="cart-summary-accordion-content"
                    className="accordion-content"
                    style={{ padding: 0, animation: 'accordionSlide 0.2s ease-out' }}
                >
                    {withRedeemable(OrderSummaryAccordionAdapter)({
                        ...props,
                        isBuyNowCart,
                        cartUrl,
                        headerLink: <div />,
                    })}
                </div>
            )}
        </div>
    );
};

export default withCheckout(mapToCartSummaryProps)(memo(CartSummaryDrawerAccordion));
