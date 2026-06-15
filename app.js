const STORAGE_KEYS = {
  player: "laxhornet.playerSettings",
  games: "laxhornet.games",
  activeGame: "laxhornet.activeGame",
  reviewGameId: "laxhornet.reviewGameId",
};

const SUPABASE_CONFIG = {
  url: "https://ulbmjcvnyznvmjgpstno.supabase.co",
  publishableKey: "sb_publishable_-RUc79OPosRLNP5B6JIH2A_f3I_2A0M",
};

const PERIOD_FORMATS = {
  quarters: {
    label: "Quarters",
    start: "Q1",
    periods: ["Q1", "Q2", "Q3", "Q4", "OT"],
  },
  halves: {
    label: "Halves",
    start: "H1",
    periods: ["H1", "H2", "OT"],
  },
};

const STAT_DEFS = [
  { key: "goal", label: "Goal", points: 5, tone: "offense", category: "Offense" },
  { key: "assist", label: "Assist", points: 4, tone: "offense", category: "Offense" },
  { key: "shot", label: "Shot", points: 1, tone: "neutral", category: "Offense" },
  { key: "shotOnGoal", label: "Shot on Goal", points: 2, tone: "offense", category: "Offense" },
  { key: "goalieSave", label: "Save", points: 3, tone: "goalieSave", category: "Goalie" },
  { key: "goalAllowed", label: "Goal Allowed", points: -2, tone: "goalieAllowed", category: "Goalie" },
  { key: "faceoffWin", label: "Faceoff Win", points: 2, tone: "faceoffWin", category: "Faceoff" },
  { key: "faceoffLoss", label: "Faceoff Loss", points: -1, tone: "faceoffLoss", category: "Faceoff" },
  { key: "groundBall", label: "Ground Ball", points: 3, tone: "effort", category: "Effort / IQ" },
  { key: "turnover", label: "Turnover", points: -2, tone: "negative", category: "Possession" },
  { key: "causedTurnover", label: "Caused Turnover", points: 3, tone: "defense", category: "Defense" },
  { key: "defensiveStop", label: "Defensive Stop", points: 3, tone: "defense", category: "Defense" },
  { key: "successfulClear", label: "Successful Clear", points: 2, tone: "clear", category: "Clearing" },
  { key: "failedClear", label: "Failed Clear", points: -2, tone: "negative", category: "Clearing" },
  { key: "hustlePlay", label: "Hustle Play", points: 1, tone: "effort", category: "Effort / IQ" },
  { key: "backedUpShot", label: "Backed Up Shot", points: 2, tone: "effort", category: "Effort / IQ" },
  { key: "smartPlay", label: "Smart Play", points: 1, tone: "effort", category: "Effort / IQ" },
  { key: "penalty", label: "Penalty", points: -2, tone: "negative", category: "Discipline" },
  { key: "note", label: "Note", points: 0, tone: "neutral", category: "Note" },
];

const STAT_BY_KEY = Object.fromEntries(STAT_DEFS.map((stat) => [stat.key, stat]));

const LIVE_STAT_GROUPS = [
  {
    label: "Offense",
    hint: "Shots and scoring",
    keys: ["goal", "assist", "shotOnGoal", "shot", "backedUpShot"],
  },
  {
    label: "Possession / IQ",
    hint: "Loose balls, decisions, effort",
    keys: ["groundBall", "turnover", "hustlePlay", "smartPlay"],
  },
  {
    label: "Defense / Clears",
    hint: "Stops, pressure, transition",
    keys: ["causedTurnover", "defensiveStop", "successfulClear", "failedClear", "penalty"],
  },
  {
    label: "Specialty",
    hint: "Goalie, faceoff, notes",
    keys: ["faceoffWin", "faceoffLoss", "goalieSave", "goalAllowed", "note"],
    compact: true,
  },
];

const TAG_SUGGESTIONS = {
  goal: [
    "Left hand",
    "Right hand",
    "On the run",
    "Time and room",
    "Inside finish",
    "Bad angle",
    "Under pressure",
    "Saved",
    "Missed cage",
    "Blocked",
    "Pipe",
  ],
  shot: [
    "Left hand",
    "Right hand",
    "On the run",
    "Time and room",
    "Inside finish",
    "Bad angle",
    "Under pressure",
    "Saved",
    "Missed cage",
    "Blocked",
    "Pipe",
  ],
  shotOnGoal: [
    "Left hand",
    "Right hand",
    "On the run",
    "Time and room",
    "Inside finish",
    "Bad angle",
    "Under pressure",
    "Saved",
    "Missed cage",
    "Blocked",
    "Pipe",
  ],
  goalieSave: [
    "High",
    "Low",
    "Off stick",
    "Stick side",
    "Doorstep",
    "Outside shot",
    "Step-down",
    "Rebound controlled",
    "Cleared after save",
  ],
  goalAllowed: [
    "Inside finish",
    "Outside shot",
    "Screened",
    "Fast break",
    "Man-down",
    "Rebound",
    "Pipe and in",
    "Backside",
    "Under pressure",
  ],
  faceoffWin: [
    "Clean win",
    "Clamp",
    "Rake",
    "Pop out",
    "Won forward",
    "Won back",
    "Wing help",
    "Fast break",
    "Stayed with it",
  ],
  faceoffLoss: [
    "Clean loss",
    "Countered",
    "Violation",
    "Lost clamp",
    "Wing lost",
    "Scrum loss",
    "Out of bounds",
    "Quick restart",
    "Tie-up",
  ],
  groundBall: [
    "Contested",
    "Uncontested",
    "In traffic",
    "Sideline",
    "Faceoff wing",
    "Defensive end",
    "Offensive end",
    "Scoop and move",
    "Scoop but lost",
  ],
  turnover: [
    "Bad pass",
    "Dropped ball",
    "Forced dodge",
    "Double team",
    "Poor decision",
    "Pressure",
    "Out of bounds",
    "Failed catch",
    "Sloppy cradle",
  ],
  backedUpShot: [
    "Endline",
    "Sideline",
    "Hustle",
    "Saved possession",
    "Offensive end",
    "Anticipated shot",
    "Beat defender",
    "Second effort",
  ],
  defensiveStop: [
    "Good footwork",
    "Forced weak hand",
    "Stayed topside",
    "Help defense",
    "Recovery",
    "Communication",
    "Slide",
    "Forced bad shot",
  ],
  causedTurnover: [
    "Good footwork",
    "Forced weak hand",
    "Stayed topside",
    "Help defense",
    "Recovery",
    "Communication",
    "Slide",
    "Forced bad shot",
  ],
  hustlePlay: [
    "Chase down",
    "Ride effort",
    "Loose ball pressure",
    "Sprint back",
    "Second effort",
    "Energy play",
  ],
};

const DEFAULT_PLAYER = {
  name: "Your player",
  number: "",
  team: "",
  position: "",
  notes: "",
};

const app = document.querySelector("#app");
const startupParams = new URLSearchParams(window.location.search);
const startupShareCode = startupParams.get("share")?.trim().toUpperCase() || "";
const startupAuthStatus = startupParams.get("auth") || "";
const supabaseClient =
  window.supabase?.createClient && SUPABASE_CONFIG.url && SUPABASE_CONFIG.publishableKey
    ? window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.publishableKey)
    : null;

let sharedGameChannel = null;
let lastSyncErrorAt = 0;

const state = {
  screen: "home",
  player: loadJSON(STORAGE_KEYS.player, DEFAULT_PLAYER),
  games: loadJSON(STORAGE_KEYS.games, []),
  activeGame: loadJSON(STORAGE_KEYS.activeGame, null),
  reviewGameId: loadJSON(STORAGE_KEYS.reviewGameId, null),
  authUser: null,
  sharedGame: null,
  sharedCode: startupShareCode,
  syncStatus: supabaseClient ? "Live Share ready" : "Live Share unavailable",
  editingEventId: null,
  tagEditingEventId: null,
  tagDraftTags: [],
  watchShareExpanded: false,
  toast: "",
  authBusy: false,
};

