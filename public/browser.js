const tabsContainer = document.createElement("div");
tabsContainer.id = "tabsContainer";
document.body.insertBefore(tabsContainer, document.getElementById("frame"));

let tabs = [];
let activeTabId = null;

// Function to create a new tab
function createTab(url = "https://example.com") {
    const tabId = Date.now().toString();

    const tabEl = document.createElement("div");
    tabEl.classList.add("tab");
    tabEl.textContent = url;
    tabEl.dataset.id = tabId;
    tabsContainer.appendChild(tabEl);

    tabEl.addEventListener("click", () => switchTab(tabId));

    const tab = { id: tabId, url, element: tabEl };
    tabs.push(tab);

    switchTab(tabId);
}

// Function to switch active tab
function switchTab(tabId) {
    if (activeTabId === tabId) return;

    activeTabId = tabId;
    tabs.forEach(t => t.element.classList.remove("active"));

    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    tab.element.classList.add("active");
    loadProxy(tab.url);
}

// Load proxy iframe
function loadProxy(url) {
    const frame = document.getElementById("frame");
    frame.src = `/proxy?url=${encodeURIComponent(url)}`;
}

// GO button click
document.getElementById("goBtn").addEventListener("click", () => {
    const url = document.getElementById("urlInput").value.trim();
    if (!url) return;

    // Update active tab or create new
    if (activeTabId) {
        const tab = tabs.find(t => t.id === activeTabId);
        tab.url = url;
        tab.element.textContent = url;
        loadProxy(url);
    } else {
        createTab(url);
    }
});

// Start with one tab
createTab("https://example.com");
