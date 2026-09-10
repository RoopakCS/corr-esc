import { Router, Request, Response } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { Category } from "../models/Category.js";
import { verifyAuth, requireOrgAccess } from "../middleware/auth.js";

export const staffRouter = Router({ mergeParams: true });

const createStaffSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  categoryPoolIds: z.array(
    z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
      message: "Invalid category ID",
    })
  ).default([]),
});

// POST /api/v1/orgs/:slug/staff
staffRouter.post(
  "/",
  verifyAuth,
  requireOrgAccess,
  async (req: Request, res: Response): Promise<void> => {
    if (req.user?.role !== "Admin") {
      res.status(403).json({ message: "Admin access required to provision staff" });
      return;
    }

    const parseResult = createStaffSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || "Validation failed";
      res.status(400).json({
        message: firstError,
        errors: parseResult.error.format(),
      });
      return;
    }

    const { name, email, password, categoryPoolIds } = parseResult.data;
    const organization = req.organization;

    // Check if user already exists with this email in this organization
    const existing = await User.findOne({
      organizationId: organization._id,
      email: email.toLowerCase(),
    });

    if (existing) {
      res.status(400).json({ message: "A user with this email already exists in this organization" });
      return;
    }

    // Verify all categoryPoolIds belong to this organization
    if (categoryPoolIds.length > 0) {
      const matchedCategories = await Category.find({
        _id: { $in: categoryPoolIds },
        organizationId: organization._id,
      });

      if (matchedCategories.length !== categoryPoolIds.length) {
        res.status(400).json({ message: "One or more category pool IDs are invalid for this organization" });
        return;
      }
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      organizationId: organization._id,
      name: name.trim(),
      email: email.toLowerCase(),
      passwordHash,
      role: "Staff",
      categoryPoolIds: categoryPoolIds.map((id) => new mongoose.Types.ObjectId(id)),
    });

    res.status(201).json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        categoryPoolIds: user.categoryPoolIds.map((id) => id.toString()),
        organizationId: organization._id.toString(),
      },
    });
  }
);

// GET /api/v1/orgs/:slug/staff
staffRouter.get(
  "/",
  verifyAuth,
  requireOrgAccess,
  async (req: Request, res: Response): Promise<void> => {
    if (req.user?.role !== "Admin" && req.user?.role !== "Staff") {
      res.status(403).json({ message: "Staff or Admin access required" });
      return;
    }

    const organization = req.organization;
    const staffMembers = await User.find({
      organizationId: organization._id,
      role: "Staff",
    }).populate("categoryPoolIds");

    res.status(200).json({
      staff: staffMembers.map((member) => ({
        id: member._id.toString(),
        name: member.name,
        email: member.email,
        role: member.role,
        categoryPoolIds: (member.categoryPoolIds as any[]).map((c: any) =>
          c._id ? c._id.toString() : c.toString()
        ),
        categoryPools: (member.categoryPoolIds as any[]).map((c: any) => ({
          id: c._id ? c._id.toString() : c.toString(),
          name: c.name || "Unknown",
        })),
        createdAt: member.createdAt,
      })),
    });
  }
);
