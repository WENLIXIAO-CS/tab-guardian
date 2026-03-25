// Tab Guardian — Popup v3.0

// Set theme immediately to avoid flash (must run before DOM renders)
document.documentElement.setAttribute(
  "data-theme",
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
);

let currentThresholdMin = 60;
let $memBarThin, $memLabel, $statTotal, $statStale, $statMem;
let $btnClose, $btnCloseText, $thresholdSelect;
let $groupStale, $groupActive, $listStale, $listActive, $staleCount, $activeCount;

function cacheDom() {
  $memBarThin = document.getElementById("mem-bar-thin");
  $memLabel = document.getElementById("mem-label");
  $statTotal = document.getElementById("stat-total");
  $statStale = document.getElementById("stat-stale");
  $statMem = document.getElementById("stat-mem");
  $btnClose = document.getElementById("btn-close-stale");
  $btnCloseText = document.getElementById("btn-close-text");
  $thresholdSelect = document.getElementById("threshold-select");
  $groupStale = document.getElementById("group-stale");
  $groupActive = document.getElementById("group-active");
  $listStale = document.getElementById("list-stale");
  $listActive = document.getElementById("list-active");
  $staleCount = document.getElementById("stale-count");
  $activeCount = document.getElementById("active-count");
  return !!$listStale && !!$listActive;
}

// ── Formatters ─────────────────────────────────────────────────────

function formatIdle(minutes) {
  if (minutes === Infinity || minutes > 999999) return "n/a";
  if (minutes < 1) return "now";
  if (minutes < 60) return minutes + "m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? h + "h " + m + "m" : h + "h";
}

function fmtBytes(bytes) {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + " GB";
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + " MB";
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + " KB";
  return bytes + " B";
}

function fmtShort(bytes) {
  if (!bytes) return "—";
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + "G";
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + "M";
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + "K";
  return bytes + "B";
}

function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return url || ""; }
}

