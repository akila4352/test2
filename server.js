const express = require('express');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
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
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

// Registration endpoint
app.post('/api/auth/register', async (req, res) => {
  const { firstName, lastName, username, email, password, address, address2, city, state, zip } = req.body;

  if (!firstName || !lastName || !username || !email || !password) {
    return res.status(400).json({ message: 'Please fill all required fields.' });
  }

  const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

  try {
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
      .from(userType === 'admin' ? 'admins' : 'users')
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

// Borrow a book
app.post('/api/borrow-book', async (req, res) => {
  const { userId, bookId, borrowDate } = req.body;

  if (!userId || !bookId || !borrowDate) {
    return res.status(400).json({ message: 'Please provide user ID, book ID, and borrow date.' });
  }

  try {
    const { data, error } = await supabase.from('borrowed_books').insert([
      { user_id: userId, book_id: bookId, borrow_date: borrowDate },
    ]);
    if (error) throw error;

    res.status(201).json({ message: 'Book borrowed successfully!', data });
  } catch (error) {
    console.error('Error borrowing book:', error);
    res.status(500).send('Error borrowing book');
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
