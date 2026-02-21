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
  const actions = {};
  const queue   = [];
  let playing   = false;
  const clock   = new THREE.Clock();
  let idleTime  = 0;

  /* ── Load one animation clip ── */
  function loadAnim(glossName, url) {
    const loader = new GLTFLoader();
    loader.load(url, (gltf) => {
      if (!mixer || !gltf.animations.length) return;
      // Bind the clip to the scene root so bone names resolve against Kaya's skeleton
      const clip = gltf.animations[0];
      const action = mixer.clipAction(clip, mixer.getRoot());
      action.loop = THREE.LoopOnce;
      action.clampWhenFinished = true;
      actions[glossName] = action;
      console.log('[Echo-Sign] Animation loaded:', glossName);
    }, undefined, (err) => console.error('[Echo-Sign] Anim error:', glossName, err));
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
    videoEl.oncanplay = null;
    videoEl.onended   = null;
    videoEl.onerror   = null;
    videoEl.src = VIDEO_BASE + gloss.toLowerCase().replace(/-/g, '_') + '.mp4';
    videoEl.load();
    videoEl.oncanplay = () => {
      canvas.style.display = 'none';
      videoEl.style.display = 'block';
      videoEl.play();
    };
    videoEl.onended = () => { showCanvas(); onDone(); };
    videoEl.onerror = () => {
      console.log('[Echo-Sign] No video for:', gloss, '— skipping');
      onDone();
    };
  }

  loader.load(
    ANIM_BASE + 'hello.glb',
    (gltf) => {
      scene.remove(placeholder);
      scene.add(gltf.scene);
      mixer = new THREE.AnimationMixer(gltf.scene);

      // ── MVP GLBs (8 existing files) ──
      // NEED, HELP, THANK-YOU, GOODBYE → served via ISL video clips in assets/videos/
      loadAnim('HELLO',      ANIM_BASE + 'hello.glb');
      loadAnim('YES',        ANIM_BASE + 'yes.glb');
      loadAnim('NO',         ANIM_BASE + 'no.glb');
      loadAnim('GOOD',       ANIM_BASE + 'good.glb');
      loadAnim('THINK',      ANIM_BASE + 'think.glb');
      loadAnim('POINT',      ANIM_BASE + 'point.glb');
      loadAnim('CLAP',       ANIM_BASE + 'clap.glb');
      loadAnim('UNDERSTAND', ANIM_BASE + 'acknowledge.glb');

      console.log('[Echo-Sign] Kaya avatar loaded!');
    },
    (xhr) => console.log(`[Echo-Sign] Avatar: ${(xhr.loaded / xhr.total * 100).toFixed(0)}%`),
    (err) => console.error('[Echo-Sign] Avatar load failed, placeholder stays.', err)
  );

  /* ── Playback queue ── */
  function playNext() {
    if (!queue.length) { playing = false; return; }
    playing = true;
    const gloss = queue.shift();

    if (actions[gloss]) {
      Object.values(actions).forEach(a => a.stop());
      const action = actions[gloss];
      action.reset().play();
      setTimeout(playNext, action.getClip().duration * 1000 + 300);
    } else {
      // No GLB — try ISL video clip, then skip if none found
      tryPlayVideo(gloss, () => setTimeout(playNext, 600));
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

    const img = new Image();
    img.onload = () => {
      drawBubble();
      letterCtx.drawImage(img, bx, by, size, size);
      setTimeout(() => letterCtx && letterCtx.clearRect(0, 0, W, H), 700);
    };
    img.onerror = () => {
      // Fallback: text bubble when handshape PNG not found
      drawBubble();
      letterCtx.fillStyle = '#c8c4ff';
      letterCtx.font = 'bold 42px monospace';
      letterCtx.textAlign = 'center';
      letterCtx.textBaseline = 'middle';
      letterCtx.fillText(letter.toUpperCase(), bx + size / 2, by + size / 2);
      setTimeout(() => letterCtx && letterCtx.clearRect(0, 0, W, H), 700);
    };
    img.src = ALPHA_BASE + letter.toLowerCase() + '.png';
  }

  /* ── Listen for gloss + letter messages from content.js ── */
  window.addEventListener('message', (e) => {
    if (e.data?.type === 'echo-sign:play') {
      queue.push(e.data.gloss);
      if (!playing) playNext();
    } else if (e.data?.type === 'echo-sign:letter') {
      showLetter(e.data.letter);
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
