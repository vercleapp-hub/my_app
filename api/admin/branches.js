const { supabase } = require('../_supabase');

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { data, error } = await supabase.from('branches').select('*').order('created_at', { ascending: false });
    if(error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, branches: data });
  } 
  if (req.method === 'POST') {
    const { id, name, location } = req.body;
    if (id) {
        const { error } = await supabase.from('branches').update({ name, location }).eq('id', id);
        if(error) return res.status(500).json({ error: error.message });
    } else {
        const { error } = await supabase.from('branches').insert({ name, location });
        if(error) return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ success: true });
  }
  if (req.method === 'DELETE') {
    const { id } = req.body;
    const { error } = await supabase.from('branches').delete().eq('id', id);
    if(error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }
  res.status(405).json({ error: 'Method Not Allowed' });
}
