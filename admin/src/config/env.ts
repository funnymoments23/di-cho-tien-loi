/** Địa chỉ API backend, đã bao gồm prefix /it4788. */
export const API_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:5000/it4788'
).replace(/\/+$/, '');
