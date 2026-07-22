"use strict";

const app = document.getElementById("app");
const STORAGE_KEY = "spiderVerseHangmanCrossclimbSave";
const { hangmanWords: expandedHangmanWords } = window.GAME_DATA;
const expandedCrossclimbDatabase = window.CROSSCLIMB_DATA;

const gameMeta = [
  {
    id: "hangman",
    title: "Hangman",
    variant: "ULTIMATE SPIDER-MAN",
    blurb: "A cute desk-toy rescue with comic-book energy.",
    icon: "spidey.png",
    glow: "rgba(255, 209, 102, 0.38)"
  },
  {
    id: "crossclimb",
    title: "Crossclimb",
    variant: "SPIDER-MAN 2099",
    blurb: "Cyberpunk word ladder with a neon spider climb.",
    icon: "spidey.png",
    glow: "rgba(46, 229, 157, 0.36)"
  }
];

const defaultSave = {
  highScores: {
    hangman: 0,
    crossclimb: 0
  },
  lastPlayedGame: "",
  homeMode: "quadrants",
  darkMode: true,
  soundOn: false,
  recentPuzzleIds: {
    hangman: [],
    crossclimb: []
  },
  hangmanCurrentStreak: 0,
  hangmanBestStreak: 0,
  crossclimbIntroSeen: false,
  crossclimbDifficulty: null
};

let save = loadSave();
let currentCleanup = null;
let audioContext = null;

const gameState = {
  hangman: null,
  crossclimb: null
};

function loadSave() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      ...defaultSave,
      ...stored,
      highScores: {
        ...defaultSave.highScores,
        ...(stored.highScores || {})
      },
      recentPuzzleIds: {
        ...defaultSave.recentPuzzleIds,
        ...(stored.recentPuzzleIds || {})
      }
    };
  } catch {
    return JSON.parse(JSON.stringify(defaultSave));
  }
}

function persistSave() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  syncTheme();
}

function syncTheme() {
  document.body.classList.toggle("light-mode", !save.darkMode);
}

function syncChromeLabels() {
  document.querySelectorAll("[data-dark-toggle]").forEach((button) => {
    button.textContent = save.darkMode ? "Light" : "Dark";
    button.setAttribute("aria-label", save.darkMode ? "Switch to light mode" : "Switch to dark mode");
  });
  document.querySelectorAll("[data-sound-toggle]").forEach((button) => {
    button.textContent = save.soundOn ? "Sound On" : "Sound Off";
    button.setAttribute("aria-label", save.soundOn ? "Turn sound off" : "Turn sound on");
  });
  document.querySelectorAll("[data-home-mode-toggle]").forEach((button) => {
    button.textContent = save.homeMode === "menu" ? "Quadrants" : "Menu";
    button.setAttribute("aria-label", save.homeMode === "menu" ? "Show quadrant home" : "Show menu home");
  });
}

function setupChrome() {
  app.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => navigate(button.dataset.route));
  });
  app.querySelectorAll("[data-home]").forEach((button) => {
    button.addEventListener("click", () => navigate("home"));
  });
  app.querySelectorAll("[data-back]").forEach((button) => {
    button.addEventListener("click", goBack);
  });
  app.querySelectorAll("[data-dark-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      save.darkMode = !save.darkMode;
      persistSave();
      syncChromeLabels();
      playSound("click");
    });
  });
  app.querySelectorAll("[data-sound-toggle]").forEach((button) => {
    button.addEventListener("click", async () => {
      save.soundOn = !save.soundOn;
      persistSave();
      syncChromeLabels();
      if (save.soundOn) {
        await ensureAudio();
        playSound("click");
      }
    });
  });
  app.querySelectorAll("[data-home-mode-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      save.homeMode = save.homeMode === "menu" ? "quadrants" : "menu";
      persistSave();
      playSound("click");
      renderHome();
    });
  });
  syncChromeLabels();
}

function navigate(route) {
  if (route !== "home") {
    save.lastPlayedGame = route;
    persistSave();
  }
  playSound("click");
  const target = route === "home" ? "" : route;
  if (location.hash.replace("#", "") === target) {
    renderRoute();
  } else {
    location.hash = target;
  }
}

function goBack() {
  playSound("click");
  if (history.length > 1 && location.hash) {
    history.back();
    setTimeout(() => {
      if (location.hash) return;
      renderRoute();
    }, 80);
  } else {
    navigate("home");
  }
}

function setView(markup, setup) {
  if (typeof currentCleanup === "function") {
    currentCleanup();
  }
  currentCleanup = null;
  app.innerHTML = markup;
  setupChrome();
  requestAnimationFrame(() => {
    const view = app.querySelector(".view");
    if (view) view.classList.add("is-visible");
  });
  if (typeof setup === "function") {
    currentCleanup = setup() || null;
  }
}

function renderRoute() {
  syncTheme();
  const route = location.hash.replace("#", "") || "home";
  document.body.dataset.route = route;
  if (route === "home") return renderHome();
  if (route === "hangman") return renderHangman();
  if (route === "crossclimb") return renderCrossclimb();
  navigate("home");
}

function chromeHome() {
  return `
    <header class="topbar">
      <div class="brand">
        <img src="spidey.png" alt="" width="100" height="100">
        <span>Spider-Verse Arcade</span>
      </div>
      <div class="nav-actions">
        <button class="btn small" type="button" data-home-mode-toggle>Menu</button>
        <button class="btn small" type="button" data-dark-toggle>Dark</button>
        <button class="btn small" type="button" data-sound-toggle>Sound Off</button>
      </div>
    </header>
  `;
}

function chromeGame(title) {
  return `
    <header class="topbar">
      <div class="game-nav">
        <button class="btn small" type="button" data-back>Back</button>
        <button class="btn small" type="button" data-home>Home</button>
      </div>
      <h2>${escapeHtml(title)}</h2>
      <div class="nav-actions">
        <button class="btn small" type="button" data-dark-toggle>Dark</button>
        <button class="btn small" type="button" data-sound-toggle>Sound Off</button>
      </div>
    </header>
  `;
}

