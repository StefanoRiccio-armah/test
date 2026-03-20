import { BACKEND_URL } from './config';

export interface GLSShop {
    parcelShopId: string;
    partnerId: string;
    name: string;
    distance: number;
    address: {
        street: string;
        houseNumber: string;
        city: string;
        province: string;
        zipCode: string;
        countryCode: string;
        latitude: number;
        longitude: number;
    };
    openingDays: Array<{
        weekday: string;
        hours: Array<{ openingTime: string; closingTime: string }>;
    }>;
}

export interface ShippingAddressInput {
    address1: string;
    address2?: string;
    city: string;
    postalCode: string;
}

export interface FetchGLSParcelShopsResult {
    success: boolean;
    shops: GLSShop[];
    reason?: 'geocoding_failed' | 'limit_exceeded' | 'no_shops' | 'error';
}

const HEADERS = { 'ngrok-skip-browser-warning': 'true', 'Content-Type': 'application/json' };

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, { headers: HEADERS, ...options });
    return res.json();
}

export async function fetchGLSParcelShops(
    address: ShippingAddressInput,
    cartWeight: number,
    nOfPackages: number
): Promise<FetchGLSParcelShopsResult> {
    try {
        // Step 1: Geocoding
        const fullAddress = `${address.address1} ${address.address2 ?? ''}, ${address.city}, ${address.postalCode}, IT`.trim();
        const geoData = await apiFetch<{ success: boolean; data?: { lat: number; lng: number }; error?: string }>(
            `${BACKEND_URL}/gls/geocode?address=${encodeURIComponent(fullAddress)}`
        );
        if (!geoData.success || !geoData.data) {
            console.warn('[GLS] Geocoding fallito:', geoData.error);
            return { success: false, shops: [], reason: 'geocoding_failed' };
        }
        const { lat, lng } = geoData.data;

        // Step 2: Check Limit
        const limitData = await apiFetch<{ success: boolean; data?: { code: string } }>(
            `${BACKEND_URL}/gls/check-limit`,
            {
                method: 'POST',
                body: JSON.stringify({
                    isCashOnDelivery: false,
                    measures: { depth: 10, height: 20, length: 30 },
                    nOfPackages,
                    pv: Math.ceil(cartWeight),
                    weight: cartWeight,
                    plus: false,
                    sprinterList: [],
                    insuranceList: []
                })
            }
        );
        if (!limitData.success || limitData.data?.code !== '200') {
            console.warn('[GLS] check-limit rifiutato:', limitData.data);
            return { success: false, shops: [], reason: 'limit_exceeded' };
        }

        // Step 3: Ricerca Parcel Shop
        const shopsData = await apiFetch<{ success: boolean; data?: GLSShop[] }>(
            `${BACKEND_URL}/gls/parcelshops?lat=${lat}&lng=${lng}&distance=10`
        );
        if (!shopsData.success || !shopsData.data?.length) {
            console.warn('[GLS] Nessun Parcel Shop trovato');
            return { success: false, shops: [], reason: 'no_shops' };
        }

        sessionStorage.setItem('gls_parcel_shops', JSON.stringify(shopsData.data));
        sessionStorage.setItem('gls_shipping_address', JSON.stringify(address));

        return { success: true, shops: shopsData.data };

    } catch (error) {
        console.warn('[GLS] Errore fetchGLSParcelShops:', error);
        return { success: false, shops: [], reason: 'error' };
    }
}