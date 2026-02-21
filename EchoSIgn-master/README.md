# 🤟 Echo-Sign: Real-Time ISL Mirror
> Hackathon Starter — 24hr Build

A Chrome Extension that captures speech and renders Indian Sign Language via a 3D avatar overlay on any webpage.

---

## 📁 Project Structure

```
echo-sign/
├── manifest.json          ← Chrome Extension config (Manifest V3)
├── background.js          ← Service worker (message router)
├── content.js             ← Injects overlay UI into any webpage
├── popup/
│   ├── popup.html         ← Extension popup UI
│   └── popup.js           ← Popup controller (speech → glosses)
├── src/
│   ├── speechHandler.js   ← Web Speech API wrapper
│   ├── glossMap.js        ← English word → ISL gloss dictionary
│   ├── avatar.js          ← Three.js avatar controller (for popup use)
│   └── avatarContent.js   ← Three.js injected into page overlay
├── assets/
│   └── animations/        ← Put your .glb animation files here
│       ├── hello.glb
│       ├── library.glb
│       └── ...
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## 🚀 Quick Start (Load in Chrome)

1. Open Chrome → go to `chrome://extensions`
2. Enable **Developer Mode** (top right toggle)
3. Click **Load Unpacked**
4. Select the `echo-sign/` folder
5. The extension icon will appear in your toolbar!

---

## 🎨 Getting Your 3D Avatar (Free)

### Step 1 — Create avatar at Ready Player Me
1. Go to [readyplayer.me](https://readyplayer.me)
2. Create your avatar (pick one that looks like a person, not a cartoon)
3. After customizing, click **"Copy URL"** — you'll get a `.glb` URL like:
   `https://models.readyplayer.me/XXXXX.glb`
4. Open `src/avatarContent.js` and replace:
   ```js
   const AVATAR_URL = 'YOUR_READY_PLAYER_ME_AVATAR_URL.glb';
   ```
   Then **uncomment** the `loader.load(AVATAR_URL, ...)` block below it.

---

## 🕺 Getting Sign Animations (Free via Mixamo)

1. Go to [mixamo.com](https://mixamo.com) → sign in with Adobe account (free)
2. Upload your Ready Player Me `.glb` as the character
3. Search for sign/gesture animations: try **"wave"**, **"thumbs up"**, **"point"**, **"clap"**
4. Download each as **FBX for Unity** format
5. Convert FBX → GLB at [products.aspose.app/3d/conversion/fbx-to-glb](https://products.aspose.app/3d/conversion/fbx-to-glb)
6. Rename files to match the gloss names in `src/glossMap.js`, e.g. `hello.glb`
7. Place them in `assets/animations/`

### Loading animations in avatarContent.js
After the `loader.load(AVATAR_URL, ...)` block, add:
```js
// Load sign animations (add one line per sign)
loadAnim('hello',   chrome.runtime.getURL('assets/animations/hello.glb'));
loadAnim('library', chrome.runtime.getURL('assets/animations/library.glb'));
loadAnim('student', chrome.runtime.getURL('assets/animations/student.glb'));
// ... add more
```

---

## 🗺️ Adding More Signs to the Dictionary

Open `src/glossMap.js` and add entries to `ISL_GLOSS_MAP`:
```js
"photosynthesis": "photosynthesis",
"equation":       "equation",
"derivative":     "derivative",
```
Then download/create the matching `.glb` animation and load it.

---

## 🎤 How It Works (Data Flow)

```
Microphone
    ↓
Web Speech API  (popup.js)
    ↓
Raw transcript text
    ↓
wordToGloss()   (glossMap.js)
    ↓
ISL gloss name  (e.g. "library")
    ↓
chrome.runtime.sendMessage → background.js
    ↓
chrome.tabs.sendMessage → content.js
    ↓
window.dispatchEvent('echo-sign:play')
    ↓
avatarContent.js → Three.js AnimationMixer
    ↓
3D Avatar performs the sign ✋
```

---

## 🏆 Demo Script (Hackathon Winning Strategy)

1. Open an **NPTEL YouTube lecture** video
2. Click Echo-Sign extension → **"Start Signing"**
3. Talk (or let the video play) — the avatar signs in the corner
4. Show the popup panel with live transcript + gloss chips side-by-side

**Pre-load these 20 words for your demo script:**
`hello, welcome, student, teacher, learn, library, book, computer, science, math, yes, no, help, today, start, stop, important, question, answer, thank`

---

## ⚡ Hackathon Tips

- **Icons:** Generate simple icon PNGs at [favicon.io](https://favicon.io/favicon-generator/) — use text "ES" with purple background
- **If avatar URL fails CORS:** Host the GLB on GitHub Pages or use a local file served via a simple server
- **If mic doesn't work in popup:** Chrome may restrict mic in extension popups — use `chrome.tabs.executeScript` to run speech recognition in the active tab context instead
- **Demo fallback:** Have a pre-recorded video of the avatar working as backup

---

## 🛠️ Tech Stack

| Part | Technology |
|---|---|
| Extension | Chrome Manifest V3 |
| Speech | Web Speech API (`webkitSpeechRecognition`) |
| 3D Rendering | Three.js r160 (via CDN) |
| Avatar | Ready Player Me (free GLB) |
| Animations | Mixamo (free FBX → GLB) |
| Build tools | None needed! |

---

*Built in 24hrs for hackathon — good luck! 🤟*
