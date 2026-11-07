# Vercel response fixtures

These fixtures preserve the response shape observed through read-only Vercel deployment API lookups on 2026-11-07. Hostnames, deployment/project IDs, repository identity, refs, and commit identifiers are anonymized. `ready-preview.json` preserves the real `READY` + `target: null` + nested `project.id` shape. `ready-production.json` preserves the Production detail shape. `canceled-preview.json` preserves the canceled Preview state shape.

The Preview tests add only the `githubPullRequest` and `gitTreeSha` metadata fields that the new workflow passes to `vercel deploy --meta`; they verify that actual Vercel response shape together with workflow-bound provenance.
