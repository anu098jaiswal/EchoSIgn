// src/avatarContent.js
// Injected into avatar-frame.html (extension iframe)
// Uses 2D Canvas API only — no external CDN deps (avoids CSP blocks in extensions)

(function () {
  /* ── Wait for the canvas element ── */
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
    const W = 284;
    const H = 220;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    /* ── Colour palette ── */
    const SKIN  = '#f5c5a3';
    const SHIRT = '#6c63ff';
    const PANTS = '#2d2b55';
    const HAIR  = '#3b2314';
    const BG1   = '#0a0a14';
    const BG2   = '#141428';
    const GLOW  = 'rgba(108,99,255,0.18)';

    /* ── State ── */
    let t = 0;
    let lastTs = null;
    let armAnim = null;
    const queue = [];
    let playing = false;

    /* ── Drawing helpers ── */
    function roundRect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y,      x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h,  x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x,     y + h,  x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x,     y,      x + r, y);
      ctx.closePath();
    }

    /* ── Draw one frame ── */
    function draw() {
      /* Background */
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, BG1);
      grad.addColorStop(1, BG2);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      /* Floor glow */
      const floorGlow = ctx.createRadialGradient(W/2, H - 20, 5, W/2, H - 20, 80);
      floorGlow.addColorStop(0, GLOW);
      floorGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = floorGlow;
      ctx.fillRect(0, 0, W, H);

      const bob  = Math.sin(t * 1.8) * 2.5;
      const sway = Math.sin(t * 0.7) * 1.5;
      const ox   = W / 2 + sway;
      const oy   = H - 30 + bob;

      /* Shadow */
      ctx.save();
      ctx.translate(ox, H - 18);
      ctx.scale(1, 0.25);
      const sg = ctx.createRadialGradient(0, 0, 2, 0, 0, 28);
      sg.addColorStop(0, 'rgba(108,99,255,0.3)');
      sg.addColorStop(1, 'transparent');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      /* Legs */
      const legSway = Math.sin(t * 1.8) * 3;
      ctx.fillStyle = PANTS;
      ctx.save(); ctx.translate(ox - 10 - legSway, oy - 10);
      roundRect(-7, 0, 14, 60, 6); ctx.fill(); ctx.restore();
      ctx.save(); ctx.translate(ox + 10 + legSway, oy - 10);
      roundRect(-7, 0, 14, 60, 6); ctx.fill(); ctx.restore();

      /* Torso */
      ctx.fillStyle = SHIRT;
      ctx.save(); ctx.translate(ox, oy - 10);
      roundRect(-22, -60, 44, 65, 8); ctx.fill(); ctx.restore();

      /* Collar */
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ox, oy - 65); ctx.lineTo(ox - 8, oy - 58);
      ctx.moveTo(ox, oy - 65); ctx.lineTo(ox + 8, oy - 58);
      ctx.stroke();

      /* Arms */
      let leftAngle, rightAngle;
      if (armAnim) {
        const p = armAnim.phase;
        const wave = Math.sin(p * Math.PI * 3) * 0.9;
        if (armAnim.gloss === 'hello') {
          leftAngle = -0.3; rightAngle = -(0.3 + wave * 1.2);       // right arm waves
        } else if (armAnim.gloss === 'acknowledge') {
          leftAngle = -0.3; rightAngle = -(0.3 + wave * 0.9);       // gentle right nod
        } else if (armAnim.gloss === 'no') {
          leftAngle = -0.3 + wave * 0.4; rightAngle = -0.3 - wave * 0.4; // both swing opposite
        } else if (armAnim.gloss === 'yes') {
          leftAngle = -0.3; rightAngle = -0.3 + wave * 0.5;         // right nods down
        } else if (armAnim.gloss === 'clap') {
          const clap = Math.abs(Math.sin(p * Math.PI * 4));
          leftAngle = rightAngle = -(0.3 + clap * 0.8);             // both clap together
        } else if (armAnim.gloss === 'point') {
          leftAngle = -0.3; rightAngle = -(0.9 + wave * 0.1);       // right fully extended
        } else if (armAnim.gloss === 'think') {
          leftAngle = -0.3; rightAngle = -(0.8 + wave * 0.15);      // right hand to temple
        } else if (armAnim.gloss === 'good') {
          leftAngle = -0.3; rightAngle = -(0.7 + wave * 0.2);       // right arm rises (thumbs up)
        } else if (armAnim.gloss === 'welcome') {
          leftAngle = -(0.3 + wave * 0.6); rightAngle = -(0.3 - wave * 0.6); // both spread open
        } else if (armAnim.gloss === 'sorry') {
          leftAngle = -0.3; rightAngle = -(0.5 + Math.sin(p * Math.PI * 4) * 0.4); // chest circle
        } else if (armAnim.gloss === 'stop') {
          leftAngle = -0.3; rightAngle = -1.2;                      // right palm push out, held
        } else if (armAnim.gloss === 'help') {
          leftAngle = rightAngle = -(0.3 + wave * 0.7);             // both arms rise together
        } else if (armAnim.gloss === 'bad') {
          leftAngle = -0.3; rightAngle = -(0.1 + wave * 0.2);       // right arm dips low
        } else if (armAnim.gloss === 'more') {
          const pulse = Math.abs(Math.sin(p * Math.PI * 4));
          leftAngle = -(0.3 - pulse * 0.3); rightAngle = -(0.3 + pulse * 0.3); // pulse together
        } else if (armAnim.gloss === 'repeat') {
          leftAngle = -0.3; rightAngle = -(0.3 + Math.sin(p * Math.PI * 4) * 0.7); // circular
        } else if (armAnim.gloss === 'understand') {
          leftAngle = -0.3; rightAngle = -(p * 1.0 + wave * 0.2);  // lightbulb raise
        } else if (armAnim.gloss === 'goodbye') {
          leftAngle = -(0.3 + wave * 1.1); rightAngle = -0.3;       // LEFT arm waves (mirror hello)
        } else if (armAnim.gloss === 'thank_you') {
          const out = Math.sin(p * Math.PI) * 0.7;
          leftAngle = -(0.5 + out); rightAngle = -(0.5 + out);      // both hands push from chest outward
        } else if (armAnim.gloss === 'learn') {
          leftAngle = -0.3; rightAngle = -(0.6 + Math.sin(p * Math.PI * 2) * 0.5); // right taps then opens
        } else if (armAnim.gloss === 'question') {
          leftAngle = -0.3; rightAngle = -(0.4 + Math.sin(p * Math.PI * 2) * 0.6); // right curves up (? shape)
        } else if (armAnim.gloss === 'eat') {
          leftAngle = -0.3; rightAngle = -(0.3 + Math.abs(Math.sin(p * Math.PI * 4)) * 0.9); // right to mouth
        } else if (armAnim.gloss === 'water') {
          leftAngle = -0.3; rightAngle = -(0.5 + Math.abs(Math.sin(p * Math.PI * 3)) * 0.7); // W to mouth
        } else if (armAnim.gloss === 'love') {
          const hug = Math.sin(p * Math.PI) * 0.5;
          leftAngle = -(0.3 + hug); rightAngle = -(0.3 + hug);      // both arms cross chest
        } else if (armAnim.gloss === 'sad') {
          const droop = Math.sin(p * Math.PI * 1.5) * 0.2;
          leftAngle = -0.1 + droop; rightAngle = -0.1 - droop;      // arms hang low, slow sway
        } else if (armAnim.gloss === 'angry') {
          const tense = Math.abs(Math.sin(p * Math.PI * 5)) * 0.4;
          leftAngle = -(0.5 + tense); rightAngle = -(0.5 + tense);  // both arms tense/pull in
        } else if (armAnim.gloss === 'go') {
          leftAngle = -0.3; rightAngle = -(0.3 + p * 0.9 + wave * 0.1); // right sweeps forward
        } else if (armAnim.gloss === 'come') {
          leftAngle = -0.3; rightAngle = -(1.1 - p * 0.7 + wave * 0.1); // right pulls inward
        } else if (armAnim.gloss === 'wait') {
          const bounce = Math.abs(Math.sin(p * Math.PI * 3)) * 0.15;
          leftAngle = -0.3; rightAngle = -(1.1 + bounce);            // right palm out, slight bounce
        } else if (armAnim.gloss === 'name') {
          const tap = Math.abs(Math.sin(p * Math.PI * 4)) * 0.3;
          leftAngle = -(0.3 + tap); rightAngle = -(0.3 + tap);       // fingers tap together
        } else if (armAnim.gloss === 'finish') {
          const flip = Math.sin(p * Math.PI) * 0.8;
          leftAngle = -(0.3 + flip); rightAngle = -(0.3 - flip);     // both hands flip outward
        } else {
          leftAngle = -0.3; rightAngle = -(0.3 + wave * 0.8);       // generic wave
        }
      } else {
        const breathe = Math.sin(t * 1.0) * 0.05;
        leftAngle = -0.28 + breathe; rightAngle = -0.28 - breathe;
      }

      drawArm(ctx, ox - 22, oy - 68, leftAngle,  1, SHIRT, SKIN);
      drawArm(ctx, ox + 22, oy - 68, rightAngle, -1, SHIRT, SKIN);

      /* Neck */
      ctx.fillStyle = SKIN;
      roundRect(ox - 7, oy - 80, 14, 18, 5); ctx.fill();

      /* Head */
      const headY = oy - 110;
      ctx.fillStyle = SKIN;
      ctx.beginPath(); ctx.ellipse(ox, headY, 22, 26, 0, 0, Math.PI * 2); ctx.fill();

      /* Jaw shadow */
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.beginPath(); ctx.ellipse(ox, headY + 16, 18, 10, 0, 0, Math.PI); ctx.fill();

      /* Hair */
      ctx.fillStyle = HAIR;
      ctx.beginPath(); ctx.ellipse(ox, headY - 12, 22, 16, 0, Math.PI, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(ox - 20, headY - 2, 5, 14, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(ox + 20, headY - 2, 5, 14,  0.3, 0, Math.PI * 2); ctx.fill();

      /* Eyes (with blink) */
      const blink = (Math.sin(t * 0.4) > 0.97) ? 0.15 : 1;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(ox - 8, headY - 4, 5, 5 * blink, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(ox + 8, headY - 4, 5, 5 * blink, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(ox - 8, headY - 4, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(ox + 8, headY - 4, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ox - 7, headY - 5, 0.8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(ox + 9, headY - 5, 0.8, 0, Math.PI * 2); ctx.fill();

      /* Nose */
      ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(ox, headY - 2);
      ctx.quadraticCurveTo(ox + 4, headY + 4, ox + 2, headY + 7);
      ctx.stroke();

      /* Mouth / smile */
      ctx.strokeStyle = '#c88'; ctx.lineWidth = 1.5;
      const smileAmt = armAnim ? 1.2 : (0.8 + Math.sin(t * 0.5) * 0.1);
      ctx.beginPath();
      ctx.moveTo(ox - 7, headY + 10);
      ctx.quadraticCurveTo(ox, headY + 10 + smileAmt * 5, ox + 7, headY + 10);
      ctx.stroke();

      /* Glow ring when signing */
      if (armAnim) {
        ctx.strokeStyle = `rgba(108,99,255,${0.25 + Math.sin(t * 6) * 0.1})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(ox, headY, 34, 0, Math.PI * 2); ctx.stroke();
      }

      /* Fingerspelling overlay */
      if (letterOverlay) drawLetter(letterOverlay.letter);
    }

    function drawArm(ctx, x, y, angle, dir, sleeveColor, handColor) {
      ctx.save();
      ctx.translate(x, y);
      ctx.save();
      ctx.rotate(angle * dir);
      ctx.fillStyle = sleeveColor;
      roundRect(-6, 0, 12, 28, 5); ctx.fill();
      ctx.translate(0, 26);
      ctx.rotate(0.3 * dir);
      ctx.fillStyle = sleeveColor;
      roundRect(-5, 0, 10, 22, 4); ctx.fill();
      ctx.translate(0, 20);
      ctx.fillStyle = handColor;
      ctx.beginPath(); ctx.ellipse(0, 0, 7, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.restore();
    }

    /* ── Sign animation queue ── */
    const GLOSS_DURATION = {
      hello: 1500,    clap: 1800,      point: 1200,      yes: 1000,
      no: 1200,       good: 1200,      acknowledge: 1400, think: 1600,
      welcome: 1600,  sorry: 1400,     stop: 900,        help: 1200,
      bad: 1100,      more: 1300,      repeat: 1500,     understand: 1400,
      goodbye: 1600,  thank_you: 1400, learn: 1500,      question: 1000,
      eat: 1200,      water: 1100,     love: 1400,       sad: 1300,
      angry: 1000,    go: 1100,        come: 1100,       wait: 900,
      name: 1000,     finish: 1200,
    };

    function playNext() {
      if (!queue.length) { playing = false; armAnim = null; return; }
      playing = true;
      const gloss = queue.shift();
      const duration = GLOSS_DURATION[gloss] || 1200;
      const startT = performance.now();
      armAnim = { gloss, phase: 0 };

      function tick() {
        const elapsed = performance.now() - startT;
        armAnim.phase = Math.min(elapsed / duration, 1);
        if (armAnim.phase < 1) {
          requestAnimationFrame(tick);
        } else {
          armAnim = null;
          setTimeout(playNext, 200);
        }
      }
      requestAnimationFrame(tick);
    }

    /* ── ISL Fingerspelling (A–Z) ── */
    let letterOverlay = null; // { letter, alpha, timer }

    function drawLetter(letter) {
      const lx = ox + 30; // position: right side of avatar
      const ly = oy - 55;
      const r  = 22;

      // Background bubble
      ctx.save();
      ctx.globalAlpha = letterOverlay ? Math.min(letterOverlay.alpha, 0.92) : 0.92;
      ctx.fillStyle = '#1a1a3a';
      ctx.strokeStyle = '#6C63FF';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(lx, ly, r, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();

      // Letter text
      ctx.fillStyle = '#c8c4ff';
      ctx.font = `bold ${r}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(letter.toUpperCase(), lx, ly);
      ctx.restore();

      // Simplified ISL hand-shape indicator below the bubble
      const hx = lx, hy = ly + r + 14;
      ctx.save();
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = SKIN; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      const l = letter.toLowerCase();

      if ('aeiou'.includes(l)) {
        // Vowels: O-shape hand
        ctx.beginPath(); ctx.arc(hx, hy, 7, 0, Math.PI * 2); ctx.stroke();
      } else if ('bdfhkl'.includes(l)) {
        // Extended fingers
        const count = 'bdfhkl'.indexOf(l) % 3 + 1;
        for (let i = 0; i < count; i++) {
          ctx.beginPath(); ctx.moveTo(hx - 6 + i * 6, hy + 4);
          ctx.lineTo(hx - 6 + i * 6, hy - 10); ctx.stroke();
        }
      } else if ('mnpqrsvwxyz'.includes(l)) {
        // Fist-based: draw crossed or bent lines
        ctx.beginPath(); ctx.moveTo(hx - 7, hy); ctx.lineTo(hx + 7, hy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(hx, hy + 5); ctx.lineTo(hx, hy - 8); ctx.stroke();
      } else {
        // Default: simple fist dot
        ctx.fillStyle = SKIN;
        ctx.beginPath(); ctx.arc(hx, hy, 6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    /* ── Listen for sign events from content.js ── */
    window.addEventListener('message', (e) => {
      if (e.data?.type === 'echo-sign:play') {
        queue.push(e.data.gloss);
        if (!playing) playNext();
      } else if (e.data?.type === 'echo-sign:letter') {
        // Show letter overlay for 400ms (staggered by caller)
        letterOverlay = { letter: e.data.letter, alpha: 1, timer: 400 };
        setTimeout(() => { letterOverlay = null; }, 400);
      }
    });

    /* ── Main render loop ── */
    function loop(ts) {
      if (lastTs !== null) t += (ts - lastTs) / 1000;
      lastTs = ts;
      draw();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    console.log('[Echo-Sign] 2D avatar ready');
  });
})();