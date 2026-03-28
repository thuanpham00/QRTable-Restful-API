import { generateResponse } from '@/controllers/chatbot/ai.services'
import { detectIntent } from '@/controllers/chatbot/intent.services'
import { retrieveAndRankDishes } from '@/controllers/chatbot/menu-retrival.services'
import { buildPrompt } from '@/controllers/chatbot/prompt-builder.services'
import prisma from '@/database'
import { ChatbotQueryType } from '@/schemaValidations/chatbot.schema'

export async function handleMessage(message: string, guestId?: number, sessionId?: string) {
  const start = Date.now()

  try {
    const guest = guestId ? await prisma.guest.findUnique({ where: { id: guestId } }) : null

    const { intent, analysis } = await detectIntent(message)

    const dishes = await retrieveAndRankDishes(message, guest)

    const prompt = buildPrompt(message, guest, dishes)

    const aiResponse = await generateResponse(prompt)

    const dishIds = dishes.map((d: any) => d.id)

    if (sessionId) {
      await prisma.chatHistory.create({
        data: {
          sessionId,
          guestId,
          message,
          response: aiResponse,
          intent,
          extractedData: JSON.stringify(analysis),
          suggestedDishes: JSON.stringify(dishIds),
          responseTimeMs: Date.now() - start
        }
      })
    }

    return {
      response: aiResponse,
      dishes
    }
  } catch (error) {
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
