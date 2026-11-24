from backend.app_factory import create_app
from backend.config import load_config
from backend.errors import ConflictError, RecordNotFoundException, ValidationError

PRODUCTION_ENV = {
    "APP_ENV": "production",
    "SQL_SERVER": "s",
    "DATABASE": "d",
    "SQL_USER": "u",
    "SQL_PASSWORD": "p",
    "JWT_SECRET_KEY": "j",
    "FLASK_SECRET_KEY": "f",
}


def add_failing_routes(app):
    @app.route("/api/_missing")
    def missing():
        raise RecordNotFoundException("Order 9 not found")

    @app.route("/api/_invalid")
    def invalid():
        raise ValidationError("Bad input", error_code="FIELD_REQUIRED")

    @app.route("/api/_conflict")
    def conflict():
        raise ConflictError("Nope")

    @app.route("/api/_boom")
    def boom():
        raise RuntimeError("secret detail")

    return app


def test_health(client):
    response = client.get("/api/test")
    assert response.status_code == 200
    assert response.get_json()["status"] == 0


def test_error_handlers_keep_the_envelope_and_add_error_codes(config):
    client = add_failing_routes(create_app(config)).test_client()
    cases = {
        "/api/_missing": (404, "RECORD_NOT_FOUND"),
        "/api/_invalid": (422, "FIELD_REQUIRED"),
        "/api/_conflict": (409, "CONFLICT"),
        "/api/_boom": (500, "INTERNAL_ERROR"),
    }
    for path, (http_status, code) in cases.items():
        response = client.get(path)
        body = response.get_json()
        assert response.status_code == http_status
        assert body["status"] == 1
        assert body["errorCode"] == code
        assert body["errorMessage"]


def test_unknown_api_route_and_wrong_method(client):
    missing = client.get("/api/does-not-exist")
    assert missing.status_code == 404
    assert missing.get_json()["errorCode"] == "NOT_FOUND"
    wrong_method = client.delete("/api/test")
    assert wrong_method.status_code == 405
    assert wrong_method.get_json()["errorCode"] == "METHOD_NOT_ALLOWED"


def test_production_hides_unexpected_error_details():
    app = add_failing_routes(create_app(load_config(PRODUCTION_ENV)))
    response = app.test_client().get("/api/_boom")
    assert response.status_code == 500
    assert "secret detail" not in response.get_json()["errorMessage"]


def test_cors_only_for_the_configured_origin():
    client = create_app(load_config({"FRONTEND_ORIGIN": "http://localhost:5173/"})).test_client()
    allowed = client.get("/api/test", headers={"Origin": "http://localhost:5173"})
    assert allowed.headers["Access-Control-Allow-Origin"] == "http://localhost:5173"
    assert allowed.headers["Access-Control-Allow-Credentials"] == "true"
    denied = client.get("/api/test", headers={"Origin": "http://evil.example"})
    assert "Access-Control-Allow-Origin" not in denied.headers


def test_no_cors_headers_when_origin_not_configured(client):
    response = client.get("/api/test", headers={"Origin": "http://localhost:5173"})
    assert "Access-Control-Allow-Origin" not in response.headers
