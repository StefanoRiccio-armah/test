import React from 'react';
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

    const container = document.getElementById(containerId);

    if (!container) {
        return;
    }

    const root = ReactDOM.createRoot(container);
    root.render(
        <CheckoutApp containerId={containerId} publicPath={configuredPublicPath} {...props} />,
    );
}