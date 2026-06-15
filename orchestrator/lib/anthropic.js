// orchestrator/lib/anthropic.js
// Thin client around the Messages API. Tracks spend so the budget guard can enforce runway.

const config = require('./config');

// Rough public per-MTok prices for cost accounting. Update if pricing changes.
// Only used to estimate spend for the budget lifeline — not billing-accurate.
const PRICES = {
  'claude-opus-4-8': { in: 5.0, out: 25.0 },
  'claude-sonnet-4-6': { in: 3.0, out: 15.0 },
  'claude-haiku-4-5-20251001': { in: 1.0, out: 5.0 },
};

let _spentUsd = 0;
const spentUsd = () => _spentUsd;

function estimateCost(model, usage) {
  const p = PRICES[model] || PRICES['claude-sonnet-4-6'];
  const inTok = usage?.input_tokens || 0;
  const outTok = usage?.output_tokens || 0;
  return (inTok / 1e6) * p.in + (outTok / 1e6) * p.out;
}

// Call the model. `system` is a string, `user` is a string. Returns the text content.
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

// Models love to wrap JSON in prose or fences. Pull the first JSON object/array out cleanly.
function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.search(/[[{]/);
  if (start === -1) throw new Error('No JSON found in model output');
  // Walk to the matching close bracket.
  const open = candidate[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  for (let i = start; i < candidate.length; i++) {
    if (candidate[i] === open) depth++;
    else if (candidate[i] === close) {
      depth--;
      if (depth === 0) return JSON.parse(candidate.slice(start, i + 1));
    }
  }
  throw new Error('Unbalanced JSON in model output');
}

module.exports = { ask, extractJson, spentUsd };
