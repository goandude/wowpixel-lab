// Embed mode helper. Loaded by every game page but does nothing unless the
// page was opened with ?embed=1, which the inline <head> script turns into
// class="embed" on <html>.
(() => {
  'use strict';
  if (!document.documentElement.classList.contains('embed')) return;

  // Any link that survives into embed mode must escape the frame, or it
  // would load the arcade inside the host's 404 page.
  for (const a of document.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href');
    if (href && !href.startsWith('#')) a.target = '_top';
  }

  // Opt-in link back to the arcade (?embed=1&credit=1). Off by default: an
  // embed sits on someone else's error page, so it should not plant an
  // outbound link there unless they asked for one. It would also overlap
  // the pause button in the corner of several games.
  if (new URLSearchParams(location.search).has('credit')) {
    const mark = document.createElement('a');
    mark.className = 'embed-mark';
    mark.target = '_top';
    mark.rel = 'noopener';
    mark.href = new URL('arcade.html', location.href).href;
    mark.textContent = 'More games ↗';
    document.body.appendChild(mark);
  }

  // Keyboard input only reaches the game once the frame itself has focus.
  // Focusing on load helps where the browser allows it; the click handler
  // covers the normal case where the visitor clicks into the game first.
  const canvas = document.querySelector('canvas');
  if (!canvas) return;

  const grab = () => { try { canvas.focus({ preventScroll: true }); } catch (_) {} };
  grab();
  window.addEventListener('pointerdown', grab);
  window.addEventListener('focus', grab);
})();
