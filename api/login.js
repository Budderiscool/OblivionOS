// api/login.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { serialize } from 'cookie';

const USERS = global.__OBLIVION_USERS ||= {};
const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret';
const TOKEN_EXPIRES = '7d';

function createToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRES });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Only POST' });

  try {
    const body = await readJson(req);
    const { username, password } = body || {};

    if (!username || !password) return res.status(400).json({ error: 'username & password required' });
    const user = USERS[username];
    if (!user) return res.status(401).json({ error: 'invalid credentials' });

    const ok = bcrypt.compareSync(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });

    const token = createToken({ username });
    res.setHeader('Set-Cookie', serialize('oblivion_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7
    }));

    return res.status(200).json({ ok: true, username });
  } catch (err) {
    console.error('login error', err);
    return res.status(500).json({ error: 'server error' });
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch (e) { resolve({}); }
    });
    req.on('error', reject);
  });
}
