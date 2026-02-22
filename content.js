// content.js — Injects and controls the Echo-Sign overlay on any webpage

(function () {
  if (window.__echoSignLoaded) return;
  window.__echoSignLoaded = true;

  let overlayEl = null;
  let currentSpeed = 1.0;
  let demoTimer = null;

  // ─── Demo scenes: each has a caption + ordered sign tokens ─────────────────
  // Token format: 'gloss_name' → plays that GLB | 'SPELL:word' → fingerspells it
  // GLB names must match keys loaded in avatarContent-src.js loadAnim() calls
  const DEMO_SCENES = [
    {
      caption: '👋 Hello! Welcome to Echo-Sign.',
      tokens: ['hello', 'hello'],
      tokenMs: [2200, 2000],
    },
    {
      caption: '✋ I can sign YES and NO.',
      tokens: ['yes', 'no'],
      tokenMs: [1600, 1800],
    },
    {
      caption: '🤔 Thinking... Got a good idea!',
      tokens: ['think', 'good'],
      tokenMs: [2000, 1600],
    },
    {
      caption: '👏 Great job — let\'s clap for that!',
      tokens: ['clap', 'clap', 'victory'],
      tokenMs: [2000, 2000, 2800],
    },
    {
      caption: '😮 Wow, that\'s surprising!',
      tokens: ['surprised', 'acknowledge'],
      tokenMs: [2200, 1800],
    },
    {
      caption: '💬 Let me explain the topic.',
      tokens: ['sitting_talking', 'point', 'think'],
      tokenMs: [2500, 1600, 2000],
    },
    {
      caption: '🎓 Study hard and learn every day.',
      tokens: ['think', 'acknowledge', 'think', 'good'],
      tokenMs: [2000, 1800, 2000, 1600],
    },
    {
      caption: '🔤 Fingerspelling: E-C-H-O',
      tokens: ['SPELL:echo'],
      tokenMs: [3500],
    },
    {
      caption: '🔤 Name sign: S-I-G-N',
      tokens: ['SPELL:sign'],
      tokenMs: [3200],
    },
    {
      caption: '😄 Don\'t give up — keep going!',
      tokens: ['no', 'dismissing_gesture', 'yes', 'good'],
      tokenMs: [1600, 2200, 1600, 1600],
    },
    {
      caption: '🙏 Thankful for your attention!',
      tokens: ['thankful', 'point', 'acknowledge'],
      tokenMs: [2200, 1600, 1800],
    },
    {
      caption: '💃 Echo-Sign — making communication fun!',
      tokens: ['samba_dancing', 'victory', 'clap'],
      tokenMs: [4500, 2800, 2200],
    },
    {
      caption: '👋 Goodbye — see you next time!',
      tokens: ['hello', 'acknowledge', 'hello'],
      tokenMs: [2200, 1800, 2200],
    },
  ];

  function stopDemo() {
    if (demoTimer) { clearTimeout(demoTimer); demoTimer = null; }
    const iframe = document.getElementById('echo-sign-iframe');
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'echo-sign:stop' }, '*');
    }
  }

  let demoActive = false;
  let demoSceneIdx = 0;
  let demoTokenIdx = 0;

  function runDemo() {
    createOverlay();
    if (overlayEl) overlayEl.style.display = '';
    demoActive = true;
    demoSceneIdx = 0;
    demoTokenIdx = 0;
    chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', state: 'signing' }).catch(() => {});
    playNextDemoToken();
  }

  function playNextDemoToken() {
    if (!demoActive) return;

    if (demoSceneIdx >= DEMO_SCENES.length) {
      demoActive = false;
      setCaption('✅ Demo complete!');
      setGloss(null);
      chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', state: 'idle' }).catch(() => {});
      return;
    }

    const scene = DEMO_SCENES[demoSceneIdx];
    const iframe = document.getElementById('echo-sign-iframe');

    if (demoTokenIdx === 0) {
      setCaption(scene.caption);
      chrome.runtime.sendMessage({ type: 'TRANSCRIPT_UPDATE', text: scene.caption }).catch(() => {});
    }

    if (demoTokenIdx >= scene.tokens.length) {
      demoTokenIdx = 0;
      demoSceneIdx++;
      // Scene break
      demoTimer = setTimeout(playNextDemoToken, 1000);
      return;
    }

    const token = scene.tokens[demoTokenIdx];
    if (token.startsWith('SPELL:')) {
      const word = token.slice(6);
      const letters = word.split('');
      const letterGap = Math.round(500 / currentSpeed);
      setGloss('spell: ' + word);
      chrome.runtime.sendMessage({ type: 'WORD_DETECTED', gloss: 'spell:' + word }).catch(() => {});
      
      let lettersFinished = 0;
      const letterListener = (e) => {
        if (e.data?.type === 'echo-sign:letter-finished') {
          lettersFinished++;
          if (lettersFinished >= letters.length) {
            window.removeEventListener('message', letterListener);
            demoTokenIdx++;
            playNextDemoToken();
          }
        }
      };
      window.addEventListener('message', letterListener);

      letters.forEach((letter, i) => {
        setTimeout(() => {
          if (iframe?.contentWindow)
            iframe.contentWindow.postMessage({ type: 'echo-sign:letter', letter }, '*');
        }, i * letterGap);
      });
    } else {
      setGloss(token);
      chrome.runtime.sendMessage({ type: 'WORD_DETECTED', gloss: token }).catch(() => {});

      const glossListener = (e) => {
        if (e.data?.type === 'echo-sign:gloss-finished' && e.data.gloss === token) {
          window.removeEventListener('message', glossListener);
          demoTokenIdx++;
          playNextDemoToken();
        }
      };
      window.addEventListener('message', glossListener);

      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage({
          type: 'echo-sign:play',
          gloss: token,
          speed: currentSpeed,
          demo: true
        }, '*');
      }
    }
  }

  // ─── Gloss map ───────────────────────────────────────────────────────────────
  // String value  → plays that GLB (must match loadAnim key in avatarContent-src.js)
  // Array value   → plays each GLB in sequence
  // UPPERCASE key → no GLB exists → tryPlayVideo() called → falls back to 600ms skip
  // Unknown word  → fingerspelled letter-by-letter
  const GLOSS_MAP = {
    // ── Single GLB animations ──
    "hello": "hello", "hi": "hello", "hey": "hello",
    "clap": "clap", "applause": "clap",
    "point": "point", "there": "point", "look": "point",
    "yes": "yes", "yeah": "yes", "yep": "yes",
    "no": "no", "nah": "no", "nope": "no",
    "good": "good", "nice": "good",
    "acknowledge": "acknowledge", "ok": "acknowledge", "okay": "acknowledge",
    "think": "think", "hmm": "think",
    // ── Extra GLBs (expressive — these share Kaya's Mixamo skeleton) ──
    "angry": "angry", "mad": "angry", "furious": "angry",
    "surprise": "surprised", "shocked": "surprised", "wow": "surprised",
    "victory": "victory", "win": "victory", "yay": "victory", "celebrate": "victory",
    "laugh": "sitting_laughing", "funny": "sitting_laughing", "haha": "sitting_laughing", "lol": "sitting_laughing",
    "talk": "sitting_talking", "talking": "sitting_talking", "chat": "sitting_talking",
    "doubt": "thoughtful_head_shake",
    "dismiss": "dismissing_gesture", "ignore": "dismissing_gesture",
    "deaf": "point", "people": "point",

    // ── ISL video clips (no GLB — plays assets/videos/*.mp4) ──
    "help": "HELP", "support": "HELP", "assist": "HELP", "rescue": "HELP",
    "thanks": "THANK-YOU", "thank": "THANK-YOU", "grateful": "THANK-YOU", "appreciate": "THANK-YOU",
    "bye": "GOODBYE", "goodbye": "GOODBYE", "farewell": "GOODBYE",

    // ── Multi-animation sequences (arrays play each GLB in order) ──
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
    "answer": ["acknowledge", "point"],
    "listen": ["acknowledge", "think"],
    "sure": ["yes", "good"],
    "problem": ["think", "no"],
    "solution": ["think", "yes"],
    "congratulations": ["clap", "clap"],
    "congrats": ["clap", "clap"],
    "success": ["good", "clap"],
    "best": ["good", "yes"],
    "true": ["yes", "point"],
    "false": ["no", "point"],
    "important": ["point", "acknowledge"],
    "learn": ["think", "good"],
    "study": ["think", "acknowledge"],
    "know": ["think", "yes"],
    "student": ["hello", "acknowledge"],
    "teacher": ["hello", "clap"],
    "exam": ["think", "point", "acknowledge"],
    "book": ["think", "acknowledge"],
    "read": ["point", "acknowledge"],
    "write": ["point", "think"],
    "math": ["think", "yes"],
    "science": ["think", "yes"],
    "computer": ["think", "point"],
    "school": ["acknowledge", "good"],
    "university": ["acknowledge", "good", "clap"],
    "homework": ["think", "acknowledge", "point"],
    "research": ["think", "think"],
    "project": ["think", "good", "point"],

    // ── Additional vocabulary (verified animations only) ──
    "begin": "hello", "start": "hello", "intro": "hello", "introduction": "hello", "open": "acknowledge",
    "thankful": "THANK-YOU",
    "bravo": ["clap", "victory"], "achievement": ["victory", "clap"],
    "secret": ["think", "acknowledge"], "whisper": "think", "private": ["think", "no"],
    "type": ["think", "point"], "typing": ["think", "point"],
    "walk": "point", "go": ["point", "acknowledge"], "move": "point",
    "run": ["angry", "point"], "rush": ["angry", "point"], "hurry": ["angry", "point"],
    "dance": ["clap", "sitting_laughing"], "enjoy": ["good", "clap"], "fun": ["sitting_laughing", "clap"],
    "wait": ["think", "acknowledge"], "stand": "acknowledge", "ready": ["yes", "good"],
    "send": ["point", "acknowledge"], "submit": ["yes", "acknowledge"], "share": ["point", "good"],
    "fall": ["no", "dismissing_gesture"], "mistake": ["no", "think"], "error": ["no", "think"],
    "challenge": ["angry", "think"], "compete": ["good", "think"],

    // ── Lecture / classroom ──
    "lecture":    ["sitting_talking", "point"],
    "explain":    ["point", "sitting_talking"],
    "discuss":    ["sitting_talking", "acknowledge"],
    "present":    ["hello", "point"],
    "lesson":     ["think", "acknowledge"],
    "topic":      ["point", "think"],
    "example":    ["point", "acknowledge"],
    "concept":    ["think", "point"],
    "theory":     ["think", "think"],
    "definition": ["think", "point"],
    "meaning":    ["think", "acknowledge"],
    "note":       ["think", "acknowledge"],
    "notes":      ["think", "acknowledge"],
    "focus":      ["think", "point"],
    "attention":  ["point", "think"],
    "sentence":   ["point", "think", "acknowledge"],

    // ── Academic actions ──
    "practice":   ["think", "good"],
    "complete":   ["yes", "good"],
    "finish":     ["yes", "acknowledge"],
    "continue":   ["yes", "point"],
    "remember":   ["think", "yes"],
    "forget":     ["no", "think"],
    "improve":    ["think", "good"],
    "pass":       ["yes", "good", "clap"],
    "fail":       ["no", "dismissing_gesture"],
    "grade":      ["good", "acknowledge"],
    "score":      ["good", "point"],
    "college":    ["acknowledge", "good", "clap"],
    "class":      ["acknowledge", "good"],
    "course":     ["acknowledge", "good"],
    "module":     ["think", "acknowledge"],
    "assignment": ["think", "acknowledge", "point"],
    "quiz":       ["think", "point"],
    "test":       ["think", "point"],
    "attend":     ["hello", "acknowledge"],
    "ask":        ["think", "point"],

    // ── Communication & broader education ──
    "communicate": ["sitting_talking", "acknowledge"],
    "language":   ["sitting_talking", "point"],
    "education":  ["think", "good", "clap"],
    "knowledge":  ["think", "yes"],
    "skill":      ["good", "acknowledge"],
    "ability":    ["good", "yes"],
    "report":     ["sitting_talking", "point"],
    "group":      ["hello", "acknowledge"],
    "team":       ["hello", "clap"],
    "work":       ["think", "good"],
  };

  function wordToGloss(word) {
    const clean = word.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (GLOSS_MAP[clean]) return GLOSS_MAP[clean];
    // Unknown word → fingerspell it (min 6 chars skips filler: are/the/and/that/with)
    if (clean.length >= 6) return 'SPELL:' + clean;
    return null;
  }

  // ─── Dispatch a gloss (or fingerspell an unknown word) to the iframe ─────
  function dispatchGloss(gloss) {
    const iframe = document.getElementById('echo-sign-iframe');
    if (!iframe?.contentWindow) return;
    if (Array.isArray(gloss)) {
      gloss.forEach(g => iframe.contentWindow.postMessage({ type: 'echo-sign:play', gloss: g, speed: currentSpeed }, '*'));
      setGloss(gloss.join('+'));
      return;
    }
    if (gloss.startsWith('SPELL:')) {
      const letters = gloss.slice(6).split('');
      letters.forEach((letter, i) => {
        setTimeout(() => {
          iframe.contentWindow.postMessage({ type: 'echo-sign:letter', letter }, '*');
        }, i * Math.round(450 / currentSpeed)); // stagger adjusted by speed
      });
      setGloss('spell: ' + gloss.slice(6));
    } else {
      iframe.contentWindow.postMessage({ type: 'echo-sign:play', gloss, speed: currentSpeed }, '*');
      setGloss(gloss);
    }
  }

  // ─── Speech recognition (runs here so it inherits page mic access) ──────────
  let recognition = null;
  let isListening = false;
  const signedThisPhrase = new Set(); // all glosses dispatched in current phrase
  const recentSigns = new Map();      // gloss → timestamp for cross-session cooldown

  function canDispatch(key) {
    const now = Date.now();
    const last = recentSigns.get(key);
    const cooldown = key.startsWith('SPELL:')
      ? key.slice(6).length * Math.ceil(450 / currentSpeed) + 500  // full spell duration + 500ms buffer
      : 1500;
    if (last && now - last < cooldown) return false;
    recentSigns.set(key, now);
    return true;
  }

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
        chrome.runtime.sendMessage({ type: 'TRANSCRIPT_UPDATE', text: finalText.trim() }).catch(() => {});
        finalText.toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .split(/\s+/)
          .filter(w => w.length > 1)
          .forEach(word => {
            const gloss = wordToGloss(word);
            const key = Array.isArray(gloss) ? gloss.join('+') : gloss;
            if (gloss && !signedThisPhrase.has(key) && canDispatch(key)) {
              dispatchGloss(gloss);
              chrome.runtime.sendMessage({ type: 'WORD_DETECTED', gloss }).catch(() => {});
            }
          });
        signedThisPhrase.clear(); // reset for next phrase

      } else if (interimText) {
        chrome.runtime.sendMessage({ type: 'TRANSCRIPT_UPDATE', text: interimText.trim() }).catch(() => {});
        // Process ALL words (not just last) so middle words aren't missed
        interimText.toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .split(/\s+/)
          .filter(w => w.length > 1)
          .forEach(word => {
            const gloss = wordToGloss(word);
            const key = Array.isArray(gloss) ? gloss.join('+') : gloss;
            if (gloss && !signedThisPhrase.has(key) && canDispatch(key)) {
              signedThisPhrase.add(key);
              dispatchGloss(gloss);
              chrome.runtime.sendMessage({ type: 'WORD_DETECTED', gloss }).catch(() => {});
            }
          });
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
        <span>🤟 Echo-Sign Gestures</span>
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

      case 'SET_SPEED': {
        currentSpeed = message.speed;
        const iframeEl = document.getElementById('echo-sign-iframe');
        if (iframeEl?.contentWindow) {
          iframeEl.contentWindow.postMessage({ type: 'echo-sign:speed', factor: currentSpeed }, '*');
        }
        break;
      }

      case 'SET_AVATAR': {
        const avIframe = document.getElementById('echo-sign-iframe');
        if (avIframe?.contentWindow) {
          avIframe.contentWindow.postMessage({ type: 'echo-sign:avatar', avatar: message.avatar }, '*');
        }
        break;
      }

      case 'START_DEMO':
        stopDemo();
        runDemo();
        break;

      case 'STOP_DEMO':
        stopDemo();
        demoActive = false;
        chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', state: 'idle' }).catch(() => {});
        break;

      case 'STOP':
        stopListening();
        break;
    }
  });

  // Auto-create overlay when content script loads
  createOverlay();
})();
