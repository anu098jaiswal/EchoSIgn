// src/avatarContent.js
// Injected into the page by content.js
// Handles Three.js avatar + ISL animation playback

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160/examples/jsm/loaders/GLTFLoader.js';

/* ────────────────────────────────────────────────────────────── */
/* Wait for canvas                                                */
/* ────────────────────────────────────────────────────────────── */
function waitForCanvas(cb) {
  const el = document.getElementById('echo-sign-canvas');
  if (el) return cb(el);

  const obs = new MutationObserver(() => {
    const canvas = document.getElementById('echo-sign-canvas');
    if (canvas) {
      obs.disconnect();
      cb(canvas);
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });
}

waitForCanvas((canvas) => {
  const W = canvas.clientWidth || 284;
  const H = canvas.clientHeight || 220;

  /* ────────────────────────────────────────────────────────────── */
  /* Scene setup                                                   */
  /* ────────────────────────────────────────────────────────────── */
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
  camera.position.set(0, 1.4, 2.5);
  camera.lookAt(0, 1.0, 0);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
  });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  /* ────────────────────────────────────────────────────────────── */
  /* Lights                                                        */
  /* ────────────────────────────────────────────────────────────── */
  scene.add(new THREE.AmbientLight(0xffffff, 0.9));

  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(2, 4, 3);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xaaaaff, 0.4);
  fill.position.set(-2, 2, -1);
  scene.add(fill);

  /* ────────────────────────────────────────────────────────────── */
  /* Placeholder avatar                                            */
  /* ────────────────────────────────────────────────────────────── */
  const mat = new THREE.MeshStandardMaterial({
    color: 0x6c63ff,
    roughness: 0.6,
  });

  const placeholder = new THREE.Group();

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), mat);
  head.position.set(0, 1.65, 0);
  placeholder.add(head);

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.12, 0.5, 12),
    mat
  );
  body.position.set(0, 1.25, 0);
  placeholder.add(body);

  const armL = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.04, 0.4, 8),
    mat
  );
  armL.position.set(-0.25, 1.25, 0);
  armL.rotation.z = 0.4;
  placeholder.add(armL);

  const armR = armL.clone();
  armR.position.set(0.25, 1.25, 0);
  armR.rotation.z = -0.4;
  placeholder.add(armR);

  scene.add(placeholder);

  /* ────────────────────────────────────────────────────────────── */
  /* State                                                         */
  /* ────────────────────────────────────────────────────────────── */
  let mixer = null;
  const actions = {};
  const queue = [];
  let playing = false;

  const clock = new THREE.Clock();
  let idleTime = 0;

  /* ────────────────────────────────────────────────────────────── */
  /* Load animation helper                                         */
  /* ────────────────────────────────────────────────────────────── */
  function loadAnim(glossName, url) {
    const loader = new GLTFLoader();
    loader.load(url, (gltf) => {
      if (!mixer || !gltf.animations.length) return;

      const action = mixer.clipAction(gltf.animations[0]);
      action.loop = THREE.LoopOnce;
      action.clampWhenFinished = true;

      actions[glossName] = action;
      console.log('[Echo-Sign] Loaded:', glossName);
    });
  }

  /* ────────────────────────────────────────────────────────────── */
  /* Load avatar + then animations                                 */
  /* ────────────────────────────────────────────────────────────── */
  const ANIM_BASE = chrome.runtime.getURL('assets/animations/');

  const avatarLoader = new GLTFLoader();
  avatarLoader.load(
    ANIM_BASE + 'hello.glb',
    (gltf) => {
      scene.remove(placeholder);
      scene.add(gltf.scene);

      mixer = new THREE.AnimationMixer(gltf.scene);

      loadAnim('hello',       ANIM_BASE + 'hello.glb');
      loadAnim('clap',        ANIM_BASE + 'clap.glb');
      loadAnim('point',       ANIM_BASE + 'point.glb');
      loadAnim('yes',         ANIM_BASE + 'yes.glb');
      loadAnim('no',          ANIM_BASE + 'no.glb');
      loadAnim('good',        ANIM_BASE + 'good.glb');
      loadAnim('acknowledge', ANIM_BASE + 'acknowledge.glb');
      loadAnim('think',       ANIM_BASE + 'think.glb');
    },
    undefined,
    (err) => {
      console.error('[Echo-Sign] Avatar failed to load, using placeholder.', err);
    }
  );

  /* ────────────────────────────────────────────────────────────── */
  /* Playback queue                                                */
  /* ────────────────────────────────────────────────────────────── */
  function playNext() {
    if (!queue.length) {
      playing = false;
      return;
    }

    playing = true;
    const gloss = queue.shift();

    if (actions[gloss]) {
      Object.values(actions).forEach(a => a.stop());

      const action = actions[gloss];
      action.reset().play();

      const delay = action.getClip().duration * 1000 + 300;
      setTimeout(playNext, delay);
    } else {
      animatePlaceholder();
      setTimeout(playNext, 800);
    }
  }

  function animatePlaceholder() {
    const arm = placeholder.children[3]; // armR (head, body, armL, armR)
    if (!arm) return;
    let t = 0;

    const wave = setInterval(() => {
      t += 0.3;
      arm.rotation.z = -0.4 + Math.sin(t * 3) * 0.6;

      if (t > 2.5) {
        arm.rotation.z = -0.4;
        clearInterval(wave);
      }
    }, 30);
  }

  /* ────────────────────────────────────────────────────────────── */
  /* Listen for gloss events                                       */
  /* ────────────────────────────────────────────────────────────── */
  window.addEventListener('echo-sign:play', (e) => {
    const { gloss } = e.detail;
    queue.push(gloss);
    if (!playing) playNext();
  });

  /* ────────────────────────────────────────────────────────────── */
  /* Render loop                                                   */
  /* ────────────────────────────────────────────────────────────── */
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