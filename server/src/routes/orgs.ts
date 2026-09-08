import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Organization } from "../models/Organization.js";
import { User } from "../models/User.js";
import { createAuthToken, verifyAuth, requireOrgAccess } from "../middleware/auth.js";

export const orgsRouter = Router();

const registerOrgSchema = z.object({
  organizationName: z.string().min(2, "Organization name must be at least 2 characters"),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  adminName: z.string().min(2, "Admin name must be at least 2 characters"),
  adminEmail: z.string().email("Invalid admin email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password required"),
});

// Register a new Organization and Admin
orgsRouter.post("/", async (req: Request, res: Response): Promise<void> => {
  const parseResult = registerOrgSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      message: "Validation failed",
      errors: parseResult.error.format(),
    });
    return;
  }

  const { organizationName, slug, adminName, adminEmail, password } = parseResult.data;
  const normalizedSlug = slug.toLowerCase();

  const existingOrg = await Organization.findOne({ slug: normalizedSlug });
  if (existingOrg) {
    res.status(409).json({ message: "Organization slug already in use" });
    return;
  }

  const organization = await Organization.create({
    name: organizationName,
    slug: normalizedSlug,
  });

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const admin = await User.create({
    organizationId: organization._id,
    name: adminName,
    email: adminEmail.toLowerCase(),
    passwordHash,
    role: "Admin",
  });

  const token = createAuthToken(admin);

  res.status(201).json({
    organization: {
      id: organization._id,
      name: organization.name,
      slug: organization.slug,
      createdAt: organization.createdAt,
    },
    admin: {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
    },
    token,
  });
});

// Admin / User login scoped to organization slug
orgsRouter.post("/:slug/auth/login", requireOrgAccess, async (req: Request, res: Response): Promise<void> => {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      message: "Validation failed",
      errors: parseResult.error.format(),
    });
    return;
  }

  const { email, password } = parseResult.data;
  const organization = req.organization;

  const user = await User.findOne({
    organizationId: organization._id,
    email: email.toLowerCase(),
  });

  if (!user) {
    res.status(401).json({ message: "Invalid email or password" });
    return;
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    res.status(401).json({ message: "Invalid email or password" });
    return;
  }

  const token = createAuthToken(user);

  res.status(200).json({
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationId: organization._id,
    },
  });
});

// Organization Admin Dashboard
orgsRouter.get(
  "/:slug/admin/dashboard",
  verifyAuth,
  requireOrgAccess,
  async (req: Request, res: Response): Promise<void> => {
    if (req.user?.role !== "Admin") {
      res.status(403).json({ message: "Admin access required" });
      return;
    }

    const organization = req.organization;
    const adminUser = await User.findOne({
      _id: req.user.userId,
      organizationId: organization._id,
      role: "Admin",
    });

    if (!adminUser) {
      res.status(403).json({ message: "Admin user not found in this organization" });
      return;
    }

    res.status(200).json({
      organization: {
        id: organization._id,
        name: organization.name,
        slug: organization.slug,
        createdAt: organization.createdAt,
      },
      admin: {
        id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
      },
    });
  }
);
