import { BACKEND_URL } from "./config"

export interface GLSShop {
    parcelShopId: string
    partnerId: string
    name: string
    distance: number
    address: {
        street: string
        houseNumber: string
        city: string
        province: string
        zipCode: string
        countryCode: string
        latitude: number
        longitude: number
    }
    openingDays: Array<{
        weekday: string
        hours: Array<{
            openingTime: string
            closingTime: string
        }>
    }>
}

export interface ShippingAddressInput {
    address1: string
    address2?: string
    city: string
    postalCode: string
}

export interface FetchGLSParcelShopsResult {
    success: boolean
    shops: GLSShop[]
    reason?: 'geocoding_failed' | 'limit_exceeded' | 'no_shops' | 'error'
}

const NGROK_HEADERS = {
    'ngrok-skip-browser-warning': 'true'
}

export async function fetchGLSParcelShops(
    address: ShippingAddressInput,
    cartWeight: number,
    nOfPackages: number
): Promise<FetchGLSParcelShopsResult> {
    try {
        const fullAddress = `${address.address1} ${address.address2 || ''}, ${address.city}, ${address.postalCode}, IT`.trim()

        // ── Step 1: Geocoding ─────────────────────────────────────────────
        const geoRes = await fetch(
            `${BACKEND_URL}/gls/geocode?address=${encodeURIComponent(fullAddress)}`,
            { headers: NGROK_HEADERS }
        )
        const geoData = await geoRes.json()

        if (!geoData.success) {
            console.warn('[GLS] Geocoding fallito:', geoData.error)
            return { success: false, shops: [], reason: 'geocoding_failed' }
        }

        console.log(cartWeight, nOfPackages)
        const { lat, lng } = geoData.data

        // ── Step 2: Check Limit ───────────────────────────────────────────
        const limitRes = await fetch(`${BACKEND_URL}/gls/check-limit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...NGROK_HEADERS
            },
            body: JSON.stringify({
                isCashOnDelivery: false,
                measures: { depth: 10, height: 20, length: 30 }, // misure medie
                nOfPackages,
                pv: Math.ceil(cartWeight),  // peso/volume = peso reale arrotondato
                weight: cartWeight,
                plus: false,
                sprinterList: [],
                insuranceList: []
            })
        })
        const limitData = await limitRes.json()

        if (!limitData.success || limitData.data?.code !== '200') {
            console.warn('[GLS] check-limit rifiutato:', {
                code: limitData.data?.code,
                description: limitData.data?.description
            })
            return { success: false, shops: [], reason: 'limit_exceeded' }
        }



        // ── Step 3: Ricerca Parcel Shop ───────────────────────────────────
        const shopsRes = await fetch(
            `${BACKEND_URL}/gls/parcelshops?lat=${lat}&lng=${lng}&distance=10`,
            { headers: NGROK_HEADERS }
        )
        const shopsData = await shopsRes.json()

        if (!shopsData.success || !shopsData.data?.length) {
            console.warn('[GLS] Nessun Parcel Shop trovato')
            return { success: false, shops: [], reason: 'no_shops' }
        }

        // Salva in sessionStorage come ponte per lo step spedizione
        sessionStorage.setItem('gls_parcel_shops', JSON.stringify(shopsData.data))
        sessionStorage.setItem('gls_shipping_address', JSON.stringify(address))

        return { success: true, shops: shopsData.data }

    } catch (error) {
        console.warn('[GLS] Errore fetchGLSParcelShops:', error)
        return { success: false, shops: [], reason: 'error' }
    }
}