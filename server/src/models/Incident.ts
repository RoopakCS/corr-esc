import mongoose, { Schema, Document, Types } from "mongoose";

export type IncidentStatus =
  | "New"
  | "Assigned"
  | "In Progress"
  | "Resolved"
  | "Closed";

export interface IContractionAudit {
  complaintId: Types.ObjectId;
  complaintTitle: string;
  previousDeadline: Date;
  newDeadline: Date;
  contractedMs: number;
  corroborationCount: number;
  createdAt: Date;
}

export interface IIncident extends Document {
  organizationId: Types.ObjectId;
  categoryId: Types.ObjectId;
  status: IncidentStatus;
  escalationTier: number;
  assigneeId?: Types.ObjectId;
  supervisorId?: Types.ObjectId;
  corroborationCount: number;
  slaDeadline: Date;
  gracePeriodExpiresAt?: Date;
  reopenCount: number;
  contractionAudit: IContractionAudit[];
  createdAt: Date;
  updatedAt: Date;
}

const IncidentSchema = new Schema<IIncident>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["New", "Assigned", "In Progress", "Resolved", "Closed"],
      default: "New",
      required: true,
      index: true,
    },
    escalationTier: {
      type: Number,
      default: 0,
      min: 0,
      required: true,
    },
    assigneeId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    supervisorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    corroborationCount: {
      type: Number,
      default: 1,
      min: 1,
      required: true,
    },
    slaDeadline: {
      type: Date,
      required: true,
      index: true,
    },
    gracePeriodExpiresAt: {
      type: Date,
    },
    reopenCount: {
      type: Number,
      default: 0,
      min: 0,
      required: true,
    },
    contractionAudit: [
      {
        complaintId: {
          type: Schema.Types.ObjectId,
          ref: "Complaint",
          required: true,
        },
        complaintTitle: {
          type: String,
          required: true,
        },
        previousDeadline: {
          type: Date,
          required: true,
        },
        newDeadline: {
          type: Date,
          required: true,
        },
        contractedMs: {
          type: Number,
          required: true,
        },
        corroborationCount: {
          type: Number,
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
          required: true,
        },
      },
    ],
  },
  { timestamps: true }
);

export const Incident = mongoose.model<IIncident>("Incident", IncidentSchema);
