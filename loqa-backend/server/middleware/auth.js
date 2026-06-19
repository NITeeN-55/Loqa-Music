import jwt from 'jsonwebtoken';

/**
 * Auth middleware — reads JWT from:
 *  1. HttpOnly cookie `lm_access` (new, secure)
 *  2. Authorization: Bearer <token> header (legacy, backward compat)
 *
 * Both paths are valid during transition. Once all clients are
 * updated to use cookie-based auth, remove the Bearer fallback.
 */
export default function authMiddleware(req, _res, next) {
  // 1. Cookie-based auth (preferred — XSS-safe)
  let token = req.cookies?.lm_access;

  // 2. Legacy Bearer token fallback
  if (!token) {
    const header = req.headers.authorization || '';
    if (header.startsWith('Bearer ')) token = header.slice(7);
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // Reject refresh tokens used as access tokens
      if (decoded.type !== 'refresh') {
        req.userId  = decoded.userId;
        req.userObj = decoded;
      }
    } catch { /* invalid/expired — proceed as guest */ }
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.userId) return res.status(401).json({ error: 'Authentication required' });
  next();
}
