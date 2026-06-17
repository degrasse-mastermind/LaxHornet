const STORAGE_KEYS = {
  player: "laxhornet.playerSettings",
  players: "laxhornet.players",
  activePlayerId: "laxhornet.activePlayerId",
  games: "laxhornet.games",
  deletedGames: "laxhornet.deletedGames",
  deletedEvents: "laxhornet.deletedEvents",
  activeGame: "laxhornet.activeGame",
  reviewGameId: "laxhornet.reviewGameId",
  teams: "laxhornet.teams",
  rosterPlayers: "laxhornet.rosterPlayers",
  activeTeamId: "laxhornet.activeTeamId",
  teamAccessRequests: "laxhornet.teamAccessRequests",
  playerClaims: "laxhornet.playerClaims",
  adminViewMode: "laxhornet.adminViewMode",
};

const SUPABASE_CONFIG = {
  url: "https://ulbmjcvnyznvmjgpstno.supabase.co",
  publishableKey: "sb_publishable_-RUc79OPosRLNP5B6JIH2A_f3I_2A0M",
};

const PLATFORM_REVIEWER_EMAIL = "degrassed@gmail.com";
const APP_VERSION = "v123";

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
  id: "",
  name: "Your player",
  number: "",
  team: "",
  position: "",
  notes: "",
};

const DEFAULT_TEAM_INVITE_LENGTH = 6;
const TEAM_MANAGE_ROLES = ["admin"];
const APP_ROLES = ["tracker", "admin"];
const PLAYER_POSITIONS = ["Attack", "Midfield", "Defense", "Goalie", "Faceoff", "LSM", "SSDM"];

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
let activeStorageUserId = "";
let waitingServiceWorker = null;
let reloadingForUpdate = false;
let serviceWorkerRegistration = null;
const initialStoredState = readStoredAccountState();

const state = {
  screen: "home",
  players: initialStoredState.players,
  activePlayerId: initialStoredState.activePlayerId,
  player: activePlayerFrom(initialStoredState.players, initialStoredState.activePlayerId),
  teams: initialStoredState.teams,
  rosterPlayers: initialStoredState.rosterPlayers,
  activeTeamId: initialStoredState.activeTeamId,
  teamAccessRequests: initialStoredState.teamAccessRequests,
  playerClaims: initialStoredState.playerClaims,
  games: initialStoredState.games,
  activeGame: initialStoredState.activeGame,
  reviewGameId: initialStoredState.reviewGameId,
  authUser: null,
  authUserId: "",
  userProfile: null,
  adminRequests: [],
  sharedGame: null,
  sharedCode: startupShareCode,
  syncStatus: supabaseClient ? "Live Share ready" : "Live Share unavailable",
  cloudError: "",
  editingEventId: null,
  editingGameDetails: false,
  tagEditingEventId: null,
  tagDraftTags: [],
  deletedGameIds: initialStoredState.deletedGameIds,
  deletedEventIds: initialStoredState.deletedEventIds,
  watchShareExpanded: false,
  teamRosterExpanded: true,
  teamAccessExpanded: false,
  exportToolsExpanded: false,
  helpExpanded: false,
  adminViewMode: initialStoredState.adminViewMode,
  signupDraft: null,
  accessRequestSummary: null,
  toast: "",
  updateAvailable: false,
  updateInstalling: false,
  authBusy: false,
};

mergeRosterPlayersIntoPlayers();
if (initialStoredState.activePlayerId && state.players.some((player) => player.id === initialStoredState.activePlayerId)) {
  state.activePlayerId = initialStoredState.activePlayerId;
}
ensureActiveTeamRosterPlayer();
syncActivePlayer();
state.games = state.games.map((game) => normalizeGame(game, state.player));
state.activeGame = state.activeGame ? normalizeGame(state.activeGame, state.player) : null;
mergePlayersFromGames([state.activeGame, ...state.games].filter(Boolean));
persistAll();

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(scopedStorageKey(key));
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(scopedStorageKey(key), JSON.stringify(value));
}

function removeStoredItem(key) {
  localStorage.removeItem(scopedStorageKey(key));
}

function scopedStorageKey(key) {
  return activeStorageUserId ? `${key}.user.${activeStorageUserId}` : key;
}

function readStoredAccountState(userId = activeStorageUserId) {
  activeStorageUserId = userId || "";
  const storedPlayer = normalizePlayer(loadJSON(STORAGE_KEYS.player, DEFAULT_PLAYER), { createId: true });
  const players = normalizePlayers(loadJSON(STORAGE_KEYS.players, null), storedPlayer);
  const activePlayerId = loadJSON(STORAGE_KEYS.activePlayerId, storedPlayer.id);
  const safeActivePlayerId = players.some((player) => player.id === activePlayerId) ? activePlayerId : players[0].id;
  const adminViewMode = loadJSON(STORAGE_KEYS.adminViewMode, "admin") === "tracker" ? "tracker" : "admin";

  return {
    players,
    activePlayerId: safeActivePlayerId,
    teams: normalizeTeams(loadJSON(STORAGE_KEYS.teams, [])),
    rosterPlayers: normalizeRosterPlayers(loadJSON(STORAGE_KEYS.rosterPlayers, [])),
    activeTeamId: loadJSON(STORAGE_KEYS.activeTeamId, ""),
    teamAccessRequests: normalizeTeamAccessRequests(loadJSON(STORAGE_KEYS.teamAccessRequests, [])),
    playerClaims: normalizePlayerClaims(loadJSON(STORAGE_KEYS.playerClaims, [])),
    games: loadJSON(STORAGE_KEYS.games, []),
    activeGame: loadJSON(STORAGE_KEYS.activeGame, null),
    reviewGameId: loadJSON(STORAGE_KEYS.reviewGameId, null),
    deletedGameIds: loadJSON(STORAGE_KEYS.deletedGames, []),
    deletedEventIds: loadJSON(STORAGE_KEYS.deletedEvents, []),
    adminViewMode,
  };
}

