# LaxHornet Conversation Index and Canonical Decision Register

**Version:** 1.0  
**Status:** Canonical working register  
**Date:** July 26, 2026  
**Owner:** David / MethodNorth  
**Product:** LaxHornet  
**Purpose:** Preserve the durable record of LaxHornet discussions while clearly separating current decisions, historical implementation, deferred concepts, superseded ideas, and unresolved questions.

---

## 0. Authority and Use

This register reconciles prior LaxHornet conversations and related project records available in the current ChatGPT history and File Library. It is intended to prevent older brainstorming or legacy implementation from quietly being treated as current product policy.

It does **not** replace:

- the deployed LaxHornet repository as the source of truth for what the software currently does;
- approved MethodNorth doctrine as the source of truth for cross-product philosophy, standards, and governance;
- an approved LaxHornet specification or decision record that explicitly supersedes this register.

Deleted, inaccessible, or unindexed chats may not be represented. New decisions should be added rather than silently rewriting the historical record.

### Status labels

| Label | Meaning |
|---|---|
| **Canonical** | Current approved direction. |
| **Canonical—Constrained** | Approved only within stated limits. |
| **Implementation Fact** | Exists or existed in code; not necessarily approved as future direction. |
| **Deferred** | Valuable concept intentionally postponed. |
| **Exploratory** | Brainstorming or hypothesis; never formally approved. |
| **Superseded** | Replaced by a later decision. |
| **Rejected** | Intentionally excluded. |
| **Open** | Requires an explicit decision. |

### Two kinds of truth

**Product intent and governance authority**

1. Explicit current owner decision.
2. Approved MethodNorth doctrine or standard.
3. Approved LaxHornet specification or decision record.
4. This canonical register.
5. Historical conversation material and brainstorming.

**Implementation truth**

1. Deployed production behavior.
2. Current repository main branch.
3. Active implementation branch and verified test evidence.
4. Technical documentation.
5. Conversation descriptions of the code.

A feature can be an implementation fact without remaining part of the approved product direction.

---

# 1. Canonical Current-State Summary

LaxHornet is a distinct MethodNorth product and separate deployed codebase. It is a mobile-first, offline-capable youth lacrosse stat-tracking PWA intended for adult users such as parents, approved trackers, team administrators, coaches where authorization is explicit, and families.

LaxHornet owns its lacrosse-specific implementation, event model, user experience, deployment, product operations, and remediation. MethodNorth owns shared philosophy, doctrine, standards, product-system governance, research provenance, brand architecture, and cross-product design principles.

The core product loop is:

> **Track → Understand → Encourage → Focus → Improve**

The central product opportunity is not simply counting traditional box-score statistics. It is helping adults understand the plays behind the scoreboard—especially possession creation, transition impact, ground-ball value, defensive disruption, and other contributions that youth athletes and families often overlook.

The current safest intelligence direction is deliberately narrower than several earlier concepts:

- use one canonical effective-event source;
- begin with **private factual review only**;
- include evidence-envelope validation, provenance, invalidation, and regeneration;
- show explicit `insufficient evidence` and `context needed` states;
- do not provide interpretive recommendations until governance supports them;
- do not deliver intelligence to athletes, parents, public sharing, or Live Share yet;
- do not add numeric sufficiency thresholds without an approved decision;
- do not create a parallel event resolver;
- do not release to production until hosted behavior is verified.

Legacy Game Impact scores, grades, player archetypes, broad recommendations, and public or athlete-facing intelligence must not be treated as automatically approved merely because related code, mockups, or prior discussions exist.

---

# 2. Conversation Index

## CI-01 — Initial Youth Lacrosse Tracker Concept

**Approximate period:** June 13–17, 2026  
**Primary subjects:**

- Fast in-game lacrosse stat tracking for a parent on the sideline.
- Mobile-first interaction and large one-handed controls.
- Player-specific tracking.
- Traditional and nontraditional lacrosse contributions.
- Initial Codex prompts and product build direction.

**Durable outcome:** Established the core need: capture a fast game without requiring a professional statistician and turn recorded events into more useful understanding.

**Status:** Canonical foundation.

---

## CI-02 — 1LAXHORNET: Youth Sports Stat App

**Approximate date:** June 17, 2026  
**Primary subjects:**

- Market need and differentiation.
- Game Impact.
- Possession Value and Extra Possessions Created.
- Player archetypes.
- Competitor discovery.
- Unique value beyond standard stat tracking.
- Codex-ready implementation prompts.

**Durable outcomes:**

- Possession analytics identified as a key differentiator.
- “Invisible impact” became a central value proposition.
- Direct comparison of a child’s game to a PLL player was abandoned.
- Player archetypes were explored but not permanently approved.

