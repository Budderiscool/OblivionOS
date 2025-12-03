// api/proxy.js
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import { parse as parseCookie } from 'cookie';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret';

// USERS store exists server-side from signup/login modules
const USERS = global.__OBLIVION_USERS ||= {};

function isValidUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function escapeHtml(s = '') {
  return String(s).replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Allow only authenticated users
function requireAuth(req) {
  const cookies = req.headers.cookie ? parseCookie(req.headers.cookie || '') : {};
  const token = cookies['oblivion_token'] || null;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return payload;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const auth = requireAuth(req);
  if (!auth) {
    return res.status(401).json({ error: 'unauthenticated' });
  }

  const target = req.query.url;
  if (!target) return res.status(400).json({ error: 'Missing url parameter' });
  if (!isValidUrl(target)) return res.status(400).json({ error: 'Invalid url' });

  try {
    // Fetch remote
    const remoteRes = await fetch(target, {
      headers: {
        'user-agent': req.headers['user-agent'] || 'Mozilla/5.0 (OblivionOS Proxy)',
        // don't forward client cookies
      },
      redirect: 'follow'
    });

    const contentType = (remoteRes.headers.get('content-type') || '').toLowerCase();

    // binary or non-html -> stream back
    if (!contentType.includes('text/html')) {
      const buffer = await remoteRes.arrayBuffer();
      // forward content-type
      res.setHeader('Content-Type', contentType || 'application/octet-stream');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('X-OblivionOS', 'cloaked-proxy');
      // forward status and data
      return res.status(remoteRes.status).send(Buffer.from(buffer));
    }

    // text/html -> modify
    let body = await remoteRes.text();

    // Attempt to rewrite inline CSS url(...) and meta refreshes and srcset attributes before injecting script
    // 1) Rewrite url(...) occurrences in inline style and style tags to absolute and proxy them.
    // We'll replace url(<whatever>) with url(/api/proxy?url=ENCODED)
    // Caution: regex approach is heuristic but improves many cases.
    body = body.replace(/url\(([^)]+)\)/gi, (m, p1) => {
      // strip quotes
      let raw = p1.trim().replace(/^["']|["']$/g, '');
      try {
        const abs = new URL(raw, target).href;
        return `url('/api/proxy?url=${encodeURIComponent(abs)}')`;
      } catch (e) {
        return m;
      }
    });

    // 2) Rewrite meta refresh redirect tags
    body = body.replace(/<meta\s+http-equiv=["']refresh["'][^>]*content=["']?([^"'>]+)["']?[^>]*>/gi, (m, content) => {
      // content like "5;url=/foo"
      try {
        const parts = content.split(';').map(s => s.trim());
        const wait = parts[0];
        let urlPart = parts.slice(1).join(';') || '';
        const match = urlPart.match(/url=(.*)/i);
        if (match) {
          const raw = match[1].replace(/^["']|["']$/g, '');
          const abs = new URL(raw, target).href;
          const proxied = `/api/proxy?url=${encodeURIComponent(abs)}`;
          return `<meta http-equiv="refresh" content="${escapeHtml(wait)};url=${escapeHtml(proxied)}">`;
        }
        return m;
      } catch {
        return m;
      }
    });

    // 3) Inject base tag into head so relative URLs resolve
    const baseTag = `<base href="${escapeHtml(target)}">`;
    if (/<head[^>]*>/i.test(body)) {
      body = body.replace(/<head([^>]*)>/i, `<head$1>\n${baseTag}\n`);
    } else {
      body = '<head>' + baseTag + '</head>' + body;
    }

    // 4) Injection script to rewrite attributes dynamically (adds srcset + lazy attrs handling)
    const injectionScript = `
<script>
(function(){
  function resolveUrl(url){ try { return new URL(url, document.baseURI).href; } catch { return url; } }
  function isProxiable(u){
    if (!u) return false;
    try {
      const parsed = new URL(u, document.baseURI);
      if (/^(data|blob|about|javascript):/i.test(parsed.protocol)) return false;
      return true;
    } catch { return false; }
  }
  function proxyize(u){
    if (!u) return u;
    if (!isProxiable(u)) return u;
    const abs = resolveUrl(u);
    // already proxied?
    if (abs.includes('/api/proxy?url=' + encodeURIComponent(abs))) return u;
    return '/api/proxy?url=' + encodeURIComponent(abs);
  }

  function rewriteNode(node, attr){
    const orig = node.getAttribute(attr);
    if (!orig) return;
    // handle srcset specially
    if (attr === 'srcset') {
      try {
        const parts = orig.split(',');
        const mapped = parts.map(p=>{
          const seg = p.trim();
          const [url, descriptor] = seg.split(/\s+/, 2);
          const prox = proxyize(url);
          return descriptor ? prox + ' ' + descriptor : prox;
        }).join(', ');
        node.setAttribute(attr, mapped);
        return;
      } catch {}
    }

    // regular attributes (src, href, action, data, poster, srcdoc not handled)
    const prox = proxyize(orig);
    if (prox !== orig) node.setAttribute(attr, prox);
  }

  function rewriteAll(){
    const rules = [
      {sel:'img', attrs:['src','srcset','data-src','data-srcset']},
      {sel:'script', attrs:['src']},
      {sel:'link[rel~="stylesheet"]', attrs:['href']},
      {sel:'a', attrs:['href']},
      {sel:'iframe', attrs:['src']},
      {sel:'source', attrs:['src','srcset']},
      {sel:'video', attrs:['src','poster']},
      {sel:'audio', attrs:['src']},
      {sel:'embed', attrs:['src']},
      {sel:'object', attrs:['data']},
      {sel:'form', attrs:['action']}
    ];
    rules.forEach(r=>{
      Array.from(document.querySelectorAll(r.sel)).forEach(node=>{
        r.attrs.forEach(attr => rewriteNode(node, attr));
      });
    });
  }

  // rewrite inline style attributes that contain url(...) (heuristic)
  function rewriteInlineStyles(){
    Array.from(document.querySelectorAll('[style]')).forEach(el=>{
      const s = el.getAttribute('style');
      if (!s) return;
      const ns = s.replace(/url\$begin:math:text$\(\[\^\)\]\+\)\\$end:math:text$/gi, function(m, p1){
        const raw = p1.replace(/^["']|["']$/g,'').trim();
        try {
          const abs = new URL(raw, document.baseURI).href;
          return "url('/api/proxy?url=" + encodeURIComponent(abs) + "')";
        } catch(e){ return m; }
      });
      if (ns !== s) el.setAttribute('style', ns);
    });
  }

  // intercept clicks so that navigation stays proxied
  document.addEventListener('click', function(e){
    const a = e.target.closest && e.target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href) return;
    if (href.startsWith('#')) return;
    if (href.includes('/api/proxy')) return;
    e.preventDefault();
    const resolved = resolveUrl(href);
    window.location.href = '/api/proxy?url=' + encodeURIComponent(resolved);
  }, true);

  // intercept form submits
  document.addEventListener('submit', function(e){
    const form = e.target;
    if (!form) return;
    const method = (form.method || 'GET').toUpperCase();
    const action = form.getAttribute('action') || document.baseURI;
    const abs = resolveUrl(action);
    if (method === 'GET') {
      const params = new URLSearchParams(new FormData(form)).toString();
      e.preventDefault();
      window.location.href = '/api/proxy?url=' + encodeURIComponent(abs + (abs.includes('?') ? '&' : '?') + params);
    } else {
      e.preventDefault();
      // POST via fetch and replace document
      fetch('/api/proxy?url=' + encodeURIComponent(abs), { method: 'POST', body: new FormData(form) })
        .then(r => r.text()).then(html => {
          document.open(); document.write(html); document.close();
        }).catch(console.error);
    }
  }, true);

  // Observe changes and rewrite
  const mo = new MutationObserver(function(){ try { rewriteAll(); rewriteInlineStyles(); } catch(e){} });
  mo.observe(document.documentElement || document, { childList:true, subtree:true, attributes:true });

  // initial rewrite: run on DOMContentLoaded or immediately
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ()=>{ rewriteAll(); rewriteInlineStyles(); });
  else { rewriteAll(); rewriteInlineStyles(); }

  // expose for debugging
  window.__oblivion_rewrite = function(){ rewriteAll(); rewriteInlineStyles(); };
})();
</script>
`;

    // Inject script before </body>
    if (/<\/body>/i.test(body)) {
      body = body.replace(/<\/body>/i, injectionScript + '\n</body>');
    } else {
      body = body + injectionScript;
    }

    // Return modified HTML with safe headers
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-OblivionOS', 'cloaked-proxy');
    // remove CSP to allow our script (we don't forward remote CSP header)
    return res.status(remoteRes.status).send(body);

  } catch (err) {
    console.error('proxy error', err);
    return res.status(500).json({ error: 'fetch failed' });
  }
}
