import { ExtensionRegion, type ShippingOption } from '@bigcommerce/checkout-sdk/essential';
import React, { type FunctionComponent, memo, useCallback, useState } from 'react';

import { Extension } from '@bigcommerce/checkout/checkout-extension';
import { LoadingOverlay } from '@bigcommerce/checkout/ui';

import { EMPTY_ARRAY } from '../../common/utility';
import { Checklist, ChecklistItem } from '../../ui/form';
import {  isGLSParcelShopSelected } from '../../custom/api/glsShippingMethod';
import GLSParcelShopSelector from '../../custom/components/GLSParcelShopSelector';

import StaticShippingOption from './StaticShippingOption';

interface ShippingOptionListItemProps {
    consignmentId: string;
    isMultiShippingMode: boolean;
    selectedShippingOptionId?: string;
    shippingOption: ShippingOption;
}

const ShippingOptionListItem: FunctionComponent<ShippingOptionListItemProps> = ({
    consignmentId,
    isMultiShippingMode,
    selectedShippingOptionId,
    shippingOption,
}) => {
    const isSelected = selectedShippingOptionId === shippingOption.id;

    const renderLabel = useCallback(
        () => (
            <div className="shippingOptionLabel">
                <StaticShippingOption displayAdditionalInformation={true} method={shippingOption} />
                {(isSelected && !isMultiShippingMode) && (
                    <Extension region={ExtensionRegion.ShippingSelectedShippingMethod} />
                )}
            </div>
        ),
        [isSelected, isMultiShippingMode, shippingOption],
    );

    return (
        <ChecklistItem
            htmlId={`shippingOptionRadio-${consignmentId}-${shippingOption.id}`}
            label={renderLabel}
            value={shippingOption.id}
        />
    );
};

export interface ShippingOptionListProps {
    consignmentId: string;
    inputName: string;
    isLoading: boolean;
    isMultiShippingMode: boolean;
    selectedShippingOptionId?: string;
    shippingOptions?: ShippingOption[];
    onSelectedOption(consignmentId: string, shippingOptionId: string): void;
}

const ShippingOptionsList: FunctionComponent<ShippingOptionListProps> = ({
    consignmentId,
    inputName,
    isLoading,
    isMultiShippingMode,
    shippingOptions = EMPTY_ARRAY,
    selectedShippingOptionId,
    onSelectedOption,
}) => {
    const [selectedParcelShopId, setSelectedParcelShopId] = useState<string | undefined>();

    const handleSelect = useCallback(
        (value: string) => {
            onSelectedOption(consignmentId, value);
        },
        [consignmentId, onSelectedOption],
    );

    const handleShopSelected = useCallback(
        (partnerId: string, parcelShopId: string, shopName: string) => {
            setSelectedParcelShopId(parcelShopId);
            console.log('[GLS] Shop selezionato:', { partnerId, parcelShopId, shopName });
        },
        [],
    );

    if (!shippingOptions.length) {
        return null;
    }

   const glsIsSelected = isGLSParcelShopSelected(selectedShippingOptionId, shippingOptions);

    return (
        <LoadingOverlay isLoading={isLoading}>
            <Checklist
                aria-live="polite"
                defaultSelectedItemId={selectedShippingOptionId}
                name={inputName}
                onSelect={handleSelect}
            >
                {shippingOptions.map((shippingOption) => (
                    <ShippingOptionListItem
                        consignmentId={consignmentId}
                        isMultiShippingMode={isMultiShippingMode}
                        key={shippingOption.id}
                        selectedShippingOptionId={selectedShippingOptionId}
                        shippingOption={shippingOption}
                    />
                ))}
            </Checklist>

            {/* Selettore GLS — appare solo se l'utente ha selezionato GLS Parcel Shop */}
            {glsIsSelected && (
                <GLSParcelShopSelector
                    onShopSelected={handleShopSelected}
                    selectedParcelShopId={selectedParcelShopId}
                />
            )}
        </LoadingOverlay>
    );
};

export default memo(ShippingOptionsList);