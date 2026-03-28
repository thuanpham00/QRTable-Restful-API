import { analyzeUserIntent, type IntentAnalysis } from './ai.services'

export type Intent = 'search_dish' | 'recommend_dish' | 'filter_dish' | 'sort_dish' | 'general'

export interface DetectIntentResult {
  intent: Intent
  analysis: IntentAnalysis
}

export async function detectIntent(message: string): Promise<DetectIntentResult> {
  const analysis = await analyzeUserIntent(message)

  let intent: Intent = 'general'

  // sort intent có độ ưu tiên cao nhất (đắt nhất, rẻ nhất, v.v.)
  if (analysis.sortBy) {
    intent = 'sort_dish'
  } else if (analysis.filterBy || analysis.dietaryPreference || analysis.spicyLevel !== null) {
    intent = 'filter_dish'
  } else if (analysis.keywords?.length > 0) {
    intent = 'search_dish'
  } else if (analysis.isGenericQuestion) {
    intent = 'recommend_dish'
  }

  return { intent, analysis }
}
