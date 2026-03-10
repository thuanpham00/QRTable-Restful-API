import prisma from '@/database'
import {
  CreateSupplierIngredientBodyType,
  UpdateSupplierIngredientBodyType
} from '@/schemaValidations/supplierIngredient.schema'

export const getSupplyList = async (idSupplier: number) => {
  const whereCondition: any = {
    supplierId: idSupplier
  }

  const [supplierIngredients] = await Promise.all([
    prisma.supplierIngredient.findMany({
      orderBy: { createdAt: 'desc' },
      where: whereCondition,
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        ingredient: {
          select: {
            id: true,
            name: true,
            category: true,
            image: true
          }
        }
      }
    })
  ])

  return {
    data: supplierIngredients
  }
}

export const getSupplyDetail = async (id: number) => {
  return prisma.supplierIngredient.findUniqueOrThrow({
    where: {
      id
    },
    include: {
      supplier: {
        select: {
          id: true,
          name: true,
          code: true,
          phone: true,
          email: true
        }
      },
      ingredient: {
        select: {
          id: true,
          name: true,
          category: true,
          description: true,
          image: true
        }
      }
    }
  })
}

export const createSupply = async (data: CreateSupplierIngredientBodyType) => {
  // Kiểm tra link đã tồn tại chưa
  const existing = await prisma.supplierIngredient.findUnique({
    where: {
      supplierId_ingredientId: {
        supplierId: data.supplierId,
        ingredientId: data.ingredientId
      }
    }
  })

  if (existing) {
    throw new Error(`Link giữa supplier #${data.supplierId} và ingredient #${data.ingredientId} đã tồn tại`)
  }

  // Kiểm tra supplier và ingredient có tồn tại không
  const [supplier, ingredient] = await Promise.all([
    prisma.supplier.findUnique({ where: { id: data.supplierId } }),
    prisma.ingredient.findUnique({ where: { id: data.ingredientId } })
  ])

  if (!supplier) {
    throw new Error(`Nhà cung cấp #${data.supplierId} không tồn tại`)
  }

  if (!ingredient) {
    throw new Error(`Nguyên liệu #${data.ingredientId} không tồn tại`)
  }

  return prisma.supplierIngredient.create({
    data: {
      supplierId: data.supplierId,
      ingredientId: data.ingredientId,
      price: data.price,
      isPreferred: data.isPreferred || false,
      note: data.note || null
    },
    include: {
      supplier: {
        select: {
          id: true,
          name: true,
          code: true
        }
      },
      ingredient: {
        select: {
          id: true,
          name: true,
          category: true,
          image: true
        }
      }
    }
  })
}

export const updateSupply = async (id: number, data: UpdateSupplierIngredientBodyType) => {
  return prisma.supplierIngredient.update({
    where: {
      id
    },
    data,
    include: {
      supplier: {
        select: {
          id: true,
          name: true,
          code: true
        }
      },
      ingredient: {
        select: {
          id: true,
          name: true,
          category: true,
          image: true
        }
      }
    }
  })
}

export const deleteSupply = async (id: number) => {
  // Kiểm tra có phiếu nhập nào sử dụng link này không
  const importReceiptItemCount = await prisma.importReceiptItem.count({
    where: {
      supplierIngredientId: id
    }
  })

  if (importReceiptItemCount > 0) {
    throw new Error(`Không thể xóa vì còn ${importReceiptItemCount} phiếu nhập kho sử dụng link này`)
  }

  return prisma.supplierIngredient.delete({
    where: {
      id
    }
  })
}

export const getIngredientNotLink = async (supplierId: number) => {
  const listIngredientLinked = await prisma.supplierIngredient.findMany({
    where: {
      supplierId
    },
    include: {
      ingredient: {
        select: {
          id: true,
          name: true
        }
      }
    }
  })

  const listIngredient = await prisma.ingredient.findMany({
    where: {
      id: {
        notIn: listIngredientLinked.map((item) => item.ingredientId)
      }
    }
  })
  console.log(listIngredient.length)
  return listIngredient
}
