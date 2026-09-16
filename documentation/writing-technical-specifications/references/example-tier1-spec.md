# Payment Statement Ingestion Service Specification

## Purpose
This document specifies the observable behaviour, data formats, and business rules for the Statement Ingestion Service.

## Scope
In scope: Ingestion of electronic bank statement files, record validation, idempotency checks, and emission of verified transaction events.
Out of scope: Cloud infrastructure provisioning, container runtime management, and downstream ledger balancing.

## Related Documents
- `01-context-and-architecture.md` (for Tier 2/3 suites)

---

## 1. System Context and Actors

- **Actor: Batch Scheduler** — Delivers statement files via HTTP POST.
- **System: Ingestion Service** — Validates files, detects duplicate batches, and extracts transaction items.
- **External System: Ledger Event Bus** — Receives valid transaction events via message broker.

```
[Batch Scheduler] ──(POST /statements)──> [Ingestion Service] ──(Emit Event)──> [Ledger Event Bus]
```

---

## 2. Component Breakdown

- **`COMP-001` File Validator:** Validates file syntax, headers, and checksums.
- **`COMP-002` Deduplication Engine:** Verifies that the batch identifier is unique.
- **`COMP-003` Record Parser:** Translates statement lines into domain transaction records.

---

## 3. Functional Requirements

- **`FR-001` Format Verification:** The service MUST reject any file whose header does not match the CAMT.053 schema.
  - *Trigger:* Incoming HTTP upload.
  - *Precondition:* Upload payload size under 50 megabytes.
  - *Failure Result:* Return HTTP 400 with error code `ERR-001`.
  - *Confidence:* Confirmed.
- **`FR-002` Batch Deduplication:** The service MUST NOT process a statement batch with a previously ingested `statement_id`.
  - *Trigger:* Successful format verification.
  - *Failure Result:* Return HTTP 409 with error code `ERR-002`.
  - *Confidence:* Confirmed.
- **`FR-003` Event Emission:** The service MUST emit a `TransactionParsed` event for every valid record within two seconds of receipt.
  - *Confidence:* Confirmed.

---

## 4. Business Rules

- **`BR-001` Duplicate Batch Detection:**
  A batch is a duplicate when `statement_id` exists in the `processed_statements` table with status `COMPLETED`.

- **`BR-002` Amount Normalisation:**
  Convert statement amounts into minor currency units (integer cents). Do not use floating-point decimals.

---

## 5. Interface Contract

### `API-001` Statement Upload
- **Method:** `POST /api/v1/statements`
- **Request Headers:**
  - `Content-Type: application/xml`
  - `X-Statement-ID: string (UUIDv4)`
- **Success Response:** HTTP 202 Accepted. Body: `{"status": "PROCESSING", "batch_id": "string"}`
- **Error Responses:**
  - HTTP 400: `{"code": "ERR-001", "message": "Invalid CAMT.053 XML schema"}`
  - HTTP 409: `{"code": "ERR-002", "message": "Statement ID has already been processed"}`

---

## 6. Acceptance Test Scenarios

- **`AT-001` Valid Ingestion:**
  - *Preconditions:* Database has no record of statement ID `STMT-1001`.
  - *Inputs:* Valid CAMT.053 XML file with three transaction lines.
  - *Action:* Send `POST /api/v1/statements` with header `X-Statement-ID: STMT-1001`.
  - *Expected Result:* HTTP 202 returned. Three events emitted to message broker. Batch recorded as `COMPLETED`.

- **`AT-002` Duplicate Rejection:**
  - *Preconditions:* Database contains statement ID `STMT-1001` marked `COMPLETED`.
  - *Action:* Send `POST /api/v1/statements` with header `X-Statement-ID: STMT-1001`.
  - *Expected Result:* HTTP 409 returned. Zero events emitted.

---

## 7. Open Questions Register

| ID       | Topic            | Description                                                  | Technical Risk | Owner       | Status |
| -------- | ---------------- | ------------------------------------------------------------ | -------------- | ----------- | ------ |
| `OQ-001` | Encoding Support | Is UTF-16 statement encoding required, or is UTF-8 standard? | Medium         | Banking Ops | Open   |
| `OQ-002` | Retention Window | How long must statement deduplication keys be retained?      | Low            | Compliance  | Open   |