**Status:** Mixed—foundational analytics remain valuable; several presentation concepts were later superseded.

---

## CI-03 — 2LAXHORNET: Marketing Strategy and Live-App Assessment

**Approximate date:** June 21–22, 2026  
**Primary subjects:**

- Parent-first positioning.
- Product messaging and launch strategy.
- Review of the live application and screenshots.
- Authentication, team access, roster claims, Supabase, cloud sync, offline use, and Live Share.
- Privacy, adult accounts, Terms of Use, and intellectual-property considerations.
- Parent, player-development, club, and program-value messaging.

**Durable outcomes:**

- LaxHornet was defined as a mobile-first PWA for parents, team administrators, and families.
- No child accounts.
- Parent trackers should not receive unnecessary full-roster access.
- Preserve authentication, approvals, local tracking, cloud sync, saved games, imports/exports, and Live Share while making passive UX improvements.
- Development-oriented review language became a priority.

**Status:** Canonical, subject to later evidence and disclosure constraints.

---

## CI-04 — 5LAXHORNET: Game and Season Review Language

**Approximate date:** June 26–27, 2026  
**Primary subjects:**

- Richer game-review feedback.
- Lacrosse-smart, coach-quality analysis.
- Dynamic response language.
- Preserving the existing review order.
- Season Review redesign and language.

**Durable outcomes:**

- Review language should be specific, useful, and lacrosse-literate.
- Feedback should not feel generic or repetitive.
- The experience should support understanding and development rather than simply restating totals.

**Later constraint:** Coach-like language cannot imply unsupported authority, certainty, or knowledge beyond the recorded evidence.

**Status:** Canonical goal; delivery method constrained.

---

## CI-05 — 4LAXHORNET: Post-Game Review Architecture

**Approximate date:** June 28–29, 2026  
**Primary subjects:**

- Event timing and scorekeeping.
- Intelligent feedback after a game is finalized.
- Game Review screen-recording analysis.
- Reducing redundancy.
- Organizing the post-game experience.
- Codex implementation prompts.

**Durable outcomes:**

- Post-game review is one of the product’s highest-value moments.
- The page should move from evidence toward meaning without overwhelming the user.
- Repetition across snapshot, summary, takeaways, and breakdown sections should be reduced.
- Review should end with useful next conversation or development context rather than a verdict.

**Status:** Canonical design objective.

---

## CI-06 — 3LAXHORNET: Club Licensing and Pilot Strategy

**Approximate date:** June 29, 2026  
**Primary subjects:**

- Selling team or club access through youth organizations.
- Bundling access into tuition.
- Local club pilot strategy.
- One-page club pilot offer.
- Pitch decks, pricing sheets, onboarding materials, and sales collateral.

**Durable outcomes:**

- Team-season or club licensing is the preferred initial monetization path.
- A small club pilot is the preferred sales entry.
- Parent premium features may follow after organizational validation.
- Earlier pricing concepts included a low-friction seasonal offer and pilot options, but exact pricing remains unapproved.

**Status:** Canonical go-to-market direction; pricing is open.

---

## CI-07 — 06LAXHORNET: Coaching Framework Research

**Approximate date:** July 15, 2026  
**Primary subjects:**

- Crawling and synthesizing coaching articles.
- Converting coaching research into an app framework.
- Evidence collection, article notes, conflicting advice, coaching principles, and event-sequence analysis.
- Codex research prompts.

**Durable outcomes:**

- Coaching research should inform product language and developmental structure.
- Source provenance and conflicting viewpoints should be preserved.
- Research should support the conversation, not manufacture false coaching authority.

**Status:** Canonical research foundation.

---

## CI-08 — MethodNorth, Project One, and Product Architecture

**Approximate date:** July 16–20, 2026  
**Primary subjects:**

- MethodNorth as philosophy and product system.
- Project One as the first proof/reference implementation.
- LaxHornet as the first product implementation and proof point.
- Post-game developmental review.
- Evidence before opinion, context before judgment, understanding before action, and human before technology.

**Durable outcomes:**

- MethodNorth and LaxHornet are connected but must not be combined.
- LaxHornet remains visually athletic, fast, bold, competitive, and high-energy.
- MethodNorth remains calmer and more editorial.
- MethodNorth branding must not be inserted into LaxHornet without an approved implementation specification.

**Status:** Canonical.

---

## CI-09 — Organization Audit and Migration Work

**Approximate date:** July 19–20, 2026  
**Primary subjects:**

- Repository and file-system boundaries.
- Canonical source reconciliation.
- Backup and migration plans.
- LaxHornet assets, research, review screenshots, launch materials, and technical files.
- Separation of deployed code from MethodNorth strategy and design governance.

**Durable outcomes:**

