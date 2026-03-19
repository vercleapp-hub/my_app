const { supabase } = require('./_supabase');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  
  const { transaction_id, status } = req.body;
  if (!transaction_id) return res.status(400).json({ error: 'Missing transaction_id' });

  const newStatus = status === 'rejected' ? 'rejected' : 'paid';

  const { data: tx, error } = await supabase
    .from('transactions')
    .update({ 
      status: newStatus, 
      paid_at: newStatus === 'paid' ? new Date().toISOString() : null,
      approved_at: new Date().toISOString()
    })
    .eq('id', transaction_id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await supabase.from('activity_logs').insert({
    user_id: tx.user_id,
    action: newStatus === 'paid' ? 'TRANSACTION_APPROVED' : 'TRANSACTION_REJECTED',
    details: `Transaction ${transaction_id} marked as ${newStatus}.`
  });

  return res.status(200).json({ success: true, transaction: tx });
}
