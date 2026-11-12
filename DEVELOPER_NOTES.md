# Piniso — your funny AI study buddy ✏️

A browser extension for **Microsoft Edge and Google Chrome**. A cute jelly blob with a pencil sits on your lecture video, writes notes, makes funny-but-useful comments, quizzes you, and keeps you focused.

## Try it on your PC (2 minutes)
1. Unzip `piniso-4.0.0.zip` into a folder.
2. Edge: open `edge://extensions` → turn on **Developer mode** (left side) → **Load unpacked** → pick the folder.
   Chrome: `chrome://extensions` → Developer mode → Load unpacked.
3. The welcome page opens. Paste a free Groq key (console.groq.com/keys → Create API key).
4. Open any YouTube lecture. Piniso pops up in the bottom-right corner.

## Publish on your Microsoft account (Edge Add-ons)
1. Go to **partner.microsoft.com/dashboard/microsoftedge** and sign in with your Microsoft account (register as a developer — it is free).
2. **Create new extension** → upload `piniso-4.0.0.zip` (the zip itself, not the folder).
3. **Availability:** Public, all markets.
4. **Properties:** category *Education*; privacy policy URL = where you host `store/privacy-policy.html` (for example on aaradhybadjatya.com).
5. **Store listing:** copy text from `store/LISTING.md`. Upload `store/store-logo-300.png`, `store/promo-small-440x280.png`, `store/promo-marquee-1400x560.png` and the images in `store/screenshots/`.
6. **Submit.** In "Notes for certification" paste: *"Uses the user's own AI API key. To test: open the options page, add a free Groq key from console.groq.com/keys, then open any YouTube lecture with captions. Tab audio capture is used only when the user presses Listen."*
7. Review usually takes a few working days.

Same zip works for the Chrome Web Store (one-time $5 developer fee).

## New in v4.1 — Piniso in real 3D
- **A real 3D Piniso**, modelled in Blender with code (`tools/build_piniso.py` — no AI art): soft clay body, glossy eyes with two highlights, blush cheeks, little feet, springy sprout leaves and a real wooden pencil (hex body, wood, lead, metal band, eraser) held in his paw.
- **Drawn live in 3D** inside the page (`shared/pet3d.js` + a small three.js build in `vendor/three/`): clay materials, studio lights, soft contact shadow. Up to 60 FPS while moving, 30 FPS when resting, pauses when the tab is hidden, and lowers its resolution by itself if a PC is slow.
- **All 22 moods in 3D** — star eyes, heart eyes, ^^ eyes, sleepy lids, dizzy spirals, ✕ eyes, 10 mouths, moving eyebrows, blushing cheeks.
- **67 animations** — tada, backflip, frontflip, superjump, dance, robot, groove, twirl, salute, facepalm, yawn, sneeze, faint, peek, meditate, swim, hiccup, blow a kiss, high-five… plus 3D particles: confetti, hearts, Zzz, sweat, tears, anger puffs, music notes, light bulb, dizzy stars.
- **Life-like details** — breathing, blinking (sometimes a double blink), eyes and body follow your mouse, leaves wobble after jumps, little random idle moves.
- **Reacts to studying** — claps/cheers on right answers, facepalm on wrong ones, superjump on golden moments, level-up flips, stretch at break time. Type `dance` or `move backflip` in Ctrl+K.
- **Every accessory in 3D** — 10 hats, 6 glasses/face items, 5 neck items, 6 things to hold, 3 auras — and theme colours recolour him live.
- **Design studio**: 3D ⇄ Classic 2D switch, a 🎬 animation gallery with every move, and a 🎉 Dance party button. Dashboard and popup got spring motion too.
- **Safe fallback**: on PCs without a real graphics chip (or if 3D fails), Piniso quietly uses the classic 2D drawing. Everything else works the same.

