const express = require('express');
const app = express();
const port = process.env.PORT || 8080;

app.get('/', async (req, res) => {
  try {
    const response = await fetch('https://httpbin.org/ip');
    const data = await response.json();
    const ip = data.origin; // 获取出站 IP
    res.json({ ip, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error(`Error fetching IP: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch IP' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
