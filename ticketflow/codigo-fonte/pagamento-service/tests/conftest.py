import os
import tempfile

import pytest

# Banco temporário próprio dos testes (definido antes de importar a aplicação).
_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/teste.db"
os.environ.setdefault("SEED_EXEMPLOS", "false")

from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture
def client():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
