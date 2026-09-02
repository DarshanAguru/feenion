"""
Feenion Interactive CLI Debugging & AI Ecosystem Simulator
==========================================================
An interactive CLI chat and observability simulator (inspired by Gemini CLI)
that allows testing and debugging all aspects of AI telemetry:
  1. Standard Function Execution & Custom Spans
  2. Google Gemini 2.0 Flash Chat (Token & Cost Tracking)
  3. OpenAI GPT-4o Chat (Choice Metadata & Pricing)
  4. RAG Vector DB Search (Similarity Scores & Chunk Re-ranking)
  5. Model Context Protocol (MCP) Tool Calling (SQL / Tools)
  6. Full Autonomous Multi-Agent Loop (RAG + MCP + Gemini + OpenAI)
  7. Simulated Failures & Error Fingerprinting (Stack Traces & Errors)
  8. Freeform Interactive Chat Mode

Zero external API keys needed — all telemetry is transmitted directly to
the Feenion dashboard on http://localhost:8000.
"""

from __future__ import annotations

import sys
import time
import json
from dataclasses import dataclass, field
from typing import Any, List, Dict

# Import Feenion SDK components
import feenion
from feenion import trace, span, configure, tracer
from feenion.redaction import Redactor
from feenion.exporters import ConsoleExporter, HTTPExporter, AsyncExporter, CompositeExporter
from feenion.integrations import (
    instrument_gemini,
    wrap_gemini,
    instrument_openai,
    wrap_openai,
    instrument_anthropic,
    wrap_anthropic,
)

# =============================================================================
# 🏢 MULTI-TENANT WORKSPACE ROUTING CONFIGURATION (OPTIONAL)
# -----------------------------------------------------------------------------
# By default, ALL scenarios in this mock suite ([1], [2], [3], [5], [6], [7], [8], [9])
# send their traces and metrics to your primary (Default) workspace.
#
# Scenario [4] (RAG Vector Database Search) demonstrates per-trace workspace isolation:
# If you set RAG_TARGET_WORKSPACE_ID below, ONLY the RAG pipeline's traces will be
# routed into that specific workspace!
#
# How to use:
# 1. Open the Feenion Dashboard (http://localhost:8000 -> Settings -> Workspaces).
# 2. Copy the Workspace ID or Name of your target workspace (e.g. "reag-test").
# 3. Paste it in RAG_TARGET_WORKSPACE_ID below.
# =============================================================================
RAG_TARGET_WORKSPACE_ID: str | None = None  # <-- Paste Workspace ID or Name for RAG demo (e.g. "reag-test")
RAG_TARGET_API_KEY: str | None = None       # <-- Optional API Key if server authentication is enabled



# -----------------------------------------------------------------------------
# 1. Mock Google Gemini SDK Emulation
# -----------------------------------------------------------------------------
@dataclass
class MockUsageMetadata:
    prompt_token_count: int = 140
    candidates_token_count: int = 65
    total_token_count: int = 205

@dataclass
class MockCandidate:
    finish_reason: str = "STOP"

@dataclass
class MockGeminiResponse:
    text: str
    usage_metadata: MockUsageMetadata = field(default_factory=MockUsageMetadata)
    candidates: List[MockCandidate] = field(default_factory=lambda: [MockCandidate()])

class MockGeminiModels:
    def generate_content(self, model: str, contents: Any, **kwargs: Any) -> MockGeminiResponse:
        time.sleep(0.04)  # Simulate network latency
        prompt_str = str(contents)
        tokens_in = max(10, len(prompt_str.split()) * 2)
        tokens_out = 45
        
        resp_text = (
            f"[Gemini 2.0 Flash]: Synthesized insight for prompt: '{prompt_str[:50]}...'. "
            f"All constraints validated and optimized."
        )
        return MockGeminiResponse(
            text=resp_text,
            usage_metadata=MockUsageMetadata(
                prompt_token_count=tokens_in,
                candidates_token_count=tokens_out,
                total_token_count=tokens_in + tokens_out,
            )
        )

class MockGoogleGenAIClient:
    """Emulates official `google.genai.Client`"""
    def __init__(self):
        self.models = MockGeminiModels()

# -----------------------------------------------------------------------------
# 2. Mock OpenAI SDK Emulation
# -----------------------------------------------------------------------------
@dataclass
class MockOpenAIUsage:
    prompt_tokens: int = 180
    completion_tokens: int = 55
    total_tokens: int = 235

