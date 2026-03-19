const { supabase } = require('./_supabase');

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  
  const { user_id } = req.query;
  if(!user_id) return res.status(400).json({ error: 'user_id is required' });

  const { data: wallet, error } = await supabase.from('wallets').select('balance').eq('user_id', user_id).single();
  
  if (error && error.code !== 'PGRST116') {
      return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ success: true, balance: wallet ? wallet.balance : 0 });
}
