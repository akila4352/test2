const express = require('express');
const path = require('path');
const crypto = require('crypto'); // Import crypto for hashing
const nodemailer = require('nodemailer'); // Import nodemailer
const { createClient } = require('@supabase/supabase-js'); // Import Supabase client
require('dotenv').config();

const app = express();
const cors = require('cors');
app.use(cors());

// Middleware for parsing JSON requests
app.use(express.json());

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Use environment variable
    pass: process.env.EMAIL_APP_PASSWORD, // Use app password from environment variable
  },
});

// Registration endpoint
app.post('/api/auth/register', async (req, res) => {
  const { firstName, lastName, username, email, password, address, address2, city, state, zip } = req.body;

  if (!firstName || !lastName || !username || !email || !password) {
    return res.status(400).json({ message: 'Please fill all required fields.' });
  }

  // Hash password with SHA-256
  const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

  try {
    // Insert user into Supabase table
    const { data, error } = await supabase
      .from('users')
      .insert([
        {
          first_name: firstName,
          last_name: lastName,
          username,
          email,
          password: hashedPassword,
          address,
          address2,
          city,
          state,
          zip,
        },
      ]);

    if (error) {
      console.error('Error inserting user:', error);
      return res.status(500).json({ message: 'Failed to register user' });
    }

    res.status(201).json({ message: 'User registered successfully!' });
  } catch (error) {
    console.error('Unexpected error:', error);
    res.status(500).json({ message: 'An unexpected error occurred' });
  }
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  const { email, password, userType } = req.body;

  if (!email || !password || !userType) {
    return res.status(400).json({ message: 'Please provide email, password, and user type.' });
  }

  try {
    const { data, error } = await supabase
      .from(userType === 'admin' ? 'admins' : 'users') // Select table based on user type
      .select('first_name, password')
      .eq('email', email);

    if (error || !data.length) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const storedPasswordHash = data[0].password;
    const hashedInputPassword = crypto.createHash('sha256').update(password).digest('hex');

    if (hashedInputPassword === storedPasswordHash) {
      return res.status(200).json({
        message: 'Login successful!',
        firstName: data[0].first_name,
        userType,
      });
    } else {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
  } catch (error) {
    console.error('Unexpected error during login:', error);
    res.status(500).json({ message: 'An unexpected error occurred.' });
  }
});

// Send OTP endpoint
app.post('/api/auth/send-otp', async (req, res) => {
  const { email } = req.body;

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Your OTP Code',
    text: `Your OTP code is: ${otp}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'OTP sent successfully', otp });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ message: 'Failed to send OTP' });
  }
});
//Admin panel**************************************************************
// Fetch all books
app.get('/api/books', async (req, res) => {
  try {
    const { data, error } = await supabase.from('books').select('*');
    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching books:', error);
    res.status(500).send('Error fetching books');
  }
});

// Add a new book
app.post('/api/books', async (req, res) => {
  const { title, description, is_available, imgsrc } = req.body;

  try {
    const { data, error } = await supabase.from('books').insert([
      { title, description, is_available, imgsrc },
    ]);
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('Error adding book:', error);
    res.status(500).send('Error adding book');
  }
});

// Delete a book
app.delete('/api/books/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase.from('books').delete().eq('id', id);
    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    console.error('Error deleting book:', error);
    res.status(500).send('Error deleting book');
  }
});

// Update the status of a borrowed book
app.put('/api/borrowedbooks/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const { data, error } = await supabase
      .from('borrowedbooks')
      .update({ status })
      ;

    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    console.error('Error updating borrowed book status:', error);
    res.status(500).send('Error updating borrowed book status');
  }
});

// Fetch borrowed books
app.get('/api/borrowedbooks', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('borrowedbooks')
      .select('*, books (title, imgsrc)');
    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching borrowed books:', error);
    res.status(500).send('Error fetching borrowed books');
  }
});

// Default route
app.get('/', (req, res) => {
  res.send('Hello, Heroku! Your Node.js app is running.');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
