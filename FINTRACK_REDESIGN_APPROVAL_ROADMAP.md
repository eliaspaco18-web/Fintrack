# FinTrack Redesign Approval Roadmap

**Purpose:** Owner-facing map for controlling the full redesign rollout

**Related source of truth:** `FINTRACK_APPROVED_REDESIGN_BLUEPRINT.md`

**Approved visual direction:** Portfolio reference design

**Approved identity:** FT Ligature, logo proposal 12

**Implementation status:** Not started

## 1. How this roadmap is used

The redesign advances through approval gates. A gate is not complete until both conditions are true:

1. **Technical acceptance:** financial parity, functionality, states, responsive behavior, accessibility, and regression checks pass.
2. **Owner acceptance:** the visible result, information hierarchy, density, interaction, and product direction are approved.

No later gate begins automatically. After each delivery, work stops at **Awaiting owner approval**. The owner may:

- approve the gate;
- approve it with documented follow-up changes;
- request a focused revision;
- reject it and restore the previous accepted state;
- postpone a module without blocking unrelated safe modules.

Each implementation gate is isolated in its own branch or pull request. Bug fixes, data decisions, shared design infrastructure, and individual module redesigns remain separate.

## 2. Status legend

| Status | Meaning |
|---|---|
| `LOCKED` | Direction already approved by the owner |
| `READY` | Defined and ready to start after owner authorization |
| `IN PROGRESS` | Active implementation or verification |
| `TECHNICAL REVIEW` | Implementation complete; engineering/QA evidence in progress |
| `OWNER REVIEW` | Technical gate passed; waiting for owner decision |
| `APPROVED` | Owner accepted this gate |
| `REVISION` | Focused changes requested; scope remains the same |
| `BLOCKED` | Cannot advance because a required decision or defect remains |
| `DEFERRED` | Intentionally postponed without being discarded |

## 3. Executive map

```text
LOCKED DIRECTION
Portfolio visual language + FT Ligature logo 12
        │
        ▼
GATE 0 — APPROVAL MAP
Confirm sequence, approval method, and stop rules
        │ owner approval
        ▼
GATE 1 — STABILITY AND FINANCIAL INTEGRITY
Loading, actions, errors, currency, schedules, attachments, factual charts
        │ owner receives safety report
        ▼
GATE 2 — BRAND SYSTEM
FT Ligature assets, wordmark, favicon, app icon, inverse/mono variants
        │ owner visual approval
        ▼
GATE 3 — DESIGN FOUNDATIONS
Manrope, DM Mono, colors, dark mode, spacing, radius, shadow, motion, charts
        │ owner system approval
        ▼
GATE 4 — APP SHELL
Sidebar, topbar, navigation, page grid, desktop/tablet/mobile behavior
        │ owner shell approval
        ▼
GATE 5 — SHARED INTERACTIONS
Tables, filters, forms, modals, drawers, details, loading/error/empty states
        │ owner component approval
        ▼
GATE 6 — PORTFOLIO PILOT
First complete real module in the approved language
        │ owner module approval
        ▼
GATE 7 — DASHBOARD
Primary executive experience and financial visualizations
        │ owner flagship approval
        ▼
GATE 8 — TRANSACTIONS
Register first; create/edit/detail second
        │ two owner approvals
        ▼
GATE 9 — FINANCIAL POSITION AND PLANNING
Assets → Budgets → Credits, approved one at a time
        │ three owner approvals
        ▼
GATE 10 — COMMITMENTS
Receivables → Payables, approved separately
        │ two owner approvals
        ▼
GATE 11 — SUPPORTING MODULES
Recurring templates → Alerts → Settings
        │ three owner approvals
        ▼
GATE 12 — CONTROL AND ENTRY SURFACES
Admin → Developer/status → Authentication/public/system
        │ separate owner approvals
        ▼
GATE 13 — FINAL CONSISTENCY AND RELEASE READINESS
Remove compatibility layer, full regression, accessibility, preview release
        │ final owner approval
        ▼
REDESIGN READY FOR CONTROLLED RELEASE
```

