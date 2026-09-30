const crypto = require('crypto');
const { rest, download, clean, configured, send } = require('./_sb');
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
function newCode() { const b = crypto.randomBytes(6); return Array.from(b, x => ALPHA[x % ALPHA.length]).join(''); }
function authed(req) {
  const want = process.env.COACH_PASSWORD || '', got = String(req.headers['x-coach-key'] || '');
  if (!want || want.length < 8) return false;
  const a = Buffer.from(want), b = Buffer.from(got);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const VALID = ['squat','overhead','lateralLunge','balance','march','thoracic','hinge','forwardFold','lunge','sts','gait'];
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { ok: false });
  if (!configured()) return send(res, 500, { ok: false, error: 'Server not configured: add SUPABASE_URL and SUPABASE_SERVICE_KEY in Vercel.' });
  if (!process.env.COACH_PASSWORD) return send(res, 500, { ok: false, error: 'Add COACH_PASSWORD in Vercel settings.' });
  if (!authed(req)) { await new Promise(r => setTimeout(r, 800)); return send(res, 401, { ok: false, error: 'Wrong password.' }); }
  const b = req.body || {};
  try {
    switch (b.action) {
      case 'login': return send(res, 200, { ok: true });
      case 'list': {
        const reports = await rest('assess_reports?select=id,code,client_name,created_at,summary&order=created_at.desc&limit=300');
        const codes = await rest('assess_codes?select=*&order=created_at.desc&limit=300');
        return send(res, 200, { ok: true, reports, codes });
      }
      case 'report': {
        const rows = await rest('assess_reports?id=eq.' + String(b.id).replace(/[^a-f0-9-]/gi, '') + '&select=report_path,client_name,created_at');
        if (!rows || !rows[0]) return send(res, 404, { ok: false, error: 'Report not found.' });
        const html = await download(rows[0].report_path);
        return send(res, 200, { ok: true, html, client_name: rows[0].client_name, created_at: rows[0].created_at });
      }
      case 'newcode': {
        const name = String(b.client_name || '').trim().slice(0, 80);
        if (!name) return send(res, 400, { ok: false, error: 'Enter the client name.' });
        const movements = (Array.isArray(b.movements) ? b.movements : []).filter(m => VALID.includes(m));
        if (!movements.length) return send(res, 400, { ok: false, error: 'Pick at least one movement.' });
        const days = Math.min(90, Math.max(1, parseInt(b.days, 10) || 14));
        for (let i = 0; i < 5; i++) {
          const code = newCode();
          try {
            const row = await rest('assess_codes', { method: 'POST', headers: { Prefer: 'return=representation' },
              body: JSON.stringify({ code, client_name: name, movements, mode: String(b.mode || 'Online – self-serve').slice(0, 40), expires_at: new Date(Date.now() + days * 864e5).toISOString() }) });
            return send(res, 200, { ok: true, code: row[0] });
          } catch (e) { if (!/duplicate|23505/.test(e.message)) throw e; }
        }
        return send(res, 500, { ok: false, error: 'Could not create a code. Try again.' });
      }
      case 'setstatus': {
        const status = ['active', 'revoked'].includes(b.status) ? b.status : null;
        if (!status) return send(res, 400, { ok: false });
        const patch = { status };
        if (status === 'active') patch.expires_at = new Date(Date.now() + 14 * 864e5).toISOString();
        await rest('assess_codes?code=eq.' + encodeURIComponent(clean(b.code)), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) });
        return send(res, 200, { ok: true });
      }
      default: return send(res, 400, { ok: false, error: 'Unknown action.' });
    }
  } catch (e) { return send(res, 500, { ok: false, error: 'Server error: ' + e.message.slice(0, 160) }); }
};
