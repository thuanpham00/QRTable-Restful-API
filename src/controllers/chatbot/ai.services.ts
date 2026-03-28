const OLLAMA_URL = 'http://127.0.0.1:11434/api/chat'
const CHAT_MODEL = 'llama3'
const ANALYSIS_MODEL = 'llama3'
const OLLAMA_TIMEOUT_MS = 30_000

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IntentAnalysis {
  keywords: string[]
  spicyLevel: number | null // 0-3
  dietaryPreference: 'vegetarian' | 'vegan' | null
  category: string | null
  isGenericQuestion: boolean
  sortBy: 'price_desc' | 'price_asc' | 'popularity' | 'spicy_desc' | null
  filterBy: 'vegetarian' | 'vegan' | 'spicy' | null
}

// ─── AI: Analyze intent ───────────────────────────────────────────────────────

export async function analyzeUserIntent(message: string): Promise<IntentAnalysis> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS)

  try {
    const res = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: ANALYSIS_MODEL,
        messages: [
          {
            role: 'system',
            content: `
Phân tích câu hỏi khách hàng về món ăn nhà hàng.

Trả về JSON với đúng format sau, không giải thích thêm:

{
  "keywords": [],
  "spicyLevel": 0-3 hoặc null,
  "dietaryPreference": "vegetarian" | "vegan" | null,
  "category": string | null,
  "isGenericQuestion": boolean,
  "sortBy": "price_desc" | "price_asc" | "popularity" | "spicy_desc" | null,
  "filterBy": "vegetarian" | "vegan" | "spicy" | null
}

Quy tắc xác định sortBy:
- "đắt nhất", "giá cao nhất", "cao cấp nhất" → "price_desc"
- "rẻ nhất", "giá rẻ", "tiết kiệm", "bình dân" → "price_asc"
- "ngon nhất", "nổi tiếng", "phổ biến", "bán chạy", "nhiều người order" → "popularity"
- "cay nhất", "cay nhất", "nhiều gia vị" → "spicy_desc"
- Câu hỏi bình thường → null

Quy tắc xác định filterBy:
- "chay", "vegetarian", "không thịt" → "vegetarian"
- "vegan", "thuần chay" → "vegan"
- "cay", "nhiều ớt" → "spicy"
- Không đề cập → null

Chỉ trả JSON, không markdown, không giải thích.
`
          },
          { role: 'user', content: message }
        ],
        options: { temperature: 0.1, num_predict: 400 },
        stream: false
      })
    })

    const data = await res.json()
    const text: string = data.message?.content || '{}'

    // strip markdown code fences nếu model vẫn wrap
    const clean = text.replace(/```(?:json)?|```/g, '').trim()

    return JSON.parse(clean) as IntentAnalysis
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      console.error('analyzeUserIntent timeout after', OLLAMA_TIMEOUT_MS, 'ms')
    } else {
      console.error('analyzeUserIntent error:', err)
    }
    // fallback: trả về analysis rỗng, pipeline vẫn chạy được
    return {
      keywords: [],
      spicyLevel: null,
      dietaryPreference: null,
      category: null,
      isGenericQuestion: true,
      sortBy: null,
      filterBy: null
    }
  } finally {
    clearTimeout(timer)
  }
}

// ─── AI: Generate response ────────────────────────────────────────────────────

export async function generateResponse(prompt: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS)

  try {
    const res = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: [
          {
            role: 'system',
            content: 'Bạn là AI tư vấn món ăn cho nhà hàng. Chỉ gợi ý món trong menu. Trả lời bằng tiếng Việt.'
          },
          { role: 'user', content: prompt }
        ],
        options: { temperature: 0.7, num_predict: 800 },
        stream: false
      })
    })

    const data = await res.json()
    return data.message?.content || ''
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      console.error('generateResponse timeout after', OLLAMA_TIMEOUT_MS, 'ms')
      throw new Error('AI_TIMEOUT')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}
