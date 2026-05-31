const http = require("http");
const API = process.env.CRM_PREVIEW_API || "http://127.0.0.1:43123";
const WEB = process.env.CRM_PREVIEW_WEB || "http://127.0.0.1:43124";
const PORT = Number(process.env.CRM_PREVIEW_PORT || 43210);
const BIND = process.env.CRM_PREVIEW_BIND || "127.0.0.1";
function proxy(req, res, target) {
  const url = new URL(req.url, target);
  const headers = { ...req.headers, host: url.host };
  const upstream = http.request(url, { method: req.method, headers }, (upstreamRes) => {
    res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
    upstreamRes.pipe(res);
  });
  upstream.on("error", (err) => {
    res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    res.end("CRM preview proxy error: " + err.message + "\n");
  });
  req.pipe(upstream);
}
http.createServer((req, res) => proxy(req, res, (req.url.startsWith("/api/") || req.url === "/health") ? API : WEB))
  .listen(PORT, BIND, () => console.log(`CRM preview proxy listening on ${BIND}:${PORT}`));
