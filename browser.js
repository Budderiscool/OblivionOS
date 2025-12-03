// browser.js
(function(){
  const addressEl = document.getElementById('address');
  const goBtn = document.getElementById('goBtn');
  const reloadBtn = document.getElementById('reloadBtn');
  const viewer = document.getElementById('viewer');
  const loader = document.getElementById('loader');
  const statusEl = document.getElementById('status');
  const cloakToggle = document.getElementById('cloakToggle');
  const favicon = document.getElementById('favicon');
  const openNew = document.getElementById('openNew');

  let currentUrl = '';
  let isLoading = false;

  function setStatus(s){
    statusEl.textContent = s;
  }

  function showLoader(show){
    if (show) {
      loader.classList.remove('hidden');
    } else {
      loader.classList.add('hidden');
    }
  }

  function normalizeUrl(input){
    let v = input.trim();
    if (!v) return null;
    // If user entered something without protocol, assume https
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(v)) {
      v = 'https://' + v;
    }
    try {
      const u = new URL(v);
      return u.href;
    } catch {
      return null;
    }
  }

  function buildProxyUrl(target){
    return '/api/proxy?url=' + encodeURIComponent(target);
  }

  async function navigate(rawInput){
    const resolved = normalizeUrl(rawInput || addressEl.value || '');
    if (!resolved) {
      setStatus('invalid URL');
      return;
    }

    // update UI
    addressEl.value = resolved;
    currentUrl = resolved;

    const useCloak = cloakToggle.checked;

    // Show about:blank first to avoid flashes; then load spinner and set iframe src
    viewer.src = 'about:blank';
    showLoader(true);
    setStatus('loading...');

    // small delay so about:blank renders for perceived smoothness
    await new Promise(r => setTimeout(r, 80));

    if (useCloak) {
      viewer.src = buildProxyUrl(resolved);
    } else {
      viewer.src = resolved;
    }
    isLoading = true;
  }

  // Events
  goBtn.addEventListener('click', () => navigate(addressEl.value));
  addressEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') navigate(addressEl.value);
  });

  reloadBtn.addEventListener('click', () => {
    if (!currentUrl) return;
    // reload by reassigning src
    const useCloak = cloakToggle.checked;
    showLoader(true);
    setStatus('reloading...');
    viewer.src = useCloak ? buildProxyUrl(currentUrl) : currentUrl;
  });

  openNew.addEventListener('click', () => {
    if (!currentUrl) return window.open(currentUrl, '_blank');
    // open the real URL in new tab (not proxied) - because proxied content can conflict with modern browsers when opened directly
    window.open(currentUrl, '_blank');
  });

  // iframe load handling
  viewer.addEventListener('load', () => {
    // try to set favicon based on currentUrl
    try {
      const urlBase = (new URL(viewer.src, location.href)).origin;
      favicon.textContent = '🌐';
    } catch {}
    // small delay to keep loader visible until content settles
    setTimeout(()=> {
      showLoader(false);
      setStatus('idle');
      isLoading = false;
    }, 350);
  });

  // message listener to accept status updates from proxied pages if they postMessage
  window.addEventListener('message', (ev) => {
    try {
      if (ev && ev.data && typeof ev.data === 'object' && ev.data.__oblivion_status) {
        setStatus(ev.data.__oblivion_status);
      }
    } catch {}
  });

  // quick helpers: sample placeholder when page is blank
  addressEl.placeholder = 'https://example.com';

  // expose navigate for debugging
  window.oblivionNavigate = navigate;

  // init: focus address
  addressEl.focus();
})();
