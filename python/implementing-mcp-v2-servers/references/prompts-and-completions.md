# Prompts & Autocompletions

Prompts in MCP v2 are reusable prompt templates and instructions exposed to the user interface (such as a dropdown, modal, or slash command in client UIs).

---

## 1. Defining Prompts

Use the `@mcp.prompt()` decorator:
- **Function Name**: The prompt's identifier (e.g. `code_review`).
- **Docstring**: Human-readable description presented to the user.
- **Parameters**: Input arguments the user must supply before rendering.

```python
from mcp.server.mcpserver import MCPServer

mcp = MCPServer(name="PromptServer")

@mcp.prompt()
def code_review(code: str, language: str = "python") -> str:
    """Perform a security and style review on a code snippet.

    Args:
        code: The source code to inspect.
        language: Programming language of the snippet.
    """
    return f"""Please review the following {language} code for:
1. Security vulnerabilities
2. Performance bottlenecks
3. Idiomatic design

Code:
```{language}
{code}
```
"""
```

---

## 2. Returning Multi-Message Sequences

Prompts can return structured message sequences rather than a single string:

```python
@mcp.prompt()
def triage_bug(error_log: str) -> list[dict]:
    """Structure a multi-message bug triage conversation."""
    return [
        {
            "role": "user",
            "content": {
                "type": "text",
                "text": f"Here is the system failure log:\n\n{error_log}",
            },
        },
        {
            "role": "assistant",
            "content": {
                "type": "text",
                "text": "Understood. I will parse the stack trace, identify failure points, and propose a fix.",
            },
        },
        {
            "role": "user",
            "content": {
                "type": "text",
                "text": "Please provide the root cause analysis first.",
            },
        },
    ]
```

---

## 3. Dynamic Completions

Servers can provide autocompletion options for prompt arguments or resource templates:

```python
@mcp.completion(prompt="code_review", argument="language")
async def complete_languages(value: str) -> list[str]:
    """Provide autocompletions for programming language options."""
    supported = ["python", "typescript", "rust", "go", "java", "csharp"]
    return [lang for lang in supported if lang.startswith(value.lower())]
```

