import express from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const db = getFirestore();

// Public routes - no authentication needed
router.post('/enquiries', async (req, res) => {
  try {
    const { email } = req.body;
    const enquiry = {
      email,
      userId: req.user.uid,
      enquiryDate: new Date().toISOString(),
      status: 'pending'
    };

    const docRef = await db.collection('collaborationEnquiries').add(enquiry);
    res.status(201).json({ id: docRef.id, ...enquiry });
  } catch (error) {
    console.error('Error submitting enquiry:', error);
    res.status(400).json({ error: error.message });
  }
});

router.get('/enquiries', async (req, res) => {
  try {
    const snapshot = await db.collection('collaborationEnquiries').get();
    const enquiries = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    res.json(enquiries);
  } catch (error) {
    console.error('Error fetching enquiries:', error);
    res.status(400).json({ error: error.message });
  }
});

export default router;