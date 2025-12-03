import React,{lazy} from 'react'

import { TranslatedString } from '@bigcommerce/checkout/locale'
import { AddressFormSkeleton, LazyContainer } from '@bigcommerce/checkout/ui'

import { retry } from '../../common/utility'
import CheckoutStep from '../../checkout/CheckoutStep'
import type CheckoutStepType from '../../checkout/CheckoutStepType'

import { type CustomerAndShippingProps } from './CustomerAndShipping'


const CustomerAndShippingContainer = lazy(()=> retry(()=> import(/*webpackChunkName: "customer-shipping" */ './CustomerAndShipping')))

export interface CustomerAndShippingStepProps extends CustomerAndShippingProps{
    onEdit(type:CheckoutStepType):void
    onExpanded(type:CheckoutStepType):void
}

const CustomerAndShippingStep:React.FC<CustomerAndShippingStepProps> = (props) =>{

    return(
        <CheckoutStep
        {...props.step}
        heading={<TranslatedString id="checkout.customer_shipping_heading" />}
        key={props.step.type}
        onEdit={props.onEdit}
        onExpanded={props.onExpanded}
        >
            <LazyContainer loadingSkeleton={<AddressFormSkeleton />}>
                <CustomerAndShippingContainer {...props} />
            </LazyContainer>
        </CheckoutStep>
    )
}

export default CustomerAndShippingStep