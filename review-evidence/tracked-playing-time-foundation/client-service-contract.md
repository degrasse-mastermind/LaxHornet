# Companion Client Service Contract

`tracked-playing-time-service.js` is a framework-free ES module that can be injected with local storage, time, and RPC functions.

It provides:

- normalized clock creation and deterministic projection;
- start, pause, resume, period transition, and game-end helpers;
- bounded recovery classification;
- local effective-operation resolution for correction and tombstone history;
- RPC payload builders with database contract field names;
- immediate local persistence;
- queued retry with idempotent client operation IDs;
- reconciliation hooks and private effective snapshots.

The module is not referenced by `app.html`. That is intentional: this ticket proves the foundation and contracts without introducing controls or changing the current tracker. A later UI ticket must decide interaction design, wire lifecycle calls, and perform signed-in/offline browser validation.
