export interface Env {
  AI: Ai;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== '/api') return new Response('Not Found', { status: 404 });

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // Only GET/POST
    if (request.method !== 'GET' && request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // Collect params
    let params: Record<string, any> = {};
    if (request.method === 'GET') {
      url.searchParams.forEach((v, k) => { params[k] = v; });
    } else {
      try {
        params = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Validate prompt
    const prompt = typeof params.prompt === 'string' ? params.prompt.trim() : '';
    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Missing prompt' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Build payload (same as before)...
    const payload: Record<string, any> = { prompt };
    // ... [width/height/num_steps/guidance/strength/seed/image/img2img fields validation as before] ...

    // **Key change**: force POST to the AI binding
    let aiResp: { image: string };
    try {
      aiResp = await env.AI.run(
        '@cf/bytedance/stable-diffusion-xl-lightning',
        payload,
        { method: 'POST' }
      );
    } catch (err) {
      return new Response(JSON.stringify({ error: 'AI generation error' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Decode & return PNG
    let bin: Uint8Array;
    try {
      bin = Uint8Array.from(atob(aiResp.image), c => c.charCodeAt(0));
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid base64 in AI response' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(bin, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    });
  },
} satisfies ExportedHandler<Env>;
