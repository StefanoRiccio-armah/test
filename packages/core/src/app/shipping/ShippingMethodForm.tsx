import React, { type FunctionComponent } from 'react';
import { Formik } from 'formik';

import { TranslatedString } from '@bigcommerce/checkout/locale';
import { useThemeContext } from '@bigcommerce/checkout/contexts';

import { OrderComments } from '../orderComments';
import { Alert, AlertType } from '../ui/alert';
import { Button, ButtonVariant } from '../ui/button';
import { Fieldset, Form, Legend } from '../ui/form';
import { ShippingOptions } from './shippingOption';
import { useShipping } from './hooks/useShipping';

export interface ShippingMethodFormProps {
    cartHasChanged: boolean;
    isLoading: boolean;
    onSubmit(orderComment?: string): Promise<void>;
    onUnhandledError(error: Error): void;
}

const ShippingMethodForm: FunctionComponent<ShippingMethodFormProps> = ({
    cartHasChanged,
    isLoading,
    onSubmit,
    onUnhandledError,
}) => {
    const { themeV2 } = useThemeContext();
    
    const {
        consignments,
        shouldShowOrderComments,
        customerMessage,
    } = useShipping();

    const handleSubmit = async (values: { orderComment: string }) => {
        // Verify that a shipping method is selected
        const hasSelectedMethod = consignments?.some(
            consignment => consignment.selectedShippingOption
        );

        if (!hasSelectedMethod) {
            onUnhandledError(new Error('Please select a shipping method'));
            return;
        }

        try {
            // Use the order comment if present, otherwise use the existing one
            await onSubmit(values.orderComment || customerMessage);
        } catch (error) {
            if (error instanceof Error) {
                onUnhandledError(error);
            }
        }
    };

    return (
        <Formik
            initialValues={{ orderComment: customerMessage || '' }}
            onSubmit={handleSubmit}
        >
            {({ isSubmitting }) => (
                <Form
                    className="checkout-form"
                    id="checkout-shipping-method"
                >
                    {cartHasChanged && (
                        <Alert type={AlertType.Error}>
                            <strong>
                                <TranslatedString id="shipping.cart_change_error" />
                            </strong>
                        </Alert>
                    )}

                    <Fieldset
                        id="checkout-shipping-options"
                        legend={
                            <Legend themeV2={themeV2}>
                                Metodo di spedizione
                            </Legend>
                        }
                    >
                        <ShippingOptions
                            isInitialValueLoaded={!isLoading}
                            isMultiShippingMode={false}
                            isUpdatingAddress={false}
                            shouldShowShippingOptions={true}
                        />
                    </Fieldset>

                    {shouldShowOrderComments && (
                        <OrderComments />
                    )}

                    <div className="form-actions">
                        <Button
                            className={themeV2 ? 'body-bold' : ''}
                            id="checkout-shipping-continue"
                            isLoading={isSubmitting}
                            type="submit"
                            variant={ButtonVariant.Primary}
                            disabled={!consignments?.some(c => c.selectedShippingOption)}
                        >
                            <TranslatedString id="common.continue_action" />
                        </Button>
                    </div>
                </Form>
            )}
        </Formik>
    );
};

export default ShippingMethodForm;