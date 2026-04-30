// Simple JWT decode (without verification, for client-side)
export const decodeJWT = (token: string) => {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) {
      return null;
    }

    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const paddedBase64 = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "=",
    );
    const payload = JSON.parse(atob(paddedBase64));
    return payload;
  } catch {
    return null;
  }
};

export const getRoleFromToken = (token: string) => {
  const decoded = decodeJWT(token);
  return decoded?.role || null;
};

export const getUserNameFromToken = (token: string) => {
  const decoded = decodeJWT(token);
  return decoded?.name || null;
};
