const buildRateLimitMiddleware = ({
  windowMs = 60 * 1000,
  max = 300,
  keyPrefix = 'global',
} = {}) => {
  const buckets = new Map();

  const getClientIp = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
      return forwarded.split(',')[0].trim();
    }
    const candidate = req.ip || req.socket?.remoteAddress || '';
    return String(candidate).replace(/^::ffff:/, '').trim() || 'unknown';
  };

  return (req, res, next) => {
    const now = Date.now();
    const key = `${keyPrefix}:${getClientIp(req)}`;
    const current = buckets.get(key) || [];
    const recent = current.filter((ts) => now - ts < windowMs);

    if (recent.length >= max) {
      const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - recent[0])) / 1000));
      buckets.set(key, recent);
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({ error: 'Too many requests. Try later.' });
    }

    recent.push(now);
    buckets.set(key, recent);
    return next();
  };
};

module.exports = { buildRateLimitMiddleware };
