// src/dexieConfig.js
import Dexie from 'dexie';

export const db = new Dexie('lolImproveAppDB');
const DB_NAME = 'lolImproveAppDB';

// Version 3: Added structured notes fields
db.version(3).stores({
  trackedAccounts: '++id, &[riotId+platformId], puuid, name, tag, profileIconId, platformId, addedAt, lastUpdated',
  matches: '&matchId, trackedAccountDocId, puuid, gameCreation, queueId, championName, win, teamPosition, mainGoal, goalAchieved, goalDifficultyReason, positiveMoment, keyMistake, actionableTakeaway, gameRating, mentalRating, generalNotes',
  goalTemplates: '++id, title, category, createdAt',
}).upgrade(async tx => {
  console.log("Upgrading database to version 3: Added detailed notes fields to 'matches' table.");
  // No specific data migration needed for just adding new optional fields to existing tables
  // if old records simply won't have them.
});

// Version 4: Added vibeTags to the 'matches' table
db.version(4).stores({
  trackedAccounts: '++id, &[riotId+platformId], puuid, name, tag, profileIconId, platformId, addedAt, lastUpdated',
  matches: '&matchId, trackedAccountDocId, puuid, gameCreation, queueId, championName, win, teamPosition, mainGoal, goalAchieved, goalDifficultyReason, positiveMoment, keyMistake, actionableTakeaway, gameRating, mentalRating, generalNotes, *vibeTags', // Added vibeTags (indexed as multiEntry)
  goalTemplates: '++id, title, category, createdAt',
}).upgrade(async tx => {
  console.log("Upgrading database to version 4: Added 'vibeTags' to 'matches' table.");
  // If you need to initialize vibeTags for existing matches, you could do it here:
  // await tx.table("matches").toCollection().modify(match => {
  //   if (match.vibeTags === undefined) {
  //     match.vibeTags = []; // Initialize as an empty array
  //   }
  // });
});


db.open().catch(err => {
  console.error(`Failed to open Dexie DB: ${err.stack || err}`);
});

// Utility functions (no changes from previous version)
export async function clearAllDexieTables() { /* ... */ try { await db.transaction('rw', db.tables, async () => { const tablesToClear = db.tables.map(table => { console.log(`Clearing table: ${table.name}`); return table.clear(); }); await Promise.all(tablesToClear); console.log("All Dexie tables have been cleared successfully."); alert("All local data tables have been cleared. You might need to refresh or re-fetch data."); }); } catch (error) { console.error("Failed to clear Dexie tables:", error); alert(`Error clearing tables: ${error.message || error}`); } }
export async function deleteEntireDexieDB() { /* ... */ try { if (db.isOpen()) { db.close(); console.log(`Dexie database '${DB_NAME}' connection closed.`); } await Dexie.delete(DB_NAME); console.log(`Dexie database '${DB_NAME}' has been deleted successfully.`); alert(`The local database '${DB_NAME}' has been deleted. Please reload the page to reinitialize.`); } catch (error) { console.error(`Failed to delete Dexie database '${DB_NAME}':`, error); alert(`Error deleting database: ${error.message || error}`); } }

if (import.meta.env.DEV) { 
  window.dexieDebug = {
    dbInstance: db,
    clearAllTables: clearAllDexieTables,
    deleteEntireDB: deleteEntireDexieDB,
    listTables: () => db.tables.map(table => table.name),
    countTrackedAccounts: async () => { try { const count = await db.trackedAccounts.count(); console.log(`Tracked accounts count: ${count}`); return count; } catch (e) { console.error(e); } },
    countMatches: async () => { try { const count = await db.matches.count(); console.log(`Matches count: ${count}`); return count; } catch (e) { console.error(e); } },
    countGoalTemplates: async () => { try { const count = await db.goalTemplates.count(); console.log(`Goal templates count: ${count}`); return count; } catch (e) { console.error(e); } }
  };
  console.log("Dexie debug utilities (window.dexieDebug) are available in the console.");
}

export default db;
