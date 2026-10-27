/**
 * Relay Client API Service
 * Handles REST endpoints and SSE streaming from the Express backend
 */

const API_BASE = '/api';

function getAuthHeaders() {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Common fetch wrapper with JSON and error handling
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Include httpOnly cookies
  });

  if (!response.ok) {
    let errorMsg = `Request failed: ${response.statusText}`;
    try {
      const errorData = await response.json();
      errorMsg = errorData.error || errorMsg;
    } catch {
      // Not JSON
    }
    const err = new Error(errorMsg);
    err.status = response.status;
    throw err;
  }

  return response.json();
}

/* ── Auth API ───────────────────────────────────────────────────────────── */

export const authApi = {
  getMe: () => request('/auth/me'),
  demoLogin: () => request('/auth/demo-login', { method: 'POST' }),
  logout: () => request('/auth/logout', { method: 'POST' }),
};

/* ── Sessions API ───────────────────────────────────────────────────────── */

export const sessionsApi = {
  list: () => request('/sessions'),
  get: (id) => request(`/sessions/${id}`),
  create: (data) => request('/sessions', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateProvider: (id, provider) => request(`/sessions/${id}/provider`, {
    method: 'PATCH',
    body: JSON.stringify({ provider, activeProvider: provider }),
  }),
  delete: (id) => request(`/sessions/${id}`, {
    method: 'DELETE',
  }),
};

/* ── Files API ──────────────────────────────────────────────────────────── */

export const filesApi = {
  list: (sessionId) => request(`/sessions/${sessionId}/files`),
  get: (sessionId, path) => request(`/sessions/${sessionId}/files/${encodeURIComponent(path)}`),
  save: (sessionId, path, content) => request(`/sessions/${sessionId}/files/${encodeURIComponent(path)}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  }),
};

/* ── SSE Stream Turn API ────────────────────────────────────────────────── */

/**
 * Stream a conversational turn via POST with SSE response
 * @param {string} sessionId
 * @param {string} content
 * @param {object} callbacks - { onEvent, onError, onDone }
 * @param {string} [simulateHeader] - e.g. 'rate_limit', 'server_error', 'context_overflow'
 * @returns {function} abort - Function to cancel the stream
 */
export function streamTurn(sessionId, content, { onEvent, onError, onDone }, simulateHeader = null) {
  const controller = new AbortController();
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
  };
  if (simulateHeader) {
    headers['x-relay-simulate'] = simulateHeader;
  }

  fetch(`${API_BASE}/sessions/${sessionId}/turn`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({ content }),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        let msg = 'Failed to start turn';
        try {
          const errData = await response.json();
          msg = errData.error || msg;
        } catch {}
        throw new Error(msg);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        // Keep the last potentially incomplete chunk
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.slice(6);
            try {
              const event = JSON.parse(jsonStr);
              if (onEvent) onEvent(event);
              if (event.type === 'done') {
                if (onDone) onDone(event);
              }
              if (event.type === 'error') {
                if (onError) onError(new Error(event.message || 'Stream error'));
              }
            } catch (err) {
              console.error('Failed to parse SSE event:', jsonStr, err);
            }
          }
        }
      }

      if (onDone) onDone({ status: 'completed' });
    })
    .catch((err) => {
      if (err.name === 'AbortError') {
        console.log('Turn stream aborted by user');
      } else {
        console.error('Turn stream failed:', err);
        if (onError) onError(err);
      }
    });

  return () => controller.abort();
}
