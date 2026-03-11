/**
 * Script tạo ImportReceipt mẫu
 * 
 * Logic:
 * 1. Đọc Supplier từ database
 * 2. Đọc SupplierIngredient tương ứng
 * 3. Tạo 1 phiếu nhập mẫu với random items
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Helper: Random số trong khoảng [min, max]
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// Helper: Random giá theo đơn vị
function randomPrice(unit) {
  switch (unit) {
    case 'kg':
      return randomInt(50000, 300000) // 50k - 300k/kg
    case 'liter':
      return randomInt(30000, 150000) // 30k - 150k/liter
    case 'piece':
      return randomInt(1000, 50000)   // 1k - 50k/cái
    default:
      return randomInt(10000, 100000)
  }
}

// Helper: Random quantity theo đơn vị
function randomQuantity(unit) {
  switch (unit) {
    case 'kg':
      return randomInt(20, 200) // 20-200 kg
    case 'liter':
      return randomInt(10, 100) // 10-100 liter
    case 'piece':
      return randomInt(50, 500) // 50-500 cái
    default:
      return randomInt(10, 100)
  }
}

// Generate mã phiếu nhập tự động: IMP-YYYYMMDD-XXXX
async function generateImportReceiptCode(tx) {
  const today = new Date()
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')

  const lastReceipt = await tx.importReceipt.findFirst({
    where: {
      code: {
        startsWith: `IMP-${dateStr}`
      }
    },
    orderBy: {
      code: 'desc'
    }
  })

  let sequence = 1
  if (lastReceipt) {
    const lastSequence = parseInt(lastReceipt.code.split('-')[2])
    sequence = lastSequence + 1
  }

  return `IMP-${dateStr}-${sequence.toString().padStart(4, '0')}`
}

async function createSampleImportReceipt() {
  console.log('📦 Tạo ImportReceipt mẫu...\n')
  console.log('='.repeat(80))

  try {
    // 1. Đọc danh sách Supplier
    const suppliers = await prisma.supplier.findMany({
      where: {
        status: 'Active'
      },
      include: {
        supplierIngredients: {
          include: {
            ingredient: true
          }
        }
      }
    })

    if (suppliers.length === 0) {
      console.log('❌ Không tìm thấy Supplier nào!')
      return
    }

    console.log(`\n📋 Tìm thấy ${suppliers.length} nhà cung cấp:\n`)
    suppliers.forEach((supplier, idx) => {
      console.log(`   [${idx + 1}] ${supplier.name} - Code: ${supplier.code}`)
      console.log(`       Số nguyên liệu: ${supplier.supplierIngredients.length}`)
    })

    // 2. Chọn supplier đầu tiên hoặc random
    const selectedSupplier = suppliers[0]

    console.log(`\n✅ Chọn nhà cung cấp: ${selectedSupplier.name}`)
    console.log(`   Mã NCC: ${selectedSupplier.code}`)
    console.log(`   Số nguyên liệu có sẵn: ${selectedSupplier.supplierIngredients.length}`)

    if (selectedSupplier.supplierIngredients.length === 0) {
      console.log('❌ Nhà cung cấp này chưa có nguyên liệu nào!')
      return
    }

    // 3. Hiển thị danh sách SupplierIngredient
    console.log(`\n📦 Danh sách nguyên liệu từ ${selectedSupplier.name}:\n`)
    selectedSupplier.supplierIngredients.forEach((si, idx) => {
      console.log(`   [${idx + 1}] ${si.ingredient.name} (${si.ingredient.unit})`)
      console.log(`       Giá: ${si.price.toLocaleString('vi-VN')}đ/${si.ingredient.unit}`)
      console.log(`       ID: ${si.id} | Preferred: ${si.isPreferred ? 'Yes' : 'No'}`)
    })

    // 4. Chọn random 2-5 nguyên liệu để nhập
    const numItems = Math.min(
      randomInt(2, 5),
      selectedSupplier.supplierIngredients.length
    )

    const shuffled = [...selectedSupplier.supplierIngredients].sort(() => 0.5 - Math.random())
    const selectedIngredients = shuffled.slice(0, numItems)

    console.log(`\n🎲 Random chọn ${numItems} nguyên liệu để nhập:\n`)

    // 5. Tạo items data
    const itemsData = selectedIngredients.map((si, idx) => {
      const quantity = randomQuantity(si.ingredient.unit)
      const unitPrice = si.price // Dùng giá từ SupplierIngredient
      const totalPrice = quantity * unitPrice
      const batchNumber = `BATCH-${si.ingredient.name.slice(0, 3).toUpperCase()}-${Date.now()}-${idx}`

      // Hạn sử dụng: 1-6 tháng sau
      const expiryDate = new Date()
      expiryDate.setMonth(expiryDate.getMonth() + randomInt(1, 6))

      console.log(`   [${idx + 1}] ${si.ingredient.name}`)
      console.log(`       Số lượng: ${quantity} ${si.ingredient.unit}`)
      console.log(`       Đơn giá: ${unitPrice.toLocaleString('vi-VN')}đ`)
      console.log(`       Thành tiền: ${totalPrice.toLocaleString('vi-VN')}đ`)
      console.log(`       Batch: ${batchNumber}`)
      console.log(`       HSD: ${expiryDate.toISOString().slice(0, 10)}`)

      return {
        supplierIngredientId: si.id,
        quantity,
        unitPrice,
        totalPrice,
        batchNumber,
        expiryDate,
        note: `Nhập ${si.ingredient.name} - Đợt ${new Date().toISOString().slice(0, 10)}`
      }
    })

    const totalAmount = itemsData.reduce((sum, item) => sum + item.totalPrice, 0)

    console.log(`\n💰 Tổng tiền dự kiến: ${totalAmount.toLocaleString('vi-VN')}đ`)

    // 6. Lấy account để làm createdBy
    const account = await prisma.account.findFirst({
      where: {
        role: 'Owner'
      }
    })

    if (!account) {
      console.log('❌ Không tìm thấy account Owner!')
      return
    }

    console.log(`\n👤 Người tạo: ${account.name} (ID: ${account.id})`)

    // 7. Tạo ImportReceipt
    console.log(`\n🔄 Đang tạo phiếu nhập...`)

    const result = await prisma.$transaction(async (tx) => {
      const code = await generateImportReceiptCode(tx)

      const receipt = await tx.importReceipt.create({
        data: {
          code,
          supplierId: selectedSupplier.id,
          importDate: new Date(),
          totalAmount,
          status: 'Draft',
          note: `Phiếu nhập mẫu từ ${selectedSupplier.name} - Tạo tự động`,
          createdBy: account.id,
          items: {
            create: itemsData
          }
        },
        include: {
          items: {
            include: {
              supplierIngredient: {
                include: {
                  ingredient: true
                }
              }
            }
          },
          supplier: true,
          createdByAccount: true
        }
      })

      return receipt
    })

    console.log(`\n${'='.repeat(80)}`)
    console.log(`\n✅ TẠO PHIẾU NHẬP THÀNH CÔNG!\n`)
    console.log(`📄 Mã phiếu: ${result.code}`)
    console.log(`📅 Ngày nhập: ${result.importDate.toISOString().slice(0, 10)}`)
    console.log(`🏪 Nhà cung cấp: ${result.supplier.name}`)
    console.log(`💰 Tổng tiền: ${result.totalAmount.toLocaleString('vi-VN')}đ`)
    console.log(`📊 Trạng thái: ${result.status}`)
    console.log(`👤 Người tạo: ${result.createdByAccount.name}`)
    console.log(`📦 Số lượng items: ${result.items.length}`)
    console.log(`\nChi tiết items:`)
    result.items.forEach((item, idx) => {
      console.log(`   [${idx + 1}] ${item.supplierIngredient.ingredient.name}`)
      console.log(`       ${item.quantity} ${item.supplierIngredient.ingredient.unit} × ${item.unitPrice.toLocaleString('vi-VN')}đ = ${item.totalPrice.toLocaleString('vi-VN')}đ`)
    })

    console.log(`\n🎯 Test Postman:`)
    console.log(`   GET /import-receipts/${result.id}`)
    console.log(`   PUT /import-receipts/${result.id}`)
    console.log(`   DELETE /import-receipts/${result.id}`)

  } catch (error) {
    console.error('\n❌ LỖI:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

createSampleImportReceipt()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
