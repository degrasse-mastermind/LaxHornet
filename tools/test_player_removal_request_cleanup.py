#!/usr/bin/env python3
"""Regression checks for roster-player removal and Parent Request cleanup."""

from __future__ import annotations

import copy
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCHEMA = (ROOT / "supabase-schema.sql").read_text(encoding="utf-8")
MIGRATION = (ROOT / "supabase-player-removal-request-cleanup.sql").read_text(encoding="utf-8")
ROSTER_REPAIR = (ROOT / "supabase-create-team-repair.sql").read_text(encoding="utf-8")
REMINDER_REPAIR = (ROOT / "supabase-player-verification-reminder-update.sql").read_text(encoding="utf-8")
APP = (ROOT / "app.js").read_text(encoding="utf-8")

FAILURES: list[str] = []
PASSES = 0


def check(label: str, condition: bool) -> None:
    global PASSES
    if condition:
        PASSES += 1
        print(f"PASS: {label}")
    else:
        FAILURES.append(label)
        print(f"FAIL: {label}")


def function_body(source: str, name: str) -> str:
    pattern = re.compile(
        rf"create\s+or\s+replace\s+function\s+public\.{re.escape(name)}\b.*?"
        rf"as\s+(?P<tag>\$[a-zA-Z0-9_]*\$)(?P<body>.*?)(?P=tag)\s*;",
        re.IGNORECASE | re.DOTALL,
    )
    match = pattern.search(source)
    if not match:
        return ""
    return match.group("body")


def normalized_jersey(value: str) -> str:
    return re.sub(r"^#\s*", "", (value or "").strip().lower())


@dataclass
class FakeState:
    players: list[dict] = field(default_factory=list)
    claims: list[dict] = field(default_factory=list)
    requests: list[dict] = field(default_factory=list)
    members: list[dict] = field(default_factory=list)


def visible_requests(state: FakeState) -> list[str]:
    visible: list[str] = []
    for request in state.requests:
        active_matches = [
            player
            for player in state.players
            if player["team_id"] == request["team_id"]
            and player["active"]
            and normalized_jersey(player["number"]) == normalized_jersey(request["jersey"])
        ]
        if not active_matches:
            continue
        if request["status"] == "pending":
            visible.append(request["id"])
            continue
        if request["status"] != "approved":
            continue
        exact_claim_exists = any(
            claim["team_id"] == request["team_id"]
            and claim["user_id"] == request["user_id"]
            and any(player["id"] == claim["roster_player_id"] for player in active_matches)
            for claim in state.claims
        )
        if not exact_claim_exists:
            visible.append(request["id"])
    return visible


def remove_player(
    state: FakeState,
    roster_player_id: str,
    team_id: str,
    *,
    authorized: bool,
    fail_after_claim_cleanup: bool = False,
) -> None:
    before = copy.deepcopy(state)
    try:
        if not authorized:
            raise PermissionError("Team admin access required")
        player = next(
            item for item in state.players if item["id"] == roster_player_id and item["team_id"] == team_id
        )
        player["active"] = False
        state.claims[:] = [
            claim
            for claim in state.claims
            if not (claim["team_id"] == team_id and claim["roster_player_id"] == roster_player_id)
        ]
        if fail_after_claim_cleanup:
            raise RuntimeError("Injected cleanup failure")
        player_number = normalized_jersey(player["number"])
        for request in state.requests:
            if (
                request["team_id"] == team_id
                and request["status"] in {"pending", "approved"}
                and normalized_jersey(request["jersey"]) == player_number
            ):
                request["status"] = "player_removed"
    except Exception:
        state.players = before.players
        state.claims = before.claims
        state.requests = before.requests
        state.members = before.members
        raise


remove_schema = function_body(SCHEMA, "laxhornet_remove_roster_player")
pending_schema = function_body(SCHEMA, "laxhornet_pending_team_access_requests")
review_schema = function_body(SCHEMA, "laxhornet_review_team_access_request")
request_schema = function_body(SCHEMA, "laxhornet_request_team_player_access")
remove_migration = function_body(MIGRATION, "laxhornet_remove_roster_player")
pending_migration = function_body(MIGRATION, "laxhornet_pending_team_access_requests")
review_migration = function_body(MIGRATION, "laxhornet_review_team_access_request")

for label, source in [
    ("canonical schema", SCHEMA),
    ("standalone migration", MIGRATION),
]:
    check(f"{label} permits player_removed status", "player_removed" in source and "team_access_requests_status_check" in source)

for label, body in [
    ("canonical removal RPC", remove_schema),
    ("migration removal RPC", remove_migration),
    ("roster repair removal RPC", function_body(ROSTER_REPAIR, "laxhornet_remove_roster_player")),
]:
    lower = body.lower()
    check(f"{label} exists", bool(body))
    check(f"{label} requires sign-in", "auth.uid()" in lower and "sign in required" in lower)
    check(f"{label} requires team admin or reviewer", "laxhornet_is_platform_reviewer" in lower and "laxhornet_team_role" in lower)
    check(f"{label} locks exact roster player", "for update" in lower and "p_roster_player_id" in lower and "p_team_id" in lower)
    check(f"{label} marks player inactive", "set active = false" in lower)
    check(f"{label} removes only exact player claims", "delete from public.player_claims" in lower and "claims.roster_player_id = target_player.id" in lower)
    check(f"{label} preserves team membership", "delete from public.team_members" not in lower)
    check(f"{label} resolves only matching pending or approved requests", "status in ('pending', 'approved')" in lower and "target_player.number" in lower)
    check(f"{label} records player_removed", "status = 'player_removed'" in lower)
    check(f"{label} leaves failures to roll back the transaction", "exception when" not in lower)

