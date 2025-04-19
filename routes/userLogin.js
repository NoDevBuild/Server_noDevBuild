import express from 'express';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { SignJWT } from 'jose';
import { promisify } from 'util';
import validator from 'email-validator';
import dns from 'dns';
import { jwtVerify } from 'jose';
import { sendWelcomeEmail, sendLoginNotification, sendResetPasswordLinkEmail } from '../services/emailAutomation.js';
import { authenticateUser, createUser, updateUser, deleteUser, getUserProfile } from '../services/authService.js';
import dotenv from 'dotenv';

const router = express.Router();
const auth = getAuth();
const db = getFirestore();

// Load environment variables
dotenv.config();

const resolveMx = promisify(dns.resolveMx);

// Secret key for signing the JWT
const JWT_SECRET = new TextEncoder().encode('no_dev_build'); // Ensure this matches the secret used in auth.js
const JWT_EXPIRATION = '1d'; // Set the desired expiration time (e.g., '1h', '2d', etc.)

// Add this middleware function at the top of the file after the constants
const authenticateJWT = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1]; // Bearer <token>
    if (!token) {
      return res.status(401).json({ error: 'Invalid token format' });
    }

    // Verify the token using the same JWT_SECRET we use for creation
    const { payload } = await jwtVerify(token, JWT_SECRET);
    
    // Add the user info to the request object
    req.user = { uid: payload.uid };
    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Helper function to validate email domain
async function isEmailDomainValid(email) {
  const domain = email.split('@')[1];
  try {
    const mxRecords = await resolveMx(domain);
    return mxRecords && mxRecords.length > 0;
  } catch (error) {
    return false;
  }
}

// Helper function for creating JWT tokens
async function generateJWTToken(uid) {
  return await new SignJWT({ uid })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRATION)
    .sign(JWT_SECRET);
}

// Login route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required' 
      });
    }

    try {
      console.log(`Login attempt for email: ${email}`);
      
      // Use our auth service to authenticate the user
      const result = await authenticateUser(email, password);
      
      console.log(`Login successful for user: ${email}`);
      
      // Send login notification email
      // await sendLoginNotification(email, result.user.displayName);

      res.status(200).json(result);
    } catch (error) {
      console.error('Error in login:', error);
      
      // Handle specific Firebase Admin errors
      if (error.code === 'auth/user-not-found' || error.code === 'auth/email-not-found') {
        return res.status(401).json({ 
          error: 'Email not found',
          code: 'auth/email-not-found'
        });
      } else if (error.code === 'auth/invalid-password') {
        return res.status(401).json({ 
          error: 'Invalid password',
          code: 'auth/invalid-password'
        });
      } else if (error.code === 'auth/too-many-attempts') {
        return res.status(429).json({ 
          error: 'Too many login attempts. Please try again later.',
          code: 'auth/too-many-attempts'
        });
      } else if (error.code === 'auth/unknown-error') {
        return res.status(401).json({ 
          error: 'Authentication failed',
          details: error.message
        });
      }
      
      // For any other errors, return a generic error message
      res.status(401).json({ 
        error: 'Authentication failed',
        details: error.message || 'Unknown error occurred'
      });
    }
  } catch (error) {
    console.error('Server error during login:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Create user (Sign up)
router.post('/signup', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;

    // Step 1: Basic email format validation
    if (!validator.validate(email)) {
      return res.status(400).json({
        error: 'Invalid email format',
        code: 'auth/invalid-email-format'
      });
    }

    // Step 2: Check if email domain is valid and has MX records
    const isValidDomain = await isEmailDomainValid(email);
    if (!isValidDomain) {
      return res.status(400).json({
        error: 'Invalid email domain or domain does not accept emails',
        code: 'auth/invalid-email-domain'
      });
    }

    // Step 3: Check if email already exists in Firebase
    try {
      const existingUser = await auth.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          error: 'Email already exists',
          code: 'auth/email-already-exists'
        });
      }
    } catch (error) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    // Create user using our auth service
    try {
      const result = await createUser(email, password, displayName);
      
      const verificationLink = await auth.generateEmailVerificationLink(email, {
        url: 'https://nodevbuild.com/verify-email'
      });
      // Send welcome email
      await sendWelcomeEmail(email, displayName, verificationLink);

      // Generate email verification link

      res.status(201).json({
        ...result,
        message: 'Please check your email to verify your account'
      });
    } catch (firebaseError) {
      console.error('Firebase Auth Error:', firebaseError);
      
      // Check for specific Firebase Admin authentication errors
      if (firebaseError.code === 'auth/invalid-credential' || 
          firebaseError.message.includes('Missing credentials')) {
        return res.status(500).json({ 
          error: 'Server authentication error. Please contact support.',
          details: 'Firebase Admin authentication failed. Check server logs.'
        });
      }
      
      throw firebaseError;
    }

  } catch (error) {
    console.error('Error creating user:', error);
    res.status(400).json({ error: error.message });
  }
});

