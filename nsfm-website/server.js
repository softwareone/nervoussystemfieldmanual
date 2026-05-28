const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.render('index', {
    title: 'The Nervous System Field Manual | Battlefield Essentials',
    meta_description: "A Corpsman's Guide to the War Within. Six pillars. Seven tools. Thirty days. Built for veterans, operators, and anyone carrying it alone."
  });
});

app.listen(PORT, () => {
  console.log(`NSFM website running on http://localhost:${PORT}`);
});
