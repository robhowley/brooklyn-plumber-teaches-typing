// Local edited traces are loaded once, never allocated in a draw call.
// URL construction also lets the renderer's Node contract tests import this module.
const urls = {
  backdrop: new URL('./backdrop.png', import.meta.url).href,
  seabed: new URL('./seabed.png', import.meta.url).href,
  rock: new URL('./rock.png', import.meta.url).href,
  branch: new URL('./plant-branch.png', import.meta.url).href,
  tall: new URL('./plant-tall.png', import.meta.url).href,
  small: new URL('./plant-small.png', import.meta.url).href,
  fishOpen: new URL('./fish-open.png', import.meta.url).href,
  fishHalf: new URL('./fish-half.png', import.meta.url).href,
  fishClosed: new URL('./fish-closed.png', import.meta.url).href,
  squidCurled: new URL('./squid-curled.png', import.meta.url).href,
  squidDown: new URL('./squid-down.png', import.meta.url).href,
  squidSpread: new URL('./squid-spread.png', import.meta.url).href,
};
export const underwaterImages = {};
export const underwaterAssetsReady = Promise.all(Object.entries(urls).map(([name, url]) => {
  const image = typeof Image === 'undefined' ? null : new Image();
  underwaterImages[name] = image;
  if (!image) return;
  image.src = url;
  return image.decode().catch(() => {});
}));
