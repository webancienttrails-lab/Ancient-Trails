import {
  model,
  models,
  Schema,
  type HydratedDocument,
  type Model,
} from "mongoose";

export enum UserRole {
  TRAVELLER = "traveller",
  SUPER_ADMIN = "super_admin",
}

export enum UserStatus {
  ACTIVE = "active",
  BLOCKED = "blocked",
}

export interface IUser {
  firstName: string;
  lastName: string;
  email: string;
  passwordHash?: string;
  mobileNumber?: string;
  gender?: string;
  nationality?: string;
  dateOfBirth?: string;
  firebaseUid?: string;
  roles: string[];
  status: UserStatus;
  isMobileVerified: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<IUser>;

const userSchema = new Schema<IUser>(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    passwordHash: {
      type: String,
      trim: true,
      select: false,
    },
    mobileNumber: {
      type: String,
      trim: true,
      match: [/^\d{10,15}$/, "Mobile number must be 10 to 15 digits"],
    },
    gender: {
      type: String,
      trim: true,
      enum: ["Male", "Female", ""],
      default: "",
    },
    nationality: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
    dateOfBirth: {
      type: String,
      trim: true,
      maxlength: 40,
      default: "",
    },
    firebaseUid: {
      type: String,
      trim: true,
      maxlength: 128,
    },
    roles: {
      type: [String],
      default: [UserRole.TRAVELLER],
      required: true,
      validate: {
        validator(roles: string[]) {
          return roles.every(
            (role) =>
              role === UserRole.TRAVELLER ||
              role === UserRole.SUPER_ADMIN ||
              role === "admin" ||
              role.endsWith("_admin")
          );
        },
        message: "Role must be traveller or an admin role",
      },
    },
    status: {
      type: String,
      enum: Object.values(UserStatus),
      default: UserStatus.ACTIVE,
      required: true,
    },
    isMobileVerified: {
      type: Boolean,
      default: false,
      required: true,
    },
    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index({ mobileNumber: 1 }, { unique: true, sparse: true });
userSchema.index({ firebaseUid: 1 }, { unique: true, sparse: true });
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ roles: 1 });

export const User =
  (models.User as Model<IUser> | undefined) ||
  model<IUser>("User", userSchema);
