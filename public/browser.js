let currentTab = null, tabs = [], useProxy = false;
const proxyURL = "https://YOUR-PROJECT-NAME.vercel.app/api/proxy?url=";

function newTab(url = "about:blank") {
  const id = Date.now();
  const tab = { id, url };
  tabs.push(tab);

  const tabDiv = document.createElement("div");
  tabDiv.className = "tab";
  tabDiv.textContent = "Tab";
  tabDiv.onclick = () => switchTab(id);
  tabDiv.dataset.id = id;
  document.getElementById("tabs").appendChild(tabDiv);

  switchTab(id);
}

function switchTab(id) {
  currentTab = tabs.find(t => t.id === id);
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.querySelector(`.tab[data-id='${id}']`).classList.add("active");
  document.getElementById("url").value = currentTab.url;
  load(currentTab.url);
}

function go() {
  let u = document.getElementById("url").value.trim();
  if (!u.startsWith("http")) u = "https://" + u;
  currentTab.url = u;
  load(u);
}

function load(url) {
  const frame = document.getElementById("view");
  frame.src = useProxy ? proxyURL + encodeURIComponent(url) : url;
}

function saveBookmark() {
  const bar = document.getElementById("bookmarkBar");
  const url = document.getElementById("url").value.trim();
  if (!url) return;
  const b = document.createElement("div");
  b.textContent = url;
  b.onclick = () => { document.getElementById("url").value = url; go(); };
  bar.appendChild(b);
}

function runJS() {
  const code = prompt("Enter JavaScript to run on this page:");
  if (!code) return;
  const frame = document.getElementById("view");
  try { frame.contentWindow.eval(code); } 
  catch(e){ alert("Error running JS"); }
}

function toggleProxy() {
  useProxy = !useProxy;
  load(currentTab.url);
}

newTab("https://example.com");
