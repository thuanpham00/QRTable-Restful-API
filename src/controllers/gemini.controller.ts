import prisma from '@/database'
import { generateResponse, analyzeUserIntent } from '@/utils/gemini'
import { Dish, Ingredient, DishIngredient, MenuItem, Menu } from '@prisma/client'

type DishWithDetails = Dish & {
  category?: { name: string } | null
  dishIngredients?: (DishIngredient & {
    ingredient: Ingredient
  })[]
  menuItems?: (MenuItem & {
    menu: Menu
  })[]
}

type GuestContext = {
  dietaryPreferences?: string | null
  allergyInfo?: string | null
}

export function buildPrompt(
  message: string,
  guestContext: GuestContext,
  dishes: DishWithDetails[],
  guestName?: string
): string {
  return `
Bạn là chatbot AI tư vấn món ăn cho nhà hàng Việt Nam.

**KHÁCH HÀNG:**
${guestName ? `Tên: ${guestName}` : 'Quý khách'}
${guestContext.dietaryPreferences ? `Sở thích: ${guestContext.dietaryPreferences}` : ''}
${guestContext.allergyInfo ? `⚠️ Dị ứng: ${guestContext.allergyInfo}` : ''}

**MENU (${dishes.length} món):**
${dishes
  .map((dish, idx) => {
    // Lấy giá từ MenuItem trong menu đang active
    const activeMenuItem = dish.menuItems?.find((mi) => mi.menu.isActive && mi.status === 'Available')
    const currentPrice = activeMenuItem?.price || dish.price

    return `
${idx + 1}. ${dish.name} - ${currentPrice.toLocaleString('vi-VN')}đ (ID: ${dish.id})
   ${dish.description}
   Danh mục: ${dish.category?.name || 'Chưa phân loại'} | Độ cay: ${dish.spicyLevel || 0}/3 ${getSpicyEmoji(dish.spicyLevel || 0)}
   ${dish.dietaryTags ? `🏷️ ${dish.dietaryTags}` : ''}
   ${
     dish.dishIngredients?.some((di) => di.ingredient.allergenType)
       ? `⚠️ Dị ứng: ${dish.dishIngredients
           .filter((di) => di.ingredient.allergenType)
           .map((di) => di.ingredient.allergenType)
           .join(', ')}`
       : ''
   }
`
  })
  .join('\n')}

**CÂU HỎI:** "${message}"

**YÊU CẦU:**
1. Gọi khách ${guestName ? `"${guestName}"` : '"bạn"'} một lần duy nhất ở đầu
2. Gợi ý món phù hợp nhất (tối đa 2-3 món nếu có)
3. Mỗi món chỉ viết 1-2 câu ngắn gọn (lý do chọn + đặc điểm nổi bật)
4. Dùng emoji nhẹ nhàng (1-2 emoji/món)
5. Tổng độ dài: TỐI ĐA 300-400 từ
6. **KHÔNG giải thích** về số lượng món trong menu (ví dụ: "do menu chỉ có 1 món...")
7. **QUAN TRỌNG**: KẾT THÚC bằng [SUGGESTED_DISH_IDS: ...] với **số thứ tự món** (1, 2, 3...), KHÔNG phải ID

Ví dụ (nếu gợi ý món số 1, 3, 5 trong menu):
"
Chào ${guestName || 'bạn'}! 

🍜 **Món số 1** - Lý do ngắn gọn
🍲 **Món số 3** - Phù hợp vì...
🥘 **Món số 5** - Đặc biệt...

[SUGGESTED_DISH_IDS: 1,3,5]
"

Trả lời ngắn gọn, đủ ý:`
}

export function getSpicyEmoji(level: number): string {
  const emojis = ['😊', '🌶️', '🌶️🌶️', '🌶️🌶️🌶️']
  return emojis[level] || emojis[0]
}

