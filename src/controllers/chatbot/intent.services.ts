import { analyzeUserIntent } from '@/controllers/chatbot/ai.services'

export async function detectIntent(message: string) {
  const analysis = await analyzeUserIntent(message)

  let intent = 'general'

  if (analysis.keywords?.length) {
    intent = 'search_dish'
  }

  if (analysis.isGenericQuestion) {
    intent = 'recommend_dish'
  }

  return {
    intent,
    analysis
  }
}
