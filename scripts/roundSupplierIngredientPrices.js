const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Hàm làm tròn đến nghìn gần nhất
function roundToThousand(price) {
  return Math.round(price / 1000) * 1000
}

async function main() {
  console.log('📝 Đang lấy tất cả SupplierIngredient...\n')

  const supplierIngredients = await prisma.supplierIngredient.findMany({
    orderBy: { id: 'asc' }
  })

  console.log(`✅ Tìm thấy ${supplierIngredients.length} bản ghi\n`)

  let updatedCount = 0
  let unchangedCount = 0

  console.log('🔄 Đang cập nhật giá...\n')

  for (const item of supplierIngredients) {
    const oldPrice = item.price
    const newPrice = roundToThousand(oldPrice)

    if (oldPrice !== newPrice) {
      await prisma.supplierIngredient.update({
        where: { id: item.id },
        data: { price: newPrice }
      })

      console.log(`  ✓ ID ${item.id}: ${oldPrice.toLocaleString('vi-VN')}đ → ${newPrice.toLocaleString('vi-VN')}đ`)
      updatedCount++
    } else {
      unchangedCount++
    }
  }

  console.log('\n' + '═'.repeat(60))
  console.log(`✅ Đã cập nhật: ${updatedCount} bản ghi`)
  console.log(`➖ Không thay đổi: ${unchangedCount} bản ghi`)
  console.log(`📊 Tổng cộng: ${supplierIngredients.length} bản ghi`)
}

main()
  .catch((e) => {
    console.error('❌ Lỗi:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
