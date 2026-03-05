/**
 * In-memory session manager for demo/starter purposes.
 * For production, use Redis to handle multiple instances and data persistence.
 */
class SessionManager {
  constructor() {
    this.sessions = new Map();
    // Clear sessions every hour to avoid memory leaks
    setInterval(() => this._clearExpiredSessions(), 3600000);
  }

  get(id) {
    return this.sessions.get(id) || { step: 'START', data: {} };
  }

  set(id, session) {
    this.sessions.set(id, {
      ...session,
      updatedAt: Date.now()
    });
  }

  delete(id) {
    this.sessions.delete(id);
  }

  _clearExpiredSessions() {
    const now = Date.now();
    const expiryTime = 2 * 3600000; // 2 hours
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.updatedAt > expiryTime) {
        this.sessions.delete(id);
      }
    }
  }
}

module.exports = new SessionManager();
