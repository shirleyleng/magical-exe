#!/usr/bin/env python3
"""Tiny static file server for local dev that disables caching.

Plain `python -m http.server` sends no Cache-Control header, so browsers
heuristically cache ES modules and won't pick up edits without a hard
reload. This server sends `Cache-Control: no-store` on everything so a
normal reload always fetches fresh source.
"""
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4321
    HTTPServer(("127.0.0.1", port), NoCacheHandler).serve_forever()
