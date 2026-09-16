# Evidence, Traceability, and Parity Reference

## Purpose

This document provides conventions for evidence citations, confidence ratings, identifier schemes, traceability matrices, and parity checklists.

## Epistemic Status (Confidence Ratings)

Classify every substantive claim with one of three confidence levels:

| Level          | Definition                                                             | When to Use                                          |
| -------------- | ---------------------------------------------------------------------- | ---------------------------------------------------- |
| **Confirmed**  | Directly supported by code, tests, schema, or explicit PRD statements. | You read the source line or test case directly.      |
| **Inferred**   | Strongly implied by multiple data points, but not stated explicitly.   | Deduction from naming patterns or surrounding logic. |
| **Unresolved** | Missing, ambiguous, or contradictory evidence.                         | The evidence has gaps or conflicts.                  |

## Evidence Citation Syntax

Cite evidence using repository-relative paths with exact line ranges:

- **Source code:** `path/to/file.ext:Lstart-Lend` (for example: `app.py:L112-L163`).
- **Tests:** `tests/test_file.ext:Lstart-Lend`.
- **Documentation:** `docs/file.md#section-anchor`.
- **Design or PRD:** `PRD.md:Section 4.2`.

When evidence is missing, write `Unknown` and add an open question. Do not guess file locations or line numbers.

## Identifier Schemes

Use standard uppercase prefixes with three-digit numbers:

| Prefix     | Entity Type                  | Example                                  |
| ---------- | ---------------------------- | ---------------------------------------- |
| `COMP-xxx` | Logical Component            | `COMP-001` (Web Presentation Layer)      |
| `FR-xxx`   | Functional Requirement       | `FR-001` (Upload Notification File)      |
| `WF-xxx`   | Workflow or Use Case         | `WF-001` (Reconcile Daily Statements)    |
| `BR-xxx`   | Business Rule or Formula     | `BR-001` (Application Classification)    |
| `API-xxx`  | Interface, Route, or Command | `API-001` (`POST /api/v1/reconcile`)     |
| `ERR-xxx`  | Error Catalogue Entry        | `ERR-001` (Invalid File Header)          |
| `AT-xxx`   | Acceptance Test Scenario     | `AT-001` (Match Valid PDP Code)          |
| `OQ-xxx`   | Open Question or Uncertainty | `OQ-001` (Undefined Transaction Timeout) |

## Normative Keywords

Use normative keywords in functional requirements:

- **MUST:** Absolute requirement. The system fails compliance without it.
- **MUST NOT:** Absolute prohibition.
- **SHOULD:** Recommended practice. Valid reasons may exist in particular circumstances to ignore it.
- **MAY:** Optional feature.

---

## Traceability Matrices

Include traceability matrices to prove full specification coverage:

### 1. Requirement to Acceptance Test Matrix
| Requirement ID | Requirement Statement      | Acceptance Test ID | Coverage Status |
| -------------- | -------------------------- | ------------------ | --------------- |
| `FR-001`       | Validate input file format | `AT-001`, `AT-002` | Covered         |
| `FR-002`       | Parse statement records    | `AT-003`           | Covered         |

### 2. Requirement to Component Matrix
| Requirement ID | Owning Component              | Evidence Location       | Confidence |
| -------------- | ----------------------------- | ----------------------- | ---------- |
| `FR-001`       | `COMP-002` (Ingestion Parser) | `src/parser.py:L45-L78` | Confirmed  |

### 3. Interface to Data Model Matrix
| Interface ID | Operation            | Input Entity         | Output Entity       |
| ------------ | -------------------- | -------------------- | ------------------- |
| `API-001`    | `POST /transactions` | `TransactionRequest` | `TransactionRecord` |

---

## Reimplementation Parity Checklist

Use this checklist for reverse-engineered systems to guide new implementations:

| Item            | Observable Behaviour     | Classification    | Rationale / Evidence                                        |
| --------------- | ------------------------ | ----------------- | ----------------------------------------------------------- |
| Route paths     | `/analyze`, `/results`   | **Must Preserve** | External callers and UI depend on exact URL wire paths.     |
| Wire fields     | `login_details`, `dn_id` | **Must Preserve** | Frontend JSON deserialisation depends on exact field names. |
| Date format     | `DD-MM-YYYY`             | **Must Preserve** | User reports require standard format (`app.py:L152`).       |
| Database engine | SQLite vs PostgreSQL     | **May Vary**      | Any relational store matching the schema works.             |
| Framework       | Flask vs Express         | **May Vary**      | Any HTTP server providing matching endpoints works.         |

---

## Open Questions Register

Document every unresolved problem, risk, and missing stakeholder decision:

| ID       | Topic                  | Description                        | Technical Risk | Decision Maker | Status |
| -------- | ---------------------- | ---------------------------------- | -------------- | -------------- | ------ |
| `OQ-001` | Missing Authentication | No auth layer exists on endpoints. | **High**       | Security Team  | Open   |
| `OQ-002` | In-memory Cache Loss   | Cache clears on server restart.    | **Medium**     | Tech Lead      | Open   |
| `OQ-003` | File Name Sanitisation | Upload path traversal risk.        | **High**       | Security Team  | Open   |
