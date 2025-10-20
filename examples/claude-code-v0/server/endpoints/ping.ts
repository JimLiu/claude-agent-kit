const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function handlePingEndpoint(req: Request): Promise<Response> {
  return new Response(JSON.stringify({ ping: 'pong' }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    
    
}