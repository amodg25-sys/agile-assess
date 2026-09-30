const { rest, upload, clean, configured, send, getCode, codeState } = require('./_sb');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { ok: false });
  if (!configured()) return send(res, 500, { ok: false, error: 'Server not configured yet.' });
  try {
    const b = req.body || {};
    const code = clean(b.code), id = String(b.id || '').replace(/[^a-f0-9-]/gi, '').slice(0, 36);
    if (!id || !b.html || typeof b.html !== 'string') return send(res, 400, { ok: false, error: 'Incomplete report.' });
    // Idempotent: a retry after a successful send just confirms success
    const existing = await rest('assess_reports?id=eq.' + id + '&select=id');
    if (existing && existing.length) return send(res, 200, { ok: true, already: true });
    const row = await getCode(code);
    if (codeState(row) !== 'active') return send(res, 403, { ok: false, error: 'This code is no longer active.' });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const path = code + '/' + stamp + '.html';
    await upload(path, b.html, 'text/html; charset=utf-8');
    await rest('assess_reports', { method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ id, code, client_name: row.client_name, summary: b.summary || null, report_path: path, device: String(b.device || '').slice(0, 200) }) });
    await rest('assess_codes?code=eq.' + encodeURIComponent(code), { method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'used', used_at: new Date().toISOString() }) });
    send(res, 200, { ok: true });
  } catch (e) { send(res, 500, { ok: false, error: 'Could not send the report. Check the internet and try again.' }); }
};
