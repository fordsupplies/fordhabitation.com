import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const recipient = 'fordhabitation@hotmail.com';
const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/site.js', ['site.js', 'text/javascript; charset=utf-8']],
  ['/assets/logo-ford-habitation-transparent.png', ['assets/logo-ford-habitation-transparent.png', 'image/png']],
  ['/assets/maison-illustration.jpg', ['assets/maison-illustration.jpg', 'image/jpeg']]
]);
const fieldLimits = { nom: 100, courriel: 150, telephone: 35, ville: 100, service: 100, projet: 1500 };

function reply(response, status) {
  response.writeHead(status, { 'Cache-Control': 'no-store' }).end();
}

async function readQuote(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16_384) throw new Error('Request too large');
    chunks.push(chunk);
  }

  const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const quote = {};
  for (const [field, limit] of Object.entries(fieldLimits)) {
    const value = input?.[field];
    if (typeof value !== 'string' || value.length > limit) throw new Error('Invalid field');
    quote[field] = value.trim();
    if (field !== 'telephone' && !quote[field]) throw new Error('Missing field');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(quote.courriel)) throw new Error('Invalid email');
  return quote;
}

function sendQuote(quote, apiKey, from) {
  const text = [
    'Nom : ' + quote.nom,
    'Courriel : ' + quote.courriel,
    'Téléphone : ' + (quote.telephone || 'Non indiqué'),
    'Ville : ' + quote.ville,
    'Type de travaux : ' + quote.service,
    '',
    quote.projet
  ].join('\n');

  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [recipient],
      reply_to: quote.courriel,
      subject: 'Demande de soumission – Ford Habitation',
      text
    }),
    signal: AbortSignal.timeout(10_000)
  });
}

export function createSiteServer({ apiKey = process.env.RESEND_API_KEY, from = process.env.QUOTE_FROM } = {}) {
  let windowEnds = 0;
  let attempts = 0;

  return createServer(async (request, response) => {
    const path = request.url.split('?')[0];
    if (path === '/api/soumission') {
      if (request.method !== 'POST') return reply(response, 405);
      if (request.headers['content-type'] !== 'application/json') return reply(response, 415);

      let quote;
      try {
        quote = await readQuote(request);
      } catch {
        return reply(response, 400);
      }

      if (!apiKey || !from) return reply(response, 503);
      if (Date.now() >= windowEnds) {
        attempts = 0;
        windowEnds = Date.now() + 60_000;
      }
      if (attempts >= 10) return reply(response, 429);
      attempts += 1;

      try {
        const result = await sendQuote(quote, apiKey, from);
        await result.body?.cancel();
        return reply(response, result.ok ? 204 : 502);
      } catch {
        return reply(response, 502);
      }
    }

    const asset = assets.get(path) || (
      /^\/assets\/realisations\/[a-z-]+\.jpg$/.test(path)
        ? [path.slice(1), 'image/jpeg']
        : null
    );
    if (!asset || request.method !== 'GET') return reply(response, 404);

    try {
      const body = await readFile(new URL(asset[0], import.meta.url));
      response.writeHead(200, { 'Content-Type': asset[1], 'Cache-Control': 'no-store' }).end(body);
    } catch (error) {
      return reply(response, error.code === 'ENOENT' ? 404 : 500);
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const host = process.env.HOST || '127.0.0.1';
  const port = Number(process.env.PORT || 4318);
  createSiteServer().listen(port, host, () => console.log('Ford Habitation : http://' + host + ':' + port));
}
