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
    if (['na1', 'br1', 'la1', 'la2', 'oc1', 'americas'].includes(lowerPlatformId)) return 'americas'; // Added 'americas' for safety
    if (['kr', 'jp1', 'asia'].includes(lowerPlatformId)) return 'asia'; // Added 'asia' for safety
    if (['vn2', 'th2', 'tw2', 'sg2', 'ph2', 'sea'].includes(lowerPlatformId)) return 'sea'; // Added 'sea' for safety
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
    if (typeof durationSeconds !== 'number' || isNaN(durationSeconds)) return 'N/A';
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = durationSeconds % 60;
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
      // Add more cases as needed
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
   * @param {Array<object>} timelineFrames - Array of frame data from Riot API.
   * @param {number} playerParticipantId - The participant ID of the tracked player.
   * @param {number|null} opponentParticipantId - The participant ID of the opponent, or null.
   * @param {number} gameDurationSeconds - Total game duration in seconds.
   * @returns {object} Processed timeline data.
   */
  export const processTimelineData = (timelineFrames, playerParticipantId, opponentParticipantId, gameDurationSeconds) => {
    const processedData = {
      snapshots: [], // For CS, gold, XP at specific times
      skillOrder: [],
      buildOrder: [],
      firstLevel2Time: null,
    };
  
    if (!timelineFrames || timelineFrames.length === 0) return processedData;
  
    // Define snapshot times in minutes
    const snapshotMinutes = [5, 10, 15];
    const snapshotTimestampsMs = snapshotMinutes.map(min => min * 60 * 1000);
  
    let lastPlayerLevel = 0;
  
    timelineFrames.forEach((frame, frameIndex) => {
      const playerFrame = frame.participantFrames?.[playerParticipantId.toString()];
      const opponentFrame = opponentParticipantId ? frame.participantFrames?.[opponentParticipantId.toString()] : null;
  
      if (playerFrame) {
        // Snapshots
        snapshotTimestampsMs.forEach((snapshotTimeMs, index) => {
          // Check if this is the first frame at or after the snapshot time
          // and if we haven't already taken this snapshot
          if (frame.timestamp >= snapshotTimeMs && !processedData.snapshots.find(s => s.minute === snapshotMinutes[index])) {
            const snapshot = {
              minute: snapshotMinutes[index],
              player: {
                cs: playerFrame.minionsKilled + (playerFrame.jungleMinionsKilled || 0),
                gold: playerFrame.totalGold,
                xp: playerFrame.xp,
                level: playerFrame.level,
              },
              opponent: opponentFrame ? {
                cs: opponentFrame.minionsKilled + (opponentFrame.jungleMinionsKilled || 0),
                gold: opponentFrame.totalGold,
                xp: opponentFrame.xp,
                level: opponentFrame.level,
              } : null,
            };
            if (snapshot.opponent) {
              snapshot.diff = {
                cs: snapshot.player.cs - snapshot.opponent.cs,
                gold: snapshot.player.gold - snapshot.opponent.gold,
                xp: snapshot.player.xp - snapshot.opponent.xp,
              };
            }
            processedData.snapshots.push(snapshot);
          }
        });
  
        // First Level 2
        if (!processedData.firstLevel2Time && playerFrame.level === 2) {
          processedData.firstLevel2Time = frame.timestamp;
        }
  
        // Skill Order (only if level increased)
        if (playerFrame.level > lastPlayerLevel) {
          // Find SKILL_LEVEL_UP events for the player in this frame's events
          frame.events?.forEach(event => {
            if (event.type === 'SKILL_LEVEL_UP' && event.participantId === playerParticipantId && event.levelUpType === 'NORMAL') {
              // Ensure we don't add duplicate skill-ups for the same level if events span frames
              if (processedData.skillOrder.length < playerFrame.level) {
                   processedData.skillOrder.push({ level: playerFrame.level, skillSlot: event.skillSlot, timestamp: event.timestamp });
              }
            }
          });
          lastPlayerLevel = playerFrame.level;
        }
      }
  
      // Build Order
      frame.events?.forEach(event => {
        if (event.type === 'ITEM_PURCHASED' && event.participantId === playerParticipantId) {
          processedData.buildOrder.push({ itemId: event.itemId, timestamp: event.timestamp });
        }
        // Could also track ITEM_SOLD, ITEM_UNDO if needed
      });
    });
    
    // Sort build order by timestamp
    processedData.buildOrder.sort((a, b) => a.timestamp - b.timestamp);
    // Sort skill order by level then timestamp (though level should be sufficient if processed correctly)
    processedData.skillOrder.sort((a,b) => a.level - b.level || a.timestamp - b.timestamp);
  
  
    return processedData;
  };
  