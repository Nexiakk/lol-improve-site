// src/utils/matchCalculations.js

/**
 * @fileoverview Utility functions for match data calculations and formatting.
 */

// Constants for queue IDs (can be expanded)
export const QUEUE_IDS = {
  RANKED_SOLO: 420,
  FLEX_SR: 440,
  NORMAL_DRAFT: 400,
  NORMAL_BLIND: 430,
  ARAM: 450,
  // Add other relevant queue IDs here
};

/**
 * Determines the Riot API continental route based on platformId.
 * @param {string} platformId - The platform ID (e.g., 'euw1', 'na1').
 * @returns {string} The continental route (e.g., 'europe', 'americas').
 */
export const getContinentalRoute = (platformId) => {
  if (!platformId) return 'europe'; // Default or error case
  const lowerPlatformId = platformId.toLowerCase();
  if (['eun1', 'euw1', 'tr1', 'ru'].includes(lowerPlatformId)) return 'europe';
  if (['na1', 'br1', 'la1', 'la2', 'oc1', 'americas'].includes(lowerPlatformId)) return 'americas';
  if (['kr', 'jp1', 'asia'].includes(lowerPlatformId)) return 'asia';
  if (['vn2', 'th2', 'tw2', 'sg2', 'ph2', 'sea'].includes(lowerPlatformId)) return 'sea';
  return 'europe'; // Fallback
};

/**
 * Creates a promise that resolves after a specified delay.
 * @param {number} ms - The delay in milliseconds.
 * @returns {Promise<void>}
 */
export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Formats a Unix timestamp (in seconds) into a human-readable "time ago" string.
 * @param {number} timestampSeconds - The Unix timestamp in seconds.
 * @returns {string} The formatted time ago string (e.g., "5m ago", "2h ago").
 */
export const timeAgo = (timestampSeconds) => {
  if (!timestampSeconds) return '';
  const date = new Date(timestampSeconds * 1000);
  const now = new Date();
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);

  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
};

/**
 * Formats game duration (in seconds) to "MM:SS" string.
 * @param {number} durationSeconds - The game duration in seconds.
 * @returns {string} Formatted duration string or 'N/A'.
 */
