import { type Address } from '@bigcommerce/checkout-sdk';
import { mapCustomFormFieldsFromFormValues } from '../formFields';
import { type AddressFormValues } from './mapAddressToFormValues';

export default function mapAddressFromFormValues(formValues: AddressFormValues): Address {
    const { customFields, ...address } = formValues;
    const shouldSaveAddress = formValues.shouldSaveAddress;
    const mappedCustomFields = mapCustomFormFieldsFromFormValues(customFields);
    const result: Address = {
        ...address,
        shouldSaveAddress,
        customFields: mappedCustomFields,
    };

    return result;
}
