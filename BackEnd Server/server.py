from flask import Flask

from controllers.UserController import user_bp
from controllers.LocationController import location_bp

# .\venv\Scripts\activatepython
# uvicorn server.main:app --host 127.0.0.1 --port 5010 --reload
# deactivate
app = Flask(__name__)

# Blueprints
app.register_blueprint(user_bp)
app.register_blueprint(location_bp)

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
    response.headers['Access-Control-Allow-Origin'] = 'http://127.0.0.1:5020'
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    return response

# app.run(debug=True)
app.run(host='127.0.0.1', port=5010, debug=True)