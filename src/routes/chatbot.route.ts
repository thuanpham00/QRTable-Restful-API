import { FastifyInstance, FastifyPluginOptions } from 'fastify'
import {
  ChatBody,
  ChatBodyType,
  ChatbotQuery,
  ChatbotQueryType,
  ChatRes,
  ChatResType,
  ChatStoryAllGuestsListRes,
  ChatStoryAllGuestsListResType,
  ChatStoryListRes,
  ChatStoryListResType
} from '@/schemaValidations/chatbot.schema'
import { requireEmployeeHook, requireGuestHook, requireLoginedHook, requireOwnerHook } from '@/hooks/auth.hooks'
import { TokenPayload } from '@/types/jwt.types'
import { getListMessageAllGuests, getListMessageFromGuest, handleMessage } from '@/controllers/chatbot/main.controller'

export default async function chatbotRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  // Chat với AI chatbot tư vấn món ăn
  fastify.post<{
    Body: ChatBodyType
    Reply: ChatResType
  }>(
    '/chat',
    {
      schema: {
        body: ChatBody,
        response: {
          200: ChatRes
        }
      },
      preValidation: fastify.auth([requireLoginedHook, requireGuestHook], {
        relation: 'and'
      })
    },
    async (request, reply) => {
      const { content, guestId, sessionId } = request.body

      const result = await handleMessage(content, guestId, sessionId)

      reply.send({
        data: {
          response: result.response,
          suggestedDishes: result.dishes
        },
        message: 'Chat thành công'
      })
    }
  )

  fastify.get<{
    Reply: ChatStoryListResType
  }>(
    '/messages',
    {
      schema: {
        response: {
          200: ChatStoryListRes
        }
      },
      preValidation: fastify.auth([requireLoginedHook, requireGuestHook], {
        relation: 'and'
      })
    },
    async (request, reply) => {
      const { userId } = request.decodedAccessToken as TokenPayload

      const data = await getListMessageFromGuest(userId)
      reply.send({
        data: data as ChatStoryListResType['data'],
        message: 'Lấy lịch sử chat thành công'
      })
    }
  )

  fastify.get<{
    Reply: ChatStoryAllGuestsListResType
    Querystring: ChatbotQueryType
  }>(
    '/list-message',
    {
      schema: {
        response: {
          200: ChatStoryAllGuestsListRes
        },
        querystring: ChatbotQuery
      },
      preValidation: fastify.auth([requireLoginedHook, [requireOwnerHook, requireEmployeeHook]], {
        relation: 'and'
      })
    },
    async (request, reply) => {
      const { data, pagination } = await getListMessageAllGuests({
        page: request.query.page || 1,
        limit: request.query.limit || 5
      })
      reply.send({
        data: data as ChatStoryAllGuestsListResType['data'],
        message: 'Lấy danh sách lịch sử chat thành công',
        pagination
      })
    }
  )
}