## 4. Current approval board

| Gate | Deliverable | Current status | Owner decision needed |
|---:|---|---|---|
| Direction | Portfolio language + FT Ligature 12 | `LOCKED` | None |
| 0 | Approval roadmap | `OWNER REVIEW` | Approve the sequence and stop rules |
| 1 | Stability and financial integrity | `READY` | Authorize the first verification/fix work package |
| 2 | Brand system | Not started | After Gate 1 safety approval |
| 3 | Design foundations | Not started | After brand approval |
| 4 | App shell | Not started | After foundation approval |
| 5 | Shared interactions | Not started | After shell approval |
| 6 | Portfolio pilot | Not started | After shared-system approval |
| 7 | Dashboard | Not started | After Portfolio approval |
| 8 | Transactions | Not started | After Dashboard approval |
| 9 | Assets, Budgets, Credits | Not started | One approval per module |
| 10 | Receivables, Payables | Not started | One approval per module |
| 11 | Recurring, Alerts, Settings | Not started | One approval per module |
| 12 | Admin, developer/status, auth/public | Not started | One approval per surface group |
| 13 | Final QA and release readiness | Not started | Final release decision |

## 5. Gate 0 — Approve the process

### Purpose

Agree on how the redesign will be controlled before code changes begin.

### Deliverable

- This roadmap.
- The detailed implementation blueprint.
- Explicit stop-and-approval rules.
- The order of technical and visual work.

### Owner reviews

- Is the sequence understandable?
- Are Portfolio and Dashboard correctly prioritized?
- Is one-module-at-a-time approval acceptable?
- Is it acceptable that stability and financial-integrity fixes come before visual implementation?

### Exit decision

The owner may respond:

> Approve Gate 0. Start Gate 1.

No application code changes are included in Gate 0.

## 6. Gate 1 — Stability and financial integrity

### Why it comes first

A premium interface must not present incorrect totals, unsupported actions, fabricated history, or incomplete schedules more convincingly. This gate separates correctness work from redesign work.

### Internal work packages

Each item is its own change and review:

1. Complete authenticated QA and module loading/error/action verification.
2. Verify Portfolio loading, retry, bank-entity partial failure, and infinite-loading protection.
3. Correct USD loan exchange-rate submission.
4. Preserve all loan schedule components exactly.
5. Decide and correct unsupported attachment behavior.
6. Correct Asset status filtering and custom type detail.
7. Correct Credit detail currency and available-amount presentation.
8. Decide Budget series edit/delete scope.
9. Decide safe Receivables/Payables currency presentation.
10. Remove the implication that the interpolated Portfolio curve is historical data.

### What the owner receives

- A concise issue report for each work package.
- Before/after behavior evidence.
- Files changed.
- Financial and functional tests.
- Risk and rollback instructions.
- A final `Safe to begin visual transformation` recommendation.

### Owner approves

- Product decisions that cannot be inferred safely.
- Whether unsupported attachments should be implemented in a separate project or visibly disabled.
- Whether Receivables/Payables initially use currency-separated documented lines.
- Whether Budget grouped actions remain record-scoped or become series-scoped in a separately approved change.

### Exit criteria

- No unresolved critical loading/action defect blocks the redesign.
- No known redesigned headline would use a misleading financial value.
- Every unresolved data capability has an explicit deferred state.
- `QA_CHECKLIST.md` stability gates required for visual work pass.

### Stop point

Work stops after the stability report. Brand implementation does not begin without owner authorization.

## 7. Gate 2 — Brand system

### Scope

Logo and identity assets only. No screen redesign.

### Deliverable

- Canonical FT Ligature SVG.
- Horizontal FinTrack wordmark.
- Compact mark.
- Light, dark, monochrome, and fallback variants.
- Favicon, app-icon, email/PDF-safe samples.
- Size, clear-space, and misuse specification.
- Visual comparison sheet.

### Owner reviews

