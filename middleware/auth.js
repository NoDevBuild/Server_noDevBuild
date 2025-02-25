import { auth } from '../config/firebase.js';

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Unauthorized - No token provided or invalid format' 
      });
    }

    const token = authHeader.split('Bearer ')[1].trim();
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Unauthorized - Token is empty' 
      });
    }

    try {
      const decodedToken = await auth.verifyIdToken(token);
      req.user = decodedToken;
      next();
    } catch (verifyError) {
      console.error('Token verification error:', verifyError);
      return res.status(401).json({ 
        error: 'Unauthorized - Invalid token',
        details: verifyError.message 
      });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ 
      error: 'Internal server error during authentication' 
    });
  }
};