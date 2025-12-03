// api/logout.js
import { serialize } from 'cookie';
export default function handler(req, res) {
  // Clear cookie
  res.setHeader('Set-Cookie', serialize('oblivion_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0
  }));
  res.status(200).json({ ok: true });
}
