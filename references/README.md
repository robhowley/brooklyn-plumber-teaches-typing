# Mario Teaches Typing: gameplay, progression, and completion

**Your remembered letter-covered blocks and turtles are real. The original is a typing course with three Mario action scenes plus a practice mode, not the original NES campaign played with a keyboard. Its manual defines graduation as finishing Tunnel of Doom at 50 words per minute.**

Researched November 8, 2026. Focus: original 1992 DOS release. Later Macintosh/CD-ROM releases and the sequel are distinguished below.

## 1. How many levels?

There are three separate things that can be called a “level”:

| Kind | Count | Meaning |
|---|---:|---|
| Action worlds | 3 | Outdoor key targets (letters, numbers, or symbols depending on the selected key group), underwater words, underground/castle sentences. |
| Playable activities | 4 | Those three worlds plus Expert Express, a typing drill without the platform scenery. |
| Keyboard lesson selections | 6 | Home row; add top row; add bottom row; add numbers; add symbols; all keyboard. |

Report Card is a fifth numbered menu option, but not a playable level. Next guides course progression, rather than opening a sixth world. The game reuses its scenes as the keyboard coverage and speed requirements grow. It is not a set of NES World 1-1 through 8-4 maps. [M pp. 5–15, 19–20; H; W]

## 2. Setup and the normal session

1. Start the game and reach the main menu, with File, Student, and Lessons menus above a large Mario illustration.
2. Under **Student > New**, enter a name and a goal speed in words per minute (WPM), then choose Mario, Luigi, or Princess Toadstool/Peach. These are character choices, not different platforming abilities.
3. The course starts with **Home Row Only**. Use the Lessons menu to choose other key groups, or let Next guide progression.
4. Choose an activity from the right-hand icons. The original manual documents keys 1–4 for activities, 5 for Report Card, and 6 for Next.
5. Type the displayed targets. Review the results afterward, then repeat, use Next, or return to the menu.
6. The student file saves progress on quitting; load it to resume. Goal WPM and character can be edited. [M pp. 4–7, 19–20]

The DOS help permits Outside and Practice without a minimum goal. Underwater requires **goal WPM at least 10**, and Underground requires **goal WPM at least 30**. These are editable profile settings, not necessarily a locked test of previously achieved speed: the help explicitly permits raising the goal manually. MarioWiki reports a new-profile default of 5 WPM. [H; W]

The inspected DOS v1.1 language resource includes **Lesson Times**, **Certificates**, and “T edit lesson Times.” The printed manual describes an earlier interface and omits these entries; do not assume every release has exactly the manual’s menu layout. [H; W]

## 3. The moment-to-moment control loop

You do not steer with arrows and separately press a jump button. You read the next required character and type it; the game performs the corresponding movement or action.

- A correct key advances the target.
- A wrong key counts as an error but leaves the target waiting for the correct character. You do not drift one character out of alignment after a typo or missing space. [R]
- On-screen hands indicate the correct finger for the next key. [M p. 16]
- The status display tracks elapsed time, keys typed, WPM, and errors. [M p. 16]
- Beginner mode places the current key-group targets on objects in the scenery; later modes move the text into a scrolling word/sentence line. [M pp. 8–13]

The structure is therefore **read target → type correctly → see Mario act → read the next target**, rather than freely exploring and deciding which block to attack.

## 4. Each activity and its pacing

The durations below are **DOS defaults reported by MarioWiki**, not universal limits stated in the printed manual. The DOS build supports editing lesson times. MarioWiki says expiration leads to the results screen. [W; H]

