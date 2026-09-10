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
    id: string;
    name: string;
    email: string;
    role: "Admin";
  };
}

export interface TierTarget {
  tier: number;
  targetRole: string;
  supervisorRole?: string;
  targetUserId?: string;
}

export interface Category {
  id: string;
  name: string;
  baseSlaHours: number;
  floorHours: number;
  contractionFactor: number;
  tierTargets: TierTarget[];
  createdAt: string;
  updatedAt: string;
}

export interface CategoryPayload {
  name: string;
  baseSlaHours: number;
  floorHours: number;
  contractionFactor: number;
  tierTargets?: TierTarget[];
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

export async function getCategories(slug: string): Promise<Category[]> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/${encodeURIComponent(slug)}/categories`, {
    headers,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to fetch categories");
  }

  return data.categories || [];
}

export async function createCategory(
  slug: string,
  payload: CategoryPayload
): Promise<Category> {
  const token = getToken();
  if (!token) {
    throw new Error("Authentication required");
  }

  const res = await fetch(`${API_BASE}/${encodeURIComponent(slug)}/categories`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to create category");
  }

  return data.category;
}

export async function updateCategory(
  slug: string,
  id: string,
  payload: CategoryPayload
): Promise<Category> {
  const token = getToken();
  if (!token) {
    throw new Error("Authentication required");
  }

  const res = await fetch(`${API_BASE}/${encodeURIComponent(slug)}/categories/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to update category");
  }

  return data.category;
}

export interface RegisterComplainantPayload {
  name: string;
  email: string;
  password: string;
}

export interface IncidentInfo {
  id: string;
  status: "New" | "Assigned" | "In Progress" | "Resolved" | "Closed";
  escalationTier: number;
  corroborationCount: number;
  slaDeadline: string;
}

export interface Complaint {
  id: string;
  title: string;
  description: string;
  locationContext: string;
  photoUrl?: string;
  complainantId: string;
  categoryId: string;
  categoryName?: string;
  incidentId: string;
  incident?: IncidentInfo;
  createdAt: string;
  updatedAt: string;
}

export interface CreateComplaintPayload {
  categoryId: string;
  title: string;
  description: string;
  locationContext?: string;
  photoUrl?: string;
}

export async function registerComplainant(
  slug: string,
  payload: RegisterComplainantPayload
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(slug)}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to register complainant");
  }

  if (data.token) {
    setToken(data.token);
  }

  return data;
}

export async function submitComplaint(
  slug: string,
  payload: CreateComplaintPayload
): Promise<{ complaint: Complaint; incident: IncidentInfo }> {
  const token = getToken();
  if (!token) {
    throw new Error("Authentication required");
  }

  const res = await fetch(`${API_BASE}/${encodeURIComponent(slug)}/complaints`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to submit complaint");
  }

  return data;
}

export async function getMyComplaints(slug: string): Promise<Complaint[]> {
  const token = getToken();
  if (!token) {
    throw new Error("Authentication required");
  }

  const res = await fetch(`${API_BASE}/${encodeURIComponent(slug)}/complaints/my`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to fetch complaints");
  }

  return data.complaints || [];
}

export async function getComplaintById(
  slug: string,
  id: string
): Promise<Complaint> {
  const token = getToken();
  if (!token) {
    throw new Error("Authentication required");
  }

  const res = await fetch(
    `${API_BASE}/${encodeURIComponent(slug)}/complaints/${encodeURIComponent(id)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to fetch complaint details");
  }

  return data.complaint;
}

