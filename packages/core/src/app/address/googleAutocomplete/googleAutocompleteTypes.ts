/**
 * L'interfaccia `GoogleMapsSdk` è stata sostituita con un alias di tipo.
 * `typeof google.maps` utilizza direttamente la definizione di tipo completa
 * fornita dal pacchetto @types/google.maps.
 * Questo risolve l'errore "Property 'importLibrary' does not exist"
 * e garantisce che tutti i nuovi tipi e funzioni siano disponibili.
 */
export type GoogleMapsSdk = typeof google.maps;

// I tipi sottostanti rimangono validi in quanto descrivono
// opzioni e strutture dati che non sono state deprecate.

export type GoogleAutocompleteOptionTypes = 'establishment' | 'geocode' | 'address';

export type GoogleAutocompleteFields =
    | 'address_components'
    | 'adr_address'
    | 'aspects'
    | 'formatted_address'
    | 'formatted_phone_number'
    | 'geometry'
    | 'html_attributions'
    | 'icon'
    | 'international_phone_number'
    | 'name'
    | 'opening_hours'
    | 'photos'
    | 'place_id'
    | 'plus_code'
    | 'price_level'
    | 'rating'
    | 'reviews'
    | 'types'
    | 'url'
    | 'utc_offset'
    | 'vicinity'
    | 'website';

export type GoogleAutocompleteEvent = 'place_changed';

/**
 * L'interfaccia `GoogleMapsSdk` personalizzata è stata rimossa.
 * Non è più necessaria perché usiamo l'alias di tipo definito sopra.
 * Abbiamo anche rimosso il riferimento al vecchio `AutocompleteService`.
 */

/**
 * Questa interfaccia ora funziona correttamente perché `GoogleMapsSdk`
 * è un alias per il tipo completo `google.maps`.
 */
export interface GoogleAutocompleteWindow extends Window {
    google: {
        maps: GoogleMapsSdk;
    };
}

export type GoogleAddressFieldType =
    | 'postal_town'
    | 'administrative_area_level_1'
    | 'administrative_area_level_2'
    | 'locality'
    | 'neighborhood'
    | 'postal_code'
    | 'street_number'
    | 'route'
    | 'political'
    | 'country'
    | 'subpremise'
    | 'sublocality'
    | 'sublocality_level_1';