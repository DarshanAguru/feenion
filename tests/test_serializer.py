from datetime import datetime, timezone
from uuid import uuid4
from dataclasses import dataclass
from pydantic import BaseModel

from feenion.serializer import safe_serialize, TelemetrySerializer

@dataclass
class SampleDataClass:
    name: str
    count: int

class SamplePydantic(BaseModel):
    key: str
    value: float

def test_safe_serialize_primitives():
    assert safe_serialize(123) == 123
    assert safe_serialize("hello") == "hello"
    assert safe_serialize(True) is True
    assert safe_serialize(None) is None

def test_safe_serialize_complex():
    u = uuid4()
    now = datetime.now(timezone.utc)
    dc = SampleDataClass(name="test", count=5)
    py = SamplePydantic(key="k", value=3.14)
    exc = ValueError("something went wrong")

    data = {
        "uuid": u,
        "datetime": now,
        "dataclass": dc,
        "pydantic": py,
        "exception": exc,
    }

    serialized = safe_serialize(data)
    assert serialized["uuid"] == str(u)
    assert serialized["datetime"] == now.isoformat()
    assert serialized["dataclass"] == {"name": "test", "count": 5}
    assert serialized["pydantic"] == {"key": "k", "value": 3.14}
    assert serialized["exception"]["error_type"] == "ValueError"

def test_safe_serialize_truncation():
    serializer = TelemetrySerializer(max_string_length=10, max_collection_size=2, max_depth=2)
    
    long_str = "a" * 50
    res_str = serializer.serialize(long_str)
    assert "truncated" in res_str

    long_list = [1, 2, 3, 4, 5]
    res_list = serializer.serialize(long_list)
    assert len(res_list) == 3
    assert "truncated" in res_list[-1]

    deep_dict = {"a": {"b": {"c": {"d": 1}}}}
    res_deep = serializer.serialize(deep_dict)
    assert res_deep["a"]["b"]["c"] == "<max_depth_exceeded>"

