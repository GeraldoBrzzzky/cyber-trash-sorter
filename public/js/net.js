/** Thin wrapper over the JSON API — always sends the session cookie. */
export async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || `Request gagal (${res.status})`);
    error.status = res.status;
    throw error;
  }
  return data;
}

export const redirect = (to) => {
  window.location.href = to;
};
