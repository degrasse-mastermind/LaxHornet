# Disclosure Data Flows

## Live Share Before

```mermaid
flowchart LR
  V[Public viewer] --> B[Browser]
  B --> G[Ordinary games table]
  B --> E[Nested ordinary events rows]
  G --> B
  E --> B
  B --> F[Client-side filtering]
```

Risk: ordinary rows reached the browser before public fields were filtered, and
future private columns could be inherited by a wildcard query or subscription.

## Live Share Staging Target

```mermaid
flowchart LR
  O[Authorized tracker] --> C[Create game-scoped token RPC]
  C --> H[SHA-256 token hash only]
  V[Public viewer] --> P[Public-safe RPC polling]
  P --> A[Server allowlist projection]
  A --> V
  R[Authorized tracker] --> X[Revoke token RPC]
  X --> H
```

- The raw 32-character token is returned once and is not stored in the table.
- Unknown, expired, and revoked tokens return the same neutral `null` response.
- Anonymous users cannot select from ordinary `games`, `events`, token, or audit
  tables.
- The browser polls the allowlisted RPC every four seconds. It does not subscribe
  to unrestricted ordinary-table changes.
- Runtime flags remain off by default. Production continues its legacy path
  until a separately approved cutover.

## Export and Import

```mermaid
flowchart TD
  U[Signed-in user] --> D{Choose purpose}
  D --> C[Selected-scope CSV]
  D --> B[Private full backup]
  C --> I[Explicit notes/tag choices]
  B --> W[Sensitive-data confirmation]
  I --> L[Local download]
  W --> L
  C -. trusted flag .-> A[Metadata-only export audit RPC]
  B -. trusted flag .-> A
  J[Imported JSON] --> Q[Review eligible games]
  Q --> M[Merge new authorized games only]
  M --> N[Live Share forced off]
```

Imports cannot restore authority, roster membership, player claims, access
requests, share tokens, or account ownership. Existing same-ID games are not
silently replaced, and tombstoned games are not resurrected.

