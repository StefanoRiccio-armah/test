import { type Address, type Country, type Region } from '@bigcommerce/checkout-sdk';

import type AddressSelector from './AddressSelector';
import AddressSelectorFactory from './AddressSelectorFactory';

/**
 * Funzione di utilità per costruire la via (address1)
 * in modo robusto, usando il nuovo metodo pubblico getComponent.
 */
function getStreet1(accessor: AddressSelector): string {
    const streetName = accessor.getComponent('route')?.long_name;
    const streetNumber = accessor.getComponent('street_number')?.long_name;

    if (streetName && streetNumber) {
        // CORREZIONE: Formattazione standard italiana (Via Nome, Numero)
        return `${streetName}, ${streetNumber}`;
    }

    return accessor.getStreet() || streetName || '';
}


export default function mapToAddress(
    place: google.maps.places.Place,
    countries: Country[] = [],
): Partial<Address> {
    // I console.log possono rimanere per ora, sono utili.
    console.log('%c[mapToAddress] Oggetto "place" originale ricevuto:', 'color: orange; font-weight: bold;', place);
    
    if (!place || !place.addressComponents) {
        return {};
    }

    const legacyLikePlace = {
        address_components: place.addressComponents.map((component) => ({
            long_name: component.longText,
            short_name: component.shortText,
            types: component.types,
        })),
    } as google.maps.places.PlaceResult;
    
    console.log('%c[mapToAddress] Oggetto "legacy-like" creato per AddressSelectorFactory:', 'color: purple; font-weight: bold;', legacyLikePlace);

    const accessor = AddressSelectorFactory.create(legacyLikePlace);

    const stateCodeFromGoogle = accessor.getState(); // Questo ora restituisce "NA"
    const countryCode = accessor.getCountry();
    const country = countries.find((c) => c.code === countryCode);
    
    const address1 = getStreet1(accessor);

    const mappedAddress: Partial<Address> = {
        address1,
        address2: accessor.getStreet2(),
        city: accessor.getCity(),
        countryCode,
        postalCode: accessor.getPostCode(),
        // Passiamo il codice della provincia e la lista delle suddivisioni alla nostra funzione
        ...(stateCodeFromGoogle ? getState(stateCodeFromGoogle, country?.subdivisions) : {}),
    };

    console.log('%c[mapToAddress] Indirizzo finale mappato:', 'color: green; font-weight: bold;', mappedAddress);
    
    return mappedAddress;
}

/**
 * SOLUZIONE DEFINITIVA per la provincia.
 * Trova la provincia nella lista fornita da BigCommerce usando il codice
 * (es. "NA") restituito da Google.
 */
function getState(stateCodeFromGoogle: string, states: Region[] = []): Partial<Address> {
    // Cerca la provincia confrontando il campo 'code' (case-insensitive).
    const state = states.find(
        (s) => s.code.toUpperCase() === stateCodeFromGoogle.toUpperCase(),
    );

    // Se troviamo una corrispondenza (es. l'oggetto per "NA")
    if (state) {
        return {
            stateOrProvince: state.name,       // Es. "Napoli"
            stateOrProvinceCode: state.code, // Es. "NA"
        };
    }

    // Fallback se non troviamo nulla (non dovrebbe accadere per l'Italia)
    return {
        stateOrProvince: stateCodeFromGoogle, // Usa il codice come nome
        stateOrProvinceCode: stateCodeFromGoogle,
    };
}