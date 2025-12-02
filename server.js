// server.js
import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
app.use(cors());

// Proxy endpoint
app.get('/proxy', async (req, res) => {
  const target = req.query.url;
  if (!target) return res.status(400).send('Missing URL');

  try {
    const response = await fetch(target);
    const data = await response.text();
    res.send(data);
  } catch (err) {
    res.status(500).send('Proxy error');
  }
});

// Listen on Render's port
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Proxy running on port ${port}`));
