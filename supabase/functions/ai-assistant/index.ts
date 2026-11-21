// Supabase Edge Function: ai-assistant
// Gemini кілті серверде қалады, браузерге түспейді / the Gemini key stays on the server.
import { SYSTEM_PROMPT } from './prompt.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) return json({ error: 'GEMINI_API_KEY is not set' }, 500);
  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash';

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
  const pet = body?.pet || {};
  const lang = body?.lang === 'en' ? 'en' : 'kk';
  const msgs: { role: string; text: string }[] = Array.isArray(body?.messages) ? body.messages.slice(-14) : [];
  if (!msgs.length) return json({ error: 'no messages' }, 400);

  const clip = (s: unknown, n: number) => String(s ?? '').slice(0, n);
  const card =
`CASE CARD
- Preferred reply language: ${lang === 'kk' ? 'Kazakh (kk)' : 'English (en)'} (but follow the language the user actually writes in)
- Animal: ${clip(pet.species, 40)}
- Breed: ${clip(pet.breed, 60)}
- Sex: ${clip(pet.sex, 12)}; spayed/neutered: ${pet.neutered ? 'yes' : 'no'}
- Age: ${clip(pet.age, 30)}
- Weight (kg): ${clip(pet.weight_kg, 10)}
- Symptoms started: ${clip(pet.since, 30)}
- Extra notes: ${clip(pet.extra, 600) || 'none'}`;

  const contents = msgs.map((m, i) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: (i === 0 ? card + '\n\nOWNER DESCRIPTION:\n' : '') + clip(m.text, 2000) }]
  }));
  // Gemini сұхбаты "user" рөлінен басталуы тиіс / must start with a user turn
  while (contents.length && contents[0].role !== 'user') contents.shift();

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: { temperature: 0.4, maxOutputTokens: 1200 },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' }
      ]
    })
  });

  if (!res.ok) {
    console.error('Gemini error', res.status, await res.text());
    return json({ error: 'gemini_failed', status: res.status }, 502);
  }
  const data = await res.json();
  const reply = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
  if (!reply) return json({ error: 'empty_reply' }, 502);
  return json({ reply });
});
