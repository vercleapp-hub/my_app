const { supabase } = require('../_supabase');

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { data, error } = await supabase.from('deposit_methods').select('*').order('created_at', { ascending: false });
    if(error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, methods: data });
  } 
  
  if (req.method === 'POST') {
    const { id, name, account_number, details, is_active } = req.body;
    if (id) {
        const { error } = await supabase.from('deposit_methods').update({ name, account_number, details, is_active }).eq('id', id);
        if(error) return res.status(500).json({ error: error.message });
    } else {
        if(!name || !account_number) return res.status(400).json({ error: 'Name and number required' });
        const { error } = await supabase.from('deposit_methods').insert({ name, account_number, details, is_active });
        if(error) return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    const { error } = await supabase.from('deposit_methods').delete().eq('id', id);
    if(error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
