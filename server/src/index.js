const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { buildConfig } = require('./utils/config');
const { buildConsultationsRouter } = require('./routes/consultations');
const { buildAuthRouter } = require('./routes/auth');
const { buildAiRouter } = require('./routes/ai');
const { buildSchoolsRouter } = require('./routes/schools');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const config = buildConfig();
const app = express();

const allowAll = !config.allowedOrigins.length || config.allowedOrigins.includes('*');
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowAll || config.allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: require('../package.json').version,
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/consultations', buildConsultationsRouter(config));
app.use('/api/auth', buildAuthRouter(config));
app.use('/api/ai', buildAiRouter(config));
app.use('/api/schools', buildSchoolsRouter());

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

const port = config.port;
app.listen(port, () => {
  console.log(`Edumap API listening on port ${port}`);
});
