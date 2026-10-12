"""Shared playtest helpers: local server, headless Chrome, console error capture, key helpers."""
import functools
import http.server
import json
import threading
import time
from contextlib import contextmanager
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent / "out"
CHROME_ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]


class _QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def start_server():
    """Serve the repo root on a free port in a daemon thread. Returns (server, base_url)."""
    handler = functools.partial(_QuietHandler, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, f"http://127.0.0.1:{server.server_address[1]}"


class Session:
    def __init__(self, page, url):
        self.page = page
        self.url = url
        self.errors = []  # console errors and page errors only (warnings are ignored)


@contextmanager
def session(wait_hook=True, timeout=10, start_level="test", debug=True):
    """Yields a Session with the game loaded. Check session.errors at the end.

    debug=True (the default) loads index.html?debug, the LittleJS debug build, as development does.
    debug=False loads the release build that players get (see release_smoke.py).

    The game boots to the title screen. start_level (default "test") skips straight into that level
    via __sammy.commands.loadLevel, so gameplay scenarios don't have to click through the menu.
    Pass start_level=None to stay on the title screen."""
    OUT.mkdir(parents=True, exist_ok=True)
    server, url = start_server()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(channel="chrome", headless=True, args=CHROME_ARGS)
            page = browser.new_page(viewport={"width": 1280, "height": 720})
            s = Session(page, url)
            page.on("console", lambda m: s.errors.append(f"console: {m.text}") if m.type == "error" else None)
            page.on("pageerror", lambda e: s.errors.append(f"pageerror: {e}"))
            page.goto(url + "/index.html" + ("?debug" if debug else ""))
            if wait_hook:
                try:
                    page.wait_for_function("window.__sammy !== undefined", timeout=timeout * 1000)
                except Exception:
                    s.errors.append("window.__sammy missing")
                if start_level and not s.errors:
                    page.wait_for_function("window.__sammy.scene === 'title'", timeout=timeout * 1000)
                    page.evaluate("id => window.__sammy.commands.loadLevel(id)", start_level)
                    wait_scene(page, "playing", timeout)
            try:
                yield s
            finally:
                browser.close()
    finally:
        server.shutdown()


def hold(page, key, seconds):
    page.keyboard.down(key)
    time.sleep(seconds)
    page.keyboard.up(key)


def tap(page, key):
    page.keyboard.down(key)
    time.sleep(0.08)  # long enough to span at least one engine frame
    page.keyboard.up(key)


def state(page):
    """window.__sammy serialized to a dict (getters included, functions dropped)."""
    return json.loads(page.evaluate("JSON.stringify(window.__sammy)"))


def shot(page, name):
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{name}.png"
    page.screenshot(path=str(path))
    return path


def wait_scene(page, name, timeout=5):
    page.wait_for_function("n => window.__sammy && window.__sammy.scene === n", arg=name, timeout=timeout * 1000)
