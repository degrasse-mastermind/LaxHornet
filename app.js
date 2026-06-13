const STORAGE_KEYS = {
  player: "laxhornet.playerSettings",
  games: "laxhornet.games",
  activeGame: "laxhornet.activeGame",
  reviewGameId: "laxhornet.reviewGameId",
};

const QUARTERS = ["Q1", "Q2", "Q3", "Q4", "OT"];

const STAT_DEFS = [
  { key: "goal", label: "Goal", points: 5, tone: "positive" },
  { key: "assist", label: "Assist", points: 4, tone: "positive" },
  { key: "shot", label: "Shot", points: 1, tone: "neutral" },
  { key: "shotOnGoal", label: "Shot on Goal", points: 2, tone: "positive" },
  { key: "groundBall", label: "Ground Ball", points: 3, tone: "positive" },
  { key: "turnover", label: "Turnover", points: -2, tone: "negative" },
  { key: "causedTurnover", label: "Caused Turnover", points: 3, tone: "positive" },
  { key: "defensiveStop", label: "Defensive Stop", points: 3, tone: "positive" },
  { key: "successfulClear", label: "Successful Clear", points: 2, tone: "positive" },
  { key: "failedClear", label: "Failed Clear", points: -2, tone: "negative" },
  { key: "hustlePlay", label: "Hustle Play", points: 1, tone: "positive" },
  { key: "smartPlay", label: "Smart Play", points: 1, tone: "positive" },
  { key: "penalty", label: "Penalty", points: -2, tone: "negative" },
  { key: "note", label: "Note", points: 0, tone: "neutral" },
];

const STAT_BY_KEY = Object.fromEntries(STAT_DEFS.map((stat) => [stat.key, stat]));

const DEFAULT_PLAYER = {
  name: "Your player",
  number: "",
  team: "",
  position: "",
  notes: "",
};

const app = document.querySelector("#app");

const state = {
  screen: "home",
  player: loadJSON(STORAGE_KEYS.player, DEFAULT_PLAYER),
  games: loadJSON(STORAGE_KEYS.games, []),
  activeGame: loadJSON(STORAGE_KEYS.activeGame, null),
  reviewGameId: loadJSON(STORAGE_KEYS.reviewGameId, null),
  toast: "",
};

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
  const index = state.games.findIndex((item) => item.id === game.id);
  if (index >= 0) {
    state.games[index] = { ...game };
  } else {
    state.games.unshift({ ...game });
  }
  state.games.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
}

function makeGame(formData) {
  return {
    id: uid("game"),
    opponent: formData.get("opponent")?.trim() || "Opponent",
    date: formData.get("date") || todayISO(),
    location: formData.get("location")?.trim() || "",
    gameType: formData.get("gameType") || "Regular season",
    playerSnapshot: { ...state.player },
    currentQuarter: "Q1",
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

  return {
    impact,
    eventCount: events.length,
    goals,
    assists,
    points: goals + assists,
    shots,
    shotsOnGoal,
    shootingPct: shots ? goals / shots : 0,
    shotOnGoalPct: shots ? shotsOnGoal / shots : 0,
    groundBalls: count("groundBall"),
    turnovers: count("turnover"),
    causedTurnovers: count("causedTurnover"),
    defensiveStops: count("defensiveStop"),
    clears: successfulClears,
    failedClears,
    hustlePlays: count("hustlePlay"),
    smartPlays: count("smartPlay"),
    penalties: count("penalty"),
    notes: count("note"),
  };
}

function calculateSeasonTotals() {
  const games = state.games;
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
      groundBalls: 0,
      turnovers: 0,
      causedTurnovers: 0,
      defensiveStops: 0,
      clears: 0,
      failedClears: 0,
      hustlePlays: 0,
      smartPlays: 0,
      penalties: 0,
      notes: 0,
    },
  );

  totals.shootingPct = totals.shots ? totals.goals / totals.shots : 0;
  totals.shotOnGoalPct = totals.shots ? totals.shotsOnGoal / totals.shots : 0;
  totals.averageImpact = totals.gamesPlayed ? totals.impact / totals.gamesPlayed : 0;
  return totals;
}

function pct(value) {
  return `${Math.round(value * 100)}%`;
}

function currentReviewGame() {
  if (state.reviewGameId) {
    return state.games.find((game) => game.id === state.reviewGameId) || state.activeGame;
  }
  return state.activeGame || state.games[0] || null;
}

function saveActiveGame(message = "Game saved locally") {
  if (!state.activeGame) return;
  state.activeGame.savedAt = new Date().toISOString();
  upsertGame(state.activeGame);
  persistAll();
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
    statType: stat.key,
    statLabel: stat.label,
    quarter: state.activeGame.currentQuarter,
    timestamp: new Date().toISOString(),
    note,
    pointValue: stat.points,
  };

  state.activeGame.events.push(event);
  state.activeGame.savedAt = new Date().toISOString();
  persistAll();
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
  render();
  showToast(`Undid ${removed.statLabel}`);
}

