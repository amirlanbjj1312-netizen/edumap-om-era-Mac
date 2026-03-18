const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { buildConfig } = require('./utils/config');
const { buildConsultationsRouter } = require('./routes/consultations');
const { buildAuthRouter } = require('./routes/auth');
const { buildAiRouter } = require('./routes/ai');
const { buildSchoolsRouter } = require('./routes/schools');
const { buildNewsRouter } = require('./routes/news');
const { buildCoursesRouter } = require('./routes/courses');
const { buildChatRouter } = require('./routes/chat');
const { buildRatingSurveysRouter } = require('./routes/ratingSurveys');
const { buildRequestTimeoutMiddleware } = require('./middleware/requestTimeout');
const { buildRateLimitMiddleware } = require('./middleware/rateLimit');

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
app.use(buildRequestTimeoutMiddleware(Number(process.env.REQUEST_TIMEOUT_MS) || 15000));
app.use(
  buildRateLimitMiddleware({
    windowMs: Number(process.env.API_RATE_LIMIT_WINDOW_MS) || 60 * 1000,
    max: Number(process.env.API_RATE_LIMIT_MAX) || 300,
    keyPrefix: 'api',
  })
);

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
app.use('/api/news', buildNewsRouter(config));
app.use('/api/courses', buildCoursesRouter(config));
app.use('/api/chat', buildChatRouter(config));
app.use('/api/schools/rating-surveys', buildRatingSurveysRouter());

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

const port = config.port;
app.listen(port, () => {
  console.log(`Edumap API listening on port ${port}`);
});
