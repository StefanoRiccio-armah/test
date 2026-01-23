import { type Address, type Country, type Region } from '@bigcommerce/checkout-sdk';

import type AddressSelector from './AddressSelector';
import AddressSelectorFactory from './AddressSelectorFactory';

function getStreet1(accessor: AddressSelector): string {
    const streetName = accessor.getComponent('route')?.long_name;
    
    // Solo il nome della via, senza il numero civico
    if (streetName) {
        return streetName;
    }

    // Fallback: prova a ottenere la strada completa
    return accessor.getStreet() || '';
}

function getStreet2(accessor: AddressSelector): string {
    // Il numero civico va in address2
    const streetNumber = accessor.getComponent('street_number')?.long_name;
    
    return streetNumber || '';
}

export default function mapToAddress(
    place: google.maps.places.Place,
    countries: Country[] = [],
): Partial<Address> {
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

    const accessor = AddressSelectorFactory.create(legacyLikePlace);
    const stateCodeFromGoogle = accessor.getState(); // Questo ora restituisce "NA"
    const countryCode = accessor.getCountry();
    const country = countries.find((c) => c.code === countryCode);
    
    const address1 = getStreet1(accessor);
    const address2 = getStreet2(accessor);

    const mappedAddress: Partial<Address> = {
        address1,
        address2,
        city: accessor.getCity(),
        countryCode,
        postalCode: accessor.getPostCode(),
        // Passiamo il codice della provincia e la lista delle suddivisioni alla nostra funzione
        ...(stateCodeFromGoogle ? getState(stateCodeFromGoogle, country?.subdivisions) : {}),
    };
    
    return mappedAddress;
}

function getState(stateCodeFromGoogle: string, states: Region[] = []): Partial<Address> {
    // Cerca la provincia confrontando il campo 'code' (case-insensitive).
    const state = states.find(
        (s) => s.code.toUpperCase() === stateCodeFromGoogle.toUpperCase(),
    );

    // Se troviamo una corrispondenza (es. l'oggetto per "NA")
    if (state) {
        return {
            stateOrProvince: state.name,       // Es. "Napoli"
            stateOrProvinceCode: state.code,   // Es. "NA"
        };
    }

    // Fallback se non troviamo nulla (non dovrebbe accadere per l'Italia)
    return {
        stateOrProvince: stateCodeFromGoogle, // Usa il codice come nome
        stateOrProvinceCode: stateCodeFromGoogle,
    };
}