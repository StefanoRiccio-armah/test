import { BACKEND_URL } from "./config"

export interface UpdatePaymentFeeParams {
    checkoutId: string
    selectedPaymentMethodId: string
    language: string
}

export async function updatePaymentFee({ checkoutId, selectedPaymentMethodId, language }: UpdatePaymentFeeParams): Promise<boolean> {
    try {
        const response = await fetch(`${BACKEND_URL}/payment/handle-payment-change`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                checkoutId, selectedPaymentMethodId, language
            })
        })

        if(!response.ok){
            console.warn('[PaymentFee] errore risposta server: ', await response.text())
            return false
        }

        return true
    }catch(error){
        console.warn('[PaymentFee] Errore di rete: ', error)
        return false
    }
}