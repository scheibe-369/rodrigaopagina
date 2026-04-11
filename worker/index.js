// Cloudflare Worker: proxy pro Pages + API de estado compartilhado (KV)
// Route: trafego.ioncomunity.com.br/*
// - GET  /api/state -> retorna o JSON salvo no KV (ou {} se nao houver)
// - PUT  /api/state -> salva o JSON enviado no KV (unico estado global compartilhado)
// - OPTIONS /api/state -> CORS preflight
// - qualquer outra rota -> proxy pra https://trafego-studio.pages.dev

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const MAX_PAYLOAD_BYTES = 20 * 1024 * 1024; // 20 MB (limite do KV e 25 MB por valor; deixo margem)

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ---- API: /api/state ----
    if (url.pathname === '/api/state') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: CORS_HEADERS });
      }

      if (request.method === 'GET') {
        const data = await env.TRAFEGO_STATE.get('main');
        return new Response(data || '{}', {
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            ...CORS_HEADERS,
          },
        });
      }

      if (request.method === 'PUT') {
        const body = await request.text();

        if (body.length > MAX_PAYLOAD_BYTES) {
          return new Response(JSON.stringify({ error: 'Payload too large' }), {
            status: 413,
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
          });
        }

        try {
          JSON.parse(body); // valida
        } catch (e) {
          return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
          });
        }

        await env.TRAFEGO_STATE.put('main', body);

        return new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }

      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    // ---- Fallback: proxy pro Cloudflare Pages ----
    const targetUrl = `https://trafego-studio.pages.dev${url.pathname}${url.search}`;
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      redirect: 'follow',
    });

    const newResponse = new Response(response.body, response);
    newResponse.headers.set('X-Proxied-By', 'Cloudflare-Worker');
    return newResponse;
  },
};