function gameShell(id, title, content) {
  return `
    <main class="view game-shell" data-game="${id}">
      ${chromeGame(title)}
      <section class="game-panel">
        <div class="panel-inner">${content}</div>
      </section>
    </main>
  `;
}

function renderHome() {
  const lastGame = gameMeta.find((game) => game.id === save.lastPlayedGame);
  const cards = gameMeta.map((game) => `
    <button class="game-card" type="button" data-route="${game.id}" style="--card-glow: ${game.glow}">
      <img class="card-icon" src="${game.icon}" alt="">
      <div>
        <span class="variant-label">${game.variant}</span>
        <h3>${game.title}</h3>
        <p>${game.blurb}</p>
        <p class="mini-stat">${scoreLabel(game.id)}</p>
      </div>
    </button>
  `).join("");
  const quadrants = gameMeta.map((game) => `
    <button class="home-quadrant home-quadrant-${game.id}" type="button" data-route="${game.id}" style="--card-glow: ${game.glow}">
      <span class="variant-art" aria-hidden="true"></span>
      <img class="card-icon" src="${game.icon}" alt="">
      <div>
        <span class="variant-label">${game.variant}</span>
        <h3>${game.title}</h3>
        <p>${game.blurb}</p>
        <p class="mini-stat">${scoreLabel(game.id)}</p>
      </div>
    </button>
  `).join("");

  setView(`
    <main class="view">
      ${chromeHome()}
      <section class="hero">
        <div class="hero-copy">
          <span class="kicker">Friendly Neighborhood Arcade</span>
          <h1>Spider-Verse Mini Games</h1>
          <p>Two Spider-variant mini games in one local page, with web-slung transitions, parallax textures, and saved scores.</p>
          ${lastGame ? `<p class="last-played">Last played: <strong>${lastGame.title}</strong></p>` : ""}
        </div>
      </section>
      ${save.homeMode === "menu"
        ? `<section class="menu-grid" aria-label="Game menu">${cards}</section>`
        : `<section class="quadrant-grid" aria-label="Game menu">${quadrants}</section>`
      }
    </main>
  `);
}

function scoreLabel(id) {
  const value = save.highScores[id] || 0;
  if (id === "hangman") return `Wins ${value} · Best streak ${save.hangmanBestStreak || 0}`;
  if (id === "crossclimb") return `Best climb ${value}`;
  return "";
}

async function ensureAudio() {
  if (!audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    audioContext = new AudioCtx();
  }
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }
  return audioContext;
}

function playSound(type) {
  if (!save.soundOn) return;
  ensureAudio().then((ctx) => {
    if (!ctx) return;
    const profiles = {
      click: [420, 0.05, "square", 0.04],
      web: [720, 0.12, "sawtooth", 0.06],
      victory: [880, 0.22, "triangle", 0.08],
      error: [150, 0.16, "sawtooth", 0.08]
    };
    const [freq, duration, typeName, gainLevel] = profiles[type] || profiles.click;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = typeName;
    oscillator.frequency.value = freq;
    gain.gain.value = gainLevel;
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    oscillator.stop(ctx.currentTime + duration + 0.02);
  }).catch(() => {});
}