// Update user profile
router.put('/users/:uid', authenticateJWT, async (req, res) => {
  try {
    const { uid } = req.params;
    const authenticatedUserId = req.user.uid;

    // Check if the authenticated user is trying to update their own profile
    if (uid !== authenticatedUserId) {
      return res.status(403).json({ 
        error: 'Unauthorized: You can only update your own profile' 
      });
    }

    const { displayName, photoURL } = req.body;

    // Create an object to hold the fields to update
    const updateData = {};

    // Only add fields that are defined
    if (displayName !== undefined) {
      updateData.displayName = displayName;
    }
    if (photoURL !== undefined) {
      updateData.photoURL = photoURL;
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Update user using our auth service
    const userRecord = await updateUser(uid, updateData);

    res.json(userRecord);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(400).json({ error: error.message });
  }
});

// Delete user
router.delete('/users/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    
    // Delete user using our auth service
    await deleteUser(uid);
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get user profile
router.get('/users/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    
    // Get user profile using our auth service
    const userProfile = await getUserProfile(uid);
    
    res.json(userProfile);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get dashboard data
router.get('/dashboard/:userId', authenticateJWT, async (req, res) => {
  try {
    const { userId } = req.params;
    const authenticatedUserId = req.user.uid;

    // Check if the authenticated user is requesting their own dashboard
    if (userId !== authenticatedUserId) {
      return res.status(403).json({ 
        error: 'Unauthorized: You can only access your own dashboard' 
      });
    }
    
    // Get user from Firebase Auth
    const userRecord = await auth.getUser(userId);
    
    // Get user document from Firestore
    const userDoc = await db.collection('users').doc(userId).get();
    
    res.json({
      ...userRecord,
      ...userDoc.data()
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(400).json({ error: error.message });
  }
});

// Reset password route
router.post('/reset-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Get user record to get display name
    const userRecord = await auth.getUserByEmail(email);
    
    // Generate password reset link
    const resetLink = await auth.generatePasswordResetLink(email, {
      url: 'https://nodevbuild.com/login'
    });

    // Send reset password email
    await sendResetPasswordLinkEmail(email, userRecord.displayName, resetLink);
        
    res.json({ 
      message: 'Password reset link has been sent to your email',
      success: true
    });
  } catch (error) {
    console.error('Error generating password reset link:', error);
    
    // Handle specific Firebase errors
    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({ 
        error: 'No account found with this email address',
        code: 'auth/user-not-found'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to send reset link',
      details: error.message 
    });
  }
});

// Add verify token endpoint
router.get('/verify-token', authenticateJWT, async (req, res) => {
  try {
    const { uid } = req.user;
    
    // Verify the user exists in Firebase Auth
    const userRecord = await auth.getUser(uid);
    
    // Get user document from Firestore for additional data
    const userDoc = await db.collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    // Combine Firebase Auth and Firestore data
    const userData = {
      ...userRecord,
      ...userDoc.data()
    };

    res.json({
      uid: userData.uid,
      email: userData.email,
      displayName: userData.displayName,
      emailVerified: userData.emailVerified,
      membershipStatus: userData.membershipStatus,
      lastLoginAt: userData.lastLoginAt,
      createdAt: userData.createdAt
    });
  } catch (error) {
    console.error('Token verification failed:', error);
    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;