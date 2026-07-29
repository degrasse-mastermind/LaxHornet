# LaxHornet Allowlisted Pages Artifact Rollback

Status: rollout procedure ready
Custom domain: `laxhornet.mybranford.com`
Previous Pages source: legacy `main` repository root
Previous deployed SHA: `86e3ff79d569c3ec84e382b1b93d2d85df1cd550`

## Safety rule

Rollback must redeploy a previously verified allowlisted artifact or rebuild
one from an existing allowlisted `main` commit. It must never restore
repository-root publishing.

## Normal rollback

1. Select the last known-good `main` commit that contains the allowlist,
   builder, validator, and Pages workflow.
2. Confirm it is an ancestor of current `origin/main`.
3. Dispatch `Allowlisted GitHub Pages` with that SHA:

   ```powershell
   gh workflow run pages-deployment.yml `
     --ref main `
     -f deployment_ref=<LAST_KNOWN_GOOD_ALLOWLISTED_MAIN_SHA>
   ```

4. Watch the workflow through the build, validation, artifact upload, and
   `github-pages` deployment:

   ```powershell
   gh run list --workflow pages-deployment.yml --limit 5
   gh run watch <RUN_ID> --exit-status
   ```

5. Verify the custom domain, `v284` marker, service worker, application shell,
   manifest hashes, and representative internal-path `404` responses.

The workflow refuses a deployment SHA that is not incorporated into
`origin/main`. Validation runs before artifact upload; deployment depends on
the successful build job.

## First-rollout recovery

The infrastructure merge preserves the v284 product files from
`86e3ff79d569c3ec84e382b1b93d2d85df1cd550`. If the first Actions deployment
needs recovery, rerun the successful infrastructure workflow or manually
dispatch that same infrastructure merge SHA. This rebuilds the identical
allowlisted product bytes without exposing the repository root.

If the workflow definition itself is defective, revert or repair only the
deployment infrastructure on `main`, require the deployment contracts to pass,
and deploy the corrected allowlisted artifact. Do not switch `build_type` back
to `legacy`.

## First-cutover gate

After the infrastructure PR is independently approved and its regression is
green, but before merging it:

1. Record the current legacy source, custom domain, HTTPS state, and
   certificate state.
2. Change only the Pages `build_type` from `legacy` to `workflow`.
3. Require `cname: laxhornet.mybranford.com`, HTTPS enforcement, and an
   approved certificate to remain unchanged.
4. Merge the approved PR so the `main` push starts the first artifact
   deployment.
5. Require the workflow preflight and post-deployment verification jobs to
   pass. Both fail closed if the source or custom-domain gate drifts.
6. Complete byte, internal-path, installed-PWA, v284 smoke, and rollback
   verification before closing the ticket.

The site continues serving the previous successful deployment between the
settings change and the first workflow deployment. The cutover changes the
publishing method, not DNS or current content.

## Custom-domain preservation

Before and after rollback, confirm the Pages settings retain:

- `build_type: workflow`;
- `cname: laxhornet.mybranford.com`;
- HTTPS enforcement;
- an approved certificate for the custom domain.

`CNAME` is retained inside the artifact as an additional explicit identity
check, but repository Pages settings and DNS remain authoritative.

## Verification record

For every rollback, record:

- source/deployment SHA;
- workflow run URL and conclusion;
- generated deployment-manifest SHA-256;
- deployed file count;
- byte verification;
- internal-path HTTP results;
- service-worker activation and stale-cache purge;
- custom-domain and HTTPS result.
