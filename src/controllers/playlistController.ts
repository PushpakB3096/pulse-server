import { NextFunction, Request, Response } from 'express';
import { getOrCreateDefaultUser } from '../services/userService';
import { Playlist } from '../models/Playlist';

export async function getPlaylists(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = await getOrCreateDefaultUser();
    const playlists = await Playlist.find({ userId })
      .sort({ isSystemDefault: -1, name: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: playlists
    });
  } catch (err) {
    next(err);
  }
}