- LaxHornet’s deployed repository remains protected and separate.
- No casual moving, renaming, consolidation, or cleanup of deployed files.
- Review screenshots, research, launch assets, and technical evidence must be preserved until provenance and deployment dependencies are confirmed.
- MethodNorth design-system material may provide implementation guidance, but source originals must not be overwritten without controlled migration.

**Status:** Canonical repository governance.

---

## CI-10 — Product Alignment Audit

**Approximate date:** July 20, 2026  
**Primary subjects:**

- Requirement-by-requirement review of actual implementation.
- Game Impact and letter-grade risk.
- Player archetype risk.
- Evidence mutability.
- Live Share disclosure.
- Export scope.
- Authority and role separation.

**Durable outcomes:**

- Existing Game Impact presentation was considered too verdict-like.
- Archetypes risk defining a child rather than supporting understanding.
- Interpretation should not precede evidence review.
- Existing event correction does not provide a production-grade immutable evidence history.
- Team Admin must not be treated as Coach without explicit authorization.
- Public disclosure, broad exports, and Live Share require minimum-necessary rules.

**Status:** Canonical risk and remediation record.

---

## CI-11 — GitHub, Codex, Event Pipeline, and Release Control

**Approximate date:** July 22–23, 2026  
**Primary subjects:**

- Repository inspection and current feature inventory.
- Offline PWA architecture.
- Local storage, Supabase, optional cloud sync, and Live Share.
- Bounded remediation rather than open-ended rewrite.
- Event Pipeline and Release Control.

**Durable outcomes:**

- Use one canonical event path.
- Maintain explicit game scope.
- Add a backend capability handshake where required.
- Produce one controlled release bundle.
- Require one end-to-end `track → share` verification.
- Provide admin visibility and ownership rules.
- Preserve GitHub Pages paths and service-worker behavior.
- Avoid destabilizing existing capture, sync, and saved-game flows.

**Status:** Canonical implementation boundary.

---

## CI-12 — LH-20 Intelligence Specification and Evidence Envelope

**Approximate date:** Late July 2026  
**Primary subjects:**

- Robust game-review response library.
- Canonical intelligence evidence envelope.
- Effective-event source.
- Eligibility, invalidation, provenance, routing, sufficiency, versioning, and implementation boundaries.
- Freezing broader interpretive work pending governance.

**Current recorded implementation state:**

- Branch: `work/lh20-intelligence-evidence-envelope-v0-1`
- Based on: `61cf1a7`
- Commit: `2dfd390`
- PR #15 replacement/specification documents created.
- PR #15 remains frozen.

**Durable outcomes:**

- Factual summary and invalidation/provenance plumbing are bounded-implementable.
- Interpretive recommendation is not yet supported.
- Parent-facing intelligence is blocked pending governance.
- Athlete-facing intelligence is blocked pending governance and professional review.
- Production release is unsupported until hosted behavior is verified.

**Status:** Canonical—Constrained.

---

# 3. Canonical Decision Register

## D-001 — Product Boundary

**Decision:** LaxHornet is a distinct MethodNorth product and separate deployed codebase.

**MethodNorth owns:**

- philosophy and doctrine;
- standards;
- product-system governance;
- brand architecture;
- design governance;
- research provenance;
- portfolio strategy;
- Project One doctrine and cross-product learning.

**LaxHornet owns:**

- lacrosse-specific product decisions;
- application code;
- event and data models;
- user experience;
- deployment;
- operations;
- product remediation.

**Status:** Canonical.

---

## D-002 — Product Purpose

**Decision:** LaxHornet helps adults record and understand a young lacrosse player’s contributions beyond goals and assists.

**The product should:**

- track fast;
- explain simply;
- celebrate positively;
- support better conversations;
- reveal possession, transition, effort, and defensive contributions;
- avoid reducing a child to a score, label, or verdict.

**Status:** Canonical.

---

## D-003 — Primary Users and Accounts

**Decision:** Accounts are adult-controlled.

**Requirements:**

- no child accounts;
- adult users may include parents, approved trackers, team administrators, and explicitly authorized coaches;
- parent trackers must not automatically receive full-roster visibility;
- team codes, jersey numbers, claims, and approvals should limit access;
- admin status is not equivalent to coaching authority.

**Status:** Canonical.

---

## D-004 — Core Product Loop

**Decision:** The durable product loop is:

> **Track → Understand → Encourage → Focus → Improve**

The review experience should help the user move through these stages without turning the app into the final authority on the athlete.

**Status:** Canonical.

---

## D-005 — Platform and Architecture

**Decision:** Preserve LaxHornet as a mobile-first, offline-capable PWA.

**Current architecture facts include:**

