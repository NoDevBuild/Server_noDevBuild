import express from 'express';
import { getFirestore } from 'firebase-admin/firestore';

const router = express.Router();
const db = getFirestore();

// Public routes - no authentication needed
router.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection('courses').get();
    const courses = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    res.json(courses);
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const doc = await db.collection('courses').doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Course not found' });
    }
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error('Error fetching course:', error);
    res.status(400).json({ error: error.message });
  }
});

router.get('/category/:category', async (req, res) => {
  // Get courses by category
});

// Create course (admin only)
router.post('/', async (req, res) => {
  try {
    const course = {
      ...req.body,
      slug: req.body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      createdAt: new Date().toISOString()
    };

    const docRef = await db.collection('courses').add(course);
    res.status(201).json({ id: docRef.id, ...course });
  } catch (error) {
    console.error('Error creating course:', error);
    res.status(400).json({ error: error.message });
  }
});

// Update course (admin only)
router.put('/:id', async (req, res) => {
  try {
    await db.collection('courses').doc(req.params.id).update({
      ...req.body,
      updatedAt: new Date().toISOString()
    });
    res.json({ id: req.params.id, ...req.body });
  } catch (error) {
    console.error('Error updating course:', error);
    res.status(400).json({ error: error.message });
  }
});

// Delete course (admin only)
router.delete('/:id', async (req, res) => {
  try {
    await db.collection('courses').doc(req.params.id).delete();
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting course:', error);
    res.status(400).json({ error: error.message });
  }
});

export default router;