// Tìm kiếm món ăn dựa trên keywords và AI analysis
export async function searchDishes(
  message: string,
  guestContext: GuestContext,
  aiAnalysis?: {
    keywords: string[]
    dishType?: string
    spicyLevel?: number
    dietaryPreference?: string
    priceRange?: string
    category?: string
    isGenericQuestion: boolean
  }
): Promise<DishWithDetails[]> {
  // Xây dựng điều kiện tìm kiếm
  const whereConditions: any = {
    status: 'Active'
  }

  const andConditions: any[] = []
  const orConditions: any[] = []

  console.log('🎯 Using AI-extracted keywords:', aiAnalysis?.keywords)

  // ========== 1. ALLERGY (BẮT BUỘC - AND) ==========
  // Loại bỏ món có allergen - Ưu tiên cao nhất - dị ứng
  if (guestContext.allergyInfo) {
    const allergens = guestContext.allergyInfo.split(',').map((a) => a.trim())

    const allergyConditions = allergens.map((allergen) => ({
      dishIngredients: {
        none: {
          ingredient: {
            allergenType: { contains: allergen }
          }
        }
      }
    }))

    andConditions.push(...allergyConditions)
  }

  // ========== 2. SPICY LEVEL (ƯU TIÊN AI - AND) ==========
  // Chỉ dùng AI analysis, BỎ manual parsing để tránh conflict
  if (aiAnalysis?.spicyLevel !== undefined && aiAnalysis?.spicyLevel !== null) {
    if (aiAnalysis.spicyLevel === 0) {
      // Không cay hoặc ít cay
      andConditions.push({ spicyLevel: { lte: 1 } })
    } else {
      // Cay vừa, rất cay
      andConditions.push({ spicyLevel: { equals: aiAnalysis.spicyLevel } })
    }
  }

  // ========== 3. DIETARY PREFERENCE (ƯU TIÊN AI - OR) ==========
  // Priority: AI analysis > Guest profile
  if (aiAnalysis?.dietaryPreference) {
    // AI đã phân tích được từ message
    orConditions.push({ dietaryTags: { contains: aiAnalysis.dietaryPreference } })
  } else if (guestContext.dietaryPreferences && !aiAnalysis?.isGenericQuestion) {
    // Fallback: Dùng guest profile nếu AI không phân tích được
    // VÀ không phải câu hỏi chung chung
    const prefs = guestContext.dietaryPreferences.toLowerCase().split(',')
    prefs.forEach((pref) => {
      orConditions.push({ dietaryTags: { contains: pref.trim() } })
    })
  }

  // ========== 4. CATEGORY (AI - OR) ==========
  if (aiAnalysis?.category) {
    orConditions.push({ category: { name: { contains: aiAnalysis.category } } })
  }

  // ========== 5. TEXT SEARCH (OR) ==========
  // Sử dụng AI-extracted keywords, fallback to manual extraction
  let searchWords: string[] = []

  if (aiAnalysis && aiAnalysis.keywords.length > 0) {
    searchWords = aiAnalysis.keywords
  } else {
    // Fallback: extract từ message
    const stopWords = ['món', 'các', 'cho', 'tôi', 'ở', 'đây', 'giới', 'thiệu', 'gợi', 'ý', 'nhà', 'hàng']
    searchWords = message
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 2)
      .filter((word) => !stopWords.includes(word))
  }

  if (searchWords.length > 0) {
    const textSearchOr = searchWords.flatMap((word) => [
      { name: { contains: word } },
      { description: { contains: word } },
      { searchKeywords: { contains: word } }
    ])

    orConditions.push(...textSearchOr)
  }

  // ========== 6. XÂY DỰNG WHERE CONDITIONS ==========
  if (andConditions.length > 0) {
    whereConditions.AND = andConditions
  }

  if (orConditions.length > 0) {
    // Remove duplicate conditions bằng JSON stringify
    const uniqueOr = Array.from(new Set(orConditions.map((c) => JSON.stringify(c)))).map((c) => JSON.parse(c))

    if (whereConditions.AND) {
      whereConditions.AND.push({ OR: uniqueOr })
    } else {
      whereConditions.OR = uniqueOr
    }
  }

  console.log('🔍 Search conditions:', JSON.stringify(whereConditions, null, 2))

  // ========== 7. QUERY DISHES VỚI MENU ITEMS ==========
  // Chỉ lấy món có trong menu đang active
  const finalWhereConditions = {
    ...whereConditions,
    menuItems: {
      some: {
        menu: { isActive: true },
        status: 'Available'
      }
    }
  }

  let dishes = await prisma.dish.findMany({
    where: finalWhereConditions,
    include: {
      category: true,
      dishIngredients: {
        include: {
          ingredient: true
        }
      },
      menuItems: {
        where: {
          menu: { isActive: true },
          status: 'Available'
        },
        include: {
          menu: true
        }
      }
    },
    orderBy: [{ popularity: 'desc' }, { createdAt: 'desc' }],
    take: 10 // Lấy tối đa 10 món để AI xử lý
  })

  console.log(`✅ Found ${dishes.length} dishes from active menu`)

  // 🎯 FALLBACK STRATEGY: Nếu không tìm thấy món nào
  if (dishes.length === 0) {
    console.warn('⚠️ No dishes found, using fallback strategy')

    // Strategy 1: Nếu có dietary preference từ guest profile → tìm theo đó
    if (guestContext.dietaryPreferences) {
      dishes = await prisma.dish.findMany({
        where: {
          status: 'Active',
          dietaryTags: { contains: guestContext.dietaryPreferences.split(',')[0] },
          menuItems: {
            some: {
              menu: { isActive: true },
              status: 'Available'
            }
          }
        },
        include: {
          category: true,
          dishIngredients: { include: { ingredient: true } },
          menuItems: {
            where: {
              menu: { isActive: true },
              status: 'Available'
            },
            include: { menu: true }
          }
        },
        orderBy: [{ popularity: 'desc' }],
        take: 10
      })
    }

    // Strategy 2: Nếu vẫn không có hoặc câu hỏi chung chung → top popular dishes
    if (dishes.length === 0 || aiAnalysis?.isGenericQuestion) {
      console.log('🌟 Returning top popular dishes from active menu')
      dishes = await prisma.dish.findMany({
        where: {
          status: 'Active',
          menuItems: {
            some: {
              menu: { isActive: true },
              status: 'Available'
            }
          }
        },
        include: {
          category: true,
          dishIngredients: { include: { ingredient: true } },
          menuItems: {
            where: {
              menu: { isActive: true },
              status: 'Available'
            },
            include: { menu: true }
          }
        },
        orderBy: [{ popularity: 'desc' }, { createdAt: 'desc' }],
        take: 10
      })
    }
  }

  return dishes
}

