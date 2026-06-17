# Security Audit Module

Identifies security vulnerabilities, architectural flaws, and dependency exploits. Verifies all findings against external vulnerability databases.

## When to Use

Use this module when you need to:
- Identify security vulnerabilities in code and architecture
- Detect insecure patterns (unvalidated input, hardcoded secrets, weak authentication)
- Scan dependencies for known exploits and CVEs
- Assess exposure to OWASP Top 10 vulnerabilities
- Get verified, evidence-based security findings with vulnerability database links
- Evaluate overall security posture

## Analysis Areas

### Input & Data Validation
- Unvalidated user input
- SQL injection risks
- Cross-site scripting (XSS) vulnerabilities
- Command injection risks
- Type confusion or unexpected data handling

### Authentication & Authorisation
- Weak or missing authentication mechanisms
- Privilege escalation risks
- Session management flaws
- Password storage and handling
- Multi-factor authentication gaps

### Secrets & Credentials
- Hardcoded credentials, API keys, or tokens
- Secrets exposed in version control
- Insecure storage of sensitive data
- Credential rotation and revocation

### Dependency & Library Security
- Known CVEs in dependencies
- Outdated or deprecated packages
- Malicious or compromised dependencies
- License compliance risks

### Data Protection
- Encryption of sensitive data (at rest, in transit)
- Privacy violation risks
- Data leakage in logs or error messages
- Secure communication channels

### Infrastructure & Configuration
- Insecure default configurations
- Missing security headers
- CORS misconfiguration
- Insecure API endpoints

## Quality Principles

- **Verification** – Cross-reference all findings with official vulnerability databases (CVE, NVD, etc.)
- **Consensus** – Multiple subagents audit the same domains independently; findings must be verified
- **Specificity** – Every vulnerability includes concrete evidence and links to documentation
- **False Positive Elimination** – Debate to eliminate spurious findings before reporting

## What This Module Does NOT Do

- Does not perform penetration testing or dynamic vulnerability scanning
- Does not suggest security fixes or code changes
- Does not assess business logic vulnerabilities (domain-specific risks)
- Does not evaluate DevOps security (infrastructure, CI/CD pipelines, etc.)
- Does not execute code

## Report Structure

Each finding includes:

- **Vulnerability Name** – Clear description of the security issue
- **Severity** – Critical / High / Medium / Low / Disputed
- **Location** – File path, line numbers, architectural component
- **Explanation** – How and why this is a vulnerability in the context of this code
- **Evidence** – Links to CVEs, official documentation, or exploit records
- **Consensus Status** – Fully agreed upon or disputed

## Example Findings

**Example 1: Hardcoded Database Credentials**
- Severity: Critical
- Location: `src/config/database.ts`, lines 5–10
- Explanation: Database password hardcoded in source file; exposed in version control; visible to all developers and in production builds
- Evidence: Line 7: `password: "prod_db_secret_123"`; standard secure practice requires environment variables
- Consensus Status: Fully agreed upon

**Example 2: SQL Injection Risk**
- Severity: High
- Location: `src/services/UserService.ts`, line 45
- Explanation: User input concatenated directly into SQL query without parameterisation; attackers can inject SQL commands
- Evidence: `const query = \`SELECT * FROM users WHERE email = '\${userInput}'\`;` allows injection; parameterised queries prevent this
- Consensus Status: Fully agreed upon

**Example 3: Outdated Dependency with Known CVE**
- Severity: High
- Location: `package.json`, line 15
- Explanation: Dependency `lodash@4.17.20` has CVE-2021-23337 (prototype pollution); current version 4.17.21+ patches this
- Evidence: CVE-2021-23337 documented at https://nvd.nist.gov/vuln/detail/CVE-2021-23337; affects path traversal attacks
- Consensus Status: Fully agreed upon

**Example 4: Missing CORS Headers**
- Severity: Medium
- Location: `src/middleware/cors.ts`
- Explanation: CORS headers not configured; API accepts requests from any origin; increases CSRF and XSS risks
- Evidence: No `Access-Control-Allow-Origin` header; OWASP recommends explicit origin whitelist
- Consensus Status: Fully agreed upon

## Example Invocation

```
Run a security audit on [PROJECT_PATH].
Identify:
- Code-level vulnerabilities (input validation, secrets, auth flaws)
- Dependency vulnerabilities and known CVEs
- Architectural security weaknesses
- OWASP Top 10 exposure

For each finding:
- Provide specific location and concrete evidence
- Cross-reference with CVE databases and official documentation
- Assign severity level (Critical/High/Medium/Low)
- Verify via subagent consensus

Flag disputed findings explicitly for manual review.
```
