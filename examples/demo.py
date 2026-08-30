#!/usr/bin/env python3
"""
Feenion AI Observability Demo & Interactive Chat CLI

Features Demonstrated:
  1. Auto-Instrumentation (instrument_openai & instrument_anthropic)
  2. Multi-Span Agent Pipelines (@trace, with span(...))
  3. Sensitive Data Redaction (masking API keys, PII, passwords)
  4. Real-time WebSocket Telemetry Streaming
  5. Interactive Chat CLI + High-Volume Bulk Generator

Usage:
  python examples/demo.py                # Interactive Chat CLI + Auto-Generator
  python examples/demo.py --bulk 20      # Bulk generate 20 real-world traces
"""

import sys
import time
import random
from typing import Any
from types import SimpleNamespace

from feenion import trace, span, configure, set_model_pricing
from feenion.exporters import HTTPExporter, AsyncExporter
from feenion.redaction import Redactor, redact_data
from feenion.integrations.openai import instrument_openai
from feenion.integrations.anthropic import instrument_anthropic

# 1. Configure Exporter, Redactor & Tunable Model Pricing (Per 1M Tokens: input, output)
redactor = Redactor(sensitive_keys={"password", "api_key", "secret_token", "credit_card"})
exporter = AsyncExporter(
    HTTPExporter("http://localhost:8000", timeout=5.0),
    flush_interval=0.2,
)

# Developers can tune model pricing or override specific models on the fly
configure(
    exporter=exporter,
    model_pricing={
        "gpt-4o": (2.50, 10.00),               # $2.50 input, $10.00 output per 1M
        "claude-3-5-sonnet": (3.00, 15.00),     # $3.00 input, $15.00 output per 1M
        "gemini-1.5-pro": (3.50, 10.50),       # $3.50 input, $10.50 output per 1M
        "custom-enterprise-rag": (0.50, 1.50), # Custom in-house fine-tune
    },
)

# 2. Setup Simulated OpenAI & Anthropic Clients with Auto-Instrumentation
class MockOpenAIChatCompletions:
    def create(self, model: str, messages: list[dict], **kwargs):
        time.sleep(random.uniform(0.15, 0.35))
        prompt_text = " ".join(m.get("content", "") for m in messages)
        p_tokens = max(50, len(prompt_text.split()) * 4 + random.randint(100, 300))
        c_tokens = random.randint(80, 240)

        return SimpleNamespace(
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(
                        role="assistant",
                        content=f"[OpenAI {model}] Synthesized response answering: '{messages[-1]['content'][:60]}...'",
                    ),
                    finish_reason="stop",
                )
            ],
            usage=SimpleNamespace(
                prompt_tokens=p_tokens,
                completion_tokens=c_tokens,
                total_tokens=p_tokens + c_tokens,
            ),
        )

class MockOpenAIClient:
    def __init__(self):
        self.chat = SimpleNamespace(completions=MockOpenAIChatCompletions())

class MockAnthropicMessages:
    def create(self, model: str, messages: list[dict], **kwargs):
        time.sleep(random.uniform(0.18, 0.38))
        prompt_text = " ".join(m.get("content", "") for m in messages)
        p_tokens = max(60, len(prompt_text.split()) * 4 + random.randint(120, 350))
        c_tokens = random.randint(90, 260)

        return SimpleNamespace(
            content=[
                SimpleNamespace(
                    text=f"[Claude {model}] In-depth analysis for: '{messages[-1]['content'][:60]}...'"
                )
            ],
            usage=SimpleNamespace(
                input_tokens=p_tokens,
                output_tokens=c_tokens,
            ),
        )

class MockAnthropicClient:
    def __init__(self):
        self.messages = MockAnthropicMessages()

# Initialize and Auto-Instrument Clients
openai_client = MockOpenAIClient()
anthropic_client = MockAnthropicClient()

instrument_openai(openai_client)
instrument_anthropic(anthropic_client)

# --- WORKFLOW SIMULATION STEPS ---

