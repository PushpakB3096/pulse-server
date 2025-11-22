import { Schema, Document, model, Types } from 'mongoose';

export interface ISession extends Document {
  userId: string;
  gameId: Types.ObjectId; // Reference to Game document
  playniteId: string; // Playnite game ID for quick lookups
  startTime: Date;
  endTime?: Date;
  durationMinutes: number; // Calculated duration in minutes
  createdAt: Date;
  updatedAt: Date;
}

const SessionSchema = new Schema<ISession>(
  {
    userId: {
      type: String,
      required: true,
      index: true
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

// Indexes for efficient queries
// Get sessions by user and game (for game detail view)
SessionSchema.index({ userId: 1, gameId: 1, startTime: -1 });

// Per-user, per-playniteId timeline
SessionSchema.index({ userId: 1, playniteId: 1, startTime: -1 });

// For user-wide timelines
SessionSchema.index({ userId: 1, startTime: -1 });

// For daily aggregation (range queries on startTime)
SessionSchema.index({ userId: 1, startTime: 1 });

// Get active sessions (where endTime is null) per game
SessionSchema.index({ userId: 1, playniteId: 1, endTime: 1 });



export const Session = model<ISession>('Session', SessionSchema);

