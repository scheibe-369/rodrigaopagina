export default {
  async fetch(request) {
    const url = new URL(request.url);
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
  }
};
