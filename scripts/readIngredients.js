const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')
const prisma = new PrismaClient()

async function main() {
  console.log('📋 Đang đọc danh sách nguyên liệu từ database...')

  const ingredients = await prisma.ingredient.findMany({
    orderBy: {
      name: 'asc'
    }
  })

  const outputPath = path.join(__dirname, 'ingredients-export.json')

  fs.writeFileSync(outputPath, JSON.stringify(ingredients, null, 2), 'utf-8')

  console.log(`✅ Đã xuất ${ingredients.length} nguyên liệu ra file: ${outputPath}`)
}

main()
  .catch((e) => {
    console.error('❌ Lỗi:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
