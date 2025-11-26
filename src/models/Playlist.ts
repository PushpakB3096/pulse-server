import { Schema, Document, model, Types } from 'mongoose';

export type PlaylistType = 'default' | 'custom';

export interface IPlaylist extends Document {
  userId: Types.ObjectId; // Reference to User document
  name: string;
  slug: string; // Normalized slug (lowercase, hyphenated)
  type: PlaylistType;
  isSystemDefault: boolean;
  gameIds: Types.ObjectId[]; // References to Game documents
  createdAt: Date;
  updatedAt: Date;
}

const PlaylistSchema = new Schema<IPlaylist>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    type: {
      type: String,
      enum: ['default', 'custom'],
      default: 'custom'
    },
    isSystemDefault: {
      type: Boolean,
      default: false
    },
    gameIds: {
      type: [Schema.Types.ObjectId],
      ref: 'Game',
      default: []
    }
  },
  {
    timestamps: true // Automatically adds createdAt and updatedAt
  }
);

// Helper function to generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

// Pre-save hook to auto-generate slug if not provided
PlaylistSchema.pre('save', function (next) {
  if (!this.slug && this.name) {
    this.slug = generateSlug(this.name);
  }
  next();
});

// Unique playlist name per user (also covers userId-only queries)
PlaylistSchema.index({ userId: 1, slug: 1 }, { unique: true });

export const Playlist = model<IPlaylist>('Playlist', PlaylistSchema);
