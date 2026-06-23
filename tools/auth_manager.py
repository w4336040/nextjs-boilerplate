from __future__ import annotations

import argparse
import json
import time
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env"
TOKEN_PATH = ROOT / "tokens" / "alibaba_token.json"
DEFAULT_CALLBACK_TIMEOUT_SECONDS = 300
TOKEN_EXPIRY_SAFETY_SECONDS = 300


def load_env(path: Path = ENV_PATH) -> dict[str, str]:
    if not path.exists():
        raise SystemExit("Missing .env. Copy .env.example to .env and fill it in.")

    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def require(env: dict[str, str], key: str) -> str:
    value = env.get(key, "")
    if not value or value.startswith("your_") or value.startswith("official_"):
        raise SystemExit(f"Set {key} in .env first.")
    return value


def optional_int(env: dict[str, str], key: str, default: int) -> int:
    raw = env.get(key, "")
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError as exc:
        raise SystemExit(f"{key} must be an integer.") from exc


def now() -> int:
    return int(time.time())


def redacted(value: str | None) -> str:
    if not value:
        return ""
    if len(value) <= 12:
        return value[:2] + "***"
    return value[:6] + "..." + value[-4:]


@dataclass
class TokenRecord:
    raw: dict[str, Any]
    created_at: int
    expires_at: int | None

    @classmethod
    def from_response(cls, response: dict[str, Any]) -> "TokenRecord":
        created_at = now()
        expires_at = None
        expires_in = response.get("expires_in") or response.get("expiresIn")
        if expires_in is not None:
            try:
                expires_at = created_at + int(expires_in)
            except (TypeError, ValueError):
                expires_at = None
        return cls(raw=response, created_at=created_at, expires_at=expires_at)

    @property
    def access_token(self) -> str:
        value = self.raw.get("access_token") or self.raw.get("accessToken")
        return str(value or "")

    @property
    def refresh_token(self) -> str:
        value = self.raw.get("refresh_token") or self.raw.get("refreshToken")
        return str(value or "")

    @property
    def is_expiring(self) -> bool:
        if self.expires_at is None:
            return False
        return now() >= self.expires_at - TOKEN_EXPIRY_SAFETY_SECONDS

    def to_file_payload(self) -> dict[str, Any]:
        return {
            "created_at": self.created_at,
            "expires_at": self.expires_at,
            "token": self.raw,
        }

    @classmethod
    def from_file_payload(cls, payload: dict[str, Any]) -> "TokenRecord":
        token = payload.get("token")
        if not isinstance(token, dict):
            token = payload
        return cls(
            raw=token,
            created_at=int(payload.get("created_at") or now()),
            expires_at=payload.get("expires_at"),
        )


