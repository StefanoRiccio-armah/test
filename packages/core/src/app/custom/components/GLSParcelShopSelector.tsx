import React, { type FunctionComponent, useState, useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { TranslatedString } from '@bigcommerce/checkout/locale'
import { getGLSParcelShops, saveGLSShopSelection } from '../api/glsShippingMethod'
import type { GLSShop } from '../api/fetchGLSParcelShops'
import {POLLING_INTERVAL_MS,POLLING_MAX_ATTEMPTS, type GLSParcelShopSelectorProps, markerIcon,selectedMarkerIcon} from './UseGLSShop'

function useGLSShops(): GLSShop[] {
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

// ─── Sub-components ───────────────────────────────────────────────────────────

const ShopAddress: FunctionComponent<{ shop: GLSShop }> = ({ shop: { address: a } }) => (
    <address style={{ fontStyle: 'normal' }}>
        {a.street} {a.houseNumber}<br />
        {a.city} ({a.province}) {a.zipCode}
    </address>
)

interface ShopMarkerProps {
    shop: GLSShop
    isSelected: boolean
    onSelect(shop: GLSShop): void
}

const ShopMarker: FunctionComponent<ShopMarkerProps> = ({ shop, isSelected, onSelect }) => (
    <Marker
        position={[shop.address.latitude, shop.address.longitude]}
        icon={isSelected ? selectedMarkerIcon : markerIcon}
    >
        <Popup>
            <div style={{ minWidth: 180 }}>
                <strong>{shop.name}</strong>
                <div className="popup-style">
                    <ShopAddress shop={shop} />
                </div>
                <button className="button button--primary button-gls" onClick={() => onSelect(shop)}>
                    <TranslatedString id="address.gls_select" />
                </button>
            </div>
        </Popup>
    </Marker>
)

interface SelectedShopCardProps {
    shop: GLSShop
    onClick(): void
}

const SelectedShopCard: FunctionComponent<SelectedShopCardProps> = ({ shop, onClick }) => (
    <div className="gls-selected-shop" onClick={onClick} role="button" tabIndex={0}>
        <div className="gls-selected-title"><TranslatedString id="address.gls_choose" /></div>
        <div className="gls-selected-name">{shop.name}</div>
        <div className="gls-selected-address"><ShopAddress shop={shop} /></div>
        <div className="gls-selected-change"><TranslatedString id="address.gls_change" /></div>
    </div>
)

interface DrawerProps {
    shops: GLSShop[]
    selectedParcelShopId?: string
    center: [number, number]
    onClose(): void
    onSelect(shop: GLSShop): void
}

const Drawer: FunctionComponent<DrawerProps> = ({ shops, selectedParcelShopId, center, onClose, onSelect }) => (
    <div className="gls-drawer">
        <div className="gls-drawer-overlay" onClick={onClose} />
        <div className="gls-drawer-content">
            <div className="gls-drawer-header">
                <strong><TranslatedString id="address.gls_title" /></strong>
                <button className="gls-drawer-close" onClick={onClose} aria-label="Close">✕</button>
            </div>
            <div className="gls-map-container">
                <MapContainer center={center} zoom={13} scrollWheelZoom className="map">
                    <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    {shops.map(shop => (
                        <ShopMarker
                            key={shop.parcelShopId}
                            shop={shop}
                            isSelected={shop.parcelShopId === selectedParcelShopId}
                            onSelect={onSelect}
                        />
                    ))}
                </MapContainer>
            </div>
        </div>
    </div>
)

// ─── Main Component ───────────────────────────────────────────────────────────

const GLSParcelShopSelector: FunctionComponent<GLSParcelShopSelectorProps> = ({
    onShopSelected,
    selectedParcelShopId,
}) => {
    const shops = useGLSShops()
    const [drawerOpen, setDrawerOpen] = useState(false)

    const selectedShop = shops.find(s => s.parcelShopId === selectedParcelShopId)

    const center: [number, number] = selectedShop
        ? [selectedShop.address.latitude, selectedShop.address.longitude]
        : shops.length > 0 ? [shops[0].address.latitude, shops[0].address.longitude] : [0, 0]

    const handleSelect = useCallback((shop: GLSShop) => {
        saveGLSShopSelection(shop.partnerId, shop.parcelShopId, shop.name)
        sessionStorage.setItem('gls_selected_shop', JSON.stringify(shop))
        onShopSelected(shop.partnerId, shop.parcelShopId, shop.name)
        setDrawerOpen(false)
    }, [onShopSelected])

    if (!shops.length) return (
        <div className="alertBox alertBox--error">
            <div className="alertBox-column alertBox-message">
                <TranslatedString id="address.no_gls" />
            </div>
        </div>
    )

    return (
        <div className="gls-selector-wrapper">
            {selectedShop
                ? <SelectedShopCard shop={selectedShop} onClick={() => setDrawerOpen(true)} />
                : (
                    <button type="button" className="button button--primary gls-open-map-button" onClick={() => setDrawerOpen(true)}>
                        <TranslatedString id="address.gls_selection" />
                    </button>
                )
            }
            {drawerOpen && (
                <Drawer
                    shops={shops}
                    selectedParcelShopId={selectedParcelShopId}
                    center={center}
                    onClose={() => setDrawerOpen(false)}
                    onSelect={handleSelect}
                />
            )}
        </div>
    )
}

export default GLSParcelShopSelector
