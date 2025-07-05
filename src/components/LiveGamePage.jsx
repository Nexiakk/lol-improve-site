// src/components/LiveGamePage.jsx
import React, { useState, useEffect, useCallback } from "react";
import { Popover, Tooltip } from "antd";
import { Loader2, WifiOff } from "lucide-react";
import { delay, getContinentalRoute, formatGameDurationMMSS, formatGameMode } from "../utils/matchCalculations";
import RunePopoverContent from "./common/RunePopoverContent";
import riotApiFetchWithRetry from "../components/common/apiFetch";

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

// --- RANK HELPERS ---
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

const formatRank = (rankInfo) => {
  if (!rankInfo || !rankInfo.tier || rankInfo.tier === "UNRANKED") {
    return "Unranked";
  }
  const { tier, rank, leaguePoints } = rankInfo;
  const highTiers = ["MASTER", "GRANDMASTER", "CHALLENGER"];
  const isHighTier = highTiers.includes(tier.toUpperCase());
  return isHighTier ? `${tier.charAt(0) + tier.slice(1).toLowerCase()} (${leaguePoints} LP)` : `${tier.charAt(0) + tier.slice(1).toLowerCase()} ${rank}`;
};

const getRankTextColor = (tier) => {
  switch (tier.toUpperCase()) {
    case "IRON":
      return "text-gray-200";
    case "BRONZE":
      return "text-amber-200";
    case "SILVER":
      return "text-gray-200";
    case "GOLD":
      return "text-yellow-200";
    case "PLATINUM":
      return "text-teal-200";
    case "EMERALD":
      return "text-green-200";
    case "DIAMOND":
      return "text-blue-200";
    case "MASTER":
      return "text-purple-200";
    case "GRANDMASTER":
      return "text-red-200";
    case "CHALLENGER":
      return "text-indigo-200";
    default:
      return "text-gray-200";
  }
};

const getWinrateTextColor = (tier) => {
  switch (tier.toUpperCase()) {
    case "IRON":
      return "text-gray-300";
    case "BRONZE":
      return "text-amber-300";
    case "SILVER":
      return "text-gray-300";
    case "GOLD":
      return "text-yellow-300";
    case "PLATINUM":
      return "text-teal-300";
    case "EMERALD":
      return "text-green-300";
    case "DIAMOND":
      return "text-blue-300";
    case "MASTER":
      return "text-purple-300";
    case "GRANDMASTER":
      return "text-red-300";
    case "CHALLENGER":
      return "text-indigo-300";
    default:
      return "text-gray-300";
  }
};

const RankDisplay = ({ rankInfo }) => {
  if (!rankInfo || !rankInfo.tier || rankInfo.tier === "UNRANKED") {
    return (
      <div className="flex flex-col items-center">
        <span className="text-gray-500 text-xs">Unranked</span>
        <span className="text-gray-500 text-xs mt-1">N/A</span>
      </div>
    );
  }
  const iconSrc = rankIconMap[rankInfo.tier.toUpperCase()];
  const winrate = rankInfo.wins && rankInfo.losses ? ((rankInfo.wins / (rankInfo.wins + rankInfo.losses)) * 100).toFixed(0) : "N/A";
  const gamesPlayed = rankInfo.wins + rankInfo.losses;
  const isHighTier = ["MASTER", "GRANDMASTER", "CHALLENGER"].includes(rankInfo.tier.toUpperCase());

  const rankColorClass = getRankTextColor(rankInfo.tier);
  const winrateColorClass = getWinrateTextColor(rankInfo.tier);

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center h-6" title={formatRank(rankInfo)}>
        {iconSrc && <img src={iconSrc} alt={rankInfo.tier} className="h-6 w-6" />}
      </div>
      <div className={`${rankColorClass} text-xs font-semibold mt-1`}>{isHighTier ? `${rankInfo.leaguePoints} LP` : `${rankInfo.rank} - ${rankInfo.leaguePoints} LP`}</div>
      {gamesPlayed > 0 && (
        <div className={`${winrateColorClass} text-xs mt-1`}>
          {winrate}% ({rankInfo.wins}W - {rankInfo.losses}L)
        </div>
      )}
    </div>
  );
};

