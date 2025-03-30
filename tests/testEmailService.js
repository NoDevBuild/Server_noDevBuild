import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { sendWelcomeEmail, sendLoginNotification } from '../services/emailAutomation.js';

// Get the directory path of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from the correct path
dotenv.config({ path: join(__dirname, '../.env') });

// Debug: Check if environment variables are loaded
console.log('Environment loaded from:', join(__dirname, '../.env'));
console.log('Email User:', process.env.EMAIL_USER);
console.log('Email Password:', process.env.EMAIL_PASSWORD ? 'Password exists' : 'Password missing');

// Test email address - replace with your email
const TEST_EMAIL = 'lifeofshahrukh@gmail.com';
const TEST_NAME = 'Test User';

async function testEmailService() {
  try {
    console.log('Starting email service tests...\n');

    // Test welcome email
    console.log('Testing welcome email...');
    await sendWelcomeEmail(TEST_EMAIL, TEST_NAME);
    console.log('✓ Welcome email test completed\n');

    // Test login notification
    console.log('Testing login notification...');
    await sendLoginNotification(TEST_EMAIL, TEST_NAME);
    console.log('✓ Login notification test completed\n');

    console.log('All tests completed successfully! 🎉');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Error details:', error.response.body);
    }
  }
}

// Run the tests
testEmailService(); 