state.games = state.games.map(normalizeGame);
state.activeGame = state.activeGame ? normalizeGame(state.activeGame) : null;
persistAll();

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function uid(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeShareCode() {
  return `${Math.random().toString(36).slice(2, 8)}${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
}

function currentUserId() {
  return state.authUser?.id || null;
}

function userEmail() {
  return state.authUser?.email || "";
}

function authRedirectUrl() {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("auth", "verified");
  return url.toString();
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "No date";
  const date = new Date(`${value}T12:00:00`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function pointText(points) {
  if (points > 0) return `+${points}`;
  return `${points}`;
}

function periodFormatForGame(game = {}) {
  if (PERIOD_FORMATS[game.periodFormat]) return game.periodFormat;
  if (PERIOD_FORMATS[game.period_format]) return game.period_format;
  const current = game.currentQuarter || game.current_quarter || "";
  const hasHalfEvent = (game.events || []).some((event) => String(event.quarter || "").startsWith("H"));
  if (String(current).startsWith("H") || hasHalfEvent) return "halves";
  return "quarters";
}

function periodsForGame(game = {}) {
  return PERIOD_FORMATS[periodFormatForGame(game)].periods;
}

function periodFormatLabel(game = {}) {
  return PERIOD_FORMATS[periodFormatForGame(game)].label;
}

function normalizeTag(tag) {
  return String(tag || "").trim();
}

function uniqueTags(tags = []) {
  return [...new Set(tags.map(normalizeTag).filter(Boolean))];
}

function normalizeEvent(event = {}, gameId = "") {
  const stat = STAT_BY_KEY[event.statType] || {
    key: event.statType || "note",
    label: event.statLabel || "Note",
    points: Number(event.pointValue || 0),
    category: event.category || "Note",
  };

  return {
    id: event.id || uid("event"),
    gameId: event.gameId || gameId,
    userId: event.userId || event.user_id || "",
    timestamp: event.timestamp || new Date().toISOString(),
    quarter: event.quarter || "Q1",
    statType: stat.key,
    statLabel: event.statLabel || stat.label,
    category: event.category || stat.category || "General",
    pointValue: Number(event.pointValue ?? stat.points ?? 0),
    tags: uniqueTags(event.tags),
    note: event.note || "",
    fieldZone: event.fieldZone || "",
    correctedAt: event.correctedAt || null,
    tagsUpdatedAt: event.tagsUpdatedAt || null,
  };
}

function normalizeGame(game = {}) {
  const id = game.id || uid("game");
  const periodFormat = periodFormatForGame(game);
  const periods = PERIOD_FORMATS[periodFormat].periods;
  const currentQuarter = game.currentQuarter || game.current_quarter || PERIOD_FORMATS[periodFormat].start;
  return {
    ...game,
    id,
    shareCode: game.shareCode || game.share_code || makeShareCode(),
    userId: game.userId || game.user_id || "",
    isShared: Boolean(game.isShared ?? game.is_shared ?? false),
    periodFormat,
    currentQuarter: periods.includes(currentQuarter) ? currentQuarter : periods[0],
    events: (game.events || []).map((event) => normalizeEvent(event, id)),
  };
}

function persistAll() {
  saveJSON(STORAGE_KEYS.player, state.player);
  saveJSON(STORAGE_KEYS.games, state.games);
  if (state.activeGame) {
    saveJSON(STORAGE_KEYS.activeGame, state.activeGame);
  } else {
    localStorage.removeItem(STORAGE_KEYS.activeGame);
  }
  saveJSON(STORAGE_KEYS.reviewGameId, state.reviewGameId);
}

function showToast(message) {
  state.toast = message;
  render();
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    state.toast = "";
    render();
  }, 1900);
}

function navigate(screen) {
  state.screen = screen;
  persistAll();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function upsertGame(game) {
  game = normalizeGame(game);
  const index = state.games.findIndex((item) => item.id === game.id);
  if (index >= 0) {
    state.games[index] = { ...game };
  } else {
    state.games.unshift({ ...game });
  }
  state.games.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
}

function saveReviewedGame(game, message = "Game updated") {
  const updatedGame = normalizeGame({ ...game, savedAt: new Date().toISOString() });
  upsertGame(updatedGame);
  if (state.activeGame?.id === updatedGame.id) {
    state.activeGame = updatedGame;
  }
  persistAll();
  syncGameToSupabase(updatedGame, { includeEvents: true });
  showToast(message);
}

function updateReviewGame(gameId, updater, message = "Game updated") {
  const game = state.games.find((item) => item.id === gameId);
  if (!game) return;
  saveReviewedGame(updater(game), message);
}

function makeGame(formData) {
  const periodFormat = PERIOD_FORMATS[formData.get("periodFormat")] ? formData.get("periodFormat") : "quarters";
  return {
    id: uid("game"),
    shareCode: makeShareCode(),
    userId: currentUserId() || "",
    isShared: false,
    periodFormat,
    opponent: formData.get("opponent")?.trim() || "Opponent",
    date: formData.get("date") || todayISO(),
    location: formData.get("location")?.trim() || "",
    gameType: formData.get("gameType") || "Regular season",
    playerSnapshot: { ...state.player },
    currentQuarter: PERIOD_FORMATS[periodFormat].start,
    events: [],
    status: "in-progress",
    createdAt: new Date().toISOString(),
    savedAt: null,
    endedAt: null,
  };
}

function calculateTotals(events = []) {
  const count = (key) => events.filter((event) => event.statType === key).length;
  const goals = count("goal");
  const assists = count("assist");
  const shotOnly = count("shot");
  const shotsOnGoal = count("shotOnGoal");
  const shots = shotOnly + shotsOnGoal;
  const successfulClears = count("successfulClear");
  const failedClears = count("failedClear");
  const impact = events.reduce((sum, event) => sum + Number(event.pointValue || 0), 0);
  const saves = count("goalieSave");
  const goalsAllowed = count("goalAllowed");
  const backedUpShots = count("backedUpShot");
  const groundBalls = count("groundBall");
  const hustlePlays = count("hustlePlay");
  const faceoffWins = count("faceoffWin");
  const faceoffLosses = count("faceoffLoss");
  const faceoffAttempts = faceoffWins + faceoffLosses;

  return {
    impact,
    eventCount: events.length,
    goals,
    assists,
    points: goals + assists,
    shots,
    shotsOnGoal,
    saves,
    goalsAllowed,
    savePct: saves + goalsAllowed ? saves / (saves + goalsAllowed) : 0,
    faceoffWins,
    faceoffLosses,
    faceoffAttempts,
    faceoffPct: faceoffAttempts ? faceoffWins / faceoffAttempts : 0,
    shootingPct: shots ? goals / shots : 0,
    shotOnGoalPct: shots ? shotsOnGoal / shots : 0,
    groundBalls,
    turnovers: count("turnover"),
    causedTurnovers: count("causedTurnover"),
    defensiveStops: count("defensiveStop"),
    clears: successfulClears,
    failedClears,
    hustlePlays,
    backedUpShots,
    effortScore: hustlePlays + groundBalls + backedUpShots,
    smartPlays: count("smartPlay"),
    penalties: count("penalty"),
    notes: count("note"),
  };
}

function calculateSeasonTotals() {
  const games = visibleGames();
  const totals = games.reduce(
    (acc, game) => {
      const gameTotals = calculateTotals(game.events);
      Object.keys(acc).forEach((key) => {
        if (key !== "gamesPlayed") acc[key] += gameTotals[key] || 0;
      });
      return acc;
    },
    {
      gamesPlayed: games.length,
      impact: 0,
      eventCount: 0,
      goals: 0,
      assists: 0,
      points: 0,
      shots: 0,
      shotsOnGoal: 0,
      saves: 0,
      goalsAllowed: 0,
      faceoffWins: 0,
      faceoffLosses: 0,
      faceoffAttempts: 0,
      groundBalls: 0,
      turnovers: 0,
      causedTurnovers: 0,
      defensiveStops: 0,
      clears: 0,
      failedClears: 0,
      hustlePlays: 0,
      backedUpShots: 0,
      effortScore: 0,
      smartPlays: 0,
      penalties: 0,
      notes: 0,
    },
  );

  totals.shootingPct = totals.shots ? totals.goals / totals.shots : 0;
  totals.shotOnGoalPct = totals.shots ? totals.shotsOnGoal / totals.shots : 0;
  totals.savePct = totals.saves + totals.goalsAllowed ? totals.saves / (totals.saves + totals.goalsAllowed) : 0;
  totals.faceoffPct = totals.faceoffAttempts ? totals.faceoffWins / totals.faceoffAttempts : 0;
  totals.averageImpact = totals.gamesPlayed ? totals.impact / totals.gamesPlayed : 0;
  return totals;
}

function pct(value) {
  return `${Math.round(value * 100)}%`;
}

function visibleGames() {
  const userId = currentUserId();
  if (!userId) return state.games.filter((game) => !game.userId);
  return state.games.filter((game) => !game.userId || game.userId === userId);
}

function currentReviewGame() {
  const games = visibleGames();
  if (state.reviewGameId) {
    return games.find((game) => game.id === state.reviewGameId) || state.activeGame;
  }
  return state.activeGame || games[0] || null;
}

function saveActiveGame(message = "Game saved locally") {
  if (!state.activeGame) return;
  state.activeGame.savedAt = new Date().toISOString();
  upsertGame(state.activeGame);
  persistAll();
  syncGameToSupabase(state.activeGame, { includeEvents: true });
  showToast(message);
}

function logEvent(statKey) {
  if (!state.activeGame) {
    showToast("Start a game first");
    navigate("start");
    return;
  }

  const stat = STAT_BY_KEY[statKey];
  let note = "";
  if (statKey === "note") {
    note = window.prompt("Add a quick note")?.trim() || "";
    if (!note) return;
  }

  const event = {
    id: uid("event"),
    gameId: state.activeGame.id,
    userId: state.activeGame.userId || currentUserId() || "",
    timestamp: new Date().toISOString(),
    quarter: state.activeGame.currentQuarter,
    statType: stat.key,
    statLabel: stat.label,
    category: stat.category,
    pointValue: stat.points,
    tags: [],
    note,
    fieldZone: "",
  };

  state.activeGame.events.push(event);
  state.activeGame.savedAt = new Date().toISOString();
  persistAll();
  syncLoggedEvent(state.activeGame, event);
  render();
  showToast(`${stat.label} logged (${pointText(stat.points)})`);
}

function undoLastEvent() {
  if (!state.activeGame?.events.length) {
    showToast("No events to undo");
    return;
  }
  const removed = state.activeGame.events.pop();
  state.activeGame.savedAt = new Date().toISOString();
  persistAll();
  deleteSupabaseEvent(removed.id);
  syncGameToSupabase(state.activeGame);
  render();
  showToast(`Undid ${removed.statLabel}`);
}

function endGame() {
  if (!state.activeGame) return;
  state.activeGame.status = "complete";
  state.activeGame.endedAt = new Date().toISOString();
  state.activeGame.savedAt = new Date().toISOString();
  const completedGame = normalizeGame(state.activeGame);
  upsertGame(state.activeGame);
  state.reviewGameId = state.activeGame.id;
  state.activeGame = null;
  persistAll();
  syncGameToSupabase(completedGame, { includeEvents: true });
  navigate("review");
  showToast("Game ended and saved");
}

function deleteGame(id) {
  const game = state.games.find((item) => item.id === id);
  if (!game) return;
  if (!window.confirm(`Delete ${game.opponent} on ${formatDate(game.date)}?`)) return;
  state.games = state.games.filter((item) => item.id !== id);
  if (state.reviewGameId === id) state.reviewGameId = state.games[0]?.id || null;
  persistAll();
  deleteSupabaseGame(id);
  render();
  showToast("Game deleted");
}

function deleteEvent(gameId, eventId) {
  const game = state.games.find((item) => item.id === gameId);
  if (!game) return;
  const event = game.events.find((item) => item.id === eventId);
  if (!event) return;
  if (!window.confirm(`Delete ${event.statLabel}?`)) return;

  const updatedGame = {
    ...game,
    events: game.events.filter((item) => item.id !== eventId),
  };
  if (state.editingEventId === eventId) state.editingEventId = null;
  deleteSupabaseEvent(eventId);
  saveReviewedGame(updatedGame, "Event deleted");
  render();
}

function beginTagEdit(eventId) {
  const game = currentReviewGame();
  const event = game?.events.find((item) => item.id === eventId);
  if (!event) return;
  state.tagEditingEventId = eventId;
  state.tagDraftTags = uniqueTags(event.tags);
  render();
  document.querySelector("[data-tag-editor]")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function addDraftTag(tag) {
  state.tagDraftTags = uniqueTags([...state.tagDraftTags, tag]);
  render();
  document.querySelector("[data-tag-editor]")?.scrollIntoView({ behavior: "auto", block: "start" });
}

function removeDraftTag(tag) {
  state.tagDraftTags = uniqueTags(state.tagDraftTags).filter((item) => item !== normalizeTag(tag));
  render();
  document.querySelector("[data-tag-editor]")?.scrollIntoView({ behavior: "auto", block: "start" });
}

function saveEventTags(gameId, eventId) {
  const tags = uniqueTags(state.tagDraftTags);
  updateReviewGame(
    gameId,
    (game) => ({
      ...game,
      events: game.events.map((event) =>
        event.id === eventId
          ? {
              ...event,
              tags,
              tagsUpdatedAt: new Date().toISOString(),
            }
          : event,
      ),
    }),
    "Tags saved",
  );
  state.tagEditingEventId = null;
  state.tagDraftTags = [];
  render();
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function buildCSV() {
  const headers = [
    "gameId",
    "gameDate",
    "opponent",
    "eventId",
    "timestamp",
    "quarter",
    "statType",
    "statLabel",
    "category",
    "pointValue",
    "tags",
    "note",
    "fieldZone",
  ];
  const rows = state.games.flatMap((game) =>
    normalizeGame(game).events.map((event) => [
      game.id,
      game.date,
      game.opponent,
      event.id,
      event.timestamp,
      event.quarter,
      event.statType,
      event.statLabel,
      event.category,
      event.pointValue,
      event.tags,
      event.note,
      event.fieldZone,
    ]),
  );
  return [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportCSV() {
  downloadFile(`laxhornet-events-${todayISO()}.csv`, buildCSV(), "text/csv;charset=utf-8");
  showToast("CSV exported");
}

function exportJSON() {
  const payload = {
    app: "LaxHornet",
    version: 2,
    exportedAt: new Date().toISOString(),
    player: state.player,
    games: state.games.map(normalizeGame),
  };
  downloadFile(
    `laxhornet-backup-${todayISO()}.json`,
    JSON.stringify(payload, null, 2),
    "application/json;charset=utf-8",
  );
  showToast("JSON backup exported");
}

function importJSONFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const payload = JSON.parse(reader.result);
      const importedGames = Array.isArray(payload) ? payload : payload.games;
      if (!Array.isArray(importedGames)) throw new Error("Missing games array");

      if (payload.player) state.player = { ...DEFAULT_PLAYER, ...payload.player };

      const merged = new Map(state.games.map((game) => [game.id, normalizeGame(game)]));
      importedGames.map(normalizeGame).forEach((game) => merged.set(game.id, game));
      state.games = [...merged.values()].sort(
        (a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt),
      );
      persistAll();
      render();
      showToast("JSON backup imported");
    } catch {
      showToast("Could not import that JSON file");
    }
  });
  reader.readAsText(file);
}

function gameToSupabaseRow(game) {
  const normalized = normalizeGame(game);
  const userId = normalized.userId || currentUserId();
  return {
    id: normalized.id,
    user_id: userId,
    share_code: normalized.shareCode,
    is_shared: Boolean(normalized.isShared),
    opponent: normalized.opponent,
    game_date: normalized.date,
    location: normalized.location || "",
    game_type: normalized.gameType || "",
    period_format: normalized.periodFormat || "quarters",
    player_snapshot: normalized.playerSnapshot || {},
    current_quarter: normalized.currentQuarter || "Q1",
    status: normalized.status || "in-progress",
    created_at: normalized.createdAt || new Date().toISOString(),
    saved_at: normalized.savedAt || null,
    ended_at: normalized.endedAt || null,
  };
}

function eventToSupabaseRow(event) {
  const normalized = normalizeEvent(event, event.gameId);
  const game = state.activeGame?.id === normalized.gameId
    ? state.activeGame
    : state.games.find((item) => item.id === normalized.gameId) || state.sharedGame;
  const userId = normalized.userId || game?.userId || currentUserId();
  return {
    id: normalized.id,
    game_id: normalized.gameId,
    user_id: userId,
    timestamp: normalized.timestamp,
    quarter: normalized.quarter,
    stat_type: normalized.statType,
    stat_label: normalized.statLabel,
    category: normalized.category,
    point_value: normalized.pointValue,
    tags: uniqueTags(normalized.tags),
    note: normalized.note || "",
    field_zone: normalized.fieldZone || "",
    corrected_at: normalized.correctedAt || null,
    tags_updated_at: normalized.tagsUpdatedAt || null,
  };
}

function eventFromSupabaseRow(row) {
  return normalizeEvent(
    {
      id: row.id,
      gameId: row.game_id,
      userId: row.user_id || "",
      timestamp: row.timestamp,
      quarter: row.quarter,
      statType: row.stat_type,
      statLabel: row.stat_label,
      category: row.category,
      pointValue: row.point_value,
      tags: row.tags || [],
      note: row.note || "",
      fieldZone: row.field_zone || "",
      correctedAt: row.corrected_at || null,
      tagsUpdatedAt: row.tags_updated_at || null,
    },
    row.game_id,
  );
}

function gameFromSupabaseRow(row, events = []) {
  return normalizeGame({
    id: row.id,
    userId: row.user_id || "",
    shareCode: row.share_code,
    isShared: Boolean(row.is_shared),
    opponent: row.opponent,
    date: row.game_date,
    location: row.location || "",
    gameType: row.game_type || "",
    periodFormat: row.period_format || periodFormatForGame({ currentQuarter: row.current_quarter }),
    playerSnapshot: row.player_snapshot || {},
    currentQuarter: row.current_quarter || "Q1",
    status: row.status || "in-progress",
    createdAt: row.created_at,
    savedAt: row.saved_at,
    endedAt: row.ended_at,
    events: events.map(eventFromSupabaseRow).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
  });
}

function shareLinkForGame(game) {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("share", normalizeGame(game).shareCode);
  return url.toString();
}

function reportSyncError(error) {
  console.warn("LaxHornet Supabase sync failed:", error);
  state.syncStatus = "Live Share setup needed";
  const now = Date.now();
  if (now - lastSyncErrorAt > 8000) {
    lastSyncErrorAt = now;
    showToast("Live Share needs Supabase setup");
  }
}

function missingSupabaseColumn(error) {
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`;
  return (
    message.match(/'([^']+)' column/i)?.[1] ||
    message.match(/column "([^"]+)"/i)?.[1] ||
    ""
  );
}

