export const R206_RUNTIME_SHA =
  "2fcc446d5f3d06ca6d24c69bc4466a13794e02b3";

export const R206_MIGRATIONS = Object.freeze([
  "supabase/migrations/20260730134439_durable_game_tombstones.sql",
  "supabase/migrations/20260730151714_durable_game_tombstone_concurrency.sql",
]);

export const R206_REVIEWED_IDENTITIES = Object.freeze({
  "supabase/migrations/20260730134439_durable_game_tombstones.sql":
    "138e8edfdaa4b48747ceb63a66a0eae76f91c832b19dffa52914bdea45188900",
  "supabase/rollback/20260730134439_durable_game_tombstones_rollback.sql":
    "405d0b10370cbcc90aa474f469d9841a5bc56a96453094561cb8a2386dd1545b",
  "supabase/tests/durable_game_tombstones.sql":
    "23f4abe853acf82817690b296c5dcf29947f500ded5721e88f5e04f83dea778f",
  "supabase/migrations/20260730151714_durable_game_tombstone_concurrency.sql":
    "619dbe275e50b8eef9e8b63a2dce1f850e4163e1259c05521604ffdcd3778aad",
  "supabase/rollback/20260730151714_durable_game_tombstone_concurrency_rollback.sql":
    "ef3577ecc8a40e3850771a97d416d5c8f124cebe8c0fa79f613deac3045b98dc",
  "supabase/tests/durable_game_tombstone_concurrency.sql":
    "63b8d971352ff4fe7caf1f544343cf6f1ae3745fd683bb6e73c101c437565731",
});

export const R206_INCIDENT_CLASSIFICATION =
  "Unauthorized release-control deviation with apparently aligned reviewed state";

const packageFiles = (reviewPackage) => [
  reviewPackage?.forwardMigration,
  reviewPackage?.rollbackReference,
  reviewPackage?.testSql,
];

const evidenceComplete = (evidence, evidenceExists) =>
  Boolean(
    evidence
    && typeof evidence.path === "string"
    && evidence.path.length > 0
    && /^[a-f0-9]{64}$/.test(evidence.sha256 || "")
    && evidence.reviewed === true
    && evidenceExists(evidence.path),
  );