def simulate_knowledge_retrieval(query: str) -> list[str]:
    with span("vector_db_search", span_type="retrieval") as s:
        s.input = {"query": query, "top_k": 3, "collection": "enterprise_kb"}
        time.sleep(random.uniform(0.04, 0.09))
        docs = [
            f"Doc 1: Knowledge reference relevant to '{query[:30]}...'",
            "Doc 2: High availability architecture with sub-millisecond failover.",
            "Doc 3: Compliance policies require end-to-end telemetry auditing.",
        ]
        s.output = {"documents": docs, "similarity_scores": [0.96, 0.89, 0.82]}
        return docs

def simulate_tool_execution(tool_name: str, payload: dict) -> dict:
    with span(tool_name, span_type="tool") as s:
        s.input = redact_data(payload, redactor)
        time.sleep(random.uniform(0.06, 0.14))
        res = {
            "status": "success",
            "result": f"Executed tool '{tool_name}' successfully.",
            "timestamp": time.time()
        }
        s.output = res
        return res

# --- AGENT WORKFLOWS ---

@trace(name="openai_customer_support_agent", span_type="agent")
def run_openai_agent(user_message: str):
    docs = simulate_knowledge_retrieval(user_message)
    simulate_tool_execution("web_search", {"query": user_message, "api_key": "sk-secret-prod-key-998877"})

    messages = [
        {"role": "system", "content": "You are a helpful OpenAI customer support assistant."},
        {"role": "user", "content": f"Context:\n{docs}\n\nUser Question: {user_message}"},
    ]

    res = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
        temperature=0.3,
    )
    return res.choices[0].message.content, "gpt-4o"

@trace(name="claude_technical_analyst_agent", span_type="agent")
def run_claude_agent(user_message: str):
    docs = simulate_knowledge_retrieval(user_message)
    simulate_tool_execution("code_interpreter", {"query": user_message, "api_key": "sk-secret-prod-key-998877"})

    messages = [
        {"role": "system", "content": "You are a Claude technical reasoning assistant."},
        {"role": "user", "content": f"Context:\n{docs}\n\nUser Question: {user_message}"},
    ]

    res = anthropic_client.messages.create(
        model="claude-3-5-sonnet",
        messages=messages,
        temperature=0.3,
    )
    return res.content[0].text, "claude-3-5-sonnet"

from feenion.integrations.langchain import FeenionCallbackHandler, instrument_langchain
from uuid import uuid4

def run_langchain_agent(user_message: str):
    handler = FeenionCallbackHandler(trace_name="langchain_conversational_rag_agent")
    chain_id = uuid4()
    tool_id = uuid4()
    llm_id = uuid4()

    # 1. Root LangChain Agent Chain
    handler.on_chain_start(
        serialized={"name": "ConversationalRetrievalAgent"},
        inputs={"question": user_message},
        run_id=chain_id,
        tags=["enterprise-agent", "rag"],
    )

    # 2. Document Retriever Tool
    handler.on_tool_start(
        serialized={"name": "hybrid_vector_search"},
        input_str=user_message,
        run_id=tool_id,
        parent_run_id=chain_id,
    )
    time.sleep(random.uniform(0.05, 0.12))
    handler.on_tool_end(output={"context_docs": 3, "status": "relevant"}, run_id=tool_id)

    # 3. LLM Step
    handler.on_llm_start(
        serialized={"name": "ChatAnthropic"},
        prompts=[f"User: {user_message}"],
        run_id=llm_id,
        parent_run_id=chain_id,
        metadata={"model_name": "claude-3-5-sonnet"},
    )
    time.sleep(random.uniform(0.18, 0.35))
    ans_text = f"[LangChain Agent] Resolved query: '{user_message[:50]}...' with grounded tools."
    p_tok = random.randint(220, 550)
    c_tok = random.randint(70, 210)
    mock_res = SimpleNamespace(
        generations=[[SimpleNamespace(text=ans_text)]],
        llm_output={"token_usage": {"prompt_tokens": p_tok, "completion_tokens": c_tok, "total_tokens": p_tok + c_tok}},
    )
    handler.on_llm_end(response=mock_res, run_id=llm_id)

    # 4. Finish Root Chain
    handler.on_chain_end(outputs={"output": ans_text}, run_id=chain_id)
    return ans_text, "langchain (claude-3-5-sonnet)"

