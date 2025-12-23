import React from 'react';
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

    // Import dopo il publicPath
    const { default: OrderConfirmationApp } = require('./OrderConfirmationApp');

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

    const root = createRoot(container);
    root.render(
        <OrderConfirmationApp
            containerId={containerId}
            publicPath={configuredPublicPath}
            {...props}
        />,
    );
}
