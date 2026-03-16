import envConfig from '@/config'
import Groq from 'groq-sdk'

const groq = new Groq({
  apiKey: envConfig.GROQ_API_KEY
})

const CHAT_MODEL = 'llama-3.3-70b-versatile'
const ANALYSIS_MODEL = 'llama-3.3-70b-versatile'

/*
AI GENERATE CHAT RESPONSE
*/
export async function generateResponse(prompt: string): Promise<string> {
  const completion = await groq.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0.7,
    max_tokens: 1500,
    messages: [
      {
        role: 'system',
        content: 'Bạn là AI tư vấn món ăn cho nhà hàng. Chỉ gợi ý món trong menu.'
      },
      {
        role: 'user',
        content: prompt
      }
    ]
  })

  return completion.choices?.[0]?.message?.content || ''
}

/*
AI ANALYZE USER INTENT
*/
export async function analyzeUserIntent(message: string) {
  const completion = await groq.chat.completions.create({
    model: ANALYSIS_MODEL,
    temperature: 0.1,
    max_tokens: 400,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `
Phân tích câu hỏi khách hàng về món ăn.

Trả JSON:

{
"keywords": [],
"spicyLevel": 0-3 hoặc null,
"dietaryPreference": "vegetarian|vegan|null",
"category": string|null,
"isGenericQuestion": boolean
}

Chỉ trả JSON.
`
      },
      {
        role: 'user',
        content: message
      }
    ]
  })

  const text = completion.choices?.[0]?.message?.content || '{}'

  return JSON.parse(text)
}
