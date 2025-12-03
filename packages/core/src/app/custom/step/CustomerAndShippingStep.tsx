// CustomerAndShippingStep.tsx
import React, { lazy } from 'react';

import { AddressFormSkeleton, LazyContainer } from '@bigcommerce/checkout/ui';

import { retry } from '../../common/utility';
import CheckoutStep from '../../checkout/CheckoutStep';
import type CheckoutStepType from '../../checkout/CheckoutStepType';

import { type CustomerAndShippingProps } from './CustomerAndShipping';

const CustomerAndShippingContainer = lazy(() =>
    retry(() => import(/* webpackChunkName: "customer-shipping" */ './CustomerAndShipping')),
);

// eredita 1:1 dal container, NON cambiamo onExpanded
export interface CustomerAndShippingStepProps extends CustomerAndShippingProps {}

const CustomerAndShippingStep: React.FC<CustomerAndShippingStepProps> = (props) => {
    const { step, onExpanded, onEdit, ...rest } = props;

    return (
        <CheckoutStep
            {...step}
            heading="Dati personali e spedizione"
            key={step.type}
            onEdit={onEdit}
            // qui adattiamo la firma per CheckoutStep
            onExpanded={(type: CheckoutStepType) => {
                // se ti serve, puoi usare `type` qui
                onExpanded(); // chiama la callback () => void del container
            }}
        >
            <LazyContainer loadingSkeleton={<AddressFormSkeleton />}>
                <CustomerAndShippingContainer
                    {...rest}
                    step={step}
                    onExpanded={onExpanded} // il container si aspetta () => void
                    onEdit={onEdit}
                />
            </LazyContainer>
        </CheckoutStep>
    );
};

export default CustomerAndShippingStep;
