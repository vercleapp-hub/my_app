import { createClient } from '@supabase/supabase-js'

// 🔴 حط بياناتك من Supabase هنا
const supabase = createClient(
  'https://auwnsxmdksplftccysqu.supabase.co',
  'sb_publishable_sCsVKIE6tLVRgNnIRHzKSw_T5iQntHi'
)

export default async function handler(req, res) {
  try {
    const text = req.query.text || "hello"

    const { data, error } = await supabase
      .from('messages')
      .insert([{ text }])
      .select()

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      })
    }

    return res.status(200).json({
      success: true,
      data
    })

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    })
  }
}