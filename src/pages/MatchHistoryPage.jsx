// src/pages/MatchHistoryPage.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, doc, getDoc, setDoc, Timestamp, query, orderBy, limit, updateDoc } from 'firebase/firestore';
import { Loader2, AlertTriangle, ListChecks, MessageSquare, RefreshCw, ImageOff, Globe, Edit, ChevronDown, Star, TrendingUp, TrendingDown, ShieldCheck, Swords, Skull, Coins, Gamepad2 } from 'lucide-react'; 
import MatchNotesPanel from '../components/MatchNotesPanel'; 
import PaginationControls from '../components/PaginationControls';

// Import role icons
import topIcon from '../assets/top_icon.svg';
import jungleIcon from '../assets/jungle_icon.svg';
import middleIcon from '../assets/mid_icon.svg';
import bottomIcon from '../assets/bottom_icon.svg';
import supportIcon from '../assets/support_icon.svg';

const RIOT_API_KEY = import.meta.env.VITE_RIOT_API_KEY;
const RANKED_SOLO_QUEUE_ID = 420; // Used to identify Ranked Solo/Duo games
const MATCH_COUNT_PER_FETCH = 20; 
const MATCH_DETAILS_TO_PROCESS_PER_ACCOUNT_UPDATE = 10; 
const API_CALL_DELAY_MS = 1250;
const MATCHES_PER_PAGE = 15; 

// Helper function to determine the continental route for Riot API calls based on platformId
const getContinentalRoute = (platformId) => {
  if (!platformId) return 'europe'; // Default to Europe
  const lowerPlatformId = platformId.toLowerCase();
  if (['eun1', 'euw1', 'tr1', 'ru'].includes(lowerPlatformId)) return 'europe';
  if (['na1', 'br1', 'la1', 'la2', 'oc1'].includes(lowerPlatformId)) return 'americas';
  if (['kr', 'jp1'].includes(lowerPlatformId)) return 'asia';
  return 'europe'; // Fallback
};

// Utility function to introduce a delay, useful for rate limiting API calls
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Formats a Unix timestamp (in seconds) into a human-readable "time ago" string
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

// Formats game duration from seconds to a "Xm Ys" string
function formatGameDuration(durationSeconds) {
    if (typeof durationSeconds !== 'number') return 'N/A';
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = durationSeconds % 60;
    return `${minutes}m ${seconds < 10 ? '0' : ''}${seconds}s`;
}

// Helper function to format game mode display string
const formatGameMode = (gameMode, queueId) => {
    if (!gameMode) return 'Unknown Mode';
    if (gameMode === 'CLASSIC' && queueId === RANKED_SOLO_QUEUE_ID) return 'Ranked Solo';
    if (gameMode === 'CLASSIC' && queueId === 440) return 'Ranked Flex'; // Example for Flex
    if (gameMode === 'ARAM') return 'ARAM';
    if (gameMode === 'URF') return 'URF';
    // Add more specific game modes as needed
    // Fallback to a generic capitalized format
    return gameMode.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};


// Mapping of team positions (roles) to their respective icon images
const ROLE_ICON_MAP = {
    TOP: topIcon, JUNGLE: jungleIcon, MIDDLE: middleIcon,
    BOTTOM: bottomIcon, UTILITY: supportIcon 
};

