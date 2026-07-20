from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[1]
INSTALLER = (ROOT / "supabase-game-delete-rpc-update.sql").read_text(encoding="utf-8")
HARDENING = (ROOT / "supabase-security-hardening.sql").read_text(encoding="utf-8")
SCHEMA = (ROOT / "supabase-schema.sql").read_text(encoding="utf-8")
PATCH = (ROOT / "supabase-delete-rpc-permissions-fix.sql").read_text(encoding="utf-8")

FUNCTIONS = [
    "public.laxhornet_delete_game(text)",
    "public.laxhornet_delete_event(text)",
]

checks = []


def check(name, condition):
    checks.append((name, bool(condition)))


def contains_statement(source, statement):
    normalized = re.sub(r"\s+", " ", source.lower())
    expected = re.sub(r"\s+", " ", statement.lower())
    return expected in normalized


for signature in FUNCTIONS:
    check(
        f"delete installer revokes PUBLIC and anon from {signature}",
        contains_statement(
            INSTALLER,
            f"revoke execute on function {signature} from public, anon;",
        ),
    )
    check(
        f"delete installer grants authenticated access to {signature}",
        contains_statement(
            INSTALLER,
            f"grant execute on function {signature} to authenticated;",
        ),
    )
    check(
        f"security hardening restores authenticated access to {signature}",
        f"'{signature}'" in HARDENING,
    )
    check(
        f"main schema grants authenticated access to {signature}",
        contains_statement(
            SCHEMA,
            f"grant execute on function {signature} to authenticated;",
        ),
    )
    check(
        f"permission patch revokes PUBLIC and anon from {signature}",
        contains_statement(
            PATCH,
            f"revoke execute on function {signature} from public, anon;",
        ),
    )
    check(
        f"permission patch grants authenticated access to {signature}",
        contains_statement(
            PATCH,
            f"grant execute on function {signature} to authenticated;",
        ),
    )

check("permission patch is transactional", "begin;" in PATCH.lower() and "commit;" in PATCH.lower())
check(
    "permission patch verifies effective privileges",
    PATCH.lower().count("has_function_privilege(") == 4,
)
check(
    "main schema removes default PUBLIC function execution",
    contains_statement(
        SCHEMA,
        "alter default privileges in schema public revoke execute on functions from public;",
    ),
)
check(
    "delete game RPC rejects missing authentication",
    "if (select auth.uid()) is null then" in INSTALLER
    and "Game delete access required" in INSTALLER,
)
check(
    "delete event RPC rejects missing authentication",
    INSTALLER.count("if (select auth.uid()) is null then") >= 2
    and "Event delete access required" in INSTALLER,
)

failed = [name for name, ok in checks if not ok]
for name, ok in checks:
    print(f"{'PASS' if ok else 'FAIL'}: {name}")

if failed:
    print(f"\n{len(failed)} delete RPC permission check(s) failed.", file=sys.stderr)
    sys.exit(1)

print(f"\n{len(checks)} delete RPC permission checks passed.")
