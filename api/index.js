const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://auwnsxmdksplftccysqu.supabase.co', 
  process.env.SUPABASE_ANON_KEY || 'sb_publishable_sCsVKIE6tLVRgNnIRHzKSw_T5iQntHi'
);

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  let endpoint = req.query.match || req.query.action;
  if (Array.isArray(endpoint)) endpoint = endpoint.join('/');
  
  if (!endpoint) {
    let p = req.url.split('?')[0];
    if (p.startsWith('/api/')) p = p.substring(5);
    if (p === 'index.js' || p === 'index') p = '';
    endpoint = p;
  }

  const method = req.method;

  try {
    if (endpoint === 'login' && method === 'POST') {
      const { identifier, password } = req.body;
      const { data: user } = await supabase.from('custom_users').select('*').or(`email.eq.${identifier},phone.eq.${identifier}`).single();
      if (!user) {
        if (identifier === 'admin@drpay.com' || identifier === '0000') {
          if (password === 'admin') {
              const { data: newUser, error } = await supabase.from('custom_users').insert({ name: 'الإدارة', phone: '0000', email: 'admin@drpay.com', password, role: 'admin' }).select().single();
              if (error) throw error;
              return res.status(200).json({ success: true, user: newUser, token: 'admin-token' });
          }
        }
        return res.status(401).json({ error: 'عفواً، الهاتف أو كلمة المرور غير صحيحة' });
      }
      if (user.password !== password) return res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
      if (user.status !== 'active') return res.status(403).json({ error: 'حسابك محظور من الإدارة' });
      
      // ===== DEVICE & LOCATION VERIFICATION =====
      const { device_id, location, device_info } = req.body;
      if (!device_id || !location) return res.status(403).json({ error: 'البيانات الأمنية والموقع الجغرافي إلزامية للمتابعة.' });
      
      const { data: userDevices } = await supabase.from('devices').select('id, device_fingerprint').eq('user_id', user.id);
      let isKnown = userDevices && userDevices.some(d => d.device_fingerprint === device_id);
      if (!isKnown) {
          if (userDevices && userDevices.length >= 2) return res.status(403).json({ error: 'مرفوض: حسابك مربوط بالحد الأقصى المسموح به من الأجهزة (2 جهاز). يرجى مراجعة الإدارة.' });
          await supabase.from('devices').insert({ user_id: user.id, device_fingerprint: device_id, device_info, location });
      } else {
          await supabase.from('devices').update({ location, device_info, created_at: new Date().toISOString() }).eq('user_id', user.id).eq('device_fingerprint', device_id);
      }
      // ==========================================

      const token = crypto.randomUUID ? crypto.randomUUID() : 'session-'+Date.now();
      await supabase.from('sessions').insert({ user_id: user.id, session_id: token });
      await supabase.from('activity_logs').insert({ user_id: user.id, action: 'تحديد موقع الدخول', details: `نظام: ${device_info?.platform||'مجهول'} (RAM:${device_info?.memory||'-'}GB) إحداثيات: ${location.lat},${location.lng}` });
      return res.status(200).json({ success: true, user, token });
    }

    if (endpoint === 'register' && method === 'POST') {
      const { name, phone, email, password, national_id, address, id_front_image, id_back_image, device_id, location, device_info } = req.body;
      
      if (!device_id || !location) return res.status(403).json({ error: 'صلاحية الموقع الجغرافي إجبارية لأسباب أمنية.' });

      const { data: existing } = await supabase.from('custom_users').select('id').or(`email.eq.${email},phone.eq.${phone},national_id.eq.${national_id}`).single();
      if (existing) return res.status(400).json({ error: 'رقم الهاتف أو الرقم القومي مسجل من قبل في النظام' });
      
      const { data: user, error } = await supabase.from('custom_users').insert({ 
          name, phone, email, password, role: 'user',
          national_id, address, id_front_image, id_back_image
      }).select().single();
      if (error) throw error;
      
      await supabase.from('devices').insert({ user_id: user.id, device_fingerprint: device_id, device_info, location });

      const token = crypto.randomUUID ? crypto.randomUUID() : 'session-'+Date.now();
      await supabase.from('sessions').insert({ user_id: user.id, session_id: token });
      await supabase.from('activity_logs').insert({ user_id: user.id, action: 'مستخدم جديد', details: `تسجيل بصلاحية أمنية، نظام: ${device_info?.platform||'مجهول'} إحداثيات: ${location.lat},${location.lng}` });
      return res.status(200).json({ success: true, user, token });
    }

    if (endpoint === 'me' && method === 'GET') {
      const { user_id } = req.query;
      const { data: wallet, error } = await supabase.from('wallets').select('balance').eq('user_id', user_id).single();
      return res.status(200).json({ success: true, balance: wallet ? wallet.balance : 0 });
    }

    if (endpoint === 'pay' && method === 'POST') {
      const { name, phone, service_id, amount, service_data } = req.body;
      let { data: user } = await supabase.from('custom_users').select('id').eq('phone', phone).single();
      const { data: service } = await supabase.from('services').select('name, price').eq('id', service_id).single();
      if (!service) return res.status(400).json({ error: 'الخدمة غير متوفرة' });
      const total = Number(service.price);

      const { data: wallet } = await supabase.from('wallets').select('*').eq('user_id', user.id).single();
      if (!wallet || Number(wallet.balance) < total) {
          return res.status(400).json({ error: 'الرصيد غير كاف، يرجى إيداع أموال في المحفظة أولاً.' });
      }
      await supabase.from('wallets').update({ balance: Number(wallet.balance) - total }).eq('user_id', user.id);

      const invoice_no = 'INV-2026-' + Math.floor(10000 + Math.random() * 90000);
      const { data: tx, error: txError } = await supabase.from('transactions').insert({
          invoice_no, user_id: user.id, service_id, service_name: service.name,
          customer_name: name, customer_phone: phone, service_data,
          amount: total, total, status: 'paid', payment_company: 'مدفوعات النظام', paid_at: new Date().toISOString()
      }).select().single();
      if (txError) throw txError;

      await supabase.from('invoices').insert({ transaction_id: tx.id, invoice_number: invoice_no });
      await supabase.from('activity_logs').insert({ user_id: user.id, action: 'عملية دفع', details: `دفع ${total} ج.م لخدمة ${service.name} (مرجع: ${invoice_no})` });

      return res.status(200).json({ success: true, invoice_no });
    }

    if (endpoint === 'transactions' && method === 'GET') {
      const { user_id } = req.query;
      let q = supabase.from('transactions').select('*').order('created_at', { ascending: false });
      if (user_id) q = q.eq('user_id', user_id);
      const { data, error } = await q;
      if (error) throw error;
      return res.status(200).json({ success: true, transactions: data });
    }

    if (endpoint === 'approve' && method === 'POST') {
      const { transaction_id, status } = req.body;
      await supabase.from('transactions').update({ status, paid_at: new Date().toISOString() }).eq('id', transaction_id);
      return res.status(200).json({ success: true });
    }

    if (endpoint === 'deposits' && method === 'GET') {
      const { data, error } = await supabase.from('deposit_methods').select('*').eq('is_active', true);
      if (error) throw error;
      return res.status(200).json({ success: true, methods: data });
    }

    if (endpoint === 'deposits' && method === 'POST') {
      const { user_id, method_id, amount, transfer_ref, transfer_image } = req.body;
      if (!user_id || !method_id || !amount) return res.status(400).json({ error: 'معلومات غير مكتملة' });
      await supabase.from('deposit_requests').insert({ user_id, method_id, amount, transfer_ref, transfer_image });
      await supabase.from('activity_logs').insert({ user_id, action: 'طلب إيداع', details: `تم طلب شحن بقيمة ${amount} ج.م` });
      return res.status(200).json({ success: true, message: 'تم إرسال طلب الشحن بنجاح للمراجعة' });
    }

    if (endpoint === 'wallet' && method === 'POST') {
      const { user_id, amount } = req.body;
      const { data: wallet } = await supabase.from('wallets').select('*').eq('user_id', user_id).single();
      let newBalance = Number(amount);
      if (wallet) {
          newBalance += Number(wallet.balance);
          await supabase.from('wallets').update({ balance: newBalance, updated_at: new Date().toISOString() }).eq('user_id', user_id);
      } else {
          await supabase.from('wallets').insert({ user_id, balance: newBalance });
      }
      return res.status(200).json({ success: true });
    }

    if (endpoint === 'logs' && method === 'GET') {
      const { data, error } = await supabase.from('activity_logs').select('*, custom_users(name)').order('created_at', { ascending: false }).limit(200);
      return res.status(200).json({ success: true, logs: data || [] });
    }

    if (endpoint === 'admin/stats' && method === 'GET') {
      const { count: totalUsers } = await supabase.from('custom_users').select('*', { count: 'exact', head: true });
      const { data: txs } = await supabase.from('transactions').select('total, status, created_at');
      const totalTransactions = txs ? txs.length : 0;
      const revenue = txs ? txs.filter(t => t.status === 'paid').reduce((sum, t) => sum + Number(t.total), 0) : 0;
      const today = new Date(); today.setHours(0,0,0,0);
      const dailyTx = txs ? txs.filter(t => new Date(t.created_at) >= today).length : 0;
      return res.status(200).json({ success: true, stats: { totalUsers, totalTransactions, revenue, dailyTx } });
    }

    if (endpoint === 'admin/settings' && method === 'GET') {
      const { data } = await supabase.from('settings').select('*').eq('key', 'system_settings').single();
      return res.status(200).json({ success: true, settings: data?.value || {} });
    }
    if (endpoint === 'admin/settings' && method === 'POST') {
      await supabase.from('settings').upsert({ key: 'system_settings', value: req.body.settings }, { onConflict: 'key' });
      return res.status(200).json({ success: true });
    }

    if (endpoint === 'admin/users' && method === 'GET') {
      const { data } = await supabase.from('custom_users').select('*, wallets(balance)').order('created_at', { ascending: false });
      return res.status(200).json({ success: true, users: data });
    }
    if (endpoint === 'admin/users' && method === 'POST') {
      await supabase.from('custom_users').update({ status: req.body.status, role: req.body.role || 'user' }).eq('id', req.body.id);
      return res.status(200).json({ success: true });
    }
    if (endpoint === 'admin/devices' && method === 'DELETE') {
      await supabase.from('devices').delete().eq('user_id', req.body.user_id);
      return res.status(200).json({ success: true, message: 'تم إعادة تعيين أجهزة المستخدم' });
    }

    if (endpoint === 'admin/services' && method === 'GET') {
      const { data } = await supabase.from('services').select('*').order('id', { ascending: true });
      return res.status(200).json({ success: true, services: data });
    }
    if (endpoint === 'admin/services' && method === 'POST') {
      const { id, name, price, company } = req.body;
      if (id) await supabase.from('services').update({ name, price, company }).eq('id', id);
      else await supabase.from('services').insert({ name, price, company });
      return res.status(200).json({ success: true });
    }
    if (endpoint === 'admin/services' && method === 'DELETE') {
      await supabase.from('services').delete().eq('id', req.body.id);
      return res.status(200).json({ success: true });
    }

    if (endpoint === 'admin/deposit_methods' && method === 'GET') {
      const { data } = await supabase.from('deposit_methods').select('*').order('created_at', { ascending: false });
      return res.status(200).json({ success: true, methods: data });
    }
    if (endpoint === 'admin/deposit_methods' && method === 'POST') {
      const { id, name, account_number, details, is_active } = req.body;
      if (id) await supabase.from('deposit_methods').update({ name, account_number, details, is_active }).eq('id', id);
      else await supabase.from('deposit_methods').insert({ name, account_number, details, is_active });
      return res.status(200).json({ success: true });
    }
    if (endpoint === 'admin/deposit_methods' && method === 'DELETE') {
      await supabase.from('deposit_methods').delete().eq('id', req.body.id);
      return res.status(200).json({ success: true });
    }

    if (endpoint === 'admin/deposits' && method === 'GET') {
      const { data } = await supabase.from('deposit_requests').select('*, custom_users(name, phone), deposit_methods(name, account_number)').order('created_at', { ascending: false });
      return res.status(200).json({ success: true, requests: data });
    }
    if (endpoint === 'admin/deposits' && method === 'POST') {
      const { id, status } = req.body;
      const { data: request } = await supabase.from('deposit_requests').select('*').eq('id', id).single();
      if (!request || request.status !== 'pending') return res.status(400).json({ error: 'تمت مراجعة هذا الطلب مسبقاً' });
      
      await supabase.from('deposit_requests').update({ status, reviewed_at: new Date().toISOString() }).eq('id', id);
      if(status === 'approved') {
          const { data: wallet } = await supabase.from('wallets').select('*').eq('user_id', request.user_id).single();
          let newBalance = Number(request.amount) + (wallet ? Number(wallet.balance) : 0);
          if (wallet) await supabase.from('wallets').update({ balance: newBalance }).eq('user_id', request.user_id);
          else await supabase.from('wallets').insert({ user_id: request.user_id, balance: newBalance });
          await supabase.from('activity_logs').insert({ user_id: request.user_id, action: 'إيداع معتمد', details: `تم اعتماد مبلغ ${request.amount} ج.م` });
      }
      return res.status(200).json({ success: true });
    }

    if (endpoint === 'admin/branches' && method === 'GET') {
      const { data } = await supabase.from('branches').select('*').order('created_at', { ascending: false });
      return res.status(200).json({ success: true, branches: data });
    }
    if (endpoint === 'admin/branches' && method === 'POST') {
      const { id, name, location } = req.body;
      if (id) await supabase.from('branches').update({ name, location }).eq('id', id);
      else await supabase.from('branches').insert({ name, location });
      return res.status(200).json({ success: true });
    }
    if (endpoint === 'admin/branches' && method === 'DELETE') {
      await supabase.from('branches').delete().eq('id', req.body.id);
      return res.status(200).json({ success: true });
    }

    if (endpoint === 'admin/employees' && method === 'GET') {
      const { data } = await supabase.from('employees').select('*, branches(name)').order('created_at', { ascending: false });
      return res.status(200).json({ success: true, employees: data });
    }
    if (endpoint === 'admin/employees' && method === 'POST') {
      const { id, name, phone, branch_id, role } = req.body;
      if (id) await supabase.from('employees').update({ name, phone, branch_id, role }).eq('id', id);
      else await supabase.from('employees').insert({ name, phone, branch_id, role });
      return res.status(200).json({ success: true });
    }
    if (endpoint === 'admin/employees' && method === 'DELETE') {
      await supabase.from('employees').delete().eq('id', req.body.id);
      return res.status(200).json({ success: true });
    }

    if (endpoint === 'admin/transactions' && method === 'GET') {
      const { data } = await supabase.from('transactions').select('*').order('created_at', { ascending: false });
      return res.status(200).json({ success: true, transactions: data });
    }
    if (endpoint === 'admin/transactions' && method === 'DELETE') {
      const { id } = req.body;
      await supabase.from('invoices').delete().eq('transaction_id', id);
      await supabase.from('transactions').delete().eq('id', id);
      return res.status(200).json({ success: true });
    }

    if (endpoint === 'admin/create_admin' && method === 'POST') {
      const { name, phone, email, password } = req.body;
      if (!name || !phone || !email || !password) return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
      const { data: existing } = await supabase.from('custom_users').select('id').or(`email.eq.${email},phone.eq.${phone}`).single();
      if (existing) return res.status(400).json({ error: 'البريد الإلكتروني أو رقم الهاتف مسجل بالفعل' });
      const { data: newAdmin, error } = await supabase.from('custom_users').insert({ name, phone, email, password, role: 'admin', status: 'active' }).select().single();
      if (error) throw error;
      await supabase.from('activity_logs').insert({ user_id: newAdmin.id, action: 'إنشاء أدمن جديد', details: `تم إنشاء حساب إدارة جديد: ${name}` });
      return res.status(200).json({ success: true, user: newAdmin });
    }

    return res.status(404).json({ error: 'المسار غير موجود', endpoint });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'خطأ داخلي بالخادم' });
  }
}