## New in v4.0 — "Piniso it" becomes a habit
Built from many rounds of four reviewers: a harsh customer, an internet-nerd idea finder, a student-psychology expert and a motion designer.
- **⌘ Command bar (Ctrl+K)** — type anything: a tool name ("pdf", "meme", even "bklt"), `speed 1.5`, `go to 12:30`, `back 30`, `note: …`, `card: Q | A`, `timer 25`, `ask: …`, or any word to search your notes. Recent tools come first.
- **✏️ "Piniso karo" kickoff** — the long start form is gone. One big button, a 📵 phone-away chip, a timer picker and an optional goal, then a hand-drawn **3-2-1-GO!** countdown. "Always start instantly" skips it forever.
- **🖥️ No-key mode** — no API key? Piniso uses the AI built into Chrome (Gemini Nano, Chrome 138+, on-device, free, offline after a one-time download). Settings → AI brain shows the status and a one-click download. A key always wins when you add one.
- **🧩 4 new quiz games** — Fill the blank (tap a word chip), Spot the mistake (tap the wrong word), Put in order (tap steps first → last) and Match the pairs. Checked on your PC instantly; turned into spoken questions in voice quiz.
- **🫥 Smart dodge** — Piniso hops off the subtitles by itself. The notes desk opens **beside** the video when there is room.
- **🌟 Golden moments** — rare surprise "+25 XP GOLDEN!" on right answers (never on wrong ones, never more than once in 12 minutes).
- **🌱 Piniso grows** — Seed → Sprout → Sapling → Scholar → Sage → Legend with your study hours (+40 XP each stage). See it in the popup, Ctrl+K and the 🌱 tool.
- **📱 Revise on phone** — one tap saves your flashcards as a single offline page. WhatsApp it to yourself and revise on the bus (flip cards, Again / Hard / Easy).
- **↩️ Undo** after deleting a note. Share card is now **9:16** for WhatsApp status / Insta stories.
- Motion pass: spring pop-ins, staggered menus, card shine, sparkles. Calm mode / "reduce motion" keeps everything still.
- Fixes: tapping Piniso did nothing after closing the welcome tour with ✕ · "Trick learned" toast showed twice · quick-menu buttons piled up in screen corners · start form's goal box was squashed · share card and Wrapped ignored your theme colours.

## New in v3.1.1 — never annoying on normal videos
- Piniso **never starts by itself**. On a normal video (music, vlogs, games) it stays hidden and quiet.
- On a study video it **asks first** with a small pop-up: ✨ Yes, start · Not now · Always start on study videos. If you don't answer, it quietly goes away.
- Tap **✨ Piniso it** under any YouTube video (or the toolbar icon) to start it on any video yourself.
- Settings → Study → "When should Piniso start?": Ask me first / Start by itself / Only when I tap.

## New in v3.1 — printable notes, done properly
- **Study booklet v2**: real A4 / Letter pages with page numbers. No more cut-off or overlapping text. Big blocks never split in half, and long lists continue neatly on the next page.
- **⬇️ Download PDF** button (one click, links still clickable), plus 🖨️ Print for perfect vector prints.
- **Two layouts**: 🛋️ Comfortable (roomy, a new page for every chapter) and 📄 Compact (same content, about half the pages).
- **Customize live**: 5 colour themes (including Ink saver), text size, paper and margins, answers (at the end / under each question / hidden), lined notes page, name and class on the cover, show or hide any section, and reorder or hide chapters.
- **Easier to read**: high contrast, dyslexia-friendly spacing, emoji icons on or off. Diagrams have text labels for screen readers.
- **New mind map**: clean and two-sided, with no overlaps. Formulas like H^{+} now show as H⁺ instead of raw code.
- **Printable notes page** rebuilt the same way: comfortable / compact, choose what to include, timestamps, Download PDF.
- **🎬 Whole video**: Ask, Quiz, explain buttons and voice can now use the full video, including parts you haven't watched yet. You choose this; by default Piniso uses only what you've watched.
- **No spoilers**: notes, flashcards, key terms and topic names written ahead of time stay hidden until the video reaches them. Pre-questions are now off by default.
- **Bubbles you can read**: tips stay on screen while your mouse is over them, and each one stays long enough to read. A new bubble waits for you to finish the current one.

## New in v3.0 — “Piniso it”
Built on research about student habits (Fogg model, Duolingo streak studies, retrieval practice, endowed progress, Spotify Wrapped).
- **✨ Piniso it** — one button (popup, next to every YouTube video, or tap Piniso) turns everything on.
- **Magic menu** — tap Piniso → every tool in one searchable screen, grouped Before / While watching / After / Revise / Focus / Fun.
- **New trick unlocked** — one feature taught per session; “Tricks mastered” checklist on the dashboard.
- **3-step welcome tour**, **60-second recall** at the end of every video, **Piniso Wrapped** weekly share card.
- **Forgiving streak** (5 min of study *or* 5 flashcards counts) with streak freezes.
- 25 new tools: doubt snipe, I'm lost + revisit list, rewind-and-explain, formula strip, speed coach, autoplay blocker, warm-up recap, board-answer writer, Ask across all videos, focus lock, daily mission, mood check-in, focus replay, night-owl guard, smart breaks, mistake notebook, weak-topic heatmap, formula drill, night-before mode, evening reminders, exam countdown, audio recap, share card, shortcuts sheet, low-data mode.
- Guardian: "Lock now" works anytime; booklet PDF never fails (falls back to your notes).

