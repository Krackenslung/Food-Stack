import os
import sys
from pathlib import Path

from flask import Flask, jsonify, send_from_directory
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.Controllers.user_controller import user_bp
from backend.Controllers.category_controller import category_bp
from backend.Controllers.product_controller import product_bp
from backend.Controllers.ingredient_controller import ingredient_bp
from backend.Controllers.order_controller import order_bp
from backend.Controllers.product_ingredient_controller import product_ingredient_bp
from backend.Controllers.order_product_controller import order_product_bp
from backend.Controllers.order_product_ingredient_controller import order_product_ingredient_bp

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR / "frontend"

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "secret_key")

app.register_blueprint(user_bp, url_prefix="/api")
app.register_blueprint(category_bp, url_prefix="/api")
app.register_blueprint(product_bp, url_prefix="/api")
app.register_blueprint(ingredient_bp, url_prefix="/api")
app.register_blueprint(order_bp, url_prefix="/api")
app.register_blueprint(product_ingredient_bp, url_prefix="/api")
app.register_blueprint(order_product_bp, url_prefix="/api")
app.register_blueprint(order_product_ingredient_bp, url_prefix="/api")


@app.route("/api/test")
def test():
    return jsonify({
        "status": "ok",
        "message": "API funcionando"
    }), 200


@app.route("/")
def root():
    return send_from_directory(FRONTEND_DIR, "home.html")


@app.route("/<path:resource>")
def frontend_resource(resource):
    if resource.startswith("api/"):
        return jsonify({
            "status": 1,
            "errorMessage": "API route not found."
        }), 404

    direct_target = FRONTEND_DIR / resource
    if direct_target.is_file():
        return send_from_directory(FRONTEND_DIR, resource)

    if "." not in resource:
        html_target = FRONTEND_DIR / f"{resource}.html"
        if html_target.is_file():
            return send_from_directory(FRONTEND_DIR, f"{resource}.html")

    return send_from_directory(FRONTEND_DIR, "login.html")


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    return response


if __name__ == "__main__":
    app.run(debug=True)