| Activity | Input and scene | Reported default duration | Access and success |
|---|---|---:|---|
| **Mario’s Smash & Dash** | Single target keys on blocks and Koopa Troopas in an outdoor side-scrolling scene; letters, numbers, or symbols depending on the selected key group. | 2 min | No minimum goal; reaching your configured WPM goal is the manual’s documented victory criterion. |
| **Mario’s Wet World Challenge** | Copy words in a scrolling text line while the character swims among sea creatures. | 5 min | Goal setting ≥10 WPM; same documented WPM-goal criterion. |
| **Mario’s Tunnel of Doom** | Copy sentences, including capitals, punctuation, and spaces, through a castle-like underground obstacle sequence. | 5 min | Goal setting ≥30 WPM; reaching the configured WPM goal is the documented victory criterion; finishing at 50 WPM is the manual’s graduation milestone. |
| **Mario’s Expert Express** | Letters, words, or sentences on a practice display; Mario’s face reacts to performance. | 10 min | No minimum goal. A separate practice activity, not a fourth boss stage. |

**Table-wide caveat:** Reaching the configured WPM goal is the manual’s documented victory criterion, but not a claim that goal completion is sufficient under every runtime condition. `ENGLISH.MSD` also contains **“You stopped typing!”** and **“Your accuracy was poor!”** loss messages; their exact triggers and interaction with goal completion remain unverified.

### Smash & Dash: the scene you remember

A **guiding star** marks the current target block or turtle. Type its target key: the block breaks or the turtle flips onto its back, the character runs forward, and the star moves to the next target. You are following a prescribed sequence, not picking arbitrary visible targets. [M p. 8]

The manual describes this activity as suitable for roughly **5–12 WPM**. It even suggests manually setting a 12-WPM goal and moving to the water activity if progress stalls around 9 WPM. That is strong evidence that the beginner scene was not intended as an indefinitely fast typing challenge. [M p. 9]

MarioWiki also describes an early moving-block bonus that can lead to a cloud coin-collecting sequence. The manual mentions surprise screens but does not document their exact triggers. [M p. 17; W]

### Wet World: words replace object-by-object key targets

Words scroll across the screen while the character swims. The manual says faster typing raises Mario away from clams and increases distance from the pursuing creature. [M pp. 10–11]

**There is conflicting evidence about that chase.** Sue James’s December 1992 review says the sea creatures continued independently of typing speed, without changing the distance to danger. Treat the manual’s speed-sensitive chase as the stated design, not verified behavior across all builds. [R]

Naming also varies: the manual uses **Wet Word Challenge** in its text but **Wet World Challenge** in a screenshot caption; modern references usually use Wet World. These are not two different activities.

### Tunnel of Doom: sentences, hazards, and short breaks

The manual describes this sequence: falling blocks/Thwomps → sewer-pipe transit → quicksand. It warns that typing too slowly can get Mario crushed or buried. **Time does not count against you during sewer-pipe transit**, but typing resumes on emerging. MarioWiki describes the obstacle sequence repeating. [M pp. 12–13; W]

This is more demanding than reading key targets from blocks: sentences require continuous typing, spaces, capital letters, and punctuation. It is not evidence of a full castle maze, navigational choices, or a Bowser boss fight.

### Expert Express: practice without the scenery

The manual explicitly describes this as removing distracting game elements. Mario’s face is happy, neutral, or sad according to how close you are to the WPM goal. It is available for practice, rather than being something you must defeat after the castle. [M pp. 14–15]

## 5. Exactly how progression and winning work

### Ending an attempt is not the same as passing it

After a game, Mario presents a blackboard with keys typed, errors, accuracy, speed, and lesson time. An attempt can finish and produce a report without achieving the goal. [M p. 18; W]

The manual says that after a game in which you reach the WPM goal, Mario arrives at a **Victory Screen**. This is the manual’s documented victory criterion, not proof that reaching the goal is sufficient under every runtime condition or an instant win the moment the live WPM counter briefly crosses the target. [M p. 17]

There is also failure feedback. The inspected DOS language resource includes **“YOU LOSE!”**, **“You stopped typing!”**, and **“Your accuracy was poor!”** The manual’s castle description explicitly warns about crushing and sinking. These messages show that reaching the goal should not be presented as sufficient under all runtime conditions. Their exact triggers, along with hazard timing and post-death restart behavior, were not established. [H; M p. 12]

