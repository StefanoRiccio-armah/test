import getGoogleAutocompleteScriptLoader from './getGoogleAutocompleteScriptLoader';
import type GoogleAutocompleteScriptLoader from './GoogleAutocompleteScriptLoader';

export type AutocompleteSuggestion = google.maps.places.AutocompleteSuggestion;
export type AutocompleteSessionToken = google.maps.places.AutocompleteSessionToken;

/**
 * Campi supportati dalla Place API (New)
 * https://developers.google.com/maps/documentation/javascript/place-data-fields
 */
export type PlaceField =
    | 'addressComponents'
    | 'displayName'
    | 'location'
    | 'formattedAddress'
    | 'postalAddress';

interface FetchSuggestionsOptions {
    types?: string[];
    componentRestrictions?: google.maps.places.ComponentRestrictions;
}

export default class GoogleAutocompleteService {
    private _scriptLoader: GoogleAutocompleteScriptLoader;
    private _mapsSdkPromise?: Promise<typeof google.maps>;
    private _sessionToken?: AutocompleteSessionToken;

    constructor(
        private _apiKey: string,
        scriptLoader: GoogleAutocompleteScriptLoader = getGoogleAutocompleteScriptLoader(),
    ) {
        this._scriptLoader = scriptLoader;
    }

    /**
     * Carica Google Maps SDK + Places Library (NUOVA API)
     */
    private async _loadMapsSdk(): Promise<typeof google.maps> {
        if (!this._mapsSdkPromise) {
            this._mapsSdkPromise = this._scriptLoader.loadMapsSdk(this._apiKey);
        }

        await this._mapsSdkPromise;

        // Places API (New): import obbligatorio
        await google.maps.importLibrary('places');

        return window.google.maps;
    }

    private _ensureSessionToken(): void {
        if (!this._sessionToken) {
            this._sessionToken = new google.maps.places.AutocompleteSessionToken();
        }
    }

    /**
     * Autocomplete — Places API (New)
     */
    public async fetchSuggestions(
        input: string,
        options: FetchSuggestionsOptions = {},
    ): Promise<AutocompleteSuggestion[]> {
        if (!input) {
            return [];
        }

        try {
            await this._loadMapsSdk();

            const { AutocompleteSuggestion } =
                (await google.maps.importLibrary(
                    'places',
                )) as google.maps.PlacesLibrary;

            this._ensureSessionToken();

            const request: google.maps.places.AutocompleteRequest = {
                input,
                sessionToken: this._sessionToken,
                includedPrimaryTypes: options.types,
            };

            if (options.componentRestrictions?.country) {
                request.includedRegionCodes = Array.isArray(
                    options.componentRestrictions.country,
                )
                    ? options.componentRestrictions.country
                    : [options.componentRestrictions.country];
            }

            const { suggestions } =
                await AutocompleteSuggestion.fetchAutocompleteSuggestions(
                    request,
                );

            return suggestions ?? [];
        } catch (error) {
            console.error(
                '[GoogleAutocompleteService] fetchSuggestions error',
                error,
            );
            this.renewSessionToken();
            return [];
        }
    }

    /**
     * Place Details — Places API (New)
     */
    public async getPlaceDetails(
        placeId: string,
        fields: PlaceField[] = [
            'addressComponents',
            'displayName',
            'location',
        ],
    ): Promise<google.maps.places.Place | null> {
        try {
            await this._loadMapsSdk();

            const { Place } =
                (await google.maps.importLibrary(
                    'places',
                )) as google.maps.PlacesLibrary;

            const place = new Place({ id: placeId });

            await place.fetchFields({ fields });

            return place;
        } catch (error) {
            console.error(
                '[GoogleAutocompleteService] getPlaceDetails error',
                error,
            );
            return null;
        }
    }

    /**
     * Session token lifecycle (best practice Google)
     */
    public renewSessionToken(): void {
        this._sessionToken =
            new google.maps.places.AutocompleteSessionToken();
    }
}
