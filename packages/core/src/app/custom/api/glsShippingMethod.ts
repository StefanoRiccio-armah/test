import type { GLSShop } from './fetchGLSParcelShops';
import { GLS_PARCEL_SHOP_METHOD_NAME } from './config';
import type { ShippingOption } from '@bigcommerce/checkout-sdk/essential';

// ── SessionStorage helpers ────────────────────────────────────────────────────

function ssGet<T>(key: string): T | null {
    try {
        const val = sessionStorage.getItem(key);
        return val ? JSON.parse(val) : null;
    } catch { return null; }
}

function ssSet(key: string, value: unknown): void {
    try {
        sessionStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.warn(`[GLS] Errore sessionStorage set "${key}":`, e);
    }
}

// ── Parcel Shops ──────────────────────────────────────────────────────────────

export function hasGLSParcelShops(): boolean {
    const shops = ssGet<unknown[]>('gls_parcel_shops');
    return Array.isArray(shops) && shops.length > 0;
}

export function getGLSParcelShops(): GLSShop[] {
    return ssGet<GLSShop[]>('gls_parcel_shops') ?? [];
}

// ── Shop Selection ────────────────────────────────────────────────────────────

export interface GLSShopSelection {
    partnerId: string;
    parcelShopId: string;
    shopName: string;
}

export function saveGLSShopSelection(partnerId: string, parcelShopId: string, shopName: string): void {
    ssSet('gls_selected_shop', { partnerId, parcelShopId, shopName });
}

export function getGLSShopSelection(): GLSShopSelection | null {
    return ssGet<GLSShopSelection>('gls_selected_shop');
}

export function clearGLSSelection(): void {
    ['gls_parcel_shops', 'gls_selected_shop', 'gls_shipping_address'].forEach(k =>
        sessionStorage.removeItem(k)
    );
}

// ── Utilities ─────────────────────────────────────────────────────────────────

export function isGLSParcelShopSelected(
    selectedShippingOptionId?: string,
    shippingOptions?: ShippingOption[]
): boolean {
    if (!selectedShippingOptionId || !shippingOptions?.length) return false;
    return shippingOptions.find(o => o.id === selectedShippingOptionId)?.description === GLS_PARCEL_SHOP_METHOD_NAME;
}