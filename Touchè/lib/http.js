'use strict';
// Livello HTTP: router JSON, cache delle risposte pubbliche, compressione, ETag e file statici con cache a lungo termine.
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib');

class HttpError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const bad = (msg, code = 400) => { throw new HttpError(code, msg); };

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json',
};
const COMPRESSIBLE = /^(text\/|application\/json|image\/svg)/;
const etagOf = buf => '"' + crypto.createHash('sha1').update(buf).digest('base64url').slice(0, 20) + '"';
const SECURITY = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'SAMEORIGIN' };

function encodingFor(req) {
  const ae = req.headers['accept-encoding'] || '';
  return /\bbr\b/.test(ae) ? 'br' : /\bgzip\b/.test(ae) ? 'gzip' : null;
}

// Invia un corpo già pronto (con varianti compresse) rispettando If-None-Match.
function send(req, res, status, entry, headers) {
  const h = { ...SECURITY, 'Content-Type': entry.type, ETag: entry.etag, Vary: 'Accept-Encoding', ...headers };
  if (status === 200 && req.headers['if-none-match'] === entry.etag) { res.writeHead(304, h); return res.end(); }
  const enc = encodingFor(req);
  let body = entry.buf;
  if (enc && entry.buf.length > 1024 && COMPRESSIBLE.test(entry.type)) {
    entry.z ||= {};
    body = entry.z[enc] ||= enc === 'br' ? zlib.brotliCompressSync(entry.buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }) : zlib.gzipSync(entry.buf, { level: 6 });
    h['Content-Encoding'] = enc;
  }
  h['Content-Length'] = body.length;
  res.writeHead(status, h);
  res.end(req.method === 'HEAD' ? undefined : body);
}

function createApp({ publicDir, version = () => 0, sync = () => {}, cacheable = () => false }) {
  const routes = [];
  const route = (method, re, fn) => routes.push([method, new RegExp('^' + re + '$'), fn]);

  // Cache delle risposte pubbliche: valida finché la versione dei dati non cambia.
  const cache = new Map(), MAX = 800;
  const cacheGet = k => { const e = cache.get(k); if (e && e.v === version()) { cache.delete(k); cache.set(k, e); return e; } return null; };
  const cachePut = (k, e) => { cache.set(k, e); if (cache.size > MAX) cache.delete(cache.keys().next().value); };

  // File statici in memoria (ricaricati se cambiano su disco). index.html punta a app.js/style.css con ?v=<hash>.
  const files = new Map();
  function loadFile(f) {
    let st; try { st = fs.statSync(f); } catch { return null; }
    if (!st.isFile()) return null;
    const old = files.get(f);
    if (old && old.mtime === st.mtimeMs) return old;
    let buf = fs.readFileSync(f);
    if (path.basename(f) === 'index.html') {
      buf = Buffer.from(buf.toString('utf8').replace(/(href|src)="(app\.js|style\.css)"/g, (m, a, name) => { const e = loadFile(path.join(publicDir, name)); return `${a}="${name}?v=${e ? e.etag.slice(1, 11) : '0'}"`; }));
    }
    const e = { mtime: st.mtimeMs, buf, etag: etagOf(buf), type: MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' };
    files.set(f, e);
    return e;
  }
  function serveStatic(req, res, url) {
    let p; try { p = decodeURIComponent(url.pathname); } catch { p = '/'; }
    if (p === '/') p = '/index.html';
    const f = path.join(publicDir, path.normalize(p));
    const e = f.startsWith(publicDir) ? loadFile(f) : null;
    if (!e) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Non trovato'); }
    if (path.basename(f) === 'index.html') files.delete(f); // l'hash degli asset può cambiare: si rigenera
    const cc = url.searchParams.has('v') ? 'public, max-age=31536000, immutable' : /\.html$/.test(f) ? 'no-cache' : 'public, max-age=86400';
    send(req, res, 200, e, { 'Cache-Control': cc });
  }

  const json = (obj, status = 200) => { const buf = Buffer.from(JSON.stringify(obj)); return { status, buf, etag: etagOf(buf), type: 'application/json; charset=utf-8' }; };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url);
    sync();
    const key = url.pathname + url.search, isGet = req.method === 'GET', canCache = isGet && cacheable(url.pathname);
    if (canCache) { const hit = cacheGet(key); if (hit) return send(req, res, 200, hit, { 'Cache-Control': 'no-cache' }); }
    let raw = '';
    req.on('data', d => { raw += d; if (raw.length > 12e6) req.destroy(); });
    req.on('end', () => {
      try {
        for (const [m, re, fn] of routes) {
          const match = re.exec(url.pathname);
          if (m === req.method && match) {
            const body = raw ? JSON.parse(raw) : {};
            const v = version(), out = fn(req, body, res, match.slice(1), url), e = json(out);
            if (canCache) { e.v = v; cachePut(key, e); }
            return send(req, res, 200, e, { 'Cache-Control': isGet ? 'no-cache' : 'no-store' });
          }
        }
        throw new HttpError(404, 'Non trovato');
      } catch (err) {
        const code = err instanceof HttpError ? err.code : err instanceof SyntaxError ? 400 : 500;
        if (code === 500) console.error(err);
        const e = json({ error: code === 500 ? 'Errore interno' : err.message });
        send(req, res, code, e, { 'Cache-Control': 'no-store' });
      }
    });
  });
  return { route, server };
}

module.exports = { createApp, HttpError, bad };
