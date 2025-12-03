// api/proxy.js
import fetch from "node-fetch";

/**
 * Simple Vercel serverless proxy with HTML injection for cloaking.
 * Security note: This proxies content and injects scripts — use only for permitted targets.
 */

function isValidUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  const target = req.query.url;
  if (!target) return res.status(400).json({ error: "Missing url parameter" });

  // Basic validation
  if (!isValidUrl(target)) {
    return res.status(400).json({ error: "Invalid url (must start with http:// or https://)" });
  }

  try {
    // Fetch the resource
    const remoteRes = await fetch(target, {
      headers: {
        // Identify as a generic user agent to reduce some blocking
        "user-agent": req.headers["user-agent"] || "Mozilla/5.0 (OblivionOS Proxy)"
      },
      redirect: "follow",
      // don't send cookies from user to remote
    });

    // If remote responded with non-OK but with content, still forward it
    const contentType = remoteRes.headers.get("content-type") || "";

    // Forward non-html resources as bytes
    if (!contentType.includes("text/html")) {
      const buffer = await remoteRes.arrayBuffer();
      // Copy content-type and other essential headers
      res.setHeader("Content-Type", contentType);
      // Allow CORS so iframe / fetch can load resources
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("X-OblivionOS", "cloaked-proxy");
      // Some servers send content-disposition etc; forward filename if present
      const cd = remoteRes.headers.get("content-disposition");
      if (cd) res.setHeader("Content-Disposition", cd);
      return res.status(remoteRes.status).send(Buffer.from(buffer));
    }

    // For HTML, we will inject a base tag and a rewrite script for cloaking.
    let body = await remoteRes.text();

    // Create injection pieces
    const baseTag = `<base href="${escapeHtml(target)}">`;

    // Injection script: rewrites links and resources to route through /api/proxy?url=...
    // It also intercepts form submits and link clicks to keep browsing within the proxy.
    const injectionScript = `
<script>
(function(){
  // Utility: resolve URL relative to base
  function resolveUrl(url){
    try { return new URL(url, document.baseURI).href; } catch { return url; }
  }

  function proxyizeUrl(url){
    if (!url) return url;
    // don't proxy data:, blob:, about:, javascript:
    if (/^(data|blob|about|javascript):/i.test(url)) return url;
    // If already pointing to our api-proxy, leave it
    try {
      const parsed = new URL(url, document.baseURI);
      if (parsed.pathname && parsed.pathname.startsWith('/api/proxy')) return url;
    } catch {}
    return '/api/proxy?url=' + encodeURIComponent(resolveUrl(url));
  }

  function rewriteAttributes(){
    // Elements to rewrite: img, script, link (rel=stylesheet), a, iframe, source, video, audio, embed, object, form
    const attrs = [
      {sel:'img', attr:'src'},
      {sel:'script', attr:'src'},
      {sel:'link[rel~="stylesheet"]', attr:'href'},
      {sel:'a', attr:'href'},
      {sel:'iframe', attr:'src'},
      {sel:'source', attr:'src'},
      {sel:'video', attr:'src'},
      {sel:'audio', attr:'src'},
      {sel:'embed', attr:'src'},
      {sel:'object', attr:'data'},
      {sel:'form', attr:'action'}
    ];

    for (const rule of attrs){
      const nodes = Array.from(document.querySelectorAll(rule.sel));
      for (const node of nodes){
        const original = node.getAttribute(rule.attr);
        if (!original) continue;
        // Keep anchors that are anchors (#...) local
        if (rule.sel === 'a' && original.startsWith('#')) continue;
        try {
          const proxied = proxyizeUrl(original);
          node.setAttribute(rule.attr, proxied);
          // For anchors: add target to keep inside iframe
          if (rule.sel === 'a') node.setAttribute('target', '_self');
        } catch(e){}
      }
    }
  }

  // Intercept clicks on anchors that might be dynamically added later
  document.addEventListener('click', function(e){
    const a = e.target.closest && e.target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href) return;
    // allow same-page anchors
    if (href.startsWith('#')) return;
    // If link already proxied, let it continue
    if (href.includes('/api/proxy')) return;
    e.preventDefault();
    const resolved = resolveUrl(href);
    window.location.href = '/api/proxy?url=' + encodeURIComponent(resolved);
  }, true);

  // Intercept form submits to route action through proxy
  document.addEventListener('submit', function(e){
    const form = e.target;
    if (!form) return;
    const action = form.getAttribute('action') || document.baseURI;
    const method = (form.method || 'GET').toUpperCase();
    // Build absolute action URL
    const abs = resolveUrl(action);
    // For safety, convert GET forms to proxied URL with query string
    if (method === 'GET') {
      const params = new URLSearchParams(new FormData(form)).toString();
      const target = abs + (abs.includes('?') ? '&' : '?') + params;
      e.preventDefault();
      window.location.href = '/api/proxy?url=' + encodeURIComponent(target);
    } else {
      // For POST and others, perform a fetch and replace document contents with response
      e.preventDefault();
      const formData = new FormData(form);
      fetch('/api/proxy?url=' + encodeURIComponent(abs), {
        method: 'POST',
        body: formData
      }).then(r => r.text()).then(html => {
        document.open();
        document.write(html);
        document.close();
      }).catch(console.error);
    }
  }, true);

  // Run at load and after DOM modifications
  function runRewrite(){
    try { rewriteAttributes(); } catch(e){ console.error('rewriteAttributes', e); }
  }

  // observe DOM additions to rewrite dynamically added content
  const mo = new MutationObserver(runRewrite);
  mo.observe(document.documentElement || document, {childList: true, subtree: true});

  // initial rewrite
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runRewrite);
  } else {
    runRewrite();
  }

  // expose function for external triggers
  window.__oblivion_rewrite = runRewrite;
})();
</script>
`;

    // Insert base tag if <head> exists, else create head
    if (/<head[^>]*>/i.test(body)) {
      body = body.replace(/<head([^>]*)>/i, `<head$1>\n${baseTag}\n`);
    } else {
      // prepend head
      body = '<head>' + baseTag + '</head>' + body;
    }

    // Inject our script just before </body> (or at end if no body)
    if (/<\/body>/i.test(body)) {
      body = body.replace(/<\/body>/i, injectionScript + '\n</body>');
    } else {
      body = body + injectionScript;
    }

    // Return modified html
    // Remove or override Content-Security-Policy to avoid blocking our injected script
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("X-OblivionOS", "cloaked-proxy");
    // Don't forward CSP to client
    // Copy content-type
    res.setHeader("Content-Type", "text/html; charset=utf-8");

    return res.status(remoteRes.status).send(body);
  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ error: "Proxy fetch failed", details: String(err) });
  }
}

// small helper to escape double quotes in base href
function escapeHtml(s){
  return s.replace(/"/g, '&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
