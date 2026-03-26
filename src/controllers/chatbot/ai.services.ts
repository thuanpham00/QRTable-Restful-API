const OLLAMA_URL = 'http://127.0.0.1:11434/api/chat'

const CHAT_MODEL = 'llama3'
const ANALYSIS_MODEL = 'llama3'

/*
AI GENERATE CHAT RESPONSE
*/
export async function generateResponse(prompt: string): Promise<string> {
  const res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: [
        {
          role: 'system',
          content: 'Bạn là AI tư vấn món ăn cho nhà hàng. Chỉ gợi ý món trong menu.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      options: {
        temperature: 0.7,
        num_predict: 1500
      },
      stream: false
    })
  })

  const data = await res.json()

  return data.message?.content || ''
}

/*
AI ANALYZE USER INTENT
*/
export async function analyzeUserIntent(message: string) {
  const res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: ANALYSIS_MODEL,
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

Chỉ trả JSON, không giải thích.
`
        },
        {
          role: 'user',
          content: message
        }
      ],
      options: {
        temperature: 0.1,
        num_predict: 400
      },
      stream: false
    })
  })

  const data = await res.json()

  const text = data.message?.content || '{}'

  try {
    return JSON.parse(text)
  } catch (err) {
    console.error('Parse JSON error:', text)
    return {}
  }
}