- plain HTML, CSS, and JavaScript;
- `localStorage`-based local state and offline use;
- optional Supabase authentication, roster/team operations, cloud sync, and Live Share;
- GitHub Pages deployment;
- service worker and version-controlled update behavior.

**Requirements:**

- preserve authentication, approvals, saved games, local tracking, cloud sync, Live Share, imports, exports, and existing event meanings unless an approved migration explicitly changes them;
- preserve deployed paths and service-worker behavior;
- prefer additive, reversible changes over destructive migration.

**Status:** Canonical.

---

## D-006 — Live Tracking UX

**Decision:** Game-day tracking must remain fast enough for a parent or approved tracker on the sideline.

**Requirements include:**

- large, one-handed controls;
- grouped high-frequency events;
- lower placement for specialty statistics;
- player switching;
- quarters or halves;
- overtime support;
- faceoff win and loss tracking;
- undo;
- save, end, review, and delete flows;
- explicit game and player scope.

**Status:** Canonical.

---

## D-007 — Event Pipeline

**Decision:** Use one canonical event path and one canonical effective-event source.

**Requirements:**

- no parallel event resolver;
- explicit game scope;
- normalized events and games;
- stable event meanings;
- invalidated or corrected evidence must trigger appropriate downstream invalidation and regeneration;
- intelligence must be derived from the effective evidence set, not stale cached interpretation.

**Status:** Canonical.

---

## D-008 — Possession Analytics

**Decision:** Possession-based analysis remains a central differentiator.

**Durable concepts include:**

- Extra Possessions Created;
- Possession Value;
- faceoff impact;
- ground-ball value;
- caused turnovers and defensive disruption;
- care of the ball and possession losses;
- transition creation.

**Constraint:** Definitions and calculations must be transparent enough to explain and must not imply certainty beyond recorded events.

**Status:** Canonical concept; exact formulas remain subject to specification.

---

## D-009 — Post-Game Review

**Decision:** Post-game review is a primary value surface, not an afterthought.

**The review should:**

1. establish the game and evidence scope;
2. show recorded facts before interpretation;
3. explain notable patterns carefully;
4. recognize useful contributions;
5. support a constructive conversation;
6. avoid redundant cards and repeated language;
7. preserve access to the event timeline and correction tools;
8. provide explicit uncertainty or missing-context states.

**Status:** Canonical.

---

## D-010 — Evidence Before Interpretation

**Decision:** Interpretation must not precede evidence review.

**Implications:**

- a user should be able to see what was recorded;
- the app must distinguish fact, calculation, interpretation, and recommendation;
- incomplete evidence must not be presented as complete truth;
- response provenance and versioning must be retained;
- user-facing language must avoid false certainty.

**Status:** Canonical.

---

## D-011 — Game Impact

**Historical implementation:** A bounded proprietary `0–100` Game Impact score with a letter grade and category breakdown was designed and implemented or partially implemented.

**Current decision:** Game Impact grades and verdict-like presentation are not approved as the future canonical experience.

**Current handling:**

- treat existing score behavior as an implementation fact;
- do not expand or rely on it as the central developmental judgment;
- do not present a child’s game as a definitive grade;
- any future contribution summary must be evidence-first, explainable, and non-reductive.

**Status:** Superseded as a canonical product centerpiece; legacy implementation may remain pending remediation.

---

## D-012 — Player Archetypes and Profiles

**Historical concepts included:**

- Finisher;
- Setup Artist;
- Possession Engine;
- Ground Ball Magnet;
- Defensive Disruptor;
- Two-Way Force;
- Spark Plug;
- Glue Player;
- The Wall;
- Outlet Starter;
- Growth Profile.

An interim naming change proposed “Today’s Player Profile” and “Season Player Profile.”

**Current decision:** Generated archetypes or profiles must not define the child or be treated as a canonical feature.

**Status:** Superseded and blocked from reintroduction without new governance approval.

---

## D-013 — Intelligence Delivery

**Decision:** The first implementable intelligence slice is private factual review only.

**Required:**

- canonical effective-event source;
- evidence-envelope validation;
- response provenance;
- invalidation and regeneration;
- explicit `insufficient evidence` and `context needed` states;
- private access;
- versioned outputs.

**Not currently permitted:**

- recommendations;
- athlete-facing delivery;
- parent-facing intelligence delivery;
- public sharing;
- Live Share intelligence;
- numeric evidence thresholds;
- production release;
- parallel event logic.

**Status:** Canonical—Constrained.

---

## D-014 — Coach-Like Language

**Decision:** LaxHornet should sound lacrosse-smart and useful, but it must not falsely claim the authority or context of a human coach.

**Requirements:**

- ground every statement in recorded evidence;
- distinguish observed event patterns from coaching conclusions;
- avoid generic praise and repetitive boilerplate;
- avoid pretending to know positioning, intent, assignment, matchup, or off-ball behavior that was not recorded;
- keep AI subordinate to the human conversation.

