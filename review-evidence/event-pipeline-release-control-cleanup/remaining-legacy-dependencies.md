# Remaining Legacy Dependencies

Trust Spine is the authoritative cloud event history. The following compatibility behavior remains behind the canonical event-operation service:

1. `syncEventToCloud` mirrors private event content for existing private review and recovery flows.
2. `syncGameToCloud` preserves current cross-device saved-game and private review compatibility.
3. `deleteEventFromCloud` keeps the legacy private representation aligned after an authoritative tombstone.
4. Legacy local storage remains the immediate offline source for tracking and review.

Browser features no longer choose independently between Trust Spine and legacy event writes. Removal is deferred until private review, import/export, cross-device recovery, and old-client compatibility are proven without these representations.
