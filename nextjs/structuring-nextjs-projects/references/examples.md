# Worked Examples Reference

Working examples of feature scaffolding and architectural patterns following Next.js project structure conventions.

To keep documentation lean and accessible, the detailed worked examples are decomposed into the specialized reference documents below.

---

## Worked Examples Index

| Example | Target Topic | Reference Document | Description |
| --- | --- | --- | --- |
| **Example 1** | Complete Feature Scaffolding | [Comments Feature](examples/comments-feature.md) | Full 10-file comments feature (types, schema, actions, server/client components, route page, test, and tree). |
| **Example 2 & 3** | Business Logic & Constants | [Utilities & Shared Constants](examples/utilities-and-constants.md) | Duration formatter placement in `lib/music/` and reusable SQL select queries in `actions/_db-selects.ts`. |
| **Example 4** | Type Architecture | [Type Composition Pattern](examples/type-composition.md) | Domain-specific base types vs cross-domain composed types for complex queries. |
| **Example 5** | Test Setup & Factories | [Test Structure & Mocks](examples/test-structure.md) | Mirrored test files under root `__tests__/`, mock data factories, and React Testing Library tests. |
| **Example 6** | URL Parameter State | [URL State Management with Nuqs](examples/url-state-nuqs.md) | `<NuqsAdapter>` provider setup and custom `useSongFilterState` hook with `clearOnDefault: true`. |
| **Example 7** | Multi-Stage Containers | [Docker Containerization](examples/docker-containerization.md) | Production multi-stage `docker/next/Dockerfile` and `docker/docker-compose.yml` stack orchestration. |
| **Example 8** | CI/CD Automation | [CI/CD Pipeline with GitHub Actions](examples/ci-cd-pipeline.md) | Complete `.github/workflows/merge.yml` workflow checking Biome, Turbopack, tests, and Docker across Node 24/26. |
| **Example 9** | Default Tools in Action | [Recommended Tools & Libraries](examples/recommended-tools.md) | Zustand player store, dynamic BlockNote editor, Drizzle ORM client, TypeORM DataSource, and MCP server handler. |

---

## Quick Scaffolding Checklist

When adding a new feature, create files in this order:

1. **Types** (`types/[domain]/`)
   - Base type
   - Composed types (if needed)

2. **Schemas** (`schemas/[domain]/`)
   - Validation schemas for mutations

3. **Server Actions** (`actions/[domain]/`)
   - Get/fetch actions
   - Mutation actions (create/update/delete)

4. **Components** (`components/[domain]/`)
   - Server components (display, lists)
   - Client components (forms, interactive)

5. **Tests** (`__tests__/`)
   - Action tests
   - Component tests

6. **Integration** (`app/[route]/`)
   - Add to page/layout

### Reminders
- One export per file
- Absolute imports only (`@/*`)
- No barrel exports (`index.ts`)
- Domain subfolders
- kebab-case files
- Test files mirror structure under root `__tests__/` (using camelCase for test file names)

