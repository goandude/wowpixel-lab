(() => {
  'use strict';
  const $ = id => document.getElementById(id), kind = document.body.dataset.game;
  const canvas = $('game'), ctx = canvas.getContext('2d'), W = 720, H = 432;
  const keys = new Set();
  let state = 'ready', score = 0, best = 0, elapsed = 0, audio = null, sound = true;
  let last = null, accumulator = 0;
  try { best = Number(localStorage.getItem(`arcade-${kind}-best`)) || 0; sound = localStorage.getItem('arcade-sound') !== 'false'; } catch (_) {}
  function unlock() {
    if (!sound) return;
    try { const A = window.AudioContext || window.webkitAudioContext; if (!audio && A) audio = new A(); if (audio?.state === 'suspended') audio.resume().catch(() => {}); } catch (_) {}
  }
  function tone(frequency, end = frequency, duration = .12) {
    if (!sound || audio?.state !== 'running') return;
    try {
      const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime;
      o.type = 'triangle'; o.frequency.setValueAtTime(frequency, t); o.frequency.exponentialRampToValueAtTime(end, t + duration);
      g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(.07, t + .005); g.gain.exponentialRampToValueAtTime(.0001, t + duration);
      o.connect(g); g.connect(audio.destination); o.start(); o.stop(t + duration + .01);
      o.onended = () => { o.disconnect(); g.disconnect(); };
    } catch (_) {}
  }
  function soundUI() { $('sound').textContent = sound ? 'SOUND ON' : 'SOUND OFF'; $('sound').setAttribute('aria-pressed', String(sound)); }
  function hud() {
    $('score').textContent = score; $('best').textContent = best;
    $('extra').textContent = kind === 'breakout' ? `LEVEL ${level}/3 · ${lives} LIVES` : kind === 'snake' ? `LENGTH ${snake.length}` : `MAIL ${deliveries} · GAPS ${gaps}`;
  }
  function points(n) {
    score += n;
    if (score > best) { best = score; try { localStorage.setItem(`arcade-${kind}-best`, String(best)); } catch (_) {} }
    hud();
  }
  function show(title, description, button, badge) {
    $('title').textContent = title; $('description').textContent = description; $('start').textContent = button;
    $('badge').textContent = badge; $('overlay').hidden = false; $('announce').textContent = `${title} ${description}`;
  }
  function finish(won = false) {
    state = won ? 'won' : 'over'; keys.clear(); $('pause').disabled = true;
    tone(won ? 660 : 180, won ? 1100 : 55, .35);
    show(won ? 'Connection restored.' : 'Signal lost.', `You scored ${score}. ${won ? 'Every brick cleared!' : 'Your best is ' + best + '. Try another run?'}`, 'PLAY AGAIN →', won ? 'MISSION COMPLETE' : '404 / TRY AGAIN');
  }
  function start() {
    unlock(); keys.clear();
    if (state !== 'paused') { score = 0; elapsed = 0; if (kind === 'breakout') resetBreakout(); if (kind === 'flappy') resetFlappy(); if (kind === 'snake') resetSnake(); }
    state = 'playing'; $('overlay').hidden = true; $('pause').disabled = false; $('pause').textContent = 'PAUSE · P';
    canvas.focus({ preventScroll: true }); hud();
  }
  function pause() {
    if (state === 'paused') return start();
    if (state !== 'playing') return;
    state = 'paused'; keys.clear(); $('pause').textContent = 'RESUME · P';
    show('Signal on hold.', 'Take a breather. Your game will wait.', 'RESUME →', 'PAUSED');
  }
  // BREAKOUT: a swept, subdivided ball step prevents tunneling through bricks.
  let level = 1, lives = 3, paddle = 360, bricks = [], ball, docked = true;
  const digits = ['101101111001001','111101101101111','101101111001001'];
  function resetBall() { ball = { x: paddle, y: 382, vx: 0, vy: 0, r: 6 }; docked = true; }
  function buildBricks() {
    bricks = [];
    if (level === 1) {
      for (let d = 0; d < 3; d++) for (let row = 0; row < 5; row++) for (let col = 0; col < 3; col++) {
        if (digits[d][row * 3 + col] === '1') bricks.push({x: 106 + d * 178 + col * 47, y: 62 + row * 25, w: 42, h: 19, color: (row + col) % 2 ? '#64e9ef' : '#cafa78'});
      }
    } else {
      for (let row = 0; row < 6; row++) for (let col = 0; col < 12; col++) {
        if (level === 2 ? (row + col) % 3 !== 0 : Math.abs(col - 5.5) + row < 9) bricks.push({x: 57 + col * 51, y: 55 + row * 25, w: 46, h: 19, color: ['#64e9ef','#cafa78','#ff71a5'][row % 3]});
      }
    }
    resetBall();
  }
  function resetBreakout() { lives = 3; level = 1; paddle = W / 2; buildBricks(); }
  function launch() {
    if (!docked) return;
    docked = false; const speed = 290 + (level - 1) * 45; ball.vx = speed * .4; ball.vy = -speed * Math.sqrt(.84); tone(350, 600);
  }
  function breakout(dt) {
    paddle = Math.max(48, Math.min(W - 48, paddle + ((keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0)) * 480 * dt));
    if (docked) { ball.x = paddle; if (keys.has('action')) launch(); return; }
    const steps = Math.max(1, Math.ceil(Math.hypot(ball.vx, ball.vy) * dt / 4));
    for (let i = 0; i < steps; i++) {
      const oldX = ball.x, oldY = ball.y;
      ball.x += ball.vx * dt / steps; ball.y += ball.vy * dt / steps;
      if (ball.x < 6 || ball.x > W - 6) { ball.x = Math.max(6, Math.min(W - 6, ball.x)); ball.vx *= -1; tone(230); }
      if (ball.y < 6) { ball.y = 6; ball.vy = Math.abs(ball.vy); tone(230); }
      if (ball.vy > 0 && oldY + 6 <= 394 && ball.y + 6 >= 394 && Math.abs(ball.x - paddle) < 51) {
        const speed = 290 + (level - 1) * 45, angle = Math.max(-1, Math.min(1, (ball.x - paddle) / 45)) * 1.05;
        ball.vx = speed * Math.sin(angle); ball.vy = -speed * Math.cos(angle); ball.y = 388; tone(300, 450);
      }
      const index = bricks.findIndex(b => ball.x + 6 > b.x && ball.x - 6 < b.x + b.w && ball.y + 6 > b.y && ball.y - 6 < b.y + b.h);
      if (index >= 0) {
        const b = bricks.splice(index, 1)[0];
        if (oldY + 6 <= b.y || oldY - 6 >= b.y + b.h) { ball.vy *= -1; ball.y = oldY; } else { ball.vx *= -1; ball.x = oldX; }
        points(10); tone(500 + level * 80, 950);
        if (!bricks.length) {
          points(100);
          if (level === 3) finish(true); else { level++; buildBricks(); hud(); $('announce').textContent = `Level ${level}. Space to launch.`; }
          return;
        }
      }
      if (ball.y > H + 8) { lives--; tone(180, 60, .25); hud(); if (!lives) finish(); else resetBall(); return; }
    }
  }
  // FLAPPY: gaps are spaced so consecutive openings remain reachable.
  let bird, pipes = [], pipeTimer = 0, gaps = 0, deliveries = 0;
  function resetFlappy() { bird = { x: 185, y: H / 2, vy: 0 }; pipes = []; pipeTimer = 1.1; gaps = 0; deliveries = 0; }
  function flap() { bird.vy = -260; tone(420, 780, .07); }
  function flappy(dt) {
    bird.vy += 760 * dt; bird.y += bird.vy * dt;
    pipeTimer -= dt;
    const speed = Math.min(205, 135 + gaps * 2);
    if (pipeTimer <= 0) {
      const prev = pipes.length ? pipes[pipes.length - 1].gap : H / 2;
      const gap = Math.max(120, Math.min(H - 120, prev + (Math.random() - .5) * 120));
      pipes.push({ x: W + 20, gap, passed: false, collected: false }); pipeTimer = 245 / speed;
    }
    for (const p of pipes) {
      p.x -= speed * dt;
      if (!p.passed && p.x + 52 < bird.x - 10) { p.passed = true; gaps++; points(1); tone(800, 1000); }
      if (!p.collected && Math.hypot(bird.x - (p.x + 26), bird.y - p.gap) < 23) { p.collected = true; deliveries++; points(5); tone(1050, 1500); }
      if (bird.x + 10 > p.x && bird.x - 10 < p.x + 52 && (bird.y - 10 < p.gap - 77 || bird.y + 10 > p.gap + 77)) { finish(); return; }
    }
    pipes = pipes.filter(p => p.x > -70);
    if (bird.y < 10 || bird.y > H - 10) finish();
  }
  // SNAKE: queue two turns; validate against the last queued heading.
  let snake = [], food, direction, turns = [], snakeTimer = 0;
  const columns = 30, rows = 18, cell = 24;
  function placeFood() {
    const empty = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) if (!snake.some(s => s.x === x && s.y === y)) empty.push({ x, y });
    if (!empty.length) { finish(true); return; }
    food = empty[Math.floor(Math.random() * empty.length)];
  }
  function resetSnake() { snake = [{x:12,y:9},{x:11,y:9},{x:10,y:9},{x:9,y:9}]; direction = {x:1,y:0}; turns = []; snakeTimer = 0; placeFood(); }
  function steer(x, y) {
    const previous = turns.length ? turns[turns.length - 1] : direction;
    if (turns.length < 2 && (x !== previous.x || y !== previous.y) && (x !== -previous.x || y !== -previous.y)) turns.push({x,y});
  }
  function snakeStep(dt) {
    snakeTimer += dt;
    const interval = Math.max(.075, .17 - score * .0015);
    if (snakeTimer < interval) return; snakeTimer -= interval;
    if (turns.length) direction = turns.shift();
    const head = {x:snake[0].x + direction.x, y:snake[0].y + direction.y};
    const eats = head.x === food.x && head.y === food.y;
    const body = eats ? snake : snake.slice(0, -1);
    if (head.x < 0 || head.x >= columns || head.y < 0 || head.y >= rows || body.some(s => s.x === head.x && s.y === head.y)) { finish(); return; }
    snake.unshift(head);
    if (eats) { points(10); tone(650, 1000); placeFood(); } else snake.pop();
    hud();
  }
  const stars = Array.from({length:60}, () => ({x:Math.random()*W,y:Math.random()*H}));
  function draw() {
    ctx.fillStyle = '#070e19'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#77b8d044'; for (const s of stars) ctx.fillRect(s.x, s.y, 1.5, 1.5);
    if (kind === 'breakout') {
      for (const b of bricks) {
        ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.fillStyle = '#ffffff40'; ctx.fillRect(b.x+2,b.y+2,b.w-4,3);
        ctx.fillStyle = '#07162533'; ctx.fillRect(b.x,b.y+b.h-4,b.w,4);
      }
      ctx.fillStyle = '#879ead'; ctx.fillRect(paddle-45,394,90,12);
      ctx.fillStyle = '#dcecf3'; ctx.fillRect(paddle-42,394,84,3);
      ctx.fillStyle = '#64e9ef'; ctx.fillRect(paddle-28,399,56,3);
      ctx.fillStyle = '#f3ffff'; ctx.shadowColor = '#64e9ef'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(ball.x,ball.y,6,0,Math.PI*2); ctx.fill(); ctx.shadowBlur = 0;
      if (docked && state === 'playing') { ctx.textAlign='center';ctx.fillStyle='#91b7cd';ctx.font='12px monospace';ctx.fillText('SPACE / TAP TO LAUNCH',W/2,350); }
    }
    if (kind === 'flappy') window.drawCosmicCourier(ctx, bird, pipes, elapsed, W, H);
    if (kind === 'snake') {
      ctx.strokeStyle='#243f5144';ctx.lineWidth=1;
      for(let x=0;x<=W;x+=cell){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
      for(let y=0;y<=H;y+=cell){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
      if(food){ctx.fillStyle='#ffcf63';ctx.shadowColor='#ffcf63';ctx.shadowBlur=10;ctx.fillRect(food.x*cell+6,food.y*cell+6,12,12);ctx.shadowBlur=0;ctx.fillStyle='#fff2b0';ctx.fillRect(food.x*cell+9,food.y*cell+9,6,6);}
      snake.forEach((s,i)=>{ctx.fillStyle=i===0?'#64e9ef':'#cafa78';ctx.fillRect(s.x*cell+2,s.y*cell+2,20,20);if(i===0){ctx.fillStyle='#153443';ctx.fillRect(s.x*cell+7,s.y*cell+7,3,3);ctx.fillRect(s.x*cell+14,s.y*cell+7,3,3);}});
    }
  }
  const map = {arrowleft:'left',a:'left',arrowright:'right',d:'right',arrowup:'up',w:'up',arrowdown:'down',s:'down',' ':'action'};
  function action(key, repeat = false) {
    if (state !== 'playing') return;
    if (kind === 'snake') { const dirs={left:[-1,0],right:[1,0],up:[0,-1],down:[0,1]};if(dirs[key]&&!repeat)steer(...dirs[key]); }
    else if (kind === 'flappy' && (key==='action'||key==='up') && !repeat) flap();
    else keys.add(key);
  }
  window.addEventListener('keydown', e => {
    if (e.ctrlKey||e.metaKey||e.altKey||e.target.closest('button,a,input,textarea,select'))return;
    const k=e.key.toLowerCase();if(map[k]||k==='p'||k==='enter')e.preventDefault();
    if(k==='enter'&&!e.repeat&&state!=='playing')start();else if(k==='p'&&!e.repeat)pause();else if(map[k])action(map[k],e.repeat);
  });
  window.addEventListener('keyup', e => { if(map[e.key.toLowerCase()])keys.delete(map[e.key.toLowerCase()]); });
  window.addEventListener('blur', () => { keys.clear();if(state==='playing')pause(); });
  document.addEventListener('visibilitychange', () => { if(document.hidden&&state==='playing')pause(); });
  canvas.addEventListener('pointerdown', e => {
    if(state!=='playing')return;e.preventDefault();canvas.focus({preventScroll:true});
    if(kind==='flappy')flap();if(kind==='breakout'){positionPaddle(e);launch();}
  });
  function positionPaddle(e){if(kind!=='breakout'||state!=='playing')return;const r=canvas.getBoundingClientRect();paddle=Math.max(48,Math.min(W-48,(e.clientX-r.left)*W/r.width));}
  canvas.addEventListener('pointermove',positionPaddle);
  const buttons = kind==='snake' ? [['left','←'],['up','↑'],['down','↓'],['right','→']] : kind==='flappy' ? [['action','FLAP ↑']] : [['left','←'],['action','LAUNCH'],['right','→']];
  for(const [key,label]of buttons){const b=document.createElement('button');b.textContent=label;b.setAttribute('aria-label',key==='action'?label:`Move ${key}`);$('touch').appendChild(b);b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);action(key);});for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,()=>keys.delete(key));}
  $('start').addEventListener('click',start);$('pause').addEventListener('click',pause);
  $('sound').addEventListener('click',()=>{sound=!sound;try{localStorage.setItem('arcade-sound',String(sound));}catch(_){}unlock();soundUI();canvas.focus({preventScroll:true});});
  resetBreakout();resetFlappy();resetSnake();hud();soundUI();
  function update(dt){if(state!=='playing')return;elapsed+=dt;if(kind==='breakout')breakout(dt);if(kind==='flappy')flappy(dt);if(kind==='snake')snakeStep(dt);}
  function loop(now){if(last===null)last=now;accumulator+=Math.min(now-last,100);last=now;while(accumulator>=1000/120){update(1/120);accumulator-=1000/120;}draw();requestAnimationFrame(loop);}
  requestAnimationFrame(loop);
})();
