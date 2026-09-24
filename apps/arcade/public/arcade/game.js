(() => {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const soundToggleBtn = document.getElementById('sound-toggle');
  const soundIcon = document.getElementById('sound-icon');

  const W = 480;
  const H = 320;
  canvas.width = W;
  canvas.height = H;

  // --- Sound Engine (Web Audio API) ---
  let audioCtx = null;
  let soundEnabled = true;
  try { soundEnabled = localStorage.getItem('void_explorer_sound') !== 'false'; } catch (_) {}

  function updateSoundIcon() {
    if (soundIcon) soundIcon.textContent = soundEnabled ? '🔊' : '🔇';
  }
  updateSoundIcon();

  if (soundToggleBtn) {
    soundToggleBtn.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      try { localStorage.setItem('void_explorer_sound', soundEnabled ? 'true' : 'false'); } catch (_) {}
      updateSoundIcon();
      if (soundEnabled && !audioCtx) initAudio();
    });
  }

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playTone(freq, type, duration, slideTo = null, gainVal = 0.12) {
    if (!soundEnabled) return;
    try {
      initAudio();
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      if (slideTo !== null) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(10, slideTo), audioCtx.currentTime + duration);
      }
      gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (_) {}
  }

  const sfx = {
    jump() {
      playTone(150, 'square', 0.15, 480, 0.08);
    },
    coin() {
      if (!soundEnabled) return;
      try {
        initAudio();
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(987.77, now); // B5
        osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      } catch (_) {}
    },
    stomp() {
      playTone(320, 'square', 0.18, 120, 0.15);
    },
    hurt() {
      playTone(180, 'sawtooth', 0.25, 40, 0.18);
    },
    gameover() {
      if (!soundEnabled) return;
      try {
        initAudio();
        if (!audioCtx) return;
        const notes = [280, 240, 200, 150];
        notes.forEach((f, i) => {
          setTimeout(() => playTone(f, 'sawtooth', 0.22, f * 0.8, 0.14), i * 150);
        });
      } catch (_) {}
    }
  };

  // --- High Score Persistence ---
  let highScore = 512;
  try {
    const saved = localStorage.getItem('void_explorer_hi');
    if (saved !== null) highScore = parseInt(saved, 10) || 512;
  } catch (_) {}

  // --- Game State Variables ---
  let gameState = 'playing'; // 'playing', 'paused', 'over'
  let score = 0;
  let lives = 3;
  let maxLives = 3;
  let invulnerableTimer = 0;
  let frameCount = 0;

  // Visual effects
  let floatingTexts = [];
  let particles = [];

  // --- Stars (Parallax Background) ---
  const stars = [];
  for (let i = 0; i < 65; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      size: Math.random() < 0.75 ? 1 : 2,
      speed: 0.1 + Math.random() * 0.35,
      alpha: 0.3 + Math.random() * 0.7,
      color: ['#ffffff', '#00f0ff', '#ff2a85', '#ffcc00'][Math.floor(Math.random() * 4)]
    });
  }

  // --- Platforms (Rocky lunar cliffs matching screenshot) ---
  // Left elevated ledge (y:190), pit crater (y:260) with spikes, right step-ups, plus upper floating platforms
  const platforms = [
    // Main Left High Ledge (x: 0 -> 180, y: 190)
    { x: 0, y: 190, w: 180, h: 130, type: 'cliff_left' },
    // Crater Floor (x: 180 -> 330, y: 260)
    { x: 180, y: 260, w: 150, h: 60, type: 'crater' },
    // Right Raised Platform (x: 330 -> 480, y: 215)
    { x: 330, y: 215, w: 150, h: 105, type: 'cliff_right' },
    // Upper Floating Platform Left (x: 50 -> 140, y: 115)
    { x: 50, y: 115, w: 90, h: 14, type: 'floating' },
    // Upper Floating Platform Right (x: 230 -> 320, y: 130)
    { x: 230, y: 130, w: 90, h: 14, type: 'floating' },
    // High Island (x: 145 -> 215, y: 65)
    { x: 145, y: 65, w: 70, h: 14, type: 'floating' }
  ];

  // Hazards: Spikes / fiery void anomaly in the lower crater
  const initialPlatforms = platforms.map(p => ({ ...p }));
  const hazards = [
    { x: 235, y: 248, w: 32, h: 12 }
  ];

  const initialHazards = hazards.map(h => ({ ...h }));

  // --- Player (Astronaut) ---
  const player = {
    x: 45,
    y: 150,
    w: 18,
    h: 24,
    vx: 0,
    vy: 0,
    speed: 2.5,
    jumpStrength: -6.8,
    grounded: false,
    facing: 'right',
    animTimer: 0,
    animFrame: 0
  };

  // --- Collectible Coins (Lost Data Disks) ---
  const coinTemplates = [
    { x: 100, y: 165 },
    { x: 95, y: 90 },
    { x: 180, y: 40 },
    { x: 275, y: 105 },
    { x: 300, y: 235 },
    { x: 390, y: 190 },
    { x: 440, y: 190 }
  ];

  let coins = [];
  function initCoins() {
    coins = coinTemplates.map(c => ({
      x: c.x,
      y: c.y,
      w: 14,
      h: 14,
      collected: false,
      glowTimer: Math.random() * 10
    }));
  }
  initCoins();

  // --- Enemies (Cute Pixel Aliens matching screenshot) ---
  // Alien 1: Blue/Purple Spiky creature on left platform
  // Alien 2: Orange/Red Horned creature in crater
  // Alien 3: Blue alien on right platform
  let enemies = [];
  function initEnemies() {
    enemies = [
      {
        type: 'blue_alien',
        x: 120,
        y: 172,
        w: 18,
        h: 18,
        vx: -0.85,
        minX: 10,
        maxX: 165,
        anim: 0,
        alive: true
      },
      {
        type: 'orange_alien',
        x: 290,
        y: 242,
        w: 18,
        h: 18,
        vx: -0.9,
        minX: 185,
        maxX: 320,
        anim: 0,
        alive: true
      },
      {
        type: 'blue_alien',
        x: 360,
        y: 197,
        w: 18,
        h: 18,
        vx: 0.8,
        minX: 340,
        maxX: 460,
        anim: 0,
        alive: true
      }
    ];
  }
  initEnemies();

  // World coordinates stay stable; the camera follows forward progress.
  let cameraX = 0;
  let worldEnd = W;
  let lastGroundY = 215;
  let furthestX = 45;
  let distance = 0;
  let nextMilestone = 100;
  let checkpoint = { x: 45, y: 150 };

  function extendWorld() {
    while (worldEnd < cameraX + W * 2) {
      const tier = Math.min(5, Math.floor(worldEnd / 1800));
      const gap = Math.random() < .4 ? 30 + Math.random() * 15 : 0;
      // A full jump covers ~95px and rises ~63px. Keep all transitions reachable.
      const y = Math.max(185, Math.min(250, lastGroundY + (Math.floor(Math.random() * 3) - 1) * 20));
      const x = worldEnd + gap;
      const w = 190 + Math.floor(Math.random() * 110);
      platforms.push({ x, y, w, h: H - y, type: 'cliff_right' });
      const challenge = Math.random();
      if (challenge < .48) {
        hazards.push({ x: x + w * .55, y: y - 12, w: 24 + tier * 2, h: 12 });
      } else if (challenge < .9) {
        enemies.push({ type: tier % 2 ? 'orange_alien' : 'blue_alien', x: x + w * .55,
          y: y - 18, w: 18, h: 18, vx: .65 + tier * .12,
          minX: x + 65, maxX: x + w - 30, anim: 0, alive: true });
      }
      if (Math.random() < .55) {
        platforms.push({ x: x + 65, y: y - 48, w: 85, h: 14, type: 'floating' });
        coins.push({ x: x + 100, y: y - 73, w: 14, h: 14, collected: false });
      }
      for (const offset of [25, w - 35]) {
        coins.push({ x: x + offset, y: y - 25, w: 14, h: 14, collected: false });
      }
      worldEnd = x + w;
      lastGroundY = y;
    }
    // Retire scenery behind the camera so long runs use bounded memory.
    const cutoff = cameraX - W;
    for (const list of [platforms, hazards, coins, enemies]) {
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i].x + list[i].w < cutoff) list.splice(i, 1);
      }
    }
  }
  extendWorld();

  // --- Input Handling ---
  const keys = { left: false, right: false, up: false };

  window.addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('button, a, input, textarea, select')) return;
    initAudio();
    const key = e.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'arrowup', ' '].includes(key)) e.preventDefault();
    if (['arrowup', 'w', ' '].includes(key)) {
      if (gameState === 'over') {
        resetGame();
        return;
      }
      keys.up = true;
      e.preventDefault();
    }
    if (['arrowleft', 'a'].includes(key)) {
      keys.left = true;
    }
    if (['arrowright', 'd'].includes(key)) {
      keys.right = true;
    }
    if (key === 'p' && !e.repeat) {
      if (gameState === 'playing') gameState = 'paused';
      else if (gameState === 'paused') gameState = 'playing';
    }
  });

  window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (['arrowup', 'w', ' '].includes(key)) keys.up = false;
    if (['arrowleft', 'a'].includes(key)) keys.left = false;
    if (['arrowright', 'd'].includes(key)) keys.right = false;
  });

  window.addEventListener('blur', () => {
    keys.left = keys.right = keys.up = false;
    if (gameState === 'playing') gameState = 'paused';
  });

  // Touch button support
  function setupTouch(id, onStart, onEnd) {
    const el = document.getElementById(id);
    if (!el) return;
    const start = (e) => {
      e.preventDefault();
      initAudio();
      onStart();
    };
    const end = (e) => {
      e.preventDefault();
      onEnd();
    };
    el.addEventListener('touchstart', start, { passive: false });
    el.addEventListener('touchend', end, { passive: false });
    el.addEventListener('touchcancel', end, { passive: false });
    el.addEventListener('mousedown', start);
    el.addEventListener('mouseup', end);
    el.addEventListener('mouseleave', end);
  }

  setupTouch('touch-left', () => { keys.left = true; }, () => { keys.left = false; });
  setupTouch('touch-right', () => { keys.right = true; }, () => { keys.right = false; });
  setupTouch('touch-jump', () => {
    if (gameState === 'over') resetGame();
    else if (gameState === 'paused') gameState = 'playing';
    else keys.up = true;
  }, () => { keys.up = false; });

  canvas.addEventListener('click', () => {
    initAudio();
    if (gameState === 'over') resetGame();
    else if (gameState === 'paused') gameState = 'playing';
  });

  // --- Helper: Particle & Floating Text ---
  function addSparks(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 2.5;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.5,
        life: 20 + Math.random() * 15,
        maxLife: 35,
        color,
        size: Math.random() < 0.5 ? 2 : 3
      });
    }
  }

  function addFloatingText(text, x, y, color = '#ffcc00') {
    floatingTexts.push({
      text,
      x,
      y,
      vy: -0.9,
      alpha: 1,
      life: 40,
      color
    });
  }

  // --- Reset Game ---
  function resetGame() {
    score = 0;
    lives = 3;
    gameState = 'playing';
    invulnerableTimer = 0;
    player.x = 45;
    player.y = 150;
    player.vx = 0;
    player.vy = 0;
    player.grounded = false;
    particles = [];
    floatingTexts = [];
    initCoins();
    initEnemies();
    platforms.splice(0, platforms.length, ...initialPlatforms.map(p => ({ ...p })));
    hazards.splice(0, hazards.length, ...initialHazards.map(h => ({ ...h })));
    cameraX = 0; worldEnd = W; lastGroundY = 215;
    furthestX = 45; distance = 0; nextMilestone = 100;
    checkpoint = { x: 45, y: 150 };
    keys.left = keys.right = keys.up = false;
    extendWorld();
  }

  function takeDamage(knockbackDir = 0) {
    if (invulnerableTimer > 0) return;
    lives--;
    sfx.hurt();
    invulnerableTimer = 60; // 1 second invulnerability
    player.vy = -4.5;
    player.vx = knockbackDir * 3;
    addSparks(player.x + player.w / 2, player.y + player.h / 2, '#ff2a85', 12);
    if (lives <= 0) {
      gameState = 'over';
      sfx.gameover();
      if (score > highScore) {
        highScore = score;
        try { localStorage.setItem('void_explorer_hi', highScore); } catch (_) {}
      }
    }
  }

  // --- Physics & Updates ---
  function update() {
    frameCount++;

    // Update floating stars
    for (const s of stars) {
      s.y += s.speed;
      if (s.y > H) {
        s.y = 0;
        s.x = Math.random() * W;
      }
    }

    if (gameState !== 'playing') return;

    if (invulnerableTimer > 0) invulnerableTimer--;

    // Horizontal Movement
    if (keys.left) {
      player.vx = -player.speed;
      player.facing = 'left';
      player.animTimer++;
    } else if (keys.right) {
      player.vx = player.speed;
      player.facing = 'right';
      player.animTimer++;
    } else {
      player.vx *= 0.6;
      player.animTimer = 0;
    }

    // Animation frame for walking
    if (player.animTimer > 6) {
      player.animFrame = (player.animFrame + 1) % 4;
      player.animTimer = 0;
    }

    // Jump
    if (keys.up && player.grounded) {
      player.vy = player.jumpStrength;
      player.grounded = false;
      sfx.jump();
      addSparks(player.x + player.w / 2, player.y + player.h, '#00f0ff', 4);
    }

    // Gravity
    player.vy += 0.35;
    if (player.vy > 8.5) player.vy = 8.5;

    // Apply Velocity X
    player.x += player.vx;

    // Follow the explorer without an artificial right edge.
    player.x = Math.max(cameraX, player.x);
    cameraX = Math.max(cameraX, player.x - W * .38);
    furthestX = Math.max(furthestX, player.x);
    distance = Math.floor((furthestX - 45) / 10);
    if (distance >= nextMilestone) {
      score += 100;
      addFloatingText(`${nextMilestone}m! +100`, player.x, player.y - 15, '#00f0ff');
      nextMilestone += 100;
      if (score > highScore) {
        highScore = score;
        try { localStorage.setItem('void_explorer_hi', highScore); } catch (_) {}
      }
    }
    extendWorld();

    // Apply Velocity Y & Reset Grounded
    player.y += player.vy;
    player.grounded = false;

    // Platform collisions
    for (const plat of platforms) {
      // Landing on top of platform
      if (
        player.x + player.w - 3 > plat.x &&
        player.x + 3 < plat.x + plat.w &&
        player.y + player.h >= plat.y &&
        player.y + player.h <= plat.y + 12 &&
        player.vy >= 0
      ) {
        player.y = plat.y - player.h;
        player.vy = 0;
        player.grounded = true;
        if (plat.type !== 'floating' && player.x >= plat.x + 8) {
          checkpoint = { x: plat.x + 12, y: plat.y - player.h };
        }
      }
    }

    // Bottom of screen safety (respawn with loss of 1 life)
    if (player.y > H + 20) {
      takeDamage();
      player.x = checkpoint.x;
      player.y = checkpoint.y;
      cameraX = Math.max(0, player.x - W * .38);
      player.vx = 0;
      player.vy = 0;
    }

    // Spike / Hazard collision
    for (const h of hazards) {
      if (
        player.x + player.w > h.x &&
        player.x < h.x + h.w &&
        player.y + player.h > h.y + 2 &&
        player.y < h.y + h.h
      ) {
        takeDamage(player.x < h.x + h.w / 2 ? -1 : 1);
        player.vy = -6; // bounce off spikes
      }
    }

    // Coin Pickup
    for (const c of coins) {
      if (!c.collected) {
        const cx = c.x + c.w / 2;
        const cy = c.y + c.h / 2;
        const px = player.x + player.w / 2;
        const py = player.y + player.h / 2;
        const dist = Math.hypot(px - cx, py - cy);

        if (dist < 18) {
          c.collected = true;
          score += 35;
          sfx.coin();
          addSparks(cx, cy, '#ffcc00', 10);
          addFloatingText('+35', cx - 10, cy - 8, '#ffcc00');
          if (score > highScore) {
            highScore = score;
            try { localStorage.setItem('void_explorer_hi', highScore); } catch (_) {}
          }
        }
      }
    }

    // Update Enemies
    for (const en of enemies) {
      if (!en.alive) continue;

      en.x += en.vx;
      if (en.x <= en.minX || en.x + en.w >= en.maxX) {
        en.vx *= -1;
      }
      en.anim = (en.anim + 0.1) % (Math.PI * 2);

      // Collision with player
      if (
        player.x + player.w > en.x &&
        player.x < en.x + en.w &&
        player.y + player.h > en.y &&
        player.y < en.y + en.h
      ) {
        // Did player stomp the enemy from above?
        if (player.vy > 0 && (player.y + player.h - player.vy) <= en.y + 8) {
          // Stomp victory!
          en.alive = false;
          player.vy = -5.5; // bounce up
          score += 100;
          sfx.stomp();
          addSparks(en.x + en.w / 2, en.y + en.h / 2, en.type === 'blue_alien' ? '#00f0ff' : '#ff5533', 14);
          addFloatingText('+100', en.x, en.y - 10, '#00f0ff');
          if (score > highScore) {
            highScore = score;
            try { localStorage.setItem('void_explorer_hi', highScore); } catch (_) {}
          }
        } else {
          // Player hit by enemy
          takeDamage(player.x < en.x ? -1 : 1);
        }
      }
    }

    // Update Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08;
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }

    // Update Floating Text
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const ft = floatingTexts[i];
      ft.y += ft.vy;
      ft.life--;
      ft.alpha = ft.life / 40;
      if (ft.life <= 0) floatingTexts.splice(i, 1);
    }
  }

  // --- Rendering Pipeline ---
  function render() {
    // Clear canvas
    ctx.fillStyle = '#060710';
    ctx.fillRect(0, 0, W, H);

    // Render twinkling stars
    for (const s of stars) {
      ctx.fillStyle = s.color;
      ctx.globalAlpha = s.alpha * (0.6 + Math.sin(frameCount * 0.05 + s.x) * 0.4);
      ctx.fillRect(Math.floor(((s.x - cameraX * s.speed * .3) % W + W) % W), Math.floor(s.y), s.size, s.size);
    }
    ctx.globalAlpha = 1.0;

    // Background 404 watermark text (as seen in the mockup screenshot!)
    ctx.save();
    ctx.textAlign = 'center';
    // "404"
    ctx.font = 'bold 36px "Press Start 2P", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('404', 380, 115);

    // "THE PAGE IS GONE. / NAVIGATE THE VOID!"
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('THE PAGE IS GONE.', 380, 138);
    ctx.fillText('NAVIGATE THE VOID!', 380, 152);
    ctx.restore();

    ctx.save();
    ctx.translate(-Math.floor(cameraX), 0);

    // Render Platforms (Pixel art rocky lunar blocks)
    renderPlatforms();

    // Render Hazards
    renderHazards();

    // Render Coins
    renderCoins();

    // Render Enemies
    renderEnemies();

    // Render Player (Astronaut)
    renderPlayer();

    // Render Particles
    for (const p of particles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1.0;

    // Render Floating Text
    for (const ft of floatingTexts) {
      ctx.save();
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillStyle = ft.color;
      ctx.globalAlpha = ft.alpha;
      ctx.fillText(ft.text, Math.floor(ft.x), Math.floor(ft.y));
      ctx.restore();
    }

    ctx.restore();

    // Render HUD (Hearts on top-left, Scores on top-right)
    renderHUD();

    // Render Overlay States (Paused / Game Over)
    if (gameState === 'paused') {
      ctx.fillStyle = 'rgba(6, 8, 18, 0.75)';
      ctx.fillRect(0, 0, W, H);
      ctx.font = '14px "Press Start 2P", monospace';
      ctx.fillStyle = '#00f0ff';
      ctx.textAlign = 'center';
      ctx.fillText('GAME PAUSED', W / 2, H / 2 - 8);
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('PRESS P OR TAP TO RESUME', W / 2, H / 2 + 16);
    } else if (gameState === 'over') {
      ctx.fillStyle = 'rgba(6, 8, 18, 0.88)';
      ctx.fillRect(0, 0, W, H);

      ctx.textAlign = 'center';
      ctx.font = '16px "Press Start 2P", monospace';
      ctx.fillStyle = '#ff2a85';
      ctx.shadowColor = '#ff2a85';
      ctx.shadowBlur = 12;
      ctx.fillText('SIGNAL LOST', W / 2, H / 2 - 28);
      ctx.shadowBlur = 0;

      ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillStyle = '#8e95b3';
      ctx.fillText(`SCORE: ${score} / DISTANCE: ${distance}m`, W / 2, H / 2 + 2);
      ctx.fillText(`HIGH SCORE: ${highScore}`, W / 2, H / 2 + 18);

      ctx.font = '9px "Press Start 2P", monospace';
      ctx.fillStyle = '#00f0ff';
      const blink = Math.floor(frameCount / 25) % 2 === 0;
      if (blink) {
        ctx.fillText('PRESS SPACE OR TAP TO RETRY', W / 2, H / 2 + 48);
      }
    }
  }

  // --- Pixel Art Drawing Functions ---

  function renderPlatforms() {
    for (const plat of platforms) {
      // Main rock fill
      ctx.fillStyle = '#1e2238';
      ctx.fillRect(plat.x, plat.y, plat.w, plat.h);

      // Top rocky surface highlight (lunar slate)
      ctx.fillStyle = '#394168';
      ctx.fillRect(plat.x, plat.y, plat.w, 4);

      // Secondary highlight line
      ctx.fillStyle = '#556094';
      ctx.fillRect(plat.x + 2, plat.y, plat.w - 4, 2);

      // Cobblestone / rocky pixel block pattern
      ctx.fillStyle = '#141728';
      const blockSize = 14;
      for (let py = plat.y + 6; py < plat.y + plat.h; py += blockSize) {
        const rowShift = (Math.floor(py / blockSize) % 2) * 7;
        for (let px = plat.x + rowShift; px < plat.x + plat.w; px += blockSize) {
          if (px + blockSize <= plat.x + plat.w + 6) {
            // Draw stone block outline and crevice
            ctx.fillRect(px, py, blockSize - 2, blockSize - 2);
            // Block interior highlight
            ctx.fillStyle = '#282d4a';
            ctx.fillRect(px + 2, py + 2, 4, 3);
            ctx.fillStyle = '#141728';
          }
        }
      }

      // Edge shadow
      ctx.fillStyle = '#0f1120';
      ctx.fillRect(plat.x, plat.y + plat.h - 3, plat.w, 3);
    }
  }

  function renderHazards() {
    for (const h of hazards) {
      // Draw orange jagged spikes / void anomaly
      const spikesCount = Math.floor(h.w / 8);
      for (let i = 0; i < spikesCount; i++) {
        const sx = h.x + i * 8;
        const sy = h.y + h.h;

        // Base glow
        ctx.fillStyle = '#ff7700';
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + 4, h.y + (i % 2 === 0 ? 0 : 2));
        ctx.lineTo(sx + 8, sy);
        ctx.closePath();
        ctx.fill();

        // Hot tip
        ctx.fillStyle = '#ffee44';
        ctx.fillRect(sx + 3, h.y + (i % 2 === 0 ? 1 : 3), 2, 3);
      }
    }
  }

  function renderCoins() {
    const pulse = Math.sin(frameCount * 0.08) * 2;
    for (const c of coins) {
      if (c.collected) continue;
      const cx = c.x + c.w / 2;
      const cy = c.y + c.h / 2 + pulse;

      // Glow behind coin
      ctx.save();
      const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 14);
      glow.addColorStop(0, 'rgba(255, 204, 0, 0.45)');
      glow.addColorStop(1, 'rgba(255, 204, 0, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Coin base: deep gold
      ctx.fillStyle = '#d49b00';
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();

      // Inner shiny gold
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath();
      ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Specular shine glint
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - 2, cy - 3, 2, 2);
      ctx.fillRect(cx - 3, cy - 1, 1, 1);
    }
  }

  function renderEnemies() {
    for (const en of enemies) {
      if (!en.alive) continue;
      const ex = Math.floor(en.x);
      const ey = Math.floor(en.y);
      const bounce = Math.sin(en.anim * 2) * 1.5;

      if (en.type === 'blue_alien') {
        // --- Cute Blue/Purple Spiky Alien (Matches Left Monster in Mockup) ---
        // Spikes/horns around body
        ctx.fillStyle = '#00d4ff';
        // Top spikes
        ctx.fillRect(ex + 4, ey - 2 + bounce, 2, 3);
        ctx.fillRect(ex + 12, ey - 2 + bounce, 2, 3);
        // Side spikes
        ctx.fillRect(ex - 2, ey + 6 + bounce, 3, 2);
        ctx.fillRect(ex + 17, ey + 6 + bounce, 3, 2);

        // Main body (blue/cyan)
        ctx.fillStyle = '#2260ff';
        ctx.fillRect(ex + 2, ey + 2 + bounce, 14, 12);
        ctx.fillStyle = '#00d4ff';
        ctx.fillRect(ex + 3, ey + 3 + bounce, 12, 10);

        // Face: Big expressive cyclops eye or two cute eyes
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(ex + 4, ey + 5 + bounce, 4, 4);
        ctx.fillRect(ex + 10, ey + 5 + bounce, 4, 4);

        // Pupils looking toward movement direction
        ctx.fillStyle = '#0a0d25';
        const pupOff = en.vx > 0 ? 2 : 0;
        ctx.fillRect(ex + 5 + pupOff, ey + 6 + bounce, 2, 2);
        ctx.fillRect(ex + 11 + pupOff, ey + 6 + bounce, 2, 2);

        // Little walking tentacles / feet
        ctx.fillStyle = '#2260ff';
        const footWiggle = Math.sin(en.anim * 4) * 2;
        ctx.fillRect(ex + 3, ey + 14, 3, 3 + footWiggle);
        ctx.fillRect(ex + 12, ey + 14, 3, 3 - footWiggle);

      } else if (en.type === 'orange_alien') {
        // --- Cute Orange/Red Horned Monster (Matches Lower Monster in Mockup) ---
        // Horns
        ctx.fillStyle = '#ff2a85';
        ctx.fillRect(ex + 3, ey - 2 + bounce, 3, 4);
        ctx.fillRect(ex + 12, ey - 2 + bounce, 3, 4);

        // Round body
        ctx.fillStyle = '#e63900';
        ctx.fillRect(ex + 1, ey + 2 + bounce, 16, 12);
        ctx.fillStyle = '#ff6622';
        ctx.fillRect(ex + 2, ey + 3 + bounce, 14, 10);

        // Eyes
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(ex + 4, ey + 5 + bounce, 4, 4);
        ctx.fillRect(ex + 10, ey + 5 + bounce, 4, 4);

        // Pupils
        ctx.fillStyle = '#240000';
        const pupOff = en.vx > 0 ? 2 : 0;
        ctx.fillRect(ex + 5 + pupOff, ey + 6 + bounce, 2, 2);
        ctx.fillRect(ex + 11 + pupOff, ey + 6 + bounce, 2, 2);

        // Smiling mouth
        ctx.fillStyle = '#240000';
        ctx.fillRect(ex + 7, ey + 10 + bounce, 4, 1);

        // Feet
        ctx.fillStyle = '#ff2a85';
        const footWiggle = Math.cos(en.anim * 4) * 2;
        ctx.fillRect(ex + 3, ey + 14, 4, 3 + footWiggle);
        ctx.fillRect(ex + 11, ey + 14, 4, 3 - footWiggle);
      }
    }
  }

  function renderPlayer() {
    // Invulnerability flashing effect
    if (invulnerableTimer > 0 && Math.floor(invulnerableTimer / 4) % 2 === 0) {
      return; // Skip rendering frame to create blink
    }

    const px = Math.floor(player.x);
    const py = Math.floor(player.y);
    const facingRight = player.facing === 'right';

    ctx.save();

    // 1. Oxygen Backpack (Red/Pink tank on back)
    ctx.fillStyle = '#ff2a85';
    if (facingRight) {
      ctx.fillRect(px - 1, py + 8, 3, 10);
    } else {
      ctx.fillRect(px + player.w - 2, py + 8, 3, 10);
    }

    // Thruster smoke particles if in air jumping
    if (!player.grounded && player.vy < 0) {
      ctx.fillStyle = '#00f0ff';
      const thrusterX = facingRight ? px : px + player.w - 1;
      ctx.fillRect(thrusterX, py + 18, 2, 3);
    }

    // 2. Spacesuit Torso & Arms (White & Light Grey)
    ctx.fillStyle = '#dfe6f0';
    ctx.fillRect(px + 3, py + 8, 12, 9);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px + 4, py + 8, 10, 8);

    // Suit belt & chest monitor
    ctx.fillStyle = '#1a2035';
    ctx.fillRect(px + 4, py + 14, 10, 2);
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(px + 6, py + 10, 2, 2);
    ctx.fillStyle = '#ff2a85';
    ctx.fillRect(px + 10, py + 10, 2, 2);

    // 3. Helmet (Chibi rounded dome)
    ctx.fillStyle = '#c5d0e0';
    ctx.fillRect(px + 2, py, 14, 9);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px + 3, py + 1, 12, 7);

    // Helmet top antenna
    ctx.fillStyle = '#ff2a85';
    ctx.fillRect(px + 8, py - 3, 2, 3);
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(px + 7, py - 5, 4, 2);

    // 4. Cyan Glass Visor
    ctx.fillStyle = '#0090b8';
    if (facingRight) {
      ctx.fillRect(px + 6, py + 2, 8, 5);
      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(px + 7, py + 2, 7, 4);
      // Glint shine
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px + 8, py + 3, 3, 1);
      ctx.fillRect(px + 7, py + 4, 1, 1);
    } else {
      ctx.fillRect(px + 4, py + 2, 8, 5);
      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(px + 4, py + 2, 7, 4);
      // Glint shine
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px + 5, py + 3, 3, 1);
      ctx.fillRect(px + 8, py + 4, 1, 1);
    }

    // 5. Legs / Boots (Animated walk cycle)
    ctx.fillStyle = '#8e9bb0';
    if (!player.grounded) {
      // In-air tucked legs
      ctx.fillRect(px + 3, py + 17, 4, 4);
      ctx.fillRect(px + 11, py + 17, 4, 4);
      ctx.fillStyle = '#ff2a85';
      ctx.fillRect(px + 3, py + 20, 5, 3);
      ctx.fillRect(px + 10, py + 20, 5, 3);
    } else if (Math.abs(player.vx) > 0.3) {
      // Running animation frames
      const frame = player.animFrame;
      if (frame === 0 || frame === 2) {
        ctx.fillRect(px + 4, py + 17, 4, 4);
        ctx.fillRect(px + 10, py + 17, 4, 4);
        ctx.fillStyle = '#ff2a85';
        ctx.fillRect(px + 3, py + 21, 5, 3);
        ctx.fillRect(px + 10, py + 21, 5, 3);
      } else if (frame === 1) {
        ctx.fillRect(px + 2, py + 16, 4, 5);
        ctx.fillRect(px + 12, py + 18, 4, 3);
        ctx.fillStyle = '#ff2a85';
        ctx.fillRect(px + 1, py + 21, 5, 3);
        ctx.fillRect(px + 12, py + 20, 5, 3);
      } else {
        ctx.fillRect(px + 12, py + 16, 4, 5);
        ctx.fillRect(px + 2, py + 18, 4, 3);
        ctx.fillStyle = '#ff2a85';
        ctx.fillRect(px + 11, py + 21, 5, 3);
        ctx.fillRect(px + 2, py + 20, 5, 3);
      }
    } else {
      // Idle standing
      ctx.fillRect(px + 4, py + 17, 4, 4);
      ctx.fillRect(px + 10, py + 17, 4, 4);
      ctx.fillStyle = '#ff2a85';
      ctx.fillRect(px + 3, py + 21, 5, 3);
      ctx.fillRect(px + 10, py + 21, 5, 3);
    }

    ctx.restore();
  }

  function renderHUD() {
    // 1. Pixel Hearts (Top-Left)
    const heartX = 14;
    const heartY = 14;
    for (let i = 0; i < maxLives; i++) {
      const hx = heartX + i * 16;
      drawPixelHeart(hx, heartY, i < lives);
    }

    // 2. Score & High Score (Top-Right, matching screenshot exactly)
    ctx.save();
    ctx.textAlign = 'right';
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`Score: ${score}`, W - 14, 20);

    ctx.font = '7px "Press Start 2P", monospace';
    ctx.fillStyle = '#a2aac8';
    ctx.fillText(`High Score: ${highScore}`, W - 14, 33);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#00f0ff';
    ctx.fillText(`${distance}m  >  KEEP EXPLORING`, 14, 42);
    ctx.restore();
  }

  function drawPixelHeart(x, y, filled) {
    ctx.save();
    // 8x7 pixel heart
    const color = filled ? '#ff2a85' : '#222538';
    const darkEdge = filled ? '#a00045' : '#141624';

    ctx.fillStyle = color;
    // Row 1
    ctx.fillRect(x + 1, y, 2, 2);
    ctx.fillRect(x + 5, y, 2, 2);
    // Row 2
    ctx.fillRect(x, y + 2, 8, 2);
    // Row 3
    ctx.fillRect(x + 1, y + 4, 6, 2);
    // Row 4
    ctx.fillRect(x + 2, y + 6, 4, 1);
    // Row 5
    ctx.fillRect(x + 3, y + 7, 2, 1);

    if (filled) {
      // Specular glint
      ctx.fillStyle = '#ff9ec6';
      ctx.fillRect(x + 1, y + 1, 1, 1);
    } else {
      ctx.fillStyle = darkEdge;
      ctx.fillRect(x + 2, y + 2, 4, 3);
    }
    ctx.restore();
  }

  // --- Main Animation Loop ---
  let lastTime = null;
  let accumulator = 0;
  function loop(time) {
    if (lastTime === null) lastTime = time;
    accumulator += Math.min(time - lastTime, 100);
    lastTime = time;
    while (accumulator >= 1000 / 60) {
      update();
      accumulator -= 1000 / 60;
    }
    render();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
