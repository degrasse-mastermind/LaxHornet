// Exact R2-07 Forward Migration B production-capable runtime configuration.
// This file is a reviewed release artifact; it is not loaded by production
// until a separately authorized R2-07F deployment installs these values as
// the canonical runtime-config.js content.
window.LAXHORNET_RUNTIME_CONFIG = Object.freeze({
  ...(window.LAXHORNET_RUNTIME_CONFIG || {}),
  publicLiveShareRpc: true,
  liveShareTokenRpc: true,
  exportAuditRpc: true,
  r207bControlledPreview: true,
  r207cVersionedEventCorrections: true,
  r207dConflictResolution: true,
  r207ClockCommandBatch: true,
  r207ProductionActivation: true,
  minimumSchemaCapability: 1,
});
window.LAXHORNET_SCRIPT_ORDER = [
  ...(window.LAXHORNET_SCRIPT_ORDER || []),
  "runtime-config",
];
