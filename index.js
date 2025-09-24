const functions = require('@google-cloud/functions-framework');
const fetch = require('node-fetch');
const { WebSocket } = require('ws');

const TARGET_URL = process.env.TARGET_URL || 'https://api.mainnet-beta.solana.com';

functions.http('solanaProxy', async (req, res) => {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const targetUrl = TARGET_URL + url.pathname + url.search;

  // WebSocket 处理（通过 HTTP/2 长连接）
  if (req.get('upgrade') === 'websocket') {
    res.status(101).set({
      'Upgrade': 'websocket',
      'Connection': 'Upgrade',
    });

    const wsTarget = new WebSocket(targetUrl.replace('https://', 'wss://'), {
      headers: { 'User-Agent': 'Solana-RPC-Proxy/1.0' },
    });

    wsTarget.on('open', () => {
      console.log('WebSocket 目标连接成功');
      req.on('data', (data) => wsTarget.send(data.toString()));
      wsTarget.on('message', (data) => res.write(data));
    });

    wsTarget.on('error', (err) => {
      console.error('WebSocket 目标错误:', err.message);
      res.status(502).json({ error: 'WebSocket target error' });
    });

    wsTarget.on('close', () => res.end());
    return;
  }

  // HTTP 处理
  try {
    const proxyReq = {
      method: req.method,
      headers: { ...req.headers },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? req.rawBody : undefined,
    };
    delete proxyReq.headers.host;

    const proxyRes = await fetch(targetUrl, proxyReq);
    console.log('HTTP 响应:', proxyRes.status);

    res.status(proxyRes.status);
    for (const [key, value] of proxyRes.headers.entries()) {
      res.set(key, value);
    }
    res.set('Cache-Control', 'no-store');
    res.set('Content-Type', proxyRes.headers.get('content-type') || 'application/json');

    proxyRes.body.pipe(res);
  } catch (error) {
    console.error('HTTP 代理错误:', error.message);
    res.status(502).json({ error: error.message });
  }
});
