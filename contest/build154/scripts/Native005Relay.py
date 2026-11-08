from http.server import BaseHTTPRequestHandler, HTTPServer
import base64, json, sys

class Relay(BaseHTTPRequestHandler):
    def log_message(self, *args):
        return
    def do_GET(self):
        self.handle_request()
    def do_POST(self):
        self.handle_request()
    def handle_request(self):
        if self.path not in ("/v1/chat/completions", "/v1/models", "/v1/models/gpt-oss:20b"):
            self.send_error(403)
            return
        body = self.rfile.read(int(self.headers.get("Content-Length", "0")))
        print(json.dumps({"path": self.path, "method": self.command, "body": base64.b64encode(body).decode()}), flush=True)
        response = json.loads(sys.stdin.readline())
        data = base64.b64decode(response["body"])
        self.send_response(response["status"])
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

HTTPServer(("127.0.0.1", 53571), Relay).serve_forever()

