# AGENTS.md

Before doing any task in this repository, read and follow:
- CODEX_RULES.md
- BUG_AUDIT.md, if it exists
- QA_CHECKLIST.md, if it exists
- IMPLEMENTATION_PLAN.md, if it exists
- MISSING_DECISIONS.md, if it exists

This project is a production financial SaaS. Do not make broad or destructive changes without explaining the risk first.

Mandatory workflow:
1. Read CODEX_RULES.md before analysis or implementation.
2. If the task is ambiguous, create a recommendation and wait for approval.
3. Do not mix bug fixing, refactoring, redesign, and new features in the same change.
4. Do not modify database schema, Supabase RLS policies, API contracts, or authentication logic without explicit approval.
5. For every implementation, provide:
   - files modified
   - reason for the change
   - risks
   - how to test
   - rollback notes if relevant
6. Repository files and technical docs should be written in English.
7. Final explanations to the owner should include a simple Spanish summary for a non-programmer.

Current priority:

Phase 1:
- stabilize the app
- fix bugs
- fix slow module loading
- fix portfolio loading
- make every visible button/action work or be clearly disabled
- remove infinite loading states
- improve Supabase error handling
- validate production readiness

Phase 2:
- complete redesign
- new visual language
- new motion system
- new dashboard structure
- new modals, notifications, forms, tables, charts, and navigation
- no incremental polishing of the current UI
