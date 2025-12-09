import { Schema, Document, model, Types } from 'mongoose';

export const gameStatusValues = [
  'NOT_STARTED',
  'PLAYING',
  'ON_HOLD',
  'COMPLETED',
  'DROPPED'
] as const;

export type GameStatus = (typeof gameStatusValues)[number];

export interface IGame extends Document {
  userId: Types.ObjectId; // Reference to User document
  playniteId: string; // Unique identifier from Playnite extension
  name: string;
  coverImageUrl?: string;
  genres: string[];
  status?: GameStatus;
  tags: string[];
  platform: string;
  source: string;
  totalPlaytimeMinutes: number;
  lastPlayedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const GameSchema = new Schema<IGame>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    playniteId: {
      type: String,
      required: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    coverImageUrl: {
      type: String,
      trim: true
    },
    genres: {
      type: [String],
      default: []
    },
    status: {
      type: String,
      enum: gameStatusValues,
      default: 'NOT_STARTED',
      required: true,
      index: true
    },
    tags: {
      type: [String],
      default: []
    },
    platform: {
      type: String,
      required: true,
      trim: true
    },
    source: {
      type: String,
      required: true,
      trim: true
    },
    totalPlaytimeMinutes: {
      type: Number,
      default: 0,
      min: 0
    },
    lastPlayedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true // Automatically adds createdAt and updatedAt
  }
);

// Unique per user per Playnite game
GameSchema.index({ userId: 1, playniteId: 1 }, { unique: true });

// Common query patterns
GameSchema.index({ userId: 1, lastPlayedAt: -1 });
GameSchema.index({ userId: 1, totalPlaytimeMinutes: -1 });

export const Game = model<IGame>('Game', GameSchema);