function removeColumnFromPayload(payload, column) {
  const remove = (row) => {
    const next = { ...row };
    delete next[column];
    return next;
  };
  return Array.isArray(payload) ? payload.map(remove) : remove(payload);
}

async function upsertWithOptionalColumns(table, payload, optionalColumns = []) {
  let nextPayload = payload;
  const skipped = new Set();

  for (let attempt = 0; attempt <= optionalColumns.length; attempt += 1) {
    const { error } = await supabaseClient.from(table).upsert(nextPayload);
    if (!error) return { error: null, skipped: [...skipped] };

    const missingColumn = missingSupabaseColumn(error);
    if (!optionalColumns.includes(missingColumn) || skipped.has(missingColumn)) {
      return { error, skipped: [...skipped] };
    }

    skipped.add(missingColumn);
    nextPayload = removeColumnFromPayload(nextPayload, missingColumn);
  }

  return { error: { message: "Could not sync Live Share data" }, skipped: [...skipped] };
}

function mergeGames(localGames, cloudGames) {
  const merged = new Map(localGames.map((game) => [game.id, normalizeGame(game)]));
  cloudGames.map(normalizeGame).forEach((game) => merged.set(game.id, game));
  return [...merged.values()].sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
}

async function loadCloudGames(options = {}) {
  if (!supabaseClient || !currentUserId()) return;
  const { data, error } = await supabaseClient
    .from("games")
    .select("*, events(*)")
    .eq("user_id", currentUserId())
    .order("game_date", { ascending: false });

  if (error) {
    if (!options.silent) reportSyncError(error);
    return;
  }

  const cloudGames = (data || []).map((game) => gameFromSupabaseRow(game, game.events || []));
  state.games = mergeGames(state.games, cloudGames);
  persistAll();
  state.syncStatus = "Cloud games loaded";
  if (!options.silent) {
    render();
    showToast("Cloud games synced");
  }
}

