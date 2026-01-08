import React, { lazy } from 'react';

import { LazyContainer } from '@bigcommerce/checkout/ui';

import { retry } from '../../common/utility';
import {
    CheckoutSuggestion,
    CustomerInfo,
    type CustomerProps,
    type CustomerSignOutEvent,
} from '../../customer';
import { TranslatedString } from '@bigcommerce/checkout/locale';
import { isEmbedded } from '../../embeddedCheckout';
import CheckoutStep from '../CheckoutStep';
import type CheckoutStepType from '../CheckoutStepType';


const Customer = lazy(() =>
    retry(
        () =>
            import(
                /* webpackChunkName: "customer" */
                '../../customer/Customer'
            ),
    ),
);

export interface CustomerStepProps extends CustomerProps {
    onEdit(type: CheckoutStepType): void;
    onExpanded(type: CheckoutStepType): void;
    onSignOut(event: CustomerSignOutEvent): void;
    onSignOutError(error: Error): void;
    // NUOVE PROPS PER GESTIRE LO STATO DELLA FATTURAZIONE
    onBillingSameAsShippingChange(isSame: boolean): void;
    isBillingSameAsShipping: boolean;
}

const CustomerStep: React.FC<CustomerStepProps> = ({
    step,
    viewType,
    isSubscribed,
    isWalletButtonsOnTop,
    onEdit,
    onExpanded,
    onSignOut,
    onSignOutError,
    checkEmbeddedSupport,
    onAccountCreated,
    onChangeViewType,
    onContinueAsGuest,
    onContinueAsGuestError,
    onReady,
    onSignIn,
    onSignInError,
    onSubscribeToNewsletter,
    onUnhandledError,
    onWalletButtonClick,
    // Destruttura le nuove props
    onBillingSameAsShippingChange,
    isBillingSameAsShipping,
}) => {
    return (
        <CheckoutStep
            {...step}
            heading={<TranslatedString id="customer.customer_heading" />}
            key={step.type}
            isActive={step.isActive}
            onEdit={onEdit}
            onExpanded={onExpanded}
            suggestion={<CheckoutSuggestion />}
            summary={
                <CustomerInfo
                    onSignOut={onSignOut}
                    onSignOutError={onSignOutError}
                />
            }
        >
            <LazyContainer>
                <Customer
                    checkEmbeddedSupport={checkEmbeddedSupport}
                    isBillingSameAsShipping={isBillingSameAsShipping}
                    isEmbedded={isEmbedded()}
                    isSubscribed={isSubscribed}
                    isWalletButtonsOnTop={isWalletButtonsOnTop}
                    onAccountCreated={onAccountCreated}
                    onBillingSameAsShippingChange={onBillingSameAsShippingChange}
                    onChangeViewType={onChangeViewType}
                    onContinueAsGuest={onContinueAsGuest}
                    onContinueAsGuestError={onContinueAsGuestError}
                    onReady={onReady}
                    onSignIn={onSignIn}
                    onSignInError={onSignInError}
                    onSubscribeToNewsletter={onSubscribeToNewsletter}
                    onUnhandledError={onUnhandledError}
                    onWalletButtonClick={onWalletButtonClick}
                    step={step}
                    viewType={viewType}
                />
            </LazyContainer>
        </CheckoutStep>
    );
};

export default CustomerStep;