// 白小白後台代理 — Gemini 生成（金鑰只在後台 env，前端碰不到）
// 環境變數：GEMINI_API_KEY（在 Netlify 後台設定）
const MODEL = 'gemini-2.5-flash';

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: 'POST only' };

  const key = process.env.GEMINI_API_KEY;
  if (!key) return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'no_key' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'bad_json' }) }; }

  const prompt = (body.prompt || '').toString().slice(0, 8000);
  if (!prompt) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'no_prompt' }) };

  const parts = [{ text: prompt }];
  if (body.image && body.image.data && body.image.mimeType) {
    parts.push({ inline_data: { mime_type: body.image.mimeType, data: body.image.data } });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0.9, maxOutputTokens: 800 },
      }),
    });
    const d = await r.json();
    if (!r.ok) {
      const status = (d && d.error && d.error.status) || r.status;
      return { statusCode: 502, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'gemini', status }) };
    }
    const text = (((d.candidates || [])[0] || {}).content || {}).parts
      ? d.candidates[0].content.parts.map(p => p.text).filter(Boolean).join('')
      : '';
    return { statusCode: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) };
  } catch (e) {
    return { statusCode: 502, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: String(e) }) };
  }
};
