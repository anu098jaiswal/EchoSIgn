# Echo-Sign — Project Status & Roadmap

## Target Workflow
```
User opens NPTEL lecture
  → Clicks Echo-Sign
  → Tab audio captured (no mic needed, earphones work)
  → Whisper transcribes speech in real time
  → Known words   → ISL sign animation on Kaya avatar
  → Academic terms → broken into concepts, each signed
  → Unknown words  → fingerspelled letter by letter
  → Avatar signs in overlay corner while lecture plays
```

---

## ✅ DONE

### Infrastructure
- [x] **Chrome Extension (MV3)** — manifest, popup, content script, background service worker
- [x] **Floating overlay** — draggable, resizable, minimizable panel injected into any webpage
- [x] **Background message router** — bidirectional routing (popup ↔ content ↔ offscreen)

### Audio Capture
- [x] **Microphone mode** — SpeechRecognition in content script (page context), works on HTTPS pages
- [x] **Tab audio mode** — `chrome.tabCapture` + offscreen document captures tab audio directly
- [x] **Earphone-safe** — tab audio captured before it reaches speakers; earphones irrelevant
- [x] **Audio playback** — captured stream played back so user still hears the lecture

### Transcription
- [x] **Whisper API integration** — 5-second audio chunks → `POST /v1/audio/transcriptions`
- [x] **Language selection** — en-IN / en-US / en-GB / hi-IN configurable in popup
- [x] **API key storage** — saved locally via `chrome.storage.local`

### Sign Pipeline
- [x] **Gloss map** (`src/glossMap.js` + inline in `content.js`) — ~80 English → ISL animation mappings
- [x] **Word → gloss lookup** — `wordToGloss()` used in both mic and tab audio paths
- [x] **Sign queue** — ordered playback, one sign at a time, `LoopOnce` clamped
- [x] **echo-sign:play event** — content script dispatches directly to avatar (no round-trip)
- [x] **WORD_DETECTED routing** — popup gloss chips update in real time

### Avatar (Placeholder)
- [x] **Three.js scene** — perspective camera, ambient + directional lights, WebGL renderer
- [x] **Placeholder mannequin** — purple stick figure with idle bob + arm wave while loading
- [x] **GLTFLoader** — loads `.glb` animations, registers them in `actions` map
- [x] **AnimationMixer** — drives sign playback with proper timing + delay between signs

### Popup UI
- [x] **Start / Stop toggle** — green pulse when listening, red when active
- [x] **Transcript box** — live rolling text
- [x] **Gloss chips** — last 8 signed words shown as chips
- [x] **Audio source toggle** — Microphone vs Tab Audio dropdown
- [x] **Sign speed selector** — 0.75× / 1.0× / 1.5×

---

## 🔴 NOT DONE — Critical for Demo

### 1. Kaya Avatar (humanoid 3D model)
**Status:** Currently loads `hello.glb` (an animation file) as the avatar base — wrong.
**Need:** A rigged humanoid `.glb` character (Ready Player Me / Mixamo / custom Kaya model).
**Files:** `src/avatarContent.js` lines 127–151
**Fix:** Replace `ANIM_BASE + 'hello.glb'` with a proper `avatar.glb` character file.
**Action:** Export/download Kaya or any rigged humanoid from Ready Player Me → save as `assets/avatar.glb`.

### 2. Fingerspelling (unknown words)
**Status:** Not implemented at all.
**Need:** When a word has no gloss mapping, spell it letter by letter using ISL hand-shape animations.
**Files:** `content.js` → `wordToGloss()` returns `null` for unknown words — those are currently silently dropped.
**Fix needed:**
- Add 26 letter animations (`a.glb` … `z.glb`) in `assets/animations/letters/`
- In `content.js` and `offscreen.js`: when `wordToGloss(word) === null`, queue each letter of the word as `letter_<char>`
- In `avatarContent.js` `loadAnim()`: load all letter animations at startup

### 3. Academic Term Concept-Breaking
**Status:** Partially done — `glossMap.js` has some academic terms. Complex terms not broken down.
**Need:** When an academic word like "photosynthesis" has no single sign, map it to a sequence of simpler concept signs.
**Fix needed:**
- Add a `CONCEPT_MAP` in `glossMap.js`:
  ```js
  "photosynthesis": ["light", "plant", "food"],
  "algorithm": ["step", "rule", "order"],
  ```
- Modify `wordToGloss()` to return an array for concept-mapped words
- Update the sign queue logic to push multiple signs for one word

### 4. Sign animations for all mapped glosses
**Status:** Only 8 `.glb` files exist: `hello`, `clap`, `point`, `yes`, `no`, `good`, `acknowledge`, `think`.
**Need:** Animations for every entry in the gloss map (~80 words).
**Action:** Download/create Mixamo animations for each word, export as `.glb`, add to `assets/animations/`.
The code already handles missing animations gracefully (falls back to arm wave).

---

## 🟡 PARTIAL / NEEDS TESTING

### Mic mode end-to-end
- [ ] Test on HTTPS page: click Start → mic permission prompt → green dot → speak "hello" → chip appears + arm waves
- [ ] Verify `STATUS_UPDATE: 'listening'` reaches popup (was the original "stuck at connecting" bug)

### Tab audio mode end-to-end
- [ ] YouTube lecture → Start Signing (Tab Audio) → Whisper transcribes → signs play
- [ ] Verify audio playback still works with earphones while capturing

### Avatar loading
- [ ] Fix: load a proper humanoid `avatar.glb`, not `hello.glb` as the base model
- [ ] Verify animations apply correctly to the skeleton

---

## 📁 File Map

```
echo-sign/
├── manifest.json          ✅ permissions: activeTab, scripting, tabs, tabCapture, offscreen, storage
├── background.js          ✅ routes all messages; orchestrates tab capture
├── content.js             ✅ overlay + mic SpeechRecognition + PROCESS_TRANSCRIPT handler
├── offscreen.html         ✅ shell for offscreen document
├── offscreen.js           ✅ tab audio capture → MediaRecorder → Whisper API
├── popup/
│   ├── popup.html         ✅ UI with source toggle + API key field
│   └── popup.js           ✅ handles both mic and tab modes
├── src/
│   ├── glossMap.js        ✅ ~80 word mappings — needs expansion + concept map
│   ├── speechHandler.js   ✅ (kept for reference, unused now)
│   ├── avatar.js          ⚠️  unused (avatarContent.js used instead)
│   └── avatarContent.js   🔴 avatar base model wrong (hello.glb); needs real Kaya model
└── assets/
    ├── animations/        🔴 only 8 signs; needs ~80+ signs + 26 letter animations
    │   ├── hello.glb
    │   ├── clap.glb
    │   ├── point.glb
    │   ├── yes.glb
    │   ├── no.glb
    │   ├── good.glb
    │   ├── acknowledge.glb
    │   └── think.glb
    └── avatar.glb         ❌ MISSING — need a rigged Kaya humanoid character
```

---

## 🔢 Priority Order for Next Steps

| # | Task | Impact | Effort |
|---|---|---|---|
| 1 | Get/export Kaya avatar.glb (humanoid) | Critical — no real avatar yet | Low (export from Ready Player Me) |
| 2 | Test mic mode + fix any remaining bugs | Core feature | Low |
| 3 | Test tab audio + Whisper end-to-end | Core feature | Low |
| 4 | Add fingerspelling (a–z .glb + queue logic) | Differentiator | Medium |
| 5 | Expand gloss map + add more Mixamo animations | Coverage | Medium |
| 6 | Add concept-breaking for academic terms | Differentiator | Medium |
