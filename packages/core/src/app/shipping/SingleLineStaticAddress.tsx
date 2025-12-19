import { type Address } from '@bigcommerce/checkout-sdk';
import React from 'react';

interface SingleLineStaticAddressProps {
    address: Address;
}

const SingleLineStaticAddress: React.FC<SingleLineStaticAddressProps> = ({ address }) => {
    if (!address) {
        return null;
    }

    const parts = [
        address.address1,
        address.city,
        address.stateOrProvinceCode || address.stateOrProvince,
        address.postalCode,
    ].filter(Boolean);

    return <span>{parts.join(', ')}</span>;
};

export default SingleLineStaticAddress;