// Extract dish IDs từ response của AI
export function extractSuggestedDishIds(response: string): number[] {
  const match = response.match(/\[SUGGESTED_DISH_IDS:\s*([\d,\s]+)\]/)
  if (match) {
    return match[1]
      .split(',')
      .map((id) => parseInt(id.trim()))
      .filter((id) => !isNaN(id))
  }
  return []
}

// Phát hiện intent đơn giản
export function detectIntent(message: string): string {
  const lower = message.toLowerCase()

  if (lower.includes('gọi nhân viên') || lower.includes('cần hỗ trợ')) {
    return 'call_staff'
  }
  if (lower.includes('order') || lower.includes('đặt món') || lower.includes('gọi món')) {
    return 'order_dish'
  }
  if (lower.includes('giá') || lower.includes('bao nhiêu tiền')) {
    return 'ask_price'
  }
  if (lower.includes('phổ biến') || lower.includes('bán chạy')) {
    return 'popular_dishes'
  }

  return 'search_dish'
}

// Main function xử lý chat
export async function handleMessage(message: string, guestId: number, sessionId: string) {
  const startTime = Date.now()

  try {
    // 1. Lấy thông tin guest
    const guest = await prisma.guest.findUnique({
      where: { id: guestId },
      select: {
        dietaryPreferences: true,
        allergyInfo: true,
        name: true
      }
    })

    const guestContext: GuestContext = {
      dietaryPreferences: guest?.dietaryPreferences,
      allergyInfo: guest?.allergyInfo
    }
    console.log(guestContext)

    // 2. Phát hiện intent
    const intent = detectIntent(message)

    // Xử lý intent đặc biệt
    if (intent === 'call_staff') {
      await createGuestCall(guestId)
      const response = 'Đã gọi nhân viên! Chúng tôi sẽ đến hỗ trợ bạn ngay. 🔔'
      await saveChatHistory({
        sessionId,
        guestId,
        message,
        response,
        intent,
        responseTimeMs: Date.now() - startTime
      })
      return { response, suggestedDishes: [] }
    }

    // 3. Phân tích ý định bằng AI
    const aiAnalysis = await analyzeUserIntent(message)
    console.log('🎯 AI Analysis Result:', aiAnalysis)

    // 4. Tìm kiếm món ăn với AI analysis
    const dishes = await searchDishes(message, guestContext, aiAnalysis)
    console.log(
      `Found ${dishes.length} dishes:`,
      dishes.map((d) => d.name)
    )
    if (dishes.length === 0) {
      const response =
        'Xin lỗi, hiện tại chúng tôi không có món ăn phù hợp. Bạn có thể thử tìm kiếm khác hoặc gọi nhân viên hỗ trợ không? 😊'
      await saveChatHistory({
        sessionId,
        guestId,
        message,
        response,
        intent,
        responseTimeMs: Date.now() - startTime
      })
      return { response, suggestedDishes: [] }
    }

    // 5. Tạo prompt và gọi Gemini API
    const prompt = buildPrompt(message, guestContext, dishes, guest?.name)
    let aiResponse = (await generateResponse(prompt)) as string
    console.log('aiResponse:', aiResponse)

    // 6. Extract dish indices và map sang IDs thực
    const suggestedIndices = extractSuggestedDishIds(aiResponse) // Extract indices (1, 2, 3...)
    const suggestedDishIds = suggestedIndices
      .map((index) => dishes[index - 1]?.id) // Map index to actual dish ID
      .filter((id) => id !== undefined) as number[]

    // Remove the SUGGESTED_DISH_IDS line from response
    aiResponse = aiResponse.replace(/\[SUGGESTED_DISH_IDS:.*?\]/g, '').trim()

    // 7. Lưu vào database
    await saveChatHistory({
      sessionId,
      guestId,
      message,
      response: aiResponse,
      intent,
      suggestedDishes: suggestedDishIds,
      responseTimeMs: Date.now() - startTime,
      aiTokensUsed: aiResponse.length // Estimate
    })
    console.log('dishes', dishes)
    // 8. Return response với dishes (map price từ MenuItem)
    const suggestedDishes = dishes
      .filter((d) => suggestedDishIds.includes(d.id))
      .map((dish) => {
        // Lấy giá từ MenuItem trong menu đang active
        const activeMenuItem = dish.menuItems?.find((mi) => mi.menu.isActive && mi.status === 'Available')
        const currentPrice = activeMenuItem?.price || dish.price

        return {
          ...dish,
          price: currentPrice // Override price với giá từ menu
        }
      })
    console.log('suggestedDishes', suggestedDishes)
    return {
      response: aiResponse,
      suggestedDishes
    }
  } catch (error) {
    console.error('Chatbot error:', error)

    const fallbackResponse = 'Xin lỗi, tôi đang gặp chút vấn đề. Bạn có thể thử lại hoặc gọi nhân viên hỗ trợ không? 🙏'

    await saveChatHistory({
      sessionId,
      guestId,
      message,
      response: fallbackResponse,
      intent: 'error',
      responseTimeMs: Date.now() - startTime
    })

    return {
      response: fallbackResponse,
      suggestedDishes: []
    }
  }
}

