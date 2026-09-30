// Shared Supabase helpers (files starting with _ are not public routes on Vercel)
const URL_ = () => (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = () => process.env.SUPABASE_SERVICE_KEY || '';
const H = extra => ({ apikey: KEY(), Authorization: 'Bearer ' + KEY(), ...extra });

async function rest(path, opts = {}) {
  const r = await fetch(URL_() + '/rest/v1/' + path, { ...opts, headers: H({ 'Content-Type': 'application/json', ...(opts.headers || {}) }) });
  const t = await r.text();
  if (!r.ok) throw new Error('DB ' + r.status + ': ' + t.slice(0, 200));
  return t ? JSON.parse(t) : null;
}
async function upload(path, body, type) {
  const r = await fetch(URL_() + '/storage/v1/object/assess-reports/' + path, { method: 'POST', headers: H({ 'Content-Type': type, 'x-upsert': 'true' }), body });
  if (!r.ok) throw new Error('Storage ' + r.status + ': ' + (await r.text()).slice(0, 200));
}
async function download(path) {
  const r = await fetch(URL_() + '/storage/v1/object/assess-reports/' + path, { headers: H() });
  if (!r.ok) throw new Error('Storage ' + r.status);
  return await r.text();
}
const clean = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
function configured() { return !!(URL_() && KEY()); }
function send(res, code, obj) { res.status(code).setHeader('Cache-Control', 'no-store'); res.json(obj); }
async function getCode(code) {
  const rows = await rest('assess_codes?code=eq.' + encodeURIComponent(code) + '&select=*');
  return rows && rows[0];
}
function codeState(row) {
  if (!row) return 'invalid';
  if (row.status === 'revoked') return 'revoked';
  if (row.status === 'used') return 'used';
  if (row.expires_at && new Date(row.expires_at) < new Date()) return 'expired';
  return 'active';
}
module.exports = { rest, upload, download, clean, configured, send, getCode, codeState };