async function handleAuthSubmit(formData) {
  if (!supabaseClient) {
    showToast("Supabase is not available");
    return;
  }

  if (state.authBusy) return;

  const email = formData.get("email")?.trim();
  const password = formData.get("password") || "";
  const authAction = formData.get("authAction");
  if (!email || password.length < 6) {
    showToast("Use an email and 6+ character password");
    return;
  }

  state.authBusy = true;
  render();

  const result =
    authAction === "sign-up"
      ? await supabaseClient.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: authRedirectUrl(),
          },
        })
      : await supabaseClient.auth.signInWithPassword({ email, password });

  state.authBusy = false;

  if (result.error) {
    const message = result.error.message || "";
    showToast(
      /rate|too many|exceeded/i.test(message)
        ? "Email limit hit. Wait, or set up custom SMTP."
        : message,
    );
    render();
    return;
  }

  state.authUser = result.data.user || result.data.session?.user || state.authUser;
  state.syncStatus = state.authUser ? "Signed in" : "Check email to confirm account";
  if (state.authUser) await loadCloudGames({ silent: true });
  render();
  showToast(state.syncStatus);
}

async function signOut() {
  if (!supabaseClient) return;
  await supabaseClient.auth.signOut();
  state.authUser = null;
  state.syncStatus = "Signed out";
  render();
  showToast("Signed out");
}

async function syncGameToSupabase(game, options = {}) {
  if (!supabaseClient || !game) return false;
  const userId = currentUserId();
  if (!userId) {
    state.syncStatus = "Sign in for cloud sync";
    return false;
  }
  const normalized = normalizeGame({ ...game, userId: game.userId || userId });
  const { error, skipped } = await upsertWithOptionalColumns("games", gameToSupabaseRow(normalized), [
    "period_format",
  ]);
  if (error) {
    reportSyncError(error);
    return false;
  }

  if (options.includeEvents && normalized.events.length) {
    const { error: eventsError, skipped: skippedEventColumns } = await upsertWithOptionalColumns(
      "events",
      normalized.events.map((event) => eventToSupabaseRow({ ...event, userId })),
      ["tags", "field_zone", "corrected_at", "tags_updated_at"],
    );
    if (eventsError) {
      reportSyncError(eventsError);
      return false;
    }
    skipped.push(...skippedEventColumns);
  }

  state.syncStatus = skipped.length
    ? "Live Share synced; database update recommended"
    : "Live Share synced";
  return true;
}

async function syncLoggedEvent(game, event) {
  if (!supabaseClient || !game || !event) return;
  const gameSynced = await syncGameToSupabase(game);
  if (!gameSynced) return;
  const { error, skipped } = await upsertWithOptionalColumns("events", eventToSupabaseRow(event), [
    "tags",
    "field_zone",
    "corrected_at",
    "tags_updated_at",
  ]);
  if (error) {
    reportSyncError(error);
  } else {
    state.syncStatus = skipped.length
      ? "Live Share synced; database update recommended"
      : "Live Share synced";
  }
}

async function deleteSupabaseEvent(eventId) {
  if (!supabaseClient || !eventId) return;
  const { error } = await supabaseClient.from("events").delete().eq("id", eventId);
  if (error) reportSyncError(error);
}

async function deleteSupabaseGame(gameId) {
  if (!supabaseClient || !gameId) return;
  const { error } = await supabaseClient.from("games").delete().eq("id", gameId);
  if (error) reportSyncError(error);
}

function applySharedEventPayload(payload) {
  if (!state.sharedGame) return;
  if (payload.eventType === "DELETE") {
    state.sharedGame.events = state.sharedGame.events.filter((event) => event.id !== payload.old.id);
  } else {
    const event = eventFromSupabaseRow(payload.new);
    const index = state.sharedGame.events.findIndex((item) => item.id === event.id);
    if (index >= 0) {
      state.sharedGame.events[index] = event;
    } else {
      state.sharedGame.events.push(event);
    }
    state.sharedGame.events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }
  render();
}

function applySharedGamePayload(payload) {
  if (!state.sharedGame || payload.eventType === "DELETE") return;
  state.sharedGame = gameFromSupabaseRow(payload.new, state.sharedGame.events.map(eventToSupabaseRow));
  render();
}

function subscribeToSharedGame(gameId) {
  if (!supabaseClient || !gameId) return;
  if (sharedGameChannel) supabaseClient.removeChannel(sharedGameChannel);
  sharedGameChannel = supabaseClient
    .channel(`laxhornet-game-${gameId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` }, applySharedGamePayload)
    .on("postgres_changes", { event: "*", schema: "public", table: "events", filter: `game_id=eq.${gameId}` }, applySharedEventPayload)
    .subscribe((status) => {
      state.syncStatus = status === "SUBSCRIBED" ? "Watching live" : "Connecting live";
      render();
    });
}

async function loadSharedGame(shareCode) {
  const code = normalizeTag(shareCode).toUpperCase();
  if (!code) return;
  state.sharedCode = code;
  state.screen = "shared";
  state.sharedGame = null;
  render();

  if (!supabaseClient) {
    showToast("Live Share is not available");
    return;
  }

  const { data, error } = await supabaseClient
    .from("games")
    .select("*, events(*)")
    .eq("share_code", code)
    .maybeSingle();

  if (error) {
    reportSyncError(error);
    return;
  }

  if (!data) {
    showToast("Shared game not found");
    return;
  }

  state.sharedGame = gameFromSupabaseRow(data, data.events || []);
  state.syncStatus = "Watching live";
  subscribeToSharedGame(state.sharedGame.id);
  render();
}

async function copyShareLink() {
  const game = state.activeGame || currentReviewGame();
  if (!game) return;
  if (!supabaseClient) {
    showToast("Live Share is not available");
    return;
  }
  if (!currentUserId()) {
    state.syncStatus = "Sign in for Live Share";
    showToast("Sign in to use Live Share");
    return;
  }
  game.isShared = true;
  game.userId = game.userId || currentUserId() || "";
  if (state.activeGame?.id === game.id) state.activeGame = game;
  upsertGame(game);
  persistAll();
  const synced = await syncGameToSupabase(game, { includeEvents: true });
  if (!synced) return;
  const link = shareLinkForGame(game);
  try {
    await navigator.clipboard.writeText(link);
    showToast("Live share link copied");
  } catch {
    window.prompt("Copy this share link", link);
  }
}

function setQuarter(quarter) {
  if (!state.activeGame) return;
  state.activeGame.currentQuarter = quarter;
  persistAll();
  syncGameToSupabase(state.activeGame);
  render();
}

function renderShell(content, options = {}) {
  return `
    <header class="topbar">
      <div class="brand-row">
        <button class="brand" type="button" data-nav="home" aria-label="Go home">
          <span class="brand-logo-wrap">
            <img class="brand-logo" src="assets/laxhornet-logo.png" alt="LaxHornet" />
            <h1 class="sr-only">LaxHornet</h1>
          </span>
        </button>
        <span class="topbar-actions">
          <button class="help-chip" type="button" data-nav="help" aria-label="Open help">?</button>
          <button class="help-chip tutorial-chip" type="button" data-nav="tutorial" aria-label="Open quick tutorial">i</button>
          <span class="status-chip">${state.activeGame ? "Live" : "Offline Ready"}</span>
        </span>
      </div>
    </header>
    ${content}
    ${options.hideNav ? "" : renderBottomNav()}
    ${state.toast ? `<div class="toast" role="status">${escapeHTML(state.toast)}</div>` : ""}
  `;
}

