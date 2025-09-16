/*
  Simple dev proxy to avoid CORS on web when using Metro bundler.
  - Listens on http://localhost:3001
  - Proxies /api/... to https://testnet.omni.apex.exchange/api/...
  - Adds permissive CORS headers for local development
*/
const http = require('http');
const https = require('https');

const TARGET_ORIGIN = 'testnet.omni.apex.exchange';
const TARGET_PROTOCOL = 'https:';
const LISTEN_PORT = process.env.DEV_PROXY_PORT ? Number(process.env.DEV_PROXY_PORT) : 3001;

function addCors(res, reqHeaders) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    reqHeaders['access-control-request-headers'] || 'Content-Type,Authorization'
  );
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    addCors(res, req.headers);
    res.statusCode = 204;
    res.end();
    return;
  }

  const upstreamPath = req.url || '/';
  const opts = {
    protocol: TARGET_PROTOCOL,
    hostname: TARGET_ORIGIN,
    method: req.method,
    path: upstreamPath,
    headers: {
      ...req.headers,
      host: TARGET_ORIGIN,
      origin: `${TARGET_PROTOCOL}//${TARGET_ORIGIN}`,
      referer: `${TARGET_PROTOCOL}//${TARGET_ORIGIN}/`,
    },
  };

  const proxyReq = https.request(opts, (proxyRes) => {
    // Copy status and headers
    res.statusCode = proxyRes.statusCode || 500;
    Object.entries(proxyRes.headers || {}).forEach(([k, v]) => {
      if (typeof v !== 'undefined') res.setHeader(k, v);
    });
    // Add CORS headers
    addCors(res, req.headers);

    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('[dev-proxy] upstream error', err.message);
    res.statusCode = 502;
    addCors(res, req.headers);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Bad Gateway', message: err.message }));
  });

  if (req.readable) {
    req.pipe(proxyReq);
  } else {
    proxyReq.end();
  }
});

server.listen(LISTEN_PORT, () => {
  console.log(`[dev-proxy] listening on http://localhost:${LISTEN_PORT}`);
  console.log(`[dev-proxy] proxying to https://${TARGET_ORIGIN}`);
});

