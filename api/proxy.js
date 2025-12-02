import fetch from 'node-fetch';

export default async function handler(req, res) {
  const target = req.query.url;
  if (!target) return res.status(400).send('Missing URL');

  try {
    const response = await fetch(target);
    const data = await response.text();
    res.status(200).send(data);
  } catch (err) {
    res.status(500).send('Proxy error');
  }
}
