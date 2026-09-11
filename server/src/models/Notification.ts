import mongoose, { Schema, Document, Types } from "mongoose";

export interface INotification extends Document {
  organizationId: Types.ObjectId;
  recipientId: Types.ObjectId;
  incidentId?: Types.ObjectId;
  complaintId?: Types.ObjectId;
  type: string;
  title: string;
  message: string;
  priority: "normal" | "high";
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    incidentId: {
      type: Schema.Types.ObjectId,
      ref: "Incident",
      index: true,
    },
    complaintId: {
      type: Schema.Types.ObjectId,
      ref: "Complaint",
      index: true,
    },
    type: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    priority: {
      type: String,
      enum: ["normal", "high"],
      default: "normal",
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      required: true,
    },
  },
  { timestamps: true }
);

NotificationSchema.index({ organizationId: 1, recipientId: 1, isRead: 1 });
NotificationSchema.index({ createdAt: -1 });

export const Notification = mongoose.model<INotification>(
  "Notification",
  NotificationSchema
);
