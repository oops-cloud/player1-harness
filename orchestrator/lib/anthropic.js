// orchestrator/lib/anthropic.js
// Thin client around the Messages API. Tracks spend so the budget guard can enforce runway.

const config = require('./config');

// Rough public per-MTok prices for cost accounting. Update if pricing changes.
// Only used to estimate spend for the budget lifeline, not billing-accurate.
const PRICES = {
  'claude-opus-4-8': { in: 5.0, out: 25.0 },
  'claude-sonnet-4-6': { in: 3.0, out: 15.0 },
  'claude-haiku-4-5-20251001': { in: 0.8, out: 4.0 },
};

let _spentUsd = 0;
const spentUsd = () => _spentUsd;

function estimateCost(model, usage) {
  const p = PRICES[model] || PRICES['claude-sonnet-4-6'];
  const inTok = usage?.input_tokens || 0;
  const outTok = usage?.output_tokens || 0;
  return (inTok / 1e6) * p.in + (outTok / 1e6) * p.out;
}

// Call the model. `system` and `user` are strings. Returns the text content.
async function ask({ system, user, model = config.model, maxTokens = config.maxTokens }) {
  if (!config.apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

  const res = await fetch(config.anthropicBase, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': config.anthropicVersion,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 500)}`);
  }

  const data = await res.json();
  _spentUsd += estimateCost(model, data.usage);

  const text = (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
  return text;
}

// Pull the JSON object out of model output. Robust to prose and code fences: prefers an
// explicit ```json block, otherwise scans the raw text. Both callers return a JSON OBJECT,
// so we anchor on the first '{' and walk to its matching '}', tracking string state so that
// braces/brackets/quotes inside string values (e.g. Rust `seeds = [b"user", authority]`)
// can never throw off the depth count.
function extractJson(text) {
  const jsonFence = text.match(/```json\s*([\s\S]*?)```/i);
  const candidate = jsonFence ? jsonFence[1] : text;

  const start = candidate.indexOf('{');
  if (start === -1) throw new Error('No JSON object found in model output');

  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < candidate.length; i++) {
    const c = candidate[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return JSON.parse(candidate.slice(start, i + 1));
    }
  }
  throw new Error('Unbalanced JSON object in model output');
}

module.exports = { ask, extractJson, spentUsd };
