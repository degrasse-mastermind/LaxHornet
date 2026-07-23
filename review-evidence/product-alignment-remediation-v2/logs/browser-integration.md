# Browser Integration Check

Date: 2026-07-22  
Environment: temporary local harness wired to disposable staging  
Data: synthetic only

## Verified

- A newly created staging Live Share token opened the public shared-game screen.
- The screen rendered `Madison Demo`, `Demo Player #12`, and one `Ground Ball`.
- The event note, public test tag, private process tag, user ID, grant ID, and
  revision data in the synthetic fixture did not render.
- The public view remained read-only.
- The shared-view status now uses `Read-only live updates` rather than account
  sync language.

## Not claimed

The complete signed-in staging setup flow was not proven through the temporary
browser harness. Direct authenticated PostgREST/RPC calls passed independently.
The harness and its local server were removed after the check.

