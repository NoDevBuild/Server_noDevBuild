import express from 'express';
import { getFirestore } from 'firebase-admin/firestore';

const router = express.Router();
const db = getFirestore();

// Public routes - no authentication needed
router.post('/submit', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    const query = {
      name,
      email,
      subject,
      message,
      createdAt: new Date().toISOString(),
      status: 'new'
    };

    const docRef = await db.collection('contactQueries').add(query);
    res.status(201).json({ id: docRef.id, ...query });
  } catch (error) {
    console.error('Error submitting query:', error);
    res.status(400).json({ error: error.message });
  }
});

router.get('/queries', async (req, res) => {
  try {
    const snapshot = await db.collection('contactQueries').get();
    const queries = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    res.json(queries);
  } catch (error) {
    console.error('Error fetching queries:', error);
    res.status(400).json({ error: error.message });
  }
});

export default router;