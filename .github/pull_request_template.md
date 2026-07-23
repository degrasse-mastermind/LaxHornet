## Change boundary

- [ ] I identified the authoritative write path.
- [ ] I identified the authoritative read path.
- [ ] I documented what happens offline.
- [ ] I documented retry and duplicate-operation behavior.
- [ ] I considered old installed clients and cache versions.
- [ ] I classified affected games as `personal` or `team_roster`.
- [ ] I recorded the minimum backend capability version.
- [ ] I named the real user journey that proves the change.
- [ ] I verified private notes, tags, account data, and youth data are excluded from public or operational output.
- [ ] I documented the rollback boundary.

## Release safety

- [ ] No production credentials or private data are included.
- [ ] No existing migration was rewritten.
- [ ] Runtime, service worker, asset markers, and `version.json` agree.
- [ ] Required local and managed-preview tests are attached.
- [ ] Production deployment and PR merge remain separately approved actions.
