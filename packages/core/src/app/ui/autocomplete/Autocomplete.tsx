import Downshift, { type DownshiftState, type StateChangeOptions } from 'downshift';
import { noop } from 'lodash';
import React, { type ReactNode, useCallback, FunctionComponent } from 'react';

import type AutocompleteItem from './autocomplete-item';
import AutocompleteContent from './AutocompleteContent';
import { itemToString } from './utils';

export interface InputPropsType {
    className: string;
    id: string;
    'aria-labelledby': string;
    placeholder: string | undefined;
    labelText: React.JSX.Element | null;
    maxLength: number | undefined;
}

export interface AutocompleteProps {
    value?: string;
    initialValue?: string;
    initialHighlightedIndex?: number;
    defaultHighlightedIndex?: number;
    children?: ReactNode;
    items: AutocompleteItem[];
    inputProps?: InputPropsType;
    listTestId?: string;
    onToggleOpen?(state: { inputValue: string; isOpen: boolean }): void;
    onSelect?(item: AutocompleteItem | null): void;
    onChange?(value: string, isOpen: boolean): void;
}

const Autocomplete: FunctionComponent<AutocompleteProps> = ({
    value,
    inputProps,
    initialValue,
    initialHighlightedIndex,
    defaultHighlightedIndex,
    items,
    children,
    onSelect,
    listTestId,
    onChange,
    onToggleOpen = noop,
}) => {
    const stateReducer = useCallback(
        (
            state: DownshiftState<AutocompleteItem>,
            changes: StateChangeOptions<AutocompleteItem>,
        ): Partial<StateChangeOptions<AutocompleteItem>> => {
            switch (changes.type) {
                case Downshift.stateChangeTypes.changeInput:
                    if (changes.inputValue !== state.inputValue && onChange) {
                        onChange(changes.inputValue || '', state.isOpen);
                    }
                    return changes;

                // Per tutti gli altri casi (inclusi blur, mouseUp, etc.),
                // accetta semplicemente le modifiche proposte da Downshift
                // senza imporre il vecchio stato. Questo permette al componente
                // di essere pienamente controllato dalla prop `inputValue`.
                default:
                    return changes;
            }
        },
        [onChange],
    );

    const handleStateChange = useCallback(
        ({ isOpen, inputValue }: StateChangeOptions<AutocompleteItem>) => {
            if (isOpen !== undefined) {
                onToggleOpen({ isOpen, inputValue: inputValue || '' });
            }
        },
        [onToggleOpen],
    );

    return (
        <Downshift
            defaultHighlightedIndex={defaultHighlightedIndex}
            initialHighlightedIndex={initialHighlightedIndex}
            inputValue={value}
            itemToString={itemToString}
            labelId={inputProps && inputProps['aria-labelledby']}
            onChange={onSelect}
            onStateChange={handleStateChange}
            stateReducer={stateReducer}
        >
            {({ isOpen, getInputProps, getMenuProps, getItemProps, highlightedIndex }) => {
                return (
                    <div>
                        <AutocompleteContent
                            getInputProps={getInputProps}
                            getItemProps={getItemProps}
                            getMenuProps={getMenuProps}
                            highlightedIndex={highlightedIndex}
                            initialValue={initialValue}
                            inputProps={inputProps}
                            isOpen={isOpen}
                            items={items}
                            listTestId={listTestId}
                        >
                            {children}
                        </AutocompleteContent>
                    </div>
                );
            }}
        </Downshift>
    );
};

export default Autocomplete;