### Next expands the keyboard, then increases speed

The manual’s recommended progression is:

```text
Create/load student and set goal WPM
  → Home Row Only
  → meet goal in a game, then choose Next
  → Add Top Row
  → Add Bottom Row
  → Add Numbers
  → Add Symbols
  → All Keyboard
  → further successful progression raises the WPM goal
  → progress from outdoor to underwater to underground work
  → finish Tunnel of Doom at 50 WPM: Mario Graduate
```

Each arrow between keyboard selections represents another goal-achieving exercise, not an automatic jump after merely playing. The manual says Next raises the WPM goal after all keyboard lesson levels have been covered. It does **not** specify the increment size or the exact reset/interleaving of key groups at every world transition. [M p. 20]

The DOS text resources corroborate graduation between worlds and messages assigning the next WPM goal and lesson. The editable 10/30-WPM access gates mean you can also select harder worlds without following the entire guided sequence. [H]

### Certificates and the overall endpoint

- Moving up a world, with Outside → Water as the manual’s example, permits printing a certificate. You can print to a printer, the screen, or a text file. Certificates are not reserved solely for the final graduation. [M p. 20]
- The explicit overall skill milestone is **finishing Tunnel of Doom at 50 WPM**, which makes you a **Mario Graduate**. [M p. 13]
- The sources establish the graduation milestone, not whether it triggers any additional final screen or changes subsequent access to practice.
- No exact accuracy threshold for passing or certificate eligibility is given in the manual. The executable’s poor-accuracy failure message is a reason not to invent a “WPM is the only condition” rule.

## 6. Which version had a story ending?

| Edition | What matters for your memory |
|---|---|
| **Original DOS (1992)** | The course above, three action worlds, practice, victory screens, certificates, and a documented 50-WPM graduation milestone. |
| **Original Macintosh (1993)** | A port of the original; this investigation did not independently validate all its timing and menu details. |
| **Enhanced CD-ROM (DOS/Windows 1994; Mac 1995)** | Adds the floating talking Mario head, cutscenes, and the broken Magical Typewriter story. The ending restores the typewriter and drops a giant green **! Block** onto Bowser’s Castle. |
| **Mario Teaches Typing 2 (1996)** | Reworks the CD presentation and cutscenes, adds features including Magical Keyboard and customizable lesson plans. Its ending drops a giant **typewriter** onto Bowser’s Castle. |

The story ending is therefore **not exclusive to the sequel**, but it should not be retroactively assigned to the original floppy game. Exact lesson-to-cutscene unlock conditions in the enhanced CD and sequel were not established here. [C; S]

## 7. Original DOS screenshots

These are actual screenshots, not recreations. Some use Luigi rather than Mario, demonstrating the character selection. Images are saved locally and attributed to the [Super Mario Wiki gallery][W]. They remain copyrighted game imagery, not freely licensed replacement assets.

| Menu and setup | Outdoor letters |
|---|---|
| ![Original DOS main menu](images/menu.png) | ![Luigi, a letter-marked Koopa, and a floating letter block](images/outdoors.png) |
| ![Student profile and character selection](images/profile.png) | ![Underwater scrolling text and Luigi](images/underwater.png) |

| Castle sentences | Practice |
|---|---|
| ![Sentence line above Thwomps and Luigi](images/castle.png) | ![Expert Express typing practice](images/practice.png) |
| ![Mario showing performance on a blackboard](images/results.png) | ![Student report card](images/report-card.png) |

### Image provenance

