"""Serve built dist at / and a Pages project prefix, never the source tree."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
PREFIX = '/brooklyn-plumber-teaches-typing'


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        path = urlsplit(self.path).path
        if path == PREFIX or path.startswith(PREFIX + '/'):
            self.path = self.path[len(PREFIX):] or '/'
        super().do_GET()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=4179)
    args = parser.parse_args()
    if not (ROOT / 'dist/index.html').is_file():
        parser.error('Missing dist. Run npm run build first.')
    server = ThreadingHTTPServer(('127.0.0.1', args.port), partial(Handler, directory=str(ROOT / 'dist')))
    print(f'Serving dist at http://127.0.0.1:{args.port}/', flush=True)
    server.serve_forever()


if __name__ == '__main__':
    main()
