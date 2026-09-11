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
  roleOrUserId?: string;
  targetUserId?: string;
  slaHours?: number;
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

export interface ContractionAuditEntry {
  id?: string;
  complaintId: string;
  complaintTitle: string;
  previousDeadline: string;
  newDeadline: string;
  contractedMs: number;
  corroborationCount: number;
  createdAt: string;
}

export interface IncidentInfo {
  id: string;
  status: "New" | "Assigned" | "In Progress" | "Resolved" | "Closed";
  escalationTier: number;
  corroborationCount: number;
  slaDeadline: string;
  gracePeriodExpiresAt?: string;
  reopenCount?: number;
  createdAt?: string;
  contractionAudit?: ContractionAuditEntry[];
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

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: "Staff";
  categoryPoolIds: string[];
  categoryPools: { id: string; name: string }[];
  createdAt: string;
}

export interface CreateStaffPayload {
  name: string;
  email: string;
  password: string;
  categoryPoolIds: string[];
}

export async function getStaff(slug: string): Promise<StaffMember[]> {
  const token = getToken();
  if (!token) {
    throw new Error("Authentication required");
  }

  const res = await fetch(`${API_BASE}/${encodeURIComponent(slug)}/staff`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to fetch staff list");
  }

  return data.staff || [];
}

export async function createStaff(
  slug: string,
  payload: CreateStaffPayload
): Promise<StaffMember> {
  const token = getToken();
  if (!token) {
    throw new Error("Authentication required");
  }

  const res = await fetch(`${API_BASE}/${encodeURIComponent(slug)}/staff`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to create staff account");
  }

  return data.user;
}

export interface IncidentItem {
  id: string;
  categoryId: string;
  category?: {
    id: string;
    name: string;
    baseSlaHours: number;
  };
  status: "New" | "Assigned" | "In Progress" | "Resolved" | "Closed";
  escalationTier: number;
  assigneeId?: string;
  assignee?: {
    id: string;
    name: string;
    email: string;
  };
  supervisorId?: string;
  supervisor?: {
    id: string;
    name: string;
    email: string;
  };
  corroborationCount: number;
  slaDeadline: string;
  gracePeriodExpiresAt?: string;
  reopenCount?: number;
  contractionAudit?: ContractionAuditEntry[];
  createdAt: string;
  updatedAt: string;
}

export async function getIncidents(
  slug: string,
  options?: { status?: string; escalated?: boolean } | string
): Promise<IncidentItem[]> {
  const token = getToken();
  if (!token) {
    throw new Error("Authentication required");
  }

  const query = new URLSearchParams();
  if (typeof options === "string") {
    query.set("status", options);
  } else if (options) {
    if (options.status) query.set("status", options.status);
    if (options.escalated) query.set("escalated", "true");
  }

  const queryString = query.toString() ? `?${query.toString()}` : "";
  const res = await fetch(`${API_BASE}/${encodeURIComponent(slug)}/incidents${queryString}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to fetch incidents");
  }

  return data.incidents || [];
}

export async function getIncidentDetails(
  slug: string,
  id: string
): Promise<{ incident: IncidentItem; complaints: Complaint[] }> {
  const token = getToken();
  if (!token) {
    throw new Error("Authentication required");
  }

  const res = await fetch(
    `${API_BASE}/${encodeURIComponent(slug)}/incidents/${encodeURIComponent(id)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to fetch incident details");
  }

  return data;
}

export async function claimIncident(
  slug: string,
  id: string
): Promise<IncidentItem> {
  const token = getToken();
  if (!token) {
    throw new Error("Authentication required");
  }

  const res = await fetch(
    `${API_BASE}/${encodeURIComponent(slug)}/incidents/${encodeURIComponent(id)}/claim`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to claim incident");
  }

  return data.incident;
}

export async function updateIncidentStatus(
  slug: string,
  id: string,
  status: "In Progress" | "Resolved" | "Closed"
): Promise<IncidentItem> {
  const token = getToken();
  if (!token) {
    throw new Error("Authentication required");
  }

  const res = await fetch(
    `${API_BASE}/${encodeURIComponent(slug)}/incidents/${encodeURIComponent(id)}/status`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to update incident status");
  }

  return data.incident;
}

export async function contestIncident(
  slug: string,
  incidentId: string,
  feedback?: string
): Promise<IncidentItem> {
  const token = getToken();
  if (!token) {
    throw new Error("Authentication required");
  }

  const res = await fetch(
    `${API_BASE}/${encodeURIComponent(slug)}/incidents/${encodeURIComponent(incidentId)}/contest`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ feedback }),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to contest incident resolution");
  }

  return data.incident;
}