@dataclass
class MockOpenAIMessage:
    role: str = "assistant"
    content: str = "OpenAI analysis: Data validation succeeded with zero schema anomalies."

@dataclass
class MockOpenAIChoice:
    message: MockOpenAIMessage = field(default_factory=MockOpenAIMessage)
    finish_reason: str = "stop"

@dataclass
class MockOpenAIResponse:
    choices: List[MockOpenAIChoice] = field(default_factory=lambda: [MockOpenAIChoice()])
    usage: MockOpenAIUsage = field(default_factory=MockOpenAIUsage)

class MockOpenAIChatCompletions:
    def create(self, model: str = "gpt-4o", messages: list = None, **kwargs: Any) -> MockOpenAIResponse:
        time.sleep(0.05)
        last_msg = messages[-1]["content"] if messages else "query"
        resp = MockOpenAIResponse()
        resp.choices[0].message.content = f"GPT-4o evaluated: '{last_msg[:45]}...'. Compliance verified."
        return resp

class MockOpenAIClient:
    """Emulates official `openai.OpenAI`"""
    def __init__(self):
        self.chat = type("Chat", (), {"completions": MockOpenAIChatCompletions()})()

# -----------------------------------------------------------------------------
# 3. Mock Model Context Protocol (MCP) Tools Server
# -----------------------------------------------------------------------------
class MockMCPServer:
    """Emulates a local Model Context Protocol (MCP) Tool Execution Server."""
    
    @staticmethod
    def call_tool(tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        with span(f"mcp_tool.{tool_name}", span_type="tool", input=arguments) as s:
            s.set_attribute("protocol", "mcp/v1.0")
            s.set_attribute("tool_name", tool_name)
            time.sleep(0.03)

            if tool_name == "query_financial_db":
                result = {
                    "account_id": arguments.get("account_id", "acc_default"),
                    "status": "active",
                    "balance_usd": 14250.75,
                    "risk_tier": "low",
                }
            elif tool_name == "fetch_compliance_rules":
                result = {
                    "jurisdiction": arguments.get("jurisdiction", "US"),
                    "rules": ["SEC-Rule-144", "KYC-Tier-2", "SOX-Compliance-Verified"],
                }
            elif tool_name == "weather_lookup":
                result = {
                    "city": arguments.get("city", "San Francisco"),
                    "temp_c": 19.5,
                    "condition": "Sunny",
                }
            else:
                result = {"error": f"Unknown MCP tool: {tool_name}"}

            s.set_output(result)
            return result

# -----------------------------------------------------------------------------
# 4. Mock Vector Database / RAG Pipeline
# -----------------------------------------------------------------------------
class MockVectorDatabase:
    """Emulates Chroma / Qdrant semantic chunk retrieval."""
    
    @staticmethod
    def search(query: str, top_k: int = 3) -> List[Dict[str, Any]]:
        with span("chroma_vector_search", span_type="retrieval", input={"query": query, "top_k": top_k}) as s:
            time.sleep(0.035)
            chunks = [
                {"id": "doc_chunk_841", "score": 0.94, "content": f"Enterprise trading limits are calculated dynamically for: '{query}'."},
                {"id": "doc_chunk_219", "score": 0.88, "content": "Accounts in Tier-1 require two-factor authorization for withdrawals over $10k."},
                {"id": "doc_chunk_503", "score": 0.81, "content": "Audit logs must be preserved for 7 years in immutable WAL format."},
            ]
            s.set_output({"chunks_found": len(chunks), "top_score": 0.94, "chunks": chunks})
            return chunks

# -----------------------------------------------------------------------------
# 5. Modular Test Tracing Scenarios
# -----------------------------------------------------------------------------

@trace(name="standard_function_pipeline", span_type="custom")
def run_simple_function_trace() -> Dict[str, Any]:
    """Test standard business logic and nested child spans."""
    print("\n[1] ⚙️  Running Standard Function & Custom Spans...")
    with span("validate_input_payload", span_type="custom") as s:
        s.set_attribute("validation_schema", "v2.1")
        time.sleep(0.02)
        s.set_output({"valid": True})

    with span("compute_risk_score", span_type="custom") as s:
        s.set_attribute("algorithm", "monte_carlo")
        time.sleep(0.03)
        s.set_output({"score": 0.12, "classification": "safe"})

    return {"status": "success", "risk": "low"}


def run_gemini_chat_trace(prompt: str = "Explain the Raft Consensus Algorithm in 2 sentences.") -> str:
    """Test standalone Google Gemini auto-instrumentation (no outer @trace required)."""
    print(f"\n[2] ✨ Running Standalone Google Gemini Chat: '{prompt}'...")
    client = wrap_gemini(MockGoogleGenAIClient())
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=prompt
    )
    print(f"💬 {response.text}")
    return response.text


