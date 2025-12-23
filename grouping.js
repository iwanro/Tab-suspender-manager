// Tab Grouping Module

// Create a new tab group
async function createTabGroup(name, tabIds) {
  try {
    const group = await chrome.tabGroups.create({ title: name });
    await chrome.tabs.group({ groupId: group.id, tabIds });
    console.log(`Created group "${name}" with ${tabIds.length} tabs`);
    return group;
  } catch (error) {
    console.error('Failed to create tab group:', error);
    throw error;
  }
}

// Group tabs by domain (Pro feature)
async function groupTabsByDomain() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const domainGroups = {};

  // Group tabs by domain
  tabs.forEach(tab => {
    if (tab.url && !tab.pinned) {
      try {
        const domain = new URL(tab.url).hostname;
        if (!domainGroups[domain]) {
          domainGroups[domain] = [];
        }
        domainGroups[domain].push(tab.id);
      } catch (e) {
        console.warn(`Invalid URL for tab ${tab.id}: ${tab.url}`);
      }
    }
  });

  // Create groups
  for (const [domain, tabIds] of Object.entries(domainGroups)) {
    if (tabIds.length > 1) {
      await createTabGroup(domain, tabIds);
    }
  }
}

// Group tabs by URL pattern (Pro feature)
async function groupTabsByPattern(pattern) {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const matchedTabs = tabs.filter(tab => 
    tab.url && tab.url.includes(pattern) && !tab.pinned
  );
  
  if (matchedTabs.length > 1) {
    await createTabGroup(`Pattern: ${pattern}`, matchedTabs.map(tab => tab.id));
  }
}

// Ungroup all tabs
async function ungroupAllTabs() {
  const groups = await chrome.tabGroups.query({});
  for (const group of groups) {
    await chrome.tabGroups.update(group.id, { title: '' });
  }
  console.log('Ungrouped all tabs');
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createTabGroup,
    groupTabsByDomain,
    groupTabsByPattern,
    ungroupAllTabs
  };
}