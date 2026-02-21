// src/avatar.js — Three.js 3D avatar renderer and animation controller

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class AvatarController {
  constructor(canvasEl) {
    this.canvas = canvasEl;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.mixer = null;
    this.clock = new THREE.Clock();
    this.actions = {};        // gloss name → AnimationAction
    this.signQueue = [];
    this.isPlaying = false;
    this.avatarLoaded = false;

    this._init();
  }

  // ─── Initialize Three.js scene ──────────────────────────────────────────
  _init() {
    const w = this.canvas.clientWidth || 284;
    const h = this.canvas.clientHeight || 220;

    // Scene
    this.scene = new THREE.Scene();

    // Camera
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    this.camera.position.set(0, 1.4, 2.5);
    this.camera.lookAt(0, 1.0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true
    });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(2, 4, 3);
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.4);
    fillLight.position.set(-2, 2, -1);
    this.scene.add(fillLight);

    // Placeholder cube while avatar loads
    this._addPlaceholder();

    // Start render loop
    this._animate();

    console.log('[Echo-Sign] Three.js scene initialized.');
  }

  // ─── Placeholder avatar (colored mannequin) ──────────────────────────────
  _addPlaceholder() {
    const group = new THREE.Group();

    const mat = new THREE.MeshStandardMaterial({ color: 0x6C63FF });

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), mat);
    head.position.set(0, 1.65, 0);
    group.add(head);

    // Body
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.12, 0.5, 12), mat
    );
    body.position.set(0, 1.25, 0);
    group.add(body);

    // Left arm
    const armL = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.04, 0.4, 8), mat
    );
    armL.position.set(-0.25, 1.25, 0);
    armL.rotation.z = 0.3;
    group.add(armL);

    // Right arm
    const armR = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.04, 0.4, 8), mat
    );
    armR.position.set(0.25, 1.25, 0);
    armR.rotation.z = -0.3;
    group.add(armR);

    this.placeholderGroup = group;
    this.scene.add(group);

    // Idle bobbing animation on placeholder
    this._idleBobbingEnabled = true;
    this._idleTime = 0;
  }

  // ─── Load a Ready Player Me or custom GLB avatar ─────────────────────────
  loadAvatar(url) {
    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        // Remove placeholder
        if (this.placeholderGroup) {
          this.scene.remove(this.placeholderGroup);
          this._idleBobbingEnabled = false;
        }

        this.avatarModel = gltf.scene;
        this.scene.add(this.avatarModel);

        // Setup animation mixer
        this.mixer = new THREE.AnimationMixer(this.avatarModel);

        // If avatar has built-in animations (e.g., idle), play first one
        if (gltf.animations.length > 0) {
          const idle = this.mixer.clipAction(gltf.animations[0]);
          idle.play();
        }

        this.avatarLoaded = true;
        console.log('[Echo-Sign] Avatar loaded:', url);
      },
      (xhr) => {
        console.log(`[Echo-Sign] Avatar loading: ${(xhr.loaded / xhr.total * 100).toFixed(0)}%`);
      },
      (err) => {
        console.error('[Echo-Sign] Avatar load error:', err);
      }
    );
  }

  // ─── Load an animation clip for a gloss ──────────────────────────────────
  loadAnimation(glossName, url) {
    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        if (!this.mixer) {
          console.warn('[Echo-Sign] Mixer not ready, load avatar first.');
          return;
        }
        if (gltf.animations.length === 0) {
          console.warn('[Echo-Sign] No animations in file:', url);
          return;
        }
        const clip = gltf.animations[0];
        clip.name = glossName;
        const action = this.mixer.clipAction(clip);
        action.loop = THREE.LoopOnce;
        action.clampWhenFinished = true;
        this.actions[glossName] = action;
        console.log('[Echo-Sign] Animation loaded:', glossName);
      },
      null,
      (err) => console.error('[Echo-Sign] Anim load error:', glossName, err)
    );
  }

  // ─── Queue a sign to play ─────────────────────────────────────────────────
  queueSign(glossName) {
    this.signQueue.push(glossName);
    if (!this.isPlaying) this._processQueue();
  }

  // ─── Process sign queue ───────────────────────────────────────────────────
  _processQueue() {
    if (this.signQueue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const gloss = this.signQueue.shift();
    const action = this.actions[gloss];

    if (action) {
      // Stop all others
      Object.values(this.actions).forEach(a => {
        if (a !== action) a.stop();
      });

      action.reset().play();
      const durationMs = (action.getClip().duration * 1000) + 300;

      this.mixer.addEventListener('finished', () => {
        this._processQueue();
      }, { once: true });

    } else {
      // Gloss not loaded — skip with small delay
      console.log('[Echo-Sign] No animation for gloss:', gloss);
      setTimeout(() => this._processQueue(), 200);
    }
  }

  // ─── Render loop ──────────────────────────────────────────────────────────
  _animate() {
    requestAnimationFrame(() => this._animate());

    const delta = this.clock.getDelta();

    // Update animation mixer
    this.mixer?.update(delta);

    // Placeholder idle bobbing
    if (this._idleBobbingEnabled && this.placeholderGroup) {
      this._idleTime += delta;
      this.placeholderGroup.position.y = Math.sin(this._idleTime * 1.5) * 0.015;
      this.placeholderGroup.rotation.y = Math.sin(this._idleTime * 0.5) * 0.1;
    }

    this.renderer.render(this.scene, this.camera);
  }

  // ─── Resize handler ───────────────────────────────────────────────────────
  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
}
