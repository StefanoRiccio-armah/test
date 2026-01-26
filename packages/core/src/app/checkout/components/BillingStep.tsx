import { type Address } from '@bigcommerce/checkout-sdk/essential';
import React, { lazy } from 'react';

import { TranslatedString } from '@bigcommerce/checkout/locale';
import { AddressFormSkeleton, LazyContainer } from '@bigcommerce/checkout/ui';

import { type BillingProps, StaticBillingAddress } from '../../billing';
import { retry } from '../../common/utility';
import CheckoutStep from '../CheckoutStep';
import type CheckoutStepStatus from '../CheckoutStepStatus';
import type CheckoutStepType from '../CheckoutStepType';

const Billing = lazy(() =>
    retry(
        () =>
            import(
                /* webpackChunkName: "billing" */
                '../../billing/Billing'
            ),
    ),
);

export interface BillingStepProps extends BillingProps {
    step: CheckoutStepStatus;
    billingAddress?: Address;
    navigateNextStep(): void;
    onReady(): void;
    onUnhandledError(error: Error): void;
    onEdit(type: CheckoutStepType): void;
    onExpanded(type: CheckoutStepType): void;
    showInvoiceFields?: boolean;
    onToggleInvoiceFields?: (show: boolean) => void;
}

const BillingStep: React.FC<BillingStepProps> = ({
    step,
    billingAddress,
    onEdit,
    onExpanded,
    navigateNextStep,
    onReady,
    onUnhandledError,
    showInvoiceFields = false,
    onToggleInvoiceFields,
}) => {
    const handleToggleInvoice = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation(); // Previene il click sul parent
        // Attiva i campi fattura E apre lo step
        if (onToggleInvoiceFields) {
            onToggleInvoiceFields(true);
        }
        onEdit(step.type);
    };
    
    const handleEdit = () => {
        // Disattiva i campi fattura quando si modifica normalmente
        if (onToggleInvoiceFields) {
            onToggleInvoiceFields(false);
        }
        onEdit(step.type);
    };

    return (
        <CheckoutStep
            {...step}
            heading={<TranslatedString id="billing.billing_heading" />}
            key={step.type}
            onEdit={handleEdit}
            onExpanded={onExpanded}
            isActive={step.isActive}
            summary={billingAddress && <StaticBillingAddress address={billingAddress} />}
            additionalActions={
                billingAddress ? (
                    <button
                        type="button"
                        onClick={handleToggleInvoice}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#0066cc',
                            textDecoration: 'underline',
                            cursor: 'pointer',
                            padding: 0,
                            fontSize: 'inherit',
                        }}
                    >
                       <TranslatedString id="billing.want_invoice" />
                    </button>
                ) : undefined
            }
        >
            <LazyContainer loadingSkeleton={<AddressFormSkeleton />}>
                <Billing
                    navigateNextStep={navigateNextStep}
                    onReady={onReady}
                    onUnhandledError={onUnhandledError}
                    showInvoiceFields={showInvoiceFields}
                />
            </LazyContainer>
        </CheckoutStep>
    );
};

export default BillingStep;