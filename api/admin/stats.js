const { supabase } = require('../_supabase');

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { count: totalUsers } = await supabase.from('custom_users').select('*', { count: 'exact', head: true });
    
    const { data: txs } = await supabase.from('transactions').select('total, status, created_at');
    const totalTransactions = txs ? txs.length : 0;
    const revenue = txs ? txs.filter(t => t.status === 'paid').reduce((sum, t) => sum + Number(t.total), 0) : 0;

    const today = new Date(); today.setHours(0,0,0,0);
    const dailyTx = txs ? txs.filter(t => new Date(t.created_at) >= today).length : 0;
    
    return res.status(200).json({ success: true, stats: { totalUsers, totalTransactions, revenue, dailyTx } });
  }
  res.status(405).json({ error: 'Method Not Allowed' });
}
