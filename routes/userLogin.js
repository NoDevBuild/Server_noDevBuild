import express from 'express';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { SignJWT } from 'jose';
import { promisify } from 'util';
import validator from 'email-validator';
import dns from 'dns';

const router = express.Router();
const auth = getAuth();
const db = getFirestore();

const resolveMx = promisify(dns.resolveMx);

// Secret key for signing the JWT
const JWT_SECRET = new TextEncoder().encode('no_dev_build'); // Ensure this matches the secret used in auth.js
const JWT_EXPIRATION = '1d'; // Set the desired expiration time (e.g., '1h', '2d', etc.)

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

// Login route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required' 
      });
    }

    // Get user by email
    try {
      const userRecord = await auth.getUserByEmail(email);
      
      // Create a custom token for the user
      const customToken = await auth.createCustomToken(userRecord.uid);
      
      // Create a JWT with a custom expiration date using jose
      const jwtToken = await new SignJWT({ uid: userRecord.uid })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(JWT_EXPIRATION)
        .sign(JWT_SECRET); // Use the secret from the auth.js

      console.log(jwtToken);
      // Get additional user data from Firestore if needed
      const userDoc = await db.collection('users').doc(userRecord.uid).get();
      const userData = userDoc.data();

      res.status(200).json({
        token: jwtToken,
        user: {
          ...userRecord,
          ...userData
        }
      });
    } catch (error) {
      console.error('Error in login:', error);
      res.status(401).json({ 
        error: 'Invalid email or password',
        details: error.message 
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

    // Create user in Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
      displayName,
      emailVerified: false
    });

    // Send verification email
    const verificationLink = await auth.generateEmailVerificationLink(email);
    
    // Here you should implement your email sending logic
    // For example, using nodemailer or other email service
    // await sendVerificationEmail(email, verificationLink);

    // Create user document in Firestore
    await db.collection('users').doc(userRecord.uid).set({
      email,
      displayName,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      emailVerified: false
    });

    // Create a custom token for the user
    const customToken = await auth.createCustomToken(userRecord.uid);

    res.status(201).json({
      token: customToken,
      user: userRecord,
      message: 'Please check your email to verify your account'
    });

  } catch (error) {
    console.error('Error creating user:', error);
    res.status(400).json({ error: error.message });
  }
});

// Update user profile
router.put('/users/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
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

    // Update user in Firebase Auth
    const userRecord = await auth.updateUser(uid, updateData);

    // Update user document in Firestore
    await db.collection('users').doc(uid).update({
      ...updateData,
      updatedAt: new Date().toISOString() // Update the timestamp
    });

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
    
    // Delete user from Firebase Auth
    await auth.deleteUser(uid);
    
    // Delete user document from Firestore
    await db.collection('users').doc(uid).delete();
    
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
    
    // Get user from Firebase Auth
    const userRecord = await auth.getUser(uid);
    
    // Get user document from Firestore
    const userDoc = await db.collection('users').doc(uid).get();
    
    res.json({
      ...userRecord,
      ...userDoc.data()
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(400).json({ error: error.message });
  }
});

// Reset password
router.post('/reset-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    // Generate password reset link
    const link = await auth.generatePasswordResetLink(email);
    
    // Here you would typically send this link via email
    // For now, we'll just return it
    res.json({ link });
  } catch (error) {
    console.error('Error generating password reset link:', error);
    res.status(400).json({ error: error.message });
  }
});

export default router;