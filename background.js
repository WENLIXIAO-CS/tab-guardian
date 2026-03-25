// Tab Guardian — Background Service Worker
// Tracks tab activity and sends notifications for stale tabs.

const STALE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour
const CHECK_INTERVAL_MIN = 5; // check every 5 minutes

// ── Tab Activity Tracking ──────────────────────────────────────────

// Serialise storage writes to prevent concurrent read-modify-write races.
// Without this, two near-simultaneous tab events can each read the same
// snapshot and the second write silently drops the first's changes.
let _storageQueue = Promise.resolve();
function _enqueue(fn) {
  _storageQueue = _storageQueue.then(fn).catch(console.error);
  return _storageQueue;
}

function markActive(tabId) {
  return _enqueue(async () => {
    const data = (await chrome.storage.local.get("tabActivity")).tabActivity || {};
    data[tabId] = Date.now();
    await chrome.storage.local.set({ tabActivity: data });
  });
}

function removeTab(tabId) {
  return _enqueue(async () => {
    const data = (await chrome.storage.local.get("tabActivity")).tabActivity || {};
    delete data[tabId];
    await chrome.storage.local.set({ tabActivity: data });
  });
}

// When a tab is activated (switched to)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await markActive(activeInfo.tabId);
});

// When a tab finishes loading
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status === "complete") {
    await markActive(tabId);
  }
});

// When a tab is created
chrome.tabs.onCreated.addListener(async (tab) => {
  await markActive(tab.id);
  checkAndNotify().catch(console.error);
});

// Cleanup when a tab is closed
chrome.tabs.onRemoved.addListener(async (tabId) => {
  await removeTab(tabId);
});

// ── Stale Tab Detection & Notification ─────────────────────────────

async function getStaleTabs() {
  const data = (await chrome.storage.local.get("tabActivity")).tabActivity || {};
  const now = Date.now();
  const tabs = await chrome.tabs.query({});
  const stale = [];

  for (const tab of tabs) {
    // Skip active tab in each window
    if (tab.active) continue;
    const lastActive = data[tab.id];
    if (!lastActive || now - lastActive > STALE_THRESHOLD_MS) {
      stale.push({
        id: tab.id,
        title: tab.title || "Untitled",
        url: tab.url || "",
        lastActive: lastActive || 0,
        idleMinutes: lastActive ? Math.round((now - lastActive) / 60000) : Infinity,
      });
    }
  }

  // Sort by idle time descending
  stale.sort((a, b) => b.idleMinutes - a.idleMinutes);
  return stale;
}

const TAB_WARNING_THRESHOLD = 8;

async function checkAndNotify() {
  const allTabs = await chrome.tabs.query({});
  const totalCount = allTabs.length;
  const staleTabs = await getStaleTabs();
  const stored = await chrome.storage.local.get(["lastNotifiedCount", "lastNotifiedTotal"]);
  const prevStale = stored.lastNotifiedCount || 0;
  const prevTotal = stored.lastNotifiedTotal || 0;

  // Badge: show total tab count if over threshold, otherwise stale count
  if (totalCount > TAB_WARNING_THRESHOLD) {
    chrome.action.setBadgeText({ text: String(totalCount) });
    chrome.action.setBadgeBackgroundColor({ color: "#f59e0b" });
  } else if (staleTabs.length > 0) {
    chrome.action.setBadgeText({ text: String(staleTabs.length) });
    chrome.action.setBadgeBackgroundColor({ color: "#e74c3c" });
  } else {
    chrome.action.setBadgeText({ text: "" });
  }

  // Notification: too many tabs
  if (totalCount > TAB_WARNING_THRESHOLD && prevTotal <= TAB_WARNING_THRESHOLD) {
    chrome.notifications.create("too-many-tabs", {
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "Tab Guardian — Too many tabs!",
      message: `You have ${totalCount} tabs open. Consider closing unused tabs to free up memory.`,
    });
  }
  await chrome.storage.local.set({ lastNotifiedTotal: totalCount });

  // Notification: stale tabs
  if (staleTabs.length > 0 && staleTabs.length !== prevStale) {
    chrome.notifications.create("stale-tabs", {
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "Tab Guardian",
      message: `You have ${staleTabs.length} tab${staleTabs.length > 1 ? "s" : ""} unused for over 1 hour. Click the extension to clean up.`,
    });
  }
  await chrome.storage.local.set({ lastNotifiedCount: staleTabs.length });
}

// ── Periodic Alarm ─────────────────────────────────────────────────

chrome.alarms.create("check-stale-tabs", { periodInMinutes: CHECK_INTERVAL_MIN });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "check-stale-tabs") {
    checkAndNotify().catch(console.error);
  }
});

// Initialize on install / startup
chrome.runtime.onInstalled.addListener(async () => {
  // Seed activity for all currently-open tabs
  const tabs = await chrome.tabs.query({});
  const data = {};
  const now = Date.now();
  for (const tab of tabs) {
    data[tab.id] = now;
  }
  await chrome.storage.local.set({ tabActivity: data });
  chrome.action.setBadgeText({ text: "" });
});

