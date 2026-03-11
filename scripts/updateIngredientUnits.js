/**
 * Script để update unit cho tất cả Ingredient hiện có
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Ánh xạ category → unit mặc định (Vietnamese categories)
const CATEGORY_UNIT_MAP = {
  'thit-ca': 'kg',    // Thịt, cá, hải sản
  'rau-cu': 'kg',     // Rau củ
  'gia-vi': 'gram',   // Gia vị (mặc định gram cho gia vị khô)
  'khac': 'kg',       // Khác (mặc định kg)
  'default': 'kg'
}

// Logic xác định unit dựa trên tên nguyên liệu
function determineUnit(ingredient) {
  const name = ingredient.name.toLowerCase()
  const category = ingredient.category || 'default'

  // 1. Trứng - đơn vị là quả/trái
  if (name.includes('trứng')) {
    return 'piece'
  }

  // 2. Chất lỏng - liter
  if (name.includes('nước') || name.includes('dầu') || name.includes('mắm') ||
    name.includes('tương') || name.includes('sữa') || name.includes('mật ong')) {
    return 'liter'
  }

  // 3. Sốt/sauce - ml (dễ đong hơn)
  if (name.includes('sốt')) {
    return 'ml'
  }

  // 4. Bột khô, gia vị bột - gram
  if (name.includes('bột') || name.includes('muối') || name.includes('tiêu xay') ||
    name.includes('tỏi bột') || name.includes('hạt nêm')) {
    return 'gram'
  }

  // 5. Rau thơm (herbs) - thường dùng ít - gram
  if (name.includes('rau mùi') || name.includes('hành lá') || name.includes('húng quế') ||
    name.includes('hành khô')) {
    return 'gram'
  }

  // 6. Gia vị nhỏ - gram
  if (category === 'gia-vi' && (name.includes('gừng') || name.includes('tỏi') ||
    name.includes('ớt') || name.includes('me'))) {
    return 'gram'
  }

  // 7. Các loại bún, bánh, mì - kg
  if (name.includes('bún') || name.includes('bánh') || name.includes('mì')) {
    return 'kg'
  }

  // 8. Thịt, cá, hải sản - kg
  if (category === 'thit-ca' && !name.includes('trứng')) {
    return 'kg'
  }

  // 9. Rau củ lớn - kg
  if (category === 'rau-cu') {
    // Rau thơm đã được xử lý ở trên (gram)
    // Còn lại là rau củ lớn - kg
    if (!name.includes('rau mùi') && !name.includes('hành lá') && !name.includes('húng quế')) {
      return 'kg'
    }
  }

  // 10. Mặc định theo category
  return CATEGORY_UNIT_MAP[category] || CATEGORY_UNIT_MAP['default']
}

async function updateIngredientUnits() {
  console.log('🔄 Bắt đầu cập nhật unit cho Ingredient...')
  console.log('📋 Logic: trứng=piece, chất lỏng=liter, sốt=ml, bột/gia vị=gram, thịt/rau=kg\n')

  try {
    const ingredients = await prisma.ingredient.findMany()

    console.log(`📦 Tìm thấy ${ingredients.length} nguyên liệu\n`)

    let stats = {
      kg: 0,
      gram: 0,
      liter: 0,
      ml: 0,
      piece: 0
    }

    for (const ing of ingredients) {
      const finalUnit = determineUnit(ing)

      await prisma.ingredient.update({
        where: { id: ing.id },
        data: { unit: finalUnit }
      })

      stats[finalUnit]++
      console.log(`✅ ${ing.name.padEnd(25)} → ${finalUnit.padEnd(8)} (${ing.category})`)
    }

    console.log(`\n📊 Thống kê:`)
    console.log(`   - kg: ${stats.kg} nguyên liệu`)
    console.log(`   - gram: ${stats.gram} nguyên liệu`)
    console.log(`   - liter: ${stats.liter} nguyên liệu`)
    console.log(`   - ml: ${stats.ml} nguyên liệu`)
    console.log(`   - piece: ${stats.piece} nguyên liệu`)
    console.log(`\n✨ Hoàn thành! Đã cập nhật ${ingredients.length} nguyên liệu`)
  } catch (error) {
    console.error('❌ Lỗi:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

updateIngredientUnits()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
