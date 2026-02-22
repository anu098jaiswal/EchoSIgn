// background.js — Echo-Sign Service Worker
// Routes messages between popup, content scripts, and offscreen document.

// Messages from popup (no sender.tab) → forward to content script or offscreen
// Messages from content/offscreen → forward to popup or content script

let captureMode = 'mic'; // 'mic' | 'tab'

const TO_CONTENT = ['TOGGLE_OVERLAY', 'START_LISTENING', 'STOP_LISTENING', 'PLAY_SIGN', 'STOP', 'SET_SPEED', 'SET_AVATAR', 'START_DEMO', 'STOP_DEMO'];
const TO_POPUP   = ['STATUS_UPDATE', 'WORD_DETECTED', 'TRANSCRIPT_UPDATE'];

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // ── Tab audio capture (popup → background orchestration) ────────────────
  if (!sender.tab && message.type === 'START_TAB_CAPTURE') {
    captureMode = 'tab';
    handleStartTabCapture(message);
    sendResponse({ ok: true });
    return true;
  }

  // ── Transcript chunk from offscreen → content + popup ───────────────────
  if (message.type === 'TRANSCRIPT_CHUNK') {
    // Forward as PROCESS_TRANSCRIPT to active tab's content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'PROCESS_TRANSCRIPT',
          text: message.text,
        }).catch(() => {});
      }
    });
    // Forward transcript to popup
    chrome.runtime.sendMessage({ type: 'TRANSCRIPT_UPDATE', text: message.text }).catch(() => {});
    sendResponse({ ok: true });
    return true;
  }

  // ── STOP_LISTENING: behaviour depends on mode ────────────────────────────
  if (!sender.tab && message.type === 'STOP_LISTENING') {
    if (captureMode === 'tab') {
      chrome.runtime.sendMessage({ type: 'STOP_TAB_CAPTURE' }).catch(() => {});
      closeOffscreen();
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, message).catch(() => {});
        }
      });
    }
    captureMode = 'mic';
    sendResponse({ ok: true });
    return true;
  }

  // ── Generic popup → content routing ─────────────────────────────────────
  if (!sender.tab && TO_CONTENT.includes(message.type)) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, message).catch(() => {});
      }
    });
  }

  // ── Generic content/offscreen → popup routing ────────────────────────────
  if (TO_POPUP.includes(message.type)) {
    chrome.runtime.sendMessage(message).catch(() => {});
  }

  sendResponse({ ok: true });
  return true;
});

// ── Tab capture helpers ──────────────────────────────────────────────────────

async function handleStartTabCapture({ apiKey, lang }) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tabs[0]?.id;
    if (!tabId) return;

    // Show overlay on the tab
    chrome.tabs.sendMessage(tabId, { type: 'TOGGLE_OVERLAY', visible: true }).catch(() => {});

    // Notify popup we are starting
    chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', state: 'connecting' }).catch(() => {});

    // Create offscreen document if it doesn't exist yet
    const existing = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
    }).catch(() => []);

    if (existing.length === 0) {
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['USER_MEDIA', 'AUDIO_PLAYBACK'],
        justification: 'Capture tab audio for ISL speech-to-sign transcription',
      });
    }

    // Get stream ID for the target tab
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });

    // Send stream ID + credentials to offscreen document
    chrome.runtime.sendMessage({
      type: 'START_TAB_CAPTURE',
      streamId,
      apiKey,
      lang,
    }).catch(() => {});

  } catch (err) {
    console.error('[Echo-Sign BG] Tab capture setup failed:', err);
    chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', state: 'error', error: 'setup-failed' }).catch(() => {});
  }
}

async function closeOffscreen() {
  const existing = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  }).catch(() => []);

  if (existing.length > 0) {
    chrome.offscreen.closeDocument().catch(() => {});
  }
}

console.log('[Echo-Sign] Background service worker started.');
