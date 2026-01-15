// GoogleAutocomplete.tsx

import { noop } from 'lodash';
import React, { useRef, useState, useCallback } from 'react';

import { Autocomplete, type AutocompleteItem } from '../../ui/autocomplete';
import GoogleAutocompleteService, { type AutocompleteSuggestion } from './GoogleAutocompleteService';
import { type GoogleAutocompleteOptionTypes } from './googleAutocompleteTypes';
import './GoogleAutocomplete.scss';

export interface GoogleAutocompleteProps {
    initialValue?: string;
    componentRestrictions?: google.maps.places.ComponentRestrictions;
    fields?: string[];
    apiKey: string;
    nextElement?: HTMLElement;
    inputProps?: any;
    isAutocompleteEnabled?: boolean;
    types?: GoogleAutocompleteOptionTypes[];
    onSelect?(place: google.maps.places.PlaceResult, item: AutocompleteItem): void;
    onToggleOpen?(state: { inputValue: string; isOpen: boolean }): void;
    onChange?(value: string, isOpen: boolean): void;
}

// MODIFICATO: Questa funzione è ora aggiornata per la nuova struttura della risposta.
const toAutocompleteItems = (
    suggestions?: AutocompleteSuggestion[],
): AutocompleteItem[] => {
    if (!suggestions) {
        return [];
    }

    return suggestions.reduce<AutocompleteItem[]>((acc, suggestion) => {
        const { placePrediction } = suggestion;

        // Se per qualche motivo non c'è placePrediction, lo saltiamo
        if (!placePrediction) {
            return acc;
        }

        acc.push({
            id: placePrediction.placeId,
            // La descrizione completa ora è in `placePrediction.text.text`
            label: placePrediction.text.text,
            // Il valore principale (es. "Via Roma") è in `placePrediction.mainText.text`
            value: placePrediction.mainText?.text || '',
            // Gli `highlightedSlices` vengono calcolati dai `matches`
            highlightedSlices: placePrediction.mainText?.matches.map(
                (match) => ({
                    offset: match.startOffset,
                    length: match.endOffset - match.startOffset,
                }),
            ) || [],
        });

        return acc;
    }, []);
};

const GoogleAutocomplete: React.FC<GoogleAutocompleteProps> = ({
    initialValue,
    onToggleOpen = noop,
    inputProps = {},
    fields,
    onSelect = noop,
    nextElement,
    isAutocompleteEnabled,
    onChange = noop,
    componentRestrictions,
    types,
    apiKey,
}) => {
    const [items, setItems] = useState<AutocompleteItem[]>([]);
    const [autoComplete, setAutoComplete] = useState<string>('off');

    // Manteniamo una singola istanza del servizio per tutta la vita del componente
    const googleAutocompleteServiceRef = useRef<GoogleAutocompleteService>(
        new GoogleAutocompleteService(apiKey)
    );

    // MODIFICATO: Logica di selezione aggiornata
    const onSelectHandler = useCallback((item: AutocompleteItem) => {
        const service = googleAutocompleteServiceRef.current;

        service.getPlacesService().then((placesService: google.maps.places.PlacesService) => {
            placesService.getDetails(
                {
                    placeId: item.id,
                    fields: fields || ['address_components', 'name', 'geometry'],
                },
                (
                    result: google.maps.places.PlaceResult | null,
                    status: google.maps.places.PlacesServiceStatus,
                ) => {
                    if (status === google.maps.places.PlacesServiceStatus.OK && result) {
                        if (nextElement) {
                            nextElement.focus();
                        }
                        onSelect(result, item);
                    } else {
                        console.error('Errore nel recupero dei dettagli del luogo:', status);
                    }
                    
                    // IMPORTANTE: Rinnova il token per la prossima sessione di ricerca.
                    // Questo conclude la sessione di fatturazione corrente.
                    service.renewSessionToken();
                },
            );
        });
    }, [fields, nextElement, onSelect]);

    {/*const resetAutocomplete = useCallback((): void => {
        setItems([]);
        setAutoComplete('off');
    }, []);
    */}
    
    // NUOVO: La logica di fetch è stata leggermente aggiornata per chiarezza
    const fetchAndSetItems = useCallback(async (input: string): Promise<void> => {
        if (!isAutocompleteEnabled || !input) {
            setItems([]);
            return;
        }

        const service = googleAutocompleteServiceRef.current;
        const suggestions = await service.fetchSuggestions(input, {
            types: types || ['geocode'],
            componentRestrictions,
        });

        const autocompleteItems = toAutocompleteItems(suggestions);
        setItems(autocompleteItems);
    }, [isAutocompleteEnabled, types, componentRestrictions]);


    const onChangeHandler = useCallback((input: string) => {
        onChange(input, false);
        // Questo fa sì che l'autocomplete del browser non interferisca
        setAutoComplete(input ? 'nope' : 'off');
        // Chiama la funzione per recuperare i suggerimenti
        void fetchAndSetItems(input);
    }, [onChange, fetchAndSetItems]);

    return (
        <Autocomplete
            defaultHighlightedIndex={-1}
            initialHighlightedIndex={-1}
            initialValue={initialValue}
            inputProps={{
                ...inputProps,
                autoComplete,
            }}
            items={items}
            listTestId="address-autocomplete-suggestions"
            onChange={onChangeHandler}
            onSelect={onSelectHandler}
            onToggleOpen={onToggleOpen}
        >
            <div className="co-googleAutocomplete-footer" />
        </Autocomplete>
    );
};

export default GoogleAutocomplete;