function faviconUrl(tab) {
  if (tab.favIconUrl && tab.favIconUrl.startsWith("http")) return tab.favIconUrl;
  try {
    return "chrome-extension://" + chrome.runtime.id + "/_favicon/?pageUrl=" + encodeURIComponent(new URL(tab.url).origin) + "&size=16";
  } catch { return ""; }
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

// ── Build a tab row ────────────────────────────────────────────────

function buildRow(tab, idleMin, isStale) {
  const row = document.createElement("div");
  row.className = "tab-row flex items-center px-5 py-2 border-b border-base-content border-opacity-5";
  row.addEventListener("click", () => {
    chrome.tabs.update(tab.id, { active: true });
    chrome.windows.update(tab.windowId, { focused: true });
  });

  // Favicon
  const img = document.createElement("img");
  img.className = "w-4 h-4 rounded-sm flex-shrink-0 opacity-70";
  const src = faviconUrl(tab);
  if (src) img.src = src; else img.style.visibility = "hidden";
  img.addEventListener("error", function () { this.style.visibility = "hidden"; });

  // Info
  const info = document.createElement("div");
  info.className = "flex-1 min-w-0 ml-3 mr-3";
  const domain = getDomain(tab.url);
  info.innerHTML =
    '<div class="text-xs font-medium text-base-content opacity-80 truncate">' + escapeHtml(domain || tab.title) + '</div>' +
    '<div class="text-[10px] text-base-content opacity-30 truncate mt-0.5">' + escapeHtml(domain ? tab.title : "") + '</div>';

  // Right side: memory + idle + menu
  const right = document.createElement("div");
  right.className = "flex items-center gap-3 flex-shrink-0";

  // Memory column (filled async)
  const memCol = document.createElement("div");
  memCol.className = "text-right w-16";
  memCol.innerHTML =
    '<div id="heap-' + tab.id + '" class="text-[10px] font-mono text-base-content opacity-25">···</div>' +
    '<div id="cache-' + tab.id + '" class="text-[10px] font-mono text-base-content opacity-25">···</div>';

  // Idle
  const idle = document.createElement("div");
  idle.className = "text-[10px] font-mono w-10 text-right " +
    (tab.active ? "text-success opacity-60" : isStale ? "text-error opacity-70" : "text-base-content opacity-30");
  idle.textContent = tab.active ? "now" : formatIdle(idleMin);

  // Inline action buttons
  const actions = document.createElement("div");
  actions.className = "flex items-center gap-1";
  actions.addEventListener("click", (e) => e.stopPropagation());

  // Clear cache button
  const cacheBtn = document.createElement("button");
  cacheBtn.className = "btn btn-xs btn-ghost btn-square text-warning opacity-40 hover:opacity-100 hover:bg-warning hover:bg-opacity-10 tooltip tooltip-left";
  cacheBtn.setAttribute("data-tip", "Clear site data");
  cacheBtn.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>';
  cacheBtn.addEventListener("click", () => {
    cacheBtn.innerHTML = '<span class="loading loading-spinner w-3 h-3"></span>';
    chrome.runtime.sendMessage({ type: "clearCache", tabId: tab.id }, (res) => {
      if (res && res.success) {
        cacheBtn.innerHTML = '<svg class="w-3.5 h-3.5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>';
        setTimeout(loadStats, 800);
      } else {
        cacheBtn.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>';
      }
    });
  });

  // Close tab button
  const closeBtn = document.createElement("button");
  closeBtn.className = "btn btn-xs btn-ghost btn-square text-error opacity-40 hover:opacity-100 hover:bg-error hover:bg-opacity-10 tooltip tooltip-left";
  closeBtn.setAttribute("data-tip", "Close tab");
  closeBtn.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>';
  closeBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "closeTabs", tabIds: [tab.id] }, () => loadStats());
  });

  actions.appendChild(cacheBtn);
  actions.appendChild(closeBtn);

  right.appendChild(memCol);
  right.appendChild(idle);
  right.appendChild(actions);

  row.appendChild(img);
  row.appendChild(info);
  row.appendChild(right);

  return row;
}

// ── Update memory badges ───────────────────────────────────────────

function updateTabMemory(tabId, mem) {
  const heapEl = document.getElementById("heap-" + tabId);
  const cacheEl = document.getElementById("cache-" + tabId);
  if (heapEl) {
    const v = mem.usedHeap || 0;
    heapEl.textContent = v ? fmtShort(v) : "—";
    heapEl.className = "text-[10px] font-mono " +
      (v > 209715200 ? "text-error opacity-80" : v > 52428800 ? "text-warning opacity-60" : "text-base-content opacity-30");
  }
  if (cacheEl) {
    const v = mem.storageUsage || 0;
    cacheEl.textContent = v ? fmtShort(v) : "0";
    cacheEl.className = "text-[10px] font-mono " +
      (v > 104857600 ? "text-error opacity-80" : v > 10485760 ? "text-warning opacity-60" : "text-base-content opacity-30");
  }
}

// ── Render ─────────────────────────────────────────────────────────

