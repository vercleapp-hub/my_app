import { supabase } from './supabase.js';

let adminProfile = null;

window.addEventListener('DOMContentLoaded', () => {
    checkAdmin();
    document.getElementById('admin-service-form')?.addEventListener('submit', handleServiceSubmit);
});

async function checkAdmin() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'index.html';
        return;
    }
    
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
        
    if (!profile || profile.role !== 'ADMIN') {
        alert('غير مصرح لك بالدخول لهذه الصفحة!');
        window.location.href = 'index.html';
        return;
    }
    
    adminProfile = profile;
    document.getElementById('admin-body').classList.remove('hidden');
    loadDashboardStats();
}

window.switchTab = function(tabId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.admin-tab').forEach(el => {
        el.classList.remove('bg-purple-500/20', 'text-white');
        el.classList.add('text-slate-400');
    });
    
    document.getElementById(`view-${tabId}`).classList.remove('hidden');
    const btn = document.getElementById(`tab-${tabId}`);
    btn.classList.add('bg-purple-500/20', 'text-white');
    btn.classList.remove('text-slate-400', 'hover:text-white', 'hover:bg-slate-800/50');
    
    if(tabId === 'dashboard') loadDashboardStats();
    if(tabId === 'users') loadUsers();
    if(tabId === 'services') loadAdminServices();
    if(tabId === 'transactions') loadAdminTransactions();
}

async function loadDashboardStats() {
    const { count: usersCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    const { count: pendingTxs } = await supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('status', 'PENDING');
    
    const { data: compTxs } = await supabase.from('transactions').select('amount').eq('status', 'COMPLETED');
    let totalRev = 0;
    if(compTxs) totalRev = compTxs.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
    
    document.getElementById('stat-users').textContent = usersCount || 0;
    document.getElementById('stat-pending').textContent = pendingTxs || 0;
    document.getElementById('stat-revenue').textContent = totalRev.toFixed(2);
}

async function loadUsers() {
    const { data: users } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    const tbody = document.getElementById('admin-users-list');
    tbody.innerHTML = '';
    
    if(!users) return;
    
    users.forEach(user => {
        const bal = parseFloat(user.balance).toFixed(2);
        const roleHtml = user.role === 'ADMIN' ? '<span class="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded">ADMIN</span>' : '<span class="text-xs bg-slate-500/20 text-slate-400 px-2 py-1 rounded">USER</span>';
        
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-800/30 transition-colors border-b border-slate-700/50';
        tr.innerHTML = `
            <td class="py-4 px-6 font-medium text-white">${user.full_name}</td>
            <td class="py-4 px-6 text-slate-400 text-sm" dir="ltr">${user.email}</td>
            <td class="py-4 px-6 font-bold text-emerald-400">${bal} ج.م</td>
            <td class="py-4 px-6">${roleHtml}</td>
            <td class="py-4 px-6">
                <button onclick="addBalance('${user.id}', '${user.full_name}')" class="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all shadow-[0_0_10px_rgba(37,99,235,0.3)]">تعبئة رصيد</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.addBalance = async function(userId, userName) {
    const amountStr = prompt(`المبلغ المضاف للمستخدم "${userName}" (بالجنية):`);
    if(!amountStr) return;
    const amount = parseFloat(amountStr);
    if(isNaN(amount) || amount <= 0) return alert('الرجاء إدخال مبلغ صحيح.');
    
    const { data: u } = await supabase.from('profiles').select('balance').eq('id', userId).single();
    if(!u) return;
    
    const newBal = parseFloat(u.balance) + amount;
    const { error } = await supabase.from('profiles').update({ balance: newBal }).eq('id', userId);
    if(error) alert('حدث خطأ: ' + error.message);
    else {
        alert('تم شحن الرصيد بنجاح!');
        loadUsers();
    }
}

async function loadAdminServices() {
    const { data: services } = await supabase.from('services').select('*').order('created_at', { ascending: false });
    const container = document.getElementById('admin-services-list');
    container.innerHTML = '';
    if(!services) return;
    
    services.forEach(srv => {
        const div = document.createElement('div');
        div.className = 'glass-card p-5 rounded-xl border border-slate-700/50 fade-in';
        const activeHtml = srv.is_active ? '<span class="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">مفعل</span>' : '<span class="text-xs font-bold text-red-400 bg-red-500/10 px-2 py-1 rounded">معطل</span>';
        
        div.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <h4 class="font-bold text-lg text-white">${srv.name}</h4>
                ${activeHtml}
            </div>
            <p class="text-slate-400 text-sm mb-4 line-clamp-2">${srv.description || '--'}</p>
            <div class="flex justify-between items-center mb-4">
                <span class="text-emerald-400 font-bold">${parseFloat(srv.price).toFixed(2)} ج.م</span>
            </div>
            <div class="flex gap-2">
                <button onclick="editService('${srv.id}')" class="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-white font-medium transition-colors">تعديل</button>
                <button onclick="toggleServiceActive('${srv.id}', ${!srv.is_active})" class="flex-1 py-2 ${srv.is_active ? 'bg-red-900/40 hover:bg-red-900/60 text-red-400' : 'bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-400'} rounded-lg text-sm font-medium transition-colors">${srv.is_active ? 'تعطيل الخدمة' : 'تفعيل الخدمة'}</button>
            </div>
        `;
        container.appendChild(div);
    });
    window.adminCachedServices = services;
}

window.openServiceForm = function() {
    document.getElementById('service-form-wrapper').classList.remove('hidden');
    document.getElementById('sf-title').textContent = 'إضافة خدمة جديدة';
    document.getElementById('admin-service-form').reset();
    document.getElementById('sf-id').value = '';
}

window.editService = function(id) {
    const srv = window.adminCachedServices.find(s => s.id === id);
    if(!srv) return;
    
    document.getElementById('service-form-wrapper').classList.remove('hidden');
    document.getElementById('sf-title').textContent = 'تعديل بيانات الخدمة';
    document.getElementById('sf-id').value = srv.id;
    document.getElementById('sf-name').value = srv.name;
    document.getElementById('sf-price').value = srv.price;
    document.getElementById('sf-desc').value = srv.description || '';
    
    let fieldsStr = '';
    if(srv.dynamic_fields) {
        fieldsStr = srv.dynamic_fields.map(f => f.name).join(',');
    }
    document.getElementById('sf-fields').value = fieldsStr;
}

window.toggleServiceActive = async function(id, val) {
    await supabase.from('services').update({ is_active: val }).eq('id', id);
    loadAdminServices();
}

async function handleServiceSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('sf-id').value;
    const name = document.getElementById('sf-name').value;
    const price = parseFloat(document.getElementById('sf-price').value);
    const desc = document.getElementById('sf-desc').value;
    
    const fieldsRaw = document.getElementById('sf-fields').value;
    let dynamic_fields = [];
    if(fieldsRaw.trim() !== '') {
        dynamic_fields = fieldsRaw.split(',').map(s => ({ name: s.trim(), type: 'text', required: true }));
    }
    let payload = { name, price, description: desc, dynamic_fields };
    
    if(id) {
        await supabase.from('services').update(payload).eq('id', id);
    } else {
        await supabase.from('services').insert(payload);
    }
    
    document.getElementById('service-form-wrapper').classList.add('hidden');
    loadAdminServices();
}

