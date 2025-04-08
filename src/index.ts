export interface Env {
  AI: Ai;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Only /api endpoint
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

    // Only GET or POST allowed
    if (request.method !== 'GET' && request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // Merge params from GET query or POST JSON
    let params: Record<string, any> = {};
    if (request.method === 'GET') {
      url.searchParams.forEach((v, k) => { params[k] = v; });
    } else {
      try {
        params = await request.json();
      } catch {
        return new Response(
          JSON.stringify({ error: 'Invalid JSON body' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Validate required prompt
    const prompt = typeof params.prompt === 'string' ? params.prompt.trim() : '';
    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: prompt' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Build payload with defaults & validation
    const payload: Record<string, any> = { prompt };

    // Negative prompt
    if (typeof params.negative_prompt === 'string') {
      payload.negative_prompt = params.negative_prompt;
    }

    // Width/Height
    const w = Number(params.width);
    if (!isNaN(w)) {
      if (w < 256 || w > 2048) {
        return new Response('`width` must be 256–2048', { status: 400 });
      }
      payload.width = w;
    }
    const h = Number(params.height);
    if (!isNaN(h)) {
      if (h < 256 || h > 2048) {
        return new Response('`height` must be 256–2048', { status: 400 });
      }
      payload.height = h;
    }

    // num_steps (1–20)
    const steps = Number.isInteger(params.num_steps) ? params.num_steps : 20;
    if (steps < 1 || steps > 20) {
      return new Response('`num_steps` must be 1–20', { status: 400 });
    }
    payload.num_steps = steps;

    // guidance
    if (params.guidance !== undefined) {
      const g = Number(params.guidance);
      if (isNaN(g)) {
        return new Response('`guidance` must be a number', { status: 400 });
      }
      payload.guidance = g;
    }

    // strength
    if (params.strength !== undefined) {
      const s = Number(params.strength);
      if (isNaN(s) || s < 0 || s > 1) {
        return new Response('`strength` must be between 0 and 1', { status: 400 });
      }
      payload.strength = s;
    }

    // seed
    if (params.seed !== undefined) {
      const sd = Number(params.seed);
      if (!Number.isInteger(sd)) {
        return new Response('`seed` must be an integer', { status: 400 });
      }
      payload.seed = sd;
    }

    // img2img fields: image (array), image_b64 (string), mask (array)
    if (Array.isArray(params.image)) {
      payload.image = params.image;
    }
    if (typeof params.image_b64 === 'string') {
      // Validate base64 before sending to model?
      // The AI binding should handle it; we won't decode it here.
      payload.image_b64 = params.image_b64;
    }
    if (Array.isArray(params.mask)) {
      payload.mask = params.mask;
    }

    // Call the AI model
    let aiResp: { image: string };
    try {
      aiResp = await env.AI.run(
        '@cf/bytedance/stable-diffusion-xl-lightning',
        payload
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ error: 'AI generation error' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Decode the returned base64 PNG safely
    let binary: Uint8Array;
    try {
      binary = Uint8Array.from(atob(aiResp.image), c => c.charCodeAt(0));
    } catch (err) {
      return new Response(
        JSON.stringify({ error: 'Invalid base64 from AI response' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Return the binary PNG
    return new Response(binary, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    });
  },
} satisfies ExportedHandler<Env>;
