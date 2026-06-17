# Dependency Usage Module

Identifies custom-written logic that replicates functionality already available in project dependencies or reputable external libraries. Focuses on code reduction while maintaining functional parity.

## When to Use

Use this module when you need to:
- Find custom utility code that duplicates existing dependencies
- Identify missed opportunities to leverage standard libraries
- Assess whether custom implementations are justified or should be replaced
- Calculate code reduction potential through library consolidation
- Evaluate "dependency bloat"—whether suggested libraries are worth their overhead
- Improve code maintainability through standardised, battle-tested libraries

## Analysis Approach

### Existing Dependency Scan
Review `package.json`, `requirements.txt`, `pom.xml` to identify current libraries that might be under-utilised.

### Custom Logic Identification
Scan for common utility patterns:
- Date/time manipulation
- Deep cloning and object merging
- String parsing and validation
- Data transformation and mapping
- Array/object utilities
- Regular expressions and pattern matching

### Functional Equivalence Verification
Ensure proposed library replacements are 100% functionally equivalent:
- All data transformation paths handled identically
- Edge case behaviour matches
- Performance characteristics acceptable
- API design compatible with existing code

### Dependency Bloat Assessment
Debate to ensure suggested libraries:
- Do not introduce unnecessary external dependencies
- Provide meaningful code reduction (not trivial 1–2 line replacements)
- Have acceptable bundle size impact
- Are widely used and well-maintained

### Code Reduction Metrics
Calculate:
- Lines of code deleted
- Lines of code added (library import)
- Net reduction
- Complexity reduction

## Quality Criteria

- **Behavioural Parity** – Confirmed for all proposed replacements
- **Zero-Effort Integration** – Suggested libraries should be "drop-in" replacements
- **Less is More** – Only flag items where library significantly simplifies codebase
- **Functional Comparison** – Prove library handles all current logic paths
- **No API Changes** – Replacements must not alter public API or function signatures

## What This Module Does NOT Do

- Does not suggest migrating to new frameworks
- Does not suggest libraries for trivial tasks (<5 lines of code)
- Does not suggest replacing highly proprietary or business-domain-specific logic
- Does not suggest large libraries for small feature needs
- Does not modify or implement any changes
- Does not suggest libraries with known security vulnerabilities or restrictive licenses

## Report Structure

Each finding includes:

- **Finding Title** – Description of the custom logic being replaced
- **Location** – File path and line numbers
- **Current Logic** – Description of the custom implementation
- **Library Alternative** – Proposed library name and specific function/method
- **Reasoning** – Why the library is superior (edge case handling, performance, maintainability)
- **Code Reduction** – Estimated lines of code deleted vs added
- **Behavioural Parity** – Confirmed / Disputed

## Example Findings

**Example 1: Custom Date Formatting Duplicates Day.js**
- Location: `src/utils/dateFormatter.ts` (lines 1–45)
- Current Logic: Custom date formatting with locale support and timezone handling
- Library Alternative: Day.js `format()` and locale plugins (already in `package.json`)
- Reasoning: Day.js handles edge cases (DST transitions, leap seconds); custom code lacks timezone awareness
- Code Reduction: 45 lines deleted, 2 lines added (import + usage) = net 43 lines saved
- Behavioural Parity: Confirmed (tested against 200+ date scenarios)

**Example 2: Duplicate Lodash Utilities in Custom Helpers**
- Location: `src/utils/objectHelpers.ts` (lines 78–120, deep clone function)
- Current Logic: Custom deep cloning with circular reference detection
- Library Alternative: Lodash `_.cloneDeep()` (already in `package.json` v4.17.21)
- Reasoning: Lodash version is battle-tested, handles obscure edge cases (functions, symbols, getters)
- Code Reduction: 42 lines deleted, 0 lines added (Lodash already imported) = net 42 lines saved
- Behavioural Parity: Confirmed

**Example 3: Validation Logic vs Zod**
- Location: `src/validators/formValidator.ts` (lines 1–120)
- Current Logic: Manual validation with error accumulation and message formatting
- Library Alternative: Zod schema validation (not currently in `package.json`—would be new dependency)
- Reasoning: Zod provides structured validation, better error messages, composable schemas
- Code Reduction: 120 lines deleted, 25 lines added (Zod setup) = net 95 lines saved; **Bundle Impact**: +15 KB (acceptable for 95-line reduction)
- Behavioural Parity: Confirmed (all current validations covered by Zod schemas)

**Example 4: Rejected: Custom Formatting is Justified**
- Location: `src/utils/currencyFormatter.ts` (lines 1–8)
- Current Logic: Custom currency formatting for company-specific display rules
- Library Alternative: Numeral.js (considered but rejected)
- Reasoning: Custom implementation is only 8 lines and enforces proprietary formatting rules (company-specific currency symbol placement); library would require configuration and adds 50 KB; not justified
- Status: Rejected—custom implementation is simpler and more appropriate

## Example Invocation

```
Analyse [PROJECT_PATH] for custom-written logic that replicates dependencies or standard libraries.
Scan:
- Current project dependencies (package.json, requirements.txt, etc.)
- Custom utility implementations (date, validation, object manipulation, etc.)
- Commonly duplicated patterns (formatting, parsing, transformation)

For each finding:
- Verify 100% functional equivalence
- Calculate code reduction (lines deleted vs added)
- Assess bundle impact
- Debate dependency bloat concerns

Provide specific recommendations with behavioural parity confirmation.
Flag disputed findings explicitly.
```
