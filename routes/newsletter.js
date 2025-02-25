import express from 'express';
import { getFirestore } from 'firebase-admin/firestore';

const router = express.Router();
const db = getFirestore();

// Public routes - no authentication needed
router.post('/subscribe', async (req, res) => {
  try {
    const { email } = req.body;
    const subscriber = {
      email,
      subscribedAt: new Date().toISOString()
    };

    const docRef = await db.collection('newsletterSubscribers').add(subscriber);
    res.status(201).json({ id: docRef.id, ...subscriber });
  } catch (error) {
    console.error('Error subscribing to newsletter:', error);
    res.status(400).json({ error: error.message });
  }
});

router.get('/subscribers', async (req, res) => {
  try {
    const snapshot = await db.collection('newsletterSubscribers').get();
    const subscribers = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    res.json(subscribers);
  } catch (error) {
    console.error('Error fetching subscribers:', error);
    res.status(400).json({ error: error.message });
  }
});

export default router;