class TokenStore:
    def __init__(self, path: Path = TOKEN_PATH) -> None:
        self.path = path

    def load(self) -> TokenRecord | None:
        if not self.path.exists():
            return None
        payload = json.loads(self.path.read_text(encoding="utf-8"))
        return TokenRecord.from_file_payload(payload)

    def save(self, record: TokenRecord) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(
            json.dumps(record.to_file_payload(), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def delete(self) -> None:
        if self.path.exists():
            self.path.unlink()


class CallbackHandler(BaseHTTPRequestHandler):
    server_version = "AlibabaOAuthLocal/1.0"

    def do_GET(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed.query)
        self.server.auth_code = query.get("code", [""])[0]  # type: ignore[attr-defined]
        self.server.auth_state = query.get("state", [""])[0]  # type: ignore[attr-defined]
        self.server.auth_error = query.get("error", [""])[0]  # type: ignore[attr-defined]
        self.server.auth_error_description = query.get("error_description", [""])[0]  # type: ignore[attr-defined]

        if self.server.auth_error:  # type: ignore[attr-defined]
            body = b"Authorization failed. You can close this tab."
        else:
            body = b"Authorization received. You can close this tab."

        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: object) -> None:
        return


class AlibabaOAuthClient:
    def __init__(self, env: dict[str, str]) -> None:
        self.env = env

    def build_authorize_url(self) -> str:
        auth_url = require(self.env, "ALIBABA_AUTH_URL")
        params = {
            self.env.get("ALIBABA_AUTH_CLIENT_ID_PARAM", "client_id"): require(self.env, "ALIBABA_APP_KEY"),
            self.env.get("ALIBABA_AUTH_REDIRECT_URI_PARAM", "redirect_uri"): require(self.env, "ALIBABA_REDIRECT_URI"),
            self.env.get("ALIBABA_AUTH_RESPONSE_TYPE_PARAM", "response_type"): "code",
            self.env.get("ALIBABA_AUTH_STATE_PARAM", "state"): self.env.get("ALIBABA_STATE", "local-dev"),
        }
        scope = self.env.get("ALIBABA_SCOPE", "")
        if scope:
            params[self.env.get("ALIBABA_AUTH_SCOPE_PARAM", "scope")] = scope

        separator = "&" if "?" in auth_url else "?"
        return auth_url + separator + urllib.parse.urlencode(params)

    def wait_for_code(self) -> str:
        redirect_uri = require(self.env, "ALIBABA_REDIRECT_URI")
        parsed = urllib.parse.urlparse(redirect_uri)
        host = parsed.hostname or "127.0.0.1"
        port = parsed.port or 80
        expected_state = self.env.get("ALIBABA_STATE", "local-dev")
        timeout_seconds = optional_int(
            self.env,
            "ALIBABA_CALLBACK_TIMEOUT_SECONDS",
            DEFAULT_CALLBACK_TIMEOUT_SECONDS,
        )

        httpd = HTTPServer((host, port), CallbackHandler)
        httpd.auth_code = ""  # type: ignore[attr-defined]
        httpd.auth_state = ""  # type: ignore[attr-defined]
        httpd.auth_error = ""  # type: ignore[attr-defined]
        httpd.auth_error_description = ""  # type: ignore[attr-defined]

        deadline = time.time() + timeout_seconds
        while time.time() < deadline:
            httpd.timeout = 1
            httpd.handle_request()
            if httpd.auth_error:  # type: ignore[attr-defined]
                detail = httpd.auth_error_description or httpd.auth_error  # type: ignore[attr-defined]
                raise SystemExit(f"Authorization failed: {detail}")
            if httpd.auth_code:  # type: ignore[attr-defined]
                if expected_state and httpd.auth_state != expected_state:  # type: ignore[attr-defined]
                    raise SystemExit("Authorization failed: OAuth state mismatch.")
                return str(httpd.auth_code)  # type: ignore[attr-defined]

        raise SystemExit("Timed out waiting for OAuth callback.")

    def exchange_code(self, code: str) -> TokenRecord:
        payload = {
            self.env.get("ALIBABA_TOKEN_GRANT_TYPE_PARAM", "grant_type"): "authorization_code",
            self.env.get("ALIBABA_TOKEN_CLIENT_ID_PARAM", "client_id"): require(self.env, "ALIBABA_APP_KEY"),
            self.env.get("ALIBABA_TOKEN_CLIENT_SECRET_PARAM", "client_secret"): require(self.env, "ALIBABA_APP_SECRET"),
            self.env.get("ALIBABA_TOKEN_REDIRECT_URI_PARAM", "redirect_uri"): require(self.env, "ALIBABA_REDIRECT_URI"),
            self.env.get("ALIBABA_TOKEN_CODE_PARAM", "code"): code,
        }
        return TokenRecord.from_response(self._post_token(payload))

    def refresh(self, refresh_token: str) -> TokenRecord:
        if not refresh_token:
            raise SystemExit("No refresh token is available. Run login again.")
        payload = {
            self.env.get("ALIBABA_TOKEN_GRANT_TYPE_PARAM", "grant_type"): "refresh_token",
            self.env.get("ALIBABA_TOKEN_CLIENT_ID_PARAM", "client_id"): require(self.env, "ALIBABA_APP_KEY"),
            self.env.get("ALIBABA_TOKEN_CLIENT_SECRET_PARAM", "client_secret"): require(self.env, "ALIBABA_APP_SECRET"),
            self.env.get("ALIBABA_TOKEN_REFRESH_TOKEN_PARAM", "refresh_token"): refresh_token,
        }
        return TokenRecord.from_response(self._post_token(payload))

    def _post_token(self, payload: dict[str, str]) -> dict[str, Any]:
        token_url = require(self.env, "ALIBABA_TOKEN_URL")
        data = urllib.parse.urlencode(payload).encode("utf-8")
        req = urllib.request.Request(
            token_url,
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                raw = resp.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            raise SystemExit(f"Token request failed: HTTP {exc.code}: {body}") from exc
        except urllib.error.URLError as exc:
            raise SystemExit(f"Token request failed: {exc.reason}") from exc

        try:
            result = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise SystemExit(f"Token response is not JSON: {raw[:500]}") from exc

        if "error" in result or "error_description" in result:
            raise SystemExit(f"Token response returned an error: {json.dumps(result, ensure_ascii=False)}")
        return result


def cmd_login(args: argparse.Namespace) -> int:
    env = load_env()
    client = AlibabaOAuthClient(env)
    store = TokenStore()
    url = client.build_authorize_url()
    print("Open this URL if the browser does not open automatically:")
    print(url)
    if not args.no_browser:
        webbrowser.open(url)
    code = client.wait_for_code()
    record = client.exchange_code(code)
    store.save(record)
    print(f"Saved token response to {store.path}")
    print_status(record)
    return 0


def cmd_status(args: argparse.Namespace) -> int:
    record = TokenStore().load()
    if record is None:
        print("No token found. Run: python tools/auth_manager.py login")
        return 1
    print_status(record)
    return 0


def cmd_refresh(args: argparse.Namespace) -> int:
    env = load_env()
    store = TokenStore()
    record = store.load()
    if record is None:
        raise SystemExit("No token found. Run login first.")
    refreshed = AlibabaOAuthClient(env).refresh(record.refresh_token)
    store.save(refreshed)
    print("Token refreshed.")
    print_status(refreshed)
    return 0


def cmd_access_token(args: argparse.Namespace) -> int:
    env = load_env()
    store = TokenStore()
    record = store.load()
    if record is None:
        raise SystemExit("No token found. Run login first.")
    if record.is_expiring and record.refresh_token:
        record = AlibabaOAuthClient(env).refresh(record.refresh_token)
        store.save(record)
    if not record.access_token:
        raise SystemExit("Token file does not contain an access token.")
    print(record.access_token)
    return 0


def cmd_logout(args: argparse.Namespace) -> int:
    TokenStore().delete()
    print("Local token deleted.")
    return 0


def print_status(record: TokenRecord) -> None:
    expires_text = "unknown"
    if record.expires_at is not None:
        remaining = max(record.expires_at - now(), 0)
        expires_text = f"{remaining} seconds remaining"
    print(
        json.dumps(
            {
                "has_access_token": bool(record.access_token),
                "access_token": redacted(record.access_token),
                "has_refresh_token": bool(record.refresh_token),
                "refresh_token": redacted(record.refresh_token),
                "created_at": record.created_at,
                "expires_at": record.expires_at,
                "expires": expires_text,
                "is_expiring": record.is_expiring,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Alibaba Open Platform OAuth token manager.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    login = subparsers.add_parser("login", help="Run browser OAuth and save token locally.")
    login.add_argument("--no-browser", action="store_true", help="Print the authorization URL without opening a browser.")
    login.set_defaults(func=cmd_login)

    status = subparsers.add_parser("status", help="Show local token status without printing secrets.")
    status.set_defaults(func=cmd_status)

    refresh = subparsers.add_parser("refresh", help="Refresh the token using refresh_token.")
    refresh.set_defaults(func=cmd_refresh)

    access_token = subparsers.add_parser("access-token", help="Print a usable access token for API calls.")
    access_token.set_defaults(func=cmd_access_token)

    logout = subparsers.add_parser("logout", help="Delete the local token file.")
    logout.set_defaults(func=cmd_logout)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())

