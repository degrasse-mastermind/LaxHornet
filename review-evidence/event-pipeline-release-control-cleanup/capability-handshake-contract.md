# Capability Handshake Contract

Secure operations require all four gates:

1. the runtime flag is enabled;
2. `lh_release_capabilities()` reports schema capability 1 and the required feature;
3. the signed-in user and game are eligible;
4. authoritative event reconciliation completes.

The capability response contains feature booleans only. It contains no account, team, player, game, or event data. Responses are cached for at most 60 seconds. Failure leaves local tracking and private reviews available and disables secure sharing or audited export without a legacy fallback.
