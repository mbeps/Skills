# Codebase Consistency Module

Audits the codebase for internal consistency in naming conventions, directory structure, architectural patterns, dependency usage, file formatting, and code style.

## When to Use

Use this module when you need to:
- Verify adherence to established project conventions and standards
- Identify naming inconsistencies (camelCase vs PascalCase, singular vs plural)
- Assess whether files are placed in correct directories according to project rules
- Evaluate if architectural layers and design patterns are applied uniformly
- Check for inconsistent library usage and restricted utility patterns
- Verify file formatting consistency (indentation, trailing commas, newlines)
- Ensure the codebase "feels cohesive" across modules

## Analysis Domains

### Naming & Style
Variables, functions, classes, constants, and files. Consistency of:
- camelCase vs PascalCase vs snake_case
- Singular vs plural naming
- Prefix/suffix conventions (e.g. `use*` for hooks, `I*` for interfaces)
- Abbreviation patterns
- Boolean naming (e.g. `is*`, `has*`, `should*`)

### Directory & Architectural Structure
File placement and organisation:
- Feature-based vs layer-based structure
- Module boundaries and dependencies
- Shared vs domain-specific utilities
- Test file colocation vs centralisation
- Configuration file locations

### Architectural Patterns
Consistent application of:
- Service layers, repositories, controllers
- State management patterns
- Middleware and interceptor usage
- Error handling approaches
- Logging patterns

### Dependency & Import Usage
- Consistent import paths (relative vs absolute)
- Utility imports (do all modules use the same shared functions?)
- External library usage (is one library used differently across modules?)
- Version consistency

### File Formatting
- Indentation (spaces vs tabs, width)
- Trailing commas and semicolons
- Newline placement
- Maximum line length
- Comment style

## Quality Principles

- **Pattern Identification** – Scan multiple modules to establish the norm before flagging deviations
- **Conflict Resolution** – Prioritise factual evidence from configuration files and majority patterns
- **Framework Respect** – Account for conventions enforced by the chosen framework
- **Precision** – Every inconsistency must have specific location and reference to established pattern

## What This Module Does NOT Do

- Does not suggest or implement fixes
- Does not modify any files
- Does not over-analyse development configuration settings
- Does not flag cosmetic inconsistencies that do not affect code clarity
- Does not penalise deliberate, justified deviations from standards

## Report Structure

Each finding includes:

- **Inconsistency Name** – Clear description of the violation
- **Location** – File path, line numbers, module
- **Violation** – Description of the inconsistency and established pattern being violated
- **Evidence** – References to specific files/configurations demonstrating the established pattern
- **Consensus Status** – Fully agreed upon or disputed during subagent debate

## Example Findings

**Example 1: Naming Convention Inconsistency**
- Inconsistency: React Component Naming
- Location: `src/components/` (mixed naming)
  - `UserProfile.tsx` (PascalCase - correct)
  - `user_details.tsx` (snake_case - inconsistent)
  - `adminPanel.tsx` (camelCase - inconsistent)
- Violation: Components use mixed naming; established pattern is PascalCase throughout the project
- Evidence: 23/25 components use PascalCase; `.editorconfig` specifies PascalCase for components
- Consensus Status: Fully agreed upon

**Example 2: Import Path Inconsistency**
- Inconsistency: Import Statement Styles
- Location: `src/services/`, mixed usage
  - Some files: `import { helper } from '@/utils/helpers'` (absolute)
  - Other files: `import { helper } from '../../utils/helpers'` (relative)
- Violation: Inconsistent import path strategy; established pattern uses absolute paths with `@/` alias
- Evidence: `tsconfig.json` defines `@/` path alias; 18/22 files use absolute paths
- Consensus Status: Fully agreed upon

**Example 3: Directory Structure Placement**
- Inconsistency: Test File Location
- Location: Mixed placement of test files
  - `src/utils/helpers.ts` + `src/utils/helpers.test.ts` (colocated)
  - `src/hooks/useAuth.ts` + `tests/hooks/useAuth.test.ts` (separated)
- Violation: Inconsistent test placement; established pattern is colocation in `src/`
- Evidence: 15/18 test files colocated; project documentation recommends colocation
- Consensus Status: Fully agreed upon

## Example Invocation

```
Audit [PROJECT_PATH] for consistency in naming, structure, patterns, and style.
Spawn subagents for each domain:
- Naming conventions
- Directory structure and placement
- Architectural pattern application
- Dependency and import usage
- File formatting

For each domain, deploy two independent subagents to identify discrepancies.
Facilitate debate to reach consensus.
Flag findings with specific locations and evidence of established patterns.
```
