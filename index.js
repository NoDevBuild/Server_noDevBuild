import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import './config/firebase.js';
import bodyParser from 'body-parser';

dotenv.config();

// Routes
import authRoutes from './routes/userLogin.js';
import collaborationRoutes from './routes/collaboration.js';
import contactRoutes from './routes/contact.js';
import courseRoutes from './routes/courses.js';
import newsletterRoutes from './routes/newsletter.js';
import paymentRoutes from './routes/payment.js';

const app = express();

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Middleware
app.use(cors({
    origin: '*',
    credentials: true
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/collaboration', collaborationRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/payment', paymentRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});