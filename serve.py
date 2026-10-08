#!/usr/bin/env python3
"""Serves this folder and opens the viewer.

A file:// page cannot load ES modules, so the viewer needs a web server even
though it has no backend of its own.

The port is chosen rather than fixed: a second copy of this script, or anything
else already on 8080, used to leave the browser pointing at a port this server
never got, which looks exactly like the viewer being broken.
"""

import http.server
import os
import shutil
import socket
import subprocess
import sys
import threading
import webbrowser

PREFERRED = [8080, 8081, 8082, 8090, 8099, 3100, 4200]

HERE = os.path.dirname(os.path.abspath(__file__))
GENERATED = os.path.join(HERE, "src", "kiosk-tuning.generated.js")
KIOSK_TUNING = os.path.join(
    HERE, "..", "Mari-Interactive-Kiosk-main", "frontend", "components", "avatar", "tuning.ts"
)


def resync_if_stale() -> None:
    """Re-reads the kiosk's tuning if it has moved since the last sync.

    The viewer is only worth anything if its studio is the kiosk's studio, and
    whoever is retuning the kiosk will not think to re-run a script in another
    folder — twice in this viewer's first hour the numbers went stale and it drew
    the presenter at the wrong size. So a reload checks for itself.

    Everything here is best-effort: on the designer's machine there is no kiosk
    checkout and no Node, and the generated file that shipped with the folder is
    exactly right.
    """
    try:
        if not os.path.exists(KIOSK_TUNING):
            return
        if os.path.getmtime(KIOSK_TUNING) <= os.path.getmtime(GENERATED):
            return
        node = shutil.which("node")
        if not node:
            print("  Kiosk tuning changed, but Node is not installed — run sync-tuning.mjs.")
            return
        done = subprocess.run(
            [node, os.path.join(HERE, "sync-tuning.mjs")],
            cwd=HERE,
            capture_output=True,
            text=True,
            timeout=60,
        )
        print((done.stdout or done.stderr).rstrip("\n"))
    except Exception as error:  # never let a sync problem stop the viewer serving
        print(f"  Could not re-read the kiosk's tuning ({error}); serving what is here.")


def free_port() -> int:
    """The first preferred port nothing is listening on, else any free one."""
    wanted = [int(p) for p in sys.argv[1:] if p.isdigit()] or PREFERRED
    for port in wanted:
        with socket.socket() as probe:
            probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                probe.bind(("", port))
            except OSError:
                continue
        return port
    with socket.socket() as probe:
        probe.bind(("", 0))
        return probe.getsockname()[1]


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=HERE, **kwargs)

    def do_GET(self):
        # On the page itself, not on every asset: one check per reload is enough,
        # and the generated file is requested moments later in the same load.
        if self.path in ("/", "/index.html"):
            resync_if_stale()
        super().do_GET()

    def log_message(self, *args):
        pass  # The request log is noise; failures still raise.

    def end_headers(self):
        # Always re-read from disk: an edited viewer file should show up on
        # reload rather than on a cache clear.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main() -> None:
    port = free_port()
    url = f"http://localhost:{port}/"
    server = http.server.ThreadingHTTPServer(("", port), Handler)

    print()
    print("  Mari Avatar Viewer is running.")
    print()
    print(f"      {url}")
    print()
    print("  If no browser window opened, copy that address into one yourself.")
    print("  Press Ctrl+C here to stop.")
    print(flush=True)

    # After the socket is listening, so the first request cannot race it.
    threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Stopped.")


if __name__ == "__main__":
    main()
