import { FastifyInstance, FastifyPluginOptions } from 'fastify'
import { getListMessageFromGuest, handleMessage } from '@/controllers/gemini.controller'
import {
  ChatBody,
  ChatBodyType,
  ChatRes,
  ChatResType,
  ChatStoryListRes,
  ChatStoryListResType
} from '@/schemaValidations/chatbot.schema'
import { requireGuestHook, requireLoginedHook } from '@/hooks/auth.hooks'
import { TokenPayload } from '@/types/jwt.types'

export default async function geminiRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
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
      }
      // preValidation: fastify.auth([requireLoginedHook, requireGuestHook], {
      //   relation: 'and'
      // })
    },
    async (request, reply) => {
      const { content, guestId, sessionId } = request.body

      const result = await handleMessage(content, guestId, sessionId)

      reply.send({
        data: {
          response: result.response,
          suggestedDishes: result.suggestedDishes
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
}
