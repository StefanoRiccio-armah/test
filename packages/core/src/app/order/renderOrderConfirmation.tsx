import React from 'react';
// 1. Modifica l'import
import { createRoot } from 'react-dom/client';

import { configurePublicPath } from '../common/bundler';

import { type OrderConfirmationAppProps } from './OrderConfirmationApp';

export type RenderOrderConfirmationOptions = OrderConfirmationAppProps;
export type RenderOrderConfirmation = typeof renderOrderConfirmation;

export default function renderOrderConfirmation({
    containerId,
    publicPath,
    ...props
}: RenderOrderConfirmationOptions): void {
    const configuredPublicPath = configurePublicPath(publicPath);

    const { default: OrderConfirmationApp } = require('./OrderConfirmationApp');

    if (process.env.NODE_ENV === 'development') {
        const whyDidYouRender = require('@welldone-software/why-did-you-render');

        whyDidYouRender(React, {
            collapseGroups: true,
        });
    }

    // 2. Applica la nuova API createRoot
    const container = document.getElementById(containerId);

    // È buona norma verificare che il container esista prima di procedere
    if (container) {
        const root = createRoot(container);

        root.render(
            <OrderConfirmationApp
                containerId={containerId}
                publicPath={configuredPublicPath}
                {...props}
            />,
        );
    }
}