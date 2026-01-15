// GoogleAutocompleteService.ts

import getGoogleAutocompleteScriptLoader from './getGoogleAutocompleteScriptLoader';
import type GoogleAutocompleteScriptLoader from './GoogleAutocompleteScriptLoader';

// Esportiamo i tipi ufficiali per chiarezza
export type AutocompleteSuggestion = google.maps.places.AutocompleteSuggestion;
export type AutocompleteSessionToken = google.maps.places.AutocompleteSessionToken;

// L'interfaccia delle opzioni rimane la stessa per non modificare il codice che la usa
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
     * Carica lo script dell'API di Google Maps.
     */
    private async _loadMapsSdk(): Promise<typeof google.maps> {
        if (!this._mapsSdkPromise) {
            this._mapsSdkPromise = this._scriptLoader.loadMapsSdk(this._apiKey);
        }
        await this._mapsSdkPromise;
        // La libreria 'places' è richiesta per AutocompleteSessionToken
        if (!google.maps.places?.AutocompleteSessionToken) {
            await google.maps.importLibrary('places');
        }
        return window.google.maps;
    }

    /**
     * Inizializza o rinnova il session token.
     */
    private _ensureSessionToken(): void {
        if (!this._sessionToken) {
            this._sessionToken = new google.maps.places.AutocompleteSessionToken();
        }
    }
    
    /**
     * Recupera suggerimenti di autocompletamento usando la nuova API.
     */
    public async fetchSuggestions(
        input: string,
        options: FetchSuggestionsOptions = {},
    ): Promise<AutocompleteSuggestion[]> {
        if (!input) {
            return [];
        }

        try {
            // Assicurati che l'SDK e la libreria 'places' siano carichi
            await this._loadMapsSdk();
            const { AutocompleteSuggestion } = await google.maps.importLibrary('places') as google.maps.PlacesLibrary;
            
            this._ensureSessionToken();

            // Costruisci la richiesta con i parametri della NUOVA API
            const request: google.maps.places.AutocompleteRequest = {
                input,
                sessionToken: this._sessionToken,
                // Mappa i vecchi nomi ai nuovi
                includedPrimaryTypes: options.types, 
            };

            // Converte `componentRestrictions` nel nuovo `includedRegionCodes`
            if (options.componentRestrictions?.country) {
                request.includedRegionCodes = Array.isArray(options.componentRestrictions.country)
                    ? options.componentRestrictions.country
                    : [options.componentRestrictions.country];
            }

            const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
            
            return suggestions || [];
        } catch (error) {
            console.error('Errore durante il recupero dei suggerimenti di autocompletamento:', error);
            // In caso di errore, è buona norma invalidare il token
            this.renewSessionToken(); 
            return [];
        }
    }

    /**
     * Ottiene un'istanza di PlacesService.
     */
    public async getPlacesService(): Promise<google.maps.places.PlacesService> {
        await this._loadMapsSdk();
        const { PlacesService } = await google.maps.importLibrary('places') as google.maps.PlacesLibrary;
        const node = document.createElement('div');
        return new PlacesService(node);
    }

    /**
     * Rinnova il session token. Va chiamato dopo aver ottenuto i dettagli di un luogo.
     */
    public renewSessionToken(): void {
        if (google.maps.places?.AutocompleteSessionToken) {
            this._sessionToken = new google.maps.places.AutocompleteSessionToken();
        } else {
            this._sessionToken = undefined;
        }
    }
}