import envConfig from '@/config'
import { OrderStatus } from '@/constants/type'
import prisma from '@/database'
import { formatInTimeZone } from 'date-fns-tz'

export const dashboardIndicatorController = async ({ fromDate, toDate }: { fromDate: Date; toDate: Date }) => {
  // Query data cần thiết
  const [completedSessions, activeSessions, dishes, categories, allGuests, totalTables, individualPayments] =
    await Promise.all([
      // 1. Sessions đã kết thúc trong khoảng thời gian
      prisma.tableSession.findMany({
        where: {
          status: 'Completed',
          endTime: {
            gte: fromDate,
            lte: toDate
          }
        },
        include: {
          orders: {
            include: {
              dishSnapshot: {
                include: {
                  menuItem: {
                    include: {
                      dish: {
                        include: {
                          category: true
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          guests: true,
          paymentGroups: {
            include: {
              payments: true
            }
          }
        }
      }),
      // 2. Sessions đang active
      prisma.tableSession.findMany({
        where: {
          status: 'Active'
        }
      }),
      // 3. Danh sách món ăn với category
      prisma.dish.findMany({
        where: {
          categoryId: { not: null }
        },
        include: {
          category: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }),
      // 4. Categories
      prisma.dishCategory.findMany(),
      // 5. All guests có orders trong khoảng thời gian
      prisma.guest.findMany({
        where: {
          tableSession: {
            status: 'Completed',
            endTime: {
              gte: fromDate,
              lte: toDate
            }
          }
        },
        include: {
          orders: {
            where: {
              status: OrderStatus.Paid
            }
          }
        }
      }),
      // 6. Total tables
      prisma.table.count(),
      // 7. Individual payments (không thuộc PaymentGroup)
      prisma.payment.findMany({
        where: {
          paymentGroupId: null,
          status: 'Paid',
          guest: {
            tableSession: {
              status: 'Completed',
              endTime: {
                gte: fromDate,
                lte: toDate
              }
            }
          }
        }
      })
    ])

  // Khởi tạo biến thống kê
  let revenue = 0
  const uniqueGuests = new Set<number>()
  let orderCount = 0
  const orderStatusCount = {
    Paid: 0,
    Cancelled: 0,
    Rejected: 0,
    Processing: 0,
    Pending: 0,
    Delivered: 0
  }

  // Doanh thu theo ngày
  const revenueByDateObj: { [key: string]: number } = {}
  for (let i = new Date(fromDate); i <= toDate; i.setDate(i.getDate() + 1)) {
    revenueByDateObj[formatInTimeZone(i, envConfig.SERVER_TIMEZONE, 'dd/MM/yyyy')] = 0
  }

  // Thống kê món ăn
  const dishIndicatorObj: Record<
    number,
    {
      id: number
      name: string
      price: number
      description: string
      image: string
      status: string
      categoryId: number
      category: { id: number; name: string }
      createdAt: Date
      updatedAt: Date
      successOrders: number
      revenue: number
    }
  > = dishes.reduce((acc, dish) => {
    acc[dish.id] = { ...dish, successOrders: 0, revenue: 0 }
    return acc
  }, {} as any)

  // Thống kê category
  const categoryStatsObj: Record<
    number,
    {
      categoryId: number
      categoryName: string
      orderCount: number
      revenue: number
      dishCount: number
    }
  > = categories.reduce((acc, category) => {
    acc[category.id] = {
      categoryId: category.id,
      categoryName: category.name,
      orderCount: 0,
      revenue: 0,
      dishCount: 0
    }
    return acc
  }, {} as any)

  // Thống kê table performance
  const tableStatsObj: Record<
    number,
    {
      tableNumber: number
      sessionCount: number
      totalRevenue: number
      totalDuration: number
    }
  > = {}

  // Thống kê giờ peak
  const hourStatsObj: Record<
    string,
    {
      hour: string
      sessionCount: number
      revenue: number
    }
  > = {}

  // Xử lý dữ liệu từ sessions
  let totalSessionDuration = 0

  completedSessions.forEach((session) => {
    // 1. Revenue
    revenue += session.totalRevenue

    // 2. Unique guests
    session.guests.forEach((guest) => {
      uniqueGuests.add(guest.id)
    })

    // 3. Orders và order status
    session.orders.forEach((order) => {
      orderCount++
      if (order.status in orderStatusCount) {
        orderStatusCount[order.status as keyof typeof orderStatusCount]++
      }

      // Dish statistics
      const dishId = order.dishSnapshot.menuItem?.dish?.id
      if (dishId && dishIndicatorObj[dishId]) {
        dishIndicatorObj[dishId].successOrders += order.quantity
        dishIndicatorObj[dishId].revenue += order.dishSnapshot.price * order.quantity
      }

      // Category statistics
      const categoryId = order.dishSnapshot.menuItem?.dish?.category?.id
      if (categoryId && categoryStatsObj[categoryId]) {
        categoryStatsObj[categoryId].orderCount += order.quantity
        categoryStatsObj[categoryId].revenue += order.dishSnapshot.price * order.quantity
      }
    })

    // 4. Doanh thu theo ngày
    if (session.endTime) {
      const date = formatInTimeZone(session.endTime, envConfig.SERVER_TIMEZONE, 'dd/MM/yyyy')
      revenueByDateObj[date] = (revenueByDateObj[date] ?? 0) + session.totalRevenue

      // Peak hours analysis
      const hour = formatInTimeZone(session.startTime, envConfig.SERVER_TIMEZONE, 'HH:00')
      if (!hourStatsObj[hour]) {
        hourStatsObj[hour] = { hour, sessionCount: 0, revenue: 0 }
      }
      hourStatsObj[hour].sessionCount++
      hourStatsObj[hour].revenue += session.totalRevenue
    }

    // 5. Table performance
    const tableNumber = session.tableNumber
    if (!tableStatsObj[tableNumber]) {
      tableStatsObj[tableNumber] = {
        tableNumber,
        sessionCount: 0,
        totalRevenue: 0,
        totalDuration: 0
      }
    }
    tableStatsObj[tableNumber].sessionCount++
    tableStatsObj[tableNumber].totalRevenue += session.totalRevenue

    if (session.endTime) {
      const duration = (session.endTime.getTime() - session.startTime.getTime()) / (1000 * 60) // minutes
      tableStatsObj[tableNumber].totalDuration += duration
      totalSessionDuration += duration
    }
  })

  // Count dishes per category
  dishes.forEach((dish) => {
    if (dish.categoryId && categoryStatsObj[dish.categoryId]) {
      categoryStatsObj[dish.categoryId].dishCount++
    }
  })

  // ============ PAYMENT ANALYTICS ============
  let cashCount = 0
  let cashAmount = 0
  let sepayCount = 0
  let sepayAmount = 0
  let totalPayments = 0
  let totalGuestsInGroups = 0
  let totalAmountInGroups = 0

  // 1. PaymentGroups (thanh toán nhóm)
  completedSessions.forEach((session) => {
    session.paymentGroups.forEach((group) => {
      totalPayments++
      totalGuestsInGroups += group.payments.length
      totalAmountInGroups += group.totalAmount

      if (group.paymentMethod === 'CASH') {
        cashCount++
        cashAmount += group.totalAmount
      } else if (group.paymentMethod === 'SEPAY') {
        sepayCount++
        sepayAmount += group.totalAmount
      }
    })
  })

  // 2. Individual Payments (thanh toán riêng lẻ)
  individualPayments.forEach((payment) => {
    totalPayments++

    if (payment.paymentMethod === 'CASH') {
      cashCount++
      cashAmount += payment.totalAmount
    } else if (payment.paymentMethod === 'SEPAY') {
      sepayCount++
      sepayAmount += payment.totalAmount
    }
  })

  const groupPaymentCount = completedSessions.reduce((sum, s) => sum + s.paymentGroups.length, 0)
  const individualPaymentCount = individualPayments.length
  const avgGuestsPerGroup = groupPaymentCount > 0 ? totalGuestsInGroups / groupPaymentCount : 0
  const avgAmountPerGroup = groupPaymentCount > 0 ? totalAmountInGroups / groupPaymentCount : 0
  const avgPaymentValue = totalPayments > 0 ? revenue / totalPayments : 0
  const groupPaymentRate = totalPayments > 0 ? (groupPaymentCount / totalPayments) * 100 : 0

  // ============ GUEST ANALYTICS ============
  let guestsWithLogin = 0
  let guestsWithoutLogin = 0
  const guestOrderCountMap = new Map<number, number>()

  allGuests.forEach((guest) => {
    if (guest.refreshToken) {
      guestsWithLogin++
    } else {
      guestsWithoutLogin++
    }

    // Track order count per guest
    guestOrderCountMap.set(guest.id, guest.orders.length)
  })

  const returningGuests = Array.from(guestOrderCountMap.values()).filter((count) => count > 1).length

  // ============ SESSION STATISTICS ============
  const totalSessions = completedSessions.length
  const avgRevenuePerSession = totalSessions > 0 ? revenue / totalSessions : 0
  const avgGuestsPerSession = totalSessions > 0 ? uniqueGuests.size / totalSessions : 0
  const avgOrdersPerSession = totalSessions > 0 ? orderCount / totalSessions : 0
  const avgSessionDuration = totalSessions > 0 ? totalSessionDuration / totalSessions : 0

  // ============ TABLE PERFORMANCE ============
  const servingTableCount = new Set(activeSessions.map((s) => s.tableNumber)).size
  const utilizationRate = totalTables > 0 ? (totalSessions / totalTables) * 100 : 0

  const tablePerformance = Object.values(tableStatsObj)
    .map((table) => ({
      ...table,
      avgSessionDuration: table.sessionCount > 0 ? table.totalDuration / table.sessionCount : 0
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 10)

  // ============ TIME ANALYTICS ============
  const peakHours = Object.values(hourStatsObj)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  // ============ CATEGORY PERFORMANCE ============
  const categoryPerformance = Object.values(categoryStatsObj)
    .map((cat) => ({
      ...cat,
      percentage: revenue > 0 ? (cat.revenue / revenue) * 100 : 0
    }))
    .sort((a, b) => b.revenue - a.revenue)

  // ============ ORDER ANALYTICS ============
  const cancellationRate =
    orderCount > 0 ? ((orderStatusCount.Cancelled + orderStatusCount.Rejected) / orderCount) * 100 : 0

  // Format response
  const revenueByDate = Object.keys(revenueByDateObj).map((date) => ({
    date,
    revenue: revenueByDateObj[date]
  }))

  const dishIndicator = Object.values(dishIndicatorObj)
  const topDishesByQuantity = [...dishIndicator].sort((a, b) => b.successOrders - a.successOrders).slice(0, 10)
  const topDishesByRevenue = [...dishIndicator].sort((a, b) => b.revenue - a.revenue).slice(0, 10)

  return {
    // Basic metrics
    revenue,
    guestCount: uniqueGuests.size,
    orderCount,
    servingTableCount,
    revenueByDate,

    // Priority 1: Payment Analytics
    paymentAnalytics: {
      totalPayments,
      avgPaymentValue: Math.round(avgPaymentValue),
      groupPaymentRate: Math.round(groupPaymentRate * 100) / 100,
      paymentMethodBreakdown: {
        CASH: {
          count: cashCount,
          amount: cashAmount,
          percentage: revenue > 0 ? Math.round((cashAmount / revenue) * 100 * 100) / 100 : 0
        },
        SEPAY: {
          count: sepayCount,
          amount: sepayAmount,
          percentage: revenue > 0 ? Math.round((sepayAmount / revenue) * 100 * 100) / 100 : 0
        }
      },
      paymentGroupStats: {
        count: groupPaymentCount,
        avgGuestsPerGroup: Math.round(avgGuestsPerGroup * 100) / 100,
        avgAmountPerGroup: Math.round(avgAmountPerGroup)
      }
    },

    // Priority 1: Category Performance
    categoryPerformance,

    // Priority 1: Time Analytics
    timeAnalytics: {
      avgSessionDuration: Math.round(avgSessionDuration),
      peakHours,
      turnoverRate: Math.round((totalSessions / totalTables) * 100) / 100
    },

    // Priority 1: Table Performance
    tablePerformance: {
      totalTables,
      utilizationRate: Math.round(utilizationRate * 100) / 100,
      avgSessionsPerTable: Math.round((totalSessions / totalTables) * 100) / 100,
      topTables: tablePerformance
    },

    // Priority 2: Guest Analytics
    guestAnalytics: {
      totalGuests: uniqueGuests.size,
      avgGuestsPerSession: Math.round(avgGuestsPerSession * 100) / 100,
      guestLoginStats: {
        loggedIn: guestsWithLogin,
        walkIn: guestsWithoutLogin
      },
      returningGuests
    },

    // Priority 2: Order Analytics
    orderAnalytics: {
      totalOrders: orderCount,
      orderStatusBreakdown: orderStatusCount,
      cancellationRate: Math.round(cancellationRate * 100) / 100,
      avgOrdersPerSession: Math.round(avgOrdersPerSession * 100) / 100
    },

    // Priority 2: Session Statistics
    sessionStats: {
      totalSessions,
      completedSessions: completedSessions.length,
      activeSessions: activeSessions.length,
      avgRevenuePerSession: Math.round(avgRevenuePerSession),
      avgGuestsPerSession: Math.round(avgGuestsPerSession * 100) / 100,
      avgOrdersPerSession: Math.round(avgOrdersPerSession * 100) / 100
    },

    // Dish indicators
    topDishesByQuantity,
    topDishesByRevenue
  }
}
