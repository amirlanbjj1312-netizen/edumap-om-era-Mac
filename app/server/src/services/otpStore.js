const DEFAULT_TTL_MINUTES = 10;

class OtpStore {
  constructor({ ttlMinutes = DEFAULT_TTL_MINUTES, maxAttempts = 5, resendWindowSec = 60 } = {}) {
    this.store = new Map();
    this.ttlMs = ttlMinutes * 60 * 1000;
    this.maxAttempts = maxAttempts;
    this.resendWindowMs = resendWindowSec * 1000;
  }

  generate(email, code) {
    const now = Date.now();
    this.store.set(email, {
      code,
      expiresAt: now + this.ttlMs,
      attempts: 0,
      lastSentAt: now,
    });
    return code;
  }

  canResend(email) {
    const entry = this.store.get(email);
    if (!entry) return true;
    return Date.now() - entry.lastSentAt >= this.resendWindowMs;
  }

  get(email) {
    const entry = this.store.get(email);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(email);
      return null;
    }
    return entry;
  }

  incrementAttempt(email) {
    const entry = this.get(email);
    if (!entry) return null;
    entry.attempts += 1;
    this.store.set(email, entry);
    return entry;
  }

  delete(email) {
    this.store.delete(email);
  }
}

module.exports = { OtpStore };
