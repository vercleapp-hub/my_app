const { supabase } = require('./_supabase');
const crypto = require('crypto');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const { name, phone, email, password } = req.body;
  
  if (!phone || !email || !password || !name) {
      return res.status(400).json({ error: 'جميع الحقول مطلوبة.' });
  }

  // Check if exists
  const { count } = await supabase.from('custom_users').select('*', { count: 'exact', head: true }).or(`email.eq.${email},phone.eq.${phone}`);
  if(count > 0) return res.status(400).json({ error: 'البريد الإلكتروني أو رقم الهاتف مستخدم بالفعل.' });

  const { data: newUser, error } = await supabase.from('custom_users').insert({
      name, phone, email, password, role: 'user'
  }).select().single();

  if (error) return res.status(500).json({ error: error.message });

  // Generate session
  const sessionId = crypto.randomUUID();
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';

  await supabase.from('sessions').insert({
    user_id: newUser.id,
    session_id: sessionId,
    ip_address: ip,
    user_agent: req.headers['user-agent']
  });

  await supabase.from('activity_logs').insert({
    user_id: newUser.id,
    ip_address: ip,
    action: 'USER_REGISTERED',
    details: 'New merchant account created'
  });

  return res.status(200).json({ 
    success: true, 
    token: sessionId,
    user: { id: newUser.id, name: newUser.name, phone: newUser.phone, role: newUser.role } 
  });
}