## New in v2.2
- **Fair grading:** a strict exam checker (main model, temperature 0) — related-but-wrong answers like "refraction" for "dispersion" are marked wrong; MCQ answer keys are double-checked by the option text.
- **You choose the range:** quiz, Ask and voice can use "around now", the last 5/10/15 minutes, the whole video so far, or one topic/chapter.
- **Timeline aware:** Piniso knows where you are (time, %, YouTube chapter, topics done, your recent mistakes) and never spoils parts you haven't watched.
- **Smarter voice:** reads any part of the lecture, searches your notes, shows formulas on a card while it talks, uses your mistakes, one-tap prompts, bigger live orb.
- **📘 Study booklet:** pick videos/topics → a colourful printable PDF with mind map, diagrams, formula boxes, practice questions + answer key, cut-out flashcards and a revision tracker.
- **Guardian really blocks:** on by default (only while studying), already-open Instagram tabs are caught too, and YouTube Shorts are blocked during study.
- **Videos tab / watchlist:** continue any study video where you stopped (each with its own notes + chat), an "Up next" study queue, and study-only suggestions. On YouTube Piniso only wakes up for study videos.
- Many UI fixes (radial tooltips, desk never covered by bubbles/quizzes, small screens, header overflow, tab scroll).

## New in v2.1
- **Smarter notes:** the AI reads the captions first, then writes real exam notes in its own words (never copies captions). Starred moments get a proper AI note too.
- **Notes on time:** with captions, Piniso reads one part ahead, so notes appear as the teacher says it.
- **✨ Clean notes:** a tidy topic-wise version with tables, an exam corner and common mistakes. Updates by itself and goes into the PDF.
- **Filters + search** in notes (⭐, formulas, definitions, mine).
- **Much faster:** Ask answers type out live; Ask/quiz never wait behind notes; quiz questions are prepared with the notes so quizzes open instantly.
- **Flashcards fixed:** 1–3 cards with every set of notes, a “Make cards from notes” button, and in-desk revision (Forgot / Hard / Good / Easy).
- **Voice is one tap away:** mic button on Piniso and in the desk header, plus **🎙️ Voice quiz** (also inside every quiz: “Answer by voice”).

## New in v2
- **Voice talk** (hover Piniso → 🎙️ or Alt+Shift+T): real speech-to-speech with Gemini Live (free key from aistudio.google.com/apikey) or OpenAI Realtime. Live captions. Modes: buddy, teach, Socratic, rapid-fire, coach. Say "pause", "go back 30 seconds", "what's on the board?", "quiz me".
- **Guardian** (Dashboard → Guardian): blocks distracting sites while you study.
- **Any website**: Dashboard → Study modes → *Run on every website*.
- **Full screen**: Piniso stays visible; or use the ⛶ button in its menu.
- **Study Anything**: popup → *Study a desktop app / any window*.
- **Floating Piniso**: hover → 🪟 (or Alt+Shift+F) — always on top of every window.

## How it hears the lecture
1. YouTube: catches the caption file that YouTube's own player downloads (YouTube blocks direct downloads since 2026), then falls back to reading live captions.
2. Other sites: reads the video's subtitle tracks.
3. No captions (Unacademy etc.): click the Piniso icon → **Listen** (or Alt+Shift+L). Audio goes to Groq Whisper (free) / OpenAI / Gemini.

## Shortcuts
Ctrl+K command bar · Alt+Shift+P desk · Alt+Shift+Q quiz · Alt+Shift+S snap board · Alt+Shift+L listen · Alt+Shift+M star moment · Alt+Shift+N notes · Alt+Shift+T talk · Alt+Shift+F float

## Project layout
- `manifest.json`, `background.js` — service worker: AI router (Groq, Gemini, OpenAI, OpenRouter, custom/offline), speech-to-text, tab audio, snaps, shortcuts
- `offscreen/` — records tab audio for Listen mode
- `content/` — the in-page buddy: video finder, transcript engine, brain (prompts), UI, quiz, report card, app
- `shared/` — mascot (pure SVG + physics), sound engine (Web Audio), storage, themes, lines, on-device AI (`device-ai.js`)
- `shared/pet3d.js`, `assets/3d/piniso.glb`, `vendor/three/pz3.min.js` — the live 3D Piniso (model source: `tools/build_piniso.py`, run with Blender's Python: `pip install bpy` then `python3 tools/build_piniso.py assets/3d/piniso.glb`; three.js build: `tools/pz3-entry.js` with esbuild)
- `content/v4.js`, `content/v4-css.js` — v4: command bar, kickoff, smart dodge, golden moments, growth, revise on phone
- `pages/` — popup, dashboard (setup, design studio, library, revision, progress), printable notes
- Styles live in `content/ui-css.js` (main) and `content/v4-css.js` (v4) — plain JS strings, edit them directly.

Fonts: Caveat, DM Sans, Instrument Serif, JetBrains Mono (SIL OFL). Math: KaTeX (MIT). 3D runtime: three.js (MIT). Everything else is original. © Eka.
