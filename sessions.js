// Session Management Module

// Save current session
async function saveCurrentSession(sessionName) {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const session = {
    id: Date.now().toString(),
    name: sessionName,
    tabs: tabs.map(tab => ({ url: tab.url, title: tab.title })),
    created_at: Date.now()
  };

  const result = await chrome.storage.local.get(['sessions']);
  const sessions = result.sessions || [];

  // All features are now free - unlimited sessions
  sessions.push(session);
  await chrome.storage.local.set({ sessions });

  return session;
}

// Restore session
async function restoreSession(sessionId) {
  const result = await chrome.storage.local.get(['sessions']);
  const sessions = result.sessions || [];
  const session = sessions.find(s => s.id === sessionId);
  
  if (!session) {
    throw new Error('Session not found');
  }
  
  for (const tab of session.tabs) {
    await chrome.tabs.create({ url: tab.url });
  }
  
  return session;
}

// Delete session
async function deleteSession(sessionId) {
  const result = await chrome.storage.local.get(['sessions']);
  let sessions = result.sessions || [];
  
  sessions = sessions.filter(s => s.id !== sessionId);
  await chrome.storage.local.set({ sessions });
  
  return true;
}

// Get all sessions
async function getAllSessions() {
  const result = await chrome.storage.local.get(['sessions']);
  return result.sessions || [];
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    saveCurrentSession,
    restoreSession,
    deleteSession,
    getAllSessions
  };
}