export async function confirmIncidentResolution(
  slug: string,
  incidentId: string
): Promise<IncidentItem> {
  const token = getToken();
  if (!token) {
    throw new Error("Authentication required");
  }

  const res = await fetch(
    `${API_BASE}/${encodeURIComponent(slug)}/incidents/${encodeURIComponent(incidentId)}/confirm-resolution`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to confirm incident resolution");
  }

  return data.incident;
}

export async function reassignIncident(
  slug: string,
  incidentId: string,
  assigneeId: string
): Promise<IncidentItem> {
  const token = getToken();
  if (!token) {
    throw new Error("Authentication required");
  }

  const res = await fetch(
    `${API_BASE}/${encodeURIComponent(slug)}/incidents/${encodeURIComponent(incidentId)}/reassign`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ assigneeId }),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to reassign incident");
  }

  return data.incident;
}

export interface SuggestedCorroboration {
  complaint: Complaint;
  similarityScore: number;
  sourceIncidentId: string;
}

export interface MergeResponse {
  incident: IncidentItem;
  complaints: Complaint[];
}

export async function getCorroborationSuggestions(
  slug: string,
  incidentId: string,
  threshold?: number
): Promise<SuggestedCorroboration[]> {
  const token = getToken();
  if (!token) {
    throw new Error("Authentication required");
  }

  const query = threshold !== undefined ? `?threshold=${threshold}` : "";
  const res = await fetch(
    `${API_BASE}/${encodeURIComponent(slug)}/incidents/${encodeURIComponent(incidentId)}/corroboration-suggestions${query}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to fetch corroboration suggestions");
  }

  return data.suggestions;
}

export async function getMergeCandidates(
  slug: string,
  incidentId: string,
  search?: string
): Promise<Complaint[]> {
  const token = getToken();
  if (!token) {
    throw new Error("Authentication required");
  }

  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  const res = await fetch(
    `${API_BASE}/${encodeURIComponent(slug)}/incidents/${encodeURIComponent(incidentId)}/merge-candidates${query}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to fetch merge candidates");
  }

  return data.candidates;
}

export async function mergeComplaintIntoIncident(
  slug: string,
  incidentId: string,
  complaintId: string
): Promise<MergeResponse> {
  const token = getToken();
  if (!token) {
    throw new Error("Authentication required");
  }

  const res = await fetch(
    `${API_BASE}/${encodeURIComponent(slug)}/incidents/${encodeURIComponent(incidentId)}/merge`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ complaintId }),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to merge complaint into incident");
  }

  return data;
}

export interface NotificationItem {
  id: string;
  organizationId: string;
  recipientId: string;
  incidentId?: string;
  type: string;
  title: string;
  message: string;
  priority: "normal" | "high";
  isRead: boolean;
  createdAt: string;
}

export async function getNotifications(
  slug: string
): Promise<{ notifications: NotificationItem[]; unreadCount: number }> {
  const token = getToken();
  if (!token) {
    throw new Error("Authentication required");
  }

  const res = await fetch(`${API_BASE}/${encodeURIComponent(slug)}/notifications`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to fetch notifications");
  }

  return data;
}

export async function markNotificationRead(
  slug: string,
  id: string
): Promise<void> {
  const token = getToken();
  if (!token) {
    throw new Error("Authentication required");
  }

  const res = await fetch(
    `${API_BASE}/${encodeURIComponent(slug)}/notifications/${encodeURIComponent(id)}/read`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Failed to mark notification as read");
  }
}

export async function markAllNotificationsRead(slug: string): Promise<void> {
  const token = getToken();
  if (!token) {
    throw new Error("Authentication required");
  }

  const res = await fetch(
    `${API_BASE}/${encodeURIComponent(slug)}/notifications/mark-all-read`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Failed to mark all notifications as read");
  }
}




