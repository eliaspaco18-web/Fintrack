# CODEX_RULES.md

## Project context

This is a production personal finance SaaS called FinTrack.
It uses GitHub, Supabase, and Vercel.
The app is already live, so stability comes before redesign.

## Non-negotiable rules

1. Never modify production directly.
2. Never mix bug fixing, refactoring, redesign, and new features in the same task.
3. Never change database schema without explicit approval.
4. Never change Supabase RLS policies without explicit approval.
5. Never change authentication logic without explicit approval.
6. Never change API contracts without documenting impact.
7. Never delete code unless you prove it is unused.
8. Never redesign while critical bugs remain.
9. Every visible button/action must be functional, clearly disabled, hidden by permission, or documented as pending decision.
10. Every module must handle loading, error, empty, and success states when applicable.

## Stability priorities

- Fix slow module loading.
- Fix portfolio loading.
- Fix broken buttons, links, modals, menus, and forms.
- Remove infinite loading states.
- Surface Supabase errors clearly.
- Check routes, layouts, auth guards, and session handling.
- Validate Vercel build and preview deployment.
- Keep mobile and responsive behavior working.

## Redesign priorities after stability

- Do not polish the current UI.
- Create a new design language.
- Create a design system before redesigning screens.
- Create a motion system before adding animations.
- Redesign one module per branch/PR.
- Keep financial clarity above decoration.

## Required response format after implementation

- Summary
- Files modified
- Why the change was needed
- Risks
- How to test
- Rollback notes
- Spanish explanation for a non-programmer
