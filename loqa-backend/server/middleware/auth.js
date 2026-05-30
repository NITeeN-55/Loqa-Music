import jwt from 'jsonwebtoken';

export default function authMiddleware(req, _res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.userId  = decoded.userId;
      req.userObj = decoded;
    } catch { /* invalid token — proceed as guest */ }
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.userId) return res.status(401).json({ error: 'Authentication required' });
  next();
}
