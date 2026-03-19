const { supabase } = require('./_supabase');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  
  const { name, phone, service_id, amount, service_data } = req.body;
  if(!phone || !service_id || !amount) {
    return res.status(400).json({ error: 'يجب ملء جميع الحقول المطلوبة' });
  }

  try {
    // 1. Check or Create User
    let userId;
    let { data: existingUsers } = await supabase.from('custom_users').select('*').eq('phone', phone).limit(1);
    
    if (existingUsers && existingUsers.length > 0) {
      userId = existingUsers[0].id;
    } else {
      const { data: newUser, error: noUserErr } = await supabase.from('custom_users')
        .insert({ name: name || 'Customer', phone })
        .select().single();
      if(noUserErr) throw noUserErr;
      userId = newUser.id;
    }

    // 2. Check Wallet
    const { data: wallet } = await supabase.from('wallets').select('*').eq('user_id', userId).single();
    if (!wallet || Number(wallet.balance) < Number(amount)) {
      return res.status(400).json({ error: 'رصيد المحفظة غير كافٍ لإتمام العملية.' });
    }

    // 3. Deduct Wallet
    await supabase.from('wallets').update({ balance: Number(wallet.balance) - Number(amount) }).eq('user_id', userId);

    // 4. Fetch Service Name
    const { data: service } = await supabase.from('services').select('*').eq('id', service_id).single();

    // 5. Generate Invoice NO (INV-2026-xxxxx)
    const randomHash = Math.floor(10000 + Math.random() * 90000);
    const invoiceNo = `INV-2026-${randomHash}`;

    // 6. Insert Transaction
    const { data: tx, error: txError } = await supabase.from('transactions').insert({
      invoice_no: invoiceNo,
      user_id: userId,
      service_id: service_id,
      service_name: service ? service.name : 'Unknown Service',
      service_data: JSON.stringify(service_data || {}),
      customer_name: name,
      customer_phone: phone,
      amount: amount,
      total: amount,
      status: 'pending',
      payment_type: 'api'
    }).select().single();

    if(txError) throw txError;

    // 7. Insert Invoice
    await supabase.from('invoices').insert({
      transaction_id: tx.id,
      invoice_number: invoiceNo
    });

    // 8. Log Activity
    await supabase.from('activity_logs').insert({
      user_id: userId,
      action: 'PAYMENT_SUBMITTED',
      details: `Paid ${amount} for ${service ? service.name : 'Service'} - Invoice ${invoiceNo}`
    });

    return res.status(200).json({ success: true, invoice_no: invoiceNo, message: 'تم إتمام الدفع وإصدار الفاتورة.' });

  } catch (error) {
    console.error('Pay API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
