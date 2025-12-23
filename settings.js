// Settings Management Module
// Handles user preferences and configuration

const DEFAULT_SETTINGS = {
  // All features are now free
  autoSuspendEnabled: false,
  autoSuspendMinutes: 1,
  autoSaveEnabled: true,
  autoSaveLimit: 10,  // Increased from 3
  showStatistics: true,
  darkMode: true,

  // Previously Pro features - now free
  advancedStats: true,
  customThemes: true,
  autoSaveIntervals: true,
  perTabTimer: true,
  advancedTagging: true,
  customShortcuts: true,
  groupAnalytics: true,

  // Whitelist domains
  whitelistDomains: ['gmail.com', 'outlook.com', 'slack.com'],

  // UI preferences
  compactView: false,
  showNotifications: true
};

/**
 * Get all user settings
 * @returns {Promise<Object>} User settings object
 */
export async function getSettings() {
  try {
    const result = await chrome.storage.local.get(['settings']);
    return { ...DEFAULT_SETTINGS, ...result.settings };
  } catch (error) {
    console.error('Failed to load settings:', error);
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Save user settings
 * @param {Object} newSettings - Settings to save
 * @returns {Promise<void>}
 */
export async function saveSettings(newSettings) {
  try {
    const currentSettings = await getSettings();
    const updatedSettings = { ...currentSettings, ...newSettings };
    await chrome.storage.local.set({ settings: updatedSettings });

    // Apply settings immediately
    await applySettings(updatedSettings);
  } catch (error) {
    console.error('Failed to save settings:', error);
    throw error;
  }
}

/**
 * Apply settings to the extension
 * @param {Object} settings - Settings to apply
 */
export async function applySettings(settings) {
  try {
    // Apply dark mode
    if (settings.darkMode !== undefined) {
      await chrome.storage.local.set({ darkMode: settings.darkMode });
    }

    // Apply auto-suspension
    if (settings.autoSuspendEnabled) {
      await setupAutoSuspension(settings.autoSuspendMinutes);
    } else {
      await disableAutoSuspension();
    }

    // Apply auto-save
    if (settings.autoSaveEnabled) {
      // Auto-save is handled in popup.js on beforeunload
    }

    // Notify all tabs about settings changes
    const tabs = await chrome.tabs.query({});
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, {
        action: 'settingsChanged',
        settings
      }).catch(() => {}); // Ignore errors for tabs that don't have content scripts
    });

  } catch (error) {
    console.error('Failed to apply settings:', error);
  }
}

/**
 * Setup automatic tab suspension
 * @param {number} minutes - Minutes after which to suspend tabs
 */
export async function setupAutoSuspension(minutes) {
  try {
    // Clear existing alarm
    await chrome.alarms.clear('autoSuspend');

    // Create new alarm
    await chrome.alarms.create('autoSuspend', {
      delayInMinutes: minutes,
      periodInMinutes: minutes
    });

    console.log(`Auto-suspension set up for ${minutes} minutes`);
  } catch (error) {
    console.error('Failed to setup auto-suspension:', error);
  }
}

/**
 * Disable automatic tab suspension
 */
export async function disableAutoSuspension() {
  try {
    await chrome.alarms.clear('autoSuspend');
    console.log('Auto-suspension disabled');
  } catch (error) {
    console.error('Failed to disable auto-suspension:', error);
  }
}

/**
 * Check if user has Pro features (always true now - all features are free)
 * @returns {Promise<boolean>} Always returns true
 */
export async function isProUser() {
  return true; // All features are now free
}

/**
 * Get settings available for current user type
 * @returns {Promise<Object>} All settings (all features are now free)
 */
export async function getAvailableSettings() {
  return await getSettings();
}

/**
 * Reset settings to defaults
 * @returns {Promise<void>}
 */
export async function resetSettings() {
  try {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
    await applySettings(DEFAULT_SETTINGS);
  } catch (error) {
    console.error('Failed to reset settings:', error);
    throw error;
  }
}