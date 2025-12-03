// browser.js
(function(){
  /* DOM */
  const addressEl = document.getElementById('address');
  const goBtn = document.getElementById('goBtn');
  const reloadBtn = document.getElementById('reloadBtn');
  const viewer = document.getElementById('viewer');
  const loader = document.getElementById('loader');
  const statusEl = document.getElementById('status');
  const cloakToggle = document.getElementById('cloakToggle');
  const faviconEl = document.getElementById('favicon');
  const openNew = document.getElementById('openNew');
  const panicBtn = document.getElementById('panicBtn');
  const cloakOverlay = document.getElementById('cloakOverlay');
  const cloakContent = document.getElementById('cloakContent');
  const cloakPreset = document.getElementById('cloakPreset');
  const siteFaviconLink = document.getElementById('site-favicon');

  const authStatus = document.getElementById('authStatus');
  const showSignup = document.getElementById('showSignup');
  const showLogin = document.getElementById('showLogin');
  const doLogout = document.getElementById('doLogout');

  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modalTitle');
  const mUsername = document.getElementById('m_username');
  const mPassword = document.getElementById('m_password');
  const modalSubmit = document.getElementById('modalSubmit');
  const modalCancel = document.getElementById('modalCancel');
  const modalMessage = document.getElementById('modalMessage');

  /* state */
  let currentUrl = '';
  let isLoading = false;
  let isCloaked = false;
  let savedDocumentTitle = document.title;
  let savedFaviconHref = siteFaviconLink ? siteFaviconLink.href : '';
  let modalMode = 'signup';

  const CLOAK_HOTKEY = { key: 'Q', shift: true };

  /* helpers */
  function setStatus(s){ statusEl.textContent = s; }
  function showLoader(show){ if (show) loader.classList.remove('hidden'); else loader.classList.add('hidden'); }

  function normalizeUrl(input){
    let v = input && input.trim();
    if (!v) return null;
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(v)) v = 'https://' + v;
    try { return (new URL(v)).href; } catch { return null; }
  }
  function buildProxyUrl(target){ return '/api/proxy?url=' + encodeURIComponent(target); }

  /* auth helpers */
  async function checkAuth() {
    // quick ping to proxy to verify auth when idle (safe)
    try {
      const r = await fetch('/api/proxy?url=' + encodeURIComponent(location.origin + '/_auth_ping'), { method: 'GET' });
      // if 401 -> unauthenticated (we expect 400 or 200)
      if (r.status === 401) { setUnauthed(); return false; }
      // if non-401, consider signed in
      setAuthed((await r.json()).username || 'User');
      return true;
    } catch (e) {
      // fallback: check a simple endpoint
      // We'll just try /api/login existence
      try {
        const r2 = await fetch('/api/login', { method: 'OPTIONS' });
        setUnauthed();
      } catch { setUnauthed(); }
      return false;
    }
  }

  function setAuthed(name){
    authStatus.textContent = 'Signed in: ' + (name || 'user');
    showSignup.classList.add('hidden');
    showLogin.classList.add('hidden');
    doLogout.classList.remove('hidden');
  }
  function setUnauthed(){
    authStatus.textContent = 'Not signed in';
    showSignup.classList.remove('hidden');
    showLogin.classList.remove('hidden');
    doLogout.classList.add('hidden');
  }

  async function submitAuth(mode, username, password) {
    const url = mode === 'signup' ? '/api/signup' : '/api/login';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const j = await res.json().catch(()=>({}));
    if (res.ok) {
      setAuthed(j.username || username);
      hideModal();
      return { ok:true };
    } else {
      return { ok:false, error: j.error || 'failed' };
    }
  }

  async function doLogoutFetch(){
    await fetch('/api/logout', { method: 'POST' }).catch(()=>{});
    setUnauthed();
  }

  /* navigation */
  async function navigate(rawInput){
    const resolved = normalizeUrl(rawInput || addressEl.value || '');
    if (!resolved) { setStatus('invalid URL'); return; }
    addressEl.value = resolved;
    currentUrl = resolved;

    const useCloak = cloakToggle.checked;
    viewer.src = 'about:blank';
    showLoader(true);
    setStatus('loading…');
    await new Promise(r=>setTimeout(r,80));
    viewer.src = useCloak ? buildProxyUrl(resolved) : resolved;
    isLoading = true;
  }

  /* cloak */
  function setPageFavicon(href){
    try {
      if (!siteFaviconLink) {
        const link = document.createElement('link');
        link.id = 'site-favicon';
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      const link = document.getElementById('site-favicon');
      link.href = href;
    } catch {}
  }

  function generateEmojiFavicon(emoji){
    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0,0,64,64);
      ctx.font = '48px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, 32, 32);
      return canvas.toDataURL('image/png');
    } catch { return 'data:,'; }
  }

  function getCloakHTML(preset){
    switch (preset) {
      case 'calculator':
        return '<div class="cloak-doc-title">Calculator</div><div class="cloak-doc-body"><input id="calcDisplay" placeholder="0" style="width:100%;padding:10px;border-radius:8px;border:1px solid #e6e9ef" /><div style="display:flex;gap:8px;margin-top:8px;"><button data-op>7</button><button data-op>8</button><button data-op>9</button><button data-op>4</button><button data-op>5</button><button data-op>6</button><button data-op>1</button><button data-op>2</button><button data-op>3</button><button data-op>0</button><button data-op>.</button><button id="calcEval">=</button></div></div>';
      case 'classroom':
        return '<div class="cloak-doc-title">Classroom — Today</div><div class="cloak-doc-body"><ul><li>Math: worksheet</li><li>Science: read chapter</li><li>History: review map</li></ul></div>';
      case '404':
        return '<div class="cloak-doc-title">404 — Not Found</div><div class="cloak-doc-body">The page could not be found.</div>';
      default:
        return '<div class="cloak-doc-title">Document</div><div class="cloak-doc-body"><textarea style="width:100%;height:160px;border-radius:8px;padding:12px;border:1px solid #e6e9ef" placeholder="Write..."></textarea></div>';
    }
  }

  function applyCloakPreset(preset){
    cloakContent.innerHTML = getCloakHTML(preset);
    if (preset === 'calculator') {
      const display = cloakContent.querySelector('#calcDisplay');
      const buttons = cloakContent.querySelectorAll('[data-op]');
      buttons.forEach(b => b.addEventListener('click', ()=> display.value = (display.value === '0' ? '' : display.value) + b.textContent));
      const evalBtn = cloakContent.querySelector('#calcEval');
      evalBtn && evalBtn.addEventListener('click', ()=> {
        try { display.value = String(eval(display.value || '0')); } catch { display.value = 'Err'; }
      });
    }
  }

  function enableCloak(preset){
    if (isCloaked) return;
    savedDocumentTitle = document.title;
    savedFaviconHref = (document.getElementById('site-favicon') || {}).href || '';
    let emoji = '📄';
    if (preset === 'calculator') emoji = '🧮';
    else if (preset === 'classroom') emoji = '🏫';
    else if (preset === '404') emoji = '❌';
    document.title = preset === 'classroom' ? 'Google Classroom' : (preset === 'calculator' ? 'Calculator' : (preset === '404' ? '404 Not Found' : 'Document'));
    setPageFavicon(generateEmojiFavicon(emoji));
    applyCloakPreset(preset);
    cloakOverlay.classList.remove('hidden');
    viewer.style.visibility = 'hidden';
    isCloaked = true;
    setStatus('cloaked');
  }
  function disableCloak(){
    if (!isCloaked) return;
    document.title = savedDocumentTitle || 'OblivionOS — Proxy Browser';
    if (savedFaviconHref) setPageFavicon(savedFaviconHref); else setPageFavicon('data:,');
    cloakOverlay.classList.add('hidden');
    viewer.style.visibility = 'visible';
    isCloaked = false;
    setStatus('idle');
  }
  function toggleCloak(){ if (isCloaked) disableCloak(); else enableCloak(cloakPreset.value || 'blank'); }

  /* events */
  goBtn.addEventListener('click', ()=> navigate(addressEl.value));
  addressEl.addEventListener('keydown', (e)=> { if (e.key === 'Enter') navigate(addressEl.value); });
  reloadBtn.addEventListener('click', ()=> {
    if (!currentUrl) return;
    showLoader(true);
    setStatus('reloading...');
    viewer.src = cloakToggle.checked ? buildProxyUrl(currentUrl) : currentUrl;
  });
  openNew.addEventListener('click', ()=> { if (!currentUrl) return window.open(currentUrl, '_blank'); });

  panicBtn.addEventListener('click', toggleCloak);
  cloakPreset.addEventListener('change', ()=> { if (isCloaked) applyCloakPreset(cloakPreset.value); });

  viewer.addEventListener('load', ()=> {
    try { faviconEl.textContent = '🌐'; } catch {}
    setTimeout(()=> { showLoader(false); setStatus('idle'); isLoading=false; }, 300);
  });

  window.addEventListener('keydown', function(ev){
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement.isContentEditable) return;
    if (ev.key.toUpperCase() === CLOAK_HOTKEY.key && !!ev.shiftKey === !!CLOAK_HOTKEY.shift) { ev.preventDefault(); toggleCloak(); }
  });

  // auth UI bindings
  showSignup.addEventListener('click', ()=> openModal('signup'));
  showLogin.addEventListener('click', ()=> openModal('login'));
  doLogout.addEventListener('click', async ()=> { await doLogoutFetch(); });

  modalCancel.addEventListener('click', hideModal);
  modalSubmit.addEventListener('click', async ()=>{
    const u = mUsername.value && mUsername.value.trim();
    const p = mPassword.value;
    if (!u || !p) { modalMessage.textContent = 'username and password required'; return; }
    modalMessage.textContent = '...';
    const result = await submitAuth(modalMode, u, p);
    if (!result.ok) modalMessage.textContent = (result.error || 'failed');
    else modalMessage.textContent = '';
  });

  async function openModal(mode){
    modalMode = mode;
    modalTitle.textContent = mode === 'signup' ? 'Sign up' : 'Login';
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    mUsername.value = '';
    mPassword.value = '';
    modalMessage.textContent = '';
    mUsername.focus();
  }
  function hideModal(){
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  }

  // initial auth check
  (async ()=> {
    // check by calling /api/proxy with a safe internal ping - implement server returns 200 with info when proxied origin matches special path
    try {
      // build a fake ping URL that the proxy will fetch; the proxy will try to fetch location.origin + '/_auth_ping'
      const ping = '/api/proxy?url=' + encodeURIComponent(location.origin + '/_auth_ping');
      const r = await fetch(ping, { method: 'GET' });
      if (r.status === 401) { setUnauthed(); }
      else if (r.ok) {
        // server may return JSON if target returns JSON; but some servers will block; best-effort
        setAuthed('you');
      } else setUnauthed();
    } catch (e) {
      // fallback
      setUnauthed();
    }
  })();

  // expose debug
  window.oblivionNavigate = navigate;
  window.oblivionToggleCloak = toggleCloak;
  window.oblivionIsCloaked = ()=> isCloaked;

  // init UI
  addressEl.placeholder = 'https://example.com';
  addressEl.focus();
})();
