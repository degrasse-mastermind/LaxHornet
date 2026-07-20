import fs from "node:fs";
import path from "node:path";

const migrationPath = path.resolve(process.argv[2]);
const outputPath = path.resolve(process.argv[3]);
const source = fs.readFileSync(migrationPath, "utf8");

const functionNames = [
  "lh_trust_private.lh_evidence_fields",
  "lh_trust_private.lh_live_share_game_fields",
  "lh_trust_private.lh_live_share_event_fields",
  "lh_trust_private.lh_sensitive_export_game_fields",
  "lh_trust_private.lh_sensitive_export_event_fields",
  "lh_trust_private.lh_active_grants_for_user",
  "lh_trust_private.lh_create_event_impl",
  "lh_trust_private.lh_correct_event_impl",
  "lh_trust_private.lh_tombstone_event_impl",
  "lh_trust_private.lh_public_live_share_game_impl",
  "lh_trust_private.lh_record_sensitive_export_impl",
  "public.lh_resolve_active_grants",
  "public.lh_create_event",
  "public.lh_correct_event",
  "public.lh_tombstone_event",
  "public.lh_public_live_share_game",
  "public.lh_record_sensitive_export",
];

function extractFunction(name) {
  const marker = `create or replace function ${name}`;
  const start = source.toLowerCase().indexOf(marker.toLowerCase());
  if (start < 0) throw new Error(`Missing function: ${name}`);

  const bodyStart = source.slice(start).match(/\bas\s+(\$[a-z0-9_]*\$)/i);
  if (!bodyStart) throw new Error(`Missing dollar-quoted body: ${name}`);
  const tag = bodyStart[1];
  const opening = start + bodyStart.index + bodyStart[0].lastIndexOf(tag);
  const closing = source.indexOf(tag, opening + tag.length);
  if (closing < 0) throw new Error(`Unterminated function body: ${name}`);
  const semicolon = source.indexOf(";", closing + tag.length);
  if (semicolon < 0) throw new Error(`Missing function terminator: ${name}`);
  return source.slice(start, semicolon + 1).trim();
}

const header = `-- LaxHornet Trust Spine Release 1 RPC evidence
-- Source: ${path.basename(migrationPath)}
-- This file extracts exact definitions from the implementation migration.
-- It is review evidence, not a standalone migration.
--
-- Deliberate gap: no public or private restore-event RPC exists in Release 1.
-- Restore operation tables and lifecycle records exist, but runtime restore
-- cannot be exercised through the approved public RPC surface.
`;

const blocks = functionNames.map(
  (name) => `\n-- -----------------------------------------------------------------\n-- ${name}\n-- -----------------------------------------------------------------\n${extractFunction(name)}\n`,
);

fs.writeFileSync(outputPath, `${header}${blocks.join("")}`, "utf8");
console.log(`Extracted ${blocks.length} exact function definitions to ${outputPath}`);