export function evaluateR206ReleaseControl(
  manifest,
  { evidenceExists = () => false } = {},
) {
  const failures = [];
  const expect = (condition, message) => {
    if (!condition) failures.push(message);
    return Boolean(condition);
  };
  const reviewPackages = manifest.reviewDatabasePackages || [];
  const tombstonePackage = reviewPackages.find(
    (entry) => entry.name === "durable_game_tombstones",
  );
  const concurrencyPackage = reviewPackages.find(
    (entry) => entry.name === "durable_game_tombstone_concurrency",
  );
  const control = manifest.r206ReleaseControl || {};
  const reconciliation = control.reconciliation || {};
  const synthetic = control.syntheticVerification || {};
  const evidenceReconciliation = control.evidenceReconciliation || {};

  const runtimeReady = expect(
    manifest.productionApplicationSha === R206_RUNTIME_SHA
      && control.runtimeDeployed === true
      && control.runtimeSourceSha === R206_RUNTIME_SHA
      && control.pagesRunId === "30559099199",
    "R2-06 runtime must identify verified Pages run 30559099199 at the reviewed merge",
  );

  let identitiesReady = true;
  for (const reviewPackage of [tombstonePackage, concurrencyPackage]) {
    for (const file of packageFiles(reviewPackage)) {
      const identityMatches =
        Boolean(file)
        && reviewPackage?.sha256?.[file] === R206_REVIEWED_IDENTITIES[file];
      identitiesReady =
        expect(identityMatches, `R2-06 reviewed identity is missing or altered: ${file || "(missing)"}`)
        && identitiesReady;
    }
  }

  const migrationOrderReady = expect(
    JSON.stringify(manifest.runtimeDatabaseDependencies) === JSON.stringify(R206_MIGRATIONS)
      && JSON.stringify(manifest.expectedPendingProductionMigrations || []) === "[]"
      && JSON.stringify(manifest.expectedRemoteAppliedMigrations)
        === JSON.stringify(manifest.requiredMigrationSequence)
      && manifest.requiredMigrationSequence?.at(-2) === R206_MIGRATIONS[0]
      && manifest.requiredMigrationSequence?.at(-1) === R206_MIGRATIONS[1]
      && concurrencyPackage?.requiresMigration === R206_MIGRATIONS[0],
    "R2-06 migrations must be recorded applied in dependency order with no pending entry",
  );

  const migrationStateReady = expect(
    control.migrationsApplied === true
      && manifest.runtimeDatabaseDependenciesSatisfied === true
      && tombstonePackage?.status === "production_present_reconciled"
      && tombstonePackage?.productionApplied === true
      && tombstonePackage?.productionCatalogVerified === true
      && tombstonePackage?.productionAuthorizationRecorded === false
      && concurrencyPackage?.status === "production_present_reconciled"
      && concurrencyPackage?.productionApplied === true
      && concurrencyPackage?.productionCatalogVerified === true
      && concurrencyPackage?.productionAuthorizationRecorded === false,
    "R2-06 package states must record reconciled production presence without tracked authorization",
  );

  const catalogReady = expect(
    control.catalogVerified === true
      && control.catalogVerificationEvidence
        === "review-evidence/r2-06-durable-game-tombstones-release/PRODUCTION_STATE_RECONCILIATION.md",
    "R2-06 catalog verification must remain bound to the reconciliation evidence",
  );

  const provenanceReady = expect(
    control.implementationReviewed === true
      && reconciliation.discoveredThroughReconciliation === true
      && reconciliation.trackedReleaseAuthorizationRecorded === false
      && reconciliation.productionStatePreserved === true
      && reconciliation.retroactiveApprovalGranted === false
      && reconciliation.migrationApplicationAttribution === "unresolved"
      && reconciliation.incidentClassification === R206_INCIDENT_CLASSIFICATION
      && reconciliation.observationEvidence
        === "review-evidence/r2-06-durable-game-tombstones-release/PRODUCTION_STATE_RECONCILIATION.md"
      && reconciliation.manifestReconciliationEvidence
        === "review-evidence/r2-06-durable-game-tombstones-release/RELEASE_MANIFEST_RECONCILIATION.md",
    "R2-06 reconciliation provenance must preserve the unauthorized incident state",
  );

  const runtimeDatabaseReady =
    runtimeReady
    && identitiesReady
    && migrationOrderReady
    && migrationStateReady
    && catalogReady
    && provenanceReady;

  const authorizationEvidenceReady = evidenceComplete(
    synthetic.authorizationEvidence,
    evidenceExists,
  );
  const behaviorEvidenceReady = evidenceComplete(synthetic.evidence, evidenceExists);
  const cleanupEvidenceReady = evidenceComplete(synthetic.cleanupEvidence, evidenceExists);
  const directProductionEvidenceReady =
    synthetic.authorized === true
    && authorizationEvidenceReady
    && synthetic.completed === true
    && behaviorEvidenceReady
    && control.cleanupCompleted === true
    && cleanupEvidenceReady;
  const mixedEvidenceEntries = Object.values(evidenceReconciliation.evidence || {});
  const mixedEvidenceReady =
    synthetic.authorized === false
    && synthetic.completed === false
    && synthetic.completionModel === "approved_mixed_evidence"
    && synthetic.futureAuthorizationState === "not_authorized"
    && synthetic.historicProductionEvidenceReconciled === true
    && synthetic.mixedEvidenceAccepted === true
    && synthetic.cleanupAttested === true
    && synthetic.syntheticVerificationCloseoutStatus === "approved_mixed_evidence"
    && control.cleanupCompleted === false
    && control.cleanupApproved === true
    && evidenceReconciliation.status
      === "R2-06 RELEASE CLOSEOUT APPROVED — MIXED EVIDENCE ACCEPTED"
    && evidenceReconciliation.independentCloseoutReviewPending === false
    && evidenceReconciliation.approvedCloseoutBaselineSha
      === "adb9c4b91d9243534080f84f288d7f68bf446757"
    && evidenceReconciliation.approvalAuthority === "David"
    && evidenceReconciliation.approvalDate === "2026-08-01"
    && evidenceReconciliation.newProductionAuthorizationCreated === false
    && evidenceReconciliation.secondProductionLifecycleExecuted === false
    && evidenceReconciliation.noSecondProductionLifecycleRequired === true
    && evidenceReconciliation.productionAccessDuringCloseout === false
    && evidenceReconciliation.productionMutationDuringCloseout === false
    && evidenceReconciliation.productionRerunDuringCloseout === false
    && evidenceReconciliation.newProductionAuthorizationCreatedDuringCloseout === false
    && evidenceReconciliation.privateEvidenceOpenedDuringCloseout === false
    && evidenceReconciliation.retainedTombstoneChangedDuringCloseout === false
    && evidenceReconciliation.unrelatedRolloutStagesChangedDuringCloseout === false
    && mixedEvidenceEntries.length === 4
    && mixedEvidenceEntries.every((entry) => evidenceComplete(entry, evidenceExists))
    && evidenceReconciliation.cleanupAttestation
      ?.immutableConsumptionRecordCleanupCompleted === false
    && evidenceReconciliation.cleanupAttestation?.manualCleanupRequired === false
    && evidenceReconciliation.cleanupAttestation?.retainedDurableTombstones === 1
    && evidenceReconciliation.cleanupAttestation?.retainedPrivateLedgers === 1
    && Object.values(evidenceReconciliation.cleanupAttestation?.mutableResidueCounts || {})
      .every((count) => Number.isInteger(count) && count === 0);
  const closeoutBlockers = [];
  if (!directProductionEvidenceReady && !mixedEvidenceReady
      && (synthetic.authorized !== true || !authorizationEvidenceReady)) {
    closeoutBlockers.push("synthetic verification authorization evidence is absent");
  }
  if (!directProductionEvidenceReady && !mixedEvidenceReady
      && (synthetic.completed !== true || !behaviorEvidenceReady)) {
    closeoutBlockers.push("synthetic production behavior evidence is absent");
  }
  if (!directProductionEvidenceReady && !mixedEvidenceReady
      && (control.cleanupCompleted !== true || !cleanupEvidenceReady)) {
    closeoutBlockers.push("synthetic cleanup evidence is absent");
  }
  if (!runtimeDatabaseReady) {
    closeoutBlockers.push("runtime/database reconciliation is incomplete");
  }

  const closeoutReady = closeoutBlockers.length === 0;
  if (synthetic.completed === true && !behaviorEvidenceReady) {
    failures.push("synthetic verification cannot be completed without reviewed evidence");
  }
  if (control.cleanupCompleted === true && !cleanupEvidenceReady) {
    failures.push("synthetic cleanup cannot be completed without reviewed evidence");
  }
  if (synthetic.mixedEvidenceAccepted === true && !mixedEvidenceReady) {
    failures.push("mixed-evidence closeout cannot be accepted without complete reviewed evidence");
  }
  if (control.releaseCloseoutApproved === true && !closeoutReady) {
    failures.push("release closeout cannot be approved before all closeout evidence is complete");
  }

  return {
    failures,
    runtimeDatabaseReady,
    closeoutReady,
    releaseComplete: closeoutReady && control.releaseCloseoutApproved === true,
    closeoutMode: mixedEvidenceReady
      ? "approved_mixed_evidence"
      : (directProductionEvidenceReady ? "direct_production_evidence" : null),
    closeoutBlockers,
  };
}
