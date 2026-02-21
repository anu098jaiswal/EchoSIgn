// content.js — Injects and controls the Echo-Sign overlay on any webpage

(function () {
  if (window.__echoSignLoaded) return;
  window.__echoSignLoaded = true;

  let overlayEl = null;

  // ─── Gloss map (inline — content scripts cannot import ES modules) ──────────
  const GLOSS_MAP = {
    // Current single animations mapped
    "hello": "hello", "hi": "hello", "hey": "hello",
    "clap": "clap", "applause": "clap",
    "point": "point", "there": "point", "look": "point",
    "yes": "yes", "yeah": "yes", "yep": "yes",
    "no": "no", "nah": "no", "nope": "no",
    "good": "good", "nice": "good",
    "acknowledge": "acknowledge", "ok": "acknowledge", "okay": "acknowledge",
    "think": "think", "hmm": "think",

    // New single animations imported from device
    "angry": "angry", "mad": "angry", "furious": "angry",
    "dismiss": "dismissing_gesture", "ignore": "dismissing_gesture", "whatever": "dismissing_gesture",
    "fall": "falling", "falling": "falling", "drop": "falling",
    "stand": "female_standing_pose", "standing": "female_standing_pose", "wait": "female_standing_pose",
    "ready": "offensive_idle", "impatient": "offensive_idle",
    "open": "opening", "opening": "opening", "start": "opening",
    "run": "running", "running": "running", "sprint": "running",
    "dance": "samba_dancing", "dancing": "samba_dancing", "party": "samba_dancing",
    "laugh": "sitting_laughing", "laughing": "sitting_laughing", "funny": "sitting_laughing", "haha": "sitting_laughing", "lol": "sitting_laughing",
    "talk": "sitting_talking", "talking": "sitting_talking", "speak": "sitting_talking", "chat": "sitting_talking",
    "spin": "spin_in_place", "turn": "spin_in_place", "round": "spin_in_place",
    "walk": "standard_walk", "walking": "standard_walk", "stroll": "standard_walk",
    "ovation": "standing_clap", "cheer": "standing_clap",
    "surprise": "surprised", "surprised": "surprised", "shock": "surprised", "shocked": "surprised", "wow": "surprised",
    "taunt": "taunt", "tease": "taunt", "mock": "taunt",
    "secret": "telling_a_secret", "whisper": "telling_a_secret", "shh": "telling_a_secret",
    "text": "texting_while_standing", "texting": "texting_while_standing", "message": "texting_while_standing", "phone": "texting_while_standing",
    "thank": "thankful", "thanks": "thankful", "thankful": "thankful", "grateful": "thankful",
    "doubt": "thoughtful_head_shake", "disbelieve": "thoughtful_head_shake",
    "fax": "using_a_fax_machine", "print": "using_a_fax_machine",
    "victory": "victory", "win": "victory", "won": "victory", "yay": "victory", "celebrate": "victory",

    // New 30+ words mapped to concept-breaking arrays of existing animations
    "agree": ["yes", "acknowledge"],
    "disagree": ["no", "think"],
    "understand": ["think", "acknowledge"],
    "understood": ["think", "acknowledge"],
    "confused": ["think", "no"],
    "idea": ["think", "point"],
    "great": ["good", "clap"],
    "awesome": ["good", "clap"],
    "excellent": ["good", "clap"],
    "perfect": ["good", "yes"],
    "wrong": ["no", "point"],
    "smart": ["think", "good"],
    "brilliant": ["think", "good", "clap"],
    "welcome": ["hello", "acknowledge"],
    "amazing": ["clap", "good"],
    "bad": ["no", "good"],
    "right": ["yes", "point"],
    "correct": ["yes", "point", "good"],
    "approve": ["yes", "good", "acknowledge"],
    "reject": ["no", "acknowledge"],
    "maybe": ["think", "acknowledge"],
    "question": ["think", "point"],
    "questions": ["think", "point"],
    "answer": ["acknowledge", "point"],
    "listen": ["acknowledge", "think"],
    "sure": ["yes", "good"],
    "problem": ["think", "no"],
    "solution": ["think", "yes"],
    "congratulations": ["clap", "clap"],
    "congrats": ["clap", "clap"],
    "success": ["good", "clap"],
    "failure": ["no", "good"],
    "best": ["good", "yes"],
    "true": ["yes", "point"],
    "false": ["no", "point"],
    "important": ["point", "acknowledge"],

    // Study-related and Academic
    "learn": ["think", "good"],
    "learning": ["think", "good", "acknowledge"],
    "study": ["think", "acknowledge"],
    "studying": ["think", "acknowledge", "acknowledge"],
    "know": ["think", "yes"],
    "student": ["hello", "acknowledge"],
    "teacher": ["hello", "clap"],
    "computer": ["think", "point"],
    "exam": ["think", "point", "acknowledge"],
    "test": ["think", "point", "acknowledge"],
    "quiz": ["think", "point"],
    "book": ["think", "acknowledge"],
    "books": ["think", "acknowledge"],
    "read": ["point", "acknowledge"],
    "reading": ["point", "acknowledge"],
    "write": ["point", "think"],
    "writing": ["point", "think"],
    "math": ["think", "yes"],
    "mathematics": ["think", "yes"],
    "science": ["think", "yes"],
    "history": ["think", "acknowledge"],
    "literature": ["think", "acknowledge"],
    "physics": ["think", "yes"],
    "chemistry": ["think", "yes"],
    "biology": ["think", "yes"],
    "lecture": ["acknowledge", "point", "think"],
    "class": ["hello", "acknowledge"],
    "classroom": ["hello", "acknowledge"],
    "school": ["acknowledge", "good"],
    "college": ["acknowledge", "good"],
    "university": ["acknowledge", "good", "clap"],
    "homework": ["think", "acknowledge", "point"],
    "assignment": ["think", "acknowledge", "point"],
    "research": ["think", "think"],
    "project": ["think", "good", "point"]
  };


  function wordToGloss(word) {
    return GLOSS_MAP[word.toLowerCase().replace(/[^a-z0-9]/g, '')] || null;
  }

  // ─── Speech recognition (runs here so it inherits page mic access) ──────────
  let recognition = null;
  let isListening = false;
  let lastInterimGloss = null; // prevents the same sign firing repeatedly on interim updates

  function startListening(lang) {
    if (isListening) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', state: 'error', error: 'not-supported' }).catch(() => { });
      return;
    }

    // In content script context, SpeechRecognition handles mic permission natively.
    // No getUserMedia pre-call needed (that was only required in the popup context).
    recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang || 'en-IN';

    recognition.onstart = () => {
      isListening = true;
      chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', state: 'listening' }).catch(() => { });
    };

    recognition.onend = () => {
      if (isListening) setTimeout(() => recognition?.start(), 300);
    };

    recognition.onerror = (e) => {
      if (e.error !== 'no-speech') {
        chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', state: 'error', error: e.error }).catch(() => { });
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
        chrome.runtime.sendMessage({ type: 'TRANSCRIPT_UPDATE', text: finalText.trim() }).catch(() => { });
        finalText.toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .split(/\s+/)
          .filter(w => w.length > 1)
          .forEach(word => {
            const result = wordToGloss(word);
            if (result) {
              // Send the full mapped word to UI
              chrome.runtime.sendMessage({ type: 'WORD_DETECTED', gloss: word }).catch(() => { });

              // Play animations
              const glosses = Array.isArray(result) ? result : [result];
              glosses.forEach(gloss => {
                document.getElementById('echo-sign-iframe')?.contentWindow?.postMessage({ type: 'echo-sign:play', gloss }, '*');
              });
            }
          });
      } else if (interimText) {
        chrome.runtime.sendMessage({ type: 'TRANSCRIPT_UPDATE', text: interimText.trim() }).catch(() => { });
        const words = interimText.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 1);
        const lastWord = words[words.length - 1];
        if (lastWord) {
          const result = wordToGloss(lastWord);
          if (result) {
            const glosses = Array.isArray(result) ? result : [result];
            const mainGloss = glosses[0];
            if (mainGloss !== lastInterimGloss) {
              lastInterimGloss = mainGloss;

              // Send the full mapped word to UI
              chrome.runtime.sendMessage({ type: 'WORD_DETECTED', gloss: lastWord }).catch(() => { });

              glosses.forEach(gloss => {
                document.getElementById('echo-sign-iframe')?.contentWindow?.postMessage({ type: 'echo-sign:play', gloss }, '*');
              });
            }
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
        <span>🤟 Echo-Sign</span>
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
      </div>
    `;

    // Inject styles
    const style = document.createElement('style');
    style.textContent = `
      #echo-sign-overlay {
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 300px;
        background: rgba(10, 10, 20, 0.92);
        border: 1.5px solid #6C63FF;
        border-radius: 16px;
        box-shadow: 0 0 30px rgba(108, 99, 255, 0.4);
        z-index: 2147483647;
        font-family: 'Segoe UI', sans-serif;
        color: white;
        overflow: hidden;
        resize: both;
        min-width: 220px;
        min-height: 280px;
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
    iframe.style.cssText = 'width:284px;height:220px;border:none;border-radius:10px;display:block;';
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

  function setGloss(gloss) {
    const el = overlayEl?.querySelector('#echo-sign-current-gloss');
    if (el) el.textContent = gloss ? `✋ ${gloss.replace(/_/g, ' ')}` : 'Waiting...';
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
            const result = wordToGloss(word);
            if (result) {
              chrome.runtime.sendMessage({ type: 'WORD_DETECTED', gloss: word }).catch(() => { });

              const glosses = Array.isArray(result) ? result : [result];
              glosses.forEach(gloss => {
                document.getElementById('echo-sign-iframe')?.contentWindow?.postMessage({ type: 'echo-sign:play', gloss }, '*');
              });
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
