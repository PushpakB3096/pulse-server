import { Request, Response, NextFunction } from 'express';
import mongoose, { type SortOrder } from 'mongoose';
import { Game, GameStatus, gameStatusValues } from '../models/Game';
import { getOrCreateDefaultUser } from '../services/userService';
import { upsertGameForUser } from '../services/gameService';
import {
  enqueueEnrichGame,
  enrichAllGamesForUser,
  getEnrichmentStatus
} from '../services/enrichmentService';
import { Playlist } from '../models/Playlist';

type UpdateStatusRequest = Request<{ id: string }, any, { status: GameStatus }>;

/**
 * Escapes regex metacharacters (. * + ? ^ $ { } ( ) | [ ] \) so the string
 * can be used safely in a RegExp. The escaped string will match the literal
 * user input only — e.g. "Halo 2" matches "Halo 2" but "2." will not match
 * any digit; it will match the literal "2.".
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getSortingOrder(sortBy: string): Record<string, SortOrder> {
  if (sortBy === 'name') {
    return { name: 1 };
  }

  if (sortBy === 'playtime') {
    return { totalPlaytimeMinutes: -1, name: 1 };
  }

  if (sortBy === 'recent') {
    return { lastPlayedAt: -1, name: 1 };
  }

  return { lastPlayedAt: -1, name: 1 };
}

export async function listGames(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { q: query, sortBy } = req.query;
  const q = typeof query === 'string' ? query.trim() : '';
  const sortOrder = getSortingOrder(sortBy as string);

  try {
    const userId = await getOrCreateDefaultUser();
    const filter: Record<string, unknown> = { userId };

    if (q) {
      const escaped = escapeRegex(q);
      filter.name = { $regex: escaped, $options: 'i' };
    }

    const games = await Game.find(filter)
      .collation({ locale: 'en', strength: 2 }) // accent-insensitive: "pokemon" matches "Pokémon"
      .sort(sortOrder)
      .select(
        'name genres platform totalPlaytimeMinutes lastPlayedAt coverImageUrl'
      )
      .lean();

    return res.json({
      success: true,
      data: games
    });
  } catch (err) {
    next(err);
  }
}

export async function getGameDetails(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    const userId = await getOrCreateDefaultUser();

    if (!mongoose.isValidObjectId(id)) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid game id' });
    }

    const game = await Game.findOne({ _id: id, userId }).lean();

    if (!game) {
      return res
        .status(404)
        .json({ success: false, message: 'Game not found' });
    }

    // Playlists this game is in
    const playlists = await Playlist.find({
      userId,
      gameIds: new mongoose.Types.ObjectId(id)
    })
      .select('_id name slug')
      .sort({ name: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        game,
        playlists
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function createGame(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
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
      lastPlayedAt
    } = req.body;

    // TODO: remove the logic of default user
    const userId = await getOrCreateDefaultUser();

    const game = await upsertGameForUser(userId, {
      playniteId,
      name,
      description,
      coverImageUrl,
      genres,
      tags,
      platform,
      source,
      totalPlaytimeMinutes,
      lastPlayedAt
    });

    return res.status(201).json({
      success: true,
      data: game
    });
  } catch (err) {
    next(err);
  }
}

export async function syncGames(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { games } = req.body;

    if (!Array.isArray(games) || games.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'games must be a non-empty array'
      });
    }

    const userId = await getOrCreateDefaultUser(); // later this comes from auth

    const results = await Promise.all(
      games.map(game =>
        upsertGameForUser(userId, {
          playniteId: game.playniteId,
          name: game.name,
          description: game.description,
          genres: game.genres,
          tags: game.tags,
          platform: game.platform,
          source: game.source,
          totalPlaytimeMinutes: game.totalPlaytimeMinutes,
          lastPlayedAt: game.lastPlayedAt,
          gameId: game.gameId,
          pluginId: game.pluginId,
          links: game.links,
        })
      )
    );

    for (const doc of results) {
      if (doc?._id) {
        enqueueEnrichGame(userId, String(doc._id));
      }
    }

    return res.status(200).json({
      success: true,
      count: results.length
    });
  } catch (err) {
    next(err);
  }
}

export async function postEnrichGames(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = await getOrCreateDefaultUser();
    const { queued, skipped } = await enrichAllGamesForUser(userId);
    return res.status(200).json({
      success: true,
      queued,
      skipped
    });
  } catch (err) {
    next(err);
  }
}

export async function getEnrichmentStatusHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    await getOrCreateDefaultUser();
    const status = getEnrichmentStatus();
    return res.status(200).json({
      success: true,
      data: status
    });
  } catch (err) {
    next(err);
  }
}

export const updateGameStatus = async (
  req: UpdateStatusRequest,
  res: Response
) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = await getOrCreateDefaultUser();

    if (!gameStatusValues.includes(status as GameStatus)) {
      return res.status(400).json({
        error: 'INVALID_STATUS',
        message: `Status must be one of: ${gameStatusValues.join(', ')}`
      });
    }

    const game = await Game.findOneAndUpdate(
      { _id: id, userId },
      { status },
      { new: true }
    ).lean();

    if (!game) {
      return res.status(404).json({
        error: 'GAME_NOT_FOUND'
      });
    }

    return res.json(game);
  } catch (err) {
    console.error('updateGameStatus error', err);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
};