**Status:** Canonical.

---

## D-015 — Role and Authority Separation

**Decision:** Team Admin and Coach are not interchangeable roles.

**Requirements:**

- coaching context requires explicit authority policy;
- development-only proxies must be clearly identified and must not become production assumptions;
- parent, tracker, admin, and coach disclosure must be separated;
- permissions must be enforced by data policy, not only hidden interface controls.

**Status:** Canonical.

---

## D-016 — Evidence Correction and Provenance

**Decision:** In-place editing with only a `correctedAt` field is not a production-grade evidence ledger.

**A mature correction system must preserve:**

- original value;
- corrected value;
- correction author;
- correction timestamp;
- revision sequence;
- reason or context where appropriate;
- downstream invalidation and regenerated outputs.

**Constraint:** Future migration should be additive rather than destructive.

**Status:** Canonical requirement; implementation incomplete.

---

## D-017 — Live Share, Recaps, Exports, and Disclosure

**Decision:** Sharing must follow minimum-necessary disclosure.

**Requirements:**

- Live Share must not expose unnecessary player, roster, note, or developmental information;
- public links require explicit scope and expiration or access policy;
- Share Recap, CSV export, private backup, and import are separate purposes and should not inherit the broadest data scope;
- intelligence output is not currently approved for Live Share;
- notes and tags must not expose medical, sensitive, or private information.

**Status:** Canonical.

---

## D-018 — Notes and Tags

**Decision:** Notes and tags may support context but require explicit privacy warnings and access rules.

**Requirements:**

- warn users not to enter medical or highly sensitive information;
- separate private notes from shareable context;
- define who can create, view, edit, or export notes;
- do not use parent-entered notes as unquestioned factual truth.

**Status:** Canonical—Constrained.

---

## D-019 — Season Review

**Decision:** Season Review should tell a developmental story rather than merely total statistics or assign a permanent identity.

**It may include:**

- trends;
- consistency;
- contribution categories;
- changes over time;
- evidence-backed strengths;
- emerging focus areas;
- links back to individual games.

**Constraint:** No permanent player typing, reductive ranking, or unsupported recommendation.

**Status:** Canonical design goal; advanced interpretation deferred.

---

## D-020 — Monetization

**Decision:** Organization-first monetization is the preferred starting path.

**Preferred sequence:**

1. small team or club pilot;
2. team-season or club-wide license;
3. tuition-bundled access;
4. optional family premium features after validation.

**Historical price ideas:** Low-cost seasonal licenses and pilot options were discussed, including examples in the range of `US$49–US$99` per team-season and a `US$199`, sponsored, or no-cost pilot. These are not final approved prices.

**Status:** Canonical model; pricing open.

---

## D-021 — Go-to-Market

**Decision:** Lead with a specific club problem rather than a broad sports-technology promise.

**Pitch themes:**

- help families understand the game;
- recognize contributions beyond scoring;
- improve post-game conversations;
- give clubs a differentiated developmental resource;
- create value without requiring coaches to become statisticians;
- begin with a limited pilot and clear success measures.

**Status:** Canonical.

---

## D-022 — Brand Expression

**Decision:** LaxHornet should remain visually distinct from MethodNorth.

**LaxHornet expression:**

- athletic;
- bold;
- fast;
- competitive;
- high-energy;
- sharp contrast;
- confident red, black, and white system;
- hornet/stinger cues used with restraint.

**MethodNorth expression:**

- calm;
- editorial;
- reflective;
- system-oriented.

**Status:** Canonical.

---

## D-023 — Approved Brand Use Boundary

**Decision:** Do not insert MethodNorth branding, doctrine labels, or visual identity into the deployed LaxHornet experience without an approved product-expression specification.

MethodNorth may govern the design and behavior without becoming visible product copy.

**Status:** Canonical.

---

## D-024 — Release and Remediation Strategy

**Decision:** LaxHornet cleanup must be bounded remediation, not an open-ended rewrite.

**Requirements:**

- one canonical event pipeline;
- explicit game scope;
- backend capability handshake where required;
- one controlled release bundle;
- mandatory end-to-end `track → share` test;
- admin visibility;
- explicit ownership rules;
- default-off or flagged integration where risk is material;
- no production release until hosted behavior is verified.

**Status:** Canonical.

---

## D-025 — Source and Repository Governance

**Decision:** Preserve provenance and deployment safety.

**Rules:**

- the LaxHornet repository is the technical source of truth;
- MethodNorth source documents must not be edited from the LaxHornet repository;
- audits and specifications belong under documented project paths;
- experimental interface work belongs in prototype locations;
- no file moves, renames, deletions, or consolidation without approved migration evidence;
- generated screenshots, review audits, research, and launch materials must be retained until dependency and provenance review is complete.

