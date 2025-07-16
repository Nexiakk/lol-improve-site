// src/components/ExpandedMatchDetails.jsx
import React, { useState, useEffect, useMemo } from "react";
import { ImageOff, ChevronRight, X, LayoutList, PieChart, Loader2 } from "lucide-react";
import { formatGameDurationMMSS, getKDAColorClass, getKDAStringSpans } from "../utils/matchCalculations";
import RuneDisplay from "./common/RuneDisplay";
import { GrubIcon, DragonIcon, BaronIcon, HeraldIcon, ElderDragonIcon, TowerIcon, LaningPhaseIcon, WardsIcon, GlobalStatsIcon } from "./icons/MatchIcons";

// --- RANK ICON IMPORTS ---
import IRON_SMALL from "../assets/ranks/IRON_SMALL.webp";
import BRONZE_SMALL from "../assets/ranks/BRONZE_SMALL.webp";
import SILVER_SMALL from "../assets/ranks/SILVER_SMALL.webp";
import GOLD_SMALL from "../assets/ranks/GOLD_SMALL.webp";
import PLATINUM_SMALL from "../assets/ranks/PLATINUM_SMALL.webp";
import EMERALD_SMALL from "../assets/ranks/EMERALD_SMALL.webp";
import DIAMOND_SMALL from "../assets/ranks/DIAMOND_SMALL.webp";
import MASTER_SMALL from "../assets/ranks/MASTER_SMALL.webp";
import GRANDMASTER_SMALL from "../assets/ranks/GRANDMASTER_SMALL.webp";
import CHALLENGER_SMALL from "../assets/ranks/CHALLENGER_SMALL.webp";

const rankIconMap = {
  IRON: IRON_SMALL,
  BRONZE: BRONZE_SMALL,
  SILVER: SILVER_SMALL,
  GOLD: GOLD_SMALL,
  PLATINUM: PLATINUM_SMALL,
  EMERALD: EMERALD_SMALL,
  DIAMOND: DIAMOND_SMALL,
  MASTER: MASTER_SMALL,
  GRANDMASTER: GRANDMASTER_SMALL,
  CHALLENGER: CHALLENGER_SMALL,
};

// --- RANK DISPLAY HELPER COMPONENT ---
const RankDisplay = ({ rankInfo }) => {
  // 1. Handle Unranked case
  if (!rankInfo || !rankInfo.tier || rankInfo.tier === "UNRANKED") {
    return <span className="text-gray-500 text-[10px]">Unranked</span>;
  }

  const { tier, rank, leaguePoints } = rankInfo;
  const highTiers = ["MASTER", "GRANDMASTER", "CHALLENGER"];
  const isHighTier = highTiers.includes(tier.toUpperCase());

  const iconSrc = rankIconMap[tier.toUpperCase()];
  const tooltipText = isHighTier ? `${tier} ${leaguePoints} LP` : `${tier} ${rank}`;

  // 2. Fallback to text if an icon is missing for an unexpected new rank
  if (!iconSrc) {
    return <span className="text-gray-400 text-[10px] capitalize">{tooltipText}</span>;
  }

  // 3. Render icon and conditional text
  return (
    <div className="flex items-center" title={tooltipText}>
      <img src={iconSrc} alt={tooltipText} className="h-5 w-5" />
      {isHighTier && <span className="text-gray-300 text-[10px] font-semibold ml-1.5">{leaguePoints} LP</span>}
    </div>
  );
};

// --- SKILL ICON LOGIC ---
const SKILL_PLACEHOLDER_TEXT = {
  1: "Q",
  2: "W",
  3: "E",
  4: "R",
};

const SKILL_ROW_ACTIVE_COLORS = {
  1: "bg-blue-500/80 text-white",
  2: "bg-orange-500/80 text-white",
  3: "bg-purple-500/80 text-white",
  4: "bg-rose-500/80 text-white",
};

const getSkillIconUrl = (ddragonVersion, championDdragonId, skillSlot) => {
  if (!ddragonVersion || !championDdragonId || !skillSlot) return null;
  const skillKeyChar = SKILL_PLACEHOLDER_TEXT[skillSlot]?.toLowerCase();
  if (!skillKeyChar) return null;
  return `https://cdn.communitydragon.org/latest/champion/${championDdragonId}/ability-icon/${skillKeyChar}`;
};

const SkillIconDisplay = ({ ddragonVersion, championDdragonId, skillSlotKey }) => {
  const [imgError, setImgError] = useState(false);
  const skillIconUrl = getSkillIconUrl(ddragonVersion, championDdragonId, skillSlotKey);
  const skillAltText = SKILL_PLACEHOLDER_TEXT[skillSlotKey] || "?";

  useEffect(() => {
    setImgError(false);
  }, [skillIconUrl]);

  if (!skillIconUrl || imgError) {
    return <span className="text-xs font-semibold text-gray-400">{skillAltText}</span>;
  }

  return <img src={skillIconUrl} alt={skillAltText} className="w-full h-full object-contain" onError={() => setImgError(true)} />;
};
// --- END SKILL ICON LOGIC ---

