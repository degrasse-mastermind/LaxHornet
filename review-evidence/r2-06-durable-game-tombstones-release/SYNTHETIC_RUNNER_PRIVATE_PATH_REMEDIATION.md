# R2-06K synthetic runner private-path remediation

Status: `READY FOR INDEPENDENT REVIEW`

Risk level: `LEVEL 3`

Branch: `fix/r2-06k-run-scoped-private-directory`

Starting point:
`e782f4beeaf7cb6a6954e23e83328e92a5bb14d1`

## Blocked attempt and root cause

The remediated R2-06 runner passed exact repository and runner identity,
browser readiness, isolated browser launch, and browser cleanup. It then
stopped before production access with `PRIVATE_EVIDENCE_DIR_UNREVIEWED`.

That stop was correct under the implemented contract, but the contract treated
the fixed approved private root as the only accepted production directory.
The approved execution design instead requires a fresh run-specific child
under that root. The emergency `--reviewed-private-path-override` was not
approved for the normal path and was not used.

No production connection, credential read, authorization or preflight
consumption, Auth or data creation, mutation, or cleanup occurred in the
blocked attempt. This remediation also used no production credentials and did
not execute production mode.

## Reviewed root and run-child contract

The fixed authority root remains:

`C:\Users\user\Documents\LaxHornet-Private-Release-Evidence\R2-06`

It is never an execution directory. Normal production validation accepts
exactly one existing immediate child with this format:

`r206-YYYYMMDDTHHMMSSZ-<12 lowercase hexadecimal characters>`

The format is lowercase ASCII, 34 characters, contains a real UTC timestamp,
has no spaces, dots, path separators, Unicode confusables, or Windows device
name, and has a fixed bounded random suffix.

The credential-free command:

```powershell
node tools\run_r206_synthetic_verification.mjs --prepare-run-directory
```

generates the run ID and creates the child with non-recursive exclusive
create-new semantics. A collision fails closed. The command prints only the
created path and safe metadata. It does not read credentials, check browser
readiness, contact a network, or create authorization/preflight artifacts.

## Traversal, reparse-point, and worktree defenses

Normal validation rejects:

- the approved root itself;
- grandchildren or any deeper nesting;
- siblings and arbitrary external paths;
- any raw `..` path segment, even if normalization lands on an otherwise valid
  child;
- invalid, reserved, non-ASCII, dotted, or overlong run names;
- missing or non-directory roots/children;
- symbolic links and Windows junctions;
- Windows mount points or other reparse points detected on existing path
  segments;
- real paths that escape the resolved approved root;
- the repository and every path returned by `git worktree list --porcelain`.

The runner resolves both the approved root and selected child and requires the
resolved child parent to equal the resolved root. It also resolves the Git
worktree inventory before comparing it to the root and child. Reparse-point
classification is fail closed as
`PRIVATE_EVIDENCE_REPARSE_POINT_UNSAFE`.

The separate emergency reviewed override remains parsed, but normal acceptance
never sets or requires it. Tests prove the override does not silently broaden
the default path contract.

## Artifact and ledger isolation

Authorization and preflight paths must be separate direct regular non-link
files in the selected run child. Nested or external artifacts fail before
their content is read.

The production adapter derives both:

- `R2-06_AUTHORIZATION_CONSUMPTION.json`; and
- `R2-06_RETAINED_IDENTIFIERS.json`

from the validated real run-child path. State checkpoints and cleanup ledger
updates use the retained-identifier file in that same child. No private
artifact write target is derived from the authority root or another child.

Only the selected authorization and preflight files may exist when production
configuration is validated. Existing consumption, retained-ledger, public
result-name collision, unrelated file, or nested directory content stops the
run. A consumption record makes that exact child immutable and non-reusable;
it does not block a separate fresh child.

Existing historical private evidence was not opened, enumerated for
identifiers, moved, renamed, deleted, or modified. All tests use temporary
disposable directories and synthetic values.

## Classified private-path stops

The remediation uses these classified boundaries:

- `PRIVATE_EVIDENCE_ROOT_MISMATCH`;
- `PRIVATE_EVIDENCE_RUN_DIR_INVALID`;
- `PRIVATE_EVIDENCE_RUN_DIR_NOT_EMPTY`;
- `PRIVATE_EVIDENCE_PATH_ESCAPE`;
- `PRIVATE_EVIDENCE_REPARSE_POINT_UNSAFE`;
- `PRIVATE_EVIDENCE_INSIDE_WORKTREE`;
- `PRIVATE_EVIDENCE_RUN_ALREADY_CONSUMED`;
- `PRIVATE_EVIDENCE_RUN_DIR_COLLISION`;
- `PRIVATE_ARTIFACT_PATH_UNSAFE`;
- `EVIDENCE_TARGET_ALREADY_EXISTS`.

## Verification and remaining gate

Focused coverage includes immediate child acceptance without override, root,
grandchild, sibling, external, repository, other-worktree, traversal,
symlink/junction, invalid-name, reserved-name, overlong, non-ASCII, nonempty,
consumed, retained-ledger, authorization/preflight containment, exact
consumption/ledger placement, independent children, override separation,
helper create-new behavior, and immutable false closeout state.

Local results on the final shared-runtime diff:

- runner/path/cleanup/authorization contracts: 44 passed and one skipped
  because this Windows account cannot create a directory symlink;
- Windows junction escape and native reparse-point probes: passed;
- browser/failure-envelope contracts: `11/11`;
- credential-free pinned Chromium readiness: passed;
- disposable R2-06/R2-06A integration: passed, not production evidence;
- release-manifest reconciliation: `8/8`;
- phase-aware preflight: `22/22`;
- phase-aware containment: `33/33`;
- Pages deployment contracts: `21/21`;
- tombstone contracts: `33/33`;
- tombstone migration/rollback: `13/13`;
- PostgreSQL concurrency: `8/8`;
- release-manifest validation, secret/host scan, changed-JavaScript syntax, and
  diff hygiene: passed;
- complete canonical-plus-additive regression: `46/46`.

Exact-head draft-PR CI remains pending.

Synthetic verification authorization, synthetic verification completion,
cleanup completion, and release closeout remain false. A future production run
requires new explicit authorization and a fresh named read-only preflight
bound to the independently reviewed exact runner SHA. Independent exact-PR-SHA
Level 3 review is required before merge.
