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
        if (armAnim.gloss === 'hello' || armAnim.gloss === 'acknowledge') {
          leftAngle = -0.3; rightAngle = -(0.3 + wave * 1.2);
        } else if (armAnim.gloss === 'no') {
          leftAngle = -0.3 + wave * 0.4; rightAngle = -0.3 - wave * 0.4;
        } else if (armAnim.gloss === 'yes') {
          leftAngle = -0.3; rightAngle = -0.3 + wave * 0.5;
        } else if (armAnim.gloss === 'clap') {
          const clap = Math.abs(Math.sin(p * Math.PI * 4));
          leftAngle = rightAngle = -(0.3 + clap * 0.8);
        } else if (armAnim.gloss === 'point') {
          leftAngle = -0.3; rightAngle = -(0.9 + wave * 0.1);
        } else {
          leftAngle = -0.3; rightAngle = -(0.3 + wave * 0.8);
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
      hello: 1500, clap: 1800, point: 1200, yes: 1000,
      no: 1200, good: 1200, acknowledge: 1400, think: 1600,
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

    /* ── Listen for sign events from content.js ── */
    window.addEventListener('message', (e) => {
      if (e.data?.type !== 'echo-sign:play') return;
      queue.push(e.data.gloss);
      if (!playing) playNext();
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