// src/pages/MatchHistoryPage.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, doc, getDoc, setDoc, Timestamp, query, orderBy, limit, updateDoc } from 'firebase/firestore';
import { Loader2, AlertTriangle, ListChecks, MessageSquare, RefreshCw, ImageOff, ChevronDown, Gamepad2, Edit } from 'lucide-react'; 
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
const FLEX_SR_QUEUE_ID = 440;
const NORMAL_DRAFT_QUEUE_ID = 400;
const NORMAL_BLIND_QUEUE_ID = 430;
const ARAM_QUEUE_ID = 450;

const MATCH_COUNT_PER_FETCH = 20; 
const MATCH_DETAILS_TO_PROCESS_PER_ACCOUNT_UPDATE = 10; 
const API_CALL_DELAY_MS = 1250;
const MATCHES_PER_PAGE = 10;

// Funkcja pomocnicza do określania trasy kontynentalnej dla wywołań API Riot na podstawie platformId
const getContinentalRoute = (platformId) => {
  if (!platformId) return 'europe'; 
  const lowerPlatformId = platformId.toLowerCase();
  if (['eun1', 'euw1', 'tr1', 'ru'].includes(lowerPlatformId)) return 'europe';
  if (['na1', 'br1', 'la1', 'la2', 'oc1'].includes(lowerPlatformId)) return 'americas';
  if (['kr', 'jp1'].includes(lowerPlatformId)) return 'asia';
  return 'europe'; 
};

// Funkcja pomocnicza do wprowadzania opóźnienia
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Formatowanie czasu na angielski
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

