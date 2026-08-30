# Contributing to Feenion

Thank you for your interest in contributing to **Feenion**! Feenion is an open-source, self-hosted AI debugging and observability platform built for the community. We welcome contributions from developers of all backgrounds.

---

## 🌟 Areas We Welcome Contributions

We are actively seeking community contributions in the following areas:

1. **Framework & Model Integrations**:
   - Auto-instrumentation for **LangChain**, **LlamaIndex**, **DSPy**, **CrewAI**, **AutoGen**.
   - Local LLM providers: **Ollama**, **vLLM**, **LocalAI**, **TGI**.
2. **Additional SDK Languages**:
   - TypeScript / JavaScript SDK (`@feenion/sdk`).
3. **Exporters & Storage Backends**:
   - OpenTelemetry (OTel) Collector exporter.
   - ClickHouse / DuckDB analytic storage backend.
   - S3 / GCS raw trace archiver.
4. **UI & Visualizations**:
   - Advanced agent timeline visualizers and DAG renderers.
   - Custom metric query builders and dashboard widgets.
5. **Documentation & Examples**:
   - End-to-end framework examples (e.g. FastAPI + LangGraph + Feenion).
   - Video walkthroughs, tutorials, and translated documentation.

---

## 🛠️ Development Setup

### 1. Prerequisites
- **Python 3.11+**
- **Node.js 18+** & **npm** (for Web dashboard)
- **Docker & Docker Compose** (optional for container testing)

### 2. Fork & Clone
```bash
git clone https://github.com/your-username/feenion.git
cd feenion
```

### 3. Create Virtual Environment
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r server/requirements.txt
pip install -e .
```

### 4. Running Test Suite
```bash
pytest
```

---

## 🔄 Pull Request Workflow

1. **Create a Branch**:
   ```bash
   git checkout -b feature/my-new-integration
   ```
2. **Write Clean, Typed Code**:
   - Use Python type annotations (`mypy` compatible).
   - Follow PEP 8 guidelines.
   - Ensure zero unhandled exceptions in SDK paths (always isolate telemetry failures).
3. **Add Tests**:
   - Add unit tests in `tests/` covering new features or bug fixes.
   - Verify that all tests pass (`pytest`).
4. **Submit PR**:
   - Open a pull request against the `main` branch with a clear description and test evidence.

---

## 📜 Code of Conduct

Please note that this project is released with a [Contributor Code of Conduct](CODE_OF_CONDUCT.md). By participating in this project you agree to abide by its terms.

