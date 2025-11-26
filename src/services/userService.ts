import { User } from '../models/User';
import { Playlist } from '../models/Playlist';
import { Types } from 'mongoose';

export const DEFAULT_USER_EMAIL = 'default@user.com';
export const DEFAULT_USER_DISPLAY_NAME = 'Default User';

const SYSTEM_DEFAULT_PLAYLISTS = [
  { name: 'Playing', slug: 'playing', type: 'default' as const },
  { name: 'Want', slug: 'want', type: 'default' as const },
  { name: 'Finished', slug: 'finished', type: 'default' as const }
];

/**
 * Get or create the default user
 * Also ensures system default playlists exist for the user
 */
export async function getOrCreateDefaultUser(): Promise<Types.ObjectId> {
  let user = await User.findOne({ email: DEFAULT_USER_EMAIL });

  if (!user) {
    // Create default user
    user = await User.create({
      email: DEFAULT_USER_EMAIL,
      displayName: DEFAULT_USER_DISPLAY_NAME
    });

    // Create system default playlists
    const playlists = SYSTEM_DEFAULT_PLAYLISTS.map(playlist => ({
      userId: user!._id,
      name: playlist.name,
      slug: playlist.slug,
      type: playlist.type,
      isSystemDefault: true,
      gameIds: []
    }));

    await Playlist.insertMany(playlists);
  }

  return user._id;
}

