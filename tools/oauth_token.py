from __future__ import annotations

import json
import os
import sys
import time
import urllib.parse
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env"
TOKEN_PATH = ROOT / "tokens" / "alibaba_token.json"


def load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        raise SystemExit("Missing .env. Copy .env.example to .env and fill it in.")

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")

    return values


def require(env: dict[str, str], key: str) -> str:
    value = env.get(key, "")
    if not value or value.startswith("your_"):
        raise SystemExit(f"Set {key} in .env first.")
    return value


def build_authorize_url(env: dict[str, str]) -> str:
    auth_url = require(env, "ALIBABA_AUTH_URL")
    params = {
        "client_id": require(env, "ALIBABA_APP_KEY"),
        "redirect_uri": require(env, "ALIBABA_REDIRECT_URI"),
        "response_type": "code",
        "state": env.get("ALIBABA_STATE", "local-dev"),
    }
    scope = env.get("ALIBABA_SCOPE", "")
    if scope:
        params["scope"] = scope

    separator = "&" if "?" in auth_url else "?"
    return auth_url + separator + urllib.parse.urlencode(params)


class CallbackHandler(BaseHTTPRequestHandler):
    server_version = "AlibabaOAuthLocal/1.0"

    def do_GET(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed.query)
        self.server.auth_code = query.get("code", [""])[0]  # type: ignore[attr-defined]
        self.server.auth_state = query.get("state", [""])[0]  # type: ignore[attr-defined]
        self.server.auth_error = query.get("error", [""])[0]  # type: ignore[attr-defined]

        body = b"You can close this tab and return to the terminal."
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: object) -> None:
        return


def wait_for_code(redirect_uri: str) -> str:
    parsed = urllib.parse.urlparse(redirect_uri)
    host = parsed.hostname or "127.0.0.1"
    port = parsed.port or 80

    httpd = HTTPServer((host, port), CallbackHandler)
    httpd.auth_code = ""  # type: ignore[attr-defined]
    httpd.auth_error = ""  # type: ignore[attr-defined]

    deadline = time.time() + 300
    while time.time() < deadline:
        httpd.timeout = 1
        httpd.handle_request()
        if httpd.auth_error:  # type: ignore[attr-defined]
            raise SystemExit(f"Authorization failed: {httpd.auth_error}")  # type: ignore[attr-defined]
        if httpd.auth_code:  # type: ignore[attr-defined]
            return httpd.auth_code  # type: ignore[attr-defined]

    raise SystemExit("Timed out waiting for OAuth callback.")


def exchange_code(env: dict[str, str], code: str) -> dict[str, object]:
    token_url = require(env, "ALIBABA_TOKEN_URL")
    payload = {
        "grant_type": "authorization_code",
        "client_id": require(env, "ALIBABA_APP_KEY"),
        "client_secret": require(env, "ALIBABA_APP_SECRET"),
        "redirect_uri": require(env, "ALIBABA_REDIRECT_URI"),
        "code": code,
    }

    data = urllib.parse.urlencode(payload).encode("utf-8")
    req = urllib.request.Request(
        token_url,
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read().decode("utf-8")

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"raw": raw}


def main() -> int:
    env = load_env(ENV_PATH)
    redirect_uri = require(env, "ALIBABA_REDIRECT_URI")
    authorize_url = build_authorize_url(env)

    print("Open this URL if the browser does not open automatically:")
    print(authorize_url)
    webbrowser.open(authorize_url)

    code = wait_for_code(redirect_uri)
    token = exchange_code(env, code)

    TOKEN_PATH.parent.mkdir(parents=True, exist_ok=True)
    TOKEN_PATH.write_text(
        json.dumps(token, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Saved token response to {TOKEN_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

