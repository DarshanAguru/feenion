# Feenion Python SDK Reference

## Core API

### `configure(exporter=None)`
Global configuration function for setting the default exporter.

### `@trace`
Decorator for functions and async coroutines. Automatically creates a trace or nested span if an active context already exists.

```python
@trace(name="custom_name", span_type="agent")
def my_function():
    ...
```

### `with span(name, span_type="custom", attributes=None)`
Dual sync/async context manager for manual span boundary demarcation.

```python
with span("my_span", span_type="llm") as s:
    s.input = {"prompt": "..."}
    s.output = {"response": "..."}
```

### Exporters

- `ConsoleExporter()`: Prints formatted JSON traces to stdout.
- `JSONLExporter(filepath)`: Appends JSON lines to local file.
- `HTTPExporter(endpoint, api_key=None, compress=True)`: Ships telemetry batches to Feenion Server.
- `AsyncExporter(exporter, max_queue_size=1000, batch_size=20)`: Non-blocking async queue wrapper.