@trace(name="payment_gateway_checkout_agent", span_type="agent")
def run_failing_scenario():
    with span("payment_gateway_checkout", span_type="tool") as s:
        s.input = {"gateway": "stripe", "action": "charge_customer", "amount": 9900}
        time.sleep(0.06)
        try:
            raise ConnectionError("Upstream timeout: Payment service 504 Gateway Timeout")
        except Exception as exc:
            s.fail(exc)
            raise exc

# --- RUNNER MODES ---

def run_bulk_simulation(count: int = 15):
    print(f"\n🚀 Ingesting {count} realistic agent traces (Auto-Instrumented + Multi-Tool)...")
    scenarios = [
        "How do we configure zero-downtime database failover?",
        "Draft a summary of quarterly ARR growth and churn",
        "Explain JWT authentication middleware architecture",
        "Generate optimized SQL queries for high-volume transactions",
        "Review pull request for token bucket rate limiting",
        "Audit sensitive credentials in log payloads",
        "Calculate token usage budget forecast for next sprint",
    ]

    for i in range(count):
        prompt = random.choice(scenarios)
        try:
            if i % 8 == 7:
                run_failing_scenario()
            elif i % 3 == 0:
                ans, model = run_langchain_agent(f"{prompt} (Run #{i+1})")
                print(f"  [{i+1}/{count}] ✅ Trace '{prompt[:32]}...' ({model})")
            elif i % 2 == 0:
                ans, model = run_claude_agent(f"{prompt} (Run #{i+1})")
                print(f"  [{i+1}/{count}] ✅ Trace '{prompt[:32]}...' ({model})")
            else:
                ans, model = run_openai_agent(f"{prompt} (Run #{i+1})")
                print(f"  [{i+1}/{count}] ✅ Trace '{prompt[:32]}...' ({model})")
        except Exception:
            print(f"  [{i+1}/{count}] ❌ Simulated failure recorded in trace")
        time.sleep(0.08)

    print("\n⏳ Flushing traces to Feenion Server...")
    exporter.flush()
    print("✨ Traces pushed! Open http://localhost:8000 to see live metrics and proportional mindmaps!")

def run_interactive_cli_chat():
    print("\n" + "=" * 70)
    print("  💬 Feenion Interactive AI Chat CLI")
    print("  Demonstrates Auto-Instrumentation (OpenAI, Anthropic & LangChain)")
    print("  Type any message to simulate an agent pipeline with live telemetry!")
    print("  Open http://localhost:8000 in your browser to watch the dashboard update live!")
    print("  (Type 'exit' to quit, or 'bulk' to generate 15 bulk traces)")
    print("=" * 70 + "\n")

    while True:
        try:
            user_input = input("🤖 Ask AI Assistant > ").strip()
            if not user_input:
                continue
            if user_input.lower() in ("exit", "quit", "q"):
                print("👋 Exiting interactive chat. Goodbye!")
                break
            if user_input.lower() == "bulk":
                run_bulk_simulation(15)
                continue

            mode = random.choice(["openai", "anthropic", "langchain"])
            if mode == "langchain":
                print("   ⏳ Running LangChain ConversationalRetrievalAgent with Tool & Claude...")
                answer, model = run_langchain_agent(user_input)
            elif mode == "anthropic":
                print("   ⏳ Running vector search, tools & Auto-Instrumented Claude Agent...")
                answer, model = run_claude_agent(user_input)
            else:
                print("   ⏳ Running vector search, tools & Auto-Instrumented OpenAI Agent...")
                answer, model = run_openai_agent(user_input)

            print(f"   ⚡ [{model}]: {answer}")
            print("   📡 Telemetry sent -> Updated in Feenion Dashboard in real-time!\n")
            exporter.flush()
        except (KeyboardInterrupt, EOFError):
            print("\n👋 Exiting.")
            break

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--bulk":
        num = int(sys.argv[2]) if len(sys.argv) > 2 else 15
        run_bulk_simulation(num)
    else:
        run_bulk_simulation(5)
        run_interactive_cli_chat()
    
    exporter.shutdown()
