import React, { type FunctionComponent, useCallback, useMemo } from 'react';
import { Field, type FieldProps } from 'formik';

import { useThemeContext } from '@bigcommerce/checkout/contexts';

import { FormField, TextInput } from '../ui/form';
import { isCodiceFiscaleValid, normalizeCodiceFiscale, CODICE_FISCALE_ERROR } from './codice-fiscale-validator';

interface CodiceFiscaleFieldProps {
    isRequired?: boolean;
    isFloatingLabelEnabled?: boolean;
}

const CodiceFiscaleField: FunctionComponent<CodiceFiscaleFieldProps> = ({
    isRequired = false,
    isFloatingLabelEnabled = false,
}) => {
    const { themeV2 } = useThemeContext();

    const validateCodiceFiscale = useCallback((value: string) => {
        if (!value) {
            return isRequired ? 'Codice Fiscale è obbligatorio' : undefined;
        }

        if (!isCodiceFiscaleValid(value)) {
            return CODICE_FISCALE_ERROR;
        }

        return undefined;
    }, [isRequired]);

    const renderInput = useCallback(
        (props: FieldProps<string>) => {
            const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
                const value = e.currentTarget.value;
                if (value) {
                    // Normalizza il valore (uppercase, trim)
                    const normalized = normalizeCodiceFiscale(value);
                    props.form.setFieldValue('codiceFiscale', normalized);
                }
                props.field.onBlur(e);
            };

            return (
                <TextInput
                    {...props.field}
                    autoComplete="off"
                    id={props.field.name}
                    isFloatingLabelEnabled={isFloatingLabelEnabled}
                    placeholder="Es. RSSMRA90A01H501U"
                    required={isRequired}
                    themeV2={themeV2}
                    type="text"
                    maxLength={16}
                    onBlur={handleBlur}
                />
            );
        },
        [isFloatingLabelEnabled, themeV2, isRequired],
    );

    const labelContent = useMemo(() => <span>Codice Fiscale</span>, []);

    return (
        <Field
            name="codiceFiscale"
            validate={validateCodiceFiscale}
            render={(props: FieldProps<string>) => (
                <FormField
                    input={() => renderInput(props)}
                    isFloatingLabelEnabled={isFloatingLabelEnabled}
                    labelContent={labelContent}
                    name="codiceFiscale"
                    themeV2={themeV2}
                />
            )}
        />
    );
};

export default CodiceFiscaleField;
