# Playing

For local setup and tests, see [DEVELOPMENT.md](DEVELOPMENT.md).

## Controls

- The canvas receives keyboard focus on load. Press **1 Outside**, **2 Water**, **3 Castle** or **4 Practice**, or click the menu pictures.
- Startup keys skip individual sequences, not the entire introduction. **D** selects an unsaved Demo profile; then choose a world. Guest `Player` is also unsaved but never plays automatically.
- Outside accepts the marked letter immediately, including its lowercase equivalent. Water and Castle require matching case. Displayed bonus punctuation starts a sequence with lesson time stopped.
- Practice preserves case. Copy the second text row into the first; finish a line with **SPACE or Enter**. Practice has no inactivity failure or progression, and Next stays in Practice.
- Water starts its scripted failure after more than 20 seconds without any input. Castle repeats its rockface, pipe and sand scenes. There are no lives or contact-based typing requirements.
- **Escape** ends an activity early. **F10** also ends Outside and Water but is ignored in Castle and Practice.
- Results: **N Next**, **M / Escape Menu**. Tab/arrows move selection; Enter activates it. Space does not activate results.
- Use menu dropdowns with the pointer or arrows/Enter. **5 / report picture** opens a saved student's report; **H / F1** opens Help, **K / F2** Keyboard, and **A** About.
- Water's advancement sequence cannot be skipped. First Castle graduation repeats its ending until a key is pressed.
- Losing focus pauses updates and active lesson time. Return to the page or focus the canvas to resume. Wall-clock inactivity still advances, so Water may fail after a long pause.

## Students and saves

- **W** creates a student, **E** edits, **T** edits lesson durations, and **L** opens the load chooser. Canvas name fields accept eight uppercase letters/digits; goal is 5..150 and durations are 1..60 minutes.
- New clears the working profile even if cancelled. A duplicate New name loads the existing student. Rename deletes the old saved name only after acceptance; Escape cancels the field first. Escape outside a field saves the editor and returns.
- In the load chooser **D means Done/load, not Delete**; **C / Escape** cancels.
- New students start at goal 5, group 1, Mario, with durations 2/5/5/10 minutes. Next routes to Water at goal 10 and Castle at 30; it never invents a route from Castle to Practice.
- Progress stays in this browser under `mtt-static-translation.students.v1`. Old recreation profiles are left untouched, not automatically imported. Blocked or corrupt storage displays a persistent memory-only warning; those changes will not survive closing the page.

## Audio and limitations

- A keyboard or pointer gesture unlocks browser audio. Use the original music/sound/speech menu switches.
- Four recovered speech clips play. Input is discarded while speech is playing; unavailable or interrupted speech is omitted, without a guessed delay or later replay. Water's lesson timer includes its Ready clip.
- Music, sound effects and the other speech formats remain silent. Certificate selection/text output, printing, original mouse/finger imagery, Practice cursor blinking and intermediate world/modal fades are unsupported. Welcome text color is provisional.
- Browser scheduling, input delivery, focus pause and storage are adaptations, not DOS hardware emulation. Quit cannot close the browser tab. Missing resources stop visibly instead of substituting generic art or lessons.
- `?seed=1` fixes the process entry seed; startup skips and input timing still change later random draws. It is not a recording of an original DOS session.
