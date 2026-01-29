import classNames from 'classnames';
import { noop } from 'lodash';
import React, { type FunctionComponent, memo, type ReactNode, useState, useEffect } from 'react';

import { useThemeContext } from '@bigcommerce/checkout/contexts';
import { preventDefault } from '@bigcommerce/checkout/dom-utils';
import { TranslatedString } from '@bigcommerce/checkout/locale';

import { Button, ButtonSize, ButtonVariant } from '../ui/button';
import { IconCheck } from '../ui/icon';

import type CheckoutStepType from './CheckoutStepType';

export interface CheckoutStepHeaderProps {
    heading: ReactNode;
    isActive?: boolean;
    isComplete?: boolean;
    isEditable?: boolean;
    summary?: ReactNode;
    type: CheckoutStepType;
    onEdit?(type: CheckoutStepType): void;
    additionalActions?: ReactNode;
}

const CheckoutStepHeader: FunctionComponent<CheckoutStepHeaderProps> = ({
    heading,
    isActive,
    isComplete,
    isEditable,
    onEdit,
    summary,
    type,
    additionalActions,
}) => {
    const { themeV2 } = useThemeContext();
    const isBillingStep = type === 'billing';
    const hasAdditionalActions = !!additionalActions;
    const [isMobile, setIsMobile] = useState(false);
    
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= 1024);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    return (
        <div
            className={classNames('stepHeader', {
                'is-readonly': !isEditable,
                'is-clickable': isEditable && !isActive,
            })}
            onClick={preventDefault(isEditable && onEdit ? () => onEdit(type) : noop)}
            style={isBillingStep && hasAdditionalActions ? { flexWrap: 'wrap', justifyContent: 'space-between' } : undefined}
        >
            {/* Sempre figura + titolo */}
            <div className="stepHeader-figure stepHeader-column">
                <IconCheck
                    additionalClassName={classNames(
                        'stepHeader-counter',
                        'optimizedCheckout-step',
                        { 'stepHeader-counter--complete': isComplete },
                    )}
                />
                <h2
                    className={classNames('stepHeader-title optimizedCheckout-headingPrimary',
                        { 'header': themeV2 && (isActive || isComplete) },
                        { 'header-secondary': themeV2 && !isActive && !isComplete })}
                >
                    {heading}
                </h2>
            </div>

            {/* MOBILE: summary in actions (row) + "Vuoi fattura" in body flex-end */}
            {isMobile && isComplete && !isActive && (
                <>
                    <div 
                        className="mobileOnlyStepHeader-actions stepHeader-actions stepHeader-column">
                        <div className="optimizedCheckout-contentPrimary body-regular" data-test="step-info">
                            {summary}
                        </div>
                        <Button
                            aria-expanded={isActive}
                            className={classNames({ 'body-regular': themeV2 })}
                            size={ButtonSize.Tiny}
                            testId="step-edit-button"
                            variant={ButtonVariant.Secondary}
                        >
                            <TranslatedString id="common.edit_action" />
                        </Button>
                    </div>

                    {/* RIGA 3: "Vuoi fattura" in body (flex-end, SOLO billing) */}
                    {isBillingStep && hasAdditionalActions && (
                        <div 
                            className="Header-body stepHeader-column optimizedCheckout-contentPrimary body-regular customStepHeader"
                            style={{marginTop:'4px', display:'flex', justifyContent:'flex-end'}}>
                            <div style={{ whiteSpace: 'nowrap' }}>
                                {additionalActions}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* DESKTOP: layout originale */}
            {!isMobile && (
                <>
                    {/* Non-billing: summary in body */}
                    {!isBillingStep && themeV2 && !isActive && isComplete && (
                        <div className="stepHeader-body stepHeader-column optimizedCheckout-contentPrimary body-regular" data-test="step-info">
                            {summary}
                        </div>
                    )}

                    {!isBillingStep && !themeV2 && (
                        <div className="stepHeader-body stepHeader-column optimizedCheckout-contentPrimary" data-test="step-info">
                            {!isActive && isComplete && summary}
                        </div>
                    )}

                    {/* Actions generali (non-billing) */}
                    {isEditable && !isActive && (
                        <div className="stepHeader-actions stepHeader-column">
                            <Button
                                aria-expanded={isActive}
                                className={classNames({ 'body-regular': themeV2 })}
                                size={ButtonSize.Tiny}
                                testId="step-edit-button"
                                variant={ButtonVariant.Secondary}
                            >
                                <TranslatedString id="common.edit_action" />
                            </Button>
                            {!isBillingStep && additionalActions && (
                                <div style={{ marginTop: '8px', whiteSpace: 'nowrap' }}>
                                    {additionalActions}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Billing desktop: summary + "Vuoi fattura" in body */}
                    {isBillingStep && hasAdditionalActions && themeV2 && !isActive && isComplete && (
                        <div className="stepHeader-body stepHeader-column optimizedCheckout-contentPrimary body-regular customStepHeader" data-test="step-info">
                            <div style={{ flex: 1 }}>{summary}</div>
                            <div style={{ whiteSpace: 'nowrap' }}>{additionalActions}</div>
                        </div>
                    )}

                    {isBillingStep && hasAdditionalActions && !themeV2 && (
                        <div className="stepHeader-body stepHeader-column optimizedCheckout-contentPrimary customStepHeader" data-test="step-info">
                            {!isActive && isComplete && (
                                <>
                                    <div style={{ flex: 1 }}>{summary}</div>
                                    <div style={{ whiteSpace: 'nowrap' }}>{additionalActions}</div>
                                </>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default memo(CheckoutStepHeader);
