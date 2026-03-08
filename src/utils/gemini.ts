import envConfig from '@/config'
import Groq from 'groq-sdk'

const groq = new Groq({
  apiKey: envConfig.GROQ_API_KEY
})

// Main model cho chat response (Llama 3.3 70B - hiểu tiếng Việt tốt)
const CHAT_MODEL = 'llama-3.3-70b-versatile'

// Model cho phân tích intent (có thể dùng model nhỏ hơn để nhanh hơn)
const ANALYSIS_MODEL = 'llama-3.3-70b-versatile'

export async function generateResponse(prompt: string): Promise<string> {
  try {
    console.log('🤖 Calling Groq API with model:', CHAT_MODEL)

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'Bạn là AI tư vấn món ăn thông minh cho nhà hàng Việt Nam. Trả lời ngắn gọn, súc tích, thân thiện.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      model: CHAT_MODEL,
      temperature: 0.7,
      max_tokens: 2048,
      top_p: 0.95
    })

    const response = chatCompletion.choices[0]?.message?.content || ''
    console.log('✅ Groq API response received')
    return response
  } catch (error: any) {
    console.error('Groq API Error:', error)

    // Fallback response khi API lỗi
    const fallbackResponse = `Xin lỗi, tôi đang gặp chút vấn đề kỹ thuật. Tuy nhiên, tôi có thể giúp bạn:

🍽️ Xem menu món ăn
🔍 Tìm món ăn theo sở thích
🔔 Gọi nhân viên hỗ trợ

Bạn cần giúp gì không? 😊`

    return fallbackResponse
  }
}

export async function analyzeUserIntent(message: string) {
  try {
    console.log('🎯 Analyzing user intent with Groq...')

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `Bạn là AI phân tích ý định khách hàng về món ăn.

**QUAN TRỌNG - Phân biệt:**
- "cay" / "spicy" → spicyLevel (độ cay 1-3)
- "chay" / "vegetarian" → dietaryPreference: "vegetarian"

**Examples:**
- "món cay" → {"spicyLevel": 2, "dietaryPreference": null}
- "món chay" → {"dietaryPreference": "vegetarian", "spicyLevel": null}
- "món chay không cay" → {"dietaryPreference": "vegetarian", "spicyLevel": 0}
- "tôi muốn món cay" → {"spicyLevel": 2, "dietaryPreference": null}
- "có món chay nào ngon" → {"dietaryPreference": "vegetarian", "spicyLevel": null}

Trả về JSON với cấu trúc:
{
  "keywords": ["từ", "khóa", "quan", "trọng"],
  "dishType": "mon_chinh|mon_phu|trang_mieng|do_uong|null",
  "spicyLevel": 0-3 hoặc null (0=không cay, 1=ít cay, 2=cay vừa, 3=rất cay),
  "dietaryPreference": "vegetarian|vegan|gluten-free|keto|low-carb|pescatarian|null",
  "priceRange": "cheap|medium|expensive|null",
  "category": "tên danh mục|null",
  "isGenericQuestion": true nếu câu hỏi chung chung như "món gì ngon", "giới thiệu món"
}

CHỈ trả về JSON object, KHÔNG có text giải thích.`
        },
        {
          role: 'user',
          content: `Phân tích câu hỏi sau: "${message}"`
        }
      ],
      model: ANALYSIS_MODEL,
      temperature: 0.1, // Thấp để phân tích chính xác
      max_tokens: 500,
      top_p: 0.8,
      response_format: { type: 'json_object' } // ✅ Force JSON response
    })

    const jsonText = chatCompletion.choices[0]?.message?.content || '{}'
    const analysis = JSON.parse(jsonText)

    console.log('✅ Intent analysis result:', analysis)
    return analysis
  } catch (error: any) {
    console.error('❌ Groq Analysis failed, using fallback:', error)
  }
}
