// References
const tabsContainer = document.getElementById("tabsContainer");
const urlInput = document.getElementById("urlInput");
const goBtn = document.getElementById("goBtn");
const frame = document.getElementById("frame");

// Tabs data
let tabs = [];
let activeTabId = null;

// Create a new tab
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

// Switch active tab
function switchTab(tabId) {
    if (activeTabId === tabId) return;
    activeTabId = tabId;

    tabs.forEach(t => t.element.classList.remove("active"));
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    tab.element.classList.add("active");

    // Smooth fade
    frame.style.opacity = 0;
    setTimeout(() => {
        frame.src = `/proxy?url=${encodeURIComponent(tab.url)}`;
        frame.style.opacity = 1;
    }, 150);
}

// Go button
goBtn.addEventListener("click", () => {
    const url = urlInput.value.trim();
    if (!url) return;

    if (activeTabId) {
        const tab = tabs.find(t => t.id === activeTabId);
        tab.url = url;
        tab.element.textContent = url;
        switchTab(tab.id);
    } else {
        createTab(url);
    }
});

// Enter key in input
urlInput.addEventListener("keypress", e => {
    if (e.key === "Enter") goBtn.click();
});

// Start with one tab
createTab("https://example.com");
