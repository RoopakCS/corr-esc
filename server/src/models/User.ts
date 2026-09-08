import mongoose, { Schema, Document, Types } from "mongoose";
import bcrypt from "bcryptjs";

export type UserRole = "Admin" | "Staff" | "Complainant";

export interface IUser extends Document {
  organizationId: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["Admin", "Staff", "Complainant"],
      default: "Complainant",
      required: true,
    },
  },
  { timestamps: true }
);

UserSchema.index({ organizationId: 1, email: 1 }, { unique: true });

UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

export const User = mongoose.model<IUser>("User", UserSchema);
