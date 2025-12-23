// Popup script for Tab Manager
// Handles UI interactions and communicates with service worker

import { detectDuplicateTabs, calculateTabStatistics, calculateGroupStatistics, toggleDarkMode, isDarkModeEnabled, autoSaveSession } from './utils.js';
import { getSettings, saveSettings, resetSettings, getAvailableSettings } from './settings.js';

document.addEventListener('DOMContentLoaded', () => {
  const tabsList = document.getElementById('tabsList');
  const sessionsList = document.getElementById('sessionsList');
  const suspendAllBtn = document.getElementById('suspendAll');
  const saveSessionBtn = document.getElementById('saveSession');
  const groupTabsBtn = document.getElementById('groupTabs');
  const proFeatures = document.getElementById('proFeatures');

  // Get references to new UI elements
  const statsContainer = document.getElementById('statsContainer');
  const duplicateBtn = document.getElementById('findDuplicates');
  const darkModeToggle = document.getElementById('darkModeToggle');

  // Settings panel elements
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsPanel = document.getElementById('settingsPanel');
  const closeSettings = document.getElementById('closeSettings');
  const saveSettingsBtn = document.getElementById('saveSettings');
  const resetSettingsBtn = document.getElementById('resetSettings');
  const upgradeBtn = document.getElementById('upgradeBtn');

  // Hide upgrade button since all features are now free
  if (upgradeBtn) {
    upgradeBtn.style.display = 'none';
  }

  // Hide pro banner since all features are now free
  const proBanner = document.getElementById('proFeatures');
  if (proBanner) {
    proBanner.style.display = 'none';
  }

  // Load sessions
  async function loadSessions() {
    const result = await chrome.storage.local.get(['sessions']);
    const sessions = result.sessions || [];
    
    // Clear loading state if exists
    const sessionsLoading = sessionsList.querySelector('.empty-state');
    if (sessionsLoading) {
      sessionsLoading.remove();
    }
    
    if (sessions.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.innerHTML = `
        <i class="fas fa-box-open"></i>
        <span>No saved sessions</span>
      `;
      sessionsList.appendChild(emptyState);
      return;
    }
    
    sessions.forEach(session => {
      const sessionElement = document.createElement('div');
      sessionElement.className = 'session-item';
      sessionElement.innerHTML = `
        <span>${session.name} (${session.tabs.length} tabs)</span>
        <div>
          <button data-session-id="${session.id}" class="restore-btn">
            <i class="fas fa-undo"></i> Restore
          </button>
          <button data-session-id="${session.id}" class="delete-btn">
            <i class="fas fa-trash"></i> Delete
          </button>
        </div>
      `;
      sessionsList.appendChild(sessionElement);
    });
  }

  // Suspend all tabs
  suspendAllBtn.addEventListener('click', async () => {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const tabIds = tabs.map(tab => tab.id);
    chrome.runtime.sendMessage({ action: 'suspendTabs', tabIds }, (response) => {
      if (response.success) {
        alert('Tabs suspended successfully!');
      }
    });
  });

  // Save session
  saveSessionBtn.addEventListener('click', async () => {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const sessionName = prompt('Enter session name:');
    if (sessionName) {
      // Validate session name
      const trimmedName = sessionName.trim();
      if (trimmedName.length === 0) {
        alert('Session name cannot be empty!');
        return;
      }
      if (trimmedName.length > 100) {
        alert('Session name is too long! Maximum 100 characters.');
        return;
      }

      const session = {
        id: Date.now().toString(),
        name: trimmedName,
        tabs: tabs.map(tab => ({ url: tab.url, title: tab.title }))
      };
      chrome.runtime.sendMessage({ action: 'saveSession', session }, (response) => {
        if (response && response.success) {
          loadSessions();
          alert('Session saved successfully!');
        } else if (response && response.error) {
          alert('Error: ' + response.error);
        } else {
          alert('Failed to save session. Please try again.');
        }
      });
    }
  });

  // Group tabs
  groupTabsBtn.addEventListener('click', async () => {
    // All features are now free
    try {
      const { groupTabsByDomain } = await import('./grouping.js');
      await groupTabsByDomain();
      alert('Tabs grouped successfully!');
    } catch (error) {
      console.error('Failed to group tabs:', error);
      alert('Failed to group tabs. Please try again.');
    }
  });

  // Find duplicates
  duplicateBtn.addEventListener('click', async () => {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const result = detectDuplicateTabs(tabs);
    
    if (result.duplicates.length === 0) {
      alert('No duplicate tabs found!');
      return;
    }
    
    let message = `Found ${result.duplicateGroups} duplicate group(s) with ${result.totalDuplicates} total duplicate tabs:\n\n`;
    result.duplicates.forEach((group, index) => {
      message += `Group ${index + 1}: ${group.url}\n`;
      message += `  Tabs: ${group.tabs.map(tab => tab.title || 'Untitled').join(', ')}\n\n`;
    });
    
    alert(message);
  });

  // Dark mode toggle
  darkModeToggle.addEventListener('click', async () => {
    const isDark = await isDarkModeEnabled();
    toggleDarkMode(!isDark);
  });

  // Event delegation for session buttons (restore/delete)
  sessionsList.addEventListener('click', (e) => {
    const restoreBtn = e.target.closest('.restore-btn');
    const deleteBtn = e.target.closest('.delete-btn');

    if (restoreBtn) {
      const sessionId = restoreBtn.getAttribute('data-session-id');
      chrome.runtime.sendMessage(
        { action: 'restoreSession', sessionId },
        (response) => {
          if (response && response.success) {
            alert('Session restored successfully!');
          } else if (response && response.error) {
            alert('Error: ' + response.error);
          } else {
            alert('Failed to restore session. Please try again.');
          }
        }
      );
    }

    if (deleteBtn) {
      const sessionId = deleteBtn.getAttribute('data-session-id');
      if (confirm('Are you sure you want to delete this session?')) {
        chrome.runtime.sendMessage(
          { action: 'deleteSession', sessionId },
          (response) => {
            if (response && response.success) {
              loadSessions();
              alert('Session deleted successfully!');
            } else if (response && response.error) {
              alert('Error: ' + response.error);
            } else {
              alert('Failed to delete session. Please try again.');
            }
          }
        );
      }
    }
  });

  // Settings panel functionality
  settingsBtn.addEventListener('click', () => {
    showSettingsPanel();
  });

  closeSettings.addEventListener('click', () => {
    hideSettingsPanel();
  });

  saveSettingsBtn.addEventListener('click', async () => {
    try {
      await saveSettingsFromForm();
      hideSettingsPanel();
      showToast('Settings saved successfully!', 2000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      showToast('Failed to save settings. Please try again.', 3000);
    }
  });

  resetSettingsBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      await resetSettings();
      await loadSettingsIntoForm();
      showToast('Settings reset to defaults!');
    }
  });

  // Load tabs with enhanced functionality
  async function loadTabs() {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    
    // Clear loading state
    const loadingElement = document.querySelector('.empty-state');
    if (loadingElement) {
      loadingElement.remove();
    }
    
    tabs.forEach(tab => {
      const tabElement = document.createElement('div');
      tabElement.className = 'tab-item';
      tabElement.innerHTML = `
        <input type="checkbox" data-tab-id="${tab.id}">
        <span>${tab.title || 'Untitled'}</span>
      `;
      tabsList.appendChild(tabElement);
    });
    
    // Update statistics
    updateStatistics(tabs);
  }

  // Update statistics display
  function updateStatistics(tabs) {
    const stats = calculateTabStatistics(tabs);
    const groupStats = calculateGroupStatistics(tabs);

    // Update individual stat elements
    const totalTabsEl = document.getElementById('totalTabs');
    const memoryUsageEl = document.getElementById('memoryUsage');
    const totalGroupsEl = document.getElementById('totalGroups');

    if (totalTabsEl) totalTabsEl.textContent = stats.totalTabs;
    if (memoryUsageEl) memoryUsageEl.textContent = stats.memoryUsage;
    if (totalGroupsEl) totalGroupsEl.textContent = groupStats.totalGroups;
  }

  // Handle dark mode change messages from service worker
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'darkModeChanged') {
      toggleDarkMode(request.darkMode);
    }
  });

  // Settings panel functions
  async function showSettingsPanel() {
    await loadSettingsIntoForm();
    settingsPanel.style.display = 'block';
    document.body.style.overflow = 'hidden';
  }

  function hideSettingsPanel() {
    settingsPanel.style.display = 'none';
    document.body.style.overflow = '';
  }

  async function loadSettingsIntoForm() {
    try {
      const settings = await getAvailableSettings();

      // General settings
      document.getElementById('showStatistics').checked = settings.showStatistics;
      document.getElementById('showNotifications').checked = settings.showNotifications;
      document.getElementById('compactView').checked = settings.compactView;

      // Auto-suspension settings
      document.getElementById('autoSuspendEnabled').checked = settings.autoSuspendEnabled;
      document.getElementById('autoSuspendMinutes').value = settings.autoSuspendMinutes.toString();

      // Auto-save settings
      document.getElementById('autoSaveEnabled').checked = settings.autoSaveEnabled;
      document.getElementById('autoSaveLimit').value = settings.autoSaveLimit;

      // Whitelist domains
      document.getElementById('whitelistDomains').value = settings.whitelistDomains.join('\n');

      // All features are now free - enable all checkboxes
      const proFeatures = ['advancedStats', 'customThemes', 'autoSaveIntervals', 'perTabTimer', 'advancedTagging', 'customShortcuts', 'groupAnalytics'];
      proFeatures.forEach(feature => {
        const checkbox = document.getElementById(feature);
        if (checkbox) {
          checkbox.checked = settings[feature];
          checkbox.disabled = false;  // All features enabled
        }
      });

      // Hide pro section since all features are free
      const proSection = document.querySelector('.pro-section');
      if (proSection) {
        proSection.style.display = 'none';
      }

    } catch (error) {
      console.error('Failed to load settings into form:', error);
    }
  }

  async function saveSettingsFromForm() {
    try {
      const newSettings = {
        // General settings
        showStatistics: document.getElementById('showStatistics').checked,
        showNotifications: document.getElementById('showNotifications').checked,
        compactView: document.getElementById('compactView').checked,

        // Auto-suspension settings
        autoSuspendEnabled: document.getElementById('autoSuspendEnabled').checked,
        autoSuspendMinutes: parseFloat(document.getElementById('autoSuspendMinutes').value),

        // Auto-save settings
        autoSaveEnabled: document.getElementById('autoSaveEnabled').checked,
        autoSaveLimit: parseInt(document.getElementById('autoSaveLimit').value),

        // Whitelist domains
        whitelistDomains: document.getElementById('whitelistDomains').value
          .split('\n')
          .map(domain => domain.trim())
          .filter(domain => domain.length > 0)
      };

      await saveSettings(newSettings);
    } catch (error) {
      console.error('Failed to save settings from form:', error);
      showToast('Failed to save settings!');
    }
  }

  // Toast notification function
  function showToast(message, duration = 3000) {
    // Remove existing toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
      existingToast.remove();
    }

    // Create new toast
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    // Show toast
    setTimeout(() => toast.classList.add('show'), 100);

    // Hide toast
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // Initialize with dark mode check
  async function initialize() {
    const isDark = await isDarkModeEnabled();
    toggleDarkMode(isDark);

    // Set up auto-save on close
    window.addEventListener('beforeunload', async () => {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      await autoSaveSession(tabs);
    });

    loadTabs();
    loadSessions();
  }

  initialize();
});