// popup/popup.js — Main controller
// Speech recognition now runs in content.js (page context) for mic access.

// ─── State ──────────────────────────────────────────────────────────────────
let isRunning = false;
let glossCount = 0;
const recentGlosses = [];  // last 8 glosses shown in UI

// ─── DOM refs ────────────────────────────────────────────────────────────────
const toggleBtn    = document.getElementById('toggle-btn');
const btnText      = document.getElementById('btn-text');
const btnIcon      = document.getElementById('btn-icon');
const demoBtn      = document.getElementById('demo-btn');
const clearBtn     = document.getElementById('clear-btn');
const transcriptEl = document.getElementById('transcript-box');
const glossQueueEl = document.getElementById('gloss-queue');
const statusDot    = document.getElementById('status-dot');
const statusText   = document.getElementById('status-text');
const glossCountEl = document.getElementById('gloss-count');
const langSelect   = document.getElementById('lang-select');
const sourceSelect = document.getElementById('source-select');
const apiKeyInput  = document.getElementById('api-key-input');
const apiKeyRow    = document.getElementById('api-key-row');
const speedSelect  = document.getElementById('speed-select');
const avatarSelect = document.getElementById('avatar-select');

// ─── Start / Stop ────────────────────────────────────────────────────────────
toggleBtn.addEventListener('click', () => {
  if (!isRunning) startEchoSign();
  else stopEchoSign();
});

demoBtn.addEventListener('click', () => {
  sendToBackground({ type: 'START_DEMO' });
});

clearBtn.addEventListener('click', () => {
  transcriptEl.innerHTML = '<span class="placeholder">Transcript will appear here...</span>';
  glossQueueEl.innerHTML = '<span style="color:#444; font-size:11px; font-style:italic;">No signs yet...</span>';
  recentGlosses.length = 0;
  glossCount = 0;
  glossCountEl.textContent = '0';
});

// ─── Initialize Echo-Sign ─────────────────────────────────────────────────────
function startEchoSign() {
  isRunning = true;
  const source = sourceSelect.value;

  if (source === 'tab') {
    setUI('connecting', true); // tab mode connecting text
    sendToBackground({
      type: 'START_TAB_CAPTURE',
      lang: langSelect.value,
      apiKey: apiKeyInput.value.trim(),
    });
  } else {
    setUI('connecting');
    sendToBackground({ type: 'START_LISTENING', lang: langSelect.value });
  }
}

function stopEchoSign() {
  isRunning = false;
  setUI('idle');
  sendToBackground({ type: 'STOP_LISTENING' });
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
function setUI(state, tabMode = false) {
  const states = {
    idle: {
      dot: '',
      text: 'Not started',
      btnText: 'Start Signing',
      btnIcon: '🎤',
      btnClass: ''
    },
    connecting: {
      dot: '',
      text: tabMode ? 'Capturing tab audio...' : 'Starting microphone...',
      btnText: 'Starting...',
      btnIcon: '⏳',
      btnClass: ''
    },
    listening: {
      dot: 'listening',
      text: 'Listening for speech...',
      btnText: 'Stop Signing',
      btnIcon: '⏹',
      btnClass: 'active'
    },
    signing: {
      dot: 'signing',
      text: 'Performing sign...',
      btnText: 'Stop Signing',
      btnIcon: '⏹',
      btnClass: 'active'
    },
    error: {
      dot: 'error',
      text: 'Error — check mic permission',
      btnText: 'Retry',
      btnIcon: '🔄',
      btnClass: ''
    }
  };

  const s = states[state] || states.idle;
  statusDot.className = 'status-dot ' + s.dot;
  statusText.textContent = s.text;
  btnText.textContent = s.btnText;
  btnIcon.textContent = s.btnIcon;
  toggleBtn.className = 'btn-primary ' + s.btnClass;
}

function updateTranscript(text) {
  transcriptEl.textContent = text;
  transcriptEl.scrollTop = transcriptEl.scrollHeight;
}

function addGlossChip(gloss) {
  // Remove placeholder text if first chip
  if (recentGlosses.length === 0) {
    glossQueueEl.innerHTML = '';
  }

  recentGlosses.push(gloss);
  if (recentGlosses.length > 8) recentGlosses.shift();

  // Re-render chips
  glossQueueEl.innerHTML = recentGlosses.map((g, i) => {
    const isActive = i === recentGlosses.length - 1;
    return `<span class="gloss-chip ${isActive ? 'active' : ''}">${g.replace(/_/g, ' ')}</span>`;
  }).join('');
}

// ─── Send message to background ───────────────────────────────────────────────
function sendToBackground(message) {
  chrome.runtime.sendMessage(message).catch(err => {
    console.warn('[Echo-Sign Popup] Message error:', err.message);
  });
}

// ─── Listen for updates from content script (routed via background) ───────────
chrome.runtime.onMessage.addListener((message) => {
  switch (message.type) {
    case 'STATUS_UPDATE':
      if (!isRunning) return;
      setUI(message.state);
      if (message.state === 'error') {
        statusText.textContent = 'Error: ' + (message.error || 'unknown');
      }
      break;

    case 'WORD_DETECTED':
      glossCount++;
      glossCountEl.textContent = glossCount;
      addGlossChip(message.gloss);
      break;

    case 'TRANSCRIPT_UPDATE':
      updateTranscript(message.text);
      break;
  }
});

// ─── Settings persistence ─────────────────────────────────────────────────────
function toggleApiKeyRow() {
  apiKeyRow.style.display = sourceSelect.value === 'tab' ? '' : 'none';
}

sourceSelect.addEventListener('change', () => {
  toggleApiKeyRow();
  chrome.storage.local.set({ echoSignSource: sourceSelect.value });
});

apiKeyInput.addEventListener('change', () => {
  chrome.storage.local.set({ echoSignApiKey: apiKeyInput.value.trim() });
});

speedSelect.addEventListener('change', () => {
  sendToBackground({ type: 'SET_SPEED', speed: parseFloat(speedSelect.value) });
  chrome.storage.local.set({ echoSignSpeed: speedSelect.value });
});

avatarSelect.addEventListener('change', () => {
  sendToBackground({ type: 'SET_AVATAR', avatar: avatarSelect.value });
  chrome.storage.local.set({ echoSignAvatar: avatarSelect.value });
});

// ─── On load ──────────────────────────────────────────────────────────────────
chrome.storage.local.get(['echoSignSource', 'echoSignApiKey', 'echoSignSpeed', 'echoSignAvatar'], (data) => {
  if (data.echoSignSource) sourceSelect.value  = data.echoSignSource;
  if (data.echoSignApiKey) apiKeyInput.value   = data.echoSignApiKey;
  if (data.echoSignSpeed)  speedSelect.value   = data.echoSignSpeed;
  if (data.echoSignAvatar) avatarSelect.value  = data.echoSignAvatar;
  toggleApiKeyRow();
});
setUI('idle');
