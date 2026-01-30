import { type GoogleAddressFieldType } from './googleAutocompleteTypes';

export default class AddressSelector {
    protected _address: google.maps.GeocoderAddressComponent[] | undefined;
    protected _name: string;

    constructor(googlePlace: google.maps.places.PlaceResult) {
        const { address_components, name } = googlePlace;

        this._name = name ?? '';
        this._address = address_components;
    }

    public getComponent(
        type: GoogleAddressFieldType,
    ): google.maps.GeocoderAddressComponent | undefined {
        return this._address?.find((field) => field.types.includes(type));
    }

    getState(): string {
        
        if (this.getCountry() === 'IT') {
            const province = this._get('administrative_area_level_2', 'short_name');
            // Se troviamo la provincia, usiamo quella.
            if (province) {
                return province;
            }
        }

        // Per tutti gli altri paesi, o come fallback per l'Italia, usiamo level_1
        return this._get('administrative_area_level_1', 'short_name');
    }

    getStreet(): string {
        return this._name;
    }

    getStreet2(): string {
        if (this.getCountry() === 'NZ') {
            return this._get('sublocality', 'short_name');
        }

        return this._get('subpremise', 'short_name');
    }

    getCity(): string {
        return (
            this._get('postal_town', 'long_name') ||
            this._get('locality', 'long_name') ||
            this._get('neighborhood', 'short_name')
        );
    }

    getCountry(): string {
        return this._get('country', 'short_name');
    }

    getPostCode(): string {
        return this._get('postal_code', 'short_name');
    }

    protected _get(
        type: GoogleAddressFieldType,
        access: Exclude<keyof google.maps.GeocoderAddressComponent, 'types'>,
    ): string {
        const element = this.getComponent(type);
        if (element) {
            return element[access];
        }
        return '';
    }
}