function shuffle(array) {
  const copy = array.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function lettersOnly(value) {
  return value.replace(/[^a-z]/gi, "").toUpperCase();
}

function selectFreshWeighted(items, gameKey) {
  const maxRecent = Math.max(4, Math.floor(items.length * 0.35));
  const validIds = new Set(items.map((item) => item.id));
  const recent = (save.recentPuzzleIds[gameKey] || []).filter((id) => validIds.has(id)).slice(-maxRecent);
  let available = items.filter((item) => !recent.includes(item.id));

  if (!available.length) {
    recent.length = 0;
    available = items.slice();
  }

  const difficultyWeight = { Easy: 5, Medium: 3, Hard: 1 };
  const weighted = available.flatMap((item) => Array(difficultyWeight[item.difficulty] || 2).fill(item));
  const selected = weighted[Math.floor(Math.random() * weighted.length)];
  save.recentPuzzleIds[gameKey] = [...recent, selected.id].slice(-maxRecent);
  persistSave();
  return selected;
}

function markReady() {
  document.body.classList.add("app-ready");
  document.body.classList.remove("is-loading");
  window.setTimeout(() => document.querySelector(".initial-loader")?.remove(), 420);
}

function prepareInitialView() {
  const criticalImages = ["background-optimized.jpg", "spidey.png"].map((src) => new Promise((resolve) => {
    const image = new Image();
    image.onload = image.onerror = resolve;
    image.src = src;
  }));
  Promise.race([
    Promise.all(criticalImages),
    new Promise((resolve) => window.setTimeout(resolve, 850))
  ]).then(() => requestAnimationFrame(markReady));
}


const hangmanWords = [
  { answer: "JAVASCRIPT", hint: "The language powering this arcade." },
  { answer: "ALGORITHM", hint: "A step-by-step problem solving method." },
  { answer: "DATABASE", hint: "Structured storage for app data." },
  { answer: "PYTHON", hint: "A language named after a comedy group." },
  { answer: "GITHUB", hint: "Where many projects keep their repositories." },
  { answer: "MULTIVERSE", hint: "Many worlds, many Spider variants." },
  { answer: "WEBSHOOTER", hint: "Peter's wrist gadget." },
  { answer: "SYMBIOTE", hint: "An alien suit with attitude." },
  { answer: "OSCORP", hint: "A suspicious corporation in Spider lore." },
  { answer: "STARK", hint: "A famous engineer surname." },
  { answer: "REACTOR", hint: "Arc-powered technology core." },
  { answer: "DEBUGGER", hint: "A tool for catching runtime mistakes." },
  { answer: "FRAMEWORK", hint: "A reusable software structure." },
  { answer: "RECURSION", hint: "A function calling itself." },
  { answer: "VARIABLE", hint: "A named value in code." },
  { answer: "NODEJS", hint: "JavaScript outside the browser." },
  { answer: "COMPILER", hint: "Turns source into executable form." },
  { answer: "NETWORK", hint: "Connected machines exchanging data." },
  { answer: "PROTOCOL", hint: "Rules for communication." },
  { answer: "PROCESS", hint: "A running program in an operating system." },
  { answer: "THREAD", hint: "A smaller execution path inside a process." },
  { answer: "DEADLOCK", hint: "When waiting never ends." },
  { answer: "MUTEX", hint: "A lock for shared resources." },
  { answer: "SEMAPHORE", hint: "A signaling primitive in OS theory." },
  { answer: "KERNEL", hint: "The core of an operating system." },
  { answer: "MEMORY", hint: "Programs need it to run." },
  { answer: "CACHE", hint: "Fast storage close to the action." },
  { answer: "BINARY", hint: "Base two representation." },
  { answer: "HASHING", hint: "Maps data to a fixed-size value." },
  { answer: "ENCRYPTION", hint: "Keeps information secret." },
  { answer: "SANDBOX", hint: "An isolated execution environment." },
  { answer: "ACM", hint: "A major computing association." },
  { answer: "RESEARCH", hint: "The R in R&D." },
  { answer: "PROTOTYPE", hint: "An early testable build." },
  { answer: "SPIDERVERSE", hint: "A web of alternate Spider heroes." },
  { answer: "MORALES", hint: "Miles's surname." },
  { answer: "PARKER", hint: "Peter's surname." },
  { answer: "GWEN", hint: "A famous Spider variant first name." },
  { answer: "VENOM", hint: "A black-suited symbiote rival." },
  { answer: "CARNAGE", hint: "A chaotic red symbiote." },
  { answer: "MYSTERIO", hint: "Illusions and a fishbowl helmet." },
  { answer: "ELECTRO", hint: "A lightning-powered villain." },
  { answer: "OCTAVIUS", hint: "Doctor with mechanical arms." },
  { answer: "JARVIS", hint: "Tony Stark's helpful AI." },
  { answer: "VIBRANIUM", hint: "Wakandan super metal." },
  { answer: "NANOTECH", hint: "Tiny machines, big suit upgrades." },
  { answer: "DISPLAY", hint: "A screen or visual output surface." },
  { answer: "INTERFACE", hint: "Where user and system meet." },
  { answer: "FUNCTION", hint: "Reusable code with inputs and output." },
  { answer: "OBJECT", hint: "Data plus behavior in many languages." }
];

const MAX_WRONG = 6;

function createHangmanState() {
  const word = selectFreshWeighted(expandedHangmanWords, "hangman");
  return {
    word,
    guessed: new Set(),
    wrong: new Set(),
    hintLevel: 0,
    hintedLetter: "",
    feedback: "Choose a letter to begin the rescue.",
    feedbackTone: "neutral",
    finished: false,
    won: false,
    newHighScore: false
  };
}

function renderHangman() {
  gameState.hangman = createHangmanState();
  setView(gameShell("hangman", "Hangman", `
    <div id="hangman-root"></div>
  `), () => setupHangman(document.getElementById("hangman-root")));
}

function setupHangman(root) {
  renderHangmanGame(root);
  const onKeyDown = (event) => {
    if (location.hash.replace("#", "") !== "hangman") return;
    const letter = event.key.toUpperCase();
    if (/^[A-Z]$/.test(letter)) {
      event.preventDefault();
      guessHangmanLetter(letter, root);
    }
  };
  window.addEventListener("keydown", onKeyDown);
  root.addEventListener("click", (event) => {
    const key = event.target.closest("[data-letter]");
    const action = event.target.closest("[data-hangman-action]");
    if (key) {
      guessHangmanLetter(key.dataset.letter, root);
      return;
    }
    if (!action) return;
    if (action.dataset.hangmanAction === "restart") {
      gameState.hangman = createHangmanState();
      playSound("click");
      renderHangmanGame(root);
    }
    if (action.dataset.hangmanAction === "hint") useHangmanHint(root);
  });
  return () => window.removeEventListener("keydown", onKeyDown);
}

function renderHangmanGame(root) {
  const state = gameState.hangman;
  const answer = state.word.answer;
  const wrongCount = state.wrong.size;
  const slots = answer.split("").map((char) => {
    if (char === " ") return `<span class="letter-slot space" aria-hidden="true"></span>`;
    if (!/[A-Z]/.test(char)) return `<span class="letter-slot filled">${escapeHtml(char)}</span>`;
    const revealed = state.guessed.has(char);
    return `<span class="letter-slot${revealed ? " filled" : ""}">${revealed ? char : ""}</span>`;
  }).join("");

  const keyboard = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter) => {
    const used = state.guessed.has(letter) || state.wrong.has(letter);
    const keyClass = state.guessed.has(letter) ? " correct" : state.wrong.has(letter) ? " wrong" : "";
    return `<button class="key${keyClass}" type="button" data-letter="${letter}" ${used || state.finished ? "disabled" : ""}>${letter}</button>`;
  }).join("");

  const status = state.finished
    ? state.won
      ? "You saved the figurine!"
      : `Final answer: ${answer}`
    : `${MAX_WRONG - wrongCount} wrong moves left`;

  const hintContent = state.hintLevel === 0
    ? "Use a hint if you get stuck."
    : `<strong>${escapeHtml(state.word.hint)}</strong>${state.hintedLetter ? `<span>Web assist revealed the letter <b>${state.hintedLetter}</b>.</span>` : ""}`;

  const resultMarkup = state.finished ? `
    <section class="round-result ${state.won ? "success" : "failure"}" aria-live="assertive">
      <div>
        <strong>${state.won ? "Rescue complete!" : "The web snapped this time."}</strong>
        <span>${state.won ? `${state.newHighScore ? "New best streak! " : ""}Current streak: ${save.hangmanCurrentStreak}.` : `The answer was ${answer}. Try another friendly puzzle.`}</span>
      </div>
      <button class="btn primary play-again" type="button" data-hangman-action="restart">Play Again</button>
    </section>
  ` : "";

  root.innerHTML = `
    <div class="game-topline ${state.finished ? (state.won ? "round-won" : "round-lost") : ""}">
      <div>
        <h3>Spider Stand Rescue</h3>
        <p class="notice">${status}</p>
      </div>
      <div class="status-strip">
        <span class="pill">${escapeHtml(state.word.category)}</span>
        <span class="pill difficulty-${state.word.difficulty.toLowerCase()}">${state.word.difficulty}</span>
        <span class="pill">Wrong ${wrongCount}/${MAX_WRONG}</span>
        <button class="btn small hint-button ${state.hintLevel ? "used" : ""}" type="button" data-hangman-action="hint" ${state.finished || state.hintLevel >= 2 ? "disabled" : ""}>${state.hintLevel === 0 ? "Show Hint" : "Reveal a Letter"}</button>
        <button class="btn small" type="button" data-hangman-action="restart">New Word</button>
      </div>
    </div>
    <p class="game-feedback ${state.feedbackTone}" role="status">${escapeHtml(state.feedback)}</p>
    <div class="hangman-layout">
      <div class="hangman-stage wrong-${wrongCount}" aria-label="Animated Spider-Man figurine stand">
        ${hangmanSvg()}
      </div>
      <div>
        <div class="hint-box hint-level-${state.hintLevel}">${hintContent}</div>
        <div class="word-display" aria-label="Word">${slots}</div>
        <div class="keyboard" aria-label="Letter keyboard">${keyboard}</div>
      </div>
    </div>
    ${resultMarkup}
  `;
}

