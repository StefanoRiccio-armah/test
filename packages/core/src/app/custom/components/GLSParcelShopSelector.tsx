import React, { type FunctionComponent, useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { TranslatedString } from '@bigcommerce/checkout/locale'
import {getGLSParcelShops,saveGLSShopSelection,type GLSShop} from '../api/glsShippingMethod'
import navigatorIcon from '../../../static/img/navigator.png'
import locationIcon from '../../../static/img/location.png'

interface GLSParcelShopSelectorProps {
    onShopSelected(partnerId: string, parcelShopId: string, shopName: string): void
    selectedParcelShopId?: string
}




const markerIcon = new L.Icon({
    iconUrl: locationIcon,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
})

const selectedMarkerIcon = new L.Icon({
    iconUrl: navigatorIcon,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
})

const GLSParcelShopSelector: FunctionComponent<GLSParcelShopSelectorProps> = ({
    onShopSelected,
    selectedParcelShopId,
}) => {
    const [shops, setShops] = useState<GLSShop[]>([])
    const [drawerOpen, setDrawerOpen] = useState(false)

useEffect(() => {
    const data = getGLSParcelShops()
    if (data.length > 0) {
        setShops(data)
        return
    }

    // Dati non ancora pronti — polling ogni 300ms fino a 5s
    let attempts = 0
    const interval = setInterval(() => {
        attempts++
        const retryData = getGLSParcelShops()
        if (retryData.length > 0) {
            setShops(retryData)
            clearInterval(interval)
        } else if (attempts >= 17) { // ~5s
            clearInterval(interval)
        }
    }, 300)

    return () => clearInterval(interval)
}, [])

    if (!shops.length) {
        return (
            <div className="alertBox alertBox--error">
                <div className="alertBox-column alertBox-message">
                    <TranslatedString id="address.no_gls"/>
                </div>
            </div>
        )
    }

    const selectedShop = shops.find(
        shop => shop.parcelShopId === selectedParcelShopId
    )

    const center: [number, number] = selectedShop
        ? [selectedShop.address.latitude, selectedShop.address.longitude]
        : [shops[0].address.latitude, shops[0].address.longitude]



return (
    <div className="gls-selector-wrapper">

        {!selectedShop && (
            <button
                type="button"
                className="button button--primary gls-open-map-button"
                onClick={() => setDrawerOpen(true)}
            >
                <TranslatedString id="address.gls_selection"/>
            </button>
        )}

        {selectedShop && (
            <div
                className="gls-selected-shop"
                onClick={() => setDrawerOpen(true)}
            >
                <div className="gls-selected-title">
                    <TranslatedString id="address.gls_choose"/>
                </div>

                <div className="gls-selected-name">
                    {selectedShop.name}
                </div>

                <div className="gls-selected-address">
                    {selectedShop.address.street} {selectedShop.address.houseNumber} <br/>
                    {selectedShop.address.city} ({selectedShop.address.province}) {selectedShop.address.zipCode}
                </div>

                <div className="gls-selected-change">
                    <TranslatedString id="address.gls_change"/>
                </div>
            </div>
        )}

            {drawerOpen && (
                <div className="gls-drawer">
                    <div
                        className="gls-drawer-overlay"
                        onClick={() => setDrawerOpen(false)}
                    />

                    <div className="gls-drawer-content">
                        <div className="gls-drawer-header">
                            <strong><TranslatedString id="address.gls_title"/></strong>

                            <button
                                className="gls-drawer-close"
                                onClick={() => setDrawerOpen(false)}
                            >
                                ✕
                            </button>
                        </div>

                        <div className="gls-map-container">
                            <MapContainer
                                center={center}
                                zoom={13}
                                scrollWheelZoom
                               className='map'
                            >
                                <TileLayer
                                    attribution="&copy; OpenStreetMap"
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                />

                                {shops.map((shop) => {
                                    const isSelected =
                                        shop.parcelShopId ===
                                        selectedParcelShopId

                                    return (
                                        <Marker
                                            key={shop.parcelShopId}
                                            position={[
                                                shop.address.latitude,
                                                shop.address.longitude,
                                            ]}
                                            icon={
                                                isSelected
                                                    ? selectedMarkerIcon
                                                    : markerIcon
                                            }
                                        >
                                            <Popup>
                                                <div style={{ minWidth: '180px' }}>
                                                    <strong>{shop.name}</strong>

                                                    <div className='popup-style'>
                                                        {shop.address.street}{' '}
                                                        {shop.address.houseNumber}
                                                        <br />
                                                        {shop.address.city} (
                                                        {shop.address.province})
                                                        <br />
                                                        {shop.address.zipCode}
                                                    </div>

                                                    <button className='button button--primary button-gls'
                                                        onClick={() => {
                                                            saveGLSShopSelection(
                                                                shop.partnerId,
                                                                shop.parcelShopId,
                                                                shop.name,
                                                            )

                                                            sessionStorage.setItem(
                                                                'gls_selected_shop',
                                                                JSON.stringify(shop),
                                                            )

                                                            onShopSelected(
                                                                shop.partnerId,
                                                                shop.parcelShopId,
                                                                shop.name,
                                                            )

                                                            setDrawerOpen(false)
                                                        }}
                                                    >
                                                        <TranslatedString id="address.gls_select"/>
                                                    </button>
                                                </div>
                                            </Popup>
                                        </Marker>
                                    )
                                })}
                            </MapContainer>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default GLSParcelShopSelector