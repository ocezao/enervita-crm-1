const http = require("http");
const API = process.env.CRM_PREVIEW_API || "http://127.0.0.1:43123";
const WEB = process.env.CRM_PREVIEW_WEB || "http://127.0.0.1:43124";
const PORT = Number(process.env.CRM_PREVIEW_PORT || 43210);
const BIND = process.env.CRM_PREVIEW_BIND || "127.0.0.1";
function cacheControlFor(reqUrl, contentType) {
  const path = (reqUrl || "/").split("?")[0];
  if (path.startsWith("/api/") || path === "/health" || path.startsWith("/uploads/")) {
    return "no-store";
  }
  if (path.startsWith("/assets/")) {
    return "public, max-age=31536000, immutable";
  }
  if ((contentType || "").includes("text/html")) {
    return "no-store";
  }
  return "public, max-age=3600";
}

function proxy(req, res, target) {
  const url = new URL(req.url, target);
  const headers = { ...req.headers, host: url.host };
  const upstream = http.request(url, { method: req.method, headers }, (upstreamRes) => {
    const responseHeaders = { ...upstreamRes.headers };
    responseHeaders["cache-control"] = cacheControlFor(req.url, responseHeaders["content-type"]);
    responseHeaders["pragma"] = responseHeaders["cache-control"] === "no-store" ? "no-cache" : undefined;
    for (const [key, value] of Object.entries(responseHeaders)) {
      if (value === undefined) delete responseHeaders[key];
    }
    res.writeHead(upstreamRes.statusCode || 502, responseHeaders);
    upstreamRes.pipe(res);
  });
  upstream.on("error", (err) => {
    res.writeHead(502, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
    res.end("CRM preview proxy error: " + err.message + "\n");
  });
  req.pipe(upstream);
}
http.createServer((req, res) => {
  const pathname = (req.url || "/").split("?")[0];
  const target = pathname.startsWith("/api/") || pathname === "/health" || pathname.startsWith("/uploads/") ? API : WEB;
  proxy(req, res, target);
}).listen(PORT, BIND, () => console.log(`CRM preview proxy listening on ${BIND}:${PORT}`));
