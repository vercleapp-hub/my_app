const { supabase } = require('../_supabase');

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { data, error } = await supabase.from('employees').select('*, branches(name)').order('created_at', { ascending: false });
    if(error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, employees: data });
  } 
  if (req.method === 'POST') {
    const { id, name, phone, branch_id, role } = req.body;
    if (id) {
        const { error } = await supabase.from('employees').update({ name, phone, branch_id, role }).eq('id', id);
        if(error) return res.status(500).json({ error: error.message });
    } else {
        const { error } = await supabase.from('employees').insert({ name, phone, branch_id, role });
        if(error) return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ success: true });
  }
  if (req.method === 'DELETE') {
    const { id } = req.body;
    const { error } = await supabase.from('employees').delete().eq('id', id);
    if(error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }
  res.status(405).json({ error: 'Method Not Allowed' });
}
