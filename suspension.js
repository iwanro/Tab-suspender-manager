// Tab Suspension Module

// Suspend inactive tabs after a certain period
async function suspendInactiveTabs(minutes = 5) {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const inactiveTabs = tabs.filter(tab => !tab.pinned && !tab.active);
  
  for (const tab of inactiveTabs) {
    try {
      await chrome.tabs.discard(tab.id);
      console.log(`Suspended inactive tab ${tab.id}: ${tab.title}`);
    } catch (error) {
      console.error(`Failed to suspend tab ${tab.id}:`, error);
    }
  }
}

// Suspend specific tabs
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

// Check if tab should be excluded from suspension
function shouldExcludeTab(tab, whitelist) {
  if (tab.pinned) return true;
  if (tab.url.startsWith('chrome://')) return true;
  
  for (const domain of whitelist) {
    if (tab.url.includes(domain)) {
      return true;
    }
  }
  
  return false;
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    suspendInactiveTabs,
    suspendTabs,
    shouldExcludeTab
  };
}