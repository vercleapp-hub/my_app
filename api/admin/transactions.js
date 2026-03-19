const { supabase } = require('../_supabase');

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { data: transactions, error } = await supabase.from('transactions').select('*').order('created_at', { ascending: false });
    if(error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, transactions });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    if(!id) return res.status(400).json({ error: 'Missing ID' });
    
    // Deleting associated invoice first due to foreign key constraint
    await supabase.from('invoices').delete().eq('transaction_id', id);
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    
    if(error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
