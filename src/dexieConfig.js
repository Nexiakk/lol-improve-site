// src/dexieConfig.js
import Dexie from 'dexie';

/**
 * Dexie database instance.
 * This database will store tracked accounts and their match history locally.
 */
export const db = new Dexie('lolImproveAppDB');

// Define the database schema
db.version(1).stores({
  /**
   * Stores tracked League of Legends accounts.
   *
   * Schema:
   * ++id: Auto-incrementing primary key.
   * &[riotId+platformId]: Compound index ensuring uniqueness for riotId and platformId combination.
   * The '&' prefix means the index must be unique.
   * puuid: Player Universally Unique Identifier, indexed for quick lookups.
   * name: Summoner name (game name part of Riot ID).
   * tag: Tagline part of Riot ID.
   * profileIconId: ID of the summoner's profile icon.
   * platformId: The platform/region ID (e.g., 'euw1', 'na1').
   * addedAt: Timestamp when the account was added to tracking. Indexed for sorting.
   * lastUpdated: Timestamp of the last successful match history update for this account.
   * // Any other account-specific fields can be added here.
   */
  trackedAccounts: '++id, &[riotId+platformId], puuid, name, tag, profileIconId, platformId, addedAt, lastUpdated',

  /**
   * Stores individual match details for tracked accounts.
   *
   * Schema:
   * ++id: Auto-incrementing primary key (Dexie will manage this if not provided or if matchId is not suitable as a primary key directly).
   * &matchId: Unique match identifier from Riot API. Used as the primary key.
   * trackedAccountDocId: Foreign key linking to the 'id' in 'trackedAccounts' table.
   * This helps associate matches with a specific tracked account.
   * Indexed for efficient querying of matches by account.
   * puuid: PUUID of the tracked player in this match. Indexed for filtering.
   * gameCreation: Timestamp (in seconds or Date object) of when the game was created. Indexed for sorting and filtering by date.
   * gameDuration: Duration of the game in seconds.
   * gameMode: Game mode (e.g., 'CLASSIC', 'ARAM').
   * queueId: The specific queue ID for the match. Indexed for filtering by queue type.
   * platformId: Platform ID where the match was played.
   * win: Boolean indicating if the tracked player won the match.
   * championName: Name of the champion played by the tracked player.
   * championId: ID of the champion played.
   * championLevel: Level of the champion at the end of the game.
   * teamPosition: Player's role/position in the game (e.g., 'TOP', 'JUNGLE').
   * kills, deaths, assists: KDA stats for the tracked player.
   * totalMinionsKilled, neutralMinionsKilled: CS stats.
   * goldEarned: Gold earned by the tracked player.
   * item0, item1, ..., item6: Item IDs for the player's build.
   * summoner1Id, summoner2Id: Summoner spell IDs.
   * primaryPerkId, subStyleId: Rune IDs.
   * opponentChampionName: Name of the opponent champion in the same role (if applicable).
   * notes: User-added notes for the match.
   * goals: User-added goals for the match.
   * rating: User-assigned rating for the match.
   * allParticipants: Array of objects, each representing a participant in the match with their detailed stats.
   * Not typically indexed directly due to its complex structure, but useful for display.
   * teamObjectives: Array of objects detailing objectives taken by each team.
   * processedTimelineForTrackedPlayer: Object containing processed timeline data (snapshots, skill order, etc.) for the tracked player.
   * rawTimelineFrames: Array of raw frame data from the Riot API timeline endpoint.
   * // Any other match-specific fields can be added here.
   *
   * Note on `trackedAccountDocId`: In Firestore, this was the document ID of the account.
   * In Dexie, this will be the `id` (auto-incremented primary key) from the `trackedAccounts` table.
   * We'll need to ensure this linkage is correctly established when saving matches.
   *
   * Note on `matchId` as primary key: Using `&matchId` makes `matchId` the primary key and ensures it's unique.
   * This is generally good for match data. If `matchId` is not always present or if you prefer an auto-incrementing
   * primary key regardless, you could use `++id, matchId, ...` and ensure `matchId` is still indexed and unique
   * if needed (e.g., `++autoId, &matchId, trackedAccountDocId, ...`).
   * For simplicity and direct mapping from Riot's unique match ID, `&matchId` is chosen here.
   */
  matches: '&matchId, trackedAccountDocId, puuid, gameCreation, queueId, championName, win, teamPosition',
  // Add more indexes to 'matches' table as needed for querying performance.
  // For example, if you frequently query matches by championName or win status.
});

// Open the database
db.open().catch(err => {
  console.error(`Failed to open Dexie DB: ${err.stack || err}`);
});

// Example of how to use it (optional, for testing):
// async function testDB() {
//   try {
//     // Add a sample account
//     const accountId = await db.trackedAccounts.add({
//       riotId: 'testuser#1234',
//       platformId: 'euw1',
//       puuid: 'SAMPLE_PUUID_123',
//       name: 'TestUser',
//       tag: '1234',
//       profileIconId: 1,
//       addedAt: new Date(),
//       lastUpdated: new Date()
//     });
//     console.log(`Added account with ID: ${accountId}`);
//
//     // Add a sample match for that account
//     const match RiotId = `EUW1_1234567890`; // Example match ID
//     await db.matches.add({
//       matchId: matchRiotId,
//       trackedAccountDocId: accountId, // Link to the account we just added
//       puuid: 'SAMPLE_PUUID_123',
//       gameCreation: Math.floor(Date.now() / 1000),
//       gameDuration: 1800, // 30 minutes
//       win: true,
//       championName: 'Ahri',
//       notes: 'Played well, good CS.'
//     });
//     console.log(`Added match ${matchRiotId}`);
//
//     // Query accounts
//     const allAccounts = await db.trackedAccounts.toArray();
//     console.log('All tracked accounts:', allAccounts);
//
//     // Query matches for the specific account
//     const accountMatches = await db.matches.where('trackedAccountDocId').equals(accountId).toArray();
//     console.log(`Matches for account ${accountId}:`, accountMatches);
//
//   } catch (error) {
//     console.error('Dexie DB test error:', error);
//   }
// }
//
// testDB(); // Uncomment to run a quick test when the app loads

export default db;