// Component for expanded match details
const ExpandedMatchDetails = ({ match, ddragonVersion, championData, summonerSpellsMap, runesMap, runesDataFromDDragon, getChampionImage, getSummonerSpellImage, getItemImage, getRuneImage, getChampionDisplayName, isTrackedPlayerWin, roleIconMap, roleOrder, processTimelineDataForPlayer }) => {
  const [activeTab, setActiveTab] = useState("General");
  const [selectedPlayerForDetailsPuuid, setSelectedPlayerForDetailsPuuid] = useState(match.puuid);
  const [currentSelectedPlayerTimeline, setCurrentSelectedPlayerTimeline] = useState(null);

  const { allParticipants = [], teamObjectives = [], gameDuration, puuid: trackedPlayerPuuid, processedTimelineForTrackedPlayer, rawTimelineFrames, matchId } = match;

  useEffect(() => {
    setSelectedPlayerForDetailsPuuid(trackedPlayerPuuid);
    setCurrentSelectedPlayerTimeline(processedTimelineForTrackedPlayer || null);
    setActiveTab("General");
  }, [matchId, trackedPlayerPuuid, processedTimelineForTrackedPlayer]);

  useEffect(() => {
    if (activeTab !== "Details") return;

    if (selectedPlayerForDetailsPuuid === trackedPlayerPuuid) {
      setCurrentSelectedPlayerTimeline(processedTimelineForTrackedPlayer || null);
    } else if (rawTimelineFrames && processTimelineDataForPlayer && selectedPlayerForDetailsPuuid && allParticipants.length > 0) {
      const selectedParticipant = allParticipants.find((p) => p.puuid === selectedPlayerForDetailsPuuid);
      if (selectedParticipant) {
        const targetParticipantId = allParticipants.findIndex((p) => p.puuid === selectedParticipant.puuid) + 1;

        let opponentForSelected = null;
        let opponentIdForSelectedTimeline = null;
        if (selectedParticipant.teamPosition && selectedParticipant.teamPosition !== "") {
          opponentForSelected = allParticipants.find((p) => p.teamId !== selectedParticipant.teamId && p.teamPosition === selectedParticipant.teamPosition);
        }
        if (opponentForSelected) {
          opponentIdForSelectedTimeline = allParticipants.findIndex((p) => p.puuid === opponentForSelected.puuid) + 1;
        }

        if (targetParticipantId > 0) {
          const timeline = processTimelineDataForPlayer(rawTimelineFrames, targetParticipantId, opponentIdForSelectedTimeline, gameDuration);
          setCurrentSelectedPlayerTimeline(timeline);
        } else {
          setCurrentSelectedPlayerTimeline(null);
        }
      } else {
        setCurrentSelectedPlayerTimeline(null);
      }
    } else {
      setCurrentSelectedPlayerTimeline(null);
    }
  }, [selectedPlayerForDetailsPuuid, activeTab, rawTimelineFrames, processTimelineDataForPlayer, allParticipants, trackedPlayerPuuid, processedTimelineForTrackedPlayer, gameDuration]);

  const blueTeam = allParticipants.filter((p) => p.teamId === 100).sort((a, b) => roleOrder.indexOf(a.teamPosition?.toUpperCase()) - roleOrder.indexOf(b.teamPosition?.toUpperCase()));
  const redTeam = allParticipants.filter((p) => p.teamId === 200).sort((a, b) => roleOrder.indexOf(a.teamPosition?.toUpperCase()) - roleOrder.indexOf(b.teamPosition?.toUpperCase()));

  const blueTeamData = teamObjectives.find((t) => t.teamId === 100) || { objectives: {}, win: false };
  const redTeamData = teamObjectives.find((t) => t.teamId === 200) || { objectives: {}, win: false };

  const maxDamageInGame = Math.max(...allParticipants.map((p) => p.totalDamageDealtToChampions || 0), 0);
  const maxDamageBlueTeam = Math.max(0, ...blueTeam.map((p) => p.totalDamageDealtToChampions || 0));
  const maxDamageRedTeam = Math.max(0, ...redTeam.map((p) => p.totalDamageDealtToChampions || 0));

  const gamePatch = useMemo(() => {
    if (match.gamePatchVersion && match.gamePatchVersion !== "N/A") {
      return match.gamePatchVersion;
    }
    if (ddragonVersion) {
      const parts = ddragonVersion.split(".");
      if (parts.length >= 2) {
        return `${parts[0]}.${parts[1]}`;
      }
      return ddragonVersion;
    }
    return "N/A";
  }, [match.gamePatchVersion, ddragonVersion]);

  const renderPlayerRow = (player, teamTotalKills, isTopDamageInTeam, isTrackedPlayerRow) => {
    const items = [player.item0, player.item1, player.item2, player.item3, player.item4, player.item5];
    const trinket = player.item6;
    const kdaColor = getKDAColorClass(player.kills, player.deaths, player.assists);
    const kdaRatio = gameDuration > 0 ? (player.deaths === 0 ? (player.kills > 0 || player.assists > 0 ? "Perfect" : "0.00") : ((player.kills + player.assists) / player.deaths).toFixed(2)) : "0.00";
    const kp = teamTotalKills > 0 ? (((player.kills + player.assists) / teamTotalKills) * 100).toFixed(0) + "%" : "0%";
    const cs = (player.totalMinionsKilled || 0) + (player.neutralMinionsKilled || 0);
    const csPerMin = gameDuration > 0 ? (cs / (gameDuration / 60)).toFixed(1) : "0.0";
    const damageDealt = player.totalDamageDealtToChampions || 0;
    const damagePerMin = gameDuration > 0 ? (damageDealt / (gameDuration / 60)).toFixed(0) : "0";
    const damagePercentage = maxDamageInGame > 0 ? (damageDealt / maxDamageInGame) * 100 : 0;

    const playerPrimaryRune = player.perks?.styles?.find((s) => s.description === "primaryStyle")?.selections?.[0]?.perk;
    const playerSubStyle = player.perks?.styles?.find((s) => s.description === "subStyle")?.style;
    const roleIcon = roleIconMap[player.teamPosition?.toUpperCase()];

    const damageTextColorClass = isTopDamageInTeam ? "text-white font-semibold" : "text-gray-200";
    const damageBarColorClass = isTopDamageInTeam ? (player.teamId === 100 ? "neon-bg-blue" : "neon-bg-red") : player.teamId === 100 ? "bg-blue-500" : "bg-red-500";

    const trackedPlayerClass = isTrackedPlayerRow ? "tracked-player-highlight" : "";

    const playerRankInfo = player.rankInfo;

    return (
      <div key={player.puuid || player.summonerName} className={`flex items-center gap-x-2 sm:gap-x-3 py-0.5 px-1 text-xs hover:bg-gray-700/10 transition-colors duration-150 ${trackedPlayerClass}`}>
        <div className="flex items-center space-x-1.5 w-[120px] sm:w-[140px] flex-shrink-0">
          <div className="relative w-9 h-9 flex-shrink-0">
            <img
              src={getChampionImage(player.championName)}
              alt={getChampionDisplayName(player.championName)}
              className="w-full h-full rounded-md border border-gray-600"
              onError={(e) => {
                e.target.src = `https://placehold.co/36x36/222/ccc?text=${player.championName ? player.championName.substring(0, 1) : "?"}`;
              }}
            />
            <span className="absolute -bottom-1 -right-1 bg-black bg-opacity-80 text-white text-[9px] px-1 rounded-sm leading-tight border border-gray-500/50">{player.champLevel}</span>
            {roleIcon && <img src={roleIcon} alt={player.teamPosition || "Role"} className="absolute -top-1 -left-1 w-4 h-4 p-0.5 bg-gray-800 rounded-full border border-gray-400/70 shadow-sm" />}
          </div>
          <div className="flex flex-col justify-center overflow-hidden">
            <span className="font-semibold text-gray-100 truncate" title={player.riotIdGameName ? `${player.riotIdGameName}#${player.riotIdTagline}` : player.summonerName}>
              {player.riotIdGameName || player.summonerName || "Player"}
            </span>
            <div className="h-5 flex items-center">
              <RankDisplay rankInfo={playerRankInfo} />
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-1 flex-shrink-0">
          <div className="flex flex-col space-y-0.5">
            <div className="w-5 h-5 bg-black/30 rounded border border-gray-600 flex items-center justify-center">
              <img src={getSummonerSpellImage(player.summoner1Id)} alt="S1" className="w-full h-full rounded-sm" onError={(e) => (e.target.style.display = "none")} />
            </div>
            <div className="w-5 h-5 bg-black/30 rounded border border-gray-600 flex items-center justify-center">
              <img src={getSummonerSpellImage(player.summoner2Id)} alt="S2" className="w-full h-full rounded-sm" onError={(e) => (e.target.style.display = "none")} />
            </div>
          </div>
          {/* Rune Display for Scoreboard - wrapped in a Popover */}
          <RuneDisplay perks={player.perks} runesDataFromDDragon={runesDataFromDDragon} runesMap={runesMap} getRuneImage={getRuneImage} layout="compact" size="md" popoverProps={{ trigger: "hover", placement: "top" }}>
            {/* Pass the small rune icons as children for the popover trigger */}
            <div className="flex flex-col space-y-0.5">
              <div className="w-5 h-5 bg-black/30 rounded flex items-center justify-center border border-gray-600">{playerPrimaryRune ? <img src={getRuneImage(playerPrimaryRune)} alt="R1" className="w-full h-full object-contain" onError={(e) => (e.target.style.display = "none")} /> : <div className="w-full h-full rounded-sm bg-gray-700/50 flex items-center justify-center text-xs text-gray-500">K?</div>}</div>
              <div className="w-5 h-5 bg-black/30 rounded border border-gray-600 flex items-center justify-center p-0.5">{playerSubStyle ? <img src={getRuneImage(playerSubStyle)} alt="R2" className="w-full h-full object-contain" onError={(e) => (e.target.style.display = "none")} /> : <div className="w-full h-full rounded-sm bg-gray-700/50 flex items-center justify-center text-xs text-gray-500">S?</div>}</div>
            </div>
          </RuneDisplay>

          <div className="flex flex-col space-y-0.5">
            <div className="flex space-x-0.5">
              {[items[0], items[1], items[2], trinket].map((item, idx) => (
                <div key={`item-top-${idx}-${player.puuid}`} className="w-5 h-5 bg-black/30 rounded border border-gray-600 flex items-center justify-center">
                  {item && item !== 0 ? <img src={getItemImage(item)} alt={`Item ${idx}`} className="w-full h-full rounded-sm" /> : <div className="w-4 h-4 bg-gray-700/50 rounded-sm"></div>}
                </div>
              ))}
            </div>
            <div className="flex space-x-0.5">
              {[items[3], items[4], items[5]].map((item, idx) => (
                <div key={`item-bot-${idx}-${player.puuid}`} className="w-5 h-5 bg-black/30 rounded border border-gray-600 flex items-center justify-center">
                  {item && item !== 0 ? <img src={getItemImage(item)} alt={`Item ${idx + 3}`} className="w-full h-full rounded-sm" /> : <div className="w-4 h-4 bg-gray-700/50 rounded-sm"></div>}
                </div>
              ))}
              <div className="w-5 h-5"></div>
            </div>
          </div>
        </div>

        <div className="flex flex-1 justify-around items-start gap-x-1 sm:gap-x-2 text-center min-w-0">
          <div className="flex flex-col items-center min-w-[55px] sm:min-w-[65px]">
            <span className="text-gray-100">{getKDAStringSpans(player)}</span>
            <div>
              <span className={`text-xs ${kdaColor}`}>{kdaRatio}</span>
              <span className="text-[10px] text-gray-300 ml-0.5 sm:ml-1">KDA</span>
            </div>
          </div>
          <div className="flex flex-col items-center min-w-[30px] sm:min-w-[35px]">
            <span className="text-gray-200">{kp}</span>
            <span className="text-[10px] text-gray-300">KP</span>
          </div>
          <div className="flex flex-col items-center min-w-[55px] sm:min-w-[65px]">
            <span className="text-gray-200">{cs}</span>
            <span className="text-[10px] text-gray-300">{csPerMin} CS/m</span>
          </div>
          <div className="flex flex-col items-center flex-grow min-w-[70px] sm:min-w-[90px] max-w-[120px]">
            <div className="flex justify-between w-full items-baseline">
              <span className={`${damageTextColorClass} text-[10px]`}>{damageDealt.toLocaleString()}</span>
              <span className="text-gray-300 text-[9px]">{damagePerMin} DPM</span>
            </div>
            <div className="h-1.5 bg-gray-500 rounded-full w-full overflow-hidden my-0.5">
              <div className={`h-full ${damageBarColorClass}`} style={{ width: `${damagePercentage}%` }}></div>
            </div>
          </div>
          <div className="flex flex-col items-center min-w-[50px] sm:min-w-[60px]">
            <span className="text-gray-200">{player.visionWardsBoughtInGame || 0}</span>
            <span className="text-[10px] text-gray-300">
              {player.wardsPlaced || 0}/{player.wardsKilled || 0}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderTeamSection = (team, teamData, teamName, teamMaxDamage) => {
    const totalKills = teamData?.objectives?.champion?.kills || 0;
    const teamSide = teamName === "Blue Team" ? "Blue Side" : "Red Side";
    const teamColorForText = teamName === "Blue Team" ? "text-blue-400" : "text-red-400";
    const objectiveIconSize = "w-5 h-5";

    return (
      <div className="px-2 sm:px-3 py-2 mb-0 rounded-md">
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center">
            <h3 className={`text-md sm:text-lg font-semibold ${teamColorForText}`}>
              {teamData.win ? "Victory" : "Defeat"}
              <span className="text-xs sm:text-sm text-gray-400 font-normal ml-1.5 mr-2 sm:mr-3">({teamSide})</span>
            </h3>
            <div className="flex space-x-1.5 sm:space-x-2 items-center text-xs">
              <span title="Voidgrubs" className="flex items-center">
                <GrubIcon className={`${objectiveIconSize} mr-0.5`} /> {teamData.objectives?.horde?.kills || 0}
              </span>
              <span title="Dragons" className="flex items-center">
                <DragonIcon className={`${objectiveIconSize} mr-0.5`} /> {teamData.objectives?.dragon?.kills || 0}
              </span>
              <span title="Barons" className="flex items-center">
                <BaronIcon className={`${objectiveIconSize} mr-0.5`} /> {teamData.objectives?.baron?.kills || 0}
              </span>
              <span title="Heralds" className="flex items-center">
                <HeraldIcon className={`${objectiveIconSize} mr-0.5`} /> {teamData.objectives?.riftHerald?.kills || 0}
              </span>
              {teamData.objectives?.elderDragon?.kills > 0 && (
                <span title="Elder Dragons" className="flex items-center">
                  <ElderDragonIcon className={`${objectiveIconSize} mr-0.5`} /> {teamData.objectives.elderDragon.kills || 0}
                </span>
              )}
              <span title="Towers" className="flex items-center">
                <TowerIcon className={`${objectiveIconSize} mr-0.5`} /> {teamData.objectives?.tower?.kills || 0}
              </span>
            </div>
          </div>
          {teamName === "Blue Team" && <span className="text-xs text-gray-500 ml-auto pl-2">v{gamePatch}</span>}
        </div>
        {team.map((player) => renderPlayerRow(player, totalKills, player.totalDamageDealtToChampions === teamMaxDamage && teamMaxDamage > 0, player.puuid === trackedPlayerPuuid))}
      </div>
    );
  };

  const GeneralTabContent = () => (
    <div className="space-y-3">
      {renderTeamSection(blueTeam, blueTeamData, "Blue Team", maxDamageBlueTeam)}
      {renderTeamSection(redTeam, redTeamData, "Red Team", maxDamageRedTeam)}
    </div>
  );

  // --- RUNES TAB CONTENT (kept for reference, but integrated into DetailsTabContent) ---
  const RunesTabContent = () => {
    const currentPlayer = allParticipants.find((p) => p.puuid === selectedPlayerForDetailsPuuid);
    if (!currentPlayer || !currentPlayer.perks || !runesDataFromDDragon || runesDataFromDDragon.length === 0) {
      return <p className="text-gray-400 p-4 text-center">Rune data not available for this player or DDragon data missing.</p>;
    }

    return (
      <div className="bg-gray-800/40 p-2 sm:p-3 rounded-lg border border-gray-700/50">
        <div className="flex justify-center">
          <RuneDisplay perks={currentPlayer.perks} runesDataFromDDragon={runesDataFromDDragon} runesMap={runesMap} getRuneImage={getRuneImage} layout="full" size="lg" />
        </div>
      </div>
    );
  };
  // --- END RUNES TAB CONTENT ---

  const DetailsTabContent = () => {
    const currentPlayerForDisplay = allParticipants.find((p) => p.puuid === selectedPlayerForDetailsPuuid);

    if (!currentPlayerForDisplay) return <p className="text-gray-400 p-4">Player data not found for selection.</p>;
    if (!currentSelectedPlayerTimeline && activeTab === "Details") {
      return <div className="p-4 text-center text-gray-400">Loading player details...</div>;
    }

    const timelineToDisplay = currentSelectedPlayerTimeline;
    const snapshot14min = timelineToDisplay?.snapshots?.find((s) => s.minute === 14);

    const StatItem = ({ value, label, title }) => (
      <div className="flex flex-col items-center text-center" title={title}>
        <span className="text-gray-100 font-medium text-sm">{value !== undefined && value !== null ? value : "N/A"}</span>
        <span className="text-gray-400 text-[10px] leading-tight">{label}</span>
      </div>
    );

    const renderChampionIconWithRole = (player) => {
      const roleIconSrc = roleIconMap[player.teamPosition?.toUpperCase()];
      const isSelected = player.puuid === selectedPlayerForDetailsPuuid;
      return (
        <button
          key={player.puuid}
          className={`relative w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 focus:outline-none transition-all duration-150 p-0.5
                                ${isSelected ? "bg-white/20 rounded-md scale-110 shadow-lg" : "opacity-75 hover:opacity-100"}`}
          title={`Show stats for ${getChampionDisplayName(player.championName)}`}
          onClick={() => setSelectedPlayerForDetailsPuuid(player.puuid)}
        >
          <img
            src={getChampionImage(player.championName)}
            alt={getChampionDisplayName(player.championName)}
            className="w-full h-full rounded-md border-2 border-gray-600"
            onError={(e) => {
              e.target.src = `https://placehold.co/48x48/222/ccc?text=${player.championName ? player.championName.substring(0, 1) : "?"}`;
            }}
          />
          {roleIconSrc && <img src={roleIconSrc} alt={player.teamPosition || "Role"} className="absolute -bottom-1 -left-1 w-4 h-4 p-0.5 bg-gray-900 rounded-full border border-gray-500" />}
        </button>
      );
    };

    const groupedBuildOrder =
      timelineToDisplay?.buildOrder?.reduce((acc, itemEvent) => {
        const minuteKey = Math.floor(itemEvent.timestamp / (1000 * 60));
        if (!acc[minuteKey]) {
          acc[minuteKey] = {
            items: [],
            firstTimestampMs: itemEvent.timestamp,
          };
        }
        acc[minuteKey].items.push(itemEvent);
        if (itemEvent.timestamp < acc[minuteKey].firstTimestampMs) {
          acc[minuteKey].firstTimestampMs = itemEvent.timestamp;
        }
        return acc;
      }, {}) || {};

    const skillLevelsByAbility = { 1: [], 2: [], 3: [], 4: [] };
    const currentPointsInSkill = { 1: 0, 2: 0, 3: 0, 4: 0 };

    if (timelineToDisplay?.skillOrder && Array.isArray(timelineToDisplay.skillOrder)) {
      const sortedSkillOrderEvents = [...timelineToDisplay.skillOrder].sort((a, b) => {
        if (a.levelTakenAt === b.levelTakenAt) {
          return a.timestamp - b.timestamp;
        }
        return a.levelTakenAt - b.levelTakenAt;
      });

      for (let champLvl = 1; champLvl <= 18; champLvl++) {
        const eventThisLevel = sortedSkillOrderEvents.find((event) => event.levelTakenAt === champLvl);

        if (eventThisLevel) {
          currentPointsInSkill[eventThisLevel.skillSlot] = eventThisLevel.skillLevel;
        }

        for (const slot of [1, 2, 3, 4]) {
          skillLevelsByAbility[slot][champLvl - 1] = currentPointsInSkill[slot] > 0 ? currentPointsInSkill[slot] : undefined;
        }
      }
    }

    // Prepare final build items, filtering out empty slots
    const finalBuildItemsRaw = [currentPlayerForDisplay.item0, currentPlayerForDisplay.item1, currentPlayerForDisplay.item2, currentPlayerForDisplay.item3, currentPlayerForDisplay.item4, currentPlayerForDisplay.item5];
    const finalBuildItemsFiltered = finalBuildItemsRaw.filter((itemId) => itemId && itemId !== 0);
    const finalTrinketItem = currentPlayerForDisplay.item6;

    return (
      <div className="p-2 sm:p-3 text-gray-200 space-y-3">
        {/* Player Selection */}
        <div className="flex items-center justify-center space-x-2 sm:space-x-5 mb-1 p-2 rounded-lg bg-gray-800/20">
          <div className="flex space-x-1 sm:space-x-3.5">{blueTeam.slice(0, 5).map((player) => renderChampionIconWithRole(player))}</div>
          <span className="text-gray-400 font-bold text-sm sm:text-md">VS</span>
          <div className="flex space-x-1 sm:space-x-3.5">{redTeam.slice(0, 5).map((player) => renderChampionIconWithRole(player))}</div>
        </div>

        {/* Stat Blocks */}
        <div className="grid grid-cols-1 md:grid-cols-8 gap-2 sm:gap-3">
          <div className="bg-gray-800/40 px-3 py-1.5 rounded-lg border border-gray-700/50 flex flex-col md:col-span-3">
            <h4 className="text-xs font-semibold uppercase text-gray-400 mb-1.5 text-center flex items-center justify-center">
              <LaningPhaseIcon className="w-4 h-4 mr-1.5" />
              Laning Phase (at 14 min)
            </h4>
            {timelineToDisplay && timelineToDisplay.snapshots && timelineToDisplay.snapshots.length > 0 && snapshot14min ? (
              <div className="grid grid-cols-4 gap-x-2 sm:gap-x-2.5 gap-y-1">
                <StatItem value={snapshot14min?.diff?.cs !== undefined ? (snapshot14min.diff.cs > 0 ? `+${snapshot14min.diff.cs}` : snapshot14min.diff.cs) : "N/A"} label="CS Diff" />
                <StatItem value={snapshot14min?.diff?.gold !== undefined ? (snapshot14min.diff.gold > 0 ? `+${snapshot14min.diff.gold.toLocaleString()}` : snapshot14min.diff.gold.toLocaleString()) : "N/A"} label="Gold Diff" />
                <StatItem value={snapshot14min?.diff?.xp !== undefined ? (snapshot14min.diff.xp > 0 ? `+${snapshot14min.diff.xp.toLocaleString()}` : snapshot14min.diff.xp.toLocaleString()) : "N/A"} label="XP Diff" />
                <StatItem value={snapshot14min?.diff?.damage !== undefined ? (snapshot14min.diff.damage > 0 ? `+${snapshot14min.diff.damage.toLocaleString()}` : snapshot14min.diff.damage.toLocaleString()) : "N/A"} label="Dmg Diff" />
              </div>
            ) : (
              <p className="text-gray-500 text-center text-sm italic py-2">Missing laning stats.</p>
            )}
          </div>

          <div className="bg-gray-800/40 px-3 py-1.5 rounded-lg border border-gray-700/50 flex flex-col md:col-span-2">
            <h4 className="text-xs font-semibold uppercase text-gray-400 mb-1.5 text-center flex items-center justify-center">
              <WardsIcon className="w-4 h-4 mr-1.5" />
              Vision
            </h4>
            <div className="grid grid-cols-3 gap-x-1.5 gap-y-1">
              <StatItem value={currentPlayerForDisplay.wardsPlaced || 0} label="Placed" />
              <StatItem value={currentPlayerForDisplay.wardsKilled || 0} label="Killed" />
              <StatItem value={currentPlayerForDisplay.visionWardsBoughtInGame || 0} label="Controls" />
            </div>
          </div>

          <div className="bg-gray-800/40 px-3 py-1.5 rounded-lg border border-gray-700/50 flex flex-col md:col-span-3">
            <h4 className="text-xs font-semibold uppercase text-gray-400 mb-1.5 text-center flex items-center justify-center">
              <GlobalStatsIcon className="w-4 h-4 mr-1.5" />
              Performance
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-2 sm:gap-x-2.5 gap-y-1">
              <StatItem value={gameDuration > 0 ? (((currentPlayerForDisplay.totalMinionsKilled || 0) + (currentPlayerForDisplay.neutralMinionsKilled || 0)) / (gameDuration / 60)).toFixed(1) : "0.0"} label="CS/min" />
              <StatItem value={gameDuration > 0 ? ((currentPlayerForDisplay.visionScore || 0) / (gameDuration / 60)).toFixed(2) : "0.00"} label="VS/min" />
              <StatItem value={gameDuration > 0 ? ((currentPlayerForDisplay.totalDamageDealtToChampions || 0) / (gameDuration / 60)).toFixed(0) : "0"} label="DMG/min" />
              <StatItem value={gameDuration > 0 ? ((currentPlayerForDisplay.goldEarned || 0) / (gameDuration / 60)).toFixed(0) : "0"} label="Gold/min" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800/40 px-2 py-1 rounded-lg border border-gray-700/50 flex flex-col justify-center">
          <h4 className="font-semibold text-gray-300 mb-1.5 text-sm sm:text-sm uppercase">Build Order</h4>
          {timelineToDisplay && timelineToDisplay.buildOrder && timelineToDisplay.buildOrder.length > 0 ? (
            <div className="flex flex-wrap items-start gap-x-0.5 gap-y-1">
              {Object.entries(groupedBuildOrder)
                .sort(([minA], [minB]) => parseInt(minA) - parseInt(minB))
                .map(([minuteKey, groupData], groupIndex, arr) => {
                  const itemsInGroup = groupData.items;
                  const firstItemTimestampMs = groupData.firstTimestampMs;
                  const displayTime = formatGameDurationMMSS(firstItemTimestampMs / 1000);
                  return (
                    <React.Fragment key={`build-group-${minuteKey}`}>
                      <div className="flex flex-col items-center">
                        <div className="flex items-center gap-x-0.5 h-5">
                          {itemsInGroup.map((itemEvent, itemIndex) => {
                            const itemSrc = getItemImage(itemEvent.itemId);
                            const isSold = itemEvent.type === "sold";
                            return itemSrc ? (
                              <div key={`build-${minuteKey}-${itemIndex}-${itemEvent.itemId}-${itemEvent.timestamp}`} className="relative">
                                <img
                                  src={itemSrc}
                                  alt={`Item ${itemEvent.itemId}`}
                                  className={`w-6 h-6 rounded border ${isSold ? "border-red-600/70 opacity-50" : "border-gray-600"}`}
                                  title={`@ ${formatGameDurationMMSS(itemEvent.timestamp / 1000)} (${itemEvent.type})`}
                                  onError={(e) => {
                                    e.target.style.display = "none";
                                  }}
                                />
                                {isSold && <X size={8} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-red-500 stroke-[2px]" />}
                              </div>
                            ) : null;
                          })}
                        </div>
                        <span className="text-[8px] text-gray-300 mt-0.5">{displayTime}</span>
                      </div>
                      {groupIndex < arr.length - 1 && (
                        <div className="flex items-center justify-center h-5 mx-0.5">
                          <ChevronRight size={16} className="text-gray-400" />
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}

              <div className="flex items-center justify-center h-5 mx-0.5">
                <ChevronRight size={16} className="text-gray-400" />
              </div>
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-x-0.5 h-5">
                  {finalBuildItemsFiltered.map((itemId, index) => {
                    const itemSrc = getItemImage(itemId);
                    return itemSrc ? (
                      <img
                        key={`final-item-${index}-${itemId}`}
                        src={itemSrc}
                        alt={`Final Item ${index + 1}`}
                        className="w-6 h-6 rounded border border-gray-500"
                        title={`Item ${itemId}`}
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                    ) : null; // Should not happen due to filter, but good practice
                  })}
                  {/* Trinket */}
                  {finalTrinketItem && finalTrinketItem !== 0 && (
                    <img
                      key={`final-trinket-${finalTrinketItem}`}
                      src={getItemImage(finalTrinketItem)}
                      alt="Final Trinket"
                      className="w-6 h-6 rounded border border-yellow-500/50" // Different border for trinket
                      title={`Trinket ${finalTrinketItem}`}
                      onError={(e) => {
                        e.target.style.display = "none";
                      }}
                    />
                  )}
                </div>
                <span className="text-[8px] text-gray-300 mt-0.5">Final Build</span>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-xs italic">Missing build order data.</p>
          )}
        </div>

        <div className="bg-gray-800/40 px-1.5 py-1 rounded-lg border border-gray-700/50">
          <h4 className="font-semibold text-gray-300 mb-1 text-sm sm:text-sm uppercase">Skill Order</h4>
          <div className="space-y-1">
            {[1, 2, 3, 4].map((skillSlotKey) => {
              const championInfo = championData && championData[currentPlayerForDisplay.championName];
              const championDdragonId = championInfo ? championInfo.id : currentPlayerForDisplay.championName;
              const skillKeyBadgeText = SKILL_PLACEHOLDER_TEXT[skillSlotKey];

              return (
                <div key={`skill-row-${skillSlotKey}`} className="flex items-center space-x-2.5">
                  <div className="relative w-6.5 h-6.5 flex-shrink-0 bg-gray-800 rounded border border-gray-600 p-px" title={`Skill ${skillKeyBadgeText}`}>
                    <SkillIconDisplay ddragonVersion={ddragonVersion} championDdragonId={championDdragonId} skillSlotKey={skillSlotKey} />
                    <span
                      className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 flex items-center justify-center
                                                       text-[9px] font-bold rounded-full shadow-sm border border-black/50
                                                       bg-gray-700 text-gray-200`}
                    >
                      {skillKeyBadgeText}
                    </span>
                  </div>
                  <div className="grid grid-cols-[repeat(18,minmax(0,1fr))] gap-0.5 sm:gap-1 flex-grow">
                    {Array.from({ length: 18 }).map((_, levelIndex) => {
                      const championLevel = levelIndex + 1;
                      const skillEventForThisBox = timelineToDisplay?.skillOrder?.find((event) => event.levelTakenAt === championLevel && event.skillSlot === skillSlotKey);
                      const currentTotalPointsInThisSkillSlot = skillLevelsByAbility[skillSlotKey]?.[levelIndex];
                      let boxColor = "bg-gray-600/30";
                      let textColor = "text-gray-400";
                      if (skillEventForThisBox) {
                        boxColor = SKILL_ROW_ACTIVE_COLORS[skillSlotKey] || "bg-orange-500/80 text-white";
                      }
                      return (
                        <div
                          key={`skill-${skillSlotKey}-lvl-${championLevel}`}
                          className={`h-5 sm:h-6 text-[9px] sm:text-[10px] flex items-center justify-center rounded-sm border border-gray-500/30 ${boxColor} transition-colors`}
                          title={skillEventForThisBox ? `Level ${championLevel}: Leveled ${SKILL_PLACEHOLDER_TEXT[skillSlotKey]} (Tier ${skillEventForThisBox.skillLevel})` : currentTotalPointsInThisSkillSlot ? `${SKILL_PLACEHOLDER_TEXT[skillSlotKey]} Tier ${currentTotalPointsInThisSkillSlot}` : `Champ Lvl ${championLevel}`}
                        >
                          <span className={skillEventForThisBox ? SKILL_ROW_ACTIVE_COLORS[skillSlotKey].split(" ").find((cls) => cls.startsWith("text-")) || textColor : textColor}>{skillEventForThisBox ? skillEventForThisBox.levelTakenAt : ""}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          {(!timelineToDisplay?.skillOrder || timelineToDisplay.skillOrder.length === 0) && <p className="text-gray-500 text-xs italic mt-1.5 ml-1">Missing skill order data.</p>}
        </div>

        {/* ADD THE RUNE DISPLAY HERE, AT THE BOTTOM OF THE DETAILS TAB */}
        <div className="bg-gray-800/40 p-2 sm:p-3 rounded-lg border border-gray-700/50 mt-3">
          <h4 className="font-semibold text-gray-300 mb-2 text-sm sm:text-sm uppercase text-center">Runes</h4>
          {currentPlayerForDisplay && currentPlayerForDisplay.perks && runesDataFromDDragon && runesDataFromDDragon.length > 0 ? (
            <div className="flex justify-center">
              <RuneDisplay perks={currentPlayerForDisplay.perks} runesDataFromDDragon={runesDataFromDDragon} runesMap={runesMap} getRuneImage={getRuneImage} layout="full" size="lg" />
            </div>
          ) : (
            <p className="text-gray-400 p-4 text-center">Rune data not available for this player.</p>
          )}
        </div>
      </div>
    );
  };

  const expandedBgClass = "bg-black-800/50";

  let tabBaseBg = "bg-gray-800/25";
  let tabActiveBg = "bg-black-800/40";

  if (isTrackedPlayerWin === true) {
    tabBaseBg = "bg-blue-900/20";
  } else if (isTrackedPlayerWin === false) {
    tabBaseBg = "bg-red-900/20";
  }

  return (
    <div className={`p-2 sm:p-0 ${expandedBgClass} backdrop-blur-sm rounded-b-lg shadow-inner`}>
      <div className={`flex w-full overflow-hidden ${tabBaseBg}`}>
        <button
          onClick={() => setActiveTab("General")}
          className={`flex-1 py-2.5 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium transition-colors focus:outline-none
                                flex items-center justify-center space-x-2
                                ${activeTab === "General" ? `${tabActiveBg} text-gray-100` : "text-gray-400 hover:text-gray-100 hover:bg-white/5"}`}
        >
          <LayoutList size={16} className={`${activeTab === "General" ? "text-gray-100" : "text-gray-500 group-hover:text-gray-300"}`} />
          <span>Scoreboard</span>
        </button>
        <button
          onClick={() => setActiveTab("Details")}
          className={`flex-1 py-2.5 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium transition-colors focus:outline-none
                                flex items-center justify-center space-x-2
                                ${activeTab === "Details" ? `${tabActiveBg} text-gray-100` : "text-gray-400 hover:text-gray-100 hover:bg-white/5"}`}
        >
          <PieChart size={16} className={`${activeTab === "Details" ? "text-gray-100" : "text-gray-500 group-hover:text-gray-300"}`} />
          <span>Details</span>
        </button>
        {/* REMOVE THE SEPARATE RUNES TAB BUTTON */}
        {/*
        <button
          onClick={() => setActiveTab("Runes")}
          className={`flex-1 py-2.5 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium transition-colors focus:outline-none
                                flex items-center justify-center space-x-2
                                ${activeTab === "Runes" ? `${tabActiveBg} text-gray-100` : "text-gray-400 hover:text-gray-100 hover:bg-white/5"}`}
        >
          <img src="/src/assets/icon-runes.png" alt="Runes" className={`w-4 h-4 ${activeTab === "Runes" ? "opacity-100" : "opacity-50 grayscale group-hover:opacity-100 group-hover:grayscale-0"}`} />
          <span>Runes</span>
        </button>
        */}
      </div>
      {activeTab === "General" && <GeneralTabContent />}
      {activeTab === "Details" && <DetailsTabContent />}
      {/* REMOVE THE CONDITIONAL RENDERING FOR THE SEPARATE RUNES TAB */}
      {/* {activeTab === "Runes" && <RunesTabContent />} */}
    </div>
  );
};

export default ExpandedMatchDetails;
