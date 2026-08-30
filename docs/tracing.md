# Tracing & Context Propagation

Feenion provides context-aware tracing using Python's standard `contextvars` library. This ensures trace and span parentage propagate seamlessly across nested function calls, coroutines, `asyncio.gather`, and multi-threaded worker pipelines.

---

## The `@trace` Decorator

Use `@trace` to automatically start a root trace (if none is active) or a child span (if inside an existing trace).

### Synchronous Functions

```python
from feenion import trace

@trace
def process_order(order_id: str):
    ...
```

### Asynchronous Coroutines

```python
from feenion import trace

@trace
async def async_fetch_data(url: str):
    ...
```

### Customizing Span Names and Types

```python
@trace(name="custom_agent_step", span_type="agent")
def execute_step():
    ...
```

---

## Manual Span Demarcation: `with span(...)`

Use `with span(...)` or `async with span(...)` for granular block-level instrumentation.

### Basic Usage

```python
from feenion import span

with span("db_query", span_type="database") as s:
    s.input = {"sql": "SELECT * FROM users"}
    result = db.execute(...)
    s.output = {"rows": len(result)}
```

### Dual Sync/Async Context Manager

`span(...)` supports both synchronous and asynchronous context manager protocols automatically:

```python
async with span("async_retrieval", span_type="retrieval") as s:
    s.input = {"query": "vector search"}
    res = await async_vector_db.search(...)
    s.output = res
```

---

## Nested Span Hierarchies

Spans automatically record their parent span ID based on active context:

```python
@trace
def parent_task():
    with span("sub_task_1"):
        ... # parent_span_id points to parent_task root span

    with span("sub_task_2"):
        with span("leaf_task"):
            ... # parent_span_id points to sub_task_2
```

Visualized in Web UI:

```text
parent_task
 ├── sub_task_1
 └── sub_task_2
      └── leaf_task
```

