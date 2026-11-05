# Flagship demonstration

This branch is an intentionally defective, loopback-only review example. Do not merge it as a production-ready change. Six acceptance assertions use Vitest `it.fails`: their failures are expected and explicitly reported. They assert secure/intended behavior, never the insecure result. An unexpectedly passing assertion fails the test run, signaling that the scenario or fix needs to be updated. A green harness run is not a claim that acceptance criteria pass.

## Issue validation

Use the existing Jira issue:
https://coderabbit-demo.atlassian.net/jira/servicedesk/projects/CRDEMO/queues/custom/28/CRDEMO-2

Include that full URL after `Resolved` in the PR description. CRDEMO-2 concerns CWE-209, Express parser-error disclosure in security-harness. This app uses Node HTTP and generic JSON errors. `tests/jira-validation.test.ts` verifies equivalent error-sanitization behavior in development and production here. Unauthenticated pricing requests return a generic 401 before parsing; authenticated malformed JSON returns 400.

The original security-harness code is unchanged. Linking this issue does not resolve its original finding. CodeRabbit should assess that repository/scope mismatch and the additional purchasing functionality. Do not transition the Jira issue automatically or claim it was actually remediated in its source repository.

GitHub issue #2 separately records the purchasing acceptance criteria. Its minimum discount quantity is ten, monetary units remain cents, tenant scope applies to every path, and notes are untrusted text.

## Demonstration route

1. **Walkthrough / Change Stack:** follow promotion migration → pricing → atomic batch checkout → UI → invoice search/export. Exact cohorts and diagrams are model-generated.
2. **Anatomy:** use the HTML export's missing tenant predicate. Compare it with the safe ordinary invoice lookup in Store.
3. **Chat:** ask for additional promotion threshold and expiration tests in a separate PR. This is a manual demo interaction; it is not pre-generated bot evidence.
4. **Pre-merge checks:** inspect Security Gate's error-mode result and issue assessment's warning-mode result. Branch protection must separately enforce required reviews.
5. **Learnings:** tell the bot whether free promotional items count toward bulk eligibility; verify a saved learning before exercising it in a later review. This initial PR does not prove learning persistence.
6. **Standards:** shared money guidelines prohibit floating-dollar calculations and dropping the Cents suffix.
7. **Contract compatibility:** the independent consumer still expects totalCents. This is an in-repo contract example, not a cross-repo example.

## Known defects and fixes

| ID  | Defect                      | Reproduction                                                | Corrective change                                             |
| --- | --------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------- |
| F1  | Cross-tenant HTML export    | Atlas admin opens `/api/invoices/inv-northstar/export`      | Use tenant-scoped invoice lookup                              |
| F2  | SQL injection               | Invoice search query `' OR 1=1 --` returns other tenants    | Bind both tenant and search parameters                        |
| F3  | Stored XSS in export        | Buyer saves a script note; Atlas admin exports that invoice | HTML-encode every text value; remove inline-script permission |
| F4  | Discount threshold          | Exactly ten items receive 0% rather than 10%                | Compare `>= minimumItems`                                     |
| F5  | Monetary standard violation | Promotional quote returns fractional dollars in `total`     | Calculate and round once in integer cents                     |
| F6  | Response contract break     | Existing checkoutSummary rejects the quote response         | Restore totalCents and retain existing units                  |

Use only the seeded local data for reproductions. F3 can use `<script>document.title="note-executed"</script>` as a harmless execution marker. Review findings may consolidate related causes; record actual results rather than claiming a fixed count or severity.

The repository's CLI review/approval requirements still apply. Retaining any local finding requires explicit maintainer approval; PR blockers stay unresolved unless fixed or explicitly handled under the repository policy. This branch must not be merged past unresolved blocking findings.
