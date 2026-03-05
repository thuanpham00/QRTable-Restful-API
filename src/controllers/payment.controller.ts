import {
  CreatePaymentBodyType,
  CreatePaymentByTableBodyType,
  GetPaymentsQueryType,
  SepayWebhookBodyType
} from '@/schemaValidations/payment.schema'
import prisma from '@/database'
import { generateSepayQR, formatBankInfo, extractPaymentIdFromContent } from '@/utils/sepay'
import { EntityError } from '@/utils/errors'
import { ManagerRoom, OrderStatus } from '@/constants/type'

// Controller: Thanh toán cả bàn (sử dụng PaymentGroup)
export const createPaymentForTable = async (body: CreatePaymentByTableBodyType, accountId: number, io?: any) => {
  const { tableNumber, paymentMethod, guestIds } = body

  const existingGroup = await prisma.paymentGroup.findFirst({
    where: {
      tableNumber,
      status: 'Pending',
      paymentMethod: 'SEPAY'
    },
    include: {
      payments: {
        include: {
          orders: {
            include: {
              dishSnapshot: true,
              orderHandler: true,
              guest: true
            }
          }
        }
      }
    }
  })
  // SEPAY → CASH: cancel group cũ, tạo mới
  if (existingGroup && paymentMethod === 'CASH') {
    await prisma.$transaction([
      prisma.paymentGroup.update({
        where: { id: existingGroup.id },
        data: { status: 'Cancelled' }
      }),
      prisma.order.updateMany({
        where: {
          paymentId: { in: existingGroup.payments.map((p) => p.id) }
        },
        data: { paymentId: null, status: OrderStatus.Delivered }
      }),
      prisma.payment.updateMany({
        where: { paymentGroupId: existingGroup.id },
        data: { status: 'Cancelled' }
      })
    ])
  }
  // 1. Check existing PaymentGroup nếu là SEPAY (tránh tạo group mới mỗi lần mở modal QR)
  else if (existingGroup && paymentMethod === 'SEPAY') {
    // Nếu đã có PaymentGroup Pending, return existing group với QR code
    if (existingGroup) {
      const allOrders = existingGroup.payments.flatMap((p) => p.orders)

      // Lấy socketIds của tất cả guests
      const guestIds = existingGroup.payments.map((p) => p.guestId).filter(Boolean) as number[]
      const sockets = await prisma.socket.findMany({
        where: { guestId: { in: guestIds } }
      })
      const socketIds = sockets.map((s) => s.socketId)

      return {
        paymentGroupId: existingGroup.id,
        totalAmount: existingGroup.totalAmount,
        status: existingGroup.status,
        paymentMethod: existingGroup.paymentMethod,
        // qrCodeUrl: generateSepayQR(existingGroup.id, existingGroup.totalAmount), // TODO: Cần sửa utils để support group
        // bankInfo: formatBankInfo(existingGroup.id, existingGroup.totalAmount),
        qrCodeUrl: generateSepayQR(existingGroup.id, 2000), // TODO: Cần sửa utils để support group
        bankInfo: formatBankInfo(existingGroup.id, 2000),
        expiresIn: 600,
        payments: existingGroup.payments,
        orders: allOrders,
        socketIds
      }
    }
  }

  // 2. Lấy tất cả orders chưa thanh toán của các guests
  const guests = await prisma.guest.findMany({
    where: { tableNumber, id: { in: guestIds } },
    include: {
      orders: {
        where: {
          paymentId: null,
          status: OrderStatus.Delivered
        },
        include: {
          dishSnapshot: true,
          orderHandler: true,
          guest: true
        }
      }
    }
  })

  const tableSessionId = guests[0]?.tableSessionId || null

  // Tính tổng tiền và chuẩn bị data cho từng guest
  const paymentsData: Array<{
    guestId: number
    orderIds: number[]
    totalAmount: number
    orders: any[]
  }> = []
  let totalAmount = 0

  for (const guest of guests) {
    if (guest.orders.length === 0) continue

    const guestTotal = guest.orders.reduce((sum, order) => sum + order.dishSnapshot.price * order.quantity, 0)
    totalAmount += guestTotal

    paymentsData.push({
      guestId: guest.id,
      orderIds: guest.orders.map((o) => o.id),
      totalAmount: guestTotal,
      orders: guest.orders
    })
  }

  if (paymentsData.length === 0) {
    throw new EntityError([{ field: 'orders', message: 'Không có order nào cần thanh toán' }])
  }

  // 3. Tạo PaymentGroup + Payments trong transaction
  let shouldUpdateTableStatus = false
  const result = await prisma.$transaction(async (tx) => {
    // 3.1. Tạo PaymentGroup
    const paymentGroup = await tx.paymentGroup.create({
      data: {
        tableNumber,
        totalAmount,
        paymentMethod,
        status: paymentMethod === 'SEPAY' ? 'Pending' : 'Paid',
        note: `Thanh toán ${paymentMethod === 'CASH' ? 'tiền mặt' : 'chuyển khoản SePay'} cho toàn bộ bàn ${tableNumber} (${guestIds.length} khách)`,
        createdById: accountId,
        tableSessionId
      }
    })

    // 3.2. Tạo Payments cho từng guest
    const payments = await Promise.all(
      paymentsData.map((data) =>
        tx.payment.create({
          data: {
            guestId: data.guestId,
            tableNumber,
            totalAmount: data.totalAmount,
            paymentMethod,
            status: paymentMethod === 'SEPAY' ? 'Pending' : 'Paid',
            paymentGroupId: paymentGroup.id,
            note: `Phần thanh toán của khách tại bàn ${tableNumber}`,
            createdById: accountId,
            orders: {
              connect: data.orderIds.map((id) => ({ id }))
            }
          },
          include: {
            orders: {
              include: {
                dishSnapshot: true,
                orderHandler: true,
                guest: true
              }
            }
          }
        })
      )
    )

    // 3.3. Update orders status
    await tx.order.updateMany({
      where: {
        id: {
          in: paymentsData.flatMap((d) => d.orderIds)
        }
      },
      data: {
        status: paymentMethod === 'SEPAY' ? OrderStatus.Delivered : OrderStatus.Paid,
        orderHandlerId: accountId
      }
    })

    if (tableSessionId && paymentMethod === 'CASH') {
      await tx.tableSession.update({
        where: { id: tableSessionId },
        data: {
          totalRevenue: { increment: totalAmount }
        }
      })

      // Check guests không login (refreshToken null) - đã thanh toán xong
      const guestsInfo = await tx.guest.findMany({
        where: { id: { in: paymentsData.map((p) => p.guestId) } },
        select: { id: true, refreshToken: true, refreshTokenExpiresAt: true }
      })

      const loggedOutGuestsCount = guestsInfo.filter(
        (g) => g.refreshToken === null && g.refreshTokenExpiresAt === null
      ).length

      if (loggedOutGuestsCount > 0) {
        const currentSession = await tx.tableSession.findUnique({
          where: { id: tableSessionId }
        })

        if (currentSession) {
          const remainingGuests = currentSession.guestCount - loggedOutGuestsCount

          if (remainingGuests <= 0) {
            // Tất cả guests đã logout → End session
            await tx.tableSession.update({
              where: { id: tableSessionId },
              data: {
                endTime: new Date(),
                status: 'Completed',
                guestCount: 0
              }
            })
            await tx.table.update({
              where: { number: tableNumber },
              data: { status: 'Available' }
            })
            shouldUpdateTableStatus = true
          } else {
            // Còn guests khác → Chỉ decrement
            await tx.tableSession.update({
              where: { id: tableSessionId },
              data: {
                guestCount: { decrement: loggedOutGuestsCount }
              }
            })
          }
        }
      }
    }

    return { paymentGroup, payments }
  })

  // Emit socket nếu table status đổi
  if (shouldUpdateTableStatus && io) {
    io.to(ManagerRoom).emit('update-status-table')
  }

  // 4. Generate response
  const allOrders = result.payments.flatMap((p) => p.orders)

  // Lấy socketIds của tất cả guests
  const socketGuestIds = result.payments.map((p) => p.guestId).filter(Boolean) as number[]
  const sockets = await prisma.socket.findMany({
    where: { guestId: { in: socketGuestIds } }
  })
  const socketIds = sockets.map((s) => s.socketId)

  const responseData: any = {
    paymentGroupId: result.paymentGroup.id,
    totalAmount: result.paymentGroup.totalAmount,
    status: result.paymentGroup.status,
    paymentMethod: result.paymentGroup.paymentMethod,
    payments: result.payments,
    orders: allOrders,
    socketIds
  }

  if (paymentMethod === 'SEPAY') {
    // responseData.qrCodeUrl = generateSepayQR(result.paymentGroup.id, totalAmount) // TODO: Cần sửa utils để support group
    // responseData.bankInfo = formatBankInfo(result.paymentGroup.id, totalAmount)

    responseData.qrCodeUrl = generateSepayQR(result.paymentGroup.id, 2000) // TODO: Cần sửa utils để support group
    responseData.bankInfo = formatBankInfo(result.paymentGroup.id, 2000)
    responseData.expiresIn = 600
  }

  return responseData
}

