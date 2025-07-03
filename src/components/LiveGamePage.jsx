// src/components/LiveGamePage.jsx
import React, { useState, useEffect, useCallback } from "react";
import { Popover } from "antd";
import { Loader2, Shield, Swords, WifiOff } from "lucide-react";
import { delay, getContinentalRoute } from "../utils/matchCalculations";
import RunePopoverContent from "./common/RunePopoverContent";
import riotApiFetchWithRetry from "../components/common/apiFetch";

// --- RANK ICON IMPORTS (from ExpandedMatchDetails.jsx) ---
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

// --- RANK HELPERS (from ExpandedMatchDetails.jsx) ---
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

const RankDisplay = ({ rankInfo }) => {
  if (!rankInfo || !rankInfo.tier || rankInfo.tier === "UNRANKED") {
    return <span className="text-gray-500 text-[10px]">Unranked</span>;
  }
  const iconSrc = rankIconMap[rankInfo.tier.toUpperCase()];
  const rankText = formatRank(rankInfo);
  if (!iconSrc) {
    return <span className="text-gray-400 text-[10px] capitalize">{rankText}</span>;
  }
  return (
    <div className="flex items-center h-5" title={rankText}>
      <img src={iconSrc} alt={rankText} className="h-5 w-5" />
      {rankInfo.leaguePoints && <span className="text-gray-300 text-[10px] font-semibold ml-1.5">{rankInfo.leaguePoints} LP</span>}
    </div>
  );
};

const RIOT_API_KEY = import.meta.env.VITE_RIOT_API_KEY;

const LiveGamePlayer = ({ player, rankInfo, riotId, isTrackedPlayer, getChampionImage, getSummonerSpellImage, getRuneImage, runesDataFromDDragon, runesMap }) => {
  const primaryRuneImg = getRuneImage(player.perks.perkIds[0]);
  const secondaryTreeImg = getRuneImage(player.perks.perkSubStyle);
  const displayName = riotId ? `${riotId.gameName} #${riotId.tagLine}` : player.summonerName;

  const containerClasses = `flex items-center justify-between p-2 rounded-lg transition-all ${isTrackedPlayer ? "bg-sky-900/60 border border-sky-500 shadow-lg" : "bg-gray-800/50"}`;

  return (
    <div className={containerClasses}>
      <div className="flex items-center gap-3">
        <img src={getChampionImage(player.championId)} alt={displayName} className="w-10 h-10 rounded-md" />
        <div>
          <div className="font-semibold text-gray-100 text-sm">{displayName}</div>
          <RankDisplay rankInfo={rankInfo} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex flex-col gap-1">
          <img src={getSummonerSpellImage(player.spell1Id)} alt="Summoner 1" className="w-5 h-5 rounded" />
          <img src={getSummonerSpellImage(player.spell2Id)} alt="Summoner 2" className="w-5 h-5 rounded" />
        </div>
        <Popover content={<RunePopoverContent perks={player.perks} runesDataFromDDragon={runesDataFromDDragon} runesMap={runesMap} getRuneImage={getRuneImage} />} trigger="hover" placement="top" styles={{ body: { padding: "12px", backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "8px" } }}>
          <div className="flex flex-col gap-1 cursor-pointer">
            <img src={primaryRuneImg} alt="Primary Rune" className="w-5 h-5" />
            <img src={secondaryTreeImg} alt="Secondary Tree" className="w-5 h-5 p-0.5" />
          </div>
        </Popover>
      </div>
    </div>
  );
};

