/**
 * Script xem toàn bộ DishIngredient và phân tích quantity
 * Giúp điều chỉnh quantity cho hợp lý với món ăn
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function reviewDishIngredients() {
  console.log('📋 Đọc toàn bộ DishIngredient...\n')
  console.log('='.repeat(100))

  try {
    const dishIngredients = await prisma.dishIngredient.findMany({
      include: {
        dish: true,
        ingredient: true
      },
      orderBy: [
        { dish: { name: 'asc' } },
        { ingredient: { name: 'asc' } }
      ]
    })

    console.log(`\n📊 Tổng số: ${dishIngredients.length} records\n`)

    // Group by dish
    const dishesByName = {}
    dishIngredients.forEach(di => {
      const dishName = di.dish.name
      if (!dishesByName[dishName]) {
        dishesByName[dishName] = []
      }
      dishesByName[dishName].push(di)
    })

    console.log(`🍽️  Tổng số món: ${Object.keys(dishesByName).length}\n`)
    console.log('='.repeat(100))

    // Display each dish with ingredients
    Object.entries(dishesByName).forEach(([dishName, ingredients], idx) => {
      console.log(`\n${idx + 1}. 🍽️  ${dishName.toUpperCase()}`)
      console.log(`   Số nguyên liệu: ${ingredients.length}`)
      console.log(`   Nguyên liệu:`)

      ingredients.forEach((di, i) => {
        const ing = di.ingredient
        const qty = di.quantity
        const unit = ing.unit

        // Highlight potential issues
        let warning = ''
        if (qty > 100 && unit === 'kg') {
          warning = ' ⚠️  (Quá nhiều cho 1 món?)'
        } else if (qty < 0.01 && (unit === 'kg' || unit === 'liter')) {
          warning = ' ⚠️  (Quá ít?)'
        } else if (qty > 1000 && unit === 'gram') {
          warning = ' ⚠️  (Nên đổi sang kg?)'
        } else if (qty > 1000 && unit === 'ml') {
          warning = ' ⚠️  (Nên đổi sang liter?)'
        }

        console.log(`      ${i + 1}. ${ing.name}: ${qty} ${unit}${warning}`)
      })

      console.log(`   ${'─'.repeat(95)}`)
    })

    console.log(`\n${'='.repeat(100)}`)
    console.log(`\n📊 PHÂN TÍCH:`)

    // Find high quantities
    const highQty = dishIngredients.filter(di =>
      (di.ingredient.unit === 'kg' || di.ingredient.unit === 'liter') && di.quantity > 10
    )

    if (highQty.length > 0) {
      console.log(`\n⚠️  ${highQty.length} records có quantity > 10 kg/liter:`)
      highQty.forEach(di => {
        console.log(`   - ${di.dish.name}: ${di.ingredient.name} = ${di.quantity} ${di.ingredient.unit}`)
      })
    }

    // Find very low quantities
    const lowQty = dishIngredients.filter(di =>
      (di.ingredient.unit === 'kg' || di.ingredient.unit === 'liter') && di.quantity < 0.01
    )

    if (lowQty.length > 0) {
      console.log(`\n⚠️  ${lowQty.length} records có quantity < 0.01 kg/liter:`)
      lowQty.forEach(di => {
        console.log(`   - ${di.dish.name}: ${di.ingredient.name} = ${di.quantity} ${di.ingredient.unit}`)
      })
    }

    // Find strange units
    const gramIngredients = dishIngredients.filter(di => di.ingredient.unit === 'gram')
    const mlIngredients = dishIngredients.filter(di => di.ingredient.unit === 'ml')

    if (gramIngredients.length > 0 || mlIngredients.length > 0) {
      console.log(`\n⚠️  Nguyên liệu vẫn dùng gram/ml (chưa convert):`)
      if (gramIngredients.length > 0) {
        console.log(`   - Gram: ${gramIngredients.length} records`)
      }
      if (mlIngredients.length > 0) {
        console.log(`   - ML: ${mlIngredients.length} records`)
      }
    }

    console.log(`\n✅ Hoàn tất!`)

  } catch (error) {
    console.error('\n❌ LỖI:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

reviewDishIngredients()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
