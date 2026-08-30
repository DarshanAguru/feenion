# Security & Redaction

Feenion is built for privacy-first, self-hosted environments. It includes strict sensitive data redaction to prevent passwords, bearer tokens, or API keys from being stored in telemetry traces.

---

## Automatic Data Sanitization

The `Redactor` ([redaction.py](file:///home/darshan/Projects/feenion/sdk/feenion/redaction.py)) automatically scans inputs, outputs, attributes, and metadata for sensitive keys and regex patterns.

### Default Sensitive Keys Redacted

- `password`
- `token` / `access_token` / `refresh_token`
- `authorization`
- `api_key` / `apikey`
- `secret`
- `cookie`
- `credit_card` / `creditcard`
- `private_key`

### Default Pattern Matching

- OpenAI API Keys: `sk-[a-zA-Z0-9]{32,}`
- Bearer Authorization Headers: `Bearer ...`

---

## Custom Redaction Configuration

You can customize sensitive keys or add custom regex patterns:

```python
import re
from feenion.redaction import Redactor

custom_redactor = Redactor(
    sensitive_keys={"ssn", "tax_id", "password", "bank_account"},
    sensitive_regexes=[
        re.compile(r"\b\d{3}-\d{2}-\d{4}\b"), # SSN pattern
    ],
    redact_val="[CONFIDENTIAL]"
)

sanitized_payload = custom_redactor.redact(raw_data)
```

---

## API Key Security

- Feenion Server **NEVER** stores raw API keys in the database.
- Keys are hashed using **SHA-256** (`hash_api_key`) and matched against hashed database records.
- Unauthenticated requests default to the `"default"` project in development, or can be restricted in production.

