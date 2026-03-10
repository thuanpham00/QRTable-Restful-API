import prisma from '@/database'
import {
  CreateSupplierBodyType,
  SupplierListResType,
  SupplierQueryType,
  UpdateSupplierBodyType
} from '@/schemaValidations/supplier.schema'

export const getSupplierList = async ({ page, limit, name, status }: SupplierQueryType) => {
  const suppliers = await prisma.supplier.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { supplierIngredients: true }
      }
    }
  })

  // Map data để thêm ingredientCount
  let supplierWithCount = suppliers.map((supplier: any) => ({
    id: supplier.id,
    name: supplier.name,
    code: supplier.code,
    phone: supplier.phone,
    email: supplier.email,
    address: supplier.address,
    status: supplier.status,
    note: supplier.note,
    createdAt: supplier.createdAt,
    updatedAt: supplier.updatedAt,
    ingredientCount: supplier._count.supplierIngredients
  }))

  if (name) {
    const nameLower = name.toLowerCase()
    supplierWithCount = supplierWithCount.filter((supplier) => supplier.name.toLowerCase().includes(nameLower))
  }

  if (status) {
    supplierWithCount = supplierWithCount.filter((supplier) => supplier.status === status)
  }

  const total = supplierWithCount.length
  const skip = (page - 1) * limit
  const paginatedData = supplierWithCount.slice(skip, skip + limit)

  return {
    data: paginatedData,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  }
}

export const getSupplierDetail = async (id: number) => {
  const supplier = await prisma.supplier.findUniqueOrThrow({
    where: {
      id
    },
    include: {
      _count: {
        select: { supplierIngredients: true }
      }
    }
  })

  return {
    id: supplier.id,
    name: supplier.name,
    code: supplier.code,
    phone: supplier.phone,
    email: supplier.email,
    address: supplier.address,
    status: supplier.status,
    note: supplier.note,
    createdAt: supplier.createdAt,
    updatedAt: supplier.updatedAt,
    ingredientCount: supplier._count.supplierIngredients
  }
}

export const createSupplier = async (data: CreateSupplierBodyType) => {
  // Kiểm tra code đã tồn tại chưa
  const existingSupplier = await prisma.supplier.findUnique({
    where: {
      code: data.code
    }
  })

  if (existingSupplier) {
    throw new Error(`Mã nhà cung cấp "${data.code}" đã tồn tại`)
  }

  return prisma.supplier.create({
    data: {
      name: data.name,
      code: data.code,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
      status: data.status || 'Active',
      note: data.note || null
    }
  })
}

export const updateSupplier = async (id: number, data: UpdateSupplierBodyType) => {
  // Nếu update code, kiểm tra code mới có trùng với supplier khác không
  if (data.code) {
    const existingSupplier = await prisma.supplier.findUnique({
      where: {
        code: data.code
      }
    })

    if (existingSupplier && existingSupplier.id !== id) {
      throw new Error(`Mã nhà cung cấp "${data.code}" đã tồn tại`)
    }
  }

  return prisma.supplier.update({
    where: {
      id
    },
    data
  })
}

export const deleteSupplier = async (id: number) => {
  // Kiểm tra nhà cung cấp có phiếu nhập nào không
  const importReceiptCount = await prisma.importReceipt.count({
    where: {
      supplierId: id
    }
  })

  if (importReceiptCount > 0) {
    throw new Error(`Không thể xóa nhà cung cấp này vì còn ${importReceiptCount} phiếu nhập kho`)
  }

  const checkSupplyLink = await prisma.supplierIngredient.count({
    where: {
      supplierId: id
    }
  })

  if (checkSupplyLink > 0) {
    throw new Error(`Không thể xóa nhà cung cấp này vì còn ${checkSupplyLink} liên kết nguyên liệu`)
  }

  return prisma.supplier.delete({
    where: {
      id
    }
  })
}
