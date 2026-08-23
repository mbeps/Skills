# References

Official documentation sources used to build this skill. Research was grounded in mypy 2.3.1 stable docs; **this repo pins mypy 1.19.0** (`mypy>=1.19.0` in `pyproject.toml`). No cited feature differs between 1.19 and 2.x, but the flag set behind `strict` may change over time — verify against the installed version if in doubt.

## mypy
- Configuration: https://mypy.readthedocs.io/en/stable/config_file.html
- Command line: https://mypy.readthedocs.io/en/stable/command_line.html
- Inline config (`# mypy:`): https://mypy.readthedocs.io/en/stable/inline_config.html
- Error codes (default-on): https://mypy.readthedocs.io/en/stable/error_code_list.html
- Error codes (opt-in): https://mypy.readthedocs.io/en/stable/error_code_list2.html
- TypedDict: https://mypy.readthedocs.io/en/stable/typed_dict.html
- Kinds of types (aliases, unions): https://mypy.readthedocs.io/en/stable/kinds_of_types.html
- Generics: https://mypy.readthedocs.io/en/stable/generics.html
- Protocols: https://mypy.readthedocs.io/en/stable/protocols.html
- More types (NewType, Self, ParamSpec, NoReturn): https://mypy.readthedocs.io/en/stable/more_types.html
- Type narrowing: https://mypy.readthedocs.io/en/stable/type_narrowing.html
- Existing codebases (migration): https://mypy.readthedocs.io/en/stable/existing_code.html

## Pydantic
- mypy plugin: https://pydantic.dev/docs/validation/latest/integrations/dev-tools/mypy/

## Python typing (PEPs)
- PEP 484 (type hints / Optional): https://peps.python.org/pep-0484/
- PEP 604 (union syntax `X | Y`): https://peps.python.org/pep-0604/
- PEP 589 (TypedDict): https://peps.python.org/pep-0589/
- PEP 613 (TypeAlias): https://peps.python.org/pep-0613/
- PEP 695 (type/generic syntax, py3.12): https://peps.python.org/pep-0695/
- PEP 673 (Self): https://peps.python.org/pep-0673/
- PEP 612 (ParamSpec): https://peps.python.org/pep-0612/
- PEP 544 (Protocol): https://peps.python.org/pep-0544/
- PEP 647 (TypeGuard): https://peps.python.org/pep-0647/
- PEP 742 (TypeIs): https://peps.python.org/pep-0742/

## Repository grounding
- `subagents/mypy-research/project-usage.md` — real usage analysis of this repo's `src/mcp_server/` (config, constructs, house style, anti-patterns).
- `subagents/mypy-research/official-docs.md` — full research deliverable with inline citations and uncertainty flags.
