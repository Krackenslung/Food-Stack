import logging
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from werkzeug.exceptions import HTTPException

from backend.config import Config, load_config
from backend.errors import AppError, RecordNotFoundException
from backend.Services.container import Services

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend" / "dist"  # built by `npm run build`

logger = logging.getLogger(__name__)

HTTP_ERROR_CODES = {
    400: "BAD_REQUEST",
    401: "UNAUTHENTICATED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    409: "CONFLICT",
    415: "UNSUPPORTED_MEDIA_TYPE",
    422: "VALIDATION_ERROR",
    429: "RATE_LIMITED",
}


def _error_response(message, http_status, error_code):
    return (
        jsonify({"status": 1, "errorMessage": str(message), "errorCode": error_code}),
        http_status,
    )


def register_blueprints(app):
    # Imported lazily so create_app() controls when env/config is read.
    from backend.Controllers.admin_controller import admin_bp
    from backend.Controllers.auth_controller import auth_bp
    from backend.Controllers.category_controller import category_bp
    from backend.Controllers.ingredient_controller import ingredient_bp
    from backend.Controllers.order_controller import order_bp
    from backend.Controllers.order_product_controller import order_product_bp
    from backend.Controllers.order_product_ingredient_controller import (
        order_product_ingredient_bp,
    )
    from backend.Controllers.payment_controller import payment_bp
    from backend.Controllers.product_controller import product_bp
    from backend.Controllers.product_ingredient_controller import product_ingredient_bp
    from backend.Controllers.public_controller import public_bp
    from backend.Controllers.user_controller import user_bp

    for blueprint in (
        public_bp,  # first: its paths win over the legacy ones when the SQL services are on
        user_bp,
        category_bp,
        product_bp,
        ingredient_bp,
        order_bp,
        product_ingredient_bp,
        order_product_bp,
        order_product_ingredient_bp,
        payment_bp,
        auth_bp,
        admin_bp,
    ):
        app.register_blueprint(blueprint, url_prefix="/api")


def register_cors(app, config):
    @app.after_request
    def add_cors_headers(response):
        # Same-origin (Flask serves the frontend) needs no CORS. Only the configured
        # FRONTEND_ORIGIN may call the API cross-origin, with credentials.
        origin = request.headers.get("Origin", "").rstrip("/")
        if config.frontend_origin and origin == config.frontend_origin:
            response.headers["Access-Control-Allow-Origin"] = config.frontend_origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            response.headers["Access-Control-Allow-Methods"] = (
                "GET, POST, PUT, PATCH, DELETE, OPTIONS"
            )
        response.headers.add("Vary", "Origin")
        return response


def register_error_handlers(app, config):
    @app.errorhandler(RecordNotFoundException)
    def handle_not_found_record(error):
        return _error_response(error, 404, "RECORD_NOT_FOUND")

    @app.errorhandler(AppError)
    def handle_app_error(error):
        return _error_response(error, error.http_status, error.error_code)

    @app.errorhandler(HTTPException)
    def handle_http_exception(error):
        code = error.code or 500
        return _error_response(error.description, code, HTTP_ERROR_CODES.get(code, "HTTP_ERROR"))

    @app.errorhandler(Exception)
    def handle_unexpected(error):
        logger.exception("Unhandled error on %s %s", request.method, request.path)
        message = "Internal server error." if config.is_production else str(error)
        return _error_response(message, 500, "INTERNAL_ERROR")


def register_frontend(app, frontend_dir):
    """Serve the built React app. Real files (assets, images) are sent as they are and every
    other non-API path gets index.html so React Router can handle the route."""
    index = frontend_dir / "index.html"

    def spa():
        if not index.is_file():
            return _error_response(
                "The frontend is not built. Run `npm run build` in frontend/.",
                503,
                "FRONTEND_NOT_BUILT",
            )
        response = send_from_directory(frontend_dir, "index.html")
        response.headers["Cache-Control"] = "no-cache"  # new deploys must reach users at once
        return response

    @app.route("/")
    def root():
        return spa()

    @app.route("/<path:resource>")
    def frontend_resource(resource):
        if resource.startswith("api/"):
            return _error_response("API route not found.", 404, "NOT_FOUND")

        target = (frontend_dir / resource).resolve()
        if frontend_dir.resolve() in target.parents and target.is_file():
            response = send_from_directory(frontend_dir, resource)
            if resource.startswith("assets/"):  # hashed file names: cache for a year
                response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
            return response
        return spa()


def create_app(
    config: Config | None = None,
    frontend_dir: Path | None = None,
    services: Services | None = None,
):
    config = config or load_config()

    app = Flask(__name__)
    app.secret_key = config.flask_secret_key
    app.config["FOODSTACK"] = config
    app.extensions["foodstack_services"] = services or Services()

    register_blueprints(app)
    register_cors(app, config)
    register_error_handlers(app, config)

    @app.route("/api/test")
    def test():
        return jsonify({"status": 0, "message": "API funcionando"}), 200

    register_frontend(app, frontend_dir or FRONTEND_DIR)
    return app