- Shape and optical balance.
- Readability at small size.
- Teal, flow green, and gold-node balance.
- Wordmark spacing.
- Light and dark presentation.

### Technical checks

- Vector rendering.
- Accessibility label behavior.
- No clipped or stretched asset.
- No functional route change.

### Exit decision

Owner approves the final brand asset set before fonts/tokens are installed app-wide.

## 8. Gate 3 — Design foundations

### Scope

The complete visual grammar before full screens are redesigned.

### Deliverable

- Manrope UI typography.
- DM Mono financial typography.
- Light and dark color tokens.
- Spacing, radius, border, shadow, layer, and focus tokens.
- Buttons, fields, selections, status badges, and panel samples.
- Recorded / Scheduled / Modeled chart grammar.
- Chart legends, tooltips, axes, loading, empty, and error samples.
- Motion samples and reduced-motion behavior.
- A review page or static HTML showing the complete system without mock production claims.

### Owner reviews

- Overall elegance and identity.
- Typography and numerical readability.
- Light/dark visual character.
- Panel density and roundness.
- Chart clarity and sophistication.
- Motion feel.

### Technical checks

- WCAG contrast.
- No theme flash.
- No layout shift from fonts.
- Existing pages remain usable through compatibility tokens.
- No new financial calculation.

### Exit decision

The design system is frozen for the Portfolio pilot. Changes after this point require a documented token/system revision rather than local module improvisation.

## 9. Gate 4 — App shell

### Scope

The frame shared by all authenticated modules.

### Deliverable

- 218px expanded sidebar and compact state.
- Functional route grouping and badges.
- FT Ligature brand lockup.
- Route-aware topbar.
- 12-column content grid.
- Desktop, iPad/tablet, and iPhone/mobile navigation behavior.
- Light and dark mode.
- Keyboard and reduced-motion behavior.

### Owner reviews

- Sidebar usefulness and visual proportion.
- Navigation grouping.
- Topbar clarity.
- Balance between navigation and content.
- Desktop/tablet/mobile behavior.

### Technical checks

- Every route and permission remains available.
- No duplicate create actions.
- No duplicate network requests caused by responsive markup.
- Drawer and compact sidebar work with keyboard/touch.
- No module behavior is changed.

### Exit decision

The shell becomes the fixed frame for subsequent modules.

## 10. Gate 5 — Shared interactions

### Scope

Reusable behavior-heavy patterns before redesigning Portfolio.

### Sub-gates

1. Tables, search, filters, sorting, pagination, and row actions.
2. Forms and financial inputs.
3. Modals, confirmation dialogs, and drawers.
4. Detail-page anatomy.
5. Loading, partial error, error, first-run empty, and filtered empty states.

### Deliverable

- Interactive component review page.
- Desktop/tablet/mobile examples.
- Light/dark examples.
- Keyboard and touch behavior.
- Motion examples.
- Compatibility evidence using current props and actions.

### Owner reviews

- Usability and density.
- Form clarity.
- Table readability.
- Modal/drawer proportions.
- Empty/error tone.

### Exit decision

Shared interactions are approved before a complete module is transformed.

## 11. Gate 6 — Portfolio pilot

### Why Portfolio is first

It is the approved visual reference, has a representative mix of KPIs, charts, filtering, account records, create/edit flows, statuses, currencies, and responsive behavior, and can validate the full system before the Dashboard is rebuilt.

### Deliverable

- Complete real Portfolio module in the approved language.
- Current PEN and USD position.
- Current account/entity/type composition.
- Account register and filters.
- Create/edit/status/delete behavior.
- Detail/drawer behavior.
- Desktop, iPad, and iPhone layouts.
- Light/dark modes.
- Loading/error/empty/large-data states.

### Important product condition

The visual must not display an interpolated curve as historical balance. Phase 1 uses a truthful current-position or opening-versus-current visualization.

### Owner reviews

- Is this the visual standard for the rest of FinTrack?
- Are sidebar/content proportions correct?
- Are values and charts understandable?
- Is the module sufficiently premium without becoming decorative?
- Does mobile preserve the most important tasks?

