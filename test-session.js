require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration (same as server.js)
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
  }
}));

// Test routes
app.get('/', (req, res) => {
  res.send(`
    <h1>Session Test</h1>
    <p>Session User: ${JSON.stringify(req.session.user || 'Not logged in')}</p>
    <form action="/login" method="POST">
      <button type="submit">Test Login</button>
    </form>
    <br>
    <a href="/protected">Go to Protected Page</a>
  `);
});

app.post('/login', (req, res) => {
  req.session.user = {
    id: '123',
    email: 'test@example.com',
    role: 'admin'
  };
  
  console.log('Before save - Session:', req.session.user);
  
  req.session.save((err) => {
    if (err) {
      console.error('Session save error:', err);
      return res.send('Error saving session');
    }
    
    console.log('After save - Session:', req.session.user);
    res.redirect('/protected');
  });
});

app.get('/protected', (req, res) => {
  console.log('Protected route - Session:', req.session.user);
  
  if (!req.session.user) {
    return res.send('<h1>❌ Not logged in - Please login to continue</h1><a href="/">Back</a>');
  }
  
  res.send(`
    <h1>✅ Protected Page</h1>
    <p>User: ${JSON.stringify(req.session.user)}</p>
    <a href="/">Back</a>
  `);
});

app.listen(3001, () => {
  console.log('Session test server running on http://localhost:3001');
});
