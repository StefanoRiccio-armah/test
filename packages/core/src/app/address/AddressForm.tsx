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
import {getAddressFormFieldInputId,getAddressFormFieldLegacyName} from './getAddressFormFieldInputId';
import { GoogleAutocompleteFormField, mapToAddress } from './googleAutocomplete';
import './AddressForm.scss';
import classNames from 'classnames';

const AddressForm: React.FC<AddressFormProps> = ({
    formFields,
    fieldName,
    countryCode,
    onAutocompleteToggle,
    shouldShowSaveAddress,
    shouldShowCodiceFiscale,
    setFieldValue = noop,
    addressValues,
    onChange = noop,
    type,
    isFloatingLabelEnabled: isFloatingLabelEnabledOverride,
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

    // Valore di default globale
    const isFloatingLabelEnabledValue = config
        ? isFloatingLabelEnabled(config.checkoutSettings)
        : false;

    // Determina se usare l'override o il valore globale
    const finalIsFloatingLabelEnabled = typeof isFloatingLabelEnabledOverride === 'boolean'
        ? isFloatingLabelEnabledOverride
        : isFloatingLabelEnabledValue;

    const countriesWithAutocomplete = ['US', 'CA', 'AU', 'NZ', 'GB','IT','FR','DE','ES','NL'];

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
        (value: string, _isOpen: boolean) => {
            syncNonFormikValue(AUTOCOMPLETE_FIELD_NAME, value);
        },
        [syncNonFormikValue],
    );

    const handleAutocompleteSelect = useCallback(
        (place: google.maps.places.Place, item: AutocompleteItem) => {
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

    // -----------------------------
    // Funzione per riordinare Shipping
    // -----------------------------
    const reorderShippingFields = (fields: FormField[]) => {
        const result = [...fields];

        const cfIndex = result.findIndex(f => f.name === 'field_29');
        if (cfIndex === -1) {
            return result;
        }

        const codiceFiscaleField = result.splice(cfIndex, 1)[0];

        const phoneIndex = result.findIndex(f => f.name === 'phone');
        const insertIndex = phoneIndex !== -1 ? phoneIndex + 1 : 0;

        result.splice(insertIndex, 0, codiceFiscaleField);

        return result;
    };

    const orderedFormFields =
        type === AddressType.Shipping
            ? reorderShippingFields(formFields)
            : formFields;

    // -----------------------------
    // Funzione per renderizzare ogni campo
    // -----------------------------
    const renderFormField = (field: FormField) => {
        const addressFieldName = field.name;
        const translatedPlaceholderId = PLACEHOLDER[addressFieldName];

        if (type === AddressType.Shipping) {
            if (
                addressFieldName === 'company' ||
                addressFieldName === 'field_33' ||
                addressFieldName === 'field_35' ||
                addressFieldName === 'field_37'
            ) {
                return null;
            }

            if (addressFieldName === 'field_29') {
                if (shouldShowCodiceFiscale) {
                    return (
                        <DynamicFormField
                            autocomplete={AUTOCOMPLETE[field.name]}
                            extraClass={`dynamic-form-field--${getAddressFormFieldLegacyName(
                                addressFieldName,
                            )}`}
                            field={field}
                            inputId={getAddressFormFieldInputId(addressFieldName)}
                            isFloatingLabelEnabled={finalIsFloatingLabelEnabled}
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

                return (
                    <div
                        key="codice-fiscale-placeholder"
                        className={classNames(
                            'dynamic-form-field',
                            `dynamic-form-field--${getAddressFormFieldLegacyName(addressFieldName)}`,
                        )}
                    >
                        <div className="info-banner">
                            <span className="info-banner-icon">ℹ️</span>
                            <span className="info-banner-text">
                                <TranslatedString id="customer.fiscal_code_tooltip" />
                            </span>
                        </div>
                    </div>
                );
            }
        }

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
                    isFloatingLabelEnabled={finalIsFloatingLabelEnabled}
                    key={field.id}
                    nextElement={nextElementRef.current || undefined}
                    onChange={handleAutocompleteChange}
                    onSelect={handleAutocompleteSelect}
                    onToggleOpen={onAutocompleteToggle}
                    parentFieldName={fieldName}
                    supportedCountries={countriesWithAutocomplete}
                    value={addressValues?.address1 || field.default || ''}
                />
            );
        }

        return (
            <DynamicFormField
                autocomplete={AUTOCOMPLETE[field.name]}
                extraClass={`dynamic-form-field--${getAddressFormFieldLegacyName(
                    addressFieldName,
                )}`}
                field={field}
                inputId={getAddressFormFieldInputId(addressFieldName)}
                isFloatingLabelEnabled={finalIsFloatingLabelEnabled}
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
    };

    return (
        <>
            <Fieldset>
                <div className="checkout-address" ref={containerRef}>
                    {orderedFormFields.map(renderFormField)}
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
