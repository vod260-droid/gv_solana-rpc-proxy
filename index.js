const http = require('http');
const https = require('https');
const WebSocket = require('ws');
const url = require('url');

// 目标服务器地址（通过环境变量配置）
const TARGET_URL = process.env.TARGET_URL || 'https://api.mainnet-beta.solana.com';

// 创建 HTTP 服务器
const server = http.createServer((req, res) => {
  // 解析请求 URL
  const parsedUrl = url.parse(req.url);
  const targetUrl = new URL(parsedUrl.path, TARGET_URL);

  // 构造代理请求选项
  const options = {
    method: req.method,
    headers: { ...req.headers, host: targetUrl.host },
    timeout: 5000,
  };

  // 选择 HTTP 或 HTTPS 模块
  const protocol = targetUrl.protocol === 'https:' ? https : http;

  // 发起代理请求
  const proxyReq = protocol.request(targetUrl, options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, {
      ...proxyRes.headers,
      'Access-Control-Allow-Origin': '*', // 可选：支持 CORS
    });
    proxyRes.pipe(res); // 直接流式传输响应
  });

  // 转发请求体（如果有）
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    req.pipe(proxyReq);
  } else {
    proxyReq.end();
  }

  proxyReq.on('error', (err) => {
    console.error('HTTP Proxy Error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Proxy Error' }));
  });
});

// WebSocket 转发
const wss = new WebSocket.Server({ server });
wss.on('connection', (ws, req) => {
  const targetUrl = `wss://api.mainnet-beta.solana.com${req.url}`;
  console.log(`WebSocket connection to ${targetUrl}`);

  const targetWs = new WebSocket(targetUrl);

  targetWs.on('open', () => console.log(`Connected to ${targetUrl}`));
  targetWs.on('message', (data) => ws.readyState === WebSocket.OPEN && ws.send(data.toString()));
  targetWs.on('close', () => ws.close());
  targetWs.on('error', (err) => {
    console.error('Target WebSocket error:', err);
    ws.close();
  });

  ws.on('message', (data) => targetWs.readyState === WebSocket.OPEN && targetWs.send(data));
  ws.on('close', () => targetWs.close());
  ws.on('error', (err) => {
    console.error('Client WebSocket error:', err);
    targetWs.close();
  });
});

// 监听端口（SCF Web 函数默认 9000）
const port = process.env.PORT || 8080;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
