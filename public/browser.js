let currentTab = null;
let tabs = [];
let useProxy = false;

// Replace with your Vercel project proxy URL
const proxyURL = "https://oblivion-os.vercel.app/api/proxy?url=";

// Create a new tab
function newTab(url = "https://example.com") {
  const id = Date.now();
  const tab = { id, url };
  tabs.push(tab);

  const tabDiv = document.createElement("div");
  tabDiv.className = "tab";
  tabDiv.textContent = "Tab";
  tabDiv.dataset.id = id;
  tabDiv.onclick = () => switchTab(id);
  document.getElementById("tabs").appendChild(tabDiv);

  switchTab(id);
}

// Switch to a tab by ID
function switchTab(id) {
  currentTab = tabs.find(t => t.id === id);
  if (!currentTab) return;

  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.querySelector(`.tab[data-id='${id}']`).classList.add("active");

  document.getElementById("url").value = currentTab.url;
  load(currentTab.url);
}

// Load a URL into the iframe
function load(url) {
  const frame = document.getElementById("view");
  frame.src = useProxy ? proxyURL + encodeURIComponent(url) : url;
}

// Navigate using the Go button or Enter key
function go() {
  if (!currentTab) return;
  let u = document.getElementById("url").value.trim();
  if (!u.startsWith("http")) u = "https://" + u;
  currentTab.url = u;
  load(u);
}

// Save a bookmark
function saveBookmark() {
  const bar = document.getElementById("bookmarkBar");
  const url = document.getElementById("url").value.trim();
  if (!url) return;

  const b = document.createElement("div");
  b.textContent = url;
  b.onclick = () => {
    document.getElementById("url").value = url;
    go();
  };
  bar.appendChild(b);
}

// Run JavaScript on the iframe page
function runJS() {
  const code = prompt("Enter JavaScript to run on this page:");
  if (!code) return;

  const frame = document.getElementById("view");
  try {
    frame.contentWindow.eval(code);
  } catch (e) {
    alert("Error running JS");
  }
}

// Toggle proxy on/off
function toggleProxy() {
  useProxy = !useProxy;
  if (currentTab) load(currentTab.url);
}

// Initialize with a default tab
window.onload = () => {
  newTab("https://example.com");

  // Optional: trigger Go when pressing Enter in URL input
  const urlInput = document.getElementById("url");
  urlInput.addEventListener("keypress", e => {
    if (e.key === "Enter") go();
  });
};
