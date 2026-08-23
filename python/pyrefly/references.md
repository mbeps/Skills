# References

Official documentation sources used to build this skill. Grounded in **Pyrefly 1.1.1** (this repo pins `pyrefly>=1.1.1`) and the official Docusaurus docs downloaded 2026-08-20. Research deliverables live in `subagents/pyrefly-skill-research/` (`cli-config-errors.md`, `ide-migration-frameworks.md`, `project-usage.md`).

## Official docs (html snapshots in this repo root)
- Introduction / positioning: `blog_introducing-pyrefly.html`
- Installation: `en_docs_installation.html`
- Configuration: `en_docs_configuration.html`
- Error suppressions: `en_docs_error-suppressions.html`
- IDE installation: `en_docs_IDE.html`
- IDE features: `en_docs_IDE-features.html`
- Migrating to Pyrefly: `en_docs_migrating-to-pyrefly.html`
- Pydantic support: `en_docs_pydantic.html`
- Pytest support: `en_docs_pytest.html`
- Compare (mypy/Pyright/Pyrefly): `en_docs_compare.html`

## Live URLs
- Docs home: https://pyrefly.org/en/docs/
- Compare type checkers: https://pyrefly.org/en/docs/compare/
- Migrate from mypy: https://pyrefly.org/en/docs/migrating-from-mypy/
- Migrate from pyright: https://pyrefly.org/en/docs/migrating-from-pyright/
- GitHub (source, issues): https://github.com/facebook/pyrefly
- PyPI: https://pypi.org/project/pyrefly/
- VS Code extension: https://marketplace.visualstudio.com/items?itemName=meta.pyrefly
- OpenVSX: https://open-vsx.org/extension/meta/pyrefly
- Pre-commit hook: https://github.com/facebook/pyrefly-pre-commit

## Python typing (PEPs)
- PEP 484 (type hints / Optional): https://peps.python.org/pep-0484/
- PEP 604 (union syntax `X | Y`): https://peps.python.org/pep-0604/
- PEP 589 (TypedDict): https://peps.python.org/pep-0589/
- PEP 613 (TypeAlias): https://peps.python.org/pep-0613/
- PEP 695 (type/generic syntax, py3.12): https://peps.python.org/pep-0695/
- PEP 544 (Protocol): https://peps.python.org/pep-0544/
- PEP 673 (Self): https://peps.python.org/pep-0673/
- PEP 647 (TypeGuard): https://peps.python.org/pep-0647/

## Repository grounding
- `subagents/pyrefly-skill-research/project-usage.md` — this repo's `[tool.pyrefly]`/`[tool.mypy]` config, CI (`uv run pyrefly check`), and actual type-hinting house style (`src/`).
- `subagents/pyrefly-skill-research/cli-config-errors.md` — CLI, config, and error-suppression extraction with uncertainty flags.
- `subagents/pyrefly-skill-research/ide-migration-frameworks.md` — IDE, migration, Pydantic, and pytest extraction with uncertainty flags.
