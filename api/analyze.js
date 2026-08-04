// Server-side Anthropic proxy.
//
// The client sends only structured inputs (an image, or wine details) and never
// a raw Anthropic request body. Model, token limits, tools, and prompts are all
// fixed here so this endpoint can only ever do wine-label work.

const MODEL = 'claude-sonnet-5';
const MAX_TOKENS = 1000;

// Vercel caps request bodies at 4.5 MB. Base64 inflates a file by ~33%, so keep
// the encoded image comfortably under that; the client downscales before upload.
const MAX_IMAGE_B64_CHARS = 4_000_000;
const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const MAX_FIELD_CHARS = 200;

// Upstream calls must be bounded. Without this a stalled Anthropic request runs
// until Vercel kills the function at its 300s ceiling, burning the whole
// duration budget and leaving the client spinning.
// Both sit under the 60s maxDuration in vercel.json so the handler returns a
// real 504 rather than being killed mid-flight.
const UPSTREAM_TIMEOUT_MS = { analyzeLabel: 40_000, drinkWindow: 50_000 };

// Cap how many searches the model runs. Unbounded, a single lookup can spend
// minutes fanning out across retailer sites.
const MAX_SEARCHES = 4;

const VARIETALS = 'Cabernet Sauvignon, Pinot Noir, Merlot, Syrah/Shiraz, Zinfandel, Chardonnay, Sauvignon Blanc, Riesling, Pinot Grigio, Rosé, Champagne/Sparkling, Other Red, Other White';
const REGIONS = 'Napa Valley, Sonoma, Burgundy, Bordeaux, Rhône, Tuscany, Piedmont, Rioja, Willamette Valley, Barossa Valley, Marlborough, or Other if not matching';

const LABEL_PROMPT = `Analyze this wine label and extract the following information. Respond ONLY with a JSON object, no markdown or explanation:
{
  "name": "wine name (e.g., 'Reserve Cabernet', 'Clos du Val')",
  "producer": "winery/producer name",
  "vintage": year as number or null if not visible,
  "varietal": "grape variety - must be one of: ${VARIETALS}",
  "region": "wine region - should be one of: ${REGIONS}",
  "notes": "any other notable info from the label like vineyard designation, special notes, alcohol %, etc."
}

If you can't determine a field, use null.`;

const drinkWindowPrompt = (producer, name, vintage, varietal) =>
  `Search for the drink window (when to drink) for this wine: ${vintage || ''} ${producer} ${name} ${varietal || ''}.

Look for information from CellarTracker, Wine Spectator, Vivino, or other wine databases about when this specific wine should be consumed.

Respond ONLY with a JSON object, no markdown:
{
  "drinkFrom": starting year as number,
  "drinkTo": ending year as number,
  "source": "where this info came from (e.g., 'CellarTracker community', 'Wine Spectator')",
  "confidence": "high" or "medium" or "low",
  "notes": "any relevant aging notes found"
}

If you can't find specific data for this wine, estimate based on the wine type and vintage, set confidence to "low", and note it's an estimate.`;

// Collapse whitespace and clamp length. These values are interpolated into a
// prompt, so keeping them short and single-line limits the injection surface.
const cleanField = (value) => {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, MAX_FIELD_CHARS);
};

const buildLabelRequest = (body) => {
  const { image, mediaType } = body;

  if (typeof image !== 'string' || image.length === 0) {
    return { error: 'Missing image' };
  }
  if (image.length > MAX_IMAGE_B64_CHARS) {
    return { error: 'Image too large — resize before uploading' };
  }
  if (!/^[A-Za-z0-9+/=]+$/.test(image)) {
    return { error: 'Image must be base64-encoded' };
  }
  if (!ALLOWED_MEDIA_TYPES.includes(mediaType)) {
    return { error: 'Unsupported image type' };
  }

  return {
    payload: {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: 'disabled' },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
          { type: 'text', text: LABEL_PROMPT }
        ]
      }]
    }
  };
};

const buildDrinkWindowRequest = (body) => {
  const producer = cleanField(body.producer);
  const name = cleanField(body.name);
  const varietal = cleanField(body.varietal);
  const vintage = Number.isInteger(body.vintage) ? body.vintage : '';

  if (!producer && !name) {
    return { error: 'Missing wine details' };
  }

  return {
    payload: {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: 'disabled' },
      // Deliberately the basic search variant, not web_search_20260209. The
      // newer version adds dynamic filtering, which runs server-side code
      // execution on every search and pushed this call past 100s.
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: MAX_SEARCHES }],
      messages: [{ role: 'user', content: drinkWindowPrompt(producer, name, vintage, varietal) }]
    }
  };
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY is not set');
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};

  let built;
  if (body.action === 'analyzeLabel') {
    built = buildLabelRequest(body);
  } else if (body.action === 'drinkWindow') {
    built = buildDrinkWindowRequest(body);
  } else {
    return res.status(400).json({ error: 'Unsupported action' });
  }

  if (built.error) {
    return res.status(400).json({ error: built.error });
  }

  const startedAt = Date.now();

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(built.payload),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS[body.action])
    });

    const data = await response.json();

    if (!response.ok) {
      // Log upstream detail server-side; don't hand it to the caller.
      console.error('Anthropic API error', response.status, JSON.stringify(data));
      return res.status(502).json({ error: 'Wine analysis is temporarily unavailable' });
    }

    console.log(`${body.action} ok in ${Date.now() - startedAt}ms`);
    return res.status(200).json({ content: data.content });
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      console.error(`${body.action} timed out after ${Date.now() - startedAt}ms`);
      return res.status(504).json({ error: 'Wine analysis took too long' });
    }
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Wine analysis is temporarily unavailable' });
  }
}

