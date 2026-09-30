// Daily ping (Vercel cron) so the free Supabase project never pauses from inactivity
const { rest, configured, send } = require('./_sb');
module.exports = async (req, res) => {
  if (!configured()) return send(res, 500, { ok: false });
  try { await rest('assess_codes?select=code&limit=1'); send(res, 200, { ok: true, at: new Date().toISOString() }); }
  catch (e) { send(res, 500, { ok: false }); }
};
