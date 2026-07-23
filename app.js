window.LAXHORNET_SCRIPT_ORDER = [...(window.LAXHORNET_SCRIPT_ORDER || []), "app"];

const STORAGE_KEYS = {
  player: "laxhornet.playerSettings",
  players: "laxhornet.players",
  activePlayerId: "laxhornet.activePlayerId",
  games: "laxhornet.games",
  deletedGames: "laxhornet.deletedGames",
  deletedEvents: "laxhornet.deletedEvents",
  activeGame: "laxhornet.activeGame",
  trackingSession: "laxhornet.trackingSession",
  reviewGameId: "laxhornet.reviewGameId",
  teams: "laxhornet.teams",
  rosterPlayers: "laxhornet.rosterPlayers",
  activeTeamId: "laxhornet.activeTeamId",
  teamAccessRequests: "laxhornet.teamAccessRequests",
  playerClaims: "laxhornet.playerClaims",
  removedPlayerAccess: "laxhornet.removedPlayerAccess",
  adminViewMode: "laxhornet.adminViewMode",
  onboardingIntent: "laxhornet.onboardingIntent",
  nextGameFocus: "laxhornet.nextGameFocus",
  familyRecapFocus: "laxhornet.familyRecapFocus",
  trustSpineSync: "laxhornet.trustSpineSync.v1",
};

const RUNTIME_CONFIG = window.LAXHORNET_RUNTIME_CONFIG || {};
const SUPABASE_CONFIG = {
  url: RUNTIME_CONFIG.supabaseUrl || "https://ulbmjcvnyznvmjgpstno.supabase.co",
  publishableKey: RUNTIME_CONFIG.supabasePublishableKey || "sb_publishable_-RUc79OPosRLNP5B6JIH2A_f3I_2A0M",
};
const TRUSTED_DISCLOSURE_FEATURES = Object.freeze({
  publicLiveShareRpc: RUNTIME_CONFIG.publicLiveShareRpc === true,
  liveShareTokenRpc: RUNTIME_CONFIG.liveShareTokenRpc === true,
  exportAuditRpc: RUNTIME_CONFIG.exportAuditRpc === true,
});
const REQUIRED_SCHEMA_CAPABILITY = Number(RUNTIME_CONFIG.minimumSchemaCapability || 1);
const BACKEND_CAPABILITY_CACHE_MS = 60 * 1000;
const SECURE_DISCLOSURE_RUNTIME_READY = Object.values(TRUSTED_DISCLOSURE_FEATURES).every(Boolean);
const GAME_SCOPE_TYPES = Object.freeze({
  TEAM_ROSTER: "team_roster",
  PERSONAL: "personal",
});
const PUBLIC_LIVE_SHARE_POLL_MS = 4000;

const PLATFORM_REVIEWER_EMAIL = "degrassed@gmail.com";
const APP_VERSION = "v283";
window.LAXHORNET_DISCLOSURE_STATUS = Object.freeze({
  appVersion: APP_VERSION,
  ready: SECURE_DISCLOSURE_RUNTIME_READY,
  features: TRUSTED_DISCLOSURE_FEATURES,
  requiredSchemaCapability: REQUIRED_SCHEMA_CAPABILITY,
});

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

const STAT_EDUCATION = {
  goal: {
    label: "Goal",
    meaning: "A possession finished with a score.",
    why: "Goals matter because they reward the work that came before them: winning the ball, moving it, and getting to a dangerous area.",
    focus: "Keep getting to good spots, then add one support play like a feed, ride, or ground ball to round out the impact.",
  },
  assist: {
    label: "Assist",
    meaning: "A pass or feed that directly creates a goal.",
    why: "Assists show vision and timing. They turn a teammate's cut or dodge into a better scoring chance.",
    focus: "Keep your head up after pressure and move the ball before the defense fully recovers.",
  },
  shot: {
    label: "Missed Shot",
    meaning: "A shot attempt that misses the cage.",
    why: "Missed shots still show offensive involvement, but they also help reveal when shot quality can improve.",
    focus: "Look for higher-quality shots by changing angle, getting closer, or moving the ball one more time.",
  },
  shotOnGoal: {
    label: "Shot on Goal",
    meaning: "A shot that forces the goalie to make a save or goes into the cage.",
    why: "Shots on goal force the defense and goalie to react. They can create rebounds, backups, and unsettled chances.",
    focus: "Aim for spots that make the goalie move, and be ready for the rebound or backed-up shot.",
  },
  goalieSave: {
    label: "Save",
    meaning: "A goalie stop that prevents a scoring chance from becoming a goal.",
    why: "A save protects the scoreboard, but it can also become the first play of the next possession.",
    focus: "Recover quickly, organize the clear, and find the safest outlet.",
  },
  goalAllowed: {
    label: "Goal Allowed",
    meaning: "An opponent shot that scores.",
    why: "Goals allowed give context for the pressure the goalie and defense faced, especially when shot quality varies.",
    focus: "Reset quickly, communicate the next coverage, and prepare for the next save or outlet.",
  },
  faceoffWin: {
    label: "Faceoff Win",
    meaning: "A won faceoff or draw that gives your team the ball.",
    why: "Faceoff wins create immediate possession. The next step is turning that win into controlled offense.",
    focus: "Win the clamp or loose ball, then make the first clean pass before pressure arrives.",
  },
  faceoffLoss: {
    label: "Faceoff Loss",
    meaning: "A faceoff or draw where the other team gains possession.",
    why: "Tracking losses helps show the possession battle and where wing support or ground-ball follow-up can help.",
    focus: "Compete through the loose ball, communicate with wings, and be ready to defend the next possession.",
  },
  groundBall: {
    label: "Ground Ball",
    meaning: "A loose-ball pickup that helps your team gain or keep possession.",
    why: "Ground balls create extra chances and often decide who controls the game before the scoreboard shows it.",
    focus: "Get low, move through the ball, and secure the first clean pass before looking upfield.",
  },
  turnover: {
    label: "Turnover",
    meaning: "A possession that changes to the other team.",
    why: "Turnovers show where pressure, spacing, or decision speed affected the possession.",
    focus: "Move the ball earlier, use the nearest outlet, and recover quickly into the next play.",
  },
  causedTurnover: {
    label: "Caused Turnover",
    meaning: "A defensive play that helps force the opponent to lose possession.",
    why: "Caused turnovers disrupt rhythm and can turn opponent pressure into a new possession.",
    focus: "Keep body position first, then use smart stick pressure to force rushed decisions.",
  },
  defensiveStop: {
    label: "Defensive Stop",
    meaning: "A play that prevents an opponent from turning possession into a quality chance.",
    why: "Defensive stops show positioning, communication, and team defense beyond the box score.",
    focus: "End the stop with a clean pickup, outlet, or recovery to the next threat.",
  },
  successfulClear: {
    label: "Successful Clear",
    meaning: "A clean move from defense into offense while keeping possession.",
    why: "Clears protect possession after pressure. A clean clear turns defense into offense.",
    focus: "Find the safest outlet first, then move the ball before the ride arrives.",
  },
  failedClear: {
    label: "Failed Clear",
    meaning: "A clear attempt where the other team gets the ball back.",
    why: "Failed clears show where pressure disrupted possession and where support or spacing can improve.",
    focus: "Use width, talk early, and give the ball carrier a simple outlet.",
  },
  hustlePlay: {
    label: "Hustle Play",
    meaning: "An effort play that helps the team even if it does not appear in a traditional stat line.",
    why: "Hustle plays show effort away from the scoreboard. They often create the extra chance that leads to a bigger moment later.",
    focus: "Keep sprinting through the play, then turn the effort into a controlled possession.",
  },
  backedUpShot: {
    label: "Backed Up Shot",
    meaning: "A hustle play to the endline or sideline that helps retain possession after a shot.",
    why: "Backing up shots protects offensive possessions and gives the team another chance to attack.",
    focus: "Anticipate the shot path early and beat the defender to the endline or sideline.",
  },
  smartPlay: {
    label: "Smart Play",
    meaning: "A decision that helps the team stay organized, safe, or connected.",
    why: "Smart plays show awareness, timing, and decision-making. They help a player grow even without a traditional stat.",
    focus: "Recognize the simple play early, communicate it, and keep the possession connected.",
  },
  penalty: {
    label: "Penalty",
    meaning: "A rule infraction that affects possession, field position, or personnel.",
    why: "Penalties show how discipline, footwork, and positioning affect team flow.",
    focus: "Keep feet moving, stay balanced, and compete with controlled contact.",
  },
  note: {
    label: "Note",
    meaning: "A quick observation for game review.",
    why: "Notes can add context to development moments that a button alone cannot explain.",
    focus: "Keep notes simple, supportive, and focused on development.",
  },
};

const STAT_EDUCATION_PRIORITY = {
  goal: 10,
  assist: 9,
  goalieSave: 9,
  groundBall: 8,
  causedTurnover: 8,
  faceoffWin: 8,
  defensiveStop: 7,
  successfulClear: 7,
  backedUpShot: 7,
  shotOnGoal: 6,
  hustlePlay: 6,
  smartPlay: 6,
  turnover: 5,
  failedClear: 5,
  shot: 4,
  goalAllowed: 4,
  faceoffLoss: 4,
  penalty: 3,
  note: 1,
};

const NEXT_GAME_FOCUS_OPTIONS = [
  { value: "win-possession", label: "Turn ground balls into clean possessions" },
  { value: "protect-ball", label: "Move the ball before pressure arrives" },
  { value: "shot-selection", label: "Look for higher-quality shots" },
  { value: "communicate", label: "Communicate earlier on defense" },
  { value: "start-faster", label: "Start the next shift ready" },
  { value: "off-ball", label: "Stay involved off-ball" },
  { value: "support-teammates", label: "Support the next play" },
  { value: "custom", label: "Custom focus" },
];

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

const LIVE_DEFAULT_STAT_KEYS = {
  attack: ["goal", "assist", "shotOnGoal", "shot", "groundBall", "turnover", "hustlePlay", "smartPlay", "note"],
  midfield: ["groundBall", "goal", "assist", "shotOnGoal", "causedTurnover", "successfulClear", "failedClear", "turnover", "hustlePlay", "smartPlay"],
  defense: ["groundBall", "causedTurnover", "defensiveStop", "successfulClear", "failedClear", "turnover", "hustlePlay", "smartPlay", "note"],
  goalie: ["goalieSave", "goalAllowed", "successfulClear", "failedClear", "groundBall", "turnover", "smartPlay", "note"],
  faceoff: ["faceoffWin", "faceoffLoss", "groundBall", "turnover", "causedTurnover", "hustlePlay", "smartPlay", "note"],
  default: ["goal", "assist", "shotOnGoal", "shot", "groundBall", "turnover", "causedTurnover", "successfulClear", "failedClear", "hustlePlay", "smartPlay", "note"],
};

const FIELD_ZONE_OPTIONS = ["", "Offensive end", "Midfield", "Defensive end", "Sideline", "Endline", "Crease"];

const PROCESS_DECISION_TAGS = {
  createdAdvantage: "Created Advantage",
  extendedPossession: "Extended Possession",
  supportedBallCarrier: "Supported Ball Carrier",
  forcedDefensiveRotation: "Forced Defensive Rotation",
  recognizedTransition: "Recognized Transition",
  protectedMiddle: "Protected the Middle",
  recoveredAfterMistake: "Recovered After Mistake",
  goodDecisionUnsuccessfulExecution: "Good Decision, Unsuccessful Execution",
  poorDecisionSuccessfulOutcome: "Poor Decision, Successful Outcome",
  wonSecondEffort: "Won the Second Effort",
  communicatedEarly: "Communicated Early",
  stayedComposedUnderPressure: "Stayed Composed Under Pressure",
};

const PROCESS_DECISION_TAG_VALUES = Object.values(PROCESS_DECISION_TAGS);
const PRIVATE_REVIEW_TAGS = new Set(PROCESS_DECISION_TAG_VALUES.map((tag) => tag.toLowerCase()));

const PROCESS_TAGS_BY_STAT = {
  goal: ["createdAdvantage", "supportedBallCarrier", "poorDecisionSuccessfulOutcome"],
  assist: ["createdAdvantage", "supportedBallCarrier", "forcedDefensiveRotation", "recognizedTransition"],
  shot: ["createdAdvantage", "goodDecisionUnsuccessfulExecution", "poorDecisionSuccessfulOutcome"],
  shotOnGoal: ["createdAdvantage", "goodDecisionUnsuccessfulExecution", "poorDecisionSuccessfulOutcome"],
  goalieSave: ["recognizedTransition", "communicatedEarly", "stayedComposedUnderPressure"],
  goalAllowed: ["stayedComposedUnderPressure", "recoveredAfterMistake"],
  faceoffWin: ["extendedPossession", "wonSecondEffort", "recognizedTransition"],
  faceoffLoss: ["wonSecondEffort", "recoveredAfterMistake", "stayedComposedUnderPressure"],
  groundBall: ["extendedPossession", "wonSecondEffort", "stayedComposedUnderPressure"],
  turnover: ["goodDecisionUnsuccessfulExecution", "poorDecisionSuccessfulOutcome", "recoveredAfterMistake"],
  causedTurnover: ["protectedMiddle", "communicatedEarly", "wonSecondEffort"],
  defensiveStop: ["protectedMiddle", "communicatedEarly", "stayedComposedUnderPressure"],
  successfulClear: ["extendedPossession", "recognizedTransition", "communicatedEarly", "stayedComposedUnderPressure"],
  failedClear: ["goodDecisionUnsuccessfulExecution", "recoveredAfterMistake", "stayedComposedUnderPressure"],
  hustlePlay: ["wonSecondEffort", "recoveredAfterMistake", "extendedPossession"],
  backedUpShot: ["extendedPossession", "wonSecondEffort", "recognizedTransition"],
  smartPlay: ["createdAdvantage", "supportedBallCarrier", "recognizedTransition", "communicatedEarly", "stayedComposedUnderPressure"],
  penalty: ["stayedComposedUnderPressure", "recoveredAfterMistake"],
  note: ["goodDecisionUnsuccessfulExecution", "createdAdvantage", "recoveredAfterMistake", "stayedComposedUnderPressure"],
};

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
const ONBOARDING_INTENTS = {
  child: {
    label: "I'm tracking my child",
    description: "Request player access and track only the approved player.",
  },
  roster: {
    label: "I'm managing a team roster",
    description: "Team roster tools require approved admin access.",
  },
  both: {
    label: "I'm both",
    description: "Use parent tracking now, and admin tools when approved.",
  },
};

const app = document.querySelector("#app");
const startupParams = new URLSearchParams(window.location.search);
const startupShareCode = startupParams.get("share")?.trim().toUpperCase() || "";
const startupAuthStatus = startupParams.get("auth") || "";
const startupOpenTarget = startupParams.get("open")?.trim().toLowerCase() || "";
const startupTeamId = startupParams.get("team")?.trim().slice(0, 160) || "";
const startupRequestId = startupParams.get("request")?.trim().slice(0, 200) || "";
const rawSupabaseClient =
  window.supabase?.createClient && SUPABASE_CONFIG.url && SUPABASE_CONFIG.publishableKey
    ? window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.publishableKey)
    : null;
const supabaseClient =
  rawSupabaseClient?.auth?.signInWithPassword && rawSupabaseClient?.auth?.signUp
    ? rawSupabaseClient
    : null;
const supabaseClientLoadIssue = Boolean(rawSupabaseClient && !supabaseClient);

let sharedGameChannel = null;
let sharedGamePollTimer = null;
let trustSpineSyncInFlight = null;
let gameEventOperationService = null;
let backendCapabilityState = {
  value: null,
  checkedAt: 0,
  error: "",
};
let lastSyncErrorAt = 0;
let activeStorageUserId = "";
let waitingServiceWorker = null;
let reloadingForUpdate = false;
let serviceWorkerRegistration = null;
let deferredInstallPrompt = null;
let startupDeepLinkHandled = false;
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
  removedPlayerAccess: initialStoredState.removedPlayerAccess,
  games: initialStoredState.games,
  activeGame: initialStoredState.activeGame,
  trackingSession: initialStoredState.trackingSession,
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
  watchShareTouched: false,
  teamRosterExpanded: true,
  teamEditPlayerExpanded: false,
  teamAddPlayerExpanded: false,
  teamAccessExpanded: false,
  exportToolsExpanded: false,
  exportDialog: null,
  pendingImport: null,
  helpExpanded: false,
  adminViewMode: initialStoredState.adminViewMode,
  onboardingIntent: initialStoredState.onboardingIntent,
  nextGameFocus: initialStoredState.nextGameFocus,
  trustSpineSync: initialStoredState.trustSpineSync,
  focusEditorContext: "",
  gameSetupReturnScreen: "home",
  signupDraft: null,
  accessRequestSummary: null,
  toast: "",
  updateAvailable: false,
  updateInstalling: false,
  availableVersion: "",
  authBusy: false,
  reminderBusyId: "",
  installInstructionsVisible: false,
  isOffline: window.navigator.onLine === false,
  pendingDeleteGameId: "",
  lastEventConfirmation: null,
  morePlaysExpanded: false,
  pendingEndGame: false,
  pendingCancelGame: false,
  gameSavedSummaryId: "",
  liveSharePromptGameId: "",
  pendingTeamAccessReview: null,
};

mergeRosterPlayersIntoPlayers();
if (initialStoredState.activePlayerId && state.players.some((player) => player.id === initialStoredState.activePlayerId)) {
  state.activePlayerId = initialStoredState.activePlayerId;
}
ensureActiveTeamRosterPlayer();
syncActivePlayer();
state.nextGameFocus = activeNextGameFocusForPlayer(state.player);
state.games = state.games.map((game) => normalizeGame(game, state.player));
state.activeGame = state.activeGame ? normalizeGame(state.activeGame, state.player) : null;
state.trackingSession = normalizeTrackingSession(state.trackingSession, state.activeGame);
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
    removedPlayerAccess: normalizeRemovedPlayerAccess(loadJSON(STORAGE_KEYS.removedPlayerAccess, [])),
    games: loadJSON(STORAGE_KEYS.games, []),
    activeGame: loadJSON(STORAGE_KEYS.activeGame, null),
    trackingSession: loadJSON(STORAGE_KEYS.trackingSession, null),
    reviewGameId: loadJSON(STORAGE_KEYS.reviewGameId, null),
    deletedGameIds: loadJSON(STORAGE_KEYS.deletedGames, []),
    deletedEventIds: loadJSON(STORAGE_KEYS.deletedEvents, []),
    onboardingIntent: loadJSON(STORAGE_KEYS.onboardingIntent, "child"),
    nextGameFocus: normalizeNextGameFocus(loadJSON(STORAGE_KEYS.nextGameFocus, null)),
    trustSpineSync: normalizeTrustSpineSyncState(loadJSON(STORAGE_KEYS.trustSpineSync, null)),
    adminViewMode,
  };
}

function normalizeTrustSpineSyncState(value = null) {
  const source = value && typeof value === "object" ? value : {};
  const records = source.events && typeof source.events === "object" ? source.events : {};
  const gameScopes = source.gameScopes && typeof source.gameScopes === "object" ? source.gameScopes : {};
  return {
    version: 1,
    gameScopes: Object.fromEntries(
      Object.entries(gameScopes)
        .filter(([gameId, scope]) => gameId && scope && typeof scope === "object")
        .map(([gameId, scope]) => [
          gameId,
          {
            gameId,
            accountId: String(scope.accountId || "").trim(),
            teamId: String(scope.teamId || "").trim(),
            rosterPlayerId: String(scope.rosterPlayerId || "").trim(),
            registeredAt: String(scope.registeredAt || "").trim(),
          },
        ]),
    ),
    events: Object.fromEntries(
      Object.entries(records)
        .filter(([eventId, record]) => eventId && record && typeof record === "object")
        .map(([eventId, record]) => [
          eventId,
          {
            accountId: String(record.accountId || "").trim(),
            teamId: String(record.teamId || "").trim(),
            rosterPlayerId: String(record.rosterPlayerId || "").trim(),
            gameId: String(record.gameId || "").trim(),
            eventId,
            serverEventVersion: Math.max(0, Number(record.serverEventVersion || 0)),
            lifecycleState: String(record.lifecycleState || "pending").trim(),
            acceptedEvidence:
              record.acceptedEvidence && typeof record.acceptedEvidence === "object"
                ? { ...record.acceptedEvidence }
                : {},
            pendingOperations: Array.isArray(record.pendingOperations)
              ? record.pendingOperations
                  .filter((operation) => operation && typeof operation === "object")
                  .map((operation) => ({
                    kind: String(operation.kind || "").trim(),
                    clientOperationId: String(operation.clientOperationId || "").trim(),
                    clientCreatedAt: String(operation.clientCreatedAt || "").trim(),
                    eventEvidence:
                      operation.eventEvidence && typeof operation.eventEvidence === "object"
                        ? { ...operation.eventEvidence }
                        : {},
                    rpcPayload:
                      operation.rpcPayload && typeof operation.rpcPayload === "object"
                        ? { ...operation.rpcPayload }
                        : null,
                    attempts: Math.max(0, Number(operation.attempts || 0)),
                    lastAttemptAt: String(operation.lastAttemptAt || "").trim(),
                    lastError: String(operation.lastError || "").trim(),
                  }))
                  .filter((operation) => operation.kind && operation.clientOperationId)
              : [],
            acceptedReceipts: Array.isArray(record.acceptedReceipts)
              ? record.acceptedReceipts.slice(-20)
              : [],
            conflict:
              record.conflict && typeof record.conflict === "object"
                ? { ...record.conflict }
                : null,
            lastError: String(record.lastError || "").trim(),
            updatedAt: String(record.updatedAt || "").trim(),
          },
        ]),
    ),
  };
}

function normalizeTrackingSession(session = null, activeGame = null) {
  const gameId = String(session?.gameId || session?.game_id || activeGame?.id || "").trim();
  if (!gameId || (activeGame?.id && gameId !== activeGame.id)) return null;
  const requestedOrigin = String(session?.origin || "").trim();
  const origin = ["new", "existing"].includes(requestedOrigin) ? requestedOrigin : "existing";
  return {
    gameId,
    origin,
    previousScreen: String(session?.previousScreen || "home").trim() || "home",
    startedAt: String(session?.startedAt || "").trim(),
    initialGameSnapshot:
      origin === "existing" && session?.initialGameSnapshot && typeof session.initialGameSnapshot === "object"
        ? session.initialGameSnapshot
        : null,
  };
}

function normalizeNextGameFocus(focus = null) {
  if (!focus || typeof focus !== "object") {
    return {
      focusType: "",
      focusText: "",
      sourceGameId: "",
      sourceGameDate: "",
      createdAt: "",
      status: "",
      accountId: "",
      teamId: "",
      startedGameId: "",
      startedAt: "",
      followUpResult: "",
      followUpGameId: "",
      followUpAt: "",
      sourceFocusText: "",
      sourceSelected: "",
      sourceCustomText: "",
      changedFromSourceAt: "",
      changedFromSourceText: "",
      changedFromSourceContext: "",
      selected: "",
      customText: "",
      text: "",
      gameId: "",
      playerId: "",
      rosterPlayerId: "",
      updatedAt: "",
    };
  }
  const focusText = String(focus.focusText || focus.text || "").trim();
  const sourceGameId = String(focus.sourceGameId || focus.gameId || "").trim();
  const createdAt = String(focus.createdAt || focus.updatedAt || "").trim();
  return {
    focusType: String(focus.focusType || focus.selected || "").trim(),
    focusText,
    sourceGameId,
    sourceGameDate: String(focus.sourceGameDate || "").trim(),
    createdAt,
    status: String(focus.status || (focusText ? "open" : "")).trim(),
    accountId: String(focus.accountId || "").trim(),
    teamId: String(focus.teamId || "").trim(),
    startedGameId: String(focus.startedGameId || "").trim(),
    startedAt: String(focus.startedAt || "").trim(),
    followUpResult: String(focus.followUpResult || "").trim(),
    followUpGameId: String(focus.followUpGameId || "").trim(),
    followUpAt: String(focus.followUpAt || "").trim(),
    sourceFocusText: String(focus.sourceFocusText || "").trim(),
    sourceSelected: String(focus.sourceSelected || "").trim(),
    sourceCustomText: String(focus.sourceCustomText || "").trim(),
    changedFromSourceAt: String(focus.changedFromSourceAt || "").trim(),
    changedFromSourceText: String(focus.changedFromSourceText || "").trim(),
    changedFromSourceContext: String(focus.changedFromSourceContext || "").trim(),
    selected: String(focus.selected || "").trim(),
    customText: String(focus.customText || "").trim(),
    text: focusText,
    gameId: sourceGameId,
    playerId: String(focus.playerId || "").trim(),
    rosterPlayerId: String(focus.rosterPlayerId || "").trim(),
    updatedAt: String(focus.updatedAt || createdAt).trim(),
  };
}

function focusStorageSegment(value = "none") {
  return String(value || "none")
    .trim()
    .replace(/[^a-z0-9_-]+/gi, "_")
    .slice(0, 80) || "none";
}

function focusAccountId() {
  return currentUserId?.() || activeStorageUserId || "device";
}

function nextGameFocusStorageKey(player = state?.player) {
  const normalized = normalizePlayer(player || DEFAULT_PLAYER);
  const teamId = normalized.teamId || "local";
  const rosterPlayerId = normalized.rosterPlayerId || normalized.id || "player";
  return [
    "laxhornet.nextGameFocus.v2",
    `user.${focusStorageSegment(focusAccountId())}`,
    `team.${focusStorageSegment(teamId)}`,
    `player.${focusStorageSegment(rosterPlayerId)}`,
  ].join(".");
}

function loadScopedNextGameFocus(player = state.player) {
  try {
    return normalizeNextGameFocus(JSON.parse(localStorage.getItem(nextGameFocusStorageKey(player)) || "null"));
  } catch {
    return normalizeNextGameFocus(null);
  }
}

function saveScopedNextGameFocus(focus, player = state.player) {
  const normalized = normalizeNextGameFocus(focus);
  const key = nextGameFocusStorageKey(player);
  if (!normalized.text) {
    localStorage.removeItem(key);
    return normalized;
  }
  localStorage.setItem(key, JSON.stringify(normalized));
  return normalized;
}

function activeNextGameFocusForPlayer(player = state.player) {
  const scoped = loadScopedNextGameFocus(player);
  if (scoped.text) return scoped;
  const legacy = normalizeNextGameFocus(state?.nextGameFocus);
  return nextGameFocusMatchesPlayer(legacy, player) ? legacy : normalizeNextGameFocus(null);
}

function nextGameFocusMatchesPlayer(focus = null, player = state.player) {
  const saved = normalizeNextGameFocus(focus);
  if (!saved.text) return false;
  const normalized = normalizePlayer(player);
  const playerId = normalized.id || "";
  const rosterPlayerId = normalized.rosterPlayerId || "";
  const teamId = normalized.teamId || "";
  if (saved.playerId && playerId && saved.playerId !== playerId) return false;
  if (saved.rosterPlayerId && rosterPlayerId && saved.rosterPlayerId !== rosterPlayerId) return false;
  if (saved.teamId && teamId && saved.teamId !== teamId) return false;
  return true;
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

function normalizeRemovedPlayerAccessItem(item = {}) {
  return {
    teamId: item.teamId || item.team_id || "",
    rosterPlayerId: item.rosterPlayerId || item.roster_player_id || item.id || "",
    jerseyNumber: String(item.jerseyNumber || item.jersey_number || item.number || "").trim(),
    playerName: String(item.playerName || item.player_name || item.name || "").trim(),
    removedAt: item.removedAt || item.removed_at || new Date().toISOString(),
  };
}

function removedPlayerAccessKey(teamId = "", rosterPlayerId = "", jerseyNumber = "") {
  const team = String(teamId || "").trim();
  const roster = String(rosterPlayerId || "").trim();
  const jersey = String(jerseyNumber || "").trim();
  if (!team || (!roster && !jersey)) return "";
  return `${team}|${roster || `jersey:${jersey}`}`;
}

function normalizeRemovedPlayerAccess(items = []) {
  const merged = new Map();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const normalized = normalizeRemovedPlayerAccessItem(item);
    const key = removedPlayerAccessKey(normalized.teamId, normalized.rosterPlayerId, normalized.jerseyNumber);
    if (key) merged.set(key, { ...merged.get(key), ...normalized });
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
  state.playerClaims = normalizePlayerClaims(state.playerClaims).filter(
    (claim) => !isPlayerAccessRemoved(claim.teamId, claim.rosterPlayerId),
  );
  state.rosterPlayers = normalizeRosterPlayers(
    state.rosterPlayers.filter((player) => {
      const normalized = normalizeRosterPlayer(player);
      if (!cloudTeamIds.has(normalized.teamId)) return false;
      if (isPlatformReviewer()) return true;
      if (isPlayerAccessRemoved(normalized.teamId, normalized.id, normalized.number)) return false;
      return hasPlayerClaim(normalized.teamId, normalized.id);
    }),
  );
  state.games = state.games.filter(canShowGameForCurrentAccess);
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
  if (isPlayerAccessRemoved(teamId, rosterPlayerId)) return false;
  return state.playerClaims.some((claim) => claim.teamId === teamId && claim.rosterPlayerId === rosterPlayerId);
}

function teamHasVerifiedPlayerAccess(teamId) {
  if (!teamId) return false;
  return state.playerClaims.some((claim) => claim.teamId === teamId && !isPlayerAccessRemoved(claim.teamId, claim.rosterPlayerId));
}

function ownTeamAccessRequests() {
  return state.teamAccessRequests.filter((request) => request.userId === currentUserId());
}

function isPlayerAccessRemoved(teamId = "", rosterPlayerId = "", jerseyNumber = "") {
  if (isPlatformReviewer()) return false;
  const exactKey = removedPlayerAccessKey(teamId, rosterPlayerId, jerseyNumber);
  const jerseyKey = removedPlayerAccessKey(teamId, "", jerseyNumber);
  return normalizeRemovedPlayerAccess(state.removedPlayerAccess).some((item) => {
    const itemKey = removedPlayerAccessKey(item.teamId, item.rosterPlayerId, item.jerseyNumber);
    return itemKey && (itemKey === exactKey || (!!jerseyKey && itemKey === jerseyKey));
  });
}

function removedAccessForPlayer(player = {}) {
  const normalized = normalizePlayer(player);
  const rosterPlayerId = normalized.rosterPlayerId || normalized.id;
  if (!normalized.teamId || !rosterPlayerId) return null;
  return normalizeRemovedPlayerAccessItem({
    teamId: normalized.teamId,
    rosterPlayerId,
    jerseyNumber: normalized.number,
    playerName: normalized.name,
    removedAt: new Date().toISOString(),
  });
}

function requestAccessRemoved(request = {}) {
  const rosterPlayer = requestedRosterPlayerForAccess(request);
  return isPlayerAccessRemoved(request.teamId, rosterPlayer?.id || "", request.childJerseyNumber);
}

function playerClaimForRequest(request = {}) {
  if (!request.teamId || !request.userId) return null;
  if (requestAccessRemoved(request)) return null;
  return state.playerClaims.find((claim) => claim.teamId === request.teamId && claim.userId === request.userId) || null;
}

function requestNeedsPlayerVerification(request = {}) {
  return request.status === "approved" && !requestAccessRemoved(request) && !playerClaimForRequest(request);
}

function inferredClaimFromRosterPlayer(player = {}) {
  const normalized = normalizeRosterPlayer(player);
  const userId = currentUserId();
  if (!userId || !normalized.teamId || !normalized.id) return null;
  return normalizePlayerClaim({
    id: `claim-local-${normalized.teamId}-${userId}-${normalized.id}`,
    teamId: normalized.teamId,
    rosterPlayerId: normalized.id,
    userId,
    createdAt: new Date().toISOString(),
  });
}

function teamAccessStatusCopy(request = {}) {
  if (request.status === "pending") return "Waiting for team admin approval";
  if (requestAccessRemoved(request)) return "Player removed from this account";
  if (requestNeedsPlayerVerification(request)) return `Approved - verify player${request.childJerseyNumber ? ` #${request.childJerseyNumber}` : ""}`;
  if (request.status === "approved") return "Verified player access";
  if (request.status === "rejected") return "Request not approved";
  return request.status || "Request";
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

function canShowGameForCurrentAccess(game = {}) {
  const gameId = game.id || "";
  if (gameId && isDeletedGame(gameId)) return false;

  const teamId = gameTeamId(game);
  const rosterPlayerId = gameRosterPlayerId(game);
  const snapshot = gamePlayerSnapshot(game);
  if (teamId && isPlayerAccessRemoved(teamId, rosterPlayerId, snapshot.number)) return false;

  if (!cloudRosterModeEnabled() || isPlatformReviewer()) return true;
  if (!teamId) return !game.userId || game.userId === currentUserId();
  if (!rosterPlayerId) return false;
  return hasPlayerClaim(teamId, rosterPlayerId);
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

function playerFirstName(player = state.player) {
  const normalized = normalizePlayer(player);
  const name = String(normalized.name || "").trim();
  return name.split(/\s+/).filter(Boolean)[0] || "Player";
}

function possessiveName(name = "Player") {
  const clean = String(name || "Player").trim() || "Player";
  return /s$/i.test(clean) ? `${clean}'` : `${clean}'s`;
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

function gameScopeType(game = {}) {
  const explicit = String(game.scopeType || game.scope_type || "").trim().toLowerCase();
  if (Object.values(GAME_SCOPE_TYPES).includes(explicit)) return explicit;
  return gameTeamId(game) && gameRosterPlayerId(game)
    ? GAME_SCOPE_TYPES.TEAM_ROSTER
    : GAME_SCOPE_TYPES.PERSONAL;
}

function isTeamRosterGame(game = {}) {
  return gameScopeType(game) === GAME_SCOPE_TYPES.TEAM_ROSTER;
}

function isPersonalGame(game = {}) {
  return gameScopeType(game) === GAME_SCOPE_TYPES.PERSONAL;
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
  state.nextGameFocus = activeNextGameFocusForPlayer(state.player);
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

function normalizeOnboardingIntent(intent = "child") {
  const cleanIntent = String(intent || "").trim().toLowerCase();
  return ONBOARDING_INTENTS[cleanIntent] ? cleanIntent : "child";
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

async function setAdminViewMode(mode, options = {}) {
  if (!isReviewerAccount()) return;
  state.adminViewMode = mode === "tracker" ? "tracker" : "admin";
  if (isPlatformReviewer()) {
    if (options.screen) state.screen = options.screen;
    await loadCloudTeams({ silent: true });
    mergeRosterPlayersIntoPlayers();
    ensureActiveTeamRosterPlayer();
    syncActivePlayer();
  } else {
    mergeRosterPlayersIntoPlayers();
    const firstVisible = visiblePlayers()[0];
    if (firstVisible) {
      state.activePlayerId = firstVisible.id;
      state.player = firstVisible;
    }
    if (options.screen) state.screen = options.screen;
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

function displaySyncStatus(status = state.syncStatus) {
  const text = String(status || "").trim();
  if (state.isOffline) return "Will sync when online";
  if (state.cloudError) return "Sync needs attention";
  if (/synced|signed in|watching live/i.test(text)) return "Synced to your account";
  if (/saved on this phone|ready|no saved account games|signed out|account features unavailable/i.test(text)) return "Saved on this phone";
  if (/offline|waiting|will sync/i.test(text)) return "Will sync when online";
  if (/issue|error|failed|needs attention|setup|missing|approval required/i.test(text)) return "Sync needs attention";
  return text || "Saved on this phone";
}

function gameDayCloudStatus() {
  if (state.isOffline) return "Will sync when online";
  const label = displaySyncStatus();
  return label === "Sync needs attention" ? "Needs attention" : label;
}

function gameDayLiveShareStatus() {
  if (state.activeGame?.isShared) return "Active";
  return "Off";
}

function playerAccessStatus(player = state.player) {
  if (isTeamPlayer(player)) return canTrackPlayer(player) ? "Approved" : "Waiting for approval";
  return visiblePlayers().length ? "Approved" : "No approved player yet";
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

function liveTrackerPositionGroup(player = {}) {
  const position = String(player.position || "").toLowerCase();
  if (position.includes("goalie") || position.includes("goal")) return "goalie";
  if (position.includes("face") || position.includes("fogo")) return "faceoff";
  if (position.includes("attack")) return "attack";
  if (position.includes("mid")) return "midfield";
  if (position.includes("defense") || position.includes("lsm") || position.includes("ssdm")) return "defense";
  return "default";
}

function liveDefaultStatKeysForPlayer(player = {}) {
  return LIVE_DEFAULT_STAT_KEYS[liveTrackerPositionGroup(player)] || LIVE_DEFAULT_STAT_KEYS.default;
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
  if (!events.length) return "Record game events to calculate a LaxHornet Game Impact summary.";
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
    return `The recorded events include ${mistakes} possession-losing or goal-allowed event${mistakes === 1 ? "" : "s"} and no positive contribution-category value yet. The calculation uses the ${weightProfile.label || "player"} position weighting.`;
  }

  const biggest = activeBreakdowns.reduce((best, item) => (item.score > best.score ? item : best), activeBreakdowns[0]);

  if (biggest.key === "scoring" && scoringChances) {
    lines.push(
      efficiency >= 0.4
        ? `Scoring contributed the most recorded value: ${goals} goal${goals === 1 ? "" : "s"}, ${assists} assist${assists === 1 ? "" : "s"}, and the recorded shot outcomes.`
        : `Scoring events contributed the most recorded value, with ${missedShots} missed shot${missedShots === 1 ? "" : "s"} also included in the calculation.`,
    );
  } else if (biggest.key === "possession") {
    lines.push(`Possession contributed the most recorded value: ${extraPossessions} possession-changing play${extraPossessions === 1 ? "" : "s"} was included.`);
  } else if (biggest.key === "defense") {
    lines.push(`Defense contributed the most recorded value: ${defensiveWins} stop or caused-turnover event${defensiveWins === 1 ? "" : "s"} was included.`);
  } else if (biggest.key === "goalie") {
    lines.push(
      saveLooksStrong
        ? `Goalie events contributed the most recorded value, including ${saves} save${saves === 1 ? "" : "s"}.`
        : `Goalie events contributed the most recorded value, with ${saves} save${saves === 1 ? "" : "s"} and ${goalsAllowed} goal${goalsAllowed === 1 ? "" : "s"} allowed included.`,
    );
  } else {
    lines.push(`Effort and awareness contributed the most recorded value: ${hustle} manually recorded hustle, backed-up-shot, or smart-play event${hustle === 1 ? "" : "s"} was included.`);
  }

  if (faceoffAttempts) {
    lines.push(`The recorded faceoff line was ${faceoffWins}-${faceoffAttempts}; those outcomes are included as possession inputs.`);
  } else if (extraPossessions) {
    lines.push(`${extraPossessions} recorded possession swing${extraPossessions === 1 ? "" : "s"} came from ground balls, clears, backed-up shots, or defensive pressure.`);
  }

  if (mistakes) {
    lines.push(`${mistakes} possession-losing or goal-allowed event${mistakes === 1 ? "" : "s"} also affected the numeric result.`);
  } else {
    lines.push("No possession-losing or goal-allowed events were recorded in this game.");
  }

  lines.push(`The ${weightProfile.label || "player"} position weighting changes how ${biggest.label.toLowerCase()} events contribute to this LaxHornet-created summary.`);

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

function isPrivateReviewTag(tag) {
  return PRIVATE_REVIEW_TAGS.has(normalizeTag(tag).toLowerCase());
}

function publicEventTags(tags = []) {
  return uniqueTags(tags).filter((tag) => !isPrivateReviewTag(tag));
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

function forgetDeletedGame(gameId) {
  if (!gameId) return;
  state.deletedGameIds = uniqueIds(state.deletedGameIds).filter((id) => id !== gameId);
}

function forgetDeletedEvent(eventId) {
  if (!eventId) return;
  state.deletedEventIds = uniqueIds(state.deletedEventIds).filter((id) => id !== eventId);
}

function forgetDeletedEvents(eventIds = []) {
  const ids = new Set(uniqueIds(eventIds));
  if (!ids.size) return;
  state.deletedEventIds = uniqueIds(state.deletedEventIds).filter((id) => !ids.has(id));
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
  const scoreForAtEvent = optionalScoreNumber(event.scoreForAtEvent ?? event.score_for_at_event);
  const scoreAgainstAtEvent = optionalScoreNumber(event.scoreAgainstAtEvent ?? event.score_against_at_event);
  const scoreMarginAtEvent = scoreForAtEvent === null || scoreAgainstAtEvent === null
    ? null
    : scoreForAtEvent - scoreAgainstAtEvent;
  const scoreForBeforeEvent = optionalScoreNumber(event.scoreForBeforeEvent ?? event.score_for_before_event);
  const scoreAgainstBeforeEvent = optionalScoreNumber(event.scoreAgainstBeforeEvent ?? event.score_against_before_event);

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
    scoreForAtEvent,
    scoreAgainstAtEvent,
    scoreMarginAtEvent,
    scoreStateAtEvent: event.scoreStateAtEvent || event.score_state_at_event || scoreStateForMargin(scoreMarginAtEvent),
    gameSegmentAtEvent: event.gameSegmentAtEvent || event.game_segment_at_event || gameSegmentForPeriod(event.quarter),
    scoreAutoIncrement: event.scoreAutoIncrement || "",
    scoreForBeforeEvent,
    scoreAgainstBeforeEvent,
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
  const scoreFor = optionalScoreNumber(game.scoreFor ?? game.score_for);
  const scoreAgainst = optionalScoreNumber(game.scoreAgainst ?? game.score_against);
  const finalScoreFor = optionalScoreNumber(game.finalScoreFor ?? game.final_score_for);
  const finalScoreAgainst = optionalScoreNumber(game.finalScoreAgainst ?? game.final_score_against);
  const storedScoreTouched = game.scoreTrackingTouched ?? game.score_tracking_touched;
  const scoreTrackingTouched = Boolean(
    storedScoreTouched ?? (scoreFor !== null || scoreAgainst !== null || finalScoreFor !== null || finalScoreAgainst !== null),
  );
  return {
    ...game,
    id,
    scopeType: gameScopeType({ ...game, teamId, rosterPlayerId }),
    playerId: playerId || playerSnapshot.id || "",
    teamId,
    rosterPlayerId,
    playerSnapshot,
    shareCode: game.shareCode || game.share_code || makeShareCode(),
    userId: game.userId || game.user_id || "",
    isShared: Boolean(game.isShared ?? game.is_shared ?? false),
    periodFormat,
    currentQuarter: periods.includes(currentQuarter) ? currentQuarter : periods[0],
    scoreFor: scoreFor ?? 0,
    scoreAgainst: scoreAgainst ?? 0,
    scoreTrackingTouched,
    finalScoreFor,
    finalScoreAgainst,
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
  saveJSON(STORAGE_KEYS.removedPlayerAccess, normalizeRemovedPlayerAccess(state.removedPlayerAccess));
  saveJSON(STORAGE_KEYS.adminViewMode, state.adminViewMode === "tracker" ? "tracker" : "admin");
  saveJSON(STORAGE_KEYS.onboardingIntent, state.onboardingIntent || "child");
  saveJSON(STORAGE_KEYS.nextGameFocus, normalizeNextGameFocus(state.nextGameFocus));
  saveJSON(STORAGE_KEYS.trustSpineSync, normalizeTrustSpineSyncState(state.trustSpineSync));
  if (state.nextGameFocus?.text && nextGameFocusMatchesPlayer(state.nextGameFocus, state.player)) {
    saveScopedNextGameFocus(state.nextGameFocus, state.player);
  }
  saveJSON(STORAGE_KEYS.deletedGames, uniqueIds(state.deletedGameIds));
  saveJSON(STORAGE_KEYS.deletedEvents, uniqueIds(state.deletedEventIds));
  saveJSON(STORAGE_KEYS.games, state.games);
  if (state.activeGame) {
    saveJSON(STORAGE_KEYS.activeGame, state.activeGame);
  } else {
    removeStoredItem(STORAGE_KEYS.activeGame);
  }
  if (state.trackingSession) {
    saveJSON(STORAGE_KEYS.trackingSession, normalizeTrackingSession(state.trackingSession, state.activeGame));
  } else {
    removeStoredItem(STORAGE_KEYS.trackingSession);
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
  state.removedPlayerAccess = stored.removedPlayerAccess;
  state.adminViewMode = stored.adminViewMode;
  state.onboardingIntent = stored.onboardingIntent;
  state.nextGameFocus = stored.nextGameFocus;
  state.trustSpineSync = stored.trustSpineSync;
  state.games = stored.games;
  state.activeGame = stored.activeGame;
  state.trackingSession = stored.trackingSession;
  state.reviewGameId = stored.reviewGameId;
  state.deletedGameIds = stored.deletedGameIds;
  state.deletedEventIds = stored.deletedEventIds;
  state.userProfile = null;
  state.adminRequests = [];
  state.editingEventId = null;
  state.editingGameDetails = false;
  state.tagEditingEventId = null;
  state.tagDraftTags = [];
  state.pendingCancelGame = false;
  mergeRosterPlayersIntoPlayers();
  ensureActiveTeamRosterPlayer();
  syncActivePlayer();
  state.nextGameFocus = activeNextGameFocusForPlayer(state.player);
  state.games = state.games.map((game) => normalizeGame(game, state.player));
  state.activeGame = state.activeGame ? normalizeGame(state.activeGame, state.player) : null;
  state.trackingSession = normalizeTrackingSession(state.trackingSession, state.activeGame);
  mergePlayersFromGames([state.activeGame, ...state.games].filter(Boolean));
  persistAll();
}

function resetCloudAccountState() {
  state.teams = [];
  state.rosterPlayers = [];
  state.activeTeamId = "";
  state.teamAccessRequests = [];
  state.playerClaims = [];
  state.removedPlayerAccess = [];
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
  if (screen === "adminPortal" && isReviewerAccount()) state.adminViewMode = "admin";
  state.screen = screen;
  recoverAdminTeamContext();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function applyStartupDeepLink() {
  if (startupDeepLinkHandled || startupOpenTarget !== "team-request" || !state.authUser) return false;
  if (!isReviewerAccount()) {
    startupDeepLinkHandled = true;
    state.screen = "more";
    showToast("Team admin access is required to review this request");
    return true;
  }

  state.adminViewMode = "admin";
  const request = state.teamAccessRequests.find((item) => item.id === startupRequestId);
  const targetTeamId = request?.teamId || startupTeamId;
  if (targetTeamId && state.teams.some((team) => team.id === targetTeamId)) {
    state.activeTeamId = targetTeamId;
  }
  state.screen = "team";
  startupDeepLinkHandled = true;
  persistAll();
  render();
  window.setTimeout(() => {
    const requestCard = [...document.querySelectorAll("[data-team-access-request]")].find(
      (element) => element.dataset.teamAccessRequest === startupRequestId,
    );
    requestCard?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 100);
  return true;
}

function upsertGame(game) {
  game = normalizeGame(game);
  if (isDeletedGame(game.id)) return;
  if (!canShowGameForCurrentAccess(game)) return;
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
  syncGameToSupabase(updatedGame);
  showToast(message);
}

function updateReviewGame(gameId, updater, message = "Game updated") {
  const game = state.games.find((item) => item.id === gameId);
  if (!game) return;
  saveReviewedGame(updater(game), message);
}

function makeGame(formData) {
  const periodFormat = PERIOD_FORMATS[formData.get("periodFormat")] ? formData.get("periodFormat") : "quarters";
  const periods = PERIOD_FORMATS[periodFormat].periods;
  const requestedStart = formData.get("startingPeriod") || PERIOD_FORMATS[periodFormat].start;
  const currentQuarter = periods.includes(requestedStart) ? requestedStart : PERIOD_FORMATS[periodFormat].start;
  const player = { ...state.player };
  const teamId = player.teamId || "";
  const rosterPlayerId = player.rosterPlayerId || (teamId ? player.id : "");
  const scopeType = teamId && rosterPlayerId ? GAME_SCOPE_TYPES.TEAM_ROSTER : GAME_SCOPE_TYPES.PERSONAL;
  return {
    id: uid("game"),
    scopeType,
    playerId: player.id,
    teamId,
    rosterPlayerId,
    shareCode: makeShareCode(),
    userId: currentUserId() || "",
    isShared: Boolean(teamId && rosterPlayerId && formData.get("liveShare") === "on"),
    periodFormat,
    opponent: formData.get("opponent")?.trim() || "Opponent",
    date: formData.get("date") || todayISO(),
    location: formData.get("location")?.trim() || "",
    gameType: formData.get("gameType") || "Regular season",
    playerSnapshot: player,
    currentQuarter,
    scoreFor: 0,
    scoreAgainst: 0,
    scoreTrackingTouched: false,
    finalScoreFor: null,
    finalScoreAgainst: null,
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

const GAME_IMPACT_LIMITATION =
  "Game Impact is a LaxHornet-created summary of selected recorded events. It is not a coach grade, player rating, ranking, or complete measure of performance or development.";

const GAME_IMPACT_EVIDENCE_LIMIT =
  "Missing or incorrectly recorded events can change the result.";

function renderImpactScore(value, options = {}) {
  const score = formatImpactNumber(value);
  const label = options.label || "LaxHornet score";
  return `
    <span class="impact-score">
      <strong>${escapeHTML(score)}</strong>
      <small>${escapeHTML(label)}</small>
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

function optionalScoreNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.round(number));
}

function scoreStateForMargin(margin) {
  if (margin === undefined || margin === null || !Number.isFinite(Number(margin))) return "unknown";
  const value = Number(margin);
  if (value > 0) return "leading";
  if (value < 0) return "trailing";
  return "tied";
}

function gameSegmentForPeriod(period = "") {
  const clean = String(period || "").toUpperCase();
  if (clean === "OT") return "overtime";
  if (clean === "Q1" || clean === "H1") return "early_game";
  if (clean === "Q2" || clean === "Q3") return "mid_game";
  if (clean === "Q4" || clean === "H2") return "late_game";
  return "unknown";
}

function gameSegmentLabel(segment = "") {
  const labels = {
    early_game: "Early game",
    mid_game: "Mid game",
    late_game: "Late game",
    overtime: "Overtime",
  };
  return labels[segment] || "Unknown";
}

function hasScoreContext(game = {}) {
  const normalized = game || {};
  return Boolean(
    normalized.scoreTrackingTouched ||
      optionalScoreNumber(normalized.finalScoreFor) !== null ||
      optionalScoreNumber(normalized.finalScoreAgainst) !== null ||
      (normalized.events || []).some((event) => optionalScoreNumber(event.scoreForAtEvent) !== null && optionalScoreNumber(event.scoreAgainstAtEvent) !== null),
  );
}

function scoreLabel(game = {}) {
  const normalized = normalizeGame(game);
  return `Us ${normalized.scoreFor} · Them ${normalized.scoreAgainst}`;
}

function eventScoreDisplay(event = {}) {
  const scoreFor = optionalScoreNumber(event.scoreForAtEvent);
  const scoreAgainst = optionalScoreNumber(event.scoreAgainstAtEvent);
  if (scoreFor === null || scoreAgainst === null) return "";
  return `Us ${scoreFor} - Them ${scoreAgainst}`;
}

function scoreContextForGame(game = {}, quarter = "") {
  const normalized = normalizeGame(game);
  const finalFor = optionalScoreNumber(normalized.finalScoreFor);
  const finalAgainst = optionalScoreNumber(normalized.finalScoreAgainst);
  const lastScoreEvent = [...(normalized.events || [])]
    .reverse()
    .find((event) => optionalScoreNumber(event.scoreForAtEvent) !== null && optionalScoreNumber(event.scoreAgainstAtEvent) !== null);
  const scoreFor = normalized.scoreTrackingTouched
    ? optionalScoreNumber(normalized.scoreFor)
    : finalFor ?? optionalScoreNumber(lastScoreEvent?.scoreForAtEvent);
  const scoreAgainst = normalized.scoreTrackingTouched
    ? optionalScoreNumber(normalized.scoreAgainst)
    : finalAgainst ?? optionalScoreNumber(lastScoreEvent?.scoreAgainstAtEvent);
  const hasScore = scoreFor !== null && scoreAgainst !== null && hasScoreContext(normalized);
  const safeFor = scoreFor ?? 0;
  const safeAgainst = scoreAgainst ?? 0;
  const margin = hasScore ? safeFor - safeAgainst : null;
  return {
    scoreForAtEvent: hasScore ? safeFor : null,
    scoreAgainstAtEvent: hasScore ? safeAgainst : null,
    scoreMarginAtEvent: margin,
    scoreStateAtEvent: scoreStateForMargin(margin),
    gameSegmentAtEvent: gameSegmentForPeriod(quarter || game.currentQuarter),
  };
}

function applyScoreIncrement(game, side = "") {
  if (!game) return { side: "", beforeFor: null, beforeAgainst: null };
  const beforeFor = optionalScoreNumber(game.scoreFor) ?? 0;
  const beforeAgainst = optionalScoreNumber(game.scoreAgainst) ?? 0;
  const beforeFinalFor = optionalScoreNumber(game.finalScoreFor);
  const beforeFinalAgainst = optionalScoreNumber(game.finalScoreAgainst);
  game.scoreFor = beforeFor;
  game.scoreAgainst = beforeAgainst;
  game.scoreTrackingTouched = true;
  if (side === "for") {
    game.scoreFor += 1;
    if (beforeFinalFor !== null) game.finalScoreFor = beforeFinalFor + 1;
  }
  if (side === "against") {
    game.scoreAgainst += 1;
    if (beforeFinalAgainst !== null) game.finalScoreAgainst = beforeFinalAgainst + 1;
  }
  return { side, beforeFor, beforeAgainst };
}

function scoreIncrementSideForStat(statKey = "") {
  if (statKey === "goal" || statKey === "assist") return "for";
  if (statKey === "goalAllowed") return "against";
  return "";
}

function applyScoreIncrementForStat(game, statKey = "") {
  const side = scoreIncrementSideForStat(statKey);
  if (side) return applyScoreIncrement(game, side);
  return {
    side: "",
    beforeFor: optionalScoreNumber(game?.scoreFor) ?? 0,
    beforeAgainst: optionalScoreNumber(game?.scoreAgainst) ?? 0,
  };
}

function rollbackScoreIncrement(game, event = {}) {
  if (!game || !event.scoreAutoIncrement) return;
  const currentFor = optionalScoreNumber(game.scoreFor) ?? 0;
  const currentAgainst = optionalScoreNumber(game.scoreAgainst) ?? 0;
  if (event.scoreAutoIncrement === "for" && currentFor === optionalScoreNumber(event.scoreForAtEvent)) {
    game.scoreFor = optionalScoreNumber(event.scoreForBeforeEvent) ?? Math.max(0, currentFor - 1);
  }
  if (event.scoreAutoIncrement === "against" && currentAgainst === optionalScoreNumber(event.scoreAgainstAtEvent)) {
    game.scoreAgainst = optionalScoreNumber(event.scoreAgainstBeforeEvent) ?? Math.max(0, currentAgainst - 1);
  }
}

function removeScoreIncrementFromGameTotal(game, event = {}) {
  if (!game || !event.scoreAutoIncrement) return game;
  const nextGame = { ...game };
  const side = event.scoreAutoIncrement;
  if (side === "for") {
    nextGame.scoreFor = Math.max(0, (optionalScoreNumber(nextGame.scoreFor) ?? 0) - 1);
    if (optionalScoreNumber(nextGame.finalScoreFor) !== null) {
      nextGame.finalScoreFor = Math.max(0, optionalScoreNumber(nextGame.finalScoreFor) - 1);
    }
  }
  if (side === "against") {
    nextGame.scoreAgainst = Math.max(0, (optionalScoreNumber(nextGame.scoreAgainst) ?? 0) - 1);
    if (optionalScoreNumber(nextGame.finalScoreAgainst) !== null) {
      nextGame.finalScoreAgainst = Math.max(0, optionalScoreNumber(nextGame.finalScoreAgainst) - 1);
    }
  }
  return nextGame;
}

function possessionContextEvent(event = {}) {
  return ["groundBall", "causedTurnover", "successfulClear", "failedClear", "turnover", "goalieSave", "faceoffWin", "backedUpShot"].includes(event.statType);
}

function negativeContextEvent(event = {}) {
  return ["turnover", "failedClear", "penalty", "faceoffLoss"].includes(event.statType);
}

function gameContextSummary(game = {}, totals = {}) {
  const normalized = normalizeGame(game);
  const events = normalized.events || [];
  const scoreEvents = events.filter((event) => optionalScoreNumber(event.scoreForAtEvent) !== null && optionalScoreNumber(event.scoreAgainstAtEvent) !== null);
  const segmentCounts = events.reduce((acc, event, index) => {
    let segment = event.gameSegmentAtEvent || gameSegmentForPeriod(event.quarter);
    if (segment === "unknown" && events.length) {
      const ratio = (index + 1) / events.length;
      segment = ratio <= 1 / 3 ? "early_game" : ratio <= 2 / 3 ? "mid_game" : "late_game";
    }
    if (impactValueForEvent(event) > 0) acc[segment] = (acc[segment] || 0) + 1;
    return acc;
  }, {});
  const strongestStretch = Object.entries(segmentCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  const closeGameEvents = scoreEvents.filter((event) => Math.abs(Number(event.scoreMarginAtEvent || 0)) <= 2);
  const closePossessionPlays = closeGameEvents.filter(possessionContextEvent).length;
  const lateEvents = events.filter((event) => event.gameSegmentAtEvent === "late_game" || gameSegmentForPeriod(event.quarter) === "late_game");
  const latePositivePossession = lateEvents.filter((event) => possessionContextEvent(event) && impactValueForEvent(event) > 0).length;
  const lateNegative = lateEvents.filter(negativeContextEvent).length;
  const tiedOrTrailingTurnovers = scoreEvents.filter((event) => event.statType === "turnover" && Number(event.scoreMarginAtEvent || 0) <= 0).length;
  const earlyScoring = events.filter((event) => event.gameSegmentAtEvent === "early_game" && (event.statType === "goal" || event.statType === "assist")).length;
  const goalieCloseSaves = closeGameEvents.filter((event) => event.statType === "goalieSave").length;
  const hasFinal = normalized.finalScoreFor !== null && normalized.finalScoreAgainst !== null;
  return {
    hasScore: hasScoreContext(normalized),
    hasFinal,
    finalScoreFor: normalized.finalScoreFor,
    finalScoreAgainst: normalized.finalScoreAgainst,
    strongestStretch,
    closePossessionPlays,
    latePositivePossession,
    lateNegative,
    tiedOrTrailingTurnovers,
    earlyScoring,
    goalieCloseSaves,
    scoreEvents: scoreEvents.length,
    eventCount: events.length || totals.eventCount || 0,
  };
}

function scoreContextSentence(context = {}, totals = {}, player = state.player) {
  context = context || {};
  if (!context.eventCount || (!context.hasScore && !context.strongestStretch)) return "";
  const positionGroup = impactPositionGroup(player);
  if (context.goalieCloseSaves > 0) return "Goalie play helped protect the game during an important stretch.";
  if (context.closePossessionPlays > 0 && context.strongestStretch === "late_game") {
    return "Those plays came in a high-leverage stretch, when possessions mattered more.";
  }
  if (context.latePositivePossession > 0) return "Late-game possession work helped keep the player involved when the game tightened.";
  if (context.earlyScoring > 0) return "Early scoring helped set the tone.";
  if (positionGroup === "goalie" && totals.saves > 0) return "The score context can make save-and-clear moments easier to understand over time.";
  return "";
}

function isTeamWinWithModestPlayerImpact(game = {}, totals = {}) {
  const context = gameContextSummary(game, totals);
  if (!context.hasFinal) return false;
  const finalFor = Number(context.finalScoreFor || 0);
  const finalAgainst = Number(context.finalScoreAgainst || 0);
  if (finalFor <= finalAgainst) return false;
  const eventCount = Number(totals.eventCount || 0);
  if (eventCount < 5) return false;
  const points = Number(totals.points || 0);
  const possessionPressure = Number(totals.turnovers || 0) + Number(totals.failedClears || 0) + Number(totals.penalties || 0);
  const positiveRolePlays =
    Number(totals.groundBalls || 0) +
    Number(totals.causedTurnovers || 0) +
    Number(totals.clears || 0) +
    Number(totals.hustlePlays || 0) +
    Number(totals.smartPlays || 0);
  return (points === 0 || possessionPressure >= 2) && positiveRolePlays > 0 && points < 3;
}

function buildTeamWinGrowthPattern(game = {}, events = [], totals = {}, player = state.player, nextFocus = null) {
  if (!isTeamWinWithModestPlayerImpact(game, totals)) return null;
  const context = gameContextSummary(game, totals);
  const name = playerFirstName(player);
  const topContribution = topContributionForTotals(totals);
  const roleSignals = [
    countPhrase(totals.groundBalls, "ground ball"),
    countPhrase(totals.causedTurnovers, "caused turnover"),
    countPhrase(totals.clears, "successful clear"),
    countPhrase(totals.hustlePlays, "hustle play"),
    countPhrase(totals.smartPlays, "smart play"),
  ].filter(Boolean);
  const pressureSignals = [
    countPhrase(totals.turnovers, "turnover"),
    countPhrase(totals.failedClears, "failed clear"),
    countPhrase(totals.penalties, "penalty", "penalties"),
  ].filter(Boolean);
  const result = `${context.finalScoreFor}-${context.finalScoreAgainst}`;
  const signalText = roleSignals.length ? `The useful role plays came through ${listPhrase(roleSignals.slice(0, 3))}.` : "The useful plays came in supporting moments away from the scoring line.";
  const pressureText = pressureSignals.length
    ? `The growth layer is protecting the next possession after ${listPhrase(pressureSignals.slice(0, 2))}.`
    : "The growth layer is turning those useful plays into one clean next action.";
  const tryThis = nextFocus?.tryThisNextGame || buildNextFocusLine(totals, player, topContribution.label, game);

  return patternResult({
    key: "teamWinIndividualGrowth",
    storyType: "Team Win, Individual Growth",
    title: "Team result, next-play focus",
    text: `The team won ${result}, but ${name}'s review is more about role impact and the next clean decision than the scoreboard. ${signalText} ${pressureText}`,
    category: "development",
    priority: 112,
    evidence: [
      `Team won ${result}`,
      topContribution.label && topContribution.label !== "Building profile" ? `${topContribution.label} was the largest recorded contribution category` : "",
      pressureSignals.length ? `${listPhrase(pressureSignals.slice(0, 2))} to clean up` : "",
    ],
    development: {
      whatWentWell: `${name} stayed involved in a game the team won, even without a big scoring line.`,
      whyItMattered: `${positionDevelopmentLens(player)} Role plays matter because they help the team gain control even when points are not the story.`,
      whatToBuildOn: pressureSignals.length
        ? "Build the next play after pressure: secure it, find support, and choose the simple outlet."
        : "Build on the useful role play by turning it into one calm next decision.",
    },
    focus: {
      focusTitle: "Next clean decision",
      whyThisFits: "The team result was positive, but the individual development pattern points to cleaner next-play possession.",
      tryThisNextGame: tryThis,
      confidence: "high",
      category: "decision",
    },
    encouragement: `Praise ${name}'s involvement in the win, then reinforce the simple next-play decision that can make those moments more repeatable.`,
  });
}

function impactWeightLabel(weight) {
  const value = Number(weight || 0);
  if (value === 0) return "not weighted";
  if (value >= 1.6) return "primary weight";
  if (value >= 1.2) return "added weight";
  if (value <= 0.7) return "reduced weight";
  return "standard weight";
}

function visibleGames() {
  return visibleGamesForPlayer(state.player);
}

function visibleGamesForPlayer(player = state.player) {
  const userId = currentUserId();
  const joinedTeamIds = teamIds();
  const accessFilteredGames = state.games.filter(canShowGameForCurrentAccess);
  const userGames = userId
    ? accessFilteredGames.filter((game) => {
        const teamGameId = gameTeamId(game);
        return !game.userId || game.userId === userId || (teamGameId && joinedTeamIds.includes(teamGameId));
      })
    : accessFilteredGames.filter((game) => !game.userId && !gameTeamId(game));
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
  reconcileGameEventOperations(state.activeGame);
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

  const operation = createGameEventOperation(state.activeGame, () => {
    const scoreChange = applyScoreIncrementForStat(state.activeGame, statKey);
    const scoreContext = scoreContextForGame(state.activeGame, state.activeGame.currentQuarter);
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
      ...scoreContext,
      scoreAutoIncrement: scoreChange.side,
      scoreForBeforeEvent: scoreChange.beforeFor,
      scoreAgainstBeforeEvent: scoreChange.beforeAgainst,
    };
    state.activeGame.events.push(event);
    state.activeGame.savedAt = new Date().toISOString();
    state.lastEventConfirmation = {
      gameId: state.activeGame.id,
      eventId: event.id,
      label: stat.label,
      quarter: event.quarter,
      timestamp: event.timestamp,
    };
    return { game: state.activeGame, event };
  });
  const event = operation.event;
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
  const operation = tombstoneGameEventOperation(state.activeGame, "Undo last event", () => {
    const removed = state.activeGame.events.pop();
    rollbackScoreIncrement(state.activeGame, removed);
    state.activeGame.savedAt = new Date().toISOString();
    state.lastEventConfirmation = null;
    rememberDeletedEvent(removed.id);
    return { game: state.activeGame, event: removed };
  });
  render();
  showToast(`Undo last event: ${operation.event.statLabel}`);
}

function updateActiveGameScore(side = "") {
  if (!state.activeGame) return;
  if (!canEditGame(state.activeGame)) {
    showToast("View-only team access");
    return;
  }
  applyScoreIncrement(state.activeGame, side);
  state.activeGame.savedAt = new Date().toISOString();
  persistAll();
  syncGameToSupabase(state.activeGame);
  render();
  showToast(`${side === "against" ? "Opponent score" : "Our score"} updated`);
}

function editActiveGameScore() {
  if (!state.activeGame) return;
  if (!canEditGame(state.activeGame)) {
    showToast("View-only team access");
    return;
  }
  const currentFor = optionalScoreNumber(state.activeGame.scoreFor) ?? 0;
  const currentAgainst = optionalScoreNumber(state.activeGame.scoreAgainst) ?? 0;
  const forInput = window.prompt("Our Score", String(currentFor));
  if (forInput === null) return;
  const againstInput = window.prompt("Opponent Score", String(currentAgainst));
  if (againstInput === null) return;
  const scoreFor = optionalScoreNumber(forInput);
  const scoreAgainst = optionalScoreNumber(againstInput);
  if (scoreFor === null || scoreAgainst === null) {
    showToast("Enter whole-number scores");
    return;
  }
  state.activeGame.scoreFor = scoreFor;
  state.activeGame.scoreAgainst = scoreAgainst;
  state.activeGame.scoreTrackingTouched = true;
  state.activeGame.savedAt = new Date().toISOString();
  persistAll();
  syncGameToSupabase(state.activeGame);
  render();
  showToast("Score updated");
}

function addNoteToLastEvent() {
  const confirmation = state.lastEventConfirmation;
  if (!confirmation || !state.activeGame || confirmation.gameId !== state.activeGame.id) {
    showToast("No recent event to note");
    return;
  }
  if (!canEditGame(state.activeGame)) {
    showToast("View-only team access");
    return;
  }
  const eventIndex = state.activeGame.events.findIndex((event) => event.id === confirmation.eventId);
  if (eventIndex < 0) {
    showToast("Recent event not found");
    return;
  }
  const note = window.prompt(`Add note for ${confirmation.label}`)?.trim() || "";
  if (!note) return;
  correctGameEventOperation(state.activeGame, () => {
    state.activeGame.events[eventIndex] = {
      ...state.activeGame.events[eventIndex],
      note,
      correctedAt: new Date().toISOString(),
    };
    state.activeGame.savedAt = new Date().toISOString();
    return { game: state.activeGame, event: state.activeGame.events[eventIndex] };
  });
  render();
  showToast("Note added");
}

function endGame() {
  if (!state.activeGame) return;
  if (!canEditGame(state.activeGame)) {
    showToast("View-only team access");
    return;
  }
  state.pendingEndGame = true;
  render();
}

function activeTrackingSession() {
  return normalizeTrackingSession(state.trackingSession, state.activeGame);
}

function isDiscardableTrackingSession() {
  return Boolean(state.activeGame && activeTrackingSession()?.origin === "new");
}

function clearLiveTrackingTransientState(gameId = "") {
  state.pendingCancelGame = false;
  state.pendingEndGame = false;
  state.lastEventConfirmation = null;
  state.morePlaysExpanded = false;
  state.addingReviewEvent = false;
  state.editingEventId = null;
  state.editingGameDetails = false;
  state.tagEditingEventId = null;
  state.tagDraftTags = [];
  state.focusEditorContext = "";
  if (!gameId || state.gameSavedSummaryId === gameId) state.gameSavedSummaryId = "";
  if (!gameId || state.liveSharePromptGameId === gameId) state.liveSharePromptGameId = "";
}

function focusCancelGameDialog() {
  window.requestAnimationFrame(() => {
    document.querySelector('[data-action="keep-tracking"]')?.focus();
  });
}

function requestCancelGame() {
  if (!state.activeGame) return;
  if (!canEditGame(state.activeGame)) {
    showToast("View-only team access");
    return;
  }
  state.pendingCancelGame = true;
  state.pendingEndGame = false;
  render();
  focusCancelGameDialog();
}

function keepTrackingAfterCancelPrompt() {
  state.pendingCancelGame = false;
  render();
  window.requestAnimationFrame(() => {
    document.querySelector('[data-action="cancel-game"]')?.focus();
  });
}

async function confirmCancelGame() {
  const game = state.activeGame;
  if (!game) {
    state.pendingCancelGame = false;
    render();
    return;
  }
  if (!canEditGame(game)) {
    state.pendingCancelGame = false;
    showToast("View-only team access");
    return;
  }

  const session = activeTrackingSession();
  const returnScreen = ["home", "player", "more"].includes(session?.previousScreen) ? session.previousScreen : "home";

  if (session?.origin !== "new") {
    const previouslySavedGame = state.games.find((item) => item.id === game.id);
    const preservedGame = normalizeGame(session?.initialGameSnapshot || previouslySavedGame || game);
    upsertGame(preservedGame);
    state.activeGame = null;
    state.trackingSession = null;
    clearLiveTrackingTransientState(game.id);
    if (state.reviewGameId === game.id) state.reviewGameId = preservedGame.id;
    persistAll();
    navigate(returnScreen);
    showToast("Tracking exited. The saved game was preserved.");
    return;
  }

  rememberDeletedGame(game.id);
  state.games = state.games.filter((item) => item.id !== game.id);
  state.activeGame = null;
  state.trackingSession = null;
  clearLiveTrackingTransientState(game.id);
  if (state.reviewGameId === game.id) state.reviewGameId = state.games[0]?.id || null;
  persistAll();
  navigate(returnScreen);
  showToast("Game canceled");

  if (state.isOffline || !supabaseClient || !currentUserId()) {
    state.syncStatus = state.isOffline ? "Will sync when online" : "Saved on this phone";
    persistAll();
    return;
  }

  const cloudDeleted = await deleteSupabaseGame(game.id, { rpcOnly: true });
  if (cloudDeleted) {
    state.syncStatus = "Synced";
    clearResolvedCloudDeleteError();
    persistAll();
  } else if (!state.cloudError) {
    reportCloudDeleteNeedsUpdate("game");
  }
}

function confirmEndGame() {
  if (!state.activeGame) {
    state.pendingEndGame = false;
    render();
    return;
  }
  if (!canEditGame(state.activeGame)) {
    state.pendingEndGame = false;
    showToast("View-only team access");
    return;
  }
  state.activeGame.status = "complete";
  state.activeGame.endedAt = new Date().toISOString();
  state.activeGame.savedAt = new Date().toISOString();
  if (hasScoreContext(state.activeGame)) {
    state.activeGame.finalScoreFor = optionalScoreNumber(state.activeGame.scoreFor) ?? 0;
    state.activeGame.finalScoreAgainst = optionalScoreNumber(state.activeGame.scoreAgainst) ?? 0;
  }
  const completedGame = normalizeGame(state.activeGame);
  upsertGame(state.activeGame);
  state.reviewGameId = state.activeGame.id;
  state.activeGame = null;
  state.trackingSession = null;
  state.pendingEndGame = false;
  state.gameSavedSummaryId = completedGame.id;
  state.lastEventConfirmation = null;
  persistAll();
  reconcileGameEventOperations(completedGame);
  render();
  showToast(`Game saved. Review ${possessiveName(playerFirstName(gamePlayerSnapshot(completedGame)))} impact.`);
}

function deleteGame(id) {
  const game = state.games.find((item) => item.id === id);
  if (!game) return;
  if (!canEditGame(game)) {
    showToast("View-only team access");
    return;
  }
  state.pendingDeleteGameId = id;
  render();
}

async function confirmDeleteGame(id) {
  const game = state.games.find((item) => item.id === id);
  if (!game) {
    state.pendingDeleteGameId = "";
    render();
    return;
  }
  if (!canEditGame(game)) {
    state.pendingDeleteGameId = "";
    showToast("View-only team access");
    return;
  }
  rememberDeletedGame(id);
  (game.events || []).forEach((event) => rememberDeletedEvent(event.id));
  state.games = state.games.filter((item) => item.id !== id);
  if (state.activeGame?.id === id) {
    state.activeGame = null;
    state.trackingSession = null;
  }
  state.addingReviewEvent = false;
  state.editingGameDetails = false;
  state.editingEventId = null;
  state.tagEditingEventId = null;
  state.pendingDeleteGameId = "";
  if (state.reviewGameId === id) state.reviewGameId = state.games[0]?.id || null;
  persistAll();
  render();
  showToast("Game deleted");
  const cloudDeleted = await deleteSupabaseGame(id);
  if (cloudDeleted) {
    forgetDeletedEvents((game.events || []).map((event) => event.id));
    state.syncStatus = "Synced";
    clearResolvedCloudDeleteError();
  } else if (supabaseClient && currentUserId() && !state.cloudError) {
    reportCloudDeleteNeedsUpdate("game");
  }
  persistAll();
  render();
}

async function deleteEvent(gameId, eventId) {
  const game = state.games.find((item) => item.id === gameId);
  if (!game) return;
  if (!canEditGame(game)) {
    showToast("View-only team access");
    return;
  }
  const event = game.events.find((item) => item.id === eventId);
  if (!event) return;
  if (!window.confirm(`Delete ${event.statLabel}?`)) return;

  tombstoneGameEventOperation(game, "Tracker event deleted", () => {
    const updatedGame = normalizeGame({
      ...removeScoreIncrementFromGameTotal(game, event),
      events: game.events.filter((item) => item.id !== eventId),
      savedAt: new Date().toISOString(),
    });
    rememberDeletedEvent(eventId);
    state.addingReviewEvent = false;
    if (state.editingEventId === eventId) state.editingEventId = null;
    if (state.tagEditingEventId === eventId) state.tagEditingEventId = null;
    upsertGame(updatedGame);
    if (state.activeGame?.id === updatedGame.id) state.activeGame = updatedGame;
    return { game: updatedGame, event };
  });
  showToast("Event deleted");
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
  correctGameEventOperation(game, () => {
    const updatedEvent = {
      ...game.events.find((event) => event.id === eventId),
      tags,
      tagsUpdatedAt: new Date().toISOString(),
    };
    const updatedGame = normalizeGame({
      ...game,
      events: game.events.map((event) => (event.id === eventId ? updatedEvent : event)),
      savedAt: new Date().toISOString(),
    });
    upsertGame(updatedGame);
    if (state.activeGame?.id === updatedGame.id) state.activeGame = updatedGame;
    return { game: updatedGame, event: updatedEvent };
  });
  state.tagEditingEventId = null;
  state.tagDraftTags = [];
  render();
  showToast("Tags saved");
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function exportGamesForScope(scope = "selected_player", gameId = "") {
  if (scope === "current_game") {
    const requestedGame = state.games.find((game) => game.id === gameId);
    const selected =
      (requestedGame && canShowGameForCurrentAccess(requestedGame) ? requestedGame : null) ||
      visibleGames().find((game) => game.id === gameId) ||
      currentReviewGame();
    return selected ? [selected] : [];
  }
  return visibleGames();
}

function buildCSV(options = {}) {
  const scope = options.scope || "selected_player";
  const includeNotes = options.includeNotes === true;
  const includePublicTags = options.includePublicTags === true;
  const includeProcessTags = options.includeProcessTags === true;
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
    "finalScoreFor",
    "finalScoreAgainst",
    "eventId",
    "timestamp",
    "quarter",
    "statType",
    "statLabel",
    "category",
    "pointValue",
    "eventImpactValue",
    "eventImpactPillar",
    "laxhornetImpactScore",
    "gameImpactRaw",
    "extraPossessions",
    "possessionValue",
    "scoreForAtEvent",
    "scoreAgainstAtEvent",
    "scoreMarginAtEvent",
    "scoreStateAtEvent",
    "gameSegmentAtEvent",
    "fieldZone",
  ];
  if (includePublicTags) headers.push("publicTags");
  if (includeProcessTags) headers.push("privateProcessTags");
  if (includeNotes) headers.push("privateNote");

  const rows = exportGamesForScope(scope, options.gameId).flatMap((game) => {
    const normalizedGame = normalizeGame(game);
    const player = gamePlayerSnapshot(normalizedGame);
    const totals = calculateTotals(normalizedGame.events, player);
    return normalizedGame.events.map((event) => {
      const row = [
        normalizedGame.id,
        gamePlayerId(normalizedGame),
        gameTeamId(normalizedGame),
        teamById(gameTeamId(normalizedGame))?.name || player.team || "",
        gameRosterPlayerId(normalizedGame),
        player.name,
        player.number,
        normalizedGame.date,
        normalizedGame.opponent,
        normalizedGame.finalScoreFor ?? "",
        normalizedGame.finalScoreAgainst ?? "",
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
        event.scoreForAtEvent ?? "",
        event.scoreAgainstAtEvent ?? "",
        event.scoreMarginAtEvent ?? "",
        event.scoreStateAtEvent || "",
        event.gameSegmentAtEvent || "",
        event.fieldZone,
      ];
      if (includePublicTags) row.push(publicEventTags(event.tags));
      if (includeProcessTags) row.push(uniqueTags(event.tags).filter(isPrivateReviewTag));
      if (includeNotes) row.push(event.note || "");
      return row;
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

function fullBackupPayload() {
  return {
    app: "LaxHornet",
    version: 4,
    purpose: "private-account-recovery",
    sensitive: true,
    importPolicy: {
      restoresAuthorization: false,
      activatesLiveShare: false,
      replacesExistingGames: false,
    },
    impactModel: {
      version: "game-impact-v2-position-weighted",
      scale: "0-100",
      proprietary: true,
      limitation: GAME_IMPACT_LIMITATION,
      evidenceLimit: GAME_IMPACT_EVIDENCE_LIMIT,
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
}

function openExportDialog(type) {
  state.exportDialog = type === "full_backup" ? "full_backup" : "csv";
  render();
}

function closeExportDialog() {
  state.exportDialog = null;
  render();
}

async function recordSensitiveExportAudit(exportType, scopeType, scopeId) {
  if (!SECURE_DISCLOSURE_RUNTIME_READY) {
    throw new Error("Secure export is temporarily unavailable. Tracking and reviews are still available.");
  }
  if (!supabaseClient || !currentUserId()) throw new Error("Sign in before exporting sensitive data.");
  if (!(await backendCapabilityAvailable("exportAudit"))) {
    throw new Error("Secure export is temporarily unavailable. Tracking and reviews are still available.");
  }
  const { data, error } = await supabaseClient.rpc("lh_record_disclosure_export", {
    p_export_type: exportType,
    p_scope_type: scopeType,
    p_scope_id: scopeId || null,
    p_outcome: "accepted",
  });
  if (error || data?.outcome !== "accepted") {
    throw new Error("Secure export is temporarily unavailable. Try again after reconnecting.");
  }
  return data;
}

async function confirmExportFromDialog() {
  const type = state.exportDialog;
  if (!type) return;
  try {
    if (type === "csv") {
      const scope = document.querySelector("#csvExportScope")?.value || "selected_player";
      const gameId = document.querySelector("#csvExportGame")?.value || "";
      const includeNotes = Boolean(document.querySelector("#csvIncludeNotes")?.checked);
      const includePublicTags = Boolean(document.querySelector("#csvIncludePublicTags")?.checked);
      const includeProcessTags = Boolean(document.querySelector("#csvIncludeProcessTags")?.checked);
      const games = exportGamesForScope(scope, gameId);
      if (!games.length) throw new Error("No games are available for that export scope.");
      const scopeId = scope === "current_game" ? games[0].id : state.player.rosterPlayerId || state.player.id;
      await recordSensitiveExportAudit("player_csv", scope === "current_game" ? "game" : "player", scopeId);
      downloadFile(
        `laxhornet-events-${todayISO()}.csv`,
        buildCSV({ scope, gameId, includeNotes, includePublicTags, includeProcessTags }),
        "text/csv;charset=utf-8",
      );
      state.exportDialog = null;
      render();
      showToast("CSV exported");
      return;
    }

    if (!document.querySelector("#confirmSensitiveBackup")?.checked) {
      showToast("Confirm that you understand this is a sensitive private backup.");
      return;
    }
    await recordSensitiveExportAudit("full_backup", "account", currentUserId() || "local-account");
    downloadFile(
      `laxhornet-private-backup-${todayISO()}.json`,
      JSON.stringify(fullBackupPayload(), null, 2),
      "application/json;charset=utf-8",
    );
    state.exportDialog = null;
    render();
    showToast("Private backup exported");
  } catch (error) {
    showToast(error?.message || "Could not complete the export.");
  }
}

function importedGameIsAuthorized(game) {
  const teamId = gameTeamId(game);
  const rosterPlayerId = gameRosterPlayerId(game);
  if (!teamId) return !game.userId || !currentUserId() || game.userId === currentUserId();
  return Boolean(rosterPlayerId && canTrackRosterPlayer(teamId, rosterPlayerId));
}

function sanitizeImportedGame(game) {
  const normalized = normalizeGame(game);
  return normalizeGame({
    ...normalized,
    userId: currentUserId() || "",
    isShared: false,
    shareCode: makeShareCode(),
    events: normalized.events.map((event) => ({
      ...event,
      userId: currentUserId() || "",
    })),
  });
}

function prepareImportJSONFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const payload = JSON.parse(reader.result);
      const importedGames = Array.isArray(payload) ? payload : payload.games;
      if (!Array.isArray(importedGames)) throw new Error("Missing games array");
      const normalized = importedGames.map(sanitizeImportedGame);
      const existingIds = new Set(state.games.map((game) => game.id));
      const deletedIds = new Set(state.deletedGameIds);
      const authorized = normalized.filter(importedGameIsAuthorized);
      const mergeable = authorized.filter((game) => !existingIds.has(game.id) && !deletedIds.has(game.id));
      state.pendingImport = {
        games: mergeable,
        sourceVersion: Number(payload?.version || 1),
        totalCount: normalized.length,
        unauthorizedCount: normalized.length - authorized.length,
        duplicateCount: authorized.filter((game) => existingIds.has(game.id)).length,
        deletedCount: authorized.filter((game) => deletedIds.has(game.id)).length,
        ignoredAuthorityRecords:
          (Array.isArray(payload?.teams) ? payload.teams.length : 0) +
          (Array.isArray(payload?.rosterPlayers) ? payload.rosterPlayers.length : 0) +
          (Array.isArray(payload?.playerClaims) ? payload.playerClaims.length : 0) +
          (Array.isArray(payload?.teamAccessRequests) ? payload.teamAccessRequests.length : 0),
      };
      render();
    } catch (error) {
      state.pendingImport = null;
      showToast("Could not import that JSON file");
    }
  });
  reader.readAsText(file);
}

function cancelPendingImport() {
  state.pendingImport = null;
  render();
}

function confirmPendingImport() {
  const pending = state.pendingImport;
  if (!pending) return;
  const existingIds = new Set(state.games.map((game) => game.id));
  const mergeable = pending.games.filter((game) => !existingIds.has(game.id) && !isDeletedGame(game.id));
  state.games = [...state.games, ...mergeable].sort(
    (a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt),
  );
  state.pendingImport = null;
  persistAll();
  render();
  showToast(`${mergeable.length} game${mergeable.length === 1 ? "" : "s"} imported. Access settings were not changed.`);
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

function shareLinkForGame(game, shareCode = "") {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("share", normalizeTag(shareCode || normalizeGame(game).shareCode).toUpperCase());
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

function reportSecureDisclosureUnavailable(feature = "Secure sharing") {
  state.syncStatus = `${feature} temporarily unavailable`;
  showToast(`${feature} is temporarily unavailable. Tracking is still available.`);
  render();
}

function normalizeBackendCapabilities(value = {}) {
  const source = Array.isArray(value) ? value[0] || {} : value || {};
  return {
    schemaVersion: Number(source.schemaVersion ?? source.schema_version ?? 0),
    trustSpineEvents: source.trustSpineEvents === true || source.trust_spine_events === true,
    secureLiveShare: source.secureLiveShare === true || source.secure_live_share === true,
    exportAudit: source.exportAudit === true || source.export_audit === true,
    personalGameSharing: source.personalGameSharing === true || source.personal_game_sharing === true,
  };
}

function validBackendCapabilities(capabilities = {}) {
  return Number.isInteger(capabilities.schemaVersion)
    && capabilities.schemaVersion >= REQUIRED_SCHEMA_CAPABILITY;
}

async function fetchBackendCapabilities(options = {}) {
  const now = Date.now();
  if (
    !options.force
    && backendCapabilityState.value
    && now - backendCapabilityState.checkedAt < BACKEND_CAPABILITY_CACHE_MS
  ) {
    return backendCapabilityState.value;
  }
  if (!supabaseClient || state.isOffline) {
    backendCapabilityState = {
      value: null,
      checkedAt: now,
      error: state.isOffline ? "offline" : "account_service_unavailable",
    };
    return null;
  }
  const { data, error } = await supabaseClient.rpc("lh_release_capabilities");
  const capabilities = normalizeBackendCapabilities(data);
  if (error || !validBackendCapabilities(capabilities)) {
    backendCapabilityState = {
      value: null,
      checkedAt: now,
      error: readableSupabaseError(error) || "capability_mismatch",
    };
    return null;
  }
  backendCapabilityState = {
    value: capabilities,
    checkedAt: now,
    error: "",
  };
  return capabilities;
}

async function backendCapabilityAvailable(feature, options = {}) {
  const capabilities = await fetchBackendCapabilities(options);
  return Boolean(capabilities?.[feature]);
}

async function requireSecureCapability(feature, label, options = {}) {
  if (!SECURE_DISCLOSURE_RUNTIME_READY || !TRUSTED_DISCLOSURE_FEATURES[options.runtimeFlag || feature]) {
    reportSecureDisclosureUnavailable(label);
    return false;
  }
  if (!(await backendCapabilityAvailable(feature, options))) {
    reportSecureDisclosureUnavailable(label);
    return false;
  }
  return true;
}

function reportCloudDeleteNeedsUpdate(recordLabel = "item") {
  state.syncStatus = "Sync needs attention";
  state.cloudError = `Cloud delete setup needs an update. Deleted ${recordLabel}s stay hidden on this device, but may return on other devices until the update is applied.`;
  const now = Date.now();
  if (now - lastSyncErrorAt > 8000) {
    lastSyncErrorAt = now;
    showToast("Cloud delete setup needs an update");
  }
}

function reportCloudDeleteError(recordLabel = "item", error = {}) {
  console.warn(`LaxHornet cloud ${recordLabel} delete failed:`, error);
  state.syncStatus = "Sync needs attention";
  const detail = readableSupabaseError(error);
  state.cloudError = detail
    ? `Could not remove this ${recordLabel} from the cloud: ${detail}`
    : `Could not remove this ${recordLabel} from the cloud.`;
  const now = Date.now();
  if (now - lastSyncErrorAt > 8000) {
    lastSyncErrorAt = now;
    showToast(`Cloud ${recordLabel} delete needs attention`);
  }
}

function supabaseErrorText(error = {}) {
  return `${error.message || ""} ${error.details || ""} ${error.hint || ""} ${error.code || ""}`.trim();
}

function readableSupabaseError(error = {}) {
  return supabaseErrorText(error).replace(/\s+/g, " ").slice(0, 220);
}

function isCloudDeleteNotFoundError(error = {}, label = "record") {
  const text = readableSupabaseError(error);
  return (
    new RegExp(`${label}\\s+not\\s+found`, "i").test(text)
    || (/not\s+found/i.test(text) && !/function|schema|rpc|cache/i.test(text))
  );
}

function cloudDeleteErrorIsResolved() {
  return !uniqueIds(state.deletedGameIds).length && !uniqueIds(state.deletedEventIds).length;
}

function clearResolvedCloudDeleteError() {
  if (!cloudDeleteErrorIsResolved()) return;
  if (/cloud delete|could not remove|deleted .* may return/i.test(state.cloudError || "")) {
    state.cloudError = "";
  }
  if (/sync (issue|needs attention)/i.test(state.syncStatus || "")) {
    state.syncStatus = "Synced";
  }
}

async function cloudRecordStillVisible(tableName, id) {
  if (!supabaseClient || !tableName || !id) return false;
  const { data, error } = await supabaseClient
    .from(tableName)
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.warn(`LaxHornet ${tableName} delete verification failed:`, error);
    return true;
  }
  return Boolean(data?.id);
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
    showToast(state.cloudError ? `Sync issue: ${state.cloudError}` : "Sync needs attention");
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
      .filter(canShowGameForCurrentAccess)
      .map((game) => [game.id, normalizeGame(game)]),
  );
  cloudGames
    .filter((game) => !isDeletedGame(game.id))
    .map(normalizeGame)
    .filter(canShowGameForCurrentAccess)
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
      .filter((player) => (!ids.length || ids.includes(player.teamId)) && !isPlayerAccessRemoved(player.teamId, player.id, player.number));
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
    rosterPlayers: normalizeRosterPlayers((rosterRows || []).map(rosterPlayerFromSupabaseRow))
      .filter((player) => !isPlayerAccessRemoved(player.teamId, player.id, player.number)),
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
  // Do not auto-repair player claims during routine sync. If a parent removes a
  // verified player from their account, an old approved request should not
  // recreate that player claim on the next sync.
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
  if (!canCreateTeams() && state.player?.teamId && teamHasVerifiedPlayerAccess(state.player.teamId)) {
    state.activeTeamId = state.player.teamId;
  }
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

async function repairApprovedPlayerClaims(options = {}) {
  if (!supabaseClient || !currentUserId()) return [];
  const { data, error } = await supabaseClient.rpc("laxhornet_repair_approved_player_claims");
  if (error) {
    if (!isMissingRpcError(error) && !options.silent) reportTeamSetupError(error);
    return [];
  }
  const repairedClaims = normalizePlayerClaims((Array.isArray(data) ? data : []).map(playerClaimFromSupabaseRow))
    .filter((claim) => !isPlayerAccessRemoved(claim.teamId, claim.rosterPlayerId));
  if (repairedClaims.length) {
    state.playerClaims = normalizePlayerClaims([...state.playerClaims, ...repairedClaims]);
  }
  return repairedClaims;
}

async function loadPlayerClaims(options = {}) {
  if (!supabaseClient || !currentUserId()) return [];
  const { data, error } = await supabaseClient.rpc("laxhornet_my_player_claims");
  if (error) {
    if (!options.silent) reportTeamSetupError(error);
    return [];
  }
  state.playerClaims = normalizePlayerClaims((Array.isArray(data) ? data : []).map(playerClaimFromSupabaseRow))
    .filter((claim) => !isPlayerAccessRemoved(claim.teamId, claim.rosterPlayerId));
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
  const claimedRosterPlayers = normalizeRosterPlayers((Array.isArray(data) ? data : []).map(rosterPlayerFromSupabaseRow))
    .filter((player) => !isPlayerAccessRemoved(player.teamId, player.id, player.number));
  if (claimedRosterPlayers.length) {
    state.playerClaims = normalizePlayerClaims([
      ...state.playerClaims,
      ...claimedRosterPlayers.map(inferredClaimFromRosterPlayer).filter(Boolean),
    ]);
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
  await flushDeletedCloudRecords({ quiet: Boolean(options.silent) });
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
  const cloudGames = [...rowsById.values()]
    .map((game) => gameFromSupabaseRow(game, game.events || []))
    .filter(canShowGameForCurrentAccess);
  state.games = mergeGames(state.games, cloudGames).filter(canShowGameForCurrentAccess);
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
        ? `Synced to your account. Showing ${playerTitle(state.player)}.`
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
    const synced = await reconcileGameEventOperations(normalized);
    if (synced) uploaded += 1;
  }
  return uploaded;
}

async function flushDeletedCloudRecords(options = {}) {
  if (!supabaseClient || !currentUserId()) return;
  const deletedEvents = uniqueIds(state.deletedEventIds);
  const deletedGames = uniqueIds(state.deletedGameIds);
  let changed = false;
  for (const eventId of deletedEvents) {
    const deleted = await deleteSupabaseEvent(eventId, { quiet: Boolean(options.quiet) });
    if (deleted) changed = true;
  }
  for (const gameId of deletedGames) {
    const deleted = await deleteSupabaseGame(gameId, { quiet: Boolean(options.quiet) });
    if (deleted) changed = true;
  }
  if (changed) {
    clearResolvedCloudDeleteError();
    persistAll();
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
  if (!applyStartupDeepLink()) render();
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

async function resetThisDeviceState() {
  const confirmed = window.confirm(
    "Reset LaxHornet on this device? This signs out and clears locally cached players, teams, games, and app state from this browser. Cloud teams, accounts, approvals, and saved cloud data are not deleted.",
  );
  if (!confirmed) return;
  if (supabaseClient) await supabaseClient.auth.signOut().catch(() => {});
  clearLaxHornetBrowserStorage();
  await clearLaxHornetCaches().catch(() => {});
  await unregisterLaxHornetServiceWorkers().catch(() => {});
  window.location.replace(`app.html?fresh=${APP_VERSION}-device-reset-${Date.now()}`);
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
  const onboardingIntent = normalizeOnboardingIntent(formData.get("onboardingIntent") || state.onboardingIntent);
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
  state.onboardingIntent = onboardingIntent;

  if (teamAccessCode) await requestTeamAccessByCode(teamAccessCode, { silent: true, childJerseyNumber });
  await loadUserProfile({ silent: true });
  await loadCloudTeams({ silent: true });
  if (teamAccessCode) {
    state.accessRequestSummary = {
      email: userEmail(),
      firstName,
      lastName,
      phone,
      onboardingIntent,
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
  const onboardingIntent = normalizeOnboardingIntent(formData.get("onboardingIntent") || state.onboardingIntent);
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
    onboardingIntent,
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
        onboarding_intent: onboardingIntent,
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
  state.onboardingIntent = onboardingIntent;
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
  try {
    const { data: profileRow, error: profileError } = await supabaseClient
      .from("user_profiles")
      .select("*")
      .eq("user_id", currentUserId())
      .maybeSingle();
    if (!profileError && profileRow) row = profileRow;
  } catch (profileError) {
    console.warn("Profile fallback skipped.", profileError);
  }
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

function beginTeamAccessReview(requestId, approved) {
  state.pendingTeamAccessReview = { requestId, approved: Boolean(approved) };
  render();
}

async function confirmTeamAccessReview() {
  const pending = state.pendingTeamAccessReview;
  if (!pending) return;
  state.pendingTeamAccessReview = null;
  await reviewTeamAccessRequest(pending.requestId, pending.approved);
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

async function sendPlayerVerificationReminder(requestId) {
  if (!supabaseClient || !currentUserId() || !requestId) return;
  state.reminderBusyId = requestId;
  render();
  const { error } = await supabaseClient.rpc("laxhornet_send_player_verification_reminder", {
    reminder_request_id: requestId,
  });
  state.reminderBusyId = "";
  if (error) {
    reportTeamSetupError(error);
    render();
    return;
  }
  await loadTeamAccessRequests({ silent: true });
  render();
  showToast("Verification reminder queued");
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
  state.removedPlayerAccess = normalizeRemovedPlayerAccess(state.removedPlayerAccess).filter(
    (item) => !(item.teamId === claim.teamId && ((claim.rosterPlayerId && item.rosterPlayerId === claim.rosterPlayerId) || (jerseyNumber && item.jerseyNumber === jerseyNumber))),
  );
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
  await loadTeamAccessRequests({ silent: true });
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
  if (!window.confirm(`Remove ${playerTitle(player)} from this account? This does not delete saved games or remove the player from the team roster. It only removes this player's access from this parent account.`)) return;

  const { error } = await supabaseClient.rpc("laxhornet_delete_player_claim", {
    p_team_id: player.teamId,
    p_roster_player_id: rosterPlayerId,
  });
  if (error && !/not found|access not found|player access not found/i.test(readableSupabaseError(error))) {
    reportTeamSetupError(error);
    return;
  }

  const removedAccess = removedAccessForPlayer(player);
  if (removedAccess) {
    state.removedPlayerAccess = normalizeRemovedPlayerAccess([...state.removedPlayerAccess, removedAccess]);
  }
  state.playerClaims = state.playerClaims.filter(
    (claim) => !(claim.teamId === player.teamId && claim.rosterPlayerId === rosterPlayerId),
  );
  if (!isReviewerAccount()) {
    state.rosterPlayers = state.rosterPlayers.filter((item) => !(item.teamId === player.teamId && item.id === rosterPlayerId));
  }
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

function trustSpineBridgeEnabled() {
  return SECURE_DISCLOSURE_RUNTIME_READY && Boolean(supabaseClient) && Boolean(currentUserId());
}

function hasCanonicalTrustSpineScope(game = {}) {
  return isTeamRosterGame(game)
    && Boolean(String(gameTeamId(game)).trim() && String(gameRosterPlayerId(game)).trim());
}

function personalGameLiveShareMessage() {
  return "Secure Live Share is available for games connected to a team roster player. You can continue tracking and reviewing this personal game.";
}

function secureLiveShareEligibility(game = {}) {
  if (!hasCanonicalTrustSpineScope(game)) {
    return {
      available: false,
      reason: "personal_game",
      message: personalGameLiveShareMessage(),
    };
  }
  if (!SECURE_DISCLOSURE_RUNTIME_READY || !TRUSTED_DISCLOSURE_FEATURES.liveShareTokenRpc) {
    return {
      available: false,
      reason: "runtime_unavailable",
      message: "Live Share is temporarily unavailable. Tracking and private review remain available.",
    };
  }
  if (!backendCapabilityState.value?.secureLiveShare) {
    return {
      available: false,
      reason: backendCapabilityState.error || "capability_unconfirmed",
      message: state.isOffline
        ? "Live Share will be checked when this phone is back online. Tracking remains available."
        : "Live Share is temporarily unavailable while the app checks secure sharing support. Tracking remains available.",
    };
  }
  return {
    available: true,
    reason: "",
    message: "",
  };
}

function stableTrustSpineValue(value) {
  if (Array.isArray(value)) return value.map(stableTrustSpineValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableTrustSpineValue(value[key])]),
  );
}

function stableTrustSpineJSON(value) {
  return JSON.stringify(stableTrustSpineValue(value));
}

function trustSpineHash(value) {
  const text = typeof value === "string" ? value : stableTrustSpineJSON(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function trustSpineOperationId(kind, gameId, eventId, value = {}) {
  return `lh-${kind}-${trustSpineHash({ gameId, eventId, value })}`;
}

function trustSpineEvidenceForEvent(event = {}) {
  const normalized = normalizeEvent(event, event.gameId || "");
  return {
    occurred_at: String(normalized.timestamp || new Date().toISOString()),
    period: String(normalized.quarter || "Q1"),
    stat_type: String(normalized.statType || "note"),
    stat_label: String(normalized.statLabel || "Note"),
    category: String(normalized.category || "Note"),
    point_value: Number.isFinite(Number(normalized.pointValue)) ? Number(normalized.pointValue) : 0,
    field_zone: String(normalized.fieldZone || ""),
  };
}

function trustSpineEvidenceChanges(previous = {}, next = {}) {
  return Object.fromEntries(
    Object.keys(next)
      .filter((key) => stableTrustSpineJSON(previous[key]) !== stableTrustSpineJSON(next[key]))
      .map((key) => [key, next[key]]),
  );
}

function trustSpineState() {
  if (
    !state.trustSpineSync
    || state.trustSpineSync.version !== 1
    || typeof state.trustSpineSync.events !== "object"
    || typeof state.trustSpineSync.gameScopes !== "object"
  ) {
    state.trustSpineSync = normalizeTrustSpineSyncState(state.trustSpineSync);
  }
  return state.trustSpineSync;
}

function trustSpineGameById(gameId) {
  if (state.activeGame?.id === gameId) return normalizeGame(state.activeGame);
  const game = state.games.find((item) => item.id === gameId);
  return game ? normalizeGame(game) : null;
}

function trustSpineEventRecord(game, eventId) {
  const syncState = trustSpineState();
  const existing = syncState.events[eventId];
  if (existing) return existing;
  const record = {
    accountId: String(currentUserId() || ""),
    teamId: String(gameTeamId(game)),
    rosterPlayerId: String(gameRosterPlayerId(game)),
    gameId: String(game.id || ""),
    eventId: String(eventId || ""),
    serverEventVersion: 0,
    lifecycleState: "pending",
    acceptedEvidence: {},
    pendingOperations: [],
    acceptedReceipts: [],
    conflict: null,
    lastError: "",
    updatedAt: new Date().toISOString(),
  };
  syncState.events[eventId] = record;
  return record;
}

function trustSpinePendingOperation(record, kind) {
  return record.pendingOperations.find((operation) => operation.kind === kind);
}

function enqueueTrustSpineOperation(record, operation) {
  if (!operation?.kind || !operation.clientOperationId) return;
  if (record.pendingOperations.some((item) => item.clientOperationId === operation.clientOperationId)) return;
  record.pendingOperations.push({
    kind: operation.kind,
    clientOperationId: operation.clientOperationId,
    clientCreatedAt: operation.clientCreatedAt || new Date().toISOString(),
    eventEvidence: operation.eventEvidence && typeof operation.eventEvidence === "object" ? { ...operation.eventEvidence } : {},
    rpcPayload: operation.rpcPayload && typeof operation.rpcPayload === "object" ? { ...operation.rpcPayload } : null,
    attempts: 0,
    lastAttemptAt: "",
    lastError: "",
  });
  record.updatedAt = new Date().toISOString();
}

function queueTrustSpineEvent(game, event) {
  if (!SECURE_DISCLOSURE_RUNTIME_READY || !currentUserId() || !hasCanonicalTrustSpineScope(game) || !event?.id) return;
  const normalizedEvent = normalizeEvent(event, game.id);
  const evidence = trustSpineEvidenceForEvent(normalizedEvent);
  const record = trustSpineEventRecord(game, normalizedEvent.id);
  if (record.lifecycleState === "tombstoned") return;

  if (record.serverEventVersion < 1) {
    if (!trustSpinePendingOperation(record, "create")) {
      const clientCreatedAt = String(normalizedEvent.timestamp || new Date().toISOString());
      const rpcPayload = {
        client_operation_id: trustSpineOperationId("create", game.id, normalizedEvent.id, evidence),
        event_id: normalizedEvent.id,
        game_id: game.id,
        evidence,
        annotations: {},
        client_created_at: clientCreatedAt,
      };
      enqueueTrustSpineOperation(record, {
        kind: "create",
        clientOperationId: rpcPayload.client_operation_id,
        clientCreatedAt,
        eventEvidence: evidence,
        rpcPayload,
      });
    }
    return;
  }

  if (record.conflict) return;
  const changes = trustSpineEvidenceChanges(record.acceptedEvidence, evidence);
  if (!Object.keys(changes).length || trustSpinePendingOperation(record, "correct")) return;
  const clientCreatedAt = String(normalizedEvent.correctedAt || new Date().toISOString());
  const operationSeed = {
    baseServerEventVersion: record.serverEventVersion,
    changes,
    clientCreatedAt,
  };
  const rpcPayload = {
    client_operation_id: trustSpineOperationId("correct", game.id, normalizedEvent.id, operationSeed),
    event_id: normalizedEvent.id,
    game_id: game.id,
    base_server_event_version: record.serverEventVersion,
    changes,
    correction_reason: "Tracker event corrected",
    client_created_at: clientCreatedAt,
  };
  enqueueTrustSpineOperation(record, {
    kind: "correct",
    clientOperationId: rpcPayload.client_operation_id,
    clientCreatedAt,
    eventEvidence: changes,
    rpcPayload,
  });
}

function queueTrustSpineTombstone(game, event, reason = "Tracker event removed") {
  if (!SECURE_DISCLOSURE_RUNTIME_READY || !currentUserId() || !hasCanonicalTrustSpineScope(game) || !event?.id) return;
  const record = trustSpineEventRecord(game, event.id);
  if (record.lifecycleState === "tombstoned" || trustSpinePendingOperation(record, "tombstone")) return;
  const clientCreatedAt = new Date().toISOString();
  enqueueTrustSpineOperation(record, {
    kind: "tombstone",
    clientOperationId: trustSpineOperationId("tombstone", game.id, event.id, {
      baseServerEventVersion: record.serverEventVersion,
      reason,
      clientCreatedAt,
    }),
    clientCreatedAt,
    eventEvidence: {},
    rpcPayload: null,
  });
}

function queueTrustSpineGameReconciliation(game) {
  if (!SECURE_DISCLOSURE_RUNTIME_READY || !currentUserId() || !hasCanonicalTrustSpineScope(game)) return;
  const normalized = normalizeGame(game);
  const presentEventIds = new Set(normalized.events.map((event) => event.id));
  normalized.events.forEach((event) => queueTrustSpineEvent(normalized, event));
  Object.values(trustSpineState().events)
    .filter((record) => record.gameId === normalized.id && !presentEventIds.has(record.eventId) && isDeletedEvent(record.eventId))
    .forEach((record) => queueTrustSpineTombstone(normalized, { id: record.eventId }, "Tracker event deleted"));
  persistAll();
}

function trustSpineScopeMatches(game, scope = {}) {
  return (
    scope.accountId === String(currentUserId() || "")
    && scope.teamId === String(gameTeamId(game))
    && scope.rosterPlayerId === String(gameRosterPlayerId(game))
  );
}

async function ensureTrustSpineGameScope(game) {
  if (!trustSpineBridgeEnabled() || !hasCanonicalTrustSpineScope(game) || state.isOffline) return false;
  const syncState = trustSpineState();
  const existing = syncState.gameScopes[game.id];
  if (existing && trustSpineScopeMatches(game, existing)) return true;
  const { data, error } = await supabaseClient.rpc("lh_register_game_scope", { p_game_id: game.id });
  if (error || data?.outcome !== "accepted") {
    const detail = readableSupabaseError(error || { message: data?.code || "game_scope_unavailable" });
    state.syncStatus = "Secure sharing is waiting for synchronization";
    state.cloudError = detail;
    persistAll();
    return false;
  }
  syncState.gameScopes[game.id] = {
    gameId: game.id,
    accountId: String(currentUserId() || ""),
    teamId: String(gameTeamId(game)),
    rosterPlayerId: String(gameRosterPlayerId(game)),
    registeredAt: new Date().toISOString(),
  };
  persistAll();
  return true;
}

function trustSpineRpcForOperation(kind) {
  if (kind === "create") return "lh_create_event";
  if (kind === "correct") return "lh_correct_event";
  if (kind === "tombstone") return "lh_tombstone_event";
  return "";
}

function trustSpinePayloadForOperation(record, operation) {
  if (operation.kind !== "tombstone") return operation.rpcPayload;
  if (record.serverEventVersion < 1) return null;
  return {
    client_operation_id: operation.clientOperationId,
    event_id: record.eventId,
    game_id: record.gameId,
    base_server_event_version: record.serverEventVersion,
    tombstone_reason: "Tracker event removed",
    client_created_at: operation.clientCreatedAt,
  };
}

function acceptTrustSpineOperation(record, operation, result) {
  record.serverEventVersion = Math.max(record.serverEventVersion, Number(result.serverEventVersion || 0));
  if (operation.kind === "create") {
    record.lifecycleState = "active";
    record.acceptedEvidence = { ...operation.eventEvidence };
  } else if (operation.kind === "correct") {
    record.lifecycleState = "active";
    record.acceptedEvidence = { ...record.acceptedEvidence, ...operation.eventEvidence };
  } else if (operation.kind === "tombstone") {
    record.lifecycleState = "tombstoned";
  }
  record.pendingOperations = record.pendingOperations.filter((item) => item.clientOperationId !== operation.clientOperationId);
  record.acceptedReceipts = [...record.acceptedReceipts, {
    clientOperationId: operation.clientOperationId,
    kind: operation.kind,
    code: String(result.code || ""),
    serverEventVersion: record.serverEventVersion,
    acceptedAt: new Date().toISOString(),
  }].slice(-20);
  record.conflict = null;
  record.lastError = "";
  record.updatedAt = new Date().toISOString();
}

async function processTrustSpineOperation(record, operation) {
  const rpcName = trustSpineRpcForOperation(operation.kind);
  const rpcPayload = trustSpinePayloadForOperation(record, operation);
  if (!rpcName || !rpcPayload) return false;
  operation.attempts += 1;
  operation.lastAttemptAt = new Date().toISOString();
  const { data, error } = await supabaseClient.rpc(rpcName, { p_operation: rpcPayload });
  if (error) {
    operation.lastError = readableSupabaseError(error) || "Secure event synchronization failed";
    record.lastError = operation.lastError;
    record.updatedAt = new Date().toISOString();
    return false;
  }
  if (data?.outcome === "accepted") {
    acceptTrustSpineOperation(record, operation, data);
    return true;
  }
  record.pendingOperations = record.pendingOperations.filter((item) => item.clientOperationId !== operation.clientOperationId);
  if (data?.outcome === "conflicted") {
    record.conflict = {
      code: String(data.code || "event_conflict"),
      serverEventVersion: Number(data.serverEventVersion || record.serverEventVersion),
      clientOperationId: operation.clientOperationId,
      detectedAt: new Date().toISOString(),
    };
  }
  record.serverEventVersion = Math.max(record.serverEventVersion, Number(data?.serverEventVersion || 0));
  record.lastError = String(data?.code || "Secure event synchronization was rejected");
  record.updatedAt = new Date().toISOString();
  return false;
}

async function flushTrustSpineSync(options = {}) {
  if (!trustSpineBridgeEnabled() || state.isOffline) return false;
  if (trustSpineSyncInFlight) return trustSpineSyncInFlight;
  trustSpineSyncInFlight = (async () => {
    const gameId = String(options.gameId || "");
    const records = Object.values(trustSpineState().events)
      .filter((record) => !gameId || record.gameId === gameId)
      .sort((left, right) => left.gameId.localeCompare(right.gameId) || left.eventId.localeCompare(right.eventId));
    const gameIds = [...new Set(records.map((record) => record.gameId))];
    for (const targetGameId of gameIds) {
      const game = trustSpineGameById(targetGameId);
      if (!game || !hasCanonicalTrustSpineScope(game)) continue;
      if (!(await ensureTrustSpineGameScope(game))) continue;
      const gameRecords = records.filter((record) => record.gameId === targetGameId);
      for (const kind of ["create", "correct", "tombstone"]) {
        for (const record of gameRecords) {
          const pending = record.pendingOperations.filter((operation) => operation.kind === kind);
          for (const operation of pending) {
            await processTrustSpineOperation(record, operation);
          }
        }
      }
    }
    persistAll();
    return true;
  })();
  try {
    return await trustSpineSyncInFlight;
  } finally {
    trustSpineSyncInFlight = null;
  }
}

function trustSpineGameSynchronizationStatus(game) {
  const syncState = trustSpineState();
  const scope = syncState.gameScopes[game.id];
  const events = normalizeGame(game).events.filter((event) => !isDeletedEvent(event.id));
  const records = events.map((event) => syncState.events[event.id]).filter(Boolean);
  const pending = records.some((record) => record.pendingOperations.length);
  const conflict = records.some((record) => record.conflict || record.lastError);
  const synchronized = (
    trustSpineScopeMatches(game, scope)
    && records.length === events.length
    && records.every((record, index) => (
      record.serverEventVersion >= 1
      && record.lifecycleState === "active"
      && stableTrustSpineJSON(record.acceptedEvidence) === stableTrustSpineJSON(trustSpineEvidenceForEvent(events[index]))
    ))
    && !pending
    && !conflict
  );
  return { synchronized, pending, conflict };
}

async function reconcileTrustSpineGame(game) {
  if (!trustSpineBridgeEnabled() || !hasCanonicalTrustSpineScope(game)) return false;
  queueTrustSpineGameReconciliation(game);
  if (state.isOffline) {
    state.syncStatus = "Secure sharing is waiting for synchronization";
    persistAll();
    return false;
  }
  if (!(await ensureTrustSpineGameScope(game))) return false;
  await flushTrustSpineSync({ gameId: game.id });
  queueTrustSpineGameReconciliation(game);
  await flushTrustSpineSync({ gameId: game.id });
  const status = trustSpineGameSynchronizationStatus(game);
  if (!status.synchronized) {
    state.syncStatus = status.conflict
      ? "Secure sharing needs a correction review"
      : "Secure sharing is waiting for synchronization";
    persistAll();
    return false;
  }
  if (/secure sharing/i.test(state.syncStatus || "")) state.syncStatus = "Synced";
  persistAll();
  return true;
}

function eventOperationService() {
  if (gameEventOperationService) return gameEventOperationService;
  const factory = window.LaxHornetEventOperations?.createEventOperationService;
  if (typeof factory !== "function") {
    throw new Error("Event operation service is unavailable");
  }
  gameEventOperationService = factory({
    persistLocal: persistAll,
    queueEvent: queueTrustSpineEvent,
    queueTombstone: queueTrustSpineTombstone,
    queueReconciliation: queueTrustSpineGameReconciliation,
    syncLegacyEvent: syncLoggedEvent,
    syncLegacyGame: syncGameToSupabase,
    deleteLegacyEvent: deleteSupabaseEvent,
    flushAuthoritativeQueue: flushTrustSpineSync,
    reconcileAuthoritativeGame: reconcileTrustSpineGame,
    canUseCloud: () => Boolean(supabaseClient && currentUserId() && !state.isOffline),
    requiresAuthoritativeHistory: (game) => isTeamRosterGame(game),
    reportError: reportSyncError,
  });
  return gameEventOperationService;
}

function createGameEventOperation(game, applyLocal) {
  return eventOperationService().createGameEventOperation({ game, applyLocal });
}

function correctGameEventOperation(game, applyLocal) {
  return eventOperationService().correctGameEventOperation({ game, applyLocal });
}

function tombstoneGameEventOperation(game, reason, applyLocal) {
  return eventOperationService().tombstoneGameEventOperation({ game, reason, applyLocal });
}

function reconcileGameEventOperations(game) {
  return eventOperationService().reconcileGameEventOperations(game);
}

async function syncGameToSupabase(game, options = {}) {
  if (!supabaseClient || !game) return false;
  if (isDeletedGame(game.id)) return false;
  if (gameTeamId(game) && !canEditGame(game)) {
    state.syncStatus = "Team roster is view-only";
    return false;
  }
  if (state.isOffline) {
    state.syncStatus = "Saved on this phone";
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
  if (!supabaseClient || !game || !event) return false;
  if (gameTeamId(game) && !canEditGame(game)) {
    state.syncStatus = "Verify your player before saving team stats";
    return false;
  }
  const gameSynced = await syncGameToSupabase(game);
  if (!gameSynced) return false;
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
    return false;
  } else {
    state.syncStatus = detachedMissingTeam
      ? "Synced without team link"
      : skipped.length
      ? "Synced; setup update recommended"
      : "Synced";
  }
  return true;
}

async function deleteSupabaseEvent(eventId, options = {}) {
  if (!supabaseClient || !eventId) return;
  const rpcResult = await supabaseClient.rpc("laxhornet_delete_event", { p_event_id: eventId });
  if (!rpcResult.error || isCloudDeleteNotFoundError(rpcResult.error, "event")) {
    forgetDeletedEvent(eventId);
    clearResolvedCloudDeleteError();
    return true;
  }
  if (!isMissingRpcError(rpcResult.error)) {
    reportCloudDeleteError("event", rpcResult.error);
    return false;
  }

  const { data, error } = await supabaseClient.from("events").delete().eq("id", eventId).select("id");
  if (error) {
    reportCloudDeleteError("event", error);
    return false;
  }
  if (Array.isArray(data) && data.length) {
    forgetDeletedEvent(eventId);
    clearResolvedCloudDeleteError();
    return true;
  }
  const stillVisible = await cloudRecordStillVisible("events", eventId);
  if (!stillVisible) {
    forgetDeletedEvent(eventId);
    clearResolvedCloudDeleteError();
    return true;
  }
  if (!options.quiet) reportCloudDeleteNeedsUpdate("event");
  return false;
}

async function deleteSupabaseGame(gameId, options = {}) {
  if (!supabaseClient || !gameId) return;
  const rpcResult = await supabaseClient.rpc("laxhornet_delete_game", { p_game_id: gameId });
  if (!rpcResult.error || isCloudDeleteNotFoundError(rpcResult.error, "game")) {
    forgetDeletedGame(gameId);
    clearResolvedCloudDeleteError();
    return true;
  }
  if (!isMissingRpcError(rpcResult.error)) {
    reportCloudDeleteError("game", rpcResult.error);
    return false;
  }
  if (!options.quiet) reportCloudDeleteNeedsUpdate("game");
  return false;
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

function stopSharedGameTransport() {
  if (sharedGameChannel && supabaseClient) supabaseClient.removeChannel(sharedGameChannel);
  sharedGameChannel = null;
  if (sharedGamePollTimer) window.clearTimeout(sharedGamePollTimer);
  sharedGamePollTimer = null;
}

function publicLiveShareGameFromPayload(payload = {}) {
  const game = payload?.game;
  if (!game?.game_id) return null;
  const events = Array.isArray(payload.events)
    ? payload.events.map((event) => normalizeEvent({
        id: event.event_id,
        gameId: game.game_id,
        timestamp: event.occurred_at,
        quarter: event.period,
        statType: event.stat_type,
        statLabel: event.stat_label,
        category: event.category,
        pointValue: Number(event.point_value || 0),
        fieldZone: event.field_zone || "",
        note: "",
        tags: [],
        userId: "",
      }, game.game_id))
    : [];
  return normalizeGame({
    id: game.game_id,
    playerId: game.roster_player_id || `shared-${game.game_id}`,
    rosterPlayerId: game.roster_player_id || "",
    playerSnapshot: {
      id: game.roster_player_id || `shared-${game.game_id}`,
      name: game.player_name || "Player",
      number: game.jersey_number || "",
      team: game.team_name || "",
      position: game.position || "",
    },
    opponent: game.opponent || "Opponent",
    date: game.game_date || todayISO(),
    periodFormat: game.period_format || "quarters",
    currentQuarter: events.at(-1)?.quarter || PERIOD_FORMATS[game.period_format]?.start || "Q1",
    status: game.final_score_for == null && game.final_score_against == null ? "in-progress" : "complete",
    finalScoreFor: game.final_score_for,
    finalScoreAgainst: game.final_score_against,
    isShared: true,
    events,
  });
}

async function fetchPublicLiveShareGame(code, options = {}) {
  const { data, error } = await supabaseClient.rpc("lh_public_live_share_game", { p_share_code: code });
  if (error) throw error;
  const sharedGame = publicLiveShareGameFromPayload(data);
  if (!sharedGame) {
    stopSharedGameTransport();
    state.sharedGame = null;
    state.syncStatus = "Shared game unavailable";
    if (!options.quiet) showToast("Shared game is unavailable");
    render();
    return null;
  }
  state.sharedGame = sharedGame;
  state.syncStatus = "Watching live";
  render();
  return sharedGame;
}

function schedulePublicLiveSharePoll(code) {
  if (sharedGamePollTimer) window.clearTimeout(sharedGamePollTimer);
  sharedGamePollTimer = window.setTimeout(async () => {
    try {
      const game = await fetchPublicLiveShareGame(code, { quiet: true });
      if (game) schedulePublicLiveSharePoll(code);
    } catch {
      state.syncStatus = "Live updates paused";
      render();
      schedulePublicLiveSharePoll(code);
    }
  }, PUBLIC_LIVE_SHARE_POLL_MS);
}

function subscribeToSharedGame(gameId) {
  if (!supabaseClient || !gameId) return;
  stopSharedGameTransport();
  if (TRUSTED_DISCLOSURE_FEATURES.publicLiveShareRpc) {
    schedulePublicLiveSharePoll(state.sharedCode);
    return;
  }
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

  stopSharedGameTransport();
  if (!(await requireSecureCapability("secureLiveShare", "Live Share", { runtimeFlag: "publicLiveShareRpc" }))) return;
  if (TRUSTED_DISCLOSURE_FEATURES.publicLiveShareRpc) {
    try {
      const sharedGame = await fetchPublicLiveShareGame(code);
      if (sharedGame) subscribeToSharedGame(sharedGame.id);
    } catch {
      state.syncStatus = "Shared game unavailable";
      showToast("Shared game is unavailable");
      render();
    }
    return;
  }
  reportSecureDisclosureUnavailable("Live Share");
}

async function copyShareLink() {
  const game = state.activeGame || currentReviewGame();
  if (!game) return;
  if (!hasCanonicalTrustSpineScope(game)) {
    state.liveSharePromptGameId = "";
    state.syncStatus = "Personal game saved privately";
    showToast(personalGameLiveShareMessage());
    render();
    return;
  }
  state.liveSharePromptGameId = game.id;
  render();
}

async function copyLiveShareLinkNow(gameId) {
  const game = (state.activeGame?.id === gameId ? state.activeGame : null) || state.games.find((item) => item.id === gameId) || currentReviewGame();
  if (!game) return;
  if (!supabaseClient) {
    showToast("Live Share is not available");
    return;
  }
  if (!(await requireSecureCapability("secureLiveShare", "Live Share", { runtimeFlag: "liveShareTokenRpc" }))) return;
  if (!currentUserId()) {
    state.syncStatus = "Sign in for Live Share";
    showToast("Sign in to use Live Share");
    return;
  }
  if (!hasCanonicalTrustSpineScope(game)) {
    state.liveSharePromptGameId = "";
    state.syncStatus = "Personal game saved privately";
    showToast(personalGameLiveShareMessage());
    render();
    return;
  }
  if (TRUSTED_DISCLOSURE_FEATURES.liveShareTokenRpc) {
    const synchronized = await reconcileGameEventOperations(game);
    if (!synchronized) {
      state.syncStatus = "Secure sharing is waiting for synchronization";
      showToast("Secure sharing is waiting for synchronization. Your game remains saved.");
      render();
      return;
    }
    const tokenResult = await supabaseClient.rpc("lh_create_live_share_token", {
      p_game_id: game.id,
      p_expires_at: null,
    });
    if (tokenResult.error || tokenResult.data?.outcome !== "accepted" || !tokenResult.data?.shareCode) {
      reportSyncError(tokenResult.error || { message: tokenResult.data?.code || "Live Share token unavailable" });
      return;
    }
    const code = tokenResult.data.shareCode;
    game.isShared = true;
    game.shareCode = code;
    upsertGame(game);
    persistAll();
    const link = shareLinkForGame(game, code);
    try {
      await navigator.clipboard.writeText(link);
      state.liveSharePromptGameId = "";
      render();
      showToast("Live Share link copied");
    } catch {
      window.prompt("Copy this share link", link);
      state.liveSharePromptGameId = "";
      render();
    }
    return;
  }
  reportSecureDisclosureUnavailable("Live Share");
}

async function turnOffLiveShare(gameId) {
  const game = (state.activeGame?.id === gameId ? state.activeGame : null) || state.games.find((item) => item.id === gameId);
  if (!game) {
    state.liveSharePromptGameId = "";
    render();
    return;
  }
  if (!(await requireSecureCapability("secureLiveShare", "Live Share", { runtimeFlag: "liveShareTokenRpc" }))) return;
  if (TRUSTED_DISCLOSURE_FEATURES.liveShareTokenRpc && supabaseClient) {
    const { data, error } = await supabaseClient.rpc("lh_revoke_live_share_tokens", { p_game_id: game.id });
    if (error || data?.outcome !== "accepted") {
      reportSyncError(error || { message: data?.code || "Live Share could not be turned off" });
      return;
    }
  }
  game.isShared = false;
  if (state.activeGame?.id === game.id) {
    state.activeGame = { ...state.activeGame, isShared: false };
  } else {
    upsertGame(game);
  }
  state.liveSharePromptGameId = "";
  persistAll();
  syncGameToSupabase(game);
  render();
  showToast("Live Share turned off");
}

async function copyFamilySummary(gameId) {
  copyGameFamilyRecap(gameId);
}

function gameForFamilyRecap(gameId) {
  return (state.activeGame?.id === gameId ? state.activeGame : null) || state.games.find((item) => item.id === gameId) || currentReviewGame();
}

async function copyGameFamilyRecap(gameId) {
  const game = gameForFamilyRecap(gameId);
  if (!game) return;
  const player = gamePlayerSnapshot(game);
  const recap = buildFamilyRecap(game, game.events || [], player, calculateTotals(game.events || [], player));
  try {
    await writeTextToClipboard(recap.text);
    showToast("Recap copied.");
  } catch {
    showToast("Couldn't copy recap. Please try again.");
  }
}

async function shareGameFamilyRecap(gameId) {
  const game = gameForFamilyRecap(gameId);
  if (!game) return;
  const player = gamePlayerSnapshot(game);
  const recap = buildFamilyRecap(game, game.events || [], player, calculateTotals(game.events || [], player));
  if (!canShareFamilyRecap()) {
    try {
      await writeTextToClipboard(recap.text);
      showToast("Sharing is not available here, so the recap was copied instead.");
    } catch {
      showToast("Couldn't copy recap. Please try again.");
    }
    return;
  }

  try {
    await navigator.share({ title: recap.title, text: recap.text });
    showToast("Recap shared.");
  } catch (error) {
    if (error?.name === "AbortError") return;
    try {
      await writeTextToClipboard(recap.text);
      showToast("Sharing is not available here, so the recap was copied instead.");
    } catch {
      showToast("Couldn't copy recap. Please try again.");
    }
  }
}

function nextFocusDraftFromReview() {
  const game = currentReviewGame();
  const player = game ? gamePlayerSnapshot(game) : state.player;
  const totals = game ? calculateTotals(game.events || [], player) : calculateSeasonTotalsForPlayer(player);
  const topContribution = topContributionForTotals(totals).label;
  const intelligence = game
    ? buildPostGameIntelligence(game, game.events || [], player, totals, calculateSeasonTotalsForPlayer(player))
    : null;
  const recommendationText =
    intelligence?.developmentTakeaway?.nextFocus ||
    intelligence?.nextFocusRecommendation?.tryThisNextGame ||
    buildNextFocusLine(totals, player, topContribution, game);
  const recommendationSelected = focusValueMatchingText(recommendationText) || (recommendationText ? "custom" : recommendedFocusValue(totals));
  const recommendationCustomText = recommendationSelected === "custom" ? recommendationText : "";
  const select = document.querySelector("#nextGameFocusSelect");
  const customInput = document.querySelector("#nextGameFocusCustom");
  const selected = select?.value || recommendationSelected;
  const customText = customInput?.value?.trim() || "";
  const editorChanged =
    Boolean(select || customInput) &&
    (selected !== recommendationSelected ||
      (selected === "custom" && customText && customText !== recommendationCustomText));
  const text = editorChanged
    ? focusTextForValue(selected, customText, totals, player, topContribution)
    : recommendationText;
  const finalSelected = editorChanged ? selected : recommendationSelected;
  const finalCustomText = editorChanged ? customText : recommendationCustomText;
  return {
    game,
    player,
    selected: finalSelected,
    customText: finalCustomText,
    text,
  };
}

function saveNextGameFocusFromReview(options = {}) {
  const draft = nextFocusDraftFromReview();
  if (!draft.text) {
    showToast("Choose a focus first");
    return null;
  }
  const teamId = draft.player?.teamId || gameTeamId(draft.game) || "";
  const rosterPlayerId = draft.player?.rosterPlayerId || gameRosterPlayerId(draft.game) || "";
  state.nextGameFocus = saveScopedNextGameFocus({
    focusType: draft.selected,
    focusText: draft.text,
    sourceGameId: draft.game?.id || "",
    sourceGameDate: draft.game?.date || "",
    createdAt: new Date().toISOString(),
    status: "open",
    accountId: focusAccountId(),
    teamId,
    rosterPlayerId,
    sourceFocusText: draft.text,
    sourceSelected: draft.selected,
    sourceCustomText: draft.customText,
    changedFromSourceAt: "",
    changedFromSourceText: "",
    changedFromSourceContext: "",
    selected: draft.selected,
    customText: draft.customText,
    text: draft.text,
    gameId: draft.game?.id || "",
    playerId: draft.player?.id || "",
    updatedAt: new Date().toISOString(),
  }, draft.player);
  persistAll();
  render();
  if (!options.silent) showToast("Next game focus saved.");
  return state.nextGameFocus;
}

function focusValueMatchingText(text = "") {
  const cleanText = String(text || "").trim();
  if (!cleanText) return "";
  return NEXT_GAME_FOCUS_OPTIONS.find((option) => option.value !== "custom" && option.label === cleanText)?.value || "";
}

function selectedFocusValueForFocus(focus = null, totals = {}) {
  const saved = normalizeNextGameFocus(focus);
  return saved.selected || saved.focusType || focusValueMatchingText(saved.text) || recommendedFocusValue(totals);
}

function focusContextLabel(context = "") {
  if (context === "home") return "Home";
  if (context === "start") return "Track";
  return "app";
}

function formatFocusChangeDate(value = "") {
  const clean = String(value || "").trim();
  if (!clean) return "";
  const datePart = clean.includes("T") ? clean.slice(0, 10) : clean;
  return formatDate(datePart);
}

function sourceReviewFocusChangeNote(focus = null, gameId = "") {
  const saved = normalizeNextGameFocus(focus);
  if (!saved.text || !saved.sourceGameId || saved.sourceGameId !== gameId) return "";
  const sourceText = saved.sourceFocusText || saved.text;
  const changedText = saved.changedFromSourceText || saved.text;
  if (!saved.changedFromSourceAt || !changedText || changedText === sourceText) return "";
  const changedDate = formatFocusChangeDate(saved.changedFromSourceAt);
  return `Changed to "${changedText}"${changedDate ? ` on ${changedDate}` : ""}.`;
}

function saveInlineNextGameFocus(formData, context = "") {
  const player = state.player;
  const saved = openNextGameFocusForPlayer(player);
  if (!saved.text) {
    showToast("Save a focus from Game Review first.");
    return null;
  }
  const totals = calculateSeasonTotalsForPlayer(player);
  const topContribution = topContributionForTotals(totals).label;
  const selected = String(formData.get("focusType") || "").trim() || selectedFocusValueForFocus(saved, totals);
  const customText = String(formData.get("customFocus") || "").trim();
  const text = focusTextForValue(selected, customText, totals, player, topContribution);
  if (!text) {
    showToast("Choose a focus first.");
    return null;
  }
  const now = new Date().toISOString();
  const originalSelected =
    saved.sourceSelected ||
    saved.selected ||
    saved.focusType ||
    focusValueMatchingText(saved.text) ||
    selectedFocusValueForFocus(saved, totals);
  const updated = normalizeNextGameFocus({
    ...saved,
    focusType: selected,
    focusText: text,
    status: "open",
    accountId: focusAccountId(),
    teamId: player?.teamId || saved.teamId || "",
    rosterPlayerId: player?.rosterPlayerId || saved.rosterPlayerId || "",
    playerId: player?.id || saved.playerId || "",
    sourceFocusText: saved.sourceFocusText || saved.text,
    sourceSelected: originalSelected,
    sourceCustomText: saved.sourceCustomText || saved.customText,
    changedFromSourceAt: now,
    changedFromSourceText: text,
    changedFromSourceContext: focusContextLabel(context),
    selected,
    customText,
    text,
    updatedAt: now,
  });
  state.nextGameFocus = saveScopedNextGameFocus(updated, player);
  state.focusEditorContext = "";
  persistAll();
  render();
  showToast("Next game focus changed.");
  return state.nextGameFocus;
}

function saveInlineNextGameFocusFromPanel(panel) {
  if (!panel) return null;
  const formData = new FormData();
  formData.set("focusType", panel.querySelector('select[name="focusType"]')?.value || "");
  formData.set("customFocus", panel.querySelector('input[name="customFocus"]')?.value || "");
  return saveInlineNextGameFocus(formData, panel.dataset.focusContext || "");
}

function familyRecapFocusStorageKey(game = {}, player = state.player) {
  const normalized = normalizePlayer(player || {});
  const gameId = game?.id || "game";
  const teamId = normalized.teamId || gameTeamId(game) || "local";
  const rosterPlayerId = normalized.rosterPlayerId || gameRosterPlayerId(game) || normalized.id || "player";
  return [
    STORAGE_KEYS.familyRecapFocus,
    `user.${focusStorageSegment(focusAccountId())}`,
    `team.${focusStorageSegment(teamId)}`,
    `player.${focusStorageSegment(rosterPlayerId)}`,
    `game.${focusStorageSegment(gameId)}`,
  ].join(".");
}

function loadFamilyRecapFocus(game = {}, player = state.player) {
  if (!game?.id) return "";
  try {
    const saved = JSON.parse(localStorage.getItem(familyRecapFocusStorageKey(game, player)) || "null");
    return String(saved?.focusText || "").trim();
  } catch {
    return "";
  }
}

function saveFamilyRecapFocus(game = {}, player = state.player, focusText = "") {
  const text = String(focusText || "").trim();
  if (!game?.id || !text) return "";
  const normalized = normalizePlayer(player || {});
  localStorage.setItem(
    familyRecapFocusStorageKey(game, player),
    JSON.stringify({
      focusText: text,
      gameId: game.id,
      teamId: normalized.teamId || gameTeamId(game) || "",
      rosterPlayerId: normalized.rosterPlayerId || gameRosterPlayerId(game) || "",
      playerId: normalized.id || "",
      updatedAt: new Date().toISOString(),
    }),
  );
  return text;
}

function addFocusToFamilyRecap() {
  const draft = nextFocusDraftFromReview();
  if (!draft.text) {
    showToast("Choose a focus first");
    return;
  }
  saveFamilyRecapFocus(draft.game, draft.player, draft.text);
  render();
  showToast("Focus added to recap");
}

function markFocusUsedForGame(game = state.activeGame) {
  if (!game) return null;
  const player = gamePlayerSnapshot(game);
  const saved = activeNextGameFocusForPlayer(player);
  if (!saved.text || saved.status !== "open") return null;
  const updated = normalizeNextGameFocus({
    ...saved,
    startedGameId: game.id,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  state.nextGameFocus = saveScopedNextGameFocus(updated, player);
  return state.nextGameFocus;
}

function reviewFollowUpFocus(game = currentReviewGame()) {
  if (!game) return normalizeNextGameFocus(null);
  const player = gamePlayerSnapshot(game);
  const saved = activeNextGameFocusForPlayer(player);
  if (!saved.text || saved.status !== "open") return normalizeNextGameFocus(null);
  if (saved.startedGameId !== game.id) return normalizeNextGameFocus(null);
  if (saved.sourceGameId === game.id) return normalizeNextGameFocus(null);
  return saved;
}

function updateFocusFollowUp(result, game = currentReviewGame()) {
  const focus = reviewFollowUpFocus(game);
  if (!focus.text || !game) return;
  const player = gamePlayerSnapshot(game);
  const completed = result === "yes";
  const carryForward = result === "carry" || result === "somewhat" || result === "not-yet";
  const updated = normalizeNextGameFocus({
    ...focus,
    status: completed ? "completed" : "open",
    followUpResult: result,
    followUpGameId: game.id,
    followUpAt: new Date().toISOString(),
    startedGameId: carryForward ? "" : focus.startedGameId,
    updatedAt: new Date().toISOString(),
  });
  state.nextGameFocus = saveScopedNextGameFocus(updated, player);
  persistAll();
  render();
  if (completed) showToast("Focus marked complete.");
  else showToast("Focus carried forward.");
}

async function writeTextToClipboard(text) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to the textarea method for older iOS/browser contexts.
    }
  }

  if (typeof document === "undefined") throw new Error("Clipboard unavailable");
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-1000px";
  textarea.style.left = "-1000px";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!copied) throw new Error("Clipboard unavailable");
}

function canShareFamilyRecap() {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

async function copyRosterSummary() {
  const team = activeTeam();
  if (!team || !canManageRoster(team.id)) return;
  const roster = teamRosterPlayers(team.id);
  const lines = [
    `${team.name} roster`,
    team.inviteCode ? `Team Code: ${team.inviteCode}` : "",
    "",
    ...roster.map((player) => {
      const claimed = hasPlayerClaim(player.teamId, player.id) ? "Verified" : "Unverified";
      return `${player.number ? `#${player.number} ` : ""}${player.name}${player.position ? ` - ${player.position}` : ""} - ${claimed}`;
    }),
  ].filter((line, index, list) => line || list[index - 1] !== "");
  const summary = lines.join("\n");
  try {
    await navigator.clipboard.writeText(summary);
    showToast("Roster copied");
  } catch {
    window.prompt("Copy roster", summary);
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

function shouldHideShellStatus(options = {}) {
  if (options.hideStatus) return true;
  if (!state.authUser) return true;
  return ["profileSetup", "requestSubmitted", "authSuccess", "teamAccess"].includes(state.screen);
}

function renderShell(content, options = {}) {
  const statusText = state.activeGame ? "Live" : "";
  const hideShellStatus = shouldHideShellStatus(options);
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
    ${hideShellStatus ? "" : renderConnectionNotice()}
    ${content}
    ${renderCancelGameModal()}
    ${renderEndGameModal()}
    ${renderGameSavedModal()}
    ${renderLiveShareModal()}
    ${renderExportDialog()}
    ${renderImportDialog()}
    ${renderTeamAccessReviewModal()}
    ${renderDeleteGameModal()}
    ${options.hideNav ? "" : renderBottomNav()}
    ${state.toast ? `<div class="toast" role="status">${escapeHTML(state.toast)}</div>` : ""}
  `;
}

function renderCancelGameModal() {
  if (!state.pendingCancelGame || !state.activeGame) return "";
  const discardable = isDiscardableTrackingSession();
  return `
    <section class="modal-backdrop" role="presentation" data-cancel-game-backdrop>
      <div
        class="confirm-modal cancel-game-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancelGameTitle"
        aria-describedby="cancelGameDescription"
      >
        <h3 id="cancelGameTitle">${discardable ? "Cancel this game?" : "Exit tracking?"}</h3>
        <p class="muted small" id="cancelGameDescription">${
          discardable
            ? "This will discard the current game and all events recorded during it. This action cannot be undone."
            : "This game was already saved before this tracking session. Exit tracking without deleting the saved game."
        }</p>
        <div class="edit-actions">
          <button class="btn secondary" type="button" data-action="keep-tracking">Keep Tracking</button>
          <button class="btn danger" type="button" data-action="confirm-cancel-game">${
            discardable ? "Cancel Game" : "Exit Tracking"
          }</button>
        </div>
      </div>
    </section>
  `;
}

function renderConnectionNotice() {
  if (state.isOffline) {
    return `
      <section class="sync-notice offline" role="status">
        <strong>You&apos;re offline. Keep tracking.</strong>
        <span>Events are saved on this device and will sync when your connection returns.</span>
      </section>
    `;
  }
  if (state.syncStatus === "Saved on this phone") {
    return `
      <section class="sync-notice waiting" role="status">
        <strong>Saved on this phone</strong>
        <span>We&apos;ll sync this game when your connection returns.</span>
      </section>
    `;
  }
  return "";
}

function renderDeleteGameModal() {
  if (!state.pendingDeleteGameId) return "";
  const game = state.games.find((item) => item.id === state.pendingDeleteGameId);
  if (!game) return "";
  return `
    <section class="modal-backdrop" role="presentation">
      <div class="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="deleteGameTitle">
        <h3 id="deleteGameTitle">Delete this game?</h3>
        <p class="muted small">This removes the game from your saved history and season totals. This cannot be undone.</p>
        <div class="edit-actions">
          <button class="btn secondary" type="button" data-action="cancel-delete-game">Cancel</button>
          <button class="btn danger" type="button" data-action="confirm-delete-game" data-game-id="${escapeHTML(game.id)}">Delete Game</button>
        </div>
      </div>
    </section>
  `;
}

function renderEndGameModal() {
  if (!state.pendingEndGame || !state.activeGame) return "";
  return `
    <section class="modal-backdrop" role="presentation">
      <div class="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="endGameTitle">
        <h3 id="endGameTitle">End game and save review?</h3>
        <p class="muted small">You can still reopen this game to edit events, tags, notes, and game details.</p>
        <div class="edit-actions">
          <button class="btn secondary" type="button" data-action="cancel-end-game">Keep Tracking</button>
          <button class="btn danger" type="button" data-action="confirm-end-game">End Game &amp; Review</button>
        </div>
      </div>
    </section>
  `;
}

function renderGameSavedModal() {
  if (!state.gameSavedSummaryId) return "";
  const game = state.games.find((item) => item.id === state.gameSavedSummaryId);
  if (!game) return "";
  const player = gamePlayerSnapshot(game);
  return `
    <section class="modal-backdrop" role="presentation">
      <div class="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="gameSavedTitle">
        <h3 id="gameSavedTitle">Game saved. Review ${escapeHTML(possessiveName(playerFirstName(player)))} impact.</h3>
        <p class="muted small">The game is saved in Past Games and can be reopened for corrections.</p>
        <div class="edit-actions">
          <button class="btn positive" type="button" data-action="open-saved-review" data-game-id="${escapeHTML(game.id)}">Open Game Review</button>
          <button class="btn secondary" type="button" data-action="copy-family-summary" data-game-id="${escapeHTML(game.id)}">Copy Recap</button>
          <button class="btn ghost modal-ghost" type="button" data-action="close-saved-game">Back Home</button>
        </div>
      </div>
    </section>
  `;
}

function renderLiveShareModal() {
  if (!state.liveSharePromptGameId) return "";
  const game = (state.activeGame?.id === state.liveSharePromptGameId ? state.activeGame : null) || state.games.find((item) => item.id === state.liveSharePromptGameId);
  if (!game) return "";
  const liveShareEligibility = secureLiveShareEligibility(game);
  const liveShareAvailable = liveShareEligibility.available;
  return `
    <section class="modal-backdrop" role="presentation">
      <div class="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="liveShareTitle">
        <h3 id="liveShareTitle">Live Share</h3>
        <p class="muted small">${
          liveShareAvailable
            ? "Anyone with this link can view the live game timeline. Only share it with people you trust."
            : escapeHTML(liveShareEligibility.message)
        }</p>
        <div class="edit-actions">
          ${
            liveShareAvailable
              ? `<button class="btn positive" type="button" data-action="confirm-copy-share-link" data-game-id="${escapeHTML(game.id)}">Copy Live Share Link</button>
                 <button class="btn danger-outline" type="button" data-action="turn-off-live-share" data-game-id="${escapeHTML(game.id)}">Turn Off Live Share</button>`
              : `<button class="btn secondary" type="button" data-action="close-live-share">Continue Tracking</button>
                 <button class="btn positive" type="button" data-nav="player">Select a Roster Player</button>`
          }
        </div>
      </div>
    </section>
  `;
}

function requestedRosterPlayerForAccess(request = {}) {
  const jersey = String(request.childJerseyNumber || "").trim();
  if (!request.teamId || !jersey) return null;
  return teamRosterPlayers(request.teamId).find((player) => String(player.number || "").trim() === jersey) || null;
}

function renderTeamAccessReviewModal() {
  const pending = state.pendingTeamAccessReview;
  if (!pending) return "";
  const request = state.teamAccessRequests.find((item) => item.id === pending.requestId);
  if (!request) return "";
  const rosterPlayer = requestedRosterPlayerForAccess(request);
  const playerName = rosterPlayer?.name || "this player";
  const jersey = request.childJerseyNumber || rosterPlayer?.number || "";
  const approving = Boolean(pending.approved);
  return `
    <section class="modal-backdrop" role="presentation">
      <div class="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="teamAccessReviewTitle">
        <h3 id="teamAccessReviewTitle">${approving ? `Approve this parent for ${escapeHTML(playerName)}${jersey ? ` #${escapeHTML(jersey)}` : ""}?` : "Reject this access request?"}</h3>
        <p class="muted small">${
          approving
            ? "They will be able to track this player's games and view this player's saved stats for this team. They will not be able to edit the team roster."
            : "The parent will not be linked to this player. They can request again if the team code or jersey number was entered incorrectly."
        }</p>
        <div class="edit-actions">
          <button class="btn secondary" type="button" data-action="cancel-team-access-review">Cancel</button>
          <button class="btn ${approving ? "positive" : "danger"}" type="button" data-action="confirm-team-access-review">${approving ? "Approve Parent Access" : "Reject Request"}</button>
        </div>
      </div>
    </section>
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
    { screen: "more", label: "More", icon: "manage", active: ["more", "player", "settings", "team", "teamAccess", "profileSetup", "tutorial", "help", "launchKit", "promoDemo", "demo"].includes(state.screen) },
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
    help: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.4a8.6 8.6 0 1 0 0 17.2 8.6 8.6 0 0 0 0-17.2Zm0 15.2a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Zm1.2-4.2h-2.1v-.7c0-1.1.6-1.8 1.6-2.5.8-.6 1.3-1 1.3-1.8 0-.9-.7-1.4-1.8-1.4-1 0-1.8.4-2.5 1.1L8.5 7.6A5 5 0 0 1 12.3 6c2.4 0 4 1.3 4 3.3 0 1.7-.9 2.5-2 3.2-.8.5-1.1.9-1.1 1.6v.3Z"/></svg>`,
    season: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19h14v1.7H5V19Zm1.3-7.2h3v5.6h-3v-5.6Zm4.2-6.6h3v12.2h-3V5.2Zm4.2 3.9h3v8.3h-3V9.1Z"/></svg>`,
    share: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.2 15.2a3.1 3.1 0 0 0-2.4 1.1L9.4 12.8c.1-.3.1-.5.1-.8s0-.5-.1-.8l6.4-3.5a3.1 3.1 0 1 0-.9-1.8L8.5 9.4a3.1 3.1 0 1 0 0 5.2l6.4 3.5a3.1 3.1 0 1 0 3.3-2.9Z"/></svg>`,
    cloud: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.2 18.7a5.1 5.1 0 0 1-.6-10.1 6.2 6.2 0 0 1 11.8 2.2 4 4 0 0 1-.9 7.9H8.2Zm7.8-5.5h-2.7V7.7h-2.5v5.5H8.1l4 4.1 3.9-4.1Z"/></svg>`,
    update: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.2a7.8 7.8 0 0 1 7.5 5.6h2.2l-3.5 4.1-3.5-4.1h2.2a5.3 5.3 0 1 0-.9 5.2l1.8 1.7A7.8 7.8 0 1 1 12 4.2Zm1.2 4v4.2l3 1.8-1.1 1.8-4.2-2.5V8.2h2.3Z"/></svg>`,
    lock: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V8.1a5 5 0 0 1 10 0V10h1.1c.9 0 1.6.7 1.6 1.6v7.1c0 .9-.7 1.6-1.6 1.6H5.9c-.9 0-1.6-.7-1.6-1.6v-7.1c0-.9.7-1.6 1.6-1.6H7Zm2.2 0h5.6V8.1a2.8 2.8 0 0 0-5.6 0V10Zm2.8 6.6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"/></svg>`,
    exit: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.4 3.8h8.2c.9 0 1.6.7 1.6 1.6v2.3h-2.3V6.1H6.7v11.8h5.2v-1.6h2.3v2.3c0 .9-.7 1.6-1.6 1.6H4.4V3.8Zm11.1 4.1 4.9 4.1-4.9 4.1v-2.8H9.7v-2.6h5.8V7.9Z"/></svg>`,
    reset: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.8 3.3a1.4 1.4 0 0 1 1.2 2.1l-3.2 5.3-2.4-1.4 3.2-5.3c.2-.5.7-.7 1.2-.7Zm-6.3 6.1 5.5 3.3-.8 1.4a1.4 1.4 0 0 1-1.9.5L12.1 17l.8-3.1-2.5 2.1-3.2-1.9 3.4-4.2a1.5 1.5 0 0 1 1.9-.5Zm-5.9 5.8 4 2.4-.9 3.4-5.2-3.1 2.1-2.7Z"/></svg>`,
    player: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.2a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0 9.8c4.2 0 7.6 2.4 7.6 5.4v.4H4.4v-.4c0-3 3.4-5.4 7.6-5.4Z"/></svg>`,
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
    const adminPortalButton = isReviewerAccount()
      ? `<button class="btn brand neutral" type="button" data-action="${isPlatformReviewer() ? "open-tracker-view" : "open-admin-portal"}">${isPlatformReviewer() ? "Open Parent Tracker App" : "Open Team Admin Portal"}</button>`
      : "";
    return `
      <section class="card pad account-card">
        <h3>User Profile</h3>
        <p class="muted small">${escapeHTML([state.userProfile?.firstName, state.userProfile?.lastName].filter(Boolean).join(" ") || userEmail())}</p>
        <p class="muted small">${escapeHTML(userEmail())}</p>
        <p class="muted small">Access: ${escapeHTML(isReviewerAccount() ? `Reviewer / ${appRoleLabel(role)}` : appRoleLabel(role))}</p>
        <p class="muted small">${escapeHTML(displaySyncStatus())}</p>
        ${state.cloudError ? `<p class="muted small">Sync issue: ${escapeHTML(state.cloudError)}</p>` : ""}
        <div class="account-actions">
          ${adminPortalButton}
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
        <button class="btn secondary auth-login" type="submit" name="authAction" value="sign-in" ${state.authBusy ? "disabled" : ""}>${state.authBusy ? "Working..." : "Log In"}</button>
        <button class="btn neutral auth-create-dark" type="submit" name="authAction" value="sign-up" ${state.authBusy ? "disabled" : ""}>${state.authBusy ? "Sending..." : "Create New Account"}</button>
        <button class="btn neutral auth-demo-light" type="button" data-nav="demo">View Demo Game</button>
      </div>
      ${renderInstallCard({ compact: true })}
      <div class="auth-legal muted small">
        <p>By creating an account, you agree to the <a href="terms.html" target="_blank" rel="noopener">LaxHornet Terms of Use</a> and <a href="privacy.html" target="_blank" rel="noopener">Privacy Policy</a>.</p>
      </div>
    </form>
  `;
}

function renderWatchSharedGameForm(options = {}) {
  const expanded = options.expanded ?? (options.defaultExpanded && !state.watchShareTouched ? true : state.watchShareExpanded);
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
              <p class="muted small">Anyone with this link can view the live game timeline. Only share it with people you trust.</p>
            </div>`
          : ""
      }
    </form>
  `;
}

function renderWatchSharedGameInline() {
  if (!state.watchShareExpanded) return "";
  return `
    <form class="more-inline-form share-watch-inline-form" data-form="watch-share">
      <div class="field">
        <label for="shareCodeMore">Share code</label>
        <input id="shareCodeMore" name="shareCode" value="${escapeHTML(state.sharedCode)}" placeholder="ABC123" autocapitalize="characters" />
      </div>
      <button class="mini-btn" type="submit">Watch Live</button>
      <p class="muted small">Anyone with this link can view the live game timeline. Only share it with people you trust.</p>
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
        <span><strong>${signedMetric(totals.possessionValue)}</strong> Possession Value</span>
        <span><strong>${totals.goals}</strong> Goals</span>
        <span><strong>${totals.assists}</strong> Assists</span>
      </div>
      <div class="player-assignment-actions">
        <button class="mini-btn" type="button" data-player-go="${escapeHTML(normalized.id)}" data-target-screen="start">Track</button>
        <button class="mini-btn light" type="button" data-player-go="${escapeHTML(normalized.id)}" data-target-screen="past">Review</button>
        <button class="mini-btn light" type="button" data-player-go="${escapeHTML(normalized.id)}" data-target-screen="dashboard">Season</button>
      </div>
    </section>
  `;
}

function renderMyPlayersList(options = {}) {
  const players = visiblePlayers();
  const showHeaderAction = options.showHeaderAction !== false;
  if (!players.length) {
    return `
      <section class="card pad">
        <h3>No approved player yet</h3>
        <p class="muted small">Add a player with your team code and jersey number. Once your team admin approves it, you can start tracking games.</p>
        <button class="mini-btn" type="button" data-nav="team">Add Player</button>
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
        ${showHeaderAction ? `<button class="mini-btn light" type="button" data-nav="player">Players & Teams</button>` : ""}
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

function renderParentRequestStatus(request = {}) {
  if (request.status === "pending") return `<span class="status-pill warning">Pending approval</span>`;
  if (requestNeedsPlayerVerification(request)) return `<span class="status-pill danger">Needs player verification</span>`;
  if (request.status === "approved") return `<span class="status-pill success">Approved</span>`;
  return `<span class="status-pill muted">${escapeHTML(request.status || "Request")}</span>`;
}

function renderParentRequestRow(request = {}, options = {}) {
  const team = teamById(request.teamId);
  const parentName = [request.firstName, request.lastName].filter(Boolean).join(" ");
  const displayName = parentName || request.email || "Unknown parent";
  const rosterPlayer = requestedRosterPlayerForAccess(request);
  const jersey = request.childJerseyNumber || rosterPlayer?.number || "";
  const teamName = request.teamName || team?.name || "this team";
  const playerCopy = rosterPlayer
    ? `${rosterPlayer.name}${jersey ? ` #${jersey}` : ""}`
    : `${jersey ? `#${jersey}` : "the requested jersey"}`;
  const detailCopy = request.status === "pending"
    ? `${displayName} is requesting access to ${playerCopy} on ${teamName}.`
    : requestNeedsPlayerVerification(request)
      ? `Team access is approved for ${playerCopy} on ${teamName}. The parent still needs verified player access.`
      : request.status === "approved"
        ? `${displayName} has verified player access for ${playerCopy} on ${teamName}.`
        : `${displayName} requested access to ${playerCopy} on ${teamName}.`;
  const showApprovalActions = request.status === "pending" && options.showReviewActions !== false;
  const showReminder = requestNeedsPlayerVerification(request) && options.showReminder !== false;
  const reminderBusy = state.reminderBusyId === request.id;
  const emailTarget = startupOpenTarget === "team-request" && startupRequestId === request.id;
  return `
    <div class="access-request-row detailed ${showReminder ? "needs-verification" : ""} ${emailTarget ? "email-request-target" : ""}" data-team-access-request="${escapeHTML(request.id)}">
      <div class="request-main">
        <div class="request-title-line">
          <strong>${escapeHTML(displayName)}</strong>
          ${renderParentRequestStatus(request)}
        </div>
        <small>${escapeHTML(detailCopy)}</small>
        ${request.email ? `<small class="request-email">${escapeHTML(request.email)}</small>` : ""}
      </div>
      <div class="event-actions request-actions">
        ${
          showApprovalActions
            ? `<button class="mini-btn" type="button" data-review-team-access="${request.id}" data-approved="true">Approve Access</button>
               <button class="mini-btn danger" type="button" data-review-team-access="${request.id}" data-approved="false">Reject Request</button>`
            : ""
        }
        ${
          showReminder
            ? `<button class="mini-btn light" type="button" data-action="send-verification-reminder" data-request-id="${escapeHTML(request.id)}" ${reminderBusy ? "disabled" : ""}>${reminderBusy ? "Sending..." : "Email Reminder"}</button>`
            : ""
        }
      </div>
    </div>
  `;
}

function renderTeamAccessRequests() {
  const team = activeTeam();
  if (!team || !canManageRoster(team.id)) return "";
  const requests = state.teamAccessRequests.filter(
    (request) => request.teamId === team.id && (request.status === "pending" || requestNeedsPlayerVerification(request)),
  );
  const reminderCount = requests.filter(requestNeedsPlayerVerification).length;
  return `
    <div class="team-roster-block unclaimed-summary-block access-summary-block admin-workflow-panel">
      <div class="unclaimed-summary-head">
        <div>
          <h4>Parent Requests</h4>
          <p class="muted small">${requests.length ? "Approve new requests or remind approved parents to verify their player." : "No parent requests need action for this team."}</p>
        </div>
        <strong>${requests.length}</strong>
      </div>
      ${reminderCount ? `<p class="muted small unclaimed-meta">${reminderCount} approved parent${reminderCount === 1 ? "" : "s"} still need player verification.</p>` : ""}
      ${
        requests.length
          ? `<div class="access-request-list">
              ${requests.map((request) => renderParentRequestRow(request)).join("")}
            </div>`
          : `<p class="muted small unclaimed-meta">Share the team code when a parent needs access.</p>`
      }
    </div>
  `;
}

function renderAdminTeamRequestInbox() {
  if (!isPlatformReviewer()) return "";
  const activeTeamId = activeTeam()?.id || "";
  const requests = state.teamAccessRequests.filter(
    (request) => (request.status === "pending" || requestNeedsPlayerVerification(request)) && (!activeTeamId || request.teamId !== activeTeamId),
  );
  if (!requests.length) return "";
  const pendingCount = requests.filter((request) => request.status === "pending").length;
  const reminderCount = requests.filter(requestNeedsPlayerVerification).length;
  return `
    <section class="card pad admin-review-card admin-workflow-card">
      <div class="section-head compact-head">
        <div>
          <h3>Other Team Requests</h3>
          <p class="muted small">Requests needing action for teams other than the selected team.</p>
        </div>
        <button class="mini-btn light" type="button" data-action="sync-team-roster">Sync</button>
      </div>
      <div class="admin-mini-stats">
        <div><span>Pending</span><strong>${pendingCount}</strong></div>
        <div><span>Needs verification</span><strong>${reminderCount}</strong></div>
      </div>
      ${
        `<div class="admin-request-list">
              ${requests.map((request) => renderParentRequestRow(request)).join("")}
            </div>`
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

function renderAdminTeamSnapshot(team, roster = []) {
  if (!team || !canManageRoster(team.id)) return "";
  const verifiedCount = roster.filter((player) => hasPlayerClaim(player.teamId, player.id)).length;
  const requests = state.teamAccessRequests.filter((request) => request.teamId === team.id);
  const needsActionCount = requests.filter((request) => request.status === "pending" || requestNeedsPlayerVerification(request)).length;
  return `
    <div class="admin-team-snapshot">
      <div>
        <span>Roster</span>
        <strong>${roster.length}</strong>
      </div>
      <div>
        <span>Verified</span>
        <strong>${verifiedCount}</strong>
      </div>
      <div>
        <span>Needs action</span>
        <strong>${needsActionCount}</strong>
      </div>
    </div>
  `;
}

function renderMyTeamAccessRequests() {
  if (canCreateTeams()) return "";
  const ownRequests = ownTeamAccessRequests().filter((request) => {
    if (requestAccessRemoved(request)) return true;
    if (request.status !== "approved") return true;
    return requestNeedsPlayerVerification(request);
  });
  if (!ownRequests.length) return "";
  return `
    <div class="team-roster-block access-status-block">
      <div class="section-head compact-head">
        <div>
          <h4>Access Status</h4>
          <p class="muted small">Items appear here only when approval or jersey verification still needs attention.</p>
        </div>
      </div>
      <div class="admin-request-list">
        ${ownRequests
          .map(
            (request) => {
              const needsClaim =
                request.status === "approved" &&
                request.requestedRole === "tracker" &&
                !playerClaimForRequest(request);
              return `
                <div class="admin-request-row">
                  <span>
                    <strong>${escapeHTML(request.teamName || "Team")}</strong>
                    <small>${escapeHTML(teamAccessStatusCopy(request))}</small>
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

  const rawTeam = activeTeam();
  const team = canCreateTeams()
    ? rawTeam
    : rawTeam && teamHasVerifiedPlayerAccess(rawTeam.id)
      ? rawTeam
      : state.teams.find((item) => teamHasVerifiedPlayerAccess(item.id)) || null;
  const roster = team ? visibleRosterPlayers(teamRosterPlayers(team.id)) : [];
  const fullTeamRoster = team ? teamRosterPlayers(team.id) : [];
  const editable = team ? canManageRoster(team.id) : false;
  const manageRoster = team ? canManageRoster(team.id) : false;
  const deletableTeam = team ? canDeleteTeam(team.id) : false;
  const displayTeams = canCreateTeams()
    ? state.teams
    : state.teams.filter((item) => teamHasVerifiedPlayerAccess(item.id));
  const teams = displayTeams
    .map((item) => {
      const active = item.id === team?.id;
      const accessCopy = item.localRecovered && !item.cloudBacked
        ? "Local copy"
        : item.role === "admin" && canCreateTeams()
        ? `${item.inviteCode ? `Team code: ${item.inviteCode}` : "Access: approved"}`
        : "Verified player access";
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
  const teamCardTitle = canCreateTeams() ? "Connected Team" : "Your Verified Players";
  const teamHeaderCopy = !team
    ? canCreateTeams()
      ? "Create a team or request access with a team code."
      : "No verified players yet. Add a player with your team code and jersey number."
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
              </div>
              ${
                teams
                  ? `<div class="team-chip-row">${teams}</div>`
                  : `<p class="muted small">${
                      canCreateTeams()
                        ? "No teams yet. Create one for your roster or request access with a team code."
                        : "No verified players yet. Add a player below to start the approval process."
                    }</p>`
              }
              ${team?.localRecovered && !team.cloudBacked ? `<div class="notice-card error-card compact-notice"><strong>Team needs attention.</strong><p class="muted small">This team was recovered from this device, but it is not connected to your account. Remove it or recreate the team before adding roster players.</p></div>` : ""}
              ${state.cloudError ? `<div class="notice-card error-card compact-notice"><strong>Sync needs attention</strong><p class="muted small">${escapeHTML(state.cloudError)}</p></div>` : ""}
              ${manageRoster ? renderAdminTeamSnapshot(team, fullTeamRoster) : ""}
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
                                <h4>Roster</h4>
                                <p class="muted small">Admin-only roster tools for preloading players by name and jersey number.</p>
                              </div>
                            </div>
                            <div class="player-chip-row">${rosterContent}</div>
                            ${claimByNumberForm}
                          </div>
                          ${selectedTeamRosterPlayer ? renderEditRosterPlayerBlock(selectedTeamRosterPlayer) : ""}
                          ${renderAddRosterPlayerBlock()}
                          <div class="team-roster-block admin-tool-group team-safety-group">
                            <h4>Access & Cleanup</h4>
                            <p class="muted small">Export roster details, manage parent access, or delete this team when needed.</p>
                            <div class="team-actions">
                              <button class="mini-btn light" type="button" data-action="copy-roster-summary">Export Roster</button>
                              ${deletableTeam ? `<button class="mini-btn danger" type="button" data-action="delete-team">Delete Team</button>` : ""}
                            </div>
                          </div>`
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
  if (isPlatformReviewer()) return renderAdminPortal();

  const season = calculateSeasonTotals();
  const hasApprovedPlayer = visiblePlayers().length > 0 && playerAccessStatus(state.player) === "Approved";

  return renderShell(`
    <section class="screen-title home-title">
      <h2>What should I do next?</h2>
      <p>Start tracking, review a game, or check the season story.</p>
    </section>

    <section class="stack">
      ${renderApprovedPlayerCallout()}
      ${hasApprovedPlayer ? renderHomeReadyCard() : renderNoApprovedPlayerHome()}
      ${hasApprovedPlayer ? renderHomeNextGameFocusCard() : ""}
      ${renderHomeQuickActions()}

      <div class="metric-grid">
        <div class="metric"><strong>${season.gamesPlayed}</strong><span>Games</span></div>
        <div class="metric"><strong>${signedMetric(season.possessionValue)}</strong><span>Possession Value</span></div>
        <div class="metric"><strong>${season.goals}</strong><span>Goals</span></div>
        <div class="metric"><strong>${season.assists}</strong><span>Assists</span></div>
      </div>
      ${renderGameDayStatusCard()}
    </section>
  `);
}

function renderMore() {
  const team = activeTeam();
  const playerLine = [playerSubline(state.player)].filter(Boolean).join("");
  const profileName = [state.userProfile?.firstName, state.userProfile?.lastName].filter(Boolean).join(" ");
  const active = state.activeGame;
  const activePlayer = active ? gamePlayerSnapshot(active) : null;
  const activePlayerTeamName = state.player.team || teamById(state.player.teamId)?.name || "";
  const activeTeamName = team?.name || "";
  const teamMismatch = activeTeamName && activePlayerTeamName && activeTeamName !== activePlayerTeamName;
  const gameDaySummary = teamMismatch
    ? `Tracking ${playerTitle(state.player)} on ${activePlayerTeamName}. Managing ${activeTeamName}.`
    : `${playerTitle(activePlayer || state.player)}${playerLine ? ` - ${playerLine}` : ""}`;
  const gameDayContext = [
    `Active player: ${playerTitle(state.player)}${activePlayerTeamName ? ` (${activePlayerTeamName})` : ""}`,
    `Team: ${activeTeamName || state.player.team || "Not connected"}`,
  ];
  const adminPortalEntry = isReviewerAccount()
    ? `
      <section class="card pad admin-portal-entry-card">
        <div>
          <h3>Team Admin Portal</h3>
          <p class="muted small">Separate entryway for roster setup, parent approvals, and team management tools.</p>
        </div>
        <button class="btn brand positive admin-portal-entry-button" type="button" data-action="open-admin-portal">Open Team Admin Portal</button>
      </section>
    `
    : "";
  const adminTools = isPlatformReviewer()
    ? `
      <section class="card pad more-card admin-tools-card">
        <div>
          <h3>Team Admin Tools</h3>
          <p class="muted small">Create teams, manage rosters, approve parent requests, and handle access cleanup tools.</p>
        </div>
        <div class="admin-tool-groups">
          <div>
            <h4>Team Setup</h4>
            <p class="muted small">Create team, team code, and basic team settings.</p>
          </div>
          <div>
            <h4>Roster</h4>
            <p class="muted small">Add and edit players from Manage Teams.</p>
          </div>
          <div>
            <h4>Parent Requests</h4>
            <p class="muted small">Approve or reject access from the Team page.</p>
          </div>
          <div>
            <h4>Access & Cleanup</h4>
            <p class="muted small">Manage parent access, export roster details, and delete teams when needed.</p>
          </div>
        </div>
        <div class="more-action-list compact-actions">
          <button class="more-action" type="button" data-nav="team">
            <span>${renderNavIcon("team")}</span>
            <strong>Open Team Admin Tools</strong>
            <small>Manage team setup, roster, requests, and access cleanup.</small>
          </button>
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
      <h2>More</h2>
      <p>Quick access to tracking, player details, team tools, account, watching, and help.</p>
    </section>

    <section class="stack">
      <section class="card pad more-card primary-manage-card">
        <div>
          <h3>Game Day Manager</h3>
          <p class="muted small">Game setup, tracking, sharing, and player context.</p>
        </div>
        ${teamMismatch ? `<div class="notice-card compact-notice"><strong>Different team selected.</strong><p class="muted small">Open Players &amp; Teams to switch who you are tracking or add another player.</p></div>` : ""}
        <div class="more-action-list">
          <button class="more-action" type="button" data-nav="player">
            <span>${renderNavIcon("player")}</span>
            <strong>Players &amp; Teams</strong>
            <small>Choose who to track, view team context, or add another player.</small>
          </button>
          <button class="more-action" type="button" data-nav="${active ? "live" : "start"}">
            <span>${renderNavIcon("track")}</span>
            <strong>${active ? "Resume Live Game" : "Track New Game"}</strong>
            <small>${active ? `Continue tracking ${escapeHTML(playerTitle(activePlayer))}.` : "Open the game setup screen."}</small>
          </button>
          <button class="more-action" type="button" data-action="toggle-watch-share">
            <span>${renderNavIcon("share")}</span>
            <strong>Watch Shared Game</strong>
            <small>Enter a family share code for a read-only live game.</small>
          </button>
        </div>
        ${renderWatchSharedGameInline()}
        <div class="more-helper-text" aria-label="Game day details">
          <p>${escapeHTML(gameDaySummary)}</p>
          ${gameDayContext.map((line) => `<p>${escapeHTML(line)}</p>`).join("")}
        </div>
      </section>

      <section class="card pad more-card account-tools-card">
        <div>
          <h3>Account & App</h3>
          <p class="muted small">${escapeHTML(profileName || "Signed in")}${userEmail() ? ` - ${escapeHTML(userEmail())}` : ""}</p>
        </div>
        <div class="more-action-list compact-actions">
          <button class="more-action" type="button" data-nav="profileSetup">
            <span>${renderNavIcon("more")}</span>
            <strong>User Profile</strong>
            <small>Edit account details.</small>
          </button>
          <button class="more-action" type="button" data-action="sync-cloud-games">
            <span>${renderNavIcon("cloud")}</span>
            <strong>Sync</strong>
            <small>Refresh games, teams, and player access.</small>
          </button>
          <button class="more-action" type="button" data-action="check-app-update">
            <span>${renderNavIcon("update")}</span>
            <strong>Updates</strong>
            <small>Check for the newest app version.</small>
          </button>
          <button class="more-action" type="button" data-nav="tutorial">
            <span>${renderNavIcon("help")}</span>
            <strong>Help / Tracker Guide</strong>
            <small>Learn the game-day flow and sharing tools.</small>
          </button>
          <a class="more-action" href="privacy.html" target="_blank" rel="noopener">
            <span>${renderNavIcon("lock")}</span>
            <strong>Privacy Policy</strong>
            <small>Review how LaxHornet handles accounts, teams, players, and game data.</small>
          </a>
          <a class="more-action" href="terms.html" target="_blank" rel="noopener">
            <span>${renderNavIcon("games")}</span>
            <strong>Terms of Use</strong>
            <small>Review account, team access, Live Share, recap, and usage rules.</small>
          </a>
          <button class="more-action danger-link" type="button" data-action="sign-out">
            <span>${renderNavIcon("exit")}</span>
            <strong>Sign Out</strong>
            <small>Switch accounts on this device.</small>
          </button>
          <button class="more-action danger-link" type="button" data-action="reset-device-state">
            <span>${renderNavIcon("reset")}</span>
            <strong>Reset This Device</strong>
            <small>Clear cached app state here without deleting cloud data.</small>
          </button>
        </div>
        ${renderAccountAppHelper()}
      </section>

      ${adminTools}

      ${adminPortalEntry}
    </section>
  `);
}

function renderWelcome() {
  return renderShell(`
    <section class="welcome-hero">
      <div class="welcome-copy">
        <h2>Track the plays that show the whole game.</h2>
        <p>LaxHornet helps parents track youth lacrosse stats, share live updates with family, and understand a player&apos;s game impact after the final whistle.</p>
      </div>
    </section>

    <section class="stack welcome-stack">
      ${renderAccountCard()}

      ${renderWatchSharedGameForm({ defaultExpanded: true })}

      <div class="card pad welcome-info-card welcome-access-card subtle-welcome-card">
        <h3>How access works</h3>
        <div class="welcome-step-list">
          <div><strong>1</strong><span>Create a User Profile.</span></div>
          <div><strong>2</strong><span>Request access with your team code.</span></div>
          <div><strong>3</strong><span>Parent Trackers verify their player by jersey number.</span></div>
        </div>
      </div>

      <details class="card pad faq-card welcome-faq-card subtle-welcome-card">
        <summary class="faq-card-summary">
          <span>
            <strong>Quick FAQ</strong>
            <small>Account, watching, and team setup basics.</small>
          </span>
        </summary>
        <div class="faq-card-body">
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
      </details>
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

      ${renderOnboardingIntentPicker(state.onboardingIntent)}

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
          <p class="muted small">Parents only see the player/team access approved by a team admin. Live Share links are read-only.</p>
        </div>
      ` : ""}

      ${state.cloudError ? `<div class="notice-card error-card"><strong>Could not submit request.</strong><p class="muted small">${escapeHTML(state.cloudError)}</p></div>` : ""}

      <div class="account-actions">
        <button class="btn positive" type="submit" ${state.authBusy ? "disabled" : ""}>${state.authBusy ? "Submitting..." : signupDraft ? "Request Player Access" : "Save Profile"}</button>
        <button class="btn secondary" type="button" data-nav="home">Back</button>
        ${state.authUser ? `<button class="btn danger" type="button" data-action="sign-out">Sign Out</button>` : ""}
      </div>
    </form>
  `, { hideNav: true, hideStatus: true });
}

function renderTeamAccessTools() {
  if (canCreateTeams()) {
    return `
      <section class="card pad">
        <div class="section-head compact-head">
          <div>
            <h3>Team Setup</h3>
            <p class="muted small">Create team, team code, and basic team settings.</p>
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
  const hasVerifiedPlayers = visiblePlayers().length > 0;
  const addPlayerTitle = hasVerifiedPlayers ? "Add Another Player" : "Add Player";
  return `
      <section class="card pad add-player-access-card ${expanded ? "" : "collapsed"}">
        <div class="collapsible-card-head">
          <div>
            <h3>${escapeHTML(addPlayerTitle)}</h3>
            <p class="muted small">${escapeHTML(team ? "Use a team code and jersey number to connect a player." : "Ask your coach, team admin, or parent coordinator for the team code.")}</p>
          </div>
          <button class="collapse-icon" type="button" data-action="toggle-team-access" aria-expanded="${expanded}" aria-label="${expanded ? `Minimize ${addPlayerTitle}` : `Expand ${addPlayerTitle}`}">
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
                  <button class="mini-btn" type="submit">Submit Player Info</button>
                </div>
                <p class="muted small">Once the team admin approves and the jersey number matches the roster, only that player appears in this account.</p>
                ${renderPrivacyReassurance()}
              </form>`
            : ""
        }
      </section>

      <section class="card pad team-requests-card compact-status-card">
        ${
          requestList ||
          `<div class="section-head compact-head">
            <div>
              <h3>Access Status</h3>
              <p class="muted small">No player steps need attention right now.</p>
            </div>
          </div>
          <p class="muted small">${hasVerifiedPlayers ? "Verified players are listed above. Add another player only when you need to track a different child or team." : "Add a player above to start the approval and verification process."}</p>`
        }
      </section>
  `;
}

function renderCurrentTrackingPlayerCard() {
  const player = normalizePlayer(state.player);
  const hasPlayer = visiblePlayers().some((item) => item.id === player.id);
  if (!hasPlayer || !isTeamPlayer(player)) return "";
  const lastGame = latestVisibleGame();
  return `
    <section class="card pad current-player-manage-card">
      <div class="section-head compact-head">
        <div>
          <h3>Current Tracking Player</h3>
          <p class="muted small">This is the player used for new games, reviews, and season totals.</p>
        </div>
        <span class="status-pill">Selected</span>
      </div>
      <div class="player-context-panel">
        <strong>${escapeHTML(playerTitle(player))}</strong>
        <span>${escapeHTML(playerSubline(player))}</span>
        ${playerTeamCodeLabel(player) ? `<small>${escapeHTML(playerTeamCodeLabel(player))}</small>` : ""}
      </div>
      <div class="player-assignment-actions">
        <button class="mini-btn" type="button" data-nav="start">Track Game</button>
        <button class="mini-btn light" type="button" ${lastGame ? `data-review="${escapeHTML(lastGame.id)}"` : `data-nav="past"`}>Review</button>
        <button class="mini-btn light" type="button" data-nav="dashboard">Season</button>
      </div>
    </section>
  `;
}

function renderPlayerAccountRemovalCard() {
  const selectedRosterPlayer = isTeamPlayer(state.player) ? normalizePlayer(state.player) : null;
  const canEditSelectedRosterPlayer = selectedRosterPlayer ? canManageRoster(selectedRosterPlayer.teamId) : false;
  const canRemoveClaimedRosterPlayer = selectedRosterPlayer
    ? !canEditSelectedRosterPlayer && hasPlayerClaim(selectedRosterPlayer.teamId, selectedRosterPlayer.rosterPlayerId || selectedRosterPlayer.id)
    : false;
  if (selectedRosterPlayer && canRemoveClaimedRosterPlayer) {
    return `
      <section class="card pad player-account-tools-card">
        <h3>Player Account Tools</h3>
        <p class="muted small">Remove ${escapeHTML(playerTitle(selectedRosterPlayer))} from this parent account only. This does not delete saved games and does not remove the player from the team roster.</p>
        <button class="btn danger" type="button" data-action="remove-claimed-player">Remove Player From My Account</button>
      </section>
    `;
  }
  if (!selectedRosterPlayer) {
    return `
      <section class="card pad player-account-tools-card">
        <h3>Local Player Tools</h3>
        <p class="muted small">This only removes the locally saved player from this device. It does not affect any team roster.</p>
        <button class="btn danger" type="button" data-action="delete-player">Remove Local Player</button>
      </section>
    `;
  }
  return "";
}

function renderTeamPage() {
  const admin = canCreateTeams();
  if (!admin) return renderPlayersTeamsPage();
  const showNoTeamCodeCard = !admin && !activeTeam();
  return renderShell(`
    <section class="screen-title">
      <h2>${admin ? "Team Admin Tools" : "Players & Teams"}</h2>
      <p>${admin ? "Create teams, sync parent approvals, and manage roster tools in one place." : "See verified players, sync updates, or add another player with a team code."}</p>
    </section>

    <section class="stack">
      ${showNoTeamCodeCard ? renderNoTeamCodeCard() : ""}
      ${renderTeamRosterCard()}
      ${renderTeamAccessTools()}
      ${renderAdminTeamRequestInbox()}
    </section>
  `, { hideNav: admin });
}

function renderPlayersTeamsPage() {
  if (canCreateTeams()) return renderTeamPage();
  const hasPlayers = visiblePlayers().length > 0;
  return renderShell(`
    <section class="screen-title">
      <h2>Players &amp; Teams</h2>
      <p>Choose who you are tracking, see each player&apos;s team context, or add a player with a team code.</p>
    </section>

    <section class="stack">
      ${renderCurrentTrackingPlayerCard()}
      ${renderMyPlayersList({ showHeaderAction: false })}
      ${renderTeamAccessTools()}
      ${hasPlayers ? renderPlayerAccountRemovalCard() : ""}
    </section>
  `);
}

function operationalHealthSnapshot() {
  const records = Object.values(trustSpineState().events);
  const pending = records.reduce((count, record) => count + record.pendingOperations.length, 0);
  const failed = records.filter((record) => record.lastError).length;
  const conflicted = records.filter((record) => record.conflict).length;
  const acceptedAt = records
    .flatMap((record) => record.acceptedReceipts || [])
    .map((receipt) => receipt.acceptedAt)
    .filter(Boolean)
    .sort()
    .at(-1) || "";
  const capabilities = backendCapabilityState.value;
  return {
    appVersion: APP_VERSION,
    cacheVersion: `laxhornet-${APP_VERSION}`,
    schemaVersion: capabilities?.schemaVersion || 0,
    runtimeReady: SECURE_DISCLOSURE_RUNTIME_READY,
    pending,
    failed,
    conflicted,
    acceptedAt,
    liveShareReady: Boolean(TRUSTED_DISCLOSURE_FEATURES.liveShareTokenRpc && capabilities?.secureLiveShare),
    exportAuditReady: Boolean(TRUSTED_DISCLOSURE_FEATURES.exportAuditRpc && capabilities?.exportAudit),
    anonymousTables: "Denied by release contract",
    legacyCompatibility: "Present",
    manifestRelease: "v283",
  };
}

function renderOperationalHealth() {
  const health = operationalHealthSnapshot();
  const rows = [
    ["App", health.appVersion],
    ["Expected cache", health.cacheVersion],
    ["Database capability", health.schemaVersion ? `v${health.schemaVersion}` : "Not checked"],
    ["Secure runtime", health.runtimeReady ? "Ready" : "Unavailable"],
    ["Pending operations", String(health.pending)],
    ["Failed operations", String(health.failed)],
    ["Conflicts", String(health.conflicted)],
    ["Last accepted sync", health.acceptedAt ? formatDateTime(health.acceptedAt) : "None on this device"],
    ["Secure token RPC", health.liveShareReady ? "Ready" : "Not confirmed"],
    ["Export audit RPC", health.exportAuditReady ? "Ready" : "Not confirmed"],
    ["Anonymous table access", health.anonymousTables],
    ["Legacy compatibility", health.legacyCompatibility],
    ["Release manifest", health.manifestRelease],
  ];
  return `
    <section class="card pad admin-portal-card operational-health-card">
      <div class="section-head compact-head">
        <div>
          <h3>Release &amp; Sync Health</h3>
          <p class="muted small">Operational status only. No player or family information appears here.</p>
        </div>
        <button class="mini-btn light" type="button" data-action="refresh-release-health">Refresh</button>
      </div>
      <div class="operational-health-grid">
        ${rows.map(([label, value]) => `
          <div>
            <span>${escapeHTML(label)}</span>
            <strong>${escapeHTML(value)}</strong>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderAdminPortal() {
  if (!isPlatformReviewer()) {
    return renderShell(`
      <section class="screen-title">
        <h2>Team Admin Portal</h2>
        <p>Open this area from the approved admin account.</p>
      </section>
      <section class="stack">
        <section class="card pad">
          <h3>Admin access required</h3>
          <p class="muted small">Use the parent tracker app for game tracking, or sign in with the approved admin account for roster management.</p>
          <button class="btn secondary" type="button" data-nav="home">Back Home</button>
        </section>
      </section>
    `);
  }

  const managedTeams = state.teams.filter((team) => canManageRoster(team.id) || canDeleteTeam(team.id));
  const activeTeamId = activeTeam()?.id || "";
  const allRosterCount = state.rosterPlayers.filter((player) => managedTeams.some((team) => team.id === player.teamId) && player.active !== false).length;
  const pendingRequests = state.teamAccessRequests.filter((request) => request.status === "pending").length;
  const verificationNeeded = state.teamAccessRequests.filter(requestNeedsPlayerVerification).length;

  return renderShell(`
    <section class="admin-portal-shell">
      <section class="admin-portal-hero">
        <div>
          <p class="admin-portal-kicker">Team Admin Portal</p>
          <h2>Manage teams, rosters, and parent access.</h2>
          <p>Admin work stays separate from the Parent Tracker app so roster management is not affected by parent-only player cleanup.</p>
        </div>
        <div class="admin-portal-actions">
          <button class="btn brand positive" type="button" data-action="sync-team-roster">Sync Admin Data</button>
          <button class="btn secondary" type="button" data-action="open-tracker-view">Open Parent Tracker App</button>
        </div>
      </section>

      <section class="admin-portal-metrics" aria-label="Admin overview">
        <div><span>Teams</span><strong>${managedTeams.length}</strong></div>
        <div><span>Roster Players</span><strong>${allRosterCount}</strong></div>
        <div><span>Pending Requests</span><strong>${pendingRequests}</strong></div>
        <div><span>Need Verification</span><strong>${verificationNeeded}</strong></div>
      </section>

      <section class="admin-portal-grid">
        ${renderTeamAccessTools()}
        ${renderTeamRosterCard()}

        <section class="card pad admin-portal-card">
          <div class="section-head compact-head">
            <div>
              <h3>Parent Access Queue</h3>
              <p class="muted small">Approve requests and remind parents to verify their player.</p>
            </div>
            <button class="mini-btn light" type="button" data-action="sync-team-roster">Sync</button>
          </div>
          ${renderTeamAccessRequests() || `<p class="muted small">No requests need action for the selected team.</p>`}
          ${renderAdminTeamRequestInbox()}
        </section>

        <section class="card pad admin-portal-card">
          <h3>Admin Resources</h3>
          <div class="more-action-list compact-actions">
            <button class="more-action" type="button" data-nav="launchKit">
              <span>${renderNavIcon("games")}</span>
              <strong>Launch Kit</strong>
              <small>Share materials, QR code, and parent instructions.</small>
            </button>
            <button class="more-action" type="button" data-nav="profileSetup">
              <span>${renderNavIcon("manage")}</span>
              <strong>Admin Profile</strong>
              <small>Update account details and sign out.</small>
            </button>
          </div>
        </section>
        ${renderOperationalHealth()}
      </section>
    </section>
  `, { hideNav: true });
}

function renderNoTeamCodeCard() {
  return `
    <section class="card pad empty-state-card">
      <h3>Need a team code?</h3>
      <p class="muted small">Ask your coach, team admin, or parent coordinator for the LaxHornet team code.</p>
      <button class="mini-btn" type="button" data-action="toggle-team-access">I Have a Code</button>
    </section>
  `;
}

function renderTeamAccess() {
  return renderTeamPage();
}

function renderPrivacyReassurance() {
  return `
    <div class="notice-card compact-notice privacy-reassurance">
      <strong>Player privacy matters.</strong>
      <p class="muted small">Parents only see the player/team access approved by a team admin. Live Share links are read-only.</p>
    </div>
  `;
}

function latestVisibleGame() {
  return [...visibleGames()].sort((a, b) => {
    const aTime = Date.parse(a.endedAt || a.savedAt || a.date || a.createdAt || 0) || 0;
    const bTime = Date.parse(b.endedAt || b.savedAt || b.date || b.createdAt || 0) || 0;
    return bTime - aTime;
  })[0] || null;
}

function playerReadySubcopy(player = state.player) {
  const teamName = player.team || teamById(player.teamId)?.name || "Team not linked";
  const jersey = player.number ? `#${player.number}` : "No jersey";
  const position = player.position || "Position not set";
  return `${teamName} · ${jersey} · ${position}`;
}

function renderNoApprovedPlayerHome() {
  return `
    <section class="card pad empty-state-card">
      <h3>No approved player yet</h3>
      <p class="muted small">Request access with your team code and jersey number. Once your team admin approves it, you can start tracking games.</p>
      <div class="action-grid compact">
        <button class="btn positive" type="button" data-nav="team">Request Player Access</button>
        <button class="btn secondary" type="button" data-nav="tutorial">Help / Tracker Guide</button>
      </div>
    </section>
  `;
}

function renderHomeReadyCard() {
  const lastGame = latestVisibleGame();
  const playerName = normalizePlayer(state.player).name || playerTitle(state.player);
  return `
    <section class="card pad home-next-card">
      <div>
        <h3>Ready to track ${escapeHTML(playerName)}?</h3>
        <p class="muted small">${escapeHTML(playerReadySubcopy(state.player))}</p>
      </div>
      <div class="action-grid compact">
        <button class="btn brand positive" type="button" data-nav="start">Start New Game</button>
        <button class="btn brand neutral" type="button" ${lastGame ? `data-review="${escapeHTML(lastGame.id)}"` : `data-nav="past"`}>Review Last Game</button>
      </div>
    </section>
  `;
}

function renderInlineNextFocusEditor(context, focus) {
  const saved = normalizeNextGameFocus(focus);
  const totals = calculateSeasonTotalsForPlayer(state.player);
  const selectedValue = selectedFocusValueForFocus(saved, totals);
  const customText = selectedValue === "custom" ? saved.customText : "";
  const selectId = `inlineNextFocusSelect-${context}`;
  const customId = `inlineNextFocusCustom-${context}`;
  return `
    <div class="inline-next-focus-editor" data-focus-context="${escapeHTML(context)}">
      <div class="field">
        <label for="${escapeHTML(selectId)}">Change focus</label>
        <select id="${escapeHTML(selectId)}" name="focusType">
          ${NEXT_GAME_FOCUS_OPTIONS.map(
            (option) => `<option value="${escapeHTML(option.value)}" ${option.value === selectedValue ? "selected" : ""}>${escapeHTML(option.label)}</option>`,
          ).join("")}
        </select>
      </div>
      <div class="field">
        <label for="${escapeHTML(customId)}">Custom focus</label>
        <input id="${escapeHTML(customId)}" name="customFocus" value="${escapeHTML(customText)}" placeholder="One simple focus for next game" />
      </div>
      <p class="muted small">This changes the active focus for the next game. The original Game Review focus stays in that review with a change note.</p>
      <div class="lh-focus-actions compact">
        <button class="btn secondary" type="button" data-action="save-inline-next-focus">Save Change</button>
        <button class="btn neutral" type="button" data-action="cancel-inline-next-focus">Cancel</button>
      </div>
    </div>
  `;
}

function renderHomeNextGameFocusCard() {
  const focus = openNextGameFocusForPlayer(state.player);
  if (!focus.text) return "";
  const editorOpen = state.focusEditorContext === "home";
  return `
    <section class="card pad development-card lh-active-focus-card">
      <div class="section-head compact-head">
        <div>
          <h3>Next Game Focus</h3>
          <p class="muted small">Saved from the last game review.</p>
        </div>
      </div>
      <p>${escapeHTML(focus.text)}</p>
      <div class="lh-focus-actions compact">
        <button class="btn brand positive" type="button" data-action="start-with-focus">Start Game With This Focus</button>
        <button class="btn secondary" type="button" data-action="toggle-next-focus-editor" data-focus-context="home">${editorOpen ? "Close" : "Change"}</button>
      </div>
      ${editorOpen ? renderInlineNextFocusEditor("home", focus) : ""}
    </section>
  `;
}

function renderGameDayStatusCard() {
  const rows = [
    ["Offline tracking", "Ready"],
    ["Cloud sync", gameDayCloudStatus()],
    ["Live Share", gameDayLiveShareStatus()],
    ["Player access", playerAccessStatus(state.player)],
  ];
  return `
    <section class="card pad game-day-status-card">
      <h3>Game-day status</h3>
      <div class="status-row-list">
        ${rows
          .map(
            ([label, value]) => `
              <div class="status-row">
                <span>${escapeHTML(label)}</span>
                <strong>${escapeHTML(value)}</strong>
              </div>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderHomeQuickActions() {
  const actions = [
    { label: "Season Dashboard", screen: "dashboard", icon: "season", show: visiblePlayers().length > 0 },
    { label: "Past Games", screen: "past", icon: "games", show: visiblePlayers().length > 0 },
    { label: "Players & Teams", screen: "player", icon: "player", show: state.authUser },
    { label: "Help / Tracker Guide", screen: "tutorial", icon: "help", show: true },
  ].filter((item) => item.show);
  return `
    <section class="card pad quick-actions-card">
      <h3>Quick actions</h3>
      <div class="quick-action-grid">
        ${actions
          .map(
            (item) => `
              <button class="quick-action" type="button" data-nav="${item.screen}">
                <span>${renderNavIcon(item.icon)}</span>
                <strong>${escapeHTML(item.label)}</strong>
              </button>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderPlayerPage() {
  if (!canCreateTeams()) return renderPlayersTeamsPage();
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
          <p class="muted small">This removes ${escapeHTML(playerTitle(selectedRosterPlayer))} from this parent account only. It does not delete saved games and does not remove the player from the team roster.</p>
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
  const focus = openNextGameFocusForPlayer(state.player);
  const focusEditorOpen = state.focusEditorContext === "start";
  const liveShareEligibility = secureLiveShareEligibility({
    scopeType: state.player.teamId ? GAME_SCOPE_TYPES.TEAM_ROSTER : GAME_SCOPE_TYPES.PERSONAL,
    teamId: state.player.teamId || "",
    rosterPlayerId: state.player.rosterPlayerId || (state.player.teamId ? state.player.id : ""),
  });
  const liveShareAvailable = liveShareEligibility.available;
  return renderShell(`
    <section class="screen-title">
      <h2>Set up game</h2>
      <p>You can edit game details later.</p>
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

      ${
        focus.text
            ? `<section class="card pad development-card lh-active-focus-card">
              <h3>Today's Focus</h3>
              <p>${escapeHTML(focus.text)}</p>
              <p class="muted small">Keep this in mind while tracking the next game.</p>
              <div class="lh-focus-actions compact">
                <button class="btn brand positive" type="button" data-action="use-this-focus">Use This Focus</button>
                <button class="btn secondary" type="button" data-action="toggle-next-focus-editor" data-focus-context="start">${focusEditorOpen ? "Close" : "Change Focus"}</button>
              </div>
              ${focusEditorOpen ? renderInlineNextFocusEditor("start", focus) : ""}
            </section>`
          : ""
      }

      <section class="card pad form-grid">
        <div class="section-head compact-head">
          <div>
            <h3>Game Details</h3>
            <p class="muted small">Keep setup quick so you can get to the sideline tracker.</p>
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
            <label for="periodFormat">Game format</label>
            <select id="periodFormat" name="periodFormat">
              <option value="quarters">Quarters</option>
              <option value="halves">Halves</option>
            </select>
          </div>
        </div>
        <div class="form-grid two">
          <div class="field">
            <label for="startingPeriod">Starting period</label>
            <select id="startingPeriod" name="startingPeriod">
              <option value="Q1">Q1</option>
              <option value="H1">H1</option>
            </select>
          </div>
          <div class="field">
            <label for="liveShare">Live Share</label>
            <select id="liveShare" name="liveShare" ${liveShareAvailable ? "" : "disabled"}>
              <option value="off">Off</option>
              ${liveShareAvailable ? `<option value="on">On</option>` : ""}
            </select>
            ${
              liveShareAvailable
                ? ""
                : `<p class="field-help">${escapeHTML(liveShareEligibility.message)}</p>`
            }
          </div>
        </div>
        <button class="btn positive" type="submit" ${viewOnlyTeamPlayer ? "disabled" : ""}>Start Tracking</button>
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

function renderStatButtonsForKeys(keys = [], options = {}) {
  const stepByKey = options.stepByKey || {};
  return keys
    .map((key) => STAT_BY_KEY[key])
    .filter(Boolean)
    .map((stat) =>
      renderStatButton(stat, {
        compact: options.compact,
        interactive: options.interactive,
        promoStep: Number.isFinite(stepByKey[stat.key]) ? stepByKey[stat.key] : null,
      }),
    )
    .join("");
}

function renderLiveStatGroups(options = {}) {
  const stepByKey = options.stepByKey || {};
  if (!options.demo) {
    const player = options.player || state.player;
    const defaultKeys = liveDefaultStatKeysForPlayer(player);
    const moreKeys = STAT_DEFS.map((stat) => stat.key).filter((key) => !defaultKeys.includes(key));
    return `
      <section class="live-stat-groups position-aware" aria-label="Stat buttons">
        <div class="stat-group">
          <div class="stat-group-head">
            <h3>Quick Plays</h3>
            <span>${escapeHTML((IMPACT_POSITION_WEIGHTS[liveTrackerPositionGroup(player)]?.label || "Default"))}</span>
          </div>
          <div class="tracker-grid">${renderStatButtonsForKeys(defaultKeys)}</div>
        </div>
        <div class="stat-group more-plays ${state.morePlaysExpanded ? "expanded" : "collapsed"}">
          <button class="more-plays-toggle" type="button" data-action="toggle-more-plays" aria-expanded="${state.morePlaysExpanded}">
            <strong>More Plays</strong>
            <span>${state.morePlaysExpanded ? "Hide less-used stats" : "Show all other stats"}</span>
          </button>
          ${state.morePlaysExpanded ? `<div class="tracker-grid">${renderStatButtonsForKeys(moreKeys, { compact: true })}</div>` : ""}
        </div>
      </section>
    `;
  }
  return `
    <section class="live-stat-groups${options.demo ? " promo-demo-groups" : ""}" aria-label="Stat buttons">
      ${LIVE_STAT_GROUPS.map((group) => {
        const buttons = renderStatButtonsForKeys(group.keys, {
          compact: group.compact,
          interactive: options.interactive,
          stepByKey,
        });
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

function liveSyncChipLabel() {
  if (!currentUserId()) return "Saved on this phone";
  return displaySyncStatus();
}

function renderLiveStatusChips(game) {
  const liveShareAvailable = secureLiveShareEligibility(game).available;
  const liveShareLabel = liveShareAvailable ? (game.isShared ? "Live Share On" : "Live Share Off") : "Live Share Unavailable";
  return `
    <div class="live-status-chips" aria-label="Game save and share status">
      <span>${escapeHTML(liveSyncChipLabel())}</span>
      <span class="${game.isShared ? "share-on" : ""}">${liveShareLabel}</span>
    </div>
  `;
}

function renderLivePlayerCard(player) {
  const jersey = player.number ? ` #${player.number}` : "";
  const meta = [player.team, player.position].filter(Boolean).join(" · ");
  return `
    <section class="card pad live-player-card">
      <div>
        <h3>Tracking: ${escapeHTML(player.name || "Player")}${escapeHTML(jersey)}</h3>
        ${meta ? `<p class="muted small">${escapeHTML(meta)}</p>` : ""}
      </div>
      <button class="mini-btn light" type="button" data-nav="player">Switch Player</button>
    </section>
  `;
}

function renderLastEventConfirmation(game) {
  const confirmation = state.lastEventConfirmation;
  if (!confirmation || confirmation.gameId !== game.id) return "";
  return `
    <section class="live-confirmation" role="status">
      <strong>${escapeHTML(confirmation.label)} added &middot; ${escapeHTML(confirmation.quarter)}</strong>
      <div>
        <button class="mini-btn" type="button" data-action="undo">Undo</button>
        <button class="mini-btn light" type="button" data-action="add-note-last-event">Add Note</button>
      </div>
    </section>
  `;
}

function renderLiveImpactPill(game, totals) {
  return `
    <div class="live-pill">
      <strong>${Number(totals.eventCount || (game.events || []).length || 0)}</strong>
      <span>Recorded Events</span>
    </div>
  `;
}

function renderExportDialog() {
  if (!state.exportDialog) return "";
  const fullBackup = state.exportDialog === "full_backup";
  const games = visibleGames();
  const selectedGameId = currentReviewGame()?.id || games[0]?.id || "";
  return `
    <section class="modal-backdrop" role="presentation">
      <div class="confirm-modal disclosure-modal" role="dialog" aria-modal="true" aria-labelledby="exportDialogTitle">
        <h3 id="exportDialogTitle">${fullBackup ? "Create private full backup" : "Export selected event data"}</h3>
        ${
          fullBackup
            ? `<p class="muted small">This sensitive recovery file includes account player settings, team and roster snapshots, saved games, events, notes, tags, and model configuration. It is not a family/public share file.</p>
               <p class="safety-note">The file may contain youth information. You control its recipient and storage location after download. LaxHornet will not open the native share sheet.</p>
               <label class="confirm-check"><input id="confirmSensitiveBackup" type="checkbox" /> <span>I understand this is a sensitive private backup.</span></label>`
            : `<div class="field">
                 <label for="csvExportScope">Export scope</label>
                 <select id="csvExportScope">
                   <option value="selected_player">Selected player - all visible games</option>
                   <option value="current_game">One selected game</option>
                 </select>
               </div>
               <div class="field">
                 <label for="csvExportGame">Selected game</label>
                 <select id="csvExportGame">
                   ${games.map((game) => `<option value="${escapeHTML(game.id)}" ${game.id === selectedGameId ? "selected" : ""}>${escapeHTML(formatDate(game.date))} vs ${escapeHTML(game.opponent || "Opponent")}</option>`).join("")}
                 </select>
               </div>
               <div class="export-inclusion-list">
                 <strong>Included by default</strong>
                 <p class="muted small">Recorded event facts, game context, player snapshot, score context, and calculated values for the chosen scope.</p>
                 <label class="confirm-check"><input id="csvIncludePublicTags" type="checkbox" /> <span>Include descriptive event tags</span></label>
                 <label class="confirm-check"><input id="csvIncludeProcessTags" type="checkbox" /> <span>Include private process/decision tags</span></label>
                 <label class="confirm-check"><input id="csvIncludeNotes" type="checkbox" /> <span>Include private event notes</span></label>
               </div>
               <p class="safety-note">This file may contain youth information. You control its recipient and storage location after download.</p>`
        }
        <div class="edit-actions">
          <button class="btn secondary" type="button" data-action="cancel-export">Cancel</button>
          <button class="btn positive" type="button" data-action="confirm-export">${fullBackup ? "Create Private Backup" : "Export CSV"}</button>
        </div>
      </div>
    </section>
  `;
}

function renderImportDialog() {
  const pending = state.pendingImport;
  if (!pending) return "";
  return `
    <section class="modal-backdrop" role="presentation">
      <div class="confirm-modal disclosure-modal" role="dialog" aria-modal="true" aria-labelledby="importDialogTitle">
        <h3 id="importDialogTitle">Merge private backup?</h3>
        <p class="muted small">${pending.games.length} of ${pending.totalCount} saved game${pending.totalCount === 1 ? "" : "s"} can be added without replacing current games.</p>
        <ul class="import-summary-list">
          <li>${pending.duplicateCount} existing same-ID game${pending.duplicateCount === 1 ? "" : "s"} will remain unchanged.</li>
          <li>${pending.deletedCount} previously deleted game${pending.deletedCount === 1 ? "" : "s"} will stay deleted.</li>
          <li>${pending.unauthorizedCount} game${pending.unauthorizedCount === 1 ? "" : "s"} outside current player access will be skipped.</li>
          <li>Team access, roster authority, account ownership, and Live Share will not be restored or changed.</li>
        </ul>
        <p class="safety-note">Imported games are private and Live Share is off. Existing games are never silently replaced.</p>
        <div class="edit-actions">
          <button class="btn secondary" type="button" data-action="cancel-import">Cancel</button>
          <button class="btn positive" type="button" data-action="confirm-import" ${pending.games.length ? "" : "disabled"}>Merge ${pending.games.length} Game${pending.games.length === 1 ? "" : "s"}</button>
        </div>
      </div>
    </section>
  `;
}

function renderLiveScoreControl(game) {
  const normalized = normalizeGame(game);
  return `
    <section class="lh-score-control" aria-label="Score control">
      <div class="lh-score-chip">
        <span>Score</span>
        <strong>${escapeHTML(scoreLabel(normalized))}</strong>
      </div>
      <div class="lh-score-actions">
        <button class="mini-btn light" type="button" data-action="score-goal-for">Goal For</button>
        <button class="mini-btn light" type="button" data-action="score-goal-against">Goal Against</button>
        <button class="mini-btn light" type="button" data-action="edit-score">Edit Score</button>
      </div>
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
  const statusLine = `${escapeHTML(game.currentQuarter)} <span aria-hidden="true">&middot;</span> vs ${escapeHTML(game.opponent || "Opponent")}`;
  const liveShareEligibility = secureLiveShareEligibility(game);
  const liveShareAvailable = liveShareEligibility.available;
  const liveMeta = [formatDate(game.date), periodFormatLabel(game), game.location]
    .filter(Boolean)
    .map((item) => escapeHTML(item))
    .join(' <span aria-hidden="true">&middot;</span> ');

  return renderShell(`
    <section class="screen-title live-title">
      <h2>${statusLine}</h2>
      <p class="live-meta">
        <span>${liveMeta}</span>
        ${
          liveShareAvailable
            ? `<button class="live-share-link" type="button" data-action="copy-share-link">Live Share</button>`
            : `<span class="live-share-link" aria-label="Live Share unavailable">Live Share unavailable</span>`
        }
      </p>
      ${liveShareAvailable ? "" : `<p class="field-help">${escapeHTML(liveShareEligibility.message)}</p>`}
      ${renderLiveStatusChips(game)}
    </section>

    ${renderLivePlayerCard(player)}
    ${renderLastEventConfirmation(game)}

    <div class="period-tabs" role="group" aria-label="Period selector">
      ${periods.map(
        (period) =>
          `<button class="period-tab ${game.currentQuarter === period ? "active" : ""}" type="button" data-quarter="${period}">${period}</button>`,
      ).join("")}
    </div>

    ${renderLiveScoreControl(game)}

    <section class="live-summary" aria-label="Live game summary">
      ${renderLiveImpactPill(game, totals)}
      <div class="live-pill"><strong>${totals.points}</strong><span>Points</span></div>
      <div class="live-pill"><strong>${game.events.length}</strong><span>Events</span></div>
    </section>

    ${renderLiveStatGroups({ player })}

    <section class="card pad live-recent-log" style="margin-top: 12px;">
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
      <div class="cancel-game-row">
        <button class="cancel-game-trigger" type="button" data-action="cancel-game">
          ${isDiscardableTrackingSession() ? "Cancel Game" : "Exit Tracking"}
        </button>
      </div>
    </div>
  `, { hideNav: true });
}

function renderEventRow(event, options = {}) {
  const stat = STAT_BY_KEY[event.statType] || { tone: "neutral" };
  const scoreContext = eventScoreDisplay(event);
  const privateView = !options.publicOnlyTags;
  const noteText = privateView && event.note ? ` - ${escapeHTML(event.note)}` : "";
  return `
    <div class="event-row ${stat.tone}">
      <span class="badge">${escapeHTML(event.quarter)}</span>
      <span>
        <strong>${escapeHTML(event.statLabel)}</strong>
        <p>${formatTime(event.timestamp)} - ${escapeHTML(event.category || "General")}${scoreContext ? ` - ${escapeHTML(scoreContext)}` : ""}${event.fieldZone ? ` - ${escapeHTML(event.fieldZone)}` : ""}${noteText}</p>
        ${renderTagChips(event.tags, { publicOnly: Boolean(options.publicOnlyTags) })}
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
  const cleanTags = options.publicOnly ? publicEventTags(tags) : uniqueTags(tags);
  if (!cleanTags.length) return "";
  const hasUserContext = !options.publicOnly && cleanTags.some(isPrivateReviewTag);
  return `
    <span class="tag-chip-list">
      ${hasUserContext ? `<span class="tag-context-label">User-recorded context</span>` : ""}
      ${cleanTags
        .map(
          (tag) => `
            <span class="tag-chip ${isPrivateReviewTag(tag) ? "process-tag" : ""}">
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
  const zoneOptions = FIELD_ZONE_OPTIONS.map(
    (zone) => `<option value="${escapeHTML(zone)}" ${event.fieldZone === zone ? "selected" : ""}>${escapeHTML(zone || "Not set")}</option>`,
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
        <div class="field">
          <label for="editFieldZone">Field zone</label>
          <select id="editFieldZone" name="fieldZone">${zoneOptions}</select>
        </div>
      </div>
      <div class="field">
        <label for="editNote">Note</label>
        <textarea id="editNote" name="note" placeholder="Optional correction note">${escapeHTML(event.note || "")}</textarea>
        <p class="field-help">Avoid private, medical, or sensitive information. Notes stay in private reviews and account exports; they do not appear in Live Share.</p>
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
  const zoneOptions = FIELD_ZONE_OPTIONS.map(
    (zone) => `<option value="${escapeHTML(zone)}">${escapeHTML(zone || "Not set")}</option>`,
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
        <div class="field">
          <label for="addFieldZone">Field zone</label>
          <select id="addFieldZone" name="fieldZone">${zoneOptions}</select>
        </div>
      </div>
      <div class="field">
        <label for="addNote">Note</label>
        <textarea id="addNote" name="note" placeholder="Optional correction note"></textarea>
        <p class="field-help">Avoid private, medical, or sensitive information. Notes stay in private reviews and account exports; they do not appear in Live Share.</p>
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

function processTagsForEvent(event = {}) {
  const keys = PROCESS_TAGS_BY_STAT[event.statType] || PROCESS_TAGS_BY_STAT.note;
  return uniqueTags(keys.map((key) => PROCESS_DECISION_TAGS[key]));
}

function renderTagEditor(game, event) {
  const selectedTags = uniqueTags(state.tagDraftTags);
  const suggestedTags = suggestedTagsForEvent(event).filter((tag) => !selectedTags.includes(tag));
  const processTags = processTagsForEvent(event).filter((tag) => !selectedTags.includes(tag));

  return `
    <section class="card pad tag-editor" data-tag-editor="${event.id}">
      <h3>Edit Tags</h3>
      <p class="muted small">${escapeHTML(event.statLabel)} - ${escapeHTML(event.category || "General")} - ${formatTime(event.timestamp)}</p>
      <p class="safety-note">Avoid private, medical, or sensitive information. Notes and tags stay in private reviews and account exports; they do not appear in Live Share.</p>
      <p class="field-help">Process tags are optional user-recorded context. They can help separate a decision, its execution, and its outcome, but they do not define the player or create season conclusions.</p>
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
      <div class="tag-editor-block">
        <strong class="tag-editor-label">User-recorded process / decision context</strong>
        <p class="muted small">Use these when the result does not tell the whole story.</p>
        ${
          processTags.length
            ? `<div class="tag-suggestions process-suggestions">${processTags
                .map((tag) => `<button class="tag-suggestion process-tag-option" type="button" data-add-draft-tag="${escapeHTML(tag)}">${escapeHTML(tag)}</button>`)
                .join("")}</div>`
            : `<p class="muted small">All suggested process tags are already selected.</p>`
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

function insightCard(label, value, helper = "", options = {}) {
  const isCopyCard = label.toLowerCase().includes("takeaway");
  const cardClass = isCopyCard ? "insight-card insight-card-copy" : "insight-card";
  const valueClass = isCopyCard ? "insight-value insight-value-copy" : "insight-value";
  const extraClass = options.className ? ` ${options.className}` : "";

  return `
    <div class="${cardClass}${extraClass}">
      <span>${escapeHTML(label)}</span>
      <div class="${valueClass}">${value}</div>
      ${helper ? `<small>${escapeHTML(helper)}</small>` : ""}
    </div>
  `;
}

function renderTakeawayValue(text) {
  const copy = String(text || "").trim() || "Track more plays to build the takeaway.";
  const chunks = (copy.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [copy])
    .map((item) => item.trim())
    .filter(Boolean);
  const labels = ["Biggest impact", "Possession story", "Watch next", "Next focus"];
  if (chunks.length <= 1) return escapeHTML(copy);
  return `
    <div class="takeaway-stack">
      ${chunks
        .slice(0, labels.length)
        .map(
          (chunk, index) => `
            <p>
              <span>${labels[index]}</span>
              ${escapeHTML(chunk)}
            </p>
          `,
        )
        .join("")}
    </div>
  `;
}

function topContributionForTotals(totals) {
  const options = [
    {
      label: "Scoring",
      value: totals.points * 4 + totals.shotsOnGoal,
      display: `${totals.points} points`,
      helper: `${totals.goals}G ${totals.assists}A`,
    },
    {
      label: "Possession",
      value: Math.max(0, totals.extraPossessions) * 4 + Math.max(0, totals.possessionValue),
      display: `${signedMetric(totals.possessionValue)} value`,
      helper: `${signedMetric(totals.extraPossessions)} extra chances`,
    },
    {
      label: "Defense",
      value: totals.causedTurnovers * 4 + totals.defensiveStops * 3,
      display: `${totals.causedTurnovers + totals.defensiveStops} plays`,
      helper: `${totals.causedTurnovers} CTO, ${totals.defensiveStops} stops`,
    },
    {
      label: "Goalie",
      value: totals.saves * 4,
      display: `${totals.saves} saves`,
      helper: `${pct(totals.savePct)} save rate`,
    },
    {
      label: "Hustle",
      value: totals.effortScore * 2,
      display: `${totals.effortScore} effort plays`,
      helper: `${totals.groundBalls} GB, ${totals.hustlePlays} hustle`,
    },
  ].filter((item) => item.value > 0);

  if (!options.length) {
    return {
      label: "Building profile",
      display: "More plays needed",
      helper: "Track events to reveal the pattern.",
    };
  }

  return options.sort((a, b) => b.value - a.value)[0];
}

function statEducationForKey(key) {
  const stat = STAT_BY_KEY[key] || {};
  return STAT_EDUCATION[key] || {
    label: stat.label || "Tracked Play",
    meaning: "A tracked moment from the game.",
    why: "Tracking it helps parents see how the player contributed to the team story.",
    focus: "Look for one repeatable next step before the next game.",
  };
}

function eventCountsByStat(events = []) {
  return events.reduce((acc, event) => {
    const key = event.statType;
    if (!key) return acc;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function importantEducationItemsForEvents(events = [], limit = 4) {
  const counts = eventCountsByStat(events);
  const entries = Object.entries(counts)
    .filter(([key, count]) => count > 0 && key !== "note")
    .map(([key, count]) => {
      const priority = STAT_EDUCATION_PRIORITY[key] || 1;
      return {
        key,
        count,
        priority,
        score: count * priority + Math.abs(impactValueForEvent({ statType: key })),
        education: statEducationForKey(key),
      };
    })
    .sort((a, b) => b.score - a.score || b.priority - a.priority);

  if (!entries.length && counts.note) {
    entries.push({
      key: "note",
      count: counts.note,
      priority: 1,
      score: 1,
      education: statEducationForKey("note"),
    });
  }

  return entries.slice(0, limit);
}

function renderWhyThesePlaysMatter(events = [], options = {}) {
  const limit = options.limit || 4;
  const directItems = Array.isArray(options.items) ? options.items.filter((item) => item?.label && item?.explanation) : null;
  const allItems = directItems || importantEducationItemsForEvents(events, options.showMore ? 8 : limit);
  const items = allItems.slice(0, limit);
  const extraItems = options.showMore ? allItems.slice(limit) : [];
  const title = options.title || "Why these plays matter";
  const helper = options.helper || "A quick parent guide to the plays that shaped this game.";
  const emptyCopy = options.emptyCopy || "Track a few plays to see simple explanations of what each stat means and why it supports development.";
  const showMoreLabel = options.showMoreLabel || "Show more stat explanations";
  const className = options.className ? ` ${options.className}` : "";
  const renderEducationItem = (item) => {
    if (item.explanation) {
      return `
        <article class="why-play-item">
          <div>
            <strong>${escapeHTML(item.label)}</strong>
          </div>
          <p>${escapeHTML(item.explanation)}</p>
        </article>
      `;
    }
    const { count, education } = item;
    return `
    <article class="why-play-item">
      <div>
        <strong>${escapeHTML(education.label)}</strong>
        <span>${count} tracked</span>
      </div>
      <p class="why-play-meaning">${escapeHTML(education.meaning)}</p>
      <p><b>Why it matters:</b> ${escapeHTML(education.why)}</p>
      <p><b>Next focus:</b> ${escapeHTML(education.focus)}</p>
    </article>
  `;
  };

  return `
    <details class="card pad lh-why-card${className}" open>
      <summary>
        <span>${escapeHTML(title)}</span>
        <small>${escapeHTML(helper)}</small>
      </summary>
      ${
        items.length
          ? `<div class="why-play-list">
              ${items.map(renderEducationItem).join("")}
            </div>`
          : `<p class="muted small">${escapeHTML(emptyCopy)}</p>`
      }
      ${
        extraItems.length
          ? `<details class="why-more-details">
              <summary>${escapeHTML(showMoreLabel)}</summary>
              <div class="why-play-list compact">${extraItems.map(renderEducationItem).join("")}</div>
            </details>`
          : ""
      }
    </details>
  `;
}

function recommendedFocusValue(totals = {}) {
  if (totals.turnovers > totals.groundBalls + totals.clears) return "protect-ball";
  if (totals.shots > 0 && totals.shotOnGoalPct < 0.5) return "shot-selection";
  if (totals.possessionValue <= 0) return "win-possession";
  if (totals.causedTurnovers + totals.defensiveStops > 0) return "communicate";
  if (totals.effortScore > 1) return "off-ball";
  return "support-teammates";
}

function focusLabelForValue(value) {
  return NEXT_GAME_FOCUS_OPTIONS.find((item) => item.value === value)?.label || "";
}

function focusTextForValue(value, customText = "", totals = {}, player = state.player, topContribution = "") {
  const cleanCustom = String(customText || "").trim();
  if (value === "custom" && cleanCustom) return cleanCustom;
  if (value && value !== "custom") return focusLabelForValue(value);
  return developmentTakeawayForTotals(totals, player, topContribution).focus;
}

function savedNextFocusForPlayer(player = state.player) {
  const saved = activeNextGameFocusForPlayer(player);
  if (!saved.text) return "";
  if (saved.status && saved.status !== "open") return "";
  const playerId = player.id || "";
  const rosterPlayerId = player.rosterPlayerId || "";
  if (saved.playerId && saved.playerId !== playerId) return "";
  if (saved.rosterPlayerId && rosterPlayerId && saved.rosterPlayerId !== rosterPlayerId) return "";
  return saved.text;
}

function openNextGameFocusForPlayer(player = state.player) {
  const saved = activeNextGameFocusForPlayer(player);
  return saved.text && (!saved.status || saved.status === "open") ? saved : normalizeNextGameFocus(null);
}

function listPhrase(items = []) {
  const cleanItems = items.map((item) => String(item || "").trim()).filter(Boolean);
  if (cleanItems.length <= 1) return cleanItems[0] || "";
  if (cleanItems.length === 2) return `${cleanItems[0]} and ${cleanItems[1]}`;
  return `${cleanItems.slice(0, -1).join(", ")}, and ${cleanItems[cleanItems.length - 1]}`;
}

function isPossessionReviewStory(totals = {}, topContribution = "") {
  const extraPossessions = Number(totals.extraPossessions || 0);
  const possessionValue = Number(totals.possessionValue || 0);
  if (topContribution === "Possession") return true;
  if (Math.abs(extraPossessions) >= 3) return true;
  if (Math.abs(possessionValue) >= 4) return true;
  if (extraPossessions >= 2 && possessionValue >= 2) return true;
  return false;
}

function reviewLanguageSeed(totals = {}, topContribution = "", player = state.player) {
  const normalized = normalizePlayer(player || {});
  const basis = [
    normalized.id,
    normalized.rosterPlayerId,
    normalized.name,
    normalized.position,
    topContribution,
    totals.eventCount,
    totals.points,
    totals.groundBalls,
    totals.causedTurnovers,
    totals.saves,
    totals.extraPossessions,
    totals.possessionValue,
  ].join("|");
  let hash = 0;
  for (let index = 0; index < basis.length; index += 1) {
    hash = (hash * 31 + basis.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function chooseReviewTemplate(templates = [], totals = {}, topContribution = "", player = state.player) {
  const cleanTemplates = templates.filter(Boolean);
  if (!cleanTemplates.length) return "";
  const choice = cleanTemplates[reviewLanguageSeed(totals, topContribution, player) % cleanTemplates.length];
  return typeof choice === "function" ? choice() : choice;
}

function eventSegment(event = {}, index = 0, totalEvents = 0) {
  let segment = event.gameSegmentAtEvent || gameSegmentForPeriod(event.quarter);
  if (segment !== "unknown") return segment;
  if (!totalEvents) return "unknown";
  const ratio = (index + 1) / totalEvents;
  if (ratio <= 1 / 3) return "early_game";
  if (ratio <= 2 / 3) return "mid_game";
  return "late_game";
}

function eventScoreMargin(event = {}) {
  const number = Number(event.scoreMarginAtEvent);
  return Number.isFinite(number) ? number : null;
}

function chronologicalEvents(events = []) {
  return [...events].sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());
}

function enrichPostGameEvents(events = []) {
  const ordered = chronologicalEvents(events);
  return ordered.map((event, index) => ({
    ...event,
    intelligenceSegment: eventSegment(event, index, ordered.length),
    intelligenceMargin: eventScoreMargin(event),
  }));
}

function isPositiveDevelopmentEvent(event = {}) {
  if (event.statType === "note") return false;
  return impactValueForEvent(event) > 0 || Number(event.pointValue || 0) > 0;
}

function isPossessionWinEvent(event = {}) {
  return ["groundBall", "faceoffWin", "causedTurnover", "goalieSave", "successfulClear", "backedUpShot"].includes(event.statType);
}

function isPossessionLossEvent(event = {}) {
  return ["turnover", "failedClear", "faceoffLoss"].includes(event.statType);
}

function isPossessionProtectedEvent(event = {}) {
  return ["successfulClear", "assist", "goal", "shotOnGoal", "backedUpShot", "smartPlay", "hustlePlay"].includes(event.statType);
}

function eventHasTag(event = {}, tag = "") {
  const target = normalizeTag(tag).toLowerCase();
  return uniqueTags(event.tags || []).some((eventTag) => eventTag.toLowerCase() === target);
}

function countEventsWithTag(events = [], tag = "") {
  return events.filter((event) => eventHasTag(event, tag)).length;
}

function processDecisionSummary(events = []) {
  const counts = {
    goodDecisionUnsuccessfulExecution: countEventsWithTag(events, PROCESS_DECISION_TAGS.goodDecisionUnsuccessfulExecution),
    poorDecisionSuccessfulOutcome: countEventsWithTag(events, PROCESS_DECISION_TAGS.poorDecisionSuccessfulOutcome),
    recoveredAfterMistake: countEventsWithTag(events, PROCESS_DECISION_TAGS.recoveredAfterMistake),
    extendedPossession: countEventsWithTag(events, PROCESS_DECISION_TAGS.extendedPossession),
    supportedBallCarrier: countEventsWithTag(events, PROCESS_DECISION_TAGS.supportedBallCarrier),
    createdAdvantage: countEventsWithTag(events, PROCESS_DECISION_TAGS.createdAdvantage),
    wonSecondEffort: countEventsWithTag(events, PROCESS_DECISION_TAGS.wonSecondEffort),
    stayedComposedUnderPressure: countEventsWithTag(events, PROCESS_DECISION_TAGS.stayedComposedUnderPressure),
    communicatedEarly: countEventsWithTag(events, PROCESS_DECISION_TAGS.communicatedEarly),
  };
  const total = Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0);
  return { ...counts, total };
}

function possessionQualitySequence(events = []) {
  const ordered = chronologicalEvents(events).filter((event) => event.statType !== "note");
  const wins = ordered.filter(isPossessionWinEvent);
  let protectedAfterWin = 0;
  let lossesAfterWin = 0;
  let secondEffortWins = 0;

  wins.forEach((win) => {
    const index = ordered.findIndex((event) => event.id === win.id);
    const nextEvents = ordered.slice(index + 1, index + 3);
    if (eventHasTag(win, PROCESS_DECISION_TAGS.wonSecondEffort) || eventHasTag(win, PROCESS_DECISION_TAGS.extendedPossession)) {
      secondEffortWins += 1;
    }
    if (nextEvents.some(isPossessionLossEvent)) {
      lossesAfterWin += 1;
    } else if (nextEvents.some(isPossessionProtectedEvent)) {
      protectedAfterWin += 1;
    }
  });

  const totalFollowUps = protectedAfterWin + lossesAfterWin;
  const qualityScore = wins.length ? (protectedAfterWin - lossesAfterWin) / wins.length : 0;
  return {
    wins: wins.length,
    protectedAfterWin,
    lossesAfterWin,
    secondEffortWins,
    totalFollowUps,
    qualityScore,
  };
}

function possessionQualitySentence(sequence = possessionQualitySequence([])) {
  if (!sequence.wins) return "";
  if (sequence.protectedAfterWin && !sequence.lossesAfterWin) {
    return `${sequence.protectedAfterWin} possession win${sequence.protectedAfterWin === 1 ? "" : "s"} turned into a protected next play.`;
  }
  if (sequence.lossesAfterWin && !sequence.protectedAfterWin) {
    return `${sequence.lossesAfterWin} possession win${sequence.lossesAfterWin === 1 ? "" : "s"} was followed quickly by a lost possession, so the next growth area is the first clean decision after winning the ball.`;
  }
  if (sequence.protectedAfterWin || sequence.lossesAfterWin) {
    return `${sequence.protectedAfterWin} protected follow-up${sequence.protectedAfterWin === 1 ? "" : "s"} and ${sequence.lossesAfterWin} quick loss${sequence.lossesAfterWin === 1 ? "" : "es"} show both the win and the next play mattered.`;
  }
  return "Possession wins were logged; add tags or follow-up events to show whether those wins became clean possessions.";
}

function isDefensivePressureEvent(event = {}) {
  return ["causedTurnover", "defensiveStop", "goalieSave"].includes(event.statType);
}

function isCloseScoreEvent(event = {}) {
  const margin = event.intelligenceMargin ?? eventScoreMargin(event);
  return margin !== null && Math.abs(margin) <= 2;
}

function isTiedOrTrailingEvent(event = {}) {
  const margin = event.intelligenceMargin ?? eventScoreMargin(event);
  return margin !== null && margin <= 0;
}

function hasKnownScoreState(events = []) {
  return events.some((event) => eventScoreMargin(event) !== null || event.scoreStateAtEvent);
}

function safeStatFact(count, singular, plural = `${singular}s`) {
  return count ? `${count} ${count === 1 ? singular : plural}` : "";
}

function patternResult({
  key,
  storyType,
  title,
  text,
  category,
  priority,
  evidence = [],
  development = {},
  focus = {},
  encouragement = "",
}) {
  return {
    key,
    storyType,
    title,
    text,
    category,
    priority,
    evidence: evidence.filter(Boolean).slice(0, 4),
    development,
    focus,
    encouragement,
  };
}

function detectHighLeverageImpact(events = [], totals = {}, player = state.player) {
  const highLeverage = events.filter(
    (event) =>
      (event.intelligenceSegment === "late_game" || event.intelligenceSegment === "overtime") &&
      isPositiveDevelopmentEvent(event) &&
      (isCloseScoreEvent(event) || isTiedOrTrailingEvent(event)),
  );
  if (!highLeverage.length) return null;
  const possessionPlays = highLeverage.filter(isPossessionWinEvent).length;
  const scoringPlays = highLeverage.filter((event) => ["goal", "assist", "shotOnGoal"].includes(event.statType)).length;
  const hasOvertime = highLeverage.some((event) => event.intelligenceSegment === "overtime");
  const stretchLabel = hasOvertime ? "overtime close-score stretch" : "second-half close-score stretch";
  const storyType = hasOvertime ? "Late-Game Contributor" : "Close-Score Contributor";
  return patternResult({
    key: "highLeverageImpact",
    storyType,
    title: "High-leverage stretch",
    text: `${playerFirstName(player)} showed up in a ${stretchLabel}. Those moments matter because one clean possession can change the feel of a youth lacrosse game.`,
    category: "context",
    priority: 100,
    evidence: [
      safeStatFact(highLeverage.length, "positive close-game play"),
      possessionPlays ? safeStatFact(possessionPlays, "possession play") : "",
      scoringPlays ? safeStatFact(scoringPlays, "scoring play") : "",
    ],
    development: {
      whatWentWell: `${playerFirstName(player)} stayed involved when the game context mattered most.`,
      whyItMattered: hasOvertime
        ? "Overtime possessions carry extra weight because they can protect momentum, create a final chance, or help the team settle under pressure."
        : "Close-score possessions after halftime carry extra weight because they can protect momentum, create a chance, or help the team settle under pressure.",
      whatToBuildOn: "Keep looking for the simple, controlled play in close-score moments.",
    },
    focus: {
      focusTitle: "Close-game possession",
      whyThisFits: hasOvertime
        ? "The tracked plays show positive involvement when the score was close in overtime."
        : "The tracked plays show positive involvement during a close-score second half.",
      tryThisNextGame: "In the next close stretch, secure the ball first, then make the simple pass before pressure arrives.",
      confidence: "high",
      category: "possession",
    },
    encouragement: "Praise the calm, useful plays that helped the team stay connected in a high-leverage stretch.",
  });
}

function detectPossessionWinLossPattern(events = [], totals = {}, player = state.player) {
  const wins = events.filter(isPossessionWinEvent);
  const losses = events.filter(isPossessionLossEvent);
  if (!wins.length) return null;
  const sequence = possessionQualitySequence(events);
  if (!sequence.lossesAfterWin && !sequence.protectedAfterWin) return null;
  const protectedMoreThanLost = sequence.protectedAfterWin > sequence.lossesAfterWin;
  return patternResult({
    key: "possessionWinLoss",
    storyType: protectedMoreThanLost ? "Possession Builder" : "Cleaner Possession Needed",
    title: protectedMoreThanLost ? "Win it, then use it" : "Win it, then protect it",
    text: protectedMoreThanLost
      ? `${playerFirstName(player)} helped turn possession wins into cleaner next plays.`
      : `${playerFirstName(player)} helped create possession chances, and the next development layer is protecting the ball after those wins.`,
    category: "possession",
    priority: protectedMoreThanLost ? 84 : 94,
    evidence: [
      safeStatFact(wins.length, "possession win"),
      safeStatFact(losses.length, "possession loss", "possession losses"),
      sequence.protectedAfterWin ? safeStatFact(sequence.protectedAfterWin, "protected follow-up") : "",
      sequence.lossesAfterWin ? safeStatFact(sequence.lossesAfterWin, "quick loss", "quick losses") : "",
      `${signedMetric(totals.possessionValue)} possession value`,
    ],
    development: {
      whatWentWell: `${playerFirstName(player)} created chances to gain or protect possession.`,
      whyItMattered: "Winning the ball is the first part of the play. Possession quality comes from the next pass, cradle, clear, or reset.",
      whatToBuildOn: protectedMoreThanLost ? "Keep connecting possession wins to clean next plays." : "Turn the first possession win into one clean decision before pressure arrives.",
    },
    focus: {
      focusTitle: protectedMoreThanLost ? "Repeat the next play" : "Protect the first win",
      whyThisFits: protectedMoreThanLost
        ? "The stat pattern shows possession wins that were followed by protected next plays."
        : "The stat pattern shows both possession wins and moments where the ball was given back.",
      tryThisNextGame: protectedMoreThanLost
        ? "After winning the ball, keep looking for the same simple outlet or support decision that protected the possession."
        : "After a ground ball, save, clear, or faceoff win, make the first safe pass or carry before pressure closes.",
      confidence: "high",
      category: "possession",
    },
    encouragement: protectedMoreThanLost
      ? "Celebrate the possession wins and the simple follow-up plays that protected them."
      : "Celebrate the possession wins, then reinforce the first clean decision after the ball is secured.",
  });
}

function detectDefenseClearConversion(events = [], totals = {}, player = state.player) {
  const defensiveStarts = events.filter(isDefensivePressureEvent);
  if (!defensiveStarts.length) return null;
  const clears = events.filter((event) => event.statType === "successfulClear").length;
  const failedExits = events.filter((event) => event.statType === "failedClear" || event.statType === "turnover").length;
  if (!clears && !failedExits) return null;
  const clean = clears >= failedExits;
  return patternResult({
    key: "defenseClearConversion",
    storyType: clean ? "Defensive Spark" : "Transition Growth Game",
    title: clean ? "Defense became possession" : "Defense-to-clear growth",
    text: clean
      ? `${playerFirstName(player)} helped turn defensive pressure into cleaner possessions.`
      : `${playerFirstName(player)} helped create defensive stops, and the next growth area is the exit after the stop.`,
    category: "defense",
    priority: clean ? 88 : 94,
    evidence: [
      safeStatFact(defensiveStarts.length, "defensive pressure play"),
      clears ? safeStatFact(clears, "successful clear") : "",
      failedExits ? safeStatFact(failedExits, "exit under pressure") : "",
    ],
    development: {
      whatWentWell: `${playerFirstName(player)} helped reduce opponent pressure.`,
      whyItMattered: "A defensive play is most valuable when it becomes a ground ball, outlet, or clear that lets the team reset.",
      whatToBuildOn: clean ? "Keep connecting stops to clean exits." : "Stay composed after the stop and find the first clean outlet.",
    },
    focus: {
      focusTitle: clean ? "Start the clear" : "Clean first outlet",
      whyThisFits: "The game included defensive pressure and clear or exit moments.",
      tryThisNextGame: clean ? "After the stop, communicate early and support the clear." : "After a stop, slow the first decision just enough to find the safest outlet.",
      confidence: "high",
      category: "defense",
    },
    encouragement: clean ? "Praise the stops that became team possessions." : "Praise the stop first, then talk about the outlet that finishes the play.",
  });
}

function detectShotQualityPattern(events = [], totals = {}, player = state.player) {
  if (totals.shots < 3 || totals.shotOnGoalPct >= 0.5) return null;
  const shotTags = events
    .filter((event) => ["goal", "shot", "shotOnGoal"].includes(event.statType))
    .flatMap((event) => event.tags || []);
  const pressureTags = shotTags.filter((tag) => ["Under pressure", "Bad angle", "Blocked", "Missed cage", "Pipe", "Saved"].includes(tag)).length;
  return patternResult({
    key: "shotQuality",
    storyType: "Scoring Driver",
    title: "Shot quality next",
    text: `${playerFirstName(player)} was involved in scoring chances. The next step is improving shot quality, not just shot volume.`,
    category: "scoring",
    priority: 86,
    evidence: [
      safeStatFact(totals.shots, "shot"),
      `${pct(totals.shotOnGoalPct)} shot-on-goal rate`,
      pressureTags ? "shot tags point to pressure or angle details" : "",
    ],
    development: {
      whatWentWell: `${playerFirstName(player)} got involved around the goal.`,
      whyItMattered: "Shot involvement is useful, but repeatable scoring comes from better spots, better timing, and calmer decisions under pressure.",
      whatToBuildOn: "Look for higher-quality chances before settling for the first available look.",
    },
    focus: {
      focusTitle: "Improve shot quality",
      whyThisFits: "The game had shot volume, but fewer shots reached the cage.",
      tryThisNextGame: "Before shooting, look for one step to improve angle, space, or time and room.",
      confidence: "high",
      category: "scoring",
    },
    encouragement: "Praise the willingness to get involved, then reinforce looking for the best available shot.",
  });
}

function detectStrongStartPattern(events = [], totals = {}, player = state.player) {
  const earlyPositive = events.filter((event) => event.intelligenceSegment === "early_game" && isPositiveDevelopmentEvent(event));
  if (earlyPositive.length < 2) return null;
  return patternResult({
    key: "strongStart",
    storyType: totals.points > 0 ? "Scoring Driver" : "Effort Game",
    title: "Strong start",
    text: `${playerFirstName(player)} got involved early, which helped set the tone for the game.`,
    category: "effort",
    priority: 72,
    evidence: [safeStatFact(earlyPositive.length, "positive early play")],
    development: {
      whatWentWell: `${playerFirstName(player)} was ready early.`,
      whyItMattered: "Early involvement can help a player settle into the game and start seeing the next play sooner.",
      whatToBuildOn: "Carry that same ready posture into the next shift or period.",
    },
    focus: {
      focusTitle: "Start ready",
      whyThisFits: "The early-game events were a positive part of the game story.",
      tryThisNextGame: "Look for one ground ball, support pass, or smart off-ball play in the first shift.",
      confidence: "medium",
      category: "effort",
    },
    encouragement: "Point out that early effort and readiness helped the player get connected.",
  });
}

function detectStrongFinishPattern(events = [], totals = {}, player = state.player) {
  const latePositive = events.filter((event) => (event.intelligenceSegment === "late_game" || event.intelligenceSegment === "overtime") && isPositiveDevelopmentEvent(event));
  if (latePositive.length < 2) return null;
  return patternResult({
    key: "strongFinish",
    storyType: "Late-Game Contributor",
    title: "Strong finish",
    text: `${playerFirstName(player)} stayed involved late, which is a strong development sign.`,
    category: "effort",
    priority: 78,
    evidence: [safeStatFact(latePositive.length, "positive late play")],
    development: {
      whatWentWell: `${playerFirstName(player)} kept contributing late in the game.`,
      whyItMattered: "Late involvement shows the player stayed connected after the game had already developed.",
      whatToBuildOn: "Keep looking for one useful play after halftime or in the final stretch.",
    },
    focus: {
      focusTitle: "Stay involved late",
      whyThisFits: "The late-game events were a positive part of the review.",
      tryThisNextGame: "Pick one late-game possession to support with a ground ball, clear, ride, or smart pass.",
      confidence: "medium",
      category: "effort",
    },
    encouragement: "Praise staying involved all the way through the game.",
  });
}

function detectSlowStartLateInvolvementPattern(events = [], totals = {}, player = state.player) {
  const earlyPositive = events.filter((event) => event.intelligenceSegment === "early_game" && isPositiveDevelopmentEvent(event));
  const laterPositive = events.filter((event) => ["mid_game", "late_game", "overtime"].includes(event.intelligenceSegment) && isPositiveDevelopmentEvent(event));
  if (earlyPositive.length > 1 || laterPositive.length < 2) return null;
  return patternResult({
    key: "lateInvolvement",
    storyType: "Late-Game Contributor",
    title: "Grew into the game",
    text: `${playerFirstName(player)} became more involved as the game moved on. That is a useful sign when a player keeps searching for ways to help.`,
    category: "effort",
    priority: 76,
    evidence: [safeStatFact(laterPositive.length, "positive later play"), earlyPositive.length ? "limited early involvement" : "no positive early plays tracked"],
    development: {
      whatWentWell: `${playerFirstName(player)} found ways to contribute later.`,
      whyItMattered: "Players do not always start fast. Staying engaged and finding the next useful play is part of development.",
      whatToBuildOn: "Try to bring that same involvement into the first period or first shift.",
    },
    focus: {
      focusTitle: "Start the next shift ready",
      whyThisFits: "The positive pattern showed up later more than early.",
      tryThisNextGame: "Look for one early ground ball, support pass, or smart decision to get connected sooner.",
      confidence: "medium",
      category: "effort",
    },
    encouragement: "Praise the way the player kept working into the game instead of disappearing after a quiet start.",
  });
}

function detectPlayHardWithControlPattern(events = [], totals = {}, player = state.player) {
  const closeLateControl = events.filter(
    (event) =>
      (event.intelligenceSegment === "late_game" || event.intelligenceSegment === "overtime") &&
      (isCloseScoreEvent(event) || !hasKnownScoreState(events)) &&
      (event.statType === "penalty" || isPossessionLossEvent(event)),
  );
  if (!closeLateControl.length) return null;
  return patternResult({
    key: "playHardWithControl",
    storyType: "Cleaner Possession Needed",
    title: "Play hard with control",
    text: `${playerFirstName(player)} was involved in pressure moments. The next step is keeping that effort controlled so the team can protect possession.`,
    category: "decision",
    priority: 96,
    evidence: [safeStatFact(closeLateControl.length, "late pressure moment")],
    development: {
      whatWentWell: `${playerFirstName(player)} was involved when the game had pressure.`,
      whyItMattered: "Close-game effort matters, and clean decisions help that effort become a useful possession instead of a reset for the opponent.",
      whatToBuildOn: "Play with the same energy, then make the safest first decision.",
    },
    focus: {
      focusTitle: "Controlled pressure",
      whyThisFits: "A late or close-game negative event points to a useful development target.",
      tryThisNextGame: "When pressure rises, pause for the simple outlet, body position, or safe carry before forcing the play.",
      confidence: "high",
      category: "decision",
    },
    encouragement: "Frame this positively: the effort was there, and control is the next layer.",
  });
}

function detectGoalieResponsePattern(events = [], totals = {}, player = state.player) {
  if (impactPositionGroup(player) !== "goalie" && !(totals.saves || totals.goalsAllowed)) return null;
  if (!(totals.saves || totals.goalsAllowed)) return null;
  const clearEvents = events.filter((event) => event.statType === "successfulClear" || event.statType === "failedClear").length;
  return patternResult({
    key: "goalieResponse",
    storyType: "Goalie Impact Game",
    title: "Goalie response",
    text: `${playerFirstName(player)}'s goalie impact showed up in saves, goals allowed context, and the chance to help the team reset after pressure.`,
    category: "goalie",
    priority: 90,
    evidence: [
      safeStatFact(totals.saves, "save"),
      safeStatFact(totals.goalsAllowed, "goal allowed", "goals allowed"),
      clearEvents ? safeStatFact(clearEvents, "clear event") : "",
    ],
    development: {
      whatWentWell: totals.saves ? `${playerFirstName(player)} gave the team chances to reset with saves.` : `${playerFirstName(player)} faced pressure in goal and created reviewable learning moments.`,
      whyItMattered: "A save protects the scoreboard, but the outlet and reset can become the first play of the next possession.",
      whatToBuildOn: "Organize quickly after the shot and look for the safest outlet.",
    },
    focus: {
      focusTitle: "Save to outlet",
      whyThisFits: "Goalie events were part of the tracked game story.",
      tryThisNextGame: "After each save or loose rebound, find the first safe outlet and help the clear start cleanly.",
      confidence: totals.saves + totals.goalsAllowed >= 3 ? "high" : "medium",
      category: "goalie",
    },
    encouragement: "Praise the reset and communication after the shot, not just the save.",
  });
}

function detectFaceoffExitPattern(events = [], totals = {}, player = state.player) {
  if (impactPositionGroup(player) !== "faceoff" && !totals.faceoffAttempts) return null;
  if (!totals.faceoffAttempts) return null;
  const exits = events.filter((event) => ["groundBall", "turnover", "successfulClear", "failedClear"].includes(event.statType)).length;
  return patternResult({
    key: "faceoffExit",
    storyType: "Faceoff Possession Game",
    title: "Faceoff exit",
    text: `${playerFirstName(player)}'s faceoff story is about more than the win or loss. The exit after the draw decides whether it becomes a team possession.`,
    category: "faceoff",
    priority: 89,
    evidence: [
      `${totals.faceoffWins}-${totals.faceoffAttempts} on faceoffs`,
      exits ? safeStatFact(exits, "exit or loose-ball play") : "",
    ],
    development: {
      whatWentWell: totals.faceoffWins ? `${playerFirstName(player)} created immediate possession chances.` : `${playerFirstName(player)} generated faceoff reps that can guide the next practice focus.`,
      whyItMattered: "The faceoff win matters most when the ball exits cleanly to a teammate or controlled space.",
      whatToBuildOn: "Compete through the loose ball and make the first clean pass.",
    },
    focus: {
      focusTitle: "Win to exit",
      whyThisFits: "Faceoff events were a meaningful part of the tracked game.",
      tryThisNextGame: "After the clamp or loose ball, think first clean exit: scoop, protect, and move it.",
      confidence: totals.faceoffAttempts >= 3 ? "high" : "medium",
      category: "faceoff",
    },
    encouragement: "Praise the compete-through-the-ball moments that turn faceoff reps into possessions.",
  });
}

function detectSeasonTrendPattern(events = [], totals = {}, player = state.player, seasonContext = null) {
  if (!seasonContext || Number(seasonContext.gamesPlayed || 0) < 2) return null;
  const abovePossession = Number(totals.possessionValue || 0) >= Number(seasonContext.averagePossessionValue || 0) + 1.5;
  if (!abovePossession) return null;
  return patternResult({
    key: "seasonTrend",
    storyType: abovePossession ? "Possession Builder" : "Effort Game",
    title: "Season trend",
    text: abovePossession
      ? `${playerFirstName(player)}'s possession work stood above the recent season pattern.`
      : `${playerFirstName(player)}'s game impact stood above the recent season average.`,
    category: "season",
    priority: 82,
    evidence: [
      abovePossession ? `Possession value ${signedMetric(totals.possessionValue)} vs ${signedMetric(seasonContext.averagePossessionValue)} season average` : "",
    ],
    development: {
      whatWentWell: `${playerFirstName(player)} showed a positive game pattern compared with the season view.`,
      whyItMattered: "Season context helps separate one stat from a developing pattern.",
      whatToBuildOn: "Repeat the same type of useful play next game.",
    },
    focus: {
      focusTitle: abovePossession ? "Repeat possession value" : "Repeat the impact pattern",
      whyThisFits: "This game stood out against the saved season context.",
      tryThisNextGame: "Pick one repeatable play from this game and try to create it again early.",
      confidence: "medium",
      category: "season",
    },
    encouragement: "Point out the developing pattern, not just the single-game result.",
  });
}

function detectPositiveStandoutPattern(events = [], totals = {}, player = state.player) {
  const topContribution = topContributionForTotals(totals);
  const driver = reviewDriverType(totals, topContribution.label, player);
  if (driver === "lowData") return null;
  const storyTypeMap = {
    scoring: "Scoring Driver",
    possession: "Possession Builder",
    defense: "Defensive Spark",
    goalie: "Goalie Impact Game",
    effort: "Effort Game",
    balanced: "Effort Game",
  };
  return patternResult({
    key: "positiveStandout",
    storyType: storyTypeMap[driver] || "Effort Game",
    title: topContribution.label,
    text: `${playerFirstName(player)}'s top contribution came through ${topContribution.label.toLowerCase()} plays.`,
    category: driver,
    priority: 64,
    evidence: [topContribution.display, topContribution.helper],
    development: {
      whatWentWell: `${playerFirstName(player)} contributed through ${topContribution.label.toLowerCase()} moments.`,
      whyItMattered: "A clear standout area gives the player something specific to build on.",
      whatToBuildOn: "Repeat the most useful play from this game.",
    },
    focus: {
      focusTitle: "Build on the top contribution",
      whyThisFits: `The strongest stat pattern was ${topContribution.label.toLowerCase()}.`,
      tryThisNextGame: buildNextFocusLine(totals, player, topContribution.label),
      confidence: "medium",
      category: driver,
    },
    encouragement: buildEncouragementLine(totals, topContribution.label, player),
  });
}

function detectLowDataPattern(events = [], totals = {}, player = state.player) {
  if (Number(totals.eventCount || events.length || 0) >= 3) return null;
  return patternResult({
    key: "lowData",
    storyType: "Low Data Game",
    title: "Short game review",
    text: "There may not be enough recorded evidence for a reliable game takeaway yet.",
    category: "low-data",
    priority: 120,
    evidence: [safeStatFact(Number(totals.eventCount || events.length || 0), "tracked play") || "Few tracked plays"],
    development: {
      whatWentWell: "The recorded plays are available for review.",
      whyItMattered: "There may not be enough recorded evidence for a reliable game takeaway yet.",
      whatToBuildOn: "Track one simple pattern next game.",
    },
    focus: {
      focusTitle: "Track one simple pattern",
      whyThisFits: "There are fewer than three recorded events, so LaxHornet does not create a developmental takeaway.",
      tryThisNextGame: "Pick one area to watch, such as ground balls, clears, or smart decisions.",
      confidence: "low",
      category: "tracking",
    },
    encouragement: "Ask about one recorded play without drawing a broader conclusion from this short sample.",
  });
}

function rankPostGameInsights(patterns = []) {
  return patterns
    .filter(Boolean)
    .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0))
    .slice(0, 6);
}

function buildPostGamePatterns(events = [], totals = {}, player = state.player, seasonContext = null) {
  return rankPostGameInsights([
    detectLowDataPattern(events, totals, player),
    detectHighLeverageImpact(events, totals, player),
    detectPlayHardWithControlPattern(events, totals, player),
    detectPossessionWinLossPattern(events, totals, player),
    detectDefenseClearConversion(events, totals, player),
    detectGoalieResponsePattern(events, totals, player),
    detectFaceoffExitPattern(events, totals, player),
    detectShotQualityPattern(events, totals, player),
    detectSeasonTrendPattern(events, totals, player, seasonContext),
    detectStrongFinishPattern(events, totals, player),
    detectSlowStartLateInvolvementPattern(events, totals, player),
    detectStrongStartPattern(events, totals, player),
    detectPositiveStandoutPattern(events, totals, player),
  ]);
}

function playExplanationForKey(key, player = state.player) {
  const name = playerFirstName(player);
  const explanations = {
    processDecision: "A user-entered process tag records the tracker's context about a decision, execution, or outcome. It does not establish a player trait or season conclusion.",
    possessionQuality: "Possession quality asks what happened after the ball was won. A ground ball, save, clear, or faceoff win matters more when the next play protects possession.",
    responseAfterMistake: "A user-entered response tag records what the tracker noticed after a difficult moment. It is optional context, not a conclusion about the player.",
    goal: "A goal finishes a scoring chance, but the development value is also in how the player found space, handled pressure, or made the right read before the shot.",
    assist: "Assists show vision, timing, and trust with teammates. They are a strong sign that the player is seeing more than just their own shot.",
    groundBall: "Ground balls create extra chances and often decide who controls the game. They are one of the clearest signs of effort, readiness, and field awareness.",
    successfulClear: "A clean clear protects possession after pressure and turns defense into offense.",
    causedTurnover: "Caused turnovers disrupt the opponent and can create a new possession. The best defensive plays usually start with good feet and smart pressure.",
    defensiveStop: "A defensive stop matters because it ends pressure and gives the team a chance to reset.",
    hustlePlay: "Hustle plays show effort away from the scoreboard. These plays often create the extra chance that leads to a bigger moment later.",
    smartPlay: "Smart plays show awareness, timing, and decision-making. They are a sign of growth even when they do not create a traditional stat.",
    goalieSave: "A save protects the scoreboard, but it can also start the next possession if the goalie and team reset quickly.",
    faceoffWin: "Faceoff wins create immediate possession. The next step is turning that win into a controlled offensive chance.",
    backedUpShot: "Backing up a shot protects possession after a missed or saved shot. It rewards hustle and anticipation away from the ball carrier.",
    turnover: "Turnovers are useful review moments because they show where the next clean decision can happen sooner.",
    failedClear: "Failed clears show where the team can improve the exit after pressure. The next step is usually one safer pass or support angle.",
    penalty: "Penalties are control moments. The development focus is playing with the same energy while staying composed.",
  };
  return explanations[key] || `${name}'s tracked plays help show how effort, awareness, and decisions shape the game beyond the box score.`;
}

function educationLabelForKey(key) {
  const labels = {
    processDecision: "Decision vs Outcome",
    possessionQuality: "Possession Quality",
    responseAfterMistake: "Response After Mistake",
  };
  return labels[key] || statEducationForKey(key).label;
}

function postGameWhyThesePlaysMatter(events = [], patterns = [], totals = {}, player = state.player, limit = 3) {
  const patternKeys = [];
  const presentStats = new Set((events || []).map((event) => event.statType).filter(Boolean));
  const addKey = (key, options = {}) => {
    if (!key) return;
    if (options.synthetic || presentStats.has(key)) patternKeys.push(key);
  };
  const addPresentKeys = (keys = []) => keys.forEach((key) => addKey(key));
  patterns.forEach((pattern) => {
    if (pattern.key === "shotQuality") addPresentKeys(["shotOnGoal", "goal", "shot"]);
    if (pattern.key === "possessionWinLoss") {
      addKey("possessionQuality", { synthetic: true });
      addPresentKeys(["groundBall", "turnover", "successfulClear", "failedClear"]);
    }
    if (pattern.key === "defenseClearConversion") addPresentKeys(["causedTurnover", "successfulClear", "defensiveStop", "failedClear"]);
    if (pattern.key === "goalieResponse") addPresentKeys(["goalieSave", "successfulClear", "goalAllowed"]);
    if (pattern.key === "faceoffExit") addPresentKeys(["faceoffWin", "faceoffLoss", "groundBall", "turnover"]);
    if (pattern.key === "playHardWithControl") addPresentKeys(["turnover", "failedClear", "penalty"]);
  });
  const eventItems = importantEducationItemsForEvents(events, 6).map((item) => item.key);
  const keys = [...new Set([...patternKeys, ...eventItems])].filter((key) => key && key !== "note").slice(0, limit);
  if (!keys.length) {
    return [{ label: "Tracked plays", explanation: "A fuller guide will build as more plays are tracked." }];
  }
  return keys.map((key) => ({
    label: educationLabelForKey(key),
    explanation: playExplanationForKey(key, player),
  }));
}

function buildPostGameIntelligence(game = {}, events = [], playerContext = state.player, totals = null, seasonContext = null) {
  const player = normalizePlayer(playerContext || gamePlayerSnapshot(game) || state.player);
  const normalizedEvents = enrichPostGameEvents((events || []).map((event) => normalizeEvent(event, game.id || "")));
  const computedTotals = totals || calculateTotals(normalizedEvents, player);
  const patterns = buildPostGamePatterns(normalizedEvents, computedTotals, player, seasonContext);
  const processLayer = processDecisionSummary(normalizedEvents);
  const possessionQuality = possessionQualitySequence(normalizedEvents);
  const primary = patterns[0] || detectLowDataPattern(normalizedEvents, computedTotals, player);
  const nextPattern = patterns.find((pattern) => pattern.focus?.tryThisNextGame) || primary;
  const nextFocus = {
    focusTitle: nextPattern.focus?.focusTitle || "Track one simple pattern",
    whyThisFits: nextPattern.focus?.whyThisFits || "The tracked game has a clear next development step.",
    tryThisNextGame: nextPattern.focus?.tryThisNextGame || "Pick one area to watch, such as ground balls, clears, or smart decisions.",
    confidence: nextPattern.focus?.confidence || (Number(computedTotals.eventCount || 0) >= 5 ? "medium" : "low"),
    category: nextPattern.focus?.category || nextPattern.category || "development",
    evidence: (nextPattern.evidence || primary.evidence || []).filter(Boolean).slice(0, 3),
  };
  const hasEnoughEvidence = Number(computedTotals.eventCount || normalizedEvents.length || 0) >= 3;
  const teamWinGrowthPattern = hasEnoughEvidence
    ? buildTeamWinGrowthPattern(game, normalizedEvents, computedTotals, player, nextFocus)
    : null;
  const primaryPattern = teamWinGrowthPattern || primary;
  const activeNextFocus = teamWinGrowthPattern?.focus
    ? {
        ...nextFocus,
        ...teamWinGrowthPattern.focus,
        evidence: teamWinGrowthPattern.evidence?.filter(Boolean).slice(0, 3) || nextFocus.evidence,
      }
    : nextFocus;
  const insightPatterns = teamWinGrowthPattern
    ? [
        teamWinGrowthPattern,
        ...patterns.filter((pattern) => !["highLeverageImpact", "positiveStandout", "teamWinIndividualGrowth"].includes(pattern.key)),
      ]
    : patterns;
  const contextHighlights = insightPatterns
    .filter((pattern) => pattern.key !== "lowData")
    .slice(0, teamWinGrowthPattern ? 2 : 3)
    .map((pattern) => ({
      label: pattern.title,
      text: pattern.evidence?.length ? `Based on ${listPhrase(pattern.evidence.slice(0, 2))}.` : pattern.text,
    }));
  const development = primaryPattern.development || {};
  return {
    gameStoryType: primaryPattern.storyType || "Effort Game",
    gameStoryTitle: primaryPattern.title || "Game Story",
    gameStoryText: primaryPattern.text || "Here is what shaped this game.",
    developmentTakeaway: hasEnoughEvidence
      ? {
          whatWentWell: development.whatWentWell || `${playerFirstName(player)} contributed in recorded moments.`,
          whyItMattered: development.whyItMattered || "Based on the recorded events, these plays may help explain contribution beyond the scoreboard.",
          whatToBuildOn: development.whatToBuildOn || "One possible next step is to repeat the most useful recorded play from this game.",
          nextFocus: activeNextFocus.tryThisNextGame,
        }
      : null,
    nextFocusRecommendation: activeNextFocus,
    parentEncouragement: primaryPattern.encouragement || buildEncouragementLine(computedTotals, topContributionForTotals(computedTotals).label, player),
    whyThesePlaysMatter: postGameWhyThesePlaysMatter(normalizedEvents, insightPatterns, computedTotals, player, 3),
    contextHighlights,
    processLayer,
    possessionQuality,
    warnings: hasEnoughEvidence ? [] : ["There may not be enough recorded evidence for a reliable game takeaway yet."],
    patterns: insightPatterns,
  };
}

function reviewDriverType(totals = {}, topContribution = "", player = state.player) {
  const positionGroup = impactPositionGroup(player);
  const contribution = String(topContribution || "");
  const eventCount = Number(totals.eventCount || 0);
  const possessionIsStory = isPossessionReviewStory(totals, contribution);
  if (eventCount < 3) return "lowData";
  if (positionGroup === "goalie" && totals.saves + totals.goalsAllowed > 0) return "goalie";
  if (contribution === "Possession" || (possessionIsStory && contribution !== "Scoring" && contribution !== "Defense")) return "possession";
  if (contribution === "Defense" || totals.causedTurnovers + totals.defensiveStops >= 2) return "defense";
  if (contribution === "Scoring" || totals.points >= 2 || totals.goals >= 1) return "scoring";
  if (contribution === "Hustle" || totals.effortScore >= 2 || totals.smartPlays >= 2) return "effort";
  return "balanced";
}

function positionDevelopmentLens(player = state.player) {
  switch (impactPositionGroup(player)) {
    case "attack":
      return "For an attack player, repeatable impact comes from spacing, shot selection, feeding, and riding after the ball leaves the stick.";
    case "midfield":
      return "For a midfielder, the strongest games usually connect both ends: transition, ground balls, clears, and support after the first pass.";
    case "defense":
      return "For a defender or LSM, the goal is to turn good positioning and pressure into a clean ground ball or clear.";
    case "faceoff":
      return "For a faceoff player, the win matters most when it becomes a controlled team possession.";
    case "goalie":
      return "For a goalie, the save is only part of the play; the reset, outlet, and clear can start the next possession.";
    default:
      return "The strongest development pattern is usually the repeatable play that helps the team gain control.";
  }
}

function buildReviewStoryLine(totals = {}, topContribution = "", player = state.player) {
  const driver = reviewDriverType(totals, topContribution, player);
  const possessionIsStory = isPossessionReviewStory(totals, topContribution);
  if (driver === "lowData") return "A fuller review will build as more plays are tracked.";

  if (driver === "scoring" && possessionIsStory) {
    return chooseReviewTemplate(
      [
        "Scoring shaped the game, with possession decisions as the next growth area.",
        "The scoring line led the story, while possession details show the next layer to build.",
        "Finishing and feeding stood out, with cleaner possessions as the next step.",
      ],
      totals,
      topContribution,
      player,
    );
  }

  const templates = {
    scoring: [
      "Scoring drove the impact, with shot quality and support play as the next focus.",
      "The biggest story was offensive involvement in dangerous areas.",
      "Finishing or feeding shaped the game, and the next step is making those chances repeatable.",
    ],
    possession: [
      "Possession work was the biggest story today.",
      "Winning, protecting, or extending possessions shaped this game.",
      "The most important impact came from helping the team gain control of the ball.",
    ],
    defense: [
      "Defensive pressure helped shape the game story.",
      "Defense turned pressure into opportunities to clear and reset.",
      "The strongest theme was disrupting the opponent and helping the team get the ball back.",
    ],
    goalie: [
      "Goalie play helped define the game story.",
      "Shot-stopping and reset moments shaped this game.",
      "The goalie impact came from managing pressure and starting the next possession.",
    ],
    effort: [
      "Effort and awareness kept the player involved beyond the scoreboard.",
      "Hustle and smart plays connected the game story.",
      "The impact came from staying involved when the ball was loose or the play was changing.",
    ],
    balanced: [
      "A balanced game with contributions in more than one part of the field.",
      "The story came from several small plays adding up.",
      "This game showed a mix of involvement, effort, and decision-making.",
    ],
  };

  return chooseReviewTemplate(templates[driver] || templates.balanced, totals, topContribution, player);
}

function buildPossessionStory(totals = {}, topContribution = "", player = state.player) {
  if (!isPossessionReviewStory(totals, topContribution)) return "";
  const extraPossessions = Number(totals.extraPossessions || 0);
  const possessionValue = Number(totals.possessionValue || 0);
  const events = totals.possessionImpact?.eventsByType || {};
  const gameEvents = Array.isArray(totals.events) ? totals.events : [];
  const sequence = possessionQualitySequence(gameEvents);
  const sequenceSentence = gameEvents.length ? possessionQualitySentence(sequence) : "";
  const positives = [];
  const negatives = [];
  const chanceLabel = Math.abs(extraPossessions) === 1 ? "chance" : "chances";

  if (events.groundBall > 0) positives.push(`${events.groundBall} ground ball${events.groundBall === 1 ? "" : "s"}`);
  if (events.causedTurnover > 0) positives.push(`${events.causedTurnover} caused turnover${events.causedTurnover === 1 ? "" : "s"}`);
  if (events.successfulClear > 0) positives.push(`${events.successfulClear} successful clear${events.successfulClear === 1 ? "" : "s"}`);
  if (events.backedUpShot > 0) positives.push(`${events.backedUpShot} backed up shot${events.backedUpShot === 1 ? "" : "s"}`);
  if (events.goalieSave > 0) positives.push(`${events.goalieSave} save${events.goalieSave === 1 ? "" : "s"}`);
  if (events.faceoffWin > 0) positives.push(`${events.faceoffWin} faceoff win${events.faceoffWin === 1 ? "" : "s"}`);
  if (events.turnover > 0) negatives.push(`${events.turnover} turnover${events.turnover === 1 ? "" : "s"}`);
  if (events.failedClear > 0) negatives.push(`${events.failedClear} failed clear${events.failedClear === 1 ? "" : "s"}`);
  if (events.faceoffLoss > 0) negatives.push(`${events.faceoffLoss} faceoff loss${events.faceoffLoss === 1 ? "" : "es"}`);

  if (extraPossessions > 0 && possessionValue > 0) {
    const source = positives.length ? ` through ${listPhrase(positives.slice(0, 3))}` : "";
    return `${signedMetric(possessionValue)} possession value means the player helped create or protect ${signedMetric(extraPossessions)} extra ${chanceLabel}${source}. ${sequenceSentence || "The next step is turning those wins into clean clears or better shot opportunities."}`;
  }
  if (extraPossessions > 0) {
    const source = positives.length ? ` came from ${listPhrase(positives.slice(0, 3))}` : " came from possession work";
    return `${signedMetric(extraPossessions)} extra ${chanceLabel}${source}. ${sequenceSentence || "Winning the ball is the first part; the next step is turning the win into a clean team possession."}`;
  }
  if (possessionValue > 0) {
    const source = positives.length ? ` from ${listPhrase(positives.slice(0, 3))}` : "";
    return `${signedMetric(possessionValue)} possession value shows useful possession-changing plays${source}. Those moments matter because they help the team stay in control.`;
  }
  if (extraPossessions < 0 || possessionValue < 0) {
    const source = negatives.length ? ` The pressure showed up through ${listPhrase(negatives.slice(0, 2))}.` : "";
    return `Possession was the growth area in this game.${source} ${sequenceSentence || "The next step is making the first safe outlet or ground-ball decision before pressure builds."}`;
  }
  return "Possession was part of the story, but not the main driver in this game.";
}

function buildNextFocusLine(totals = {}, player = state.player, topContribution = "", game = null) {
  const positionGroup = impactPositionGroup(player);
  if (Number(totals.eventCount || 0) < 3) return "Track a few more plays next game to reveal the strongest pattern.";
  const context = game ? gameContextSummary(game, totals) : null;
  if (context?.lateNegative > 0 && (context.tiedOrTrailingTurnovers > 0 || totals.groundBalls > 0)) {
    return "Protect the ball after winning possession. Try this next game: secure the ball first, then make the simple pass.";
  }
  if (context?.latePositivePossession > 0 && context.lateNegative === 0) {
    return "Keep building late-game involvement. Try this next game: look for one more possession play after halftime or late in the game.";
  }
  if (context?.goalieCloseSaves > 0) {
    return "Turn saves into clean outlets. Try this next game: look early for the safest outlet after the save.";
  }
  if (positionGroup === "goalie" && totals.saves) return "Find the outlet after saves and help the defense reset quickly.";
  if (totals.turnovers > totals.groundBalls + totals.clears) return "Move the ball before pressure arrives and recover quickly into the next play.";
  if (totals.failedClears > 0 && totals.clears <= totals.failedClears) return "Clear through pressure with the first clean pass or easy outlet.";
  if (totals.shots > 0 && totals.shotOnGoalPct < 0.5) return "Look for higher-quality shots instead of rushing the first available look.";
  if (topContribution === "Defense" || totals.causedTurnovers + totals.defensiveStops >= 2) return "Keep body position first, then use stick pressure to force a rushed decision.";
  if (topContribution === "Possession" || Number(totals.extraPossessions || 0) > 0) return "Turn possession wins into cleaner clears or better shot opportunities.";
  if (positionGroup === "attack" && totals.points > 0) return "Build on the scoring by adding one feed, ride, or backed-up shot.";
  if (positionGroup === "faceoff" && totals.faceoffWins) return "Turn faceoff wins into controlled possessions with the first clean pass.";
  if (totals.effortScore > 0) return "Stay involved off-ball and turn effort plays into controlled possessions.";
  return "Choose one repeatable play to build on next game.";
}

function buildDevelopmentInsight(totals = {}, player = state.player, topContribution = "", game = null) {
  const name = playerFirstName(player);
  const positionGroup = impactPositionGroup(player);
  const driver = reviewDriverType(totals, topContribution, player);
  const context = game ? gameContextSummary(game, totals) : null;
  const contextSentence = scoreContextSentence(context, totals, player);
  const withContext = (sentence) => [sentence, contextSentence].filter(Boolean).join(" ");
  const focus = buildNextFocusLine(totals, player, topContribution, game);

  if (driver === "lowData") {
    return {
      wentWell: "A fuller review will build as more plays are tracked.",
      why: withContext("From this sample, focus on the plays that show involvement, effort, and how the player stayed connected to the game."),
      focus,
    };
  }
  if (driver === "goalie") {
    return {
      wentWell: `${name} helped manage pressure in goal with ${countPhrase(totals.saves, "save", "saves") || "important reset moments"}.`,
      why: withContext("A save is not only a stopped shot. It can become the first play of the next possession when the outlet and clear are organized."),
      focus,
    };
  }
  if (positionGroup === "faceoff" && totals.faceoffWins) {
    return {
      wentWell: `${name} helped create possession chances at the faceoff spot.`,
      why: withContext("Faceoff wins matter most when the loose ball, wing support, and first pass turn the win into settled team possession."),
      focus,
    };
  }
  if (driver === "scoring") {
    const scoringDetail =
      totals.goals && totals.assists
        ? "showed up in both finishing and feeding"
        : totals.goals
          ? "got to scoring spots and finished chances"
          : "helped create scoring chances for teammates";
    return {
      wentWell: `${name} ${scoringDetail}.`,
      why: withContext("Finishing matters, but repeatable impact comes from getting to good areas, reading pressure, and making the next right play."),
      focus,
    };
  }
  if (driver === "defense") {
    return {
      wentWell: `${name} helped disrupt the opponent and turn defense into opportunity.`,
      why: withContext("Defensive impact is not only stopping a shot. It is pressure, positioning, and helping the team get the ball back."),
      focus,
    };
  }
  if (driver === "possession") {
    return {
      wentWell: `${name} helped the team gain control through possession plays.`,
      why: withContext("Possession work often decides youth lacrosse games before the scoreboard shows it."),
      focus,
    };
  }
  if (driver === "effort") {
    return {
      wentWell: `${name} stayed involved through effort, awareness, and off-ball plays.`,
      why: withContext("These are the plays that may not lead the box score, but they connect possessions and help the team keep pressure on."),
      focus,
    };
  }
  return {
    wentWell: `${name} contributed in multiple parts of the game.`,
    why: withContext(`${positionDevelopmentLens(player)} Each tracked play helps show development beyond the scoreboard.`),
    focus,
  };
}

function buildRichKeyTakeaway(totals = {}, player = state.player, topContribution = "") {
  const insight = buildDevelopmentInsight(totals, player, topContribution);
  const possessionStory = buildPossessionStory(totals, topContribution, player);
  return [insight.wentWell, insight.why, possessionStory || insight.focus].filter(Boolean).join(" ");
}

function buildEncouragementLine(totals = {}, topContribution = "", player = state.player) {
  const driver = reviewDriverType(totals, topContribution, player);
  if (driver === "lowData") return "Encourage the tracked moments that show involvement, effort, and growth beyond the box score.";
  if (driver === "possession") return "Celebrate the ground balls, clears, backups, or faceoff plays that created extra chances.";
  if (driver === "scoring" && totals.assists) return "Point out the smart decisions and feeds before praising only the scoring moments.";
  if (driver === "scoring") return "Celebrate getting to dangerous areas, then look for one support play that makes the scoring repeatable.";
  if (driver === "defense") return "Praise the pressure, positioning, and recovery that helped turn stops into possessions.";
  if (driver === "goalie") return "Praise the reset after the save, not just the save itself.";
  if (driver === "effort") return "Praise the effort plays that kept the player involved away from the ball.";
  return "Encourage the plays that show effort, awareness, and growth beyond the box score.";
}

function buildFamilyRecapDevelopmentLine(totals = {}, player = {}, topContribution = "", game = null, intelligence = null) {
  const reviewIntelligence = intelligence || (game ? buildPostGameIntelligence(game, game.events || [], player, totals, calculateSeasonTotalsForPlayer(player)) : null);
  if (reviewIntelligence?.developmentTakeaway) {
    return `${reviewIntelligence.developmentTakeaway.whatWentWell} Build on: ${reviewIntelligence.developmentTakeaway.whatToBuildOn}`;
  }
  if (Number(totals.eventCount || 0) < 3) {
    return "A fuller recap will build as more plays are tracked. From this sample, focus on involvement and effort.";
  }
  return buildRichKeyTakeaway(totals, player, topContribution);
}

function possessionStoryForTotals(totals = {}, topContribution = "", player = state.player) {
  return buildPossessionStory(totals, topContribution, player);
}

function reviewOneLineSummary(totals = {}, topContribution = "", player = state.player) {
  return buildReviewStoryLine(totals, topContribution, player);
}

function encouragementForTotals(totals = {}, topContribution = "", player = state.player) {
  return buildEncouragementLine(totals, topContribution, player);
}

function developmentTakeawayForTotals(totals = {}, player = state.player, topContribution = "", game = null) {
  if (game) return buildPostGameIntelligence(game, game.events || [], player, totals, calculateSeasonTotalsForPlayer(player)).developmentTakeaway;
  return buildDevelopmentInsight(totals, player, topContribution, game);
}

function renderDevelopmentTakeaway(totals = {}, player = state.player, topContribution = "", game = null, intelligence = null) {
  const reviewIntelligence = intelligence || (game ? buildPostGameIntelligence(game, game.events || [], player, totals, calculateSeasonTotalsForPlayer(player)) : null);
  const takeaway = reviewIntelligence?.developmentTakeaway || developmentTakeawayForTotals(totals, player, topContribution, game);
  const hasEnoughEvidence = Number(totals.eventCount || game?.events?.length || 0) >= 3;
  const recorded = familyRecapStatLine(totals, player) || `${Number(totals.eventCount || 0)} recorded event${Number(totals.eventCount || 0) === 1 ? "" : "s"}`;
  const interpretation = hasEnoughEvidence && takeaway
    ? `Based on the recorded events, ${takeaway.whatWentWell || takeaway.wentWell} ${takeaway.whyItMattered || takeaway.why}`
    : "There may not be enough recorded evidence for a reliable game takeaway yet.";
  const possibleFocus = hasEnoughEvidence && takeaway
    ? takeaway.nextFocus || takeaway.focus
    : "Track one simple pattern next game, such as ground balls, clears, or smart decisions.";
  const focusTools = game
    ? `
      <div class="lh-takeaway-focus-tools" aria-label="Next focus options">
        <button class="mini-btn light lh-focus-option" type="button" data-action="save-next-focus" data-game-id="${escapeHTML(game.id)}">Save for Next Game</button>
        <button class="mini-btn light lh-focus-option" type="button" data-action="add-focus-to-recap" data-game-id="${escapeHTML(game.id)}">Add to Recap</button>
      </div>
      ${renderNextGameFocusSection(game, player, totals, topContribution, reviewIntelligence)}
    `
    : "";
  return `
    <section class="card pad development-card lh-development-takeaway">
      <h3>Development Takeaway</h3>
      <div class="takeaway-stack">
        <p><span>Recorded</span>${escapeHTML(recorded)}</p>
        <p><span>What this may suggest</span>${escapeHTML(interpretation)}</p>
        <p><span>Possible next focus</span>${escapeHTML(possibleFocus)}</p>
      </div>
      ${hasEnoughEvidence ? focusTools : ""}
    </section>
  `;
}

function renderWhatToEncourage(totals = {}, topContribution = "", player = state.player, intelligence = null) {
  return `
    <section class="card pad development-card lh-encourage-card">
      <h3>What to Encourage</h3>
      <p>${escapeHTML(intelligence?.parentEncouragement || encouragementForTotals(totals, topContribution, player))}</p>
    </section>
  `;
}

function conversationStarterCandidates(totals = {}, player = state.player, game = null, intelligence = null) {
  const positionGroup = impactPositionGroup(player);
  const context = game ? gameContextSummary(game, totals) : {};
  const patterns = intelligence?.patterns || [];
  const patternKeys = new Set(patterns.map((pattern) => pattern.key).filter(Boolean));
  const possessionQuality = intelligence?.possessionQuality || (game ? possessionQualitySequence(game.events || []) : {});
  const processLayer = intelligence?.processLayer || (game ? processDecisionSummary(game.events || []) : {});
  const finalMargin = game && optionalScoreNumber(game.finalScoreFor) !== null && optionalScoreNumber(game.finalScoreAgainst) !== null
    ? Number(game.finalScoreFor) - Number(game.finalScoreAgainst)
    : null;
  const shotVolume = Number(totals.shots || 0) + Number(totals.shotsOnGoal || 0) + Number(totals.goals || 0);
  const shotOnGoalPct = shotVolume ? Number(totals.shotsOnGoal || 0) / shotVolume : 0;
  const candidates = [];
  const add = (condition, prompt, score = 10, group = "general") => {
    if (!condition || !prompt) return;
    candidates.push({ prompt, score, group });
  };

  add(patternKeys.has("highLeverageImpact") || context.closePossessionPlays > 0, "Which close-game play felt most important, and what helped you stay calm in that moment?", 98, "context");
  add(patternKeys.has("playHardWithControl") || context.lateNegative > 0, "What is one way to play hard in the next close stretch while still protecting the ball?", 95, "context");
  add(patternKeys.has("strongFinish") || context.latePositivePossession > 0, "What helped you stay involved late in the game?", 92, "context");
  add(patternKeys.has("strongStart") || context.earlyScoring > 0, "What helped you get into the game early?", 88, "context");
  add(patternKeys.has("lateInvolvement"), "What changed later in the game that helped you get more involved?", 86, "context");
  add(finalMargin !== null && finalMargin < 0, "Even in a loss, what play showed the kind of effort you want to repeat?", 84, "context");
  add(finalMargin !== null && finalMargin > 0 && Number(totals.impact || 0) < 60, "The team won, but what is one personal play you want to clean up next game?", 82, "context");

  add(patternKeys.has("possessionWinLoss") || possessionQuality.lossesAfterWin > 0, "After winning the ball, what could help make the next pass or carry cleaner?", 90, "possession");
  add(Number(totals.groundBalls || 0) > 0, "Which ground ball changed momentum, and what helped you get there first?", 78, "possession");
  add(Number(totals.backedUpShots || 0) > 0, "What did you notice that helped you back up a shot and keep possession?", 74, "possession");
  add(Number(totals.clears || 0) > 0, "On your best clear, what made the first decision feel simple?", 72, "possession");
  add(Number(totals.failedClears || 0) > 0, "On a tough clear, where was the safer outlet or support option?", 76, "possession");
  add(Number(totals.turnovers || 0) > 0, "Before pressure arrived, what earlier option might have kept the possession clean?", 80, "possession");
  add(Number(totals.extraPossessions || 0) > 0, "What did you do today that helped the team earn an extra chance?", 76, "possession");

  add(patternKeys.has("shotQuality") || (shotVolume >= 3 && shotOnGoalPct < 0.5), "Which shot was the best quality chance, and what made it better than the others?", 88, "offense");
  add(Number(totals.goals || 0) > 0, "On your goal, what happened before the shot that created the chance?", 78, "offense");
  add(Number(totals.assists || 0) > 0, "On your assist, what did you see before you moved the ball?", 78, "offense");
  add(Number(totals.points || 0) > 0, "What helped you create or finish your best scoring chance?", 70, "offense");
  add(Number(totals.shotsOnGoal || 0) > 0, "What helped you get a shot on cage instead of just getting a shot off?", 68, "offense");

  add(patternKeys.has("defenseClearConversion"), "After a stop, what helped the team turn defense into a clear?", 88, "defense");
  add(Number(totals.causedTurnovers || 0) > 0, "What body position or pressure helped create the turnover?", 78, "defense");
  add(Number(totals.defensiveStops || 0) > 0, "When did you feel most connected on defense?", 74, "defense");
  add(positionGroup === "defense" || positionGroup === "lsm", "What defensive moment showed good feet before stick pressure?", 64, "defense");

  add(patternKeys.has("goalieResponse") || Number(totals.saves || 0) > 0, "After your best save, what helped you reset and find the next outlet?", 90, "goalie");
  add(Number(totals.goalsAllowed || 0) > 0 && positionGroup === "goalie", "After a goal against, what helped you reset for the next shot?", 72, "goalie");

  add(patternKeys.has("faceoffExit") || Number(totals.faceoffAttempts || 0) > 0, "On the faceoff, what helped turn the rep into team possession?", 90, "faceoff");
  add(Number(totals.faceoffLosses || 0) > 0, "After a lost faceoff, what was the quickest way to compete for the next possession?", 70, "faceoff");

  add(processLayer.goodDecisionUnsuccessfulExecution > 0, "Was there a play where the idea was right even though the execution did not work yet?", 84, "process");
  add(processLayer.recoveredAfterMistake > 0, "What did you do well after a mistake to get back into the play?", 84, "process");
  add(processLayer.supportedBallCarrier > 0, "When did you help the ball carrier without needing the ball yourself?", 78, "process");
  add(processLayer.communicatedEarly > 0, "What communication helped a teammate see pressure sooner?", 76, "process");
  add(Number(totals.smartPlays || 0) > 0, "What smart decision helped the team, even if it did not show up as a goal or assist?", 76, "process");
  add(Number(totals.hustlePlays || 0) > 0 || Number(totals.effortScore || 0) > 0, "What was one moment where you worked hard away from the ball?", 72, "effort");

  add(positionGroup === "attack", "What spacing or off-ball movement helped create a better scoring chance?", 58, "position");
  add(positionGroup === "midfield", "What was your best two-way play between offense, defense, and transition?", 58, "position");
  add(positionGroup === "goalie", "What helped you organize the defense after pressure?", 58, "position");
  add(positionGroup === "faceoff", "What happened after the clamp or draw that decided possession?", 58, "position");

  add(Number(totals.eventCount || 0) < 3, "What play should we make sure to track next game so the review tells a fuller story?", 100, "lowData");
  add(Number(totals.eventCount || 0) > 0, "What is one thing you want to try next game?", 40, "general");
  add(true, "What play felt best today?", 30, "general");
  add(true, "What should we practice before the next game?", 28, "general");
  add(true, "What is one play you want me to notice next game?", 26, "general");

  return candidates;
}

function conversationStartersForTotals(totals = {}, player = state.player, game = null, intelligence = null, limit = 8) {
  const seen = new Set();
  return conversationStarterCandidates(totals, player, game, intelligence)
    .sort((a, b) => b.score - a.score)
    .map((candidate) => candidate.prompt)
    .filter((prompt) => {
      const key = prompt.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function renderConversationStarters(totals = {}, player = state.player, game = null, intelligence = null) {
  const prompts = conversationStartersForTotals(totals, player, game, intelligence, 8);
  const visiblePrompts = prompts.slice(0, 2);
  const extraPrompts = prompts.slice(2);
  return `
    <section class="card pad development-card lh-conversation-card">
      <h3>Talk About the Game</h3>
      <p class="muted small">Ask your player:</p>
      <ul class="conversation-list">
        ${visiblePrompts.map((prompt) => `<li>${escapeHTML(prompt)}</li>`).join("")}
      </ul>
      ${
        extraPrompts.length
          ? `<details class="lh-more-questions">
              <summary>Show More Questions</summary>
              <ul class="conversation-list compact">
                ${extraPrompts.map((prompt) => `<li>${escapeHTML(prompt)}</li>`).join("")}
              </ul>
            </details>`
          : ""
      }
    </section>
  `;
}

function nextGameFocusForRecap(totals = {}, player = state.player, topContribution = "", game = null, intelligence = null) {
  const recapFocus = game ? loadFamilyRecapFocus(game, player) : "";
  if (recapFocus) return recapFocus;
  const reviewIntelligence = intelligence || (game ? buildPostGameIntelligence(game, game.events || [], player, totals, calculateSeasonTotalsForPlayer(player)) : null);
  return (
    reviewIntelligence?.developmentTakeaway?.nextFocus ||
    reviewIntelligence?.nextFocusRecommendation?.tryThisNextGame ||
    savedNextFocusForPlayer(player) ||
    developmentTakeawayForTotals(totals, player, topContribution).focus
  );
}

function renderNextGameFocusSection(game, player, totals, topContribution = "", intelligence = null) {
  const saved = openNextGameFocusForPlayer(player);
  const focusRecommendation = intelligence?.nextFocusRecommendation || null;
  const recommendationText =
    intelligence?.developmentTakeaway?.nextFocus ||
    focusRecommendation?.tryThisNextGame ||
    buildNextFocusLine(totals, player, topContribution, game);
  const recommendationSelected = focusValueMatchingText(recommendationText) || (recommendationText ? "custom" : recommendedFocusValue(totals));
  const recommendationCustomText = recommendationSelected === "custom" ? recommendationText : "";
  const savedFromThisGame = saved.sourceGameId && saved.sourceGameId === game.id;
  const selectedValue = savedFromThisGame
    ? saved.sourceSelected || saved.selected || recommendationSelected
    : recommendationSelected;
  const customText = selectedValue === "custom"
    ? savedFromThisGame
      ? saved.sourceCustomText || saved.customText
      : recommendationCustomText
    : "";
  const previewFocus = savedFromThisGame
    ? saved.sourceFocusText || saved.text || focusTextForValue(selectedValue, customText, totals, player, topContribution)
    : recommendationText || focusTextForValue(selectedValue, customText, totals, player, topContribution);
  const changedNote = sourceReviewFocusChangeNote(saved, game.id);

  return `
    <details class="lh-inline-focus-editor lh-customize-focus-card">
      <summary>
        <span>Change focus</span>
      </summary>
      <div class="lh-customize-focus-body">
      <div class="field">
        <label for="nextGameFocusSelect">Choose focus</label>
        <select id="nextGameFocusSelect" name="nextGameFocus">
          ${NEXT_GAME_FOCUS_OPTIONS.map(
            (option) => `<option value="${escapeHTML(option.value)}" ${option.value === selectedValue ? "selected" : ""}>${escapeHTML(option.label)}</option>`,
          ).join("")}
        </select>
      </div>
      <div class="field">
        <label for="nextGameFocusCustom">Custom focus</label>
        <input id="nextGameFocusCustom" name="nextGameFocusCustom" value="${escapeHTML(customText)}" placeholder="One simple focus for next game" />
      </div>
      <div class="focus-preview">
        <span>Current focus</span>
        <strong>${escapeHTML(previewFocus)}</strong>
      </div>
      ${
        focusRecommendation
          ? `<div class="lh-focus-recommendation compact">
              <span>Post-game recommendation</span>
              <strong>${escapeHTML(focusRecommendation.focusTitle)}</strong>
              <p>${escapeHTML(focusRecommendation.tryThisNextGame)}</p>
              ${focusRecommendation.evidence?.length ? `<small>Based on: ${escapeHTML(focusRecommendation.evidence.slice(0, 3).join("; "))}</small>` : ""}
            </div>`
          : ""
      }
      ${changedNote ? `<p class="focus-change-note">${escapeHTML(changedNote)}</p>` : ""}
      </div>
    </details>
  `;
}

function renderFocusFollowUpSection(game, player) {
  const focus = reviewFollowUpFocus(game);
  if (!focus.text) return "";
  return `
    <section class="card pad development-card lh-focus-followup-card">
      <h3>Follow-up from last game</h3>
      <div class="focus-preview">
        <span>Focus</span>
        <strong>${escapeHTML(focus.text)}</strong>
      </div>
      <p class="muted small">Did this show up today?</p>
      <div class="lh-focus-actions followup">
        <button class="btn secondary" type="button" data-action="focus-followup" data-result="yes" data-game-id="${escapeHTML(game.id)}">Yes</button>
        <button class="btn neutral" type="button" data-action="focus-followup" data-result="somewhat" data-game-id="${escapeHTML(game.id)}">Somewhat</button>
        <button class="btn neutral" type="button" data-action="focus-followup" data-result="not-yet" data-game-id="${escapeHTML(game.id)}">Not yet</button>
        <button class="btn neutral" type="button" data-action="focus-followup" data-result="carry" data-game-id="${escapeHTML(game.id)}">Carry Forward</button>
      </div>
    </section>
  `;
}

function renderStatEducationHelp() {
  const keys = ["groundBall", "causedTurnover", "goalieSave", "successfulClear", "backedUpShot", "assist", "faceoffWin", "smartPlay"];
  return `
    <div class="card pad lh-why-card lh-help-why-card">
      <h3>Why Plays Matter</h3>
      <p class="muted small">Track the game. Understand the sport. Encourage the player. These quick explanations help parents connect stats to development.</p>
      <div class="why-play-list compact">
        ${keys
          .map((key) => {
            const item = statEducationForKey(key);
            return `
              <article class="why-play-item">
                <div>
                  <strong>${escapeHTML(item.label)}</strong>
                  <span>development lens</span>
                </div>
                <p class="why-play-meaning">${escapeHTML(item.meaning)}</p>
                <p><b>Why it matters:</b> ${escapeHTML(item.why)}</p>
                <p><b>Next focus:</b> ${escapeHTML(item.focus)}</p>
              </article>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

const FAMILY_RECAP_STATS_BY_POSITION = {
  attack: ["goals", "assists", "shotsOnGoal", "groundBalls", "backedUpShots", "smartPlays", "hustlePlays"],
  midfield: ["goals", "assists", "groundBalls", "causedTurnovers", "clears", "backedUpShots", "hustlePlays", "smartPlays"],
  defense: ["causedTurnovers", "defensiveStops", "groundBalls", "clears", "backedUpShots", "hustlePlays", "smartPlays"],
  goalie: ["saves", "goalsAllowed", "clears", "groundBalls", "smartPlays"],
  faceoff: ["faceoffWins", "faceoffLosses", "groundBalls", "causedTurnovers", "hustlePlays", "smartPlays"],
  default: ["goals", "assists", "groundBalls", "causedTurnovers", "clears", "saves", "faceoffWins", "hustlePlays", "smartPlays"],
};

const FAMILY_RECAP_STAT_LABELS = {
  goals: ["goal", "goals"],
  assists: ["assist", "assists"],
  shotsOnGoal: ["shot on goal", "shots on goal"],
  groundBalls: ["ground ball", "ground balls"],
  causedTurnovers: ["caused turnover", "caused turnovers"],
  defensiveStops: ["defensive stop", "defensive stops"],
  clears: ["successful clear", "successful clears"],
  saves: ["save", "saves"],
  goalsAllowed: ["goal allowed", "goals allowed"],
  faceoffWins: ["faceoff win", "faceoff wins"],
  faceoffLosses: ["faceoff loss", "faceoff losses"],
  backedUpShots: ["backed up shot", "backed up shots"],
  hustlePlays: ["hustle play", "hustle plays"],
  smartPlays: ["smart play", "smart plays"],
};

function countPhrase(value, singular, plural = `${singular}s`) {
  const count = Number(value || 0);
  if (!count) return "";
  return `${formatImpactNumber(count)} ${count === 1 ? singular : plural}`;
}

function familyRecapOpponentLabel(game = {}) {
  const opponent = String(game.opponent || "").trim();
  if (!opponent || opponent.toLowerCase() === "opponent") return "- today's game";
  return `vs ${opponent}`;
}

function familyRecapStatLine(totals = {}, player = {}) {
  const positionGroup = impactPositionGroup(player);
  const orderedKeys = [...(FAMILY_RECAP_STATS_BY_POSITION[positionGroup] || FAMILY_RECAP_STATS_BY_POSITION.default), ...FAMILY_RECAP_STATS_BY_POSITION.default];
  const seen = new Set();
  const phrases = [];

  orderedKeys.forEach((key) => {
    if (seen.has(key) || phrases.length >= 6) return;
    seen.add(key);
    const labels = FAMILY_RECAP_STAT_LABELS[key];
    const phrase = labels ? countPhrase(totals[key], labels[0], labels[1]) : "";
    if (phrase) phrases.push(phrase);
  });

  return phrases.join(", ");
}

function familyRecapTopContribution(totals = {}, player = {}) {
  const positionGroup = impactPositionGroup(player);
  if (positionGroup === "goalie" && totals.saves) return "Goalie play";
  if (positionGroup === "faceoff" && totals.faceoffWins) return "Faceoff / possession";
  if (positionGroup === "defense" && totals.causedTurnovers + totals.defensiveStops > 0) return "Defense";
  if (positionGroup === "attack" && totals.points > 0) return "Scoring";
  const topContribution = topContributionForTotals(totals);
  if (!topContribution || topContribution.label === "Building profile") return "";
  return topContribution.label;
}

function familyRecapTakeaway(totals = {}, player = {}, topContribution = "", game = null, intelligence = null) {
  return buildFamilyRecapDevelopmentLine(totals, player, topContribution, game, intelligence);
}

function rideHomeRecapLine(totals = {}, player = {}, intelligence = null, game = null) {
  const encouragement = intelligence?.parentEncouragement || buildEncouragementLine(totals, familyRecapTopContribution(totals, player), player);
  const prompt = conversationStartersForTotals(totals, player, game, intelligence)[0] || "What play felt best today?";
  return `Ride home idea: ${encouragement} Ask: "${prompt}"`;
}

function buildFamilyRecap(game = {}, events = [], playerContext = {}, computedStats = null, intelligence = null) {
  const player = playerContext || {};
  const totals = computedStats || calculateTotals(events || [], player);
  const reviewIntelligence = intelligence || buildPostGameIntelligence(game, events || [], player, totals, calculateSeasonTotalsForPlayer(player));
  const title = `${playerFirstName(player)} ${familyRecapOpponentLabel(game)}`;
  const eventCount = Number(totals.eventCount || events?.length || 0);
  const topContribution = familyRecapTopContribution(totals, player);
  const statLine = familyRecapStatLine(totals, player);
  const recorded = statLine || `${eventCount} recorded event${eventCount === 1 ? "" : "s"}`;
  const interpretation = eventCount < 3
    ? "There may not be enough recorded evidence for a reliable game takeaway yet."
    : topContribution
      ? `Based on the recorded events, ${topContribution.toLowerCase()} may have been an important part of this game.`
      : "The recorded events suggest several contribution types may have shaped the game.";
  const publicRecapIntelligence = { ...reviewIntelligence, processLayer: {} };
  const conversationPrompt = conversationStartersForTotals(totals, player, game, publicRecapIntelligence)[0] || "What play felt best today?";
  const optionalFocus = loadFamilyRecapFocus(game, player);
  const lines = [];

  lines.push("Recorded contributions", recorded);
  lines.push("", "What this may suggest", interpretation);
  lines.push("", "Conversation starter", conversationPrompt);
  if (optionalFocus) lines.push("", "Possible next focus", `One possible focus is ${optionalFocus}`);

  const body = lines.join("\n");
  return {
    title,
    body,
    text: `${title}\n${body}`,
  };
}

function renderFamilyRecapSection(game, player, totals, intelligence = null) {
  const recap = buildFamilyRecap(game, game.events || [], player, totals, intelligence);
  const previewLines = recap.text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join("\n");
  return `
    <section class="card pad lh-family-recap-card" aria-label="Optional recap sharing">
      <details class="lh-family-recap-details">
        <summary>
          <span>
            <span class="lh-tertiary-label">Optional share</span>
            <strong>Share Recap</strong>
            <small>Copy a short, positive recap when you need it.</small>
          </span>
        </summary>
        <div class="lh-family-recap-body">
          <div class="lh-family-recap-preview" aria-label="Recap preview">${escapeHTML(previewLines || recap.title).replace(/\n/g, "<br>")}</div>
          <div class="lh-family-recap-actions">
            <button class="mini-btn light" type="button" data-action="copy-family-recap" data-game-id="${escapeHTML(game.id)}">Copy Recap</button>
            ${canShareFamilyRecap() ? `<button class="mini-btn light" type="button" data-action="share-family-recap" data-game-id="${escapeHTML(game.id)}">Share Recap</button>` : ""}
          </div>
          <details class="lh-family-recap-expand">
            <summary>View full recap text</summary>
            <div class="lh-family-recap-text" aria-label="Full recap">${escapeHTML(recap.text).replace(/\n/g, "<br>")}</div>
          </details>
        </div>
      </details>
    </section>
  `;
}

function uniqueInsightLines(lines = [], limit = 5) {
  const seen = new Set();
  return lines
    .map((line) => String(line || "").trim())
    .filter((line) => {
      const key = line.toLowerCase();
      if (!line || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function seasonEventsFromGames(games = []) {
  return games.flatMap((game) =>
    (game.events || []).map((event) => normalizeEvent(event, game.id || "")),
  );
}

function seasonSignalsForContext(totals = {}, player = state.player, sequence = {}) {
  const signals = [];
  const add = (condition, label, text) => {
    if (condition && signals.length < 3) signals.push({ label, text });
  };
  add(
    sequence.protectedAfterWin > sequence.lossesAfterWin && sequence.protectedAfterWin > 0,
    "Possession quality",
    `The recorded sequences may suggest that some possession wins became protected next plays.`,
  );
  add(
    sequence.lossesAfterWin > sequence.protectedAfterWin && sequence.lossesAfterWin > 0,
    "Next-play growth",
    "One possible focus is the first decision after winning or protecting the ball.",
  );
  add(
    Number(totals.averagePossessionValue || 0) > 0,
    "Possession value",
    `${signedMetric(totals.averagePossessionValue)} average possession value suggests possession events are part of the recorded season story.`,
  );
  add(
    Number(totals.averageImpact || 0) > 0,
    "Impact trend",
    `${formatImpactNumber(totals.averageImpact)} average LaxHornet Impact summarizes selected recorded events across saved games.`,
  );
  return signals;
}

function seasonStoryWithSignals(totals = {}, player = state.player, topContribution = "", sequence = {}) {
  const base = seasonStoryForTotals(totals, player, topContribution);
  if (!Number(totals.gamesPlayed || 0) || Number(totals.eventCount || 0) < 3) return base;
  if (sequence.protectedAfterWin > sequence.lossesAfterWin && sequence.protectedAfterWin > 0) {
    return `${base} The recorded sequence data may suggest that some possession wins became protected next actions.`;
  }
  if (sequence.lossesAfterWin > sequence.protectedAfterWin && sequence.lossesAfterWin > 0) {
    return `${base} The next layer is possession quality after the ball is won: secure it, find support, and turn the win into a cleaner team possession.`;
  }
  return base;
}

function seasonRecordedEvidence(totals = {}, player = state.player, sequence = {}) {
  const sequenceLines = [];
  if (sequence.protectedAfterWin > 0) {
    sequenceLines.push(`Recorded possession wins were followed by ${sequence.protectedAfterWin} protected next play${sequence.protectedAfterWin === 1 ? "" : "s"}.`);
  }
  return uniqueInsightLines([...sequenceLines, ...seasonStrengthBullets(totals, player)], 5);
}

function seasonEncouragementFromEvidence(totals = {}, player = state.player, topContribution = "", sequence = {}) {
  if (sequence.protectedAfterWin > sequence.lossesAfterWin && sequence.protectedAfterWin > 0) {
    return "Celebrate the possession wins and the simple next plays that protected them.";
  }
  if (sequence.lossesAfterWin > sequence.protectedAfterWin && sequence.lossesAfterWin > 0) {
    return "Celebrate winning the ball, then reinforce the first calm pass or carry after possession is secured.";
  }
  return seasonEncouragementForTotals(totals, player, topContribution);
}

function seasonNextFocusFromEvidence(totals = {}, sequence = {}) {
  if (!totals.gamesPlayed) return "Track one full game to build a stronger season picture.";
  if (sequence.lossesAfterWin > sequence.protectedAfterWin && sequence.lossesAfterWin > 0) {
    return "Win the ball, then make the first clean decision before pressure arrives.";
  }
  if (sequence.protectedAfterWin > 0) {
    return "Repeat the first clean support pass or safe carry after possession wins.";
  }
  return nextLevelFocusForSeason(totals);
}

function seasonWhyThesePlaysMatter(events = [], totals = {}, player = state.player, sequence = {}) {
  const customItems = [];
  if (sequence.wins > 0) {
    customItems.push({
      label: "Possession Quality",
      explanation: "Possession quality asks what happened after the ball was won. Ground balls, saves, clears, and faceoff wins matter more when the next play protects possession.",
    });
  }
  const eventItems = postGameWhyThesePlaysMatter(events, [], totals, player, 8);
  const merged = new Map();
  [...customItems, ...eventItems].forEach((item) => {
    const key = String(item.label || "").toLowerCase();
    if (key && !merged.has(key)) merged.set(key, item);
  });
  return [...merged.values()].slice(0, 8);
}

function buildSeasonIntelligence(games = visibleGames(), totals = calculateSeasonTotalsFromGames(games), player = state.player) {
  const events = enrichPostGameEvents(seasonEventsFromGames(games));
  const topContribution = topContributionForTotals(totals);
  const sequence = possessionQualitySequence(events);
  return {
    story: seasonStoryWithSignals(totals, player, topContribution.label, sequence),
    strengths: seasonRecordedEvidence(totals, player, sequence),
    encouragement: seasonEncouragementFromEvidence(totals, player, topContribution.label, sequence),
    nextFocus: seasonNextFocusFromEvidence(totals, sequence),
    whyItems: seasonWhyThesePlaysMatter(events, totals, player, sequence),
    signals: seasonSignalsForContext(totals, player, sequence),
    possessionQuality: sequence,
  };
}

function seasonStoryForTotals(totals, player = state.player, topContribution = topContributionForTotals(totals).label) {
  const name = playerFirstName(player);
  const driver = reviewDriverType(totals, topContribution, player);
  if (!Number(totals.gamesPlayed || 0) || Number(totals.eventCount || 0) < 3) {
    return "There may not be enough recorded evidence for a reliable season interpretation yet. More complete game tracking can make the summary more specific.";
  }
  if (driver === "goalie") {
    return `Based on the recorded games, goalie events may be an important part of ${name}'s season. Saves are recorded evidence; organization, outlets, and clears are possible areas worth watching next.`;
  }
  if (impactPositionGroup(player) === "faceoff" && totals.faceoffAttempts > 0) {
    return `The recorded faceoff events suggest possession starts may be an important part of ${name}'s season. One possible next focus is turning wins and loose-ball follow-up into controlled team possessions.`;
  }
  if (driver === "possession") {
    return `Across the saved games, the recorded events suggest possession work may be a recurring contribution for ${name}. Ground balls, clears, faceoffs, and defensive pressure can create or protect extra chances.`;
  }
  if (driver === "scoring") {
    return `The recorded games suggest scoring involvement may be a recurring contribution for ${name}. One possible next focus is how shot quality, spacing, and support play create those chances.`;
  }
  if (driver === "defense") {
    return `The recorded games suggest pressure, stops, and possession-changing defensive plays may be part of ${name}'s season contribution. Those events can help turn defense into a chance to clear and reset.`;
  }
  if (driver === "effort") {
    return `Manually recorded hustle and smart-play events may add context beyond ${name}'s scoring line. Because these are user-entered observations, they should be discussed as context rather than a conclusion about effort or character.`;
  }
  return `The recorded games include several contribution types for ${name}. Scoring, possession, defense, goalie play, and manually entered context should be reviewed together rather than treated as one fixed player identity.`;
}

function seasonStrengthBullets(totals, player = state.player) {
  const bullets = [];
  const add = (condition, text) => {
    if (condition && bullets.length < 5) bullets.push(text);
  };
  const name = playerFirstName(player);
  add(totals.points > 0, `Recorded goals and assists identify scoring involvement across the saved games.`);
  add(totals.possessionValue > 0, `Positive recorded possession value may suggest extra chances were created or protected.`);
  add(totals.groundBalls > 0, `Ground balls are helping turn loose-ball moments into team possessions.`);
  add(totals.clears > 0, `Successful clears are helping protect the ball after pressure and turn defense into offense.`);
  add(totals.causedTurnovers + totals.defensiveStops > 0, `Defensive impact plays are helping reduce opponent pressure and create chances to reset.`);
  add(totals.saves > 0, `Saves are giving the team a chance to reset, outlet, and start the next possession.`);
  add(totals.faceoffWins > 0, `Faceoff wins are creating immediate possession chances that can become settled offense.`);
  add(totals.effortScore > 0, `Manually recorded hustle and support events add user-entered context beyond the scoreboard.`);
  add(totals.gamesPlayed === 0, "Track a game to start building a clear season story.");
  return bullets.length ? bullets.slice(0, 5) : ["Keep tracking complete games to build a more reliable evidence base."];
}

function seasonEncouragementForTotals(totals = {}, player = state.player, topContribution = topContributionForTotals(totals).label) {
  const driver = reviewDriverType(totals, topContribution, player);
  if (!totals.gamesPlayed) return "Encourage the first full-game tracking session so the season story can start to take shape.";
  if (driver === "goalie") return "Praise the reset and outlet after the save, not just the save itself.";
  if (impactPositionGroup(player) === "faceoff" && totals.faceoffAttempts > 0) return "Praise the compete-through-the-ball moments that turn faceoff reps into team possessions.";
  if (driver === "possession") return "Praise the ground balls, clears, and possession plays that help the team gain control.";
  if (driver === "scoring" && totals.assists) return "Point out the smart decisions and feeds before praising only goals.";
  if (driver === "scoring") return "Celebrate the scoring involvement, then reinforce spacing, shot quality, and support play.";
  if (driver === "defense") return "Praise the pressure and positioning that turn stops into clears.";
  if (driver === "effort") return "Celebrate the effort plays that keep the player involved beyond the scoreboard.";
  return "Encourage the plays that show effort, awareness, and growth beyond the stat sheet.";
}

function nextLevelFocusForSeason(totals) {
  if (!totals.gamesPlayed) return "Track one full game to build a stronger season picture.";
  if (totals.turnovers + totals.failedClears > totals.groundBalls + totals.clears) return "Win the ball, then make the first clean pass before pressure arrives.";
  if (totals.shots > 0 && totals.shotOnGoalPct < 0.5) return "Look for higher-quality shots instead of rushing the first available look.";
  if (totals.groundBalls >= Math.max(2, totals.gamesPlayed)) return "Turn ground balls into clean possessions and quick support passes.";
  if (totals.causedTurnovers + totals.defensiveStops >= Math.max(2, totals.gamesPlayed)) return "Stay composed after the stop and help start the clear.";
  if (totals.saves > 0) return "Find the outlet after saves and help the defense reset quickly.";
  if (totals.faceoffAttempts > 0) return "Turn faceoff wins into controlled offensive chances.";
  if (totals.effortScore > 0) return "Keep turning effort plays into controlled possessions.";
  return "Choose one recorded behavior to watch next game, such as a ground ball, clear, support play, or shot decision.";
}

function renderReviewSummarySection(game, player, totals) {
  const topContribution = topContributionForTotals(totals);
  const showPossession = Number(totals.possessionValue || 0) !== 0 || Number(totals.extraPossessions || 0) !== 0 || topContribution.label === "Possession";
  const activityLabel = totals.points > 0 ? "Points" : "Events";
  const activityValue = totals.points > 0 ? totals.points : totals.eventCount;
  const activityHelper = totals.points > 0 ? `${totals.goals}G ${totals.assists}A` : "tracked plays";
  const context = gameContextSummary(game, totals);
  const snapshotCards = [
    insightCard("Recorded Events", escapeHTML(String(totals.eventCount)), "Tracked plays", { className: "snapshot-card" }),
    insightCard("Top Contribution", escapeHTML(topContribution.display), topContribution.label, { className: "snapshot-card" }),
    showPossession
      ? insightCard("Possession", escapeHTML(signedMetric(totals.possessionValue)), `${signedMetric(totals.extraPossessions)} extra ${Math.abs(Number(totals.extraPossessions || 0)) === 1 ? "chance" : "chances"}`, { className: "snapshot-card" })
      : "",
    activityLabel === "Points" ? insightCard(activityLabel, escapeHTML(String(activityValue)), activityHelper, { className: "snapshot-card" }) : "",
    context.hasFinal
      ? insightCard("Final Score", escapeHTML(`${context.finalScoreFor}-${context.finalScoreAgainst}`), "final", { className: "snapshot-card" })
      : "",
    insightCard("LaxHornet Impact", renderImpactScore(totals.impact), "Selected recorded events", { className: "snapshot-card impact-snapshot-card" }),
  ].filter(Boolean);
  return `
    <section class="review-section review-snapshot-section lh-review-snapshot">
      <div class="section-head compact-head">
        <div>
          <h3>Game Snapshot</h3>
        </div>
      </div>
      <div class="insight-grid review-snapshot-grid">
        ${snapshotCards.join("")}
      </div>
      <div class="impact-limitations snapshot-impact-limitations" role="note">
        <p>${escapeHTML(GAME_IMPACT_LIMITATION)}</p>
        <p>${escapeHTML(GAME_IMPACT_EVIDENCE_LIMIT)}</p>
      </div>
    </section>
  `;
}

function renderGameStorySection(intelligence = null) {
  if (!intelligence) return "";
  const showHighlights = intelligence.gameStoryType !== "Team Win, Individual Growth" && intelligence.contextHighlights?.length;
  return `
    <section class="card pad development-card lh-game-story-card">
      <div class="section-head compact-head">
        <div>
          <h3>Game Story</h3>
        </div>
      </div>
      <span class="evidence-layer-label">What this may suggest</span>
      <strong>${escapeHTML(intelligence.gameStoryTitle)}</strong>
      <p>Based on the recorded events, ${escapeHTML(intelligence.gameStoryText)}</p>
      ${
        showHighlights
          ? `<div class="context-highlight-list">
              ${intelligence.contextHighlights.slice(0, 2).map((item) => `
                <div class="context-highlight">
                  <span>${escapeHTML(item.label)}</span>
                  <p>${escapeHTML(item.text)}</p>
                </div>
              `).join("")}
            </div>`
          : ""
      }
    </section>
  `;
}

function renderGameContextCard(game, totals) {
  const context = gameContextSummary(game, totals);
  const rows = [];
  if (context.hasFinal) rows.push(["Final Score", `Us ${context.finalScoreFor} · Them ${context.finalScoreAgainst}`]);
  if (context.strongestStretch && context.strongestStretch !== "unknown") rows.push(["Strongest stretch", gameSegmentLabel(context.strongestStretch)]);
  if (context.closePossessionPlays > 0) rows.push(["Close-game impact", `${context.closePossessionPlays} possession ${context.closePossessionPlays === 1 ? "play" : "plays"} while tied or within 2 goals`]);
  if (!rows.length) return "";
  return `
    <div class="lh-context-card" aria-label="Game context">
      <strong>Game Context</strong>
      <div>
        ${rows
          .map(
            ([label, value]) => `
              <p class="lh-game-context-row">
                <span>${escapeHTML(label)}</span>
                <b>${escapeHTML(value)}</b>
              </p>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderReviewStatsSection(totals, events = [], postGameIntelligence = null) {
  return `
    <section class="review-section review-full-breakdown">
      <details class="review-details-card lh-breakdown-card">
        <summary>
          <span class="review-details-summary-copy">
            <span>Full Game Impact Breakdown</span>
            <small>View scoring, possession, defense, goalie, and effort scores.</small>
          </span>
        </summary>
        <div class="review-details-stack">
          ${renderImpactBreakdown(totals, { embedded: true })}
          ${renderWhyThesePlaysMatter(events, {
            limit: 2,
            showMore: true,
            title: "Why These Plays Matter",
            helper: "2 key explanations from this game",
            showMoreLabel: "Show More",
            items: postGameIntelligence?.whyThesePlaysMatter,
            className: "review-embedded-why-card",
          })}
          <div class="explainer-card review-explainer-card">
            <strong>About LaxHornet Game Impact</strong>
            <p>${escapeHTML(GAME_IMPACT_LIMITATION)}</p>
            <p>${escapeHTML(GAME_IMPACT_EVIDENCE_LIMIT)}</p>
          </div>
          ${renderTotalsTable(totals, { embedded: true })}
        </div>
      </details>
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
        <h3>No games tracked yet</h3>
        <p class="muted small">Start your first game to build a timeline, stats, Game Impact, and season dashboard.</p>
        <button class="btn positive" type="button" data-nav="start">Start New Game</button>
      </section>
    `);
  }

  const player = gamePlayerSnapshot(game);
  const totals = calculateTotals(game.events, player);
  const topContribution = topContributionForTotals(totals);
  const seasonContext = calculateSeasonTotalsForPlayer(player);
  const postGameIntelligence = buildPostGameIntelligence(game, game.events || [], player, totals, seasonContext);
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
  const opponent = String(game.opponent || "").trim();
  return renderShell(`
    <section class="screen-title lh-review-header">
      <h2>Game Review</h2>
      <p>${escapeHTML(playerTitle(player))}${opponent ? ` vs ${escapeHTML(opponent)}` : ""} &middot; ${formatDate(game.date)}</p>
    </section>

    <section class="stack review-screen-stack lh-review-page">
      ${renderReviewSummarySection(game, player, totals)}
      ${renderGameStorySection(postGameIntelligence)}
      ${renderDevelopmentTakeaway(totals, player, topContribution.label, game, postGameIntelligence)}
      ${renderFamilyRecapSection(game, player, totals, postGameIntelligence)}
      ${renderConversationStarters(totals, player, game, postGameIntelligence)}
      ${renderReviewStatsSection(totals, game.events || [], postGameIntelligence)}
      <section class="review-section lh-timeline-section">
        <div class="card pad">
          <h3>Timeline &amp; Edits</h3>
          <p class="muted small">Review each tracked play, add notes or tags, and make corrections if needed.</p>
          <p class="safety-note">Avoid private, medical, or sensitive information. Notes and process tags stay in private reviews and account exports; they do not appear in Live Share.</p>
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
      ${canEditCurrentGame ? `
        <section class="review-section">
          <div class="card pad edit-tools-card">
            <h3>Edit Tools</h3>
            <p class="safety-note">Changes update this game&apos;s totals, Game Impact, possession metrics, tags, and season dashboard.</p>
            ${
              canShowAddEvent || canShowGameEdit
                ? `<div class="review-tool-actions">
                    ${canShowAddEvent ? `<button class="btn neutral" type="button" data-action="add-review-event">Add Event</button>` : ""}
                    ${canShowGameEdit ? `<button class="btn secondary" type="button" data-action="edit-game-details">Edit Game Details</button>` : ""}
                  </div>`
                : ""
            }
          </div>
          ${state.addingReviewEvent && canEditCurrentGame ? renderEventAddForm(game) : ""}
          ${state.editingGameDetails && canEditCurrentGame ? renderGameEditForm(game) : ""}
          ${editingEvent && canEditCurrentGame ? renderEventEditForm(game, editingEvent) : ""}
          ${tagEditingEvent && canEditCurrentGame ? renderTagEditor(game, tagEditingEvent) : ""}
        </section>
      ` : ""}
    </section>
  `);
}

function renderSharedGame() {
  const code = escapeHTML(state.sharedCode || "");
  if (!state.sharedGame) {
    const disclosureUnavailable = !SECURE_DISCLOSURE_RUNTIME_READY;
    const liveShareUnavailable = /unavailable|paused/i.test(state.syncStatus || "");
    const helper = disclosureUnavailable || liveShareUnavailable
      ? "Secure Live Share is temporarily unavailable. Game tracking and saved reviews are not affected."
      : code
        ? `Loading read-only share code ${code}...`
        : "Enter a share code from the Parent Tracker phone to open a read-only game.";
    return renderShell(`
      <section class="screen-title">
        <h2>Shared Game</h2>
        <p>${helper}</p>
      </section>
      <form class="card pad form-grid" data-form="watch-share">
        <div class="field">
          <label for="sharedScreenCode">Share code</label>
          <input id="sharedScreenCode" name="shareCode" value="${code}" placeholder="ABC123" autocapitalize="characters" />
        </div>
        <button class="btn neutral" type="submit" ${disclosureUnavailable ? "disabled" : ""}>Watch Live</button>
      </form>
    `);
  }

  const game = state.sharedGame;
  const totals = calculateTotals(game.events, gamePlayerSnapshot(game));
  const events = [...game.events].reverse();

  return renderShell(`
    <section class="screen-title">
      <h2>${escapeHTML(game.opponent)}</h2>
      <p>Shared live game - ${formatDate(game.date)} - Read-only live updates</p>
    </section>

    <section class="stack">
      <div class="metric-grid">
        <div class="metric"><strong>${totals.eventCount}</strong><span>Recorded Events</span></div>
        <div class="metric"><strong>${totals.points}</strong><span>Points</span></div>
        <div class="metric"><strong>${totals.goals}</strong><span>Goals</span></div>
        <div class="metric"><strong>${totals.assists}</strong><span>Assists</span></div>
      </div>
      ${renderTotalsTable(totals)}
      <div class="card pad">
        <h3>Live Timeline</h3>
        ${
          events.length
            ? `<div class="event-list">${events.map((event) => renderEventRow(event, { publicOnlyTags: true })).join("")}</div>`
            : `<p class="muted small">No events logged yet.</p>`
        }
      </div>
    </section>
  `);
}

function renderTotalsTable(totals, options = {}) {
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
    <div class="${options.embedded ? "table-card table-card-embedded" : "card table-card"}">
      <div class="stat-table-scroll">
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
    </div>
  `;
}

function renderImpactBreakdown(totals, options = {}) {
  const impact = totals.gameImpact || calculateGameImpact([]);
  const profile = impact.weightProfile || IMPACT_POSITION_WEIGHTS.midfield;
  const WrapperTag = options.embedded ? "div" : "section";
  const wrapperClass = options.embedded ? "impact-card impact-card-embedded" : "card pad impact-card";
  return `
    <${WrapperTag} class="${wrapperClass}">
      <div class="section-head compact-head">
        <div>
          <h3>LaxHornet Game Impact Inputs</h3>
          <p class="muted small">Recorded contribution categories weighted for ${escapeHTML(profile.label || "this position")} context.</p>
        </div>
        <span class="impact-score-badge">${renderImpactScore(impact.score)}</span>
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
      <div class="impact-limitations" role="note">
        <p>${escapeHTML(GAME_IMPACT_LIMITATION)}</p>
        <p>${escapeHTML(GAME_IMPACT_EVIDENCE_LIMIT)}</p>
      </div>
      <p class="muted small">Recorded event value: ${formatImpactNumber(impact.raw)}. Position-weighted event value: ${formatImpactNumber(impact.weightedRaw)}. The Season page averages these bounded 0-100 LaxHornet summaries.</p>
    </${WrapperTag}>
  `;
}

function renderPossessionImpact(totals) {
  const possession = totals.possessionImpact || calculatePossessionImpact([]);
  return `
    <section class="card pad possession-impact-card">
      <div class="section-head compact-head">
        <div>
          <h3>Possession Impact</h3>
          <p class="muted small">Possession Impact shows how the player helped create extra chances, protect the ball, or prevent opponent chances. Ground balls, caused turnovers, saves, clears, turnovers, and failed clears all affect this view.</p>
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
                <p class="muted small">Start your first game to build a timeline, stats, Game Impact, and season dashboard.</p>
                <button class="mini-btn" type="button" data-nav="start">Start New Game</button>
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
                <p class="muted small">Choose a purpose before downloading. CSV is a scoped data export; Full Backup is a sensitive private recovery file.</p>
                <div class="export-actions">
                  <button class="btn neutral" type="button" data-action="open-csv-export">Export Selected CSV</button>
                  <button class="btn neutral" type="button" data-action="open-full-backup">Create Private Backup</button>
                  <label class="btn secondary import-label" for="jsonImport">Restore Private Backup</label>
                  <input class="import-input" id="jsonImport" type="file" accept="application/json,.json" data-import-json />
                </div>
                <p class="field-help">Live Share, recap sharing, CSV data export, and private backup are separate output modes with different contents.</p>
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
  return `
    <div class="list-row">
      <button class="brand" type="button" data-review="${game.id}" style="color: var(--text); text-align: left;">
        <span>
          <h3>${escapeHTML(game.opponent)}</h3>
          <p>${escapeHTML(playerContextLine(player))} - ${formatDate(game.date)} - ${totals.eventCount} recorded events - Possession Value ${signedMetric(totals.possessionValue)}</p>
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

function renderOnboardingIntentPicker(selected = "child") {
  const activeIntent = normalizeOnboardingIntent(selected);
  return `
    <section class="onboarding-intent-block">
      <div>
        <h3>How will you use LaxHornet?</h3>
        <p class="muted small">You can switch later if your role changes.</p>
      </div>
      <div class="intent-options" role="radiogroup" aria-label="How will you use LaxHornet?">
        ${Object.entries(ONBOARDING_INTENTS).map(
          ([value, option]) => `
            <label class="intent-option">
              <input type="radio" name="onboardingIntent" value="${escapeHTML(value)}" ${activeIntent === value ? "checked" : ""} />
              <span>
                <strong>${escapeHTML(option.label)}</strong>
                <small>${escapeHTML(option.description)}</small>
              </span>
            </label>
          `,
        ).join("")}
      </div>
    </section>
  `;
}

function dashboardHeadlineMetrics(totals, player = state.player) {
  const position = String(player.position || "").toLowerCase();
  const metrics = [
    [totals.gamesPlayed, "Games Played"],
    [totals.averageImpact.toFixed(1), "Avg LaxHornet Impact"],
    [signedMetric(totals.possessionValue), "Possession Value"],
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
  const seasonGames = visibleGames();
  const totals = calculateSeasonTotals();
  const seasonIntelligence = buildSeasonIntelligence(seasonGames, totals, state.player);
  const strengths = seasonIntelligence.strengths;
  const seasonStory = seasonIntelligence.story;
  const encouragement = seasonIntelligence.encouragement;
  const nextFocus = seasonIntelligence.nextFocus;
  const seasonEvents = seasonGames.flatMap((game) => game.events || []);
  return renderShell(`
    <section class="screen-title">
      <h2>Season Snapshot</h2>
      <p>Totals for ${escapeHTML(playerContextLine(state.player))}.</p>
    </section>

    <section class="stack lh-season-review">
      ${renderCompactPlayerContext({
        title: "Season For",
        helper: "Switch players to see another season dashboard.",
      })}
      <div class="insight-grid">
        ${insightCard("Games Tracked", escapeHTML(String(totals.gamesPlayed)), "Saved games")}
        ${insightCard("Total Points", escapeHTML(String(totals.points)), `${totals.goals}G ${totals.assists}A`)}
        ${insightCard("Possession Impact", escapeHTML(signedMetric(totals.possessionValue)), `${signedMetric(totals.extraPossessions)} extra chances`)}
        ${insightCard("Average LaxHornet Impact", renderImpactScore(totals.averageImpact, { label: "average" }), "Selected recorded events")}
      </div>
      <div class="impact-limitations season-impact-limitations" role="note">
        <p>${escapeHTML(GAME_IMPACT_LIMITATION)}</p>
        <p>${escapeHTML(GAME_IMPACT_EVIDENCE_LIMIT)}</p>
      </div>
      <section class="card pad development-card lh-season-story-card">
        <h3>Season Story</h3>
        <span class="evidence-layer-label">What this may suggest</span>
        <p>${escapeHTML(seasonStory)}</p>
        ${
          seasonIntelligence.signals.length
            ? `<div class="context-highlight-list season-signal-list">
                ${seasonIntelligence.signals.map((item) => `
                  <div class="context-highlight">
                    <span>${escapeHTML(item.label)}</span>
                    <p>${escapeHTML(item.text)}</p>
                  </div>
                `).join("")}
              </div>`
            : ""
        }
        <p class="muted small">Season Snapshot highlights patterns across scoring, possession, defense, goalie play, hustle, and decision-making. Position matters, so players are not evaluated the same way across every role.</p>
      </section>
      <section class="card pad development-card lh-season-strengths-card">
        <h3>Recorded Season Evidence</h3>
        <ul class="insight-list">
          ${strengths.map((item) => `<li>${escapeHTML(item)}</li>`).join("")}
        </ul>
      </section>
      <section class="card pad development-card lh-season-encourage-card">
        <h3>What to Encourage</h3>
        <p>${escapeHTML(encouragement)}</p>
      </section>
      <section class="card pad development-card lh-season-focus-card">
        <h3>Possible Next Focus</h3>
        <p>${escapeHTML(nextFocus)}</p>
      </section>
      ${renderWhyThesePlaysMatter(seasonEvents, {
        title: "Why These Season Plays Matter",
        helper: "A few parent-friendly meanings behind this player's most common tracked plays.",
        limit: 5,
        showMore: true,
        showMoreLabel: "Show more season stat explanations",
        emptyCopy: "Track games to see simple explanations of the plays shaping this player's season.",
        items: seasonIntelligence.whyItems,
      })}
      <section class="review-section lh-season-stats-section">
        <div class="section-head compact-head">
          <div>
            <h3>Full Season Stats</h3>
            <p class="muted small">Use the full stat view for details. The season story above highlights the patterns that matter most.</p>
          </div>
        </div>
        ${renderSeasonTotalsGroups(totals)}
      </section>
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
        <h3>Sharing, Export, and Backup</h3>
        <p class="muted small"><strong>Live Share</strong> is a read-only game view. <strong>Share Recap</strong> is a short summary you preview before copying. <strong>CSV</strong> exports one selected scope and keeps notes and tags off unless you include them. <strong>Private Full Backup</strong> is a sensitive recovery file and requires confirmation.</p>
        <p class="muted small">A more restrictive Live Share path has passed isolated staging and managed preview verification, but it is not active in production yet. Until a deliberate production cutover is approved, avoid sensitive or private information in notes or tags for games you intend to share.</p>
        <p class="muted small">Restoring a backup adds eligible saved games without changing team access, roster authority, account ownership, or Live Share.</p>
      </div>
      <div class="card pad">
        <h3>Game Impact</h3>
        <p class="muted small">${escapeHTML(GAME_IMPACT_LIMITATION)}</p>
        <p class="muted small">It uses five recorded contribution categories: scoring, possession, defense, goalie play, and manually recorded effort/support events. Position weighting changes how those categories contribute for lacrosse context.</p>
        <p class="muted small">${escapeHTML(GAME_IMPACT_EVIDENCE_LIMIT)}</p>
      </div>

      <div class="card pad">
        <h3>Average Impact</h3>
        <p class="muted small">Average LaxHornet Impact appears on the Season page. It averages the player&apos;s bounded numeric Game Impact summaries across saved games. It is not a ranking or player comparison.</p>
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

      ${renderStatEducationHelp()}

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

function renderApprovedPlayerCallout() {
  const player = state.player;
  if (!isTeamPlayer(player) || !canTrackPlayer(player) || visibleGamesForPlayer(player).length) return "";
  const teamName = player.team || teamById(player.teamId)?.name || "your team";
  return `
    <section class="card pad approved-player-card">
      <span class="demo-label">Approved</span>
      <h3>You&apos;re approved for ${escapeHTML(player.name)}${player.number ? ` #${escapeHTML(player.number)}` : ""} on ${escapeHTML(teamName)}.</h3>
      <p class="muted small">You can now track games, review stats, and follow season progress for this player.</p>
      <div class="action-grid compact">
        <button class="btn positive" type="button" data-nav="start">Track First Game</button>
        <button class="btn secondary" type="button" data-action="install-app">Add LaxHornet to Home Screen</button>
      </div>
    </section>
  `;
}

function accountSyncHelperText(label = displaySyncStatus()) {
  if (label === "Synced to your account") return "Your latest game data is saved to your account.";
  if (label === "Will sync when online") return "Events are saved on this device and will sync when your connection returns.";
  if (label === "Saved on this phone") return "We&apos;ll sync this game when your connection returns.";
  if (label === "Sync needs attention") return "Use Sync or Updates to refresh games, teams, and player access.";
  return "";
}

function renderAccountAppHelper() {
  const label = displaySyncStatus();
  const helper = accountSyncHelperText(label);
  return `
    <div class="more-helper-text" aria-label="Account and app details">
      <p><strong>Sync:</strong> ${escapeHTML(label)}${helper ? ` - ${helper}` : ""}</p>
      <p><strong>Version:</strong> ${escapeHTML(APP_VERSION)}</p>
      ${state.cloudError ? `<p class="warning"><strong>Last sync issue:</strong> ${escapeHTML(state.cloudError)}</p>` : ""}
    </div>
  `;
}

const DEMO_PLAYER = normalizePlayer({
  id: "demo-player-12",
  rosterPlayerId: "demo-roster-player-12",
  teamId: "demo-team",
  name: "Demo Player",
  number: "12",
  team: "Branford Demo Hornets",
  position: "Midfield",
});

function demoGame() {
  return normalizeGame(
    {
      id: "demo-game-sample",
      playerId: DEMO_PLAYER.id,
      teamId: DEMO_PLAYER.teamId,
      rosterPlayerId: DEMO_PLAYER.rosterPlayerId,
      playerSnapshot: DEMO_PLAYER,
      opponent: "Sample Game",
      date: todayISO(),
      gameType: "Demo",
      periodFormat: "quarters",
      currentQuarter: "Q2",
      shareCode: "DEMO12",
      status: "complete",
      createdAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      events: [
        { id: "demo-event-1", statType: "groundBall", quarter: "Q1", timestamp: "2026-06-25T14:02:00.000Z", tags: ["Contested"], note: "Sample possession win" },
        { id: "demo-event-2", statType: "causedTurnover", quarter: "Q1", timestamp: "2026-06-25T14:06:00.000Z", tags: ["Good footwork"] },
        { id: "demo-event-3", statType: "successfulClear", quarter: "Q1", timestamp: "2026-06-25T14:08:00.000Z", tags: ["Outlet"] },
        { id: "demo-event-4", statType: "assist", quarter: "Q2", timestamp: "2026-06-25T14:18:00.000Z", tags: ["Right hand"] },
        { id: "demo-event-5", statType: "shotOnGoal", quarter: "Q2", timestamp: "2026-06-25T14:21:00.000Z", tags: ["On the run"] },
        { id: "demo-event-6", statType: "goal", quarter: "Q2", timestamp: "2026-06-25T14:25:00.000Z", tags: ["Inside finish"] },
        { id: "demo-event-7", statType: "backedUpShot", quarter: "Q3", timestamp: "2026-06-25T14:37:00.000Z", tags: ["Endline", "Saved possession"] },
        { id: "demo-event-8", statType: "hustlePlay", quarter: "Q3", timestamp: "2026-06-25T14:41:00.000Z", tags: ["Ride effort"] },
      ],
    },
    DEMO_PLAYER,
  );
}

function renderDemoPage() {
  const game = demoGame();
  const totals = calculateTotals(game.events, DEMO_PLAYER);
  const seasonTotals = calculateSeasonTotalsFromGames([game]);
  const headlineMetrics = dashboardHeadlineMetrics(seasonTotals, DEMO_PLAYER).slice(0, 6);
  const demoTopContribution = topContributionForTotals(totals).label;
  return renderShell(`
    <section class="screen-title">
      <h2>Demo Game</h2>
      <p>Sample data only. Nothing here saves to your account or changes real team/player access.</p>
    </section>

    <section class="stack demo-screen">
      <section class="card pad demo-context-card">
        <span class="demo-label">Demo / Sample</span>
        <h3>Demo Player #12</h3>
        <p class="muted small">Branford Demo Hornets - Sample Game</p>
        <div class="action-grid compact">
          <button class="btn positive" type="button" data-nav="home">${state.authUser ? "Back to My Account" : "Create or Log In"}</button>
          <button class="btn secondary" type="button" data-nav="tutorial">Open Tracker Guide</button>
        </div>
      </section>

      <section class="card pad">
        <div class="section-head compact-head">
          <div>
            <h3>Sample Live Tracker</h3>
            <p class="muted small">These buttons are display-only in demo mode.</p>
          </div>
        </div>
        <div class="period-tabs demo-period-tabs" role="group" aria-label="Sample period selector">
          <button class="period-tab active" type="button">Q1</button>
          <button class="period-tab" type="button">Q2</button>
          <button class="period-tab" type="button">Q3</button>
          <button class="period-tab" type="button">Q4</button>
        </div>
        <section class="live-summary" aria-label="Sample live summary">
          <div class="live-pill"><strong>${signedMetric(totals.possessionValue)}</strong><span>Possession Value</span></div>
          <div class="live-pill"><strong>${totals.points}</strong><span>Points</span></div>
          <div class="live-pill"><strong>${totals.eventCount}</strong><span>Events</span></div>
        </section>
        ${renderLiveStatGroups({ demo: true, interactive: false })}
      </section>

      <section class="card pad">
        <h3>Sample Completed Game Review</h3>
        <div class="metric-grid compact-demo-grid">
          <div class="metric">${renderImpactScore(totals.impact)}<span>LaxHornet Impact</span></div>
          <div class="metric"><strong>${totals.points}</strong><span>Points</span></div>
          <div class="metric"><strong>${statWithExtraPossessions(totals.groundBalls, totals.possessionImpact.eventsByType.groundBall || 0)}</strong><span>Ground Balls</span></div>
          <div class="metric"><strong>${signedMetric(totals.possessionValue)}</strong><span>Possession Value</span></div>
        </div>
        <div class="impact-limitations" role="note">
          <p>${escapeHTML(GAME_IMPACT_LIMITATION)}</p>
          <p>${escapeHTML(GAME_IMPACT_EVIDENCE_LIMIT)}</p>
        </div>
        <div class="event-list">${game.events.slice(-5).reverse().map(renderEventRow).join("")}</div>
      </section>

      ${renderDevelopmentTakeaway(totals, DEMO_PLAYER, demoTopContribution)}
      ${renderWhyThesePlaysMatter(game.events, {
        title: "Why these demo plays matter",
        helper: "Sample explanations that help parents connect plays to development.",
      })}
      ${renderConversationStarters(totals, DEMO_PLAYER)}

      <section class="card pad">
        <h3>Sample Season Dashboard Preview</h3>
        <div class="metric-grid compact-demo-grid">
          ${headlineMetrics.map(([value, label]) => metricTile(value, label)).join("")}
        </div>
        <div class="impact-limitations" role="note">
          <p>${escapeHTML(GAME_IMPACT_LIMITATION)}</p>
          <p>${escapeHTML(GAME_IMPACT_EVIDENCE_LIMIT)}</p>
        </div>
      </section>

      <section class="card pad">
        <h3>Sample Live Share</h3>
        <p class="muted small">During a real game, Live Share gives family a read-only link so they can follow updates from another iPhone, phone, tablet, or computer.</p>
        <p class="share-code">DEMO12</p>
      </section>
    </section>
  `, { hideNav: !state.authUser });
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

  const promoTotals = calculateTotals(PROMO_DEMO_STEPS.map((step, index) => normalizeEvent({
    id: `promo-${index}`,
    statType: step.stat,
  })));
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
            <div class="live-pill"><strong>${PROMO_DEMO_STEPS.length}</strong><span>Recorded Events</span></div>
            <div class="live-pill"><strong>${lacrossePoints}</strong><span>Points</span></div>
            <div class="live-pill"><strong>${signedMetric(promoTotals.possessionValue)}</strong><span>Possession Value</span></div>
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
  `, { hideNav: true, hideStatus: true });
}

function renderRequestSubmitted() {
  const summary = state.accessRequestSummary || {};
  const fullName = [summary.firstName, summary.lastName].filter(Boolean).join(" ");
  return renderShell(`
    <section class="screen-title">
      <h2>Request sent. Your team admin needs to approve access.</h2>
      <p>Check your email for the LaxHornet verification link. Once your email is verified and your team admin approves access, this player&apos;s tracker will open automatically after sign-in.</p>
    </section>

    <section class="stack">
      <div class="card pad account-success-card">
        <h3>What Happens Next</h3>
        <p class="muted small">A team admin will review your team code and player jersey number. Once approved, this account will only show the rostered player matching that request.</p>
        <div class="welcome-step-list compact-steps">
          <div><strong>1</strong><span>Confirm your email from the LaxHornet message.</span></div>
          <div><strong>2</strong><span>Your team admin approves the player request.</span></div>
          <div><strong>3</strong><span>Sign in and start tracking the verified player.</span></div>
        </div>
        <div class="request-summary">
          ${summary.email ? `<div><span>Email</span><strong>${escapeHTML(summary.email)}</strong></div>` : ""}
          ${fullName ? `<div><span>Name</span><strong>${escapeHTML(fullName)}</strong></div>` : ""}
          ${summary.teamAccessCode ? `<div><span>Team code</span><strong>${escapeHTML(summary.teamAccessCode)}</strong></div>` : ""}
          ${summary.childJerseyNumber ? `<div><span>Jersey #</span><strong>${escapeHTML(summary.childJerseyNumber)}</strong></div>` : ""}
        </div>
        <p class="muted small">While you wait, you can explore a sample game or read the quick tracker guide.</p>
        <div class="account-actions">
          <button class="btn positive" type="button" data-nav="demo">View Demo Game</button>
          <button class="btn secondary" type="button" data-nav="tutorial">Open Tracker Guide</button>
          <button class="btn neutral" type="button" data-nav="home">Check Approval Status</button>
        </div>
      </div>
    </section>
  `, { hideNav: true, hideStatus: true });
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
        <p class="muted small">After a game, open Game Review to edit events, correct notes, add tags, and review recorded stats, possession metrics, and the bounded LaxHornet Game Impact summary. Season Dashboard shows recorded totals and an average numeric summary across saved games. Past Games follows the active player, so switch players when you want another player&apos;s totals.</p>
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
  const publicScreens = ["home", "tutorial", "help", "shared", "authSuccess", "requestSubmitted", "demo"];
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
  if (state.authUser && isPlatformReviewer() && !["adminPortal", "team", "launchKit", "promoDemo", "profileSetup", "help", "tutorial", "shared", "authSuccess"].includes(state.screen)) {
    state.screen = "adminPortal";
  }
  if (state.authUser) recoverAdminTeamContext();
  const screens = {
    home: renderHome,
    authSuccess: renderAuthSuccess,
    requestSubmitted: renderRequestSubmitted,
    profileSetup: renderProfileSetup,
    adminPortal: renderAdminPortal,
    more: renderMore,
    player: renderPlayerPage,
    team: renderTeamPage,
    teamAccess: renderTeamAccess,
    launchKit: renderLaunchKitPage,
    promoDemo: renderPromoDemoPage,
    demo: renderDemoPage,
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
    state.trackingSession = {
      gameId: state.activeGame.id,
      origin: "new",
      previousScreen: ["home", "player", "more"].includes(state.gameSetupReturnScreen)
        ? state.gameSetupReturnScreen
        : "home",
      startedAt: new Date().toISOString(),
      initialGameSnapshot: null,
    };
    markFocusUsedForGame(state.activeGame);
    state.reviewGameId = state.activeGame.id;
    if (state.activeGame.isShared) state.liveSharePromptGameId = state.activeGame.id;
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
    const eventQuarter = formData.get("quarter") || periodsForGame(game)[0];
    createGameEventOperation(game, () => {
      const scoreChange = applyScoreIncrementForStat(game, stat.key);
      const scoreContext = scoreContextForGame(game, eventQuarter);
      const newEvent = {
        id: uid("event"),
        gameId: game.id,
        userId: game.userId || currentUserId() || "",
        teamId: gameTeamId(game),
        rosterPlayerId: gameRosterPlayerId(game),
        timestamp: new Date().toISOString(),
        quarter: eventQuarter,
        statType: stat.key,
        statLabel: stat.label,
        category: stat.category,
        pointValue: stat.points,
        tags: [],
        note: formData.get("note")?.trim() || "",
        fieldZone: formData.get("fieldZone") || "",
        correctedAt: new Date().toISOString(),
        ...scoreContext,
        scoreAutoIncrement: scoreChange.side,
        scoreForBeforeEvent: scoreChange.beforeFor,
        scoreAgainstBeforeEvent: scoreChange.beforeAgainst,
      };
      const updatedGame = normalizeGame({
        ...game,
        events: [...game.events, newEvent],
        savedAt: new Date().toISOString(),
      });
      state.addingReviewEvent = false;
      state.editingEventId = null;
      state.tagEditingEventId = null;
      upsertGame(updatedGame);
      if (state.activeGame?.id === updatedGame.id) state.activeGame = updatedGame;
      return { game: updatedGame, event: newEvent };
    });
    render();
    showToast("Event added");
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

    correctGameEventOperation(game, () => {
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
        fieldZone: formData.get("fieldZone") || "",
        correctedAt: new Date().toISOString(),
      };
      const updatedGame = normalizeGame({
        ...game,
        events: updatedEvents,
        savedAt: new Date().toISOString(),
      });
      state.editingEventId = null;
      upsertGame(updatedGame);
      if (state.activeGame?.id === updatedGame.id) state.activeGame = updatedGame;
      return { game: updatedGame, event: updatedEvents[eventIndex] };
    });
    render();
    showToast("Event corrected");
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
      state.nextGameFocus = activeNextGameFocusForPlayer(state.player);
      persistAll();
      navigate(targetScreen);
    }
    return;
  }

  const nav = event.target.closest("[data-nav]");
  if (nav) {
    if (nav.dataset.nav === "start") state.gameSetupReturnScreen = state.screen;
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
    state.nextGameFocus = activeNextGameFocusForPlayer(state.player);
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
    if (action.dataset.action === "score-goal-for") updateActiveGameScore("for");
    if (action.dataset.action === "score-goal-against") updateActiveGameScore("against");
    if (action.dataset.action === "edit-score") editActiveGameScore();
    if (action.dataset.action === "save-game") saveActiveGame();
    if (action.dataset.action === "cancel-game") requestCancelGame();
    if (action.dataset.action === "keep-tracking") keepTrackingAfterCancelPrompt();
    if (action.dataset.action === "confirm-cancel-game") confirmCancelGame();
    if (action.dataset.action === "end-game") endGame();
    if (action.dataset.action === "cancel-end-game") {
      state.pendingEndGame = false;
      render();
    }
    if (action.dataset.action === "confirm-end-game") confirmEndGame();
    if (action.dataset.action === "open-saved-review") {
      state.reviewGameId = action.dataset.gameId;
      state.gameSavedSummaryId = "";
      navigate("review");
    }
    if (action.dataset.action === "copy-family-summary") copyFamilySummary(action.dataset.gameId);
    if (action.dataset.action === "copy-family-recap") copyGameFamilyRecap(action.dataset.gameId);
    if (action.dataset.action === "share-family-recap") shareGameFamilyRecap(action.dataset.gameId);
    if (action.dataset.action === "save-next-focus") saveNextGameFocusFromReview();
    if (action.dataset.action === "add-focus-to-recap") addFocusToFamilyRecap();
    if (action.dataset.action === "start-with-focus") {
      state.gameSetupReturnScreen = state.screen;
      navigate("start");
    }
    if (action.dataset.action === "toggle-next-focus-editor") {
      const context = action.dataset.focusContext || "";
      state.focusEditorContext = state.focusEditorContext === context ? "" : context;
      render();
    }
    if (action.dataset.action === "save-inline-next-focus") {
      saveInlineNextGameFocusFromPanel(action.closest(".inline-next-focus-editor"));
    }
    if (action.dataset.action === "cancel-inline-next-focus") {
      state.focusEditorContext = "";
      render();
    }
    if (action.dataset.action === "use-this-focus") showToast("Today's focus is ready.");
    if (action.dataset.action === "focus-followup") updateFocusFollowUp(action.dataset.result);
    if (action.dataset.action === "close-saved-game") {
      state.gameSavedSummaryId = "";
      navigate("home");
    }
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
    if (action.dataset.action === "open-csv-export") openExportDialog("csv");
    if (action.dataset.action === "open-full-backup") openExportDialog("full_backup");
    if (action.dataset.action === "cancel-export") closeExportDialog();
    if (action.dataset.action === "confirm-export") confirmExportFromDialog();
    if (action.dataset.action === "cancel-import") cancelPendingImport();
    if (action.dataset.action === "confirm-import") confirmPendingImport();
    if (action.dataset.action === "copy-share-link") copyShareLink();
    if (action.dataset.action === "confirm-copy-share-link") copyLiveShareLinkNow(action.dataset.gameId);
    if (action.dataset.action === "turn-off-live-share") turnOffLiveShare(action.dataset.gameId);
    if (action.dataset.action === "close-live-share") {
      state.liveSharePromptGameId = "";
      render();
    }
    if (action.dataset.action === "cancel-team-access-review") {
      state.pendingTeamAccessReview = null;
      render();
    }
    if (action.dataset.action === "confirm-team-access-review") confirmTeamAccessReview();
    if (action.dataset.action === "install-app") installApp();
    if (action.dataset.action === "add-note-last-event") addNoteToLastEvent();
    if (action.dataset.action === "toggle-more-plays") {
      state.morePlaysExpanded = !state.morePlaysExpanded;
      render();
    }
    if (action.dataset.action === "cancel-delete-game") {
      state.pendingDeleteGameId = "";
      render();
    }
    if (action.dataset.action === "confirm-delete-game") {
      confirmDeleteGame(action.dataset.gameId);
    }
    if (action.dataset.action === "focus-auth") {
      if (state.screen !== "home") {
        navigate("home");
        return;
      }
      document.querySelector(".account-card input")?.focus();
      document.querySelector(".account-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    if (action.dataset.action === "sign-out") signOut();
    if (action.dataset.action === "reset-device-state") resetThisDeviceState();
    if (action.dataset.action === "refresh-profile") loadUserProfile();
    if (action.dataset.action === "open-admin-portal") setAdminViewMode("admin", { screen: "adminPortal" });
    if (action.dataset.action === "open-tracker-view") setAdminViewMode("tracker", { screen: "home" });
    if (action.dataset.action === "request-admin") requestUserRole("admin");
    if (action.dataset.action === "refresh-admin-requests") loadAdminRequests();
    if (action.dataset.action === "sync-cloud-games") loadCloudGames();
    if (action.dataset.action === "check-app-update") checkForAppUpdate({ manual: true });
    if (action.dataset.action === "sync-team-roster") loadCloudTeams();
    if (action.dataset.action === "refresh-release-health") {
      fetchBackendCapabilities({ force: true }).then((capabilities) => {
        showToast(capabilities ? "Release health refreshed" : "Backend capability could not be confirmed");
        render();
      });
    }
    if (action.dataset.action === "send-verification-reminder") sendPlayerVerificationReminder(action.dataset.requestId);
    if (action.dataset.action === "copy-roster-summary") copyRosterSummary();
    if (action.dataset.action === "add-player") addPlayer();
    if (action.dataset.action === "delete-player") deleteActivePlayer();
    if (action.dataset.action === "remove-roster-player") removeRosterPlayer();
    if (action.dataset.action === "remove-claimed-player") removeClaimedRosterPlayer();
    if (action.dataset.action === "delete-team") deleteActiveTeam();
    if (action.dataset.action === "toggle-watch-share") {
      const expandedAttr = action.getAttribute("aria-expanded");
      const currentlyExpanded = expandedAttr === null ? state.watchShareExpanded : expandedAttr === "true";
      state.watchShareTouched = true;
      state.watchShareExpanded = !currentlyExpanded;
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
    beginTeamAccessReview(reviewTeamAccess.dataset.reviewTeamAccess, reviewTeamAccess.dataset.approved === "true");
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

function handleDialogKeydown(event) {
  if (!state.pendingCancelGame) return;
  const dialog = document.querySelector(".cancel-game-modal");
  if (!dialog) return;

  if (event.key === "Escape") {
    event.preventDefault();
    keepTrackingAfterCancelPrompt();
    return;
  }

  if (event.key !== "Tab") return;
  const focusable = [...dialog.querySelectorAll("button:not([disabled])")];
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function handleChange(event) {
  const input = event.target.closest("[data-import-json]");
  if (!input) return;
  prepareImportJSONFile(input.files?.[0]);
  input.value = "";
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("service-worker.js", { updateViaCache: "none" })
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
    reloadWithFreshMarker(state.availableVersion || APP_VERSION);
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

function showUpdateAvailable(worker, version = "") {
  if (version && version === APP_VERSION) {
    clearUpdateAvailableState();
    render();
    return;
  }
  waitingServiceWorker = worker;
  state.updateAvailable = true;
  state.updateInstalling = false;
  if (version) state.availableVersion = version;
  render();
}

function clearUpdateAvailableState() {
  waitingServiceWorker = null;
  state.updateAvailable = false;
  state.updateInstalling = false;
  state.availableVersion = "";
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
    const serverVersion = await fetchServerAppVersion().catch(() => "");
    const registration = serviceWorkerRegistration || (await navigator.serviceWorker.getRegistration());
    let registrationUpdateFailed = false;
    if (registration) {
      serviceWorkerRegistration = registration;
      try {
        await registration.update();
      } catch {
        registrationUpdateFailed = true;
      }
      if (registration.waiting && navigator.serviceWorker.controller) {
        if (serverVersion && serverVersion === APP_VERSION) {
          clearUpdateAvailableState();
          render();
          if (options.manual) showToast("LaxHornet is up to date");
          return;
        }
        showUpdateAvailable(registration.waiting);
        if (options.manual) showToast("Update ready");
        return;
      }
    }

    if (serverVersion && serverVersion !== APP_VERSION) {
      state.updateAvailable = true;
      state.updateInstalling = false;
      state.availableVersion = serverVersion;
      render();
      if (options.manual) showToast(`Update found: ${serverVersion}`);
      return;
    }

    if (registrationUpdateFailed && !serverVersion) {
      if (options.manual) showToast("Update check unavailable. Try again.");
      return;
    }

    clearUpdateAvailableState();
    render();
    if (options.manual) showToast("LaxHornet is up to date");
  } catch {
    if (options.manual) showToast("Could not check for updates");
  }
}

function reloadWithFreshMarker(targetVersion = "") {
  const url = new URL(window.location.href);
  url.searchParams.set("fresh", `${targetVersion || state.availableVersion || APP_VERSION}-update-${Date.now()}`);
  window.location.replace(url.toString());
}

async function clearLaxHornetCaches() {
  if (!("caches" in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.filter((key) => key.startsWith("laxhornet-")).map((key) => caches.delete(key)));
}

function clearLaxHornetBrowserStorage() {
  const supabaseProjectKey = (() => {
    try {
      return new URL(SUPABASE_CONFIG.url).hostname.split(".")[0];
    } catch {
      return "";
    }
  })();
  const shouldClearKey = (key) =>
    key.startsWith("laxhornet.") ||
    (supabaseProjectKey && key.startsWith(`sb-${supabaseProjectKey}-`)) ||
    key.startsWith("supabase.") ||
    key.includes("supabase.auth");

  [localStorage, sessionStorage].forEach((storage) => {
    Object.keys(storage)
      .filter(shouldClearKey)
      .forEach((key) => storage.removeItem(key));
  });
}

async function unregisterLaxHornetServiceWorkers() {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
}

async function applyAppUpdate() {
  state.updateAvailable = true;
  state.updateInstalling = true;
  render();

  const targetVersion = state.availableVersion || (await fetchServerAppVersion().catch(() => "")) || APP_VERSION;
  if (targetVersion === APP_VERSION) {
    clearUpdateAvailableState();
    render();
    showToast("LaxHornet is up to date");
    return;
  }

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
            reloadWithFreshMarker(targetVersion);
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
  reloadWithFreshMarker(targetVersion);
}

async function initApp() {
  if (supabaseClientLoadIssue) {
    state.cloudError = "App update needed. Tap Updates or Reset This Device if account data looks wrong.";
    state.syncStatus = "Sync needs attention";
  } else if (supabaseClient) {
    const { data } = await supabaseClient.auth.getSession();
    setAuthUser(data.session?.user || null);
    state.syncStatus = state.authUser ? "Signed in" : "Signed out";
    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
      setAuthUser(session?.user || null);
      state.syncStatus = state.authUser ? "Signed in" : "Signed out";
      await fetchBackendCapabilities({ force: true }).catch(() => null);
      if (state.authUser) {
        await loadUserProfile({ silent: true });
        await loadCloudGames({ silent: true });
      }
      if (!applyStartupDeepLink()) render();
    });
    if (state.authUser) {
      await loadUserProfile({ silent: true });
      await loadCloudGames({ silent: true });
    }
  }

  await fetchBackendCapabilities().catch(() => null);

  if (startupShareCode) {
    loadSharedGame(startupShareCode);
  } else if (startupAuthStatus === "verified") {
    state.screen = "authSuccess";
    render();
  } else if (applyStartupDeepLink()) {
    // The deep link renders after account and team data are ready.
  } else {
    render();
  }
}

document.addEventListener("submit", handleSubmit);
document.addEventListener("click", handleClick);
document.addEventListener("change", handleChange);
document.addEventListener("keydown", handleDialogKeydown);
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
window.addEventListener("online", async () => {
  state.isOffline = false;
  if (state.authUser) {
    await loadCloudGames({ silent: true });
    await eventOperationService().retryGameEventOperations();
    const hasPendingTrustSpineWork = Object.values(trustSpineState().events).some(
      (record) => record.pendingOperations.length || record.conflict || record.lastError,
    );
    state.syncStatus = hasPendingTrustSpineWork ? "Secure sharing is waiting for synchronization" : "Synced";
    showToast(hasPendingTrustSpineWork ? "Game saved; secure sharing is still synchronizing" : "Synced to your account");
    persistAll();
    render();
    return;
  }
  if (state.syncStatus === "Saved on this phone") state.syncStatus = "Synced";
  render();
});
window.addEventListener("offline", () => {
  state.isOffline = true;
  render();
});
registerServiceWorker();
initApp();
