import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { getOrCreateDefaultUser } from '../services/userService';
import { Playlist } from '../models/Playlist';
import { Game } from '../models/Game';

type AddGamesBody = { gameId?: unknown; gameIds?: unknown };

function collectGameIds(body: AddGamesBody): string[] {
  const raw: string[] = [];

  if (typeof body.gameId === 'string' && body.gameId.trim()) {
    raw.push(body.gameId.trim());
  }

  if (Array.isArray(body.gameIds)) {
    for (const id of body.gameIds) {
      if (typeof id === 'string' && id.trim()) {
        raw.push(id.trim());
      }
    }
  }

  return [...new Set(raw)];
}

export async function getPlaylists(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = await getOrCreateDefaultUser();
    const playlists = await Playlist.find({ userId }).sort({ name: 1 }).lean();

    return res.status(200).json({
      success: true,
      data: playlists
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/playlists/:id — append game id(s) to the playlist (no full replace).
 * Body: { gameId?: string, gameIds?: string[] } — at least one id required.
 */
export async function addGamesToPlaylist(
  req: Request<{ id: string }, unknown, AddGamesBody>,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    const gameIdStrings = collectGameIds(req.body ?? {});

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid playlist id'
      });
    }

    if (gameIdStrings.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Provide gameId and/or gameIds with at least one valid id'
      });
    }

    for (const gid of gameIdStrings) {
      if (!mongoose.isValidObjectId(gid)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid game id'
        });
      }
    }

    const userId = await getOrCreateDefaultUser();
    const objectIds = gameIdStrings.map(gid => new mongoose.Types.ObjectId(gid));

    const playlist = await Playlist.findOneAndUpdate(
      { _id: id, userId },
      { $addToSet: { gameIds: { $each: objectIds } } },
      { new: true }
    ).lean();

    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: 'Playlist not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: playlist
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/playlists/:playlistId/games/:gameId — remove one game from the playlist.
 */
export async function removeGameFromPlaylist(
  req: Request<{ playlistId: string; gameId: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const { playlistId, gameId } = req.params;

    if (!mongoose.isValidObjectId(playlistId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid playlist id'
      });
    }

    if (!mongoose.isValidObjectId(gameId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid game id'
      });
    }

    const userId = await getOrCreateDefaultUser();
    const gameObjectId = new mongoose.Types.ObjectId(gameId);

    const playlist = await Playlist.findOneAndUpdate(
      { _id: playlistId, userId },
      { $pull: { gameIds: gameObjectId } },
      { new: true }
    ).lean();

    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: 'Playlist not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: playlist
    });
  } catch (err) {
    next(err);
  }
}

export async function getPlaylistById(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid playlist id'
      });
    }

    const userId = await getOrCreateDefaultUser();
    const playlist = await Playlist.findOne({ _id: id, userId }).select('_id name slug gameIds').lean();

    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: 'Playlist not found'
      });
    }

    const gameData = await Game.find({ _id: { $in: playlist.gameIds } }).select('playniteId name coverImageUrl platform source totalPlaytimeMinutes lastPlayedAt').lean();

    return res.status(200).json({
      success: true,
      data: {
        playlist,
        gameData
      }
    });
  } catch (err) {
    next(err);
  }
}