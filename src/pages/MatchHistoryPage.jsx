// src/pages/MatchHistoryPage.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, doc, getDoc, setDoc, Timestamp, query, orderBy, limit, updateDoc } from 'firebase/firestore';
import {
    Loader2, AlertTriangle, ListChecks, MessageSquare, RefreshCw, ImageOff, ChevronDown, ChevronUp, Edit,
} from 'lucide-react';
import MatchNotesPanel from '../components/MatchNotesPanel';
import PaginationControls from '../components/PaginationControls';
import ExpandedMatchDetails from '../components/ExpandedMatchDetails'; 

// Import utility functions
import {
    getContinentalRoute,
    delay,
    timeAgo,
    formatGameDurationMMSS,
    formatGameMode,
    getKDAColorClass,
    getKDAStringSpans,
    getKDARatio,
    getCSString,
    processTimelineData, // This function is now more generalized
    QUEUE_IDS
} from '../utils/matchCalculations';


// Import role icons
import topIcon from '../assets/top_icon.svg';
import jungleIcon from '../assets/jungle_icon.svg';
import middleIcon from '../assets/mid_icon.svg';
import bottomIcon from '../assets/bottom_icon.svg';
import supportIcon from '../assets/support_icon.svg';

const RIOT_API_KEY = import.meta.env.VITE_RIOT_API_KEY;

const MATCH_COUNT_PER_FETCH = 20; // Number of match IDs to fetch per account from Riot API
const MATCH_DETAILS_TO_PROCESS_PER_ACCOUNT_UPDATE = 10; // Max new match details to process per account in one "Update All" run
const API_CALL_DELAY_MS = 1250; 
const MATCHES_PER_PAGE = 10; // Matches displayed per page in the UI

// Role icon mapping - exported so ExpandedMatchDetails can use them
export const ROLE_ICON_MAP = {
    TOP: topIcon, JUNGLE: jungleIcon, MIDDLE: middleIcon,
    BOTTOM: bottomIcon, UTILITY: supportIcon 
};
// Order of roles for sorting players in scoreboard
export const ROLE_ORDER = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];


