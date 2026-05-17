/**
 * Web3House — “Take The Quiz” content, scoring, and result profiles
 * Extensible: answers + resultId can be persisted for badges / paths later.
 */
(function (global) {
  "use strict";

  var STORAGE_KEY = "w3h-quiz-profile-v1";

  var QUESTIONS = [
    {
      id: "fun",
      category: "vibe",
      prompt: "What sounds most fun in Web3?",
      options: [
        { id: "art", label: "Discovering cool art", emoji: "🎨", scores: { creative: 3, cozy: 1 } },
        { id: "people", label: "Meeting new communities", emoji: "🤝", scores: { scout: 3, explorer: 1 } },
        { id: "trade", label: "Trading and strategy", emoji: "📈", scores: { culture: 2, explorer: 2 } },
        { id: "build", label: "Building projects", emoji: "🛠️", scores: { builder: 3, creative: 1 } },
        { id: "culture", label: "Exploring internet culture", emoji: "✨", scores: { culture: 3, explorer: 2 } },
      ],
    },
    {
      id: "wallet",
      category: "experience",
      prompt: "Have you used a crypto wallet before?",
      options: [
        { id: "never", label: "Never", emoji: "🌱", scores: { safe: 3, explorer: 2, cozy: 1 } },
        { id: "little", label: "A little", emoji: "👀", scores: { safe: 2, explorer: 2 } },
        { id: "sometimes", label: "Sometimes", emoji: "🙂", scores: { explorer: 2, scout: 1 } },
        { id: "often", label: "All the time", emoji: "⚡", scores: { culture: 2, builder: 1, scout: 1 } },
      ],
    },
    {
      id: "dm",
      category: "safety",
      prompt: "Someone DMs you a “support” link. What do you do?",
      tip: "Great instinct — scammers often impersonate moderators or support staff. Always verify through official channels.",
      options: [
        { id: "click", label: "Click it immediately", emoji: "⚠️", scores: { culture: 1 } },
        { id: "ignore", label: "Ignore it", emoji: "🙈", scores: { safe: 1 } },
        {
          id: "verify",
          label: "Verify through official channels",
          emoji: "✅",
          scores: { safe: 3, scout: 1 },
          preferred: true,
        },
        { id: "free", label: "Ask for free NFTs", emoji: "🎁", scores: { culture: 1 } },
      ],
    },
    {
      id: "secret",
      category: "safety",
      prompt: "What should NEVER be shared?",
      tip: "Your seed phrase is the master key to a wallet. No real team will ever ask for it.",
      options: [
        { id: "address", label: "Wallet address", emoji: "📬", scores: { explorer: 1 } },
        { id: "ens", label: "ENS name", emoji: "🏷️", scores: { explorer: 1 } },
        {
          id: "seed",
          label: "Seed phrase",
          emoji: "🔐",
          scores: { safe: 3, explorer: 1 },
          preferred: true,
        },
        { id: "twitter", label: "Twitter username", emoji: "🐦", scores: { scout: 1 } },
      ],
    },
    {
      id: "communities",
      category: "community",
      prompt: "What kind of communities do you enjoy?",
      options: [
        { id: "cozy", label: "Cozy / chill", emoji: "🛋️", scores: { cozy: 3, safe: 1 } },
        { id: "creative", label: "Creative / art", emoji: "🖼️", scores: { creative: 3 } },
        { id: "competitive", label: "Competitive", emoji: "🏆", scores: { culture: 2, builder: 1 } },
        { id: "meme", label: "Meme chaos", emoji: "😂", scores: { culture: 3 } },
        { id: "dev", label: "Builder / dev", emoji: "💻", scores: { builder: 3, scout: 1 } },
      ],
    },
    {
      id: "learn",
      category: "vibe",
      prompt: "How do you like to learn something new?",
      options: [
        { id: "browse", label: "Browse and explore at my pace", emoji: "🧭", scores: { explorer: 3, cozy: 1 } },
        { id: "chat", label: "Talk with people in the community", emoji: "💬", scores: { scout: 3, cozy: 1 } },
        { id: "hands", label: "Jump in and try it", emoji: "🚀", scores: { builder: 2, culture: 2 } },
        { id: "guides", label: "Follow clear guides first", emoji: "📖", scores: { safe: 3, explorer: 1 } },
      ],
    },
    {
      id: "mint",
      category: "safety",
      prompt: "You see a “guaranteed 10×” mint link. What now?",
      tip: "If it sounds too good to be true, pause. Real projects share official links — not random DMs.",
      options: [
        { id: "mint", label: "Mint right away", emoji: "⚡", scores: { culture: 2 } },
        {
          id: "research",
          label: "Research official channels first",
          emoji: "🔍",
          scores: { safe: 3, explorer: 2 },
          preferred: true,
        },
        { id: "share", label: "Share it with friends", emoji: "📣", scores: { scout: 1 } },
        { id: "skip", label: "Skip it — feels sketchy", emoji: "🛡️", scores: { safe: 2, cozy: 1 } },
      ],
    },
    {
      id: "night",
      category: "vibe",
      prompt: "Your ideal Web3 night feels like…",
      options: [
        { id: "porch", label: "A cozy porch hang", emoji: "🏡", scores: { cozy: 3, safe: 1 } },
        { id: "gallery", label: "An art gallery opening", emoji: "🎭", scores: { creative: 3 } },
        { id: "arena", label: "A competitive arena", emoji: "🎮", scores: { culture: 2, builder: 1 } },
        { id: "party", label: "A meme-fueled party", emoji: "🎉", scores: { culture: 3 } },
      ],
    },
    {
      id: "why",
      category: "community",
      prompt: "What brings you to Web3House today?",
      options: [
        { id: "find", label: "Find communities to explore", emoji: "🗺️", scores: { explorer: 3, scout: 2 } },
        { id: "safe", label: "Learn how to stay safe", emoji: "🛡️", scores: { safe: 3, cozy: 1 } },
        { id: "art", label: "See art and culture", emoji: "🎨", scores: { creative: 2, culture: 2 } },
        { id: "unsure", label: "I'm not sure yet — just curious", emoji: "✨", scores: { explorer: 2, cozy: 2, safe: 1 } },
      ],
    },
  ];

  var RESULTS = {
    "curious-explorer": {
      id: "curious-explorer",
      title: "Curious Explorer",
      badge: "🧭",
      tagline: "You belong in the discovery wing of Web3House.",
      description:
        "You enjoy discovering communities, learning the culture behind Web3, and exploring safely at your own pace.",
      guidance: [
        "Start with community stories — no wallet needed to browse Web3House.",
        "Bookmark official links before joining any Discord or mint.",
        "Take your time — the best communities reward patience over hype.",
      ],
      communityTypes: ["Story-driven collections", "Welcoming newcomer hubs", "Culture-first projects"],
      communityIds: ["little-ollie", "longlost", "space-riders", "ogenies"],
      accent: "#6de0ff",
    },
    "cozy-collector": {
      id: "cozy-collector",
      title: "Cozy Collector",
      badge: "🛋️",
      tagline: "You belong by the warm hearth of the Web3House community.",
      description:
        "You prefer chill vibes, friendly spaces, and collecting art that feels like home — without the pressure.",
      guidance: [
        "Look for communities with clear rules and kind moderators.",
        "Follow art you love before worrying about floor prices.",
        "Little Ollie Labs projects are built with families and cozy culture in mind.",
      ],
      communityTypes: ["Chill holder chats", "Family-friendly art", "Low-pressure collectibles"],
      communityIds: ["little-ollie", "quirklings", "killabears", "ogenies"],
      accent: "#ffdd55",
    },
    "community-scout": {
      id: "community-scout",
      title: "Community Scout",
      badge: "🤝",
      tagline: "You belong in the rooms where people actually show up.",
      description:
        "You're energized by people, events, and finding your crew — the social heartbeat of Web3 is your thing.",
      guidance: [
        "Join one community deeply before spreading across ten Discords.",
        "Introduce yourself — great projects love genuine newcomers.",
        "Use Web3House founder links so you know channels are real.",
      ],
      communityTypes: ["Active Discord cultures", "Event-driven communities", "Cross-collection friend groups"],
      communityIds: ["quirkies", "ddg", "ogenies", "space-riders"],
      accent: "#4c6fff",
    },
    "creative-builder": {
      id: "creative-builder",
      title: "Creative Builder",
      badge: "🛠️",
      tagline: "You belong in the creative studio corner of Web3House.",
      description:
        "You see Web3 as a canvas — art, experiments, and building things that outlast the hype cycle.",
      guidance: [
        "Explore collections with strong visual identity and creator energy.",
        "Share work-in-progress — many communities celebrate builders.",
        "Never rush a mint; study the art and the team first.",
      ],
      communityTypes: ["Art-forward PFPs", "Lore-rich worlds", "Maker-friendly ecosystems"],
      communityIds: ["quirkies", "ddg", "longlost", "akidcalledbeast"],
      accent: "#c084fc",
    },
    "culture-hunter": {
      id: "culture-hunter",
      title: "Culture Hunter",
      badge: "✨",
      tagline: "You belong where the memes and legends are made.",
      description:
        "You're here for the energy — trends, personality, and communities that don't take themselves too seriously.",
      guidance: [
        "Have fun, but keep one eye on official links vs. random DMs.",
        "Meme culture moves fast — verify before you click.",
        "The best chaos still has real people behind it.",
      ],
      communityTypes: ["High-energy Twitter/X cultures", "Meme-friendly collectives", "Bold visual brands"],
      communityIds: ["ddg", "quirkies", "longlost", "call-of-the-stars"],
      accent: "#e63cb4",
    },
    "safe-explorer": {
      id: "safe-explorer",
      title: "Safe Explorer",
      badge: "🛡️",
      tagline: "You belong on the smart, safe path through the Web3House doors.",
      description:
        "You're curious but careful — exactly the energy Web3 needs more of. You learn first, then explore with confidence.",
      guidance: [
        "Use Web3House's New to Web3 guides before connecting a wallet.",
        "Official links only — bookmark them from project pages.",
        "If something feels rushed or secretive, trust that feeling.",
      ],
      communityTypes: ["Well-moderated communities", "Transparent teams", "Beginner-friendly guides"],
      communityIds: ["little-ollie", "ogenies", "space-riders", "killabears"],
      accent: "#8b9cff",
    },
  };

  var SCORE_KEYS = ["explorer", "cozy", "scout", "creative", "builder", "culture", "safe"];

  function emptyScores() {
    var s = {};
    SCORE_KEYS.forEach(function (k) {
      s[k] = 0;
    });
    return s;
  }

  function addScores(target, delta) {
    if (!delta) return;
    Object.keys(delta).forEach(function (k) {
      target[k] = (target[k] || 0) + (delta[k] || 0);
    });
  }

  /**
   * @param {Record<string, string>} answers questionId -> optionId
   */
  function computeResult(answers) {
    var totals = emptyScores();
    var safetyCorrect = 0;
    var safetyTotal = 0;

    QUESTIONS.forEach(function (q) {
      var optionId = answers[q.id];
      if (!optionId) return;
      var option = q.options.filter(function (o) {
        return o.id === optionId;
      })[0];
      if (!option) return;
      addScores(totals, option.scores);
      if (q.category === "safety") {
        safetyTotal += 1;
        if (option.preferred) safetyCorrect += 1;
      }
    });

    var bestId = "curious-explorer";
    var bestScore = -1;
    Object.keys(RESULTS).forEach(function (rid) {
      var meta = RESULTS[rid];
      var match = 0;
      if (rid === "curious-explorer") match = totals.explorer + totals.cozy * 0.5;
      if (rid === "cozy-collector") match = totals.cozy + totals.creative * 0.4;
      if (rid === "community-scout") match = totals.scout + totals.explorer * 0.3;
      if (rid === "creative-builder") match = totals.builder + totals.creative;
      if (rid === "culture-hunter") match = totals.culture + totals.builder * 0.25;
      if (rid === "safe-explorer") match = totals.safe * 1.2 + totals.explorer * 0.35;
      if (match > bestScore) {
        bestScore = match;
        bestId = rid;
      }
    });

    if (safetyTotal >= 2 && safetyCorrect === safetyTotal && totals.safe >= 6) {
      bestId = "safe-explorer";
    }

    return {
      resultId: bestId,
      profile: RESULTS[bestId],
      scores: totals,
      safetyScore: safetyTotal ? Math.round((safetyCorrect / safetyTotal) * 100) : null,
    };
  }

  function loadSavedProfile() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function saveProfile(payload) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          Object.assign({ version: 1, savedAt: Date.now() }, payload)
        )
      );
    } catch (e) {
      /* ignore */
    }
  }

  global.Web3HouseQuizData = {
    STORAGE_KEY: STORAGE_KEY,
    QUESTIONS: QUESTIONS,
    RESULTS: RESULTS,
    computeResult: computeResult,
    loadSavedProfile: loadSavedProfile,
    saveProfile: saveProfile,
  };
})(window);
