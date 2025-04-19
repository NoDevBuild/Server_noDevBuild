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
export const sendWelcomeEmail = async (email, displayName, verificationLink) => {
  const msg = {
    to: email,
    from: 'support@nodevbuild.com',
    subject: 'Welcome to NoDevBuild!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome to NoDevBuild, ${displayName}!</h2>
        <p>Thank you for joining our community. We're excited to have you on board!</p>
        
        <p>To get started, please verify your email address by clicking the button below:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationLink}" 
             style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Verify Email Address
          </a>
        </div>
        
        <p>If the button above doesn't work, you can also copy and paste this link into your browser:</p>
        <p style="word-break: break-all;">${verificationLink}</p>
        
        <p>This link will expire in 24 hours for security reasons.</p>
        
        <p>Best regards,<br>The NoDevBuild Team</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(msg);
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

export const sendResetPasswordLinkEmail = async (email, displayName, resetLink) => {
  const msg = {
    to: email,
    from: 'support@nodevbuild.com',
    subject: 'Reset Your NoDevBuild Password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Hi ${displayName || 'there'},</h2>
        
        <p>We received a request to reset your password for your NoDevBuild account.</p>
        
        <p>To reset your password, click the button below:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" 
             style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Reset Password
          </a>
        </div>
        
        <p>If the button above doesn't work, you can also copy and paste this link into your browser:</p>
        <p style="word-break: break-all;">${resetLink}</p>
        
        <p>This link will expire in 1 hour for security reasons.</p>
        
        <p>If you didn't request this password reset, you can safely ignore this email.</p>
        
        <p>Best regards,<br>The NoDevBuild Team</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(msg);
    console.log('Password reset email sent successfully');
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
};