def run_openai_chat_trace(prompt: str = "Verify compliance schema format.") -> str:
    """Test standalone OpenAI GPT-4o auto-instrumentation (no outer @trace required)."""
    print(f"\n[3] 🟢 Running Standalone OpenAI GPT-4o Chat: '{prompt}'...")
    client = MockOpenAIClient()
    instrument_openai(client)
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}]
    )
    content = response.choices[0].message.content
    print(f"💬 {content}")
    return content


def run_rag_vector_search(query: str = "enterprise trading limits") -> List[Dict[str, Any]]:
    """Test RAG Vector Database semantic retrieval."""
    print(f"\n[4] 🔍 Running RAG Vector DB Search: '{query}'...")
    if RAG_TARGET_WORKSPACE_ID:
        print(f"🏢 Routing RAG Telemetry to Isolated Workspace: '{RAG_TARGET_WORKSPACE_ID}'")
    else:
        print("🏢 Routing RAG Telemetry to (Default) Workspace")

    with tracer.trace_context(
        "rag_knowledge_pipeline",
        span_type="retrieval",
        workspace_id=RAG_TARGET_WORKSPACE_ID,
        api_key=RAG_TARGET_API_KEY,
    ):
        docs = MockVectorDatabase.search(query=query, top_k=3)
        print(f"📚 Retrieved {len(docs)} knowledge base chunks (Top Score: {docs[0]['score']})")
        return docs


@trace(name="mcp_tool_execution", span_type="tool")
def run_mcp_tool_execution(tool_name: str = "query_financial_db", args: Dict[str, Any] = None) -> Dict[str, Any]:
    """Test Model Context Protocol (MCP) Tool calling."""
    if args is None:
        args = {"account_id": "acc_enterprise_881"}
    print(f"\n[5] 🛠️  Running MCP Tool [{tool_name}] with args {args}...")
    result = MockMCPServer.call_tool(tool_name, args)
    print(f"📦 Tool Output: {result}")
    return result


@trace(name="autonomous_compliance_agent", span_type="agent")
def run_autonomous_agent(user_query: str = "Authorize high-value transaction compliance", account_id: str = "acc_99214_enterprise") -> Dict[str, Any]:
    """Test end-to-end multi-agent orchestration (RAG + MCP + Gemini + OpenAI)."""
    print(f"\n[6] 🤖 Running Full Autonomous Multi-Agent Loop for: '{user_query}'...")

    # Step 1: SDK Clients
    gemini_client = wrap_gemini(MockGoogleGenAIClient())
    openai_client = MockOpenAIClient()
    instrument_openai(openai_client)

    # Step 2: RAG Vector Knowledge Base Search
    docs = MockVectorDatabase.search(query=user_query, top_k=3)

    # Step 3: MCP Tool Call - Financial DB Lookup
    account_info = MockMCPServer.call_tool("query_financial_db", {"account_id": account_id})

    # Step 4: MCP Tool Call - Compliance Rules Lookup
    compliance_info = MockMCPServer.call_tool("fetch_compliance_rules", {"jurisdiction": "US"})

    # Step 5: Gemini 2.0 Flash Reasoning & Synthesis
    with span("plan_synthesis", span_type="chain") as s:
        gemini_response = gemini_client.models.generate_content(
            model="gemini-2.0-flash",
            contents=f"User Query: {user_query}\nContext: {docs}\nAccount: {account_info}\nCompliance: {compliance_info}",
        )
        s.set_output({"gemini_summary": gemini_response.text})

    # Step 6: OpenAI GPT-4o Final Verification & Audit
    openai_response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "Verify compliance audit trail."},
            {"role": "user", "content": gemini_response.text},
        ]
    )

    final_result = {
        "status": "completed",
        "gemini_decision": gemini_response.text,
        "openai_audit": openai_response.choices[0].message.content,
        "account": account_info,
    }
    print("✅ Autonomous Agent Loop Finished!")
    return final_result


