// GoogleAutocompleteScriptLoader.ts

import { getScriptLoader, type ScriptLoader } from '@bigcommerce/script-loader';
import type { GoogleMapsSdk } from './googleAutocompleteTypes';

export default class GoogleAutocompleteScriptLoader {
    private _scriptLoader: ScriptLoader;
    private _googleMapsPromise?: Promise<GoogleMapsSdk>;

    constructor() {
        this._scriptLoader = getScriptLoader();
    }

    /**
     * Carica Google Maps SDK con la libreria Places inclusa.
     * La promise si risolve solo quando lo script è completamente caricato.
     */
    loadMapsSdk(apiKey: string): Promise<GoogleMapsSdk> {
        if (this._googleMapsPromise) {
            return this._googleMapsPromise;
        }

        this._googleMapsPromise = new Promise((resolve, reject) => {
            const callbackName = '__initGoogleMaps';

            // Callback globale chiamato da Google Maps quando lo script è pronto
            (window as any)[callbackName] = () => {
                if (window.google && window.google.maps) {
                    resolve(window.google.maps);
                } else {
                    reject(new Error('Google Maps SDK loaded but window.google.maps is undefined.'));
                }
                delete (window as any)[callbackName];
            };

            const scriptUrl = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=weekly&callback=${callbackName}`;

            this._scriptLoader.loadScript(scriptUrl).catch((err) => {
                reject(new Error('Failed to load Google Maps SDK: ' + err));
            });
        });

        return this._googleMapsPromise;
    }
}
