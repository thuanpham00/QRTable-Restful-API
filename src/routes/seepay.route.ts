import { FastifyInstance, FastifyPluginOptions } from 'fastify'
import { handleSepayWebhook } from '@/controllers/payment.controller'
import {
  SepayWebhookBody,
  SepayWebhookBodyType,
  SepayWebhookRes,
  SepayWebhookResType
} from '@/schemaValidations/payment.schema'

export default async function sepayRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  // POST /api/payments/sepay/webhook - Webhook từ SePay (PUBLIC - không cần auth)
  fastify.post<{
    Body: SepayWebhookBodyType
    Reply: SepayWebhookResType
  }>(
    '/webhook',
    {
      schema: {
        response: {
          200: SepayWebhookRes
        },
        body: SepayWebhookBody
      }
    },
    async (request, reply) => {
      try {
        const result = await handleSepayWebhook(request.body, fastify.io)
        request.log.info({ webhookData: request.body, result }, '[SePay Webhook] Processed')
        reply.send(result as SepayWebhookResType)
      } catch (error) {
        request.log.error(error, '[SePay Webhook] Error')
        reply.send({
          success: false,
          message: error instanceof Error ? error.message : 'Internal server error'
        })
      }
    }
  )
}
