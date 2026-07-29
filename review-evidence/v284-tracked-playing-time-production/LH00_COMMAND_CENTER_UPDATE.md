# LH-00 Command Center — v284 production completion

Date: 2026-07-29
Status: complete

- Incident: signed-in synchronization could promote private legacy
  participation aliases into the ordinary Event Pipeline, and public Live Share
  returned every active effective event.
- Containment: public Live Share RPC execution was reversibly revoked while the
  unsafe definition was active. Aggregate inspection found zero active tokens,
  no non-synthetic affected share, and no confirmed real/youth-data exposure.
- Root cause: both ingress and egress lacked a closed semantic publication
  boundary; active lifecycle state was incorrectly sufficient for disclosure.
- Correction: PR #30, final head
  `19f3f89d1120fce167f59237e355bb7cc04394c0`, merged and deployed as
  `effca6952e647b7424f96675f390fc80d5c42368`.
- Migration: `20260728193942_v284_public_event_semantic_boundary`, applied once;
  rollback remains fail-closed and never restores the vulnerable public RPC.
- Disclosure verification: exactly two approved ordinary events remained
  public after signed-in synchronization; private aliases, unknown semantics,
  poisoned evidence, tracked time, notes/tags, and internal metadata were
  excluded from payload and DOM.
- Production: `https://laxhornet.mybranford.com`, marker/cache `v284`, exact
  hosted assets matched the approved merge SHA.
- Smoke: ordinary game entry, score, Undo, Save, End Game, Game Review,
  correction, tombstone, offline recovery, quarters/halves clocks,
  participation, recovery states, CSV, recap, neutral tokens, and anonymous
  denial gates passed.
- Cleanup: zero synthetic users, sessions, refresh tokens, active tokens,
  active grants, mutable legacy rows, active event versions, running clocks,
  active participation, pending operations, and conflicts. No real data was
  touched.
- Retained history: 24 synthetic game scopes, 88 Event Pipeline operations, 107
  participation operations, 72 grant lifecycle events, and 12 paused
  clock-state dependencies remain private, inert, revoked, and append-only.
- Known limitations: non-deployable draft PR #29 must never merge; repository
  root remains the GitHub Pages publication source; the named read-only
  production connector required OAuth renewal during closeout.
- Next product priority: implement `LH-DEV-005`, replacing repository-root
  GitHub Pages publishing with an explicitly allowlisted deployment artifact.
