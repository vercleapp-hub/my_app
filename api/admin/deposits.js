const { supabase } = require('../_supabase');

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { data: requests, error } = await supabase.from('deposit_requests').select('*, custom_users(name, phone), deposit_methods(name, account_number)').order('created_at', { ascending: false });
    if(error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, requests });
  }

  if (req.method === 'POST') {
    const { id, status } = req.body; // 'approved' | 'rejected'
    if(!id || !status) return res.status(400).json({ error: 'Missing fields' });

    const { data: request, error: reqErr } = await supabase.from('deposit_requests').select('*').eq('id', id).single();
    if(reqErr || !request) return res.status(404).json({ error: 'Request not found' });
    if(request.status !== 'pending') return res.status(400).json({ error: 'Already processed' });

    const { error: updateErr } = await supabase.from('deposit_requests').update({ status, reviewed_at: new Date().toISOString() }).eq('id', id);
    if(updateErr) return res.status(500).json({ error: updateErr.message });

    if(status === 'approved') {
        const { data: wallet } = await supabase.from('wallets').select('*').eq('user_id', request.user_id).single();
        let newBalance = Number(request.amount);
        if(wallet) {
            newBalance += Number(wallet.balance);
            await supabase.from('wallets').update({ balance: newBalance, updated_at: new Date().toISOString() }).eq('user_id', request.user_id);
        } else {
            await supabase.from('wallets').insert({ user_id: request.user_id, balance: newBalance });
        }
        await supabase.from('activity_logs').insert({ user_id: request.user_id, action: 'DEPOSIT_APPROVED', details: `Admin approved ${request.amount} EGP` });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
