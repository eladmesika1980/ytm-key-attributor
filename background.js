// Service Worker for YTM Key Attributor.
// Manages the chrome.tabCapture stream capturing and the Offscreen Document lifecycle,
// and relays analyzed real-time DSP results to the content scripts.

let activeTabId = null;
let isTuning = false;
let latestData = null;

// Track if offscreen document is active
async function hasOffscreenDocument() {
  if (chrome.runtime.getContexts) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    return contexts.length > 0;
  }
  return false;
}

// Create offscreen document if it doesn't exist
async function createOffscreenDocument() {
  const hasDoc = await hasOffscreenDocument();
  if (hasDoc) return;
  
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['USER_MEDIA'],
    justification: 'Real-time local DSP analysis of tab audio stream'
  });
}

// Close offscreen document
async function closeOffscreenDocument() {
  const hasDoc = await hasOffscreenDocument();
  if (hasDoc) {
    await chrome.offscreen.closeDocument();
  }
}

// Start tab capture and analysis
async function startCapture(tabId) {
  try {
    activeTabId = tabId;
    isTuning = true;
    latestData = null;
    
    // Obtain media stream ID for tab audio capture
    // In MV3, we call getMediaStreamId with targetTabId
    chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, async (streamId) => {
      if (chrome.runtime.lastError) {
        console.error("[YTM Key Attributor SW] tabCapture error:", chrome.runtime.lastError.message);
        stopCapture();
        return;
      }
      
      if (!streamId) {
        console.error("[YTM Key Attributor SW] No stream ID returned.");
        stopCapture();
        return;
      }
      
      // Ensure offscreen document exists
      await createOffscreenDocument();
      
      // Notify offscreen document to capture and analyze the stream
      chrome.runtime.sendMessage({
        action: "start-analysis",
        streamId: streamId
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn("[YTM Key Attributor SW] Error messaging offscreen:", chrome.runtime.lastError.message);
        } else {
          console.log("[YTM Key Attributor SW] Offscreen analysis started:", response);
        }
      });
      
      // Update browser action icon state
      chrome.action.setBadgeText({ text: "ON", tabId: tabId });
      chrome.action.setBadgeBackgroundColor({ color: "#1db954", tabId: tabId });
      
      // Notify content script that tuning has started
      chrome.tabs.sendMessage(tabId, { action: "tuning-started" }).catch(() => {});
    });
  } catch (err) {
    console.error("[YTM Key Attributor SW] Failed to start capture:", err);
    stopCapture();
  }
}

// Stop capture and cleanup
async function stopCapture() {
  isTuning = false;
  latestData = null;
  
  // Reset badge text
  if (activeTabId) {
    chrome.action.setBadgeText({ text: "", tabId: activeTabId });
    // Notify content script that tuning has stopped
    chrome.tabs.sendMessage(activeTabId, { action: "tuning-stopped" }).catch(() => {});
  }
  
  // Close the analyzer offscreen page
  await closeOffscreenDocument().catch(() => {});
  activeTabId = null;
}

// Listen for the toolbar icon click
chrome.action.onClicked.addListener(async (tab) => {
  // We only enable capture on music.youtube.com
  if (!tab.url || !tab.url.includes("music.youtube.com")) {
    console.log("[YTM Key Attributor SW] Extension must be clicked while on music.youtube.com");
    return;
  }
  
  if (isTuning && activeTabId === tab.id) {
    console.log("[YTM Key Attributor SW] Toggling tuner: stopping...");
    await stopCapture();
  } else {
    if (isTuning) {
      // Stop previous tab capture first
      await stopCapture();
    }
    console.log("[YTM Key Attributor SW] Toggling tuner: starting on tab", tab.id);
    await startCapture(tab.id);
  }
});

// Clean up if the target tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === activeTabId) {
    console.log("[YTM Key Attributor SW] Target tab closed. Cleaning up capture session.");
    stopCapture();
  }
});

// Listen for messages from Content Scripts, Options, or Offscreen Document
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle results update from offscreen analyzer
  if (message.action === "update-analysis-results") {
    latestData = message.data;
    
    // Relay results to content script in the active YTM tab
    if (activeTabId && isTuning) {
      chrome.tabs.sendMessage(activeTabId, {
        action: "updateKeyBpm",
        data: latestData
      }).catch((e) => {
        // Discard errors from unloaded tabs
      });
    }
    sendResponse({ success: true });
    return true;
  }

  // Content script querying connection status or active tuner data on startup
  if (message.action === "query-tuner-status") {
    sendResponse({
      isTuning: isTuning && (activeTabId === message.tabId || !message.tabId),
      data: latestData
    });
    return true;
  }

  // Handle resetting tuner history buffers
  if (message.action === "reset-history") {
    chrome.runtime.sendMessage({ action: "reset-history" }).catch(() => {});
    sendResponse({ success: true });
    return true;
  }

  // Handle opening settings options page
  if (message.action === "openOptions") {
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
    return true;
  }
});