function useHangmanHint(root) {
  const state = gameState.hangman;
  if (!state || state.finished || state.hintLevel >= 2) return;
  state.hintLevel += 1;
  state.feedbackTone = "hint";

  if (state.hintLevel === 1) {
    state.feedback = "Hint unlocked — follow the clue beneath the figure.";
  } else {
    const answerLetters = [...new Set(lettersOnly(state.word.answer).split(""))];
    const unrevealed = answerLetters.filter((letter) => !state.guessed.has(letter));
    const letter = unrevealed[Math.floor(Math.random() * unrevealed.length)];
    if (letter) {
      state.guessed.add(letter);
      state.hintedLetter = letter;
      state.feedback = `Web assist revealed ${letter}.`;
    }
    finishHangmanRound(state);
  }
  playSound("web");
  renderHangmanGame(root);
}

function hangmanSvg() {
  return `
    <svg class="hangman-svg" viewBox="0 0 260 260" aria-hidden="true">
      <defs>
        <linearGradient id="wood" x1="0" x2="1"><stop stop-color="#8a4f25"/><stop offset="1" stop-color="#d19a58"/></linearGradient>
        <clipPath id="hangHeadClip"><circle cx="172" cy="112" r="46"/></clipPath>
        <clipPath id="hangBodyClip"><rect x="132" y="150" width="80" height="66" rx="24"/></clipPath>
      </defs>
      <path class="stand" d="M38 237h172M72 237V35h100v43" fill="none" stroke="url(#wood)" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
      <path class="wood-grain" d="M54 232h132M72 74c24-10 54-10 82 0M72 130c26 9 58 9 86 0" fill="none" stroke="#4c2c18" stroke-width="2" stroke-linecap="round" opacity=".45"/>
      <path class="rope" d="M172 78c-2 28-3 54-2 82" fill="none" stroke="#f5d899" stroke-width="4" stroke-linecap="round"/>
      <g class="figure">
        <g class="toy-shadow">
          <ellipse cx="171" cy="237" rx="44" ry="8" fill="#000" opacity=".22"/>
        </g>

        <g class="toy-limb body-part part-left-leg">
          <path d="M158 214 L150 236" fill="none" stroke="#0f0f10" stroke-width="16" stroke-linecap="round"/>
          <path d="M158 214 L150 236" fill="none" stroke="#e5303f" stroke-width="12" stroke-linecap="round"/>
          <ellipse cx="148" cy="240" rx="12" ry="8" fill="#0e1013"/>
        </g>
        <g class="toy-limb body-part part-right-leg">
          <path d="M184 214 L192 236" fill="none" stroke="#0f0f10" stroke-width="16" stroke-linecap="round"/>
          <path d="M184 214 L192 236" fill="none" stroke="#e5303f" stroke-width="12" stroke-linecap="round"/>
          <ellipse cx="194" cy="240" rx="12" ry="8" fill="#0e1013"/>
        </g>

        <g class="toy-limb body-part part-left-arm">
          <path d="M144 172 L114 188" fill="none" stroke="#0f0f10" stroke-width="15" stroke-linecap="round"/>
          <path d="M144 172 L114 188" fill="none" stroke="#e5303f" stroke-width="11" stroke-linecap="round"/>
        </g>
        <g class="toy-limb body-part part-right-arm">
          <path d="M198 172 L228 188" fill="none" stroke="#0f0f10" stroke-width="15" stroke-linecap="round"/>
          <path d="M198 172 L228 188" fill="none" stroke="#e5303f" stroke-width="11" stroke-linecap="round"/>
        </g>

        <g class="toy-body body-part part-body">
          <rect x="132" y="150" width="80" height="66" rx="24" fill="#e5303f" stroke="#0e1013" stroke-width="3"/>
          <g clip-path="url(#hangBodyClip)">
            <path d="M118 148 L138 151 L146 168 L124 172 Z" fill="#1c72d8" stroke="#0e1013" stroke-width="2.4" stroke-linejoin="round"/>
            <path d="M226 148 L206 151 L198 168 L220 172 Z" fill="#1c72d8" stroke="#0e1013" stroke-width="2.4" stroke-linejoin="round"/>
            <path d="M150 184 L194 184 L186 218 L158 218 Z" fill="#1c72d8" stroke="#0e1013" stroke-width="2.4" stroke-linejoin="round"/>
          </g>
          <g stroke="#0e1013" stroke-width="2.2" fill="#0e1013" stroke-linecap="round">
            <ellipse cx="172" cy="176" rx="4.5" ry="6.5"/>
            <path d="M172 170v-8M172 182v9M163 176h-9M181 176h9M165 169l-7-7M179 169l7-7M165 183l-7 7M179 183l7 7" fill="none"/>
          </g>
        </g>

        <g class="toy-head body-part part-head">
          <circle cx="172" cy="112" r="46" fill="#e5303f" stroke="#0e1013" stroke-width="3.5"/>
          <g clip-path="url(#hangHeadClip)">
            <g class="web-lines" stroke="#0e1013" stroke-width="1.5" opacity=".85">
              <line x1="172" y1="102" x2="242.0" y2="102.0"/>
              <line x1="172" y1="102" x2="232.6" y2="137.0"/>
              <line x1="172" y1="102" x2="207.0" y2="162.6"/>
              <line x1="172" y1="102" x2="172.0" y2="172.0"/>
              <line x1="172" y1="102" x2="137.0" y2="162.6"/>
              <line x1="172" y1="102" x2="111.4" y2="137.0"/>
              <line x1="172" y1="102" x2="102.0" y2="102.0"/>
              <line x1="172" y1="102" x2="111.4" y2="67.0"/>
              <line x1="172" y1="102" x2="137.0" y2="41.4"/>
              <line x1="172" y1="102" x2="172.0" y2="32.0"/>
              <line x1="172" y1="102" x2="207.0" y2="41.4"/>
              <line x1="172" y1="102" x2="232.6" y2="67.0"/>
            </g>
            <g fill="none" stroke="#0e1013" stroke-width="1.5" opacity=".85">
              <circle cx="172" cy="102" r="10"/>
              <circle cx="172" cy="102" r="23"/>
              <circle cx="172" cy="102" r="37"/>
            </g>
          </g>
          <g class="mask-eye" transform="translate(151,110) rotate(24)">
            <path d="M -18,0 A 20,27 0 0 1 18,0 A 20,27 0 0 1 -18,0 Z" fill="#0e1013"/>
            <path d="M -12,0 A 14,19 0 0 1 12,0 A 14,19 0 0 1 -12,0 Z" fill="#ffffff"/>
          </g>
          <g class="mask-eye" transform="translate(193,110) rotate(-24)">
            <path d="M -18,0 A 20,27 0 0 1 18,0 A 20,27 0 0 1 -18,0 Z" fill="#0e1013"/>
            <path d="M -12,0 A 14,19 0 0 1 12,0 A 14,19 0 0 1 -12,0 Z" fill="#ffffff"/>
          </g>
        </g>
      </g>
    </svg>
  `;
}

