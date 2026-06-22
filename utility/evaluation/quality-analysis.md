# Quality Analysis Module

Evaluates implementation quality against industry standards and architectural best practices. Identifies sub-optimal design, code quality issues, and redundancy without suggesting fixes.

## When to Use

Use this module when you need to:
- Assess code quality against industry standards and clean code principles
- Evaluate architecture for logical design issues and inefficiencies
- Identify over-engineered components and unnecessary layers
- Find redundant logic and DRY principle violations
- Review database schema quality and integrity
- Get detailed quality metrics without receiving refactoring suggestions

## Analysis Dimensions

### Code Architecture & Maintainability
- System modularity and logical separation
- Data flow efficiency across modules
- Call graph clarity and traceability
- Cohesion within modules, coupling between modules
- Areas of over-engineering or unnecessary complexity

### Database Schema & Integrity
- Normalisation level and decomposition accuracy
- Indexing strategies and query efficiency
- Schema alignment with project requirements
- Foreign key relationships and referential integrity
- Scalability considerations

### Redundancy & Logic Efficiency
- Code duplication and DRY violations
- Unnecessary logic paths and unreachable code
- Repeated patterns that should be centralised
- Over-abstraction and shallow layers
- Dead code and unused exports

### Implementation Quality
- Function and class size (single responsibility)
- Naming clarity and consistency
- Nesting depth and cognitive load
- Error handling patterns
- Testing strategy and coverage

## Quality Criteria

- Every finding is evidence-based—backed by specific file locations and patterns
- Findings compare against industry standards (clean code, SOLID principles, etc.)
- Consensus is reached via subagent debate before reporting
- Disputed findings are explicitly marked as such for manual review

## What This Module Does NOT Do

- Does not suggest or implement code fixes
- Does not modify any files
- Does not perform security vulnerability scanning
- Does not penalise simplicity or straightforward code
- Does not suggest unnecessary complexity or new tooling

## Report Structure

Each finding includes:

- **Issue Name** – Clear description of the quality issue
- **Location** – File path, line numbers, architectural component
- **Explanation** – Why this implementation is sub-optimal or incorrect based on industry standards
- **Evidence** – References to specific principles, documentation, or patterns
- **Consensus Status** – Fully agreed upon or disputed

## Example Findings

**Example 1: Violation of Single Responsibility Principle**
- Issue: UserService Handles Too Many Concerns
- Location: `src/services/UserService.ts` (lines 1–450)
- Explanation: Single class handles user CRUD, password hashing, email sending, and permission checks; violates SRP
- Evidence: Class has 12 public methods across 4 distinct concerns; clean code practices recommend <5 methods per class
- Consensus Status: Fully agreed upon

**Example 2: Normalisation Violation**
- Issue: Denormalised User Data in Orders Table
- Location: `schema/migrations/orders.sql` (columns: user_email, user_name, user_address)
- Explanation: User data duplicated in orders table; violates database normalisation; creates update anomalies
- Evidence: User details in both `users` and `orders` tables; updating user info requires dual updates; schema analysis shows 3NF violation
- Consensus Status: Fully agreed upon

**Example 3: Redundant Data Transformation**
- Issue: Duplicate Price Formatting Logic
- Location:
  - `src/utils/formatting.ts` – `formatPrice()` function exists
  - `src/components/ProductCard.tsx` (lines 45–52) – identical formatting logic re-implemented
  - `src/services/OrderService.ts` (lines 120–127) – third implementation
- Explanation: Three separate implementations of price formatting; violates DRY principle; inconsistent handling of edge cases
- Evidence: Line-by-line comparison shows identical transformation logic; no distinct use case justifying duplication
- Consensus Status: Fully agreed upon

## Example Invocation

```
Evaluate [PROJECT_PATH] for implementation quality against industry standards.
Analyse:
- Code architecture and modularity
- Database schema design and integrity
- Code duplication and redundancy
- Overall code quality and maintainability

Compare against clean code principles and SOLID standards.
Provide specific findings with file references and evidence.
Use subagent consensus for all reported issues.
Flag disputed findings explicitly.
```
