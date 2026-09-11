from flask import Flask

from controllers.UserController import user_bp
from controllers.LocationController import location_bp
from controllers.FavoriteController import favorite_bp
from controllers.SupportController import support_bp
import config

# .\venv\Scripts\activatepython
# uvicorn server.main:app --host 127.0.0.1 --port 5010 --reload
# deactivate

# App factory: the server is importable (tests, WSGI) without launching
def create_app():
    app = Flask(__name__)

    # Blueprints
    app.register_blueprint(user_bp)
    app.register_blueprint(location_bp)
    app.register_blueprint(favorite_bp)
    app.register_blueprint(support_bp)

    # Root (localhost:5010)
    @app.route('/')
    def home():
        return {
            "status": 0,
            "message": "Server is now up and running..."
        }

    # Cors headers
    @app.after_request
    def add_cors_headers(response):
        response.headers['Access-Control-Allow-Origin'] = config.FRONTEND_ORIGIN
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        return response

    return app

# app.run(debug=True)
if __name__ == "__main__":
    create_app().run(host='127.0.0.1', port=5010, debug=True)
