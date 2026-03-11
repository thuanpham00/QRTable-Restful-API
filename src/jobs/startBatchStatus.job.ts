import { Cron } from 'croner'
import { updateAllBatchStatus } from '@/controllers/inventory-batch.controller'

const startBatchStatusCronJob = () => {
  Cron('0 0 * * *', async () => {
    try {
      const result = await updateAllBatchStatus()
      console.log(`✅ Updated ${result.updated}/${result.total} batches`)
    } catch (error) {
      console.error(error)
    }
  })
}

export default startBatchStatusCronJob
