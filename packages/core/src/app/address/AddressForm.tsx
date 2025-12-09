import { type FormField } from '@bigcommerce/checkout-sdk';
import { forIn, noop } from 'lodash';
import React, { useCallback, useEffect, useRef } from 'react';

import { useCheckout, useLocale, useThemeContext } from '@bigcommerce/checkout/contexts';
import { TranslatedString } from '@bigcommerce/checkout/locale';
import { DynamicFormField, DynamicFormFieldType } from '@bigcommerce/checkout/ui';

import { EMPTY_ARRAY, isFloatingLabelEnabled } from '../common/utility';
import { type AutocompleteItem } from '../ui/autocomplete';
import { CheckboxFormField, Fieldset } from '../ui/form';

import { type AddressFormProps, AUTOCOMPLETE, AUTOCOMPLETE_FIELD_NAME, LABEL, PLACEHOLDER } from './AddressFormType';
import AddressType from './AddressType';
import {
    getAddressFormFieldInputId,
    getAddressFormFieldLegacyName,
} from './getAddressFormFieldInputId';
import { GoogleAutocompleteFormField, mapToAddress } from './googleAutocomplete';
import './AddressForm.scss';

const AddressForm: React.FC<AddressFormProps> = ({
    formFields,
    fieldName,
    countryCode,
    onAutocompleteToggle,
    shouldShowSaveAddress,
    shouldShowCodiceFiscale,
    setFieldValue = noop,
    onChange = noop,
    type,
}) => {
    const { language } = useLocale();
    const { themeV2 } = useThemeContext();
    const {
        checkoutState: {
            data: { getConfig, getBillingCountries, getShippingCountries },
        },
    } = useCheckout();

    const config = getConfig();
    const countries =
        (type === AddressType.Billing ? getBillingCountries() : getShippingCountries()) ||
        EMPTY_ARRAY;
    const googleMapsApiKey = config?.checkoutSettings.googleMapsApiKey || '';
    const isFloatingLabelEnabledValue = config
        ? isFloatingLabelEnabled(config.checkoutSettings)
        : false;
    const countriesWithAutocomplete = ['US', 'CA', 'AU', 'NZ', 'GB'];

    const containerRef = useRef<HTMLDivElement>(null);
    const nextElementRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        const { current } = containerRef;

        if (current) {
            nextElementRef.current =
                current.querySelector<HTMLElement>('[autocomplete="address-line2"]');
        }
    }, []);

    const syncNonFormikValue = useCallback(
        (fieldName: string, value: string | string[]) => {
            const dateFormFieldNames = formFields
                .filter((field) => field.custom && field.fieldType === DynamicFormFieldType.DATE)
                .map((field) => field.name);

            if (fieldName === AUTOCOMPLETE_FIELD_NAME || dateFormFieldNames.includes(fieldName)) {
                setFieldValue(fieldName, value);
            }

            onChange(fieldName, value);
        },
        [formFields, setFieldValue, onChange],
    );

    const handleDynamicFormFieldChange = useCallback(
        (name: string) =>
            (value: string | string[]) => {
                syncNonFormikValue(name, value);
            },
        [syncNonFormikValue],
    );

    const handleAutocompleteChange = useCallback(
        (value: string, isOpen: boolean) => {
            if (!isOpen) {
                syncNonFormikValue(AUTOCOMPLETE_FIELD_NAME, value);
            }
        },
        [syncNonFormikValue],
    );

    const handleAutocompleteSelect = useCallback(
        (place: google.maps.places.PlaceResult, item: AutocompleteItem) => {
            const { value: autocompleteValue } = item;
            const address = mapToAddress(place, countries);

            forIn(address, (value, fieldName) => {
                if (fieldName === AUTOCOMPLETE_FIELD_NAME && value === undefined) return;
                setFieldValue(fieldName, value as string);
                onChange(fieldName, value as string);
            });

            const address1 = address.address1 ? address.address1 : autocompleteValue;
            if (address1) {
                syncNonFormikValue(AUTOCOMPLETE_FIELD_NAME, address1);
            }
        },
        [countries, setFieldValue, onChange, syncNonFormikValue],
    );

    const getPlaceholderValue = useCallback(
        (field: FormField, translatedPlaceholderId: string): string => {
            if (field.default && field.fieldType !== 'dropdown') {
                return field.default;
            }
            return translatedPlaceholderId && language.translate(translatedPlaceholderId);
        },
        [language],
    );

    return (
        <>
            <Fieldset>
                <div className="checkout-address" ref={containerRef}>
                    {formFields.map((field) => {
                        const addressFieldName = field.name;
                        const translatedPlaceholderId = PLACEHOLDER[addressFieldName];

                        //
                        // LOGICA SHIPPING vs BILLING (campi aziendali / CF)
                        //
                        if (type === AddressType.Shipping) {
                            // In SHIPPING:
                            // - nascondi sempre company
                            // - nascondi sempre field_29 (CF)
            if (
            addressFieldName === 'company' ||   // Ragione Sociale
            addressFieldName === 'field_29' ||  // Codice Fiscale
            addressFieldName === 'field_31' ||  // P.IVA
            addressFieldName === 'field_33' ||  // PEC
            addressFieldName === 'field_35'     // Codice SDI
        ) {
            return null;
        }
    } else if (type === AddressType.Billing) {
                            // In BILLING:
                            // company: mostrata normalmente (niente return qui, cade nel render di default)
                            // field_29: gestito sotto con shouldShowCodiceFiscale
                        }

                        //
                        // CODICE FISCALE (field_29) in BILLING
                        //
                        if (type === AddressType.Billing && addressFieldName === 'field_29') {
                            if (shouldShowCodiceFiscale) {
                                // Mostra il campo di input
                                return (
                                    <DynamicFormField
                                        autocomplete={AUTOCOMPLETE[field.name]}
                                        extraClass={`dynamic-form-field--${getAddressFormFieldLegacyName(
                                            addressFieldName,
                                        )}`}
                                        field={field}
                                        inputId={getAddressFormFieldInputId(addressFieldName)}
                                        isFloatingLabelEnabled={isFloatingLabelEnabledValue}
                                        key={`${field.id}-${field.name}`}
                                        label={
                                            field.custom ? (
                                                field.label
                                            ) : (
                                                <TranslatedString id={LABEL[field.name]} />
                                            )
                                        }
                                        onChange={handleDynamicFormFieldChange(addressFieldName)}
                                        parentFieldName={
                                            field.custom
                                                ? fieldName
                                                    ? `${fieldName}.customFields`
                                                    : 'customFields'
                                                : fieldName
                                        }
                                        placeholder={getPlaceholderValue(
                                            field,
                                            translatedPlaceholderId,
                                        )}
                                        themeV2={themeV2}
                                    />
                                );
                            }

                            // Billing ma non deve essere mostrato come input → tooltip
                            return (
                                <div
                                    key="codice-fiscale-placeholder"
                                    className="form-field"
                                >
                                    <label className="form-label optimizedCheckout-form-label">
                                        {field.label}
                                    </label>
                                    <span
                                        style={{
                                            color: 'black',
                                            fontSize: '1.5rem',
                                            display: 'block',
                                        }}
                                    >
                                        ❕ Nel tuo carrello non ci sono prodotti detraibili
                                    </span>
                                </div>
                            );
                        }

                        //
                        // ADDRESS1 con Google Autocomplete
                        //
                        if (
                            addressFieldName === 'address1' &&
                            googleMapsApiKey &&
                            countryCode &&
                            countriesWithAutocomplete.includes(countryCode)
                        ) {
                            return (
                                <GoogleAutocompleteFormField
                                    apiKey={googleMapsApiKey}
                                    countryCode={countryCode}
                                    field={field}
                                    isFloatingLabelEnabled={isFloatingLabelEnabledValue}
                                    key={field.id}
                                    nextElement={nextElementRef.current || undefined}
                                    onChange={handleAutocompleteChange}
                                    onSelect={handleAutocompleteSelect}
                                    onToggleOpen={onAutocompleteToggle}
                                    parentFieldName={fieldName}
                                    supportedCountries={countriesWithAutocomplete}
                                />
                            );
                        }

                        //
                        // RENDER DI DEFAULT PER TUTTI GLI ALTRI CAMPI
                        //
                        return (
                            <DynamicFormField
                                autocomplete={AUTOCOMPLETE[field.name]}
                                extraClass={`dynamic-form-field--${getAddressFormFieldLegacyName(
                                    addressFieldName,
                                )}`}
                                field={field}
                                inputId={getAddressFormFieldInputId(addressFieldName)}
                                isFloatingLabelEnabled={isFloatingLabelEnabledValue}
                                key={`${field.id}-${field.name}`}
                                label={
                                    field.custom ? (
                                        field.label
                                    ) : (
                                        <TranslatedString id={LABEL[field.name]} />
                                    )
                                }
                                onChange={handleDynamicFormFieldChange(addressFieldName)}
                                parentFieldName={
                                    field.custom
                                        ? fieldName
                                            ? `${fieldName}.customFields`
                                            : 'customFields'
                                        : fieldName
                                }
                                placeholder={getPlaceholderValue(field, translatedPlaceholderId)}
                                themeV2={themeV2}
                            />
                        );
                    })}
                </div>
            </Fieldset>

            {shouldShowSaveAddress && (
                <CheckboxFormField
                    labelContent={<TranslatedString id="address.save_in_addressbook" />}
                    name={fieldName ? `${fieldName}.shouldSaveAddress` : 'shouldSaveAddress'}
                    themeV2={themeV2}
                />
            )}
        </>
    );
};

export default AddressForm;
