import time

from feenion import span, trace, configure
from feenion.exporters import HTTPExporter, AsyncExporter
from typing import Any

configure(
    exporter = AsyncExporter(
        HTTPExporter("http://localhost:8000")
    )
)

def search_web(query):

    with span(
        "http_request",
        span_type="http",
    ) as current_span:

        current_span.input = {
            "query": query
        }

        time.sleep(0.05)

        current_span.output = {
            "status_code": 200
        }

def retireve(question: str) -> Any:
    with span("vector_search", span_type="retrieval") as s:
        s.input = {
            "question": question,
        }

        search_web(question)


        return ["document"]

def generate(question: str, documents: list[str]) -> Any:
    with span("llm", span_type="llm") as s:
        s.input = {
            "question": question,
            "documents": documents,
        }

        time.sleep(0.2)

        answer = (
            "Customers can request a refund "
            "within 30 days."
        )

        s.output = {
            "answer": answer,
        }

        s.add_event(
            "llm.response",
            {
                "model": "fake-model",
            },
        )

        return answer

@trace
def ask(question: str) -> Any:
    documents = retireve(question)
    answer = generate(question, documents)

    return answer

if __name__ == "__main__":
    answer = ask("What is the refund policy?")

    print(answer)