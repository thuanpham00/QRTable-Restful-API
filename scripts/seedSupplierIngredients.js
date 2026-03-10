const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')
const prisma = new PrismaClient()

// Đọc file ingredients-export.json
const ingredientsPath = path.join(__dirname, 'ingredients-export.json')
const ingredients = JSON.parse(fs.readFileSync(ingredientsPath, 'utf-8'))

// Helper: Random price based on category
function getRandomPrice(category) {
  const priceRanges = {
    'thit-ca': { min: 80000, max: 300000 }, // Thịt cá
    'rau-cu': { min: 15000, max: 50000 }, // Rau củ
    'gia-vi': { min: 10000, max: 80000 }, // Gia vị
    khac: { min: 20000, max: 100000 } // Khác
  }

  const range = priceRanges[category] || priceRanges.khac
  return Math.floor(Math.random() * (range.max - range.min + 1) + range.min)
}

// Helper: Random số suppliers cho mỗi ingredient (1-3)
function getRandomSupplierCount() {
  const rand = Math.random()
  if (rand < 0.3) return 1 // 30% có 1 supplier
  if (rand < 0.7) return 2 // 40% có 2 suppliers
  return 3 // 30% có 3 suppliers
}

// Helper: Random suppliers (không trùng)
function getRandomSuppliers(count, maxSupplierId = 5) {
  const suppliers = []
  while (suppliers.length < count) {
    const supplierId = Math.floor(Math.random() * maxSupplierId) + 1
    if (!suppliers.includes(supplierId)) {
      suppliers.push(supplierId)
    }
  }
  return suppliers
}

async function main() {
  console.log('📦 Bắt đầu seed SupplierIngredient...\n')

  // Kiểm tra suppliers tồn tại
  const supplierCount = await prisma.supplier.count()
  if (supplierCount === 0) {
    console.log('⚠️  Chưa có supplier nào. Chạy: node scripts/seedSuppliers.js trước')
    return
  }

  console.log(`✅ Tìm thấy ${supplierCount} suppliers`)
  console.log(`✅ Tìm thấy ${ingredients.length} ingredients\n`)

  const supplierIngredients = []

  // Tạo data
  ingredients.forEach((ingredient) => {
    const supplierCount = getRandomSupplierCount()
    const suppliers = getRandomSuppliers(supplierCount, 5)

    suppliers.forEach((supplierId, index) => {
      const basePrice = getRandomPrice(ingredient.category)
      // Mỗi supplier có giá chênh lệch nhau 5-15%
      const priceVariation = 1 + (Math.random() * 0.1 - 0.05)
      const price = Math.round(basePrice * priceVariation)

      // Supplier đầu tiên là preferred
      const isPreferred = index === 0

      supplierIngredients.push({
        supplierId,
        ingredientId: ingredient.id,
        price,
        isPreferred,
        note: isPreferred ? 'Nhà cung cấp ưu tiên' : null
      })
    })
  })

  console.log(`📊 Tổng số bản ghi sẽ tạo: ${supplierIngredients.length}\n`)

  // Insert using upsert
  let successCount = 0
  let skipCount = 0

  for (const item of supplierIngredients) {
    try {
      await prisma.supplierIngredient.upsert({
        where: {
          supplierId_ingredientId: {
            supplierId: item.supplierId,
            ingredientId: item.ingredientId
          }
        },
        update: {
          price: item.price,
          isPreferred: item.isPreferred,
          note: item.note
        },
        create: item
      })
      successCount++
    } catch (error) {
      console.log(`❌ Lỗi khi insert supplierId=${item.supplierId}, ingredientId=${item.ingredientId}`)
      skipCount++
    }
  }

  console.log(`\n✅ Đã insert/update: ${successCount} bản ghi`)
  if (skipCount > 0) {
    console.log(`⚠️  Bỏ qua: ${skipCount} bản ghi`)
  }

  // Thống kê
  const total = await prisma.supplierIngredient.count()
  console.log(`\n📊 Tổng số SupplierIngredient trong DB: ${total}`)

  // Thống kê theo supplier
  console.log('\n📋 Thống kê theo nhà cung cấp:')
  for (let i = 1; i <= 5; i++) {
    const count = await prisma.supplierIngredient.count({
      where: { supplierId: i }
    })
    const supplier = await prisma.supplier.findUnique({
      where: { id: i },
      select: { name: true }
    })
    if (supplier) {
      console.log(`  - [NCC${String(i).padStart(3, '0')}] ${supplier.name}: ${count} nguyên liệu`)
    }
  }
}

main()
  .catch((e) => {
    console.error('❌ Lỗi:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
