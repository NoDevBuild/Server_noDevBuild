import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { SignJWT } from 'jose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const auth = getAuth();
const db = getFirestore();

// Secret key for signing the JWT
const JWT_SECRET = new TextEncoder().encode('no_dev_build');
const JWT_EXPIRATION = '1d';

// Helper function for creating JWT tokens
async function generateJWTToken(uid) {
  return await new SignJWT({ uid })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRATION)
    .sign(JWT_SECRET);
}

/**
 * Authenticate a user with email and password
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @returns {Promise<Object>} - User data and token
 */
export async function authenticateUser(email, password) {
  try {
    console.log(`Attempting to authenticate user: ${email}`);
    
    // Use Firebase Auth REST API to sign in with email/password
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Authentication failed:', errorData);
      
      if (errorData.error.message === 'EMAIL_NOT_FOUND') {
        const authError = new Error('Email not found');
        authError.code = 'auth/email-not-found';
        throw authError;
      } else if (errorData.error.message === 'INVALID_PASSWORD') {
        const authError = new Error('Invalid password');
        authError.code = 'auth/invalid-password';
        throw authError;
      } else if (errorData.error.message === 'TOO_MANY_ATTEMPTS_TRY_LATER') {
        const authError = new Error('Too many login attempts. Please try again later.');
        authError.code = 'auth/too-many-attempts';
        throw authError;
      }
      
      throw new Error(errorData.error.message || 'Authentication failed');
    }

    const authData = await response.json();
    
    // Get user record from Firebase Admin
    const userRecord = await auth.getUser(authData.localId);
    console.log(`User authenticated with UID: ${userRecord.uid}`);
    
    // Create a JWT with a custom expiration date
    const jwtToken = await generateJWTToken(userRecord.uid);
    console.log('JWT token generated');
    
    // Get additional user data from Firestore
    let userData = {};
    try {
      const userDoc = await db.collection('users').doc(userRecord.uid).get();
      if (userDoc.exists) {
        userData = userDoc.data();
        console.log('User data retrieved from Firestore');
      } else {
        console.log('No Firestore document found for user');
      }
    } catch (firestoreError) {
      console.error(`Error retrieving user data from Firestore: ${firestoreError.message}`);
      // Continue without Firestore data
    }
    
    return {
      token: jwtToken,
      user: {
        ...userRecord,
        ...userData
      }
    };
  } catch (error) {
    console.error(`Authentication error: ${error.message}`, error);
    throw error;
  }
}

/**
 * Create a new user
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @param {string} displayName - User's display name
 * @returns {Promise<Object>} - User data and token
 */
export async function createUser(email, password, displayName) {
  try {
    // Create user in Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
      displayName,
      emailVerified: false
    });
    
    // Create user document in Firestore
    await db.collection('users').doc(userRecord.uid).set({
      email,
      displayName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      emailVerified: false
    });
    
    // Create a JWT token
    const jwtToken = await generateJWTToken(userRecord.uid);
    
    return {
      token: jwtToken,
      user: userRecord
    };
  } catch (error) {
    console.error('User creation error:', error);
    throw error;
  }
}

/**
 * Update a user's profile
 * @param {string} uid - User's UID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} - Updated user data
 */
export async function updateUser(uid, updateData) {
  try {
    // Update user in Firebase Auth
    const userRecord = await auth.updateUser(uid, updateData);
    
    // Update user document in Firestore
    await db.collection('users').doc(uid).update({
      ...updateData,
      updatedAt: new Date().toISOString()
    });
    
    return userRecord;
  } catch (error) {
    console.error('User update error:', error);
    throw error;
  }
}

/**
 * Delete a user
 * @param {string} uid - User's UID
 * @returns {Promise<void>}
 */
export async function deleteUser(uid) {
  try {
    // Delete user from Firebase Auth
    await auth.deleteUser(uid);
    
    // Delete user document from Firestore
    await db.collection('users').doc(uid).delete();
  } catch (error) {
    console.error('User deletion error:', error);
    throw error;
  }
}

/**
 * Get a user's profile
 * @param {string} uid - User's UID
 * @returns {Promise<Object>} - User data
 */
export async function getUserProfile(uid) {
  try {
    // Get user from Firebase Auth
    const userRecord = await auth.getUser(uid);
    
    // Get user document from Firestore
    const userDoc = await db.collection('users').doc(uid).get();
    
    return {
      ...userRecord,
      ...userDoc.data()
    };
  } catch (error) {
    console.error('User profile fetch error:', error);
    throw error;
  }
} 