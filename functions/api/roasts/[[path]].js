const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
// Read-only: no mutation or arbitrary SQL endpoint exists.
export async function onRequest({ request, env, params }) {
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } });
  if (!env.DB) return json({ error: 'Roasting data is not configured yet.' }, 503);
  const path = Array.isArray(params.path) ? params.path.join('/') : (params.path || '');
  if (path && !/^roast-[0-9a-f]{16}$/.test(path)) return json({ error: 'Not found' }, 404);
  try {
    if (path) {
      const row = await env.DB.prepare(`SELECT v.detail_json FROM roast_versions v
        JOIN roast_members m USING(version_id) JOIN roast_active a ON a.import_id=m.import_id
        WHERE v.roast_id=?`).bind(path).first();
      return row ? new Response(row.detail_json, { headers }) : json({ error: 'Not found' }, 404);
    }
    const result = await env.DB.prepare(`SELECT v.summary_json FROM roast_versions v
      JOIN roast_members m USING(version_id) JOIN roast_active a ON a.import_id=m.import_id
      ORDER BY v.roast_date DESC,m.path`).all();
    const meta = await env.DB.prepare(`SELECT i.created_at,i.sources_json FROM roast_imports i
      JOIN roast_active a ON a.import_id=i.import_id`).first();
    if (!meta) return json({ error: 'Roasting data has not been imported yet.' }, 503);
    return json({ profiles: result.results.map(r => JSON.parse(r.summary_json)), updated_at: meta.created_at,
      sources: JSON.parse(meta.sources_json).map(s => ({ name: s.name, sha256: s.sha256 })) });
  } catch (error) {
    console.error('Roasting database read failed', error);
    return json({ error: 'Roasting data is temporarily unavailable.' }, 503);
  }
}
