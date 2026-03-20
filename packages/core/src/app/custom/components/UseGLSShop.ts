import { useState, useEffect } from 'react'
import { getGLSParcelShops } from '../api/glsShippingMethod'
import type { GLSShop } from '../api/fetchGLSParcelShops'
import navigatorIcon from '../../../static/img/navigator.png'
import locationIcon from '../../../static/img/location.png'
import L from 'leaflet'

export const POLLING_INTERVAL_MS = 300
export const POLLING_MAX_ATTEMPTS = 17



// ─── Types ────────────────────────────────────────────────────────────────────

export interface GLSParcelShopSelectorProps {
    onShopSelected(partnerId: string, parcelShopId: string, shopName: string): void
    selectedParcelShopId?: string
}


export const markerIcon = new L.Icon({ iconUrl: locationIcon, iconSize: [25, 41], iconAnchor: [12, 41] })
export const selectedMarkerIcon = new L.Icon({ iconUrl: navigatorIcon, iconSize: [32, 32], iconAnchor: [16, 32] })

export function useGLSShops(): GLSShop[] {
    const [shops, setShops] = useState<GLSShop[]>([])

    useEffect(() => {
        const data = getGLSParcelShops()
        if (data.length > 0) { setShops(data); return }

        let attempts = 0
        const interval = setInterval(() => {
            const retryData = getGLSParcelShops()
            if (retryData.length > 0 || ++attempts >= POLLING_MAX_ATTEMPTS) {
                if (retryData.length > 0) setShops(retryData)
                clearInterval(interval)
            }
        }, POLLING_INTERVAL_MS)

        return () => clearInterval(interval)
    }, [])

    return shops
}
