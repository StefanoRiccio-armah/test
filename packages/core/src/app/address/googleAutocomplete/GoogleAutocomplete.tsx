import { debounce, noop } from 'lodash';
import React, { useCallback, useMemo, useRef, useState, FunctionComponent } from 'react';

import { Autocomplete, type AutocompleteItem } from '../../ui/autocomplete';
import GoogleAutocompleteService, {
    type AutocompleteSuggestion,
    type PlaceField,
} from './GoogleAutocompleteService';
import { type GoogleAutocompleteOptionTypes } from './googleAutocompleteTypes';
import './GoogleAutocomplete.scss';

export interface GoogleAutocompleteProps {
    value?: string;
    componentRestrictions?: google.maps.places.ComponentRestrictions;
    fields?: PlaceField[];
    apiKey: string;
    nextElement?: HTMLElement;
    inputProps?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    isAutocompleteEnabled?: boolean;
    types?: GoogleAutocompleteOptionTypes[];
    onSelect?(place: google.maps.places.Place, item: AutocompleteItem): void;
    onToggleOpen?(state: { inputValue: string; isOpen: boolean }): void;
    onChange?(value: string, isOpen: boolean): void;
}

const toAutocompleteItems = (
    suggestions?: AutocompleteSuggestion[],
): AutocompleteItem[] => {
    if (!suggestions) {
        return [];
    }

    return suggestions.reduce<AutocompleteItem[]>((acc, suggestion) => {
        const { placePrediction } = suggestion;

        if (!placePrediction) {
            return acc;
        }

        acc.push({
            id: placePrediction.placeId,
            label: placePrediction.text.text,
            value: placePrediction.text.text,
            highlightedSlices:
                placePrediction.mainText?.matches.map((match) => ({
                    offset: match.startOffset,
                    length: match.endOffset - match.startOffset,
                })) || [],
        });

        return acc;
    }, []);
};

const GoogleAutocomplete: FunctionComponent<GoogleAutocompleteProps> = ({
    value,
    apiKey,
    componentRestrictions,
    types,
    isAutocompleteEnabled = true,
    inputProps = {},
    fields,
    nextElement,
    onChange = noop,
    onSelect = noop,
    onToggleOpen = noop,
}) => {
    console.log('🔍 GoogleAutocomplete value:', value);
    const serviceRef = useRef(new GoogleAutocompleteService(apiKey));
    const [items, setItems] = useState<AutocompleteItem[]>([]);

    const debouncedFetch = useMemo(
        () =>
            debounce(async (input: string) => {
                if (!isAutocompleteEnabled || !input) {
                    setItems([]);
                    return;
                }
                try {
                    const suggestions = await serviceRef.current.fetchSuggestions(input, {
                        types: types || ['geocode'],
                        componentRestrictions,
                    });
                    setItems(toAutocompleteItems(suggestions));
                } catch {
                    setItems([]);
                }
            }, 300),
        [isAutocompleteEnabled, types, componentRestrictions],
    );

    const onChangeHandler = useCallback(
        (newValue: string) => {
            onChange(newValue, true);
            debouncedFetch(newValue);
        },
        [onChange, debouncedFetch],
    );

    const onSelectHandler = useCallback(
        async (item: AutocompleteItem | null) => {
            if (!item) {
                return;
            }
            onChange(item.value || '', false);
            const place = await serviceRef.current.getPlaceDetails(
                item.id,
                fields || ['addressComponents', 'displayName', 'location'],
            );
            if (place) {
                nextElement?.focus();
                onSelect(place, item);
            }
            serviceRef.current.renewSessionToken();
        },
        [fields, nextElement, onSelect, onChange],
    );
    
    const onToggleOpenHandler = useCallback(
        (state: { inputValue: string; isOpen: boolean }) => {
            onToggleOpen(state);
            if (!state.isOpen) {
                onChange(state.inputValue, false);
            }
        },
        [onToggleOpen, onChange],
    );

    return (
        <Autocomplete
            value={value || ''}
            inputProps={inputProps}
            items={items}
            onChange={onChangeHandler}
            onSelect={onSelectHandler}
            onToggleOpen={onToggleOpenHandler}
            listTestId="address-autocomplete-suggestions"
            defaultHighlightedIndex={-1}
            initialHighlightedIndex={-1}
        >
            <div className="co-googleAutocomplete-footer" />
        </Autocomplete>
    );
};

export default GoogleAutocomplete;