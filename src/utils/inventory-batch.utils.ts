/**
 * Tính toán status của lô hàng dựa trên quantity và expiryDate
 *
 * @param quantity - Số lượng còn lại trong lô
 * @param expiryDate - Ngày hết hạn (nullable)
 * @param lowThreshold - Ngưỡng coi là "Low" (mặc định 10)
 * @returns Status của lô hàng
 */
export function calculateBatchStatus(
  quantity: number,
  expiryDate: Date | null,
  lowThreshold: number = 10
): 'Available' | 'Low' | 'Empty' | 'Expired' {
  // 1. Kiểm tra hết hạn trước (ưu tiên cao nhất)
  if (expiryDate && expiryDate < new Date()) {
    return 'Expired'
  }

  // 2. Kiểm tra số lượng
  if (quantity === 0) {
    return 'Empty'
  }

  if (quantity > 0 && quantity < lowThreshold) {
    return 'Low'
  }

  // 3. Mặc định là Available
  return 'Available'
}
