(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('invaders'), ctx = canvas.getContext('2d');
  const W = 800, H = 500, input = new Set();
  const patterns = [
    ['00100100','00011000','00111100','01111110','11011011','11111111','00100100','01011010'],
    ['00111100','11111111','11011011','11111111','00111100','01100110','11000011','00100100'],
    ['00011000','00111100','01111110','11011011','11111111','00100100','01011010','10100101']
  ];
  // Synthesized locally: no audio files or downloads required.
  let audio = null, soundEnabled = true;
  const voices = new Set();
  try { soundEnabled = localStorage.getItem('404-invaders-sound') !== 'false'; } catch (_) {}
  function soundUI() {
    $('sound').textContent = soundEnabled ? 'SOUND ON' : 'SOUND OFF';
    $('sound').setAttribute('aria-pressed', String(soundEnabled));
    $('sound').setAttribute('aria-label', soundEnabled ? 'Mute game sounds' : 'Enable game sounds');
  }
  function unlockAudio() {
    if (!soundEnabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!audio && AudioContext) audio = new AudioContext();
      if (audio && audio.state === 'suspended') audio.resume().catch(() => {});
    } catch (_) { /* Gameplay remains available without audio support. */ }
  }
  function hush() {
    for (const voice of voices) { try { voice.stop(); } catch (_) {} }
    voices.clear();
  }
  function tone(from, to, duration, type = 'square', volume = .035, delay = 0) {
    if (!soundEnabled || !audio || audio.state !== 'running' || voices.size >= 20) return;
    try {
      const oscillator = audio.createOscillator(), gain = audio.createGain();
      const at = audio.currentTime + delay;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(from, at);
      oscillator.frequency.exponentialRampToValueAtTime(to, at + duration);
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(volume, at + .005);
      gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
      oscillator.connect(gain); gain.connect(audio.destination);
      voices.add(oscillator);
      oscillator.onended = () => { voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(at); oscillator.stop(at + duration + .01);
    } catch (_) {}
  }
  const sfx = {
    fire: () => tone(850, 180, .09, 'square', .022),
    hit: () => tone(260, 65, .13, 'sawtooth', .035),
    hurt: () => tone(140, 35, .3, 'sawtooth', .065),
    clear: () => [440, 554, 659, 880].forEach((n, i) => tone(n, n, .18, 'triangle', .07, i * .1)),
    over: () => [330, 260, 196, 98].forEach((n, i) => tone(n, n * .75, .27, 'square', .045, i * .17))
  };
  $('sound').addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    try { localStorage.setItem('404-invaders-sound', String(soundEnabled)); } catch (_) {}
    if (soundEnabled) unlockAudio(); else hush();
    soundUI();
    window.dispatchEvent(new CustomEvent('invaders-sound', { detail: { enabled: soundEnabled } }));
    canvas.focus({ preventScroll: true });
  });
  soundUI();
  let best = 0;
  try { best = Math.max(0, Number(localStorage.getItem('404-invaders-best')) || 0); } catch (_) {}
  const levels = [
    { speed: 20, shotSpeed: 175, shotInterval: 1.0 },
    { speed: 32, shotSpeed: 200, shotInterval: .85 },
    { speed: 44, shotSpeed: 225, shotInterval: .70 },
    { speed: 56, shotSpeed: 250, shotInterval: .55 },
    { speed: 68, shotSpeed: 275, shotInterval: .40 }
  ];
  let state = 'ready', score = 0, wave = 1, lives = 3, aliens = [], shots = [], bombs = [], sparks = [];
  let direction = 1, fireTimer = 0, bombTimer = 1, invincible = 0, transition = 0, time = 0;
  let asteroids = [], asteroidTimer = 3;
  const ammoCapacity = 20;
  let ammo = ammoCapacity;
  function ammoHUD() {
    const rounds = Math.floor(ammo);
    $('ammo-meter').value = ammo;
    $('ammo-count').textContent = `${rounds} / ${ammoCapacity}`;
    $('ammo-status').textContent = rounds === 0 ? 'EMPTY — RELEASE FIRE TO RELOAD' : ammo < ammoCapacity && !input.has('fire') ? 'RELOADING' : 'RELEASE FIRE TO RELOAD';
  }
  const ship = { x: W / 2, y: H - 40, w: 32, h: 22 };
  const stars = Array.from({ length: 90 }, (_, i) => {
    const depth = i % 3;
    return { x: Math.random() * W, y: Math.random() * H, size: depth === 2 ? 2 : 1, speed: [18, 38, 65][depth], trail: [1, 2, 5][depth], color: ['#81975c40', '#a8bf8770', '#c4ddaaa0'][depth] };
  });
  function hud() {
    $('score').textContent = String(score).padStart(5, '0');
    $('best').textContent = String(best).padStart(5, '0');
    $('wave').textContent = `${wave} / ${levels.length}`;
    $('lives').textContent = Array.from({length:3}, (_, i) => i < lives ? '♥' : '♡').join(' ');
  }
  function addScore(n) {
    score += n;
    if (score > best) {
      best = score;
      try { localStorage.setItem('404-invaders-best', String(best)); } catch (_) {}
    }
    hud();
  }
  function formation() {
    ammo = ammoCapacity; ammoHUD();
    aliens = []; asteroids = []; asteroidTimer = 3;
    for (let row = 0; row < 4; row++) for (let col = 0; col < 9; col++) {
      aliens.push({ x: 115 + col * 58, y: 72 + row * 43, w: 28, h: 28, row, col });
    }
    direction = 1; bombTimer = 1.2; shots = []; bombs = [];
    $('announce').textContent = `Level ${wave} of ${levels.length}. Clear the glitches.`;
  }
  function overlay(tag, title, detail, action, hint) {
    $('tag').textContent = tag; $('message').textContent = title; $('detail').textContent = detail;
    $('play').textContent = action; $('hint').textContent = hint; $('overlay').hidden = false;
    $('announce').textContent = `${title} ${detail}`;
  }
  function play() {
    unlockAudio(); hush();
    const restarting = state !== 'paused';
    if (state !== 'paused') {
      score = 0; wave = 1; lives = 3; ship.x = W / 2;
      sparks = []; invincible = 0; fireTimer = 0; transition = 0; formation();
    }
    state = 'playing';
    window.dispatchEvent(new CustomEvent('invaders-music', { detail: { playing: true, restart: restarting, enabled: soundEnabled } }));
    held.clear(); input.clear(); $('overlay').hidden = true; $('pause').disabled = false;
    $('pause').innerHTML = 'PAUSE <kbd>P</kbd>'; hud(); canvas.focus({ preventScroll: true });
  }
  function pause() {
    if (state === 'paused') return play();
    if (state !== 'playing') return;
    hush();
    window.dispatchEvent(new CustomEvent('invaders-music', { detail: { playing: false } }));
    state = 'paused'; held.clear(); input.clear(); $('pause').innerHTML = 'RESUME <kbd>P</kbd>';
    overlay('SIGNAL ON HOLD', 'Take a little breather.', 'Your corner of the internet can wait.', 'RESUME →', 'PRESS P OR ENTER');
  }
  function over(invasion = false) {
    hush(); sfx.over();
    window.dispatchEvent(new CustomEvent('invaders-music', { detail: { playing: false } }));
    state = 'over'; input.clear(); $('pause').disabled = true;
    overlay('CONNECTION LOST', invasion ? 'The glitches got through.' : 'Out of lives. Still in spirit.',
      `You scored ${score} points and reached level ${wave}. Ready for another defence?`, 'TRY AGAIN →', 'PRESS ENTER TO RESTART');
  }
  function win() {
    window.dispatchEvent(new CustomEvent('invaders-music', { detail: { playing: false } }));
    state = 'won'; held.clear(); input.clear(); shots = []; bombs = [];
    $('pause').disabled = true;
    overlay('ALL 5 LEVELS CLEARED', 'Page defended. Signal restored.',
      `You beat all five levels with ${score} points and ${lives} ${lives === 1 ? 'life' : 'lives'} remaining.`,
      'PLAY AGAIN →', 'PRESS ENTER TO RESTART');
  }
  function burst(x, y, color) {
    for (let i = 0; i < 12; i++) sparks.push({ x, y, vx: (Math.random() - .5) * 140, vy: (Math.random() - .5) * 140, life: .5, color });
  }
  const hit = (a, b) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2;
  function hitsRock(rect, rock) {
    const dx = Math.max(Math.abs(rock.x - rect.x) - rect.w / 2, 0);
    const dy = Math.max(Math.abs(rock.y - rect.y) - rect.h / 2, 0);
    return dx * dx + dy * dy < (rock.radius * .85) ** 2;
  }
  function update(dt) {
    if (state !== 'playing') return;
    time += dt;
    for (const p of sparks) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
    sparks = sparks.filter(p => p.life > 0);
    ship.x = Math.max(24, Math.min(W - 24, ship.x + (Number(input.has('right')) - Number(input.has('left'))) * 340 * dt));
    invincible = Math.max(0, invincible - dt);
    if (transition > 0) {
      transition -= dt;
      if (transition <= 0) { wave++; formation(); hud(); }
      return;
    }
    fireTimer -= dt;
    if (!input.has('fire')) ammo = Math.min(ammoCapacity, ammo + 8 * dt);
    if (input.has('fire') && fireTimer <= 0 && ammo >= 1) {
      ammo -= 1;
      if (ammo < 1) $('announce').textContent = 'Ammunition empty. Release fire to reload.';
      shots.push({ x: ship.x, y: ship.y - 20, w: 4, h: 13 }); fireTimer = .2; sfx.fire();
    }
    ammoHUD();
    const difficulty = levels[wave - 1];
    const speed = difficulty.speed + (36 - aliens.length) * 1.8;
    const dx = direction * speed * dt;
    if (aliens.some(a => a.x + dx < 28 || a.x + dx > W - 28)) {
      direction *= -1;
      for (const a of aliens) a.y += 15;
    } else { for (const a of aliens) a.x += dx; }
    if (aliens.some(a => a.y + a.h / 2 >= ship.y - ship.h / 2)) { over(true); return; }
    bombTimer -= dt;
    if (bombTimer <= 0 && aliens.length) {
      const front = aliens.filter(a => !aliens.some(b => b.col === a.col && b.row > a.row));
      const a = front[Math.floor(Math.random() * front.length)];
      bombs.push({ x: a.x, y: a.y + 18, w: 6, h: 14 });
      bombTimer = difficulty.shotInterval + Math.random() * .12;
    }
    asteroidTimer -= dt;
    if (asteroidTimer <= 0) {
      const radius = 15 + Math.random() * 9;
      asteroids.push({ x: 35 + Math.random() * (W - 70), y: -30,
        radius, vx: (Math.random() - .5) * 24, vy: 65 + wave * 12,
        angle: Math.random() * Math.PI * 2, spin: (Math.random() - .5) * 1.4,
        outline: Array.from({ length: 9 }, () => .8 + Math.random() * .2) });
      asteroidTimer = Math.max(2, 4.5 - wave * .4) + Math.random();
    }
    for (const rock of asteroids) {
      rock.x += rock.vx * dt; rock.y += rock.vy * dt; rock.angle += rock.spin * dt;
      if (rock.x < rock.radius || rock.x > W - rock.radius) rock.vx *= -1;
    }
    for (const s of shots) s.y -= 510 * dt;
    for (const b of bombs) b.y += difficulty.shotSpeed * dt;
    for (const s of shots) {
      const rockIndex = asteroids.findIndex(rock => hitsRock(s, rock));
      if (rockIndex !== -1) {
        const rock = asteroids.splice(rockIndex, 1)[0];
        s.y = -100; burst(rock.x, rock.y, '#c9ad83'); sfx.hit(); addScore(15);
        continue;
      }
      const i = aliens.findIndex(a => hit(s, a));
      if (i !== -1) {
        const a = aliens.splice(i, 1)[0]; s.y = -100; sfx.hit();
        burst(a.x, a.y, a.row < 2 ? '#d4fa78' : '#7bbeb0'); addScore(a.row === 0 ? 30 : a.row === 1 ? 20 : 10);
      }
    }
    for (const b of bombs) if (invincible === 0 && hit(b, ship)) {
      b.y = H + 100; lives--; sfx.hurt(); invincible = 1.5; burst(ship.x, ship.y, '#ff917a'); hud();
      if (lives === 0) { over(); return; }
    }
    for (let i = asteroids.length - 1; i >= 0; i--) {
      const rock = asteroids[i];
      if (hitsRock(ship, rock)) {
        asteroids.splice(i, 1); burst(rock.x, rock.y, '#c9ad83');
        if (invincible === 0) {
          lives--; invincible = 1.5; sfx.hurt(); hud();
          $('announce').textContent = 'Asteroid impact. One life lost.';
          if (lives === 0) { over(); return; }
        }
      }
    }
    asteroids = asteroids.filter(rock => rock.y - rock.radius < H);
    shots = shots.filter(s => s.y > -20); bombs = bombs.filter(b => b.y < H + 20);
    if (!aliens.length) {
      sfx.clear(); addScore(100); shots = []; bombs = []; asteroids = [];
      if (wave === levels.length) { win(); return; }
      transition = 1.5;
      $('announce').textContent = `Level ${wave} cleared. 100 bonus points. Next level is faster.`;
    }
  }
  function render() {
    ctx.fillStyle = '#0c100b'; ctx.fillRect(0, 0, W, H);
    // Near stars pass faster than distant stars, suggesting forward flight.
    for (const s of stars) {
      const y = (s.y + time * s.speed) % (H + s.trail) - s.trail;
      ctx.fillStyle = s.color;
      ctx.fillRect(s.x, y, s.size, s.trail);
    }
    ctx.strokeStyle = '#d4fa7820'; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.moveTo(15, H - 20); ctx.lineTo(W - 15, H - 20); ctx.stroke(); ctx.setLineDash([]);
    for (const a of aliens) {
      ctx.fillStyle = a.row < 2 ? '#d4fa78' : '#7bbeb0';
      const pattern = patterns[a.row % 3], step = Math.floor(time * 3) % 2;
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (pattern[y][x] === '1') {
        ctx.fillRect(Math.round(a.x - 14 + x * 3.5 + (y > 5 ? step * (x < 4 ? -1 : 1) : 0)), Math.round(a.y - 14 + y * 3.5), 3, 3);
      }
    }
    for (const rock of asteroids) {
      ctx.save(); ctx.translate(rock.x, rock.y); ctx.rotate(rock.angle);
      ctx.beginPath();
      rock.outline.forEach((scale, i) => {
        const angle = i / rock.outline.length * Math.PI * 2;
        const x = Math.cos(angle) * rock.radius * scale, y = Math.sin(angle) * rock.radius * scale;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.closePath(); ctx.fillStyle = '#776c5d'; ctx.fill();
      ctx.strokeStyle = '#b4a187'; ctx.lineWidth = 1.5; ctx.stroke();
      for (const [x, y, radius] of [[-.3, -.25, .22], [.3, .15, .16], [-.1, .45, .12]]) {
        ctx.beginPath(); ctx.arc(x * rock.radius, y * rock.radius, radius * rock.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#4b453e'; ctx.fill(); ctx.strokeStyle = '#91816a'; ctx.lineWidth = .7; ctx.stroke();
      }
      ctx.restore();
    }
    if (!invincible || Math.floor(invincible * 10) % 2 === 0) {
      ctx.save();
      ctx.translate(ship.x, ship.y);
      const shape = (points, fill, stroke = null) => {
        ctx.beginPath();
        points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
        ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = .6; ctx.stroke(); }
      };
      // Twin exhausts are decorative; the collision box stays 32 by 22.
      const flame = 12 + Math.sin(time * 29) * 2.5 + Math.sin(time * 47) * 1.5;
      for (const x of [-7, 7]) {
        const glow = ctx.createLinearGradient(0, 8, 0, 10 + flame);
        glow.addColorStop(0, '#c5faff'); glow.addColorStop(.4, '#55c9e8');
        glow.addColorStop(1, '#2590d000');
        ctx.shadowColor = '#55c9e8'; ctx.shadowBlur = 8;
        shape([[x - 2.5, 8], [x + 2.5, 8], [x + 1.8, 14], [x, 10 + flame], [x - 1.8, 14]], glow);
        ctx.shadowBlur = 0;
        shape([[x - 1.2, 9], [x + 1.2, 9], [x, 10 + flame * .55]], '#e0fbff');
      }
      // Swept titanium wings, darker undersides, and inset armor panels.
      shape([[-3, -6], [-8, -3], [-16, 7], [-15, 10], [-5, 7]], '#667c89', '#a5bac3');
      shape([[3, -6], [8, -3], [16, 7], [15, 10], [5, 7]], '#465f6f', '#8fa6b3');
      shape([[-6, 0], [-13, 7], [-6, 5]], '#a4b8bd');
      shape([[6, 0], [13, 7], [6, 5]], '#79949f');
      ctx.fillStyle = '#253b48';
      ctx.fillRect(-9, 5, 4, 5); ctx.fillRect(5, 5, 4, 5);
      ctx.fillStyle = '#a9e9f3';
      ctx.fillRect(-8, 9, 2, 1); ctx.fillRect(6, 9, 2, 1);
      const hull = ctx.createLinearGradient(-5, 0, 5, 0);
      hull.addColorStop(0, '#637e8d'); hull.addColorStop(.4, '#e1e9e6');
      hull.addColorStop(.55, '#beced2'); hull.addColorStop(1, '#526c7d');
      shape([[0, -13], [3, -7], [5, 5], [3, 9], [-3, 9], [-5, 5], [-3, -7]], hull, '#c1d2d8');
      // Recessed blue canopy and a narrow reflection along the glass.
      shape([[0, -8], [2, -4], [2, 0], [0, 2], [-2, 0], [-2, -4]], '#173947', '#577f92');
      shape([[0, -7], [1, -4], [1, 0], [-1, -1], [-1, -4]], '#72c8dd');
      ctx.fillStyle = '#e2f8fa'; ctx.fillRect(-1, -5, .7, 3);
      ctx.fillStyle = '#445f6d'; ctx.fillRect(-2, 4, 4, 1);
      ctx.fillStyle = '#d4fa78'; ctx.fillRect(-13, 5, 2, 1); ctx.fillRect(11, 5, 2, 1);
      ctx.fillStyle = '#ff8f79'; ctx.fillRect(-16, 7, 1, 2);
      ctx.fillStyle = '#92ecc9'; ctx.fillRect(15, 7, 1, 2);
      ctx.restore();
    }
    ctx.fillStyle = '#efffc5'; for (const s of shots) ctx.fillRect(s.x - 2, s.y - 6, s.w, s.h);
    ctx.fillStyle = '#ff917a'; for (const b of bombs) { ctx.fillRect(b.x - 3, b.y - 7, 3, 9); ctx.fillRect(b.x, b.y, 3, 7); }
    for (const p of sparks) { ctx.globalAlpha = p.life * 2; ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 3, 3); } ctx.globalAlpha = 1;
    if (transition > 0 && state === 'playing') {
      ctx.fillStyle = '#0c100bdd'; ctx.fillRect(0, 190, W, 105);
      ctx.textAlign = 'center'; ctx.font = '22px monospace'; ctx.fillStyle = '#d4fa78'; ctx.fillText('LEVEL CLEARED / +100', W / 2, 230);
      ctx.font = '12px monospace'; ctx.fillStyle = '#a1ae8f'; ctx.fillText(`LEVEL ${wave + 1} / ${levels.length} — SPEED INCREASING`, W / 2, 260);
    }
  }
  const mapped = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', ' ': 'fire' };
  const held = new Set();
  function sync() { input.clear(); for (const key of held) input.add(mapped[key] || key); }
  window.addEventListener('keydown', e => {
    if (e.ctrlKey || e.altKey || e.metaKey || e.target.closest('button, a, input, textarea, select')) return;
    const k = e.key.toLowerCase();
    if (mapped[k] || k === 'p' || k === 'enter') e.preventDefault();
    if (k === 'enter' && !e.repeat && state !== 'playing') play();
    if (k === 'p' && !e.repeat) pause();
    if (mapped[k] && state === 'playing') { held.add(k); sync(); }
  });
  window.addEventListener('keyup', e => { held.delete(e.key.toLowerCase()); sync(); });
  function unfocus() { held.clear(); input.clear(); if (state === 'playing') pause(); }
  window.addEventListener('blur', unfocus);
  document.addEventListener('visibilitychange', () => { if (document.hidden) unfocus(); });
  for (const button of document.querySelectorAll('[data-key]')) {
    button.addEventListener('pointerdown', e => { e.preventDefault(); button.setPointerCapture(e.pointerId); if (state === 'playing') { held.add(button.dataset.key); sync(); } });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(event, () => { held.delete(button.dataset.key); sync(); });
  }
  $('play').addEventListener('click', () => { held.clear(); play(); });
  $('pause').addEventListener('click', () => { held.clear(); pause(); });
  formation(); hud();
  let last = null, accumulator = 0;
  function loop(now) {
    if (last === null) last = now;
    accumulator += Math.min(100, now - last); last = now;
    while (accumulator >= 1000 / 60) { update(1 / 60); accumulator -= 1000 / 60; }
    render(); requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
