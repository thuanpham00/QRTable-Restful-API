import prisma from '@/database'
import { randomId } from '@/utils/helpers'
import { Cron } from 'croner'

const autoRotateTableTokenJob = () => {
  // Chạy mỗi 10 phút
  Cron('*/10 * * * *', async () => {
    try {
      console.log('[Cron] Rotating table tokens...')

      // Lấy tất cả bàn
      const tables = await prisma.table.findMany()

      // Update token cho từng bàn
      for (const table of tables) {
        const newToken = randomId() // hoặc crypto.randomBytes(32).toString('hex')

        await prisma.table.update({
          where: { number: table.number },
          data: {
            token: newToken,
            updatedAt: new Date() // Nếu có field này
          }
        })
      }

      console.log(`[Cron] Rotated tokens for ${tables.length} tables`)
    } catch (error) {
      console.error('[Cron] Error rotating table tokens:', error)
    }
  })
}

export default autoRotateTableTokenJob