export const formatGameDurationMMSS = (durationSeconds) => {
  if (typeof durationSeconds !== 'number' || isNaN(durationSeconds) || durationSeconds < 0) return 'N/A';
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = Math.floor(durationSeconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Formats game mode and queue ID into a displayable string.
 * @param {string} gameModeApi - The game mode from API (e.g., 'CLASSIC').
 * @param {number} queueId - The queue ID.
 * @returns {string} Displayable game mode string.
 */
export const formatGameMode = (gameModeApi, queueId) => {
  switch (queueId) {
    case QUEUE_IDS.RANKED_SOLO: return 'Ranked Solo';
    case QUEUE_IDS.FLEX_SR: return 'Ranked Flex';
    case QUEUE_IDS.NORMAL_DRAFT: return 'Normal Draft';
    case QUEUE_IDS.NORMAL_BLIND: return 'Normal Blind';
    case QUEUE_IDS.ARAM: return 'ARAM';
    default:
      if (gameModeApi) {
        if (gameModeApi === 'CLASSIC') return 'Classic SR';
        return gameModeApi.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
      }
      return 'Unknown Mode';
  }
};

/**
 * Determines the Tailwind CSS text color class based on KDA.
 * @param {number} kills - Number of kills.
 * @param {number} deaths - Number of deaths.
 * @param {number} assists - Number of assists.
 * @returns {string} Tailwind CSS class string for text color.
 */
export const getKDAColorClass = (kills, deaths, assists) => {
  if (typeof kills !== 'number' || typeof deaths !== 'number' || typeof assists !== 'number') {
    return 'text-gray-400';
  }
  const kda = deaths === 0 ? (kills > 0 || assists > 0 ? (kills + assists) * 2 : 0) : (kills + assists) / deaths;

  if (deaths === 0 && (kills > 0 || assists > 0)) return 'text-yellow-400'; // Perfect KDA
  if (kda >= 5) return 'text-green-400';
  if (kda >= 3) return 'text-blue-400';
  if (kda >= 1.5) return 'text-sky-400';
  if (kda >= 0.75) return 'text-gray-400';
  return 'text-red-400';
};

/**
 * Generates JSX spans for KDA display.
 * @param {object} p - Participant data object.
 * @returns {JSX.Element} Spans for KDA.
 */
export const getKDAStringSpans = (p) => {
  if (!p || typeof p.kills === 'undefined') return <span className="text-gray-300">N/A</span>;
  return (
    <>
      <span className="text-gray-100 font-semibold">{p.kills}</span>
      <span className="text-gray-400"> / </span>
      <span className="text-red-400 font-semibold">{p.deaths}</span>
      <span className="text-gray-400"> / </span>
      <span className="text-gray-100 font-semibold">{p.assists}</span>
    </>
  );
};

/**
 * Calculates KDA ratio as a string.
 * @param {object} p - Participant data object.
 * @returns {string} KDA ratio string (e.g., "3.50", "Perfect").
 */
export const getKDARatio = (p) => {
  if (!p || typeof p.kills === 'undefined' || typeof p.deaths === 'undefined' || typeof p.assists === 'undefined') return '';
  if (p.deaths === 0) return (p.kills > 0 || p.assists > 0) ? 'Perfect' : '0.00';
  return ((p.kills + p.assists) / p.deaths).toFixed(2);
};

/**
 * Formats CS and CS/min string.
 * @param {object} p - Participant data object containing CS and gameDuration.
 * @returns {string} Formatted CS string (e.g., "CS 150 (7.5)").
 */
export const getCSString = (p) => {
  if (!p || typeof p.totalMinionsKilled === 'undefined' || typeof p.neutralMinionsKilled === 'undefined' || !p.gameDuration || p.gameDuration === 0) return 'CS N/A';
  const totalCS = p.totalMinionsKilled + p.neutralMinionsKilled;
  const csPerMin = (totalCS / (p.gameDuration / 60)).toFixed(1);
  return `CS ${totalCS} (${csPerMin})`;
};

/**
 * Processes timeline data for a specific player and their opponent.
 * Extracts laning phase stats, skill order, and build order.
 * @param {Array<object>} timelineFrames - Array of frame data from Riot API.
 * @param {number} targetParticipantId - The participant ID (1-10) of the player for whom to process data.
 * @param {number|null} opponentParticipantIdForLaning - The participant ID (1-10) of the opponent for laning comparison, or null.
 * @param {number} gameDurationSeconds - Total game duration in seconds.
 * @returns {object} Processed timeline data including snapshots, skill/build orders.
 */
export const processTimelineData = (timelineFrames, targetParticipantId, opponentParticipantIdForLaning, gameDurationSeconds) => {
  const processedData = {
    snapshots: [],
    skillOrder: [], // Will be populated with { skillSlot, levelTakenAt, skillLevel, timestamp }
    buildOrder: [],
    // Laning phase specific data can be added here if needed later
  };

  if (!timelineFrames || timelineFrames.length === 0 || !targetParticipantId) return processedData;

  const snapshotMinutes = [5, 10, 15]; // Minutes for which to take snapshots
  const snapshotTimestampsMs = snapshotMinutes.map(min => min * 60 * 1000);
  const collectedRawSkillEvents = [];
  const collectedBuildEvents = [];


  for (const frame of timelineFrames) {
    const targetPlayerFrameData = frame.participantFrames?.[targetParticipantId.toString()];
    const opponentFrameData = opponentParticipantIdForLaning ? frame.participantFrames?.[opponentParticipantIdForLaning.toString()] : null;

    // Process snapshots
    if (targetPlayerFrameData) {
      snapshotTimestampsMs.forEach((snapshotTimeMs, index) => {
        // Check if this frame is the first one at or after the snapshot time and snapshot not yet taken
        if (frame.timestamp >= snapshotTimeMs && !processedData.snapshots.find(s => s.minute === snapshotMinutes[index])) {
          const snapshot = {
            minute: snapshotMinutes[index],
            player: {
              cs: (targetPlayerFrameData.minionsKilled || 0) + (targetPlayerFrameData.jungleMinionsKilled || 0),
              gold: targetPlayerFrameData.totalGold || 0,
              xp: targetPlayerFrameData.xp || 0,
              level: targetPlayerFrameData.level || 0,
            },
            opponent: null,
            diff: null,
          };
          if (opponentFrameData) {
            snapshot.opponent = {
              cs: (opponentFrameData.minionsKilled || 0) + (opponentFrameData.jungleMinionsKilled || 0),
              gold: opponentFrameData.totalGold || 0,
              xp: opponentFrameData.xp || 0,
              level: opponentFrameData.level || 0,
            };
            snapshot.diff = {
              cs: snapshot.player.cs - snapshot.opponent.cs,
              gold: snapshot.player.gold - snapshot.opponent.gold,
              xp: snapshot.player.xp - snapshot.opponent.xp,
            };
          }
          processedData.snapshots.push(snapshot);
        }
      });
    }

    // Collect all relevant events from the frame
    frame.events?.forEach(event => {
      if (event.participantId === targetParticipantId) {
        if (event.type === 'SKILL_LEVEL_UP' && event.levelUpType === 'NORMAL') {
          if (targetPlayerFrameData) { // Ensure we have player frame data to get their level
            collectedRawSkillEvents.push({
              championLevelAtEvent: targetPlayerFrameData.level, // Champion's level when event occurred
              skillSlot: event.skillSlot,
              timestamp: event.timestamp,
            });
          }
        } else if (event.type === 'ITEM_PURCHASED') {
          collectedBuildEvents.push({ itemId: event.itemId, timestamp: event.timestamp, type: 'purchased' });
        } else if (event.type === 'ITEM_SOLD') {
          collectedBuildEvents.push({ itemId: event.itemId, timestamp: event.timestamp, type: 'sold' });
        } else if (event.type === 'ITEM_UNDO') {
          // For UNDO, we need to find the last corresponding purchase/sell and remove it
          // This implementation is simplified: it assumes undo applies to the most recent action.
          // A more robust undo would track itemBefore and itemAfter.
          // For now, we'll add it and it can be filtered/handled during final build order processing if needed.
          collectedBuildEvents.push({
            itemId: event.itemBefore, // Item that was "undone"
            targetItemId: event.itemAfter, // Item that results from undo (often 0 if purchase undone)
            timestamp: event.timestamp,
            type: 'undo'
          });
        }
      }
    });
  }

  // Process collected skill events
  collectedRawSkillEvents.sort((a, b) => a.timestamp - b.timestamp); // Sort by time
  const skillPointsCount = { 1: 0, 2: 0, 3: 0, 4: 0 }; // Q, W, E, R
  collectedRawSkillEvents.forEach(event => {
    skillPointsCount[event.skillSlot]++;
    const maxPointsForSkill = event.skillSlot === 4 ? 3 : 5; // R max 3, others 5
    if (skillPointsCount[event.skillSlot] <= maxPointsForSkill) {
      processedData.skillOrder.push({
        skillSlot: event.skillSlot,
        levelTakenAt: event.championLevelAtEvent, // Champion level when skill point was assigned
        skillLevel: skillPointsCount[event.skillSlot],   // The new level of this specific skill (1st point, 2nd, etc.)
        timestamp: event.timestamp,
      });
    }
  });

  // Process collected build events (simple sort by timestamp for now)
  // A more complex undo logic might be needed for perfect accuracy if ITEM_UNDO is frequent.
  processedData.buildOrder = collectedBuildEvents.sort((a, b) => a.timestamp - b.timestamp);
  // Filter out UNDO events for simplicity if they are problematic, or handle them properly
  // For now, we just sort. A real undo handling would remove the undone purchase/sale.

  processedData.snapshots.sort((a, b) => a.minute - b.minute); // Ensure snapshots are sorted

  return processedData;
};
