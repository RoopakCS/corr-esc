const API_BASE = "/api/v1/orgs";

export interface RegisterOrgPayload {
  organizationName: string;
  slug: string;
  adminName: string;
  adminEmail: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  organization?: {
    id: string;
    name: string;
    slug: string;
    createdAt: string;
  };
  user?: {
    id: string;
    name: string;
    email: string;
    role: "Admin" | "Staff" | "Complainant";
    organizationId: string;
  };
  admin?: {
    id: string;
    name: string;
    email: string;
    role: "Admin";
  };
}

export interface DashboardResponse {
  organization: {
    id: string;
    name: string;
    slug: string;
    createdAt: string;
  };
  admin: {
    userId: string;
    organizationId: string;
    role: "Admin";
    email: string;
    name: string;
  };
}

export function getToken(): string | null {
  return localStorage.getItem("corr_esc_token");
}

export function setToken(token: string): void {
  localStorage.setItem("corr_esc_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("corr_esc_token");
}

export async function registerOrganization(payload: RegisterOrgPayload): Promise<AuthResponse> {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to register organization");
  }

  if (data.token) {
    setToken(data.token);
  }

  return data;
}

export async function login(
  slug: string,
  email: string,
  password: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(slug)}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to log in");
  }

  if (data.token) {
    setToken(data.token);
  }

  return data;
}

export async function getAdminDashboard(slug: string): Promise<DashboardResponse> {
  const token = getToken();
  if (!token) {
    throw new Error("No authentication token found");
  }

  const res = await fetch(`${API_BASE}/${encodeURIComponent(slug)}/admin/dashboard`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to fetch admin dashboard");
  }

  return data;
}
