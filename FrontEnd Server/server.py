from flask import Flask, render_template, redirect, url_for

import config

app = Flask(__name__)

@app.route("/")
def home():
    return redirect(url_for("app_view"))

@app.route("/login")
def login():
    return render_template("login.html", api_base=config.API_BASE)

@app.route("/register")
def register():
    return render_template("register.html", api_base=config.API_BASE)

@app.route("/app")
def app_view():
    # The Maps key comes from .env and is injected into the page; the JS
    # modules read it from the <meta> tag instead of hardcoding it.
    return render_template(
        "app.html",
        maps_api_key=config.GOOGLE_MAPS_API_KEY,
        api_base=config.API_BASE,
    )

@app.route("/logout")
def logout():
    return redirect(url_for("home"))

if __name__ == "__main__":
    app.run(debug=True, port=5020)