// Controller thanh toán các hóa đơn dựa trên guestId
export const createPayment = async (body: CreatePaymentBodyType, accountId: number, io: any) => {
  const { guestId, tableNumber, orderIds, totalAmount, paymentMethod, note } = body

  // 2.5. Kiểm tra payment đã tồn tại chưa
  const existingPayment = await prisma.payment.findFirst({
    where: {
      AND: [{ guestId: guestId }, { tableNumber: tableNumber }], // đảm bảo cùng guestId và tableNumber
      status: { in: ['Pending'] },
      orders: {
        some: {
          id: { in: orderIds }
        }
      }
    }
  })

  // Nếu đã tồn tại payment, trả về thông tin payment đó
  if (existingPayment && existingPayment.paymentMethod !== paymentMethod) {
    // case đổi phương thức thanh toán (ví dụ từ SEPAY sang CASH) - hủy payment cũ và tạo payment mới
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: existingPayment.id },
        data: { status: 'Cancelled' }
      }),
      prisma.order.updateMany({
        where: { paymentId: existingPayment.id },
        data: { paymentId: null, status: OrderStatus.Delivered }
      })
    ])
  } else if (existingPayment) {
    const [ordersResult, socketRecord] = await Promise.all([
      prisma.order.findMany({
        where: {
          paymentId: existingPayment.id
        },
        include: {
          dishSnapshot: true,
          orderHandler: true,
          guest: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      }),
      prisma.socket.findUnique({
        where: {
          guestId
        }
      })
    ])

    const responseData: any = {
      paymentId: existingPayment.id,
      totalAmount: existingPayment.totalAmount,
      status: existingPayment.status,
      paymentMethod: existingPayment.paymentMethod
    }

    if (existingPayment.paymentMethod === 'SEPAY' && existingPayment.status === 'Pending') {
      // responseData.qrCodeUrl = generateSepayQR(existingPayment.id, existingPayment.totalAmount)
      // responseData.bankInfo = formatBankInfo(existingPayment.id, existingPayment.totalAmount)
      responseData.qrCodeUrl = generateSepayQR(existingPayment.id, 2000)
      responseData.bankInfo = formatBankInfo(existingPayment.id, 2000)
      responseData.expiresIn = 600
    }

    return {
      responseData,
      orders: ordersResult,
      socketId: socketRecord?.socketId
    }
  }

  // 1. Verify orders tồn tại và chưa thanh toán
  const orders = await prisma.order.findMany({
    where: {
      id: { in: orderIds },
      paymentId: null,
      status: { endsWith: OrderStatus.Delivered } // bắt buộc phải phục vụ mới được thanh toán
    },
    include: { dishSnapshot: true }
  })

  if (orders.length !== orderIds.length) {
    throw new EntityError([{ field: 'orderIds', message: 'Một số order không tồn tại hoặc đã được thanh toán' }])
  }

  // 2. Verify số tiền
  const calculatedAmount = orders.reduce((sum, order) => {
    return sum + order.dishSnapshot.price * order.quantity
  }, 0)

  if (calculatedAmount !== totalAmount) {
    throw new EntityError([
      {
        field: 'totalAmount',
        message: `Tổng tiền không khớp. Tính toán: ${calculatedAmount}, Nhận: ${totalAmount}`
      }
    ])
  }

  // 3. Tạo Payment
  const payment = await prisma.payment.create({
    data: {
      paymentMethod,
      totalAmount,
      status: paymentMethod === 'SEPAY' ? 'Pending' : 'Paid',
      guestId,
      tableNumber,
      note,
      createdById: accountId,
      orders: {
        connect: orderIds.map((id) => ({ id }))
      }
    }
  })

  await prisma.$transaction(async (tx) => {
    const orderIds = orders.map((order) => order.id)
    await tx.order.updateMany({
      where: {
        id: {
          in: orderIds
        }
      },
      data: {
        status: paymentMethod === 'SEPAY' ? OrderStatus.Delivered : OrderStatus.Paid,
        orderHandlerId: accountId
      }
    })

    if (paymentMethod === 'CASH' && payment.guestId) {
      const guest = await tx.guest.findUnique({
        where: { id: payment.guestId },
        select: { tableSessionId: true, refreshToken: true, refreshTokenExpiresAt: true }
      })
      if (guest?.tableSessionId) {
        await tx.tableSession.update({
          where: { id: guest.tableSessionId },
          data: {
            totalRevenue: { increment: totalAmount }
          }
        })

        // dành cho khách không login vào hệ thống
        if (guest?.refreshToken === null && guest?.refreshTokenExpiresAt === null) {
          const findTableSession = await tx.tableSession.findUnique({
            where: { id: guest.tableSessionId }
          })
          if (findTableSession?.guestCount === 1) {
            await Promise.all([
              tx.tableSession.update({
                where: { id: guest.tableSessionId },
                data: {
                  endTime: new Date(),
                  status: 'Completed',
                  guestCount: { decrement: 1 }
                }
              }),
              tx.table.update({
                where: { number: findTableSession.tableNumber },
                data: { status: 'Available' }
              })
            ])
            io.to(ManagerRoom).emit('update-status-table') // cập nhật trạng thái bàn
          } else {
            await tx.tableSession.update({
              where: { id: guest.tableSessionId },
              data: {
                guestCount: { decrement: 1 }
              }
            })
          }
        }
      }
    }
  })

  const [ordersResult, socketRecord] = await Promise.all([
    prisma.order.findMany({
      where: {
        id: {
          in: orders.map((order) => order.id)
        }
      },
      include: {
        dishSnapshot: true,
        orderHandler: true,
        guest: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    }),
    prisma.socket.findUnique({
      where: {
        guestId
      }
    })
  ])

  // 4. Generate response data
  const responseData: any = {
    paymentId: payment.id,
    totalAmount: payment.totalAmount,
    status: payment.status,
    paymentMethod: payment.paymentMethod
  }

  if (paymentMethod === 'SEPAY') {
    // responseData.qrCodeUrl = generateSepayQR(payment.id, totalAmount)
    // responseData.bankInfo = formatBankInfo(payment.id, totalAmount)
    responseData.qrCodeUrl = generateSepayQR(payment.id, 2000)
    responseData.bankInfo = formatBankInfo(payment.id, 2000)
    responseData.expiresIn = 600 // 10 phút
  }

  return {
    responseData,
    orders: ordersResult,
    socketId: socketRecord?.socketId
  }
}

/**
 * Xử lý webhook từ SePay
 */
export const handleSepayWebhook = async (webhookData: SepayWebhookBodyType, io?: any) => {
  // 1. Kiểm tra giao dịch đã xử lý chưa
  const existingTransaction = await prisma.sepayTransaction.findUnique({
    where: { sepayId: webhookData.id }
  })

  if (existingTransaction?.processed) {
    return { success: true, message: 'Already processed' }
  }

  // 2. Chỉ xử lý tiền VÀO
  if (webhookData.transferType !== 'in') {
    return { success: true, message: 'Outgoing transaction ignored' }
  }

  // 3. Lưu/Update transaction log
  const transactionData = {
    sepayId: webhookData.id,
    gateway: webhookData.gateway,
    transactionDate: new Date(webhookData.transactionDate),
    accountNumber: webhookData.accountNumber,
    transferType: webhookData.transferType,
    transferAmount: webhookData.transferAmount,
    accumulated: webhookData.accumulated,
    code: webhookData.code,
    content: webhookData.content,
    referenceCode: webhookData.referenceCode,
    subAccount: webhookData.subAccount,
    description: webhookData.description
  }

  const transaction = existingTransaction
    ? await prisma.sepayTransaction.update({
        where: { id: existingTransaction.id },
        data: { ...transactionData, retryCount: { increment: 1 } }
      })
    : await prisma.sepayTransaction.create({ data: transactionData })

  // 4. Trích xuất Payment ID hoặc PaymentGroup ID
  const paymentId = extractPaymentIdFromContent(webhookData.content)

  if (!paymentId) {
    const error = `Payment ID not found in content: ${webhookData.content}`
    await prisma.sepayTransaction.update({
      where: { id: transaction.id },
      data: { processingError: error }
    })
    throw new Error(error)
  }

  // 5. Tìm PaymentGroup trước (ưu tiên), nếu không có thì tìm Payment đơn lẻ
  const paymentGroup = await prisma.paymentGroup.findFirst({
    where: {
      id: paymentId,
      status: 'Pending',
      paymentMethod: 'SEPAY'
    },
    include: {
      payments: true
    }
  })

  if (paymentGroup) {
    // 6a. Xử lý PaymentGroup
    await prisma.$transaction([
      // Update PaymentGroup
      prisma.paymentGroup.update({
        where: { id: paymentGroup.id },
        data: {
          status: 'Paid',
          sepayTransactionId: webhookData.id.toString(),
          sepayReferenceCode: webhookData.referenceCode,
          sepayGateway: webhookData.gateway,
          sepayTransactionDate: new Date(webhookData.transactionDate),
          sepayContent: webhookData.content
        }
      }),

      // Update all Payments in group
      prisma.payment.updateMany({
        where: { paymentGroupId: paymentGroup.id },
        data: {
          status: 'Paid',
          sepayTransactionId: webhookData.id,
          sepayReferenceCode: webhookData.referenceCode,
          sepayGateway: webhookData.gateway,
          sepayTransactionDate: new Date(webhookData.transactionDate),
          sepayContent: webhookData.content
        }
      }),

      // Update all Orders
      prisma.order.updateMany({
        where: {
          paymentId: { in: paymentGroup.payments.map((p) => p.id) }
        },
        data: { status: 'Paid' }
      }),

      // Mark transaction as processed
      prisma.sepayTransaction.update({
        where: { id: transaction.id },
        data: {
          processed: true,
          processedAt: new Date(),
          paymentGroupId: paymentGroup.id
        }
      }),

      ...(paymentGroup.tableSessionId
        ? [
            prisma.tableSession.update({
              where: { id: paymentGroup.tableSessionId },
              data: {
                totalRevenue: { increment: paymentGroup.totalAmount }
              }
            })
          ]
        : [])
    ])

    // Check guests không login (refreshToken null) - đã thanh toán xong
    if (paymentGroup.tableSessionId) {
      const guestsInfo = await prisma.guest.findMany({
        where: {
          id: { in: paymentGroup.payments.map((p) => p.guestId).filter(Boolean) as number[] }
        },
        select: { id: true, refreshToken: true, refreshTokenExpiresAt: true }
      })

      const loggedOutGuestsCount = guestsInfo.filter(
        (g) => g.refreshToken === null && g.refreshTokenExpiresAt === null
      ).length

      if (loggedOutGuestsCount > 0) {
        const currentSession = await prisma.tableSession.findUnique({
          where: { id: paymentGroup.tableSessionId }
        })

        if (currentSession) {
          const remainingGuests = currentSession.guestCount - loggedOutGuestsCount

          if (remainingGuests <= 0) {
            // Tất cả guests đã logout → End session
            await prisma.tableSession.update({
              where: { id: paymentGroup.tableSessionId },
              data: {
                endTime: new Date(),
                status: 'Completed',
                guestCount: 0
              }
            })
            await prisma.table.update({
              where: { number: paymentGroup.tableNumber },
              data: { status: 'Available' }
            })
            if (io) {
              io.to(ManagerRoom).emit('update-status-table')
            }
          } else {
            // Còn guests khác → Chỉ decrement
            await prisma.tableSession.update({
              where: { id: paymentGroup.tableSessionId },
              data: {
                guestCount: { decrement: loggedOutGuestsCount }
              }
            })
          }
        }
      }
    }

    const listGuest = await prisma.payment.findMany({
      where: {
        paymentGroupId: paymentGroup.id
      },
      include: {
        guest: true
      }
    })
    const socketRecords = await prisma.socket.findMany({
      where: {
        guestId: {
          in: listGuest.map((p) => p.guestId!)
        }
      }
    })
    const socketIds = socketRecords.map((s) => s.socketId)

    // 7. Gửi thông báo Socket.IO
    if (io) {
      io.to(ManagerRoom).to(socketIds).emit('payment-group-completed', {
        paymentGroupId: paymentGroup.id,
        tableNumber: paymentGroup.tableNumber,
        status: 'Paid',
        amount: paymentGroup.totalAmount
      })
      io.to(ManagerRoom).emit('count-order')
    }

    return { success: true, message: 'PaymentGroup processed successfully', paymentGroupId: paymentGroup.id }
  }

  // 6b. Không tìm thấy PaymentGroup, tìm Payment đơn lẻ
  const payment = await prisma.payment.findFirst({
    where: {
      id: paymentId,
      status: 'Pending',
      paymentMethod: 'SEPAY'
    },
    include: {
      guest: true
    }
  })

  if (!payment) {
    const error = `Payment/PaymentGroup not found: ID=${paymentId}, Amount=${webhookData.transferAmount}`
    await prisma.sepayTransaction.update({
      where: { id: transaction.id },
      data: { processingError: error }
    })
    throw new Error(error)
  }

  // 7. Xử lý Payment đơn lẻ
  await prisma.$transaction([
    // Update Payment
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'Paid',
        sepayTransactionId: webhookData.id,
        sepayReferenceCode: webhookData.referenceCode,
        sepayGateway: webhookData.gateway,
        sepayTransactionDate: new Date(webhookData.transactionDate),
        sepayContent: webhookData.content
      }
    }),

    // Update Orders
    prisma.order.updateMany({
      where: { paymentId: payment.id },
      data: { status: 'Paid' }
    }),

    // Mark transaction as processed
    prisma.sepayTransaction.update({
      where: { id: transaction.id },
      data: {
        processed: true,
        processedAt: new Date(),
        paymentId: payment.id
      }
    }),

    ...(payment.guest?.tableSessionId
      ? [
          prisma.tableSession.update({
            where: { id: payment.guest.tableSessionId },
            data: {
              totalRevenue: { increment: payment.totalAmount }
            }
          })
        ]
      : [])
  ])

  // dành cho khách không login vào hệ thống
  if (payment.guest?.refreshToken === null && payment.guest?.refreshTokenExpiresAt === null) {
    const findTableSession = await prisma.tableSession.findUnique({
      where: { id: payment.guest.tableSessionId as number }
    })
    if (findTableSession?.guestCount === 1) {
      await Promise.all([
        prisma.tableSession.update({
          where: { id: payment.guest.tableSessionId as number },
          data: {
            endTime: new Date(),
            status: 'Completed',
            guestCount: { decrement: 1 }
          }
        }),
        prisma.table.update({
          where: { number: findTableSession.tableNumber },
          data: { status: 'Available' }
        })
      ])
      if (io) {
        io.to(ManagerRoom).emit('update-status-table') // cập nhật trạng thái bàn
      }
    } else {
      await prisma.tableSession.update({
        where: { id: payment.guest.tableSessionId as number },
        data: {
          guestCount: { decrement: 1 }
        }
      })
    }
  }

  const socketRecord = await prisma.socket.findUnique({
    where: {
      guestId: payment.guestId!
    }
  })

  // 8. Gửi thông báo Socket.IO
  if (socketRecord) {
    io.to(ManagerRoom).to(socketRecord.socketId).emit('payment-completed', {
      paymentId: payment.id,
      status: 'Paid',
      amount: payment.totalAmount
    })
    io.to(ManagerRoom).emit('count-order')
  } else {
    io.to(ManagerRoom).emit('payment-completed', {
      paymentId: payment.id,
      status: 'Paid',
      amount: payment.totalAmount
    })
    io.to(ManagerRoom).emit('count-order')
  }

  return { success: true, message: 'Payment processed successfully' }
}

