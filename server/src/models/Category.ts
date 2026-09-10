import mongoose, { Schema, Document, Types } from "mongoose";

export interface ISupervisorTier {
  tier: number;
  supervisorRole: string;
}

export interface ICategory extends Document {
  organizationId: Types.ObjectId;
  name: string;
  baseSlaHours: number;
  floorHours: number;
  contractionFactor: number;
  tierTargets: ISupervisorTier[];
  createdAt: Date;
  updatedAt: Date;
  updateSlaConfiguration(data: {
    name: string;
    baseSlaHours: number;
    floorHours: number;
    contractionFactor: number;
    tierTargets: ISupervisorTier[];
  }): Promise<ICategory>;
}

const SupervisorTierSchema = new Schema<ISupervisorTier>(
  {
    tier: { type: Number, required: true, min: 1 },
    supervisorRole: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const CategorySchema = new Schema<ICategory>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    baseSlaHours: { type: Number, required: true, min: 0.01 },
    floorHours: { type: Number, required: true, min: 0.001 },
    contractionFactor: {
      type: Number,
      required: true,
      min: 0.001,
      max: 0.999,
    },
    tierTargets: [SupervisorTierSchema],
  },
  { timestamps: true }
);

CategorySchema.index({ organizationId: 1, name: 1 }, { unique: true });

CategorySchema.methods.updateSlaConfiguration = async function (data: {
  name: string;
  baseSlaHours: number;
  floorHours: number;
  contractionFactor: number;
  tierTargets: ISupervisorTier[];
}): Promise<ICategory> {
  this.name = data.name.trim();
  this.baseSlaHours = data.baseSlaHours;
  this.floorHours = data.floorHours;
  this.contractionFactor = data.contractionFactor;
  this.tierTargets = data.tierTargets;
  return this.save();
};

export const Category = mongoose.model<ICategory>("Category", CategorySchema);