function renderBottomNav() {
  return `
    <nav class="bottom-nav" aria-label="Primary">
      <button class="btn ghost" type="button" data-nav="home">Home</button>
      <button class="btn ghost" type="button" data-nav="past">Past</button>
      <button class="btn ghost" type="button" data-nav="dashboard">Season</button>
      <button class="btn ghost" type="button" data-nav="settings">Player</button>
      <button class="btn ghost" type="button" data-nav="tutorial">Guide</button>
    </nav>
  `;
}

function renderAccountCard() {
  if (!supabaseClient) {
    return `
      <section class="card pad">
        <h3>Parent Account</h3>
        <p class="muted small">Supabase is not available, so this device is using local-only storage.</p>
      </section>
    `;
  }

  if (state.authUser) {
    return `
      <section class="card pad account-card">
        <h3>Parent Account</h3>
        <p class="muted small">${escapeHTML(userEmail())}</p>
        <div class="account-actions">
          <button class="btn neutral" type="button" data-action="sync-cloud-games">Sync Cloud Games</button>
          <button class="btn secondary" type="button" data-action="sign-out">Sign Out</button>
        </div>
      </section>
    `;
  }

  return `
    <form class="card pad form-grid account-card" data-form="auth">
      <h3>Parent Account</h3>
      <p class="muted small">Sign in so each parent keeps their own players, games, and season dashboard separate.</p>
      <div class="field">
        <label for="authEmail">Email</label>
        <input id="authEmail" name="email" type="email" autocomplete="email" required />
      </div>
      <div class="field">
        <label for="authPassword">Password</label>
        <input id="authPassword" name="password" type="password" autocomplete="current-password" minlength="6" required />
      </div>
      <div class="account-actions">
        <button class="btn positive" type="submit" name="authAction" value="sign-in" ${state.authBusy ? "disabled" : ""}>${state.authBusy ? "Working..." : "Sign In"}</button>
        <button class="btn secondary" type="submit" name="authAction" value="sign-up" ${state.authBusy ? "disabled" : ""}>${state.authBusy ? "Sending..." : "Create Account"}</button>
      </div>
    </form>
  `;
}

