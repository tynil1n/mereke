import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { handleRequest, validateQuery, validateExplanations } from './recommend.mjs';
const require = createRequire(import.meta.url);
const engine = require('../dist/engine.js');
const data = globalThis.CONTRACTORS;
const q = { city: 'Алматы', category: 'Ведущий', event: 'корпоратив', date: '2026-10-15', budget: 1000000, hours: 6, language: 'русский', wishes: '' };
const request = (body = q, extra = {}) => new Request('http://localhost/api/recommend', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...extra }, body: JSON.stringify(body)
});
const cards = engine.recommend(data, q).cards;
const explanations = profiles => ({ cards: profiles.map(p => ({ id: p.id, reason: 'Особенности описания подходят к указанному формату мероприятия.', evidence: p.description.slice(0, 100), caveat: 'Детали программы уточните у подрядчика.' })) });
const completed = value => Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }] });

test('reject malformed input, injected profile data and non-POST requests', async () => {
  assert.equal((await handleRequest(new Request('http://localhost/api/recommend'))).status, 405);
  assert.equal((await handleRequest(request({ ...q, cards: [{ id: 'fake' }] }))).status, 400);
  for (const patch of [{ budget: true }, { date: '2026-11-31' }, { language: 'invented' }, { wishes: 'x'.repeat(501) }, { hours: -2 }]) {
    assert.equal((await handleRequest(request({ ...q, ...patch }))).status, 400);
  }
  assert.equal((await handleRequest(request(q, { origin: 'https://other.example' }))).status, 403);
});

test('returns rules without a key; never asks OpenAI for an empty result', async () => {
  const fallback = await (await handleRequest(request(), { apiKey: '' })).json();
  assert.equal(fallback.reason, 'not_configured'); assert.equal(fallback.cards.length, 3);
  for (const patch of [{ budget: 1 }, { city: 'Астана', category: 'Декоратор' }]) {
    const result = await (await handleRequest(request({ ...q, ...patch }), { apiKey: 'test-only', fetchImpl: () => { throw new Error('Must not call'); } })).json();
    assert.equal(result.reason, 'no_candidates'); assert.equal(result.cards.length, 0);
  }
});

test('builds Responses request server-side and restores original order', async () => {
  let calls = 0;
  const fetchImpl = async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(options.headers.Authorization, 'Bearer test-only');
    const payload = JSON.parse(options.body);
    assert.equal(payload.store, false); assert.equal(payload.text.format.strict, true);
    assert.equal(JSON.parse(payload.input).profiles.length, 3);
    assert.ok(!options.body.includes('test-only'));
    return completed(explanations([...cards].reverse()));
  };
  const options = { apiKey: 'test-only', model: 'unit-test', fetchImpl };
  const result = await (await handleRequest(request(), options)).json();
  assert.equal(result.mode, 'openai');
  assert.deepEqual(result.cards.map(x => x.id), cards.map(x => x.id));
  assert.deepEqual(result.explanations.map(x => x.id), cards.map(x => x.id));
  assert.equal((await (await handleRequest(request(), options)).json()).cached, true);
  assert.equal(calls, 1);
});

test('rejects hallucinated IDs, duplicate profiles and invented quotations', () => {
  for (const mutate of [x => x.cards[0].id = 'FAKE', x => x.cards[1].id = x.cards[0].id, x => x.cards[0].evidence = 'Совершенно выдуманная цитата из профиля.']) {
    const result = explanations(cards); mutate(result);
    assert.throws(() => validateExplanations(result, cards));
  }
});

test('provider authentication errors, limits, refusals and timeouts preserve matching cards', async () => {
  for (const [name, fetchImpl, expected] of [
    ['auth', async () => new Response('{}', { status: 401 }), 'provider_auth'],
    ['quota', async () => new Response('{}', { status: 429 }), 'provider_limit'],
    ['refusal', async () => Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'No' }] }] }), 'invalid_response'],
    ['timeout', async () => { throw new DOMException('Timeout', 'TimeoutError'); }, 'timeout'],
    ['invented', async () => completed({ cards: [{ id: 'FAKE' }] }), 'invalid_response']
  ]) {
    const result = await (await handleRequest(request(), { apiKey: 'test-only', model: name, fetchImpl })).json();
    assert.equal(result.mode, 'rules'); assert.equal(result.reason, expected);
    assert.deepEqual(result.cards.map(p => p.id), cards.map(p => p.id));
  }
});

test('request size and repeated requests are bounded', async () => {
  const large = new Request('http://localhost/api/recommend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(8001) });
  assert.equal((await handleRequest(large)).status, 413);
  let last;
  for (let n = 0; n < 13; n++) last = await handleRequest(request(q, { 'x-forwarded-for': 'rate-test' }), {
    apiKey: 'test-only', model: 'rate-' + n, fetchImpl: async () => new Response('{}', { status: 429 })
  });
  assert.equal(last.status, 429); assert.equal((await last.json()).reason, 'rate_limit');
});

test('query normalization keeps numeric conditions explicit', () => {
  assert.equal(validateQuery({ ...q, budget: '1000000' }).budget, 1000000);
});