function endGame() {
  if (!state.activeGame) return;
  state.activeGame.status = "complete";
  state.activeGame.endedAt = new Date().toISOString();
  state.activeGame.savedAt = new Date().toISOString();
  upsertGame(state.activeGame);
  state.reviewGameId = state.activeGame.id;
  state.activeGame = null;
  persistAll();
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
  render();
  showToast("Game deleted");
}

function setQuarter(quarter) {
  if (!state.activeGame) return;
  state.activeGame.currentQuarter = quarter;
  persistAll();
  render();
}

function renderShell(content, options = {}) {
  const subtitle = state.activeGame
    ? `${state.activeGame.opponent} - ${state.activeGame.currentQuarter}`
    : state.player.name;

  return `
    <header class="topbar">
      <div class="brand-row">
        <button class="brand" type="button" data-nav="home" aria-label="Go home">
          <span class="brand-logo-wrap">
            <img class="brand-logo" src="assets/laxhornet-logo.png" alt="LaxHornet" />
            <h1 class="sr-only">LaxHornet</h1>
            <p class="brand-subtitle">${escapeHTML(subtitle || "Youth lacrosse stats")}</p>
          </span>
        </button>
        <span class="topbar-actions">
          <button class="help-chip" type="button" data-nav="help" aria-label="Open help">?</button>
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
    </nav>
  `;
}

function renderHome() {
  const season = calculateSeasonTotals();
  const active = state.activeGame;

  return renderShell(`
    <section class="screen-title">
      <h2>Game-day stats, fast.</h2>
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
      <p>Set the opponent, then start tracking from Q1.</p>
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
        <label for="location">Location</label>
        <input id="location" name="location" placeholder="Field or town" />
      </div>
      <button class="btn positive" type="submit">Start Live Tracker</button>
    </form>
  `);
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

  return renderShell(`
    <section class="screen-title">
      <h2>${escapeHTML(game.opponent)}</h2>
      <p>${formatDate(game.date)}${game.location ? ` - ${escapeHTML(game.location)}` : ""}</p>
    </section>

    <div class="quarter-tabs" role="group" aria-label="Quarter selector">
      ${QUARTERS.map(
        (quarter) =>
          `<button class="quarter-tab ${game.currentQuarter === quarter ? "active" : ""}" type="button" data-quarter="${quarter}">${quarter}</button>`,
      ).join("")}
    </div>

    <section class="live-summary" aria-label="Live game summary">
      <div class="live-pill"><strong>${totals.impact}</strong><span>Impact</span></div>
      <div class="live-pill"><strong>${totals.points}</strong><span>Points</span></div>
      <div class="live-pill"><strong>${totals.eventCount}</strong><span>Events</span></div>
    </section>

    <section class="tracker-grid" aria-label="Stat buttons">
      ${STAT_DEFS.map(
        (stat) => `
          <button class="stat-button ${stat.tone}" type="button" data-stat="${stat.key}">
            <span class="label">${stat.label}</span>
            <span class="points">${stat.points === 0 ? "note" : `${pointText(stat.points)} impact`}</span>
          </button>
        `,
      ).join("")}
    </section>

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

function renderEventRow(event) {
  const stat = STAT_BY_KEY[event.statType] || { tone: "neutral" };
  return `
    <div class="event-row ${stat.tone}">
      <span class="badge">${escapeHTML(event.quarter)}</span>
      <span>
        <strong>${escapeHTML(event.statLabel)}</strong>
        <p>${formatTime(event.timestamp)}${event.note ? ` - ${escapeHTML(event.note)}` : ""}</p>
      </span>
      <span class="score">${pointText(event.pointValue)}</span>
    </div>
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
      <div class="card pad">
        <h3>Event Log</h3>
        ${
          game.events.length
            ? `<div class="event-list">${[...game.events].reverse().map(renderEventRow).join("")}</div>`
            : `<p class="muted small">No events were logged for this game.</p>`
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
    ["Ground balls", totals.groundBalls],
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
  return renderShell(`
    <section class="screen-title">
      <h2>Past Games</h2>
      <p>Saved games stay on this device and can be reviewed or deleted.</p>
    </section>

    <section class="card">
      ${
        state.games.length
          ? state.games.map(renderGameListRow).join("")
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
    </section>
  `);
}

function render() {
  const screens = {
    home: renderHome,
    settings: renderSettings,
    start: renderStartGame,
    live: renderLiveTracker,
    review: renderReview,
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
  const formData = new FormData(form);

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

  if (form.dataset.form === "start-game") {
    if (state.activeGame && !window.confirm("Replace the current active game? Save it first if needed.")) {
      return;
    }
    state.activeGame = makeGame(formData);
    state.reviewGameId = state.activeGame.id;
    persistAll();
    navigate("live");
    showToast("Live game started");
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

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {
      console.info("Service worker registration failed.");
    });
  });
}

document.addEventListener("submit", handleSubmit);
document.addEventListener("click", handleClick);
registerServiceWorker();
render();
