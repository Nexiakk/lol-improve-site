// src/pages/MatchHistoryPage.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, doc, getDoc, setDoc, Timestamp, query, orderBy, limit, updateDoc } from 'firebase/firestore';
import { Loader2, AlertTriangle, ListChecks, MessageSquare, RefreshCw, ImageOff, Globe, Edit, ChevronDown } from 'lucide-react'; 
import MatchNotesPanel from '../components/MatchNotesPanel'; 
import PaginationControls from '../components/PaginationControls';

// Import role icons
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
const MATCHES_PER_PAGE = 15; 

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
    return `${minutes}m ${seconds < 10 ? '0' : ''}${seconds}s`;
}

const ROLE_ICON_MAP = {
    TOP: topIcon, JUNGLE: jungleIcon, MIDDLE: middleIcon,
    BOTTOM: bottomIcon, UTILITY: supportIcon 
};

function MatchHistoryPage() {
  const [trackedAccounts, setTrackedAccounts] = useState([]);
  const [allMatchesFromDb, setAllMatchesFromDb] = useState([]); 
  const [groupedMatches, setGroupedMatches] = useState({}); 
  const [selectedMatchForNotes, setSelectedMatchForNotes] = useState(null); 
  
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
        const q = query(matchesSubCollectionRef, orderBy("gameCreation", "desc"), limit(100)); 
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

  // Effect to update groupedMatches when currentPage or allMatchesFromDb changes
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

  // Dedicated Effect for scrolling to top when currentPage changes
  useEffect(() => {
    if (prevPageRef.current !== currentPage) { 
      if (matchListContainerRef.current) {
        // Using setTimeout to defer the scroll, allowing DOM to update
        setTimeout(() => {
          if (matchListContainerRef.current) { // Double-check ref inside timeout
            matchListContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }, 0);
      }
    }
    // Update prevPageRef *after* the check and potential scroll logic
    prevPageRef.current = currentPage; 
  }, [currentPage, groupedMatches]); // Also depend on groupedMatches to ensure content is ready


  const handleUpdateAllMatches = async () => {
    if (!RIOT_API_KEY) { setError("Riot API Key is missing."); return; }
    if (trackedAccounts.length === 0) { setError("No accounts are being tracked."); return; }

    setIsUpdatingAllMatches(true); setError('');
    setUpdateProgress(`Starting update for ${trackedAccounts.length} accounts...`);
    let totalNewMatchesActuallyStored = 0;
    const twoWeeksAgoEpochSeconds = Math.floor((Date.now() - 14 * 24 * 60 * 60 * 1000) / 1000);

    for (let i = 0; i < trackedAccounts.length; i++) {
      const account = trackedAccounts[i];
      if (!account.puuid || !account.platformId) { /* ... skip ... */ continue; }
      setUpdateProgress(`Updating ${account.name}#${account.tag} (${i + 1}/${trackedAccounts.length})...`);
      try {
        const continentalRoute = getContinentalRoute(account.platformId);
        const matchlistUrl = `https://${continentalRoute}.api.riotgames.com/lol/match/v5/matches/by-puuid/${account.puuid}/ids?startTime=${twoWeeksAgoEpochSeconds}&queue=${RANKED_SOLO_QUEUE_ID}&count=${MATCH_COUNT_PER_FETCH}&api_key=${RIOT_API_KEY}`;
        await delay(API_CALL_DELAY_MS);
        const response = await fetch(matchlistUrl);
        if (!response.ok) { /* ... error handling ... */ continue; }
        const matchIdsFromApi = await response.json();
        if (matchIdsFromApi.length === 0) { /* ... no new matches ... */ continue; }
        
        let newMatchesProcessedForThisAccount = 0;
        for (const matchId of matchIdsFromApi) {
          if (newMatchesProcessedForThisAccount >= MATCH_DETAILS_TO_PROCESS_PER_ACCOUNT_UPDATE) break;
          const matchDocRef = doc(db, "trackedAccounts", account.id, "matches", matchId);
          const docSnap = await getDoc(matchDocRef);
          if (docSnap.exists()) continue;
          
          await delay(API_CALL_DELAY_MS);
          const matchDetailUrl = `https://${continentalRoute}.api.riotgames.com/lol/match/v5/matches/${matchId}?api_key=${RIOT_API_KEY}`;
          const detailResponse = await fetch(matchDetailUrl);
          if (!detailResponse.ok) continue;
          const matchDetail = await detailResponse.json();
          const playerParticipant = matchDetail.info.participants.find(p => p.puuid === account.puuid);

          if (playerParticipant) {
            const perks = playerParticipant.perks || {};
            const primaryStyle = perks.styles?.find(s => s.description === 'primaryStyle');
            const subStyle = perks.styles?.find(s => s.description === 'subStyle');
            let opponentChampionName = null;
            const opponentParticipant = matchDetail.info.participants.find(p => p.teamId !== playerParticipant.teamId && p.teamPosition === playerParticipant.teamPosition && playerParticipant.teamPosition !== '' && p.teamPosition !== undefined);
            if (opponentParticipant) opponentChampionName = opponentParticipant.championName; 

            const matchDataToStore = {
              matchId: matchDetail.metadata.matchId,
              gameCreation: Timestamp.fromMillis(matchDetail.info.gameCreation),
              gameDuration: matchDetail.info.gameDuration, gameMode: matchDetail.info.gameMode,
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
              notes: "", goals: "", 
              rating: null,
            };
            await setDoc(matchDocRef, matchDataToStore);
            totalNewMatchesActuallyStored++; newMatchesProcessedForThisAccount++;
          }
        }
      } catch (err) { /* ... error handling ... */ }
    }
    setUpdateProgress(`Update finished. Stored ${totalNewMatchesActuallyStored} new matches.`);
    setIsUpdatingAllMatches(false);
    // After updating, re-fetch all matches which will also reset currentPage to 1 and trigger scroll via useEffect
    fetchAllMatchesFromDb(); 
  };

  const handleOpenNotes = (match) => { setSelectedMatchForNotes(match); };
  const handleCloseNotes = () => { setSelectedMatchForNotes(null); };

  const handleSaveNotes = async (matchDocumentId, newNotes, newGoals) => {
    if (!selectedMatchForNotes || !db || !selectedMatchForNotes.trackedAccountDocId) { /* ... */ return; }
    setIsSavingNotes(true);
    const matchDocRef = doc(db, "trackedAccounts", selectedMatchForNotes.trackedAccountDocId, "matches", matchDocumentId);
    try {
      await updateDoc(matchDocRef, { notes: newNotes, goals: newGoals });
      setAllMatchesFromDb(prevMatches => prevMatches.map(m => 
        m.id === matchDocumentId ? { ...m, notes: newNotes, goals: newGoals } : m
      )); 
      setSelectedMatchForNotes(prev => prev && prev.id === matchDocumentId ? {...prev, notes: newNotes, goals: newGoals} : prev);
    } catch (err) { /* ... */ } 
    finally { setIsSavingNotes(false); }
  };

  const handlePageChange = (page) => {
    // The useEffect hook that watches `currentPage` and `groupedMatches` will handle the scroll.
    setCurrentPage(page);
  };

  const getKDAString = (p) => !p || typeof p.kills === 'undefined' ? 'N/A' : `${p.kills} / ${p.deaths} / ${p.assists}`;
  const getKDARatio = (p) => {
    if (!p || typeof p.kills === 'undefined' || typeof p.deaths === 'undefined' || typeof p.assists === 'undefined') return '';
    if (p.deaths === 0) return 'Perfect KDA'; 
    return ((p.kills + p.assists) / p.deaths).toFixed(2) + ':1 KDA'; 
  };
  const getCSString = (p) => {
    if (!p || typeof p.totalMinionsKilled === 'undefined' || typeof p.neutralMinionsKilled === 'undefined' || !p.gameDuration || p.gameDuration === 0) return 'CS N/A';
    const totalCS = p.totalMinionsKilled + p.neutralMinionsKilled;
    const csPerMin = (totalCS / (p.gameDuration / 60)).toFixed(1);
    return `CS ${totalCS} (${csPerMin})`;
  };
  
  const getChampionInfo = (championKeyApi) => {
    if (!championData || !championKeyApi) return { displayName: championKeyApi, imageName: championKeyApi + ".png" };
    let dKey = championKeyApi === "Fiddlesticks" ? "FiddleSticks" : championKeyApi; 
    const champ = championData[dKey] || Object.values(championData).find(c => c.id.toLowerCase() === championKeyApi.toLowerCase());
    return champ ? { displayName: champ.name, imageName: champ.image.full } : { displayName: championKeyApi, imageName: championKeyApi + ".png" };
  };
  const getChampionImage = (key) => !key || !ddragonVersion || !championData ? `https://via.placeholder.com/48x48/2D2D2D/666?text=${key ? key.substring(0,1) : '?'}` : `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${getChampionInfo(key).imageName}`;
  const getChampionDisplayName = (key) => !key || !championData ? (key || 'N/A') : getChampionInfo(key).displayName;
  const getItemImage = (id) => !id || !ddragonVersion || id === 0 ? null : `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/item/${id}.png`;
  const getSummonerSpellImage = (id) => !id || !ddragonVersion || !summonerSpellsMap[id] ? null : `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/spell/${summonerSpellsMap[id].image.full}`;
  const getRuneImage = (id) => !id || !ddragonVersion || !runesMap[id] ? null : `https://ddragon.leagueoflegends.com/cdn/img/${runesMap[id].icon}`;

  if (!RIOT_API_KEY && !error.includes("Configuration Error")) { /* ... API Key error display ... */ }
  
  return (
    <div className={`flex flex-1 ${selectedMatchForNotes ? 'overflow-hidden h-[calc(100vh-4rem)]' : 'h-full'}`}> {/* Ensure parent has defined height for h-full on child to work */}
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
                <div className="space-y-6 max-w-4xl mx-auto"> 
                {Object.entries(groupedMatches).map(([dateKey, matchesOnDate]) => (
                    <div key={dateKey}>
                    <h2 className="text-lg font-semibold text-orange-400 mb-3 pb-2 border-b-2 border-gray-700/70">
                        {dateKey}
                    </h2>
                    <div className="space-y-3"> 
                        {matchesOnDate.map(match => {
                        const participantData = match; 
                        const gameResult = typeof match.win === 'boolean' ? (match.win ? 'Victory' : 'Defeat') : 'N/A';
                        const kdaString = getKDAString(participantData);
                        const kdaRatio = getKDARatio(participantData);
                        const csString = getCSString(participantData);

                        const items = [match.item0, match.item1, match.item2, match.item3, match.item4, match.item5].map(id => getItemImage(id));
                        const trinket = getItemImage(match.item6);
                        const summoner1Img = getSummonerSpellImage(match.summoner1Id);
                        const summoner2Img = getSummonerSpellImage(match.summoner2Id);
                        const primaryRuneImg = getRuneImage(match.primaryPerkId);
                        const subStyleImg = getRuneImage(match.subStyleId);
                        
                        const playerRoleIcon = match.teamPosition ? ROLE_ICON_MAP[match.teamPosition.toUpperCase()] : null;
                        const hasNotesOrGoals = (match.notes && match.notes.trim() !== '') || (match.goals && match.goals.trim() !== '');

                        return (
                            <div key={match.id} className={`relative p-3 rounded-lg shadow-md border flex items-center space-x-2 ${typeof match.win === 'boolean' ? (match.win ? 'border-green-600/30 bg-gradient-to-r from-green-900/20 via-gray-800/90 to-gray-800/90' : 'border-red-600/30 bg-gradient-to-r from-red-900/20 via-gray-800/90 to-gray-800/90') : 'border-gray-700 bg-gray-800/80'} transition-colors hover:border-gray-500`}>
                                <div className={`flex-shrink-0 w-2 rounded-l-md h-full self-stretch ${typeof match.win === 'boolean' ? (match.win ? 'bg-green-500' : 'bg-red-500') : 'bg-gray-600'}`}></div>
                                <div className="flex-shrink-0 w-[70px] text-left px-1.5 py-1 flex flex-col justify-center items-start"> 
                                    <p className={`font-bold text-sm ${typeof match.win === 'boolean' ? (match.win ? 'text-green-400' : 'text-red-400') : 'text-gray-300'}`}>{gameResult}</p>
                                    <p className="text-xs text-gray-400">{formatGameDuration(match.gameDuration)}</p>
                                    <p className="text-[10px] text-gray-500 mt-0.5" title={new Date(match.gameCreation.seconds * 1000).toLocaleString()}>{timeAgo(match.gameCreation.seconds)}</p>
                                </div>
                                
                                <div className="flex-shrink-0 flex items-center justify-center space-x-2 mx-1"> 
                                    <div className="relative w-12 h-12"> 
                                        <img src={getChampionImage(match.championName)} alt={getChampionDisplayName(match.championName)} className="w-12 h-12 rounded-md border border-gray-600" onError={(e) => { (e.target).style.display='none'; }} />
                                        {playerRoleIcon && <img src={playerRoleIcon} alt={match.teamPosition} className="absolute -bottom-1.5 -left-1.5 w-6 h-6 p-0.5 bg-gray-950 rounded-full border-2 border-gray-700" />}
                                    </div>
                                    
                                    <div className="h-10 w-px bg-gray-600 self-center"></div> 

                                    <div className="relative w-12 h-12"> 
                                    {match.opponentChampionName ? (
                                        <>
                                        <img src={getChampionImage(match.opponentChampionName)} alt={getChampionDisplayName(match.opponentChampionName)} className="w-12 h-12 rounded-md border border-gray-600" onError={(e) => { (e.target).style.display='none'; }} />
                                        <span className="absolute -bottom-1.5 left-1/2 transform -translate-x-1/2 bg-gray-700 text-gray-200 text-[10px] px-1.5 py-0.5 rounded-sm font-bold border border-gray-500">VS</span>
                                        </>
                                    ) : <div className="w-12 h-12 bg-gray-700/30 rounded-md flex items-center justify-center border-2 border-gray-600"><span className="text-gray-500 text-xs">N/A</span></div>} 
                                    </div>
                                </div>

                                <div className="flex-shrink-0 flex items-center space-x-2 p-2 bg-black/40 rounded-lg border border-gray-700"> 
                                    <div className="flex flex-col space-y-1">{summoner1Img ? <img src={summoner1Img} alt="S1" className="w-7 h-7 rounded" /> : <div className="w-7 h-7 rounded bg-gray-700"></div>}{summoner2Img ? <img src={summoner2Img} alt="S2" className="w-7 h-7 rounded" /> : <div className="w-7 h-7 rounded bg-gray-700"></div>}</div>
                                    <div className="flex flex-col space-y-1">{primaryRuneImg ? <img src={primaryRuneImg} alt="R1" className="w-7 h-7 rounded-full bg-black/30 p-1" /> : <div className="w-7 h-7 rounded-full bg-gray-700"></div>}{subStyleImg ? <img src={subStyleImg} alt="R2" className="w-7 h-7 rounded-full bg-black/30 p-1" /> : <div className="w-7 h-7 rounded-full bg-gray-700"></div>}</div>
                                    <div className="w-px h-12 bg-gray-600 self-center"></div> 
                                    <div className="flex flex-col space-y-0.5"> 
                                        <div className="flex space-x-0.5">
                                            {items.slice(0,3).map((itemSrc, idx) => itemSrc ? <img key={`i-${idx}`} src={itemSrc} alt={`I${idx}`} className="w-7 h-7 rounded bg-black/30"/> : <div key={`i-${idx}`} className="w-7 h-7 rounded bg-gray-700"></div>)}
                                        </div>
                                        <div className="flex space-x-0.5">
                                            {items.slice(3,6).map((itemSrc, idx) => itemSrc ? <img key={`i-${idx}`} src={itemSrc} alt={`I${idx+3}`} className="w-7 h-7 rounded bg-black/30"/> : <div key={`i-${idx}`} className="w-7 h-7 rounded bg-gray-700"></div>)}
                                        </div>
                                    </div>
                                    {trinket ? <img src={trinket} alt="T" className="w-7 h-7 rounded self-end bg-black/30 ml-0.5"/> : <div className="w-7 h-7 rounded self-end bg-gray-700 ml-0.5"></div>}
                                </div>

                                <div className="flex-grow min-w-[100px] text-sm px-3 text-left">
                                    <p className="font-bold text-lg text-gray-100">{kdaString}</p>
                                    <p className="text-xs text-orange-400">{kdaRatio}</p>
                                    <p className="text-gray-300 mt-1 text-base">{csString}</p>
                                </div>
                                
                                <div className="absolute top-1/2 right-3 transform -translate-y-1/2 flex items-center space-x-2">
                                    <button 
                                        onClick={() => handleOpenNotes(match)}
                                        className={`p-2.5 rounded-full transition-colors shadow-lg
                                                    ${hasNotesOrGoals 
                                                        ? 'bg-sky-500 hover:bg-sky-400 text-white' 
                                                        : 'bg-orange-500 hover:bg-orange-400 text-white'}`}
                                        title={hasNotesOrGoals ? "View/Edit Notes" : "Add Notes"}
                                    >
                                        {hasNotesOrGoals ? <MessageSquare size={20} /> : <Edit size={20} />}
                                    </button>
                                    <button 
                                        className="p-2.5 text-gray-400 hover:text-orange-300 transition-colors rounded-full bg-gray-700/50 hover:bg-gray-600/50 shadow-lg"
                                        title="Expand Details"
                                        onClick={() => console.log("Expand details for match:", match.id)} 
                                    >
                                        <ChevronDown size={20}/>
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
