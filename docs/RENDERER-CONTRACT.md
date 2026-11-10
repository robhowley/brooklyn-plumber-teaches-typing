# Scene renderer contract

`drawScene(canvas, state)` in `src/scene.js` draws synchronously at 640×400. It reads the supplied attempt without mutating it, uses cached local images, and never owns timers, input, storage or gameplay transitions. Metrics come from the engine's `stats`, not a second scoring formula.

- `src/engine.js` owns active elapsed time, the lesson cursor, travel, buffered contact and pipe transitions.
- `src/app.js` owns animation scheduling, keyboard events, pause/resume, accessible DOM controls and text.
- `src/scene.js` consumes elapsed time and travel positions. Paused/finished attempts freeze because active time freezes; reduced motion suppresses ambient travel.
- Outdoor sky and soil are fixed native-image crops. Only pavement repeats. Water is a fixed backdrop, not a seamless scrolling tile.
- The renderer may visualize performance but cannot end attempts, award certificates or advance the course.
- `src/screen-art.js` owns native 320×200 menu/form geometry; `src/title-art.js` owns the separate title reveal.

See [Scene art](ART.md) for assets and rights, and [Title screen](TITLE-SCREEN.md) for title behavior. Node renderer tests cover state immutability and freezes; browser tests cover actual pixels, layout, input and scrolling.
