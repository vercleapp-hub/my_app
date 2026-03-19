const { supabase } = require('./_supabase');

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { data: methods, error } = await supabase.from('deposit_methods').select('*').eq('is_active', true);
    if(error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, methods });
  }

  if (req.method === 'POST') {
    const { user_id, method_id, amount, transfer_ref } = req.body;
    if(!user_id || !method_id || !amount) return res.status(400).json({ error: 'Missing required fields' });

    const { error } = await supabase.from('deposit_requests').insert({ user_id, method_id, amount, transfer_ref });
    if(error) return res.status(500).json({ error: error.message });
    
    await supabase.from('activity_logs').insert({ user_id, action: 'DEPOSIT_SUBMITTED', details: `Requested ${amount} EGP via Ref: ${transfer_ref || 'None'}` });
    
    return res.status(200).json({ success: true, message: 'تم إرسال طلب الشحن للمراجعة' });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
