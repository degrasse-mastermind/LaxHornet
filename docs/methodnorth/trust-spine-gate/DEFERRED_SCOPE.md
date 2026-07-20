# Deferred Scope

Status: explicit quarantine list for LH-00 Trust Spine Release 1.

## Deferred roles

The following roles are out of scope:

- `club_admin`
- athlete roles
- ordinary broad `platform_admin`
- permanent support/operator access

Future support elevation, if ever needed, must be time-bound, case-bound, audited, and separate from ordinary product roles.

## Deferred user experiences

Do not implement in Release 1:

- Project One UI.
- Athlete-facing accounts.
- Athlete-visible review release.
- Club/organization administration.
- Broad coach evaluation surfaces.
- D1/college coach review language.
- PLL-player comparisons.
- Public athlete guidance.

## Deferred data systems

Do not implement in Release 1:

- Generalized polymorphic disclosure engine.
- AI interpretation persistence.
- Authoritative AI review states.
- Offline role assignment.
- Offline disclosure release.
- Offline authoritative evidence adjudication.
- Offline coach-context release.

## Deferred analytics

Do not persist as authoritative:

- AI-generated recommendations.
- Development conclusions.
- Archetype labels.
- Coach-like ratings.
- Comparison-based labels.

Current analytics may remain generated, private, and non-authoritative if they do not become public or persistent evidence.

## Deferred migration moves

Do not do in this gate:

- Production migration.
- Production RLS/grant changes.
- Full foundation one-release merge.
- Legacy direct-mutation removal without tests and staged cutover.
- Data reconstruction for unknown legacy event values.
- Deleting or overwriting event history.