const LiveGamePage = ({ trackedAccounts, getChampionImage, getSummonerSpellImage, getRuneImage, runesDataFromDDragon, runesMap }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [liveGame, setLiveGame] = useState(null);
  const [playerRanks, setPlayerRanks] = useState({});
  const [playerRiotIds, setPlayerRiotIds] = useState({});
  const [trackedPlayerInGame, setTrackedPlayerInGame] = useState(null);

  const findLiveGame = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setLiveGame(null);
    setPlayerRanks({});
    setPlayerRiotIds({});
    if (!trackedAccounts || trackedAccounts.length === 0) {
      setError("No tracked accounts to check.");
      setIsLoading(false);
      return;
    }

    let gameData = null;
    let foundAccount = null;

    for (const account of trackedAccounts) {
      try {
        // FIX: Appended the RIOT_API_KEY to the URL to prevent 401 Unauthorized errors.
        const liveGameUrl = `https://${account.platformId}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${account.puuid}?api_key=${RIOT_API_KEY}`;
        const liveGameResponse = await riotApiFetchWithRetry(liveGameUrl);

        if (liveGameResponse.ok) {
          gameData = await liveGameResponse.json();
          foundAccount = account;
          break;
        }
      } catch (err) {
        // Handle 404 (Not in game) gracefully without setting a component-wide error.
        if (err.message.includes("404")) {
          console.log(`${account.name} is not in a live game.`);
        } else {
          console.error(`Error checking live game for ${account.name}:`, err);
          setError(`An error occurred while checking for a live game. Please try again.`);
          // Stop checking other accounts if a persistent error (like 401/403) occurs.
          break;
        }
      }
      await delay(250);
    }

    // Step 3: If a game was found, fetch ranks for all participants
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

      const [riotIdResults, rankResults] = await Promise.all([Promise.allSettled(riotIdPromises), Promise.allSettled(rankPromises)]);

      const newRiotIds = {};
      riotIdResults.forEach((result, index) => {
        const puuid = gameData.participants[index].puuid;
        if (result.status === "fulfilled" && result.value.gameName) {
          newRiotIds[puuid] = { gameName: result.value.gameName, tagLine: result.value.tagLine };
        }
      });
      setPlayerRiotIds(newRiotIds);

      const newRanks = {};
      rankResults.forEach((result, index) => {
        const puuid = gameData.participants[index].puuid; 
        if (result.status === "fulfilled" && Array.isArray(result.value)) {
          const rankedSoloInfo = result.value.find((q) => q.queueType === "RANKED_SOLO_5x5");
          newRanks[puuid] = rankedSoloInfo || { tier: "UNRANKED" }; // Store by puuid
        } else {
          newRanks[puuid] = { tier: "UNRANKED" }; // Store by puuid
        }
      });
      setPlayerRanks(newRanks);
    }

    setIsLoading(false);
  }, [trackedAccounts]);

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
    <div className="p-4 max-w-4xl mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-white">Live Game</h1>
        {trackedPlayerInGame && (
          <p className="text-gray-400">
            Tracked player found:{" "}
            <span className="font-semibold text-sky-400">
              {trackedPlayerInGame.name}#{trackedPlayerInGame.tag}
            </span>
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-4">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <Shield className="text-blue-500" size={24} />
            <h2 className="text-2xl font-bold text-blue-400">Blue Team</h2>
          </div>
          <div className="space-y-2">
            {blueTeam.map((player) => (
              <LiveGamePlayer key={player.puuid} player={player} rankInfo={playerRanks[player.summonerId]} riotId={playerRiotIds[player.puuid]} isTrackedPlayer={trackedPlayerInGame?.puuid === player.puuid} getChampionImage={getChampionImage} getSummonerSpellImage={getSummonerSpellImage} getRuneImage={getRuneImage} runesDataFromDDragon={runesDataFromDDragon} runesMap={runesMap} />
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-3 mb-3">
            <Swords className="text-red-500" size={24} />
            <h2 className="text-2xl font-bold text-red-400">Red Team</h2>
          </div>
          <div className="space-y-2">
            {redTeam.map((player) => (
              <LiveGamePlayer key={player.puuid} player={player} rankInfo={playerRanks[player.summonerId]} riotId={playerRiotIds[player.puuid]} isTrackedPlayer={trackedPlayerInGame?.puuid === player.puuid} getChampionImage={getChampionImage} getSummonerSpellImage={getSummonerSpellImage} getRuneImage={getRuneImage} runesDataFromDDragon={runesDataFromDDragon} runesMap={runesMap} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveGamePage;