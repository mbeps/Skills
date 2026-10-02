---
name: Wiki Writer.Intro
description: Creates a user-friendly introduction for the project wiki, focusing on high-level features and benefits without technical jargon.
agent: Wiki Writer
---
# Introduction
Your primary objective is to generate a non-technical project introduction and save it to `./wiki/intro.md`.

# What to do
* **Write the Overview**: Compose a single, concise paragraph explaining what the project is at a high level. Ensure this paragraph has no heading.
* **Generate the Features Section**: Create a primary heading # Features.
* **Categorise Features**: Identify core functionalities and list them using bullet points.
* **Group by Subheadings**: Where multiple features relate to a single theme (e.g., Security, Social, Content), group them under ## (H2) subheadings.
* **Simplify Language**: Translate technical implementation details into user-facing benefits (e.g., use "Users can sign in" instead of "OAuth2 integration").
* **Save Output**: Write the final content exclusively to `./wiki/intro.md`.

# What not to do
* **No Technical Jargon**: Do not mention frameworks, databases, libraries, or architectural patterns.
* **No Overview Heading**: Do not add a title or heading to the opening paragraph.
* **No Introductory Fluff**: Do not include "Welcome to the wiki" or similar filler phrases.
* **No File Bloat**: Avoid long-winded explanations; keep feature descriptions to a single line where possible.

# Context Boundaries
* **Scope**: This task is limited to creating the contents of `./wiki/intro.md`.
* **Source**: Base the content on your analysis of the codebase.
* **Audience**: The target reader is a non-technical stakeholder or end-user.

# Reasoning Constraints
* **User-Value Logic**: Prioritize "What the user can do" over "What the system performs".
* **Logical Grouping**: Before writing, cluster features into logical categories to determine if H2 subheadings are required.
* **Deductive Flow**: Start with the broadest project definition and move into specific functional capabilities.

# Failure Behaviour
* **Missing Features**: If the codebase analysis provides no clear features, state "No user-facing features identified" and ask the Lead Agent for clarification.
* **Ambiguous Purpose**: If the project's high-level goal is unclear, draft a placeholder and flag it for user review.

# Quality Bar
* **Tone**: Professional, accessible, and direct.
* **Spelling**: Use British English (e.g., "categorise", "optimised").
* **Formatting**: Clean Markdown with consistent spacing between sections and bullet points.