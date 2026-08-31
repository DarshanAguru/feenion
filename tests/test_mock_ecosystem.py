import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from examples.comprehensive_mock_ecosystem import (
    MockGoogleGenAIClient,
    MockOpenAIClient,
    MockMCPServer,
    MockVectorDatabase,
    run_simple_function_trace,
    run_gemini_chat_trace,
    run_openai_chat_trace,
    run_rag_vector_search,
    run_mcp_tool_execution,
    run_autonomous_agent,
    run_simulated_failure,
)
from feenion.integrations import wrap_gemini, instrument_openai

def test_mock_ecosystem_pipeline():
    # 1. Test standard function trace
    fn_res = run_simple_function_trace()
    assert fn_res["status"] == "success"

    # 2. Test Gemini chat trace
    gem_text = run_gemini_chat_trace("Test query")
    assert "Gemini 2.0 Flash" in gem_text

    # 3. Test OpenAI chat trace
    oai_text = run_openai_chat_trace("Test query")
    assert "GPT-4o evaluated" in oai_text

    # 4. Test RAG Vector retrieval
    chunks = run_rag_vector_search("security compliance")
    assert len(chunks) == 3
    assert chunks[0]["score"] == 0.94

    # 5. Test MCP tool
    tool_res = run_mcp_tool_execution("query_financial_db", {"account_id": "acc_test_123"})
    assert tool_res["status"] == "active"

    # 6. Test full autonomous multi-step agent
    agent_output = run_autonomous_agent(
        user_query="Test compliance verification",
        account_id="acc_unit_test",
    )
    assert agent_output["status"] == "completed"
    assert "account" in agent_output

    # 7. Test simulated failure
    with pytest.raises(TimeoutError):
        run_simulated_failure("database_timeout")

