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
    const amount = planType === 'annual' ? 180 : 500;

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
router.put('/orders/:razorpayOrderId', authenticateToken, async (req, res) => {
  try {
    const { razorpayOrderId } = req.params; // Change to razorpayOrderId
    console.log('Attempting to update order with Razorpay ID:', razorpayOrderId); // Log the Razorpay order ID
    const { paymentId, status, signature } = req.body;

    // Reference to the order document using razorpayOrderId
    const orderQuery = db.collection('orders').where('razorpayOrderId', '==', razorpayOrderId);
    const orderSnapshot = await orderQuery.get();

    // Log the order document retrieval
    console.log('Order document retrieved:', !orderSnapshot.empty); // Log if the document exists

    // Check if the document exists
    if (orderSnapshot.empty) {
      console.error('Order document not found:', razorpayOrderId); // Log the error
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderDoc = orderSnapshot.docs[0]; // Get the first document
    const orderData = orderDoc.data(); // Get the order data

    // Create an object to hold the fields to update
    const updateData = {
      paymentId,
      status,
      signature,
      updatedAt: new Date().toISOString() // Update the timestamp
    };

    // Only add signature if it is defined
    if (signature) {
      updateData.signature = signature;
    }

    // Update the order in Firestore
    await orderDoc.ref.update(updateData);

    // Get the user ID from the token
    const userId = req.user.uid;

    // Update user membership data based on payment status
    if (status === 'completed') {
      const membershipRef = db.collection('users').doc(userId);
      const membershipData = {
        lastPaymentDate: new Date().toISOString(), // Date of the last payment
        subscriptionStartDate: new Date().toISOString(), // Subscription starts when payment is made
        planType: orderData.planType, // Plan type from the order
        amountPaid: orderData.amount, // Amount paid from the order
        currency: orderData.currency, // Currency from the order
        razorpayOrderId: orderData.razorpayOrderId, // Razorpay order ID
        signature: orderData.signature, // Signature from the order
        membershipStatus: 'active', // Set membership status to active
        userId: userId, // User ID
        createdAt: orderData.createdAt, // Created date from the order
      };

      await membershipRef.update(membershipData);
    }

    res.json({ message: 'Order updated successfully' });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(400).json({ error: error.message });
  }
});

export default router;