| Local file | Original URL |
|---|---|
| `images/menu.png` | https://mario.wiki.gallery/images/5/54/Mario_Teaches_Typing_1992_menu.png |
| `images/profile.png` | https://mario.wiki.gallery/images/e/ef/Mario_Teaches_Typing_1992_characters.png |
| `images/outdoors.png` | https://mario.wiki.gallery/images/d/d2/Mario_Teaches_Typing_1992_gameplay.png |
| `images/underwater.png` | https://mario.wiki.gallery/images/b/b5/Mario_Teaches_Typing_1992_intermediate.png |
| `images/castle.png` | https://mario.wiki.gallery/images/a/a3/Mario_Teaches_Typing_1992_advanced.png |
| `images/practice.png` | https://mario.wiki.gallery/images/2/28/Mario_Teaches_Typing_1992_practice.png |
| `images/results.png` | https://mario.wiki.gallery/images/4/4a/MTT_1992_Results.png |
| `images/report-card.png` | https://mario.wiki.gallery/images/5/52/Mario_Teaches_Typing_1992_report_card.png |

## 8. Sources, validation, and remaining gaps

Research used three parallel source investigations, followed by two targeted searches for the manual and completion rules. The manual text was read in full, and the pages establishing underwater behavior, castle hazards, graduation, and Next progression were also visually checked. Original DOS help and language-resource text were inspected directly. Screenshots were downloaded and examined. This was **not** an emulator playtest.

- **[M] Primary manual:** Interplay, *Mario Teaches Typing*, copyright 1992, manual code MN-IBM-025-0. [Source page][M] · [Local PDF](manual-1992.pdf). Citations above use printed page numbers; PDF page = printed page + 1.
- **[H] Original DOS files:** [Internet Archive item][H] · [ZIP](https://archive.org/download/msdos_Mario_Teaches_Typing_1992/Mario_Teaches_Typing_1992.zip), especially `MarioTea/MARIO/MARIO1.HLP`, `MARIO2.HLP`, and `ENGLISH.MSD`. The package identifies itself as v1.1. Text resources prove the existence and wording of messages, not their runtime conditions.
- **[R] Contemporary review:** Sue James, *PC Review* #014, December 1992, pp. 100–101. [Scanned issue][R] · [OCR](https://archive.org/download/pc-review-014/PC%20Review%20%23014_djvu.txt).
- **[W] Secondary gameplay, timing, and image source:** [Super Mario Wiki: original game][W]. It notes differences between the manual’s earlier screenshots and the shipped interface.
- **[C] Edition/story source:** [Enhanced CD-ROM][C].
- **[S] Edition/story source:** [Mario Teaches Typing 2][S].

**Still uncertain:** exact goal-speed increments; accuracy and inactivity loss thresholds; post-hazard restart rules; underwater chase behavior across builds; precise CD/sequel story-unlock gates. The defaults 2/5/5/10 minutes come from a secondary source, not the printed manual or a fresh runtime test.

**Final validation:** The local manual PDF and all eight screenshot files exist; the independent source review covered those artifacts and the major claims above.

### Optional viewing and running

- [1992-labelled full-game video](https://www.youtube.com/watch?v=dJP7FTvGETM), 22:10 according to retrieved metadata. Not used as frame-by-frame evidence; edition and scene timestamps were not independently checked.
- [Internet Archive DOS entry][H] offers browser emulation. Browser play was not tested in this investigation.
- For historical setup, the original manual specifies DOS, a 286 CPU, and 640K free memory; install with `INSTALL`, then launch with `MARIO`. Modern systems need emulation rather than running the DOS executable natively. [M pp. 3–4]

[M]: https://www.oldgames.sk/en/game/mario-teaches-typing/download/5125
[H]: https://archive.org/details/msdos_Mario_Teaches_Typing_1992
[R]: https://archive.org/details/pc-review-014
[W]: https://www.mariowiki.com/Mario_Teaches_Typing
[C]: https://www.mariowiki.com/Mario_Teaches_Typing_Enhanced_CD-ROM
[S]: https://www.mariowiki.com/Mario_Teaches_Typing_2
