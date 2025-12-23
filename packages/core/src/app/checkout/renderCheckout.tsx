import React from 'react';
import { createRoot } from 'react-dom/client';

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

    // Import dopo il publicPath
    const { default: CheckoutApp } = require('./CheckoutApp');

    if (process.env.NODE_ENV === 'development') {
        const whyDidYouRender = require('@welldone-software/why-did-you-render');

        whyDidYouRender(React, {
            collapseGroups: true,
        });
    }

    const container = document.getElementById(containerId);

    if (!container) {
        throw new Error(`Container with id "${containerId}" not found`);
    }

    // Nuova API React 18
    const root = createRoot(container);
    root.render(
        <CheckoutApp
            containerId={containerId}
            publicPath={configuredPublicPath}
            {...props}
        />,
    );
}