function uid(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizePlayer(player = {}, options = {}) {
  const id = player.id || player.playerId || player.player_id || (options.createId ? uid("player") : "");
  const teamId = player.teamId || player.team_id || "";
  const rosterPlayerId = player.rosterPlayerId || player.roster_player_id || (teamId ? id : "");
  return {
    id,
    name: String(player.name || "").trim() || DEFAULT_PLAYER.name,
    number: String(player.number || "").trim(),
    team: String(player.team || "").trim(),
    position: String(player.position || "").trim(),
    notes: String(player.notes || "").trim(),
    teamId,
    rosterPlayerId,
    source: player.source || (teamId ? "teamRoster" : "local"),
  };
}

function normalizeTeam(team = {}) {
  const id = team.id || team.teamId || team.team_id || "";
  return {
    id,
    name: String(team.name || "").trim() || "Team",
    inviteCode: String(team.inviteCode || team.invite_code || "").trim().toUpperCase(),
    trackerCode: String(team.trackerCode || team.tracker_code || "").trim().toUpperCase(),
    role: normalizeTeamRole(team.role || "tracker"),
    createdBy: team.createdBy || team.created_by || "",
    createdAt: team.createdAt || team.created_at || new Date().toISOString(),
  };
}

function normalizeTeamRole(role = "tracker") {
  const cleanRole = String(role || "").trim().toLowerCase();
  if (cleanRole === "member" || cleanRole === "viewer") return "tracker";
  return ["admin", "tracker"].includes(cleanRole) ? cleanRole : "tracker";
}

function normalizeTeams(teams = []) {
  const merged = new Map();
  (Array.isArray(teams) ? teams : []).forEach((team) => {
    const normalized = normalizeTeam(team);
    const existing = merged.get(normalized.id);
    if (normalized.id) {
      merged.set(normalized.id, {
        ...existing,
        ...normalized,
        inviteCode: normalized.inviteCode || existing?.inviteCode || "",
        trackerCode: normalized.trackerCode || existing?.trackerCode || "",
        role: TEAM_MANAGE_ROLES.includes(existing?.role) && normalized.role === "tracker" ? existing.role : normalized.role,
      });
    }
  });
  return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function normalizeTeamAccessRequest(request = {}) {
  return {
    id: request.id || request.requestId || request.request_id || "",
    teamId: request.teamId || request.team_id || "",
    teamName: request.teamName || request.team_name || "",
    userId: request.userId || request.user_id || "",
    email: request.email || "",
    firstName: String(request.firstName || request.first_name || "").trim(),
    lastName: String(request.lastName || request.last_name || "").trim(),
    phone: String(request.phone || "").trim(),
    childJerseyNumber: String(request.childJerseyNumber || request.child_jersey_number || "").trim(),
    requestedRole: normalizeTeamRole(request.requestedRole || request.requested_role || "tracker"),
    status: String(request.status || "pending").trim().toLowerCase(),
    createdAt: request.createdAt || request.created_at || null,
  };
}

function normalizeTeamAccessRequests(requests = []) {
  const merged = new Map();
  (Array.isArray(requests) ? requests : []).forEach((request) => {
    const normalized = normalizeTeamAccessRequest(request);
    if (normalized.id) merged.set(normalized.id, { ...merged.get(normalized.id), ...normalized });
  });
  return [...merged.values()].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function normalizeRosterPlayer(player = {}) {
  const teamId = player.teamId || player.team_id || "";
  const id = player.id || player.rosterPlayerId || player.roster_player_id || (teamId ? uid("roster") : "");
  return {
    id,
    teamId,
    name: String(player.name || "").trim() || "Roster Player",
    number: String(player.number || "").trim(),
    position: String(player.position || "").trim(),
    active: player.active !== false,
    createdAt: player.createdAt || player.created_at || new Date().toISOString(),
  };
}

function normalizeRosterPlayers(players = []) {
  const merged = new Map();
  (Array.isArray(players) ? players : []).forEach((player) => {
    const normalized = normalizeRosterPlayer(player);
    if (normalized.id && normalized.teamId) merged.set(normalized.id, { ...merged.get(normalized.id), ...normalized });
  });
  return [...merged.values()].sort((a, b) => {
    const numberDiff = Number(a.number) - Number(b.number);
    if (Number.isFinite(numberDiff) && numberDiff !== 0) return numberDiff;
    return a.name.localeCompare(b.name);
  });
}

function normalizePlayerClaim(claim = {}) {
  return {
    id: claim.id || claim.claimId || claim.claim_id || "",
    teamId: claim.teamId || claim.team_id || "",
    rosterPlayerId: claim.rosterPlayerId || claim.roster_player_id || "",
    userId: claim.userId || claim.user_id || "",
    createdAt: claim.createdAt || claim.created_at || null,
  };
}

function normalizePlayerClaims(claims = []) {
  const merged = new Map();
  (Array.isArray(claims) ? claims : []).forEach((claim) => {
    const normalized = normalizePlayerClaim(claim);
    if (normalized.teamId && normalized.rosterPlayerId) {
      merged.set(`${normalized.teamId}|${normalized.rosterPlayerId}`, { ...merged.get(`${normalized.teamId}|${normalized.rosterPlayerId}`), ...normalized });
    }
  });
  return [...merged.values()];
}

function teamById(teamId) {
  return state.teams.find((team) => team.id === teamId) || null;
}

function teamRole(teamId) {
  const role = normalizeTeamRole(teamById(teamId)?.role || "tracker");
  return !isPlatformReviewer() && role === "admin" ? "tracker" : role;
}

function teamRoleLabel(role) {
  const cleanRole = normalizeTeamRole(role);
  if (cleanRole === "admin") return "Admin";
  return "Parent Tracker";
}

function canEditTeam(teamId) {
  return isPlatformReviewer() && TEAM_MANAGE_ROLES.includes(teamRole(teamId));
}

function canManageRoster(teamId) {
  return isPlatformReviewer() && teamRole(teamId) === "admin";
}

function hasPlayerClaim(teamId, rosterPlayerId) {
  if (!teamId || !rosterPlayerId) return false;
  return state.playerClaims.some((claim) => claim.teamId === teamId && claim.rosterPlayerId === rosterPlayerId);
}

function canTrackRosterPlayer(teamId, rosterPlayerId) {
  const role = teamRole(teamId);
  if (!teamId) return true;
  if (isPlatformReviewer() && role === "admin") return true;
  if (role === "tracker") return hasPlayerClaim(teamId, rosterPlayerId);
  return false;
}

function canTrackPlayer(player = state.player) {
  const normalized = normalizePlayer(player);
  if (!isTeamPlayer(normalized)) return true;
  return canTrackRosterPlayer(normalized.teamId, normalized.rosterPlayerId || normalized.id);
}

function visibleRosterPlayers(roster = state.rosterPlayers) {
  return roster.filter((player) => {
    const normalized = normalizeRosterPlayer(player);
    return normalized.active !== false && canTrackRosterPlayer(normalized.teamId, normalized.id);
  });
}

function teamRosterPlayers(teamId) {
  if (!teamId) return [];
  return state.rosterPlayers.filter((player) => {
    const normalized = normalizeRosterPlayer(player);
    return normalized.teamId === teamId && normalized.active !== false;
  });
}

function visiblePlayers() {
  const localPlayers = state.players.filter((player) => !player.teamId);
  const rosterPlayers = visibleRosterPlayers().map(rosterPlayerToPlayer);
  const filteredLocalPlayers = rosterPlayers.length
    ? localPlayers.filter((player) => !isDefaultPlaceholderPlayer(player))
    : localPlayers;
  return dedupePlayers([...filteredLocalPlayers, ...rosterPlayers], state.activePlayerId).players;
}

function canEditGame(game = {}) {
  const teamId = gameTeamId(game);
  if (!teamId) return true;
  return canTrackRosterPlayer(teamId, gameRosterPlayerId(game));
}

function activeTeam() {
  return teamById(state.activeTeamId) || state.teams[0] || null;
}

function rosterPlayerToPlayer(rosterPlayer = {}) {
  const normalized = normalizeRosterPlayer(rosterPlayer);
  const team = teamById(normalized.teamId);
  return normalizePlayer({
    id: normalized.id,
    rosterPlayerId: normalized.id,
    teamId: normalized.teamId,
    name: normalized.name,
    number: normalized.number,
    team: team?.name || "",
    position: normalized.position,
    source: "teamRoster",
  });
}

function mergeRosterPlayersIntoPlayers() {
  const localPlayers = state.players.filter((player) => !player.teamId);
  const rosterPlayers = visibleRosterPlayers().map(rosterPlayerToPlayer);
  const filteredLocalPlayers = rosterPlayers.length
    ? localPlayers.filter((player) => !isDefaultPlaceholderPlayer(player))
    : localPlayers;
  state.players = dedupePlayers([...filteredLocalPlayers, ...rosterPlayers], state.activePlayerId).players;
  if (state.activeTeamId && !state.teams.some((team) => team.id === state.activeTeamId)) {
    state.activeTeamId = state.teams[0]?.id || "";
  }
}

function ensureActiveTeamRosterPlayer() {
  const allVisibleRoster = visibleRosterPlayers();
  if (!allVisibleRoster.length) return;
  if (allVisibleRoster.some((player) => player.id === state.activePlayerId)) return;
  const activeRoster = activeTeamRoster();
  state.activePlayerId = activeRoster[0]?.id || allVisibleRoster[0].id;
}

function activeTeamRoster() {
  const team = activeTeam();
  if (!team) return [];
  return visibleRosterPlayers(teamRosterPlayers(team.id));
}

function teamIds() {
  return state.teams.map((team) => team.id).filter(Boolean);
}

function makeInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < DEFAULT_TEAM_INVITE_LENGTH; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function isTeamPlayer(player = {}) {
  const normalized = normalizePlayer(player);
  return Boolean(normalized.teamId && normalized.rosterPlayerId);
}

function isDefaultPlaceholderPlayer(player = {}) {
  const normalized = normalizePlayer(player);
  return !normalized.teamId
    && normalized.name === DEFAULT_PLAYER.name
    && !normalized.number
    && !normalized.team
    && !normalized.position
    && !normalized.notes;
}

function normalizePlayers(players, fallbackPlayer = normalizePlayer(DEFAULT_PLAYER, { createId: true })) {
  const source = Array.isArray(players) && players.length ? players : [fallbackPlayer];
  const merged = new Map();
  source.forEach((player) => {
    const normalized = normalizePlayer(player, { createId: true });
    merged.set(normalized.id, normalized);
  });
  return dedupePlayers([...merged.values()]).players;
}

function activePlayerFrom(players, activePlayerId) {
  return players.find((player) => player.id === activePlayerId) || players[0] || normalizePlayer(DEFAULT_PLAYER, { createId: true });
}

function playerIdentityKey(player = {}) {
  const normalized = normalizePlayer(player);
  if (normalized.teamId) {
    return ["team", normalized.teamId, normalized.rosterPlayerId || normalized.id, normalized.number]
      .map((value) => String(value || "").trim().toLowerCase())
      .join("|");
  }
  return [normalized.name, normalized.number, normalized.team, normalized.position]
    .map((value) => value.trim().toLowerCase())
    .join("|");
}

function mergePlayerDetails(base, next) {
  return {
    ...base,
    name: base.name && base.name !== DEFAULT_PLAYER.name ? base.name : next.name,
    number: base.number || next.number,
    team: base.team || next.team,
    position: base.position || next.position,
    notes: base.notes || next.notes,
    teamId: base.teamId || next.teamId || "",
    rosterPlayerId: base.rosterPlayerId || next.rosterPlayerId || "",
    source: base.source || next.source || "local",
  };
}

function dedupePlayers(players = [], preferredId = "") {
  const byId = new Map();
  const byKey = new Map();
  const idMap = new Map();
  const ordered = [];

  const orderedPlayers = [...players].sort((a, b) => {
    if (a.id === preferredId) return -1;
    if (b.id === preferredId) return 1;
    return 0;
  });

  orderedPlayers.forEach((player) => {
    const normalized = normalizePlayer(player, { createId: true });
    const key = playerIdentityKey(normalized);
    const existingId = byKey.get(key);
    if (existingId) {
      const existing = byId.get(existingId);
      byId.set(existingId, mergePlayerDetails(existing, normalized));
      idMap.set(normalized.id, existingId);
      return;
    }
    byId.set(normalized.id, normalized);
    byKey.set(key, normalized.id);
    idMap.set(normalized.id, normalized.id);
    ordered.push(normalized.id);
  });

  return {
    players: ordered.map((id) => byId.get(id)).filter(Boolean),
    idMap,
  };
}

function syncActivePlayer() {
  if (!state.players.length) state.players = [normalizePlayer(DEFAULT_PLAYER, { createId: true })];
  if (!state.players.some((player) => player.id === state.activePlayerId)) {
    state.activePlayerId = state.players[0].id;
  }
  state.player = activePlayerFrom(state.players, state.activePlayerId);
}

function playerTitle(player = state.player) {
  const normalized = normalizePlayer(player);
  return `${normalized.name || "Player"}${normalized.number ? ` #${normalized.number}` : ""}`;
}

function playerSubline(player = state.player) {
  const normalized = normalizePlayer(player);
  return [normalized.team, normalized.position].filter(Boolean).join(" - ") || "Add player details before the next game.";
}

function gamePlayerId(game = {}) {
  return game.playerId || game.player_id || game.playerSnapshot?.id || game.player_snapshot?.id || "";
}

function gameTeamId(game = {}) {
  return game.teamId || game.team_id || game.playerSnapshot?.teamId || game.player_snapshot?.team_id || "";
}

function gameRosterPlayerId(game = {}) {
  return game.rosterPlayerId || game.roster_player_id || game.playerSnapshot?.rosterPlayerId || game.player_snapshot?.roster_player_id || "";
}

function gamePlayerSnapshot(game = {}) {
  return normalizePlayer(game.playerSnapshot || game.player_snapshot || state.player);
}

function gameBelongsToPlayer(game = {}, player = state.player) {
  const normalized = normalizePlayer(player);
  const rosterPlayerId = normalized.rosterPlayerId || (normalized.teamId ? normalized.id : "");
  const gameRosterId = gameRosterPlayerId(game);
  const gameTeam = gameTeamId(game);
  const gamePlayer = gamePlayerId(game);
  if (rosterPlayerId) {
    return gameRosterId === rosterPlayerId || (gamePlayer === normalized.id && (!gameTeam || gameTeam === normalized.teamId));
  }
  return gamePlayer === normalized.id;
}

function playerGameCount(playerId) {
  const player = state.players.find((item) => item.id === playerId);
  if (!player) return 0;
  return state.games.filter((game) => gameBelongsToPlayer(game, player)).length;
}

function playerHasAnyGames(player = state.player) {
  const normalized = normalizePlayer(player);
  const matchesPlayer = (game) => gameBelongsToPlayer(game, normalized);
  return Boolean((state.activeGame && matchesPlayer(state.activeGame)) || state.games.some(matchesPlayer));
}

function setActivePlayer(playerId, message = "") {
  if (!state.players.some((player) => player.id === playerId)) return;
  state.activePlayerId = playerId;
  syncActivePlayer();
  if (state.player.teamId) state.activeTeamId = state.player.teamId;
  persistAll();
  render();
  if (message) showToast(message);
}

function updatePlayerInRoster(player) {
  if (isTeamPlayer(player) && !canEditTeam(player.teamId)) {
    showToast("View-only team roster");
    return;
  }
  const normalized = normalizePlayer(player, { createId: true });
  state.players = state.players.map((item) => (item.id === normalized.id ? normalized : item));
  state.activePlayerId = normalized.id;
  syncActivePlayer();

  const applySnapshot = (game) =>
    gamePlayerId(game) === normalized.id
      ? normalizeGame({ ...game, playerId: normalized.id, playerSnapshot: { ...normalized } }, normalized)
      : game;

  state.games = state.games.map(applySnapshot);
  if (state.activeGame) state.activeGame = applySnapshot(state.activeGame);
  reconcilePlayerRoster();
  state.games
    .filter((game) => gamePlayerId(game) === normalized.id)
    .forEach((game) => syncGameToSupabase(game));
}

function applyRosterPlayerUpdate(rosterPlayer, options = {}) {
  const normalizedRosterPlayer = normalizeRosterPlayer(rosterPlayer);
  const nextRosterPlayers = state.rosterPlayers.filter((item) => item.id !== normalizedRosterPlayer.id);
  state.rosterPlayers = normalizeRosterPlayers([...nextRosterPlayers, normalizedRosterPlayer]);

  const nextPlayer = rosterPlayerToPlayer(normalizedRosterPlayer);
  if (normalizedRosterPlayer.active !== false) {
    state.players = dedupePlayers([...state.players.filter((item) => item.id !== nextPlayer.id), nextPlayer], nextPlayer.id).players;
    state.activePlayerId = nextPlayer.id;
  } else if (state.activePlayerId === normalizedRosterPlayer.id) {
    const replacement = activeTeamRoster().find((item) => item.id !== normalizedRosterPlayer.id) || state.rosterPlayers.find((item) => item.active !== false);
    state.activePlayerId = replacement?.id || state.players.find((item) => item.id !== normalizedRosterPlayer.id)?.id || state.players[0]?.id || "";
  }

  const applySnapshot = (game) => {
    if (normalizedRosterPlayer.active === false) return game;
    return gameRosterPlayerId(game) === normalizedRosterPlayer.id || gamePlayerId(game) === normalizedRosterPlayer.id
      ? normalizeGame({ ...game, playerId: nextPlayer.id, rosterPlayerId: nextPlayer.rosterPlayerId, playerSnapshot: { ...nextPlayer } }, nextPlayer)
      : game;
  };

  state.games = state.games.map(applySnapshot);
  if (state.activeGame) state.activeGame = applySnapshot(state.activeGame);
  mergeRosterPlayersIntoPlayers();
  syncActivePlayer();
  persistAll();

  if (options.syncGames && normalizedRosterPlayer.active !== false) {
    state.games
      .filter((game) => gameRosterPlayerId(game) === normalizedRosterPlayer.id || gamePlayerId(game) === normalizedRosterPlayer.id)
      .forEach((game) => syncGameToSupabase(game));
  }
}

function addPlayer() {
  const player = normalizePlayer({ name: `Player ${state.players.length + 1}` }, { createId: true });
  state.players = [...state.players, player];
  state.activePlayerId = player.id;
  syncActivePlayer();
  persistAll();
  render();
  showToast("New player added");
}

function deleteActivePlayer() {
  if (state.players.length <= 1) {
    showToast("Keep at least one player");
    return;
  }
  const activeGameMatches = state.activeGame && gamePlayerId(state.activeGame) === state.activePlayerId;
  const savedGames = playerGameCount(state.activePlayerId);
  if (activeGameMatches || savedGames) {
    showToast("Delete this player's games first");
    return;
  }
  const removedName = state.player.name;
  state.players = state.players.filter((player) => player.id !== state.activePlayerId);
  state.activePlayerId = state.players[0].id;
  syncActivePlayer();
  persistAll();
  render();
  showToast(`${removedName} removed`);
}

function mergePlayersFromGames(games = []) {
  const players = new Map(state.players.map((player) => [player.id, player]));
  games.forEach((game) => {
    const snapshot = normalizePlayer(game.playerSnapshot || game.player_snapshot || {});
    const matchingPlayer = [...players.values()].find((player) => playerIdentityKey(player) === playerIdentityKey(snapshot));
    if (matchingPlayer) {
      players.set(matchingPlayer.id, mergePlayerDetails(matchingPlayer, snapshot));
    } else if (snapshot.id && !players.has(snapshot.id)) {
      players.set(snapshot.id, snapshot);
    }
  });
  state.players = [...players.values()];
  reconcilePlayerRoster();
}

function reconcilePlayerRoster() {
  const { players, idMap } = dedupePlayers(state.players, state.activePlayerId);
  state.players = players.length ? players : [normalizePlayer(DEFAULT_PLAYER, { createId: true })];
  state.activePlayerId = idMap.get(state.activePlayerId) || state.activePlayerId;

  const playersByKey = new Map(state.players.map((player) => [playerIdentityKey(player), player]));
  const reconcileGame = (game) => {
    const snapshot = gamePlayerSnapshot(game);
    const originalId = gamePlayerId(game);
    const mappedId = idMap.get(originalId);
    const matchedPlayer = mappedId
      ? state.players.find((player) => player.id === mappedId)
      : playersByKey.get(playerIdentityKey(snapshot));
    return matchedPlayer
      ? normalizeGame({ ...game, playerId: matchedPlayer.id, playerSnapshot: { ...matchedPlayer } }, matchedPlayer)
      : game;
  };

  state.games = state.games.map(reconcileGame);
  if (state.activeGame) state.activeGame = reconcileGame(state.activeGame);
  syncActivePlayer();
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

function normalizeAppRole(role = "tracker") {
  const cleanRole = String(role || "").trim().toLowerCase();
  if (cleanRole === "viewer") return "tracker";
  return APP_ROLES.includes(cleanRole) ? cleanRole : "tracker";
}

function appRoleLabel(role = "tracker") {
  const cleanRole = normalizeAppRole(role);
  if (cleanRole === "admin") return "Admin";
  return "Parent Tracker";
}

function isReviewerAccount() {
  return userEmail().trim().toLowerCase() === PLATFORM_REVIEWER_EMAIL.toLowerCase();
}

function isPlatformReviewer() {
  return isReviewerAccount() && state.adminViewMode !== "tracker";
}

function normalizeUserProfile(profile = {}) {
  return {
    userId: profile.userId || profile.user_id || currentUserId() || "",
    email: profile.email || userEmail(),
    firstName: String(profile.firstName || profile.first_name || "").trim(),
    lastName: String(profile.lastName || profile.last_name || "").trim(),
    phone: String(profile.phone || "").trim(),
    childJerseyNumber: String(profile.childJerseyNumber || profile.child_jersey_number || "").trim(),
    onboardingCompleted: Boolean(profile.onboardingCompleted ?? profile.onboarding_completed ?? false),
    requestedRole: normalizeAppRole(profile.requestedRole || profile.requested_role || "tracker"),
    approvedRole: normalizeAppRole(profile.approvedRole || profile.approved_role || (isReviewerAccount() ? "admin" : "tracker")),
    adminStatus: String(profile.adminStatus || profile.admin_status || "approved").trim().toLowerCase(),
    reviewedBy: profile.reviewedBy || profile.reviewed_by || "",
    reviewedAt: profile.reviewedAt || profile.reviewed_at || null,
    createdAt: profile.createdAt || profile.created_at || null,
    updatedAt: profile.updatedAt || profile.updated_at || null,
  };
}

function currentAppRole() {
  if (isReviewerAccount()) return isPlatformReviewer() ? "admin" : "tracker";
  return normalizeAppRole(state.userProfile?.approvedRole || "tracker");
}

function requestedAdminPending() {
  return false;
}

function canCreateTeams() {
  return isPlatformReviewer();
}

function setAdminViewMode(mode) {
  if (!isReviewerAccount()) return;
  state.adminViewMode = mode === "tracker" ? "tracker" : "admin";
  mergeRosterPlayersIntoPlayers();
  ensureActiveTeamRosterPlayer();
  syncActivePlayer();
  persistAll();
  render();
  showToast(state.adminViewMode === "tracker" ? "Tracker mode on" : "Admin mode on");
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

function uniqueIds(ids = []) {
  return [...new Set(ids.map((id) => String(id || "").trim()).filter(Boolean))];
}

function rememberDeletedGame(gameId) {
  state.deletedGameIds = uniqueIds([...state.deletedGameIds, gameId]);
}

function rememberDeletedEvent(eventId) {
  state.deletedEventIds = uniqueIds([...state.deletedEventIds, eventId]);
}

function isDeletedGame(gameId) {
  return state.deletedGameIds.includes(gameId);
}

function isDeletedEvent(eventId) {
  return state.deletedEventIds.includes(eventId);
}

function normalizeEvent(event = {}, gameId = "") {
  const stat = STAT_BY_KEY[event.statType] || {
    key: event.statType || "note",
    label: event.statLabel || "Note",
    points: Number(event.pointValue || 0),
    category: event.category || "Note",
  };
  const rawPointValue = event.pointValue ?? event.point_value;
  const numericPointValue = Number(rawPointValue);
  const hasStoredPointValue = rawPointValue !== undefined && rawPointValue !== null && rawPointValue !== "";
  const storedPointValueLooksWrong = stat.key !== "note" && Number(stat.points || 0) !== 0 && numericPointValue === 0;
  const pointValue =
    hasStoredPointValue && Number.isFinite(numericPointValue) && !storedPointValueLooksWrong
      ? numericPointValue
      : Number(stat.points || 0);

  return {
    id: event.id || uid("event"),
    gameId: event.gameId || gameId,
    userId: event.userId || event.user_id || "",
    teamId: event.teamId || event.team_id || "",
    rosterPlayerId: event.rosterPlayerId || event.roster_player_id || "",
    timestamp: event.timestamp || new Date().toISOString(),
    quarter: event.quarter || "Q1",
    statType: stat.key,
    statLabel: event.statLabel || stat.label,
    category: event.category || stat.category || "General",
    pointValue,
    tags: uniqueTags(event.tags),
    note: event.note || "",
    fieldZone: event.fieldZone || "",
    correctedAt: event.correctedAt || null,
    tagsUpdatedAt: event.tagsUpdatedAt || null,
  };
}

function normalizeGame(game = {}, fallbackPlayer = null) {
  const id = game.id || uid("game");
  const periodFormat = periodFormatForGame(game);
  const periods = PERIOD_FORMATS[periodFormat].periods;
  const currentQuarter = game.currentQuarter || game.current_quarter || PERIOD_FORMATS[periodFormat].start;
  const fallbackSnapshot = fallbackPlayer ? normalizePlayer(fallbackPlayer) : null;
  const rawSnapshot = game.playerSnapshot || game.player_snapshot || fallbackSnapshot || {};
  let playerSnapshot = normalizePlayer(rawSnapshot);
  const playerId = game.playerId || game.player_id || playerSnapshot.id || fallbackSnapshot?.id || "";
  const teamId = game.teamId || game.team_id || playerSnapshot.teamId || "";
  const rosterPlayerId = game.rosterPlayerId || game.roster_player_id || playerSnapshot.rosterPlayerId || (teamId ? playerId : "");
  if (playerId && !playerSnapshot.id) playerSnapshot = { ...playerSnapshot, id: playerId };
  if (teamId) playerSnapshot = { ...playerSnapshot, teamId, rosterPlayerId: rosterPlayerId || playerSnapshot.rosterPlayerId || playerId };
  if ((!playerSnapshot.name || playerSnapshot.name === DEFAULT_PLAYER.name) && fallbackSnapshot?.name) {
    playerSnapshot = { ...fallbackSnapshot, id: playerId || fallbackSnapshot.id };
  }
  return {
    ...game,
    id,
    playerId: playerId || playerSnapshot.id || "",
    teamId,
    rosterPlayerId,
    playerSnapshot,
    shareCode: game.shareCode || game.share_code || makeShareCode(),
    userId: game.userId || game.user_id || "",
    isShared: Boolean(game.isShared ?? game.is_shared ?? false),
    periodFormat,
    currentQuarter: periods.includes(currentQuarter) ? currentQuarter : periods[0],
    events: (game.events || [])
      .filter((event) => !isDeletedEvent(event.id))
      .map((event) => normalizeEvent({ ...event, teamId: event.teamId || event.team_id || teamId, rosterPlayerId: event.rosterPlayerId || event.roster_player_id || rosterPlayerId }, id)),
  };
}

function persistAll() {
  mergeRosterPlayersIntoPlayers();
  if (!state.activePlayerId) ensureActiveTeamRosterPlayer();
  syncActivePlayer();
  saveJSON(STORAGE_KEYS.player, state.player);
  saveJSON(STORAGE_KEYS.players, state.players);
  saveJSON(STORAGE_KEYS.activePlayerId, state.activePlayerId);
  saveJSON(STORAGE_KEYS.teams, state.teams);
  saveJSON(STORAGE_KEYS.rosterPlayers, state.rosterPlayers);
  saveJSON(STORAGE_KEYS.activeTeamId, state.activeTeamId);
  saveJSON(STORAGE_KEYS.teamAccessRequests, normalizeTeamAccessRequests(state.teamAccessRequests));
  saveJSON(STORAGE_KEYS.playerClaims, normalizePlayerClaims(state.playerClaims));
  saveJSON(STORAGE_KEYS.adminViewMode, state.adminViewMode === "tracker" ? "tracker" : "admin");
  saveJSON(STORAGE_KEYS.deletedGames, uniqueIds(state.deletedGameIds));
  saveJSON(STORAGE_KEYS.deletedEvents, uniqueIds(state.deletedEventIds));
  saveJSON(STORAGE_KEYS.games, state.games);
  if (state.activeGame) {
    saveJSON(STORAGE_KEYS.activeGame, state.activeGame);
  } else {
    removeStoredItem(STORAGE_KEYS.activeGame);
  }
  saveJSON(STORAGE_KEYS.reviewGameId, state.reviewGameId);
}

function applyStoredAccountState(userId) {
  const stored = readStoredAccountState(userId);
  state.players = stored.players;
  state.activePlayerId = stored.activePlayerId;
  state.player = activePlayerFrom(stored.players, stored.activePlayerId);
  state.teams = stored.teams;
  state.rosterPlayers = stored.rosterPlayers;
  state.activeTeamId = stored.activeTeamId;
  state.teamAccessRequests = stored.teamAccessRequests;
  state.playerClaims = stored.playerClaims;
  state.adminViewMode = stored.adminViewMode;
  state.games = stored.games;
  state.activeGame = stored.activeGame;
  state.reviewGameId = stored.reviewGameId;
  state.deletedGameIds = stored.deletedGameIds;
  state.deletedEventIds = stored.deletedEventIds;
  state.userProfile = null;
  state.adminRequests = [];
  state.editingEventId = null;
  state.editingGameDetails = false;
  state.tagEditingEventId = null;
  state.tagDraftTags = [];
  mergeRosterPlayersIntoPlayers();
  ensureActiveTeamRosterPlayer();
  syncActivePlayer();
  state.games = state.games.map((game) => normalizeGame(game, state.player));
  state.activeGame = state.activeGame ? normalizeGame(state.activeGame, state.player) : null;
  mergePlayersFromGames([state.activeGame, ...state.games].filter(Boolean));
  persistAll();
}

function resetCloudAccountState() {
  state.teams = [];
  state.rosterPlayers = [];
  state.activeTeamId = "";
  state.teamAccessRequests = [];
  state.playerClaims = [];
  state.adminViewMode = "admin";
  state.userProfile = null;
  state.adminRequests = [];
  state.players = normalizePlayers(state.players.filter((player) => !player.teamId), normalizePlayer(DEFAULT_PLAYER, { createId: true }));
  state.activePlayerId = state.players[0]?.id || "";
  syncActivePlayer();
  persistAll();
}

function setAuthUser(user) {
  const nextUserId = user?.id || "";
  if (nextUserId !== state.authUserId) {
    if (state.authUserId && activeStorageUserId === state.authUserId) persistAll();
    state.authUserId = nextUserId;
    state.authUser = user || null;
    applyStoredAccountState(nextUserId);
  } else {
    state.authUser = user || null;
  }
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
  if (screen === "settings") screen = "player";
  if (screen === "teamAccess") screen = "team";
  state.screen = screen;
  persistAll();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function upsertGame(game) {
  game = normalizeGame(game);
  if (isDeletedGame(game.id)) return;
  const index = state.games.findIndex((item) => item.id === game.id);
  if (index >= 0) {
    state.games[index] = { ...game };
  } else {
    state.games.unshift({ ...game });
  }
  state.games.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
}

function saveReviewedGame(game, message = "Game updated") {
  if (!canEditGame(game)) {
    showToast("View-only team access");
    return;
  }
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
  const player = { ...state.player };
  const teamId = player.teamId || "";
  const rosterPlayerId = player.rosterPlayerId || (teamId ? player.id : "");
  return {
    id: uid("game"),
    playerId: player.id,
    teamId,
    rosterPlayerId,
    shareCode: makeShareCode(),
    userId: currentUserId() || "",
    isShared: false,
    periodFormat,
    opponent: formData.get("opponent")?.trim() || "Opponent",
    date: formData.get("date") || todayISO(),
    location: formData.get("location")?.trim() || "",
    gameType: formData.get("gameType") || "Regular season",
    playerSnapshot: player,
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
  return calculateSeasonTotalsFromGames(games);
}

function calculateSeasonTotalsForPlayer(player) {
  return calculateSeasonTotalsFromGames(visibleGamesForPlayer(player));
}

function calculateSeasonTotalsFromGames(games) {
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
  return visibleGamesForPlayer(state.player);
}

function visibleGamesForPlayer(player = state.player) {
  const userId = currentUserId();
  const joinedTeamIds = teamIds();
  const userGames = userId
    ? state.games.filter((game) => {
        const teamGameId = gameTeamId(game);
        return !game.userId || game.userId === userId || (teamGameId && joinedTeamIds.includes(teamGameId));
      })
    : state.games.filter((game) => !game.userId && !gameTeamId(game));
  const normalized = normalizePlayer(player);
  if (!normalized.id) return userGames;
  return userGames.filter((game) => {
    const playerId = gamePlayerId(game);
    return playerId ? gameBelongsToPlayer(game, normalized) : state.players.length <= 1;
  });
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
  if (!canEditGame(state.activeGame)) {
    showToast("View-only team access");
    return;
  }
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
  if (!canEditGame(state.activeGame)) {
    showToast("View-only team access");
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
    teamId: state.activeGame.teamId || "",
    rosterPlayerId: state.activeGame.rosterPlayerId || "",
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
  if (!canEditGame(state.activeGame)) {
    showToast("View-only team access");
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
  if (!canEditGame(state.activeGame)) {
    showToast("View-only team access");
    return;
  }
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
  if (!canEditGame(game)) {
    showToast("View-only team access");
    return;
  }
  if (!window.confirm(`Delete ${game.opponent} on ${formatDate(game.date)}?`)) return;
  rememberDeletedGame(id);
  (game.events || []).forEach((event) => rememberDeletedEvent(event.id));
  state.games = state.games.filter((item) => item.id !== id);
  if (state.activeGame?.id === id) state.activeGame = null;
  state.editingGameDetails = false;
  state.editingEventId = null;
  state.tagEditingEventId = null;
  if (state.reviewGameId === id) state.reviewGameId = state.games[0]?.id || null;
  persistAll();
  deleteSupabaseGame(id);
  render();
  showToast("Game deleted");
}

function deleteEvent(gameId, eventId) {
  const game = state.games.find((item) => item.id === gameId);
  if (!game) return;
  if (!canEditGame(game)) {
    showToast("View-only team access");
    return;
  }
  const event = game.events.find((item) => item.id === eventId);
  if (!event) return;
  if (!window.confirm(`Delete ${event.statLabel}?`)) return;

  const updatedGame = {
    ...game,
    events: game.events.filter((item) => item.id !== eventId),
  };
  rememberDeletedEvent(eventId);
  if (state.editingEventId === eventId) state.editingEventId = null;
  if (state.tagEditingEventId === eventId) state.tagEditingEventId = null;
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
  const game = state.games.find((item) => item.id === gameId);
  if (game && !canEditGame(game)) {
    showToast("View-only team access");
    return;
  }
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
    "playerId",
    "teamId",
    "teamName",
    "rosterPlayerId",
    "playerName",
    "playerNumber",
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
    normalizeGame(game).events.map((event) => {
      const player = gamePlayerSnapshot(game);
      return [
      game.id,
      gamePlayerId(game),
      gameTeamId(game),
      teamById(gameTeamId(game))?.name || player.team || "",
      gameRosterPlayerId(game),
      player.name,
      player.number,
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
    ];
    }),
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
    version: 3,
    exportedAt: new Date().toISOString(),
    player: state.player,
    players: state.players,
    teams: state.teams,
    rosterPlayers: state.rosterPlayers,
    activePlayerId: state.activePlayerId,
    activeTeamId: state.activeTeamId,
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

      const importedPlayers = Array.isArray(payload.players)
        ? payload.players.map((player) => normalizePlayer(player, { createId: true }))
        : payload.player
          ? [normalizePlayer(payload.player, { createId: true })]
          : [];
      if (importedPlayers.length) {
        const mergedPlayers = new Map(state.players.map((player) => [player.id, player]));
        importedPlayers.forEach((player) => mergedPlayers.set(player.id, player));
        state.players = [...mergedPlayers.values()];
        if (payload.activePlayerId && state.players.some((player) => player.id === payload.activePlayerId)) {
          state.activePlayerId = payload.activePlayerId;
        }
        syncActivePlayer();
      }

      const importedTeams = Array.isArray(payload.teams) ? normalizeTeams(payload.teams) : [];
      if (importedTeams.length) {
        state.teams = normalizeTeams([...state.teams, ...importedTeams]);
        if (payload.activeTeamId && state.teams.some((team) => team.id === payload.activeTeamId)) {
          state.activeTeamId = payload.activeTeamId;
        }
      }

      const importedRosterPlayers = Array.isArray(payload.rosterPlayers)
        ? normalizeRosterPlayers(payload.rosterPlayers)
        : [];
      if (importedRosterPlayers.length) {
        state.rosterPlayers = normalizeRosterPlayers([...state.rosterPlayers, ...importedRosterPlayers]);
        mergeRosterPlayersIntoPlayers();
        syncActivePlayer();
      }

      const merged = new Map(state.games.map((game) => [game.id, normalizeGame(game)]));
      importedGames.map(normalizeGame).forEach((game) => merged.set(game.id, game));
      state.games = [...merged.values()].sort(
        (a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt),
      );
      mergePlayersFromGames(state.games);
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
    player_id: normalized.playerId || normalized.playerSnapshot?.id || "",
    team_id: normalized.teamId || "",
    roster_player_id: normalized.rosterPlayerId || "",
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
    team_id: normalized.teamId || game?.teamId || "",
    roster_player_id: normalized.rosterPlayerId || game?.rosterPlayerId || "",
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
      teamId: row.team_id || "",
      rosterPlayerId: row.roster_player_id || "",
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
    playerId: row.player_id || row.player_snapshot?.id || "",
    teamId: row.team_id || "",
    rosterPlayerId: row.roster_player_id || "",
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
  if (isTeamSetupError(error)) {
    reportTeamSetupError(error);
    return;
  }
  console.warn("LaxHornet Supabase sync failed:", error);
  state.syncStatus = "Live Share setup needed";
  const now = Date.now();
  if (now - lastSyncErrorAt > 8000) {
    lastSyncErrorAt = now;
    showToast("Live Share needs Supabase setup");
  }
}

function supabaseErrorText(error = {}) {
  return `${error.message || ""} ${error.details || ""} ${error.hint || ""} ${error.code || ""}`.trim();
}

function readableSupabaseError(error = {}) {
  return supabaseErrorText(error).replace(/\s+/g, " ").slice(0, 220);
}

function isTeamSetupError(error = {}) {
  const text = supabaseErrorText(error);
  return /teams|team_members|roster_players|tracker_code|laxhornet_|schema cache|relation|column|function|permission|policy/i.test(text);
}

function isPermissionError(error = {}) {
  const text = supabaseErrorText(error);
  return /admin approval required|row-level security|violates row-level security|permission denied|policy|not authorized|42501/i.test(text);
}

function reportTeamSetupError(error) {
  console.warn("LaxHornet team roster setup failed:", error);
  state.syncStatus = "Team roster database update needed";
  state.cloudError = readableSupabaseError(error);
  const now = Date.now();
  if (now - lastSyncErrorAt > 8000) {
    lastSyncErrorAt = now;
    showToast(state.cloudError ? `Supabase error: ${state.cloudError}` : "Run the Supabase team roster SQL");
  } else {
    render();
  }
}

function reportTeamCreateError(error) {
  console.warn("LaxHornet create team failed:", error);
  if (isPermissionError(error)) {
    state.syncStatus = "Admin approval required";
    state.cloudError = readableSupabaseError(error);
    showToast(state.cloudError || "Admin approval required");
    return;
  }
  reportTeamSetupError(error);
}

function missingSupabaseColumn(error) {
  const message = supabaseErrorText(error);
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
  const merged = new Map(
    localGames
      .filter((game) => !isDeletedGame(game.id))
      .map((game) => [game.id, normalizeGame(game)]),
  );
  cloudGames
    .filter((game) => !isDeletedGame(game.id))
    .map(normalizeGame)
    .forEach((game) => merged.set(game.id, game));
  return [...merged.values()].sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
}

function teamFromSupabaseRows(memberRow = {}) {
  const team = memberRow.teams || memberRow.team || memberRow;
  return normalizeTeam({
    id: team.id || memberRow.team_id,
    name: team.name,
    inviteCode: team.invite_code,
    trackerCode: team.tracker_code || "",
    role: memberRow.role || team.role || "tracker",
    createdBy: team.created_by,
    createdAt: team.created_at,
  });
}

function rosterPlayerFromSupabaseRow(row = {}) {
  return normalizeRosterPlayer({
    id: row.id,
    teamId: row.team_id,
    name: row.name,
    number: row.number,
    position: row.position,
    active: row.active,
    createdAt: row.created_at,
  });
}

function teamAccessRequestFromSupabaseRow(row = {}) {
  return normalizeTeamAccessRequest({
    id: row.id,
    teamId: row.team_id,
    teamName: row.team_name || row.teams?.name || "",
    userId: row.user_id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    childJerseyNumber: row.child_jersey_number,
    requestedRole: row.requested_role,
    status: row.status,
    createdAt: row.created_at,
  });
}

function playerClaimFromSupabaseRow(row = {}) {
  return normalizePlayerClaim({
    id: row.id,
    teamId: row.team_id,
    rosterPlayerId: row.roster_player_id,
    userId: row.user_id,
    createdAt: row.created_at,
  });
}

async function loadCloudTeams(options = {}) {
  if (!supabaseClient || !currentUserId()) return;
  const { data: memberRows, error: memberError } = await supabaseClient
    .from("team_members")
    .select("team_id, role, teams(id,name,invite_code,created_by,created_at)")
    .eq("user_id", currentUserId());

  if (memberError) {
    if (!options.silent) reportTeamSetupError(memberError);
    return;
  }

  const cloudTeams = normalizeTeams((memberRows || []).map(teamFromSupabaseRows));
  state.teams = cloudTeams;

  if (isPlatformReviewer()) {
    const { data: ownedTeams, error: ownedTeamsError } = await supabaseClient
      .from("teams")
      .select("id,name,invite_code,tracker_code,created_by,created_at")
      .eq("created_by", currentUserId());
    if (!ownedTeamsError && Array.isArray(ownedTeams)) {
      state.teams = normalizeTeams([
        ...state.teams,
        ...ownedTeams.map((team) => teamFromSupabaseRows({ ...team, role: "admin" })),
      ]);
    }
  }

  await loadTeamAccessRequests({ silent: true });
  const approvedRequestTeams = state.teamAccessRequests
    .filter((request) => request.status === "approved" && request.teamId)
    .map((request) => ({
      id: request.teamId,
      name: request.teamName || "Approved Team",
      role: request.requestedRole || "tracker",
    }));
  if (approvedRequestTeams.length) {
    state.teams = normalizeTeams([...state.teams, ...approvedRequestTeams]);
  }

  if (!state.activeTeamId || !state.teams.some((team) => team.id === state.activeTeamId)) {
    state.activeTeamId = state.teams[0]?.id || "";
  }

  const ids = teamIds();
  if (ids.length) {
    const { data: rosterRows, error: rosterError } = await supabaseClient
      .from("roster_players")
      .select("*")
      .in("team_id", ids)
      .order("number", { ascending: true });

    if (rosterError) {
      if (!options.silent) reportTeamSetupError(rosterError);
      return;
    }

    state.rosterPlayers = normalizeRosterPlayers([
      ...state.rosterPlayers.filter((player) => !ids.includes(player.teamId)),
      ...(rosterRows || []).map(rosterPlayerFromSupabaseRow),
    ]);
    await loadEditableTeamAccessCodes();
  }

  await loadPlayerClaims({ silent: true });
  await loadClaimedRosterPlayers({ silent: true });

  mergeRosterPlayersIntoPlayers();
  ensureActiveTeamRosterPlayer();
  syncActivePlayer();
  persistAll();
  if (!options.silent) {
    render();
    showToast(state.teams.length ? "Team roster synced" : "No team rosters found");
  }
}

async function loadEditableTeamAccessCodes() {
  if (!supabaseClient || !currentUserId()) return;
  for (const team of state.teams.filter((item) => canEditTeam(item.id))) {
  const { data, error } = await supabaseClient.rpc("laxhornet_team_access_codes", { check_team_id: team.id });
    if (error || !Array.isArray(data) || !data[0]) continue;
    state.teams = normalizeTeams([
      ...state.teams,
      {
        ...team,
        inviteCode: data[0].invite_code || team.inviteCode,
        trackerCode: data[0].tracker_code || team.trackerCode,
      },
    ]);
  }
}

async function loadTeamAccessRequests(options = {}) {
  if (!supabaseClient || !currentUserId()) return [];
  const requestRows = [];
  const { data: myRequests, error: myRequestsError } = await supabaseClient.rpc("laxhornet_my_team_access_requests");
  if (myRequestsError) {
    if (!options.silent) reportTeamSetupError(myRequestsError);
  } else {
    requestRows.push(...(Array.isArray(myRequests) ? myRequests : []));
  }

  const editableTeamIds = state.teams.filter((team) => canManageRoster(team.id)).map((team) => team.id);
  if (editableTeamIds.length || isPlatformReviewer()) {
    const { data, error } = await supabaseClient.rpc("laxhornet_pending_team_access_requests");
    if (error) {
      if (!options.silent) reportTeamSetupError(error);
    } else {
      requestRows.push(...(Array.isArray(data) ? data : []));
    }
  }

  state.teamAccessRequests = normalizeTeamAccessRequests(requestRows.map(teamAccessRequestFromSupabaseRow));
  if (!options.silent) render();
  return state.teamAccessRequests;
}

async function loadPlayerClaims(options = {}) {
  if (!supabaseClient || !currentUserId()) return [];
  const { data, error } = await supabaseClient.rpc("laxhornet_my_player_claims");
  if (error) {
    if (!options.silent) reportTeamSetupError(error);
    return [];
  }
  state.playerClaims = normalizePlayerClaims((Array.isArray(data) ? data : []).map(playerClaimFromSupabaseRow));
  if (!options.silent) render();
  return state.playerClaims;
}

async function loadClaimedRosterPlayers(options = {}) {
  if (!supabaseClient || !currentUserId()) return [];
  const { data, error } = await supabaseClient.rpc("laxhornet_my_roster_players");
  if (error) {
    if (!options.silent) reportTeamSetupError(error);
    return [];
  }
  const claimedRosterPlayers = normalizeRosterPlayers((Array.isArray(data) ? data : []).map(rosterPlayerFromSupabaseRow));
  if (claimedRosterPlayers.length) {
    state.rosterPlayers = normalizeRosterPlayers([
      ...state.rosterPlayers,
      ...claimedRosterPlayers,
    ]);
    const currentStillVisible = claimedRosterPlayers.some((player) => player.id === state.activePlayerId);
    const selectedRosterPlayer = currentStillVisible
      ? claimedRosterPlayers.find((player) => player.id === state.activePlayerId)
      : claimedRosterPlayers[0];
    state.activeTeamId = state.activeTeamId || selectedRosterPlayer?.teamId || "";
    if (!currentStillVisible && selectedRosterPlayer?.id) state.activePlayerId = selectedRosterPlayer.id;
  }
  if (!options.silent) render();
  return claimedRosterPlayers;
}

async function loadCloudGames(options = {}) {
  if (!supabaseClient || !currentUserId()) return;
  await loadCloudTeams({ silent: true });
  await flushDeletedCloudRecords();
  const uploadedCount = await syncLocalGamesToCloud();
  const { data: ownData, error } = await supabaseClient
    .from("games")
    .select("*, events(*)")
    .eq("user_id", currentUserId())
    .order("game_date", { ascending: false });

  if (error) {
    if (!options.silent) reportSyncError(error);
    return;
  }

  let teamData = [];
  if (teamIds().length) {
    const { data: sharedData, error: teamError } = await supabaseClient
      .from("games")
      .select("*, events(*)")
      .in("team_id", teamIds())
      .order("game_date", { ascending: false });
    if (teamError) {
      if (!options.silent) reportSyncError(teamError);
    } else {
      teamData = sharedData || [];
    }
  }

  const rowsById = new Map([...(ownData || []), ...teamData].map((game) => [game.id, game]));
  const cloudGames = [...rowsById.values()].map((game) => gameFromSupabaseRow(game, game.events || []));
  state.games = mergeGames(state.games, cloudGames);
  mergePlayersFromGames(state.games);
  const newestCloudGame = cloudGames.find((game) => !isDeletedGame(game.id));
  if (!options.silent && newestCloudGame) {
    const syncedPlayerId = gamePlayerId(newestCloudGame);
    if (syncedPlayerId && state.players.some((player) => player.id === syncedPlayerId)) {
      state.activePlayerId = syncedPlayerId;
      syncActivePlayer();
      state.reviewGameId = newestCloudGame.id;
    }
  }
  persistAll();
  const syncParts = [];
  if (uploadedCount) syncParts.push(`${uploadedCount} uploaded`);
  syncParts.push(
    cloudGames.length
      ? `${cloudGames.length} loaded`
      : "0 loaded",
  );
  state.syncStatus = `Cloud sync: ${syncParts.join(", ")}`;
  if (!options.silent) {
    render();
    showToast(
      cloudGames.length
        ? `Cloud games synced. Showing ${playerTitle(state.player)}.`
        : "No cloud games found for this account",
    );
  }
}

async function syncLocalGamesToCloud() {
  if (!supabaseClient || !currentUserId()) return 0;
  const localGames = new Map();
  state.games.forEach((game) => {
    if (!isDeletedGame(game.id)) localGames.set(game.id, game);
  });
  if (state.activeGame && !isDeletedGame(state.activeGame.id)) {
    localGames.set(state.activeGame.id, state.activeGame);
  }

  let uploaded = 0;
  for (const game of localGames.values()) {
    if (game.userId && game.userId !== currentUserId()) continue;
    if (gameTeamId(game) && !canEditGame(game)) continue;
    const normalized = normalizeGame({ ...game, userId: currentUserId() });
    if (state.activeGame?.id === normalized.id) state.activeGame = normalized;
    const index = state.games.findIndex((item) => item.id === normalized.id);
    if (index >= 0) state.games[index] = normalized;
    const synced = await syncGameToSupabase(normalized, { includeEvents: true });
    if (synced) uploaded += 1;
  }
  return uploaded;
}

async function flushDeletedCloudRecords() {
  if (!supabaseClient || !currentUserId()) return;
  const deletedEvents = uniqueIds(state.deletedEventIds);
  const deletedGames = uniqueIds(state.deletedGameIds);
  if (deletedEvents.length) {
    const { error } = await supabaseClient.from("events").delete().in("id", deletedEvents);
    if (error) reportSyncError(error);
  }
  if (deletedGames.length) {
    const { error } = await supabaseClient.from("games").delete().in("id", deletedGames);
    if (error) reportSyncError(error);
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

  if (authAction === "sign-up") {
    state.cloudError = "";
    state.signupDraft = { email, password };
    state.accessRequestSummary = null;
    state.userProfile = normalizeUserProfile({ email });
    state.screen = "profileSetup";
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  state.authBusy = true;
  render();

  const result = await supabaseClient.auth.signInWithPassword({ email, password });

  state.authBusy = false;

  if (result.error) {
    const message = result.error.message || "";
    state.cloudError = /rate|too many|exceeded/i.test(message)
      ? "Email limit hit. Wait, or use custom SMTP."
      : readableSupabaseError(result.error) || message;
    showToast(state.cloudError);
    render();
    return;
  }

  setAuthUser(result.data.user || result.data.session?.user || state.authUser);
  if (state.authUser) await loadUserProfile({ silent: true });
  if (state.authUser && needsParentProfileSetup()) state.screen = "profileSetup";
  state.syncStatus = state.authUser ? "Signed in" : "Check email to confirm account";
  if (state.authUser) await loadCloudGames({ silent: true });
  render();
  showToast(state.syncStatus);
}

async function signOut() {
  if (!supabaseClient) return;
  await supabaseClient.auth.signOut();
  setAuthUser(null);
  state.syncStatus = "Signed out";
  render();
  showToast("Signed out");
}

async function requestUserRole(role, options = {}) {
  if (!supabaseClient || !currentUserId()) return null;
  const requestedRole = isReviewerAccount() && normalizeAppRole(role) === "admin" ? "admin" : "tracker";
  const { data, error } = await supabaseClient.rpc("laxhornet_request_user_role", {
    requested_app_role: requestedRole,
  });
  if (error) {
    if (!options.silent) reportTeamSetupError(error);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  state.userProfile = normalizeUserProfile(row || {});
  if (!options.silent) {
    render();
    showToast(`${appRoleLabel(requestedRole)} profile saved`);
  }
  return state.userProfile;
}

function needsParentProfileSetup() {
  if (!state.authUser || isReviewerAccount()) return false;
  const profile = state.userProfile || {};
  return !profile.onboardingCompleted || !profile.firstName || !profile.lastName;
}

async function saveParentProfile(formData) {
  if (!supabaseClient || !currentUserId()) {
    showToast("Sign in first");
    return;
  }

  const firstName = formData.get("firstName")?.trim() || "";
  const lastName = formData.get("lastName")?.trim() || "";
  const phone = formData.get("phone")?.trim() || "";
  const hasChildJerseyField = formData.has("childJerseyNumber");
  const childJerseyNumber = hasChildJerseyField
    ? formData.get("childJerseyNumber")?.trim() || ""
    : state.userProfile?.childJerseyNumber || "";
  const teamAccessCode = formData.get("teamAccessCode")?.trim().toUpperCase() || "";

  if (!firstName || !lastName) {
    showToast("Enter first and last name");
    return;
  }

  const profilePayload = {
    user_id: currentUserId(),
    email: userEmail(),
    first_name: firstName,
    last_name: lastName,
    phone,
    child_jersey_number: childJerseyNumber,
    requested_role: isReviewerAccount() ? "admin" : "tracker",
    approved_role: isReviewerAccount() ? "admin" : "tracker",
    admin_status: "approved",
    onboarding_completed: true,
    updated_at: new Date().toISOString(),
  };

  const { error } = await upsertWithOptionalColumns("user_profiles", profilePayload, [
    "first_name",
    "last_name",
    "phone",
    ...(hasChildJerseyField ? ["child_jersey_number"] : []),
    "onboarding_completed",
    "updated_at",
  ]);

  if (error) {
    reportTeamSetupError(error);
    return;
  }

  state.userProfile = normalizeUserProfile({
    ...(state.userProfile || {}),
    userId: currentUserId(),
    email: userEmail(),
    firstName,
    lastName,
    phone,
    childJerseyNumber,
    requestedRole: isReviewerAccount() ? "admin" : "tracker",
    approvedRole: isReviewerAccount() ? "admin" : "tracker",
    adminStatus: "approved",
    onboardingCompleted: true,
    updatedAt: new Date().toISOString(),
  });

  if (teamAccessCode) await requestTeamAccessByCode(teamAccessCode, { silent: true, childJerseyNumber });
  await loadUserProfile({ silent: true });
  await loadCloudTeams({ silent: true });
  if (teamAccessCode) {
    state.accessRequestSummary = {
      email: userEmail(),
      firstName,
      lastName,
      phone,
      teamAccessCode,
      childJerseyNumber,
    };
    state.screen = "requestSubmitted";
  } else {
    state.screen = "home";
  }
  persistAll();
  render();
  showToast(teamAccessCode ? "Profile saved and team access requested" : "Profile saved");
}

async function submitSignupAccessRequest(formData) {
  if (!supabaseClient || !state.signupDraft?.email || !state.signupDraft?.password) {
    showToast("Start with email and password first");
    state.screen = "home";
    render();
    return;
  }

  if (state.authBusy) return;

  const firstName = formData.get("firstName")?.trim() || "";
  const lastName = formData.get("lastName")?.trim() || "";
  const phone = formData.get("phone")?.trim() || "";
  const teamAccessCode = formData.get("teamAccessCode")?.trim().toUpperCase() || "";
  const childJerseyNumber = formData.get("childJerseyNumber")?.trim() || "";

  if (!firstName || !lastName || !teamAccessCode || !childJerseyNumber) {
    showToast("Name, team code, and jersey number are required");
    return;
  }

  const requestSummary = {
    email: state.signupDraft.email,
    firstName,
    lastName,
    phone,
    teamAccessCode,
    childJerseyNumber,
  };

  state.authBusy = true;
  render();

  const result = await supabaseClient.auth.signUp({
    email: state.signupDraft.email,
    password: state.signupDraft.password,
    options: {
      emailRedirectTo: authRedirectUrl(),
      data: {
        requested_role: "tracker",
        first_name: firstName,
        last_name: lastName,
        phone,
        team_access_code: teamAccessCode,
        child_jersey_number: childJerseyNumber,
        access_request_submitted_at: new Date().toISOString(),
      },
    },
  });

  state.authBusy = false;

  if (result.error) {
    const message = result.error.message || "";
    state.cloudError = /rate|too many|exceeded/i.test(message)
      ? "Email limit hit. Wait, or use custom SMTP."
      : readableSupabaseError(result.error) || message;
    showToast(state.cloudError);
    render();
    return;
  }

  state.cloudError = "";
  state.accessRequestSummary = requestSummary;
  state.signupDraft = null;
  setAuthUser(result.data.session?.user || null);
  if (state.authUser) {
    await loadUserProfile({ silent: true });
    await loadCloudTeams({ silent: true });
  }
  state.screen = "requestSubmitted";
  state.syncStatus = "Request submitted";
  persistAll();
  render();
  showToast("Request submitted");
}

async function loadUserProfile(options = {}) {
  if (!supabaseClient || !currentUserId()) return null;
  const { data, error } = await supabaseClient.rpc("laxhornet_my_profile");
  if (error) {
    if (!options.silent) reportTeamSetupError(error);
    return null;
  }
  let row = Array.isArray(data) ? data[0] : data;
  const { data: profileRow, error: profileError } = await supabaseClient
    .from("user_profiles")
    .select("*")
    .eq("user_id", currentUserId())
    .maybeSingle();
  if (!profileError && profileRow) row = profileRow;
  state.userProfile = normalizeUserProfile(row || {});
  if (isPlatformReviewer()) await loadAdminRequests({ silent: true });
  if (!options.silent) render();
  return state.userProfile;
}

async function loadAdminRequests(options = {}) {
  if (!supabaseClient || !currentUserId() || !isPlatformReviewer()) return [];
  const { data, error } = await supabaseClient.rpc("laxhornet_pending_admin_requests");
  if (error) {
    if (!options.silent) reportTeamSetupError(error);
    return [];
  }
  state.adminRequests = (Array.isArray(data) ? data : []).map(normalizeUserProfile);
  if (!options.silent) render();
  return state.adminRequests;
}

async function reviewAdminRequest(userId, approved) {
  if (!supabaseClient || !isPlatformReviewer()) return;
  const { error } = await supabaseClient.rpc("laxhornet_review_admin_request", {
    request_user_id: userId,
    approve: Boolean(approved),
  });
  if (error) {
    reportTeamSetupError(error);
    return;
  }
  await loadAdminRequests({ silent: true });
  render();
  showToast(approved ? "Admin approved" : "Admin rejected");
}

async function reviewTeamAccessRequest(requestId, approved) {
  if (!supabaseClient || !currentUserId()) return;
  const { error } = await supabaseClient.rpc("laxhornet_review_team_access_request", {
    request_id: requestId,
    approve: Boolean(approved),
  });
  if (error) {
    reportTeamSetupError(error);
    return;
  }
  await loadCloudTeams({ silent: true });
  render();
  showToast(approved ? "Team access approved" : "Team access rejected");
}

async function claimRosterPlayer(formData) {
  const formTeamId = formData.get("teamId")?.trim();
  const team = (formTeamId && teamById(formTeamId)) || activeTeam() || state.teams.find((item) => item.id === formTeamId);
  const teamId = formTeamId || team?.id || "";
  if (!teamId) {
    showToast("Sync your approved team first");
    return;
  }
  const jerseyNumber = formData.get("claimJerseyNumber")?.trim();
  if (!jerseyNumber) {
    showToast("Enter your child's jersey number");
    return;
  }
  const { data, error } = await supabaseClient.rpc("laxhornet_claim_roster_player", {
    p_team_id: teamId,
    p_jersey_number: jerseyNumber,
  });
  if (error) {
    reportTeamSetupError(error);
    return;
  }
  const claim = playerClaimFromSupabaseRow((Array.isArray(data) ? data[0] : data) || {});
  state.playerClaims = normalizePlayerClaims([...state.playerClaims, claim]);
  await loadCloudTeams({ silent: true });
  state.activePlayerId = claim.rosterPlayerId || state.activePlayerId;
  syncActivePlayer();
  persistAll();
  render();
  showToast("Player verified");
}

async function createTeam(formData) {
  if (!supabaseClient || !currentUserId()) {
    showToast("Sign in to create a team");
    return;
  }
  if (!canCreateTeams()) {
    showToast(requestedAdminPending() ? "Admin approval pending" : `Admin approval required for ${userEmail() || "this account"}`);
    return;
  }
  const name = formData.get("teamName")?.trim();
  if (!name) {
    showToast("Enter a team name");
    return;
  }
  const team = normalizeTeam({
    id: uid("team"),
    name,
    inviteCode: makeInviteCode(),
    trackerCode: makeInviteCode(),
    role: "admin",
    createdBy: currentUserId(),
  });

  const { data: teamRows, error: createError } = await supabaseClient.rpc("laxhornet_create_team", {
    p_team_id: team.id,
    p_team_name: team.name,
    p_invite_code: team.inviteCode,
    p_tracker_code: team.trackerCode,
    p_member_id: uid("member"),
  });
  if (createError) {
    reportTeamCreateError(createError);
    return;
  }

  const createdTeam = teamFromSupabaseRows((Array.isArray(teamRows) ? teamRows[0] : teamRows) || team);
  state.teams = normalizeTeams([...state.teams, createdTeam]);
  state.activeTeamId = createdTeam.id;
  persistAll();
  render();
  showToast(`Team created. Team code ${createdTeam.inviteCode}`);
}

async function requestTeamAccessByCode(accessCode, options = {}) {
  if (!supabaseClient || !currentUserId()) {
    if (!options.silent) showToast("Sign in to join a team");
    return null;
  }
  const code = String(accessCode || "").trim().toUpperCase();
  if (!code) {
    if (!options.silent) showToast("Enter a team access code");
    return null;
  }
  const { data: requestRows, error: requestError } = await supabaseClient.rpc("laxhornet_request_team_player_access", {
    join_code: code,
    requested_child_jersey_number: String(options.childJerseyNumber || "").trim(),
  });
  if (requestError) {
    reportTeamSetupError(requestError);
    return null;
  }
  const requested = Array.isArray(requestRows) ? requestRows[0] : null;
  if (!requested?.team_id) {
    if (!options.silent) showToast("Team code not found");
    return null;
  }

  state.teamAccessRequests = normalizeTeamAccessRequests([...state.teamAccessRequests, teamAccessRequestFromSupabaseRow(requested)]);
  persistAll();
  if (!options.silent) {
    render();
    showToast(`Access requested for ${requested.team_name || "team"}`);
  }
  return requested;
}

async function joinTeam(formData) {
  await requestTeamAccessByCode(formData.get("inviteCode"));
}

async function addRosterPlayer(formData) {
  const team = activeTeam();
  if (!team) {
    showToast("Create or join a team first");
    return;
  }
  if (!currentUserId()) {
    showToast("Sign in to add team players");
    return;
  }
  if (!canManageRoster(team.id)) {
    showToast("Team admin access required");
    return;
  }
  const position = positionValueFromForm(formData, "rosterPosition");
  if (!position) {
    showToast("Pick at least one position");
    return;
  }
  const rosterPlayer = normalizeRosterPlayer({
    id: uid("roster"),
    teamId: team.id,
    name: formData.get("rosterName")?.trim() || "Roster Player",
    number: formData.get("rosterNumber")?.trim() || "",
    position,
  });
  const { data: rosterRows, error } = await supabaseClient.rpc("laxhornet_create_roster_player", {
    p_roster_player_id: rosterPlayer.id,
    p_team_id: rosterPlayer.teamId,
    p_name: rosterPlayer.name,
    p_number: rosterPlayer.number,
    p_position: rosterPlayer.position,
  });
  if (error) {
    reportTeamSetupError(error);
    return;
  }

  const createdRosterPlayer = rosterPlayerFromSupabaseRow((Array.isArray(rosterRows) ? rosterRows[0] : rosterRows) || rosterPlayer);
  state.rosterPlayers = normalizeRosterPlayers([...state.rosterPlayers, createdRosterPlayer]);
  mergeRosterPlayersIntoPlayers();
  state.activePlayerId = createdRosterPlayer.id;
  syncActivePlayer();
  persistAll();
  render();
  showToast(`${playerTitle(state.player)} added`);
}

async function saveRosterPlayer(formData) {
  const player = normalizePlayer(state.player);
  if (!isTeamPlayer(player)) {
    showToast("Pick a roster player first");
    return;
  }
  if (!canManageRoster(player.teamId)) {
    showToast("Team admin access required");
    return;
  }
  const position = positionValueFromForm(formData, "position");
  if (!position) {
    showToast("Pick at least one position");
    return;
  }

  const rosterPlayer = normalizeRosterPlayer({
    id: player.rosterPlayerId || player.id,
    teamId: player.teamId,
    name: formData.get("name")?.trim() || "Roster Player",
    number: formData.get("number")?.trim() || "",
    position,
    active: true,
  });

  const { data: rosterRows, error } = await supabaseClient.rpc("laxhornet_update_roster_player", {
    p_roster_player_id: rosterPlayer.id,
    p_team_id: rosterPlayer.teamId,
    p_name: rosterPlayer.name,
    p_number: rosterPlayer.number,
    p_position: rosterPlayer.position,
  });
  if (error) {
    reportTeamSetupError(error);
    return;
  }

  const savedRosterRow = Array.isArray(rosterRows) ? rosterRows[0] : rosterRows;
  if (!savedRosterRow?.id) {
    showToast("Roster player not found");
    return;
  }
  const savedRosterPlayer = rosterPlayerFromSupabaseRow(savedRosterRow);
  applyRosterPlayerUpdate(savedRosterPlayer, { syncGames: true });
  render();
  showToast(`${playerTitle(state.player)} saved`);
}

async function removeRosterPlayer() {
  const player = normalizePlayer(state.player);
  if (!isTeamPlayer(player)) {
    deleteActivePlayer();
    return;
  }
  if (!canManageRoster(player.teamId)) {
    showToast("Team admin access required");
    return;
  }
  if (!window.confirm(`Remove ${playerTitle(player)} from the team roster? Past games will stay saved.`)) return;

  const { data: rosterRows, error } = await supabaseClient.rpc("laxhornet_remove_roster_player", {
    p_roster_player_id: player.rosterPlayerId || player.id,
    p_team_id: player.teamId,
  });
  if (error) {
    reportTeamSetupError(error);
    return;
  }

  const removedRosterRow = Array.isArray(rosterRows) ? rosterRows[0] : rosterRows;
  if (!removedRosterRow?.id) {
    showToast("Roster player not found");
    return;
  }
  const removedRosterPlayer = rosterPlayerFromSupabaseRow(removedRosterRow);
  applyRosterPlayerUpdate({ ...removedRosterPlayer, active: false });
  render();
  showToast(`${playerTitle(player)} removed from roster`);
}

async function removeClaimedRosterPlayer() {
  if (!supabaseClient || !currentUserId()) {
    showToast("Sign in to remove this player");
    return;
  }
  const player = normalizePlayer(state.player);
  const rosterPlayerId = player.rosterPlayerId || player.id;
  if (!isTeamPlayer(player) || !hasPlayerClaim(player.teamId, rosterPlayerId)) {
    showToast("No verified player selected");
    return;
  }
  if (playerHasAnyGames(player)) {
    showToast("Delete this player's games first");
    return;
  }
  if (!window.confirm(`Remove ${playerTitle(player)} from your account? This will not delete the team roster player for other parents.`)) return;

  const { error } = await supabaseClient.rpc("laxhornet_delete_player_claim", {
    p_team_id: player.teamId,
    p_roster_player_id: rosterPlayerId,
  });
  if (error) {
    reportTeamSetupError(error);
    return;
  }

  state.playerClaims = state.playerClaims.filter(
    (claim) => !(claim.teamId === player.teamId && claim.rosterPlayerId === rosterPlayerId),
  );
  state.rosterPlayers = state.rosterPlayers.filter((item) => !(item.teamId === player.teamId && item.id === rosterPlayerId));
  state.players = state.players.filter((item) => !(item.teamId === player.teamId && (item.rosterPlayerId || item.id) === rosterPlayerId));
  if (!state.players.length) state.players = [normalizePlayer(DEFAULT_PLAYER, { createId: true })];
  mergeRosterPlayersIntoPlayers();
  const nextVisiblePlayer = visiblePlayers()[0] || state.players[0];
  state.activePlayerId = nextVisiblePlayer?.id || "";
  syncActivePlayer();
  persistAll();
  render();
  showToast(`${playerTitle(player)} removed from your account`);
}

async function deleteActiveTeam() {
  if (!supabaseClient || !currentUserId()) {
    showToast("Sign in to delete a team");
    return;
  }
  const team = activeTeam();
  if (!team) {
    showToast("Pick a team first");
    return;
  }
  if (!canManageRoster(team.id)) {
    showToast("Admin mode required");
    return;
  }
  if (!window.confirm(`Delete ${team.name}? This removes the team roster, access requests, and parent access. Saved games will stay in history.`)) return;

  const { error } = await supabaseClient.rpc("laxhornet_delete_team", {
    p_team_id: team.id,
  });
  if (error) {
    reportTeamSetupError(error);
    return;
  }

  const deletedTeamId = team.id;
  state.teams = state.teams.filter((item) => item.id !== deletedTeamId);
  state.rosterPlayers = state.rosterPlayers.filter((player) => player.teamId !== deletedTeamId);
  state.teamAccessRequests = state.teamAccessRequests.filter((request) => request.teamId !== deletedTeamId);
  state.playerClaims = state.playerClaims.filter((claim) => claim.teamId !== deletedTeamId);
  state.players = state.players.filter((player) => player.teamId !== deletedTeamId);
  state.activeTeamId = state.teams[0]?.id || "";
  state.activePlayerId = state.players.some((player) => player.id === state.activePlayerId)
    ? state.activePlayerId
    : state.players[0]?.id || "";
  mergeRosterPlayersIntoPlayers();
  ensureActiveTeamRosterPlayer();
  syncActivePlayer();
  persistAll();
  render();
  showToast(`${team.name} deleted`);
}

async function syncGameToSupabase(game, options = {}) {
  if (!supabaseClient || !game) return false;
  if (isDeletedGame(game.id)) return false;
  if (gameTeamId(game) && !canEditGame(game)) {
    state.syncStatus = "Team roster is view-only";
    return false;
  }
  const userId = currentUserId();
  if (!userId) {
    state.syncStatus = "Sign in for cloud sync";
    return false;
  }
  const normalized = normalizeGame({ ...game, userId: game.userId || userId });
  const { error, skipped } = await upsertWithOptionalColumns("games", gameToSupabaseRow(normalized), [
    "player_id",
    "team_id",
    "roster_player_id",
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
      ["tags", "team_id", "roster_player_id", "field_zone", "corrected_at", "tags_updated_at"],
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
  if (gameTeamId(game) && !canEditGame(game)) {
    state.syncStatus = "Verify your child before syncing team stats";
    return;
  }
  const gameSynced = await syncGameToSupabase(game);
  if (!gameSynced) return;
  const { error, skipped } = await upsertWithOptionalColumns("events", eventToSupabaseRow(event), [
    "tags",
    "team_id",
    "roster_player_id",
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
  const statusText = state.activeGame ? "Live" : "";
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
          ${statusText ? `<span class="status-chip">${statusText}</span>` : ""}
        </span>
      </div>
    </header>
    ${renderUpdateBanner()}
    ${content}
    ${options.hideNav ? "" : renderBottomNav()}
    ${state.toast ? `<div class="toast" role="status">${escapeHTML(state.toast)}</div>` : ""}
  `;
}

function renderUpdateBanner() {
  if (!state.updateAvailable) return "";
  return `
    <section class="update-banner" role="status" aria-live="polite">
      <div>
        <strong>${state.updateInstalling ? "Updating LaxHornet..." : "Update available"}</strong>
        <span>${state.updateInstalling ? "Reloading into the newest version." : "Tap once to load the newest version."}</span>
      </div>
      <div class="update-actions">
        <button class="mini-btn light" type="button" data-action="apply-update" ${state.updateInstalling ? "disabled" : ""}>Update Now</button>
        <button class="update-dismiss" type="button" data-action="dismiss-update" aria-label="Dismiss update notice">x</button>
      </div>
    </section>
  `;
}

function renderBottomNav() {
  const trackTarget = state.activeGame ? "live" : "start";
  const navItems = [
    { screen: "home", label: "Home", icon: "home", active: state.screen === "home" },
    { screen: trackTarget, label: state.activeGame ? "Live" : "Track", icon: "track", active: ["start", "live"].includes(state.screen) },
    { screen: "past", label: "Games", icon: "games", active: ["past", "review"].includes(state.screen) },
    { screen: "dashboard", label: "Season", icon: "season", active: state.screen === "dashboard" },
    { screen: "more", label: "Manage", icon: "manage", active: ["more", "player", "settings", "team", "teamAccess", "profileSetup", "tutorial", "help"].includes(state.screen) },
  ];
  return `
    <nav class="bottom-nav" aria-label="Primary">
      ${navItems
        .map(
          (item) => `
            <button class="nav-tab ${item.active ? "active" : ""}" type="button" data-nav="${item.screen}" aria-label="${escapeHTML(item.label)}" aria-current="${item.active ? "page" : "false"}">
              ${renderNavIcon(item.icon)}
              <span>${escapeHTML(item.label)}</span>
            </button>
          `,
        )
        .join("")}
    </nav>
  `;
}

function renderNavIcon(icon) {
  const icons = {
    home: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5V20h-5.2v-5.8H9.2V20H4z"/></svg>`,
    track: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2a8.8 8.8 0 1 0 0 17.6 8.8 8.8 0 0 0 0-17.6Zm0 3.2a5.6 5.6 0 1 1 0 11.2 5.6 5.6 0 0 1 0-11.2Zm0 3.1a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z"/></svg>`,
    games: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5v-13A1.5 1.5 0 0 1 5 4Zm1.8 4.2h10.4V6.8H6.8v1.4Zm0 4.1h10.4v-1.4H6.8v1.4Zm0 4.1h6.8V15H6.8v1.4Z"/></svg>`,
    season: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19h14v1.7H5V19Zm1.3-7.2h3v5.6h-3v-5.6Zm4.2-6.6h3v12.2h-3V5.2Zm4.2 3.9h3v8.3h-3V9.1Z"/></svg>`,
    player: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.8 5.8a2.6 2.6 0 1 1 5.2 0 2.6 2.6 0 0 1-5.2 0ZM9.4 3.2l1.2-1.1 5.1 5.7-1.2 1.1-1.6-1.8-1.5 1.3 2.2 2.4c.4.5.5 1.2.1 1.7l-1.6 2.6 3.3 1.3c.4.2.7.5.8.9l.8 3.7-2 .4-.6-2.9-4.3-1.7a1.3 1.3 0 0 1-.6-1.9l1.4-2.3-2.1-2.4-2.3 2.1 2.2 2.5-1.5 1.3-5.4-6.1 1.5-1.3 1.9 2.2 6.1-5.5-1.9-2.2Zm-2.3 15.9 4.6.2-.1 2.1-7.5-.3 2.9-4.7 1.8 1.1-1.7 1.6Z"/></svg>`,
    team: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11.2 2.7h1.6v3.2h-1.6V2.7Zm-5 1.6 1.3-.9 1.6 2.6-1.3.9-1.6-2.6Zm10.3 1.7 1.6-2.6 1.3.9-1.6 2.6-1.3-.9ZM8.1 9.2l2.4 2.2c.7.7 1.9.7 2.6 0l2.3-2.2c.5-.5 1.4-.5 1.9 0l.7.7-4.8 4.6c-.7.7-1.8.7-2.5 0L6 9.9l.7-.7c.4-.5 1.2-.5 1.4 0Zm-3.9 2.2 6 5.9c1.2 1.2 3.1 1.2 4.3 0l5.9-5.9 1.7 1.7-6 5.9c-2.1 2-5.4 2-7.5 0l-6-5.9 1.6-1.7ZM2.6 14.8 7.9 20l-1.6 1.6-5.3-5.2 1.6-1.6Zm18.8 0 1.6 1.6-5.3 5.2-1.6-1.6 5.3-5.2Z"/></svg>`,
    manage: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.2h8.2a2.6 2.6 0 0 1 5 0H20v1.9h-2.8a2.6 2.6 0 0 1-5 0H4V6.2Zm10.7-1a1 1 0 1 0 0 2.1 1 1 0 0 0 0-2.1ZM4 11.1h2.8a2.6 2.6 0 0 1 5 0H20V13h-8.2a2.6 2.6 0 0 1-5 0H4v-1.9Zm5.3-1a1 1 0 1 0 0 2.1 1 1 0 0 0 0-2.1ZM4 16h8.2a2.6 2.6 0 0 1 5 0H20v1.9h-2.8a2.6 2.6 0 0 1-5 0H4V16Zm10.7-1a1 1 0 1 0 0 2.1 1 1 0 0 0 0-2.1Z"/></svg>`,
    more: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.4 13.9a1.9 1.9 0 1 1 0-3.8 1.9 1.9 0 0 1 0 3.8Zm5.6 0a1.9 1.9 0 1 1 0-3.8 1.9 1.9 0 0 1 0 3.8Zm5.6 0a1.9 1.9 0 1 1 0-3.8 1.9 1.9 0 0 1 0 3.8Z"/></svg>`,
  };
  return icons[icon] || icons.more;
}

function renderAccountCard() {
  if (!supabaseClient) {
    return `
      <section class="card pad">
        <h3>User Profile</h3>
        <p class="muted small">Supabase is not available, so this device is using local-only storage.</p>
        <p class="muted small">App version: ${escapeHTML(APP_VERSION)}</p>
      </section>
    `;
  }

  if (state.authUser) {
    const role = currentAppRole();
    const modeToggle = isReviewerAccount()
      ? `<div class="mode-toggle" role="group" aria-label="Admin view mode">
          <button class="mini-btn ${isPlatformReviewer() ? "" : "light"}" type="button" data-admin-view-mode="admin" aria-pressed="${isPlatformReviewer()}">Admin Mode</button>
          <button class="mini-btn ${!isPlatformReviewer() ? "" : "light"}" type="button" data-admin-view-mode="tracker" aria-pressed="${!isPlatformReviewer()}">Tracker Mode</button>
        </div>`
      : "";
    return `
      <section class="card pad account-card">
        <h3>User Profile</h3>
        <p class="muted small">${escapeHTML([state.userProfile?.firstName, state.userProfile?.lastName].filter(Boolean).join(" ") || userEmail())}</p>
        <p class="muted small">${escapeHTML(userEmail())}</p>
        <p class="muted small">Role: ${escapeHTML(isReviewerAccount() ? `Reviewer / ${appRoleLabel(role)}` : appRoleLabel(role))}</p>
        <p class="muted small">${escapeHTML(state.syncStatus)}</p>
        <p class="muted small">App version: ${escapeHTML(APP_VERSION)}</p>
        ${state.cloudError ? `<p class="muted small">Last Supabase error: ${escapeHTML(state.cloudError)}</p>` : ""}
        ${modeToggle}
        <div class="account-actions">
          <button class="btn neutral" type="button" data-action="sync-cloud-games">Sync Cloud Games</button>
          <button class="btn secondary" type="button" data-nav="profileSetup">Edit Profile</button>
          <button class="btn secondary" type="button" data-action="refresh-profile">Refresh Profile</button>
          <button class="btn secondary" type="button" data-action="sign-out">Sign Out</button>
        </div>
      </section>
    `;
  }

  return `
    <form class="card pad form-grid account-card" data-form="auth">
      <h3>Sign in or create account</h3>
      <p class="muted small">Use your account to request team access, verify your player, and keep stats separate from other parents on this device.</p>
      <p class="muted small">App version: ${escapeHTML(APP_VERSION)}</p>
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

function renderWatchSharedGameForm(options = {}) {
  const expanded = options.expanded ?? state.watchShareExpanded;
  const compact = options.compact !== false;
  return `
    <form class="card pad form-grid share-watch-form ${expanded ? "expanded" : "collapsed"} ${compact ? "compact-watch-card" : ""}" data-form="watch-share">
      <div class="collapsible-card-head">
        <div>
          <h3>Watch Shared Game</h3>
          <p class="muted small">Enter a family share code to watch a read-only live game.</p>
        </div>
        <button class="collapse-icon" type="button" data-action="toggle-watch-share" aria-expanded="${expanded}" aria-controls="watchShareFields" aria-label="${expanded ? "Minimize Watch Shared Game" : "Expand Watch Shared Game"}">
          <span aria-hidden="true">${expanded ? "v" : ">"}</span>
        </button>
      </div>
      ${
        expanded
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
  `;
}

function renderAdminReviewCard() {
  if (!isPlatformReviewer()) return "";
  return `
    <section class="card pad admin-review-card">
      <div class="section-head">
        <div>
          <h3>Admin Requests</h3>
          <p class="muted small">Approve parents before they can create teams.</p>
        </div>
        <button class="mini-btn light" type="button" data-action="refresh-admin-requests">Refresh</button>
      </div>
      ${
        state.adminRequests.length
          ? `<div class="admin-request-list">
              ${state.adminRequests
                .map(
                  (request) => `
                    <div class="admin-request-row">
                      <span>
                        <strong>${escapeHTML(request.email || "Unknown email")}</strong>
                        <small>${request.createdAt ? formatTime(request.createdAt) : "Pending admin request"}</small>
                      </span>
                      <span class="event-actions">
                        <button class="mini-btn" type="button" data-review-admin="${request.userId}" data-approved="true">Approve</button>
                        <button class="mini-btn danger" type="button" data-review-admin="${request.userId}" data-approved="false">Reject</button>
                      </span>
                    </div>
                  `,
                )
                .join("")}
            </div>`
          : `<p class="muted small">No pending admin requests.</p>`
      }
    </section>
  `;
}

function renderPlayerSwitcher(options = {}) {
  const title = options.title || "Tracking Player";
  const helper = options.helper === false ? "" : options.helper || "Choose who these stats belong to.";
  const helperLines = Array.isArray(options.helperLines) ? options.helperLines.filter(Boolean) : null;
  const showPlayerSubline = options.showPlayerSubline !== false;
  const showManage = options.showManage !== false;
  const shellClass = options.inline ? "player-switch-card inline" : "card pad player-switch-card";
  const defaultPlayers = visiblePlayers();
  const players = Array.isArray(options.players) ? options.players : defaultPlayers;
  const chips = players
    .map((player) => {
      const active = player.id === state.activePlayerId;
      return `
        <button class="player-chip ${active ? "active" : ""}" type="button" data-player-select="${player.id}" aria-pressed="${active}">
          <strong>${escapeHTML(player.name || "Player")}</strong>
          ${player.number ? `<span>#${escapeHTML(player.number)}</span>` : ""}
          ${showPlayerSubline ? `<span>${escapeHTML(playerSubline(player))}</span>` : ""}
        </button>
      `;
    })
    .join("");

  return `
    <section class="${shellClass}">
      <div class="section-head">
        <div>
          <h3>${escapeHTML(title)}</h3>
          ${
            helperLines
              ? `<p class="muted small helper-lines">${helperLines.map((line) => `<span>${escapeHTML(line)}</span>`).join("")}</p>`
              : helper
                ? `<p class="muted small">${escapeHTML(helper)}</p>`
                : ""
          }
        </div>
        ${showManage ? `<button class="mini-btn light" type="button" data-nav="player">My Players</button>` : ""}
      </div>
      <div class="player-chip-row">${chips || `<p class="muted small">No players available.</p>`}</div>
    </section>
  `;
}

function renderPlayerAssignmentCard(player) {
  const normalized = normalizePlayer(player);
  const active = normalized.id === state.activePlayerId;
  const totals = calculateSeasonTotalsForPlayer(normalized);
  const subline = playerSubline(normalized);
  return `
    <section class="player-assignment-card ${active ? "active" : ""}">
      <div class="player-assignment-main">
        <div>
          <h3>${escapeHTML(playerTitle(normalized))}</h3>
          <p>${escapeHTML(subline)}</p>
        </div>
        ${active ? `<span class="status-pill">Selected</span>` : `<button class="mini-btn light" type="button" data-player-select="${escapeHTML(normalized.id)}">Select</button>`}
      </div>
      <div class="player-assignment-stats">
        <span><strong>${totals.gamesPlayed}</strong> Games</span>
        <span><strong>${totals.averageImpact.toFixed(1)}</strong> Avg Impact</span>
        <span><strong>${totals.goals}</strong> Goals</span>
        <span><strong>${totals.assists}</strong> Assists</span>
      </div>
      <div class="player-assignment-actions">
        <button class="mini-btn" type="button" data-player-go="${escapeHTML(normalized.id)}" data-target-screen="start">Track</button>
        <button class="mini-btn light" type="button" data-player-go="${escapeHTML(normalized.id)}" data-target-screen="past">Games</button>
        <button class="mini-btn light" type="button" data-player-go="${escapeHTML(normalized.id)}" data-target-screen="dashboard">Season</button>
      </div>
    </section>
  `;
}

function renderMyPlayersList() {
  const players = visiblePlayers();
  if (!players.length) {
    return `
      <section class="card pad">
        <h3>No Verified Players Yet</h3>
        <p class="muted small">Request team access, then verify your child by jersey number after approval.</p>
        <button class="mini-btn" type="button" data-nav="team">Open Team Access</button>
      </section>
    `;
  }
  return `
    <section class="card pad my-players-card">
      <div class="section-head compact-head">
        <div>
          <h3>My Players</h3>
          <p class="muted small">Each tile is a separate player/team tracking context.</p>
        </div>
        <button class="mini-btn light" type="button" data-nav="team">Team Access</button>
      </div>
      <div class="player-assignment-list">
        ${players.map(renderPlayerAssignmentCard).join("")}
      </div>
    </section>
  `;
}

function renderTeamAccessRequests() {
  const team = activeTeam();
  if (!team || !canManageRoster(team.id)) return "";
  const requests = state.teamAccessRequests.filter((request) => request.teamId === team.id && request.status === "pending");
  return `
    <div class="team-roster-block">
      <div class="section-head compact-head">
        <div>
          <h4>Team Access Requests</h4>
          <p class="muted small">Approve parents before they can see this roster or track a player.</p>
        </div>
      </div>
      ${
        requests.length
          ? `<div class="admin-request-list">
              ${requests
                .map(
                  (request) => {
                    const parentName = [request.firstName, request.lastName].filter(Boolean).join(" ");
                    return `
                    <div class="admin-request-row detailed">
                      <span>
                        <strong>${escapeHTML(parentName || request.email || "Unknown parent")}</strong>
                          <small>${escapeHTML(request.email || "No email")} - ${teamRoleLabel(request.requestedRole)} - Jersey #${escapeHTML(request.childJerseyNumber || "not provided")}${request.phone ? ` - ${escapeHTML(request.phone)}` : ""}</small>
                      </span>
                      <span class="event-actions">
                        <button class="mini-btn" type="button" data-review-team-access="${request.id}" data-approved="true">Approve</button>
                        <button class="mini-btn danger" type="button" data-review-team-access="${request.id}" data-approved="false">Reject</button>
                      </span>
                    </div>
                  `;
                  },
                )
                .join("")}
            </div>`
          : `<p class="muted small">No pending team access requests.</p>`
      }
    </div>
  `;
}

function renderAdminTeamRequestInbox() {
  if (!isPlatformReviewer()) return "";
  const requests = state.teamAccessRequests.filter((request) => request.status === "pending");
  return `
    <section class="card pad admin-review-card">
      <div class="section-head compact-head">
        <div>
          <h3>Pending Parent Requests</h3>
          <p class="muted small">Approve team and player access across every roster.</p>
        </div>
        <button class="mini-btn light" type="button" data-action="sync-team-roster">Sync</button>
      </div>
      ${
        requests.length
          ? `<div class="admin-request-list">
              ${requests
                .map(
                  (request) => {
                    const parentName = [request.firstName, request.lastName].filter(Boolean).join(" ");
                    return `
                      <div class="admin-request-row detailed">
                        <span>
                          <strong>${escapeHTML(parentName || request.email || "Unknown parent")}</strong>
                          <small>${escapeHTML(request.teamName || "Team")} - Jersey #${escapeHTML(request.childJerseyNumber || "not provided")} - ${escapeHTML(request.email || "No email")}</small>
                        </span>
                        <span class="event-actions">
                          <button class="mini-btn" type="button" data-review-team-access="${request.id}" data-approved="true">Approve</button>
                          <button class="mini-btn danger" type="button" data-review-team-access="${request.id}" data-approved="false">Reject</button>
                        </span>
                      </div>
                    `;
                  },
                )
                .join("")}
            </div>`
          : `<p class="muted small">No pending parent requests.</p>`
      }
    </section>
  `;
}

function renderClaimByNumberForm(teamId, options = {}) {
  const suffix = options.suffix || teamId || "active";
  return `
    <form class="inline-mini-form" data-form="claim-roster-player">
      <input type="hidden" name="teamId" value="${escapeHTML(teamId || "")}" />
      <label for="claimJerseyNumber-${escapeHTML(suffix)}">Confirm your player</label>
      <div class="inline-input-action">
        <input id="claimJerseyNumber-${escapeHTML(suffix)}" name="claimJerseyNumber" inputmode="numeric" placeholder="Jersey #" required />
        <button class="mini-btn" type="submit">Verify</button>
      </div>
      <p class="muted small">Enter your child's jersey number. After verification, only that player will appear for this account.</p>
    </form>
  `;
}

function renderPlayerVerificationBlock(teamId, options = {}) {
  if (!teamId) return "";
  const team = teamById(teamId);
  const teamName = options.teamName || team?.name || "your team";
  const suffix = options.suffix || teamId;
  return `
    <div class="team-roster-block verify-player-block">
      <div class="section-head compact-head">
        <div>
          <h4>Verify Your Player</h4>
          <p class="muted small">Access is approved for ${escapeHTML(teamName)}. Enter your child's jersey number to unlock only that player.</p>
        </div>
      </div>
      ${renderClaimByNumberForm(teamId, { suffix })}
    </div>
  `;
}

function renderUnclaimedRosterPlayers(roster = []) {
  if (!roster.length) return "";
  const unclaimed = roster.filter((player) => !hasPlayerClaim(player.teamId, player.id));
  return `
    <div class="team-roster-block">
      <div class="section-head compact-head">
        <div>
          <h4>Unclaimed Players</h4>
          <p class="muted small">Roster players not yet verified by a parent account.</p>
        </div>
      </div>
      ${
        unclaimed.length
          ? `<div class="admin-request-list">
              ${unclaimed
                .map(
                  (player) => `
                    <div class="admin-request-row">
                      <span>
                        <strong>${escapeHTML(player.name)}</strong>
                        <small>${player.number ? `#${escapeHTML(player.number)}` : "No jersey"}${player.position ? ` - ${escapeHTML(player.position)}` : ""}</small>
                      </span>
                    </div>
                  `,
                )
                .join("")}
            </div>`
          : `<p class="muted small">Every roster player on this team has been claimed.</p>`
      }
    </div>
  `;
}

function renderMyTeamAccessRequests() {
  const ownRequests = state.teamAccessRequests.filter((request) => request.userId === currentUserId());
  if (!ownRequests.length) return "";
  return `
    <div class="team-roster-block">
      <div class="section-head compact-head">
        <div>
          <h4>My Team Requests</h4>
          <p class="muted small">Approved requests appear here before the roster loads.</p>
        </div>
      </div>
      <div class="admin-request-list">
        ${ownRequests
          .map(
            (request) => {
              const needsClaim =
                request.status === "approved" &&
                request.requestedRole === "tracker" &&
                !state.playerClaims.some((claim) => claim.teamId === request.teamId);
              return `
                <div class="admin-request-row">
                  <span>
                    <strong>${escapeHTML(request.teamName || "Team")}</strong>
                    <small>Access: ${escapeHTML(request.status)}</small>
                  </span>
                </div>
                ${needsClaim ? renderPlayerVerificationBlock(request.teamId, { teamName: request.teamName, suffix: request.id || request.teamId }) : ""}
              `;
            },
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderTeamRosterCard(options = {}) {
  const compact = Boolean(options.compact);
  const expanded = compact ? state.teamRosterExpanded : true;
  if (!supabaseClient || !state.authUser) {
    return `
      <section class="card pad team-card">
        <h3>Team</h3>
        <p class="muted small">Sign in with a User Profile to request team access and view synced team stats.</p>
      </section>
    `;
  }

  const team = activeTeam();
  const roster = activeTeamRoster();
  const fullTeamRoster = team ? teamRosterPlayers(team.id) : [];
  const editable = team ? canManageRoster(team.id) : false;
  const manageRoster = team ? canManageRoster(team.id) : false;
  const teams = state.teams
    .map((item) => {
      const active = item.id === state.activeTeamId;
      const accessCopy = item.role === "admin" && canCreateTeams()
        ? `${item.inviteCode ? `Team code: ${item.inviteCode}` : "Access: approved"}`
        : "Access: approved";
      return `
        <button class="team-chip ${active ? "active" : ""}" type="button" data-team-select="${item.id}" aria-pressed="${active}">
          <strong>${escapeHTML(item.name)}</strong>
          <span>${escapeHTML(accessCopy)}</span>
        </button>
      `;
    })
    .join("");
  const rosterChips = roster.length
    ? roster
        .map((item) => {
          const player = rosterPlayerToPlayer(item);
          const active = player.id === state.activePlayerId;
          const claimed = hasPlayerClaim(item.teamId, item.id);
          return `
            <div class="player-chip-wrap">
              <button class="player-chip ${active ? "active" : ""}" type="button" data-player-select="${player.id}" aria-pressed="${active}">
                <strong>${escapeHTML(player.name)}</strong>
                <span>${item.number ? `#${escapeHTML(item.number)}` : "No jersey"}${item.position ? ` - ${escapeHTML(item.position)}` : ""}${claimed ? " - Verified child" : ""}</span>
              </button>
            </div>
          `;
        })
        .join("")
    : "";
  const showClaimByNumber =
    team &&
    teamRole(team.id) === "tracker" &&
    !state.playerClaims.some((claim) => claim.teamId === team.id);
  const emptyRosterCopy = showClaimByNumber
    ? "Enter your child's jersey number below to unlock that player."
    : editable
      ? "No rostered players yet. Add players by name and jersey number."
      : "No verified player is available for this account yet.";
  const rosterContent = roster.length ? rosterChips : `<p class="muted small">${emptyRosterCopy}</p>`;
  const claimByNumberForm = showClaimByNumber
    ? renderPlayerVerificationBlock(team.id, { suffix: "active-team" })
    : "";
  const teamCardTitle = canCreateTeams() ? "Connected Team" : "Team Access";
  const teamHeaderCopy = !team
    ? canCreateTeams()
      ? "Create a team or request access with a team code."
      : "Request access with a team code from your team admin."
    : "";

  return `
    <section class="card pad team-card ${compact && !expanded ? "collapsed" : ""}">
      <div class="collapsible-card-head">
        <div>
          <h3>${escapeHTML(teamCardTitle)}</h3>
          ${teamHeaderCopy ? `<p class="muted small">${escapeHTML(teamHeaderCopy)}</p>` : ""}
        </div>
        ${
          compact
            ? `<button class="collapse-icon" type="button" data-action="toggle-team-roster" aria-expanded="${expanded}" aria-label="${expanded ? "Minimize Team" : "Expand Team"}">
                <span aria-hidden="true">${expanded ? "v" : ">"}</span>
              </button>`
            : ""
        }
      </div>

      ${
        expanded
          ? `
            <div class="team-card-body">
              <div class="team-actions">
                <button class="mini-btn light" type="button" data-action="sync-team-roster">Sync</button>
                <button class="mini-btn light" type="button" data-action="toggle-team-access">Request Access</button>
                ${manageRoster ? `<button class="mini-btn danger" type="button" data-action="delete-team">Delete Team</button>` : ""}
              </div>
              ${
                teams
                  ? `<div class="team-chip-row">${teams}</div>`
                  : `<p class="muted small">${
                      canCreateTeams()
                        ? "No teams yet. Create one for your roster or request access with a code from another parent."
                        : "No approved teams yet. Request access with a code from your team admin."
                    }</p>`
              }

              ${
                team
                  ? `
                    ${
                      manageRoster
                        ? `<div class="team-roster-block">
                            <div class="section-head compact-head">
                              <div>
                                <h4>Manage Team Players</h4>
                                <p class="muted small">Admin-only roster tools for preloading players by name and jersey number.</p>
                              </div>
                            </div>
                            <div class="player-chip-row">${rosterContent}</div>
                            ${renderUnclaimedRosterPlayers(fullTeamRoster)}
                            ${claimByNumberForm}
                          </div>
                          <form class="team-add-player-form" data-form="add-roster-player">
                            <div class="form-grid two">
                              <div class="field">
                                <label for="rosterName">Player name</label>
                                <input id="rosterName" name="rosterName" placeholder="Player name" required />
                              </div>
                              <div class="field">
                                <label for="rosterNumber">Jersey #</label>
                                <input id="rosterNumber" name="rosterNumber" inputmode="numeric" placeholder="12" />
                              </div>
                            </div>
                            ${renderPositionPicker({ name: "rosterPosition", label: "Positions" })}
                            <div class="team-form-actions">
                              <button class="mini-btn" type="submit">Add Player</button>
                            </div>
                          </form>`
                        : `${claimByNumberForm}`
                    }
                    ${
                      manageRoster
                        ? renderTeamAccessRequests()
                        : ""
                    }
                  `
                  : ""
              }
            </div>
          `
          : ""
      }
    </section>
  `;
}

function renderHome() {
  if (!state.authUser) return renderWelcome();

  const season = calculateSeasonTotals();
  const active = state.activeGame;
  const activePlayer = active ? gamePlayerSnapshot(active) : null;

  return renderShell(`
    <section class="screen-title home-title">
      <h2>Fast stats for a fast game.</h2>
      <p>Track every play with big buttons, local saves, and season totals that work offline.</p>
    </section>

    <section class="stack">
      ${renderPlayerSwitcher({
        helper: false,
      })}

      <div class="metric-grid">
        <div class="metric"><strong>${season.gamesPlayed}</strong><span>Games</span></div>
        <div class="metric"><strong>${season.averageImpact.toFixed(1)}</strong><span>Avg Impact</span></div>
        <div class="metric"><strong>${season.goals}</strong><span>Goals</span></div>
        <div class="metric"><strong>${season.assists}</strong><span>Assists</span></div>
      </div>

      <div class="action-grid home-action-grid">
        ${
          active
            ? `<button class="btn brand positive" type="button" data-nav="live">Resume ${escapeHTML(playerTitle(activePlayer))}</button>`
            : `<button class="btn brand positive" type="button" data-nav="start">Track New Game</button>`
        }
        <button class="btn brand neutral" type="button" data-nav="past">Review Games</button>
      </div>
    </section>
  `);
}

function renderMore() {
  const team = activeTeam();
  const playerLine = [playerSubline(state.player)].filter(Boolean).join("");
  const profileName = [state.userProfile?.firstName, state.userProfile?.lastName].filter(Boolean).join(" ");
  const active = state.activeGame;
  const activePlayer = active ? gamePlayerSnapshot(active) : null;
  const helpExpanded = state.helpExpanded;
  const activePlayerTeamName = state.player.team || teamById(state.player.teamId)?.name || "";
  const activeTeamName = team?.name || "";
  const teamMismatch = activeTeamName && activePlayerTeamName && activeTeamName !== activePlayerTeamName;
  const gameDaySummary = teamMismatch
    ? `Tracking ${playerTitle(state.player)} on ${activePlayerTeamName}. Managing ${activeTeamName}.`
    : `${playerTitle(activePlayer || state.player)}${playerLine ? ` - ${playerLine}` : ""}`;
  const accountModeToggle = isReviewerAccount()
    ? `<div class="mode-toggle" role="group" aria-label="Admin view mode">
        <button class="mini-btn ${isPlatformReviewer() ? "" : "light"}" type="button" data-admin-view-mode="admin" aria-pressed="${isPlatformReviewer()}">Admin Mode</button>
        <button class="mini-btn ${!isPlatformReviewer() ? "" : "light"}" type="button" data-admin-view-mode="tracker" aria-pressed="${!isPlatformReviewer()}">Tracker Mode</button>
      </div>`
    : "";

  return renderShell(`
    <section class="screen-title">
      <h2>Manage</h2>
      <p>Quick access to tracking, player details, team tools, account, watching, and help.</p>
    </section>

    <section class="stack">
      <section class="card pad more-card">
        <div>
          <h3>Game Day Manager</h3>
          <p class="muted small">${escapeHTML(gameDaySummary)}</p>
        </div>
        <div class="more-status-grid">
          <div class="more-status-cell">
            <span>Active player</span>
            <strong>${escapeHTML(playerTitle(state.player))}</strong>
            ${activePlayerTeamName ? `<small>${escapeHTML(activePlayerTeamName)}</small>` : ""}
          </div>
          <div class="more-status-cell">
            <span>Managing team</span>
            <strong>${escapeHTML(activeTeamName || state.player.team || "Not connected")}</strong>
          </div>
        </div>
        ${teamMismatch ? `<div class="notice-card compact-notice"><strong>Different team selected.</strong><p class="muted small">Use Manage Teams to add roster players for ${escapeHTML(activeTeamName)}, or use Players to switch who you are tracking.</p></div>` : ""}
        <div class="more-action-list">
          <button class="more-action" type="button" data-nav="${active ? "live" : "start"}">
            <span>${renderNavIcon("track")}</span>
            <strong>${active ? "Resume Live Game" : "Track New Game"}</strong>
            <small>${active ? `Continue tracking ${escapeHTML(playerTitle(activePlayer))}.` : "Open the game setup screen."}</small>
          </button>
          <button class="more-action" type="button" data-nav="player">
            <span>${renderNavIcon("player")}</span>
            <strong>Manage Players</strong>
            <small>Choose who to track and review each player/team context.</small>
          </button>
          <button class="more-action" type="button" data-nav="team">
            <span>${renderNavIcon("team")}</span>
            <strong>Manage Teams</strong>
            <small>Sync approvals, request access, and verify players.</small>
          </button>
        </div>
      </section>

      <section class="card pad more-card">
        <div>
          <h3>Account</h3>
          <p class="muted small">${escapeHTML(profileName || userEmail())}${userEmail() ? ` - ${escapeHTML(userEmail())}` : ""}</p>
        </div>
        <div class="more-status-grid">
          <div class="more-status-cell">
            <span>Status</span>
            <strong>${escapeHTML(state.syncStatus || "Signed in")}</strong>
          </div>
          <div class="more-status-cell">
            <span>App</span>
            <strong>${escapeHTML(APP_VERSION)}</strong>
          </div>
        </div>
        ${accountModeToggle}
        ${state.cloudError ? `<div class="notice-card error-card"><strong>Last Supabase error</strong><p class="muted small">${escapeHTML(state.cloudError)}</p></div>` : ""}
        <div class="more-action-list">
          <button class="more-action" type="button" data-nav="profileSetup">
            <span>${renderNavIcon("more")}</span>
            <strong>User Profile</strong>
            <small>Edit parent details and account information.</small>
          </button>
          <button class="more-action" type="button" data-action="sync-cloud-games">
            <span>${renderNavIcon("season")}</span>
            <strong>Sync Cloud Games</strong>
            <small>Refresh saved games, teams, requests, and player access.</small>
          </button>
          <button class="more-action" type="button" data-action="check-app-update">
            <span>${renderNavIcon("manage")}</span>
            <strong>Check for Updates</strong>
            <small>Look for the newest LaxHornet version without reinstalling.</small>
          </button>
          <button class="more-action danger-link" type="button" data-action="sign-out">
            <span>${renderNavIcon("more")}</span>
            <strong>Sign Out</strong>
            <small>Use this before switching parent accounts on the same device.</small>
          </button>
        </div>
      </section>

      ${renderWatchSharedGameForm()}

      <section class="card pad more-card ${helpExpanded ? "" : "collapsed"}">
        <div class="collapsible-card-head">
          <div>
            <h3>Help</h3>
            <p class="muted small">Quick guide and scoring help.</p>
          </div>
          <button class="collapse-icon" type="button" data-action="toggle-help-card" aria-expanded="${helpExpanded}" aria-label="${helpExpanded ? "Minimize Help" : "Expand Help"}">
            <span aria-hidden="true">${helpExpanded ? "v" : ">"}</span>
          </button>
        </div>
        ${helpExpanded ? `
          <div class="more-action-list">
            <button class="more-action" type="button" data-nav="tutorial">
              <span>${renderNavIcon("games")}</span>
              <strong>Quick Guide</strong>
              <small>Learn the game-day flow and sharing tools.</small>
            </button>
            <button class="more-action" type="button" data-nav="help">
              <span>${renderNavIcon("season")}</span>
              <strong>Impact Help</strong>
              <small>See how Impact Score and percentages work.</small>
            </button>
          </div>
        ` : ""}
      </section>
    </section>
  `);
}

function renderWelcome() {
  return renderShell(`
    <section class="welcome-hero">
      <div class="welcome-copy">
        <h2>Fast stats for a fast game.</h2>
        <p>LaxHornet helps parents track youth lacrosse stats live, share game updates, and keep each player&apos;s season organized.</p>
      </div>
      <div class="welcome-actions">
        <button class="btn positive" type="button" data-action="focus-auth">Sign In</button>
        <button class="btn secondary" type="button" data-action="focus-auth">Create Account</button>
      </div>
    </section>

    <section class="stack welcome-stack">
      ${renderAccountCard()}

      <div class="card pad welcome-info-card">
        <h3>How access works</h3>
        <div class="welcome-step-list">
          <div><strong>1</strong><span>Create a User Profile.</span></div>
          <div><strong>2</strong><span>Request access with your team code.</span></div>
          <div><strong>3</strong><span>Parent Trackers verify their player by jersey number.</span></div>
        </div>
      </div>

      ${renderWatchSharedGameForm()}

      <div class="card pad faq-card">
        <h3>Quick FAQ</h3>
        <details>
          <summary>Do I need an account?</summary>
          <p class="muted small">Yes for team rosters, player verification, cloud sync, and sharing stats across parent accounts.</p>
        </details>
        <details>
          <summary>Can I watch without tracking?</summary>
          <p class="muted small">Yes. Use Watch Shared Game with a share code from the Parent Tracker&apos;s iPhone or another device.</p>
        </details>
        <details>
          <summary>Who can create teams?</summary>
          <p class="muted small">Team rosters are managed by LaxHornet admin access. Parent Trackers request team access and verify their player before entering stats.</p>
        </details>
        <div class="action-grid compact">
          <button class="btn neutral" type="button" data-nav="tutorial">Quick Guide</button>
          <button class="btn secondary" type="button" data-nav="help">Impact Help</button>
        </div>
      </div>
    </section>
  `, { hideNav: true });
}

function renderProfileSetup() {
  const profile = state.userProfile || {};
  const signupDraft = !state.authUser && state.signupDraft;
  const email = signupDraft?.email || userEmail() || profile.email || "";
  const showAccessRequestFields = Boolean(signupDraft);
  return renderShell(`
    <section class="screen-title">
      <h2>${signupDraft ? "Finish Your Profile" : "User Profile"}</h2>
      <p>${signupDraft ? "Add your parent details, team code, and child jersey number. Your request will go to the LaxHornet admin for approval." : "Update your account details. Team access and player verification are managed from the Team page."}</p>
    </section>

    <form class="card pad form-grid profile-setup-card" data-form="profile-onboarding">
      <div class="field">
        <label for="profileEmail">Account email</label>
        <input id="profileEmail" value="${escapeHTML(email)}" autocomplete="email" readonly />
      </div>

      <div class="form-grid two">
        <div class="field">
          <label for="firstName">First name</label>
          <input id="firstName" name="firstName" value="${escapeHTML(profile.firstName || "")}" autocomplete="given-name" required />
        </div>
        <div class="field">
          <label for="lastName">Last name</label>
          <input id="lastName" name="lastName" value="${escapeHTML(profile.lastName || "")}" autocomplete="family-name" required />
        </div>
      </div>

      <div class="field">
        <label for="phone">Phone number <span class="optional-label">optional</span></label>
        <input id="phone" name="phone" value="${escapeHTML(profile.phone || "")}" type="tel" autocomplete="tel" placeholder="For team coordination" />
      </div>

      ${showAccessRequestFields ? `
        <div class="form-grid two">
          <div class="field">
            <label for="teamAccessCode">Team code</label>
            <input id="teamAccessCode" name="teamAccessCode" placeholder="ABC123" autocapitalize="characters" required />
          </div>
          <div class="field">
            <label for="childJerseyNumber">Child jersey #</label>
            <input id="childJerseyNumber" name="childJerseyNumber" inputmode="numeric" placeholder="12" required />
          </div>
        </div>

        <div class="notice-card">
          <strong>Approval protects the roster.</strong>
          <p class="muted small">When approved, this account will unlock only the rostered player matching the jersey number you submit.</p>
        </div>
      ` : ""}

      ${state.cloudError ? `<div class="notice-card error-card"><strong>Could not submit request.</strong><p class="muted small">${escapeHTML(state.cloudError)}</p></div>` : ""}

      <div class="account-actions">
        <button class="btn positive" type="submit" ${state.authBusy ? "disabled" : ""}>${state.authBusy ? "Submitting..." : signupDraft ? "Submit Request" : "Save Profile"}</button>
        <button class="btn secondary" type="button" data-nav="home">Back</button>
        ${state.authUser ? `<button class="btn danger" type="button" data-action="sign-out">Sign Out</button>` : ""}
      </div>
    </form>
  `, { hideNav: !state.authUser });
}

function renderTeamAccessTools() {
  const team = activeTeam();
  const requestList = renderMyTeamAccessRequests();
  const expanded = state.teamAccessExpanded;
  return `
      <section class="card pad ${expanded ? "" : "collapsed"}">
        <div class="collapsible-card-head">
          <div>
            <h3>Request Access</h3>
            <p class="muted small">${escapeHTML(team ? "Use this only if you need access to another team." : "Use the code shared by your team admin.")}</p>
          </div>
          <button class="collapse-icon" type="button" data-action="toggle-team-access" aria-expanded="${expanded}" aria-label="${expanded ? "Minimize Request Access" : "Expand Request Access"}">
            <span aria-hidden="true">${expanded ? "v" : ">"}</span>
          </button>
        </div>
        ${
          expanded
            ? `<form class="inline-mini-form" data-form="join-team">
                <label for="inviteCode">Team access code</label>
                <div class="inline-input-action">
                  <input id="inviteCode" name="inviteCode" placeholder="ABC123" autocapitalize="characters" autocomplete="off" />
                  <button class="mini-btn" type="submit">Request</button>
                </div>
              </form>`
            : ""
        }
      </section>

      ${
        canCreateTeams()
          ? `<section class="card pad">
              <div class="section-head compact-head">
                <div>
                  <h3>Create Team</h3>
                  <p class="muted small">Admin-only setup for preloading the official roster.</p>
                </div>
              </div>
              <form class="inline-mini-form" data-form="create-team">
                <label for="teamName">Team name</label>
                <div class="inline-input-action">
                  <input id="teamName" name="teamName" placeholder="Team name" />
                  <button class="mini-btn" type="submit">Create</button>
                </div>
              </form>
            </section>`
          : ""
      }

      <section class="card pad team-requests-card">
        ${
          requestList ||
          `<div class="section-head compact-head">
            <div>
              <h3>My Team Requests</h3>
              <p class="muted small">Approved access appears here. Parent Trackers verify one player by jersey number.</p>
            </div>
          </div>
          <p class="muted small">No team access requests yet.</p>`
        }
      </section>
  `;
}

function renderTeamPage() {
  const admin = canCreateTeams();
  return renderShell(`
    <section class="screen-title">
      <h2>${admin ? "Team" : "Team Access"}</h2>
      <p>${admin ? "Sync team data, request access with a team code, and manage roster tools in one place." : "Request team access, sync approvals, and verify your child by jersey number."}</p>
    </section>

    <section class="stack">
      ${renderAdminTeamRequestInbox()}
      ${renderTeamRosterCard()}
      ${renderTeamAccessTools()}
    </section>
  `);
}

function renderTeamAccess() {
  return renderTeamPage();
}

function renderPlayerPage() {
  const team = activeTeam();
  const selectedRosterPlayer = isTeamPlayer(state.player) ? normalizePlayer(state.player) : null;
  const canEditSelectedRosterPlayer = selectedRosterPlayer ? canManageRoster(selectedRosterPlayer.teamId) : false;
  const canRemoveClaimedRosterPlayer = selectedRosterPlayer
    ? !canEditSelectedRosterPlayer && hasPlayerClaim(selectedRosterPlayer.teamId, selectedRosterPlayer.rosterPlayerId || selectedRosterPlayer.id)
    : false;
  const rosterEditCard = selectedRosterPlayer
    ? canEditSelectedRosterPlayer
      ? `
        <form class="card pad form-grid" data-form="roster-player-edit">
          <div class="section-head compact-head">
            <div>
              <h3>Edit ${escapeHTML(selectedRosterPlayer.name)}</h3>
              <p class="muted small">Changes update the shared roster for every parent on this team.</p>
            </div>
          </div>
          <div class="field">
            <label for="editRosterName">Player name</label>
            <input id="editRosterName" name="name" value="${escapeHTML(selectedRosterPlayer.name)}" required />
          </div>
          <div class="form-grid two">
            <div class="field">
              <label for="editRosterNumber">Jersey #</label>
              <input id="editRosterNumber" name="number" value="${escapeHTML(selectedRosterPlayer.number)}" inputmode="numeric" />
            </div>
            ${renderPositionPicker({ name: "position", selected: selectedRosterPlayer.position, label: "Positions" })}
          </div>
          <div class="inline-input-action">
            <button class="mini-btn danger" type="button" data-action="remove-roster-player">Delete Player</button>
            <button class="mini-btn" type="submit">Save Player</button>
          </div>
        </form>
      `
      : ""
    : "";
  const playerDeleteCard = selectedRosterPlayer
    ? canRemoveClaimedRosterPlayer
      ? `<section class="card pad">
          <h3>Remove Player From My Account</h3>
          <p class="muted small">This removes your access to ${escapeHTML(playerTitle(selectedRosterPlayer))}. It will not delete the team roster player for other parents.</p>
          <button class="btn danger" type="button" data-action="remove-claimed-player">Remove from My Account</button>
        </section>`
      : ""
    : `<section class="card pad">
        <h3>Delete Player</h3>
        <p class="muted small">Remove this locally saved player from this device.</p>
        <button class="btn danger" type="button" data-action="delete-player">Delete Player</button>
      </section>`;
  return renderShell(`
    <section class="screen-title">
      <h2>My Players</h2>
      <p>Choose the player and team context before tracking, reviewing games, or checking season totals.</p>
    </section>

    <section class="stack">
      ${renderMyPlayersList()}
      ${team ? "" : `<section class="card pad">
        <h3>No Team Connected</h3>
        <p class="muted small">Use Team to request access with a team code, then sync after approval.</p>
        <button class="mini-btn" type="button" data-nav="team">Open Team</button>
      </section>`}
      ${rosterEditCard}
      ${playerDeleteCard}
    </section>
  `);
}

function renderSettings() {
  return renderPlayerPage();
}

function renderStartGame() {
  const viewOnlyTeamPlayer = isTeamPlayer(state.player) && !canTrackPlayer(state.player);
  const availablePlayers = visiblePlayers();
  return renderShell(`
    <section class="screen-title">
      <h2>Track New Game</h2>
      <p>${availablePlayers.length > 1 ? "Choose the player/team context, then set the game details." : "Set the opponent, choose the game format, then start tracking."}</p>
    </section>

    <form class="card pad form-grid" data-form="start-game">
      ${renderPlayerSwitcher({
        title: availablePlayers.length > 1 ? "Who Are You Tracking?" : "Player For This Game",
        helper: viewOnlyTeamPlayer
          ? "Verify this roster player as your child before tracking."
          : availablePlayers.length > 1
            ? "Each player/team tile keeps stats separate."
            : "Double-check this before the opening whistle.",
        inline: true,
      })}
      ${
        viewOnlyTeamPlayer
          ? `<div class="notice-card">Select your child in Player before starting a shared team game.</div>`
          : ""
      }
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
      <button class="btn positive" type="submit" ${viewOnlyTeamPlayer ? "disabled" : ""}>Start Live Tracker</button>
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
        <p>Track a new game to open the live tracker.</p>
      </section>
      <button class="btn positive" type="button" data-nav="start">Track New Game</button>
    `);
  }

  const game = state.activeGame;
  const player = gamePlayerSnapshot(game);
  const totals = calculateTotals(game.events);
  const recentEvents = [...game.events].reverse().slice(0, 5);
  const periods = periodsForGame(game);
  const details = `${escapeHTML(playerTitle(player))} - ${formatDate(game.date)} - ${periodFormatLabel(game)}${game.location ? ` - ${escapeHTML(game.location)}` : ""}`;

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

function renderGameEditForm(game) {
  const currentPlayerId = gamePlayerId(game) || state.activePlayerId;
  const playerOptions = state.players
    .map(
      (player) =>
        `<option value="${player.id}" ${player.id === currentPlayerId ? "selected" : ""}>${escapeHTML(playerTitle(player))}</option>`,
    )
    .join("");
  return `
    <form class="card pad form-grid edit-game-form" data-form="game-edit" data-game-id="${game.id}">
      <h3>Edit Game Details</h3>
      <div class="form-grid two">
        <div class="field">
          <label for="editGameOpponent">Opponent</label>
          <input id="editGameOpponent" name="opponent" value="${escapeHTML(game.opponent || "")}" required />
        </div>
        <div class="field">
          <label for="editGameDate">Date</label>
          <input id="editGameDate" name="date" type="date" value="${escapeHTML(game.date || todayISO())}" required />
        </div>
        <div class="field">
          <label for="editGamePlayer">Player</label>
          <select id="editGamePlayer" name="playerId">${playerOptions}</select>
        </div>
        <div class="field">
          <label for="editGameType">Game type</label>
          <select id="editGameType" name="gameType">
            ${["Regular season", "Tournament", "Playoff", "Scrimmage"]
              .map((type) => `<option ${type === (game.gameType || "Regular season") ? "selected" : ""}>${type}</option>`)
              .join("")}
          </select>
        </div>
        <div class="field">
          <label for="editPeriodFormat">Game format</label>
          <select id="editPeriodFormat" name="periodFormat">
            <option value="quarters" ${periodFormatForGame(game) === "quarters" ? "selected" : ""}>Quarters</option>
            <option value="halves" ${periodFormatForGame(game) === "halves" ? "selected" : ""}>Halves</option>
          </select>
        </div>
        <div class="field">
          <label for="editGameLocation">Location</label>
          <input id="editGameLocation" name="location" value="${escapeHTML(game.location || "")}" />
        </div>
      </div>
      <div class="edit-actions">
        <button class="btn positive" type="submit">Save Game Details</button>
        <button class="btn secondary" type="button" data-action="cancel-edit-game">Cancel</button>
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
      <button class="btn positive" type="button" data-nav="start">Track New Game</button>
    `);
  }

  const totals = calculateTotals(game.events);
  const player = gamePlayerSnapshot(game);
  const canEditCurrentGame = canEditGame(game);
  const canShowGameEdit = canEditCurrentGame && !state.editingGameDetails;
  const editingEvent = state.editingEventId
    ? game.events.find((event) => event.id === state.editingEventId)
    : null;
  const tagEditingEvent = state.tagEditingEventId
    ? game.events.find((event) => event.id === state.tagEditingEventId)
    : null;
  return renderShell(`
    <section class="screen-title">
      <h2>Game Review</h2>
      <p>${escapeHTML(playerTitle(player))} - ${escapeHTML(game.opponent)} - ${formatDate(game.date)}</p>
    </section>

    <section class="stack">
      <div class="metric-grid">
        <div class="metric"><strong>${totals.impact}</strong><span>Impact Score</span></div>
        <div class="metric"><strong>${totals.points}</strong><span>Points</span></div>
        <div class="metric"><strong>${totals.goals}</strong><span>Goals</span></div>
        <div class="metric"><strong>${totals.assists}</strong><span>Assists</span></div>
      </div>
      ${canShowGameEdit ? `<button class="btn neutral" type="button" data-action="edit-game-details">Edit Game Details</button>` : ""}
      ${state.editingGameDetails && canEditCurrentGame ? renderGameEditForm(game) : ""}
      ${renderTotalsTable(totals)}
      ${editingEvent && canEditCurrentGame ? renderEventEditForm(game, editingEvent) : ""}
      ${tagEditingEvent && canEditCurrentGame ? renderTagEditor(game, tagEditingEvent) : ""}
      <div class="card pad">
        <h3>Event Log</h3>
        ${
          game.events.length
            ? `<div class="event-list">${[...game.events]
                .reverse()
                .map((event) => renderEventRow(event, { editable: canEditCurrentGame, gameId: game.id }))
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
        <p>${code ? `Loading share code ${code}...` : "Enter a share code from the Parent Tracker phone."}</p>
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
  const exportExpanded = state.exportToolsExpanded;
  return renderShell(`
    <section class="screen-title">
      <h2>Past Games</h2>
      <p>Showing saved games for ${escapeHTML(playerTitle(state.player))}.</p>
    </section>

    <section class="stack">
      ${renderPlayerSwitcher({
        helper: "Switch players to review a different player's games.",
      })}

      <section class="card">
        ${
          games.length
            ? games.map(renderGameListRow).join("")
            : `<div class="empty">No saved games yet.</div>`
        }
      </section>

      <section class="card pad export-card ${exportExpanded ? "expanded" : "collapsed"}">
        <div class="collapsible-card-head">
          <div>
            <h3>Backup & Export</h3>
            <p class="muted small">CSV, JSON backup, and restore tools.</p>
          </div>
          <button class="collapse-icon" type="button" data-action="toggle-export-tools" aria-expanded="${exportExpanded}" aria-label="${exportExpanded ? "Minimize Backup and Export" : "Expand Backup and Export"}">
            <span aria-hidden="true">${exportExpanded ? "v" : ">"}</span>
          </button>
        </div>
        ${
          exportExpanded
            ? `<div class="export-card-body">
                <p class="muted small">Exports include player info, event tags, notes, categories, and impact values.</p>
                <div class="export-actions">
                  <button class="btn neutral" type="button" data-action="export-csv">Export CSV</button>
                  <button class="btn neutral" type="button" data-action="export-json">Export JSON</button>
                  <label class="btn secondary import-label" for="jsonImport">Import JSON</label>
                  <input class="import-input" id="jsonImport" type="file" accept="application/json,.json" data-import-json />
                </div>
              </div>`
            : ""
        }
      </section>
    </section>
  `);
}

function renderGameListRow(game) {
  const totals = calculateTotals(game.events);
  const player = gamePlayerSnapshot(game);
  const editable = canEditGame(game);
  return `
    <div class="list-row">
      <button class="brand" type="button" data-review="${game.id}" style="color: var(--text); text-align: left;">
        <span>
          <h3>${escapeHTML(game.opponent)}</h3>
          <p>${escapeHTML(playerTitle(player))} - ${formatDate(game.date)} - Impact ${totals.impact} - ${totals.goals}G ${totals.assists}A</p>
        </span>
      </button>
      <div class="row-actions">
        <button class="icon-btn wide" type="button" data-review="${game.id}" aria-label="Review and edit game">Review/Edit</button>
        ${editable ? `<button class="icon-btn delete" type="button" data-delete="${game.id}" aria-label="Delete game">Del</button>` : ""}
      </div>
    </div>
  `;
}

function metricTile(value, label) {
  return `<div class="metric"><strong>${escapeHTML(String(value))}</strong><span>${escapeHTML(label)}</span></div>`;
}

function positionListFromValue(value = "") {
  return String(value || "")
    .split(/[,/;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function positionValueFromForm(formData, name) {
  return formData
    .getAll(name)
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join(", ");
}

function renderPositionPicker({ name, selected = "", label = "Positions" } = {}) {
  const selectedPositions = new Set(positionListFromValue(selected));
  return `
    <fieldset class="position-picker">
      <legend>${escapeHTML(label)}</legend>
      <div class="position-options">
        ${PLAYER_POSITIONS.map(
          (position) => `
            <label class="position-option">
              <input type="checkbox" name="${escapeHTML(name)}" value="${escapeHTML(position)}" ${selectedPositions.has(position) ? "checked" : ""} />
              <span>${escapeHTML(position)}</span>
            </label>
          `,
        ).join("")}
      </div>
    </fieldset>
  `;
}

function dashboardHeadlineMetrics(totals, player = state.player) {
  const position = String(player.position || "").toLowerCase();
  const metrics = [
    [totals.gamesPlayed, "Games Played"],
    [totals.averageImpact.toFixed(1), "Avg Impact"],
    [totals.points, "Points"],
    [totals.goals, "Goals"],
    [totals.assists, "Assists"],
  ];

  if (position.includes("goalie") || position.includes("goal")) {
    metrics.push([totals.saves, "Saves"], [pct(totals.savePct), "Save %"], [totals.goalsAllowed, "Goals Allowed"], [totals.effortScore, "Effort Score"]);
  } else if (position.includes("face") || position.includes("fogo")) {
    metrics.push([totals.faceoffWins, "Faceoff Wins"], [pct(totals.faceoffPct), "Faceoff %"], [totals.groundBalls, "Ground Balls"], [totals.effortScore, "Effort Score"]);
  } else {
    metrics.push([totals.shots, "Shots"], [pct(totals.shotOnGoalPct), "SOG %"], [totals.groundBalls, "Ground Balls"], [totals.effortScore, "Effort Score"]);
  }

  return metrics;
}

function renderDashboard() {
  const totals = calculateSeasonTotals();
  const headlineMetrics = dashboardHeadlineMetrics(totals, state.player);
  return renderShell(`
    <section class="screen-title">
      <h2>Season Dashboard</h2>
      <p>Totals for ${escapeHTML(playerTitle(state.player))}.</p>
    </section>

    <section class="stack">
      ${renderPlayerSwitcher({
        helper: "Switch players to see a separate season dashboard.",
      })}
      <div class="metric-grid">
        ${headlineMetrics.map(([value, label]) => metricTile(value, label)).join("")}
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
        <p class="muted small">User profiles keep each family's players, games, and season dashboard separate.</p>
        <div class="account-actions">
          <button class="btn positive" type="button" data-nav="home">${signedIn ? "Go to Home" : "Sign In"}</button>
          <button class="btn secondary" type="button" data-nav="tutorial">Quick Tutorial</button>
        </div>
      </div>
    </section>
  `);
}

function renderRequestSubmitted() {
  const summary = state.accessRequestSummary || {};
  const fullName = [summary.firstName, summary.lastName].filter(Boolean).join(" ");
  return renderShell(`
    <section class="screen-title">
      <h2>Request Submitted</h2>
      <p>Your account request is in review. You will be able to track stats after approval.</p>
    </section>

    <section class="stack">
      <div class="card pad account-success-card">
        <h3>What Happens Next</h3>
        <p class="muted small">LaxHornet admin will review your team code and jersey number. Once approved, this account will only show the rostered player matching that jersey number.</p>
        <div class="request-summary">
          ${summary.email ? `<div><span>Email</span><strong>${escapeHTML(summary.email)}</strong></div>` : ""}
          ${fullName ? `<div><span>Name</span><strong>${escapeHTML(fullName)}</strong></div>` : ""}
          ${summary.teamAccessCode ? `<div><span>Team code</span><strong>${escapeHTML(summary.teamAccessCode)}</strong></div>` : ""}
          ${summary.childJerseyNumber ? `<div><span>Jersey #</span><strong>${escapeHTML(summary.childJerseyNumber)}</strong></div>` : ""}
        </div>
        <p class="muted small">Check your inbox for account verification. After admin approval, sign in with this email and password to open your player&apos;s tracker.</p>
        <div class="account-actions">
          <button class="btn positive" type="button" data-nav="home">Back to Sign In</button>
          <button class="btn secondary" type="button" data-nav="tutorial">Quick Tutorial</button>
        </div>
      </div>
    </section>
  `, { hideNav: !state.authUser });
}

function renderTutorial() {
  const tutorialCta = state.authUser
    ? `<button class="btn neutral" type="button" data-nav="start">Track New Game</button>`
    : `<button class="btn neutral" type="button" data-action="focus-auth">Sign In / Create Account</button>`;
  return renderShell(`
    <section class="screen-title">
      <h2>Quick Tutorial</h2>
      <p>A fast guide to tracking a game, saving data, and sharing live stats.</p>
    </section>

    <section class="stack tutorial-list">
      <div class="card pad">
        <h3>1. Set Up The Player</h3>
        <p class="muted small">Open Player to review the selected player. Use Team to sync team data, request access, and verify roster access by jersey number.</p>
      </div>

      <div class="card pad">
        <h3>2. Sign In For Cloud Sync</h3>
        <p class="muted small">Use a User Profile when you want games backed up online. Personal players stay separate, while team roster players can be shared with parents who join the same team.</p>
      </div>

      <div class="card pad">
        <h3>3. Create Or Join A Team</h3>
        <p class="muted small">Use a team access code from the team admin to request access. After approval, verify your player by jersey number.</p>
      </div>

      <div class="card pad">
        <h3>4. Pick One Parent Tracker</h3>
        <p class="muted small">For the cleanest stats, pick one official Parent Tracker for each player/game. Other family members can watch using Live Share from another iPhone, phone, tablet, or computer.</p>
      </div>

      <div class="card pad">
        <h3>5. Track A Game</h3>
        <p class="muted small">Tap Track New Game, double-check the player selector, enter the opponent, and choose Quarters or Halves. In Live Game, use the subtle period buttons so each event lands in the right part of the game.</p>
      </div>

      <div class="card pad">
        <h3>6. Track Fast</h3>
        <p class="muted small">Live stats are grouped by game flow: Offense, Possession / IQ, Defense / Clears, and Specialty. The most common field events stay higher on the page, while faceoff, goalie, and note buttons sit lower.</p>
      </div>

      <div class="card pad">
        <h3>7. Save, Undo, And Share</h3>
        <p class="muted small">Undo removes the last event. Save keeps the game locally and syncs it when you are signed in. Live Share is a small link beside the game date so family can watch from another iPhone, phone, tablet, or computer. The link automatically copies to the clipboard, so just paste it into a text or email.</p>
      </div>

      <div class="card pad">
        <h3>8. Review, Correct, And Tag</h3>
        <p class="muted small">After a game, open Game Review to edit events, correct notes, add tags, and check totals like Impact Score, Effort Score, Faceoff %, Save %, and shooting percentages. Season Dashboard and Past Games follow the active player, so switch players when you want another player's totals.</p>
      </div>

      <div class="card pad">
        <h3>9. Watch A Shared Game</h3>
        <p class="muted small">On Home, expand Watch Shared Game, enter the share code or open a shared link, and follow the read-only live timeline from another device.</p>
      </div>

      <div class="action-grid">
        <button class="btn positive" type="button" data-nav="home">Go to Home</button>
        ${tutorialCta}
      </div>
    </section>
  `, { hideNav: !state.authUser });
}

function render() {
  const publicScreens = ["home", "tutorial", "help", "shared", "authSuccess", "requestSubmitted"];
  const signupProfileAllowed = state.screen === "profileSetup" && state.signupDraft;
  if (!state.authUser && state.screen === "profileSetup" && !state.signupDraft) {
    state.screen = "home";
  }
  if (!state.authUser && !publicScreens.includes(state.screen) && !signupProfileAllowed) {
    state.screen = "home";
  }
  if (state.authUser && needsParentProfileSetup() && !["profileSetup", "shared", "help", "tutorial", "authSuccess", "requestSubmitted"].includes(state.screen)) {
    state.screen = "profileSetup";
  }
  const screens = {
    home: renderHome,
    authSuccess: renderAuthSuccess,
    requestSubmitted: renderRequestSubmitted,
    profileSetup: renderProfileSetup,
    more: renderMore,
    player: renderPlayerPage,
    team: renderTeamPage,
    teamAccess: renderTeamAccess,
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
    if (isTeamPlayer(state.player) && !canEditTeam(state.player.teamId)) {
      showToast("View-only team roster");
      return;
    }
    updatePlayerInRoster({
      id: state.activePlayerId,
      name: formData.get("name")?.trim() || DEFAULT_PLAYER.name,
      number: formData.get("number")?.trim() || "",
      team: formData.get("team")?.trim() || "",
      position: formData.get("position")?.trim() || "",
      notes: formData.get("notes")?.trim() || "",
    });
    persistAll();
    navigate("home");
    showToast("Player settings saved");
  }

  if (form.dataset.form === "auth") {
    handleAuthSubmit(formData);
  }

  if (form.dataset.form === "profile-onboarding") {
    if (!state.authUser && state.signupDraft) {
      submitSignupAccessRequest(formData);
    } else {
      saveParentProfile(formData);
    }
  }

  if (form.dataset.form === "create-team") {
    createTeam(formData);
  }

  if (form.dataset.form === "join-team") {
    joinTeam(formData);
  }

  if (form.dataset.form === "add-roster-player") {
    addRosterPlayer(formData);
  }

  if (form.dataset.form === "roster-player-edit") {
    saveRosterPlayer(formData);
  }

  if (form.dataset.form === "claim-roster-player") {
    claimRosterPlayer(formData);
  }

  if (form.dataset.form === "start-game") {
    if (isTeamPlayer(state.player) && !canTrackPlayer(state.player)) {
      showToast("Verify your child before tracking");
      return;
    }
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
    if (!canEditGame(game)) {
      showToast("View-only team access");
      return;
    }
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

  if (form.dataset.form === "game-edit") {
    const game = state.games.find((item) => item.id === form.dataset.gameId);
    if (!game) return;
    if (!canEditGame(game)) {
      showToast("View-only team access");
      return;
    }
    const selectedPlayer = state.players.find((player) => player.id === formData.get("playerId")) || gamePlayerSnapshot(game);
    const nextPeriodFormat = PERIOD_FORMATS[formData.get("periodFormat")] ? formData.get("periodFormat") : periodFormatForGame(game);
    const nextPeriods = PERIOD_FORMATS[nextPeriodFormat].periods;
    const updatedGame = normalizeGame(
      {
        ...game,
        opponent: formData.get("opponent")?.trim() || "Opponent",
        date: formData.get("date") || game.date || todayISO(),
        location: formData.get("location")?.trim() || "",
        gameType: formData.get("gameType") || game.gameType || "Regular season",
        periodFormat: nextPeriodFormat,
        currentQuarter: nextPeriods.includes(game.currentQuarter) ? game.currentQuarter : nextPeriods[0],
        playerId: selectedPlayer.id,
        playerSnapshot: { ...selectedPlayer },
        savedAt: new Date().toISOString(),
      },
      selectedPlayer,
    );
    state.editingGameDetails = false;
    state.activePlayerId = selectedPlayer.id;
    syncActivePlayer();
    state.reviewGameId = updatedGame.id;
    saveReviewedGame(updatedGame, "Game details saved");
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
  const playerGo = event.target.closest("[data-player-go]");
  if (playerGo) {
    const playerId = playerGo.dataset.playerGo;
    const targetScreen = playerGo.dataset.targetScreen || "home";
    if (state.players.some((player) => player.id === playerId)) {
      state.activePlayerId = playerId;
      syncActivePlayer();
      if (state.player.teamId) state.activeTeamId = state.player.teamId;
      persistAll();
      navigate(targetScreen);
    }
    return;
  }

  const nav = event.target.closest("[data-nav]");
  if (nav) {
    navigate(nav.dataset.nav);
    return;
  }

  const playerSelect = event.target.closest("[data-player-select]");
  if (playerSelect) {
    setActivePlayer(playerSelect.dataset.playerSelect, "Player selected");
    return;
  }

  const teamSelect = event.target.closest("[data-team-select]");
  if (teamSelect) {
    state.activeTeamId = teamSelect.dataset.teamSelect;
    const rosterForTeam = activeTeamRoster();
    if (rosterForTeam.length && !rosterForTeam.some((player) => player.id === state.activePlayerId)) {
      state.activePlayerId = rosterForTeam[0].id;
      syncActivePlayer();
    }
    persistAll();
    render();
    showToast("Team selected");
    return;
  }

  const adminViewModeButton = event.target.closest("[data-admin-view-mode]");
  if (adminViewModeButton) {
    setAdminViewMode(adminViewModeButton.dataset.adminViewMode);
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
    if (action.dataset.action === "edit-game-details") {
      const game = currentReviewGame();
      if (game && !canEditGame(game)) {
        showToast("View-only team access");
        return;
      }
      state.editingGameDetails = true;
      state.editingEventId = null;
      state.tagEditingEventId = null;
      render();
      document.querySelector(".edit-game-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (action.dataset.action === "cancel-edit-game") {
      state.editingGameDetails = false;
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
    if (action.dataset.action === "focus-auth") {
      if (state.screen !== "home") {
        navigate("home");
        return;
      }
      document.querySelector(".account-card input")?.focus();
      document.querySelector(".account-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    if (action.dataset.action === "sign-out") signOut();
    if (action.dataset.action === "refresh-profile") loadUserProfile();
    if (action.dataset.action === "request-admin") requestUserRole("admin");
    if (action.dataset.action === "refresh-admin-requests") loadAdminRequests();
    if (action.dataset.action === "sync-cloud-games") loadCloudGames();
    if (action.dataset.action === "check-app-update") checkForAppUpdate({ manual: true });
    if (action.dataset.action === "sync-team-roster") loadCloudTeams();
    if (action.dataset.action === "add-player") addPlayer();
    if (action.dataset.action === "delete-player") deleteActivePlayer();
    if (action.dataset.action === "remove-roster-player") removeRosterPlayer();
    if (action.dataset.action === "remove-claimed-player") removeClaimedRosterPlayer();
    if (action.dataset.action === "delete-team") deleteActiveTeam();
    if (action.dataset.action === "toggle-watch-share") {
      state.watchShareExpanded = !state.watchShareExpanded;
      render();
    }
    if (action.dataset.action === "toggle-team-roster") {
      state.teamRosterExpanded = !state.teamRosterExpanded;
      render();
    }
    if (action.dataset.action === "toggle-team-access") {
      state.teamAccessExpanded = !state.teamAccessExpanded;
      render();
    }
    if (action.dataset.action === "toggle-export-tools") {
      state.exportToolsExpanded = !state.exportToolsExpanded;
      render();
    }
    if (action.dataset.action === "toggle-help-card") {
      state.helpExpanded = !state.helpExpanded;
      render();
    }
    if (action.dataset.action === "apply-update") {
      applyAppUpdate();
    }
    if (action.dataset.action === "dismiss-update") {
      state.updateAvailable = false;
      render();
    }
    return;
  }

  const reviewAdmin = event.target.closest("[data-review-admin]");
  if (reviewAdmin) {
    reviewAdminRequest(reviewAdmin.dataset.reviewAdmin, reviewAdmin.dataset.approved === "true");
    return;
  }

  const reviewTeamAccess = event.target.closest("[data-review-team-access]");
  if (reviewTeamAccess) {
    reviewTeamAccessRequest(reviewTeamAccess.dataset.reviewTeamAccess, reviewTeamAccess.dataset.approved === "true");
    return;
  }

  const editEvent = event.target.closest("[data-edit-event]");
  if (editEvent) {
    const game = currentReviewGame();
    if (game && !canEditGame(game)) {
      showToast("View-only team access");
      return;
    }
    state.editingEventId = editEvent.dataset.editEvent;
    state.tagEditingEventId = null;
    state.tagDraftTags = [];
    render();
    document.querySelector(".edit-event-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const editTags = event.target.closest("[data-edit-tags]");
  if (editTags) {
    const game = currentReviewGame();
    if (game && !canEditGame(game)) {
      showToast("View-only team access");
      return;
    }
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
    navigator.serviceWorker
      .register("service-worker.js")
      .then((registration) => {
        serviceWorkerRegistration = registration;
        watchServiceWorkerUpdates(registration);
        registration.update().catch(() => {});
        checkForAppUpdate().catch(() => {});
        window.setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
      })
      .catch(() => {
        console.info("Service worker registration failed.");
      });
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadingForUpdate) return;
    reloadingForUpdate = true;
    window.location.reload();
  });
}

function watchServiceWorkerUpdates(registration) {
  if (registration.waiting && navigator.serviceWorker.controller) {
    showUpdateAvailable(registration.waiting);
  }

  registration.addEventListener("updatefound", () => {
    const worker = registration.installing;
    if (!worker) return;
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        showUpdateAvailable(worker);
      }
    });
  });
}

function showUpdateAvailable(worker) {
  waitingServiceWorker = worker;
  state.updateAvailable = true;
  state.updateInstalling = false;
  render();
}

async function fetchServerAppVersion() {
  const response = await fetch(`version.json?ts=${Date.now()}`, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache" },
  });
  if (!response.ok) throw new Error("Version check failed");
  const data = await response.json();
  return String(data.version || "").trim();
}

async function checkForAppUpdate(options = {}) {
  if (!("serviceWorker" in navigator)) {
    showToast("Updates load when the app opens");
    return;
  }
  try {
    const registration = serviceWorkerRegistration || (await navigator.serviceWorker.getRegistration());
    if (registration) {
      serviceWorkerRegistration = registration;
      await registration.update();
      if (registration.waiting && navigator.serviceWorker.controller) {
        showUpdateAvailable(registration.waiting);
        if (options.manual) showToast("Update ready");
        return;
      }
    }

    const serverVersion = await fetchServerAppVersion();
    if (serverVersion && serverVersion !== APP_VERSION) {
      state.updateAvailable = true;
      state.updateInstalling = false;
      render();
      if (options.manual) showToast(`Update found: ${serverVersion}`);
      return;
    }

    if (options.manual) showToast("LaxHornet is up to date");
  } catch {
    if (options.manual) showToast("Could not check for updates");
  }
}

function applyAppUpdate() {
  if (!waitingServiceWorker) {
    window.location.reload();
    return;
  }
  state.updateAvailable = true;
  state.updateInstalling = true;
  render();
  waitingServiceWorker.postMessage({ type: "SKIP_WAITING" });
}

async function initApp() {
  if (supabaseClient) {
    const { data } = await supabaseClient.auth.getSession();
    setAuthUser(data.session?.user || null);
    state.syncStatus = state.authUser ? "Signed in" : "Sign in for cloud sync";
    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
      setAuthUser(session?.user || null);
      state.syncStatus = state.authUser ? "Signed in" : "Signed out";
      if (state.authUser) {
        await loadUserProfile({ silent: true });
        await loadCloudGames({ silent: true });
      }
      render();
    });
    if (state.authUser) {
      await loadUserProfile({ silent: true });
      await loadCloudGames({ silent: true });
    }
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
