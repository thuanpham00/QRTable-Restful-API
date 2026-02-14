import envConfig from '@/config'

export const SEPAY_CONFIG = {
  BANK_CODE: envConfig.SEPAY_BANK_CODE,
  ACCOUNT_NUMBER: envConfig.SEPAY_ACCOUNT_NUMBER,
  ACCOUNT_NAME: envConfig.SEPAY_ACCOUNT_NAME,
  PAYMENT_PREFIX: envConfig.SEPAY_PAYMENT_PREFIX,
  WEBHOOK_SECRET: envConfig.SEPAY_WEBHOOK_SECRET || '',
  QR_BASE_URL: 'https://qr.sepay.vn/img',
  QR_TEMPLATE: 'compact' as const
} as const

/**
 * Generate SePay QR Code URL
 */
export function generateSepayQR(paymentId: number, amount: number): string {
  const params = new URLSearchParams({
    bank: SEPAY_CONFIG.BANK_CODE,
    acc: SEPAY_CONFIG.ACCOUNT_NUMBER,
    amount: amount.toString(),
    des: `${SEPAY_CONFIG.PAYMENT_PREFIX}${paymentId}`,
    template: SEPAY_CONFIG.QR_TEMPLATE
  })

  return `${SEPAY_CONFIG.QR_BASE_URL}?${params.toString()}`
}

/**
 * Extract Payment ID from transaction content
 * Example: "KS123" -> 123
 */
//     "content":"KS23 Ma giao dich Trace775646 Trace 775646",
export function extractPaymentIdFromContent(content: string): number | null {
  const regex = new RegExp(`${SEPAY_CONFIG.PAYMENT_PREFIX}(\\d+)`, 'i')
  const match = content.match(regex)

  return match && match[1] ? parseInt(match[1], 10) : null
}

/**
 * Format bank info for display
 */
export function formatBankInfo(paymentId: number, amount: number) {
  return {
    bankCode: SEPAY_CONFIG.BANK_CODE,
    accountNumber: SEPAY_CONFIG.ACCOUNT_NUMBER,
    accountName: SEPAY_CONFIG.ACCOUNT_NAME,
    amount,
    content: `${SEPAY_CONFIG.PAYMENT_PREFIX}${paymentId}`
  }
}
