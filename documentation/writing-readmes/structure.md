# Structure

A README has eight parts, always in this order: project name and intro, Features, Requirements, Stack, Setting Up Project, Run Application, and References. Optional H1 sections sit between Stack and Setting Up Project, only when the project needs them.

## Heading Levels

- Every top-level section is H1 (`#`). The first H1 is the project name, in Title Case. Keep brand names as-is.
- Subsections are H2 (`##`).
- H3 (`###`) only when a third level is genuinely needed, for example nested environment variable groups.
- Do not bold headings.

## 1. Project Name and Intro

`# Project Name`

One paragraph of 3-4 short sentences. The intro does not mention the tech stack; the Stack section covers it. Open with "A [type] ..." or "X is a ...". Describe what the project does, then one or two key capabilities.

Example: *Ledgerly is a personal finance web application for tracking income and expenses. Record transactions and categorise them by type. Review spending with monthly summaries and charts. Set budgets and export transaction data to CSV.*

## 2. Features

`# Features`

Use plain bullets when the features fit one area and there are at most six. Group features under H2 headings by area, such as Authentication or Community, when they span two or more areas. One feature per bullet, single line where possible, ~8-20 words. Keep one bullet style throughout: "Users can ...", verb-first with no subject, or a bold noun lead-in followed by `:` or `—` and a description.

Example: `- Record, edit, and delete income and expense transactions`

## 3. Requirements

`# Requirements`

List runtimes with minimum versions. List accounts, services, and credentials, nested as sub-bullets. Mark optional items "(Optional)". Do not list frameworks or package-manager dependencies; the package manager installs those.

Example: `- Node.js 20 or higher`

## 4. Stack

`# Stack`

Bullet format: `- [Component](official-url): one-sentence description.` Link text is the component name. One sentence describing what the component is. Group under H2 headings: Frontend, Backend, Database; add service-specific groups when the architecture demands. Core components only: language, framework, UI library, state, ORM or database, auth, storage, major services. No minor libraries. No version numbers; if a version is genuinely needed, put it in the description, not the link text.

Example: `- [Next.js](https://nextjs.org/docs): React framework with the App Router.`

## 5. Optional Sections

Add H1 sections before Setting Up Project only when the project needs them, such as Design, Database Schema, or Docker Support. Do not add placeholder or filler sections.

## 6. Setting Up Project

`# Setting Up Project`

Numbered H2 steps in Title Case: `## 1. Clone the Project Locally`, `## 2. Install Dependencies`. Follow the sequence: clone, install, environment variables, configure services. Put every command in a code fence tagged `sh` or `bash`.

For each config file (`.env`, `.yaml`, `.json`), show a code block with placeholder values, then describe every variable as a bullet: `- \`VAR\`: purpose + where to obtain the value.` Mark required and optional variables where relevant.

## 7. Run Application

`# Run Application`

Give the development command in a code fence. Offer the production alternative with "Alternatively, you can build the whole app and run it using the following commands:". Close with "The application should now be running at http://localhost:3000." and adapt the URL or port to the project. A `# Usage` section is optional. Add it only when interactions, endpoints, or UI flows need documenting. Keep it concise.

## 8. References

`# References`

Always last. Use bullets with a brief description: `- [Reference Name](url) - brief description.` Include links to documentation useful for understanding or working with the project.
