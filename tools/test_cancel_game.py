from copy import deepcopy
from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[1]
APP = (ROOT / "app.js").read_text(encoding="utf-8")
STYLES = (ROOT / "styles.css").read_text(encoding="utf-8")


def function_body(name):
    match = re.search(rf"(?:async\s+)?function\s+{re.escape(name)}\s*\([^)]*\)\s*\{{", APP)
    if not match:
        return ""
    start = match.end()
    depth = 1
    index = start
    while index < len(APP) and depth:
        if APP[index] == "{":
            depth += 1
        elif APP[index] == "}":
            depth -= 1
        index += 1
    return APP[start : index - 1]


def cancel_model(model):
    if not model["active"] or not model["authorized"]:
        return deepcopy(model)
    result = deepcopy(model)
    game = result["active"]
    if result["origin"] != "new":
        result["games"][game["id"]] = deepcopy(result.get("snapshot") or game)
        result["active"] = None
        result["session"] = None
        result["screen"] = "home"
        return result
    result["deleted"].add(game["id"])
    result["games"].pop(game["id"], None)
    result["active"] = None
    result["session"] = None
    result["review"] = next(iter(result["games"]), None)
    result["screen"] = "home"
    result["cloud_calls"] += 0 if result["offline"] else 1
    return result


def cloud_merge(local_games, cloud_games, deleted):
    merged = {game_id: deepcopy(game) for game_id, game in local_games.items() if game_id not in deleted}
    for game_id, game in cloud_games.items():
        if game_id not in deleted:
            merged[game_id] = deepcopy(game)
    return merged


checks = []


def check(name, condition):
    checks.append((name, bool(condition)))


new_game = {"id": "new-game", "events": []}
other_game = {"id": "other-game", "events": [{"id": "other-event"}]}
base = {
    "active": new_game,
    "games": {"new-game": new_game, "other-game": other_game},
    "deleted": set(),
    "session": {"gameId": "new-game", "origin": "new"},
    "origin": "new",
    "snapshot": None,
    "review": "new-game",
    "screen": "live",
    "offline": False,
    "authorized": True,
    "cloud_calls": 0,
}

cancelled_empty = cancel_model(base)
check("new game with no events is removed", "new-game" not in cancelled_empty["games"])
check("cancel clears active game and tracking session", cancelled_empty["active"] is None and cancelled_empty["session"] is None)
check("cancel writes a durable game tombstone", "new-game" in cancelled_empty["deleted"])
check("cancel returns to home", cancelled_empty["screen"] == "home")
check("online cancel requests one cloud deletion", cancelled_empty["cloud_calls"] == 1)

many = deepcopy(base)
many["active"] = {"id": "new-game", "events": [{"id": f"event-{index}"} for index in range(8)]}
many["games"]["new-game"] = deepcopy(many["active"])
cancelled_many = cancel_model(many)
check("game with several events is fully removed", "new-game" not in cancelled_many["games"] and cancelled_many["active"] is None)
check("unrelated games remain unchanged", cancelled_many["games"] == {"other-game": other_game})

kept = deepcopy(many)
check("Keep Tracking leaves game and events unchanged", kept == many)

offline = deepcopy(many)
offline["offline"] = True
cancelled_offline = cancel_model(offline)
check("offline cancel queues no immediate cloud call", cancelled_offline["cloud_calls"] == 0)
check(
    "offline tombstone prevents cloud resurrection after reload",
    "new-game" not in cloud_merge(cancelled_offline["games"], {"new-game": many["active"]}, cancelled_offline["deleted"]),
)
check("canceled game is excluded from export source", "new-game" not in cancelled_offline["games"])

existing = deepcopy(many)
existing["origin"] = "existing"
existing["snapshot"] = {"id": "new-game", "events": [{"id": "saved-event"}], "status": "complete"}
exited = cancel_model(existing)
check("resumed saved game is preserved", exited["games"]["new-game"] == existing["snapshot"])
check("resumed saved game does not call cloud delete", exited["cloud_calls"] == 0 and "new-game" not in exited["deleted"])

unauthorized = deepcopy(many)
unauthorized["authorized"] = False
check("unauthorized cancel cannot change the game", cancel_model(unauthorized) == unauthorized)
check("cancel is idempotent after active game is cleared", cancel_model(cancelled_many) == cancelled_many)

confirm_body = function_body("confirmCancelGame")
delete_body = function_body("deleteSupabaseGame")
submit_body = function_body("handleSubmit")
click_body = function_body("handleClick")

check("Cancel Game is a secondary live control", 'data-action="cancel-game"' in APP and "cancel-game-trigger" in STYLES)
check("confirmation uses required warning copy", "This will discard the current game and all events recorded during it. This action cannot be undone." in APP)
check("confirmation has Keep Tracking and Cancel Game actions", 'data-action="keep-tracking"' in APP and 'data-action="confirm-cancel-game"' in APP)
check("new tracking sessions are marked at game creation", 'origin: "new"' in submit_body and "trackingSession" in submit_body)
check("legacy sessions default to preservation-safe existing origin", 'requestedOrigin' in function_body("normalizeTrackingSession") and '"existing"' in function_body("normalizeTrackingSession"))
check("cancel clears active and review pointers", "state.activeGame = null" in confirm_body and "state.reviewGameId" in confirm_body)
check("cancel uses durable game tombstone", "rememberDeletedGame(game.id)" in confirm_body)
check("cancel never completes or reviews the game", "confirmEndGame" not in confirm_body and 'status = "complete"' not in confirm_body)
check("cancel uses RPC-only cloud deletion", 'deleteSupabaseGame(game.id, { rpcOnly: true })' in confirm_body)
check("game deletion has no direct table delete fallback", '.from("games").delete()' not in delete_body)
check("saved-session exit does not call cloud deletion", confirm_body.index('session?.origin !== "new"') < confirm_body.index("deleteSupabaseGame"))
check("modal is accessible", 'role="dialog"' in APP and 'aria-modal="true"' in APP and "handleDialogKeydown" in APP)
check("Escape and Tab handling are implemented", 'event.key === "Escape"' in APP and 'event.key !== "Tab"' in APP)
check("Keep Tracking restores focus to cancel control", "keepTrackingAfterCancelPrompt" in click_body and '[data-action="cancel-game"]' in APP)
check("Save, End Game, and Undo controls remain", 'data-action="save-game"' in APP and 'data-action="end-game"' in APP and 'data-action="undo"' in APP)
check("normal navigation does not invoke cancellation", "confirmCancelGame" not in function_body("navigate"))
check("cloud merge filters deleted games", ".filter((game) => !isDeletedGame(game.id))" in function_body("mergeGames"))
check("cloud reload flushes tombstones before merge", function_body("loadCloudGames").index("flushDeletedCloudRecords") < function_body("loadCloudGames").index("mergeGames"))

failed = [name for name, ok in checks if not ok]
for name, ok in checks:
    print(f"{'PASS' if ok else 'FAIL'}: {name}")

if failed:
    print(f"\n{len(failed)} cancel-game check(s) failed.", file=sys.stderr)
    sys.exit(1)

print(f"\n{len(checks)} cancel-game checks passed.")