**Status:** Canonical.

---

## D-026 — Coaching Research

**Decision:** Coaching research is a product input, not a license for automated coaching certainty.

**Requirements:**

- retain article provenance;
- preserve conflicting advice;
- synthesize principles rather than copy authority;
- connect recommendations to evidence and context;
- prioritize athlete development, autonomy, and constructive adult behavior.

**Status:** Canonical.

---

# 4. Approved and Controlled Language

## 4.1 LaxHornet product language

### Approved or durable working language

> **Track the game. Understand the sport. Encourage the player.**

> **Track your player’s full lacrosse impact from the sideline.**

> **LaxHornet helps youth lacrosse teams see the plays behind the scoreboard.**

> **Fast stats for a fast game.**

The first three lines are the strongest durable positioning statements. “Fast stats for a fast game” remains useful campaign language but should not become the complete value proposition.

### Durable product verbs

- Track
- Understand
- Encourage
- Focus
- Improve
- Record
- Review
- Recognize
- Discuss

### Controlled terminology

| Avoid or limit | Preferred language |
|---|---|
| Mistake Cost | Care of the Ball / Possession Lost |
| Grade | Contribution summary / Recorded impact breakdown |
| Player Archetype | Do not use without new approval |
| Definitive coaching statement | Evidence-backed observation |
| Complete truth | Recorded evidence / Available context |
| Admin acting as coach | Explicitly authorized coach role |
| AI coach | Assisted review / Evidence-supported language |

---

## 4.2 MethodNorth doctrine that governs LaxHornet

These principles are governing doctrine, not necessarily public-facing LaxHornet copy:

> **Progress has a direction. Growth needs a method.**

> **Move North.**

> **The child’s North belongs to the child.**

> **Guide without defining.**

> **Support without controlling.**

> **Measure without reducing.**

> **Challenge without taking ownership.**

> **Every young athlete deserves to be understood, not just measured.**

> **Winning is evidence, not the whole truth.**

> **AI should assist the conversation. It should never become the conversation.**

---

# 5. Product Requirements That Must Be Preserved

## 5.1 Game-day capture

- Mobile-first and usable one-handed.
- Clear player and game scope.
- Quarters or halves, with overtime.
- Scorekeeping and event timing where supported.
- Faceoff wins and losses.
- High-frequency events prioritized.
- Undo and correction capability.
- Safe save and end-game flow.
- Offline continuation.

## 5.2 Account and access

- Adult-controlled accounts.
- Team and player claim/approval.
- Minimum roster visibility.
- Explicit role separation.
- No child accounts.
- No assumption that admin equals coach.

## 5.3 Data and continuity

- Preserve existing event meanings unless migrated deliberately.
- Preserve saved games.
- Preserve local/offline state.
- Preserve cloud sync where enabled.
- Preserve import and private backup.
- Preserve CSV and recap purposes as separate disclosure surfaces.
- Avoid destructive migration.

## 5.4 Review

- Evidence before interpretation.
- Timeline access.
- Clear recorded-input breakdown.
- Explicit uncertainty and missing context.
- Provenance and output versioning.
- Invalidation after evidence change.
- No verdict-like child evaluation.
- No unsupported coach authority.

## 5.5 Sharing

- Minimum-necessary disclosure.
- Live Share limited to its stated purpose.
- Intelligence excluded from Live Share until approved.
- Notes and sensitive context excluded unless explicitly authorized.
- Public access requires separate security and privacy review.

## 5.6 Release quality

- One release bundle.
- Capability handshake where needed.
- End-to-end `track → share` verification.
- Hosted-behavior verification.
- Admin visibility and ownership.
- Rollback or default-off strategy for risky changes.

---

# 6. Important Research and Product Findings

## Established findings

1. **Traditional totals miss meaningful youth-lacrosse contribution.** Possession creation, ground balls, caused turnovers, faceoff impact, clears, transition, and care of the ball can create value without producing a goal or assist.

2. **The strongest differentiation is understanding, not raw tracking.** A tracker alone competes with many generic tools. LaxHornet becomes distinctive when it explains the plays behind the scoreboard carefully and constructively.

3. **The post-game moment is the highest-leverage experience.** It is where recorded data can improve recognition, parent-child conversation, and future focus.

4. **Parents need help understanding without being turned into overcoaches.** The product should illuminate the game while preserving the role of the athlete and human coach.

5. **Evidence quality matters as much as analysis quality.** An elegant insight derived from incomplete, mutable, or incorrectly scoped events can damage trust.

6. **Role ambiguity creates safety and governance risk.** Team administrators, trackers, parents, and coaches have different authority and disclosure needs.

