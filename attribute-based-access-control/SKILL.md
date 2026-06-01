---
name: attribute-based-access-control
description: Use when implementing fine-grained, dynamic, or context-aware authorization logic that depends on user, resource, or environment attributes.
---

# Attribute-Based Access Control (ABAC)

## Overview
Attribute-Based Access Control (ABAC) is an authorization model that makes access decisions based on **attributes** (characteristics) of the subject, resource, action, and environment. Unlike RBAC which relies on static roles, ABAC is dynamic and context-aware, enabling the Principle of Least Privilege at scale.

## Core Concepts
- **Attributes**: Key-value pairs representing characteristics of entities.
  - **Subject**: User department, clearance, job title, etc.
  - **Resource**: File sensitivity, owner, creation date, type.
  - **Action**: Read, Write, Approve, Delete.
  - **Environment**: IP address, time of day, device security posture.
- **Policies**: Logic-based rules combining attributes (e.g., "Allow if user.dept == 'HR' and resource.type == 'Resume'").

## Functional Components
Standard ABAC architecture (XACML-aligned) uses these roles:
- **PEP (Policy Enforcement Point)**: Intercepts requests, gathers initial attributes, and enforces the final decision.
- **PDP (Policy Decision Point)**: The engine that evaluates attributes against policies to return a Permit/Deny decision. Use conflict resolution strategies (e.g., **Deny Overrides**) when multiple policies apply.
- **PIP (Policy Information Point)**: The "source of truth" providing missing attributes from external systems (LDAP, DB).
- **PAP (Policy Administration Point)**: Where policies are defined, managed, and stored.

## Implementation Patterns
- **Open Policy Agent (OPA)**: Use Rego for logic. Decouples policy from code. Best for microservices/K8s.
- **ALFA (Abbreviated Language for Authorization)**: A high-level, human-readable language that maps to XACML for complex enterprise rules.
- **AWS ABAC / Tag-Based Control**: Uses tags on principals and resources to define dynamic access (common in cloud).
- **NGAC (Next-Generation Access Control)**: Uses a graph-based model for managing complex relationships between attributes.
- **Code-Based Logic**: Implement PDP logic directly in the application layer (suitable for smaller, monolith systems).

## Security Considerations
- **Attribute Tampering**: Ensure attributes (especially from the client/environment) cannot be spoofed. Validate sources of truth in PIP.
- **Policy Injection**: Guard against untrusted inputs being used to construct policies or logic expressions.
- **Least Privilege**: Regularly audit policies to ensure they do not grant excessive permissions as attributes change.

## Do's and Don'ts

### Do's
- **Centralize Policies**: Use a PAP to avoid scattering logic across the codebase.
- **Use Policy Fragments**: Break complex policies into reusable fragments to avoid duplication and errors.
- **Standardize Names**: Use consistent attribute keys (e.g., `user.id` not `subject.uuid`).
- **Audit and Log**: Always log policy decisions (Permit/Deny) and the attributes used.
- **Test Extensively**: Use automated unit tests to verify complex policy logic.

### Don'ts
- **Hardcode Attributes**: Keep logic decoupled from the actual values; use the PIP for resolution.
- **Over-Attribute**: Avoid creating thousands of unique attributes that increase complexity.
- **Ignore Conflict Resolution**: Always define a strategy for when multiple policies overlap (e.g., "Deny Overrides" should be the default).

## Performance and Scaling
- **Attribute Prefetching**: Gather all required attributes in a single batch to reduce network/DB latency.
- **Policy Caching**: Cache decisions for identical subject/resource/action tuples with a TTL.
- **Distributed PDPs**: Scale PDP instances horizontally for high-traffic environments.
- **Schema Optimization**: Optimize storage for PIP sources to ensure fast attribute retrieval.
