require('dotenv').config();

const express = require('express');
const path = require('path');
const { supabase, isConfigured } = require('./lib/supabase');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/', (req, res) => {
  res.render('index', {
    title: 'The Nervous System Field Manual | Battlefield Essentials',
    meta_description: "A Corpsman's Guide to the War Within. Six pillars. Seven tools. Thirty days. Built for veterans, operators, and anyone carrying it alone."
  });
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post('/api/newsletter', async (req, res) => {
  if (!isConfigured) {
    return res.status(503).json({ error: 'Newsletter signup is not configured yet.' });
  }

  const email = String(req.body.email || '').trim().toLowerCase();

  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const { error } = await supabase
    .from('newsletter_signups')
    .insert({ email, source: 'nsfm-landing' });

  if (error) {
    if (error.code === '23505') {
      return res.status(200).json({ message: "You're already on the list." });
    }
    console.error('Newsletter insert failed:', error);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }

  return res.status(201).json({ message: "You're on the list." });
});

app.listen(PORT, () => {
  console.log(`NSFM website running on http://localhost:${PORT}`);
});
