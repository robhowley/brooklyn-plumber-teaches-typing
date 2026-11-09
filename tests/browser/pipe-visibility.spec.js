import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('inside pipe conceals character identity, engine resume restores visible actor', async ({ page }) => {
  // Serve the renderer's local module, JSON and PNG dependencies, not SPA HTML.
  await page.route('**/__pipe_test__/**', route => {
    const file = new URL(route.request().url()).pathname.split('/__pipe_test__/')[1];
    const contentType = file.endsWith('.json') ? 'application/json' : file.endsWith('.png') ? 'image/png' : 'text/javascript';
    return route.fulfill({ contentType, body: readFileSync(`src/${file}`) });
  });
  await page.goto('/');
  const visibility = await page.evaluate(async () => {
    const { drawScene } = await import('/__pipe_test__/scene.js');
    const { createAttempt, typeKey, resume } = await import('/__pipe_test__/engine.js');
    const state = createAttempt({ mode: 'castle', group: 5, duration: 300, goal: 30 });
    for (let i = 0; i < 40; i++) typeKey(state, { key: state.text[state.correct % state.text.length] });
    const canvas = document.createElement('canvas');
    const pixels = character => {
      drawScene(canvas, { ...state, character }, state.elapsed);
      return canvas.toDataURL();
    };
    const inside = { stage: state.pipe?.stage, status: state.status, concealed: pixels('Mario') === pixels('Luigi') };
    resume(state);
    return { inside, resumed: { pipe: state.pipe, status: state.status, visible: pixels('Mario') !== pixels('Luigi') } };
  });
  expect(visibility.inside).toEqual({ stage: 'inside', status: 'paused', concealed: true });
  expect(visibility.resumed).toEqual({ pipe: null, status: 'running', visible: true });
});
