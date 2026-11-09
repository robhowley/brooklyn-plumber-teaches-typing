import titleUrl from './assets/title/title.png';
import titleBaseUrl from './assets/title/title-base.png';
import layout from './assets/title/title-layout.json';
import timing from './assets/title/timing.json';

const canvasWidth = layout.width;
const canvasHeight = layout.height;
const letterFadeMs = 120;
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const jobs = new WeakMap();

function decodeImage(url) {
  const image = new Image();
  image.src = url;
  return image.decode().then(() => image, () => image.complete && image.naturalWidth ? image : null);
}

// Start both local image requests when this module loads, not during drawing.
const titleReady = decodeImage(titleUrl);
const titleBaseReady = decodeImage(titleBaseUrl);

function stop(canvas, job) {
  job.cancelled = true;
  if (job.frame) cancelAnimationFrame(job.frame);
  motionPreference.removeEventListener?.('change', job.onMotionChange);
  if (jobs.get(canvas) === job) jobs.delete(canvas);
}

function draw(context, image) {
  context.globalAlpha = 1;
  context.clearRect(0, 0, canvasWidth, canvasHeight);
  context.drawImage(image, 0, 0, canvasWidth, canvasHeight);
}

export function drawTitleIllustration(canvas) {
  const previous = jobs.get(canvas);
  if (previous) stop(canvas, previous);
  if (!canvas.isConnected) return;

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.imageSmoothingEnabled = false;
  context.fillStyle = '#8018b5';
  context.fillRect(0, 0, canvasWidth, canvasHeight);

  const job = { cancelled: false, frame: 0, onMotionChange: null };
  jobs.set(canvas, job);
  const current = () => !job.cancelled && jobs.get(canvas) === job;
  const paint = image => {
    if (!current() || !canvas.isConnected) return false;
    draw(context, image);
    return true;
  };
  const unavailable = () => {
    if (!current() || !canvas.isConnected) return;
    canvas.setAttribute('aria-label', 'Title artwork unavailable. Menu controls remain available.');
    stop(canvas, job);
  };

  titleBaseReady.then(base => {
    if (!current() || !canvas.isConnected) {
      stop(canvas, job);
      return;
    }
    if (!base) {
      titleReady.then(title => {
        if (title) paint(title);
        else unavailable();
        stop(canvas, job);
      });
      return;
    }
    paint(base);
    titleReady.then(title => {
      if (!current() || !canvas.isConnected) {
        stop(canvas, job);
        return;
      }
      if (!title) {
        unavailable();
        return;
      }
      if (motionPreference.matches) {
        paint(title);
        stop(canvas, job);
        return;
      }

      const initialDelayMs = timing.implementation.recommendedInitialDelayMs;
      const lastLetterStartMs = Math.max(...timing.letters.map(letter => letter.startMs));
      const revealMs = lastLetterStartMs + letterFadeMs;
      const startedAt = performance.now();
      job.onMotionChange = event => {
        if (event.matches && paint(title)) stop(canvas, job);
      };
      motionPreference.addEventListener?.('change', job.onMotionChange);

      const animate = now => {
        if (!current() || !canvas.isConnected) {
          stop(canvas, job);
          return;
        }
        const elapsed = now - startedAt - initialDelayMs;
        if (elapsed < 0) {
          job.frame = requestAnimationFrame(animate);
          return;
        }
        if (elapsed >= revealMs) {
          paint(title);
          stop(canvas, job);
          return;
        }

        draw(context, base);
        for (const letter of timing.letters) {
          const progress = (elapsed - letter.startMs) / letterFadeMs;
          if (progress <= 0) continue;
          const glyph = layout.glyphs[letter.index - 1];
          const { x, y, width, height } = glyph.rect;
          context.globalAlpha = Math.min(progress, 1);
          context.drawImage(title, x, y, width, height, x, y, width, height);
        }
        context.globalAlpha = 1;
        job.frame = requestAnimationFrame(animate);
      };
      job.frame = requestAnimationFrame(animate);
    });
  });
}
