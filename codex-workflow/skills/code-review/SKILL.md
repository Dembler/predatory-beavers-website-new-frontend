---
name: code-review
description: Independently review an agent-workflow ticket or final implementation against requirements, changed code and verification evidence; produce findings and a verdict tied to the reviewed snapshot.
---

# Code review

Read the request, spec, relevant source and diff, check results and unresolved findings.
Use [the review contract](../agent-workflow/references/runtime.md).

1. Use an agent that did not implement the reviewed work. Prefer an independent initial
   context with source references and criteria. Retain previous findings for follow-up
   review so creating a fresh agent does not lose unresolved defects.
2. Review behavior, project architecture, integration contracts, regressions and test
   sufficiency in proportion to the change. Read surrounding code where needed.
   Do not accept the implementer's summary as proof.
3. Obtain the current snapshot from the runtime. Confirm the required checks cover it.
   If code changes during review, inspect the new version and refresh stale checks.
4. Report findings first, ordered by severity, with path/line, concrete consequence,
   evidence and fix direction. Distinguish reproduced defects from source-based risks.
5. Record `approve` only when no blocking findings remain. Otherwise record
   `changes_requested` with actionable findings and return to implementation.
   Reviewers do not silently fix the code they are approving.
6. Final review follows combined verification and covers the final source snapshot.
   After approval, the coordinator calls `complete`. Any code change requires renewed
   affected verification and review.

The verdict is an advisory and workflow decision. It does not create a Git/GitLab merge
blocker, publish comments, merge, push or deploy. Mention actual unverified acceptance
requirements in the result rather than hiding them behind a green verdict.
