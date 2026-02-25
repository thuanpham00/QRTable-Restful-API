import { DishSchema } from '@/schemaValidations/dish.schema'
import z from 'zod'

export const DashboardIndicatorQueryParams = z.object({
  fromDate: z.coerce.date(),
  toDate: z.coerce.date()
})

export type DashboardIndicatorQueryParamsType = z.TypeOf<typeof DashboardIndicatorQueryParams>

// Schema for dish with revenue
const DishWithStatsSchema = DishSchema.extend({
  successOrders: z.number(),
  revenue: z.number()
})

export const DashboardIndicatorRes = z.object({
  data: z.object({
    // Basic metrics
    revenue: z.number(),
    guestCount: z.number(),
    orderCount: z.number(),
    servingTableCount: z.number(),
    revenueByDate: z.array(
      z.object({
        date: z.string(),
        revenue: z.number()
      })
    ),

    // Priority 1: Payment Analytics
    paymentAnalytics: z.object({
      totalPayments: z.number(),
      avgPaymentValue: z.number(),
      groupPaymentRate: z.number(),
      paymentMethodBreakdown: z.object({
        CASH: z.object({
          count: z.number(),
          amount: z.number(),
          percentage: z.number()
        }),
        SEPAY: z.object({
          count: z.number(),
          amount: z.number(),
          percentage: z.number()
        })
      }),
      paymentGroupStats: z.object({
        count: z.number(),
        avgGuestsPerGroup: z.number(),
        avgAmountPerGroup: z.number()
      })
    }),

    // Priority 1: Category Performance
    categoryPerformance: z.array(
      z.object({
        categoryId: z.number(),
        categoryName: z.string(),
        orderCount: z.number(),
        revenue: z.number(),
        dishCount: z.number(),
        percentage: z.number()
      })
    ),

    // Priority 1: Time Analytics
    timeAnalytics: z.object({
      avgSessionDuration: z.number(),
      peakHours: z.array(
        z.object({
          hour: z.string(),
          sessionCount: z.number(),
          revenue: z.number()
        })
      ),
      turnoverRate: z.number()
    }),

    // Priority 1: Table Performance
    tablePerformance: z.object({
      totalTables: z.number(),
      utilizationRate: z.number(),
      avgSessionsPerTable: z.number(),
      topTables: z.array(
        z.object({
          tableNumber: z.number(),
          sessionCount: z.number(),
          totalRevenue: z.number(),
          totalDuration: z.number(),
          avgSessionDuration: z.number()
        })
      )
    }),

    // Priority 2: Guest Analytics
    guestAnalytics: z.object({
      totalGuests: z.number(),
      avgGuestsPerSession: z.number(),
      guestLoginStats: z.object({
        loggedIn: z.number(),
        walkIn: z.number()
      }),
      returningGuests: z.number()
    }),

    // Priority 2: Order Analytics
    orderAnalytics: z.object({
      totalOrders: z.number(),
      orderStatusBreakdown: z.object({
        Paid: z.number(),
        Cancelled: z.number(),
        Rejected: z.number(),
        Processing: z.number(),
        Pending: z.number(),
        Delivered: z.number()
      }),
      cancellationRate: z.number(),
      avgOrdersPerSession: z.number()
    }),

    // Priority 2: Session Statistics
    sessionStats: z.object({
      totalSessions: z.number(),
      completedSessions: z.number(),
      activeSessions: z.number(),
      avgRevenuePerSession: z.number(),
      avgGuestsPerSession: z.number(),
      avgOrdersPerSession: z.number()
    }),

    // Dish indicators
    topDishesByQuantity: z.array(DishWithStatsSchema),
    topDishesByRevenue: z.array(DishWithStatsSchema)
  }),
  message: z.string()
})

export type DashboardIndicatorResType = z.TypeOf<typeof DashboardIndicatorRes>
