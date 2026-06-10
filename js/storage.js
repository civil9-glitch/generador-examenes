const Storage = {
  KEY_API: 'exam_api_key',
  KEY_HISTORY: 'exam_history',

  saveKey(key) {
    try { localStorage.setItem(this.KEY_API, key); } catch(e) {}
  },

  loadKey() {
    try { return localStorage.getItem(this.KEY_API) || ''; } catch(e) { return ''; }
  },

  removeKey() {
    try { localStorage.removeItem(this.KEY_API); } catch(e) {}
  },

  saveHistory(entry) {
    try {
      let hist = this.loadHistory();
      hist.unshift(entry);
      if (hist.length > 100) hist = hist.slice(0, 100);
      localStorage.setItem(this.KEY_HISTORY, JSON.stringify(hist));
    } catch(e) {}
  },

  loadHistory() {
    try {
      const raw = localStorage.getItem(this.KEY_HISTORY);
      return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
  },

  clearHistory() {
    try { localStorage.removeItem(this.KEY_HISTORY); } catch(e) {}
  }
};