function renderHome() {
  const season = calculateSeasonTotals();
  const active = state.activeGame;
  const watchExpanded = state.watchShareExpanded;

  return renderShell(`
    <section class="screen-title home-title">
      <h2>Fast stats for a fast game.</h2>
      <p>Track every play with big buttons, local saves, and season totals that work offline.</p>
    </section>

    <section class="stack">
      <div class="card pad">
        <h3>${escapeHTML(state.player.name || "Player")}${state.player.number ? ` #${escapeHTML(state.player.number)}` : ""}</h3>
        <p class="muted small">${escapeHTML([state.player.team, state.player.position].filter(Boolean).join(" - ") || "Add player details before the next game.")}</p>
      </div>

      <div class="metric-grid">
        <div class="metric"><strong>${season.gamesPlayed}</strong><span>Games</span></div>
        <div class="metric"><strong>${season.goals}</strong><span>Goals</span></div>
        <div class="metric"><strong>${season.assists}</strong><span>Assists</span></div>
        <div class="metric"><strong>${season.averageImpact.toFixed(1)}</strong><span>Avg Impact</span></div>
      </div>

      <div class="action-grid">
        ${
          active
            ? `<button class="btn positive" type="button" data-nav="live">Resume Live Game</button>`
            : `<button class="btn positive" type="button" data-nav="start">Start New Game</button>`
        }
        <button class="btn neutral" type="button" data-nav="dashboard">Season Dashboard</button>
        <button class="btn secondary" type="button" data-nav="past">Past Games</button>
        <button class="btn secondary" type="button" data-nav="settings">Player Settings</button>
      </div>

      ${renderAccountCard()}

      <form class="card pad form-grid share-watch-form ${watchExpanded ? "expanded" : "collapsed"}" data-form="watch-share">
        <div class="collapsible-card-head">
          <div>
            <h3>Watch Shared Game</h3>
            <p class="muted small">Enter a family share code to watch a read-only live game.</p>
          </div>
          <button class="collapse-icon" type="button" data-action="toggle-watch-share" aria-expanded="${watchExpanded}" aria-controls="watchShareFields" aria-label="${watchExpanded ? "Minimize Watch Shared Game" : "Expand Watch Shared Game"}">
            <span aria-hidden="true">${watchExpanded ? "⌄" : "›"}</span>
          </button>
        </div>
        ${
          watchExpanded
            ? `<div class="share-watch-fields" id="watchShareFields">
                <div class="field">
                  <label for="shareCode">Share code</label>
                  <input id="shareCode" name="shareCode" value="${escapeHTML(state.sharedCode)}" placeholder="ABC123" autocapitalize="characters" />
                </div>
                <button class="btn neutral" type="submit">Watch Live</button>
              </div>`
            : ""
        }
      </form>
    </section>
  `);
}

function renderSettings() {
  return renderShell(`
    <section class="screen-title">
      <h2>Player Settings</h2>
      <p>Saved on this device with localStorage.</p>
    </section>

    <form class="card pad form-grid" data-form="settings">
      <div class="form-grid two">
        <div class="field">
          <label for="playerName">Player name</label>
          <input id="playerName" name="name" value="${escapeHTML(state.player.name)}" required />
        </div>
        <div class="field">
          <label for="number">Jersey number</label>
          <input id="number" name="number" inputmode="numeric" value="${escapeHTML(state.player.number)}" />
        </div>
        <div class="field">
          <label for="team">Team</label>
          <input id="team" name="team" value="${escapeHTML(state.player.team)}" />
        </div>
        <div class="field">
          <label for="position">Position</label>
          <input id="position" name="position" value="${escapeHTML(state.player.position)}" placeholder="Midfield, attack, defense..." />
        </div>
      </div>
      <div class="field">
        <label for="notes">Player notes</label>
        <textarea id="notes" name="notes">${escapeHTML(state.player.notes)}</textarea>
      </div>
      <button class="btn positive" type="submit">Save Player Settings</button>
    </form>
  `);
}

function renderStartGame() {
  return renderShell(`
    <section class="screen-title">
      <h2>Start New Game</h2>
      <p>Set the opponent, choose the game format, then start tracking.</p>
    </section>

    <form class="card pad form-grid" data-form="start-game">
      <div class="field">
        <label for="opponent">Opponent</label>
        <input id="opponent" name="opponent" placeholder="Opponent team" required />
      </div>
      <div class="form-grid two">
        <div class="field">
          <label for="date">Date</label>
          <input id="date" name="date" type="date" value="${todayISO()}" required />
        </div>
        <div class="field">
          <label for="gameType">Game type</label>
          <select id="gameType" name="gameType">
            <option>Regular season</option>
            <option>Tournament</option>
            <option>Playoff</option>
            <option>Scrimmage</option>
          </select>
        </div>
      </div>
      <div class="field">
        <label for="periodFormat">Game format</label>
        <select id="periodFormat" name="periodFormat">
          <option value="quarters">Quarters</option>
          <option value="halves">Halves</option>
        </select>
      </div>
      <div class="field">
        <label for="location">Location</label>
        <input id="location" name="location" placeholder="Field or town" />
      </div>
      <button class="btn positive" type="submit">Start Live Tracker</button>
    </form>
  `);
}

function renderStatButton(stat, options = {}) {
  return `
    <button class="stat-button ${stat.tone}${options.compact ? " compact" : ""}" type="button" data-stat="${stat.key}">
      <span class="label">${stat.label}</span>
      <span class="points">${stat.points === 0 ? "note" : `${pointText(stat.points)} impact`}</span>
    </button>
  `;
}

function renderLiveStatGroups() {
  return `
    <section class="live-stat-groups" aria-label="Stat buttons">
      ${LIVE_STAT_GROUPS.map((group) => {
        const buttons = group.keys
          .map((key) => STAT_BY_KEY[key])
          .filter(Boolean)
          .map((stat) => renderStatButton(stat, { compact: group.compact }))
          .join("");
        return `
          <div class="stat-group ${group.compact ? "compact" : ""}">
            <div class="stat-group-head">
              <h3>${group.label}</h3>
              <span>${group.hint}</span>
            </div>
            <div class="tracker-grid">${buttons}</div>
          </div>
        `;
      }).join("")}
    </section>
  `;
}

function renderLiveTracker() {
  if (!state.activeGame) {
    return renderShell(`
      <section class="screen-title">
        <h2>No active game</h2>
        <p>Start a new game to open the live tracker.</p>
      </section>
      <button class="btn positive" type="button" data-nav="start">Start New Game</button>
    `);
  }

  const game = state.activeGame;
  const totals = calculateTotals(game.events);
  const recentEvents = [...game.events].reverse().slice(0, 5);
  const periods = periodsForGame(game);
  const details = `${formatDate(game.date)} - ${periodFormatLabel(game)}${game.location ? ` - ${escapeHTML(game.location)}` : ""}`;

  return renderShell(`
    <section class="screen-title live-title">
      <h2>${escapeHTML(game.opponent)}</h2>
      <p class="live-meta">
        <span>${details}</span>
        <button class="live-share-link" type="button" data-action="copy-share-link">Live Share</button>
      </p>
    </section>

    <div class="period-tabs" role="group" aria-label="Period selector">
      ${periods.map(
        (period) =>
          `<button class="period-tab ${game.currentQuarter === period ? "active" : ""}" type="button" data-quarter="${period}">${period}</button>`,
      ).join("")}
    </div>

    <section class="live-summary" aria-label="Live game summary">
      <div class="live-pill"><strong>${totals.impact}</strong><span>Impact</span></div>
      <div class="live-pill"><strong>${totals.points}</strong><span>Points</span></div>
      <div class="live-pill"><strong>${totals.eventCount}</strong><span>Events</span></div>
    </section>

    ${renderLiveStatGroups()}

    <section class="card pad" style="margin-top: 12px;">
      <h3>Recent Log</h3>
      ${
        recentEvents.length
          ? `<div class="event-list">${recentEvents.map(renderEventRow).join("")}</div>`
          : `<p class="muted small">No events yet. Tap a stat button to start the log.</p>`
      }
    </section>

    <div class="sticky-actions">
      <div class="sticky-inner">
        <button class="btn warning" type="button" data-action="undo">Undo</button>
        <button class="btn neutral" type="button" data-action="save-game">Save</button>
        <button class="btn danger" type="button" data-action="end-game">End Game</button>
      </div>
    </div>
  `, { hideNav: true });
}

function renderEventRow(event, options = {}) {
  const stat = STAT_BY_KEY[event.statType] || { tone: "neutral" };
  return `
    <div class="event-row ${stat.tone}">
      <span class="badge">${escapeHTML(event.quarter)}</span>
      <span>
        <strong>${escapeHTML(event.statLabel)}</strong>
        <p>${formatTime(event.timestamp)} - ${escapeHTML(event.category || "General")}${event.note ? ` - ${escapeHTML(event.note)}` : ""}</p>
        ${renderTagChips(event.tags)}
      </span>
      <span class="score">${pointText(event.pointValue)}</span>
      ${
        options.editable
          ? `<span class="event-actions">
              <button class="mini-btn" type="button" data-edit-event="${event.id}">Edit</button>
              <button class="mini-btn tag" type="button" data-edit-tags="${event.id}">Add/Edit Tags</button>
              <button class="mini-btn danger" type="button" data-delete-event="${event.id}" data-game-id="${options.gameId}">Delete</button>
            </span>`
          : ""
      }
    </div>
  `;
}

function renderTagChips(tags = [], options = {}) {
  const cleanTags = uniqueTags(tags);
  if (!cleanTags.length) return "";
  return `
    <span class="tag-chip-list">
      ${cleanTags
        .map(
          (tag) => `
            <span class="tag-chip">
              ${escapeHTML(tag)}
              ${
                options.removable
                  ? `<button class="tag-remove" type="button" data-remove-draft-tag="${escapeHTML(tag)}" aria-label="Remove ${escapeHTML(tag)}">x</button>`
                  : ""
              }
            </span>
          `,
        )
        .join("")}
    </span>
  `;
}

function renderEventEditForm(game, event) {
  const statOptions = STAT_DEFS.map(
    (stat) =>
      `<option value="${stat.key}" ${event.statType === stat.key ? "selected" : ""}>${stat.label} (${pointText(stat.points)})</option>`,
  ).join("");
  const periodOptions = [...new Set([...periodsForGame(game), event.quarter])].filter(Boolean).map(
    (period) => `<option value="${period}" ${event.quarter === period ? "selected" : ""}>${period}</option>`,
  ).join("");

  return `
    <form class="card pad form-grid edit-event-form" data-form="event-edit" data-game-id="${game.id}" data-event-id="${event.id}">
      <h3>Edit Event</h3>
      <div class="form-grid two">
        <div class="field">
          <label for="editStat">Stat type</label>
          <select id="editStat" name="statType">${statOptions}</select>
        </div>
        <div class="field">
          <label for="editQuarter">Period</label>
          <select id="editQuarter" name="quarter">${periodOptions}</select>
        </div>
      </div>
      <div class="field">
        <label for="editNote">Note</label>
        <textarea id="editNote" name="note" placeholder="Optional correction note">${escapeHTML(event.note || "")}</textarea>
      </div>
      <div class="edit-actions">
        <button class="btn positive" type="submit">Save Correction</button>
        <button class="btn secondary" type="button" data-action="cancel-edit-event">Cancel</button>
      </div>
    </form>
  `;
}

function suggestedTagsForEvent(event) {
  return TAG_SUGGESTIONS[event.statType] || [];
}

function renderTagEditor(game, event) {
  const selectedTags = uniqueTags(state.tagDraftTags);
  const suggestedTags = suggestedTagsForEvent(event).filter((tag) => !selectedTags.includes(tag));

  return `
    <section class="card pad tag-editor" data-tag-editor="${event.id}">
      <h3>Edit Tags</h3>
      <p class="muted small">${escapeHTML(event.statLabel)} - ${escapeHTML(event.category || "General")} - ${formatTime(event.timestamp)}</p>
      <div class="tag-editor-block">
        <strong class="tag-editor-label">Selected tags</strong>
        ${
          selectedTags.length
            ? renderTagChips(selectedTags, { removable: true })
            : `<p class="muted small">No tags selected yet.</p>`
        }
      </div>
      <div class="tag-editor-block">
        <strong class="tag-editor-label">Suggested tags</strong>
        ${
          suggestedTags.length
            ? `<div class="tag-suggestions">${suggestedTags
                .map((tag) => `<button class="tag-suggestion" type="button" data-add-draft-tag="${escapeHTML(tag)}">${escapeHTML(tag)}</button>`)
                .join("")}</div>`
            : `<p class="muted small">No suggestions for this event type.</p>`
        }
      </div>
      <form class="custom-tag-form" data-form="custom-tag">
        <div class="field">
          <label for="customTag">Custom tag</label>
          <input id="customTag" name="customTag" placeholder="Add your own tag" />
        </div>
        <button class="btn neutral" type="submit">Add Tag</button>
      </form>
      <div class="edit-actions">
        <button class="btn positive" type="button" data-action="save-tags" data-game-id="${game.id}" data-event-id="${event.id}">Save Tag Changes</button>
        <button class="btn secondary" type="button" data-action="cancel-tags">Cancel</button>
      </div>
    </section>
  `;
}

function renderReview() {
  const game = currentReviewGame();
  if (!game) {
    return renderShell(`
      <section class="screen-title">
        <h2>Game Review</h2>
        <p>No saved games yet.</p>
      </section>
      <button class="btn positive" type="button" data-nav="start">Start New Game</button>
    `);
  }

  const totals = calculateTotals(game.events);
  const editingEvent = state.editingEventId
    ? game.events.find((event) => event.id === state.editingEventId)
    : null;
  const tagEditingEvent = state.tagEditingEventId
    ? game.events.find((event) => event.id === state.tagEditingEventId)
    : null;
  return renderShell(`
    <section class="screen-title">
      <h2>Game Review</h2>
      <p>${escapeHTML(game.opponent)} - ${formatDate(game.date)}</p>
    </section>

    <section class="stack">
      <div class="metric-grid">
        <div class="metric"><strong>${totals.impact}</strong><span>Impact Score</span></div>
        <div class="metric"><strong>${totals.points}</strong><span>Points</span></div>
        <div class="metric"><strong>${totals.goals}</strong><span>Goals</span></div>
        <div class="metric"><strong>${totals.assists}</strong><span>Assists</span></div>
      </div>
      ${renderTotalsTable(totals)}
      ${editingEvent ? renderEventEditForm(game, editingEvent) : ""}
      ${tagEditingEvent ? renderTagEditor(game, tagEditingEvent) : ""}
      <div class="card pad">
        <h3>Event Log</h3>
        ${
          game.events.length
            ? `<div class="event-list">${[...game.events]
                .reverse()
                .map((event) => renderEventRow(event, { editable: true, gameId: game.id }))
                .join("")}</div>`
            : `<p class="muted small">No events were logged for this game.</p>`
        }
      </div>
    </section>
  `);
}

function renderSharedGame() {
  const code = escapeHTML(state.sharedCode || "");
  if (!state.sharedGame) {
    return renderShell(`
      <section class="screen-title">
        <h2>Shared Game</h2>
        <p>${code ? `Loading share code ${code}...` : "Enter a share code from the tracker phone."}</p>
      </section>
      <form class="card pad form-grid" data-form="watch-share">
        <div class="field">
          <label for="sharedScreenCode">Share code</label>
          <input id="sharedScreenCode" name="shareCode" value="${code}" placeholder="ABC123" autocapitalize="characters" />
        </div>
        <button class="btn neutral" type="submit">Watch Live</button>
      </form>
    `);
  }

  const game = state.sharedGame;
  const totals = calculateTotals(game.events);
  const events = [...game.events].reverse();

  return renderShell(`
    <section class="screen-title">
      <h2>${escapeHTML(game.opponent)}</h2>
      <p>Shared live game - ${formatDate(game.date)} - ${escapeHTML(state.syncStatus)}</p>
    </section>

    <section class="stack">
      <div class="metric-grid">
        <div class="metric"><strong>${totals.impact}</strong><span>Impact</span></div>
        <div class="metric"><strong>${totals.points}</strong><span>Points</span></div>
        <div class="metric"><strong>${totals.goals}</strong><span>Goals</span></div>
        <div class="metric"><strong>${totals.assists}</strong><span>Assists</span></div>
      </div>
      ${renderTotalsTable(totals)}
      <div class="card pad">
        <h3>Live Timeline</h3>
        ${
          events.length
            ? `<div class="event-list">${events.map(renderEventRow).join("")}</div>`
            : `<p class="muted small">No events logged yet.</p>`
        }
      </div>
    </section>
  `);
}

function renderTotalsTable(totals) {
  const rows = [
    ["Shots", totals.shots],
    ["Shots on goal", totals.shotsOnGoal],
    ["Shooting %", pct(totals.shootingPct)],
    ["Shot on goal %", pct(totals.shotOnGoalPct)],
    ["Saves", totals.saves],
    ["Goals allowed", totals.goalsAllowed],
    ["Save %", pct(totals.savePct)],
    ["Faceoff wins", totals.faceoffWins],
    ["Faceoff losses", totals.faceoffLosses],
    ["Faceoff attempts", totals.faceoffAttempts],
    ["Faceoff win %", pct(totals.faceoffPct)],
    ["Ground balls", totals.groundBalls],
    ["Backed up shots", totals.backedUpShots],
    ["Effort score", totals.effortScore],
    ["Turnovers", totals.turnovers],
    ["Caused turnovers", totals.causedTurnovers],
    ["Defensive stops", totals.defensiveStops],
    ["Successful clears", totals.clears],
    ["Failed clears", totals.failedClears],
    ["Hustle plays", totals.hustlePlays],
    ["Smart plays", totals.smartPlays],
    ["Penalties", totals.penalties],
  ];

  return `
    <div class="card table-card">
      <table class="stat-table">
        <thead><tr><th>Stat</th><th>Total</th></tr></thead>
        <tbody>
          ${rows.map(([label, value]) => `<tr><td>${label}</td><td>${value}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderPastGames() {
  const games = visibleGames();
  return renderShell(`
    <section class="screen-title">
      <h2>Past Games</h2>
      <p>Saved games stay on this device and can be reviewed or deleted.</p>
    </section>

    <section class="card pad export-card">
      <h3>Backup & Export</h3>
      <p class="muted small">Exports include event tags, notes, categories, and impact values.</p>
      <div class="export-actions">
        <button class="btn neutral" type="button" data-action="export-csv">Export CSV</button>
        <button class="btn neutral" type="button" data-action="export-json">Export JSON</button>
        <label class="btn secondary import-label" for="jsonImport">Import JSON</label>
        <input class="import-input" id="jsonImport" type="file" accept="application/json,.json" data-import-json />
      </div>
    </section>

    <section class="card">
      ${
        games.length
          ? games.map(renderGameListRow).join("")
          : `<div class="empty">No saved games yet.</div>`
      }
    </section>
  `);
}

function renderGameListRow(game) {
  const totals = calculateTotals(game.events);
  return `
    <div class="list-row">
      <button class="brand" type="button" data-review="${game.id}" style="color: var(--text); text-align: left;">
        <span>
          <h3>${escapeHTML(game.opponent)}</h3>
          <p>${formatDate(game.date)} - Impact ${totals.impact} - ${totals.goals}G ${totals.assists}A</p>
        </span>
      </button>
      <div class="row-actions">
        <button class="icon-btn" type="button" data-review="${game.id}" aria-label="Review game">View</button>
        <button class="icon-btn delete" type="button" data-delete="${game.id}" aria-label="Delete game">Del</button>
      </div>
    </div>
  `;
}

function renderDashboard() {
  const totals = calculateSeasonTotals();
  return renderShell(`
    <section class="screen-title">
      <h2>Season Dashboard</h2>
      <p>Totals update from every saved game.</p>
    </section>

    <section class="stack">
      <div class="metric-grid">
        <div class="metric"><strong>${totals.gamesPlayed}</strong><span>Games Played</span></div>
        <div class="metric"><strong>${totals.averageImpact.toFixed(1)}</strong><span>Avg Impact</span></div>
        <div class="metric"><strong>${totals.goals}</strong><span>Goals</span></div>
        <div class="metric"><strong>${totals.assists}</strong><span>Assists</span></div>
        <div class="metric"><strong>${totals.points}</strong><span>Points</span></div>
        <div class="metric"><strong>${totals.saves}</strong><span>Saves</span></div>
        <div class="metric"><strong>${pct(totals.faceoffPct)}</strong><span>Faceoff %</span></div>
        <div class="metric"><strong>${totals.effortScore}</strong><span>Effort Score</span></div>
        <div class="metric"><strong>${pct(totals.shootingPct)}</strong><span>Shooting %</span></div>
      </div>
      ${renderTotalsTable(totals)}
    </section>
  `);
}

function renderHelp() {
  const impactRows = STAT_DEFS.filter((stat) => stat.key !== "note")
    .map(
      (stat) => `
        <tr>
          <td>${stat.label}</td>
          <td>${pointText(stat.points)}</td>
        </tr>
      `,
    )
    .join("");

  return renderShell(`
    <section class="screen-title">
      <h2>Impact Help</h2>
      <p>A quick guide to the metrics on Game Review and Season Dashboard.</p>
    </section>

    <section class="stack">
      <div class="card pad">
        <h3>Game Impact Score</h3>
        <p class="muted small">Every logged event gets an impact value. Positive plays add to the score, while turnovers, failed clears, and penalties subtract from it. The game total is the sum of all event values.</p>
      </div>

      <div class="card pad">
        <h3>Average Game Impact Score</h3>
        <p class="muted small">Average Impact is the season's total Game Impact Score divided by games played. Example: 60 total impact across 5 games = 12.0 average impact.</p>
      </div>

      <div class="card pad">
        <h3>Points vs Impact</h3>
        <p class="muted small">Lacrosse points are goals plus assists. Impact Score is broader: it also counts ground balls, clears, defensive stops, hustle plays, smart plays, and mistakes.</p>
      </div>

      <div class="card pad">
        <h3>Backed Up Shot</h3>
        <p class="muted small">A Backed Up Shot is when the player hustles to the endline or sideline to retain possession after a shot. It adds +2 to Game Impact Score.</p>
      </div>

      <div class="card pad">
        <h3>Effort Score</h3>
        <p class="muted small">Effort Score is Hustle Plays plus Ground Balls plus Backed Up Shots. It is a simple count of extra-possession effort plays.</p>
      </div>

      <div class="card table-card">
        <table class="stat-table">
          <thead><tr><th>Event</th><th>Impact</th></tr></thead>
          <tbody>${impactRows}</tbody>
        </table>
      </div>

      <div class="card pad">
        <h3>Shot Percentages</h3>
        <p class="muted small">Shooting % is goals divided by total shots. Shot on goal % is shots on goal divided by total shots. In this app, a Shot on Goal counts as both a shot and a shot on goal.</p>
      </div>

      <div class="card pad">
        <h3>Faceoff Win %</h3>
        <p class="muted small">Faceoff win % is Faceoff Wins divided by total faceoff attempts. Attempts are Faceoff Wins plus Faceoff Losses.</p>
      </div>
    </section>
  `);
}

function renderAuthSuccess() {
  const signedIn = Boolean(state.authUser);
  return renderShell(`
    <section class="screen-title">
      <h2>Account Confirmed</h2>
      <p>${signedIn ? "You're signed in and ready to track games." : "Your email has been verified."}</p>
    </section>

    <section class="stack">
      <div class="card pad account-success-card">
        <h3>Welcome to LaxHornet</h3>
        <p class="muted small">Parent accounts keep each family's players, games, and season dashboard separate.</p>
        <div class="account-actions">
          <button class="btn positive" type="button" data-nav="home">${signedIn ? "Go to Home" : "Sign In"}</button>
          <button class="btn secondary" type="button" data-nav="tutorial">Quick Tutorial</button>
        </div>
      </div>
    </section>
  `);
}

function renderTutorial() {
  return renderShell(`
    <section class="screen-title">
      <h2>Quick Tutorial</h2>
      <p>A fast guide to tracking a game, saving data, and sharing live stats.</p>
    </section>

    <section class="stack tutorial-list">
      <div class="card pad">
        <h3>1. Set Up The Player</h3>
        <p class="muted small">Open Player Settings and enter the player name, number, team, and position. These details stay on the device and are copied into each new game.</p>
      </div>

      <div class="card pad">
        <h3>2. Sign In For Cloud Sync</h3>
        <p class="muted small">Use a Parent Account when you want games backed up online. Each parent only sees their own synced games and season dashboard.</p>
      </div>

      <div class="card pad">
        <h3>3. Start A Game</h3>
        <p class="muted small">Tap Start New Game, enter the opponent, and choose Quarters or Halves. In Live Game, use the subtle period buttons so each event lands in the right part of the game.</p>
      </div>

      <div class="card pad">
        <h3>4. Track Fast</h3>
        <p class="muted small">Live stats are grouped by game flow: Offense, Possession / IQ, Defense / Clears, and Specialty. The most common field events stay higher on the page, while faceoff, goalie, and note buttons sit lower.</p>
      </div>

      <div class="card pad">
        <h3>5. Save, Undo, And Share</h3>
        <p class="muted small">Undo removes the last event. Save keeps the game locally and syncs it when you are signed in. Live Share is a small link beside the game date so family can watch from another iPhone, phone, tablet, or computer. The link automatically copies to the clipboard, so just paste it into a text or email.</p>
      </div>

      <div class="card pad">
        <h3>6. Review, Correct, And Tag</h3>
        <p class="muted small">After a game, open Game Review to edit events, correct notes, add tags, and check totals like Impact Score, Effort Score, Faceoff %, Save %, and shooting percentages. Tap ? for metric explanations.</p>
      </div>

      <div class="card pad">
        <h3>7. Watch A Shared Game</h3>
        <p class="muted small">On Home, expand Watch Shared Game, enter the share code or open a shared link, and follow the read-only live timeline from another device.</p>
      </div>

      <div class="action-grid">
        <button class="btn positive" type="button" data-nav="home">Go to Home</button>
        <button class="btn neutral" type="button" data-nav="start">Start New Game</button>
      </div>
    </section>
  `);
}

function render() {
  const screens = {
    home: renderHome,
    authSuccess: renderAuthSuccess,
    tutorial: renderTutorial,
    settings: renderSettings,
    start: renderStartGame,
    live: renderLiveTracker,
    review: renderReview,
    shared: renderSharedGame,
    past: renderPastGames,
    dashboard: renderDashboard,
    help: renderHelp,
  };
  app.innerHTML = (screens[state.screen] || renderHome)();
}

function handleSubmit(event) {
  const form = event.target.closest("form");
  if (!form) return;
  event.preventDefault();
  let formData;
  try {
    formData = event.submitter ? new FormData(form, event.submitter) : new FormData(form);
  } catch {
    formData = new FormData(form);
  }
  if (event.submitter?.name && !formData.has(event.submitter.name)) {
    formData.set(event.submitter.name, event.submitter.value);
  }

  if (form.dataset.form === "settings") {
    state.player = {
      name: formData.get("name")?.trim() || DEFAULT_PLAYER.name,
      number: formData.get("number")?.trim() || "",
      team: formData.get("team")?.trim() || "",
      position: formData.get("position")?.trim() || "",
      notes: formData.get("notes")?.trim() || "",
    };
    persistAll();
    navigate("home");
    showToast("Player settings saved");
  }

  if (form.dataset.form === "auth") {
    handleAuthSubmit(formData);
  }

  if (form.dataset.form === "start-game") {
    if (state.activeGame && !window.confirm("Replace the current active game? Save it first if needed.")) {
      return;
    }
    state.activeGame = makeGame(formData);
    state.reviewGameId = state.activeGame.id;
    persistAll();
    syncGameToSupabase(state.activeGame);
    navigate("live");
    showToast("Live game started");
  }

  if (form.dataset.form === "event-edit") {
    const game = state.games.find((item) => item.id === form.dataset.gameId);
    if (!game) return;
    const eventIndex = game.events.findIndex((item) => item.id === form.dataset.eventId);
    if (eventIndex < 0) return;

    const stat = STAT_BY_KEY[formData.get("statType")];
    if (!stat) return;

    const updatedEvents = [...game.events];
    updatedEvents[eventIndex] = {
      ...updatedEvents[eventIndex],
      statType: stat.key,
      statLabel: stat.label,
      quarter: formData.get("quarter") || updatedEvents[eventIndex].quarter,
      note: formData.get("note")?.trim() || "",
      category: stat.category,
      pointValue: stat.points,
      tags: uniqueTags(updatedEvents[eventIndex].tags),
      fieldZone: updatedEvents[eventIndex].fieldZone || "",
      correctedAt: new Date().toISOString(),
    };

    state.editingEventId = null;
    saveReviewedGame({ ...game, events: updatedEvents }, "Event corrected");
    render();
  }

  if (form.dataset.form === "custom-tag") {
    const tag = formData.get("customTag")?.trim();
    if (tag) addDraftTag(tag);
  }

  if (form.dataset.form === "watch-share") {
    loadSharedGame(formData.get("shareCode"));
  }
}

function handleClick(event) {
  const nav = event.target.closest("[data-nav]");
  if (nav) {
    navigate(nav.dataset.nav);
    return;
  }

  const statButton = event.target.closest("[data-stat]");
  if (statButton) {
    logEvent(statButton.dataset.stat);
    return;
  }

  const quarterButton = event.target.closest("[data-quarter]");
  if (quarterButton) {
    setQuarter(quarterButton.dataset.quarter);
    return;
  }

  const action = event.target.closest("[data-action]");
  if (action) {
    if (action.dataset.action === "undo") undoLastEvent();
    if (action.dataset.action === "save-game") saveActiveGame();
    if (action.dataset.action === "end-game") endGame();
    if (action.dataset.action === "cancel-edit-event") {
      state.editingEventId = null;
      render();
    }
    if (action.dataset.action === "cancel-tags") {
      state.tagEditingEventId = null;
      state.tagDraftTags = [];
      render();
    }
    if (action.dataset.action === "save-tags") {
      saveEventTags(action.dataset.gameId, action.dataset.eventId);
    }
    if (action.dataset.action === "export-csv") exportCSV();
    if (action.dataset.action === "export-json") exportJSON();
    if (action.dataset.action === "copy-share-link") copyShareLink();
    if (action.dataset.action === "sign-out") signOut();
    if (action.dataset.action === "sync-cloud-games") loadCloudGames();
    if (action.dataset.action === "toggle-watch-share") {
      state.watchShareExpanded = !state.watchShareExpanded;
      render();
    }
    return;
  }

  const editEvent = event.target.closest("[data-edit-event]");
  if (editEvent) {
    state.editingEventId = editEvent.dataset.editEvent;
    state.tagEditingEventId = null;
    state.tagDraftTags = [];
    render();
    document.querySelector(".edit-event-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const editTags = event.target.closest("[data-edit-tags]");
  if (editTags) {
    state.editingEventId = null;
    beginTagEdit(editTags.dataset.editTags);
    return;
  }

  const addDraftTagButton = event.target.closest("[data-add-draft-tag]");
  if (addDraftTagButton) {
    addDraftTag(addDraftTagButton.dataset.addDraftTag);
    return;
  }

  const removeDraftTagButton = event.target.closest("[data-remove-draft-tag]");
  if (removeDraftTagButton) {
    removeDraftTag(removeDraftTagButton.dataset.removeDraftTag);
    return;
  }

  const deleteEventButton = event.target.closest("[data-delete-event]");
  if (deleteEventButton) {
    deleteEvent(deleteEventButton.dataset.gameId, deleteEventButton.dataset.deleteEvent);
    return;
  }

  const review = event.target.closest("[data-review]");
  if (review) {
    state.reviewGameId = review.dataset.review;
    persistAll();
    navigate("review");
    return;
  }

  const deleteButton = event.target.closest("[data-delete]");
  if (deleteButton) {
    deleteGame(deleteButton.dataset.delete);
  }
}

function handleChange(event) {
  const input = event.target.closest("[data-import-json]");
  if (!input) return;
  importJSONFile(input.files?.[0]);
  input.value = "";
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {
      console.info("Service worker registration failed.");
    });
  });
}

async function initApp() {
  if (supabaseClient) {
    const { data } = await supabaseClient.auth.getSession();
    state.authUser = data.session?.user || null;
    state.syncStatus = state.authUser ? "Signed in" : "Sign in for cloud sync";
    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
      state.authUser = session?.user || null;
      state.syncStatus = state.authUser ? "Signed in" : "Signed out";
      if (state.authUser) await loadCloudGames({ silent: true });
      render();
    });
    if (state.authUser) await loadCloudGames({ silent: true });
  }

  if (startupShareCode) {
    loadSharedGame(startupShareCode);
  } else if (startupAuthStatus === "verified") {
    state.screen = "authSuccess";
    render();
  } else {
    render();
  }
}

document.addEventListener("submit", handleSubmit);
document.addEventListener("click", handleClick);
document.addEventListener("change", handleChange);
registerServiceWorker();
initApp();