function guessHangmanLetter(letter, root) {
  const state = gameState.hangman;
  if (!state || state.finished) return;
  const answerLetters = new Set(lettersOnly(state.word.answer).split(""));
  if (state.guessed.has(letter) || state.wrong.has(letter)) return;

  if (answerLetters.has(letter)) {
    state.guessed.add(letter);
    state.feedback = `${letter} is in the word — nice shot!`;
    state.feedbackTone = "success";
    playSound("click");
  } else {
    state.wrong.add(letter);
    state.feedback = `${letter} is not in this word. ${MAX_WRONG - state.wrong.size} wrong moves remain.`;
    state.feedbackTone = "error";
    playSound("error");
  }

  finishHangmanRound(state);
  renderHangmanGame(root);
}

function finishHangmanRound(state) {
  if (state.finished) return;
  const answerLetters = new Set(lettersOnly(state.word.answer).split(""));
  const won = [...answerLetters].every((char) => state.guessed.has(char));

  if (won) {
    state.finished = true;
    state.won = true;
    save.highScores.hangman = (save.highScores.hangman || 0) + 1;
    save.hangmanCurrentStreak = (save.hangmanCurrentStreak || 0) + 1;
    if (save.hangmanCurrentStreak > (save.hangmanBestStreak || 0)) {
      save.hangmanBestStreak = save.hangmanCurrentStreak;
      state.newHighScore = true;
    }
    state.feedback = state.newHighScore ? "Rescue complete — new best streak!" : "Rescue complete — spectacular!";
    state.feedbackTone = "success";
    persistSave();
    playSound("victory");
  } else if (state.wrong.size >= MAX_WRONG) {
    state.finished = true;
    state.won = false;
    save.hangmanCurrentStreak = 0;
    state.feedback = `Round over. The answer was ${state.word.answer}.`;
    state.feedbackTone = "error";
    persistSave();
    playSound("error");
  }
}
const crossclimbDatabase = [
  {
    startWord: "MIND",
    endWord: "MASK",
    category: "Marvel",
    ladder: ["MIND", "WIND", "WING", "RING", "RINK", "RANK", "TANK", "TASK", "MASK"],
    clues: [
      "Infinity Stone tied to thought.",
      "Storm can command it.",
      "Falcon flies with one.",
      "Mystic portals begin with this.",
      "A cold arena for skaters.",
      "A hero's team position.",
      "A heavy armored vehicle.",
      "A mission on the board.",
      "A hero keeps one ready."
    ]
  },
  {
    startWord: "CODE",
    endWord: "DATA",
    category: "Technology",
    ladder: ["CODE", "NODE", "MODE", "MADE", "MATE", "DATE", "DATA"],
    clues: [
      "Instructions developers write.",
      "JavaScript runtime clue.",
      "A setting or state.",
      "Created or built.",
      "A paired teammate.",
      "A calendar value.",
      "Information a program stores."
    ]
  },
  {
    startWord: "BYTE",
    endWord: "BIOS",
    category: "Computer Science",
    ladder: ["BYTE", "BITE", "SITE", "SITS", "BITS", "BIOS"],
    clues: [
      "Eight bits.",
      "Use teeth on something.",
      "A web location.",
      "Takes a seat.",
      "Binary pieces.",
      "Firmware that wakes a PC."
    ]
  },
  {
    startWord: "PARK",
    endWord: "PUNK",
    category: "Spider-Man",
    ladder: ["PARK", "PORK", "PORT", "FORT", "FONT", "PONT", "PUNT", "PUNK"],
    clues: [
      "Peter's surname begins this way.",
      "A meat word.",
      "A network service endpoint.",
      "A defended place.",
      "A typeface family.",
      "A bridge-like root word.",
      "Kick downfield.",
      "Spider variant with a guitar."
    ]
  },
  {
    startWord: "STAR",
    endWord: "SUIT",
    category: "Marvel",
    ladder: ["STAR", "STIR", "SPIR", "SPIT", "SUIT"],
    clues: [
      "What Tony Stark's surname starts with.",
      "Mix with a spoon.",
      "A hidden ladder rung.",
      "A sharp verbal clue.",
      "A hero wears one."
    ]
  },
  {
    startWord: "TEST",
    endWord: "MOCK",
    category: "R&D",
    ladder: ["TEST", "TENT", "TINT", "MINT", "MIND", "MINK", "MONK", "MOCK"],
    clues: [
      "Check if code works.",
      "Temporary shelter.",
      "A color shade.",
      "Fresh green flavor.",
      "Thinking center.",
      "A sleek animal name.",
      "A robed figure.",
      "A test double."
    ]
  }
];

