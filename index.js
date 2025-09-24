// index.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fetch = require('node-fetch');

const app = express();
const TARGET_URL = process.env.TARGET_URL || 'https://api.mainnet-beta.solana.com';
const PORT = process.env.PORT || 8080;

// 让 express 保留原始 body（Buffer）
app.use(express.raw({ type: '*/*' }));

// 健康检查
app.get('/health', (req, res) => {
  console.log('健康检查请求收到');
  res.status(200).send('OK');
});

// HTTP 代理
app.all('*', async (req, res) => {
  const url = new URL(req.originalUrl, `http://${req.headers.host}`);
  const targetUrl = TARGET_URL + url.pathname + url.search;
  console.log(`HTTP 请求: ${req.method} ${targetUrl}`);

  try {
    const proxyReq = {
      method: req.method,
      headers: { ...req.headers },
    };

    // 删除不必要的头
    delete proxyReq.headers.host;
    delete proxyReq.headers['content-length'];

    // 只有非 GET/HEAD 才带 body
    if (!['GET', 'HEAD'].includes(req.method.toUpperCase())) {
      proxyReq.body = req.body.length ? req.body.toString() : undefined;
      proxyReq.headers['content-type'] = 'application/json';
    }

    const proxyRes = await fetch(targetUrl, proxyReq);

    res.status(proxyRes.status);
    for (const [key, value] of proxyRes.headers) {
      res.set(key, value);
    }
    res.set('Cache-Control', 'no-store');

    // 转发响应内容
    const data = await proxyRes.arrayBuffer();
    res.send(Buffer.from(data));
  } catch (error) {
    console.error('HTTP 代理错误:', error.message);
    res.status(502).json({ error: error.message });
  }
});

// HTTP + WebSocket 共享 server
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const targetWsUrl = TARGET_URL.replace('https://', 'wss://') + url.pathname + url.search;
  console.log(`WebSocket 连接: ${targetWsUrl}`);

  const wsTarget = new WebSocket(targetWsUrl, {
    headers: { 'User-Agent': 'Solana-RPC-Proxy/1.0' },
  });

  wsTarget.on('open', () => {
    ws.on('message', (data) => wsTarget.send(data));
    wsTarget.on('message', (data) => ws.send(data));
  });

  wsTarget.on('error', (err) => console.error('WebSocket 目标错误:', err.message));
  ws.on('error', (err) => console.error('WebSocket 客户端错误:', err.message));

  wsTarget.on('close', () => ws.close());
  ws.on('close', () => wsTarget.close());
});

// Cloud Run 要求监听 0.0.0.0
server.listen(PORT, '0.0.0.0', () => {
  console.log(`服务器启动成功，监听端口 ${PORT}`);
});
