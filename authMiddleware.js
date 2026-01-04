import jwt from 'jsonwebtoken';

const authMiddleware = (req, res, next) => {
  const sessionToken = req.cookies.penny_session;

  if (!sessionToken) {
    console.warn('[Auth Middleware] ❌ No penny_session cookie found');
    return res.status(401).json({ error: 'Unauthorized: No session' });
  }

  try {
    const decoded = jwt.verify(sessionToken, process.env.JWT_SECRET || 'penny-secret-key');
    req.user = decoded; // Adiciona os dados do usuário na requisição
    next();
  } catch (error) {
    console.error('[Auth Middleware] ❌ JWT Verification failed:', error.message);
    res.status(401).json({ error: 'Unauthorized: Invalid session' });
  }
};

export default authMiddleware;
