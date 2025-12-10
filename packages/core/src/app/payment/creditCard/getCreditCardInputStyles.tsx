import { noop } from 'lodash';
import React, { useEffect, useRef } from 'react';
import { createRoot, Root } from 'react-dom/client';

import { getAppliedStyles } from '@bigcommerce/checkout/dom-utils';
import { FormContext } from '@bigcommerce/checkout/ui';

import { FormFieldContainer, TextInput } from '../../ui/form';

export enum CreditCardInputStylesType {
    Default = 'default',
    Error = 'error',
    Focus = 'focus',
}

export default function getCreditCardInputStyles(
    containerId: string,
    properties: string[],
    type: CreditCardInputStylesType = CreditCardInputStylesType.Default,
): Promise<{ [key: string]: string }> {
    const container = document.createElement('div');
    const parentContainer = document.getElementById(containerId);

    if (!parentContainer) {
        throw new Error(
            'Unable to retrieve input styles as the provided container ID is not valid.',
        );
    }

    parentContainer.appendChild(container);

    return new Promise((resolve) => {
        let root: Root | null = createRoot(container);

        const MeasureInputStyles: React.FC = () => {
            const inputRef = useRef<HTMLInputElement>(null);

            useEffect(() => {
                if (!inputRef.current) return;

                // Ottieni gli stili richiesti
                const styles = getAppliedStyles(inputRef.current, properties);
                resolve(styles);

                // Posticipa l'unmount per evitare warning di React 18
                setTimeout(() => {
                    if (root) {
                        root.unmount();
                        root = null;
                    }
                    if (container.parentElement) {
                        container.parentElement.removeChild(container);
                    }
                }, 0);
            }, []);

            return (
                <FormContext.Provider value={{ isSubmitted: true, setSubmitted: noop }}>
                    <FormFieldContainer hasError={type === CreditCardInputStylesType.Error}>
                        <TextInput
                            appearFocused={type === CreditCardInputStylesType.Focus}
                            ref={inputRef}
                        />
                    </FormFieldContainer>
                </FormContext.Provider>
            );
        };

        // Monta il componente misuratore
        root.render(<MeasureInputStyles />);
    });
}