/**
 * Lấy danh sách payments (cho admin)
 */
export const getPayments = async ({
  numberTable,
  paymentMethod,
  fromDate,
  toDate,
  page,
  limit
}: GetPaymentsQueryType) => {
  const skip = (page - 1) * limit
  const where: any = {}

  if (numberTable) where.tableNumber = numberTable

  if (paymentMethod) where.paymentMethod = paymentMethod

  if (fromDate) {
    where.createdAt = {
      gte: new Date(fromDate)
    }
  }
  if (toDate) {
    where.createdAt = {
      lte: new Date(toDate)
    }
  }
  if (fromDate && toDate) {
    where.createdAt = {
      gte: new Date(fromDate),
      lte: new Date(toDate)
    }
  }

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        guest: { select: { id: true, name: true } },
        table: { select: { number: true } },
        orders: { select: { id: true, quantity: true } },
        createdBy: { select: { id: true, name: true } },
        paymentGroup: true
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.payment.count({ where })
  ])

  return {
    data: payments,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  }
}

/**
 * Kiểm tra trạng thái payment
 */
export const getDetailPayment = async (paymentId: number) => {
  const payment = await prisma.payment.findFirst({
    where: {
      id: paymentId
    },
    include: {
      guest: { select: { id: true, name: true } },
      table: { select: { number: true } },
      orders: { select: { id: true, quantity: true } },
      createdBy: { select: { id: true, name: true } },
      paymentGroup: true
    }
  })

  return payment
}