### Technical checks

- Every existing Portfolio action passes.
- Native currency and technical accounts remain correct.
- No API or financial calculation changes are bundled.
- Accessibility and performance gates pass.

### Exit decision

Portfolio becomes the implementation reference for all later modules.

## 12. Gate 7 — Dashboard

### Scope

The flagship experience, built only after the design system and Portfolio prove the language in real code.

### Deliverable

- Current position and monthly result.
- Income/expense/result flow visualization.
- Documented upcoming financial events.
- Expense composition.
- Net-worth composition.
- Budget and credit utilization.
- 30/60/90-day modeled outlook.
- Account/liquidity distribution.
- Recent activity and factual alerts.
- Clear Recorded / Scheduled / Modeled distinction.
- Desktop, iPad, iPhone, light, dark, loading, error, empty, and large-data states.

### Owner reviews

- Can the situation be understood in three seconds?
- Does it feel like the financial command center of FinTrack?
- Are charts useful rather than decorative?
- Is the density rich but controlled?
- Are obligations and opportunities visible without excessive text?

### Technical checks

- Every value reconciles with existing endpoint fixtures.
- Partial failure does not blank the full dashboard.
- No mixed-currency or false-history claim.
- Existing deeper tabs and drill-downs remain available until separately approved.

### Exit decision

The Dashboard becomes the flagship reference for information-rich screens.

## 13. Gate 8 — Transactions

Transactions is split into two approvals because it has the largest interaction surface.

### Gate 8A — Register

Deliverable:

- search/filter/saved-view command bar;
- desktop ledger;
- mobile record cards;
- pagination, sorting, bulk action, import/export;
- inspection drawer/detail access.

Owner approves readability, density, and action discoverability.

### Gate 8B — Create, edit, and detail

Deliverable:

- every operation type;
- financial field hierarchy;
- conditional sections;
- exchange-rate and original/equivalent presentation;
- nested records;
- attachments;
- edit and detail states;
- mobile full-screen form behavior.

Owner approves form clarity and confidence. Technical approval requires every operation matrix to pass.

## 14. Gate 9 — Financial position and planning modules

Each module is implemented and approved independently.

### Gate 9A — Assets

- Purchase-versus-current value.
- Composition by custom asset type.
- Inventory register and detail.
- No fictional valuation history.

### Gate 9B — Budgets

- Budget execution bullet charts.
- Factual exception panel.
- Series/period register and detail.
- Existing formulas and action scope preserved.

### Gate 9C — Credits

- Separate Cards, Loans, and Lines experiences.
- Currency-safe capacity.
- Upcoming statements/installments.
- Type-specific detail and schedule.

Each sub-gate stops for owner review before the next module begins.

## 15. Gate 10 — Commitments

### Gate 10A — Receivables

- Currency-separated documented receivable position.
- Maturity ladder.
- Debtor concentration.
- Individual receivable register.
- Collection action and debtor detail.

### Gate 10B — Payables

- Currency-separated documented payable position.
- Maturity and liquidity-pressure ladder.
- Creditor concentration.
- Individual obligation register.
- Payment action and creditor detail.

These modules share visual primitives but are approved separately because their transaction directions and business meanings are opposite.

## 16. Gate 11 — Supporting modules

### Gate 11A — Recurring templates

Reusable-template library without unsupported calendar or automatic-scheduling claims.

### Gate 11B — Alerts

Factual attention inbox with overdue, due-soon, informational, and read/unread distinctions.

### Gate 11C — Settings

Profile, security, preferences, notifications, account/data, export, and support hierarchy.

Each receives its own functional, responsive, and owner approval.

## 17. Gate 12 — Control and entry surfaces

Separate approvals:

1. Admin catalogs and management.
2. Developer and module-status surfaces.
3. Login, registration, and recovery.
4. Landing, maintenance, not-found, global error, and release surfaces.

Role gating, authentication, redirects, and security are never changed as an incidental part of visual work.

