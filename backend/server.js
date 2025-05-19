const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());

// Increase the body size limit for larger payloads
app.use(bodyParser.json({ limit: '100mb' }));  // Adjust '10mb' to your needs
app.use(bodyParser.urlencoded({ limit: '100mb', extended: true }));

const DATA_FILE = path.join(__dirname, 'users.json');

// Serve static files from the root folder (adjust if needed)
app.use(express.static(path.join(__dirname, '../')));

// CORS middleware (optional, but useful for dev)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*'); // Allow all origins for dev
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Ensure users.json exists
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, '[]', 'utf8');
}

// Load users from file
app.get('/load-users', (req, res) => {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load users.' });
  }
});

// Save users to file (overwrite)
app.post('/save-users', (req, res) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(req.body, null, 2));
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save users.' });
  }
});

// Save face data to a user
// Save face data to a user
app.post('/save-face', (req, res) => {
  const { username, faceDescriptor } = req.body;
  if (!username || !faceDescriptor) {
    return res.status(400).json({ error: 'Missing username or faceDescriptor' });
  }

  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const userIndex = data.findIndex(u => u.username === username);

    if (userIndex >= 0) {
      data[userIndex].faceDescriptor = faceDescriptor;
    } else {
      data.push({ username, faceDescriptor });
    }

    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    res.json({ status: 'face saved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save face data.' });
  }
});



const PORT = 3000;
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
