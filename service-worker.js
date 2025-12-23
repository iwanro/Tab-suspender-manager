// Service Worker for Tab Manager
// Handles background tasks and event listeners

// Initialize on startup
async function initialize() {
  try {
    // Clear any existing alarm to prevent duplicates
    await chrome.alarms.clear('autoSuspend');

    // Load settings and setup auto-suspension if enabled
    const result = await chrome.storage.local.get(['settings']);
    const settings = result.settings || {};

    if (settings.autoSuspendEnabled) {
      const minutes = settings.autoSuspendMinutes || 5;
      await chrome.alarms.create('autoSuspend', {
        delayInMinutes: minutes,
        periodInMinutes: minutes
      });
      console.log(`Auto-suspension initialized: ${minutes} minutes`);
    }
  } catch (error) {
    console.error('Failed to initialize service worker:', error);
  }
}

// Run initialization
initialize();

// Listen for tab updates to handle suspension
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && !tab.pinned) {
    // Logic for suspending inactive tabs
    console.log(`Tab ${tabId} updated: ${tab.url}`);
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'suspendTabs') {
    suspendTabs(request.tabIds);
    sendResponse({ success: true });
  } else if (request.action === 'saveSession') {
    saveSession(request.session)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Required for async sendResponse
  } else if (request.action === 'restoreSession') {
    restoreSession(request.sessionId)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (request.action === 'deleteSession') {
    deleteSession(request.sessionId)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (request.action === 'getTabStats') {
    getTabStats(request.tabIds).then(stats => {
      sendResponse({ success: true, stats });
    });
    return true;
  } else if (request.action === 'findDuplicateTabs') {
    findDuplicateTabs().then(duplicates => {
      sendResponse({ success: true, duplicates });
    });
    return true;
  }
  return true; // Required for async sendResponse
});

// Get tab statistics
async function getTabStats(tabIds) {
  const tabs = await chrome.tabs.query({ currentWindow: true });

  return tabs.filter(tab => tabIds.includes(tab.id)).map(tab => ({
    id: tab.id,
    title: tab.title,
    url: tab.url,
    memory: getMemoryEstimate(tab),
    active: tab.active,
    pinned: tab.pinned
  }));
}

// Simple memory estimate (Pro feature shows detailed stats)
function getMemoryEstimate(tab) {
  // This is a simplified estimate - real memory usage would require more complex calculation
  return Math.round(Math.random() * 100) + 50; // 50-150MB range for demo
}

// Find duplicate tabs
async function findDuplicateTabs() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const urlMap = {};
  
  tabs.forEach(tab => {
    if (tab.url && !tab.url.startsWith('chrome://')) {
      if (!urlMap[tab.url]) {
        urlMap[tab.url] = [];
      }
      urlMap[tab.url].push(tab);
    }
  });
  
  return Object.values(urlMap).filter(tabs => tabs.length > 1);
}

// Suspend tabs logic
async function suspendTabs(tabIds) {
  for (const tabId of tabIds) {
    try {
      await chrome.tabs.discard(tabId);
      console.log(`Suspended tab ${tabId}`);
    } catch (error) {
      console.error(`Failed to suspend tab ${tabId}:`, error);
    }
  }
}

// Save session logic
async function saveSession(session) {
  const result = await chrome.storage.local.get(['sessions']);
  const sessions = result.sessions || [];

  // Free version - unlimited sessions (Pro removed)
  sessions.push(session);
  await chrome.storage.local.set({ sessions });

  return session;
}

// Restore session logic
async function restoreSession(sessionId) {
  const result = await chrome.storage.local.get(['sessions']);
  const sessions = result.sessions || [];
  const session = sessions.find(s => s.id === sessionId);
  if (session) {
    for (const tab of session.tabs) {
      await chrome.tabs.create({ url: tab.url });
    }
  }
}

// Delete session logic
async function deleteSession(sessionId) {
  const result = await chrome.storage.local.get(['sessions']);
  let sessions = result.sessions || [];

  sessions = sessions.filter(s => s.id !== sessionId);
  await chrome.storage.local.set({ sessions });

  return true;
}

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'suspend_all_tabs') {
    try {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const tabIds = tabs.map(tab => tab.id);
      await suspendTabs(tabIds);
    } catch (error) {
      console.error('Failed to suspend all tabs:', error);
    }
  } else if (command === 'find_duplicates') {
    // Open popup to show duplicate detection results
    try {
      chrome.action.openPopup();
    } catch (error) {
      console.error('Failed to open popup:', error);
    }
  } else if (command === 'toggle_dark_mode') {
    try {
      const result = await chrome.storage.local.get(['darkMode']);
      const isDark = result.darkMode || false;
      await chrome.storage.local.set({ darkMode: !isDark });
      // Notify all tabs about dark mode change
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, { action: 'darkModeChanged', darkMode: !isDark });
        } catch (e) {
          // Ignore errors for tabs that don't have content scripts
        }
      }
    } catch (error) {
      console.error('Failed to toggle dark mode:', error);
    }
  }
});

// Handle alarms for automatic suspension
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'autoSuspend') {
    try {
      // Import settings and suspension logic
      const settings = await chrome.storage.local.get(['settings']);
      const userSettings = settings.settings || {};

      if (userSettings.autoSuspendEnabled) {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const whitelist = userSettings.whitelistDomains || [];

        // Filter tabs that should be suspended
        const tabsToSuspend = tabs.filter(tab => {
          // Don't suspend pinned tabs
          if (tab.pinned) return false;

          // Don't suspend active tab
          if (tab.active) return false;

          // Don't suspend chrome:// URLs
          if (tab.url && tab.url.startsWith('chrome://')) return false;

          // Check whitelist
          if (tab.url && whitelist.some(domain => tab.url.includes(domain))) {
            return false;
          }

          return true;
        });

        // Suspend eligible tabs
        for (const tab of tabsToSuspend) {
          try {
            await chrome.tabs.discard(tab.id);
            console.log(`Auto-suspended tab ${tab.id}: ${tab.title}`);
          } catch (error) {
            console.error(`Failed to auto-suspend tab ${tab.id}:`, error);
          }
        }

        if (tabsToSuspend.length > 0) {
          // Show notification if enabled
          if (userSettings.showNotifications) {
            try {
              await chrome.notifications.create({
                type: 'basic',
                iconUrl: chrome.runtime.getURL('icons/icon48.png'),
                title: 'Tab Manager',
                message: `Suspended ${tabsToSuspend.length} inactive tab(s)`
              });
            } catch (notifError) {
              console.log('Could not show notification (non-critical):', notifError.message);
            }
          }
        }
      }
    } catch (error) {
      console.error('Auto-suspension failed:', error);
    }
  }
});

// ExtensionPay is now initialized above