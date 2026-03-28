import { generateResponse } from '@/controllers/chatbot/ai.services'
import { detectIntent, Intent } from '@/controllers/chatbot/intent.services'
import { retrieveAndRankDishes } from '@/controllers/chatbot/retrieve.services'
import prisma from '@/database'
import { ChatbotQueryType } from '@/schemaValidations/chatbot.schema'

function formatPrice(price: number): string {
  return price ? price.toLocaleString('vi-VN') + 'đ' : 'Liên hệ'
}

// Thêm context hướng dẫn AI sort/filter đúng ý khách
function buildSortContext(intent: Intent, sortBy: string | null): string {
  if (intent !== 'sort_dish' || !sortBy) return ''

  const hints: Record<string, string> = {
    price_desc: 'Khách muốn xem MÓN ĐẮT NHẤT. Hãy đề xuất theo thứ tự giá từ cao đến thấp.',
    price_asc: 'Khách muốn xem MÓN RẺ NHẤT. Hãy đề xuất theo thứ tự giá từ thấp đến cao.',
    popularity: 'Khách muốn xem MÓN NGON/PHỔ BIẾN NHẤT. Hãy đề xuất theo độ phổ biến.',
    spicy_desc: 'Khách muốn xem MÓN CAY NHẤT. Hãy đề xuất theo độ cay từ cao đến thấp.'
  }

  return hints[sortBy] || ''
}

export function buildPrompt(message: string, guest: any, dishes: any[], intent: Intent, sortBy: string | null): string {
  // Danh sách tên món hợp lệ — dùng để ép AI không được đặt tên khác
  const allowedNames = dishes.map((d) => `"${d.name}"`).join(', ')

  const menuContext = dishes
    .map((d, i) => {
      const ingredients = d.dishIngredients?.map((di: any) => di.ingredient.name).join(', ') || 'không rõ'
      const activePrice = getActivePrice(d)
      const allergens =
        d.dishIngredients
          ?.map((di: any) => di.ingredient.allergenType)
          .filter(Boolean)
          .join(', ') || 'không có'

      return `[${i + 1}] ${d.name}
   Giá: ${formatPrice(activePrice)}
   Danh mục: ${d.category?.name || 'không rõ'}
   Độ cay: ${d.spicyLevel ?? 0}/3
   Phổ biến: ${d.popularity ?? 0}/100
   Nguyên liệu: ${ingredients}
   Dị ứng: ${allergens}
   Mô tả: ${d.description || ''}`
    })
    .join('\n\n')

  const sortHint = buildSortContext(intent, sortBy)

  // Nếu không có món nào (retrieve trả về rỗng) → không cần gọi AI
  if (dishes.length === 0) {
    return '__NO_DISHES__'
  }

  return `Bạn là AI tư vấn món ăn cho nhà hàng. Nhiệm vụ duy nhất của bạn là chọn món từ MENU bên dưới.

=== THÔNG TIN KHÁCH HÀNG ===
Tên: ${guest?.name || 'Khách'}
Ăn kiêng: ${guest?.dietaryPreferences || 'không có'}
Dị ứng: ${guest?.allergyInfo || 'không có'}

=== MENU (CHỈ ĐƯỢC DÙNG CÁC MÓN NÀY) ===
Danh sách tên hợp lệ: ${allowedNames}

${sortHint ? `>> ${sortHint}\n` : ''}\
${menuContext}

=== CÂU HỎI KHÁCH ===
"${message}"

=== LUẬT TUYỆT ĐỐI - VI PHẠM LÀ SAI ===
1. CHỈ được nhắc đến món có tên CHÍNH XÁC trong danh sách: ${allowedNames}
2. TUYỆT ĐỐI không được đặt tên món khác, không thêm bớt chữ, không tự bịa món
3. Nếu KHÔNG có món nào phù hợp → trả lời chính xác: "Hiện tại nhà hàng chưa có món phù hợp với yêu cầu của bạn."
4. Gợi ý TỐI ĐA 3 món, mỗi món kèm 1 câu lý do ngắn
5. Trả lời hoàn toàn bằng tiếng Việt, tự nhiên, thân thiện

Trả lời:`
}

function getActivePrice(dish: any): number {
  return dish.menuItems?.[0]?.price ?? 0
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function handleMessage(message: string, guestId?: number, sessionId?: string) {
  const start = Date.now()

  try {
    // 1. Load guest info
    const guest = guestId ? await prisma.guest.findUnique({ where: { id: guestId } }) : null

    // 2. Detect intent + phân tích (1 AI call)
    const { intent, analysis } = await detectIntent(message)

    // 3. Retrieve dishes theo đúng strategy của intent
    const dishes = await retrieveAndRankDishes(message, guest, intent, analysis)

    // 4. Build prompt với context sort/filter rõ ràng
    const prompt = buildPrompt(message, guest, dishes, intent, analysis.sortBy ?? null)
    console.log(prompt)
    // 5. Nếu không có món nào → trả người dùng luôn, không gọi AI
    if (prompt === '__NO_DISHES__') {
      prisma.chatHistory
        .create({
          data: {
            sessionId: sessionId || 'no-session',
            guestId,
            message,
            response: 'Hiện tại nhà hàng chưa có món phù hợp với yêu cầu của bạn.',
            intent,
            extractedData: JSON.stringify(analysis),
            suggestedDishes: JSON.stringify([]),
            responseTimeMs: Date.now() - start
          }
        })
        .catch((err) => console.error('Save chatHistory failed:', err))
      return {
        response: 'Hiện tại nhà hàng chưa có món phù hợp với yêu cầu của bạn.',
        dishes: []
      }
    }

    // 6. Generate response (1 AI call)
    const aiResponse = await generateResponse(prompt)

    // 6. Lưu history (fire-and-forget, không block response)
    if (sessionId) {
      prisma.chatHistory
        .create({
          data: {
            sessionId,
            guestId,
            message,
            response: aiResponse,
            intent,
            extractedData: JSON.stringify(analysis),
            suggestedDishes: JSON.stringify(dishes.map((d: any) => d.id)),
            responseTimeMs: Date.now() - start
          }
        })
        .catch((err) => console.error('Save chatHistory failed:', err))
    }

    return { response: aiResponse, dishes }
  } catch (error) {
    const message_err = (error as Error).message

    // Phân biệt timeout vs lỗi khác để trả message phù hợp
    if (message_err === 'AI_TIMEOUT') {
      return {
        response: 'Hệ thống đang bận, vui lòng thử lại sau giây lát.',
        dishes: []
      }
    }

    console.error('Chatbot error:', error)
    return {
      response: 'Xin lỗi, hệ thống đang gặp sự cố.',
      dishes: []
    }
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

export async function getListMessageAllGuests({ page, limit }: ChatbotQueryType) {
  const guest = await prisma.guest.findMany({
    where: {
      tableSessionId: {
        not: null
      }
    },
    include: {
      chatHistory: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  })
  const listMessageFilter = guest
    .filter((g) => g.chatHistory.length > 0)
    .map((g) => ({
      guestId: g.id,
      guestName: g.name,
      tableSessionId: g.tableSessionId,
      messages: g.chatHistory.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    }))

  const total = listMessageFilter.length
  const skip = (page - 1) * limit
  const paginatedData = listMessageFilter.slice(skip, skip + limit)

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
