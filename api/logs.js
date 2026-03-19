const { supabase } = require('./_supabase');

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  
  const { data: logs, error } = await supabase
    .from('activity_logs')
    .select('*, custom_users(name)')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ success: true, logs });
}
