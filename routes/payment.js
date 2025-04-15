import express from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import fetch from 'node-fetch';
import { jwtVerify } from 'jose';
import crypto from 'crypto';
import { verifyReferralCode } from '../helpers/referralCodes.js';

const router = express.Router();
const db = getFirestore();

// Secret key for verifying the JWT - must match the one used in userLogin.js
const JWT_SECRET = new TextEncoder().encode('no_dev_build');

// Add the JWT authentication middleware
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

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

// Protected routes - authentication required
router.post('/create-order', authenticateJWT, async (req, res) => {
  // Create payment order with user data from req.user
  const userId = req.user.uid;
  // Payment creation logic
});

router.post('/verify', authenticateJWT, async (req, res) => {
  // Verify payment with user data
  const userId = req.user.uid;
  // Payment verification logic
});

router.get('/history', authenticateJWT, async (req, res) => {
  // Get user's payment history
  const userId = req.user.uid;
  // Payment history logic
});

// Create order
router.post('/orders', authenticateJWT, async (req, res) => {
  try {
    const { planType, referralCode } = req.body;
    const userId = req.user.uid;

    if (!planType) {
      return res.status(400).json({ error: 'Plan type is required' });
    }

    // Calculate the amount based on plan type and referral code
    let amount = planType === 'basicPlan' ? 1800 : 5000;
    
    if (referralCode) {
      const verificationResult = verifyReferralCode(referralCode, planType);
      if (verificationResult.isValid) {
        amount = verificationResult.amountToPay;
      }
    }

    // Create internal order
    const orderRef = await db.collection('orders').add({
      userId: req.user.uid,
      planType,
      amount,
      currency: 'INR',
      status: 'pending',
      createdAt: new Date().toISOString(),
      referralCode: referralCode || null
    });

    // Create Razorpay order
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`
      },
      body: JSON.stringify({
        amount: amount * 100, // Convert to paise
        currency: 'INR',
        receipt: orderRef.id,
        notes: {
          planType,
          userId: req.user.uid,
          orderId: orderRef.id,
          referralCode: referralCode || null
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.description || 'Failed to create payment order');
    }

    const razorpayOrder = await response.json();

    // Update order with Razorpay order ID
    await orderRef.update({
      razorpayOrderId: razorpayOrder.id
    });

    res.json({
      orderId: razorpayOrder.id,
      amount,
      key: RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(400).json({ error: error.message });
  }
});

// Update order status
router.put('/orders/:razorpayOrderId', authenticateJWT, async (req, res) => {
  try {
    const { razorpayOrderId } = req.params;
    const { paymentId, status, signature } = req.body;
    const userId = req.user.uid;

    console.log('Received payment update:', {
      razorpayOrderId,
      paymentId,
      status,
      signature,
      userId
    });

    // First, verify that the order belongs to the authenticated user
    const orderQuery = db.collection('orders')
      .where('razorpayOrderId', '==', razorpayOrderId)
      .where('userId', '==', userId);

    const orderSnapshot = await orderQuery.get();

    if (orderSnapshot.empty) {
      console.error('Order not found:', razorpayOrderId);
      return res.status(404).json({ 
        error: 'Order not found or unauthorized access' 
      });
    }

    const orderDoc = orderSnapshot.docs[0];
    const orderData = orderDoc.data();

    // Verify Razorpay payment
    if (status === 'completed' && paymentId && signature) {
      const generatedSignature = crypto
        .createHmac('sha256', RAZORPAY_KEY_SECRET)
        .update(`${orderData.razorpayOrderId}|${paymentId}`)
        .digest('hex');

      if (generatedSignature !== signature) {
        console.error('Invalid signature for order:', razorpayOrderId);
        return res.status(400).json({ error: 'Invalid payment signature' });
      }
    }

    // Create update data
    const updateData = {
      paymentId,
      status,
      updatedAt: new Date().toISOString()
    };

    if (signature) {
      updateData.signature = signature;
    }

    console.log('Updating order with data:', updateData);

    // Update the order
    await orderDoc.ref.update(updateData);

    // Create userOrders entry if payment is completed
    if (status === 'completed') {
      // Create userOrders entry
      const userOrderRef = await db.collection('userOrders').add({
        userId,
        orderId: orderDoc.id,
        razorpayOrderId,
        paymentId,
        planType: orderData.planType,
        amount: orderData.amount,
        currency: orderData.currency,
        status: 'completed',
        paymentDate: new Date().toISOString(),
        createdAt: new Date().toISOString()
      });

      console.log('Created userOrder entry:', userOrderRef.id);

      // Update user membership
      const membershipRef = db.collection('users').doc(userId);
      const membershipData = {
        lastPaymentDate: new Date().toISOString(),
        subscriptionStartDate: new Date().toISOString(),
        planType: orderData.planType,
        amountPaid: orderData.amount,
        currency: orderData.currency,
        razorpayOrderId: orderData.razorpayOrderId,
        signature: signature,
        membershipStatus: 'active',
        userId: userId,
        createdAt: orderData.createdAt,
      };

      console.log('Updating user membership:', membershipData);
      await membershipRef.update(membershipData);
    }

    res.json({ 
      message: 'Order updated successfully',
      status: status
    });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(400).json({ error: error.message });
  }
});

// Add route to get user's order history
router.get('/user-orders', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.uid;

    const userOrdersQuery = await db.collection('userOrders')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    const userOrders = userOrdersQuery.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(userOrders);
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(400).json({ error: error.message });
  }
});

// Verify referral code
router.post('/verify-referral', authenticateJWT, async (req, res) => {
  try {
    const { code, planType } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Referral code is required' });
    }

    if (!planType) {
      return res.status(400).json({ error: 'Plan type is required' });
    }

    const verificationResult = verifyReferralCode(code, planType);
    
    if (!verificationResult.isValid) {
      return res.status(400).json({ error: verificationResult.error });
    }

    // Calculate the amount to be paid
    const originalAmount = planType === 'basicPlan' ? 1800 : 5000;
    const discountAmount = (originalAmount * verificationResult.discountPercent) / 100;
    const amountToPay = originalAmount - discountAmount;

    res.json({
      isValid: verificationResult.isValid,
      discountPercent: verificationResult.discountPercent,
      amountToPay: amountToPay,
      acceptedPlans: verificationResult.acceptedPlans,
      planType: verificationResult.planType,
      expiryDate: verificationResult.expiryDate
    });
  } catch (error) {
    console.error('Error verifying referral code:', error);
    res.status(500).json({ error: 'Failed to verify referral code' });
  }
});

export default router;