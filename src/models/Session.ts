import { Schema, Document, model, Types } from 'mongoose';

export interface ISession extends Document {
  userId: Types.ObjectId; // Reference to User document
  gameId: Types.ObjectId; // Reference to Game document
  playniteId: string; // Playnite game ID for quick lookups
  startTime: Date;
  endTime?: Date | null;
  durationMinutes: number; // Calculated duration in minutes
  createdAt: Date;
  updatedAt: Date;
}

const SessionSchema = new Schema<ISession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    gameId: {
      type: Schema.Types.ObjectId,
      ref: 'Game',
      required: true,
      index: true
    },
    playniteId: {
      type: String,
      required: true,
      trim: true
    },
    startTime: {
      type: Date,
      required: true,
      index: true
    },
    endTime: {
      type: Date,
      default: null
    },
    durationMinutes: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true // Automatically adds createdAt and updatedAt
  }
);

// Per game, per user, latest first
SessionSchema.index({ userId: 1, gameId: 1, startTime: -1 });

// Per playniteId timelines
SessionSchema.index({ userId: 1, playniteId: 1, startTime: -1 });

// User-wide timelines
SessionSchema.index({ userId: 1, startTime: -1 });

// Daily aggregation (range queries)
SessionSchema.index({ userId: 1, startTime: 1 });

// Active sessions per game
SessionSchema.index({ userId: 1, playniteId: 1, endTime: 1 });

export const Session = model<ISession>('Session', SessionSchema);