function MatchHistoryPage() {
  const [trackedAccounts, setTrackedAccounts] = useState([]);
  const [allMatchesFromDb, setAllMatchesFromDb] = useState([]);
  const [groupedMatches, setGroupedMatches] = useState({});
  const [selectedMatchForNotes, setSelectedMatchForNotes] = useState(null);
  const [expandedMatchId, setExpandedMatchId] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [isUpdatingAllMatches, setIsUpdatingAllMatches] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [updateProgress, setUpdateProgress] = useState('');

  const [error, setError] = useState('');
  const [ddragonVersion, setDdragonVersion] = useState('');
  const [summonerSpellsMap, setSummonerSpellsMap] = useState({});
  const [runesMap, setRunesMap] = useState({});
  const [championData, setChampionData] = useState(null); 

  const matchListContainerRef = useRef(null); 
  const prevPageRef = useRef(currentPage); 

  // Fetch static DDragon data (versions, champions, spells, runes)
  useEffect(() => {
    if (!RIOT_API_KEY) setError("Configuration Error: Riot API Key is missing.");
    fetch('https://ddragon.leagueoflegends.com/api/versions.json')
      .then(res => res.json())
      .then(versions => {
        if (versions && versions.length > 0) {
          const latestVersion = versions[0];
          setDdragonVersion(latestVersion);
          const staticDataFetches = [
            fetch(`https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/en_US/summoner.json`).then(res => res.json()),
            fetch(`https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/en_US/runesReforged.json`).then(res => res.json()),
            fetch(`https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/en_US/champion.json`).then(res => res.json())
          ];
          Promise.all(staticDataFetches).then(([summonerData, runesData, champData]) => {
            const spells = {};
            if (summonerData && summonerData.data) {
              for (const key in summonerData.data) spells[summonerData.data[key].key] = summonerData.data[key];
            }
            setSummonerSpellsMap(spells);

            const runes = {};
            if (runesData && Array.isArray(runesData)) {
              runesData.forEach(style => {
                runes[style.id] = { icon: style.icon, name: style.name }; 
                style.slots.forEach(slot => slot.runes.forEach(rune => runes[rune.id] = { icon: rune.icon, name: rune.name, styleId: style.id }));
              });
            }
            setRunesMap(runes);
            if (champData && champData.data) {
                setChampionData(champData.data); 
            }
          }).catch(err => console.error("Error fetching DDragon static data:", err));
        }
      }).catch(err => console.error("Failed to fetch DDragon versions:", err));
  }, []);

  const accountsCollectionRef = useMemo(() => db ? collection(db, "trackedAccounts") : null, []);

  // Fetch tracked accounts from Firestore
  const fetchTrackedAccounts = useCallback(async () => {
    if (!accountsCollectionRef) { setError("Firestore not available."); setIsLoadingAccounts(false); return; }
    setIsLoadingAccounts(true);
    try {
      const data = await getDocs(accountsCollectionRef);
      setTrackedAccounts(data.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    } catch (err) { console.error("Error fetching tracked accounts:", err); setError("Could not load tracked accounts.");
    } finally { setIsLoadingAccounts(false); }
  }, [accountsCollectionRef]);

  useEffect(() => { fetchTrackedAccounts(); }, [fetchTrackedAccounts]);

  // Fetch all matches from DB for all tracked accounts
   const fetchAllMatchesFromDb = useCallback(async () => {
    if (trackedAccounts.length === 0 || !db) {
      setAllMatchesFromDb([]);
      setGroupedMatches({});
      setTotalPages(0);
      setIsLoadingMatches(false);
      return;
    }
    setIsLoadingMatches(true); setError('');
    let combinedMatches = [];
    try {
      for (const account of trackedAccounts) {
        const matchesSubCollectionRef = collection(db, "trackedAccounts", account.id, "matches");
        const q = query(matchesSubCollectionRef, orderBy("gameCreation", "desc"), limit(200)); 
        const querySnapshot = await getDocs(q);
        const accountMatches = querySnapshot.docs.map(docData => ({
            id: docData.id, ...docData.data(),
            trackedAccountDocId: account.id, 
            trackedAccountName: `${account.name}#${account.tag}`,
            trackedAccountPlatform: account.platformId
        }));
        combinedMatches = [...combinedMatches, ...accountMatches];
      }
      combinedMatches.sort((a, b) => (b.gameCreation?.seconds || 0) - (a.gameCreation?.seconds || 0));
      setAllMatchesFromDb(combinedMatches);
      setTotalPages(Math.ceil(combinedMatches.length / MATCHES_PER_PAGE));
      setCurrentPage(1); 
      prevPageRef.current = 1; 
    } catch (err) { console.error(`Error fetching stored matches:`, err); setError(`Failed to load stored matches.`);
    } finally { setIsLoadingMatches(false); }
  }, [trackedAccounts]); 

  useEffect(() => {
    if (trackedAccounts.length > 0) {
        fetchAllMatchesFromDb();
    } else {
        setAllMatchesFromDb([]);
        setGroupedMatches({});
        setTotalPages(0);
    }
  }, [trackedAccounts, fetchAllMatchesFromDb]);

  // Effect to group matches by date when currentPage or allMatchesFromDb changes
  useEffect(() => {
    if (allMatchesFromDb.length === 0) {
      setGroupedMatches({});
      return;
    }
    const startIndex = (currentPage - 1) * MATCHES_PER_PAGE;
    const endIndex = startIndex + MATCHES_PER_PAGE;
    const matchesForCurrentPage = allMatchesFromDb.slice(startIndex, endIndex);

    const groups = matchesForCurrentPage.reduce((acc, match) => {
      if (!match.gameCreation || !match.gameCreation.seconds) return acc; 
      const dateObj = new Date(match.gameCreation.seconds * 1000);
      const today = new Date(); const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
      let dateKey = dateObj.toDateString() === today.toDateString() ? "Today" : dateObj.toDateString() === yesterday.toDateString() ? "Yesterday" : dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(match);
      return acc;
    }, {});
    setGroupedMatches(groups);
  }, [currentPage, allMatchesFromDb]);

  // Effect to scroll to top when page changes
  useEffect(() => {
    const pageActuallyChanged = prevPageRef.current !== currentPage;
    prevPageRef.current = currentPage; 

    if (pageActuallyChanged) { 
      if (matchListContainerRef.current) {
        setTimeout(() => {
          if (matchListContainerRef.current) {
            if (matchListContainerRef.current.scrollHeight > matchListContainerRef.current.clientHeight) {
              matchListContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }
        }, 0);
      }
    }
  }, [currentPage, groupedMatches, selectedMatchForNotes]); 

  // Function to handle updating all matches for all tracked accounts
  const handleUpdateAllMatches = async () => {
    if (!RIOT_API_KEY) { setError("Riot API Key is missing."); return; }
    if (trackedAccounts.length === 0) { setError("No tracked accounts to update."); return; }

    setIsUpdatingAllMatches(true); setError('');
    setUpdateProgress(`Starting update for ${trackedAccounts.length} accounts...`);
    let totalNewMatchesActuallyStored = 0;
    const twoWeeksAgoEpochSeconds = Math.floor((Date.now() - 14 * 24 * 60 * 60 * 1000) / 1000); 

    for (let i = 0; i < trackedAccounts.length; i++) {
      const account = trackedAccounts[i];
      if (!account.puuid || !account.platformId) {
        setUpdateProgress(`Skipped ${account.name}#${account.tag} (missing PUUID/Platform). (${i + 1}/${trackedAccounts.length})`);
        continue;
      }
      setUpdateProgress(`Updating ${account.name}#${account.tag} (${i + 1}/${trackedAccounts.length})...`);
      try {
        const continentalRoute = getContinentalRoute(account.platformId);
        // Fetch only Ranked Solo/Duo games for now, can be expanded
        const matchlistUrl = `https://${continentalRoute}.api.riotgames.com/lol/match/v5/matches/by-puuid/${account.puuid}/ids?startTime=${twoWeeksAgoEpochSeconds}&queue=${QUEUE_IDS.RANKED_SOLO}&count=${MATCH_COUNT_PER_FETCH}&api_key=${RIOT_API_KEY}`;
        await delay(API_CALL_DELAY_MS); 
        const response = await fetch(matchlistUrl);
        if (!response.ok) {
            const errData = await response.json().catch(() => ({ message: "Unknown Riot API error (fetching match IDs)" }));
            console.error(`Riot API error for ${account.name} (Match IDs): ${response.status}`, errData);
            setError(`Error for ${account.name} (IDs): ${errData.status?.message || response.statusText}`);
            continue; 
        }
        const matchIdsFromApi = await response.json();
        if (matchIdsFromApi.length === 0) {
            setUpdateProgress(`No new API matches for ${account.name}#${account.tag}. (${i + 1}/${trackedAccounts.length})`);
            continue;
        }

        setUpdateProgress(`Found ${matchIdsFromApi.length} recent IDs for ${account.name}. Checking & fetching details...`);

        let newMatchesProcessedForThisAccount = 0;
        for (const matchId of matchIdsFromApi) {
          if (newMatchesProcessedForThisAccount >= MATCH_DETAILS_TO_PROCESS_PER_ACCOUNT_UPDATE) break; 

          const matchDocRef = doc(db, "trackedAccounts", account.id, "matches", matchId);
          const docSnap = await getDoc(matchDocRef);

          // If document exists and has rawTimelineFrames, assume it's fully processed.
          // The processedTimelineForTrackedPlayer might be re-calculated if logic changes, but raw frames are key.
          if (docSnap.exists() && docSnap.data().rawTimelineFrames && docSnap.data().allParticipants) {
              console.log(`Match ${matchId} for ${account.name} already has raw timeline. Skipping re-fetch of timeline, will re-process if needed or merge details.`);
              // Optionally, one could re-fetch matchDetail if only timeline was missing, but for simplicity,
              // if rawTimelineFrames exists, we assume the core data is there.
              // We will still setDoc later to ensure all fields are up-to-date based on current processing logic.
          }

          setUpdateProgress(`Fetching match details ${matchId} for ${account.name}...`);
          await delay(API_CALL_DELAY_MS);
          const matchDetailUrl = `https://${continentalRoute}.api.riotgames.com/lol/match/v5/matches/${matchId}?api_key=${RIOT_API_KEY}`;
          const detailResponse = await fetch(matchDetailUrl);

          if (!detailResponse.ok) {
            console.warn(`Failed to fetch match details for ${matchId} (Account: ${account.name}). Status: ${detailResponse.status}`);
            continue; 
          }
          const matchDetail = await detailResponse.json();
          
          let currentRawTimelineFrames = docSnap.exists() ? docSnap.data().rawTimelineFrames : null;
          // Fetch timeline data only if not already present or if we decide to always refresh it
          if (!currentRawTimelineFrames || currentRawTimelineFrames.length === 0) {
            setUpdateProgress(`Fetching timeline for ${matchId}...`);
            await delay(API_CALL_DELAY_MS);
            const timelineUrl = `https://${continentalRoute}.api.riotgames.com/lol/match/v5/matches/${matchId}/timeline?api_key=${RIOT_API_KEY}`;
            const timelineResponse = await fetch(timelineUrl);
            if (timelineResponse.ok) {
              const timelineJson = await timelineResponse.json();
              currentRawTimelineFrames = timelineJson.info?.frames || [];
            } else {
              console.warn(`Failed to fetch timeline for match ${matchId}. Status: ${timelineResponse.status}`);
              currentRawTimelineFrames = []; // Ensure it's an empty array if fetch fails
            }
          }


          const playerParticipant = matchDetail.info.participants.find(p => p.puuid === account.puuid);

          if (playerParticipant) {
            const perks = playerParticipant.perks || {};
            const primaryStyle = perks.styles?.find(s => s.description === 'primaryStyle');
            const subStyle = perks.styles?.find(s => s.description === 'subStyle');
            
            let opponentParticipant = null;
            let opponentParticipantIdForTimeline = null; 
            if (playerParticipant.teamPosition && playerParticipant.teamPosition !== '') { 
                opponentParticipant = matchDetail.info.participants.find(p =>
                    p.teamId !== playerParticipant.teamId &&
                    p.teamPosition === playerParticipant.teamPosition
                );
            }
            if (opponentParticipant) {
                opponentParticipantIdForTimeline = matchDetail.info.participants.findIndex(p => p.puuid === opponentParticipant.puuid) + 1;
            }
            const playerParticipantIdForTimeline = matchDetail.info.participants.findIndex(p => p.puuid === playerParticipant.puuid) + 1;

            // Process timeline data specifically for the tracked player and their direct opponent
            const processedTimelineForTrackedPlayer = processTimelineData(
                currentRawTimelineFrames, // Use fetched or existing raw frames
                playerParticipantIdForTimeline, 
                opponentParticipantIdForTimeline,
                matchDetail.info.gameDuration 
            );

            const matchDataToStore = {
              matchId: matchDetail.metadata.matchId,
              gameCreation: Timestamp.fromMillis(matchDetail.info.gameCreation),
              gameDuration: matchDetail.info.gameDuration,
              gameMode: matchDetail.info.gameMode,
              queueId: matchDetail.info.queueId,
              platformId: account.platformId, puuid: account.puuid, 
              win: playerParticipant.win, championName: playerParticipant.championName,
              championId: playerParticipant.championId, championLevel: playerParticipant.champLevel,
              teamPosition: playerParticipant.teamPosition, 
              kills: playerParticipant.kills, deaths: playerParticipant.deaths, assists: playerParticipant.assists,
              totalMinionsKilled: playerParticipant.totalMinionsKilled, neutralMinionsKilled: playerParticipant.neutralMinionsKilled,
              goldEarned: playerParticipant.goldEarned,
              item0: playerParticipant.item0, item1: playerParticipant.item1, item2: playerParticipant.item2,
              item3: playerParticipant.item3, item4: playerParticipant.item4, item5: playerParticipant.item5,
              item6: playerParticipant.item6, 
              summoner1Id: playerParticipant.summoner1Id, summoner2Id: playerParticipant.summoner2Id,
              primaryPerkId: primaryStyle?.selections?.[0]?.perk, subStyleId: subStyle?.style,
              opponentChampionName: opponentParticipant ? opponentParticipant.championName : null,
              notes: docSnap.exists() ? docSnap.data().notes || "" : "",
              goals: docSnap.exists() ? docSnap.data().goals || "" : "",
              rating: docSnap.exists() ? docSnap.data().rating || null : null,
              allParticipants: matchDetail.info.participants.map(p => ({
                puuid: p.puuid, summonerName: p.summonerName, 
                riotIdGameName: p.riotIdGameName, riotIdTagline: p.riotIdTagline, 
                championName: p.championName, champLevel: p.champLevel, teamId: p.teamId, teamPosition: p.teamPosition,
                kills: p.kills, deaths: p.deaths, assists: p.assists,
                totalMinionsKilled: p.totalMinionsKilled, neutralMinionsKilled: p.neutralMinionsKilled,
                goldEarned: p.goldEarned, totalDamageDealtToChampions: p.totalDamageDealtToChampions,
                visionScore: p.visionScore, wardsPlaced: p.wardsPlaced, wardsKilled: p.wardsKilled,
                visionWardsBoughtInGame: p.visionWardsBoughtInGame,
                item0: p.item0, item1: p.item1, item2: p.item2, item3: p.item3, item4: p.item4, item5: p.item5, item6: p.item6,
                summoner1Id: p.summoner1Id, summoner2Id: p.summoner2Id,
                perks: p.perks, 
              })),
              teamObjectives: matchDetail.info.teams.map(t => ({
                teamId: t.teamId, win: t.win, objectives: t.objectives
              })),
              processedTimelineForTrackedPlayer: processedTimelineForTrackedPlayer, 
              rawTimelineFrames: currentRawTimelineFrames, // Store/update raw frames
            };
            await setDoc(matchDocRef, matchDataToStore, { merge: true }); 
            if (!docSnap.exists() || !docSnap.data().rawTimelineFrames) { // Count as new only if raw timeline wasn't there
                totalNewMatchesActuallyStored++;
            }
            newMatchesProcessedForThisAccount++;
          }
        }
      } catch (err) {
        console.error(`Error processing account ${account.name}#${account.tag}:`, err);
        setError(`Update error for ${account.name}. Check console.`);
      }
    }
    setUpdateProgress(`Update finished. Processed details for up to ${MATCH_DETAILS_TO_PROCESS_PER_ACCOUNT_UPDATE * trackedAccounts.length} matches. Newly stored/fully updated with timeline: ${totalNewMatchesActuallyStored}.`);
    setIsUpdatingAllMatches(false);
    fetchAllMatchesFromDb(); 
  };

  // Handlers for notes panel
  const handleOpenNotes = (match) => { setSelectedMatchForNotes(match); };
  const handleCloseNotes = () => { setSelectedMatchForNotes(null); };

  // Save notes and goals to Firestore
  const handleSaveNotes = async (matchDocumentId, newNotes, newGoals) => {
    if (!selectedMatchForNotes || !db || !selectedMatchForNotes.trackedAccountDocId) {
      setError("Error: Cannot save notes. Missing match or account data.");
      return;
    }
    setIsSavingNotes(true);
    const matchDocRef = doc(db, "trackedAccounts", selectedMatchForNotes.trackedAccountDocId, "matches", matchDocumentId);
    try {
      await updateDoc(matchDocRef, { notes: newNotes, goals: newGoals });
      setAllMatchesFromDb(prevMatches => prevMatches.map(m =>
        m.id === matchDocumentId ? { ...m, notes: newNotes, goals: newGoals } : m
      ));
      setSelectedMatchForNotes(prev => prev && prev.id === matchDocumentId ? {...prev, notes: newNotes, goals: newGoals} : prev);
    } catch (err) {
      console.error("Error saving notes:", err);
      setError("Failed to save notes. Please try again.");
    }
    finally { setIsSavingNotes(false); }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    setExpandedMatchId(null); 
  };

  // Helper functions for DDragon data (images, names)
  const getChampionInfo = (championKeyApi) => {
    if (!championData || !championKeyApi) return { displayName: championKeyApi, imageName: championKeyApi + ".png" }; 
    let ddragonKeyToLookup = championKeyApi === "Fiddlesticks" ? "FiddleSticks" : championKeyApi;
    const championInfo = championData[ddragonKeyToLookup] || Object.values(championData).find(c => c.id.toLowerCase() === championKeyApi.toLowerCase());
    return championInfo ? { displayName: championInfo.name, imageName: championInfo.image.full } : { displayName: championKeyApi, imageName: championKeyApi + ".png" };
  };
  const getChampionImage = (championKeyApi) => !championKeyApi || !ddragonVersion || !championData ? `https://placehold.co/56x56/2D2D2D/666?text=${championKeyApi ? championKeyApi.substring(0,1) : '?'}` : `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${getChampionInfo(championKeyApi).imageName}`;
  const getChampionDisplayName = (championKeyApi) => !championKeyApi || !championData ? (championKeyApi || 'N/A') : getChampionInfo(championKeyApi).displayName;
  const getItemImage = (itemId) => !itemId || !ddragonVersion || itemId === 0 ? null : `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/item/${itemId}.png`;
  const getSummonerSpellImage = (spellId) => !spellId || !ddragonVersion || !summonerSpellsMap[spellId] ? null : `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/spell/${summonerSpellsMap[spellId].image.full}`;
  const getRuneImage = (runeId) => {
    if (!runeId || !ddragonVersion || !runesMap[runeId] || !runesMap[runeId].icon) return null;
    return `https://ddragon.leagueoflegends.com/cdn/img/${runesMap[runeId].icon}`;
  };

  // Toggle expanded match view
  const toggleExpandMatch = (matchId) => {
    setExpandedMatchId(prevId => (prevId === matchId ? null : matchId));
  };

  // Conditional rendering for API key error
  if (!RIOT_API_KEY && !error.includes("Configuration Error")) { 
      return (
          <div className="p-4 sm:p-6 md:p-8 text-gray-100 flex flex-col items-center justify-center h-full">
              <AlertTriangle size={48} className="text-red-500 mb-4" />
              <h2 className="text-2xl font-semibold text-red-400 mb-2">Configuration Error</h2>
              <p className="text-gray-300 text-center max-w-md">
                  Riot API Key is missing. Please ensure it is correctly set in your environment variables (VITE_RIOT_API_KEY).
              </p>
          </div>
      );
  }

  return (
    <div className="flex flex-1 overflow-hidden h-[calc(100vh-4rem)]"> 
        <div
            ref={matchListContainerRef}
            className={`text-gray-100 transition-all duration-300 ease-in-out overflow-y-auto h-full
                        ${selectedMatchForNotes ? 'w-full md:w-3/5 lg:w-2/3 xl:w-3/4' : 'w-full'}`} 
        >
            <header className="mb-6 mt-4 px-4 sm:px-6 md:px-8 flex justify-end items-center">
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
                <div className="mb-4 p-3 bg-sky-900/50 text-sky-300 border border-sky-700/50 rounded-md text-sm text-center max-w-4xl mx-auto px-4 sm:px-6 md:px-8">
                <p>{updateProgress}</p>
                </div>
            )}
            {error && (
                <div className="mb-6 p-4 bg-red-900/30 text-red-300 border border-red-700/50 rounded-md max-w-4xl mx-auto px-4 sm:px-6 md:px-8">
                <p><AlertTriangle size={18} className="inline mr-2" />Error: {error}</p>
                </div>
            )}

            {isLoadingMatches && !isUpdatingAllMatches && ( 
                <div className="flex flex-col items-center justify-center p-10 bg-gray-800/80 backdrop-blur-md rounded-xl shadow-xl border border-gray-700/50 max-w-4xl mx-auto mt-8">
                <Loader2 size={40} className="text-orange-500 animate-spin" />
                <p className="text-gray-300 mt-4 text-lg">Loading matches...</p>
                </div>
            )}

            {!isLoadingMatches && Object.keys(groupedMatches).length === 0 && !error && !isUpdatingAllMatches && (
                <div className="text-center py-10 px-6 bg-gray-800/80 backdrop-blur-md rounded-xl shadow-xl border border-dashed border-gray-700/50 max-w-4xl mx-auto mt-8">
                    <ListChecks size={48} className="text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 text-lg">No matches found for this page.</p>
                    {allMatchesFromDb.length > 0 && <p className="text-gray-500 text-sm">Try a different page or update matches.</p>}
                    {allMatchesFromDb.length === 0 && <p className="text-gray-500 text-sm">Click "Update All" to fetch recent games, or add accounts on the 'Accounts' page.</p>}
                </div>
            )}

            {!isLoadingMatches && Object.keys(groupedMatches).length > 0 && (
              <div className="space-y-3 max-w-4xl mx-auto px-4 sm:px-6 md:px-8 pb-8"> 
                {Object.entries(groupedMatches).map(([dateKey, matchesOnDate]) => (
                  <div key={dateKey}>
                    <h2 className="text-lg font-semibold text-orange-400 mb-3 pb-1.5 border-b border-gray-700/80">
                        {dateKey}
                    </h2>
                    <div className="space-y-1"> 
                        {matchesOnDate.map(match => {
                        const participantData = match; 
                        const isWin = typeof match.win === 'boolean' ? match.win : null; 
                        const kdaStringSpans = getKDAStringSpans(participantData);
                        const kdaRatio = getKDARatio(participantData);
                        const kdaColorClass = getKDAColorClass(participantData.kills, participantData.deaths, participantData.assists);
                        const csString = getCSString(participantData);
                        const gameModeDisplay = formatGameMode(match.gameMode, match.queueId);
                        const gameDurationFormatted = formatGameDurationMMSS(match.gameDuration);

                        const itemsRow1 = [match.item0, match.item1, match.item2].map(id => getItemImage(id));
                        const itemsRow2 = [match.item3, match.item4, match.item5].map(id => getItemImage(id));
                        const trinketImg = getItemImage(match.item6);

                        const summoner1Img = getSummonerSpellImage(match.summoner1Id);
                        const summoner2Img = getSummonerSpellImage(match.summoner2Id);
                        const primaryRuneImg = getRuneImage(match.primaryPerkId);
                        const subStyleImg = getRuneImage(match.subStyleId);

                        const playerRoleIcon = match.teamPosition ? ROLE_ICON_MAP[match.teamPosition.toUpperCase()] : null;
                        const hasNotesOrGoals = (match.notes && match.notes.trim() !== '') || (match.goals && match.goals.trim() !== '');

                        const resultBgOverlayClass = isWin === null
                        ? 'bg-gray-800/25' 
                        : (isWin ? 'bg-blue-900/20' : 'bg-red-900/20'); 

                        const expandButtonBgClass = isWin === null ? 'bg-gray-700/60 hover:bg-gray-600/80' : (isWin ? 'bg-[#263964] hover:bg-[#304A80]' : 'bg-[#42212C] hover:bg-[#582C3A]');
                        const isExpanded = expandedMatchId === match.id;

                        return (
                              <div key={match.id} className={`rounded-lg shadow-lg overflow-hidden group ${resultBgOverlayClass}`}>
                                <div className={`flex items-stretch ${isExpanded ? 'rounded-t-lg' : 'rounded-lg'} ${resultBgOverlayClass}`}> 
                                    <div className="flex flex-1 items-stretch p-3 ml-1"> 
                                        <div className="flex flex-col justify-around items-start w-40 flex-shrink-0 mr-2 space-y-0.5">
                                            <p className={`text-md font-semibold text-gray-50`}>{gameModeDisplay}</p>
                                            <div className="flex justify-start items-baseline w-full text-xs">
                                                <span className="text-gray-200 mr-2.5">{gameDurationFormatted}</span>
                                                <span className="text-gray-400">{timeAgo(match.gameCreation.seconds)}</span>
                                            </div>
                                            <div className="text-xs text-gray-400 truncate w-full pt-0.5" title={`${match.trackedAccountName} (${match.trackedAccountPlatform?.toUpperCase()})`}>
                                                <span className="truncate">{match.trackedAccountName}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-center space-x-1.5 flex-shrink-0 mx-1">
                                            <div className="relative">
                                                <img
                                                    src={getChampionImage(match.championName)}
                                                    alt={getChampionDisplayName(match.championName)}
                                                    className="w-12 h-12 rounded-md border-2 border-gray-600 shadow-md"
                                                    onError={(e) => { (e.target.src = `https://placehold.co/48x48/222/ccc?text=${match.championName ? match.championName.substring(0,1) : '?'}`); }}
                                                />
                                                {playerRoleIcon &&
                                                    <img src={playerRoleIcon} alt={match.teamPosition || "Role"} className="absolute -bottom-1 -left-1 w-5 h-5 p-0.5 bg-gray-950 rounded-full border border-gray-500 shadow-sm" />
                                                }
                                            </div>
                                            <div className="text-gray-400 text-sm font-light self-center px-0.5">vs</div>
                                            <div className="relative">
                                                {match.opponentChampionName ? (
                                                    <img
                                                        src={getChampionImage(match.opponentChampionName)}
                                                        alt={getChampionDisplayName(match.opponentChampionName)}
                                                        className="w-12 h-12 rounded-md border-2 border-gray-700 opacity-90 shadow-md"
                                                        onError={(e) => { (e.target.src = `https://placehold.co/48x48/222/ccc?text=${match.opponentChampionName ? match.opponentChampionName.substring(0,1) : '?'}`); }}
                                                    />
                                                ) : (
                                                    <div className="w-12 h-12 bg-gray-700/50 rounded-md flex items-center justify-center border border-gray-600 shadow-md">
                                                        <ImageOff size={20} className="text-gray-500" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <div className="w-px bg-gray-700/60 self-stretch mx-3"></div>

                                        <div className="flex items-center space-x-2 bg-gray-900/70 p-2 rounded-lg shadow-inner border border-gray-700/50 flex-shrink-0">
                                            <div className="flex space-x-1">
                                                <div className="flex flex-col space-y-0.5">
                                                    <div className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center border border-gray-600/50">
                                                        {summoner1Img ? <img src={summoner1Img} alt="Summ. Spell 1" className="w-5 h-5 rounded-sm" /> : <div className="w-5 h-5 rounded-sm bg-gray-700"></div>}
                                                    </div>
                                                    <div className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center border border-gray-600/50">
                                                        {summoner2Img ? <img src={summoner2Img} alt="Summ. Spell 2" className="w-5 h-5 rounded-sm" /> : <div className="w-5 h-5 rounded-sm bg-gray-700"></div>}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col space-y-0.5">
                                                    <div className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center border border-gray-600/50 p-px">
                                                        {primaryRuneImg ? <img src={primaryRuneImg} alt="Primary Rune" className="w-5 h-5 rounded-sm" /> : <div className="w-4 h-4 rounded-sm bg-gray-700"></div>}
                                                    </div>
                                                    <div className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center border border-gray-600/50 p-px">
                                                        {subStyleImg ? <img src={subStyleImg} alt="Secondary Rune Style" className="w-4 h-4 rounded-sm" /> : <div className="w-4 h-4 rounded-sm bg-gray-700"></div>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col space-y-0.5">
                                                <div className="flex space-x-0.5">
                                                    {itemsRow1.map((itemSrc, idx) => (
                                                        <div key={`item-r1-${idx}`} className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center border border-gray-600/50">
                                                            {itemSrc ? <img src={itemSrc} alt={`Item ${idx+1}`} className="w-5 h-5 rounded-sm"/> : <div className="w-5 h-5 rounded-sm bg-gray-700"></div>}
                                                        </div>
                                                    ))}
                                                    <div className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center border border-gray-600/50">
                                                        {trinketImg ? <img src={trinketImg} alt="Trinket" className="w-5 h-5 rounded-sm"/> : <div className="w-5 h-5 rounded-sm bg-gray-700"></div> }
                                                    </div>
                                                </div>
                                                <div className="flex space-x-0.5">
                                                    {itemsRow2.map((itemSrc, idx) => (
                                                        <div key={`item-r2-${idx}`} className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center border border-gray-600/50">
                                                            {itemSrc ? <img src={itemSrc} alt={`Item ${idx+4}`} className="w-5 h-5 rounded-sm"/> : <div className="w-5 h-5 rounded-sm bg-gray-700"></div>}
                                                        </div>
                                                    ))}
                                                    <div className="w-6 h-6"></div> 
                                                </div>
                                            </div>
                                        </div>

                                        <div className="w-px bg-gray-700/60 self-stretch mx-3"></div>
                                        
                                        <div className="flex flex-col justify-center flex-grow min-w-[100px] space-y-0.5">
                                            <p className="text-sm">{kdaStringSpans}</p>
                                            <p>
                                                <span className={`text-xs ${kdaColorClass}`}>{kdaRatio}</span>
                                                <span className="text-[10px] text-gray-400 ml-1">KDA</span>
                                            </p>
                                            <p className="text-gray-300 text-xs mt-0.5">{csString}</p>
                                        </div>

                                        <div className="flex items-center ml-auto pl-0.5">
                                            <button
                                                onClick={() => handleOpenNotes(match)}
                                                className={`p-1.5 rounded-md transition-all duration-150 shadow-sm hover:shadow-md flex items-center justify-center mr-2.5 w-auto h-auto
                                                            ${hasNotesOrGoals
                                                                ? 'bg-sky-600 hover:bg-sky-500 text-white' 
                                                                : 'bg-orange-600 hover:bg-orange-500 text-white'}`} 
                                                title={hasNotesOrGoals ? "View/Edit Notes" : "Add Notes"}
                                            >
                                                {hasNotesOrGoals ? <MessageSquare size={18} /> : <Edit size={18} />}
                                            </button>
                                        </div>
                                    </div>

                                    <button
                                        className={`flex items-center justify-center ${expandButtonBgClass} transition-colors w-8 cursor-pointer ${isExpanded ? 'rounded-tr-lg' : 'rounded-r-lg'}`}
                                        title={isExpanded ? "Collapse Details" : "Expand Details"}
                                        onClick={() => toggleExpandMatch(match.id)}
                                    >
                                        {isExpanded ? <ChevronUp size={18} className="text-gray-300 group-hover:text-orange-300"/> : <ChevronDown size={18} className="text-gray-400 group-hover:text-orange-300"/>}
                                    </button>
                                </div>
                                {isExpanded && (
                                    <ExpandedMatchDetails
                                        match={match} 
                                        ddragonVersion={ddragonVersion}
                                        championData={championData}
                                        summonerSpellsMap={summonerSpellsMap}
                                        runesMap={runesMap}
                                        getChampionImage={getChampionImage}
                                        getSummonerSpellImage={getSummonerSpellImage}
                                        getItemImage={getItemImage}
                                        getRuneImage={getRuneImage}
                                        getChampionDisplayName={getChampionDisplayName}
                                        isTrackedPlayerWin={isWin} 
                                        roleIconMap={ROLE_ICON_MAP} 
                                        roleOrder={ROLE_ORDER} 
                                        processTimelineDataForPlayer={processTimelineData} 
                                    />
                                )}
                            </div>
                        );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isLoadingMatches && totalPages > 1 && (
                <PaginationControls
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                />
            )}
        </div>

        {selectedMatchForNotes && (
            <MatchNotesPanel
                match={selectedMatchForNotes}
                championData={championData} 
                ddragonVersion={ddragonVersion} 
                onSave={handleSaveNotes}
                onClose={handleCloseNotes}
                isLoading={isSavingNotes}
            />
        )}
    </div>
  );
}

export default MatchHistoryPage;
