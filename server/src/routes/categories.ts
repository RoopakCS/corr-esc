import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Category, ICategory, ISupervisorTier } from "../models/Category.js";
import { verifyAuth, requireOrgAccess } from "../middleware/auth.js";

export const categoriesRouter = Router({ mergeParams: true });

function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

const supervisorTierSchema = z.object({
  tier: z.number().int().min(1, "Tier level must be at least 1"),
  supervisorRole: z
    .string()
    .min(2, "Supervisor role must be at least 2 characters")
    .optional(),
  targetRole: z.string().optional(),
}).transform((data) => ({
  tier: data.tier,
  supervisorRole: (data.supervisorRole || data.targetRole || "Supervisor").trim(),
}));

const categorySchema = z
  .object({
    name: z.string().min(2, "Category name must be at least 2 characters"),
    baseSlaHours: z.number().positive("Base SLA hours must be greater than 0"),
    floorHours: z.number().positive("Floor hours must be greater than 0"),
    contractionFactor: z
      .number()
      .gt(0, "Contraction factor must be greater than 0")
      .lt(1, "Contraction factor must be less than 1.0"),
    tierTargets: z.array(supervisorTierSchema).optional().default([]),
  })
  .refine((data) => data.floorHours < data.baseSlaHours, {
    message: "Minimum floor hours must be less than base SLA hours",
    path: ["floorHours"],
  });

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== "Admin") {
    res.status(403).json({ message: "Admin access required to configure categories" });
    return;
  }
  next();
}

function formatCategory(category: ICategory) {
  return {
    id: category._id.toString(),
    name: category.name,
    baseSlaHours: category.baseSlaHours,
    floorHours: category.floorHours,
    contractionFactor: category.contractionFactor,
    tierTargets: category.tierTargets.map((t) => ({
      tier: t.tier,
      supervisorRole: t.supervisorRole,
      targetRole: t.supervisorRole, // Maintain API backward compatibility
    })),
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

// GET /api/v1/orgs/:slug/categories
categoriesRouter.get(
  "/",
  verifyAuth,
  requireOrgAccess,
  async (req: Request, res: Response): Promise<void> => {
    const categories = await Category.find({
      organizationId: req.organization._id,
    }).sort({ name: 1 });

    res.status(200).json({
      categories: categories.map(formatCategory),
    });
  }
);

// POST /api/v1/orgs/:slug/categories
categoriesRouter.post(
  "/",
  verifyAuth,
  requireOrgAccess,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const parseResult = categorySchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || "Validation failed";
      res.status(400).json({
        message: firstError,
        errors: parseResult.error.format(),
      });
      return;
    }

    const { name, baseSlaHours, floorHours, contractionFactor, tierTargets } =
      parseResult.data;

    const escapedName = escapeRegex(name.trim());
    const existing = await Category.findOne({
      organizationId: req.organization._id,
      name: { $regex: new RegExp(`^${escapedName}$`, "i") },
    });

    if (existing) {
      res.status(409).json({ message: "Category with this name already exists" });
      return;
    }

    const category = await Category.create({
      organizationId: req.organization._id,
      name: name.trim(),
      baseSlaHours,
      floorHours,
      contractionFactor,
      tierTargets,
    });

    res.status(201).json({
      category: formatCategory(category),
    });
  }
);

// PUT /api/v1/orgs/:slug/categories/:id
categoriesRouter.put(
  "/:id",
  verifyAuth,
  requireOrgAccess,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const parseResult = categorySchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || "Validation failed";
      res.status(400).json({
        message: firstError,
        errors: parseResult.error.format(),
      });
      return;
    }

    const { name, baseSlaHours, floorHours, contractionFactor, tierTargets } =
      parseResult.data;

    const category = await Category.findOne({
      _id: id,
      organizationId: req.organization._id,
    });

    if (!category) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    const escapedName = escapeRegex(name.trim());
    const duplicate = await Category.findOne({
      organizationId: req.organization._id,
      name: { $regex: new RegExp(`^${escapedName}$`, "i") },
      _id: { $ne: id },
    });

    if (duplicate) {
      res.status(409).json({ message: "Category with this name already exists" });
      return;
    }

    await category.updateSlaConfiguration({
      name,
      baseSlaHours,
      floorHours,
      contractionFactor,
      tierTargets,
    });

    res.status(200).json({
      category: formatCategory(category),
    });
  }
);
