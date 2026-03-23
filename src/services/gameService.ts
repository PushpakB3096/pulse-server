import { Game } from '../models/Game';
import { Playlist } from '../models/Playlist';
import { Types } from 'mongoose';

export interface GameUpsertInput {
  playniteId: string;
  name: string;
  description?: string;
  coverImageUrl?: string;
  genres?: string[];
  tags?: string[];
  platform: string;
  source: string;
  totalPlaytimeMinutes?: number;
  lastPlayedAt?: Date | string | null;
  gameId?: string;
  pluginId?: string;
  links?: { name: string; url: string }[];
}

export async function upsertGameForUser(
  userId: Types.ObjectId | string,
  payload: GameUpsertInput
) {
  const {
    playniteId,
    name,
    description,
    coverImageUrl,
    genres,
    tags,
    platform,
    source,
    totalPlaytimeMinutes,
    lastPlayedAt,
    gameId,
    pluginId,
    links
  } = payload;

  if (!playniteId || !name || !platform || !source) {
    throw new Error('playniteId, name, platform, and source are required');
  }

  const updatedGame: Record<string, unknown> = {
    userId,
    playniteId,
    name,
    description,
    genres,
    tags,
    platform,
    source
  };

  if (coverImageUrl !== undefined) {
    updatedGame.coverImageUrl = coverImageUrl;
  }

  if (gameId !== undefined) {
    updatedGame.gameId = gameId;
  }
  if (pluginId !== undefined) {
    updatedGame.pluginId = pluginId;
  }
  if (links !== undefined) {
    updatedGame.links = links;
  }

  if (typeof totalPlaytimeMinutes === 'number') {
    updatedGame.totalPlaytimeMinutes = totalPlaytimeMinutes;
  }

  if (lastPlayedAt) {
    let dateValue: Date | null = null;

    if (lastPlayedAt instanceof Date) {
      dateValue = lastPlayedAt;
    } else if (typeof lastPlayedAt === 'string') {
      // Clean up date string (remove spaces around colons in time and timezone)
      // Handles cases like "2025-07-31T21: 57: 15.301+05: 30" -> "2025-07-31T21:57:15.301+05:30"
      const cleanedDateString = lastPlayedAt
        .replace(/:\s+/g, ':') // Remove spaces after colons
        .replace(/\s+:/g, ':'); // Remove spaces before colons (just in case)
      dateValue = new Date(cleanedDateString);
    }

    // Only set if date is valid
    if (dateValue && !isNaN(dateValue.getTime())) {
      updatedGame.lastPlayedAt = dateValue;
    } else if (lastPlayedAt === null) {
      // Explicitly allow null to clear the field
      updatedGame.lastPlayedAt = null;
    }
  }

  return Game.findOneAndUpdate(
    { userId, playniteId },
    {
      $set: updatedGame,
      $setOnInsert: {
        status: 'NOT_STARTED'
      }
    },
    {
      new: true,
      upsert: true,
      runValidators: true
    }
  );
}

function toObjectId(userId: Types.ObjectId | string): Types.ObjectId {
  if (userId instanceof Types.ObjectId) {
    return userId;
  }
  return new Types.ObjectId(userId);
}

/**
 * Removes a game by Playnite id: pulls its Mongo id from all user playlists, then deletes the game.
 */
export async function deleteGameByPlayniteIdForUser(
  userId: Types.ObjectId | string,
  playniteId: string
): Promise<{ deleted: boolean }> {
  const uid = toObjectId(userId);
  const trimmed = playniteId?.trim();
  if (!trimmed) {
    return { deleted: false };
  }

  const game = await Game.findOne({ userId: uid, playniteId: trimmed })
    .select('_id')
    .lean();

  if (!game?._id) {
    return { deleted: false };
  }

  const gameOid = game._id as Types.ObjectId;

  await Playlist.updateMany(
    { userId: uid, gameIds: gameOid },
    { $pull: { gameIds: gameOid } }
  );

  await Game.deleteOne({ _id: gameOid, userId: uid });
  return { deleted: true };
}