for label, body in [
    ("canonical pending-request RPC", pending_schema),
    ("migration pending-request RPC", pending_migration),
    ("reminder repair pending-request RPC", function_body(REMINDER_REPAIR, "laxhornet_pending_team_access_requests")),
]:
    lower = body.lower()
    check(f"{label} requires an active roster match", "requested_players.active = true" in lower and "exists (" in lower)
    check(f"{label} excludes terminal player_removed requests", "requests.status = 'pending'" in lower and "requests.status = 'approved'" in lower)
    check(f"{label} checks the claim for the requested jersey", "claimed_players.number" in lower and "claimed_players.active = true" in lower)

for label, body in [
    ("canonical approval RPC", review_schema),
    ("migration approval RPC", review_migration),
]:
    lower = body.lower()
    check(f"{label} locks the request", "where id = request_id" in lower and "for update" in lower)
    check(f"{label} rejects terminal requests", "request_row.status <> 'pending'" in lower)
    check(f"{label} locks the active roster match", "roster_players.active = true" in lower and lower.count("for update") >= 2)
    check(f"{label} updates only a still-pending request", "and status = 'pending'" in lower)

remove_call = re.search(
    r"async function removeRosterPlayer\(\).*?^}",
    APP,
    re.MULTILINE | re.DOTALL,
)
check(
    "admin UI refreshes Parent Requests after player removal",
    bool(remove_call and "await loadTeamAccessRequests({ silent: true });" in remove_call.group(0)),
)
check(
    "an explicit request can reopen a player_removed request",
    "status = case when public.team_access_requests.status = 'approved' then 'approved' else 'pending' end"
    in request_schema,
)

state = FakeState(
    players=[
        {"id": "player-removed", "team_id": "team-a", "number": "#23", "active": True},
        {"id": "player-other", "team_id": "team-a", "number": "41", "active": True},
        {"id": "player-other-team", "team_id": "team-b", "number": "23", "active": True},
    ],
    claims=[
        {"id": "claim-target", "team_id": "team-a", "roster_player_id": "player-removed", "user_id": "parent-a"},
        {"id": "claim-other", "team_id": "team-a", "roster_player_id": "player-other", "user_id": "parent-b"},
        {"id": "claim-other-team", "team_id": "team-b", "roster_player_id": "player-other-team", "user_id": "parent-a"},
    ],
    requests=[
        {"id": "request-target", "team_id": "team-a", "user_id": "parent-a", "jersey": "23", "status": "approved"},
        {"id": "request-other", "team_id": "team-a", "user_id": "parent-b", "jersey": "41", "status": "pending"},
        {"id": "request-other-team", "team_id": "team-b", "user_id": "parent-b", "jersey": "23", "status": "approved"},
    ],
    members=[
        {"team_id": "team-a", "user_id": "parent-a"},
        {"team_id": "team-b", "user_id": "parent-a"},
        {"team_id": "team-b", "user_id": "parent-b"},
    ],
)

remove_player(state, "player-removed", "team-a", authorized=True)
check("removing a player hides its Parent Request", "request-target" not in visible_requests(state))
check("removing a player removes the exact claim", not any(c["id"] == "claim-target" for c in state.claims))
check("requests for other players remain unchanged", next(r for r in state.requests if r["id"] == "request-other")["status"] == "pending")
check("claims for other players remain unchanged", any(c["id"] == "claim-other" for c in state.claims))
check(
    "a parent with another player claim keeps that access",
    any(c["id"] == "claim-other-team" and c["user_id"] == "parent-a" for c in state.claims),
)
check("parent team membership is preserved", any(m["user_id"] == "parent-a" for m in state.members))
check("approved request becomes player_removed", next(r for r in state.requests if r["id"] == "request-target")["status"] == "player_removed")

state.players.append({"id": "player-readded", "team_id": "team-a", "number": "23", "active": True})
check("re-adding the jersey does not reactivate the old request", "request-target" not in visible_requests(state))
next(r for r in state.requests if r["id"] == "request-target")["status"] = "pending"
check("an explicit new request can be submitted for the re-added player", "request-target" in visible_requests(state))

unauthorized_state = copy.deepcopy(state)
try:
    remove_player(unauthorized_state, "player-other", "team-a", authorized=False)
except PermissionError:
    pass
check("unauthorized cleanup leaves all data unchanged", unauthorized_state == state)

rollback_state = copy.deepcopy(state)
try:
    remove_player(
        rollback_state,
        "player-other",
        "team-a",
        authorized=True,
        fail_after_claim_cleanup=True,
    )
except RuntimeError:
    pass
check("cleanup failure rolls the modeled transaction back", rollback_state == state)

check("migration is explicitly transactional", MIGRATION.lstrip().startswith("--") and "\nbegin;" in MIGRATION.lower() and MIGRATION.rstrip().endswith("commit;"))
check("migration revokes public and anon execution", "from public, anon" in MIGRATION.lower())

print(f"\n{PASSES} passed; {len(FAILURES)} failed")
if FAILURES:
    for failure in FAILURES:
        print(f" - {failure}")
    sys.exit(1)
