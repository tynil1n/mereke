export default {
  fetch() {
    return Response.json({ status: 'ok', openaiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()) }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  }
};