function MatchHistoryPage() {
  // State for tracked accounts
  const [trackedAccounts, setTrackedAccounts] = useState([]);
  // State for all matches fetched from the database
  const [allMatchesFromDb, setAllMatchesFromDb] = useState([]); 
  // State for matches grouped by date for display
  const [groupedMatches, setGroupedMatches] = useState({}); 
  // State for the match currently selected for viewing/editing notes
  const [selectedMatchForNotes, setSelectedMatchForNotes] = useState(null); 
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1); 
  const [totalPages, setTotalPages] = useState(0);   

  // Loading states
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false); 
  const [isUpdatingAllMatches, setIsUpdatingAllMatches] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  // State for displaying progress during match updates
  const [updateProgress, setUpdateProgress] = useState('');
  
  // Error handling state
  const [error, setError] = useState('');
  // DDragon (League's static data CDN) states
  const [ddragonVersion, setDdragonVersion] = useState('');
  const [summonerSpellsMap, setSummonerSpellsMap] = useState({});
  const [runesMap, setRunesMap] = useState({});
  const [championData, setChampionData] = useState(null); 

  // Ref for the container of the match list, used for scrolling
  const matchListContainerRef = useRef(null); 
  // Ref to store the previous page number, to detect actual page changes
  const prevPageRef = useRef(currentPage); 

  // Effect to fetch DDragon static data (versions, spells, runes, champions) on component mount
  useEffect(() => {
    if (!RIOT_API_KEY) setError("Configuration Error: Riot API Key is missing.");
    fetch('https://ddragon.leagueoflegends.com/api/versions.json')
      .then(res => res.json())
      .then(versions => {
        if (versions && versions.length > 0) {
          const latestVersion = versions[0];
          setDdragonVersion(latestVersion);
          // Fetch summoner spells, runes, and champion data in parallel
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

  // Memoized reference to the Firestore collection for tracked accounts
  const accountsCollectionRef = useMemo(() => db ? collection(db, "trackedAccounts") : null, []);

  // Callback to fetch tracked accounts from Firestore
  const fetchTrackedAccounts = useCallback(async () => {
    if (!accountsCollectionRef) { setError("Firestore not available."); setIsLoadingAccounts(false); return; }
    setIsLoadingAccounts(true);
    try {
      const data = await getDocs(accountsCollectionRef);
      setTrackedAccounts(data.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    } catch (err) { console.error("Error fetching tracked accounts:", err); setError("Could not load tracked accounts.");
    } finally { setIsLoadingAccounts(false); }
  }, [accountsCollectionRef]);

  // Effect to fetch tracked accounts when the component mounts or the collection ref changes
  useEffect(() => { fetchTrackedAccounts(); }, [fetchTrackedAccounts]);

  // Callback to fetch all matches for all tracked accounts from the database
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
        // Query for matches, ordered by game creation time (descending), limited to 100 per account for performance
        const q = query(matchesSubCollectionRef, orderBy("gameCreation", "desc"), limit(100)); 
        const querySnapshot = await getDocs(q);
        const accountMatches = querySnapshot.docs.map(docData => ({ 
            id: docData.id, ...docData.data(),
            trackedAccountDocId: account.id, // Store parent document ID for easier updates
            trackedAccountName: `${account.name}#${account.tag}`, 
            trackedAccountPlatform: account.platformId 
        }));
        combinedMatches = [...combinedMatches, ...accountMatches];
      }
      // Sort all combined matches by game creation time
      combinedMatches.sort((a, b) => (b.gameCreation?.seconds || 0) - (a.gameCreation?.seconds || 0));
      setAllMatchesFromDb(combinedMatches);
      setTotalPages(Math.ceil(combinedMatches.length / MATCHES_PER_PAGE));
      setCurrentPage(1); // Reset to first page after fetching all matches
      prevPageRef.current = 1; // Reset prevPageRef as well
    } catch (err) { console.error(`Error fetching stored matches:`, err); setError(`Failed to load stored matches.`);
    } finally { setIsLoadingMatches(false); }
  }, [trackedAccounts]); 

  // Effect to fetch all matches when tracked accounts change
  useEffect(() => {
    if (trackedAccounts.length > 0) {
        fetchAllMatchesFromDb(); 
    } else {
        setAllMatchesFromDb([]);
        setGroupedMatches({});
        setTotalPages(0);
    }
  }, [trackedAccounts, fetchAllMatchesFromDb]);

  // Effect to update groupedMatches for display when currentPage or allMatchesFromDb changes
  useEffect(() => {
    if (allMatchesFromDb.length === 0) {
      setGroupedMatches({});
      return;
    }
    // Calculate start and end index for the current page
    const startIndex = (currentPage - 1) * MATCHES_PER_PAGE;
    const endIndex = startIndex + MATCHES_PER_PAGE;
    const matchesForCurrentPage = allMatchesFromDb.slice(startIndex, endIndex);

    // Group matches by date (Today, Yesterday, or specific date)
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

  // Effect for scrolling to top when currentPage changes or notes panel visibility changes
  useEffect(() => {
    const pageActuallyChanged = prevPageRef.current !== currentPage;
    // Always update prevPageRef to the current page for the next comparison.
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

  // Handler to update all matches from the Riot API
  const handleUpdateAllMatches = async () => {
    if (!RIOT_API_KEY) { setError("Riot API Key is missing."); return; }
    if (trackedAccounts.length === 0) { setError("No accounts are being tracked."); return; }

    setIsUpdatingAllMatches(true); setError('');
    setUpdateProgress(`Starting update for ${trackedAccounts.length} accounts...`);
    let totalNewMatchesActuallyStored = 0;
    // Fetch matches from the last two weeks
    const twoWeeksAgoEpochSeconds = Math.floor((Date.now() - 14 * 24 * 60 * 60 * 1000) / 1000);

    for (let i = 0; i < trackedAccounts.length; i++) {
      const account = trackedAccounts[i];
      if (!account.puuid || !account.platformId) { 
        setUpdateProgress(`Skipping ${account.name}#${account.tag} (missing PUUID/Platform). (${i + 1}/${trackedAccounts.length})`);
        continue; 
      }
      setUpdateProgress(`Updating ${account.name}#${account.tag} (${i + 1}/${trackedAccounts.length})...`);
      try {
        const continentalRoute = getContinentalRoute(account.platformId);
        // Fetch recent match IDs
        const matchlistUrl = `https://${continentalRoute}.api.riotgames.com/lol/match/v5/matches/by-puuid/${account.puuid}/ids?startTime=${twoWeeksAgoEpochSeconds}&queue=${RANKED_SOLO_QUEUE_ID}&count=${MATCH_COUNT_PER_FETCH}&api_key=${RIOT_API_KEY}`;
        await delay(API_CALL_DELAY_MS); // Respect API rate limits
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
        
        setUpdateProgress(`Found ${matchIdsFromApi.length} recent IDs for ${account.name}. Checking & fetching details...`);
        
        let newMatchesProcessedForThisAccount = 0;
        for (const matchId of matchIdsFromApi) {
          // Limit the number of new match details fetched per account in one update run
          if (newMatchesProcessedForThisAccount >= MATCH_DETAILS_TO_PROCESS_PER_ACCOUNT_UPDATE) break;
          
          const matchDocRef = doc(db, "trackedAccounts", account.id, "matches", matchId);
          const docSnap = await getDoc(matchDocRef);
          // Skip if match already exists in DB
          if (docSnap.exists()) continue;
          
          setUpdateProgress(`Fetching details for new match ${matchId} for ${account.name}...`);
          await delay(API_CALL_DELAY_MS); // Respect API rate limits
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
            // Try to find opponent in the same lane
            const opponentParticipant = matchDetail.info.participants.find(p => 
                p.teamId !== playerParticipant.teamId && 
                p.teamPosition === playerParticipant.teamPosition &&
                playerParticipant.teamPosition !== '' && p.teamPosition !== undefined
            );
            if (opponentParticipant) opponentChampionName = opponentParticipant.championName; 

            // Prepare data to store in Firestore
            const matchDataToStore = {
              matchId: matchDetail.metadata.matchId,
              gameCreation: Timestamp.fromMillis(matchDetail.info.gameCreation),
              gameDuration: matchDetail.info.gameDuration, 
              gameMode: matchDetail.info.gameMode,
              queueId: matchDetail.info.queueId, // Storing queueId for game mode formatting
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
              opponentChampionName: opponentChampionName,
              notes: "", goals: "", // Initialize notes and goals
              rating: null, // Initialize rating
            };
            await setDoc(matchDocRef, matchDataToStore);
            totalNewMatchesActuallyStored++; newMatchesProcessedForThisAccount++;
          }
        }
      } catch (err) { 
        console.error(`Error processing account ${account.name}#${account.tag}:`, err);
        setError(`Error updating ${account.name}. Check console.`);
      }
    }
    setUpdateProgress(`Update finished. Stored ${totalNewMatchesActuallyStored} new matches.`);
    setIsUpdatingAllMatches(false);
    // After updating, re-fetch all matches which will also reset currentPage to 1 and trigger scroll via useEffect
    fetchAllMatchesFromDb(); 
  };

  // Handlers for the notes panel
  const handleOpenNotes = (match) => { setSelectedMatchForNotes(match); };
  const handleCloseNotes = () => { setSelectedMatchForNotes(null); };

  // Handler to save notes and goals for a match
  const handleSaveNotes = async (matchDocumentId, newNotes, newGoals) => {
    if (!selectedMatchForNotes || !db || !selectedMatchForNotes.trackedAccountDocId) { 
      setError("Error: Cannot save notes. Match or account data missing.");
      return; 
    }
    setIsSavingNotes(true);
    const matchDocRef = doc(db, "trackedAccounts", selectedMatchForNotes.trackedAccountDocId, "matches", matchDocumentId);
    try {
      await updateDoc(matchDocRef, { notes: newNotes, goals: newGoals });
      // Update local state to reflect changes immediately
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

  // Handler for pagination page changes
  const handlePageChange = (page) => {
    // The useEffect hook that watches `currentPage`, `groupedMatches`, 
    // and `selectedMatchForNotes` will handle the scroll.
    setCurrentPage(page);
  };

  // Helper functions for displaying match data
  const getKDAString = (p) => !p || typeof p.kills === 'undefined' ? 'N/A' : `${p.kills} / ${p.deaths} / ${p.assists}`;
  const getKDARatio = (p) => {
    if (!p || typeof p.kills === 'undefined' || typeof p.deaths === 'undefined' || typeof p.assists === 'undefined') return '';
    if (p.deaths === 0) return 'Perfect KDA'; // Avoid division by zero
    return ((p.kills + p.assists) / p.deaths).toFixed(2) + ':1 KDA'; 
  };
  const getCSString = (p) => {
    if (!p || typeof p.totalMinionsKilled === 'undefined' || typeof p.neutralMinionsKilled === 'undefined' || !p.gameDuration || p.gameDuration === 0) return 'CS N/A';
    const totalCS = p.totalMinionsKilled + p.neutralMinionsKilled;
    const csPerMin = (totalCS / (p.gameDuration / 60)).toFixed(1);
    return `CS ${totalCS} (${csPerMin}/m)`; // Added /m for clarity
  };
  
  // DDragon data helpers
  const getChampionInfo = (championKeyApi) => {
    if (!championData || !championKeyApi) return { displayName: championKeyApi, imageName: championKeyApi + ".png" };
    // Handle specific case like Fiddlesticks which has different key in API vs DDragon
    let dKey = championKeyApi === "Fiddlesticks" ? "FiddleSticks" : championKeyApi; 
    const champ = championData[dKey] || Object.values(championData).find(c => c.id.toLowerCase() === championKeyApi.toLowerCase());
    return champ ? { displayName: champ.name, imageName: champ.image.full } : { displayName: championKeyApi, imageName: championKeyApi + ".png" };
  };
  const getChampionImage = (key) => !key || !ddragonVersion || !championData ? `https://placehold.co/48x48/2D2D2D/666?text=${key ? key.substring(0,1) : '?'}` : `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${getChampionInfo(key).imageName}`;
  const getChampionDisplayName = (key) => !key || !championData ? (key || 'N/A') : getChampionInfo(key).displayName;
  const getItemImage = (id) => !id || !ddragonVersion || id === 0 ? null : `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/item/${id}.png`;
  const getSummonerSpellImage = (id) => !id || !ddragonVersion || !summonerSpellsMap[id] ? null : `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/spell/${summonerSpellsMap[id].image.full}`;
  const getRuneImage = (id) => !id || !ddragonVersion || !runesMap[id] ? null : `https://ddragon.leagueoflegends.com/cdn/img/${runesMap[id].icon}`;

  // Conditional rendering for API key error
  if (!RIOT_API_KEY && !error.includes("Configuration Error")) { 
      return (
          <div className="p-4 sm:p-6 md:p-8 text-gray-100 flex flex-col items-center justify-center h-full">
              <AlertTriangle size={48} className="text-red-500 mb-4" />
              <h2 className="text-2xl font-semibold text-red-400 mb-2">Configuration Error</h2>
              <p className="text-gray-300 text-center max-w-md">
                  The Riot API Key is missing. Please ensure it is correctly set up in your environment variables (VITE_RIOT_API_KEY).
              </p>
          </div>
      );
  }
  
  return (
    <div className="flex flex-1 overflow-hidden h-[calc(100vh-4rem)]">
        <div 
            ref={matchListContainerRef} 
            className={`p-4 sm:p-6 md:p-8 text-gray-100 transition-all duration-300 ease-in-out overflow-y-auto h-full 
                        ${selectedMatchForNotes ? 'w-full md:w-3/5 lg:w-2/3 xl:w-3/4' : 'w-full'}`}
        >
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
                    <p className="text-gray-400 text-lg">No matches found for this page.</p>
                    {allMatchesFromDb.length > 0 && <p className="text-gray-500 text-sm">Try a different page or update matches.</p>}
                    {allMatchesFromDb.length === 0 && <p className="text-gray-500 text-sm">Click "Update All" to fetch recent games.</p>}
                </div>
            )}

            {!isLoadingMatches && Object.keys(groupedMatches).length > 0 && (
              // Main container for match cards
              <div className="space-y-3 max-w-5xl mx-auto"> 
                {Object.entries(groupedMatches).map(([dateKey, matchesOnDate]) => (
                  <div key={dateKey}>
                    <h2 className="text-lg font-semibold text-orange-400 mb-3 pb-1.5 border-b border-gray-700/80"> 
                        {dateKey}
                    </h2>
                    <div className="space-y-3"> 
                        {matchesOnDate.map(match => {
                        const participantData = match; 
                        const isWin = typeof match.win === 'boolean' ? match.win : null;
                        const kdaString = getKDAString(participantData);
                        const kdaRatio = getKDARatio(participantData);
                        const csString = getCSString(participantData);
                        const gameModeDisplay = formatGameMode(match.gameMode, match.queueId); // Get formatted game mode


                        const items = [match.item0, match.item1, match.item2, match.item3, match.item4, match.item5].map(id => getItemImage(id));
                        const trinket = getItemImage(match.item6);
                        const summoner1Img = getSummonerSpellImage(match.summoner1Id);
                        const summoner2Img = getSummonerSpellImage(match.summoner2Id);
                        const primaryRuneImg = getRuneImage(match.primaryPerkId);
                        const subStyleImg = getRuneImage(match.subStyleId);
                        
                        const playerRoleIcon = match.teamPosition ? ROLE_ICON_MAP[match.teamPosition.toUpperCase()] : null;
                        const hasNotesOrGoals = (match.notes && match.notes.trim() !== '') || (match.goals && match.goals.trim() !== '');

                        // Dynamic classes for win/loss styling
                        const resultBorderColor = isWin === null ? 'border-gray-600' : (isWin ? 'border-green-500' : 'border-red-500');
                        // Preserving original background color logic
                        const resultBgClasses  = isWin === null ? 'bg-gray-700/30' : (isWin ? 'bg-gradient-to-r from-green-800/20 via-gray-850/70 to-gray-850/70' : 'bg-gradient-to-r from-red-800/20 via-gray-850/70 to-gray-850/70');
                        
                        return (
                            // Adjusted individual match card - using py-2 px-2.5 for slightly less vertical padding
                            <div 
                                key={match.id} 
                                className={`relative flex items-center py-2 px-2.5 rounded-md shadow-md border ${resultBorderColor} ${resultBgClasses} transition-all duration-150 hover:shadow-lg hover:border-opacity-100 group`}
                            >
                                {/* Game Info, Mode & Account Name */}
                                <div className="flex flex-col justify-center items-start w-36 flex-shrink-0 mr-2 space-y-px"> {/* Reduced space-y */}
                                    <p className="text-xs text-gray-400">{formatGameDuration(match.gameDuration)}</p>
                                    {/* Game Mode Display */}
                                    <div className="flex items-center text-[10px] text-gray-500" title={gameModeDisplay}>
                                        <Gamepad2 size={11} className="mr-1 text-gray-600 flex-shrink-0"/>
                                        <span className="truncate">{gameModeDisplay}</span>
                                    </div>
                                    <p className="text-[10px] text-gray-500" title={new Date(match.gameCreation.seconds * 1000).toLocaleString()}>
                                        {timeAgo(match.gameCreation.seconds)}
                                    </p>
                                    <div className="text-[10px] text-gray-500 truncate flex items-center pt-0.5" title={`${match.trackedAccountName} (${match.trackedAccountPlatform?.toUpperCase()})`}>
                                        <Globe size={10} className="mr-1 text-gray-600 flex-shrink-0"/> 
                                        <span className="truncate">{match.trackedAccountName}</span>
                                    </div>
                                </div>

                                {/* Champion & Matchup Info */}
                                <div className="flex items-center justify-center space-x-1.5 flex-shrink-0">
                                    <div className="relative">
                                        <img 
                                            src={getChampionImage(match.championName)} 
                                            alt={getChampionDisplayName(match.championName)} 
                                            className="w-10 h-10 rounded border border-gray-600/50 shadow-sm" // Reduced size
                                            onError={(e) => { (e.target.src = `https://placehold.co/40x40/222/ccc?text=${match.championName ? match.championName.substring(0,1) : '?'}`); }}
                                        />
                                        {playerRoleIcon && 
                                            <img src={playerRoleIcon} alt={match.teamPosition} className="absolute -bottom-1 -left-1 w-4 h-4 p-px bg-gray-950 rounded-full border border-gray-500/70 shadow-xs" />
                                        }
                                    </div>
                                    <div className="text-gray-600 text-sm font-light self-center px-0.5">vs</div> {/* Reduced size */}
                                    <div className="relative">
                                        {match.opponentChampionName ? (
                                            <img 
                                                src={getChampionImage(match.opponentChampionName)} 
                                                alt={getChampionDisplayName(match.opponentChampionName)} 
                                                className="w-10 h-10 rounded border border-gray-700/50 opacity-60 group-hover:opacity-90 transition-opacity" // Reduced size
                                                onError={(e) => { (e.target.src = `https://placehold.co/40x40/222/ccc?text=${match.opponentChampionName ? match.opponentChampionName.substring(0,1) : '?'}`); }}
                                            />
                                        ) : (
                                            <div className="w-10 h-10 bg-gray-700/30 rounded flex items-center justify-center border border-gray-600/50"> {/* Reduced size */}
                                                <ImageOff size={16} className="text-gray-500" /> {/* Reduced size */}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Vertical Separator */}
                                <div className="w-px bg-gray-700/50 self-stretch mx-2"></div>

                                {/* Loadout: Spells & Runes (Horizontally Grouped, Vertically Stacked Internally) */}
                                <div className="flex items-center space-x-1 flex-shrink-0 mr-1.5"> {/* Reduced spacing */}
                                    {/* Summoner Spells (Vertically Stacked) */}
                                    <div className="flex flex-col space-y-0.5">
                                        {summoner1Img ? <img src={summoner1Img} alt="Summoner 1" className="w-5 h-5 rounded shadow-sm" /> : <div className="w-5 h-5 rounded bg-gray-700/50 shadow-sm"></div>}
                                        {summoner2Img ? <img src={summoner2Img} alt="Summoner 2" className="w-5 h-5 rounded shadow-sm" /> : <div className="w-5 h-5 rounded bg-gray-700/50 shadow-sm"></div>}
                                    </div>
                                    {/* Runes (Vertically Stacked) */}
                                    <div className="flex flex-col space-y-0.5">
                                        {primaryRuneImg ? <img src={primaryRuneImg} alt="Primary Rune" className="w-5 h-5 rounded-full bg-black/20 p-px shadow-sm" /> : <div className="w-5 h-5 rounded-full bg-gray-700/50 shadow-sm"></div>}
                                        {subStyleImg ? <img src={subStyleImg} alt="Sub Rune Style" className="w-5 h-5 rounded-full bg-black/20 p-px shadow-sm" /> : <div className="w-5 h-5 rounded-full bg-gray-700/50 shadow-sm"></div>}
                                    </div>
                                </div>
                                
                                {/* Items */}
                                <div className="flex flex-col justify-center space-y-0.5 flex-shrink-0">
                                    <div className="flex space-x-0.5">
                                        {items.slice(0,3).map((itemSrc, idx) => itemSrc ? 
                                            <img key={`item-${idx}`} src={itemSrc} alt={`Item ${idx+1}`} className="w-5 h-5 rounded bg-black/20 shadow-sm"/> : // Reduced item size
                                            <div key={`item-${idx}`} className="w-5 h-5 rounded bg-gray-700/50 shadow-sm"></div>
                                        )}
                                    </div>
                                    <div className="flex space-x-0.5">
                                        {items.slice(3,6).map((itemSrc, idx) => itemSrc ? 
                                            <img key={`item-${idx+3}`} src={itemSrc} alt={`Item ${idx+4}`} className="w-5 h-5 rounded bg-black/20 shadow-sm"/> : // Reduced item size
                                            <div key={`item-${idx+3}`} className="w-5 h-5 rounded bg-gray-700/50 shadow-sm"></div>
                                        )}
                                        {trinket ? 
                                            <img src={trinket} alt="Trinket" className="w-5 h-5 rounded bg-black/20 shadow-sm"/> : // Reduced item size
                                            <div className="w-5 h-5 rounded bg-gray-700/50 shadow-sm"></div>
                                        }
                                    </div>
                                </div>
                                
                                {/* Vertical Separator */}
                                <div className="w-px bg-gray-700/50 self-stretch mx-2"></div>

                                {/* KDA & CS Stats */}
                                <div className="flex flex-col justify-center flex-grow min-w-[100px] space-y-0 pr-10"> {/* Adjusted pr & min-width */}
                                    <p className="font-medium text-xs text-gray-100 leading-tight">{kdaString}</p> {/* Reduced font size */}
                                    <p className={`text-[10px] ${isWin ? 'text-green-400/80' : 'text-red-400/80'}`}>{kdaRatio}</p> {/* Reduced font size */}
                                    <div className="flex items-center text-gray-300 text-[10px] mt-0.5"> {/* Reduced font size */}
                                        <TrendingUp size={10} className="mr-0.5 text-teal-400/70 flex-shrink-0"/>  {/* Reduced icon size & margin */}
                                        {csString}
                                    </div>
                                </div>
                                
                                {/* Action Buttons (Notes, Expand) - Positioned Absolutely */}
                                <div className="absolute top-1/2 right-2 transform -translate-y-1/2 flex flex-col space-y-1">
                                    <button 
                                        onClick={() => handleOpenNotes(match)}
                                        className={`p-1.5 rounded-md transition-all duration-150 shadow-sm hover:shadow-md
                                                    ${hasNotesOrGoals 
                                                        ? 'bg-sky-600 hover:bg-sky-500 text-white' 
                                                        : 'bg-orange-600 hover:bg-orange-500 text-white'}`} // Reduced padding
                                        title={hasNotesOrGoals ? "View/Edit Notes" : "Add Notes"}
                                    >
                                        {hasNotesOrGoals ? <MessageSquare size={14} /> : <Edit size={14} />} {/* Reduced icon size */}
                                    </button>
                                    <button 
                                        className="p-1.5 text-gray-300 hover:text-orange-300 transition-colors rounded-md bg-gray-700/80 hover:bg-gray-600/80 shadow-sm hover:shadow-md" // Reduced padding
                                        title="Expand Details (Coming Soon)"
                                        onClick={() => console.log("Expand details for match:", match.id)} // Placeholder
                                    >
                                        <ChevronDown size={14}/> {/* Reduced icon size */}
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
