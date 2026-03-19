const { supabase } = require('../_supabase');

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { data: users, error } = await supabase.from('custom_users').select('*, wallets(balance)').order('created_at', { ascending: false });
    if(error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, users });
  } 
  
  if (req.method === 'POST') {
    const { id, status, role } = req.body;
    if(!id) return res.status(400).json({ error: 'Missing ID' });
    const { error } = await supabase.from('custom_users').update({ status, role }).eq('id', id);
    if(error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
