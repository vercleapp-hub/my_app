const { supabase } = require('../_supabase');

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { data, error } = await supabase.from('services').select('*').order('id', { ascending: true });
    if(error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, services: data });
  } 
  
  if (req.method === 'POST') {
    const { id, name, price, company } = req.body;
    if (id) {
        const { error } = await supabase.from('services').update({ name, price, company }).eq('id', id);
        if(error) return res.status(500).json({ error: error.message });
    } else {
        if(!name || !price) return res.status(400).json({ error: 'Name and price required' });
        const { error } = await supabase.from('services').insert({ name, price, company });
        if(error) return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    const { error } = await supabase.from('services').delete().eq('id', id);
    if(error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
