import pytest

from backend.app_factory import create_app
from backend.config import load_config
from backend.Security.Auth import generate_token


@pytest.fixture
def config():
    return load_config({})


@pytest.fixture
def app(config):
    return create_app(config)


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def auth_header():
    def build(user_id, role):
        return {"Authorization": f"Bearer {generate_token(user_id, role)}"}

    return build
