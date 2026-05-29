# Working Backwards: Migrate auth module to JWT — Filled Example

This is a reference example of a completed Micro PR/FAQ. Use it to understand the expected structure and level of specificity.

```
## Working Backwards: Migrate auth module to JWT
**Version:** v1
**Approved at:** 2026-05-28T14:32:00Z
**Approved by:** user (explicit)

### Press Release

The authentication module now uses stateless JWT tokens instead of server-side
sessions. Users log in, receive a signed token, and all protected routes validate
that token without a database round-trip. Session table lookups are gone. The
change is live, all existing tests pass, and the old session infrastructure has
been removed cleanly.

### FAQ

**Q: Complete signal?**
A: All existing auth integration tests pass green. A new test confirms a valid
JWT is returned on login and accepted on a protected route. Zero session table
queries appear in the query log during a full auth flow.

**Q: Hard boundary?**
A: Writable scope:
- auth/session.ts (delete after backup to auth/session.ts.bak)
- auth/jwt.ts (new file)
- middleware/authenticate.ts (modify)
- .env.example (append JWT_SECRET line only)
- test/auth.integration.test.ts (modify)

**Q: Out of scope?**
A: OAuth/SSO. Refresh token rotation. Any file under src/ui/. Active session
migration (they expire naturally). DB schema changes beyond a deprecation comment.

**Q: Assumptions?**
A: [BLOCKING] All protected routes use middleware/authenticate.ts — no ad-hoc
session checks elsewhere. Violation: halt, list files, report, do not proceed.
[NON-BLOCKING] JWT_SECRET not already in .env.example. Violation: log conflict,
skip append, continue.

**Q: Rollback?**
A: auth/session.ts.bak created before any deletion (first action).
Rollback: restore .bak → git checkout middleware/authenticate.ts → remove JWT_SECRET.
Time: < 5 min. No downtime. No DB changes to reverse.

**Q: Parallel subagents?**
A: Yes.
Agent A — writable: auth/, middleware/authenticate.ts, .env.example (not readonly)
Agent B — writable: test/auth.integration.test.ts only (not readonly)
Sync: B dispatched only after A returns artifact confirming jwt.ts exists and
middleware/authenticate.ts is updated. No shared writable paths.

**Q: Valid completion report?**
A: Agent A: confirmation jwt.ts exists (path + line count), diff summary of
middleware/authenticate.ts changes, confirmation session.ts.bak created before deletion.
Agent B: test runner output (pass/fail counts), confirmation zero session table queries.
Self-reports ("I finished the migration") are not valid.
```
