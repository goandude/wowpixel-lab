// Landing page behaviour. Everything here reads or writes the same
// localStorage keys the games themselves use, so nothing on the page is
// invented: a best score is blank until you actually set one.
(() => {
  'use strict';

  const $ = id => document.getElementById(id);

  // ---- Real best scores -------------------------------------------------
  // Keys match the games: arcade.js writes `arcade-<kind>-best`, racer.js
  // writes `coastal-best` in metres, invaders.js and game.js use their own.
  const readNumber = key => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return 0;
      const n = Number(raw);
      return Number.isFinite(n) && n > 0 ? n : 0;
    } catch (_) { return 0; }
  };

  const format = (value, unit) =>
    unit === 'm' ? `${Math.floor(value).toLocaleString()} m`
                 : `${Math.floor(value).toLocaleString()} ${unit}`;

  for (const el of document.querySelectorAll('[data-best]')) {
    const value = readNumber(el.dataset.best);
    // An em dash reads as "not set yet" rather than implying a score of zero.
    el.textContent = value > 0 ? format(value, el.dataset.unit || 'pts') : '—';
  }

  // ---- Sound preference -------------------------------------------------
  // Each game stores its own flag. The header toggle writes all of them so
  // the choice carries into whichever cabinet you open next.
  const SOUND_KEYS = ['arcade-sound', 'coastal-sound', '404-invaders-sound', 'void_explorer_sound'];
  const soundBtn = $('sound');
  const soundPath = $('sound-path');
  const ON = 'M4 9v6h4l5 4V5L8 9H4Zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4Zm-2.5 7.9a8 8 0 0 0 0-15.8v2.1a6 6 0 0 1 0 11.6v2.1Z';
  const OFF = 'M4 9v6h4l5 4V5L8 9H4Zm16.5-1.1-1.4-1.4L16 9.6 12.9 6.5l-1.4 1.4L14.6 11l-3.1 3.1 1.4 1.4L16 12.4l3.1 3.1 1.4-1.4L17.4 11l3.1-3.1Z';

  let soundOn = true;
  try { soundOn = localStorage.getItem('arcade-sound') !== 'false'; } catch (_) {}

  function paintSound() {
    soundBtn.setAttribute('aria-pressed', String(soundOn));
    soundBtn.setAttribute('aria-label', soundOn ? 'Sound effects on' : 'Sound effects off');
    soundPath.setAttribute('d', soundOn ? ON : OFF);
  }

  soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    for (const key of SOUND_KEYS) {
      try { localStorage.setItem(key, String(soundOn)); } catch (_) {}
    }
    paintSound();
  });
  paintSound();

  // ---- Quick play -------------------------------------------------------
  const GAMES = [
    { title: 'Coastal Cruise', href: 'racer.html' },
    { title: '404 Invaders', href: 'invaders.html' },
    { title: 'The Void Explorer', href: 'void-explorer.html' },
    { title: 'BreakOut of Cache', href: 'breakout.html' },
    { title: 'Flappy Byte', href: 'flappy.html' }
  ];

  const quick = $('quick-play');
  const quickLabel = $('quick-play-label');
  quick.addEventListener('click', () => {
    const pick = GAMES[Math.floor(Math.random() * GAMES.length)];
    quick.disabled = true;
    quickLabel.textContent = `Launching ${pick.title}…`;
    quick.querySelector('svg')?.classList.add('spin');
    // Brief pause so the chosen game registers before the page changes.
    setTimeout(() => { window.location.href = pick.href; }, 450);
  });

  // ---- Embed snippet generator ------------------------------------------
  // The snippet points at wherever this page is actually served from, so a
  // fork or a self-hosted copy produces a snippet for its own origin rather
  // than hard-coding the original one.
  const gameSel = $('embed-game');
  const widthSel = $('embed-width');
  const codeEl = $('embed-code');
  const copyBtn = $('embed-copy');

  function snippet() {
    const opt = gameSel.options[gameSel.selectedIndex];
    const url = new URL(opt.value + '?embed=1', location.href).href;
    const width = widthSel.value;
    const title = opt.dataset.title;
    return `<iframe src="${url}"\n        title="${title}"\n        style="width:${width};aspect-ratio:${opt.dataset.ratio};border:0;display:block;margin:0 auto"\n        loading="lazy"></iframe>`;
  }

  function paintSnippet() { codeEl.textContent = snippet(); }

  gameSel.addEventListener('change', paintSnippet);
  widthSel.addEventListener('change', paintSnippet);
  paintSnippet();

  const copyLabel = $('embed-copy-label');
  let copyReset = null;
  copyBtn.addEventListener('click', async () => {
    const text = snippet();
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch (_) {
      // Clipboard API needs a secure context; fall back to a scratch
      // textarea so the button still works over plain http.
      try {
        const scratch = document.createElement('textarea');
        scratch.value = text;
        scratch.setAttribute('readonly', '');
        scratch.style.cssText = 'position:fixed;top:-1000px;opacity:0';
        document.body.appendChild(scratch);
        scratch.select();
        ok = document.execCommand('copy');
        scratch.remove();
      } catch (_) { ok = false; }
    }
    copyLabel.textContent = ok ? 'Copied' : 'Press Ctrl+C to copy';
    if (!ok) {
      const range = document.createRange();
      range.selectNodeContents(codeEl);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
    clearTimeout(copyReset);
    copyReset = setTimeout(() => { copyLabel.textContent = 'Copy snippet'; }, 2000);
  });

  // ---- Animated backdrop ------------------------------------------------
  // A retro grid-and-starfield shader. Entirely optional: if WebGL is
  // missing, the shader fails to compile, or the visitor asked for reduced
  // motion, the canvas is dropped and the CSS gradient carries the page.
  const canvas = $('backdrop');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  function giveUp() { canvas.remove(); }

  if (reduced.matches) return giveUp();

  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) return giveUp();

  const VERT = `attribute vec2 a_position;
void main(){ gl_Position = vec4(a_position, 0.0, 1.0); }`;

  const FRAG = `precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;

float hash(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main(){
  vec2 st = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.4;
  // Base tone tracks --surface in home.css so the shader and the plain
  // CSS fallback sit at the same lightness.
  vec3 color = vec3(0.102, 0.133, 0.212);

  vec2 p = st;
  p.y += 0.35;
  if (p.y < 0.0) {
    // Perspective floor grid receding toward the horizon.
    float z = 0.4 / (-p.y + 0.01);
    vec2 uv = vec2(p.x * z, z + t * 2.0);
    vec2 g = abs(fract(uv - 0.5) - 0.5);
    // fwidth needs an extension in WebGL 1, so approximate the line width
    // from depth instead: distant rows thin out on their own.
    float w = 0.02 + z * 0.004;
    float line = 1.0 - smoothstep(0.0, w, min(g.x, g.y));
    float depthFade = smoothstep(8.0, 1.5, z);
    color += vec3(0.0, 0.8, 0.95) * line * depthFade * 0.35;
    color += vec3(0.9, 0.15, 0.55) * exp(-abs(p.y) * 25.0) * (0.6 + 0.4 * sin(u_time * 2.0));
  } else {
    vec2 starUV = st * 18.0;
    vec2 id = floor(starUV);
    float rnd = hash(id);
    if (rnd > 0.94) {
      vec2 f = fract(starUV) - 0.5;
      float d = length(f);
      float twinkle = sin(u_time * 3.0 + rnd * 6.28) * 0.5 + 0.5;
      color += vec3(0.3, 0.9, 1.0) * smoothstep(0.12, 0.01, d) * twinkle * 0.8;
    }
    color += vec3(0.1, 0.05, 0.25) * exp(-length(st - vec2(0.0, 0.25)) * 2.2);
  }

  color -= sin(gl_FragCoord.y * 1.5) * 0.04;
  color *= 1.0 - length(gl_FragCoord.xy / u_resolution.xy - 0.5) * 0.45;
  gl_FragColor = vec4(color, 1.0);
}`;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  }

  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return giveUp();

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return giveUp();
  gl.useProgram(prog);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const attr = gl.getAttribLocation(prog, 'a_position');
  gl.enableVertexAttribArray(attr);
  gl.vertexAttribPointer(attr, 2, gl.FLOAT, false, 0, 0);

  const uTime = gl.getUniformLocation(prog, 'u_time');
  const uRes = gl.getUniformLocation(prog, 'u_resolution');

  // Cap the drawing buffer: this is a background, so it does not need to
  // cost a full-resolution pass on a high-DPI display.
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe(canvas);
  else window.addEventListener('resize', resize);
  resize();

  let frame = null;
  function render(now) {
    resize();
    gl.uniform1f(uTime, now * 0.001);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    frame = requestAnimationFrame(render);
  }

  // Stop drawing in a background tab rather than burning battery on a
  // backdrop nobody is looking at.
  function play() { if (frame === null) frame = requestAnimationFrame(render); }
  function stop() { if (frame !== null) { cancelAnimationFrame(frame); frame = null; } }

  document.addEventListener('visibilitychange', () => { document.hidden ? stop() : play(); });
  reduced.addEventListener?.('change', e => { if (e.matches) { stop(); giveUp(); } });
  play();
})();
