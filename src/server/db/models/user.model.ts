import { Schema, model, models, type Model, type Types } from 'mongoose';
import { USER_ROLES, type UserRole } from '../../../types';

export interface UserDoc {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    // `unique` creates the index; declaring .index() as well would register a
    // duplicate and trigger a Mongoose warning.
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Never returned unless a query explicitly selects it. Keeps the hash out
    // of every accidental `find()` that later gets serialised to a client.
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    role: { type: String, required: true, enum: USER_ROLES, default: 'agent' },
  },
  { timestamps: true },
);

export const User: Model<UserDoc> =
  (models.User as Model<UserDoc>) ?? model<UserDoc>('User', userSchema);
