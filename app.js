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
const APP_VERSION = "v187";

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
  { key: "assist", label: "Assist", points: 3, tone: "offense", category: "Offense" },
  { key: "shot", label: "Missed Shot", points: -0.5, tone: "neutral", category: "Offense" },
  { key: "shotOnGoal", label: "Shot on Goal", points: 1, tone: "offense", category: "Offense" },
  { key: "goalieSave", label: "Save", points: 3, tone: "goalieSave", category: "Goalie" },
  { key: "goalAllowed", label: "Goal Allowed", points: -1, tone: "goalieAllowed", category: "Goalie" },
  { key: "faceoffWin", label: "Faceoff Win", points: 2, tone: "faceoffWin", category: "Faceoff" },
  { key: "faceoffLoss", label: "Faceoff Loss", points: -1, tone: "faceoffLoss", category: "Faceoff" },
  { key: "groundBall", label: "Ground Ball", points: 2, tone: "effort", category: "Effort / IQ" },
  { key: "turnover", label: "Turnover", points: -2, tone: "negative", category: "Possession" },
  { key: "causedTurnover", label: "Caused Turnover", points: 3, tone: "defense", category: "Defense" },
  { key: "defensiveStop", label: "Defensive Stop", points: 3, tone: "defense", category: "Defense" },
  { key: "successfulClear", label: "Successful Clear", points: 1, tone: "clear", category: "Clearing" },
  { key: "failedClear", label: "Failed Clear", points: -2, tone: "negative", category: "Clearing" },
  { key: "hustlePlay", label: "Hustle Play", points: 1, tone: "effort", category: "Effort / IQ" },
  { key: "backedUpShot", label: "Backed Up Shot", points: 2, tone: "effort", category: "Effort / IQ" },
  { key: "smartPlay", label: "Smart Play", points: 1, tone: "effort", category: "Effort / IQ" },
  { key: "penalty", label: "Penalty", points: -2, tone: "negative", category: "Discipline" },
  { key: "note", label: "Note", points: 0, tone: "neutral", category: "Note" },
];

const STAT_BY_KEY = Object.fromEntries(STAT_DEFS.map((stat) => [stat.key, stat]));

const IMPACT_PILLARS = [
  { key: "scoring", label: "Scoring" },
  { key: "possession", label: "Possession" },
  { key: "defense", label: "Defense" },
  { key: "goalie", label: "Goalie" },
  { key: "effort", label: "Effort / Hustle" },
];

const IMPACT_RULES = {
  goal: { pillar: "scoring", value: 5 },
  assist: { pillar: "scoring", value: 3 },
  shotOnGoal: { pillar: "scoring", value: 1 },
  shot: { pillar: "scoring", value: -0.5 },
  groundBall: { pillar: "possession", value: 2 },
  faceoffWin: { pillar: "possession", value: 2 },
  faceoffLoss: { pillar: "possession", value: -1 },
  successfulClear: { pillar: "possession", value: 1 },
  failedClear: { pillar: "possession", value: -2 },
  turnover: { pillar: "possession", value: -2 },
  causedTurnover: { pillar: "defense", value: 3 },
  defensiveStop: { pillar: "defense", value: 3 },
  penalty: { pillar: "defense", value: -2 },
  goalieSave: { pillar: "goalie", value: 3 },
  goalAllowed: { pillar: "goalie", value: -1 },
  backedUpShot: { pillar: "effort", value: 2 },
  hustlePlay: { pillar: "effort", value: 1 },
  smartPlay: { pillar: "effort", value: 1 },
};

const IMPACT_POSITION_WEIGHTS = {
  attack: {
    label: "Attack",
    scoring: 1.35,
    possession: 1,
    defense: 0.65,
    goalie: 0,
    effort: 1,
  },
  midfield: {
    label: "Midfield",
    scoring: 1,
    possession: 1.3,
    defense: 1,
    goalie: 0,
    effort: 1.3,
  },
  defense: {
    label: "Defense / LSM",
    scoring: 0.65,
    possession: 1,
    defense: 1.35,
    goalie: 0,
    effort: 1.3,
  },
  faceoff: {
    label: "Faceoff / Draw",
    scoring: 0.65,
    possession: 1.65,
    defense: 1,
    goalie: 0,
    effort: 1,
  },
  goalie: {
    label: "Goalie",
    scoring: 0,
    possession: 1,
    defense: 0.65,
    goalie: 1.75,
    effort: 1,
  },
};

const POSSESSION_IMPACT_RULES = {
  faceoffWin: { extra: 1, value: 1.0, label: "Faceoff / draw win" },
  groundBall: { extra: 1, value: 1.2, label: "Ground ball won" },
  causedTurnover: { extra: 1, value: 1.8, label: "Caused turnover" },
  goalieSave: { extra: 1, value: 2.5, label: "Save retained" },
  successfulClear: { extra: 0.5, value: 0.8, label: "Successful clear" },
  backedUpShot: { extra: 1, value: 1.5, label: "Backed up shot" },
  turnover: { extra: -1, value: -1.5, label: "Turnover" },
  failedClear: { extra: -1, value: -2.0, label: "Failed clear" },
  penalty: { extra: 0, value: -1.5, label: "Penalty" },
};

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
let deferredInstallPrompt = null;
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
  syncStatus: supabaseClient ? "Ready" : "Account features unavailable",
  cloudError: "",
  addingReviewEvent: false,
  editingEventId: null,
  editingGameDetails: false,
  tagEditingEventId: null,
  tagDraftTags: [],
  deletedGameIds: initialStoredState.deletedGameIds,
  deletedEventIds: initialStoredState.deletedEventIds,
  watchShareExpanded: false,
  teamRosterExpanded: true,
  teamEditPlayerExpanded: false,
  teamAddPlayerExpanded: false,
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
  installInstructionsVisible: false,
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
  const cloudBacked = team.cloudBacked ?? team.cloud_backed;
  const localRecovered = team.localRecovered ?? team.local_recovered;
  return {
    id,
    name: String(team.name || "").trim() || "Team",
    inviteCode: String(team.inviteCode || team.invite_code || "").trim().toUpperCase(),
    trackerCode: String(team.trackerCode || team.tracker_code || "").trim().toUpperCase(),
    role: normalizeTeamRole(team.role || "tracker"),
    createdBy: team.createdBy || team.created_by || "",
    createdAt: team.createdAt || team.created_at || new Date().toISOString(),
    cloudBacked: Boolean(cloudBacked),
    localRecovered: Boolean(localRecovered),
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
        cloudBacked: Boolean(existing?.cloudBacked || normalized.cloudBacked),
        localRecovered: Boolean(!existing?.cloudBacked && !normalized.cloudBacked && (existing?.localRecovered || normalized.localRecovered)),
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

function cloudRosterModeEnabled() {
  return Boolean(supabaseClient && state.authUser);
}

function pruneLocalOnlyCloudState() {
  if (!cloudRosterModeEnabled()) return;
  const cloudTeams = normalizeTeams(state.teams.filter((team) => normalizeTeam(team).cloudBacked));
  const cloudTeamIds = new Set(cloudTeams.map((team) => team.id));
  state.teams = cloudTeams;
  state.rosterPlayers = normalizeRosterPlayers(
    state.rosterPlayers.filter((player) => cloudTeamIds.has(normalizeRosterPlayer(player).teamId)),
  );
  if (state.activeTeamId && !cloudTeamIds.has(state.activeTeamId)) {
    state.activeTeamId = state.teams[0]?.id || "";
  }
}

function locallyManagedAdminTeams() {
  if (!isPlatformReviewer() || cloudRosterModeEnabled()) return [];
  const existingTeams = state.teams.filter((team) => {
    const normalized = normalizeTeam(team);
    return normalized.id && (normalized.role === "admin" || normalized.createdBy === currentUserId());
  }).map((team) => ({ ...team, cloudBacked: false, localRecovered: true }));
  const playerTeams = [state.player, ...state.players].map((player) => {
    const normalized = normalizePlayer(player);
    if (!normalized.teamId) return null;
    return normalizeTeam({
      id: normalized.teamId,
      name: normalized.team || "Team",
      role: "admin",
      createdBy: currentUserId(),
      cloudBacked: false,
      localRecovered: true,
    });
  }).filter(Boolean);
  const gameTeams = [state.activeGame, ...state.games].map((game) => {
    if (!game) return null;
    const snapshot = gamePlayerSnapshot(game);
    const teamId = gameTeamId(game) || snapshot.teamId;
    const teamName = snapshot.team || "";
    if (!teamId) return null;
    return normalizeTeam({
      id: teamId,
      name: teamName || "Team",
      role: "admin",
      createdBy: currentUserId(),
      cloudBacked: false,
      localRecovered: true,
    });
  }).filter(Boolean);
  return normalizeTeams([...existingTeams, ...playerTeams, ...gameTeams]);
}

function recoverAdminTeamContext() {
  const recoveredTeams = locallyManagedAdminTeams();
  if (!recoveredTeams.length) return;
  state.teams = normalizeTeams([...state.teams, ...recoveredTeams]);
  const activePlayer = normalizePlayer(state.player);
  if ((!state.activeTeamId || !state.teams.some((team) => team.id === state.activeTeamId)) && activePlayer.teamId) {
    state.activeTeamId = activePlayer.teamId;
  }
  if (!state.activeTeamId || !state.teams.some((team) => team.id === state.activeTeamId)) {
    state.activeTeamId = state.teams[0]?.id || "";
  }
}

function teamRoleLabel(role) {
  const cleanRole = normalizeTeamRole(role);
  if (cleanRole === "admin") return "Admin";
  return "Parent Tracker";
}

function canEditTeam(teamId) {
  return isPlatformReviewer() && isCloudBackedTeam(teamId) && TEAM_MANAGE_ROLES.includes(teamRole(teamId));
}

function canManageRoster(teamId) {
  return isPlatformReviewer() && isCloudBackedTeam(teamId) && teamRole(teamId) === "admin";
}

function canDeleteTeam(teamId) {
  const team = teamById(teamId);
  return isPlatformReviewer() && Boolean(team) && (teamRole(teamId) === "admin" || team.createdBy === currentUserId());
}

function isCloudBackedTeam(teamId) {
  return Boolean(teamById(teamId)?.cloudBacked);
}

function hasPlayerClaim(teamId, rosterPlayerId) {
  if (!teamId || !rosterPlayerId) return false;
  return state.playerClaims.some((claim) => claim.teamId === teamId && claim.rosterPlayerId === rosterPlayerId);
}

function canTrackRosterPlayer(teamId, rosterPlayerId) {
  const role = teamRole(teamId);
  if (!teamId) return true;
  if (isPlatformReviewer()) return true;
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
  const rosterPlayers = visibleRosterPlayers().map(rosterPlayerToPlayer);
  if (cloudRosterModeEnabled()) return dedupePlayers(rosterPlayers, state.activePlayerId).players;
  const localPlayers = state.players.filter((player) => !player.teamId);
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
  const rosterPlayers = visibleRosterPlayers().map(rosterPlayerToPlayer);
  if (cloudRosterModeEnabled()) {
    state.players = dedupePlayers(rosterPlayers, state.activePlayerId).players;
    if (state.activePlayerId && !state.players.some((player) => player.id === state.activePlayerId)) {
      state.activePlayerId = state.players[0]?.id || "";
    }
    if (state.activeTeamId && !state.teams.some((team) => team.id === state.activeTeamId)) {
      state.activeTeamId = state.teams[0]?.id || "";
    }
    return;
  }
  const localPlayers = state.players.filter((player) => !player.teamId);
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
    return ["team", normalized.teamId, normalized.rosterPlayerId || normalized.id]
      .map((value) => String(value || "").trim().toLowerCase())
      .join("|");
  }
  return [normalized.name, normalized.number, normalized.team, normalized.position]
    .map((value) => value.trim().toLowerCase())
    .join("|");
}

