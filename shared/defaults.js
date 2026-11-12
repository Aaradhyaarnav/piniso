/* Piniso — shared defaults, themes, providers, levels, badges.
   Loaded in content scripts, extension pages and the service worker. */
(() => {
  if (globalThis.PINISO_DEFAULTS) return;

  const THEMES = {
    'ink-paper': {
      label: 'Ink & Paper', note: 'Cream paper, black ink, highlighter yellow',
      paper: '#F5F0E6', paper2: '#FFFCF5', ink: '#1C1B18', muted: '#6E685D', line: '#DED5C4',
      accent: '#FFD23F', accentInk: '#1C1B18', pattern: 'ruled', dark: false,
      pet: { body: '#FFFDF7', outline: '#1C1B18', cheeks: '#FF9BA8', pencil: '#FFC93C', eraser: '#FF7F8E' }
    },
    'midnight-ink': {
      label: 'Midnight Ink', note: 'Dark desk, warm lamp light',
      paper: '#17161B', paper2: '#211F27', ink: '#F1ECE2', muted: '#A39C90', line: '#34313B',
      accent: '#FFB547', accentInk: '#17161B', pattern: 'dots', dark: true,
      pet: { body: '#2A2833', outline: '#F1ECE2', cheeks: '#FF8FA3', pencil: '#FFB547', eraser: '#FF7F8E' }
    },
    'blueprint': {
      label: 'Blueprint', note: 'Engineer mode: blue grid paper',
      paper: '#1E4C89', paper2: '#245899', ink: '#EEF4FF', muted: '#AFC6EA', line: '#3B6CB0',
      accent: '#FFE066', accentInk: '#14325C', pattern: 'grid', dark: true,
      pet: { body: '#EEF4FF', outline: '#0F2A50', cheeks: '#FFB3C1', pencil: '#FFE066', eraser: '#FF8FA3' }
    },
    'chalkboard': {
      label: 'Chalkboard', note: 'Classroom green with pink chalk',
      paper: '#233029', paper2: '#2B3A32', ink: '#F2EFE6', muted: '#AFB9B0', line: '#3C4D43',
      accent: '#FFB4C6', accentInk: '#233029', pattern: 'plain', dark: true,
      pet: { body: '#F2EFE6', outline: '#1B241F', cheeks: '#FFB4C6', pencil: '#FFE9A6', eraser: '#FFB4C6' }
    },
    'risograph': {
      label: 'Risograph', note: 'Zine print: riso blue + fluoro pink',
      paper: '#FFF3EA', paper2: '#FFFAF5', ink: '#2B2A8C', muted: '#6E6BB0', line: '#F1D9CD',
      accent: '#FF4FB2', accentInk: '#FFFFFF', pattern: 'dots', dark: false,
      pet: { body: '#FFFAF5', outline: '#2B2A8C', cheeks: '#FF4FB2', pencil: '#FFD23F', eraser: '#FF4FB2' }
    },
    'matcha': {
      label: 'Matcha Notes', note: 'Calm green tea vibes',
      paper: '#EEF1E5', paper2: '#F8FAF2', ink: '#24301F', muted: '#66705E', line: '#D5DCC6',
      accent: '#A6D96A', accentInk: '#24301F', pattern: 'grid', dark: false,
      pet: { body: '#F8FAF2', outline: '#24301F', cheeks: '#F5A3A3', pencil: '#E9C46A', eraser: '#F28482' }
    },
    'sepia': {
      label: 'Old Diary', note: 'Sepia pages + red pen',
      paper: '#F2E4CB', paper2: '#F8EEDC', ink: '#3A2A1A', muted: '#7A6448', line: '#E0CDAA',
      accent: '#D2503A', accentInk: '#FFF6EA', pattern: 'ruled', dark: false,
      pet: { body: '#F8EEDC', outline: '#3A2A1A', cheeks: '#E89C86', pencil: '#E4A72E', eraser: '#D2503A' }
    },
    'neon-notes': {
      label: 'Neon Notes', note: 'Black page, hot pink highlighter',
      paper: '#0F0F10', paper2: '#19191B', ink: '#F7F7F7', muted: '#9B9BA3', line: '#2A2A2E',
      accent: '#FF3EA5', accentInk: '#0F0F10', pattern: 'grid', dark: true,
      pet: { body: '#1E1E22', outline: '#F7F7F7', cheeks: '#FF3EA5', pencil: '#FFE14D', eraser: '#FF3EA5' }
    }
  };

  const DEFAULTS = {
    schema: 1,
    onboarded: false,
    enabled: true,
    disabledSites: [],
    shortsPolice: true,
    ai: {
      provider: 'groq',
      device: true,            // no key? use the AI built into Chrome (on-device, free, offline)
      keys: { groq: '', gemini: '', openai: '', openrouter: '', custom: '' },
      models: {
        groq: 'openai/gpt-oss-120b',
        gemini: 'gemini-flash-latest',
        openai: 'gpt-5-mini',
        openrouter: 'openai/gpt-oss-120b',
        custom: 'llama3.1'
      },
      fallback: {
        groq: 'openai/gpt-oss-20b',
        gemini: 'gemini-flash-lite-latest',
        openai: '',
        openrouter: '',
        custom: ''
      },
      // quick model for things you wait for (Ask, quiz, grading). 'best' = always use the main model.
      speed: 'fast',
      fast: {
        groq: 'openai/gpt-oss-20b',
        gemini: 'gemini-flash-lite-latest',
        openai: 'gpt-5-nano',
        openrouter: '',
        custom: ''
      },
      vision: 'auto',          // auto | groq | gemini | openai | openrouter | custom
      visionModels: {
        groq: 'auto',
        gemini: 'gemini-flash-latest',
        openai: 'gpt-5-mini',
        openrouter: 'google/gemini-flash-latest',
        custom: ''
      },
      stt: 'auto',             // auto | groq | openai | gemini
      sttModels: { groq: 'auto', openai: 'whisper-1', gemini: 'gemini-flash-latest' },
      customBaseUrl: 'http://localhost:11434/v1'
    },
    lang: { comments: 'hinglish', notes: 'english' },
    humor: 3,
    brain: {
      start: 'ask',            // 'ask' = pop up and ask on study videos · 'auto' = start by itself on study videos · 'manual' = only when you tap ✨ Piniso it
      autoSites: [],           // sites where you said “always start here”
      commentsOn: true,
      notesOn: true,
      commentEvery: 180,
      autoImportant: true,
      visionFallback: false,
      cardsOn: true,
      notesAhead: true,
      ytStudyOnly: true,       // on YouTube, only wake up for study videos (tap Piniso to study any other video)        // with full captions, write notes one part ahead so they are ready on time
      cleanAuto: true          // keep a tidy topic-wise version of the notes
    },
    v4: { dodge: true, golden: true },
    dev: { openShadow: false },
    quiz: {
      enabled: false,
      every: 480,
      count: 2,
      types: { mcq: true, tf: true, short: true, long: false, fill: true, fix: true, order: true, match: true },
      difficulty: 'medium',
      autoPause: true
    },
    focus: {
      pauseOnLeave: true,
      zen: true,
      hideCaptions: true,
      breakEvery: 45,
      breakLength: 5,
      dailyGoal: 60,
      sleepAfter: 3
    },
    sound: {
      master: 0.7,
      sfx: true,
      sfxVol: 0.6,
      blips: true,
      music: 'lofi',        // off | lofi | rain | brown | forest | space | examhall
      musicWhen: 'breaks',  // breaks | paused | always
      musicVol: 0.35,
      tts: false,
      ttsWhen: 'paused',    // paused | always
      voice: ''
    },
    pet: {
      name: 'Piniso',
      body: '#FFFDF7', outline: '#1C1B18', cheeks: '#FF9BA8', pencil: '#FFC93C', eraser: '#FF7F8E',
      eyes: 'round',        // round | sparkle | dot | anime | sleepy
      hat: 'sprout',
      face: 'none',
      neck: 'none',
      hold: 'pencil',
      aura: 'none',
      size: 96,
      position: 'corner',   // corner | video
      motion: 'normal',     // calm | normal | hyper
      render: '3d',         // 3d (live clay model) | 2d (classic drawing)
      followTheme: true
    },
    everywhere: false,      // run on every website (needs permission)
    fullscreenRewrap: true, // keep Piniso visible when a site makes the bare video full screen
    voice: {
      provider: 'auto',     // auto | gemini | openai
      geminiModel: 'auto',
      openaiModel: 'gpt-realtime-2',
      voice: 'Puck',        // Gemini voice name
      openaiVoice: 'marin',
      mode: 'buddy',        // buddy | teach | socratic | rapid | coach
      pauseVideo: true,
      ptt: false,
      captions: true,
      seeScreen: true
    },
    guardian: {
      enabled: true,        // on by default, but only while you study (when: 'session')
      shorts: true,         // also block YouTube Shorts while studying
      when: 'session',      // session | always | schedule
      from: '17:00', to: '22:00',
      sites: ['instagram.com', 'facebook.com', 'x.com', 'twitter.com', 'reddit.com', 'snapchat.com', 'tiktok.com', 'netflix.com', 'primevideo.com', 'hotstar.com', 'jiocinema.com', 'twitch.tv', 'pinterest.com', '9gag.com', 'poki.com', 'crazygames.com', 'miniclip.com'],
      passMinutes: 5,
      unlock: 'card',       // card | wait | both
      ritual: true,
      plan: '',
      goal: ''
    },
    study: {
      prequestions: false,
      yourTurn: true,
      yourTurnEvery: 3
    },
    ui: {
      theme: 'ink-paper',
      custom: null,         // { paper, paper2, ink, muted, line, accent, accentInk, pattern, dark }
      corners: 'sketchy',   // sketchy | round | sharp
      font: 'hand',         // hand | sans | serif | mono  (speech bubble + headings)
      bubble: 'sketch',     // sketch | comic | minimal
      deskSide: 'right'
    }
  };

  const PROVIDERS = {
    groq: {
      label: 'Groq', free: true, base: 'https://api.groq.com/openai/v1',
      keyUrl: 'https://console.groq.com/keys',
      hint: 'Free, very fast, no card needed. Recommended.',
      stt: true
    },
    gemini: {
      label: 'Google Gemini', free: true, base: 'https://generativelanguage.googleapis.com/v1beta/openai',
      keyUrl: 'https://aistudio.google.com/apikey',
      hint: 'Free tier, great at reading the board (images).',
      stt: true
    },
    openai: {
      label: 'OpenAI', free: false, base: 'https://api.openai.com/v1',
      keyUrl: 'https://platform.openai.com/api-keys',
      hint: 'Paid. Strong quality.',
      stt: true
    },
    openrouter: {
      label: 'OpenRouter', free: true, base: 'https://openrouter.ai/api/v1',
      keyUrl: 'https://openrouter.ai/keys',
      hint: 'One key, many models (some free).',
      stt: false
    },
    custom: {
      label: 'Custom / Offline (Ollama, LM Studio)', free: true, base: '',
      keyUrl: '',
      hint: 'Any OpenAI-compatible server, even on your own PC.',
      stt: false
    }
  };

  const LEVELS = [
    'Fresh Notebook', 'Pencil Pusher', 'Doubt Slayer', 'Note Ninja', 'Concept Crusher',
    'Formula Wizard', 'Topper Material', 'Exam Assassin', 'Syllabus Shredder', 'Legend of the Library'
  ];

  const xpForLevel = (lvl) => 50 * (lvl - 1) * (lvl - 1);
  const levelFromXP = (xp) => {
    let l = 1;
    while (xpForLevel(l + 1) <= xp) l++;
    return l;
  };
  const levelTitle = (lvl) => LEVELS[Math.min(lvl, LEVELS.length) - 1];

  const BADGES = {
    first_session: { icon: '🌱', name: 'First Page', desc: 'Studied your first video with Piniso' },
    night_owl: { icon: '🦉', name: 'Night Owl', desc: 'Studied after 11 PM' },
    early_bird: { icon: '🐣', name: 'Early Bird', desc: 'Studied before 7 AM' },
    quiz_ninja: { icon: '🥷', name: 'Quiz Ninja', desc: '5 quiz answers right in a row' },
    no_escape: { icon: '🔒', name: 'No Escape', desc: '45 minutes without leaving the tab' },
    doubt_destroyer: { icon: '💥', name: 'Doubt Destroyer', desc: 'Asked 10 doubts' },
    note_hoarder: { icon: '📚', name: 'Note Hoarder', desc: '100 notes collected' },
    streak_3: { icon: '🔥', name: 'On Fire', desc: '3 day streak' },
    streak_7: { icon: '☄️', name: 'Unstoppable', desc: '7 day streak' },
    streak_30: { icon: '👑', name: 'Study Royalty', desc: '30 day streak' },
    goal_crusher: { icon: '🎯', name: 'Goal Crusher', desc: 'Hit your daily goal' },
    marathon: { icon: '🏃', name: 'Marathon', desc: '3 hours in one day' },
    card_shark: { icon: '🃏', name: 'Card Shark', desc: 'Reviewed 50 flashcards' },
    board_reader: { icon: '📸', name: 'Board Reader', desc: 'Snapped the board 5 times' },
    perfect_quiz: { icon: '💯', name: 'Perfect Score', desc: 'Got every question right in a quiz' },
    mission: { icon: '🎯', name: 'Mission Done', desc: 'Finished all 3 daily missions' },
    lost_found: { icon: '🧭', name: 'Lost & Found', desc: 'Cleared 5 “lost here” moments' },
    sniper: { icon: '🎯', name: 'Doubt Sniper', desc: 'Sniped 5 parts of the board' },
    iron_will: { icon: '🛡️', name: 'Iron Will', desc: 'Guardian sent you back to studies 10 times' },
    chatterbox: { icon: '🎙️', name: 'Chatterbox', desc: 'Talked with Piniso for 30 minutes' },
    teacher: { icon: '🧑‍🏫', name: 'The Teacher', desc: 'Taught Piniso a concept in Teach mode' },
    rapid_king: { icon: '⚡', name: 'Rapid King', desc: '8+ correct in a voice rapid-fire round' },
    anywhere: { icon: '🖥️', name: 'Study Anywhere', desc: 'Studied from a desktop app with Screen mode' },
    meme_lord: { icon: '🤡', name: 'Meme Lord', desc: 'Made a lecture meme' }
  };

  // Things unlocked by level (everything else is free to design with).
  const UNLOCKS = {
    'aura:glow': 3,
    'hat:crown': 5,
    'hat:wizard': 6,
    'hold:golden': 7,
    'hat:halo': 8,
    'aura:orbit': 10
  };

  const ACCESSORIES = {
    hat: [
      ['none', 'None'], ['sprout', 'Sprout'], ['cap', 'Cap'], ['grad', 'Grad hat'], ['beanie', 'Beanie'],
      ['bow', 'Bow'], ['headphones', 'Headphones'], ['party', 'Party hat'], ['crown', 'Crown'],
      ['wizard', 'Wizard'], ['halo', 'Halo']
    ],
    face: [
      ['none', 'None'], ['round', 'Round glasses'], ['square', 'Square glasses'], ['nerd', 'Topper glasses'],
      ['sun', 'Sunglasses'], ['monocle', 'Monocle'], ['mustache', 'Mustache']
    ],
    neck: [
      ['none', 'None'], ['bowtie', 'Bow tie'], ['tie', 'Tie'], ['scarf', 'Scarf'], ['medal', 'Medal'], ['idcard', 'Topper ID']
    ],
    hold: [
      ['pencil', 'Pencil'], ['highlighter', 'Highlighter'], ['pen', 'Pen'], ['chai', 'Chai'], ['book', 'Book'],
      ['golden', 'Golden pencil'], ['none', 'Nothing']
    ],
    eyes: [['round', 'Round'], ['sparkle', 'Sparkle'], ['dot', 'Dots'], ['anime', 'Anime'], ['sleepy', 'Sleepy']],
    aura: [['none', 'None'], ['sparkles', 'Sparkles'], ['glow', 'Glow'], ['orbit', 'Orbit stars']]
  };

  const MUSIC_MODES = [
    ['off', 'Off'], ['lofi', 'Lo-fi beats'], ['rain', 'Rain'], ['brown', 'Brown noise'],
    ['forest', 'Forest'], ['space', 'Deep space'], ['examhall', 'Exam hall']
  ];

  const STUDY_SITES = /(^|\.)(youtube\.com|youtube-nocookie\.com|unacademy\.com|pw\.live|khanacademy\.org|coursera\.org|udemy\.com|vedantu\.com|byjus\.com|nptel\.ac\.in|edx\.org)$/;
  const VOICE_MODES = [
    ['buddy', '😄 Study buddy', 'Chat about the lecture, ask anything'],
    ['teach', '🧑‍🏫 Teach Piniso', 'Piniso acts confused — you explain the concept'],
    ['socratic', '🤔 Socratic', 'Piniso only asks guiding questions, never gives answers'],
    ['vquiz', '🎙️ Voice quiz', 'Your quiz, asked out loud — answer by speaking'],
    ['rapid', '⚡ Rapid-fire quiz', '10 quick voice questions from the lecture'],
    ['coach', '🛡️ Focus coach', 'Plans your session and keeps you on track']
  ];
  const GEMINI_VOICES = ['Puck', 'Kore', 'Charon', 'Fenrir', 'Aoede', 'Leda', 'Orus', 'Zephyr'];
  const LANGS = [['hinglish', 'Hinglish'], ['english', 'English'], ['hindi', 'हिंदी (Hindi)'], ['auto', 'Same as lecture']];

  function deepMerge(base, patch) {
    if (patch === undefined) return clone(base);
    if (base === null || typeof base !== 'object' || Array.isArray(base)) return clone(patch);
    if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) return clone(patch);
    const out = {};
    for (const k of new Set([...Object.keys(base), ...Object.keys(patch)])) {
      if (k in patch) out[k] = (k in base) ? deepMerge(base[k], patch[k]) : clone(patch[k]);
      else out[k] = clone(base[k]);
    }
    return out;
  }
  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }

  function themeOf(settings) {
    const ui = (settings && settings.ui) || DEFAULTS.ui;
    const base = THEMES[ui.theme] || THEMES['ink-paper'];
    return ui.theme === 'custom' && ui.custom ? Object.assign({}, THEMES['ink-paper'], ui.custom) : base;
  }

  function petOf(settings) {
    const pet = Object.assign({}, DEFAULTS.pet, (settings && settings.pet) || {});
    if (pet.followTheme) {
      const t = themeOf(settings);
      if (t.pet) Object.assign(pet, t.pet);
    }
    return pet;
  }

  globalThis.PINISO_DEFAULTS = DEFAULTS;
  globalThis.PINISO = {
    STUDY_SITES, VOICE_MODES, GEMINI_VOICES,
    THEMES, DEFAULTS, PROVIDERS, LEVELS, BADGES, UNLOCKS, ACCESSORIES, MUSIC_MODES, LANGS,
    xpForLevel, levelFromXP, levelTitle, deepMerge, clone, themeOf, petOf,
    VERSION: '3.1.1'
  };
})();
