import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Debug: Check if environment variables are loaded
console.log('Email User:', process.env.EMAIL_USER);
console.log('Email Password:', process.env.EMAIL_PASSWORD ? 'Password exists' : 'Password missing');

// Create a transporter using Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Function to send welcome email after signup
export const sendWelcomeEmail = async (email, displayName) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Welcome to NoDevBuild!',
      html: `
        <h1>Welcome to NoDevBuild, ${displayName || 'there'}!</h1>
        <p>Thank you for joining NoDevBuild. We're excited to have you on board!</p>
        <p>With NoDevBuild, you can:</p>
        <ul>
          <li>Convert text to different cases</li>
          <li>Analyze text statistics</li>
          <li>And much more!</li>
        </ul>
        <p>If you have any questions, feel free to reach out to our support team.</p>
        <p>Best regards,<br>The NoDevBuild Team</p>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('Welcome email sent successfully');
  } catch (error) {
    console.error('Error sending welcome email:', error);
    throw error;
  }
};

// Function to send login notification email
export const sendLoginNotification = async (email, displayName) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'New Login to Your NoDevBuild Account',
      html: `
        <h1>New Login Detected</h1>
        <p>Hello ${displayName || 'there'},</p>
        <p>We detected a new login to your NoDevBuild account.</p>
        <p>If this was you, you can safely ignore this email.</p>
        <p>If this wasn't you, please contact our support team immediately.</p>
        <p>Best regards,<br>The NoDevBuild Team</p>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('Login notification email sent successfully');
  } catch (error) {
    console.error('Error sending login notification:', error);
    throw error;
  }
};
