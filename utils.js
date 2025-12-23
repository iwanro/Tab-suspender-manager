// Utility functions for Tab Manager Basic
// Clean, optimized, and modular implementation

/**
 * Detects duplicate tabs based on URL
 * @param {Array} tabs - Array of tab objects
 * @returns {Object} - Object with duplicate groups and count
 */
export function detectDuplicateTabs(tabs) {
  const urlMap = new Map();
  const duplicates = [];
  
  // O(n) complexity - efficient for tab detection
  tabs.forEach(tab => {
    const url = tab.url || '';
    if (url && !url.startsWith('chrome://')) {
      if (urlMap.has(url)) {
        urlMap.get(url).push(tab);
      } else {
        urlMap.set(url, [tab]);
      }
    }
  });
  
  // Filter groups with more than one tab
  urlMap.forEach((tabGroup, url) => {
    if (tabGroup.length > 1) {
      duplicates.push({
        url,
        tabs: tabGroup,
        count: tabGroup.length
      });
    }
  });
  
  return {
    duplicates,
    totalDuplicates: duplicates.reduce((sum, group) => sum + group.count, 0),
    duplicateGroups: duplicates.length
  };
}

/**
 * Calculates basic tab statistics
 * @param {Array} tabs - Array of tab objects
 * @returns {Object} - Statistics object
 */
export function calculateTabStatistics(tabs) {
  const totalTabs = tabs.length;
  const memoryUsage = tabs.reduce((total, tab) => {
    // Estimate memory usage based on tab properties
    // This is a simplified estimation for the free version
    return total + (tab.title?.length || 0) * 100 + (tab.url?.length || 0) * 50;
  }, 0);
  
  return {
    totalTabs,
    memoryUsage: Math.round(memoryUsage / 1024) + ' KB', // Convert to KB
    averageMemory: totalTabs > 0 ? Math.round(memoryUsage / totalTabs / 1024) + ' KB' : '0 KB'
  };
}

/**
 * Calculates group statistics
 * @param {Array} tabs - Array of tab objects
 * @returns {Object} - Group statistics
 */
export function calculateGroupStatistics(tabs) {
  const groups = {};
  
  tabs.forEach(tab => {
    // Simple grouping by domain for free version
    try {
      const domain = new URL(tab.url || '').hostname || 'unknown';
      if (!groups[domain]) {
        groups[domain] = { count: 0, memory: 0 };
      }
      groups[domain].count++;
      groups[domain].memory += (tab.title?.length || 0) * 100 + (tab.url?.length || 0) * 50;
    } catch (e) {
      // Handle invalid URLs gracefully
      if (!groups['invalid']) {
        groups['invalid'] = { count: 0, memory: 0 };
      }
      groups['invalid'].count++;
    }
  });
  
  // Convert to array and sort by count
  const sortedGroups = Object.entries(groups)
    .map(([domain, stats]) => ({
      domain,
      ...stats,
      memory: Math.round(stats.memory / 1024) + ' KB'
    }))
    .sort((a, b) => b.count - a.count);
  
  return {
    groups: sortedGroups,
    totalGroups: sortedGroups.length
  };
}

/**
 * Toggle dark mode
 * @param {boolean} enable - Whether to enable dark mode
 */
export function toggleDarkMode(enable) {
  const body = document.body;
  if (enable) {
    body.classList.add('dark-mode');
    body.classList.remove('light-mode');
  } else {
    body.classList.remove('dark-mode');
    body.classList.add('light-mode');
  }
  
  // Save preference
  chrome.storage.local.set({ darkMode: enable });
}

/**
 * Check if dark mode is enabled
 * @returns {Promise<boolean>} - Whether dark mode is enabled
 */
export async function isDarkModeEnabled() {
  const result = await chrome.storage.local.get(['darkMode']);
  return result.darkMode || false;
}

/**
 * Auto-save session on browser close
 * @param {Array} tabs - Array of tab objects
 */
export async function autoSaveSession(tabs) {
  const result = await chrome.storage.local.get(['autoSaves']);
  const existingSaves = result.autoSaves || [];

  // Limit to 3 auto-saves for free version
  if (existingSaves.length >= 3) {
    existingSaves.shift(); // Remove oldest
  }

  const session = {
    id: Date.now().toString(),
    name: `Auto-save ${new Date().toLocaleString()}`,
    timestamp: Date.now(),
    tabs: tabs.map(tab => ({ url: tab.url, title: tab.title }))
  };

  existingSaves.push(session);
  await chrome.storage.local.set({ autoSaves: existingSaves });
}