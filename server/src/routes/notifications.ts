import { Router, Request, Response } from "express";
import { Notification, INotification } from "../models/Notification.js";
import { verifyAuth, requireOrgAccess } from "../middleware/auth.js";

export const notificationsRouter = Router({ mergeParams: true });

function formatNotification(notification: INotification) {
  return {
    id: notification._id.toString(),
    organizationId: notification.organizationId.toString(),
    recipientId: notification.recipientId.toString(),
    incidentId: notification.incidentId ? notification.incidentId.toString() : undefined,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    priority: notification.priority,
    isRead: notification.isRead,
    createdAt: notification.createdAt,
    updatedAt: notification.updatedAt,
  };
}

// GET /api/v1/orgs/:slug/notifications
notificationsRouter.get(
  "/",
  verifyAuth,
  requireOrgAccess,
  async (req: Request, res: Response): Promise<void> => {
    const organization = req.organization;
    const userId = req.user!.userId;

    const notifications = await Notification.find({
      organizationId: organization._id,
      recipientId: userId,
    })
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({
      organizationId: organization._id,
      recipientId: userId,
      isRead: false,
    });

    res.status(200).json({
      notifications: notifications.map(formatNotification),
      unreadCount,
    });
  }
);

// PATCH /api/v1/orgs/:slug/notifications/:id/read
notificationsRouter.patch(
  "/:id/read",
  verifyAuth,
  requireOrgAccess,
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const organization = req.organization;
    const userId = req.user!.userId;

    const notification = await Notification.findOneAndUpdate(
      {
        _id: id,
        organizationId: organization._id,
        recipientId: userId,
      },
      {
        $set: { isRead: true },
      },
      { new: true }
    );

    if (!notification) {
      res.status(404).json({ message: "Notification not found" });
      return;
    }

    res.status(200).json({
      notification: formatNotification(notification),
    });
  }
);

// POST /api/v1/orgs/:slug/notifications/mark-all-read
notificationsRouter.post(
  "/mark-all-read",
  verifyAuth,
  requireOrgAccess,
  async (req: Request, res: Response): Promise<void> => {
    const organization = req.organization;
    const userId = req.user!.userId;

    await Notification.updateMany(
      {
        organizationId: organization._id,
        recipientId: userId,
        isRead: false,
      },
      {
        $set: { isRead: true },
      }
    );

    res.status(200).json({
      message: "All notifications marked as read",
    });
  }
);
