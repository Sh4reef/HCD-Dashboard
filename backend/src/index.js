const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./routes/apiRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// Serve Frontend Static Visual Dashboard
app.use(express.static(path.join(__dirname, '../../frontend/public')));

// Mount API Endpoints
app.use('/api/v1', apiRoutes);

// Fallback route to frontend dashboard
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/public/index.html'));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  HCD Management & Analytics Platform Backend Running  `);
  console.log(`  URL: http://localhost:${PORT}                        `);
  console.log(`=======================================================`);
});
