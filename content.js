// content.js — Injects and controls the Echo-Sign overlay on any webpage

(function () {
  if (window.__echoSignLoaded) return;
  window.__echoSignLoaded = true;

  let overlayEl = null;

  // ─── Gloss map (inline — content scripts cannot import ES modules) ──────────
  // Each key is an English word; value is the ASL gloss name.
  // Gloss name must match a loadAnim() call in avatarContent-src.js.
  // Words not found here are fingerspelled letter-by-letter (SPELL: path).
  // MVP GLOSS_MAP — 7 signs (4 GLB + 3 MP4)
  // Demo sentence: "Hello! I think you are good. Please help. Do you understand? Thank you. Goodbye."
  // Unknown words fall through to fingerspelling automatically.
  const GLOSS_MAP = {

    // ══ HELLO (GLB) ══
    "hello": "HELLO", "hi": "HELLO", "hey": "HELLO",
    "greet": "HELLO", "greetings": "HELLO", "howdy": "HELLO", "welcome": "HELLO",

    // ══ THINK (GLB) ══
    "think": "THINK", "wonder": "THINK", "consider": "THINK",
    "maybe": "THINK", "idea": "THINK", "believe": "THINK", "opinion": "THINK",

    // ══ GOOD (GLB) ══
    "good": "GOOD", "nice": "GOOD", "happy": "GOOD",
    "well": "GOOD", "fine": "GOOD",

    // ══ UNDERSTAND (GLB) ══
    "understand": "UNDERSTAND", "understood": "UNDERSTAND",
    "got": "UNDERSTAND", "alright": "UNDERSTAND", "noted": "UNDERSTAND",

    // ══ HELP (MP4 — assets/videos/help.mp4) ══
    "help": "HELP", "support": "HELP", "assist": "HELP",
    "fix": "HELP", "rescue": "HELP",

    // ══ THANK-YOU (MP4 — assets/videos/thank_you.mp4) ══
    "thanks": "THANK-YOU", "thank": "THANK-YOU", "grateful": "THANK-YOU",
    "appreciate": "THANK-YOU", "thankyou": "THANK-YOU",

    // ══ GOODBYE (MP4 — assets/videos/goodbye.mp4) ══
    "bye": "GOODBYE", "goodbye": "GOODBYE", "farewell": "GOODBYE", "later": "GOODBYE",

    // ══ POINT (GLB — for demo: "deaf people") ══
    "deaf": "POINT", "people": "POINT",
  };

  // Deduplicate: if a word maps to a gloss that has a duplicate key, last one wins (JS default)

  function wordToGloss(word) {
    const clean = word.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (GLOSS_MAP[clean]) return GLOSS_MAP[clean];
    // Unknown word → fingerspell it (min 3 chars to skip noise)
    if (clean.length >= 3) return 'SPELL:' + clean;
    return null;
  }

  // ─── Dispatch a gloss (or fingerspell an unknown word) to the iframe ─────
  function dispatchGloss(gloss) {
    const iframe = document.getElementById('echo-sign-iframe');
    if (!iframe?.contentWindow) return;
    if (gloss.startsWith('SPELL:')) {
      const letters = gloss.slice(6).split('');
      letters.forEach((letter, i) => {
        setTimeout(() => {
          iframe.contentWindow.postMessage({ type: 'echo-sign:letter', letter }, '*');
        }, i * 450); // stagger each letter by 450ms
      });
      setGloss('spell: ' + gloss.slice(6));
    } else {
      iframe.contentWindow.postMessage({ type: 'echo-sign:play', gloss }, '*');
      setGloss(gloss);
    }
  }

  // ─── Speech recognition (runs here so it inherits page mic access) ──────────
  let recognition = null;
  let isListening = false;
  let lastInterimGloss = null; // prevents the same sign firing repeatedly on interim updates

  function startListening(lang) {
    if (isListening) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', state: 'error', error: 'not-supported' }).catch(() => {});
      return;
    }

    // In content script context, SpeechRecognition handles mic permission natively.
    // No getUserMedia pre-call needed (that was only required in the popup context).
    recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang || 'en-US';

    recognition.onstart = () => {
      isListening = true;
      chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', state: 'listening' }).catch(() => {});
    };

    recognition.onend = () => {
      if (isListening) setTimeout(() => recognition?.start(), 300);
    };

    recognition.onerror = (e) => {
      if (e.error !== 'no-speech') {
        chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', state: 'error', error: e.error }).catch(() => {});
      }
    };

    recognition.onresult = (event) => {
      let interimText = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) finalText += r[0].transcript + ' ';
        else interimText += r[0].transcript;
      }

      if (finalText) {
        lastInterimGloss = null; // reset dedup on finalized phrase
        chrome.runtime.sendMessage({ type: 'TRANSCRIPT_UPDATE', text: finalText.trim() }).catch(() => {});
        finalText.toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .split(/\s+/)
          .filter(w => w.length > 1)
          .forEach(word => {
            const gloss = wordToGloss(word);
            if (gloss) {
              dispatchGloss(gloss);
              chrome.runtime.sendMessage({ type: 'WORD_DETECTED', gloss }).catch(() => {});
            }
          });
      } else if (interimText) {
        chrome.runtime.sendMessage({ type: 'TRANSCRIPT_UPDATE', text: interimText.trim() }).catch(() => {});
        // Also trigger signs from interim — fires when recognition never finalises (e.g. background audio)
        const words = interimText.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 1);
        const lastWord = words[words.length - 1];
        if (lastWord) {
          const gloss = wordToGloss(lastWord);
          if (gloss && gloss !== lastInterimGloss) {
            lastInterimGloss = gloss;
            dispatchGloss(gloss);
            chrome.runtime.sendMessage({ type: 'WORD_DETECTED', gloss }).catch(() => {});
          }
        }
      }
    };

    recognition.start();
  }

  function stopListening() {
    isListening = false;
    recognition?.stop();
    recognition = null;
    setStatus('idle');
    setCaption('');
    setGloss(null);
  }

  // ─── Create the floating overlay ──────────────────────────────────────────
  function createOverlay() {
    if (overlayEl) return;

    overlayEl = document.createElement('div');
    overlayEl.id = 'echo-sign-overlay';
    overlayEl.innerHTML = `
      <div id="echo-sign-header">
        <span>🤟 Echo-Sign ASL</span>
        <div id="echo-sign-controls">
          <span id="echo-sign-status" class="status-dot idle"></span>
          <button id="echo-sign-minimize">—</button>
          <button id="echo-sign-close">✕</button>
        </div>
      </div>
      <div id="echo-sign-body">
        <div id="echo-sign-avatar-container"></div>
        <div id="echo-sign-caption"></div>
        <div id="echo-sign-gloss-bar">
          <span id="echo-sign-current-gloss">Waiting...</span>
        </div>
        <div id="echo-sign-history"></div>
      </div>
    `;

    // Inject styles
    const style = document.createElement('style');
    style.textContent = `
      #echo-sign-overlay {
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 340px;
        background: rgba(10, 10, 20, 0.92);
        border: 1.5px solid #6C63FF;
        border-radius: 16px;
        box-shadow: 0 0 30px rgba(108, 99, 255, 0.4);
        z-index: 2147483647;
        font-family: 'Segoe UI', sans-serif;
        color: white;
        overflow: hidden;
        resize: both;
        min-width: 260px;
        min-height: 320px;
        transition: opacity 0.3s;
        user-select: none;
      }
      #echo-sign-overlay.minimized #echo-sign-body {
        display: none;
      }
      #echo-sign-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        background: rgba(108, 99, 255, 0.25);
        cursor: grab;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.5px;
      }
      #echo-sign-controls {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      #echo-sign-controls button {
        background: none;
        border: none;
        color: #ccc;
        cursor: pointer;
        font-size: 13px;
        padding: 2px 5px;
        border-radius: 4px;
        transition: background 0.2s;
      }
      #echo-sign-controls button:hover {
        background: rgba(255,255,255,0.15);
        color: white;
      }
      .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        display: inline-block;
      }
      .status-dot.idle { background: #888; }
      .status-dot.listening { background: #4CAF50; animation: pulse 1.2s infinite; }
      .status-dot.signing { background: #6C63FF; animation: pulse 0.8s infinite; }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }
      #echo-sign-body {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 8px;
      }
      #echo-sign-canvas {
        width: 284px;
        height: 220px;
        border-radius: 10px;
        background: #0a0a14;
      }
      #echo-sign-caption {
        font-size: 11px;
        color: #aaa;
        text-align: center;
        padding: 4px 8px;
        min-height: 18px;
        width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #echo-sign-gloss-bar {
        background: rgba(108, 99, 255, 0.2);
        border-radius: 8px;
        padding: 4px 12px;
        font-size: 12px;
        font-weight: 500;
        color: #c8c4ff;
        text-align: center;
        width: calc(100% - 24px);
        margin-bottom: 4px;
        min-height: 22px;
      }
      #echo-sign-history {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
        padding: 0 8px 6px;
        justify-content: center;
        min-height: 20px;
      }
      .es-h-chip {
        background: rgba(108, 99, 255, 0.12);
        border: 1px solid rgba(108, 99, 255, 0.25);
        border-radius: 6px;
        padding: 2px 8px;
        font-size: 10px;
        color: #9990ff;
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(overlayEl);

    setupDrag();
    setupButtons();
    loadAvatarScript();
  }

  // ─── Drag to move ─────────────────────────────────────────────────────────
  function setupDrag() {
    const header = overlayEl.querySelector('#echo-sign-header');
    let isDragging = false, startX, startY, origLeft, origBottom;

    header.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = overlayEl.getBoundingClientRect();
      origLeft = rect.left;
      origBottom = window.innerHeight - rect.bottom;
      header.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      overlayEl.style.left = (origLeft + dx) + 'px';
      overlayEl.style.right = 'auto';
      overlayEl.style.bottom = (origBottom - dy) + 'px';
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      header.style.cursor = 'grab';
    });
  }

  // ─── Button actions ────────────────────────────────────────────────────────
  function setupButtons() {
    overlayEl.querySelector('#echo-sign-minimize').addEventListener('click', () => {
      overlayEl.classList.toggle('minimized');
    });
    overlayEl.querySelector('#echo-sign-close').addEventListener('click', () => {
      overlayEl.style.display = 'none';
    });
  }

  // ─── Load the Three.js avatar in an extension iframe (bypasses page CSP) ──
  function loadAvatarScript() {
    const iframe = document.createElement('iframe');
    iframe.id = 'echo-sign-iframe';
    iframe.src = chrome.runtime.getURL('src/avatar-frame.html');
    iframe.style.cssText = 'width:324px;height:250px;border:none;border-radius:10px;display:block;';
    const container = overlayEl.querySelector('#echo-sign-avatar-container');
    container.appendChild(iframe);
  }

  // ─── Update UI helpers ────────────────────────────────────────────────────
  function setStatus(state) {
    const dot = overlayEl?.querySelector('#echo-sign-status');
    if (dot) {
      dot.className = 'status-dot ' + state;
    }
  }

  function setCaption(text) {
    const el = overlayEl?.querySelector('#echo-sign-caption');
    if (el) el.textContent = text;
  }

  const historyGlosses = [];
  function setGloss(gloss) {
    const el = overlayEl?.querySelector('#echo-sign-current-gloss');
    if (el) el.textContent = gloss ? `✋ ${gloss.replace(/_/g, ' ')}` : 'Waiting...';
    if (gloss) {
      historyGlosses.push(gloss);
      if (historyGlosses.length > 4) historyGlosses.shift();
      const hist = overlayEl?.querySelector('#echo-sign-history');
      if (hist) {
        hist.innerHTML = historyGlosses.map(g =>
          `<span class="es-h-chip">${g.replace(/_/g, ' ')}</span>`
        ).join('');
      }
    }
  }

  // ─── Listen for messages from background / popup ──────────────────────────
  chrome.runtime.onMessage.addListener((message) => {
    switch (message.type) {
      case 'TOGGLE_OVERLAY':
        if (message.visible) {
          createOverlay();
          if (overlayEl) overlayEl.style.display = '';
        } else {
          if (overlayEl) overlayEl.style.display = 'none';
        }
        break;

      case 'START_LISTENING':
        createOverlay();
        if (overlayEl) overlayEl.style.display = '';
        startListening(message.lang);
        break;

      case 'STOP_LISTENING':
        stopListening();
        break;

      case 'PROCESS_TRANSCRIPT':
        // Arrives from offscreen (tab audio mode) — look up glosses and sign them
        setCaption(message.text);
        message.text.toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .split(/\s+/)
          .filter(w => w.length > 1)
          .forEach(word => {
            const gloss = wordToGloss(word);
            if (gloss) {
              dispatchGloss(gloss);
              chrome.runtime.sendMessage({ type: 'WORD_DETECTED', gloss }).catch(() => {});
            }
          });
        break;

      case 'TRANSCRIPT_UPDATE':
        setCaption(message.text);
        break;

      case 'STOP':
        stopListening();
        break;
    }
  });

  // Auto-create overlay when content script loads
  createOverlay();
})();
