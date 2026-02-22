// src/avatarContent-src.js
// SOURCE FILE — run: npm run build:avatar  to produce src/avatar-bundle.js
// This file imports three from local node_modules (no CDN).

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* ── Wait for canvas ── */
function waitForCanvas(cb) {
  const el = document.getElementById('echo-sign-canvas');
  if (el) return cb(el);
  const obs = new MutationObserver(() => {
    const c = document.getElementById('echo-sign-canvas');
    if (c) { obs.disconnect(); cb(c); }
  });
  obs.observe(document.body, { childList: true, subtree: true });
}

waitForCanvas((canvas) => {
  const W = 324;
  const H = 250;

  /* ── Scene ── */
  const scene    = new THREE.Scene();
  const camera   = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
  camera.position.set(0, 1.4, 2.5);
  camera.lookAt(0, 1.0, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  /* ── Lights ── */
  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(2, 4, 3);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xaaaaff, 0.4);
  fill.position.set(-2, 2, -1);
  scene.add(fill);

  /* ── Placeholder (shown while avatar GLB loads) ── */
  const mat = new THREE.MeshStandardMaterial({ color: 0x6c63ff, roughness: 0.6 });
  const placeholder = new THREE.Group();

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), mat);
  head.position.set(0, 1.65, 0);
  placeholder.add(head);

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.5, 12), mat);
  body.position.set(0, 1.25, 0);
  placeholder.add(body);

  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.4, 8), mat);
  armL.position.set(-0.25, 1.25, 0);
  armL.rotation.z = 0.4;
  placeholder.add(armL);

  const armR = armL.clone();
  armR.position.set(0.25, 1.25, 0);
  armR.rotation.z = -0.4;
  placeholder.add(armR);

  scene.add(placeholder);

  /* ── State ── */
  let mixer   = null;
  const clips   = {};   // glossName → raw AnimationClip (survives avatar switch)
  const actions = {};   // glossName → AnimationAction (rebound on each switch)
  const queue   = [];
  let playing   = false;
  const clock   = new THREE.Clock();
  let idleTime  = 0;
  let speedFactor   = 1.0;
  let currentAvatarEl = null;

  /* ── Load one animation clip ── */
  function loadAnim(glossName, url) {
    const loader = new GLTFLoader();
    loader.load(url, (gltf) => {
      if (!mixer || !gltf.animations.length) return;
      const clip = gltf.animations[0];
      clips[glossName] = clip;                          // cache raw clip
      const action = mixer.clipAction(clip, mixer.getRoot());
      action.loop = THREE.LoopOnce;
      action.clampWhenFinished = true;
      actions[glossName] = action;
      console.log('[Echo-Sign] Animation loaded:', glossName);
    }, undefined, (err) => console.error('[Echo-Sign] Anim error:', glossName, err));
  }

  /* ── Rebind all cached clips to a new mixer (used on avatar switch) ── */
  function rebindClips(newMixer) {
    Object.keys(clips).forEach(name => {
      const action = newMixer.clipAction(clips[name], newMixer.getRoot());
      action.loop = THREE.LoopOnce;
      action.clampWhenFinished = true;
      actions[name] = action;
    });
  }

  /* ── Load avatar GLB ── */
  const ANIM_BASE  = chrome.runtime.getURL('assets/animations/');
  const ALPHA_BASE = chrome.runtime.getURL('assets/alphabet/');
  const VIDEO_BASE = chrome.runtime.getURL('assets/videos/');
  const videoEl    = document.getElementById('echo-sign-video');
  const loader = new GLTFLoader();

  /* ── Canvas/video switcher ── */
  function showCanvas() {
    canvas.style.display = 'block';
    if (videoEl) { videoEl.pause(); videoEl.style.display = 'none'; }
  }

  function tryPlayVideo(gloss, onDone) {
    if (!videoEl) { onDone(); return; }
    // Set handlers BEFORE src/load so no events are missed
    videoEl.oncanplay = () => {
      canvas.style.display = 'none';
      videoEl.style.display = 'block';
      videoEl.playbackRate = speedFactor;
      videoEl.play().catch(() => { showCanvas(); onDone(); });
    };
    videoEl.onended = () => { showCanvas(); onDone(); };
    videoEl.onerror = () => {
      console.log('[Echo-Sign] No video for:', gloss, '— skipping');
      showCanvas();
      onDone();
    };
    videoEl.src = VIDEO_BASE + gloss.toLowerCase().replace(/-/g, '_') + '.mp4';
    videoEl.load();
  }

  /* ── Load / switch avatar ── */
  function loadAvatar(filename) {
    loader.load(ANIM_BASE + filename + '.glb', (gltf) => {
      if (currentAvatarEl) scene.remove(currentAvatarEl);
      scene.remove(placeholder);
      scene.add(gltf.scene);
      currentAvatarEl = gltf.scene;
      mixer = new THREE.AnimationMixer(gltf.scene);

      if (Object.keys(clips).length === 0) {
        // First load: fetch all animation GLBs
        // HELP, THANK-YOU, GOODBYE → no loadAnim → tryPlayVideo() handles them
        loadAnim('hello',                ANIM_BASE + 'hello.glb');
        loadAnim('yes',                  ANIM_BASE + 'yes.glb');
        loadAnim('no',                   ANIM_BASE + 'no.glb');
        loadAnim('good',                 ANIM_BASE + 'good.glb');
        loadAnim('think',                ANIM_BASE + 'think.glb');
        loadAnim('point',                ANIM_BASE + 'point.glb');
        loadAnim('clap',                 ANIM_BASE + 'clap.glb');
        loadAnim('acknowledge',          ANIM_BASE + 'acknowledge.glb');
        loadAnim('angry',                ANIM_BASE + 'angry.glb');
        loadAnim('dismissing_gesture',   ANIM_BASE + 'dismissing_gesture.glb');
        loadAnim('falling',              ANIM_BASE + 'falling.glb');
        loadAnim('female_standing_pose', ANIM_BASE + 'female_standing_pose.glb');
        loadAnim('offensive_idle',       ANIM_BASE + 'offensive_idle.glb');
        loadAnim('opening',              ANIM_BASE + 'opening.glb');
        loadAnim('running',              ANIM_BASE + 'running.glb');
        loadAnim('samba_dancing',        ANIM_BASE + 'samba_dancing.glb');
        loadAnim('sitting_laughing',     ANIM_BASE + 'sitting_laughing.glb');
        loadAnim('sitting_talking',      ANIM_BASE + 'sitting_talking.glb');
        loadAnim('spin_in_place',        ANIM_BASE + 'spin_in_place.glb');
        loadAnim('standard_walk',        ANIM_BASE + 'standard_walk.glb');
        loadAnim('standing_clap',        ANIM_BASE + 'standing_clap.glb');
        loadAnim('surprised',            ANIM_BASE + 'surprised.glb');
        loadAnim('taunt',                ANIM_BASE + 'taunt.glb');
        loadAnim('telling_a_secret',     ANIM_BASE + 'telling_a_secret.glb');
        loadAnim('texting_while_standing', ANIM_BASE + 'texting_while_standing.glb');
        loadAnim('thankful',             ANIM_BASE + 'thankful.glb');
        loadAnim('thoughtful_head_shake',ANIM_BASE + 'thoughtful_head_shake.glb');
        loadAnim('using_a_fax_machine',  ANIM_BASE + 'using_a_fax_machine.glb');
        loadAnim('victory',              ANIM_BASE + 'victory.glb');
      } else {
        // Avatar switch: rebind cached clips to new mesh (no re-download)
        rebindClips(mixer);
      }
      console.log('[Echo-Sign] Avatar loaded:', filename);
    },
    undefined,
    (err) => console.error('[Echo-Sign] Avatar load failed:', err));
  }

  // Initial load (Kaya — hello.glb contains both the mesh and the hello animation)
  loadAvatar('hello');

  /* ── Playback queue ── */
  function playNext() {
    if (!queue.length) { playing = false; return; }
    playing = true;
    const gloss = queue.shift();

    const onFinished = () => {
      window.parent.postMessage({ type: 'echo-sign:gloss-finished', gloss }, '*');
      setTimeout(playNext, 100);
    };

    if (actions[gloss]) {
      Object.values(actions).forEach(a => a.stop());
      const action = actions[gloss];
      action.reset();
      
      const clipDur = action.getClip().duration;
      // Demo optimization: speed up long animations to keep it snappy
      let ts = speedFactor;
      if (window.__isDemoToken && clipDur > 2.0) {
        ts *= 1.5;
      }
      action.timeScale = ts;
      
      action.play();
      setTimeout(onFinished, (clipDur / ts) * 1000);
    } else {
      // No GLB — try ISL video clip, then skip if none found
      tryPlayVideo(gloss, onFinished);
    }
  }

  /* ── Fingerspelling overlay (2D canvas on top of WebGL) ── */
  const letterCanvas = document.getElementById('echo-sign-letter');
  let letterCtx = null;
  if (letterCanvas) {
    letterCanvas.width  = W;
    letterCanvas.height = H;
    letterCtx = letterCanvas.getContext('2d');
  }

  function showLetter(letter) {
    if (!letterCtx) return;
    letterCtx.clearRect(0, 0, W, H);
    const size = 80;
    const bx = W - size - 10, by = H - size - 10; // top-left of the box

    const drawBubble = () => {
      letterCtx.fillStyle = 'rgba(26,26,58,0.88)';
      letterCtx.strokeStyle = '#6C63FF';
      letterCtx.lineWidth = 2;
      letterCtx.beginPath();
      letterCtx.roundRect(bx - 6, by - 6, size + 12, size + 12, 12);
      letterCtx.fill();
      letterCtx.stroke();
    };

    const cleanup = () => {
      if (letterCtx) letterCtx.clearRect(0, 0, W, H);
      window.parent.postMessage({ type: 'echo-sign:letter-finished', letter }, '*');
    };

    const img = new Image();
    img.onload = () => {
      drawBubble();
      letterCtx.drawImage(img, bx, by, size, size);
      setTimeout(cleanup, 700);
    };
    img.onerror = () => {
      // Fallback: text bubble when handshape PNG not found
      drawBubble();
      letterCtx.fillStyle = '#c8c4ff';
      letterCtx.font = 'bold 42px monospace';
      letterCtx.textAlign = 'center';
      letterCtx.textBaseline = 'middle';
      letterCtx.fillText(letter.toUpperCase(), bx + size / 2, by + size / 2);
      setTimeout(cleanup, 700);
    };
    img.src = ALPHA_BASE + letter.toLowerCase() + '.png';
  }

  /* ── Listen for gloss + letter messages from content.js ── */
  window.addEventListener('message', (e) => {
    if (e.data?.type === 'echo-sign:play') {
      if (e.data.speed !== undefined) speedFactor = e.data.speed;
      window.__isDemoToken = !!e.data.demo; // Set demo flag for animation logic
      // Only clear backlog for live speech, NOT for demo tokens
      if (!e.data.demo && queue.length > 1) queue.length = 0;
      queue.push(e.data.gloss);
      if (!playing) playNext();

    } else if (e.data?.type === 'echo-sign:demo-batch') {
      // Demo sends a full scene's tokens at once
      if (e.data.speed !== undefined) speedFactor = e.data.speed;
      if (Array.isArray(e.data.glosses)) {
        e.data.glosses.forEach(g => queue.push(g));
      }
      if (!playing) playNext();

    } else if (e.data?.type === 'echo-sign:stop') {
      queue.length = 0;
      playing = false;
      Object.values(actions).forEach(a => a.stop());
      showCanvas();

    } else if (e.data?.type === 'echo-sign:letter') {
      showLetter(e.data.letter);
    } else if (e.data?.type === 'echo-sign:speed') {
      speedFactor = e.data.factor;
    } else if (e.data?.type === 'echo-sign:avatar') {
      queue.length = 0;   // clear pending signs
      playing = false;
      loadAvatar(e.data.avatar);
    }
  });

  /* ── Render loop ── */
  function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);

    idleTime += delta;
    placeholder.position.y = Math.sin(idleTime * 1.5) * 0.015;
    placeholder.rotation.y = Math.sin(idleTime * 0.5) * 0.08;

    renderer.render(scene, camera);
  }
  animate();

  console.log('[Echo-Sign] Avatar system ready');
});
