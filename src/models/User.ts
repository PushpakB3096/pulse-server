import { Schema, Document, model } from 'mongoose';

export interface IUser extends Document {
  email: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    displayName: {
      type: String,
      required: true,
      trim: true
    }
  },
  {
    timestamps: true // Automatically adds createdAt and updatedAt
  }
);

export const User = model<IUser>('User', UserSchema);

