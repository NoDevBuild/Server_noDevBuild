import express from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import { authenticateToken } from '../middleware/auth.js';
import fetch from 'node-fetch';

const router = express.Router();
const db = getFirestore();

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

// Protected routes - authentication required
router.post('/create-order', authenticateToken, async (req, res) => {
  // Create payment order with user data from req.user
  const userId = req.user.uid;
  // Payment creation logic
});

router.post('/verify', authenticateToken, async (req, res) => {
  // Verify payment with user data
  const userId = req.user.uid;
  // Payment verification logic
});

router.get('/history', authenticateToken, async (req, res) => {
  // Get user's payment history
  const userId = req.user.uid;
  // Payment history logic
});

// Create order
router.post('/orders', authenticateToken, async (req, res) => {
  try {
    const { planType } = req.body;
    const amount = planType === 'annual' ? 180000 : 500000;

    // Create internal order
    const orderRef = await db.collection('orders').add({
      userId: req.user.uid,
      planType,
      amount,
      currency: 'INR',
      status: 'pending',
      createdAt: new Date().toISOString()
    });

    // Create Razorpay order
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`
      },
      body: JSON.stringify({
        amount,
        currency: 'INR',
        receipt: orderRef.id,
        notes: {
          planType,
          userId: req.user.uid,
          orderId: orderRef.id
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
router.put('/orders/:orderId', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { paymentId, status, signature } = req.body;

    await db.collection('orders').doc(orderId).update({
      paymentId,
      status,
      signature,
      updatedAt: new Date().toISOString()
    });

    res.json({ message: 'Order updated successfully' });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(400).json({ error: error.message });
  }
});

export default router;