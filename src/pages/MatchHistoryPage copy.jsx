// src/pages/MatchHistoryPage.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, doc, getDoc, setDoc, Timestamp, query, orderBy, limit } from 'firebase/firestore';
import { Loader2, AlertTriangle, ListChecks, Star, MessageSquare, RefreshCw, ImageOff, Globe } from 'lucide-react'; 

// Import role icons (adjust paths if your structure is different)
import topIcon from '../assets/top_icon.svg';
import jungleIcon from '../assets/jungle_icon.svg';
import middleIcon from '../assets/mid_icon.svg';
import bottomIcon from '../assets/bottom_icon.svg';
import supportIcon from '../assets/support_icon.svg';

const RIOT_API_KEY = import.meta.env.VITE_RIOT_API_KEY;
const RANKED_SOLO_QUEUE_ID = 420;
const MATCH_COUNT_PER_FETCH = 20;
const MATCH_DETAILS_TO_PROCESS_PER_ACCOUNT_UPDATE = 10;
const API_CALL_DELAY_MS = 1250;

const getContinentalRoute = (platformId) => {
  if (!platformId) return 'europe';
  const lowerPlatformId = platformId.toLowerCase();
  if (['eun1', 'euw1', 'tr1', 'ru'].includes(lowerPlatformId)) return 'europe';
  if (['na1', 'br1', 'la1', 'la2', 'oc1'].includes(lowerPlatformId)) return 'americas';
  if (['kr', 'jp1'].includes(lowerPlatformId)) return 'asia';
  return 'europe';
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function timeAgo(timestampSeconds) {
  if (!timestampSeconds) return '';
  const date = new Date(timestampSeconds * 1000);
  const now = new Date();
  const seconds = Math.round((now - date) / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);

  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function formatGameDuration(durationSeconds) {
    if (typeof durationSeconds !== 'number') return 'N/A';
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = durationSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

const ROLE_ICON_MAP = {
    TOP: topIcon,
    JUNGLE: jungleIcon,
    MIDDLE: middleIcon,
    BOTTOM: bottomIcon, 
    UTILITY: supportIcon 
};

function MatchHistoryPage() {
  const [trackedAccounts, setTrackedAccounts] = useState([]);
  const [allMatchesFromDb, setAllMatchesFromDb] = useState([]);
  const [groupedMatches, setGroupedMatches] = useState({});
  
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [isUpdatingAllMatches, setIsUpdatingAllMatches] = useState(false);
  const [updateProgress, setUpdateProgress] = useState('');
  
  const [error, setError] = useState('');
  const [ddragonVersion, setDdragonVersion] = useState('');
  const [summonerSpellsMap, setSummonerSpellsMap] = useState({});
  const [runesMap, setRunesMap] = useState({});
  const [championData, setChampionData] = useState(null); 

  useEffect(() => {
    if (!RIOT_API_KEY) {
      setError("Configuration Error: Riot API Key is missing.");
    }
    fetch('https://ddragon.leagueoflegends.com/api/versions.json')
      .then(res => res.json())
      .then(versions => {
        if (versions && versions.length > 0) {
          const latestVersion = versions[0];
          setDdragonVersion(latestVersion);
          
          fetch(`https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/en_US/summoner.json`)
            .then(res => res.json())
            .then(data => {
              const spells = {};
              for (const key in data.data) {
                spells[data.data[key].key] = data.data[key];
              }
              setSummonerSpellsMap(spells);
            })
            .catch(err => console.error("Failed to fetch DDragon summoner spells:", err));
          
          fetch(`https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/en_US/runesReforged.json`)
            .then(res => res.json())
            .then(data => {
              const runes = {};
              data.forEach(style => {
                runes[style.id] = { icon: style.icon, name: style.name };
                style.slots.forEach(slot => {
                  slot.runes.forEach(rune => {
                    runes[rune.id] = { icon: rune.icon, name: rune.name, styleId: style.id };
                  });
                });
              });
              setRunesMap(runes);
            })
            .catch(err => console.error("Failed to fetch DDragon runes:", err));

          fetch(`https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/en_US/champion.json`)
            .then(res => res.json())
            .then(data => {
              setChampionData(data.data); 
            })
            .catch(err => console.error("Failed to fetch DDragon champion data:", err));
        }
      })
      .catch(err => console.error("Failed to fetch DDragon versions:", err));
  }, []);

  const accountsCollectionRef = useMemo(() => db ? collection(db, "trackedAccounts") : null, []);

  const fetchTrackedAccounts = useCallback(async () => {
    if (!accountsCollectionRef) {
      setError("Firestore not available.");
      setIsLoadingAccounts(false);
      return;
    }
    setIsLoadingAccounts(true);
    try {
      const data = await getDocs(accountsCollectionRef);
      const accounts = data.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setTrackedAccounts(accounts);
    } catch (err) {
      console.error("Error fetching tracked accounts:", err);
      setError("Could not load tracked accounts.");
    } finally {
      setIsLoadingAccounts(false);
    }
  }, [accountsCollectionRef]);

  useEffect(() => {
    fetchTrackedAccounts();
  }, [fetchTrackedAccounts]);

  const fetchAllMatchesFromDbAndDisplay = useCallback(async () => {
    if (trackedAccounts.length === 0 || !db) {
      setAllMatchesFromDb([]);
      setGroupedMatches({});
      setIsLoadingMatches(false);
      return;
    }
    setIsLoadingMatches(true);
    setError('');
    let combinedMatches = [];
    try {
      for (const account of trackedAccounts) {
        const matchesSubCollectionRef = collection(db, "trackedAccounts", account.id, "matches");
        const q = query(matchesSubCollectionRef, orderBy("gameCreation", "desc"), limit(30)); 
        const querySnapshot = await getDocs(q);
        const accountMatches = querySnapshot.docs.map(docData => ({ 
            id: docData.id, 
            ...docData.data(),
            trackedAccountName: `${account.name}#${account.tag}`, 
            trackedAccountPlatform: account.platformId 
        }));
        combinedMatches = [...combinedMatches, ...accountMatches];
      }
      
      combinedMatches.sort((a, b) => (b.gameCreation?.seconds || 0) - (a.gameCreation?.seconds || 0));
      setAllMatchesFromDb(combinedMatches);

      const groups = combinedMatches.reduce((acc, match) => {
        if (!match.gameCreation || !match.gameCreation.seconds) return acc;
        const dateObj = new Date(match.gameCreation.seconds * 1000);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);

        let dateKey;
        if (dateObj.toDateString() === today.toDateString()) {
            dateKey = "Today";
        } else if (dateObj.toDateString() === yesterday.toDateString()) {
            dateKey = "Yesterday";
        } else {
            dateKey = dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        }
        
        if (!acc[dateKey]) {
          acc[dateKey] = [];
        }
        acc[dateKey].push(match);
        return acc;
      }, {});
      setGroupedMatches(groups);

    } catch (err) {
      console.error(`Error fetching stored matches:`, err);
      setError(`Failed to load stored matches.`);
    } finally {
      setIsLoadingMatches(false);
    }
  }, [trackedAccounts]);

  useEffect(() => {
    if (trackedAccounts.length > 0) {
        fetchAllMatchesFromDbAndDisplay();
    } else {
        setAllMatchesFromDb([]);
        setGroupedMatches({});
    }
  }, [trackedAccounts, fetchAllMatchesFromDbAndDisplay]);

  const handleUpdateAllMatches = async () => {
    if (!RIOT_API_KEY) { setError("Riot API Key is missing."); return; }
    if (trackedAccounts.length === 0) { setError("No accounts are being tracked."); return; }

    setIsUpdatingAllMatches(true);
    setError('');
    setUpdateProgress(`Starting update for ${trackedAccounts.length} accounts...`);
    let totalNewMatchesActuallyStored = 0;
    const twoWeeksAgoEpochSeconds = Math.floor((Date.now() - 14 * 24 * 60 * 60 * 1000) / 1000);

    for (let i = 0; i < trackedAccounts.length; i++) {
      const account = trackedAccounts[i];
      if (!account.puuid || !account.platformId) {
        setUpdateProgress(`Skipping ${account.name}#${account.tag} (missing data)... (${i + 1}/${trackedAccounts.length})`);
        continue;
      }
      setUpdateProgress(`Updating ${account.name}#${account.tag} (${i + 1}/${trackedAccounts.length})...`);
      try {
        const continentalRoute = getContinentalRoute(account.platformId);
        const matchlistUrl = `https://${continentalRoute}.api.riotgames.com/lol/match/v5/matches/by-puuid/${account.puuid}/ids?startTime=${twoWeeksAgoEpochSeconds}&queue=${RANKED_SOLO_QUEUE_ID}&count=${MATCH_COUNT_PER_FETCH}&api_key=${RIOT_API_KEY}`;
        await delay(API_CALL_DELAY_MS);
        const response = await fetch(matchlistUrl);
        if (!response.ok) { 
            const errData = await response.json().catch(() => ({ message: "Unknown Riot API error (match IDs fetch)" }));
            console.error(`Riot API error for ${account.name} (match IDs): ${response.status}`, errData);
            setError(`Error for ${account.name} (IDs): ${errData.status?.message || response.statusText}`);
            continue; 
        }
        const matchIdsFromApi = await response.json();
        if (matchIdsFromApi.length === 0) { 
            setUpdateProgress(`No new API matches for ${account.name}#${account.tag}. (${i + 1}/${trackedAccounts.length})`);
            continue; 
        }
        setUpdateProgress(`Found ${matchIdsFromApi.length} recent IDs for ${account.name}. Checking & fetching...`);
        
        let newMatchesProcessedForThisAccount = 0;
        for (const matchId of matchIdsFromApi) {
          if (newMatchesProcessedForThisAccount >= MATCH_DETAILS_TO_PROCESS_PER_ACCOUNT_UPDATE) break;
          const matchDocRef = doc(db, "trackedAccounts", account.id, "matches", matchId);
          const docSnap = await getDoc(matchDocRef);
          if (docSnap.exists()) { 
            continue; 
          }
          
          setUpdateProgress(`Fetching details for new match ${matchId} for ${account.name}...`);
          await delay(API_CALL_DELAY_MS);
          const matchDetailUrl = `https://${continentalRoute}.api.riotgames.com/lol/match/v5/matches/${matchId}?api_key=${RIOT_API_KEY}`;
          const detailResponse = await fetch(matchDetailUrl);
          if (!detailResponse.ok) { 
            console.warn(`Failed to fetch details for new match ${matchId} (Account: ${account.name}). Status: ${detailResponse.status}`);
            continue; 
          }
          const matchDetail = await detailResponse.json();
          const playerParticipant = matchDetail.info.participants.find(p => p.puuid === account.puuid);

          if (playerParticipant) {
            const perks = playerParticipant.perks || {};
            const primaryStyle = perks.styles?.find(s => s.description === 'primaryStyle');
            const subStyle = perks.styles?.find(s => s.description === 'subStyle');
            
            let opponentChampionName = null;
            const opponentParticipant = matchDetail.info.participants.find(p => 
                p.teamId !== playerParticipant.teamId && 
                p.teamPosition === playerParticipant.teamPosition &&
                playerParticipant.teamPosition !== '' && p.teamPosition !== undefined
            );
            if (opponentParticipant) {
                opponentChampionName = opponentParticipant.championName; 
            }

            const matchDataToStore = {
              matchId: matchDetail.metadata.matchId,
              gameCreation: Timestamp.fromMillis(matchDetail.info.gameCreation),
              gameDuration: matchDetail.info.gameDuration,
              gameMode: matchDetail.info.gameMode,
              platformId: account.platformId,
              puuid: account.puuid, 
              win: playerParticipant.win,
              championName: playerParticipant.championName, 
              championId: playerParticipant.championId, 
              championLevel: playerParticipant.champLevel,
              teamPosition: playerParticipant.teamPosition, // Store player's role
              kills: playerParticipant.kills,
              deaths: playerParticipant.deaths,
              assists: playerParticipant.assists,
              totalMinionsKilled: playerParticipant.totalMinionsKilled,
              neutralMinionsKilled: playerParticipant.neutralMinionsKilled,
              goldEarned: playerParticipant.goldEarned,
              item0: playerParticipant.item0, item1: playerParticipant.item1, item2: playerParticipant.item2,
              item3: playerParticipant.item3, item4: playerParticipant.item4, item5: playerParticipant.item5,
              item6: playerParticipant.item6, 
              summoner1Id: playerParticipant.summoner1Id,
              summoner2Id: playerParticipant.summoner2Id,
              primaryPerkId: primaryStyle?.selections?.[0]?.perk, 
              subStyleId: subStyle?.style,
              opponentChampionName: opponentChampionName,
              notes: "",
              rating: null,
            };
            await setDoc(matchDocRef, matchDataToStore);
            totalNewMatchesActuallyStored++;
            newMatchesProcessedForThisAccount++;
          }
        }
      } catch (err) { 
        console.error(`Error processing account ${account.name}#${account.tag}:`, err);
        setError(`Error updating ${account.name}.`);
      }
    }
    setUpdateProgress(`Update finished. Stored ${totalNewMatchesActuallyStored} new matches.`);
    setIsUpdatingAllMatches(false);
    fetchAllMatchesFromDbAndDisplay();
  };

  const getKDA = (participant) => {
    if (!participant || typeof participant.kills === 'undefined') return 'N/A';
    return `${participant.kills}/${participant.deaths}/${participant.assists}`;
  };
  
  const getCS = (participant) => {
    if (!participant || typeof participant.totalMinionsKilled === 'undefined' || typeof participant.neutralMinionsKilled === 'undefined') return 'N/A';
    return participant.totalMinionsKilled + participant.neutralMinionsKilled;
  }

  const getChampionInfo = (championKeyApi) => {
    if (!championData || !championKeyApi) return { displayName: championKeyApi, imageName: championKeyApi + ".png" }; 
    
    let championDetails = championData[championKeyApi];

    if (!championDetails) {
        for (const keyInDDragon in championData) {
            if (championData[keyInDDragon].id.toLowerCase() === championKeyApi.toLowerCase()) {
                championDetails = championData[keyInDDragon];
                break;
            }
        }
    }
    
    if (championDetails) {
        return {
            displayName: championDetails.name, 
            imageName: championDetails.image.full 
        };
    }
    
    console.warn(`Champion key "${championKeyApi}" not found in DDragon data. Using raw key.`);
    return { displayName: championKeyApi, imageName: championKeyApi + ".png" }; 
  };

  const getChampionImage = (championKeyApi) => {
    if (!championKeyApi || !ddragonVersion || !championData) return `https://via.placeholder.com/32/222/ccc?text=${championKeyApi ? championKeyApi.substring(0,1) : '?'}`;
    
    let ddragonKeyToLookup = championKeyApi;
    // Riot API returns "Fiddlesticks", DDragon champion.json key for its data is "FiddleSticks"
    // and that entry's image.full is "FiddleSticks.png"
    if (championKeyApi === "Fiddlesticks") { 
        ddragonKeyToLookup = "FiddleSticks"; 
    }

    const { imageName } = getChampionInfo(ddragonKeyToLookup); 
    return `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${imageName}`;
  };
  
  const getChampionDisplayName = (championKeyApi) => {
      if (!championKeyApi || !championData) return championKeyApi || 'N/A';
       let ddragonKeyToLookup = championKeyApi;
      if (championKeyApi === "Fiddlesticks") {
          ddragonKeyToLookup = "FiddleSticks";
      }
      const { displayName } = getChampionInfo(ddragonKeyToLookup);
      return displayName;
  };

  const getItemImage = (itemId) => {
    if (!itemId || !ddragonVersion || itemId === 0) return null;
    return `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/item/${itemId}.png`;
  };

  const getSummonerSpellImage = (spellId) => {
    if (!spellId || !ddragonVersion || !summonerSpellsMap[spellId]) return null;
    return `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/spell/${summonerSpellsMap[spellId].image.full}`;
  };

  const getRuneImage = (runeIdOrStyleId) => {
    if (!runeIdOrStyleId || !ddragonVersion || !runesMap[runeIdOrStyleId]) return null;
    return `https://ddragon.leagueoflegends.com/cdn/img/${runesMap[runeIdOrStyleId].icon}`;
  };

  if (!RIOT_API_KEY && !error.includes("Configuration Error")) { /* ... API Key error display ... */ }
  
  return (
    <div className="p-4 sm:p-6 md:p-8 text-gray-100">
      <header className="mb-8 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Match History</h1>
          <p className="text-gray-400 mt-1">Recent ranked games from all tracked accounts.</p>
        </div>
        <button
          onClick={handleUpdateAllMatches}
          disabled={isUpdatingAllMatches || isLoadingAccounts || trackedAccounts.length === 0 || !ddragonVersion || !championData}
          className="bg-orange-600 hover:bg-orange-500 text-white font-semibold py-2.5 px-4 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:ring-offset-gray-900 flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed transition-opacity min-w-[150px]"
        >
          {isUpdatingAllMatches ? <Loader2 size={20} className="animate-spin mr-2" /> : <RefreshCw size={18} className="mr-2" />}
          Update All
        </button>
      </header>
      
      {isUpdatingAllMatches && updateProgress && ( 
        <div className="mb-4 p-3 bg-sky-900/50 text-sky-300 border border-sky-700/50 rounded-md text-sm text-center">
          <p>{updateProgress}</p>
        </div>
      )}
      {error && ( 
        <div className="mb-6 p-4 bg-red-900/30 text-red-300 border border-red-700/50 rounded-md">
          <p><AlertTriangle size={18} className="inline mr-2" />Error: {error}</p>
        </div>
      )}
      
      {isLoadingMatches && !isUpdatingAllMatches && ( 
        <div className="flex flex-col items-center justify-center p-10 bg-gray-800/80 backdrop-blur-md rounded-xl shadow-xl border border-gray-700/50">
          <Loader2 size={40} className="text-orange-500 animate-spin" />
          <p className="text-gray-300 mt-4 text-lg">Loading matches...</p>
        </div>
      )}

      {!isLoadingMatches && Object.keys(groupedMatches).length === 0 && !error && !isUpdatingAllMatches && (
        <div className="text-center py-10 px-6 bg-gray-800/80 backdrop-blur-md rounded-xl shadow-xl border border-dashed border-gray-700/50">
            <ListChecks size={48} className="text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No matches found in database.</p>
            <p className="text-gray-500 text-sm">Click "Update All" to fetch recent games.</p>
        </div>
      )}

      {!isLoadingMatches && Object.keys(groupedMatches).length > 0 && (
        <div className="space-y-6"> 
          {Object.entries(groupedMatches).map(([dateKey, matchesOnDate]) => (
            <div key={dateKey}>
              <h2 className="text-lg font-semibold text-orange-400 mb-2 pb-1 border-b-2 border-gray-700/70">
                {dateKey}
              </h2>
              <div className="space-y-2"> 
                {matchesOnDate.map(match => {
                  const participantData = match; 
                  const gameResult = typeof match.win === 'boolean' ? (match.win ? 'Victory' : 'Defeat') : 'N/A';
                  const cs = getCS(participantData);
                  const csPerMin = match.gameDuration > 0 ? (cs / (match.gameDuration / 60)).toFixed(1) : 0;

                  const items = [match.item0, match.item1, match.item2, match.item3, match.item4, match.item5].map(id => getItemImage(id));
                  const trinket = getItemImage(match.item6);
                  const summoner1Img = getSummonerSpellImage(match.summoner1Id);
                  const summoner2Img = getSummonerSpellImage(match.summoner2Id);
                  const primaryRuneImg = getRuneImage(match.primaryPerkId);
                  const subStyleImg = getRuneImage(match.subStyleId);
                  
                  const playerRoleIcon = match.teamPosition ? ROLE_ICON_MAP[match.teamPosition.toUpperCase()] : null;

                  return (
                    <div key={match.id} className={`p-2.5 rounded-md shadow-sm border flex items-center space-x-3 ${typeof match.win === 'boolean' ? (match.win ? 'border-green-600/30 bg-gradient-to-r from-green-900/25 via-gray-850/25 to-gray-850/25' : 'border-red-600/30 bg-gradient-to-r from-red-900/25 via-gray-850/25 to-gray-850/25') : 'border-gray-700 bg-gray-800/50'} transition-colors hover:border-gray-600`}>
                      {/* Game Result Bar & Duration */}
                      <div className={`flex-shrink-0 w-2.5 rounded-l-md ${typeof match.win === 'boolean' ? (match.win ? 'bg-green-500' : 'bg-red-500') : 'bg-gray-600'}`}></div>
                      <div className="flex-shrink-0 w-20 text-center px-1 py-1 flex flex-col justify-center items-center"> 
                          <p className={`font-semibold text-xs ${typeof match.win === 'boolean' ? (match.win ? 'text-green-400' : 'text-red-400') : 'text-gray-300'}`}>{gameResult}</p>
                          <p className="text-xs text-gray-400">{formatGameDuration(match.gameDuration)}</p>
                          <p className="text-[10px] text-gray-500 mt-0.5" title={new Date(match.gameCreation.seconds * 1000).toLocaleString()}>{timeAgo(match.gameCreation.seconds)}</p>
                      </div>
                      
                      {/* Champion Matchup Section (Vertically Stacked) */}
                      <div className="flex-shrink-0 flex flex-col items-center justify-center space-y-1 w-12">
                        {/* Player Champion with Role Badge */}
                        <div className="relative w-10 h-10">
                           <img 
                              src={getChampionImage(match.championName)} 
                              alt={getChampionDisplayName(match.championName)} 
                              className="w-10 h-10 rounded-md"
                              onError={(e) => { (e.target).style.display='none'; }}
                          />
                          {playerRoleIcon && (
                            <img 
                                src={playerRoleIcon} 
                                alt={match.teamPosition} 
                                className="absolute -bottom-1.5 -left-1.5 w-5 h-5 p-0.5 bg-gray-900 rounded-full border border-gray-600" 
                            />
                          )}
                        </div>

                        <div className="w-8 border-t border-gray-600 my-0.5"></div> {/* Horizontal Line */}
                        
                        {/* Opponent Champion with VS Badge */}
                        <div className="relative w-10 h-10">
                         {match.opponentChampionName ? (
                            <>
                            <img 
                                src={getChampionImage(match.opponentChampionName)} 
                                alt={getChampionDisplayName(match.opponentChampionName)} 
                                className="w-10 h-10 rounded-md" 
                                onError={(e) => { (e.target).style.display='none'; }}
                            />
                            <span className="absolute -bottom-1.5 left-1/2 transform -translate-x-1/2 bg-gray-700 text-gray-200 text-[9px] px-1 rounded-sm font-bold border border-gray-500">
                                VS
                            </span>
                            </>
                         ) : <div className="w-10 h-10 bg-gray-700/30 rounded-md"></div>} 
                        </div>
                      </div>


                      {/* Loadout: Summoners, Runes, Items */}
                      <div className="flex-shrink-0 flex items-center space-x-1.5 mx-1 p-1.5 bg-black/30 rounded-md border border-gray-700/50"> 
                        <div className="flex flex-col space-y-0.5">
                           {summoner1Img ? <img src={summoner1Img} alt="S1" className="w-5 h-5 rounded" /> : <div className="w-5 h-5 rounded bg-gray-700"></div>}
                           {summoner2Img ? <img src={summoner2Img} alt="S2" className="w-5 h-5 rounded" /> : <div className="w-5 h-5 rounded bg-gray-700"></div>}
                        </div>
                        <div className="w-px h-full bg-gray-600/50 self-stretch mx-0.5"></div> {/* Vertical Line */}
                        <div className="flex flex-col space-y-0.5">
                           {primaryRuneImg ? <img src={primaryRuneImg} alt="R1" className="w-5 h-5 rounded bg-black/20 p-0.5" /> : <div className="w-5 h-5 rounded bg-gray-700"></div>}
                           {subStyleImg ? <img src={subStyleImg} alt="R2" className="w-5 h-5 rounded bg-black/20 p-0.5" /> : <div className="w-5 h-5 rounded bg-gray-700"></div>}
                        </div>
                         <div className="w-px h-full bg-gray-600/50 self-stretch mx-0.5"></div> {/* Vertical Line */}
                        <div className="flex items-center">
                            <div className="grid grid-cols-3 gap-0.5">
                                {items.map((itemSrc, idx) => itemSrc ? 
                                    <img key={`item-${idx}`} src={itemSrc} alt={`Item ${idx}`} className="w-5 h-5 rounded bg-black/20"/> 
                                    : <div key={`item-${idx}`} className="w-5 h-5 rounded bg-gray-700"></div>
                                )}
                            </div>
                            {trinket ? 
                                <img src={trinket} alt="Trinket" className="w-5 h-5 rounded self-center bg-black/20 ml-0.5"/> 
                                : <div className="w-5 h-5 rounded self-center bg-gray-700 ml-0.5"></div>
                            }
                        </div>
                      </div>

                      {/* KDA & Stats */}
                      <div className="flex-grow min-w-[70px] text-xs px-2 text-center sm:text-left">
                        <p className="font-medium text-gray-100">{getKDA(participantData)}</p>
                        <p className="text-gray-400">{cs} CS ({csPerMin}/m)</p>
                        <p className="text-yellow-400/80">{(match.goldEarned / 1000).toFixed(1)}k G</p>
                        <p className="text-gray-400">Lvl {match.championLevel || 'N/A'}</p>
                      </div>
                      
                       <div className="flex-shrink-0 text-[10px] text-gray-500 w-20 text-right truncate hidden md:block" title={`${match.trackedAccountName} (${match.trackedAccountPlatform?.toUpperCase()})`}>
                           {match.trackedAccountName}
                       </div>

                      <div className="flex-shrink-0 flex flex-col space-y-1 ml-2">
                          <button className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded text-[10px] flex items-center w-full justify-center leading-tight">
                              <Star size={12} className="mr-1" /> Rate
                          </button>
                          <button className="bg-sky-700 hover:bg-sky-600 text-white px-2 py-1 rounded text-[10px] flex items-center w-full justify-center leading-tight">
                              <MessageSquare size={12} className="mr-1" /> Notes
                          </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MatchHistoryPage;
