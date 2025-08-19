export function ok(res, data) {
  res.json({ ok: true, data });
}
export function bad(res, message='Bad Request', status=400) {
  res.status(status).json({ ok: false, error: message });
}
export function requireFields(obj, fields) {
  for (const k of fields) {
    if (obj[k] === undefined || obj[k] === null || (typeof obj[k] === 'string' && obj[k].trim() === '')) {
      throw new Error(`missing field: ${k}`);
    }
  }
}
export function toInt(v, def=0) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}
export function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