function createCrossclimbState() {
  const pool = save.crossclimbDifficulty
    ? expandedCrossclimbDatabase.filter((p) => p.difficulty === save.crossclimbDifficulty)
    : expandedCrossclimbDatabase;
  const puzzle = selectFreshWeighted(pool, "crossclimb");
  return {
    puzzle,
    current: 1,
    crawling: false,
    lastProgress: 0,
    completed: false,
    hintLevel: 0,
    hintedIndex: -1,
    feedback: `Start with ${puzzle.startWord}, then solve the first clue below it.`,
    feedbackTone: "neutral",
    justSolved: -1,
    hintsUsed: 0,
    newHighScore: false
  };
}

function renderCrossclimbDifficultySelect() {
  const easyCount = expandedCrossclimbDatabase.filter((p) => p.difficulty === "Easy").length;
  const medCount = expandedCrossclimbDatabase.filter((p) => p.difficulty === "Medium").length;
  setView(gameShell("crossclimb", "Crossclimb", `
    <div class="crossclimb-diff-select">
      <h3>Choose Difficulty</h3>
      <p class="cross-diff-subtitle">Shorter ladders are easier, longer ladders are tougher.</p>
      <div class="cross-diff-options">
        <button class="cross-diff-card difficulty-easy" type="button" data-cross-diff="Easy">
          <span class="diff-label">Easy</span>
          <span class="diff-desc">${easyCount} ladders · shorter chains</span>
        </button>
        <button class="cross-diff-card difficulty-medium" type="button" data-cross-diff="Medium">
          <span class="diff-label">Medium</span>
          <span class="diff-desc">${medCount} ladders · longer chains</span>
        </button>
      </div>
    </div>
  `), () => {
    app.addEventListener("click", (event) => {
      const card = event.target.closest("[data-cross-diff]");
      if (!card) return;
      const difficulty = card.dataset.crossDiff;
      save.crossclimbDifficulty = difficulty;
      persistSave();
      playSound("click");
      renderCrossclimb();
    });
  });
}

function renderCrossclimb() {
  if (!save.crossclimbDifficulty) {
    return renderCrossclimbDifficultySelect();
  }
  gameState.crossclimb = createCrossclimbState();
  setView(gameShell("crossclimb", "Crossclimb", `
    <div id="crossclimb-root"></div>
  `), () => setupCrossclimb(document.getElementById("crossclimb-root")));
}

function setupCrossclimb(root) {
  renderCrossclimbGame(root);
  root.addEventListener("submit", (event) => {
    event.preventDefault();
    submitCrossclimb(root);
  });
  root.addEventListener("click", (event) => {
    const action = event.target.closest("[data-cross-action]");
    if (!action) return;
    if (action.dataset.crossAction === "restart") {
      gameState.crossclimb = createCrossclimbState();
      playSound("click");
      renderCrossclimbGame(root);
    }
    if (action.dataset.crossAction === "change-difficulty") {
      save.crossclimbDifficulty = null;
      persistSave();
      playSound("click");
      renderCrossclimb();
    }
    if (action.dataset.crossAction === "hint") useCrossclimbHint(root);
    if (action.dataset.crossAction === "dismiss-intro") {
      save.crossclimbIntroSeen = true;
      persistSave();
      action.closest(".cross-intro")?.remove();
    }
  });
}

