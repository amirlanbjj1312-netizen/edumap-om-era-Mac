const buildRequestTimeoutMiddleware = (timeoutMs = 15000) => (req, res, next) => {
  req.setTimeout(timeoutMs);
  res.setTimeout(timeoutMs);

  let finished = false;
  const timer = setTimeout(() => {
    if (finished || res.headersSent) return;
    finished = true;
    res.status(504).json({ error: 'Request timeout' });
  }, timeoutMs);

  res.on('finish', () => {
    finished = true;
    clearTimeout(timer);
  });
  res.on('close', () => {
    finished = true;
    clearTimeout(timer);
  });

  next();
};

module.exports = { buildRequestTimeoutMiddleware };
