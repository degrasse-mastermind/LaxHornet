# LH-25 atomic scored-event contract

Status: approved Level 3 implementation contract; default-off until separately
reviewed and released.

## Ownership decision

The R2-07 versioned event head is the canonical mutation owner for scored-event
creation, correction, and tombstone. The R2-07 game score group remains the
canonical scoreboard owner. `public.laxhornet_apply_scored_event_v1(jsonb)` is
the only command allowed to couple those two owners.

Trust Spine and public disclosure remain downstream projections of accepted
canonical evidence. They do not authorize the score mutation, compensate a
failed scored-event operation, or become a second event mutation authority.

Manual scoreboard corrections remain independent R2-07 score corrections.
Ordinary non-scoring event operations remain independent R2-07 event commands.

## Client request

The composite request contains:

- `client_operation_id`: permanent parent identity, at most 160 characters.
- `game_id` and `event_id`: exact mutation scope.
- `action`: `create`, `correct`, or `tombstone`.
- `changes`: the existing bounded R2-07 event values.
- `base_event_version`, `base_score_version`, and `base_status_version`.
- `expected_game_lifecycle`.
- `client_created_at`.

The server hashes the complete JSON request. The same actor and operation ID
with the same request returns the stored receipt. Reuse with a different scope
or payload is rejected and appended to the attempt journal.

The server derives the score effect from the canonical stat type:

| Stat type | Score effect |
|---|---:|
| `goal` | `score_for + 1` |
| `assist` | `score_for + 1` |
| `goalAllowed` | `score_against + 1` |
| Other | none |

Correction uses the difference between the existing server event and the
proposed server event. Tombstone reverses the existing accepted effect. A
non-scoring event cannot enter the scored-event command.

## Transaction and concurrency

The private implementation locks the permanent parent, deterministic child
operation identities, and requested game in that order. It verifies current
authority, tombstone dominance, lifecycle, and exact event/score/status bases.

It then calls the already governed R2-07 event and score RPCs inside one PL/pgSQL
subtransaction. Any rejected child or exception rolls back both child mutations
and their journals before a parent rejection receipt is stored. An accepted
parent is written only after both children and their canonical versions exist.

Completed-game correction or Undo uses the existing absolute score-correction
contract with the required correction reason. Creation on a completed game
remains rejected by the existing event contract.

## Offline and client adoption

Local event and score mutation remains synchronous and immediately durable.
The browser queues one parent composite intent. It finalizes the exact versioned
request only when it is ready to attempt the server command, allowing multiple
offline intents to consume accepted versions sequentially.

Once the capability is enabled, scored events never fall back to independent
event and score RPCs. Missing capability, authentication loss, or network error
keeps the permanent operation pending locally. Conflicts enter Needs Attention.

## Security

- The public entrypoint is granted only to `authenticated`.
- The private SECURITY DEFINER implementation sets an empty search path and
  repeats authentication and row authority checks before replay or mutation.
- Parent history and attempts are FORCE RLS, directly inaccessible to browser
  roles, and append-only.
- No service-role or private credential is used by browser code.

## Rollback and release

The rollback removes only the additive command and empty/rejected-only parent
history. It refuses when accepted or merged parent evidence exists.

No local, manual, CLI, linked-main, or production application is authorized by
this contract. Automatic application to a data-less isolated Supabase Preview
branch tied to the PR is accepted CI verification. Merge, deployment,
activation, and production migration application require separate authority.