function renderCrossclimbGame(root) {
  const state = gameState.crossclimb;
  const entries = state.puzzle.ladder.map((answer, index) => ({
    answer,
    clue: state.puzzle.clues[index]
  }));
  const targetIndex = entries.length - 1;
  const totalMoves = entries.length - 1;
  const solvedMoves = state.completed ? totalMoves : Math.min(totalMoves, Math.max(0, state.current - 1));
  const progress = Math.min(74, (solvedMoves / totalMoves) * 74);
  const startProgress = state.crawling ? state.lastProgress : progress;
  const solvedRows = entries.slice(1, Math.min(state.current, targetIndex)).map((entry, offset) => {
    const index = offset + 1;
    return `
      <div class="cross-row solved ${state.justSolved === index ? "just-solved" : ""}" data-cross-row="${index}">
        <div>
          <span class="rung-label">Solved rung ${index}</span>
          <div class="word-box">${entry.answer}</div>
        </div>
        <div class="cross-clue">${escapeHtml(entry.clue)}</div>
      </div>
    `;
  }).join("");

  const activeEntry = !state.completed ? entries[state.current] : null;
  const activeRow = activeEntry ? `
    <div class="cross-row active" data-cross-row="${state.current}">
      <div>
        <span class="rung-label">Your next word</span>
        <input class="cross-input" name="answer" maxlength="${activeEntry.answer.length}" inputmode="text" autocapitalize="characters" autocomplete="off" aria-label="Answer for ${activeEntry.clue}" autofocus>
      </div>
      <div class="cross-clue">
        <span class="clue-label">Clue ${state.current}</span>
        ${escapeHtml(activeEntry.clue)}
        ${state.hintLevel >= 2 ? `<span class="letter-reveal">Letter pattern: ${activeEntry.answer.split("").map((letter, letterIndex) => letterIndex === state.hintedIndex ? letter : "•").join(" ")}</span>` : ""}
      </div>
    </div>
  ` : "";

  const hiddenIntermediateCount = Math.max(0, targetIndex - state.current - 1);
  const remainingMarker = !state.completed && hiddenIntermediateCount > 0
    ? `<div class="remaining-rungs" aria-label="${hiddenIntermediateCount} more hidden clue rungs">${hiddenIntermediateCount} more clue ${hiddenIntermediateCount === 1 ? "step" : "steps"} after this one</div>`
    : "";

  const targetRow = `
    <div class="cross-row target ${state.completed ? "reached" : ""}" data-cross-row="${targetIndex}">
      <div>
        <span class="rung-label">Target word</span>
        <div class="word-box">${entries[targetIndex].answer}</div>
      </div>
      <div class="cross-clue">Reach this word by changing exactly one letter at every step.</div>
    </div>
  `;

  const intro = save.crossclimbIntroSeen ? "" : `
    <aside class="cross-intro" aria-label="How Crossclimb works">
      <div><strong>Quick example</strong><span class="ladder-example">CAT <b>↓</b> COT <b>↓</b> DOT</span></div>
      <button class="btn small" type="button" data-cross-action="dismiss-intro" aria-label="Dismiss Crossclimb example">Got it</button>
    </aside>
  `;

  const completionText = state.newHighScore
    ? "Spider reached the rooftop — new best climb!"
    : "Spider reached the rooftop!";

  root.innerHTML = `
    <div class="game-topline">
      <div>
        <h3>Word Ladder Climb</h3>
        <p class="cross-instruction">Start with the given word. Solve one clue at a time, moving downward until you reach the visible target word.</p>
        <p class="notice">${escapeHtml(state.puzzle.category)} · ${totalMoves} one-letter changes</p>
      </div>
      <div class="status-strip">
        <span class="pill">Rung ${solvedMoves}/${totalMoves}</span>
        <span class="pill difficulty-${state.puzzle.difficulty.toLowerCase()}">${state.puzzle.difficulty}</span>
        <button class="btn small" type="button" data-cross-action="change-difficulty">Change Difficulty</button>
        <button class="btn small hint-button ${state.hintLevel ? "used" : ""}" type="button" data-cross-action="hint" ${state.completed || state.hintLevel >= 2 ? "disabled" : ""}>${state.hintLevel === 0 ? "Hint" : "Reveal a Letter"}</button>
        <button class="btn small" type="button" data-cross-action="restart">New Ladder</button>
      </div>
    </div>
    ${intro}
    <p class="game-feedback ${state.feedbackTone}" role="status">${escapeHtml(state.feedback)}</p>
    <div class="cross-layout">
      <div class="climb-stage ${state.crawling ? "web-jolt" : ""}">
        <div class="rooftop" aria-hidden="true"></div>
        <div class="web-rope" aria-hidden="true"></div>
        <div class="climb-spider ${state.crawling ? "crawling" : ""}" style="--climb-progress: ${startProgress}%" aria-hidden="true">${neonSpiderSvg()}</div>
        <div class="confetti-layer"></div>
      </div>
      <form class="ladder">
        <div class="cross-row start" data-cross-row="0">
          <div>
            <span class="rung-label">Starting word</span>
            <div class="word-box">${entries[0].answer}</div>
          </div>
          <div class="cross-clue">Begin here. Change exactly one letter to solve Clue 1.</div>
        </div>
        ${solvedRows}
        ${activeRow}
        ${remainingMarker}
        ${targetRow}
        ${state.completed
          ? `<div class="cross-complete">${completionText}<button class="btn primary play-again" type="button" data-cross-action="restart">Climb Again</button></div>`
          : `<button class="btn primary submit-word" type="submit">Submit Word</button>`}
      </form>
    </div>
  `;

  const input = root.querySelector(".cross-input");
  if (input) input.focus();
  const spider = root.querySelector(".climb-spider");
  if (state.crawling && spider) {
    requestAnimationFrame(() => {
      spider.style.setProperty("--climb-progress", `${progress}%`);
    });
  } else {
    state.lastProgress = progress;
  }
  if (state.completed) burstConfetti(root.querySelector(".confetti-layer"));
}

function useCrossclimbHint(root) {
  const state = gameState.crossclimb;
  if (!state || state.completed || state.hintLevel >= 2) return;
  state.hintLevel += 1;
  state.hintsUsed += 1;
  state.feedbackTone = "hint";
  if (state.hintLevel === 1) {
    state.feedback = `Clue focus: ${state.puzzle.clues[state.current]}`;
  } else {
    const answer = state.puzzle.ladder[state.current];
    state.hintedIndex = Math.floor(Math.random() * answer.length);
    state.feedback = `Web assist revealed one position in the ${answer.length}-letter answer.`;
  }
  playSound("web");
  renderCrossclimbGame(root);
}