// Formatowanie czasu trwania gry na "MM:SS"
function formatGameDurationMMSS(durationSeconds) {
    if (typeof durationSeconds !== 'number' || isNaN(durationSeconds)) return 'N/A';
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = durationSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Logika wyświetlania trybu gry
const formatGameMode = (gameModeApi, queueId) => {
    if (queueId === RANKED_SOLO_QUEUE_ID) return 'Ranked Solo';
    if (queueId === FLEX_SR_QUEUE_ID) return 'Ranked Flex';
    if (queueId === NORMAL_DRAFT_QUEUE_ID) return 'Normal Draft';
    if (queueId === NORMAL_BLIND_QUEUE_ID) return 'Normal Blind';
    if (queueId === ARAM_QUEUE_ID) return 'ARAM';
    if (gameModeApi) {
        if (gameModeApi === 'CLASSIC') return 'Classic SR'; 
        return gameModeApi.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
    }
    return 'Unknown Mode';
};

// Mapowanie ról na ikony
const ROLE_ICON_MAP = {
    TOP: topIcon, JUNGLE: jungleIcon, MIDDLE: middleIcon,
    BOTTOM: bottomIcon, UTILITY: supportIcon 
};

// Funkcja pomocnicza do określania koloru KDA Ratio
const getKDAColorClass = (kills, deaths, assists) => {
    if (typeof kills !== 'number' || typeof deaths !== 'number' || typeof assists !== 'number') {
        return 'text-gray-400'; 
    }
    const kda = deaths === 0 ? (kills > 0 || assists > 0 ? (kills + assists) * 2 : 0) : (kills + assists) / deaths; 

    if (deaths === 0 && (kills > 0 || assists > 0)) return 'text-[#FFAA00]'; // Perfect KDA - Gold/Orange
    if (kda >= 5) return 'text-[#00CC66]';   // High KDA - Green
    if (kda >= 3) return 'text-[#3399FF]';   // Good KDA - Blue
    if (kda >= 1.5) return 'text-sky-400';   // Average KDA - Light Blue
    if (kda >= 0.75) return 'text-[#AAAAAA]'; // Okay KDA - Light Grey
    return 'text-red-400';                   // Low KDA - Red (similar to #FF6666)
};


function MatchHistoryPage() {
  // Stany komponentu
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

  // Efekt do pobierania statycznych danych DDragon
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

  // Referencja do kolekcji kont w Firestore
  const accountsCollectionRef = useMemo(() => db ? collection(db, "trackedAccounts") : null, []);

  // Funkcja do pobierania śledzonych kont
  const fetchTrackedAccounts = useCallback(async () => {
    if (!accountsCollectionRef) { setError("Firestore not available."); setIsLoadingAccounts(false); return; }
    setIsLoadingAccounts(true);
    try {
      const data = await getDocs(accountsCollectionRef);
      setTrackedAccounts(data.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    } catch (err) { console.error("Error fetching tracked accounts:", err); setError("Could not load tracked accounts.");
    } finally { setIsLoadingAccounts(false); }
  }, [accountsCollectionRef]);

  // Efekt do pobierania kont przy montowaniu komponentu
  useEffect(() => { fetchTrackedAccounts(); }, [fetchTrackedAccounts]);

  // Funkcja do pobierania wszystkich meczów z bazy danych
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

  // Efekt do pobierania meczów, gdy zmienią się śledzone konta
  useEffect(() => {
    if (trackedAccounts.length > 0) {
        fetchAllMatchesFromDb(); 
    } else {
        setAllMatchesFromDb([]);
        setGroupedMatches({});
        setTotalPages(0);
    }
  }, [trackedAccounts, fetchAllMatchesFromDb]);

  // Efekt do aktualizacji pogrupowanych meczów przy zmianie strony lub danych
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

  // Efekt do przewijania do góry przy zmianie strony
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

  // Funkcja do aktualizacji wszystkich meczów z API Riot
  const handleUpdateAllMatches = async () => {
    if (!RIOT_API_KEY) { setError("Riot API Key is missing."); return; }
    if (trackedAccounts.length === 0) { setError("No accounts are being tracked."); return; }

    setIsUpdatingAllMatches(true); setError('');
    setUpdateProgress(`Starting update for ${trackedAccounts.length} accounts...`);
    let totalNewMatchesActuallyStored = 0;
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
        
        setUpdateProgress(`Found ${matchIdsFromApi.length} recent IDs for ${account.name}. Checking & fetching details...`);
        
        let newMatchesProcessedForThisAccount = 0;
        for (const matchId of matchIdsFromApi) {
          if (newMatchesProcessedForThisAccount >= MATCH_DETAILS_TO_PROCESS_PER_ACCOUNT_UPDATE) break;
          
          const matchDocRef = doc(db, "trackedAccounts", account.id, "matches", matchId);
          const docSnap = await getDoc(matchDocRef);
          if (docSnap.exists()) continue;
          
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
            if (opponentParticipant) opponentChampionName = opponentParticipant.championName; 

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
              opponentChampionName: opponentChampionName,
              notes: "", goals: "", 
              rating: null, 
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
    fetchAllMatchesFromDb(); 
  };

  // Funkcje obsługi panelu notatek
  const handleOpenNotes = (match) => { setSelectedMatchForNotes(match); };
  const handleCloseNotes = () => { setSelectedMatchForNotes(null); };

  // Funkcja zapisywania notatek
  const handleSaveNotes = async (matchDocumentId, newNotes, newGoals) => {
    if (!selectedMatchForNotes || !db || !selectedMatchForNotes.trackedAccountDocId) { 
      setError("Error: Cannot save notes. Match or account data missing.");
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

  // Funkcja zmiany strony paginacji
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Funkcja do wyświetlania KDA jako spany z kolorami
  const getKDAStringSpans = (p) => {
    if (!p || typeof p.kills === 'undefined') return <span className="text-gray-300">N/A</span>;
    return (
        <>
            <span className="text-gray-200">{p.kills}</span> {/* Zmieniono z gray-100 */}
            <span className="text-gray-400"> / </span> {/* Zmieniono z gray-500 */}
            <span className="text-red-400">{p.deaths}</span> {/* Użyto red-400 dla spójności z getKDAColorClass */}
            <span className="text-gray-400"> / </span> {/* Zmieniono z gray-500 */}
            <span className="text-gray-200">{p.assists}</span> {/* Zmieniono z gray-100 */}
        </>
    );
  };

  // Funkcja do obliczania KDA Ratio
  const getKDARatio = (p) => {
    if (!p || typeof p.kills === 'undefined' || typeof p.deaths === 'undefined' || typeof p.assists === 'undefined') return '';
    if (p.deaths === 0 && (p.kills > 0 || p.assists > 0)) return 'Perfect'; 
    if (p.deaths === 0) return '0.00'; 
    return ((p.kills + p.assists) / p.deaths).toFixed(2); 
  };

  // Funkcja do wyświetlania CS
  const getCSString = (p) => {
    if (!p || typeof p.totalMinionsKilled === 'undefined' || typeof p.neutralMinionsKilled === 'undefined' || !p.gameDuration || p.gameDuration === 0) return 'CS N/A';
    const totalCS = p.totalMinionsKilled + p.neutralMinionsKilled;
    const csPerMin = (totalCS / (p.gameDuration / 60)).toFixed(1);
    return `CS ${totalCS} (${csPerMin})`;
  };
  
  // Funkcje pomocnicze DDragon
  const getChampionInfo = (championKeyApi) => {
    if (!championData || !championKeyApi) return { displayName: championKeyApi, imageName: championKeyApi + ".png" };
    let dKey = championKeyApi === "Fiddlesticks" ? "FiddleSticks" : championKeyApi; 
    const champ = championData[dKey] || Object.values(championData).find(c => c.id.toLowerCase() === championKeyApi.toLowerCase());
    return champ ? { displayName: champ.name, imageName: champ.image.full } : { displayName: championKeyApi, imageName: championKeyApi + ".png" };
  };
  const getChampionImage = (key) => !key || !ddragonVersion || !championData ? `https://placehold.co/56x56/2D2D2D/666?text=${key ? key.substring(0,1) : '?'}` : `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${getChampionInfo(key).imageName}`;
  const getChampionDisplayName = (key) => !key || !championData ? (key || 'N/A') : getChampionInfo(key).displayName;
  const getItemImage = (id) => !id || !ddragonVersion || id === 0 ? null : `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/item/${id}.png`;
  const getSummonerSpellImage = (id) => !id || !ddragonVersion || !summonerSpellsMap[id] ? null : `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/spell/${summonerSpellsMap[id].image.full}`;
  const getRuneImage = (id) => {
    if (!id || !ddragonVersion || !runesMap[id] || !runesMap[id].icon) return null;
    return `https://ddragon.leagueoflegends.com/cdn/img/${runesMap[id].icon}`;
  };

  // Renderowanie błędu braku klucza API
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
        {/* Kontener listy meczów */}
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
                    {allMatchesFromDb.length === 0 && <p className="text-gray-500 text-sm">Click "Update All" to fetch recent games.</p>}
                </div>
            )}

            {/* Lista meczów */}
            {!isLoadingMatches && Object.keys(groupedMatches).length > 0 && (
              <div className="space-y-3 max-w-4xl mx-auto px-4 sm:px-6 md:px-8 pb-8"> 
                {Object.entries(groupedMatches).map(([dateKey, matchesOnDate]) => (
                  <div key={dateKey}>
                    <h2 className="text-lg font-semibold text-orange-400 mb-3 pb-1.5 border-b border-gray-700/80">
                        {dateKey}
                    </h2>
                    <div className="space-y-3"> 
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

                        // Style tła i obramowania w zależności od wyniku
                        const resultBgOverlayClass = isWin === null ? '' : (isWin ? 'bg-blue-600/20' : 'bg-[#f7665e]/20');
                        const expandButtonBgClass = isWin === null ? 'bg-gray-700/60 hover:bg-gray-600/80' : (isWin ? 'bg-[#263964] hover:bg-[#304A80]' : 'bg-[#42212C] hover:bg-[#582C3A]');
                        
                        return (
                            <div 
                                key={match.id} 
                                className={`flex items-stretch rounded-lg shadow-lg ${resultBgOverlayClass} overflow-hidden relative group`}
                            >
                                {/* Główna zawartość meczu (z marginesem lewym) */}
                                <div className="flex flex-1 items-stretch p-3 ml-1"> {/* Dodano ml-1 */}
                                    {/* Section 1: Left Info */}
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

                                    {/* Section 2: Champion & Matchup Info */}
                                    <div className="flex items-center justify-center space-x-1.5 flex-shrink-0 mx-1">
                                        <div className="relative">
                                            <img 
                                                src={getChampionImage(match.championName)} 
                                                alt={getChampionDisplayName(match.championName)} 
                                                className="w-12 h-12 rounded-md border-2 border-gray-600 shadow-md"
                                                onError={(e) => { (e.target.src = `https://placehold.co/48x48/222/ccc?text=${match.championName ? match.championName.substring(0,1) : '?'}`); }}
                                            />
                                            {playerRoleIcon && 
                                                <img src={playerRoleIcon} alt={match.teamPosition} className="absolute -bottom-1 -left-1 w-5 h-5 p-0.5 bg-gray-950 rounded-full border border-gray-500 shadow-sm" />
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

                                    {/* Section 3: Build (Spells, Runes, Items) */}
                                    <div className="flex items-center space-x-2 bg-gray-900/70 p-2 rounded-lg shadow-inner border border-gray-700/50 flex-shrink-0">
                                        <div className="flex space-x-1">
                                            <div className="flex flex-col space-y-0.5">
                                                <div className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center border border-gray-600/50">
                                                    {summoner1Img ? <img src={summoner1Img} alt="Summoner 1" className="w-5 h-5 rounded-sm" /> : <div className="w-5 h-5 rounded-sm bg-gray-700"></div>}
                                                </div>
                                                <div className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center border border-gray-600/50">
                                                    {summoner2Img ? <img src={summoner2Img} alt="Summoner 2" className="w-5 h-5 rounded-sm" /> : <div className="w-5 h-5 rounded-sm bg-gray-700"></div>}
                                                </div>
                                            </div>
                                            <div className="flex flex-col space-y-0.5">
                                                <div className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center border border-gray-600/50 p-px">
                                                    {primaryRuneImg ? <img src={primaryRuneImg} alt="Primary Rune" className="w-5 h-5 rounded-sm" /> : <div className="w-4 h-4 rounded-sm bg-gray-700"></div>}
                                                </div>
                                                <div className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center border border-gray-600/50 p-px">
                                                    {subStyleImg ? <img src={subStyleImg} alt="Sub Rune Style" className="w-4 h-4 rounded-sm" /> : <div className="w-4 h-4 rounded-sm bg-gray-700"></div>}
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
                                                <div className="w-6 h-6"></div> {/* Pusty slot dla wyrównania */}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="w-px bg-gray-700/60 self-stretch mx-3"></div>

                                    {/* Section 4: KDA & CS Stats */}
                                    <div className="flex flex-col justify-center flex-grow min-w-[100px] space-y-0.5">
                                        <p className="font-semibold text-sm">{kdaStringSpans}</p>
                                        <p className={`text-xs ${kdaColorClass}`}>{kdaRatio} KDA</p>
                                        <p className="text-gray-300 text-xs mt-0.5">{csString}</p>
                                    </div>
                                    
                                    {/* Section 5: Przycisk Notatek */}
                                    <div className="flex items-center ml-auto pl-0.5">
                                        <button 
                                            onClick={() => handleOpenNotes(match)}
                                            className={`p-1.5 rounded-md transition-all duration-150 shadow-sm hover:shadow-md flex items-center justify-center mr-2.5 w-auto h-auto
                                                        ${hasNotesOrGoals 
                                                            ? 'bg-sky-600 hover:bg-sky-500 text-white' 
                                                            : 'bg-orange-600 hover:bg-orange-500 text-white'}`}
                                            title={hasNotesOrGoals ? "Zobacz/Edytuj Notatki" : "Dodaj Notatki"}
                                        >
                                            {hasNotesOrGoals ? <MessageSquare size={14} /> : <Edit size={18} />}
                                        </button>
                                    </div>
                                </div> 

                                {/* Przycisk Rozwijania */}
                                <div 
                                    className={`flex items-center justify-center ${expandButtonBgClass} transition-colors w-8 cursor-pointer`}
                                    title="Rozwiń Szczegóły (Wkrótce)"
                                    onClick={() => console.log("Expand details for match:", match.id)} 
                                >
                                    <ChevronDown size={18} className="text-gray-400 group-hover:text-orange-300"/>
                                </div>
                            </div>
                        );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* Paginacja */}
            {!isLoadingMatches && totalPages > 1 && (
                <PaginationControls 
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange} 
                />
            )}
        </div>

        {/* Panel notatek */}
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
