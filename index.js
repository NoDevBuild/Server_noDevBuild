import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import './config/firebase.js';

dotenv.config();

// Routes
import authRoutes from './routes/userLogin.js';
import collaborationRoutes from './routes/collaboration.js';
import contactRoutes from './routes/contact.js';
import courseRoutes from './routes/courses.js';
import newsletterRoutes from './routes/newsletter.js';
import paymentRoutes from './routes/payment.js';

const app = express();

// Middleware
app.use(cors({
    origin: ['https://nodevbuild.com', 'http://localhost:3000', 'https://zp1v56uxy8rdx5ypatb0ockcb9tr6a-oci3--3000--59dccbc6.local-credentialless.webcontainer-api.io/'],
    credentials: true
}));
app.use(express.json());

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