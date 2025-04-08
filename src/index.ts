export interface Env {
  AI: Ai;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const isApi = url.pathname === '/api';

    // Only /api is supported
    if (!isApi) {
      return new Response('Not Found', { status: 404 });
    }

    // Handle CORS preflight
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

    // Merge params from GET or POST
    let params: Record<string, any> = {};
    if (request.method === 'GET') {
      // Query params
      const qp = url.searchParams;
      params.prompt = qp.get('prompt')?.trim();
      if (qp.has('steps'))  params.steps  = Number(qp.get('steps'));
      if (qp.has('width'))  params.width  = Number(qp.get('width'));
      if (qp.has('height')) params.height = Number(qp.get('height'));
      if (qp.has('seed'))   params.seed   = Number(qp.get('seed'));
    } else if (request.method === 'POST') {
      // JSON body
      try {
        params = await request.json();
      } catch {
        return new Response('Invalid JSON', { status: 400 });
      }
    } else {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // Validate prompt
    const prompt = params.prompt;
    if (typeof prompt !== 'string' || prompt.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: prompt' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate steps
    const steps = Number.isInteger(params.steps) ? params.steps : 4;
    if (steps < 1 || steps > 8) {
      return new Response(
        JSON.stringify({ error: '`steps` must be integer 1–8' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Build payload
    const payload: Record<string, any> = { prompt, steps };
    if (Number.isInteger(params.width))  payload.width  = params.width;
    if (Number.isInteger(params.height)) payload.height = params.height;
    if (Number.isInteger(params.seed))   payload.seed   = params.seed;

    // Call the AI
    let aiResp: { image: string };
    try {
      aiResp = await env.AI.run('@cf/black-forest-labs/flux-1-schnell', payload);
    } catch (err) {
      return new Response('AI generation error', { status: 502 });
    }

    // Decode base64 → binary
    const bin = Uint8Array.from(atob(aiResp.image), c => c.charCodeAt(0));

    // Return image/jpeg
    return new Response(bin, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    });
  },
} satisfies ExportedHandler<Env>;
