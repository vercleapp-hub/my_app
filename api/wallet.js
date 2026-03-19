const { supabase } = require('./_supabase');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const { user_id, amount } = req.body;
  
  if (!user_id || !amount) return res.status(400).json({ error: 'يجب تحديد المستخدم والمبلغ' });

  const { data: wallet } = await supabase.from('wallets').select('*').eq('user_id', user_id).single();
  
  let newBalance = Number(amount);
  
  if(!wallet) {
    // Should have been created by trigger, but fallback:
    await supabase.from('wallets').insert({ user_id, balance: newBalance });
  } else {
    newBalance += Number(wallet.balance);
    const { error } = await supabase.from('wallets').update({ balance: newBalance, updated_at: new Date().toISOString() }).eq('user_id', user_id);
    if(error) return res.status(500).json({ error: error.message });
  }

  await supabase.from('activity_logs').insert({
    user_id: user_id,
    action: 'WALLET_TOPUP',
    details: `Added ${amount} EGP to wallet. New balance: ${newBalance}`
  });

  return res.status(200).json({ success: true, new_balance: newBalance });
}