## 18. Gate 13 — Final consistency and release readiness

### Scope

- Remove only proven-unused compatibility styles/components.
- Remove temporary feature flags.
- Run full production-readiness QA.
- Compare every module against the approved system.
- Validate preview deployment.
- Prepare controlled release and rollback plan.

### Owner receives

- Full app review link.
- Route-by-route visual checklist.
- Desktop/tablet/mobile and light/dark evidence.
- Financial parity report.
- Accessibility and performance report.
- Known deferred data capabilities.
- Release and rollback recommendation.

### Final decision

The owner explicitly approves or postpones release. Passing technical QA does not authorize production release by itself.

## 19. Standard approval packet after every gate

Every gate delivery contains:

1. **What changed** — short scope statement.
2. **What did not change** — protected behavior and data.
3. **Files modified** — exact list.
4. **Visual evidence** — web, iPad, and iPhone; light/dark where applicable.
5. **Interaction evidence** — motion and important flows.
6. **Financial parity** — values, currency, status, dates, and linked effects.
7. **State evidence** — loading, empty, filtered empty, error, partial error, success.
8. **Tests** — automated and manual evidence.
9. **Risks** — remaining concerns.
10. **Rollback** — exact safe return path.
11. **Open decisions** — owner choices required now, not later.
12. **Approval request** — one clear decision.

## 20. Owner approval checklist

The owner does not need to review code line by line. For each visible gate, answer:

- Does this look and feel like the approved FinTrack direction?
- Is the most important financial information first?
- Can the screen be understood quickly?
- Are density and text sizes comfortable?
- Are desktop, iPad, and iPhone layouts acceptable?
- Are light and dark modes acceptable?
- Are interactions clear and restrained?
- Is anything important missing or overemphasized?
- May the team use this result as the reference for the next gate?

Technical reviewers independently confirm correctness, security, functionality, accessibility, and performance.

## 21. Change-control rules

- Feedback inside a gate is revised inside the same gate.
- A new feature request is logged separately; it does not silently enter a redesign PR.
- A financial/data decision is never inferred from a visual preference.
- Approval of one module does not authorize changes to another.
- Approved shared tokens are not locally overridden without system-level review.
- If a shared foundation changes after Portfolio approval, Portfolio and all accepted modules are regression-tested.
- A blocked module may be deferred while independent safe work continues.
- Production release always requires a separate explicit decision.

## 22. Decisions scheduled before their dependent gates

| Decision | Needed before | Recommended safe default |
|---|---|---|
| Attachment product/endpoint strategy | Assets, Receivables, Payables | Clearly disable unsupported upload controls |
| Debtor/creditor initial-debt currency | Receivables, Payables, Dashboard debt totals | Exclude ambiguous initial debt from currency totals; show documented rows separately |
| Budget series edit/delete scope | Budgets | Keep action explicitly record/period-scoped |
| Portfolio history contract | Future Portfolio history | Use current-position/opening-versus-current visual; defer history |
| Dashboard tab consolidation | After redesigned Dashboard proves parity | Retain existing deeper tabs initially |
| Optional sidebar financial summary | Shell | Omit if it delays shell or adds noise |
| New chart or motion dependency | Design foundations | Use existing Recharts, custom SVG, and CSS |

## 23. Recommended first move

After Gate 0 approval, begin with **Gate 1A: stability and evidence**, not visual implementation.

The first work package should:

1. run the remaining authenticated QA checks;
2. validate current Portfolio loading, retry, and partial-error behavior;
3. verify every visible Portfolio action;
4. record the known financial-content blockers as separately scoped changes;
5. deliver a prioritized safety report;
6. request owner authorization for the first focused correction.

This establishes a trustworthy baseline and prevents the redesign from concealing existing defects.

## 24. Approval phrase to start

To authorize the next step without authorizing redesign implementation, the owner can respond:

> I approve Gate 0. Start Gate 1A: stability and evidence. Do not begin brand or visual implementation until I approve the Gate 1 report.