const RIOT_API_KEY = import.meta.env.VITE_RIOT_API_KEY;

const LiveGamePlayer = ({ player, rankInfo, riotId, isTrackedPlayer, getChampionImage, getSummonerSpellImage, getRuneImage, runesDataFromDDragon, runesMap, teamId, championDetails, ddragonVersion }) => {
  const primaryRuneImg = getRuneImage(player.perks.perkIds[0]);
  const secondaryTreeImg = getRuneImage(player.perks.perkSubStyle);
  const displayName = riotId ? riotId.gameName : player.summonerName;

  const containerClasses = `relative flex flex-col justify-between pt-10 pb-0 rounded-lg transition-all overflow-visible ${
    isTrackedPlayer ? "bg-gray-800/90" : "bg-gray-800/50" // Increased opacity
  } w-full min-h-[220px]`; // Removed borders

  const championBorderColorClass = teamId === 100 ? "border-blue-500" : "border-red-600";
  const bottomBorderColorClass = teamId === 100 ? "bg-blue-500" : "bg-red-600";

  // Helper to render individual spells with cooldowns
  const renderSpellWithCooldown = (spell, index, isPassive = false) => {
    if (!spell || !ddragonVersion) return null;

    const spellIconUrl = isPassive ? `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/passive/${spell.image.full}` : `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/spell/${spell.image.full}`;
    const keyBinding = isPassive ? "P" : ["Q", "W", "E", "R"][index];

    const baseCooldown = Array.isArray(spell.cooldown) ? spell.cooldown[0] : spell.cooldown;

    // Only display passive if it has a defined, non-zero cooldown property
    // or if it's not an empty array and baseCooldown is not 0
    if (isPassive && (baseCooldown === undefined || baseCooldown === 0 || (Array.isArray(spell.cooldown) && spell.cooldown.length === 0))) {
      return null; // Don't render passive if it has no relevant cooldown info
    }

    // Content for the Popover (showing cooldowns at all ranks)
    const cooldownsPopoverContent = (
      <div className="text-left max-w-xs">
        <p className="font-bold text-orange-400 text-base mb-1">
          {spell.name} {isPassive ? "(Passive)" : ""}
        </p>
        <p className="text-xs text-gray-300 mb-2" dangerouslySetInnerHTML={{ __html: spell.description }}></p>
        {Array.isArray(spell.cooldown) && spell.cooldown.length > 0 && (
          <div className="mt-1 text-gray-400 text-xs">
            <p className="font-semibold text-white mb-1">Cooldowns:</p>
            {spell.cooldown.map((cd, i) => (
              <p key={i}>
                Level {i + 1}: <span className="text-sky-300">{cd}s</span>
              </p>
            ))}
          </div>
        )}
        {/* Fallback for spells with single cooldown value or passives with explicit cooldown */}
        {(!Array.isArray(spell.cooldown) || spell.cooldown.length === 0) && baseCooldown !== undefined && baseCooldown !== 0 && <p className="text-gray-400 text-xs mt-1">Cooldown: {baseCooldown}s</p>}
      </div>
    );

    // Display cooldown on the icon itself, only if it has a non-zero cooldown
    const displayCooldownOnIcon = baseCooldown !== undefined && baseCooldown !== 0 ? `${baseCooldown}s` : null;

    return (
      <Popover content={cooldownsPopoverContent} trigger="hover" placement="top" overlayInnerStyle={{ padding: "12px", backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "8px" }}>
        <div className="relative w-8 h-8 group flex-shrink-0">
          <img src={spellIconUrl} alt={spell.name} className="w-full h-full rounded-md border border-gray-700 object-cover" />
          {keyBinding && <span className="absolute -bottom-1 -right-1 bg-gray-900 text-white text-[10px] font-bold px-1 rounded-full border border-gray-600 z-10">{keyBinding}</span>}
          {displayCooldownOnIcon && <span className="absolute top-0 left-0 text-[10px] font-bold bg-black/70 text-sky-400 px-1 py-0.5 rounded-br-md rounded-tl-md z-10">{displayCooldownOnIcon}</span>}
        </div>
      </Popover>
    );
  };

  return (
    <div className={containerClasses}>
      {/* Absolute positioned elements for the top of the card */}
      <div className="absolute inset-x-0 top-0 h-auto z-10">
        {/* Champion Icon: Centered horizontally, pushed up by -translate-y-1/2 */}
        <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
          <img src={getChampionImage(player.championId)} alt={displayName} className={`w-16 h-16 rounded-xl border-2 ${championBorderColorClass} shadow-lg`} />
        </div>

        {/* Summoner Spells: Top-left, horizontal */}
        <div className="absolute top-2 left-2 flex gap-1 z-20">
          <img src={getSummonerSpellImage(player.spell1Id)} alt="Summoner 1" className="w-6 h-6 rounded-full border border-black/10" />
          <img src={getSummonerSpellImage(player.spell2Id)} alt="Summoner 2" className="w-6 h-6 rounded-full border border-black/10" />
        </div>

        {/* Runes: Top-right, horizontal */}
        <Popover content={<RunePopoverContent perks={player.perks} runesDataFromDDragon={runesDataFromDDragon} runesMap={runesMap} getRuneImage={getRuneImage} />} trigger="hover" placement="top" styles={{ body: { padding: "12px", backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "8px" } }}>
          <div className="absolute top-2 right-2 flex gap-1 cursor-pointer z-20">
            <div className="w-6 h-6 rounded-full bg-gray-900 flex items-center justify-center border border-black/10">
              <img src={primaryRuneImg} alt="Primary Rune" className="w-6 h-6" />
            </div>
            <div className="w-6 h-6 rounded-full bg-gray-900 flex items-center justify-center border border-black/10">
              <img src={secondaryTreeImg} alt="Secondary Tree" className="w-6 h-6 p-1" />
            </div>
          </div>
        </Popover>
      </div>

      {/* Player Info (Name and Rank) - Centered directly under champion icon */}
      <div className="mt-1 text-center flex flex-col items-center w-full flex-grow px-2 z-10">
        <div className="font-semibold text-gray-100 text-sm truncate w-full">{displayName}</div>
        <RankDisplay rankInfo={rankInfo} />
      </div>

      {/* Champion Skill Icons - At the very bottom, no background */}
      <div className="flex gap-1.5 justify-center pt-2 pb-4 z-20 w-full rounded-b-lg">
        {/* Conditional rendering for passive based on whether it has a cooldown */}
        {championDetails && championDetails.passive && championDetails.passive.cooldown !== undefined && (Array.isArray(championDetails.passive.cooldown) ? championDetails.passive.cooldown.length > 0 && championDetails.passive.cooldown[0] !== 0 : championDetails.passive.cooldown !== 0) && renderSpellWithCooldown(championDetails.passive, null, true)}
        {championDetails && championDetails.spells && championDetails.spells.map((spell, index) => index < 4 && renderSpellWithCooldown(spell, index))}
      </div>

      {/* Bottom Border (decorative, at the very edge of the card) */}
      <span className={`absolute bottom-0 left-0 right-0 py-0.5 rounded-b shadow-[0_0px_12px_0px_rgba(222,204,251,0.22)] ${bottomBorderColorClass}`}></span>
    </div>
  );
};

