const TOKEN_KEY = "agentwatch.adminToken";

export function getAdminToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? "";
}

export function setAdminToken(token: string): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}
