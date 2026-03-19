const { supabase } = require('./_supabase');

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  
  const { user_id } = req.query;
  let query = supabase.from('transactions').select('*, custom_users(name, phone), services(name, company)').order('created_at', { ascending: false });
  
  if (user_id) {
      query = query.eq('user_id', user_id);
  }

  const { data: transactions, error } = await query;

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ success: true, transactions });
}
