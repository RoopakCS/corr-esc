import mongoose, { Schema, Document, Types } from "mongoose";

export interface IComplaint extends Document {
  organizationId: Types.ObjectId;
  incidentId: Types.ObjectId;
  complainantId: Types.ObjectId;
  categoryId: Types.ObjectId;
  title: string;
  description: string;
  locationContext: string;
  photoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ComplaintSchema = new Schema<IComplaint>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    incidentId: {
      type: Schema.Types.ObjectId,
      ref: "Incident",
      required: true,
      index: true,
    },
    complainantId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    locationContext: {
      type: String,
      default: "",
      trim: true,
    },
    photoUrl: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

export const Complaint = mongoose.model<IComplaint>("Complaint", ComplaintSchema);
