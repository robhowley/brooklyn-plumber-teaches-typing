import titleUrl from './assets/title/title.png';
import baseUrl from './assets/title/title-base.png';
import layout from './assets/title/title-layout.json';
import timing from './assets/title/timing.json';

function load(url) {
  const image = new Image();
  image.src = url;
  return image.decode().then(() => image);
}
// Local assets are requested together. A failed load must not trap the intro.
const images = Promise.all([load(baseUrl), load(titleUrl)]).catch(() => null);
const jobs = new WeakMap();
const fadeMs = 120;

export function drawTitleIllustration(canvas, { onComplete = () => {} } = {}) {
  jobs.get(canvas)?.();
  canvas.width = layout.width;
  canvas.height = layout.height;
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = false;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let stopped = false, frame = 0, hold = 0, title;
  const observer = new MutationObserver(() => { if (!canvas.isConnected) stop(); });
  function stop() {
    stopped = true;
    cancelAnimationFrame(frame);
    clearTimeout(hold);
    observer.disconnect();
    motion.removeEventListener('change', motionChanged);
    if (jobs.get(canvas) === stop) jobs.delete(canvas);
  }
  function paint(image) {
    context.globalAlpha = 1;
    context.drawImage(image, 0, 0);
  }
  function complete() {
    cancelAnimationFrame(frame);
    paint(title); // The completed canvas is the exact source image, not assembled crops.
    canvas.dataset.phase = 'complete';
    motion.removeEventListener('change', motionChanged);
    hold = setTimeout(() => {
      const connected = canvas.isConnected;
      stop();
      if (connected) onComplete();
    }, 800);
  }
  function motionChanged(event) { if (event.matches && title) complete(); }
  jobs.set(canvas, stop);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  images.then(loaded => {
    if (stopped || !canvas.isConnected) { stop(); return; }
    if (!loaded) { stop(); onComplete(); return; }
    const [base, final] = loaded;
    title = final;
    if (motion.matches) { complete(); return; }
    paint(base);
    canvas.dataset.phase = 'base';
    motion.addEventListener('change', motionChanged);
    const started = performance.now();
    const delay = timing.implementation.recommendedInitialDelayMs;
    const end = Math.max(...timing.letters.map(letter => letter.startMs)) + fadeMs;
    function animate(now) {
      if (stopped || !canvas.isConnected) { stop(); return; }
      const elapsed = now - started - delay;
      if (elapsed >= end) { complete(); return; }
      if (elapsed >= 0) {
        paint(base);
        canvas.dataset.phase = 'revealing';
        for (const letter of timing.letters) {
          const alpha = Math.min(1, Math.max(0, (elapsed - letter.startMs) / fadeMs));
          if (!alpha) continue;
          const { x, y, width, height } = layout.glyphs[letter.index - 1].rect;
          context.globalAlpha = alpha;
          context.drawImage(title, x, y, width, height, x, y, width, height);
        }
        context.globalAlpha = 1;
      }
      frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
  });
  return stop;
}
