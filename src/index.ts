export interface Env {
  AI: Ai;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // 1. Parse URL and extract "prompt" query parameter
    const url = new URL(request.url);
    const promptParam = url.searchParams.get('prompt')?.trim();
    
    // 2. Set default prompt if none provided
    const prompt = promptParam && promptParam.length > 0
      ? promptParam
      : 'a cyberpunk lizard';
    
    // 3. Call the AI binding with dynamic prompt
    const response = await env.AI.run('@cf/black-forest-labs/flux-1-schnell', {
      prompt,
    });
    
    // 4. Decode the base64-encoded JPEG
    const binaryString = atob(response.image);
    const img = Uint8Array.from(binaryString, (m) => m.codePointAt(0)!);
    
    // 5. Return as image/jpeg
    return new Response(img, {
      headers: {
        'Content-Type': 'image/jpeg',
      },
    });
  },
} satisfies ExportedHandler<Env>;