7. **Offline capture is strategically important.** Youth sports venues often have poor connectivity; capture must not fail because cloud access is unavailable.

8. **Organization licensing may align better with adoption than isolated consumer purchase.** Clubs can bundle the tool into tuition and provide a consistent developmental resource.

## Hypotheses still requiring validation

- How many live events a parent can reliably capture without missing the game.
- Which event set provides the best balance of speed and analytical value.
- Whether families will repeatedly use post-game review after the novelty wears off.
- Whether coaches view parent-entered evidence as useful, distracting, or mixed.
- Whether clubs will pay for team-season access and at what price.
- Whether possession analytics are understandable without extensive explanation.
- Whether a private factual review meaningfully improves conversation before interpretive intelligence is added.

---

# 7. Superseded or Rejected Ideas

## Rejected

- Directly comparing a child’s game to a named PLL player.
- Public youth rankings.
- Recruiting marketplace positioning.
- Broad public leaderboards.
- Child accounts.
- Treating Team Admin as Coach by default.
- Presenting mutable event edits as a complete evidence ledger.
- Open-ended rewrite of the LaxHornet application.
- AI or computer-vision analysis as an MVP dependency.
- Using AI as the final coaching authority.

## Superseded

- Letter-grade Game Impact as the central post-game verdict.
- Generated player archetypes as a defining identity.
- “Mistake Cost” language.
- Interpretation-first review order.
- Broad intelligence delivery before evidence governance.
- Assuming existing implementation automatically represents current product approval.

## Deferred, not rejected

- Coach-authored factual context.
- Recognition.
- Next Edge.
- Conversation prompts.
- Thread or longitudinal development narrative.
- Archive and season story.
- Possession Chains.
- Game Chaos Mode.
- Why We Won / Why We Lost.
- Practice Plan Generator.
- Advanced recap cards.
- Parent-facing intelligence.
- Athlete-facing review.
- Public or Live Share intelligence.
- Cloud-persisted Review Later.
- Production-grade immutable correction history.
- Broader team-management features.

Deferred concepts must be explicitly re-approved before implementation.

---

# 8. Unresolved Questions

## Product and evidence

1. What exact event set is required for the first stable canonical pipeline?
2. Which possession formulas are approved, and how are they explained?
3. What constitutes sufficient evidence without using arbitrary numeric thresholds?
4. What user-facing language should replace or qualify `Complete` and `Context needed`?
5. How should unobserved context—positioning, assignment, matchup, and off-ball action—be represented?
6. Which calculations are factual derivations and which cross into interpretation?

## Roles and permissions

7. What is the first-class Coach role and how is it verified?
8. Can an admin act as a development-only coach proxy, and under what explicit conditions?
9. Who may add factual context, corrections, notes, or review approvals?
10. Which outputs are visible to parents, trackers, admins, coaches, and athletes?

## Corrections and storage

11. What additive schema will preserve immutable correction history?
12. Should Review Later remain local-only in the first slice?
13. When will review state be persisted across devices?
14. What invalidation behavior is required when events, tags, or context change?

## Sharing and privacy

15. What is the exact minimum-necessary Live Share payload?
16. How should public links expire or be revoked?
17. What content may appear in Share Recap, CSV, backup, and import?
18. What notes or tags are prohibited or restricted?
19. What parental consent, club authorization, and youth-data policies are required before broader rollout?

## Adoption and business

20. How burdensome is live tracking for a parent during a fast game?
21. Which user is the economic buyer: family, team, club, or sponsor?
22. What pilot price and duration create the best validation?
23. What results define a successful pilot?
24. What onboarding is required for reliable event capture?
25. How should coach adoption be measured without requiring coaches to become statkeepers?

## Release readiness

26. Has hosted behavior been verified across authentication, offline capture, sync, end-game save, review, and sharing?
27. What is the rollback plan for the next release?
28. Which branch or PR becomes the accepted implementation path after the intelligence specification?
29. What conditions must be satisfied before PR #15 is replaced, closed, or unfrozen?
30. Which legacy Game Impact and archetype surfaces remain in production and require remediation?

---

# 9. Items That Must Not Be Lost

## Product and implementation evidence

- The deployed LaxHornet repository and Git history.
- `app.html`, `app.js`, `styles.css`, `manifest.json`, `service-worker.js`, and `version.json`.
- Supabase schema, migration, access-control, and setup files.
- Saved-game, event, Live Share, export, import, and backup behavior.
- Event definitions and normalization logic.
- Existing season and review behavior, even where later remediation is required.

## Review design history

- The complete `laxhornet-review-audit-jimi-win-low-impact` screenshot set.
- The review audit document and contact sheets.
- Game snapshot, development actions, talk breakdown, player-profile, timeline, family recap, and next-game focus explorations.
- Screen recordings used to critique Game Review and Season Review.

