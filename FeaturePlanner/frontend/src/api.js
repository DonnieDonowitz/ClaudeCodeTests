const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let message = `Richiesta fallita (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch (_) {}
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  getFeatures: () => request('/features'),
  createFeature: (payload) => request('/features', { method: 'POST', body: JSON.stringify(payload) }),
  updateFeature: (id, payload) => request(`/features/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  patchProgress: (id, delta) => request(`/features/${id}/progress`, { method: 'PATCH', body: JSON.stringify({ delta }) }),
  deleteFeature: (id) => request(`/features/${id}`, { method: 'DELETE' }),
};
