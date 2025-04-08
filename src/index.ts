export interface Env {
  AI: Ai;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== '/api') {
      return new Response('Not Found', { status: 404 });
    }

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

    // Only GET or POST
    if (request.method !== 'GET' && request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // Merge GET query or POST JSON body
    let params: Record<string, any> = {};
    if (request.method === 'GET') {
      const qp = url.searchParams;
      qp.forEach((v, k) => { params[k] = v; });
    } else {
      try {
        params = await request.json();
      } catch {
        return new Response('Invalid JSON', { status: 400 });
      }
    }

    // Validate required prompt
    const prompt = params.prompt?.trim();
    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: prompt' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Build payload with validation/defaults
    const payload: Record<string, any> = { prompt };

    if (params.negative_prompt) {
      payload.negative_prompt = String(params.negative_prompt);
    }

    // width/height: integers 256–2048
    const w = Number(params.width);
    const h = Number(params.height);
    if (!isNaN(w)) {
      if (w < 256 || w > 2048) {
        return new Response('`width` must be 256–2048', { status: 400 });
      }
      payload.width = w;
    }
    if (!isNaN(h)) {
      if (h < 256 || h > 2048) {
        return new Response('`height` must be 256–2048', { status: 400 });
      }
      payload.height = h;
    }

    // num_steps: integer, max 20 (default 20)
    const steps = Number.isInteger(params.num_steps) ? params.num_steps : 20;
    if (steps < 1 || steps > 20) {
      return new Response('`num_steps` must be 1–20', { status: 400 });
    }
    payload.num_steps = steps;

    // guidance: number (default 7.5)
    if (params.guidance !== undefined) {
      const g = Number(params.guidance);
      if (isNaN(g)) {
        return new Response('`guidance` must be a number', { status: 400 });
      }
      payload.guidance = g;
    }

    // strength: number 0–1 (default 1)
    if (params.strength !== undefined) {
      const s = Number(params.strength);
      if (isNaN(s) || s < 0 || s > 1) {
        return new Response('`strength` must be 0–1', { status: 400 });
      }
      payload.strength = s;
    }

    // seed: integer
    if (params.seed !== undefined) {
      const sd = Number(params.seed);
      if (!Number.isInteger(sd)) {
        return new Response('`seed` must be an integer', { status: 400 });
      }
      payload.seed = sd;
    }

    // img2img fields (image, image_b64, mask)
    if (Array.isArray(params.image)) {
      payload.image = params.image;
    }
    if (typeof params.image_b64 === 'string') {
      payload.image_b64 = params.image_b64;
    }
    if (Array.isArray(params.mask)) {
      payload.mask = params.mask;
    }

    // Call the Stable Diffusion XL Lightning model
    let aiResp: { image: string };
    try {
      aiResp = await env.AI.run(
        '@cf/bytedance/stable-diffusion-xl-lightning',
        payload
      );
    } catch (err) {
      return new Response('AI generation error', { status: 502 });
    }

    // Decode Base64 → binary
    const bin = Uint8Array.from(atob(aiResp.image), c => c.charCodeAt(0));

    // Return PNG
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