## Research

- `research/article-notes.md`
- `research/coaching-principles.md`
- `research/conflicting-advice.md`
- `research/event-sequence-analysis.md`
- `research/executive-summary.md`
- crawler code and crawl results;
- raw coaching-source evidence;
- source provenance and conflict notes.

## Brand and market assets

- LaxHornet logos, icons, banner assets, stinger and shield concepts.
- Parent Experience, Player Development, Program Value, Coach Alignment, rollout, and launch-kit materials.
- Club pilot offer, pricing concepts, pitch materials, and monetization discussions.
- Terms of Use and privacy-related drafting.

## MethodNorth alignment

- Product One and post-game-review translation documents.
- MethodNorth product-expression guidance.
- Design-system source maps and provenance.
- Product Alignment Audit and all requirement-level findings.
- Evidence model, disclosure model, architecture plan, migration plan, and backward-compatibility records.

## Current LH-20 intelligence work

- Branch `work/lh20-intelligence-evidence-envelope-v0-1`.
- Base `61cf1a7`.
- Commit `2dfd390`.
- The twelve evidence-envelope specification documents.
- Eligibility, provenance, invalidation, routing, sufficiency, and versioning decisions.
- The decision to keep PR #15 frozen.
- The restriction to private factual review only.
- The prohibition on production release until hosted behavior is verified.

---

# 10. Current Backlog by Authority

## Approved next-work candidates

1. Complete the bounded Event Pipeline and Release Control remediation.
2. Implement or verify the private factual-review evidence envelope.
3. Verify invalidation and regeneration after event correction.
4. Add explicit insufficient-evidence and context-needed states.
5. Verify hosted `track → save → review → share` behavior.
6. Inventory remaining legacy Game Impact grade and archetype surfaces.
7. Define first-class role and authority requirements.
8. Create the production-grade correction-ledger specification.
9. Validate live tracking burden with real adult users.
10. Define pilot success metrics and organization buyer workflow.

## Quarantined backlog

The following work should not begin merely because it was previously discussed:

- recommendation engines;
- athlete-facing intelligence;
- parent-facing interpretive intelligence;
- public intelligence;
- Live Share intelligence;
- player profiles or archetypes;
- practice plans;
- “Why We Won/Lost” conclusions;
- coach-equivalent AI voice;
- numeric evidence sufficiency thresholds;
- production release of unverified intelligence.

---

# 11. Change-Control Procedure

When a new decision is made:

1. Add a dated entry to the decision register.
2. State the decision owner and source conversation, issue, PR, or specification.
3. Mark the previous entry as superseded rather than deleting it.
4. Record whether the decision changes:
   - product intent;
   - doctrine;
   - data model;
   - access policy;
   - disclosure;
   - user-facing language;
   - implementation;
   - deployment.
5. Identify affected files, screens, tests, and release conditions.
6. Confirm whether deployed behavior matches the decision.
7. Preserve dissenting research or unresolved evidence where relevant.

### Decision-entry template

```text
Decision ID:
Date:
Owner:
Status:
Decision:
Reason:
Supersedes:
Affected areas:
Implementation state:
Verification evidence:
Open follow-up:
```

---

# 12. Canonical One-Paragraph Brief

LaxHornet is a mobile-first, offline-capable youth lacrosse stat-tracking product that helps adults see and explain the plays behind the scoreboard. It is the first product implementation and proof point connected to MethodNorth, but it remains a distinct codebase and product operation. Its durable value lies in fast sideline capture, possession and contribution analytics, and a post-game experience that supports recognition, understanding, and constructive conversation. The current implementation direction is intentionally evidence-first: one canonical effective-event source, private factual review, provenance, invalidation, regeneration, and explicit uncertainty states. Letter-grade Game Impact, generated player archetypes, broad recommendations, athlete-facing intelligence, parent-facing interpretive intelligence, and public or Live Share intelligence are not current approved directions. LaxHornet should measure without reducing, assist without replacing the human conversation, and preserve the child’s ownership of development.

---

# 13. Source Record

This register was synthesized from the accessible LaxHornet conversation history and project records, including:

- the six numbered LaxHornet conversation branches;
- early youth-stat-tracker and branding discussions;
- MethodNorth and Project One architecture conversations;
- LaxHornet product-alignment and codebase audits;
- organization and migration records;
- review screenshots and audit assets;
- coaching research files;
- GitHub/Codex Event Pipeline and Release Control work;
- LH-20 intelligence and evidence-envelope work.

**Review rule:** Historical concepts are preserved for provenance but are not approved unless their current status is explicitly marked Canonical or Canonical—Constrained in this register.