async function loadAdminTransactions() {
    const { data: txs } = await supabase
        .from('transactions')
        .select('*, profiles(full_name, email)')
        .order('created_at', { ascending: false });
        
    const tbody = document.getElementById('admin-transactions-list');
    tbody.innerHTML = '';
    
    if(!txs) return;
    
    txs.forEach(tx => {
        let inputsHtml = '';
        if(tx.user_inputs) {
            Object.entries(tx.user_inputs).forEach(([k, v]) => {
                inputsHtml += `<div class="text-xs mb-1"><span class="text-slate-400">${k}:</span> <span class="text-white font-medium bg-slate-800 px-1 rounded">${v}</span></div>`;
            });
        }
        
        let actionsHtml = '';
        if(tx.status === 'PENDING') {
            actionsHtml = `
                <div class="flex flex-col gap-2">
                    <button onclick="updateTxStatus('${tx.id}', 'COMPLETED', null)" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-3 py-1.5 text-xs font-bold transition-colors">اعتماد وإكمال</button>
                    <button onclick="updateTxStatus('${tx.id}', 'REJECTED', '${tx.user_id}', ${tx.amount})" class="w-full bg-red-600 hover:bg-red-500 text-white rounded-lg px-3 py-1.5 text-xs font-bold transition-colors">رفض وإرجاع الرصيد</button>
                </div>
            `;
        } else if (tx.status === 'COMPLETED') {
            actionsHtml = '<div class="text-emerald-500 text-sm font-bold bg-emerald-500/10 py-2 rounded-lg text-center border border-emerald-500/20"><i data-lucide="check-circle" class="w-4 h-4 inline-block ml-1"></i>تمت بنجاح</div>';
        } else {
            actionsHtml = '<div class="text-red-500 text-sm font-bold bg-red-500/10 py-2 rounded-lg text-center border border-red-500/20"><i data-lucide="x-circle" class="w-4 h-4 inline-block ml-1"></i>مرفوضة</div>';
        }
        
        const date = new Date(tx.created_at).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-800/30 transition-colors border-b border-slate-700/50 text-sm';
        tr.innerHTML = `
            <td class="py-4 px-6 text-xs text-slate-500 font-mono" dir="ltr">#${tx.id.split('-')[0]}</td>
            <td class="py-4 px-6">
                <div class="font-bold text-white text-base mb-1">${tx.service_name}</div>
                <div class="text-xs text-brand-400 font-medium">${tx.profiles?.full_name}</div>
                <div class="text-xs text-slate-500 mt-1">${date}</div>
            </td>
            <td class="py-4 px-6 font-bold text-emerald-400 text-base">${parseFloat(tx.amount).toFixed(2)} ج.م</td>
            <td class="py-4 px-6 text-right">${inputsHtml || '<span class="text-slate-600">-</span>'}</td>
            <td class="py-4 px-4 align-middle min-w-[140px]">${actionsHtml}</td>
        `;
        tbody.appendChild(tr);
    });
    
    lucide.createIcons();
}

window.updateTxStatus = async function(txId, status, userIdToRefund, amountToRefund) {
    if(!confirm(status === 'COMPLETED' ? 'هل أنت متأكد من اكتمال هذه العملية؟' : 'تأكيد الرفض وإرجاع الرصيد؟')) return;
    
    const { error: txErr } = await supabase.from('transactions').update({ status }).eq('id', txId);
    if(txErr) {
        alert('خطأ أثناء التحديث: ' + txErr.message);
        return;
    }
    
    if(status === 'REJECTED' && userIdToRefund) {
        const { data: u } = await supabase.from('profiles').select('balance').eq('id', userIdToRefund).single();
        if(u) {
            const newBal = parseFloat(u.balance) + parseFloat(amountToRefund);
            await supabase.from('profiles').update({ balance: newBal }).eq('id', userIdToRefund);
            alert('تم إعادة الرصيد للمستخدم بنجاح.');
        }
    } else {
        alert('تم اعتماد العملية.');
    }
    
    loadAdminTransactions();
    loadDashboardStats();
}
