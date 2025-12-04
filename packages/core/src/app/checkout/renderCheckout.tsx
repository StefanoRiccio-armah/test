import React from 'react';
// 1. Modifica l'import per usare 'react-dom/client'
import ReactDOM from 'react-dom/client';

import { configurePublicPath } from '../common/bundler';
import { type CheckoutAppProps } from './CheckoutApp';

export type RenderCheckoutOptions = CheckoutAppProps;
export type RenderCheckout = typeof renderCheckout;

export default function renderCheckout({
    containerId,
    publicPath,
    ...props
}: RenderCheckoutOptions): void {
    const configuredPublicPath = configurePublicPath(publicPath);

    const { default: CheckoutApp } = require('./CheckoutApp');

    if (process.env.NODE_ENV === 'development') {
        const whyDidYouRender = require('@welldone-software/why-did-you-render');
        whyDidYouRender(React, {
            collapseGroups: true,
        });
    }

    // 2. Trova il container nel DOM
    const container = document.getElementById(containerId);

    // È buona norma verificare che il container esista prima di procedere
    if (!container) {
        return;
    }

    // 3. Crea un "root" per il rendering dell'applicazione
    const root = ReactDOM.createRoot(container);

    // 4. Esegui il render dell'app all'interno del root
    root.render(
        <CheckoutApp containerId={containerId} publicPath={configuredPublicPath} {...props} />,
    );
}