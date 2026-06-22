---
name: Wiki Writer.Database
description: Describe when to use this prompt
agent: Wiki Writer
---
# Introduction

Your primary objective is to analyse the codebase for data structures—including SQL schemas, ORM notations, and NoSQL configurations—and generate a comprehensive database design wiki.

# What to do

* **Identify Data Sources**: Scan the codebase for SQL files (.sql), ORM models (e.g., Prisma, SQLAlchemy, Mongoose, Django), and NoSQL schema definitions (Document, Graph, Key-Value).
* **Analyse Schemas**: Extract table/collection names, field names, data types, primary/foreign keys, and constraints.
* **Map Relationships**: Identify One-to-One, One-to-Many, and Many-to-Many connections. Define the join logic or embedding strategy used.
* **Technical Evaluation**: Assess the schema for normalization levels (1NF through BCNF) or NoSQL optimization patterns.
* **Visualise**: Construct a Mermaid erDiagram representing the entire data model.
* **Generate Documentation**: Write the final output to `./wiki/database-design/database-design.md` using the exact Markdown structure provided in the Context Boundaries.

# What not to do

* **No Guesswork**: Do not assume data types or relationships if not explicitly defined in the code or config files.
* **No Redundancy**: Do not describe business logic; focus strictly on the technical data layer.
* **No External Tools**: Do not suggest external database management tools or GUIs.

# Context Boundaries

* **Output Path**: Save all files to `./wiki/database-design/`.
* **Supported Types**: SQL (Postgres, MySQL, SQLite, etc.) and NoSQL (MongoDB, Neo4j, Redis, etc.).

# Reasoning Constraints

* **Extraction First**: Identify all unique entities before determining relationships.
* **Type Mapping**: Standardise diverse ORM types into readable SQL/NoSQL equivalents for the wiki.
* **Visual Logic**: Ensure the Mermaid diagram matches the textual table descriptions exactly.

# Failure Behaviour

* **Missing Schemas**: If no database files are found, report the lack of data structures and stop.
* **Ambiguous Types**: If a data type is unclear, mark it as [Unknown Type] and flag it for user clarification.
* **Invalid Syntax**: If Mermaid code fails to render during internal verification, simplify the diagram until valid.

# Quality Bar

* **Clarity**: Use precise technical British English.
* **Consistency**: Ensure naming conventions (CamelCase, snake_case) reflect the actual codebase.
* **Structure**: Follow the mandatory Markdown template without deviation.

Below is the structure for the generated wiki documentation:

```markdown
### Tables

**[Table Name]**

* **[Field Name] ([Data Type])** - [Primary Key / Foreign Key / Constraints]
* **[Field Name] ([Data Type])**
* (Repeat for all)

### Relationships

* **[Table A] to [Table B]**: [Relationship Type] - [Brief explanation of join/link]

### Normalisation Logic

* **1NF & 2NF**: [Technical note on atomicity/dependency]
* **3NF & BCNF**: [Technical note on transitive dependencies/determinants]

### ER Diagram

```mermaid

```
```