@trace(name="simulated_failure_workflow", span_type="agent")
def run_simulated_failure(failure_type: str = "database_timeout") -> None:
    """Test error capturing, stack trace serialization, and UI error clustering."""
    print(f"\n[7] ⚠️  Running Simulated Failure Scenario: '{failure_type}'...")
    
    with span("pre_flight_check", span_type="custom") as s:
        s.set_output({"status": "ready"})

    with span("external_api_call", span_type="tool") as s:
        s.set_attribute("target_system", "third_party_banking_gateway")
        time.sleep(0.03)
        if failure_type == "rate_limit":
            raise ConnectionRefusedError("429 Too Many Requests: Upstream LLM rate limit exceeded. Retry-After: 30s")
        elif failure_type == "auth_error":
            raise PermissionError("401 Unauthorized: Invalid or expired API credentials for workspace_prod.")
        else:
            raise TimeoutError("504 Gateway Timeout: Database connection pool exhausted after 3000ms.")


@trace(name="secure_pii_redaction_workflow", span_type="agent")
def run_pii_redaction_demo() -> Dict[str, Any]:
    """Demonstrates client-side PII & secret masking with Redactor before telemetry export."""
    print("\n[8] 🛡️  Running Client-Side Sensitive PII & Secret Redaction...")
    
    # 1. Attach user metadata
    feenion.set_user("compliance_officer_904")
    feenion.set_session("sess_gdpr_audit_771")
    feenion.set_tag("security_level", "CONFIDENTIAL")

    # 2. Raw payload containing sensitive API keys, passwords, and tokens
    raw_payload = {
        "user_email": "jane.doe@enterprise.com",
        "api_key": "sk-live-99214-secret-token-abcdef123456",
        "password": "SuperSecretPassword123!",
        "auth_token": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "credit_card": "4111-2222-3333-4444",
        "nested_details": {
            "secret_key": "super_secret_signing_key_441",
            "account_status": "active",
        },
    }

    # 3. Apply Feenion Redactor
    redactor = Redactor()
    safe_payload = redactor.redact(raw_payload)

    with span("process_sanitized_payload", span_type="tool") as s:
        s.set_input({"raw_fields_count": len(raw_payload)})
        s.set_output({"sanitized_payload": safe_payload})
        feenion.add_event("redaction_applied", {
            "masked_fields": ["api_key", "password", "auth_token", "secret_key"],
            "status": "zero_leakage",
        })

    print(f"🔒 Sensitive fields safely redacted in memory: {safe_payload}")
    return safe_payload


@trace(name="customized_telemetry_workflow", span_type="agent")
def run_customization_demo() -> Dict[str, Any]:
    """Demonstrates feenion.set_user, feenion.set_session, feenion.set_tag, feenion.add_event."""
    print("\n[9] 🏷️  Running Dynamic Customization (Tags, User, Session, Events)...")

    feenion.set_user("senior_analyst_88")
    feenion.set_session("chat_sess_99412")
    feenion.set_tag("jurisdiction", "EU_GDPR")
    feenion.set_tag("environment", "production")
    feenion.set_attribute("risk_score", 0.94)

    with span("validation_checkpoint", span_type="custom") as s:
        feenion.add_event("rule_evaluation_start", {"ruleset": "FINRA_2026"})
        time.sleep(0.02)
        feenion.add_event("rule_evaluation_passed", {"rules_passed": 24, "flagged": 0})
        s.set_output({"status": "compliant"})

    print("🏷️  Attached custom user, session, tags, attributes, and timestamped events!")
    return {"user": "senior_analyst_88", "jurisdiction": "EU_GDPR"}


# -----------------------------------------------------------------------------
# 6. Interactive CLI Chat Menu Loop
# -----------------------------------------------------------------------------

def print_banner(server_url: str):
    print("\n" + "=" * 70)
    print("  🚀 Feenion AI Observability — Interactive Debugging CLI")
    print(f"  📡 Live Dashboard Endpoint: {server_url}")
    print(f"  🏢 Global Telemetry:        '(Default Workspace)'")
    print(f"  🎯 RAG Scenario [4] Target: {RAG_TARGET_WORKSPACE_ID or '(Default Workspace)'}")
    print("=" * 70)
    print("Select an action to simulate and observe live in the UI:\n")
    print("  [1] ⚙️  Standard Function & Custom Spans")
    print("  [2] ✨ Google Gemini 2.0 Flash LLM Chat")
    print("  [3] 🟢 OpenAI GPT-4o Chat Completion")
    print("  [4] 🔍 RAG Vector DB Semantic Search (Isolated Workspace Demo)")
    print("  [5] 🛠️  Model Context Protocol (MCP) Tool Calling")
    print("  [6] 🤖 Full Multi-Step Autonomous Agent Loop")
    print("  [7] ⚠️  Simulated Failure & Error Diagnostic")
    print("  [8] 🛡️  Client-Side PII & Secret Redaction (Zero Leakage)")
    print("  [9] 🏷️  Tags, User, Session & Event Customization")
    print(" [10] 💬 Interactive Freeform Chat Query")
    print("  [a] 🚀 Run ALL scenarios sequentially")
    print("  [q] 🚪 Quit")
    print("-" * 70)


