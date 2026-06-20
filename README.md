# Suitability Audit

**Live:** https://suitability-audit.vercel.app

A bias-detection demo for FINRA Rule 2111 / Rule 2330 suitability
decisions. 5,000 synthetic clients are scored against a 10-product
universe by a deterministic rules engine. A separate audit layer joins
the resulting receipts to protected attributes (kept hidden from the
engine) and surfaces disparate-impact patterns using a four-fifths-rule
analog.

Start at the [bias dashboard](https://suitability-audit.vercel.app/dashboard)
for the audit summary, or [browse the 5,000 receipts](https://suitability-audit.vercel.app/receipts)
to drill into individual decisions.

## What this is

A working demonstration of three things broker-dealer compliance teams
care about under the FINRA 2025 oversight regime:

1. **Per-decision auditability.** Every recommendation produces a
   receipt that names the rule-2111 factors evaluated, the client value,
   the product requirement, and pass/warn/fail status.
2. **Proxy bias detection.** Even when the engine never reads a
   protected attribute, proxy variables (investment experience,
   reported time horizon) can carry disparate impact through the
   pipeline. The audit catches it.
3. **Counterfactual transparency.** Each receipt includes the answer
   to "if the client had stated a slightly different risk tolerance,
   would the recommendation change?"

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind v4
- Pure rules engine — no ML, no external APIs, deterministic
- `seedrandom` for reproducible synthetic data

## Project layout

```
lib/
  types.ts          # Client, Product, Receipt, AuditReport types
  bias-seeds.ts     # Documented bias seed configuration
  rules.ts          # Rule 2111 / 2330 rule functions
  engine.ts         # Scoring and recommendation
  audit.ts          # Disparate-impact analysis
scripts/
  generate-clients.ts
  run-engine.ts
  run-audit.ts
data/
  products.json     # Hand-crafted product master
  clients.json      # Generated, 5000 clients
  receipts.json     # Generated, 5000 receipts
  audit.json        # Generated, audit report
app/
  page.tsx          # Landing
  dashboard/        # Phase 4 — audit dashboard (UI in progress)
  receipts/[id]/    # Phase 5 — single receipt view (UI in progress)
```

## How to run the pipeline

```
npm install
npm run data:all       # generate clients → run engine → run audit
npm run dev            # start the UI
```

The full pipeline takes about a second. Re-run `data:all` whenever
`lib/rules.ts`, `lib/engine.ts`, or `lib/bias-seeds.ts` changes.

## Documented bias seeds

The synthetic generator deliberately encodes two proxy effects that the
engine cannot see directly but that flow through to its decisions. Both
are inspired by patterns documented in FINRA enforcement actions and the
2025 oversight report. Seed magnitudes live in `lib/bias-seeds.ts`.

### Seed 1 — Age proxy

65+ clients are oversampled with:
- `investment_experience = "none"` (45% of 65+ vs ~12% baseline)
- `existing_va_holdings_usd > 0` (55% of 65+ vs ~8% baseline)

Reason: senior clients are disproportionately targeted by annuity
marketing, so prior holdings and low formal experience correlate with
age in real data. The engine's eligibility rules then knock these
clients out of higher-risk products even when their stated risk
tolerance is moderate or above.

### Seed 2 — ZIP proxy

ZIP cluster D clients with growth or growth-and-income objectives are
oversampled with truncated time horizons (capped at 4 years, vs the
default 7–15 years that growth objectives normally produce).

Reason: clients in historically under-served ZIPs are more likely to
have been steered toward shorter horizons regardless of life stage.
The engine then disqualifies them from growth products on the time-
horizon rule, steering them to bond and treasury funds.

## What the audit catches (with current seed values)

Current audit headline:

```
6 disparate-impact patterns detected (3 high-severity, 3 medium-severity)
```

The selection-rate ratio is the cohort's "favorable outcome rate"
(received any suitable recommendation) divided by the rest of the
population's. The four-fifths rule from EEOC adverse-impact guidance
flags anything below 0.80. Findings include:

| Cohort | Stated RT | Ratio | Severity |
| --- | --- | --- | --- |
| age_band=65_plus | aggressive | 0.18 | high |
| zip_cluster=d | moderate_aggressive | 0.52 | high |
| zip_cluster=d | aggressive | 0.56 | high |
| age_band=65_plus | moderate_aggressive | 0.69 | medium |
| age_band=65_plus | moderate | 0.73 | medium |
| zip_cluster=d | moderate | 0.78 | medium |

## What's intentionally in scope

- Rules-based engine, no ML — the point is to show that even a fully
  explainable, deterministic system carries disparate impact through
  its proxies.
- A small commission tilt in the scoring function (see `lib/rules.ts`)
  models advisor-incentive bias. This is the realistic mechanism by
  which factor-by-factor-compliant recommendations produce cohort-
  level disparities.
- Liquidity rule is a hard fail for VAs (real surrender penalty) and a
  warn for mutual funds (volatility, no lock-up).

## What I learned building a FINRA Rule 2111 audit tool

A few things that didn't show up in the FINRA guidance but became
obvious once I had a working pipeline:

**The engine being "blind" to protected attributes is not the same as
the engine being fair.** I never let `age_band`, `zip_cluster`, or
`gender` reach the engine — they live in a separate table that only
the audit layer joins on. The engine still produces disparate impact,
because proxy variables it *is* allowed to read (investment
experience, prior VA holdings, reported time horizon) correlate with
those protected attributes in the real world. Input scrubbing is the
easy part. Proxy detection is the actual job.

**The "no recommendation" outcome is itself a disparate-impact
surface.** I expected to find bias in *which* product gets recommended.
The loudest finding turned out to be in *whether* a recommendation
happens at all — 31% of ZIP-cluster-D growth-objective clients got
"no suitable product" vs. 13% baseline. A compliance framework that
only measures the contents of recommendations misses this entirely.
Locking someone out of the shelf is an action, not a non-action.

**Four-fifths is borrowed law.** FINRA does not prescribe a numeric
disparate-impact threshold for suitability decisions. I had to import
the 0.80 selection-rate ratio from EEOC employment-discrimination
guidance and use it as an analog. That's defensible — but it means
the threshold *itself* is a methodological choice the firm is
making, and it should be documented as such. The dashboard surfaces
the ratio rather than just a binary flag for this reason.

**The bias mechanism that matters is small and structural, not
egregious.** I included a deliberately small commission tilt in the
scoring function — a few points on a 100-point scale. Factor by
factor, every recommendation passes its Rule 2111 checks. The
cohort-level disparity emerges purely from that tilt interacting
with which clients happen to be eligible for high-commission
products. This matches the pattern in FINRA enforcement actions: no
individual sale is illegal; the *aggregate* is the violation.
Auditing for individual rule violations would never have caught it.

**Counterfactual fragility is a real number, and it's high.** 37% of
the 5,000 receipts flip to a different recommendation if the client's
stated risk tolerance moves one notch up. That's not a bug — it's a
property of any threshold-based engine. But it has a compliance
implication: a third of recommendations are sensitive to a single
self-reported answer on a questionnaire, which is exactly the kind
of soft input that drift, framing effects, or advisor coaching can
move. The receipt-level counterfactual block exists so this
sensitivity can be flagged and reviewed before transacting.

**A deterministic, fully transparent engine is not automatically
explainable.** Every rule is in plain TypeScript with a citation. And
debugging "why didn't this client get a recommendation?" was still a
ten-minute exercise the first few times — looking at the client,
walking the rule list, finding which rule fired, reasoning about why.
The receipt artifact (factor-by-factor pass/warn/fail with rationale
and client value) is what makes the engine actually inspectable in
practice. Transparency is a feature, not an emergent property of
"using rules instead of ML."

**Product design is part of the audit surface, not separate from it.**
VA-005 in my product master is explicitly designed to be sold to
seniors — narrow age range (60–85), `min_experience: "none"`, high
commission. Every property is individually justifiable. Together,
they form a product that the engine will preferentially recommend to
exactly the demographic FINRA Rule 2330 flags for heightened
scrutiny. The audit needs to consider not just the engine logic but
the shape of the product shelf the engine is matching against.

## References

- FINRA Rule 2111 — Suitability
- FINRA Rule 2330 — Members' Responsibilities Regarding Deferred
  Variable Annuities
- EEOC Uniform Guidelines on Employee Selection Procedures, §1607.4(D)
  — Four-fifths rule for adverse impact
- FINRA 2025 Annual Regulatory Oversight Report — suitability and
  senior-investor risks

## Status

- [x] Phase 0 — Scaffold
- [x] Phase 1 — Data layer (types, products, generator)
- [x] Phase 2 — Suitability engine
- [x] Phase 3 — Proxy audit
- [x] Phase 4 — Dashboard UI
- [x] Phase 5 — Receipt UI
- [x] Phase 6 — Appeal artifact
- [x] Phase 7 — Deploy (live on Vercel)
