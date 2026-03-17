export type { GLSShop } from './fetchGLSParcelShops';
import {GLS_PARCEL_SHOP_METHOD_NAME} from './config'
import type { ShippingOption } from '@bigcommerce/checkout-sdk/essential'

export function hasGLSParcelShops(): boolean {
    try {
        const shops = sessionStorage.getItem('gls_parcel_shops');
        if (!shops) return false;
        const parsed = JSON.parse(shops);
        return Array.isArray(parsed) && parsed.length > 0;
    } catch {
        return false;
    }
}

export function getGLSParcelShops() {
    try {
        const shops = sessionStorage.getItem('gls_parcel_shops');
        if (!shops) return [];
        return JSON.parse(shops);
    } catch {
        return [];
    }
}

export function saveGLSShopSelection(partnerId: string, parcelShopId: string, shopName: string) {
    try {
        sessionStorage.setItem('gls_selected_shop', JSON.stringify({
            partnerId,
            parcelShopId,
            shopName
        }));
    } catch (e) {
        console.warn('[GLS] Errore salvataggio shop selezionato:', e);
    }
}

export function getGLSShopSelection(): {
    partnerId: string;
    parcelShopId: string;
    shopName: string;
} | null {
    try {
        const selection = sessionStorage.getItem('gls_selected_shop');
        if (!selection) return null;
        return JSON.parse(selection);
    } catch {
        return null;
    }
}

export function clearGLSSelection() {
    sessionStorage.removeItem('gls_parcel_shops');
    sessionStorage.removeItem('gls_selected_shop');
    sessionStorage.removeItem('gls_shipping_address');
}

export function isGLSParcelShopSelected(
    selectedShippingOptionId?: string,
    shippingOptions?: ShippingOption[]
): boolean {
    if (!selectedShippingOptionId || !shippingOptions?.length) return false
    const selected = shippingOptions.find(o => o.id === selectedShippingOptionId)
    return selected?.description === GLS_PARCEL_SHOP_METHOD_NAME
}