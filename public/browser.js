let currentTab = null;
let tabs = [];
let useProxy = false;

// Replace with your Vercel project proxy URL
const proxyURL = "https://oblivion-os.vercel.app/api/proxy?url=";

// Create a new tab
function newTab(url = "https://example.com") {
  const id = Date.now();
  const tab = { id, url, title: "Tab" };
  tabs.push(tab);

  const tabDiv = document.createElement("div");
  tabDiv.className = "tab";
  tabDiv.textContent = tab.title;
  tabDiv.dataset.id = id;
  tabDiv.onclick = () => switchTab(id);

  // Insert before the new tab button
  const newTabBtn = document.querySelector(".tab.newtab");
  newTabBtn.parentNode.insertBefore(tabDiv, newTabBtn);

  switchTab(id);
}

// Switch to a tab by ID
function switchTab(id) {
  currentTab = tabs.find(t => t.id === id);
  if (!currentTab) return;

  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  const activeTab = document.querySelector(`.tab[data-id='${id}']`);
  if (activeTab) activeTab.classList.add("active");

  document.getElementById("url").value = currentTab.url;
  load(currentTab.url);
}

// Load a URL into the iframe
function load(url) {
  const frame = document.getElementById("view");
  frame.src = useProxy ? proxyURL + encodeURIComponent(url) : url;

  // Update tab title after load
  frame.onload = () => {
    if (currentTab) {
      currentTab.title = frame.contentDocument?.title || url;
      const tabDiv = document.querySelector(`.tab[data-id='${currentTab.id}']`);
      if (tabDiv) tabDiv.textContent = currentTab.title || "Tab";
    }
  };
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
  b.title = url; // tooltip
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
    alert("Error running JS: " + e.message);
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

  // Trigger Go when pressing Enter in URL input
  const urlInput = document.getElementById("url");
  urlInput.addEventListener("keypress", e => {
    if (e.key === "Enter") go();
  });
};
