// src/dexieConfig.js
import Dexie from 'dexie';

/**
 * Dexie database instance.
 * This database will store tracked accounts and their match history locally.
 */
export const db = new Dexie('lolImproveAppDB');
const DB_NAME = 'lolImproveAppDB'; // Store DB name for delete operation

// Define the database schema
db.version(1).stores({
  trackedAccounts: '++id, &[riotId+platformId], puuid, name, tag, profileIconId, platformId, addedAt, lastUpdated',
  matches: '&matchId, trackedAccountDocId, puuid, gameCreation, queueId, championName, win, teamPosition',
});

// Open the database
db.open().catch(err => {
  console.error(`Failed to open Dexie DB: ${err.stack || err}`);
});

// --- Utility functions for DB management ---

/**
 * Clears all data from all tables in the Dexie database.
 * Keeps the database structure intact.
 */
export async function clearAllDexieTables() {
  try {
    await db.transaction('rw', db.tables, async () => {
      const tablesToClear = db.tables.map(table => {
        console.log(`Clearing table: ${table.name}`);
        return table.clear();
      });
      await Promise.all(tablesToClear);
      console.log("All Dexie tables have been cleared successfully.");
      alert("All local data tables have been cleared. You might need to refresh or re-fetch data.");
    });
  } catch (error) {
    console.error("Failed to clear Dexie tables:", error);
    alert(`Error clearing tables: ${error.message || error}`);
  }
}

/**
 * Deletes the entire Dexie database from the browser's storage.
 * A page reload is typically required after this operation for the app to reinitialize the DB.
 */
export async function deleteEntireDexieDB() {
  try {
    if (db.isOpen()) {
      db.close(); // Close the connection before deleting
      console.log(`Dexie database '${DB_NAME}' connection closed.`);
    }
    await Dexie.delete(DB_NAME);
    console.log(`Dexie database '${DB_NAME}' has been deleted successfully.`);
    alert(`The local database '${DB_NAME}' has been deleted. Please reload the page to reinitialize.`);
    // Suggesting a reload, or the app can handle it programmatically.
    // window.location.reload();
  } catch (error) {
    console.error(`Failed to delete Dexie database '${DB_NAME}':`, error);
    alert(`Error deleting database: ${error.message || error}`);
  }
}

// --- For Developer Console Access (Optional) ---
// To make these functions easily callable from the dev console:
// You can include this in a development build or a specific debug mode.
// Be cautious about exposing such functions in a production environment without safeguards.
if (import.meta.env.DEV) { // Vite specific environment variable for development
  window.dexieDebug = {
    dbInstance: db,
    clearAllTables: clearAllDexieTables,
    deleteEntireDB: deleteEntireDexieDB,
    listTables: () => db.tables.map(table => table.name),
    countTrackedAccounts: async () => {
      try {
        const count = await db.trackedAccounts.count();
        console.log(`Tracked accounts count: ${count}`);
        return count;
      } catch (e) { console.error(e); }
    },
    countMatches: async () => {
      try {
        const count = await db.matches.count();
        console.log(`Matches count: ${count}`);
        return count;
      } catch (e) { console.error(e); }
    }
  };
  console.log("Dexie debug utilities (window.dexieDebug) are available in the console.");
}

export default db; // Export the db instance as default
