// Simple JWT decode (without verification, for client-side)
export const decodeJWT = (token: string) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload;
  } catch {
    return null;
  }
};

export const getRoleFromToken = (token: string) => {
  const decoded = decodeJWT(token);
  return decoded?.role || null;
};