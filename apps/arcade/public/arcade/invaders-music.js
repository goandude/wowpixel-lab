(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const audio = $('background-music'), strip = $('lyric-strip'), viewport = $('lyric-window');
  const lyrics = `[Verse 1]
Green pixels glowing in the dark
Descending slowly, row by row
They’re marching downwards to the spark
Nowhere to hide, nowhere to go
The bunker's cracking at the seam
Another shot into the night
Caught up inside an arcade dream
We're firing lasers in the light

[Chorus]
They keep marching from the skies
Invaders right before our eyes
Ah, ah, ah, ah
Invaders right before our eyes
Invaders right before our eyes

[Verse 2]
Moving faster, side to side
That frantic bleeping in my chest
Nowhere left for man to hide
The rocketship puts us to test
I gotta clear the screen tonight
I gotta clear the screen tonight
I'm-a shoot 'em out of sight
Shoot 'em down, shoot 'em down, I got...

[Bridge]
Pew, pew, into the void
Another wave, another line destroyed
Speeding up the tempo now
We're gonna beat the high score, somehow

[Outro]
Invaders right before our eyes
(Ah, ah, ah, ah)`;
  const cues = [{"start": 15.24, "end": 20.2, "text": "Green pixels glowing in the dark"}, {"start": 20.2, "end": 23.84, "text": "Descending slowly, row by row"}, {"start": 23.84, "end": 27.86, "text": "They’re marching downwards to the spark"}, {"start": 27.86, "end": 31.9, "text": "Nowhere to hide, nowhere to go"}, {"start": 31.9, "end": 35.66, "text": "The bunker's cracking at the seam"}, {"start": 35.66, "end": 39.8, "text": "Another shot into the night"}, {"start": 39.8, "end": 43.72, "text": "Caught up inside an arcade dream"}, {"start": 43.72, "end": 48.7, "text": "We're firing lasers in the light"}, {"start": 49.33, "end": 53.38, "text": "They keep marching from the skies"}, {"start": 56.86, "end": 61.46, "text": "Invaders right before our eyes"}, {"start": 72.54, "end": 77.1, "text": "Invaders right before our eyes"}, {"start": 88.08, "end": 92.72, "text": "Invaders right before our eyes"}];
  strip.textContent = '♪ INSTRUMENTAL INTRO ♪';
  let activeCue = -2;
  $('lyric-transcript').textContent = lyrics;
  let playing = false, enabled = true, visible = true, frame = null;
  audio.volume = .4;
  try {
    const saved = localStorage.getItem('invaders-music-volume');
    if (saved !== null && Number.isFinite(Number(saved))) audio.volume = Math.max(0, Math.min(1, Number(saved)));
  } catch (_) {}
  $('music-volume').value = Math.round(audio.volume * 100);
  function status() {
    $('music-status').textContent = !playing ? 'SOUNDTRACK PAUSED' : !enabled || audio.volume === 0 ? 'SOUNDTRACK MUTED' : 'NOW PLAYING · ORIGINAL SOUNDTRACK';
  }
  // Vocal line boundaries measured from this MP3, using its playback clock.
  function draw() {
    const t = audio.currentTime;
    const index = cues.findIndex(cue => t >= cue.start && t < cue.end);
    if (index !== activeCue) {
      activeCue = index;
      strip.textContent = index >= 0 ? cues[index].text : t < cues[0].start ? '♪ INSTRUMENTAL INTRO ♪' : t >= cues[cues.length - 1].end ? '♪ INSTRUMENTAL OUTRO ♪' : '♪ MUSICAL BREAK ♪';
    }
    const distance = Math.max(0, strip.scrollWidth - viewport.clientWidth + 24);
    const cue = cues[index];
    const progress = cue ? Math.max(0, Math.min(1, (t - cue.start - .25) / Math.max(.1, cue.end - cue.start - .5))) : 0;
    strip.style.transform = `translateX(${-progress * distance}px)`;
    frame = playing && visible ? requestAnimationFrame(draw) : null;
  }
  function startFrames() { if (frame === null) draw(); }
  function sync() {
    audio.muted = !enabled;
    if (playing) {
      audio.play().then(() => { if (!playing) audio.pause(); else status(); }).catch(() => {
        if (playing) $('music-status').textContent = 'MUSIC UNAVAILABLE — CHECK AUDIO FILE OR RESUME PLAY';
      });
      startFrames();
    } else {
      audio.pause();
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    }
    status();
  }
  window.addEventListener('invaders-music', e => {
    playing = e.detail.playing;
    if (typeof e.detail.enabled === 'boolean') enabled = e.detail.enabled;
    if (e.detail.restart) { audio.currentTime = 0; activeCue = -2; strip.style.transform = 'translateX(0)'; }
    sync();
  });
  window.addEventListener('invaders-sound', e => { enabled = e.detail.enabled; sync(); });
  $('music-volume').addEventListener('input', e => {
    audio.volume = Number(e.target.value) / 100;
    try { localStorage.setItem('invaders-music-volume', String(audio.volume)); } catch (_) {}
    status();
  });
  $('lyrics-toggle').addEventListener('click', () => {
    visible = !visible; viewport.hidden = !visible;
    $('lyrics-toggle').textContent = visible ? 'LYRICS ON' : 'LYRICS OFF';
    $('lyrics-toggle').setAttribute('aria-pressed', String(visible));
    if (visible) startFrames();
    else { if (frame !== null) cancelAnimationFrame(frame); frame = null; }
  });
  audio.addEventListener('seeked', () => { if (frame === null) draw(); });
  audio.addEventListener('loadedmetadata', () => { if (frame === null) draw(); });
  audio.addEventListener('error', () => { $('music-status').textContent = 'MUSIC FILE COULD NOT BE LOADED'; });
})();
