const { supabase } = require('../_supabase');

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { data, error } = await supabase.from('settings').select('*').eq('key', 'system_settings').single();
    if(error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, settings: data?.value || {} });
  } 
  if (req.method === 'POST') {
    const { settings } = req.body;
    const { error } = await supabase.from('settings').upsert({ key: 'system_settings', value: settings }, { onConflict: 'key' });
    if(error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }
  res.status(405).json({ error: 'Method Not Allowed' });
}