export async function saveChatHistory(data: {
  sessionId: string
  guestId: number
  message: string
  response: string
  intent: string
  suggestedDishes?: number[]
  responseTimeMs: number
  aiTokensUsed?: number
}) {
  await prisma.chatHistory.create({
    data: {
      sessionId: data.sessionId,
      guestId: data.guestId,
      message: data.message,
      response: data.response,
      intent: data.intent,
      suggestedDishes: data.suggestedDishes ? JSON.stringify(data.suggestedDishes) : null,
      responseTimeMs: data.responseTimeMs,
      aiTokensUsed: data.aiTokensUsed
    }
  })
}

export async function createGuestCall(guestId: number) {
  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    select: { tableNumber: true }
  })

  if (guest?.tableNumber) {
    await prisma.guestCall.create({
      data: {
        guestId,
        tableNumber: guest.tableNumber,
        status: 'Pending'
      }
    })
  }
}

export async function getListMessageFromGuest(userId: number) {
  const guestSession = await prisma.guest.findFirst({
    where: { id: userId },
    select: {
      tableSessionId: true,
      id: true
    }
  })
  const messages = await prisma.chatHistory.findMany({
    where: { guestId: userId, sessionId: String(guestSession?.tableSessionId) },
    orderBy: { createdAt: 'asc' }
  })
  return {
    guestSession,
    messages
  }
}
