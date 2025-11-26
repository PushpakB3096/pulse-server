import 'dotenv/config';
import { connectToDatabase } from '../src/db';
import { User } from '../src/models/User';
import { Playlist } from '../src/models/Playlist';
import { Game } from '../src/models/Game';
import { DEFAULT_USER_EMAIL, DEFAULT_USER_DISPLAY_NAME } from '../src/services/userService';

async function seed() {
  try {
    console.log('Connecting to database...');
    await connectToDatabase();

    // Clear existing data (optional - comment out if you want to keep existing data)
    console.log('Clearing existing data...');
    await Game.deleteMany({});
    await Playlist.deleteMany({});
    await User.deleteMany({});

    // Create user
    console.log('Creating user...');
    const user = await User.create({
      email: DEFAULT_USER_EMAIL,
      displayName: DEFAULT_USER_DISPLAY_NAME
    });
    console.log(`Created user: ${user.email} (${user._id})`);

    // Create default playlists
    console.log('Creating default playlists...');
    const playingPlaylist = await Playlist.create({
      userId: user._id,
      name: 'Playing',
      slug: 'playing',
      type: 'default',
      isSystemDefault: true,
      gameIds: []
    });

    const wantPlaylist = await Playlist.create({
      userId: user._id,
      name: 'Want',
      slug: 'want',
      type: 'default',
      isSystemDefault: true,
      gameIds: []
    });

    const finishedPlaylist = await Playlist.create({
      userId: user._id,
      name: 'Finished',
      slug: 'finished',
      type: 'default',
      isSystemDefault: true,
      gameIds: []
    });

    console.log('Created default playlists: Playing, Want, Finished');

    // Create custom playlist
    console.log('Creating custom playlist...');
    const dnfPlaylist = await Playlist.create({
      userId: user._id,
      name: 'DNF',
      slug: 'dnf',
      type: 'custom',
      isSystemDefault: false,
      gameIds: []
    });
    console.log('Created custom playlist: DNF');

    // Create games with realistic data
    console.log('Creating games...');
    const games = [
      {
        userId: user._id,
        playniteId: 'playnite-001',
        name: 'The Witcher 3: Wild Hunt',
        coverImageUrl: 'https://example.com/witcher3.jpg',
        genres: ['RPG', 'Action', 'Adventure'],
        tags: ['Open World', 'Fantasy', 'Story Rich'],
        platform: 'PC',
        source: 'Steam',
        totalPlaytimeMinutes: 1250, // ~20 hours
        lastPlayedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
      },
      {
        userId: user._id,
        playniteId: 'playnite-002',
        name: 'Hades',
        coverImageUrl: 'https://example.com/hades.jpg',
        genres: ['Action', 'Roguelike', 'Indie'],
        tags: ['Roguelike', 'Action', 'Greek Mythology'],
        platform: 'PC',
        source: 'Steam',
        totalPlaytimeMinutes: 450, // ~7.5 hours
        lastPlayedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
      },
      {
        userId: user._id,
        playniteId: 'playnite-003',
        name: 'Cyberpunk 2077',
        coverImageUrl: 'https://example.com/cyberpunk.jpg',
        genres: ['RPG', 'Action', 'Sci-Fi'],
        tags: ['Open World', 'Cyberpunk', 'Story Rich'],
        platform: 'PC',
        source: 'Steam',
        totalPlaytimeMinutes: 320, // ~5.3 hours
        lastPlayedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
      },
      {
        userId: user._id,
        playniteId: 'playnite-004',
        name: 'Elden Ring',
        coverImageUrl: 'https://example.com/eldenring.jpg',
        genres: ['Action', 'RPG', 'Souls-like'],
        tags: ['Open World', 'Difficult', 'Fantasy'],
        platform: 'PC',
        source: 'Steam',
        totalPlaytimeMinutes: 1800, // ~30 hours
        lastPlayedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
      },
      {
        userId: user._id,
        playniteId: 'playnite-005',
        name: 'Stardew Valley',
        coverImageUrl: 'https://example.com/stardew.jpg',
        genres: ['Simulation', 'RPG', 'Indie'],
        tags: ['Farming', 'Relaxing', 'Multiplayer'],
        platform: 'PC',
        source: 'Steam',
        totalPlaytimeMinutes: 0, // Not played yet
        lastPlayedAt: null
      }
    ];

    const createdGames = await Game.insertMany(games);
    console.log(`Created ${createdGames.length} games`);

    // Assign games to playlists
    // Game 1 (Witcher 3) - in Playing playlist
    playingPlaylist.gameIds.push(createdGames[0]._id);
    await playingPlaylist.save();

    // Game 2 (Hades) - in Playing and Finished playlists
    playingPlaylist.gameIds.push(createdGames[1]._id);
    finishedPlaylist.gameIds.push(createdGames[1]._id);
    await playingPlaylist.save();
    await finishedPlaylist.save();

    // Game 3 (Cyberpunk) - in DNF playlist
    dnfPlaylist.gameIds.push(createdGames[2]._id);
    await dnfPlaylist.save();

    // Game 4 (Elden Ring) - in Want playlist
    wantPlaylist.gameIds.push(createdGames[3]._id);
    await wantPlaylist.save();

    // Game 5 (Stardew Valley) - no playlist (as requested)

    console.log('\n=== Seed Summary ===');
    console.log(`User: ${user.email}`);
    console.log(`Default Playlists: 3 (Playing, Want, Finished)`);
    console.log(`Custom Playlists: 1 (DNF)`);
    console.log(`Games: ${createdGames.length}`);
    console.log('\nGame assignments:');
    console.log(`- ${createdGames[0].name}: Playing`);
    console.log(`- ${createdGames[1].name}: Playing, Finished`);
    console.log(`- ${createdGames[2].name}: DNF`);
    console.log(`- ${createdGames[3].name}: Want`);
    console.log(`- ${createdGames[4].name}: No playlist`);

    console.log('\n✅ Seed data created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

seed();

