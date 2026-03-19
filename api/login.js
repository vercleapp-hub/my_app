const { supabase } = require('./_supabase');
const crypto = require('crypto');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const { email, password } = req.body;
  
  if (!email || !password) return res.status(400).json({ error: 'البريد الإلكتروني وكلمة المرور مطلوبان' });

  // Auto-setup first admin if table is empty
  const { count, error: countErr } = await supabase.from('custom_users').select('*', { count: 'exact', head: true });
  if (count === 0) {
    console.log("Auto-creating first admin user.");
    await supabase.from('custom_users').insert({ 
        name: 'Admin User', 
        phone: '010000000', 
        email: 'admin@drpay.com', 
        password: 'admin', 
        role: 'admin' 
    });
  }

  // Simple query to authenticate user
  const { data: user, error } = await supabase
    .from('custom_users')
    .select('*')
    .eq('email', email)
    .single();

  if (error || !user || user.password !== password) {
    return res.status(401).json({ error: 'بيانات الدخول غير صحيحة.' });
  }

  if (user.status === 'blocked') {
     return res.status(403).json({ error: 'هذا الحساب محظور، راجع الإدارة.' });
  }

  // Generate session ID
  const sessionId = crypto.randomUUID();
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';

  await supabase.from('sessions').insert({
    user_id: user.id,
    session_id: sessionId,
    ip_address: ip,
    user_agent: req.headers['user-agent']
  });

  await supabase.from('activity_logs').insert({
    user_id: user.id,
    ip_address: ip,
    action: 'USER_LOGIN',
    details: 'User logged in successfully'
  });

  return res.status(200).json({ 
    success: true, 
    token: sessionId,
    user: { id: user.id, name: user.name, phone: user.phone, role: user.role } 
  });
}
