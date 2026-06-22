---
name: evaluation
description: "Comprehensive codebase evaluation system that orchestrates multiple specialized analysis subagents to assess code quality. Use whenever evaluation of the codebase is required."
---

# Evaluation Skill

Comprehensive codebase evaluation system that orchestrates multiple specialized analysis subagents to assess code quality, architecture, design patterns, security, testing, dependencies, and maintainability. Produces detailed, structured diagnostic reports across multiple quality dimensions.

## When to Use

Use this skill when you need to:
- Perform a comprehensive codebase evaluation across all dimensions (architecture, code quality, design, security, testing, dependencies, documentation)
- Conduct targeted evaluations of specific aspects (e.g., architecture analysis, dead code detection, duplication review, security audit)
- Generate diagnostic reports that identify architectural flaws, unnecessary complexity, code duplication, and over-abstraction
- Assess codebase consistency, dependency health, and security posture
- Obtain evidence-based, objective findings with specific file references and line numbers

## Core Responsibilities

1. **Orchestrate Subagents** – Spawn dedicated subagents for each evaluation domain to work independently and in parallel
2. **Manage Quality Gates** – Ensure all findings are supported by concrete evidence from the codebase
3. **Facilitate Debate** – When subagents disagree, mediate to reach consensus or flag findings as disputed
4. **Synthesise Results** – Compile final reports from all subagent outputs into a single structured document
5. **Provide Diagnostic Value** – Report findings objectively without suggesting fixes or modifications

## Evaluation Types

This skill includes specialised evaluation modules for:

### 1. **Project Evaluation** (`project-evaluation.md`)
Comprehensive evaluation across all dimensions: Architecture, Code Quality, Design, Security, Testing, Dependencies, and Documentation. Follows a discovery → clarification → evaluation → reporting workflow. Use when you need a complete health check of a project.

### 2. **Architecture & Design Analysis** (`architecture-design-analysis.md`)
Identifies unnecessary complexity, over-engineering, and excessive decoupling. Flags Lasagna Code, Interfaces for One, and high indirection debt. Provides simplification suggestions with Mermaid visualisations.

### 3. **Code Duplication** (`code-duplication.md`)
Rigorously identifies exact duplications, functional similarity, and missed reuse opportunities. Cross-references modules for overlapping logic and fragmented patterns.

### 4. **Dead Code Analysis** (`dead-code.md`)
Traces entry points to identify unreachable logic, unused variables, imports, and exports. Assesses side effects before flagging code for removal.

### 5. **Over-Abstraction Audit** (`over-abstraction.md`)
Identifies shallow abstraction layers, excessive indirection, and Cognitive Load issues. Distinguishes between useful centralisation (DRY) and bloat.

### 6. **Codebase Consistency** (`codebase-consistency.md`)
Audits naming conventions, directory structure, architectural patterns, dependency usage, and code style for uniformity across the codebase.

### 7. **Quality Analysis** (`quality-analysis.md`)
Evaluates implementation quality against industry standards, architectural best practices, and design patterns. Flags over-engineered components and redundant logic.

### 8. **Security Audit** (`security-audit.md`)
Identifies security vulnerabilities, architectural flaws, and dependency exploits. Cross-references dependencies with external vulnerability databases.

### 9. **Dependency Usage** (`use-dependencies.md`)
Identifies custom-written logic that replicates functionality already in project dependencies or standard libraries. Calculates code reduction metrics.

## How It Works

### Workflow

```
User Request → Dispatch Subagents → Analyse Domains → Facilitate Consensus
     ↓                    ↓                   ↓              ↓
Specify target     Parallel analysis    Independent    Cross-verify
codebase/module    of evaluation        evaluation     and synthesise
                   dimensions           of findings    findings
```

### Key Principles

- **Parallel Execution** – Independent evaluation domains run concurrently for efficiency
- **Evidence-Based Findings** – Every issue cites specific file paths, line numbers, and architectural evidence
- **Objective Assessment** – Report findings without suggesting solutions or code modifications
- **Consensus Through Debate** – Use multiple subagents per domain to verify accuracy; surface disputed findings for manual review
- **Simplicity-First Lens** – Prioritise maintainability, clarity, and correctness over engineering sophistication

## Required Inputs

When invoking this skill, provide:

1. **Codebase Path** – Full path to the project directory to evaluate
2. **Evaluation Type** – Which evaluation module(s) to run:
   - `project-evaluation` for comprehensive assessment
   - Specific module name(s) for targeted analysis
3. **Scope** (Optional) – Specific folders or modules to focus on (if not evaluating entire codebase)
4. **Known Context** (Optional) – Intentional design decisions, framework requirements, or trade-offs to account for

## Output Format

All evaluation reports follow a structured Markdown format with:

- **Summary Section** – Prioritised list of findings by severity (Critical/High/Medium/Low/Disputed)
- **Detailed Findings** – Each issue with Location, Explanation, Evidence, and Consensus Status
- **Domain Assessments** – Per-dimension analysis of architecture, code quality, consistency, etc.
- **Actionable Roadmap** – Most impactful improvements ranked by priority

## Quality Standards

- All findings are **specific** – include file paths, line numbers, or architectural components
- All findings are **evidence-based** – backed by codebase references or official documentation
- All findings are **objective** – use concrete metrics (Indirection Debt, Lines of Code, Complexity) where applicable
- All reports use **British English** spelling and grammar
- Reports are **diagnostic** – focused on identifying issues, not prescribing solutions

## What This Skill Does NOT Do

- **Does not modify code** – Evaluation only; no refactoring or implementation
- **Does not execute code** – No runtime analysis or performance profiling
- **Does not penalise simplicity** – Simple, straightforward code is the goal
- **Does not suggest fixes** – Reports problems for the engineer to address
- **Does not make assumptions** – Asks for clarification on intentional design choices
- **Does not suggest new frameworks or tooling** – Focuses on code and architecture assessment

## Example Invocations

### Comprehensive Project Evaluation
```
Run a complete codebase evaluation on [PROJECT_PATH].
Use the project-evaluation module to assess all dimensions.
Include any clarification questions needed before proceeding with detailed analysis.
```

### Focused Architecture Review
```
Analyse the architecture of [PROJECT_PATH] for over-engineering and unnecessary abstraction.
Use the architecture-design-analysis and over-abstraction modules.
Provide Mermaid diagrams for complex paths.
```

### Security & Dependency Audit
```
Run security and dependency analysis on [PROJECT_PATH].
Use the security-audit and use-dependencies modules.
Cross-reference dependencies with known vulnerability databases.
```

### Code Quality Deep Dive
```
Evaluate [PROJECT_PATH] for code duplication, dead code, and inconsistency.
Use the code-duplication, dead-code, and codebase-consistency modules.
Provide specific file paths and line numbers for all findings.
```

## Related Skills

- **clean-code** – Pragmatic coding standards and direct analysis
- **karpathy-guidelines** – Guidelines to reduce common LLM coding mistakes
- **design-patterns** – Architectural frameworks for sustainable software engineering
- **subagent-driven-development** – Orchestrating parallel subagents for efficiency
- **agent-customization** – Creating and updating agent instructions and skills

## Extension Points

To extend this skill:

1. **Add new evaluation modules** – Create additional `.md` files for domain-specific analysis
2. **Customise output formats** – Adapt report templates to match your team's standards
3. **Integrate with CI/CD** – Use evaluation outputs to gate code reviews or deployments
4. **Build domain-specific analysers** – Create subagent prompts for framework-specific checks (Spring, NestJS, React, etc.)
