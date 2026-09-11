import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Organization } from "../models/Organization.js";
import { IUser } from "../models/User.js";

const JWT_SECRET = process.env.JWT_SECRET || "corr-esc-dev-secret-key-123!";

export interface AuthUserPayload {
  userId: string;
  organizationId: string;
  role: "Admin" | "Staff" | "Complainant";
  email: string;
  name: string;
  categoryPoolIds?: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
      organization?: any;
    }
  }
}

export function signToken(payload: AuthUserPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function createAuthToken(user: IUser): string {
  return signToken({
    userId: user._id.toString(),
    organizationId: user.organizationId.toString(),
    role: user.role,
    email: user.email,
    name: user.name,
    categoryPoolIds: user.categoryPoolIds
      ? user.categoryPoolIds.map((id) => id.toString())
      : [],
  });
}

export function verifyAuth(req: Request, res: Response, next: NextFunction): void {
  let token: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (req.query && typeof req.query.token === "string") {
    token = req.query.token;
  }

  if (!token) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUserPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

export async function requireOrgAccess(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const slug = req.params.slug;
  if (!slug) {
    res.status(400).json({ message: "Organization slug required in route" });
    return;
  }

  const org = await Organization.findOne({ slug: slug.toLowerCase() });
  if (!org) {
    res.status(404).json({ message: "Organization not found" });
    return;
  }

  req.organization = org;

  if (req.user) {
    if (req.user.organizationId.toString() !== org._id.toString()) {
      res.status(403).json({
        message: "Cross-organization access forbidden",
      });
      return;
    }
  }

  next();
}
