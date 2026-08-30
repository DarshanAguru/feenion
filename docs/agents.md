# Agent & Tool Call Instrumentation

AI Agents (such as LangChain, CrewAI, AutoGen, or custom agentic loops) execute multi-step tool calls, reasoning steps, and LLM calls. Feenion represents agent execution as nested span trees.

---

## Representing Agent Execution Trees

Nested spans naturally visualize the step-by-step reasoning chain of an AI agent:

```text
customer_agent
 ├── agent_planning (span_type="agent")
 ├── google_search (span_type="tool")
 ├── sql_query (span_type="tool")
 └── final_synthesis (span_type="llm")
```

---

## Instrumenting Agent Tools

Use `span_type="tool"` for tool executions:

```python
from feenion import span, trace

def search_database(query: str):
    with span("sql_tool", span_type="tool") as s:
        s.input = {"query": query}
        try:
            results = db.query(query)
            s.output = {"results": results, "row_count": len(results)}
            return results
        except Exception as exc:
            s.fail(exc)
            raise exc

@trace(name="react_agent_loop", span_type="agent")
def run_agent(user_prompt: str):
    with span("reasoning_step_1", span_type="agent"):
        ...
    
    docs = search_database(user_prompt)

    with span("reasoning_step_2", span_type="agent"):
        ...
```

---

## Tool Error Handling

When a tool fails, call `s.fail(exc)` or let exceptions propagate naturally. Feenion automatically records exception types, messages, stack traces, and marks the tool span and parent trace status as `error`.

