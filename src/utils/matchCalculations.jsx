// src/utils/matchCalculations.js

export const QUEUE_IDS = {
  RANKED_SOLO: 420,
  FLEX_SR: 440,
  NORMAL_DRAFT: 400,
  NORMAL_BLIND: 430,
  ARAM: 450,
};

export const getContinentalRoute = (platformId) => {
  if (!platformId) return "europe";
  const lowerPlatformId = platformId.toLowerCase();
  if (["eun1", "euw1", "tr1", "ru"].includes(lowerPlatformId)) return "europe";
  if (["na1", "br1", "la1", "la2", "oc1", "americas"].includes(lowerPlatformId)) return "americas";
  if (["kr", "jp1", "asia"].includes(lowerPlatformId)) return "asia";
  if (["vn2", "th2", "tw2", "sg2", "ph2", "sea"].includes(lowerPlatformId)) return "sea";
  return "europe";
};

export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const timeAgo = (timestampSeconds) => {
  if (!timestampSeconds) return "";
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

export const formatGameDurationMMSS = (durationSeconds) => {
  if (typeof durationSeconds !== "number" || isNaN(durationSeconds) || durationSeconds < 0) return "N/A";
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = Math.floor(durationSeconds % 60);
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

export const formatGameMode = (gameModeApi, queueId) => {
  switch (queueId) {
    case QUEUE_IDS.RANKED_SOLO:
      return "Ranked Solo";
    case QUEUE_IDS.FLEX_SR:
      return "Ranked Flex";
    case QUEUE_IDS.NORMAL_DRAFT:
      return "Normal Draft";
    case QUEUE_IDS.NORMAL_BLIND:
      return "Normal Blind";
    case QUEUE_IDS.ARAM:
      return "ARAM";
    default:
      if (gameModeApi) {
        if (gameModeApi === "CLASSIC") return "Classic SR";
        return gameModeApi
          .split("_")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(" ");
      }
      return "Unknown Mode";
  }
};

export const getKDAColorClass = (kills, deaths, assists) => {
  if (typeof kills !== "number" || typeof deaths !== "number" || typeof assists !== "number") {
    return "text-gray-400";
  }
  const kda = deaths === 0 ? (kills > 0 || assists > 0 ? (kills + assists) * 2 : 0) : (kills + assists) / deaths;

  if (deaths === 0 && (kills > 0 || assists > 0)) return "text-yellow-400";
  if (kda >= 5) return "text-green-400";
  if (kda >= 3) return "text-blue-400";
  if (kda >= 1.5) return "text-sky-400";
  if (kda >= 0.75) return "text-gray-400";
  return "text-red-400";
};

export const getKDAStringSpans = (p) => {
  if (!p || typeof p.kills === "undefined") return <span className="text-gray-300">N/A</span>;
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

export const getKDARatio = (p) => {
  if (!p || typeof p.kills === "undefined" || typeof p.deaths === "undefined" || typeof p.assists === "undefined") return "";
  if (p.deaths === 0) return p.kills > 0 || p.assists > 0 ? "Perfect" : "0.00";
  return ((p.kills + p.assists) / p.deaths).toFixed(2);
};

export const getCSString = (p) => {
  if (!p || typeof p.totalMinionsKilled === "undefined" || typeof p.neutralMinionsKilled === "undefined" || !p.gameDuration || p.gameDuration === 0) return "CS N/A";
  const totalCS = p.totalMinionsKilled + p.neutralMinionsKilled;
  const csPerMin = (totalCS / (p.gameDuration / 60)).toFixed(1);
  return `CS ${totalCS} (${csPerMin})`;
};

export const calculateKPDiffAgainstOpponent = (match) => {
  if (!match || !match.allParticipants || !match.teamObjectives) {
    return null;
  }

  const player = match.allParticipants.find((p) => p.puuid === match.puuid);
  const opponent = match.allParticipants.find((p) => p.teamId !== player?.teamId && p.teamPosition === player?.teamPosition);

  // Return null if we can't find a player or a direct opponent
  if (!player || !opponent) {
    return null;
  }

  const playerTeamData = match.teamObjectives.find((t) => t.teamId === player.teamId);
  const opponentTeamData = match.teamObjectives.find((t) => t.teamId === opponent.teamId);

  const playerTeamKills = playerTeamData?.objectives?.champion?.kills || 0;
  const opponentTeamKills = opponentTeamData?.objectives?.champion?.kills || 0;

  // If either team has 0 kills, a KP% comparison is not meaningful.
  if (playerTeamKills === 0 || opponentTeamKills === 0) {
    return null;
  }

  const playerKP = ((player.kills + player.assists) / playerTeamKills) * 100;
  const opponentKP = ((opponent.kills + opponent.assists) / opponentTeamKills) * 100;

  return playerKP - opponentKP;
};

export const processTimelineData = (timelineFrames, targetParticipantId, opponentParticipantIdForLaning, gameDurationSeconds) => {
  const processedData = {
    snapshots: [],
    skillOrder: [],
    buildOrder: [],
  };

  if (!timelineFrames || timelineFrames.length === 0 || !targetParticipantId) return processedData;

  const snapshotMinutes = [5, 10, 14];
  const snapshotTimestampsMs = snapshotMinutes.map((min) => min * 60 * 1000);

  let collectedItemEventsWithOriginalIndex = []; // Stores ITEM_PURCHASED, ITEM_SOLD, ITEM_UNDO with an original index
  const collectedRawSkillEventsForProcessing = []; // For skill order, also with original index for stable sort

  let originalEventCounter = 0; // Counter to assign a unique original index to each event

  // First pass: Collect all relevant events and snapshot data
  for (const frame of timelineFrames) {
    const targetPlayerFrameData = frame.participantFrames?.[targetParticipantId.toString()];
    const opponentFrameData = opponentParticipantIdForLaning ? frame.participantFrames?.[opponentParticipantIdForLaning.toString()] : null;

    if (targetPlayerFrameData) {
      snapshotTimestampsMs.forEach((snapshotTimeMs, index) => {
        if (frame.timestamp >= snapshotTimeMs && !processedData.snapshots.find((s) => s.minute === snapshotMinutes[index])) {
          const snapshot = {
            minute: snapshotMinutes[index],
            player: {
              cs: (targetPlayerFrameData.minionsKilled || 0) + (targetPlayerFrameData.jungleMinionsKilled || 0),
              gold: targetPlayerFrameData.totalGold || 0,
              xp: targetPlayerFrameData.xp || 0,
              damage: targetPlayerFrameData.damageStats?.totalDamageDoneToChampions || 0, // <-- MODIFIED
            },
            opponent: null,
            diff: null,
          };
          if (opponentFrameData) {
            snapshot.opponent = {
              cs: (opponentFrameData.minionsKilled || 0) + (opponentFrameData.jungleMinionsKilled || 0),
              gold: opponentFrameData.totalGold || 0,
              xp: opponentFrameData.xp || 0,
              damage: opponentFrameData.damageStats?.totalDamageDoneToChampions || 0, // <-- MODIFIED
            };
            snapshot.diff = {
              cs: snapshot.player.cs - snapshot.opponent.cs,
              gold: snapshot.player.gold - snapshot.opponent.gold,
              xp: snapshot.player.xp - snapshot.opponent.xp,
              damage: snapshot.player.damage - snapshot.opponent.damage, // <-- MODIFIED
            };
          }
          processedData.snapshots.push(snapshot);
        }
      });
    }
    // Collect skill and item events for the target player, assigning an original index
    frame.events?.forEach((event) => {
      if (event.participantId === targetParticipantId) {
        if (["ITEM_PURCHASED", "ITEM_SOLD", "ITEM_UNDO"].includes(event.type)) {
          collectedItemEventsWithOriginalIndex.push({ ...event, originalIndex: originalEventCounter++ });
        }
        if (event.type === "SKILL_LEVEL_UP" && event.levelUpType === "NORMAL") {
          collectedRawSkillEventsForProcessing.push({
            skillSlot: event.skillSlot,
            timestamp: event.timestamp,
            originalIndex: originalEventCounter++, // Assign original index
          });
        }
      }
    });
  }
  collectedItemEventsWithOriginalIndex.sort((a, b) => {
    if (a.timestamp === b.timestamp) {
      return a.originalIndex - b.originalIndex;
    }
    return a.timestamp - b.timestamp;
  });
  // Process item events to handle undos
  // This list will store purchase/sell events, with an 'undone' flag.
  const tempBuildEvents = [];
  for (const event of collectedItemEventsWithOriginalIndex) {
    if (event.type === "ITEM_UNDO") {
      // Handle undo of a purchase: itemAfter is 0, itemBefore is the ID of the item purchased.
      if (event.itemAfter === 0 && event.itemBefore !== 0) {
        // Search backwards in tempBuildEvents for the most recent purchase of this item that isn't already undone.
        for (let i = tempBuildEvents.length - 1; i >= 0; i--) {
          if (tempBuildEvents[i].type === "purchased" && tempBuildEvents[i].itemId === event.itemBefore && !tempBuildEvents[i].undone) {
            tempBuildEvents[i].undone = true; // Mark the original purchase as undone
            break; // Stop after undoing the most recent relevant purchase
          }
        }
      }
      // Handle undo of a sell: itemBefore is 0, itemAfter is the ID of the item sold (and now back in inventory).
      else if (event.itemBefore === 0 && event.itemAfter !== 0) {
        // Search backwards for the most recent sell of this item that isn't already undone.
        for (let i = tempBuildEvents.length - 1; i >= 0; i--) {
          if (tempBuildEvents[i].type === "sold" && tempBuildEvents[i].itemId === event.itemAfter && !tempBuildEvents[i].undone) {
            tempBuildEvents[i].undone = true; // Mark the original sell as undone
            break; // Stop after undoing the most recent relevant sell
          }
        }
      }
      // ITEM_UNDO events themselves are not added to the displayable buildOrder.
    } else if (event.type === "ITEM_PURCHASED") {
      tempBuildEvents.push({ itemId: event.itemId, timestamp: event.timestamp, type: "purchased", undone: false });
    } else if (event.type === "ITEM_SOLD") {
      tempBuildEvents.push({ itemId: event.itemId, timestamp: event.timestamp, type: "sold", undone: false });
    }
  }
  // Filter out events that were marked as undone to get the final build order.
  processedData.buildOrder = tempBuildEvents.filter((event) => !event.undone);

  // Process Skill Order
  // Sort skill events by timestamp, then by original index for stability if timestamps are identical.
  collectedRawSkillEventsForProcessing.sort((a, b) => {
    if (a.timestamp === b.timestamp) {
      return a.originalIndex - b.originalIndex;
    }
    return a.timestamp - b.timestamp;
  });

  const skillPointsCount = { 1: 0, 2: 0, 3: 0, 4: 0 }; // Q, W, E, R
  let championLevelForSkillAssignment = 1; // Start assigning skills from champion level 1

  for (const skillEvent of collectedRawSkillEventsForProcessing) {
    if (championLevelForSkillAssignment > 18) break; // Max 18 skill points normally

    skillPointsCount[skillEvent.skillSlot]++;
    const maxPointsForSkill = skillEvent.skillSlot === 4 ? 3 : 5; // R max 3, others 5

    // Check if leveling this skill would exceed its max points
    if (skillPointsCount[skillEvent.skillSlot] <= maxPointsForSkill) {
      processedData.skillOrder.push({
        skillSlot: skillEvent.skillSlot,
        levelTakenAt: championLevelForSkillAssignment, // Assign to the current sequential champion level
        skillLevel: skillPointsCount[skillEvent.skillSlot], // The new level of this specific skill
        timestamp: skillEvent.timestamp, // Keep original timestamp for reference
      });
      championLevelForSkillAssignment++; // Move to the next champion level for the next skill point
    } else {
      // If skill is already maxed, this event might be an anomaly.
      skillPointsCount[skillEvent.skillSlot]--; // Decrement count as this point isn't "spent"
    }
  }
  // Sort final skill order by levelTakenAt, then timestamp (should already be mostly sorted by levelTakenAt)
  processedData.skillOrder.sort((a, b) => {
    if (a.levelTakenAt === b.levelTakenAt) {
      return a.timestamp - b.timestamp; // Secondary sort by timestamp if levels are the same
    }
    return a.levelTakenAt - b.levelTakenAt;
  });

  // Sort snapshots by minute
  processedData.snapshots.sort((a, b) => a.minute - b.minute);

  return processedData;
};

/**
 * @typedef {object} SummaryStats
 * @property {number} winRate
 * @property {number} csPerMin
 * @property {number} csDiff14
 * @property {number} goldPerMin
 * @property {number} goldDiff14
 * @property {number} damageDiff14 - *** NEW ***
 * @property {number} goldPercentOfTeam
 * @property {number} damagePerMin
 * @property {number} damagePercentOfTeam
 * @property {number} visionPerMin
 * @property {number} avgWardsKilled
 * @property {number} avgWardsPlaced
 * @property {number} killParticipation
 * @property {number} avgDmgToTowers
 * @property {number} avgKpDiff
 */

export const calculateSummaryStatsForPeriod = (matches, startDate, endDate) => {
  const filteredMatches = matches.filter((m) => m.gameCreation >= startDate && m.gameCreation < endDate);
  if (filteredMatches.length === 0) {
    // Return a structure with all keys but with zero values to prevent UI errors
    return {
      totalGames: 0,
      winRate: 0,
      kdaRatio: 0,
      avgKills: 0,
      avgDeaths: 0,
      avgAssists: 0,
      killParticipation: 0,
      damagePercentOfTeam: 0,
      damagePerMin: 0,
      avgDamageDealt: 0,
      visionPerMin: 0,
      avgVisionScore: 0,
      csPerMin: 0,
      avgCs: 0,
      goldPerMin: 0,
      avgGold: 0,
      avgControlWardsBought: 0,
      csDiff14: 0,
      goldDiff14: 0,
      damageDiff14: 0,
      avgDmgToTowers: 0,
      avgWardsPlaced: 0,
      avgWardsKilled: 0,
      avgKpDiff: 0,
      damagePerGold: 0,
    };
  }
  const totalGames = filteredMatches.length;

  const initialTotals = {
    wins: 0,
    duration: 0,
    totalKills: 0,
    totalDeaths: 0,
    totalAssists: 0,
    playerKillsAndAssists: 0,
    totalTeamKills: 0,
    playerDamage: 0,
    totalTeamDamage: 0,
    visionScore: 0,
    totalCS: 0,
    playerGold: 0,
    controlWardsBought: 0,
    csDiff14: 0,
    goldDiff14: 0,
    damageDiff14: 0,
    gamesWithTimeline: 0,
    damageToTowers: 0,
    wardsPlaced: 0,
    wardsKilled: 0,
    totalKpDiff: 0,
    gamesWithKpDiff: 0,
  };

  const totals = filteredMatches.reduce((acc, match) => {
    const player = match.allParticipants.find((p) => p.puuid === match.puuid);
    if (!player) {
      return acc;
    }

    acc.wins += match.win ? 1 : 0;
    acc.duration += match.gameDuration || 0;

    // Accumulate K/D/A
    acc.totalKills += player.kills || 0;
    acc.totalDeaths += player.deaths || 0;
    acc.totalAssists += player.assists || 0;

    // For KP and KDA ratio
    acc.playerKillsAndAssists += (player.kills || 0) + (player.assists || 0);

    // Accumulate Damage
    acc.playerDamage += player.totalDamageDealtToChampions || 0;
    const teamDamage = match.allParticipants.filter((p) => p.teamId === player.teamId).reduce((sum, p) => sum + (p.totalDamageDealtToChampions || 0), 0);
    acc.totalTeamDamage += teamDamage;

    // Accumulate CS
    acc.totalCS += (player.totalMinionsKilled || 0) + (player.neutralMinionsKilled || 0);

    // Accumulate Gold
    acc.playerGold += player.goldEarned || 0;

    // Accumulate Vision
    acc.visionScore += player.visionScore || 0;
    acc.controlWardsBought += player.visionWardsBoughtInGame || 0;
    acc.wardsPlaced += player.wardsPlaced || 0;
    acc.wardsKilled += player.wardsKilled || 0;

    // Other stats
    const teamKills = match.teamObjectives?.find((t) => t.teamId === player.teamId)?.objectives.champion.kills || 0;
    acc.totalTeamKills += teamKills;
    acc.damageToTowers += player.damageDealtToTurrets || 0;

    const snapshot14 = match.processedTimelineForTrackedPlayer?.snapshots?.find((s) => s.minute === 14);
    if (snapshot14?.diff) {
      acc.csDiff14 += snapshot14.diff.cs || 0;
      acc.goldDiff14 += snapshot14.diff.gold || 0;
      acc.damageDiff14 += snapshot14.diff.damage || 0;
      acc.gamesWithTimeline += 1;
    }

    const kpDiff = calculateKPDiffAgainstOpponent(match);
    if (kpDiff !== null) {
      acc.totalKpDiff += kpDiff;
      acc.gamesWithKpDiff += 1;
    }

    return acc;
  }, initialTotals);

  const totalMinutes = totals.duration / 60;

  return {
    totalGames: totalGames,
    winRate: (totals.wins / totalGames) * 100,
    kdaRatio: totals.totalDeaths > 0 ? totals.playerKillsAndAssists / totals.totalDeaths : totals.playerKillsAndAssists,
    avgKills: totals.totalKills / totalGames,
    avgDeaths: totals.totalDeaths / totalGames,
    avgAssists: totals.totalAssists / totalGames,
    killParticipation: totals.totalTeamKills > 0 ? (totals.playerKillsAndAssists / totals.totalTeamKills) * 100 : 0,
    damagePercentOfTeam: totals.totalTeamDamage > 0 ? (totals.playerDamage / totals.totalTeamDamage) * 100 : 0,
    damagePerMin: totalMinutes > 0 ? totals.playerDamage / totalMinutes : 0,
    avgDamageDealt: totals.playerDamage / totalGames,
    visionPerMin: totalMinutes > 0 ? totals.visionScore / totalMinutes : 0,
    avgVisionScore: totals.visionScore / totalGames,
    csPerMin: totalMinutes > 0 ? totals.totalCS / totalMinutes : 0,
    avgCs: totals.totalCS / totalGames,
    goldPerMin: totalMinutes > 0 ? totals.playerGold / totalMinutes : 0,
    avgGold: totals.playerGold / totalGames,
    avgControlWardsBought: totals.controlWardsBought / totalGames,
    csDiff14: totals.gamesWithTimeline > 0 ? totals.csDiff14 / totals.gamesWithTimeline : 0,
    goldDiff14: totals.gamesWithTimeline > 0 ? totals.goldDiff14 / totals.gamesWithTimeline : 0,
    damageDiff14: totals.gamesWithTimeline > 0 ? totals.damageDiff14 / totals.gamesWithTimeline : 0,
    avgDmgToTowers: totals.damageToTowers / totalGames,
    avgWardsPlaced: totals.wardsPlaced / totalGames,
    avgWardsKilled: totals.wardsKilled / totalGames,
    avgKpDiff: totals.gamesWithKpDiff > 0 ? totals.totalKpDiff / totals.gamesWithKpDiff : 0,
    damagePerGold: totals.playerGold > 0 ? totals.playerDamage / totals.playerGold : 0,
  };
};