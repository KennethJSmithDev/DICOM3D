import base64, datetime, json, os, pathlib, subprocess, threading, urllib.error, urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer
from response_format import apply_verified_selection_format

import argparse
parser=argparse.ArgumentParser()
parser.add_argument("--config",required=True)
config=json.loads(pathlib.Path(parser.parse_args().config).read_text(encoding="utf-8"))
CONTAINER = config["container"]
OLLAMA = config["ollamaBase"]
LIMIT = 12
COUNT = 0
LOCK = threading.Lock()
LOG = pathlib.Path(config["evidenceRoot"]) / "inference-transport.jsonl"

proc = subprocess.Popen(
    ["docker", "exec", "--user", "51773", "-i", CONTAINER, "python3", "-u", "/run/contest/Native005Relay.py"],
    stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    text=True, encoding="utf-8", errors="replace", bufsize=1,
    creationflags=getattr(subprocess,"CREATE_NO_WINDOW",0),
)

def summarize(raw):
    try:
        data = json.loads(raw)
        if "choices" not in data:
            return data
        choices = []
        for choice in data.get("choices", []):
            message = choice.get("message") or {}
            choices.append({"finish_reason": choice.get("finish_reason"), "message": {k: message[k] for k in ("role", "content", "tool_calls") if k in message}})
        return {"model": data.get("model"), "choices": choices, "usage": data.get("usage")}
    except Exception:
        return {"invalidJson": True, "bytes": len(raw)}

class Bridge(BaseHTTPRequestHandler):
    def log_message(self, *args):
        return
    def do_GET(self):
        self.forward()
    def do_POST(self):
        self.forward()
    def forward(self):
        global COUNT
        path = self.path
        if path not in ("/v1/chat/completions", "/v1/models", "/v1/models/gpt-oss:20b"):
            self.send_error(403)
            return
        size = int(self.headers.get("Content-Length", "0"))
        if size > 1048576:
            self.send_error(413)
            return
        raw = self.rfile.read(size)
        request = json.loads(raw) if raw else None
        if path == "/v1/chat/completions":
            with LOCK:
                COUNT += 1
                number = COUNT
            if number > LIMIT:
                status, data = 429, b'{"error":"C049-NATIVE-AGENT-005 inference allowance exhausted"}'
            else:
                if not request or request.get("model") != "gpt-oss:20b" or request.get("stream"):
                    self.send_error(403)
                    return
                request["max_tokens"] = min(1024, max(1, int(request.get("max_tokens", 1024))))
                for message in request.get("messages", []):
                    if not isinstance(message.get("content", ""), str):
                        self.send_error(403)
                        return
                format_applied=apply_verified_selection_format(request)
                status, data = self.call(path, request)
            event = {"utc": datetime.datetime.now(datetime.timezone.utc).isoformat(), "path": path, "inferenceNumber": number, "request": request, "response": summarize(data), "status": status}
            event['formatProjectionApplied']=locals().get('format_applied',False)
        else:
            status, data = self.call(path, None)
            event = {"utc": datetime.datetime.now(datetime.timezone.utc).isoformat(), "path": path, "request": None, "response": summarize(data), "status": status}
        with LOG.open("a", encoding="utf-8") as stream:
            stream.write(json.dumps(event, ensure_ascii=False) + "\n")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)
    def call(self, path, payload):
        body = json.dumps(payload).encode() if payload is not None else None
        outgoing = urllib.request.Request(OLLAMA + path, data=body, method="POST" if body is not None else "GET", headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(outgoing, timeout=180) as response:
                return response.status, response.read(1048577)
        except urllib.error.HTTPError as error:
            return error.code, error.read(1048577)
        except Exception as error:
            return 502, json.dumps({"error": type(error).__name__}).encode()

def pump():
    for line in proc.stdout:
        try:
            message = json.loads(line)
            path, method = message["path"], message["method"]
            body = base64.b64decode(message["body"])
            if path not in ("/v1/chat/completions", "/v1/models", "/v1/models/gpt-oss:20b"):
                raise RuntimeError("unapproved path")
            request = json.loads(body) if body else None
            if request and request.get("model") != "gpt-oss:20b":
                raise RuntimeError("model substitution blocked")
            outgoing = urllib.request.Request("http://127.0.0.1:"+str(config["relayPort"]) + path, data=body if method == "POST" else None, method=method, headers={"Content-Type": "application/json"})
            try:
                with urllib.request.urlopen(outgoing, timeout=190) as response:
                    status, data = response.status, response.read(1048577)
            except urllib.error.HTTPError as error:
                status, data = error.code, error.read(1048577)
            proc.stdin.write(json.dumps({"status": status, "body": base64.b64encode(data).decode()}) + "\n")
            proc.stdin.flush()
        except Exception as error:
            try:
                data = json.dumps({"error": type(error).__name__}).encode()
                proc.stdin.write(json.dumps({"status": 502, "body": base64.b64encode(data).decode()}) + "\n")
                proc.stdin.flush()
            except Exception:
                break

threading.Thread(target=pump, daemon=True).start()
print("C049-NATIVE-AGENT-005 loopback relay ready", flush=True)
HTTPServer(("127.0.0.1", config["relayPort"]), Bridge).serve_forever()

