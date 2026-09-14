# PRD Section Reference
**Number style:** Always use digits, never spelled-out numbers ("30%" not "thirty percent"). Precision matters — agents cannot measure precision with words.
## Overview (3-5 sentences MAX)

A concise summary that fits on one screen. If it requires scrolling, cut it.

**Sentence templates:**

1. Context + problem being solved. "Marketing teams spend 8+ hours per week manually configuring SMTP connections and testing deliverability."
2. Proposed solution approach. "This tool provides a single interface for SMTP configuration, campaign sending, and delivery analytics."
3. Why now / business value. "Recent changes to email provider policies have made manual credential management error-prone and costly."
4. (optional) Target user segment. "Primary audience is marketing managers who send newsletters but lack infrastructure team support."
5. (optional) Key differentiator. "Unlike existing tools, this focuses exclusively on SMTP management rather than bundling full CRM features."

**Anti-patterns:**

- Feature lists masquerading as overview ("We will build SMTP config, campaign composer, and analytics")
- Technical implementation hints ("using Node.js with nodemailer library")
- More than 5 sentences
- Starting with "This PRD covers..." or "The purpose of this document is..."
- Background that belongs in Problem section

**Example:**

> Marketing managers waste 8+ hours weekly on SMTP troubleshooting and credential rotation. This tool centralises SMTP configuration, sends campaigns, and monitors delivery — all in one interface. Recent DNS policy changes have made manual email setup increasingly fragile. The primary audience is newsletter managers without dedicated infrastructure support. Unlike full CRM platforms, this tool solves only the email-sending layer.

---

## Problem

Establish why something needs building. A well-defined problem keeps the team aligned when requirements change.

**Template:**

- **Current state:** What happens today. Describe the existing workflow end-to-end.
- **Pain points:** Specific frustrations, errors, inefficiencies caused by the current state. Name exact costs (time lost, money wasted, errors committed).
- **Evidence:** Any data backing the pain. Metrics, survey results, support tickets, anecdotal evidence marked as such.
- **Why now:** Catalyst event, threshold crossed, opportunity window closing. What changed that makes this urgent?

**Key principle:** The stronger the problem definition, the less scope creep. Stakeholders reference this section when evaluating feature requests.

**Note:** Present evidence and urgency as part of the narrative — do NOT create "Evidence" or "Why Now" as separate sub-headings under Problem.

---

## Goals

Outcome-focused statements. Every goal must be measurable. These are what the product achieves, not what you build.

**Format:** Each goal has two parts:

1. **Goal statement:** Measurable outcome desired. "Reduce onboarding time from 45 minutes to under 10 minutes."
2. **Rationale:** Why this outcome matters to the business. "Faster onboarding increases Day-7 retention by an estimated 20%."

**Examples of good goals:**

- "Reduce onboarding completion time from 45 min to under 10 min"
- "Decrease cart abandonment rate by 15% within Q3"
- "Achieve 97% email delivery success rate on first attempt"

**Anti-examples (these are NOT goals):**

- "Build a wizard" — this is a feature
- "Make it faster" — unmeasurable
- "Improve user satisfaction" — how will you measure improvement?
- "Ship by October" — this is a date, not a goal

---

## Non-Goals

Explicit exclusions with reasoning. Every non-goal must answer "why are we saying no?"

**Format:**

- Item A: because [reason]
- Item B: because [reason]

**Tag system:**

- `[deferred]` — We'll do it later IF v1 succeeds. Not excluded forever.
- `[out of scope]` — Never doing this, by design. Permanent exclusion.

**Why non-goals matter:** They prevent scope creep. They give stakeholders a contract to push back on feature requests. Without them, every request becomes a renegotiation.

**Example:**

- Mobile app support [deferred]: because we need v1 stability before platform expansion
- Multi-language support [out of scope]: because English-only launch reduces initial complexity 60%
- Legacy browser support (IE11) [out of scope]: because usage is below 0.1% and maintenance cost exceeds benefit

---

## Target User

Who benefits, their context, their current workaround. Never say "users" alone — be specific.

**Include:**

- **Primary user role:** "Marketing managers sending weekly newsletters"
- **Their current workflow/problem:** How they handle this today and where it breaks
- **Frequency of use:** Daily, weekly, monthly — sets expectations for simplicity vs power features

**Anti-pattern:** "All users" or "Everyone". Vague audiences produce vague products.

---

## Core Features

High-level capabilities ONLY. No user stories, technical specs, data models, API endpoints, or implementation details.

**Format:** Simple bullet list with brief capability description.

**Example:**

- SMTP configuration with connection testing
- Campaign composer with template support
- Batch send engine with rate limiting
- Delivery analytics dashboard

---

## Success Metrics

Every metric needs four elements: name, target number, measurement method, mapped goal.

**Structure:**

1. Metric name
2. Target number
3. Measurement method
4. Which goal it maps to

**Must include three categories:**

- **Outcome metric:** Business result ("Checkout completion rate >= 95%")
- **Leading indicator:** Predicts the outcome ("Add-to-cart rate >= 85%")
- **Guardrail metric:** Prevents regression ("Page load < 2s")

**Example:**

### Email Deliverability

| Metric                          | Type              | Target | Maps to Goal                              |
| ------------------------------- | ----------------- | ------ | ----------------------------------------- |
| Send success rate               | Outcome           | >= 97% | "Achieve high email delivery reliability" |
| First-attempt delivery rate     | Leading indicator | >= 90% | "Reduce re-send overhead"                 |
| SMTP credential exposure events | Guardrail         | = 0    | "Maintain security compliance"            |

**Anti-patterns:**

- "User satisfaction survey" without a target number
- "Improved performance" without a metric
- Ship date as a success metric

---

## Extras

Include at most ONE category when genuinely needed. Usually neither is appropriate. If you choose neither, state why.

### Assumptions & Dependencies

- **Assumptions:** Beliefs treated as facts (e.g., "We assume users have Gmail accounts")
- **Dependencies:** External things we rely on (e.g., "Third-party payment processor maintains uptime SLA")

### Risks & Mitigations

- **Risk:** What could go wrong
- **Mitigation:** What we'll do about it

Pick at most one section. If you need both, your PRD is probably too complex for a single document.
