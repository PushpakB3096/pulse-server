import { Schema, Document, model } from 'mongoose';

export interface IGame extends Document {
  userId: string;
  playniteId: string; // Unique identifier from Playnite extension
  name: string;

  coverImageUrl?: string;
  genres?: string[];
  tags?: string[];
  platform: string;
  source: string;
  totalPlaytimeMinutes: number;
  lastPlayedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const GameSchema = new Schema<IGame>(
  {
    userId: {
      type: String,
      required: true
    },
    playniteId: {
      type: String,
      required: true,
      unique: true,
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

// Index for efficient queries
// Unique per user per Playnite game
GameSchema.index({ userId: 1, playniteId: 1 }, { unique: true });

export const Game = model<IGame>('Game', GameSchema);