function mergePlayerDetails(base, next) {
  if (base.teamId || next.teamId) {
    return {
      ...base,
      ...next,
      id: base.id || next.id,
      name: next.name || base.name || DEFAULT_PLAYER.name,
      number: next.number || "",
      team: next.team || base.team || "",
      position: next.position || "",
      notes: next.notes || base.notes || "",
      teamId: next.teamId || base.teamId || "",
      rosterPlayerId: next.rosterPlayerId || base.rosterPlayerId || "",
      source: next.source || base.source || "teamRoster",
    };
  }
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
  if (!state.players.length) {
    if (cloudRosterModeEnabled()) {
      state.activePlayerId = "";
      state.player = normalizePlayer(DEFAULT_PLAYER, { createId: true });
      return;
    }
    state.players = [normalizePlayer(DEFAULT_PLAYER, { createId: true })];
  }
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

function playerTeamCode(player = state.player) {
  const normalized = normalizePlayer(player);
  return normalized.teamId ? teamById(normalized.teamId)?.inviteCode || "" : "";
}

function playerTeamCodeLabel(player = state.player) {
  const code = playerTeamCode(player);
  if (code) return `Team Code: ${code}`;
  const normalized = normalizePlayer(player);
  return normalized.team ? "Team Code: Not linked" : "";
}

function playerContextLine(player = state.player) {
  const normalized = normalizePlayer(player);
  const context = [normalized.team, playerTeamCodeLabel(normalized), normalized.position].filter(Boolean).join(" - ");
  return [playerTitle(normalized), context].filter(Boolean).join(" - ");
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
    showToast("Remove this player's saved games first");
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
  if (cloudRosterModeEnabled()) {
    mergeRosterPlayersIntoPlayers();
    syncActivePlayer();
    return;
  }
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
  if (isPlatformReviewer()) {
    mergeRosterPlayersIntoPlayers();
    ensureActiveTeamRosterPlayer();
    syncActivePlayer();
  } else {
    const firstVisible = visiblePlayers()[0];
    if (firstVisible) {
      state.activePlayerId = firstVisible.id;
      state.player = firstVisible;
    }
  }
  persistAll();
  render();
  showToast(state.adminViewMode === "tracker" ? "Tracker View on" : "Team Admin Tools on");
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

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function impactPositionGroup(player = {}) {
  const position = String(player.position || "").toLowerCase();
  if (position.includes("goalie") || position.includes("goal")) return "goalie";
  if (position.includes("face") || position.includes("fogo")) return "faceoff";
  if (position.includes("attack")) return "attack";
  if (position.includes("mid")) return "midfield";
  if (position.includes("defense") || position.includes("lsm") || position.includes("ssdm")) return "defense";
  return "midfield";
}

function impactWeightProfileForPlayer(player = {}) {
  const group = impactPositionGroup(player);
  return IMPACT_POSITION_WEIGHTS[group] || IMPACT_POSITION_WEIGHTS.midfield;
}

function emptyImpactPillars() {
  return Object.fromEntries(IMPACT_PILLARS.map((pillar) => [pillar.key, 0]));
}

function eventImpactRule(event = {}) {
  return IMPACT_RULES[event.statType] || null;
}

function impactValueForEvent(event = {}) {
  return Number(eventImpactRule(event)?.value || 0);
}

function impactPillarForEvent(event = {}) {
  return eventImpactRule(event)?.pillar || "";
}

function possessionRuleForEvent(event = {}) {
  return POSSESSION_IMPACT_RULES[event.statType] || null;
}

function calculatePossessionImpact(events = []) {
  const eventsByType = {};
  let extraPossessions = 0;
  let possessionValue = 0;
  let positiveEvents = 0;
  let negativeEvents = 0;

  events.forEach((event) => {
    const rule = possessionRuleForEvent(event);
    if (!rule) return;
    const extra = Number(rule.extra || 0);
    const value = Number(rule.value || 0);
    extraPossessions += extra;
    possessionValue += value;
    if (value > 0) positiveEvents += 1;
    if (value < 0) negativeEvents += 1;
    eventsByType[event.statType] = (eventsByType[event.statType] || 0) + 1;
  });

  return {
    extraPossessions,
    possessionValue,
    positiveEvents,
    negativeEvents,
    eventsByType,
    takeaway: possessionImpactTakeaway(extraPossessions, possessionValue, eventsByType),
  };
}

function possessionImpactTakeaway(extraPossessions, possessionValue, eventsByType = {}) {
  const formatValue = formatImpactNumber(possessionValue);
  const highVolume = extraPossessions >= 4;
  const highValue = possessionValue >= 5;
  const costly = possessionValue < 0;
  const protectedPossessions = (eventsByType.successfulClear || 0) + (eventsByType.backedUpShot || 0);
  const wonPossessions = (eventsByType.groundBall || 0) + (eventsByType.causedTurnover || 0) + (eventsByType.faceoffWin || 0) + (eventsByType.goalieSave || 0);
  const lostPossessions = (eventsByType.turnover || 0) + (eventsByType.failedClear || 0);

  if (!extraPossessions && !possessionValue) return "No possession-changing events were logged yet.";
  if (costly) return `Possession swings were costly: ${formatImpactNumber(extraPossessions)} extra possessions and ${formatValue} Possession Value, mainly from lost possessions or penalties.`;
  if (highVolume && highValue) return `High-volume, high-value possession game: ${formatImpactNumber(extraPossessions)} extra possessions created and +${formatValue} Possession Value.`;
  if (highVolume) return `High-volume possession winner: ${formatImpactNumber(extraPossessions)} extra possessions created, with +${formatValue} Possession Value.`;
  if (highValue) return `High-leverage possession impact: fewer swings, but they were worth +${formatValue} Possession Value.`;
  if (protectedPossessions > wonPossessions && protectedPossessions > lostPossessions) return `Best possession work came from protecting the ball: clears and backed-up shots helped preserve chances.`;
  return `Helpful possession impact: ${formatImpactNumber(extraPossessions)} extra possessions created for +${formatValue} Possession Value.`;
}

function weightedImpactPillars(pillars, weights) {
  return Object.fromEntries(
    IMPACT_PILLARS.map((pillar) => {
      const weight = Number(weights[pillar.key] ?? 1);
      return [pillar.key, Number(pillars[pillar.key] || 0) * weight];
    }),
  );
}

function distributeImpactScore(score, pillars, rawPillars = pillars, weights = {}) {
  const positiveEntries = IMPACT_PILLARS.map((pillar) => ({
    ...pillar,
    raw: Math.max(0, Number(rawPillars[pillar.key] || 0)),
    weighted: Math.max(0, Number(pillars[pillar.key] || 0)),
    weight: Number(weights[pillar.key] ?? 1),
  }));
  const positiveTotal = positiveEntries.reduce((sum, item) => sum + item.weighted, 0);
  if (!score || !positiveTotal) {
    return positiveEntries.map((item) => ({ ...item, score: 0 }));
  }

  const distributed = positiveEntries.map((item) => ({
    ...item,
    score: Math.round((score * item.weighted) / positiveTotal),
  }));
  const diff = score - distributed.reduce((sum, item) => sum + item.score, 0);
  if (diff) {
    const strongest = distributed.reduce((bestIndex, item, index, items) => (item.weighted > items[bestIndex].weighted ? index : bestIndex), 0);
    distributed[strongest].score += diff;
  }
  return distributed;
}

function calculateGameImpact(events = [], player = state.player) {
  const pillars = emptyImpactPillars();
  const weights = impactWeightProfileForPlayer(player);
  let raw = 0;
  let scorableEvents = 0;

  events.forEach((event) => {
    const rule = eventImpactRule(event);
    if (!rule) return;
    const value = Number(rule.value || 0);
    pillars[rule.pillar] += value;
    raw += value;
    scorableEvents += 1;
  });

  const weightedPillars = weightedImpactPillars(pillars, weights);
  const weightedRaw = Object.values(weightedPillars).reduce((sum, value) => sum + Number(value || 0), 0);
  const score = scorableEvents ? clampNumber(Math.round(50 + weightedRaw * 3), 0, 100) : 0;
  const breakdown = distributeImpactScore(score, weightedPillars, pillars, weights).map((item) => ({
    key: item.key,
    label: item.label,
    raw: Number(pillars[item.key] || 0),
    weighted: Number(weightedPillars[item.key] || 0),
    weight: item.weight,
    score: item.score,
  }));

  return {
    score,
    raw,
    weightedRaw,
    pillars,
    weightedPillars,
    positionGroup: impactPositionGroup(player),
    weightProfile: weights,
    breakdown,
    takeaway: impactTakeaway(events, breakdown, weights),
  };
}

function impactTakeaway(events = [], breakdown = [], weightProfile = IMPACT_POSITION_WEIGHTS.midfield) {
  const activeBreakdowns = breakdown.filter((item) => item.score > 0);
  if (!events.length) return "Log game events to build a Game Impact profile.";
  const count = (key) => events.filter((event) => event.statType === key).length;
  const goals = count("goal");
  const assists = count("assist");
  const shotsOnGoal = count("shotOnGoal");
  const missedShots = count("shot");
  const saves = count("goalieSave");
  const goalsAllowed = count("goalAllowed");
  const faceoffWins = count("faceoffWin");
  const faceoffLosses = count("faceoffLoss");
  const defensiveWins = count("causedTurnover") + count("defensiveStop");
  const clears = count("successfulClear");
  const failedClears = count("failedClear");
  const hustle = count("hustlePlay") + count("backedUpShot") + count("smartPlay");
  const extraPossessions =
    count("groundBall") +
    faceoffWins +
    count("causedTurnover") +
    count("backedUpShot") +
    clears;
  const mistakes = count("turnover") + failedClears + count("penalty") + goalsAllowed;
  const scoringChances = goals + shotsOnGoal + assists;
  const shotAttempts = goals + shotsOnGoal + missedShots;
  const efficiency = shotAttempts ? goals / shotAttempts : 0;
  const faceoffAttempts = faceoffWins + faceoffLosses;
  const saveLooksStrong = saves >= 5 && saves >= goalsAllowed;
  const lines = [];

  if (!activeBreakdowns.length) {
    return `Impact was limited in the logged events. The profile shows ${mistakes} negative event${mistakes === 1 ? "" : "s"} and no positive pillar contribution yet, graded with the ${weightProfile.label || "player"} position profile.`;
  }

  const biggest = activeBreakdowns.reduce((best, item) => (item.score > best.score ? item : best), activeBreakdowns[0]);

  if (biggest.key === "scoring" && scoringChances) {
    lines.push(
      efficiency >= 0.4
        ? `Scoring drove the impact: ${goals} goal${goals === 1 ? "" : "s"}, ${assists} assist${assists === 1 ? "" : "s"}, and efficient shot selection.`
        : `Scoring volume was the main driver, but ${missedShots} missed shot${missedShots === 1 ? "" : "s"} kept the score from climbing higher.`,
    );
  } else if (biggest.key === "possession") {
    lines.push(`Possession work led the profile: ${extraPossessions} extra-possession play${extraPossessions === 1 ? "" : "s"} helped keep the ball with the team.`);
  } else if (biggest.key === "defense") {
    lines.push(`Defensive pressure stood out: ${defensiveWins} stop or caused-turnover event${defensiveWins === 1 ? "" : "s"} reduced opponent chances.`);
  } else if (biggest.key === "goalie") {
    lines.push(
      saveLooksStrong
        ? `Goalie impact was strong: ${saves} save${saves === 1 ? "" : "s"} stabilized the game without over-penalizing goals allowed.`
        : `Goalie impact was mixed, with ${saves} save${saves === 1 ? "" : "s"} and ${goalsAllowed} goal${goalsAllowed === 1 ? "" : "s"} allowed.`,
    );
  } else {
    lines.push(`Effort and IQ showed up most: ${hustle} hustle, backed-up-shot, or smart-play event${hustle === 1 ? "" : "s"} added value beyond the box score.`);
  }

  if (faceoffAttempts) {
    lines.push(`At the stripe, the player went ${faceoffWins}-${faceoffAttempts}, which ${faceoffWins > faceoffLosses ? "created possession leverage" : "limited possession impact"}.`);
  } else if (extraPossessions) {
    lines.push(`The player created ${extraPossessions} possession swing${extraPossessions === 1 ? "" : "s"} through ground balls, clears, backed-up shots, or defensive pressure.`);
  }

  if (mistakes) {
    lines.push(`${mistakes} negative event${mistakes === 1 ? "" : "s"} pulled the score down, so cleaner possessions would raise impact quickly.`);
  } else {
    lines.push("No major negative events were logged, which protected the overall impact score.");
  }

  lines.push(`This was graded with the ${weightProfile.label || "player"} position profile, so ${biggest.label.toLowerCase()} events count in context for that role.`);

  return lines.join(" ");
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
  recoverAdminTeamContext();
  pruneLocalOnlyCloudState();
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

function isStandaloneApp() {
  return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
}

function isIOSDevice() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent || "");
}

function installHelpText() {
  if (isStandaloneApp()) return "LaxHornet is already saved to this device.";
  if (isIOSDevice()) return "On iPhone, open this page in Safari, tap Share, then Add to Home Screen.";
  if (deferredInstallPrompt) return "Install LaxHornet so it opens like an app from your home screen.";
  return "Use your browser menu to install LaxHornet or add it to your home screen.";
}

function renderInstallCard(options = {}) {
  const compact = options.compact === true;
  const expanded = state.installInstructionsVisible || isStandaloneApp();
  return `
    <div class="install-card ${compact ? "compact-install" : ""}">
      <div>
        <strong>${isStandaloneApp() ? "Saved to Home Screen" : "Save to Home Screen"}</strong>
        <p class="muted small">${escapeHTML(installHelpText())}</p>
      </div>
      <button class="mini-btn light" type="button" data-action="install-app">${isStandaloneApp() ? "Done" : "Save"}</button>
      ${
        expanded
          ? `<div class="install-steps">
              <span>1. Open in Safari on iPhone.</span>
              <span>2. Tap the Share button.</span>
              <span>3. Choose Add to Home Screen.</span>
            </div>`
          : ""
      }
    </div>
  `;
}

function navigate(screen) {
  if (screen === "settings") screen = "player";
  if (screen === "teamAccess") screen = "team";
  state.screen = screen;
  recoverAdminTeamContext();
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

function calculateTotals(events = [], player = state.player) {
  const count = (key) => events.filter((event) => event.statType === key).length;
  const goals = count("goal");
  const assists = count("assist");
  const shotOnly = count("shot");
  const shotsOnGoal = count("shotOnGoal");
  const shots = shotOnly + shotsOnGoal;
  const successfulClears = count("successfulClear");
  const failedClears = count("failedClear");
  const gameImpact = calculateGameImpact(events, player);
  const possessionImpact = calculatePossessionImpact(events);
  const impact = gameImpact.score;
  const rawImpact = gameImpact.raw;
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
    rawImpact,
    gameImpact,
    possessionImpact,
    extraPossessions: possessionImpact.extraPossessions,
    possessionValue: possessionImpact.possessionValue,
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
      const gameTotals = calculateTotals(game.events, gamePlayerSnapshot(game));
      Object.keys(acc).forEach((key) => {
        if (key !== "gamesPlayed") acc[key] += gameTotals[key] || 0;
      });
      return acc;
    },
    {
      gamesPlayed: games.length,
      impact: 0,
      rawImpact: 0,
      extraPossessions: 0,
      possessionValue: 0,
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
  totals.averageRawImpact = totals.gamesPlayed ? totals.rawImpact / totals.gamesPlayed : 0;
  totals.averagePossessionValue = totals.gamesPlayed ? totals.possessionValue / totals.gamesPlayed : 0;
  return totals;
}

function pct(value) {
  return `${Math.round(value * 100)}%`;
}

function formatImpactNumber(value) {
  const number = Number(value || 0);
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

function impactLetterGrade(value) {
  const score = Number(value || 0);
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 77) return "C+";
  if (score >= 73) return "C";
  if (score >= 70) return "C-";
  if (score >= 67) return "D+";
  if (score >= 63) return "D";
  if (score >= 60) return "D-";
  return "F";
}

function renderImpactGrade(value, options = {}) {
  const score = formatImpactNumber(value);
  const label = options.label || "score";
  return `
    <span class="impact-grade">
      <strong>${escapeHTML(impactLetterGrade(value))}</strong>
      <small>${escapeHTML(score)} ${escapeHTML(label)}</small>
    </span>
  `;
}

function signedMetric(value) {
  const formatted = formatImpactNumber(value);
  return Number(value || 0) > 0 ? `+${formatted}` : formatted;
}

function statWithExtraPossessions(value, extraPossessions) {
  const extra = Number(extraPossessions || 0);
  if (!extra) return value;
  return `${value} (${signedMetric(extra)} EP)`;
}

/**
 * @typedef {Object} PlayerStats
 * @property {number} [gamesPlayed]
 * @property {number} goals
 * @property {number} assists
 * @property {number} shots
 * @property {number} shotsOnGoal
 * @property {number} shootingPct
 * @property {number} groundBalls
 * @property {number} faceoffWins
 * @property {number} extraPossessions
 * @property {number} clears
 * @property {number} turnovers
 * @property {number} causedTurnovers
 * @property {number} defensiveStops
 * @property {number} saves
 * @property {number} goalsAllowed
 * @property {number} savePct
 * @property {number} failedClears
 * @property {number} penalties
 * @property {number} hustlePlays
 * @property {number} backedUpShots
 * @property {number} smartPlays
 */

/**
 * @typedef {Object} DimensionScores
 * @property {number} scoring
 * @property {number} playmaking
 * @property {number} possession
 * @property {number} defense
 * @property {number} goalie
 * @property {number} hustle
 * @property {number} mistakeCost
 */

/**
 * @typedef {Object} ArchetypeResult
 * @property {string} name
 * @property {string} explanation
 * @property {string} nextFocus
 * @property {Array<string>} reasons
 * @property {DimensionScores} scores
 */

const ARCHETYPE_SCORE_CAPS = {
  scoring: 18,
  playmaking: 10,
  possession: 24,
  defense: 12,
  goalie: 18,
  hustle: 18,
  mistakeCost: 12,
};

const ARCHETYPE_DEFS = {
  finisher: {
    name: "Finisher",
    explanation: "You made your biggest impact by finishing scoring chances.",
    nextFocus: "Add assists or ground balls to become a more complete offensive threat.",
  },
  setupArtist: {
    name: "Setup Artist",
    explanation: "You created offense for teammates and helped the ball find the right player.",
    nextFocus: "Look for moments to become a scoring threat too.",
  },
  possessionEngine: {
    name: "Possession Engine",
    explanation: "You helped your team get more chances by winning possessions and protecting the ball.",
    nextFocus: "Turn more possession wins into transition chances.",
  },
  groundBallMagnet: {
    name: "Ground Ball Magnet",
    explanation: "You changed possessions by winning loose balls.",
    nextFocus: "Turn more ground balls into clean clears or scoring chances.",
  },
  defensiveDisruptor: {
    name: "Defensive Disruptor",
    explanation: "You created problems for the other team and turned defense into possession.",
    nextFocus: "Stay aggressive without taking penalties.",
  },
  twoWayForce: {
    name: "Two-Way Force",
    explanation: "You impacted both ends of the field and contributed in multiple ways.",
    nextFocus: "Keep balancing offense, defense, and possession work.",
  },
  sparkPlug: {
    name: "Spark Plug",
    explanation: "You brought energy across the field and helped in several ways.",
    nextFocus: "Channel that energy into controlled possessions and smart decisions.",
  },
  gluePlayer: {
    name: "Glue Player",
    explanation: "You helped connect the team by making steady plays in multiple areas.",
    nextFocus: "Find one area to become dominant while keeping your balanced impact.",
  },
  theWall: {
    name: "The Wall",
    explanation: "You kept the team in the game with strong saves.",
    nextFocus: "Improve outlet speed after saves to create transition chances.",
  },
  outletStarter: {
    name: "Outlet Starter",
    explanation: "You helped turn defensive stops into clean possessions.",
    nextFocus: "Look for safe fast-break outlets after stops.",
  },
  growthProfile: {
    name: "Growth Profile",
    explanation: "You logged trackable moments that give a clear starting point for the next game.",
    nextFocus: "Pick one stat to chase next game, then build from there.",
  },
};

const ARCHETYPE_DIMENSION_LABELS = {
  scoring: "Scoring",
  playmaking: "Playmaking",
  possession: "Possession",
  defense: "Defense",
  goalie: "Goalie",
  hustle: "Hustle",
  mistakeCost: "Mistake cost",
};

function statRate(playerStats, key) {
  const games = Math.max(1, Number(playerStats.gamesPlayed || 1));
  return Number(playerStats[key] || 0) / games;
}

function shootingPctBonus(playerStats) {
  const shots = statRate(playerStats, "shots");
  const pctValue = Number(playerStats.shootingPct || 0);
  if (shots < 2) return 0;
  if (pctValue >= 0.5) return 8;
  if (pctValue >= 0.35) return 5;
  if (pctValue >= 0.25) return 3;
  return 0;
}

function savePctBonus(playerStats) {
  const chances = statRate(playerStats, "saves") + statRate(playerStats, "goalsAllowed");
  const pctValue = Number(playerStats.savePct || 0);
  if (chances < 3) return 0;
  if (pctValue >= 0.7) return 8;
  if (pctValue >= 0.6) return 5;
  if (pctValue >= 0.5) return 3;
  return 0;
}

function activeArchetypeCategoryCount(playerStats) {
  const categories = [
    statRate(playerStats, "goals") + statRate(playerStats, "shotsOnGoal") > 0,
    statRate(playerStats, "assists") + statRate(playerStats, "smartPlays") > 0,
    statRate(playerStats, "groundBalls") + statRate(playerStats, "faceoffWins") + Math.max(0, statRate(playerStats, "extraPossessions")) > 0,
    statRate(playerStats, "causedTurnovers") + statRate(playerStats, "defensiveStops") > 0,
    statRate(playerStats, "saves") > 0,
    statRate(playerStats, "hustlePlays") + statRate(playerStats, "backedUpShots") > 0,
  ];
  return categories.filter(Boolean).length;
}

function multiCategoryBonus(playerStats) {
  return Math.max(0, activeArchetypeCategoryCount(playerStats) - 1) * 2;
}

function normalizeScore(value, cap) {
  return Math.round(clampNumber((Number(value || 0) / cap) * 100, 0, 100));
}

function calculateRawDimensionScores(playerStats) {
  const goals = statRate(playerStats, "goals");
  const assists = statRate(playerStats, "assists");
  const shotsOnGoal = statRate(playerStats, "shotsOnGoal");
  const groundBalls = statRate(playerStats, "groundBalls");
  const faceoffWins = statRate(playerStats, "faceoffWins");
  const extraPossessionsCreated = Math.max(0, statRate(playerStats, "extraPossessions"));
  const successfulClears = statRate(playerStats, "clears");
  const turnovers = statRate(playerStats, "turnovers");
  const causedTurnovers = statRate(playerStats, "causedTurnovers");
  const defensiveStops = statRate(playerStats, "defensiveStops");
  const saves = statRate(playerStats, "saves");
  const goalsAllowed = statRate(playerStats, "goalsAllowed");
  const failedClears = statRate(playerStats, "failedClears");
  const penalties = statRate(playerStats, "penalties");
  const hustlePlays = statRate(playerStats, "hustlePlays");
  const backedUpShots = statRate(playerStats, "backedUpShots");
  const smartPlays = statRate(playerStats, "smartPlays");

  return {
    scoring: goals * 5 + shotsOnGoal * 1 + shootingPctBonus(playerStats),
    playmaking: assists * 4 + smartPlays * 0.5 - turnovers * 1,
    possession: groundBalls * 2 + faceoffWins * 2 + extraPossessionsCreated * 3 + successfulClears * 1 - turnovers * 2,
    defense: causedTurnovers * 3 + defensiveStops * 3,
    goalie: saves * 3 + savePctBonus(playerStats) + successfulClears * 1 - goalsAllowed * 1,
    hustle: groundBalls * 2 + backedUpShots * 2 + hustlePlays * 3 + multiCategoryBonus(playerStats),
    mistakeCost: turnovers * 3 + failedClears * 2 + penalties * 2,
  };
}

function normalizeDimensionScores(allPlayersRawScores) {
  return allPlayersRawScores.map((rawScores) =>
    Object.fromEntries(
      Object.keys(ARCHETYPE_SCORE_CAPS).map((key) => [key, normalizeScore(rawScores[key], ARCHETYPE_SCORE_CAPS[key])]),
    ),
  );
}

function generateNextLevelFocus(archetype) {
  return ARCHETYPE_DEFS[archetype]?.nextFocus || ARCHETYPE_DEFS.growthProfile.nextFocus;
}

function assignArchetype(playerStats, dimensionScores) {
  const goals = statRate(playerStats, "goals");
  const assists = statRate(playerStats, "assists");
  const groundBalls = statRate(playerStats, "groundBalls");
  const extraPossessionsCreated = Math.max(0, statRate(playerStats, "extraPossessions"));
  const causedTurnovers = statRate(playerStats, "causedTurnovers");
  const successfulClears = statRate(playerStats, "clears");
  const turnovers = statRate(playerStats, "turnovers");
  const activeCategories = activeArchetypeCategoryCount(playerStats);
  const strongDimensions = ["scoring", "playmaking", "possession", "defense", "hustle"].filter((key) => dimensionScores[key] >= 60).length;
  const lowMistakeCost = dimensionScores.mistakeCost <= 35;
  const manageableMistakeCost = dimensionScores.mistakeCost <= 50;

  let archetype = "growthProfile";
  if (dimensionScores.scoring >= 75 && goals >= 2) archetype = "finisher";
  else if (dimensionScores.playmaking >= 75 || assists >= 2) archetype = "setupArtist";
  else if (dimensionScores.possession >= 75 && extraPossessionsCreated >= 3) archetype = "possessionEngine";
  else if (groundBalls >= 3 && dimensionScores.possession >= 55 && dimensionScores.hustle >= 55) archetype = "groundBallMagnet";
  else if (dimensionScores.defense >= 75 || causedTurnovers >= 2) archetype = "defensiveDisruptor";
  else if (strongDimensions >= 3 && manageableMistakeCost) archetype = "twoWayForce";
  else if (dimensionScores.hustle >= 75 && activeCategories >= 3) archetype = "sparkPlug";
  else if (activeCategories >= 3 && lowMistakeCost) archetype = "gluePlayer";
  else if (dimensionScores.goalie >= 75) archetype = "theWall";
  else if (successfulClears >= 3 && turnovers <= 1) archetype = "outletStarter";

  const definition = ARCHETYPE_DEFS[archetype];
  return {
    key: archetype,
    name: definition.name,
    explanation: definition.explanation,
    nextFocus: generateNextLevelFocus(archetype),
    reasons: generateReasons(playerStats, dimensionScores, archetype),
    scores: dimensionScores,
  };
}

function generateReasons(playerStats, dimensionScores, archetype) {
  const reasons = [];
  const addIf = (condition, reason) => {
    if (condition && reasons.length < 3) reasons.push(reason);
  };
  const statLabel = (key, singular, plural = `${singular}s`) => {
    const value = statRate(playerStats, key);
    const label = value === 1 ? singular : plural;
    return `${formatImpactNumber(value)} ${label}${Number(playerStats.gamesPlayed || 0) > 1 ? " per game" : ""}`;
  };

  addIf(statRate(playerStats, "goals") > 0, statLabel("goals", "goal"));
  addIf(statRate(playerStats, "assists") > 0, statLabel("assists", "assist"));
  addIf(statRate(playerStats, "groundBalls") > 0, statLabel("groundBalls", "ground ball"));
  addIf(statRate(playerStats, "causedTurnovers") > 0, statLabel("causedTurnovers", "caused turnover"));
  addIf(statRate(playerStats, "saves") > 0, statLabel("saves", "save"));
  addIf(
    Math.max(0, statRate(playerStats, "extraPossessions")) > 0,
    `${signedMetric(Math.max(0, statRate(playerStats, "extraPossessions")))} extra possession impact${Number(playerStats.gamesPlayed || 0) > 1 ? " per game" : ""}`,
  );
  addIf(statRate(playerStats, "clears") > 0, statLabel("clears", "successful clear"));
  addIf(activeArchetypeCategoryCount(playerStats) >= 3, `Contributed in ${activeArchetypeCategoryCount(playerStats)} tracked areas`);
  addIf(dimensionScores.mistakeCost <= 35, "Kept mistake cost low for the role");

  if (!reasons.length) {
    reasons.push("This profile will sharpen as more game events are tracked.");
  }

  const leadingDimension = ["scoring", "playmaking", "possession", "defense", "goalie", "hustle"]
    .map((key) => [key, dimensionScores[key]])
    .sort((a, b) => b[1] - a[1])[0];
  if (leadingDimension && leadingDimension[1] > 0 && reasons.length < 3) {
    reasons.push(`${ARCHETYPE_DIMENSION_LABELS[leadingDimension[0]]} led the dimension profile at ${leadingDimension[1]}/100`);
  }

  return reasons;
}

function calculateArchetypeResult(playerStats) {
  const rawScores = calculateRawDimensionScores(playerStats);
  const scores = normalizeDimensionScores([rawScores])[0];
  return assignArchetype(playerStats, scores);
}

function generateShareCard(player, archetypeResult) {
  const scoreEntries = ["scoring", "playmaking", "possession", "defense", "goalie", "hustle"];
  const badgeLabel = archetypeResult.name.replace(/^The\s+/i, "").split(" ")[0];
  return `
    <section class="card pad archetype-card">
      <div class="section-head compact-head">
        <div>
          <p class="eyebrow">Player Archetype</p>
          <h3>${escapeHTML(archetypeResult.name)}</h3>
          <p class="muted small">${escapeHTML(playerTitle(player))} - not a permanent label, just this stat profile.</p>
        </div>
        <span class="archetype-badge">${escapeHTML(badgeLabel)}</span>
      </div>
      <p class="archetype-explanation">${escapeHTML(archetypeResult.explanation)}</p>
      <div class="archetype-reasons">
        ${archetypeResult.reasons.map((reason) => `<span>${escapeHTML(reason)}</span>`).join("")}
      </div>
      <div class="archetype-bars">
        ${scoreEntries
          .map(
            (key) => `
              <div class="archetype-bar">
                <span>${escapeHTML(ARCHETYPE_DIMENSION_LABELS[key])}</span>
                <div><i style="width: ${archetypeResult.scores[key]}%;"></i></div>
                <strong>${archetypeResult.scores[key]}</strong>
              </div>
            `,
          )
          .join("")}
      </div>
      <div class="archetype-focus">
        <span>Next focus</span>
        <strong>${escapeHTML(archetypeResult.nextFocus)}</strong>
      </div>
    </section>
  `;
}

function impactWeightLabel(weight) {
  const value = Number(weight || 0);
  if (value === 0) return "not graded";
  if (value >= 1.6) return "very high";
  if (value >= 1.2) return "high";
  if (value <= 0.7) return "low";
  return "medium";
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
  showToast(`${stat.label} added · ${event.quarter} ${formatTime(event.timestamp)}`);
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
  showToast(`Undo last event: ${removed.statLabel}`);
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
  if (!window.confirm(`Delete this game?\n\nThis removes ${game.opponent} on ${formatDate(game.date)} from this account's saved game history. This cannot be undone.`)) return;
  rememberDeletedGame(id);
  (game.events || []).forEach((event) => rememberDeletedEvent(event.id));
  state.games = state.games.filter((item) => item.id !== id);
  if (state.activeGame?.id === id) state.activeGame = null;
  state.addingReviewEvent = false;
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
  state.addingReviewEvent = false;
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
    "eventImpactValue",
    "eventImpactPillar",
    "gameImpactScore",
    "gameImpactRaw",
    "extraPossessions",
    "possessionValue",
    "tags",
    "note",
    "fieldZone",
  ];
  const rows = state.games.flatMap((game) => {
    const normalizedGame = normalizeGame(game);
    const player = gamePlayerSnapshot(normalizedGame);
    const totals = calculateTotals(normalizedGame.events, player);
    return normalizedGame.events.map((event) => {
      return [
        normalizedGame.id,
        gamePlayerId(normalizedGame),
        gameTeamId(normalizedGame),
        teamById(gameTeamId(normalizedGame))?.name || player.team || "",
        gameRosterPlayerId(normalizedGame),
        player.name,
        player.number,
        normalizedGame.date,
        normalizedGame.opponent,
        event.id,
        event.timestamp,
        event.quarter,
        event.statType,
        event.statLabel,
        event.category,
        event.pointValue,
        impactValueForEvent(event),
        impactPillarForEvent(event),
        totals.impact,
        formatImpactNumber(totals.rawImpact),
        formatImpactNumber(totals.extraPossessions),
        formatImpactNumber(totals.possessionValue),
        event.tags,
        event.note,
        event.fieldZone,
      ];
    });
  });
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
    impactModel: {
      version: "game-impact-v2-position-weighted",
      scale: "0-100",
      pillars: IMPACT_PILLARS,
      rules: IMPACT_RULES,
      positionWeights: IMPACT_POSITION_WEIGHTS,
    },
    possessionImpactModel: {
      version: "possession-impact-v1",
      metrics: ["extraPossessions", "possessionValue"],
      rules: POSSESSION_IMPACT_RULES,
    },
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
    team_id: normalized.teamId || null,
    roster_player_id: normalized.rosterPlayerId || null,
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
    team_id: normalized.teamId || game?.teamId || null,
    roster_player_id: normalized.rosterPlayerId || game?.rosterPlayerId || null,
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

function detachTeamFromGameForSync(game) {
  const normalized = normalizeGame(game);
  const playerSnapshot = {
    ...(normalized.playerSnapshot || {}),
    teamId: "",
    rosterPlayerId: "",
  };
  return normalizeGame({
    ...normalized,
    teamId: "",
    rosterPlayerId: "",
    playerSnapshot,
    events: normalized.events.map((event) => ({
      ...event,
      teamId: "",
      rosterPlayerId: "",
    })),
  });
}

function detachTeamFromSupabaseRows(payload) {
  const detach = (row) => ({
    ...row,
    team_id: null,
    roster_player_id: null,
  });
  return Array.isArray(payload) ? payload.map(detach) : detach(payload);
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
  state.syncStatus = "Live Share needs setup";
  const now = Date.now();
  if (now - lastSyncErrorAt > 8000) {
    lastSyncErrorAt = now;
    showToast("Live Share is not ready yet");
  }
}

function supabaseErrorText(error = {}) {
  return `${error.message || ""} ${error.details || ""} ${error.hint || ""} ${error.code || ""}`.trim();
}

function readableSupabaseError(error = {}) {
  return supabaseErrorText(error).replace(/\s+/g, " ").slice(0, 220);
}

function isTeamForeignKeyError(error = {}) {
  const text = supabaseErrorText(error);
  return error.code === "23503" && /team_id|games_team_id_fkey|events_team_id_fkey|not present in table "teams"/i.test(text);
}

function isTeamSetupError(error = {}) {
  const text = supabaseErrorText(error);
  return /teams|team_members|roster_players|tracker_code|laxhornet_|schema cache|relation|column|function|permission|policy/i.test(text);
}

function isMissingRpcError(error = {}) {
  const text = supabaseErrorText(error);
  return /could not find the function|schema cache|PGRST202|function .* does not exist/i.test(text);
}

function isPermissionError(error = {}) {
  const text = supabaseErrorText(error);
  return /admin approval required|row-level security|violates row-level security|permission denied|policy|not authorized|42501/i.test(text);
}

function reportTeamSetupError(error) {
  console.warn("LaxHornet team roster setup failed:", error);
  state.syncStatus = "Team setup needs attention";
  state.cloudError = readableSupabaseError(error);
  const now = Date.now();
  if (now - lastSyncErrorAt > 8000) {
    lastSyncErrorAt = now;
    showToast(state.cloudError ? `Team setup error: ${state.cloudError}` : "Team setup needs attention");
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

function markTeamAsLocalOnly(teamId) {
  if (!teamId) return;
  state.teams = normalizeTeams(state.teams.map((team) =>
    team.id === teamId
      ? { ...team, cloudBacked: false, localRecovered: true, role: team.role || "admin" }
      : team,
  ));
  persistAll();
}

function handleMissingCloudTeam(error, team, actionLabel = "edit this roster") {
  if (!team || !isTeamForeignKeyError(error)) return false;
  markTeamAsLocalOnly(team.id);
  state.syncStatus = "Team exists locally only";
  state.cloudError = `${team.name} is missing from the cloud team table. Delete the local copy or recreate the team before you ${actionLabel}.`;
  render();
  showToast("Team missing from cloud");
  return true;
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
    cloudBacked: true,
    localRecovered: false,
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

async function fetchVisibleCloudTeams() {
  const rpcResult = await supabaseClient.rpc("laxhornet_my_teams");
  if (!rpcResult.error && Array.isArray(rpcResult.data)) {
    return {
      teams: normalizeTeams(rpcResult.data.map(teamFromSupabaseRows)),
      error: null,
      source: "rpc",
    };
  }
  if (rpcResult.error && !isMissingRpcError(rpcResult.error)) {
    return { teams: [], error: rpcResult.error, source: "rpc" };
  }

  const { data: memberRows, error: memberError } = await supabaseClient
    .from("team_members")
    .select("team_id, role, teams(id,name,invite_code,tracker_code,created_by,created_at)")
    .eq("user_id", currentUserId());

  if (memberError) return { teams: [], error: memberError, source: "tables" };

  let teams = normalizeTeams((memberRows || []).map(teamFromSupabaseRows));
  if (isPlatformReviewer()) {
    const { data: ownedTeams, error: ownedTeamsError } = await supabaseClient
      .from("teams")
      .select("id,name,invite_code,tracker_code,created_by,created_at")
      .eq("created_by", currentUserId());
    if (ownedTeamsError) return { teams, error: ownedTeamsError, source: "tables" };
    if (Array.isArray(ownedTeams)) {
      teams = normalizeTeams([
        ...teams,
        ...ownedTeams.map((team) => teamFromSupabaseRows({ ...team, role: "admin" })),
      ]);
    }
  }
  return { teams, error: null, source: "tables" };
}

async function fetchVisibleCloudRosterPlayers(teamIdsForSync = []) {
  const ids = uniqueIds(teamIdsForSync);
  const rpcResult = await supabaseClient.rpc("laxhornet_visible_roster_players");
  if (!rpcResult.error && Array.isArray(rpcResult.data)) {
    const rosterPlayers = normalizeRosterPlayers(rpcResult.data.map(rosterPlayerFromSupabaseRow))
      .filter((player) => !ids.length || ids.includes(player.teamId));
    return { rosterPlayers, error: null, source: "rpc" };
  }
  if (rpcResult.error && !isMissingRpcError(rpcResult.error)) {
    return { rosterPlayers: [], error: rpcResult.error, source: "rpc" };
  }
  if (!ids.length) return { rosterPlayers: [], error: null, source: "tables" };

  const { data: rosterRows, error: rosterError } = await supabaseClient
    .from("roster_players")
    .select("*")
    .in("team_id", ids)
    .order("number", { ascending: true });

  if (rosterError) return { rosterPlayers: [], error: rosterError, source: "tables" };
  return {
    rosterPlayers: normalizeRosterPlayers((rosterRows || []).map(rosterPlayerFromSupabaseRow)),
    error: null,
    source: "tables",
  };
}

async function loadCloudTeams(options = {}) {
  if (!supabaseClient || !currentUserId()) return;
  const localAdminTeams = locallyManagedAdminTeams();
  const { teams: cloudTeams, error: teamReadError } = await fetchVisibleCloudTeams();

  if (teamReadError) {
    if (!options.silent) reportTeamSetupError(teamReadError);
    return;
  }

  state.teams = normalizeTeams([...localAdminTeams, ...cloudTeams]);

  await loadTeamAccessRequests({ silent: true });
  const approvedRequestTeams = state.teamAccessRequests
    .filter((request) => request.status === "approved" && request.teamId)
    .map((request) => ({
      id: request.teamId,
      name: request.teamName || "Approved Team",
      role: request.requestedRole || "tracker",
      cloudBacked: true,
    }));
  if (approvedRequestTeams.length) {
    state.teams = normalizeTeams([...state.teams, ...approvedRequestTeams]);
  }

  if (!state.activeTeamId || !state.teams.some((team) => team.id === state.activeTeamId)) {
    state.activeTeamId = state.teams[0]?.id || "";
  }

  const ids = teamIds();
  if (ids.length) {
    const { rosterPlayers: cloudRosterPlayers, error: rosterError } = await fetchVisibleCloudRosterPlayers(ids);

    if (rosterError) {
      if (!options.silent) reportTeamSetupError(rosterError);
      return;
    }

    const cloudRosterKeys = new Set(cloudRosterPlayers.map((player) => `${player.teamId}|${player.id}`));
    const preservedRosterPlayers = state.rosterPlayers.filter((player) => {
      const normalized = normalizeRosterPlayer(player);
      if (!ids.includes(normalized.teamId)) return true;
      if (!canManageRoster(normalized.teamId)) return false;
      return !cloudRosterKeys.has(`${normalized.teamId}|${normalized.id}`);
    });
    state.rosterPlayers = normalizeRosterPlayers([
      ...preservedRosterPlayers,
      ...cloudRosterPlayers,
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
  state.syncStatus = cloudGames.length || uploadedCount ? "Synced" : "No saved account games yet";
  if (!options.silent) {
    render();
    showToast(
      cloudGames.length
        ? `Synced. Showing ${playerTitle(state.player)}.`
        : "No saved games found for this account",
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
    showToast("Account features are not available");
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
  state.syncStatus = state.authUser ? "Signed in" : "Check your email to confirm your account";
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
    showToast("Enter your player's jersey number");
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
  await loadCloudTeams({ silent: true });
  if (!state.teams.some((item) => item.id === createdTeam.id)) {
    state.teams = normalizeTeams([...state.teams, createdTeam]);
  }
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
  const accessCode = formData.get("inviteCode")?.trim().toUpperCase() || "";
  const childJerseyNumber = formData.get("joinChildJerseyNumber")?.trim() || "";
  if (!accessCode || !childJerseyNumber) {
    showToast("Enter team code and jersey number");
    return;
  }
  await requestTeamAccessByCode(accessCode, { childJerseyNumber });
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
    showToast(team.localRecovered ? "Recreate this cloud team before adding players" : "Team admin access required");
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
    if (handleMissingCloudTeam(error, team, "add roster players")) return;
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
  const explicitRosterPlayerId = formData.get("rosterPlayerId")?.trim() || "";
  const explicitTeamId = formData.get("teamId")?.trim() || "";
  const explicitRosterPlayer = explicitRosterPlayerId
    ? state.rosterPlayers.find((item) => item.id === explicitRosterPlayerId && (!explicitTeamId || item.teamId === explicitTeamId))
    : null;
  const player = explicitRosterPlayer
    ? rosterPlayerToPlayer(explicitRosterPlayer)
    : normalizePlayer(state.player);
  if (!isTeamPlayer(player)) {
    showToast("Pick a roster player first");
    return;
  }
  if (!canManageRoster(player.teamId)) {
    const team = teamById(player.teamId);
    showToast(team?.localRecovered ? "Recreate this cloud team before editing players" : "Team admin access required");
    return;
  }
  const position = positionValueFromForm(formData, "position");
  if (!position) {
    showToast("Pick at least one position");
    return;
  }

  const rosterPlayer = normalizeRosterPlayer({
    id: explicitRosterPlayerId || player.rosterPlayerId || player.id,
    teamId: explicitTeamId || player.teamId,
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
    if (handleMissingCloudTeam(error, teamById(rosterPlayer.teamId), "edit roster players")) return;
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
  await loadCloudTeams({ silent: true });
  const verifiedRosterPlayer = state.rosterPlayers.find((item) => item.id === savedRosterPlayer.id && item.teamId === savedRosterPlayer.teamId);
  if (verifiedRosterPlayer && verifiedRosterPlayer.number !== savedRosterPlayer.number) {
    showToast("Roster save did not stick. Try again after syncing.");
    render();
    return;
  }
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
    showToast("Saved games must be deleted before removing this player from your account");
    return;
  }
  if (!window.confirm(`Remove ${playerTitle(player)} from your account? This does not remove the player from the team roster. It only removes your access to this player.`)) return;

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
  if (!canDeleteTeam(team.id)) {
    showToast("Admin mode required");
    return;
  }
  if (!window.confirm(`Delete ${team.name}? This removes the team roster, access requests, and parent access. Saved games will stay in history.`)) return;

  if (team.cloudBacked) {
    const { error } = await supabaseClient.rpc("laxhornet_delete_team", {
      p_team_id: team.id,
    });
    if (error) {
      if (!handleMissingCloudTeam(error, team, "delete this team")) {
        reportTeamSetupError(error);
        return;
      }
    }
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
    state.syncStatus = "Saved on this phone";
    return false;
  }
  let normalized = normalizeGame({ ...game, userId: game.userId || userId });
  let detachedMissingTeam = false;
  let { error, skipped } = await upsertWithOptionalColumns("games", gameToSupabaseRow(normalized), [
    "player_id",
    "team_id",
    "roster_player_id",
    "period_format",
  ]);
  if (error && isTeamForeignKeyError(error)) {
    normalized = detachTeamFromGameForSync(normalized);
    detachedMissingTeam = true;
    ({ error, skipped } = await upsertWithOptionalColumns("games", gameToSupabaseRow(normalized), [
      "player_id",
      "team_id",
      "roster_player_id",
      "period_format",
    ]));
  }
  if (error) {
    reportSyncError(error);
    return false;
  }

  if (options.includeEvents && normalized.events.length) {
    let eventsPayload = normalized.events.map((event) => eventToSupabaseRow({ ...event, userId }));
    if (detachedMissingTeam) eventsPayload = detachTeamFromSupabaseRows(eventsPayload);
    let { error: eventsError, skipped: skippedEventColumns } = await upsertWithOptionalColumns(
      "events",
      eventsPayload,
      ["tags", "team_id", "roster_player_id", "field_zone", "corrected_at", "tags_updated_at"],
    );
    if (eventsError && isTeamForeignKeyError(eventsError)) {
      eventsPayload = detachTeamFromSupabaseRows(eventsPayload);
      ({ error: eventsError, skipped: skippedEventColumns } = await upsertWithOptionalColumns(
        "events",
        eventsPayload,
        ["tags", "team_id", "roster_player_id", "field_zone", "corrected_at", "tags_updated_at"],
      ));
      detachedMissingTeam = true;
    }
    if (eventsError) {
      reportSyncError(eventsError);
      return false;
    }
    skipped.push(...skippedEventColumns);
  }

  state.syncStatus = detachedMissingTeam
    ? "Synced without team link"
    : skipped.length
    ? "Synced; setup update recommended"
    : "Synced";
  return true;
}

async function syncLoggedEvent(game, event) {
  if (!supabaseClient || !game || !event) return;
  if (gameTeamId(game) && !canEditGame(game)) {
    state.syncStatus = "Verify your player before saving team stats";
    return;
  }
  const gameSynced = await syncGameToSupabase(game);
  if (!gameSynced) return;
  let eventRow = eventToSupabaseRow(event);
  let detachedMissingTeam = false;
  let { error, skipped } = await upsertWithOptionalColumns("events", eventRow, [
    "tags",
    "team_id",
    "roster_player_id",
    "field_zone",
    "corrected_at",
    "tags_updated_at",
  ]);
  if (error && isTeamForeignKeyError(error)) {
    eventRow = detachTeamFromSupabaseRows(eventRow);
    detachedMissingTeam = true;
    ({ error, skipped } = await upsertWithOptionalColumns("events", eventRow, [
      "tags",
      "team_id",
      "roster_player_id",
      "field_zone",
      "corrected_at",
      "tags_updated_at",
    ]));
  }
  if (error) {
    reportSyncError(error);
  } else {
    state.syncStatus = detachedMissingTeam
      ? "Synced without team link"
      : skipped.length
      ? "Synced; setup update recommended"
      : "Synced";
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

async function installApp() {
  if (isStandaloneApp()) {
    state.installInstructionsVisible = true;
    render();
    showToast("LaxHornet is already saved");
    return;
  }

  if (deferredInstallPrompt) {
    const promptEvent = deferredInstallPrompt;
    deferredInstallPrompt = null;
    promptEvent.prompt();
    try {
      const choice = await promptEvent.userChoice;
      showToast(choice?.outcome === "accepted" ? "Install started" : "Install dismissed");
    } catch {
      showToast("Install prompt opened");
    }
    state.installInstructionsVisible = true;
    render();
    return;
  }

  state.installInstructionsVisible = true;
  render();
  showToast(isIOSDevice() ? "Use Safari Share > Add to Home Screen" : "Use browser menu to install");
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
            <img class="brand-logo" src="assets/LHbanner.png?v=3" alt="LaxHornet" />
            <h1 class="sr-only">LaxHornet</h1>
            <span class="app-version-chip">App version: ${escapeHTML(APP_VERSION)}</span>
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
    { screen: "past", label: "Review", icon: "games", active: ["past", "review"].includes(state.screen) },
    { screen: "dashboard", label: "Season", icon: "season", active: state.screen === "dashboard" },
    { screen: "more", label: isPlatformReviewer() ? "Manage" : "More", icon: "manage", active: ["more", "player", "settings", "team", "teamAccess", "profileSetup", "tutorial", "help", "launchKit", "promoDemo"].includes(state.screen) },
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
        <p class="muted small">Account features are not available right now, but this device can still keep game data locally.</p>
      </section>
    `;
  }

  if (state.authUser) {
    const role = currentAppRole();
    const modeToggle = isReviewerAccount()
      ? `<div class="mode-toggle" role="group" aria-label="Admin view mode">
          <button class="mini-btn ${isPlatformReviewer() ? "" : "light"}" type="button" data-admin-view-mode="admin" aria-pressed="${isPlatformReviewer()}">Switch to Team Admin Tools</button>
          <button class="mini-btn ${!isPlatformReviewer() ? "" : "light"}" type="button" data-admin-view-mode="tracker" aria-pressed="${!isPlatformReviewer()}">Switch to Tracker View</button>
        </div>`
      : "";
    return `
      <section class="card pad account-card">
        <h3>User Profile</h3>
        <p class="muted small">${escapeHTML([state.userProfile?.firstName, state.userProfile?.lastName].filter(Boolean).join(" ") || userEmail())}</p>
        <p class="muted small">${escapeHTML(userEmail())}</p>
        <p class="muted small">Access: ${escapeHTML(isReviewerAccount() ? `Reviewer / ${appRoleLabel(role)}` : appRoleLabel(role))}</p>
        <p class="muted small">${escapeHTML(state.syncStatus)}</p>
        ${state.cloudError ? `<p class="muted small">Last setup error: ${escapeHTML(state.cloudError)}</p>` : ""}
        ${modeToggle}
        <div class="account-actions">
          <button class="btn neutral" type="button" data-action="sync-cloud-games">Sync</button>
          <button class="btn secondary" type="button" data-nav="profileSetup">Edit Profile</button>
          <button class="btn secondary" type="button" data-action="refresh-profile">Refresh Profile</button>
          <button class="btn secondary" type="button" data-action="sign-out">Sign Out</button>
        </div>
      </section>
    `;
  }

  return `
    <form class="card pad form-grid account-card" data-form="auth">
      <h3>Log in or create an account</h3>
      <p class="muted small">Use your account to request team access, verify your player, and keep stats separate from other parents on this device.</p>
      <div class="field">
        <label for="authEmail">Email</label>
        <input id="authEmail" name="email" type="email" autocomplete="email" required />
      </div>
      <div class="field">
        <label for="authPassword">Password</label>
        <input id="authPassword" name="password" type="password" autocomplete="current-password" minlength="6" required />
      </div>
      <div class="account-actions">
        <button class="btn positive" type="submit" name="authAction" value="sign-in" ${state.authBusy ? "disabled" : ""}>${state.authBusy ? "Working..." : "Log In"}</button>
        <button class="btn secondary auth-create" type="submit" name="authAction" value="sign-up" ${state.authBusy ? "disabled" : ""}>${state.authBusy ? "Sending..." : "Create Account"}</button>
      </div>
      ${renderInstallCard({ compact: true })}
      <p class="auth-legal muted small"><a href="privacy.html" target="_blank" rel="noopener">Privacy Policy</a></p>
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
      const teamCodeLabel = playerTeamCodeLabel(player);
      return `
        <button class="player-chip ${active ? "active" : ""}" type="button" data-player-select="${player.id}" aria-pressed="${active}">
          <strong>${escapeHTML(player.name || "Player")}</strong>
          ${player.number ? `<span>#${escapeHTML(player.number)}</span>` : ""}
          ${showPlayerSubline ? `<span>${escapeHTML(playerSubline(player))}</span>` : ""}
          ${teamCodeLabel ? `<span class="player-chip-code">${escapeHTML(teamCodeLabel)}</span>` : ""}
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

function renderCompactPlayerContext(options = {}) {
  const title = options.title || "Current Player";
  const helper = options.helper || "";
  return `
    <section class="card pad compact-player-card">
      <div>
        <p class="eyebrow">${escapeHTML(title)}</p>
        <h3>${escapeHTML(playerTitle(state.player))}</h3>
        <p class="muted small">${escapeHTML(playerSubline(state.player))}</p>
        ${playerTeamCodeLabel(state.player) ? `<p class="muted tiny player-card-code">${escapeHTML(playerTeamCodeLabel(state.player))}</p>` : ""}
        ${helper ? `<p class="muted tiny">${escapeHTML(helper)}</p>` : ""}
      </div>
      <button class="mini-btn light" type="button" data-nav="player">Switch</button>
    </section>
  `;
}

function renderPlayerAssignmentCard(player) {
  const normalized = normalizePlayer(player);
  const active = normalized.id === state.activePlayerId;
  const totals = calculateSeasonTotalsForPlayer(normalized);
  const subline = playerSubline(normalized);
  const teamCodeLabel = playerTeamCodeLabel(normalized);
  return `
    <section class="player-assignment-card ${active ? "active" : ""}">
      <div class="player-assignment-main">
        <div>
          <h3>${escapeHTML(playerTitle(normalized))}</h3>
          <p>${escapeHTML(subline)}</p>
          ${teamCodeLabel ? `<p class="player-card-code">${escapeHTML(teamCodeLabel)}</p>` : ""}
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
        <h3>No approved player yet</h3>
        <p class="muted small">Request access with your team code. After approval, enter your player's jersey number to unlock the correct roster player.</p>
        <button class="mini-btn" type="button" data-nav="team">Request Player Access</button>
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

function renderRosterPlayerEditForm(selectedRosterPlayer, options = {}) {
  const player = normalizePlayer(selectedRosterPlayer);
  if (!isTeamPlayer(player) || !canManageRoster(player.teamId)) return "";
  const prefix = options.idPrefix || "editRoster";
  return `
    <form class="card pad form-grid roster-edit-card ${options.inline ? "inline" : ""}" data-form="roster-player-edit">
      <input type="hidden" name="rosterPlayerId" value="${escapeHTML(player.rosterPlayerId || player.id)}" />
      <input type="hidden" name="teamId" value="${escapeHTML(player.teamId)}" />
      <div class="section-head compact-head">
        <div>
          <h3>Edit ${escapeHTML(player.name)}</h3>
          <p class="muted small">Changes update the shared roster for every parent on this team.</p>
        </div>
      </div>
      <div class="field">
        <label for="${escapeHTML(prefix)}Name">Player name</label>
        <input id="${escapeHTML(prefix)}Name" name="name" value="${escapeHTML(player.name)}" required />
      </div>
      <div class="form-grid two roster-edit-details">
        <div class="field roster-number-field">
          <label for="${escapeHTML(prefix)}Number">Jersey #</label>
          <input id="${escapeHTML(prefix)}Number" name="number" value="${escapeHTML(player.number)}" inputmode="numeric" />
        </div>
        ${renderPositionPicker({ name: "position", selected: player.position, label: "Positions" })}
      </div>
      <div class="inline-input-action">
        <button class="mini-btn danger" type="button" data-action="remove-roster-player">Remove from Roster</button>
        <button class="mini-btn" type="submit">Save Player</button>
      </div>
    </form>
  `;
}

function renderEditRosterPlayerBlock(selectedRosterPlayer) {
  const player = normalizePlayer(selectedRosterPlayer);
  if (!isTeamPlayer(player) || !canManageRoster(player.teamId)) return "";
  const expanded = state.teamEditPlayerExpanded;
  const playerSummary = `${playerTitle(player)}${player.position ? ` - ${player.position}` : ""}`;
  return `
    <div class="team-roster-block roster-action-block edit-player-block ${expanded ? "expanded" : "collapsed"}">
      <div class="collapsible-card-head compact-head">
        <div>
          <h4>Edit Player</h4>
          <p class="muted small">${escapeHTML(expanded ? `Editing ${playerTitle(player)}.` : playerSummary)}</p>
        </div>
        <button class="collapse-icon" type="button" data-action="toggle-edit-player" aria-expanded="${expanded}" aria-label="${expanded ? "Minimize Edit Player" : "Expand Edit Player"}">
          <span aria-hidden="true">${expanded ? "v" : ">"}</span>
        </button>
      </div>
      ${expanded ? renderRosterPlayerEditForm(player, { idPrefix: "teamRosterEdit", inline: true }) : ""}
    </div>
  `;
}

function renderAddRosterPlayerBlock() {
  const expanded = state.teamAddPlayerExpanded;
  return `
    <div class="team-roster-block roster-action-block add-player-block ${expanded ? "expanded" : "collapsed"}">
      <div class="collapsible-card-head compact-head">
        <div>
          <h4>Add Player</h4>
          <p class="muted small">${expanded ? "Add a roster player by name, jersey number, and position." : "Tap to add another roster player."}</p>
        </div>
        <button class="collapse-icon" type="button" data-action="toggle-add-player" aria-expanded="${expanded}" aria-label="${expanded ? "Minimize Add Player" : "Expand Add Player"}">
          <span aria-hidden="true">${expanded ? "v" : ">"}</span>
        </button>
      </div>
      ${
        expanded
          ? `<form class="team-add-player-form roster-edit-card inline" data-form="add-roster-player">
              <div class="form-grid two">
                <div class="field">
                  <label for="rosterName">Player name</label>
                  <input id="rosterName" name="rosterName" placeholder="Player name" required />
                </div>
                <div class="field roster-number-field">
                  <label for="rosterNumber">Jersey #</label>
                  <input id="rosterNumber" name="rosterNumber" inputmode="numeric" placeholder="12" />
                </div>
              </div>
              ${renderPositionPicker({ name: "rosterPosition", label: "Positions" })}
              <div class="team-form-actions">
                <button class="mini-btn" type="submit">Add Player</button>
              </div>
            </form>`
          : ""
      }
    </div>
  `;
}

function renderTeamAccessRequests() {
  const team = activeTeam();
  if (!team || !canManageRoster(team.id)) return "";
  const requests = state.teamAccessRequests.filter((request) => request.teamId === team.id && request.status === "pending");
  return `
    <div class="team-roster-block unclaimed-summary-block access-summary-block">
      <div class="unclaimed-summary-head">
        <div>
          <h4>Team Access Requests</h4>
          <p class="muted small">${requests.length ? "Pending parents need approval before they can see the roster or track a verified player." : "No parents are waiting for access to this team."}</p>
        </div>
        <strong>${requests.length}</strong>
      </div>
      ${
        requests.length
          ? `<div class="access-request-list">
              ${requests
                .map(
                  (request) => {
                    const parentName = [request.firstName, request.lastName].filter(Boolean).join(" ");
                    return `
                    <div class="access-request-row">
                      <span>
                        <strong>${escapeHTML(parentName || request.email || "Unknown parent")}</strong>
                          <small>${escapeHTML(parentName || "This parent")} is requesting access to #${escapeHTML(request.childJerseyNumber || "not provided")} on ${escapeHTML(request.teamName || team?.name || "this team")}.</small>
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
          : `<p class="muted small unclaimed-meta">Share the team code when a parent needs access.</p>`
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
                          <small>${escapeHTML(parentName || "This parent")} is requesting access to #${escapeHTML(request.childJerseyNumber || "not provided")} on ${escapeHTML(request.teamName || "this team")}.</small>
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
      <p class="muted small">Enter your player's jersey number. After verification, only that player will appear for this account.</p>
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
          <p class="muted small">Access is approved for ${escapeHTML(teamName)}. Enter your player's jersey number to unlock only that player.</p>
        </div>
      </div>
      ${renderClaimByNumberForm(teamId, { suffix })}
    </div>
  `;
}

function renderUnclaimedRosterPlayers(roster = []) {
  if (!roster.length) return "";
  const unclaimed = roster.filter((player) => !hasPlayerClaim(player.teamId, player.id));
  const claimedCount = roster.length - unclaimed.length;
  const preview = unclaimed.slice(0, 4);
  const extraCount = Math.max(0, unclaimed.length - preview.length);
  return `
    <div class="team-roster-block unclaimed-summary-block">
      <div class="unclaimed-summary-head">
        <div>
          <h4>Unclaimed Players</h4>
          <p class="muted small">${unclaimed.length ? "Parents need team access and jersey verification before tracking these players." : "Every roster player has been verified by a parent account."}</p>
        </div>
        <strong>${unclaimed.length}/${roster.length}</strong>
      </div>
      ${
        unclaimed.length
          ? `<div class="unclaimed-pill-row">
              ${preview
                .map(
                  (player) => `
                    <span class="unclaimed-pill">
                      ${player.number ? `#${escapeHTML(player.number)} ` : ""}${escapeHTML(player.name)}
                    </span>
                  `,
                )
                .join("")}
              ${extraCount ? `<span class="unclaimed-pill muted-pill">+${extraCount} more</span>` : ""}
            </div>`
          : `<p class="muted small unclaimed-meta">${claimedCount} verified player${claimedCount === 1 ? "" : "s"} on this roster.</p>`
      }
    </div>
  `;
}

function renderMyTeamAccessRequests() {
  if (canCreateTeams()) return "";
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
  const deletableTeam = team ? canDeleteTeam(team.id) : false;
  const teams = state.teams
    .map((item) => {
      const active = item.id === state.activeTeamId;
      const accessCopy = item.localRecovered && !item.cloudBacked
        ? "Local copy"
        : item.role === "admin" && canCreateTeams()
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
          const statusLabel = claimed ? "Verified Player" : "Unverified Player";
          const teamCodeLabel = playerTeamCodeLabel(player);
          return `
            <div class="player-chip-wrap">
              <button class="player-chip ${active ? "active" : ""}" type="button" data-player-select="${player.id}" aria-pressed="${active}">
                <strong>${escapeHTML(player.name)}</strong>
                <span class="player-chip-meta">${item.number ? `#${escapeHTML(item.number)}` : "No jersey"}${item.position ? ` - ${escapeHTML(item.position)}` : ""}</span>
                ${teamCodeLabel ? `<span class="player-chip-code">${escapeHTML(teamCodeLabel)}</span>` : ""}
                <span class="player-chip-status ${claimed ? "verified" : "unverified"}">${statusLabel}</span>
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
  const selectedTeamRosterPlayer = manageRoster && isTeamPlayer(state.player) && state.player.teamId === team.id
    ? normalizePlayer(state.player)
    : null;
  const emptyRosterCopy = showClaimByNumber
    ? "Enter your player's jersey number below to unlock that player."
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
      : "Ask your coach, team admin, or parent coordinator for the team code."
    : "";
  const teamCodeHelper = team?.inviteCode
    ? `<p class="team-code-helper">Team Code: <code>${escapeHTML(team.inviteCode)}</code></p>`
    : "";

  return `
    <section class="card pad team-card ${compact && !expanded ? "collapsed" : ""}">
      <div class="collapsible-card-head">
        <div>
          <h3>${escapeHTML(teamCardTitle)}</h3>
          ${teamHeaderCopy ? `<p class="muted small">${escapeHTML(teamHeaderCopy)}</p>` : ""}
          ${teamCodeHelper}
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
                ${canCreateTeams() ? "" : `<button class="mini-btn light" type="button" data-action="toggle-team-access">Request Access</button>`}
                ${deletableTeam ? `<button class="mini-btn danger" type="button" data-action="delete-team">Delete Team</button>` : ""}
              </div>
              ${
                teams
                  ? `<div class="team-chip-row">${teams}</div>`
                  : `<p class="muted small">${
                      canCreateTeams()
                        ? "No teams yet. Create one for your roster or request access with a team code."
                        : "No approved teams yet. Ask your coach, team admin, or parent coordinator for the team code."
                    }</p>`
              }
              ${team?.localRecovered && !team.cloudBacked ? `<div class="notice-card error-card compact-notice"><strong>Team needs attention.</strong><p class="muted small">This team was recovered from this device, but it is not connected to your account. Remove it or recreate the team before adding roster players.</p></div>` : ""}
              ${state.cloudError ? `<div class="notice-card error-card compact-notice"><strong>Last setup error</strong><p class="muted small">${escapeHTML(state.cloudError)}</p></div>` : ""}
              ${manageRoster ? renderUnclaimedRosterPlayers(fullTeamRoster) : ""}
              ${manageRoster ? renderTeamAccessRequests() : ""}

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
                            ${claimByNumberForm}
                          </div>
                          ${selectedTeamRosterPlayer ? renderEditRosterPlayerBlock(selectedTeamRosterPlayer) : ""}
                          ${renderAddRosterPlayerBlock()}`
                        : `${claimByNumberForm}`
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
      <h2>Track your player&apos;s full impact.</h2>
      <p>Fast sideline stats. Live family updates. Real lacrosse impact.</p>
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
        <button class="mini-btn ${isPlatformReviewer() ? "" : "light"}" type="button" data-admin-view-mode="admin" aria-pressed="${isPlatformReviewer()}">Team Admin Tools</button>
        <button class="mini-btn ${!isPlatformReviewer() ? "" : "light"}" type="button" data-admin-view-mode="tracker" aria-pressed="${!isPlatformReviewer()}">Tracker View</button>
      </div>`
    : "";
  const adminTools = isPlatformReviewer()
    ? `
      <section class="card pad more-card admin-tools-card">
        <div>
          <h3>Admin Tools</h3>
          <p class="muted small">Launch materials, team setup files, and sharing templates.</p>
        </div>
        <div class="more-action-list">
          <button class="more-action" type="button" data-nav="launchKit">
            <span>${renderNavIcon("games")}</span>
            <strong>Launch Kit</strong>
            <small>Open PDFs, invite messages, QR code, and the full zip bundle.</small>
          </button>
        </div>
      </section>
    `
    : "";

  return renderShell(`
    <section class="screen-title">
      <h2>${isPlatformReviewer() ? "Manage" : "More"}</h2>
      <p>Quick access to tracking, player details, team tools, account, watching, and help.</p>
    </section>

    <section class="stack">
      <section class="card pad more-card account-tools-card">
        <div>
          <h3>Account & App</h3>
          <p class="muted small">${escapeHTML(profileName || "Signed in")}${userEmail() ? ` - ${escapeHTML(userEmail())}` : ""}</p>
        </div>
        <div class="more-status-grid">
          <div class="more-status-cell">
            <span>Sync</span>
            <strong>${escapeHTML(state.syncStatus || "Signed in")}</strong>
          </div>
          <div class="more-status-cell">
            <span>Version</span>
            <strong>${escapeHTML(APP_VERSION)}</strong>
          </div>
        </div>
        ${accountModeToggle}
        ${state.cloudError ? `<div class="notice-card error-card"><strong>Last setup error</strong><p class="muted small">${escapeHTML(state.cloudError)}</p></div>` : ""}
        <div class="more-action-list compact-actions">
          <button class="more-action" type="button" data-nav="profileSetup">
            <span>${renderNavIcon("more")}</span>
            <strong>User Profile</strong>
            <small>Edit account details.</small>
          </button>
          <button class="more-action" type="button" data-action="sync-cloud-games">
            <span>${renderNavIcon("season")}</span>
            <strong>Sync</strong>
            <small>Refresh games, teams, and player access.</small>
          </button>
          <button class="more-action" type="button" data-action="check-app-update">
            <span>${renderNavIcon("manage")}</span>
            <strong>Updates</strong>
            <small>Check for the newest app version.</small>
          </button>
          <a class="more-action" href="privacy.html" target="_blank" rel="noopener">
            <span>${renderNavIcon("games")}</span>
            <strong>Privacy Policy</strong>
            <small>Review how LaxHornet handles accounts, teams, players, and game data.</small>
          </a>
          <button class="more-action danger-link" type="button" data-action="sign-out">
            <span>${renderNavIcon("more")}</span>
            <strong>Sign Out</strong>
            <small>Switch accounts on this device.</small>
          </button>
        </div>
      </section>

      <section class="card pad more-card primary-manage-card">
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

      ${adminTools}

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
              <small>See how Game Impact, Average Impact, and percentages work.</small>
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
        <h2>Track the plays that show the whole game.</h2>
        <p>LaxHornet helps parents log youth lacrosse stats quickly, share live game updates, and keep each player&apos;s season organized.</p>
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
          <p class="muted small">Yes for team rosters, player verification, saving stats to your account, and sharing stats across parent accounts.</p>
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
      <h2>${signupDraft ? "Request access to your player." : "User Profile"}</h2>
      <p>${signupDraft ? "Add your name, team code, and player jersey number. A team admin will review the request before tracking opens." : "Update your account details. Team access and player verification are managed from the Team page."}</p>
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
            <p class="field-help">Use the code shared by your coach, team admin, or parent coordinator.</p>
          </div>
          <div class="field">
            <label for="childJerseyNumber">Player jersey number</label>
            <input id="childJerseyNumber" name="childJerseyNumber" inputmode="numeric" placeholder="12" required />
            <p class="field-help">We use jersey number to match your request to the team roster.</p>
          </div>
        </div>

        <div class="notice-card">
          <strong>Player privacy matters.</strong>
          <p class="muted small">Parents only see the player and team access approved by a team admin. Live Share links are read-only.</p>
        </div>
      ` : ""}

      ${state.cloudError ? `<div class="notice-card error-card"><strong>Could not submit request.</strong><p class="muted small">${escapeHTML(state.cloudError)}</p></div>` : ""}

      <div class="account-actions">
        <button class="btn positive" type="submit" ${state.authBusy ? "disabled" : ""}>${state.authBusy ? "Submitting..." : signupDraft ? "Request Player Access" : "Save Profile"}</button>
        <button class="btn secondary" type="button" data-nav="home">Back</button>
        ${state.authUser ? `<button class="btn danger" type="button" data-action="sign-out">Sign Out</button>` : ""}
      </div>
    </form>
  `, { hideNav: !state.authUser });
}

function renderTeamAccessTools() {
  if (canCreateTeams()) {
    return `
      <section class="card pad">
        <div class="section-head compact-head">
          <div>
            <h3>Create Team</h3>
            <p class="muted small">Admin-only setup for preloading an official roster.</p>
          </div>
        </div>
        <form class="inline-mini-form" data-form="create-team">
          <label for="teamName">Team name</label>
          <div class="inline-input-action">
            <input id="teamName" name="teamName" placeholder="Team name" />
            <button class="mini-btn" type="submit">Create</button>
          </div>
        </form>
      </section>
    `;
  }
  const team = activeTeam();
  const requestList = renderMyTeamAccessRequests();
  const expanded = state.teamAccessExpanded;
  return `
      <section class="card pad ${expanded ? "" : "collapsed"}">
        <div class="collapsible-card-head">
          <div>
            <h3>Request Player Access</h3>
            <p class="muted small">${escapeHTML(team ? "Use this only if you need access to another team." : "Ask your coach, team admin, or parent coordinator for the team code.")}</p>
          </div>
          <button class="collapse-icon" type="button" data-action="toggle-team-access" aria-expanded="${expanded}" aria-label="${expanded ? "Minimize Request Player Access" : "Expand Request Player Access"}">
            <span aria-hidden="true">${expanded ? "v" : ">"}</span>
          </button>
        </div>
        ${
          expanded
            ? `<form class="inline-mini-form" data-form="join-team">
                <div class="form-grid two">
                  <div class="field">
                    <label for="inviteCode">Team code</label>
                    <input id="inviteCode" name="inviteCode" placeholder="ABC123" autocapitalize="characters" autocomplete="off" />
                    <p class="field-help">Use the code shared by your coach, team admin, or parent coordinator.</p>
                  </div>
                  <div class="field">
                    <label for="joinChildJerseyNumber">Player jersey number</label>
                    <input id="joinChildJerseyNumber" name="joinChildJerseyNumber" inputmode="numeric" placeholder="Player jersey #" />
                    <p class="field-help">We use jersey number to match your request to the team roster.</p>
                  </div>
                </div>
                <div class="team-form-actions">
                  <button class="mini-btn" type="submit">Request Player Access</button>
                </div>
                <p class="muted small">Once approved, only the matching roster player will appear for this account.</p>
              </form>`
            : ""
        }
      </section>

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
      <p>${admin ? "Create teams, sync parent approvals, and manage roster tools in one place." : "Request team access, sync approvals, and verify your player by jersey number."}</p>
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
      ? renderRosterPlayerEditForm(selectedRosterPlayer)
      : ""
    : "";
  const playerDeleteCard = selectedRosterPlayer
    ? canRemoveClaimedRosterPlayer
      ? `<section class="card pad">
          <h3>Remove Player From My Account</h3>
          <p class="muted small">This does not remove ${escapeHTML(playerTitle(selectedRosterPlayer))} from the team roster. It only removes your access to this player.</p>
          <button class="btn danger" type="button" data-action="remove-claimed-player">Remove Player From My Account</button>
        </section>`
      : ""
    : `<section class="card pad">
        <h3>Remove Local Player</h3>
        <p class="muted small">This only removes the locally saved player from this device. It does not affect any team roster.</p>
        <button class="btn danger" type="button" data-action="delete-player">Remove Local Player</button>
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

    <form class="start-game-form" data-form="start-game">
      <section class="card pad form-grid">
        ${renderPlayerSwitcher({
          title: availablePlayers.length > 1 ? "Who Are You Tracking?" : "Player For This Game",
          helper: viewOnlyTeamPlayer
            ? "Verify this roster player before tracking."
            : availablePlayers.length > 1
              ? "Each player/team tile keeps stats separate."
              : "Double-check this before the opening whistle.",
          inline: true,
        })}
        ${
          viewOnlyTeamPlayer
            ? `<div class="notice-card">Verify your player before starting a shared team game.</div>`
            : ""
        }
      </section>

      <section class="card pad form-grid">
        <div class="section-head compact-head">
          <div>
            <h3>Game Details</h3>
            <p class="muted small">Set the matchup, date, and format before the whistle.</p>
          </div>
        </div>
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
      </section>
    </form>
  `);
}

function renderStatButton(stat, options = {}) {
  const promoStep = Number.isFinite(options.promoStep) ? Number(options.promoStep) : null;
  const statAttr = options.interactive === false ? `data-promo-stat="${stat.key}"` : `data-stat="${stat.key}"`;
  const promoAttrs =
    promoStep === null
      ? ""
      : ` data-promo-step="${promoStep}" style="--promo-step: ${promoStep};"`;
  return `
    <button class="stat-button ${stat.tone}${options.compact ? " compact" : ""}${promoStep === null ? "" : " promo-hit"}" type="button" ${statAttr}${promoAttrs}>
      <span class="label">${stat.label}</span>
      <span class="points">${stat.points === 0 ? "note" : `${pointText(stat.points)} impact`}</span>
    </button>
  `;
}

function renderLiveStatGroups(options = {}) {
  const stepByKey = options.stepByKey || {};
  return `
    <section class="live-stat-groups${options.demo ? " promo-demo-groups" : ""}" aria-label="Stat buttons">
      ${LIVE_STAT_GROUPS.map((group) => {
        const buttons = group.keys
          .map((key) => STAT_BY_KEY[key])
          .filter(Boolean)
          .map((stat) =>
            renderStatButton(stat, {
              compact: group.compact,
              interactive: options.interactive,
              promoStep: Number.isFinite(stepByKey[stat.key]) ? stepByKey[stat.key] : null,
            }),
          )
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
  const totals = calculateTotals(game.events, player);
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
      <p class="safety-note">Anyone with the Live Share link can watch this game read-only. Share it only with people you trust.</p>
    </section>

    <div class="period-tabs" role="group" aria-label="Period selector">
      ${periods.map(
        (period) =>
          `<button class="period-tab ${game.currentQuarter === period ? "active" : ""}" type="button" data-quarter="${period}">${period}</button>`,
      ).join("")}
    </div>

    <section class="live-summary" aria-label="Live game summary">
      <div class="live-pill">${renderImpactGrade(totals.impact)}<span>Game Impact</span></div>
      <div class="live-pill"><strong>${totals.points}</strong><span>Points</span></div>
      <div class="live-pill"><strong>${game.events.length}</strong><span>Events</span></div>
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
      <span class="score">${pointText(impactValueForEvent(event))}</span>
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
        <p class="field-help">Avoid private, medical, or sensitive information in notes.</p>
      </div>
      <div class="edit-actions">
        <button class="btn positive" type="submit">Save Correction</button>
        <button class="btn secondary" type="button" data-action="cancel-edit-event">Cancel</button>
      </div>
    </form>
  `;
}

function renderEventAddForm(game) {
  const statOptions = STAT_DEFS.map(
    (stat) => `<option value="${stat.key}">${stat.label} (${pointText(stat.points)})</option>`,
  ).join("");
  const periods = periodsForGame(game);
  const defaultPeriod = game.currentQuarter && periods.includes(game.currentQuarter) ? game.currentQuarter : periods[0];
  const periodOptions = periods.map(
    (period) => `<option value="${period}" ${period === defaultPeriod ? "selected" : ""}>${period}</option>`,
  ).join("");

  return `
    <form class="card pad form-grid edit-event-form" data-form="event-add" data-game-id="${game.id}">
      <h3>Add Missed Event</h3>
      <p class="muted small">Use this to correct the timeline after the game. The new event is added now; existing event timestamps are unchanged.</p>
      <div class="form-grid two">
        <div class="field">
          <label for="addStat">Stat type</label>
          <select id="addStat" name="statType">${statOptions}</select>
        </div>
        <div class="field">
          <label for="addQuarter">Period</label>
          <select id="addQuarter" name="quarter">${periodOptions}</select>
        </div>
      </div>
      <div class="field">
        <label for="addNote">Note</label>
        <textarea id="addNote" name="note" placeholder="Optional correction note"></textarea>
        <p class="field-help">Avoid private, medical, or sensitive information in notes.</p>
      </div>
      <div class="edit-actions">
        <button class="btn positive" type="submit">Add Event</button>
        <button class="btn secondary" type="button" data-action="cancel-add-event">Cancel</button>
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
      <p class="safety-note">Tags and notes may appear in game reviews, exports, or shared views.</p>
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
        <p>No games tracked yet.</p>
      </section>
      <section class="card pad empty-state-card">
        <h3>No game history yet</h3>
        <p class="muted small">Track a game first. After it is saved, this screen will show the timeline, corrections, tags, Game Impact, and takeaway.</p>
        <button class="btn positive" type="button" data-nav="start">Track New Game</button>
      </section>
    `);
  }

  const player = gamePlayerSnapshot(game);
  const totals = calculateTotals(game.events, player);
  const archetypeResult = calculateArchetypeResult(totals);
  const canEditCurrentGame = canEditGame(game);
  const editingEvent = state.editingEventId
    ? game.events.find((event) => event.id === state.editingEventId)
    : null;
  const tagEditingEvent = state.tagEditingEventId
    ? game.events.find((event) => event.id === state.tagEditingEventId)
    : null;
  const correctionPanelOpen = state.addingReviewEvent || state.editingGameDetails || editingEvent || tagEditingEvent;
  const canShowGameEdit = canEditCurrentGame && !correctionPanelOpen;
  const canShowAddEvent = canEditCurrentGame && !correctionPanelOpen;
  return renderShell(`
    <section class="screen-title">
      <h2>Game Review</h2>
      <p>${escapeHTML(playerTitle(player))} - ${escapeHTML(game.opponent)} - ${formatDate(game.date)}</p>
    </section>

    <section class="stack">
      <div class="metric-grid">
        <div class="metric">${renderImpactGrade(totals.impact)}<span>Game Impact</span></div>
        <div class="metric"><strong>${totals.points}</strong><span>Points</span></div>
        <div class="metric"><strong>${totals.goals}</strong><span>Goals</span></div>
        <div class="metric"><strong>${totals.assists}</strong><span>Assists</span></div>
      </div>
      ${renderImpactBreakdown(totals)}
      ${renderPossessionImpact(totals)}
      ${generateShareCard(player, archetypeResult)}
      ${canEditCurrentGame ? `
        <div class="review-tool-actions">
          ${canShowAddEvent ? `<button class="btn neutral" type="button" data-action="add-review-event">Add Event</button>` : ""}
          ${canShowGameEdit ? `<button class="btn secondary" type="button" data-action="edit-game-details">Edit Game Details</button>` : ""}
        </div>
      ` : ""}
      ${state.addingReviewEvent && canEditCurrentGame ? renderEventAddForm(game) : ""}
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
  const totals = calculateTotals(game.events, gamePlayerSnapshot(game));
  const events = [...game.events].reverse();

  return renderShell(`
    <section class="screen-title">
      <h2>${escapeHTML(game.opponent)}</h2>
      <p>Shared live game - ${formatDate(game.date)} - ${escapeHTML(state.syncStatus)}</p>
    </section>

    <section class="stack">
      <div class="metric-grid">
        <div class="metric">${renderImpactGrade(totals.impact)}<span>Game Impact</span></div>
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
    { section: "Offense" },
    ["Goals", totals.goals],
    ["Assists", totals.assists],
    ["Points", totals.points],
    ["Shots", totals.shots],
    ["Shots on goal", totals.shotsOnGoal],
    ["Shooting %", pct(totals.shootingPct)],
    ["Shot on goal %", pct(totals.shotOnGoalPct)],
    { section: "Possession & Effort" },
    ["Possession value", signedMetric(totals.possessionValue)],
    ["Ground balls", statWithExtraPossessions(totals.groundBalls, totals.groundBalls)],
    ["Backed up shots", statWithExtraPossessions(totals.backedUpShots, totals.backedUpShots)],
    ["Successful clears", statWithExtraPossessions(totals.clears, totals.clears * 0.5)],
    ["Failed clears", statWithExtraPossessions(totals.failedClears, -totals.failedClears)],
    ["Turnovers", statWithExtraPossessions(totals.turnovers, -totals.turnovers)],
    ["Hustle plays", totals.hustlePlays],
    ["Smart plays", totals.smartPlays],
    ["Effort score", totals.effortScore],
    { section: "Defense" },
    ["Caused turnovers", statWithExtraPossessions(totals.causedTurnovers, totals.causedTurnovers)],
    ["Defensive stops", totals.defensiveStops],
    ["Penalties", totals.penalties],
    { section: "Specialty" },
    ["Faceoff wins", statWithExtraPossessions(totals.faceoffWins, totals.faceoffWins)],
    ["Faceoff losses", totals.faceoffLosses],
    ["Faceoff attempts", totals.faceoffAttempts],
    ["Faceoff win %", pct(totals.faceoffPct)],
    ["Saves", statWithExtraPossessions(totals.saves, totals.saves)],
    ["Goals allowed", totals.goalsAllowed],
    ["Save %", pct(totals.savePct)],
  ];

  return `
    <div class="card table-card">
      <table class="stat-table">
        <thead><tr><th>Stat</th><th>Total</th></tr></thead>
        <tbody>
          ${rows
            .map((row) =>
              row.section
                ? `<tr class="stat-section-row"><th colspan="2">${escapeHTML(row.section)}</th></tr>`
                : `<tr><td>${row[0]}</td><td>${row[1]}</td></tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderImpactBreakdown(totals) {
  const impact = totals.gameImpact || calculateGameImpact([]);
  const profile = impact.weightProfile || IMPACT_POSITION_WEIGHTS.midfield;
  return `
    <section class="card pad impact-card">
      <div class="section-head compact-head">
        <div>
          <h3>Game Impact Breakdown</h3>
          <p class="muted small">0-100 view weighted for ${escapeHTML(profile.label || "this position")}.</p>
        </div>
        <span class="impact-score-badge">${renderImpactGrade(impact.score)}</span>
      </div>
      <div class="impact-breakdown-grid">
        ${impact.breakdown
          .map(
            (item) => `
              <div class="impact-breakdown-row">
                <span>${escapeHTML(item.label)}</span>
                <strong>${item.score}</strong>
                <small>${impactWeightLabel(item.weight)}</small>
              </div>
            `,
          )
          .join("")}
      </div>
      <p class="impact-takeaway">${escapeHTML(impact.takeaway)}</p>
      <p class="muted small">Raw event value: ${formatImpactNumber(impact.raw)}. Weighted event value: ${formatImpactNumber(impact.weightedRaw)}. Average Impact on the Season page averages these 0-100 game scores.</p>
    </section>
  `;
}

function renderPossessionImpact(totals) {
  const possession = totals.possessionImpact || calculatePossessionImpact([]);
  return `
    <section class="card pad possession-impact-card">
      <div class="section-head compact-head">
        <div>
          <h3>Possession Impact</h3>
          <p class="muted small">Who helped get or protect the ball, and how valuable those swings were.</p>
        </div>
      </div>
      <div class="possession-impact-grid">
        <div class="possession-impact-metric">
          <span>Extra Possessions</span>
          <strong>${signedMetric(possession.extraPossessions)}</strong>
          <small>volume</small>
        </div>
        <div class="possession-impact-metric">
          <span>Possession Value</span>
          <strong>${signedMetric(possession.possessionValue)}</strong>
          <small>quality</small>
        </div>
      </div>
      <p class="impact-takeaway">${escapeHTML(possession.takeaway)}</p>
    </section>
  `;
}

function renderSeasonTotalsGroups(totals) {
  const groups = [
    {
      title: "Offense",
      rows: [
        ["Goals", totals.goals],
        ["Assists", totals.assists],
        ["Points", totals.points],
        ["Shots", totals.shots],
        ["Shots on goal", totals.shotsOnGoal],
        ["Shooting %", pct(totals.shootingPct)],
        ["Shot on goal %", pct(totals.shotOnGoalPct)],
      ],
    },
    {
      title: "Possession & Effort",
      rows: [
        ["Possession value", signedMetric(totals.possessionValue)],
        ["Avg possession value", signedMetric(totals.averagePossessionValue)],
        ["Ground balls", statWithExtraPossessions(totals.groundBalls, totals.groundBalls)],
        ["Backed up shots", statWithExtraPossessions(totals.backedUpShots, totals.backedUpShots)],
        ["Successful clears", statWithExtraPossessions(totals.clears, totals.clears * 0.5)],
        ["Failed clears", statWithExtraPossessions(totals.failedClears, -totals.failedClears)],
        ["Turnovers", statWithExtraPossessions(totals.turnovers, -totals.turnovers)],
        ["Hustle plays", totals.hustlePlays],
        ["Smart plays", totals.smartPlays],
        ["Effort score", totals.effortScore],
      ],
    },
    {
      title: "Defense",
      rows: [
        ["Caused turnovers", statWithExtraPossessions(totals.causedTurnovers, totals.causedTurnovers)],
        ["Defensive stops", totals.defensiveStops],
        ["Penalties", totals.penalties],
      ],
    },
    {
      title: "Specialty",
      rows: [
        ["Faceoff wins", statWithExtraPossessions(totals.faceoffWins, totals.faceoffWins)],
        ["Faceoff losses", totals.faceoffLosses],
        ["Faceoff attempts", totals.faceoffAttempts],
        ["Faceoff win %", pct(totals.faceoffPct)],
        ["Saves", statWithExtraPossessions(totals.saves, totals.saves)],
        ["Goals allowed", totals.goalsAllowed],
        ["Save %", pct(totals.savePct)],
      ],
    },
  ];

  return `
    <section class="season-groups" aria-label="Season stat groups">
      ${groups
        .map(
          (group) => `
            <section class="card pad season-stat-group">
              <h3>${escapeHTML(group.title)}</h3>
              <div class="stat-mini-grid">
                ${group.rows
                  .map(
                    ([label, value]) => `
                      <div class="stat-mini-row">
                        <span>${escapeHTML(label)}</span>
                        <strong>${escapeHTML(String(value))}</strong>
                      </div>
                    `,
                  )
                  .join("")}
              </div>
            </section>
          `,
        )
        .join("")}
    </section>
  `;
}

function renderPastGames() {
  const games = visibleGames();
  const exportExpanded = state.exportToolsExpanded;
  return renderShell(`
    <section class="screen-title">
      <h2>Past Games</h2>
      <p>Showing saved games for ${escapeHTML(playerContextLine(state.player))}.</p>
    </section>

    <section class="stack">
      ${renderCompactPlayerContext({
        title: "Reviewing",
        helper: "Switch players to review another player's saved games.",
      })}

      <section class="card">
        ${
          games.length
            ? games.map(renderGameListRow).join("")
            : `<div class="empty empty-state-card">
                <h3>No games tracked yet</h3>
                <p class="muted small">Track and save a game to review stats, edit events, export data, and see Game Impact.</p>
                <button class="mini-btn" type="button" data-nav="start">Track New Game</button>
              </div>`
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
  const player = gamePlayerSnapshot(game);
  const totals = calculateTotals(game.events, player);
  const editable = canEditGame(game);
  const impactSummary = `${impactLetterGrade(totals.impact)} (${formatImpactNumber(totals.impact)})`;
  return `
    <div class="list-row">
      <button class="brand" type="button" data-review="${game.id}" style="color: var(--text); text-align: left;">
        <span>
          <h3>${escapeHTML(game.opponent)}</h3>
          <p>${escapeHTML(playerContextLine(player))} - ${formatDate(game.date)} - Game Impact ${escapeHTML(impactSummary)} - Poss Value ${signedMetric(totals.possessionValue)}</p>
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
    [signedMetric(totals.possessionValue), "Poss Value"],
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
  const archetypeResult = calculateArchetypeResult(totals);
  return renderShell(`
    <section class="screen-title">
      <h2>Season Dashboard</h2>
      <p>Totals for ${escapeHTML(playerContextLine(state.player))}.</p>
    </section>

    <section class="stack">
      ${renderCompactPlayerContext({
        title: "Season For",
        helper: "Switch players to see another season dashboard.",
      })}
      <div class="metric-grid">
        ${headlineMetrics.map(([value, label]) => metricTile(value, label)).join("")}
      </div>
      ${generateShareCard(state.player, archetypeResult)}
      ${renderSeasonTotalsGroups(totals)}
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
        <h3>Game Impact</h3>
        <p class="muted small">Game Impact displays as a letter grade with the underlying 0-100 score shown beneath it. It estimates how much a player helped create possessions, convert possessions, protect possessions, and prevent opponent chances. It is built from five pillars: scoring, possession, defense, goalie play, and effort.</p>
        <p class="muted small">The score is position-weighted. Attack gives more credit to scoring, midfield values possession and effort, defense/LSM values defense and effort, faceoff/draw heavily values possession, and goalie heavily values saves and goalie-specific plays.</p>
      </div>

      <div class="card pad">
        <h3>Average Impact</h3>
        <p class="muted small">Average Impact appears on the Season page. It is the player's saved Game Impact scores averaged across games played. Example: game scores of 78, 84, and 69 create a 77.0 Average Impact.</p>
      </div>

      <div class="card pad">
        <h3>Points vs Impact</h3>
        <p class="muted small">Lacrosse points are goals plus assists. Game Impact is broader: it also counts ground balls, clears, defensive stops, faceoffs, goalie saves, backed up shots, hustle plays, smart plays, and mistakes.</p>
      </div>

      <div class="card pad">
        <h3>Possession Impact</h3>
        <p class="muted small">Possession Impact separates volume from value. Extra Possessions counts how many additional chances the player helped create or protect. Possession Value weights how important those possession-changing plays were.</p>
        <p class="muted small">Examples: a ground ball adds +1 extra possession and +1.2 Possession Value. A caused turnover adds +1 and +1.8. A save retained by the team adds +1 and +2.5. Turnovers and failed clears subtract from both.</p>
      </div>

      <div class="card pad">
        <h3>Backed Up Shot</h3>
        <p class="muted small">A Backed Up Shot is when the player hustles to the endline or sideline to retain possession after a shot. It adds +2 to the effort pillar behind Game Impact.</p>
      </div>

      <div class="card pad">
        <h3>Effort Score</h3>
        <p class="muted small">Effort Score is Hustle Plays plus Ground Balls plus Backed Up Shots. It is a simple count of extra-possession effort plays.</p>
      </div>

      <div class="card table-card">
        <table class="stat-table">
          <thead><tr><th>Event</th><th>Raw Value</th></tr></thead>
          <tbody>${impactRows}</tbody>
        </table>
      </div>

      <div class="card pad">
        <h3>Shot Percentages</h3>
        <p class="muted small">Shooting % is goals divided by total shots. Shot on goal % is shots on goal divided by total shots. Total shots are Missed Shots plus Shots on Goal.</p>
      </div>

      <div class="card pad">
        <h3>Faceoff Win %</h3>
        <p class="muted small">Faceoff win % is Faceoff Wins divided by total faceoff attempts. Attempts are Faceoff Wins plus Faceoff Losses.</p>
      </div>
    </section>
  `);
}

const PROMO_DEMO_STEPS = [
  {
    stat: "groundBall",
    field: "Wins the loose ball",
    caption: "Ground Ball +3",
    detail: "One tap captures possession.",
  },
  {
    stat: "shotOnGoal",
    field: "Dodges and gets a shot on cage",
    caption: "Shot on Goal +2",
    detail: "Track quality chances instantly.",
  },
  {
    stat: "backedUpShot",
    field: "Sprints to the endline",
    caption: "Backed Up Shot +2",
    detail: "Reward the hustle that saves possession.",
  },
  {
    stat: "assist",
    field: "Finds the open teammate",
    caption: "Assist +4",
    detail: "Scoring plays update points and impact.",
  },
  {
    stat: "goal",
    field: "Finishes the chance",
    caption: "Goal +5",
    detail: "Big plays land in the timeline.",
  },
  {
    stat: "causedTurnover",
    field: "Forces a rushed pass",
    caption: "Caused Turnover +3",
    detail: "Defense gets counted too.",
  },
  {
    stat: "hustlePlay",
    field: "Rides hard through the whistle",
    caption: "Hustle Play +1",
    detail: "Capture the plays box scores miss.",
  },
];

const PROMO_STEP_BY_KEY = Object.fromEntries(PROMO_DEMO_STEPS.map((step, index) => [step.stat, index]));
const PROMO_STEP_DURATION_SECONDS = 2.4;
const PROMO_CYCLE_SECONDS = PROMO_DEMO_STEPS.length * PROMO_STEP_DURATION_SECONDS;

const LAUNCH_KIT_GROUPS = [
  {
    title: "Complete Package",
    description: "Everything in one download.",
    files: [
      { label: "Download Full Launch Kit", meta: "ZIP bundle", href: "LaxHornet-launch-kit.zip", type: "download" },
    ],
  },
  {
    title: "Promo Video",
    description: "Vertical demo video and thumbnail for sharing LaxHornet with parents.",
    files: [
      { label: "LaxHornet Promo Demo", meta: "MP4", href: "launch-kit/LaxHornet-promo-demo.mp4", type: "video" },
      { label: "Promo Video Thumbnail", meta: "PNG", href: "launch-kit/LaxHornet-promo-demo-thumbnail.png", type: "image" },
    ],
  },
  {
    title: "Printable PDFs",
    description: "Ready for handouts, meetings, or team-manager prep.",
    files: [
      { label: "Parent Quick Start", meta: "PDF", href: "launch-kit/LaxHornet-parent-handout.pdf", type: "pdf" },
      { label: "Admin Launch Checklist", meta: "PDF", href: "launch-kit/LaxHornet-admin-launch-checklist.pdf", type: "pdf" },
      { label: "Marketing Overview", meta: "PDF", href: "launch-kit/LaxHornet-overview.pdf", type: "pdf" },
    ],
  },
  {
    title: "Share Pages",
    description: "Open, preview, print, or copy from the browser.",
    files: [
      { label: "Parent Handout Page", meta: "HTML", href: "launch-kit/parent-handout.html", type: "html" },
      { label: "LaxHornet Overview Page", meta: "HTML", href: "launch-kit/laxhornet-overview.html", type: "html" },
      { label: "Admin Checklist Page", meta: "HTML", href: "launch-kit/admin-launch-checklist.html", type: "html" },
      { label: "Parent Email Template", meta: "HTML", href: "launch-kit/parent-email.html", type: "html" },
    ],
  },
  {
    title: "Copy / Paste Messages",
    description: "Fast text for email, team apps, social posts, and parent chats.",
    files: [
      { label: "Parent Email Draft", meta: "EML", href: "launch-kit/parent-email.eml", type: "email" },
      { label: "Invite Message", meta: "TXT", href: "launch-kit/invite-message.txt", type: "text" },
      { label: "Short Text Message", meta: "TXT", href: "launch-kit/short-text-message.txt", type: "text" },
      { label: "Team Chat Posts", meta: "TXT", href: "launch-kit/team-chat-posts.txt", type: "text" },
      { label: "Social Captions", meta: "TXT", href: "launch-kit/social-captions.txt", type: "text" },
    ],
  },
  {
    title: "QR And Instructions",
    description: "Use these when sharing or rebuilding the kit.",
    files: [
      { label: "QR Code", meta: "PNG", href: "launch-kit/laxhornet-qr.png", type: "image" },
      { label: "Launch Kit README", meta: "MD", href: "launch-kit/launch-kit-readme.md", type: "text" },
    ],
  },
];

function renderLaunchKitFile(file) {
  const downloadAttr = file.type === "download" ? " download" : "";
  return `
    <a class="launch-file-card" href="${escapeHTML(file.href)}" target="_blank" rel="noopener"${downloadAttr}>
      <span>${renderNavIcon(file.type === "download" ? "manage" : file.type === "image" ? "team" : "games")}</span>
      <strong>${escapeHTML(file.label)}</strong>
      <small>${escapeHTML(file.meta)}</small>
    </a>
  `;
}

function renderPromoDemoPage() {
  if (!isPlatformReviewer()) {
    return renderShell(`
      <section class="screen-title">
        <h2>Promo Demo</h2>
        <p>Admin access is required to open the recording demo.</p>
      </section>
      <section class="stack">
        <section class="card pad">
          <h3>Admin Only</h3>
          <p class="muted small">Switch to Team Admin Tools or sign in with the approved admin account.</p>
          <button class="btn secondary" type="button" data-nav="more">Back to Manage</button>
        </section>
      </section>
    `);
  }

  const impactTotal = calculateGameImpact(PROMO_DEMO_STEPS.map((step) => ({ statType: step.stat }))).score;
  const lacrossePoints = PROMO_DEMO_STEPS.filter((step) => ["goal", "assist"].includes(step.stat)).length;
  const cycleStyle = `--promo-step-count: ${PROMO_DEMO_STEPS.length}; --promo-step-duration: ${PROMO_STEP_DURATION_SECONDS}s; --promo-cycle: ${PROMO_CYCLE_SECONDS}s;`;

  return renderShell(`
    <section class="screen-title">
      <h2>Promo Recording Demo</h2>
      <p>Screen-record this looping demo, then place your real lacrosse footage over the left panel in Canva, CapCut, or iMovie.</p>
    </section>

    <section class="stack promo-recording-screen" style="${cycleStyle}">
      <section class="card pad promo-instructions-card">
        <div>
          <h3>Recording Tip</h3>
          <p class="muted small">Start recording, wait for the loop to restart at Ground Ball, then trim the clip to the cleanest 18-20 seconds.</p>
        </div>
        <div class="promo-action-row">
          <button class="mini-btn light" type="button" data-nav="launchKit">Launch Kit</button>
          <button class="mini-btn" type="button" data-action="restart-promo-demo">Restart Loop</button>
        </div>
      </section>

      <section class="promo-recording-frame" aria-label="LaxHornet promotional recording frame">
        <div class="promo-field-panel">
          <div class="promo-field-lines" aria-hidden="true"></div>
          <div class="promo-player-marker" aria-hidden="true"></div>
          <div class="promo-field-copy">
            <strong>Follow one player through the shift</strong>
          </div>
          <div class="promo-caption-stack">
            ${PROMO_DEMO_STEPS.map(
              (step, index) => `
                <article class="promo-caption" style="--promo-step: ${index};">
                  <span>On-field moment</span>
                  <strong>${escapeHTML(step.field)}</strong>
                  <small>${escapeHTML(step.caption)}</small>
                </article>
              `,
            ).join("")}
          </div>
        </div>

        <div class="promo-phone-shell">
          <div class="promo-phone-top">
            <span>LaxHornet Live Game</span>
            <strong>CT Blazers vs Rival</strong>
          </div>
          <div class="period-tabs promo-period-tabs" role="group" aria-label="Demo period selector">
            <button class="period-tab active" type="button">Q1</button>
            <button class="period-tab" type="button">Q2</button>
            <button class="period-tab" type="button">Q3</button>
            <button class="period-tab" type="button">Q4</button>
          </div>
          <section class="live-summary" aria-label="Demo game summary">
            <div class="live-pill">${renderImpactGrade(impactTotal)}<span>Game Impact</span></div>
            <div class="live-pill"><strong>${lacrossePoints}</strong><span>Points</span></div>
            <div class="live-pill"><strong>${PROMO_DEMO_STEPS.length}</strong><span>Events</span></div>
          </section>
          ${renderLiveStatGroups({ demo: true, interactive: false, stepByKey: PROMO_STEP_BY_KEY })}
          <section class="promo-log-card">
            <h3>Recent Log</h3>
            ${PROMO_DEMO_STEPS.slice(-4).reverse().map((step, index) => {
              const stat = STAT_BY_KEY[step.stat];
              return `
                <div class="promo-log-row ${stat?.tone || "neutral"}" style="--promo-log-index: ${index};">
                  <span>${escapeHTML(stat?.label || step.caption)}</span>
                  <strong>${pointText(stat?.points || 0)}</strong>
                </div>
              `;
            }).join("")}
          </section>
        </div>
      </section>
    </section>
  `, { hideNav: true });
}

function renderLaunchKitPage() {
  if (!isPlatformReviewer()) {
    return renderShell(`
      <section class="screen-title">
        <h2>Launch Kit</h2>
        <p>Admin access is required to view launch materials.</p>
      </section>
      <section class="stack">
        <section class="card pad">
          <h3>Admin Only</h3>
          <p class="muted small">Switch to Team Admin Tools or sign in with the approved admin account.</p>
          <button class="btn secondary" type="button" data-nav="more">Back to Manage</button>
        </section>
      </section>
    `);
  }

  return renderShell(`
    <section class="screen-title">
      <h2>Launch Kit</h2>
      <p>Open, download, and share LaxHornet parent launch materials.</p>
    </section>

    <section class="stack">
      <section class="card pad launch-kit-hero-card">
        <div>
          <h3>Team Launch Files</h3>
          <p class="muted small">Use these for parent emails, team chats, printed handouts, QR sharing, and admin setup.</p>
        </div>
        <div class="launch-kit-actions">
          <button class="mini-btn light" type="button" data-nav="promoDemo">Promo Demo</button>
          <a class="mini-btn" href="LaxHornet-launch-kit.zip" download>Download ZIP</a>
        </div>
      </section>

      ${LAUNCH_KIT_GROUPS.map(
        (group) => `
          <section class="card pad launch-kit-group">
            <div>
              <h3>${escapeHTML(group.title)}</h3>
              <p class="muted small">${escapeHTML(group.description)}</p>
            </div>
            <div class="launch-file-grid">
              ${group.files.map(renderLaunchKitFile).join("")}
            </div>
          </section>
        `,
      ).join("")}
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
      <h2>Request sent. Your team admin needs to approve access.</h2>
      <p>You can come back here after approval and log in to start tracking the verified player.</p>
    </section>

    <section class="stack">
      <div class="card pad account-success-card">
        <h3>What Happens Next</h3>
        <p class="muted small">A team admin will review your team code and player jersey number. Once approved, this account will only show the rostered player matching that request.</p>
        <div class="request-summary">
          ${summary.email ? `<div><span>Email</span><strong>${escapeHTML(summary.email)}</strong></div>` : ""}
          ${fullName ? `<div><span>Name</span><strong>${escapeHTML(fullName)}</strong></div>` : ""}
          ${summary.teamAccessCode ? `<div><span>Team code</span><strong>${escapeHTML(summary.teamAccessCode)}</strong></div>` : ""}
          ${summary.childJerseyNumber ? `<div><span>Jersey #</span><strong>${escapeHTML(summary.childJerseyNumber)}</strong></div>` : ""}
        </div>
        <p class="muted small">Check your inbox for account verification. After approval, log in with this email and password to open your player&apos;s tracker.</p>
        <div class="account-actions">
          <button class="btn positive" type="button" data-nav="home">Check Approval Status</button>
          <button class="btn secondary" type="button" data-nav="tutorial">Open Tracker Guide</button>
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
        <h3>2. Sign In To Save Your Stats</h3>
        <p class="muted small">Use a User Profile when you want games saved to your account. Each approved player/team context stays separate, while team roster stats can stay connected across approved parent accounts.</p>
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
        <p class="muted small">After a game, open Game Review to edit events, correct notes, add tags, and check Game Impact, Effort Score, Faceoff %, Save %, and shooting percentages. Season Dashboard shows Average Impact across saved games. Past Games follows the active player, so switch players when you want another player's totals.</p>
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
  if (state.authUser) recoverAdminTeamContext();
  const screens = {
    home: renderHome,
    authSuccess: renderAuthSuccess,
    requestSubmitted: renderRequestSubmitted,
    profileSetup: renderProfileSetup,
    more: renderMore,
    player: renderPlayerPage,
    team: renderTeamPage,
    teamAccess: renderTeamAccess,
    launchKit: renderLaunchKitPage,
    promoDemo: renderPromoDemoPage,
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
      showToast("Verify your player before tracking");
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

  if (form.dataset.form === "event-add") {
    const game = state.games.find((item) => item.id === form.dataset.gameId);
    if (!game) return;
    if (!canEditGame(game)) {
      showToast("View-only team access");
      return;
    }

    const stat = STAT_BY_KEY[formData.get("statType")];
    if (!stat) return;

    const newEvent = {
      id: uid("event"),
      gameId: game.id,
      userId: game.userId || currentUserId() || "",
      teamId: gameTeamId(game),
      rosterPlayerId: gameRosterPlayerId(game),
      timestamp: new Date().toISOString(),
      quarter: formData.get("quarter") || periodsForGame(game)[0],
      statType: stat.key,
      statLabel: stat.label,
      category: stat.category,
      pointValue: stat.points,
      tags: [],
      note: formData.get("note")?.trim() || "",
      fieldZone: "",
      correctedAt: new Date().toISOString(),
    };

    state.addingReviewEvent = false;
    state.editingEventId = null;
    state.tagEditingEventId = null;
    saveReviewedGame({ ...game, events: [...game.events, newEvent] }, "Event added");
    render();
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
    if (action.dataset.action === "add-review-event") {
      const game = currentReviewGame();
      if (game && !canEditGame(game)) {
        showToast("View-only team access");
        return;
      }
      state.addingReviewEvent = true;
      state.editingEventId = null;
      state.tagEditingEventId = null;
      state.tagDraftTags = [];
      state.editingGameDetails = false;
      render();
      document.querySelector(".edit-event-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (action.dataset.action === "cancel-add-event") {
      state.addingReviewEvent = false;
      render();
    }
    if (action.dataset.action === "edit-game-details") {
      const game = currentReviewGame();
      if (game && !canEditGame(game)) {
        showToast("View-only team access");
        return;
      }
      state.editingGameDetails = true;
      state.addingReviewEvent = false;
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
    if (action.dataset.action === "install-app") installApp();
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
    if (action.dataset.action === "toggle-edit-player") {
      state.teamEditPlayerExpanded = !state.teamEditPlayerExpanded;
      render();
    }
    if (action.dataset.action === "toggle-add-player") {
      state.teamAddPlayerExpanded = !state.teamAddPlayerExpanded;
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
    if (action.dataset.action === "restart-promo-demo") {
      render();
      showToast("Promo loop restarted");
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
    state.addingReviewEvent = false;
    state.editingGameDetails = false;
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
    state.addingReviewEvent = false;
    state.editingGameDetails = false;
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

function reloadWithFreshMarker() {
  const url = new URL(window.location.href);
  url.searchParams.set("fresh", `${APP_VERSION}-update-${Date.now()}`);
  window.location.replace(url.toString());
}

async function clearLaxHornetCaches() {
  if (!("caches" in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.filter((key) => key.startsWith("laxhornet-")).map((key) => caches.delete(key)));
}

async function applyAppUpdate() {
  state.updateAvailable = true;
  state.updateInstalling = true;
  render();

  try {
    const registration = serviceWorkerRegistration || (await navigator.serviceWorker?.getRegistration?.());
    if (registration) {
      serviceWorkerRegistration = registration;
      await registration.update().catch(() => {});
      const worker = waitingServiceWorker || registration.waiting;
      if (worker) {
        waitingServiceWorker = worker;
        worker.postMessage({ type: "SKIP_WAITING" });
        window.setTimeout(() => {
          if (!reloadingForUpdate) {
            reloadingForUpdate = true;
            reloadWithFreshMarker();
          }
        }, 1500);
        return;
      }
    }

    await clearLaxHornetCaches();
    const registrations = await navigator.serviceWorker?.getRegistrations?.();
    if (registrations?.length) {
      await Promise.all(registrations.map((registration) => registration.unregister().catch(() => false)));
    }
  } catch {
    // If the service worker update path fails, a fresh URL reload is still the safest user action.
  }

  reloadingForUpdate = true;
  reloadWithFreshMarker();
}

async function initApp() {
  if (supabaseClient) {
    const { data } = await supabaseClient.auth.getSession();
    setAuthUser(data.session?.user || null);
    state.syncStatus = state.authUser ? "Signed in" : "Signed out";
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
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  if (!state.authUser) render();
});
window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  state.installInstructionsVisible = false;
  showToast("LaxHornet saved to home screen");
});
registerServiceWorker();
initApp();
