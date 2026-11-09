// Title-only raster, exported from the editable, hand-traced layers beside it.
// References and comparison underlays are never imported into the application.
import titleUrl from './assets/title/title.png';

// Start the one local asset request when the module loads, not during drawing.
const titleImage = new Image();
titleImage.src = titleUrl;
const titleReady = titleImage.decode().then(() => true, () => false);

export function drawTitleIllustration(canvas) {
  canvas.width = 1540;
  canvas.height = 968;
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = false;
  context.fillStyle = '#7623b0';
  context.fillRect(0, 0, canvas.width, canvas.height);
  const paint = () => context.drawImage(titleImage, 0, 0);
  if (titleImage.complete && titleImage.naturalWidth) {
    paint();
  } else {
    titleReady.then(loaded => {
      if (loaded) paint();
      else canvas.setAttribute('aria-label', 'Mario Teaches Typing. Title artwork unavailable.');
    });
  }
}