const LiveGamePage = ({ trackedAccounts, getChampionImage, getSummonerSpellImage, getRuneImage, runesDataFromDDragon, runesMap, championData, ddragonVersion }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [liveGame, setLiveGame] = useState(null);
  const [playerRanks, setPlayerRanks] = useState({});
  const [playerRiotIds, setPlayerRiotIds] = useState({});
  const [trackedPlayerInGame, setTrackedPlayerInGame] = useState(null);
  const [gameTime, setGameTime] = useState(0);
  const [playerChampionDetails, setPlayerChampionDetails] = useState({});

  useEffect(() => {
    let timerInterval;
    if (liveGame && liveGame.gameStartTime) {
      const startTime = liveGame.gameStartTime;
      setGameTime(Math.floor((Date.now() - startTime) / 1000));

      timerInterval = setInterval(() => {
        setGameTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }

    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [liveGame]);

  const findLiveGame = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setLiveGame(null);
    setPlayerRanks({});
    setPlayerRiotIds({});
    setGameTime(0);
    setPlayerChampionDetails({}); // Clear previous details on new search

    if (!RIOT_API_KEY) {
      setError("Riot API Key is missing.");
      setIsLoading(false);
      return;
    }

    if (!trackedAccounts || trackedAccounts.length === 0) {
      setError("No tracked accounts to check.");
      setIsLoading(false);
      return;
    }

    let gameData = null;
    let foundAccount = null;

    for (const account of trackedAccounts) {
      if (gameData) break;

      try {
        const liveGameUrl = `https://${account.platformId}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${account.puuid}?api_key=${RIOT_API_KEY}`;
        const liveGameResponse = await riotApiFetchWithRetry(liveGameUrl);

        if (liveGameResponse.ok) {
          gameData = await liveGameResponse.json();
          foundAccount = account;
        }
      } catch (err) {
        if (err.message.includes("404")) {
          console.log(`${account.name} is not in a live game.`);
        } else {
          console.error(`Error checking live game for ${account.name}:`, err);
          setError(`An error occurred while checking for a live game. Please try again.`);
          break;
        }
      }
      await delay(250);
    }

    if (gameData) {
      setLiveGame(gameData);
      setTrackedPlayerInGame(foundAccount);

      const continentalRoute = getContinentalRoute(gameData.platformId);

      const riotIdPromises = gameData.participants.map((p) => {
        const accountUrl = `https://${continentalRoute}.api.riotgames.com/riot/account/v1/accounts/by-puuid/${p.puuid}?api_key=${RIOT_API_KEY}`;
        return riotApiFetchWithRetry(accountUrl).then((res) => res.json());
      });

      const rankPromises = gameData.participants.map((p) => {
        const rankUrl = `https://${gameData.platformId}.api.riotgames.com/lol/league/v4/entries/by-puuid/${p.puuid}?api_key=${RIOT_API_KEY}`;
        return riotApiFetchWithRetry(rankUrl).then((res) => res.json());
      });

      const championDetailPromises = gameData.participants.map(async (p) => {
        if (!championData || !ddragonVersion) return { puuid: p.puuid, details: null };

        const championName = Object.values(championData).find((c) => c.key == p.championId)?.id;

        if (championName) {
          try {
            const detailedChampResponse = await fetch(`https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/data/en_US/champion/${championName}.json`);
            if (detailedChampResponse.ok) {
              const detailedChampData = await detailedChampResponse.json();
              return { puuid: p.puuid, details: detailedChampData.data[championName] };
            }
          } catch (error) {
            console.error(`Failed to fetch detailed champion data for ${championName}:`, error);
          }
        }
        return { puuid: p.puuid, details: null };
      });

      const [riotIdResults, rankResults, championDetailResults] = await Promise.all([Promise.allSettled(riotIdPromises), Promise.allSettled(rankPromises), Promise.allSettled(championDetailPromises)]);

      const newRiotIds = {};
      riotIdResults.forEach((result, index) => {
        const puuid = gameData.participants[index].puuid;
        if (result.status === "fulfilled" && result.value && result.value.gameName) {
          newRiotIds[puuid] = { gameName: result.value.gameName, tagLine: result.value.tagLine };
        }
      });
      setPlayerRiotIds(newRiotIds);

      const newRanks = {};
      rankResults.forEach((result, index) => {
        const puuid = gameData.participants[index].puuid;
        if (result.status === "fulfilled" && Array.isArray(result.value)) {
          const rankedSoloInfo = result.value.find((q) => q.queueType === "RANKED_SOLO_5x5");
          newRanks[puuid] = rankedSoloInfo || { tier: "UNRANKED" };
        } else {
          newRanks[puuid] = { tier: "UNRANKED" };
        }
      });
      setPlayerRanks(newRanks);

      const newChampionDetails = {};
      championDetailResults.forEach((result) => {
        if (result.status === "fulfilled" && result.value && result.value.details) {
          newChampionDetails[result.value.puuid] = result.value.details;
        }
      });
      setPlayerChampionDetails(newChampionDetails);
    }

    setIsLoading(false);
  }, [trackedAccounts, championData, ddragonVersion]);

  useEffect(() => {
    findLiveGame();
  }, [findLiveGame]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 p-8">
        <Loader2 size={48} className="mb-4 text-sky-500 animate-spin" />
        <h2 className="text-2xl font-bold text-gray-300">Searching for Live Game...</h2>
        <p className="mt-2 max-w-md">Checking tracked accounts for an active match.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 p-8">
        <WifiOff size={48} className="mb-4 text-red-500" />
        <h2 className="text-2xl font-bold text-red-400">Error</h2>
        <p className="mt-2 max-w-md text-gray-400">{error}</p>
      </div>
    );
  }

  if (!liveGame) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 p-8">
        <WifiOff size={48} className="mb-4 text-gray-600" />
        <h2 className="text-2xl font-bold text-gray-300">No Live Game Found</h2>
        <p className="mt-2 max-w-md">None of the tracked accounts are currently in an active game.</p>
        <button onClick={findLiveGame} className="mt-6 px-4 py-2 bg-sky-600 text-white font-semibold rounded-md hover:bg-sky-500 transition-colors">
          Search Again
        </button>
      </div>
    );
  }

  const blueTeam = liveGame.participants.filter((p) => p.teamId === 100);
  const redTeam = liveGame.participants.filter((p) => p.teamId === 200);

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div className="text-center mb-16">
        {/* Changed text size to text-xl and added flex with gap for noticeable distance */}
        <h2 className="flex items-center justify-center text-xl font-bold text-white mb-2">
          <span>{formatGameMode(liveGame.gameMode, liveGame.queueId)}</span>
          <span className="mx-4"></span> {/* Noticeable distance */}
          <span>{formatGameDurationMMSS(gameTime)}</span>
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-y-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {blueTeam.map((player) => (
            <LiveGamePlayer key={player.puuid} player={player} rankInfo={playerRanks[player.puuid]} riotId={playerRiotIds[player.puuid]} isTrackedPlayer={trackedPlayerInGame?.puuid === player.puuid} getChampionImage={getChampionImage} getSummonerSpellImage={getSummonerSpellImage} getRuneImage={getRuneImage} runesDataFromDDragon={runesDataFromDDragon} runesMap={runesMap} teamId={player.teamId} championDetails={playerChampionDetails[player.puuid]} ddragonVersion={ddragonVersion} />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {redTeam.map((player) => (
            <LiveGamePlayer key={player.puuid} player={player} rankInfo={playerRanks[player.puuid]} riotId={playerRiotIds[player.puuid]} isTrackedPlayer={trackedPlayerInGame?.puuid === player.puuid} getChampionImage={getChampionImage} getSummonerSpellImage={getSummonerSpellImage} getRuneImage={getRuneImage} runesDataFromDDragon={runesDataFromDDragon} runesMap={runesMap} teamId={player.teamId} championDetails={playerChampionDetails[player.puuid]} ddragonVersion={ddragonVersion} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default LiveGamePage;
