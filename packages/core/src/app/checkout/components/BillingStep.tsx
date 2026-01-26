import { type Address } from '@bigcommerce/checkout-sdk/essential';
import React, { lazy } from 'react';

import { TranslatedString } from '@bigcommerce/checkout/locale';
import { Button, ButtonSize, ButtonVariant } from '../../ui/button';
import { AddressFormSkeleton, LazyContainer } from '@bigcommerce/checkout/ui';
import { useThemeContext } from '@bigcommerce/checkout/contexts';

import { type BillingProps, StaticBillingAddress } from '../../billing';
import { retry } from '../../common/utility';
import CheckoutStep from '../CheckoutStep';
import type CheckoutStepStatus from '../CheckoutStepStatus';
import type CheckoutStepType from '../CheckoutStepType';
import classNames from 'classnames';

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
        e.stopPropagation();
        if (onToggleInvoiceFields) {
            onToggleInvoiceFields(true);
        }
        onEdit(step.type);
    };
    
    const handleEdit = () => {
        if (onToggleInvoiceFields) {
            onToggleInvoiceFields(false);
        }
        onEdit(step.type);
    };
    const { themeV2 } = useThemeContext();

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

                    <Button
                        onClick={handleToggleInvoice}
                        size={ButtonSize.Tiny}
                        variant={ButtonVariant.Secondary}
                        className={classNames({ 'body-regular': themeV2 })}
                         testId="invoice-button"
                    >
                       <TranslatedString id="billing.want_invoice" />
                    </Button>
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