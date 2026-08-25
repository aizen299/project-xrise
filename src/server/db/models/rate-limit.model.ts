import { Schema, model, models, type Model, type Types } from 'mongoose';

export interface RateLimitDoc {
  _id: Types.ObjectId;
  key: string;
  count: number;
  expiresAt: Date;
}

/**
 * Fixed-window rate limiting backed by MongoDB (REQ-032).
 *
 * An in-process counter is worthless on serverless: instances do not share
 * memory, so a caller simply needs to land on a cold container to bypass it.
 * A shared store is the only correct option; Mongo avoids adding Redis to the
 * stack for this scale.
 */
const rateLimitSchema = new Schema<RateLimitDoc>(
  {
    key: { type: String, required: true, unique: true },
    count: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false },
);

// TTL index: Mongo reaps expired windows, so no cleanup job is needed.
rateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RateLimit: Model<RateLimitDoc> =
  (models.RateLimit as Model<RateLimitDoc>) ?? model<RateLimitDoc>('RateLimit', rateLimitSchema);