def run_interactive_cli(server_url: str = "http://localhost:8000"):
    # Configure Feenion with Default Workspace (All standard scenarios go to Default)
    configure(
        server_url=server_url,
        exporter=CompositeExporter([
            ConsoleExporter(),
            AsyncExporter(
                HTTPExporter(
                    endpoint=server_url,
                    timeout=2.0,
                    max_retries=1,
                )
            ),
        ]),
    )

    # Check if run non-interactively (e.g. CI / pipe)
    if not sys.stdin.isatty():
        print("Non-interactive mode detected. Running full simulation suite...")
        run_simple_function_trace()
        run_gemini_chat_trace()
        run_openai_chat_trace()
        run_rag_vector_search()
        run_mcp_tool_execution()
        run_autonomous_agent()
        run_pii_redaction_demo()
        run_customization_demo()
        try:
            run_simulated_failure()
        except Exception:
            pass
        return

    while True:
        print_banner(server_url)
        try:
            choice = input("👉 Enter choice [1-10, a, q]: ").strip().lower()
        except (KeyboardInterrupt, EOFError):
            print("\nExiting. Happy debugging!")
            break

        if choice in ('q', 'exit', 'quit'):
            print("Exiting Feenion CLI Simulator. Goodbye!")
            break

        elif choice == '1':
            run_simple_function_trace()
        elif choice == '2':
            prompt = input("   Enter Gemini prompt (or press Enter for default): ").strip()
            run_gemini_chat_trace(prompt if prompt else "Explain quantum computing in one sentence.")
        elif choice == '3':
            prompt = input("   Enter OpenAI prompt (or press Enter for default): ").strip()
            run_openai_chat_trace(prompt if prompt else "Analyze database replication topology.")
        elif choice == '4':
            query = input("   Enter search query (or press Enter for default): ").strip()
            run_rag_vector_search(query if query else "enterprise security compliance rules")
        elif choice == '5':
            tool = input("   Tool name [1: query_financial_db, 2: weather_lookup, 3: fetch_compliance_rules]: ").strip()
            if tool == '2':
                run_mcp_tool_execution("weather_lookup", {"city": "Zurich"})
            elif tool == '3':
                run_mcp_tool_execution("fetch_compliance_rules", {"jurisdiction": "EU"})
            else:
                run_mcp_tool_execution("query_financial_db", {"account_id": "acc_corp_9941"})
        elif choice == '6':
            query = input("   Agent goal (or press Enter for default): ").strip()
            run_autonomous_agent(query if query else "Verify compliance and risk tier for withdrawal")
        elif choice == '7':
            err_opt = input("   Error type [1: Database Timeout, 2: LLM Rate Limit 429, 3: Auth 401]: ").strip()
            err_type = "rate_limit" if err_opt == '2' else "auth_error" if err_opt == '3' else "database_timeout"
            try:
                run_simulated_failure(err_type)
            except Exception as e:
                print(f"🚨 Caught expected test error: {e}")
        elif choice == '8':
            run_pii_redaction_demo()
        elif choice == '9':
            run_customization_demo()
        elif choice == '10':
            query = input("💬 Ask anything (triggers dynamic Agent + RAG + MCP): ").strip()
            if query:
                run_autonomous_agent(user_query=query, account_id="acc_chat_session")
        elif choice == 'a':
            print("\n🚀 Running ALL observability scenarios...")
            run_simple_function_trace()
            run_gemini_chat_trace()
            run_openai_chat_trace()
            run_rag_vector_search()
            run_mcp_tool_execution()
            run_autonomous_agent()
            run_pii_redaction_demo()
            run_customization_demo()
            try:
                run_simulated_failure("database_timeout")
            except Exception as e:
                print(f"🚨 Caught test error: {e}")
            print("\n✅ All scenarios executed and transmitted to dashboard!")
        else:
            print("Invalid selection. Please enter a number between 1 and 10, 'a', or 'q'.")

        time.sleep(0.4)


if __name__ == "__main__":
    server_target = "http://localhost:8000"
    if len(sys.argv) > 1 and sys.argv[1].startswith("http"):
        server_target = sys.argv[1]

    run_interactive_cli(server_target)

