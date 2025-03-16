import { auth } from '../config/firebase.js';
import { jwtVerify } from 'jose';

// Secret key for signing the JWT
const JWT_SECRET = new TextEncoder().encode('no_dev_build'); // Ensure this matches the secret used in userLogin.js

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

    // Try to verify the token as a Firebase ID token first
    try {
      const decodedToken = await auth.verifyIdToken(token);
      req.user = decodedToken;
      return next();
    } catch (verifyError) {
      console.error('Firebase token verification error:', verifyError);
      // If Firebase verification fails, try to verify it as a JWT
      try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        req.user = payload;
        return next();
      } catch (jwtError) {
        console.error('JWT verification error:', jwtError);
        return res.status(401).json({ 
          error: 'Unauthorized - Invalid token',
          details: jwtError.message 
        });
      }
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ 
      error: 'Internal server error during authentication' 
    });
  }
};