// Prune stale entries on browser startup — tabs closed while the service
// worker was inactive won't fire onRemoved, leaving orphaned entries.
chrome.runtime.onStartup.addListener(async () => {
  const tabs = await chrome.tabs.query({});
  const openIds = new Set(tabs.map((t) => t.id));
  const data = (await chrome.storage.local.get("tabActivity")).tabActivity || {};
  let changed = false;
  for (const id of Object.keys(data)) {
    if (!openIds.has(Number(id))) {
      delete data[id];
      changed = true;
    }
  }
  if (changed) await chrome.storage.local.set({ tabActivity: data });
  checkAndNotify().catch(console.error);
});

// ── Per-tab memory via scripting ────────────────────────────────────

async function getTabMemory(tabId) {
  try {
    // Step 1: Get JS heap (synchronous — works reliably)
    const heapResults = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => ({
        usedHeap: performance.memory ? performance.memory.usedJSHeapSize : 0,
        totalHeap: performance.memory ? performance.memory.totalJSHeapSize : 0,
      }),
    });
    const mem = heapResults[0]?.result || { usedHeap: 0, totalHeap: 0 };

    // Step 2: Get storage estimate via separate call
    try {
      const storageResults = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          return navigator.storage.estimate().then((est) => ({
            storageUsage: est.usage || 0,
            storageQuota: est.quota || 0,
          }));
        },
      });
      const storage = storageResults[0]?.result;
      if (storage && typeof storage.storageUsage === "number") {
        mem.storageUsage = storage.storageUsage;
        mem.storageQuota = storage.storageQuota;
      } else {
        mem.storageUsage = 0;
        mem.storageQuota = 0;
      }
    } catch {
      mem.storageUsage = 0;
      mem.storageQuota = 0;
    }

    return mem;
  } catch {
    // chrome://, edge://, extension pages, etc.
    return null;
  }
}

// ── Message handler for popup ──────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "getStats") {
    (async () => {
      try {
        const allTabs = await chrome.tabs.query({});
        const memInfo = await chrome.system.memory.getInfo();
        const activity = (await chrome.storage.local.get("tabActivity")).tabActivity || {};

        sendResponse({
          totalTabs: allTabs.length,
          memoryCapacity: memInfo.capacity,
          memoryAvailable: memInfo.availableCapacity,
          allTabs: allTabs.map((t) => ({
            id: t.id,
            title: t.title || "Untitled",
            url: t.url || "",
            active: t.active,
            favIconUrl: t.favIconUrl || "",
            windowId: t.windowId,
            lastActive: activity[t.id] || 0,
            memory: null,
          })),
        });
      } catch (e) {
        console.error("Tab Guardian getStats error:", e);
        sendResponse(null);
      }
    })();
    return true;
  }

  if (msg.type === "getTabMemory") {
    getTabMemory(msg.tabId).then(sendResponse).catch(() => sendResponse(null));
    return true;
  }

  if (msg.type === "getAllTabsMemory") {
    const ids = msg.tabIds || [];
    Promise.allSettled(ids.map((id) => getTabMemory(id))).then((results) => {
      const mem = {};
      for (let i = 0; i < ids.length; i++) {
        mem[ids[i]] = results[i].status === "fulfilled" ? results[i].value : null;
      }
      sendResponse(mem);
    });
    return true;
  }

  if (msg.type === "clearCache") {
    (async () => {
      try {
        const tab = await chrome.tabs.get(msg.tabId);
        if (!tab.url || !/^https?:\/\//.test(tab.url)) {
          sendResponse({ success: false, error: "Cannot clear data for this tab type" });
          return;
        }
        const origin = new URL(tab.url).origin;
        const opts = { origins: [origin] };

        // 1. Clear from browser level
        await Promise.allSettled([
          chrome.browsingData.removeCache(opts),
          chrome.browsingData.removeCacheStorage(opts),
          chrome.browsingData.removeIndexedDB(opts),
          chrome.browsingData.removeLocalStorage(opts),
          chrome.browsingData.removeServiceWorkers(opts),
          chrome.browsingData.removeFileSystems(opts),
          chrome.browsingData.removeWebSQL(opts),
        ]);

        // 2. Clear from within the page context so estimates update
        try {
          await chrome.scripting.executeScript({
            target: { tabId: msg.tabId },
            world: "MAIN",
            func: async () => {
              // Clear Cache Storage (Service Worker caches)
              if (window.caches) {
                const keys = await caches.keys();
                await Promise.all(keys.map((k) => caches.delete(k)));
              }
              // Clear localStorage
              try { localStorage.clear(); } catch {}
              // Clear sessionStorage
              try { sessionStorage.clear(); } catch {}
              // Clear all IndexedDB databases
              if (window.indexedDB && indexedDB.databases) {
                try {
                  const dbs = await indexedDB.databases();
                  dbs.forEach((db) => { if (db.name) indexedDB.deleteDatabase(db.name); });
                } catch {}
              }
              // Unregister service workers
              if (navigator.serviceWorker) {
                try {
                  const regs = await navigator.serviceWorker.getRegistrations();
                  await Promise.all(regs.map((r) => r.unregister()));
                } catch {}
              }
            },
          });
        } catch {}

        sendResponse({ success: true, origin });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (msg.type === "closeTabs") {
    if (!Array.isArray(msg.tabIds) || msg.tabIds.length === 0) {
      sendResponse({ success: false, error: "No tab IDs provided" });
      return true;
    }
    chrome.tabs.remove(msg.tabIds).then(() => {
      sendResponse({ success: true });
      checkAndNotify().catch(console.error);
    }).catch((e) => {
      sendResponse({ success: false, error: e.message });
    });
    return true;
  }
});