function neonSpiderSvg() {
  return `
    <svg viewBox="0 0 96 96" class="neon-spider-svg">
      <defs>
        <radialGradient id="spider2099" cx="50%" cy="36%" r="62%">
          <stop stop-color="#ff4b66"/>
          <stop offset=".58" stop-color="#d20b2c"/>
          <stop offset="1" stop-color="#4de9ff"/>
        </radialGradient>
      </defs>
      <g class="spider-legs" fill="none" stroke="#4de9ff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
        <path d="M42 38 24 22 12 18"/>
        <path d="M39 45 20 42 8 48"/>
        <path d="M39 53 22 62 14 76"/>
        <path d="M44 59 34 78 28 88"/>
        <path d="M54 38 72 22 84 18"/>
        <path d="M57 45 76 42 88 48"/>
        <path d="M57 53 74 62 82 76"/>
        <path d="M52 59 62 78 68 88"/>
      </g>
      <ellipse cx="48" cy="54" rx="19" ry="25" fill="url(#spider2099)"/>
      <ellipse cx="48" cy="31" rx="15" ry="14" fill="#07111f" stroke="#ff2f4e" stroke-width="5"/>
      <path d="M38 28c6-5 13-5 20 0M41 35c5 4 9 4 14 0" stroke="#f8fbff" stroke-width="4" stroke-linecap="round" fill="none"/>
      <path d="M48 39v33M37 54h22M40 44c6 7 10 7 16 0M40 64c6-7 10-7 16 0" stroke="#07111f" stroke-width="3" stroke-linecap="round" opacity=".75"/>
    </svg>
  `;
}

function submitCrossclimb(root) {
  const state = gameState.crossclimb;
  if (state.completed) return;
  const input = root.querySelector(".cross-input");
  const guess = lettersOnly(input?.value || "");
  const answer = state.puzzle.ladder[state.current];
  if (guess !== answer) {
    const previous = state.puzzle.ladder[state.current - 1];
    const changes = guess.length === previous.length
      ? [...previous].reduce((total, letter, index) => total + (letter !== guess[index] ? 1 : 0), 0)
      : Number.POSITIVE_INFINITY;
    state.feedback = !guess
      ? "Enter a word before submitting."
      : guess.length !== answer.length
        ? `Use exactly ${answer.length} letters for this rung.`
        : changes !== 1
          ? `Almost — your word must change exactly one letter from ${previous}.`
          : "That fits the one-letter rule, but it does not match this clue. Try another word.";
    state.feedbackTone = "error";
    playSound("error");
    renderCrossclimbGame(root);
    root.querySelector(".cross-row.active")?.classList.add("shake");
    return;
  }
  state.justSolved = state.current;
  state.current += 1;
  state.crawling = true;
  state.hintLevel = 0;
  state.hintedIndex = -1;
  state.feedback = `${answer} is correct — web up to the next rung!`;
  state.feedbackTone = "success";
  playSound("web");
  if (state.current >= state.puzzle.ladder.length - 1) {
    state.completed = true;
    const climbScore = state.puzzle.ladder.length - 1;
    state.newHighScore = climbScore > (save.highScores.crossclimb || 0);
    save.highScores.crossclimb = Math.max(save.highScores.crossclimb || 0, climbScore);
    state.feedback = state.newHighScore
      ? `${answer} connects to ${state.puzzle.endWord} — ladder complete and a new high score!`
      : `${answer} connects to ${state.puzzle.endWord} — ladder complete!`;
    persistSave();
    playSound("victory");
  }
  renderCrossclimbGame(root);
  setTimeout(() => {
    if (gameState.crossclimb === state) {
      state.crawling = false;
      state.justSolved = -1;
      const totalMoves = state.puzzle.ladder.length - 1;
      state.lastProgress = Math.min(74, ((state.current - 1) / totalMoves) * 74);
      root.querySelector(".climb-stage")?.classList.remove("web-jolt");
      root.querySelector(".climb-spider")?.classList.remove("crawling");
      root.querySelector(".cross-row.just-solved")?.classList.remove("just-solved");
    }
  }, 820);
}

function burstConfetti(layer) {
  if (!layer || layer.dataset.done) return;
  layer.dataset.done = "true";
  const colors = ["#e5092c", "#0d5cff", "#ffd166", "#2ee59d", "#f7fbff"];
  const pieces = Array.from({ length: 90 }, (_, index) => {
    const color = colors[index % colors.length];
    const left = Math.floor(Math.random() * 100);
    const speed = (1.8 + Math.random() * 1.7).toFixed(2);
    return `<span class="confetti" style="--confetti-color: ${color}; --confetti-left: ${left}%; --confetti-speed: ${speed}s"></span>`;
  }).join("");
  layer.innerHTML = pieces;
}

let pointerFrame = 0;
document.addEventListener("pointermove", (event) => {
  if (pointerFrame || !window.matchMedia("(pointer: fine) and (prefers-reduced-motion: no-preference)").matches) return;
  pointerFrame = requestAnimationFrame(() => {
    const x = (event.clientX / window.innerWidth - 0.5) * 18;
    const y = (event.clientY / window.innerHeight - 0.5) * 18;
    document.body.style.setProperty("--px", x.toFixed(2));
    document.body.style.setProperty("--py", y.toFixed(2));
    document.body.style.setProperty("--mx", `${event.clientX}px`);
    document.body.style.setProperty("--my", `${event.clientY}px`);
    pointerFrame = 0;
  });
}, { passive: true });

window.addEventListener("hashchange", renderRoute);
syncTheme();
renderRoute();
prepareInitialView();