function render(stats) {
  if (!$listStale || !$listActive) return;

  const now = Date.now();
  const thresholdMs = currentThresholdMin * 60 * 1000;
  const tabs = stats.allTabs || [];

  // Classify
  const stale = [];
  const active = [];
  for (const t of tabs) {
    const idleMs = t.lastActive ? now - t.lastActive : Infinity;
    const idleMin = Math.round(idleMs / 60000);
    const isStale = !t.active && idleMs > thresholdMs;
    const entry = { tab: t, idleMin, isStale };
    if (isStale) stale.push(entry);
    else active.push(entry);
  }

  // Sort: most idle first for stale, active tab first for active
  stale.sort((a, b) => b.idleMin - a.idleMin);
  active.sort((a, b) => {
    if (a.tab.active !== b.tab.active) return a.tab.active ? -1 : 1;
    return b.idleMin - a.idleMin;
  });

  // Stats
  $statTotal.textContent = tabs.length;
  $statStale.textContent = stale.length;
  const used = (stats.memoryCapacity || 0) - (stats.memoryAvailable || 0);
  const pct = stats.memoryCapacity ? Math.round((used / stats.memoryCapacity) * 100) : 0;
  $statMem.textContent = pct + "%";
  $statMem.className = "text-lg font-bold " + (pct > 85 ? "text-error" : pct > 65 ? "text-warning" : "text-success");

  // Memory bar
  if ($memBarThin) {
    $memBarThin.style.width = pct + "%";
    $memBarThin.style.background = pct > 85 ? "#f87272" : pct > 65 ? "#fbbd23" : "#36d399";
  }
  if ($memLabel) $memLabel.textContent = fmtBytes(used) + " / " + fmtBytes(stats.memoryCapacity || 0);

  // Button
  if ($btnClose) {
    $btnClose.disabled = stale.length === 0;
    $btnCloseText.textContent = stale.length > 0 ? "Close " + stale.length + " stale" : "All good";
  }

  // Stale group
  $listStale.innerHTML = "";
  if (stale.length > 0) {
    $groupStale.classList.remove("hidden");
    $staleCount.textContent = stale.length;
    for (const s of stale) $listStale.appendChild(buildRow(s.tab, s.idleMin, true));
  } else {
    $groupStale.classList.add("hidden");
  }

  // Active group
  $listActive.innerHTML = "";
  $activeCount.textContent = active.length;
  for (const a of active) $listActive.appendChild(buildRow(a.tab, a.idleMin, false));
}

// ── Load ───────────────────────────────────────────────────────────

function loadStats() {
  chrome.runtime.sendMessage({ type: "getStats" }, (stats) => {
    if (chrome.runtime.lastError || !stats) return;
    try {
      render(stats);
      // Batch-fetch memory for all tabs in a single message (not N+1)
      const tabIds = (stats.allTabs || []).map((t) => t.id);
      if (tabIds.length > 0) {
        chrome.runtime.sendMessage({ type: "getAllTabsMemory", tabIds }, (memMap) => {
          if (chrome.runtime.lastError || !memMap) return;
          for (const [id, mem] of Object.entries(memMap)) {
            if (mem) updateTabMemory(Number(id), mem);
          }
        });
      }
    } catch (e) {
      console.error("Tab Guardian render error:", e);
    }
  });
}

// ── Init ───────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  if (!cacheDom()) return;

  $btnClose.addEventListener("click", () => {
    const now = Date.now();
    const thresholdMs = currentThresholdMin * 60 * 1000;
    chrome.runtime.sendMessage({ type: "getStats" }, (stats) => {
      if (!stats || !stats.allTabs) return;
      const ids = stats.allTabs
        .filter((t) => !t.active && (t.lastActive ? now - t.lastActive : Infinity) > thresholdMs)
        .map((t) => t.id);
      if (ids.length > 0) {
        chrome.runtime.sendMessage({ type: "closeTabs", tabIds: ids }, () => loadStats());
      }
    });
  });

  $thresholdSelect.addEventListener("change", (e) => {
    currentThresholdMin = parseInt(e.target.value, 10);
    loadStats();
  });

  // Listen for system theme changes
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    document.documentElement.setAttribute("data-theme", e.matches ? "dark" : "light");
  });

  // Request optional permissions (scripting + host) then load
  chrome.permissions.contains({ permissions: ["scripting"], origins: ["<all_urls>"] }, (granted) => {
    if (granted) {
      loadStats();
    } else {
      chrome.permissions.request({ permissions: ["scripting"], origins: ["<all_urls>"] }, (granted) => {
        loadStats(); // Load either way — memory just shows "—" if not granted
      });
    }
  });
});
