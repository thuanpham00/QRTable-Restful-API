/**
 * Script điều chỉnh quantity trong DishIngredient cho hợp lý
 * Dựa trên khẩu phần chuẩn cho 1 suất ăn
 * 
 * Quy tắc:
 * - Thịt/cá/hải sản chính: 0.15-0.3 kg
 * - Rau củ chính: 0.1-0.2 kg
 * - Bún/mì/cơm: 0.15-0.25 kg
 * - Phụ gia (bơ, dầu, nước sốt): 0.01-0.05 kg/liter
 * - Gia vị: 0.001-0.01 kg
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const ADJUSTMENTS = {
  // Món Bò Mỹ Áp Chảo Sốt Tiêu Đen
  'Bò Mỹ Áp Chảo Sốt Tiêu Đen': {
    'Thịt bò': 0.25,
    'Bơ': 0.02,
    'Tỏi': 0.01,
    'Tiêu': 0.005,
    'Muối': 0.005
  },

  // Món Bò Wagyu nướng đá
  'Bò Wagyu nướng đá': {
    'Thịt bò': 0.3,
    'Bơ': 0.015,
    'Dầu cooking oil': 0.01,
    'Tỏi': 0.01,
    'Mè đen': 0.005,
    'Tiêu': 0.005,
    'Muối': 0.005
  },

  // Món Bún Thịt Nướng Chả Giò
  'Bún Thịt Nướng Chả Giò': {
    'Bún tươi': 0.2,
    'Thịt heo': 0.15,
    'Bột ngọt': 0.002,
    'Đường': 0.01,
    'Ớt hiểm': 0.01
  },

  // Món Cơm Gà Xối Mỡ
  'Cơm Gà Xối Mỡ': {
    'Thịt gà': 0.25,
    'Nước tương': 0.02,
    'Bột ngọt': 0.002,
    'Bột ớt': 0.005,
    'Tỏi bột': 0.005,
    'Đường': 0.005,
    'Muối': 0.005,
    'Trứng gà': 1
  },

  // Món Cơm Sườn Nướng
  'Cơm Sườn Nướng': {
    'Sườn heo': 0.2,
    'Mật ong': 0.02,
    'Bột ngọt': 0.002,
    'Bột ớt': 0.005,
    'Tỏi bột': 0.015,
    'Hành lá': 0.005,
    'Trứng gà': 1
  },

  // Món Gà Viên Chiên
  'Gà Viên Chiên': {
    'Thịt gà': 0.2,
    'Khoai tây': 0.1,
    'Bột năng': 0.03,
    'Nước mắm': 0.01,
    'Hạt nêm': 0.005,
    'Trứng gà': 1
  },

  // Món Gà rán truyền thống
  'Gà rán truyền thống': {
    'Thịt gà': 0.25,
    'Khoai tây': 0.1,
    'Bột năng': 0.03,
    'Sốt mayonnaise': 0.02,
    'Muối': 0.005,
    'Tiêu': 0.005,
    'Hạt nêm': 0.005,
    'Trứng gà': 1
  },

  // Món Khoai Tây Chiên
  'Khoai Tây Chiên': {
    'Khoai tây': 0.2,
    'Sốt ớt': 0.03
  },

  // Món Lẩu Thái hải sản
  'Lẩu Thái hải sản': {
    'Tôm': 0.1,
    'Mực ống': 0.08,
    'Cá basa': 0.06,
    'Bạch tuộc': 0.05,
    'Ngao': 0.08,
    'Nấm rơm': 0.1,
    'Húng quế': 0.005,
    'Me': 0.003,
    'Ớt hiểm': 0.01
  },

  // Món Mì xào bò
  'Mì xào bò': {
    'Mì tươi': 0.2,
    'Thịt bò': 0.15,
    'Hành tây': 0.05,
    'Nước tương': 0.015,
    'Tiêu xay': 0.005
  },

  // Món Mì xào hải sản
  'Mì xào hải sản': {
    'Mì tươi': 0.2,
    'Tôm': 0.1,
    'Mực ống': 0.08,
    'Hành tây': 0.05,
    'Cà rốt': 0.04,
    'Nước mắm': 0.015,
    'Bột ngọt': 0.002,
    'Đường': 0.01
  },

  // Món Mì ý paste sốt bò
  'Mì ý paste sốt bò': {
    'Mì ý': 0.2,
    'Thịt bò': 0.12,
    'Cà chua': 0.15,
    'Nước mắm': 0.015,
    'Bột ngọt': 0.002,
    'Đường': 0.02
  },

  // Món Sashimi Cá Hồi Na Uy Thượng Hạng
  'Sashimi Cá Hồi Na Uy Thượng Hạng': {
    'Cá hồi': 0.15,
    'Gừng': 0.01
  },

  // Món Tôm hùm sốt bơ tỏi
  'Tôm hùm sốt bơ tỏi': {
    'Tôm': 0.25,
    'Bơ': 0.02,
    'Tỏi': 0.01,
    'Muối': 0.005,
    'Tiêu': 0.005
  },

  // Món Bánh Flan Caramel
  'Bánh Flan Caramel': {
    'Trứng gà': 2,
    'Đường': 0.05
  },

  // Món Rau câu dừa 2
  'Rau câu dừa 2': {
    'Đường': 0.1
  }
}

async function adjustDishIngredients() {
  console.log('🔧 Điều chỉnh quantity DishIngredient...\n')
  console.log('='.repeat(100))

  try {
    const dishIngredients = await prisma.dishIngredient.findMany({
      include: {
        dish: true,
        ingredient: true
      }
    })

    console.log(`\n📊 Tổng số: ${dishIngredients.length} records\n`)

    let updatedCount = 0
    let skippedCount = 0

    for (const di of dishIngredients) {
      const dishName = di.dish.name
      const ingredientName = di.ingredient.name

      if (ADJUSTMENTS[dishName] && ADJUSTMENTS[dishName][ingredientName] !== undefined) {
        const newQty = ADJUSTMENTS[dishName][ingredientName]
        const oldQty = di.quantity

        await prisma.dishIngredient.update({
          where: { id: di.id },
          data: { quantity: String(newQty) } // Convert to String
        })

        console.log(`✅ ${dishName}`)
        console.log(`   ${ingredientName}: ${oldQty} → ${newQty} ${di.ingredient.unit}`)

        updatedCount++
      } else {
        skippedCount++
      }
    }

    console.log(`\n${'='.repeat(100)}`)
    console.log(`\n📊 TÓM TẮT:`)
    console.log(`   - Tổng số records: ${dishIngredients.length}`)
    console.log(`   - Đã cập nhật: ${updatedCount}`)
    console.log(`   - Bỏ qua: ${skippedCount}`)
    console.log(`\n✅ Hoàn tất!`)

  } catch (error) {
    console.error('\n❌ LỖI:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

adjustDishIngredients()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
