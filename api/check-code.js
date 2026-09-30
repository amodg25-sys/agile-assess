const { clean, configured, send, getCode, codeState } = require('./_sb');
const MSG = { invalid: 'This code is not valid. Please check it with your AGILE coach.', used: 'This code has already been used. Ask your coach for a new one.', revoked: 'This code is no longer active. Ask your coach for a new one.', expired: 'This code has expired. Ask your coach for a new one.' };
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { ok: false });
  if (!configured()) return send(res, 500, { ok: false, error: 'Server not configured yet.' });
  try {
    const code = clean(req.body && req.body.code);
    if (code.length < 4) return send(res, 400, { ok: false, error: MSG.invalid });
    const row = await getCode(code);
    const st = codeState(row);
    if (st !== 'active') return send(res, 200, { ok: false, error: MSG[st] });
    send(res, 200, { ok: true, code, client_name: row.client_name, movements: row.movements, mode: row.mode });
  } catch (e) { send(res, 500, { ok: false, error: 'Could not check the code. Try again in a moment.' }); }
};
