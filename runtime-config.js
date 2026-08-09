window.LAXHORNET_RUNTIME_CONFIG = Object.freeze({
  ...(window.LAXHORNET_RUNTIME_CONFIG || {}),
  publicLiveShareRpc: true,
  liveShareTokenRpc: true,
  exportAuditRpc: true,
  r207bControlledPreview: false,
  minimumSchemaCapability: 1,
});
window.LAXHORNET_SCRIPT_ORDER = [...(window.LAXHORNET_SCRIPT_ORDER || []), "runtime-config"];
