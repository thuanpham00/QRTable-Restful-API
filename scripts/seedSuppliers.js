const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const suppliers = [
    {
      name: 'Công ty TNHH Thực phẩm Sạch Việt',
      code: 'NCC001',
      phone: '0283456789',
      email: 'contact@thucphamsachviet.vn',
      address: '123 Đường Nguyễn Văn Linh, Quận 7, TP.HCM',
      status: 'Active',
      note: 'Chuyên cung cấp rau củ quả sạch, giao hàng hằng ngày'
    },
    {
      name: 'Công ty CP Thực phẩm Tươi sống Biển Đông',
      code: 'NCC002',
      phone: '0287654321',
      email: 'sales@biendongseafood.com',
      address: '456 Đường Lê Văn Việt, Quận 9, TP.HCM',
      status: 'Active',
      note: 'Nhà cung cấp hải sản tươi sống uy tín, giá cả cạnh tranh'
    },
    {
      name: 'Trang trại thịt sạch Organic Farm',
      code: 'NCC003',
      phone: '0901234567',
      email: 'info@organicfarm.vn',
      address: '789 Quốc lộ 1A, Huyện Củ Chi, TP.HCM',
      status: 'Active',
      note: 'Chuyên thịt bò, thịt gà, thịt heo organic không hormone'
    },
    {
      name: 'Cửa hàng gia vị Bảo Gia',
      code: 'NCC004',
      phone: '0912345678',
      email: 'baogia.spices@gmail.com',
      address: '321 Chợ Bến Thành, Quận 1, TP.HCM',
      status: 'Active',
      note: 'Cung cấp đầy đủ các loại gia vị, nước mắm, dầu ăn cao cấp'
    },
    {
      name: 'Công ty TNHH Bánh mì & Nguyên liệu Á Đông',
      code: 'NCC005',
      phone: '0298765432',
      email: 'adong.bakery@outlook.com',
      address: '555 Đường Cách Mạng Tháng 8, Quận 10, TP.HCM',
      status: 'Active',
      note: 'Cung cấp bánh mì, bột mì, nguyên liệu làm bánh chất lượng cao'
    }
  ]

  console.log('Starting to seed suppliers...')

  // Use upsert per item because `createMany({ skipDuplicates })` isn't supported on SQLite
  const created = await Promise.all(
    suppliers.map((supplier) =>
      prisma.supplier.upsert({
        where: {
          code: supplier.code // Unique field
        },
        update: supplier, // Update nếu đã tồn tại
        create: supplier // Create nếu chưa tồn tại
      })
    )
  )

  console.log('✅ Upserted suppliers:', created.length)

  const total = await prisma.supplier.count()
  console.log('📊 Total suppliers in DB:', total)

  // Hiển thị danh sách
  console.log('\n📋 Danh sách nhà cung cấp:')
  created.forEach((s) => {
    console.log(`  - [${s.code}] ${s.name}`)
  })
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
