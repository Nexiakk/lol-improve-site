// src/pages/MatchHistoryPage.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, doc, getDoc, setDoc, Timestamp, query, orderBy, limit, updateDoc } from 'firebase/firestore';
import {
    Loader2, AlertTriangle, ListChecks, MessageSquare, RefreshCw, ImageOff, ChevronDown, ChevronUp, Edit,
} from 'lucide-react';
import MatchNotesPanel from '../components/MatchNotesPanel';
import PaginationControls from '../components/PaginationControls';
import ExpandedMatchDetails from '../components/ExpandedMatchDetails'; // Zaimportowany nowy komponent

// Importuj funkcje narzędziowe
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
    processTimelineData,
    QUEUE_IDS
} from '../utils/matchCalculations';


// Importuj ikony ról
import topIcon from '../assets/top_icon.svg';
import jungleIcon from '../assets/jungle_icon.svg';
import middleIcon from '../assets/mid_icon.svg';
import bottomIcon from '../assets/bottom_icon.svg';
import supportIcon from '../assets/support_icon.svg';

const RIOT_API_KEY = import.meta.env.VITE_RIOT_API_KEY;

const MATCH_COUNT_PER_FETCH = 20;
const MATCH_DETAILS_TO_PROCESS_PER_ACCOUNT_UPDATE = 10;
const API_CALL_DELAY_MS = 1250;
const MATCHES_PER_PAGE = 10;

// Mapowanie ról na ikony - eksportowane, aby ExpandedMatchDetails mógł z nich korzystać
export const ROLE_ICON_MAP = {
    TOP: topIcon, JUNGLE: jungleIcon, MIDDLE: middleIcon,
    BOTTOM: bottomIcon, UTILITY: supportIcon
};
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

  // Pobieranie statycznych danych DDragon (wersje, bohaterowie, czary, runy)
  useEffect(() => {
    if (!RIOT_API_KEY) setError("Błąd Konfiguracji: Brak klucza API Riot.");
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
          }).catch(err => console.error("Błąd podczas pobierania statycznych danych DDragon:", err));
        }
      }).catch(err => console.error("Nie udało się pobrać wersji DDragon:", err));
  }, []);

  const accountsCollectionRef = useMemo(() => db ? collection(db, "trackedAccounts") : null, []);

  const fetchTrackedAccounts = useCallback(async () => {
    if (!accountsCollectionRef) { setError("Firestore niedostępne."); setIsLoadingAccounts(false); return; }
    setIsLoadingAccounts(true);
    try {
      const data = await getDocs(accountsCollectionRef);
      setTrackedAccounts(data.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    } catch (err) { console.error("Błąd podczas pobierania śledzonych kont:", err); setError("Nie można załadować śledzonych kont.");
    } finally { setIsLoadingAccounts(false); }
  }, [accountsCollectionRef]);

  useEffect(() => { fetchTrackedAccounts(); }, [fetchTrackedAccounts]);

  // Pobieranie wszystkich meczów z DB dla wszystkich śledzonych kont
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
    } catch (err) { console.error(`Błąd podczas pobierania zapisanych meczów:`, err); setError(`Nie udało się załadować zapisanych meczów.`);
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
      let dateKey = dateObj.toDateString() === today.toDateString() ? "Dzisiaj" : dateObj.toDateString() === yesterday.toDateString() ? "Wczoraj" : dateObj.toLocaleDateString('pl-PL', { year: 'numeric', month: 'long', day: 'numeric' });
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(match);
      return acc;
    }, {});
    setGroupedMatches(groups);
  }, [currentPage, allMatchesFromDb]);

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

  const handleUpdateAllMatches = async () => {
    if (!RIOT_API_KEY) { setError("Brak klucza API Riot."); return; }
    if (trackedAccounts.length === 0) { setError("Brak śledzonych kont."); return; }

    setIsUpdatingAllMatches(true); setError('');
    setUpdateProgress(`Rozpoczynanie aktualizacji dla ${trackedAccounts.length} kont...`);
    let totalNewMatchesActuallyStored = 0;
    const twoWeeksAgoEpochSeconds = Math.floor((Date.now() - 14 * 24 * 60 * 60 * 1000) / 1000);

    for (let i = 0; i < trackedAccounts.length; i++) {
      const account = trackedAccounts[i];
      if (!account.puuid || !account.platformId) {
        setUpdateProgress(`Pominięto ${account.name}#${account.tag} (brak PUUID/Platformy). (${i + 1}/${trackedAccounts.length})`);
        continue;
      }
      setUpdateProgress(`Aktualizowanie ${account.name}#${account.tag} (${i + 1}/${trackedAccounts.length})...`);
      try {
        const continentalRoute = getContinentalRoute(account.platformId);
        const matchlistUrl = `https://${continentalRoute}.api.riotgames.com/lol/match/v5/matches/by-puuid/${account.puuid}/ids?startTime=${twoWeeksAgoEpochSeconds}&queue=${QUEUE_IDS.RANKED_SOLO}&count=${MATCH_COUNT_PER_FETCH}&api_key=${RIOT_API_KEY}`;
        await delay(API_CALL_DELAY_MS);
        const response = await fetch(matchlistUrl);
        if (!response.ok) {
            const errData = await response.json().catch(() => ({ message: "Nieznany błąd API Riot (pobieranie ID meczów)" }));
            console.error(`Błąd API Riot dla ${account.name} (ID meczów): ${response.status}`, errData);
            setError(`Błąd dla ${account.name} (ID): ${errData.status?.message || response.statusText}`);
            continue;
        }
        const matchIdsFromApi = await response.json();
        if (matchIdsFromApi.length === 0) {
            setUpdateProgress(`Brak nowych meczów z API dla ${account.name}#${account.tag}. (${i + 1}/${trackedAccounts.length})`);
            continue;
        }

        setUpdateProgress(`Znaleziono ${matchIdsFromApi.length} ostatnich ID dla ${account.name}. Sprawdzanie i pobieranie szczegółów...`);

        let newMatchesProcessedForThisAccount = 0;
        for (const matchId of matchIdsFromApi) {
          if (newMatchesProcessedForThisAccount >= MATCH_DETAILS_TO_PROCESS_PER_ACCOUNT_UPDATE) break;

          const matchDocRef = doc(db, "trackedAccounts", account.id, "matches", matchId);
          const docSnap = await getDoc(matchDocRef);

          if (docSnap.exists() && docSnap.data().allParticipants && docSnap.data().teamObjectives && docSnap.data().timelineData) {
              console.log(`Mecz ${matchId} dla ${account.name} posiada już pełne dane wraz z timeline. Pomijanie.`);
              continue;
          }

          setUpdateProgress(`Pobieranie szczegółów meczu ${matchId} dla ${account.name}...`);
          await delay(API_CALL_DELAY_MS);
          const matchDetailUrl = `https://${continentalRoute}.api.riotgames.com/lol/match/v5/matches/${matchId}?api_key=${RIOT_API_KEY}`;
          const detailResponse = await fetch(matchDetailUrl);

          if (!detailResponse.ok) {
            console.warn(`Nie udało się pobrać szczegółów meczu ${matchId} (Konto: ${account.name}). Status: ${detailResponse.status}`);
            continue;
          }
          const matchDetail = await detailResponse.json();
          
          await delay(API_CALL_DELAY_MS);
          const timelineUrl = `https://${continentalRoute}.api.riotgames.com/lol/match/v5/matches/${matchId}/timeline?api_key=${RIOT_API_KEY}`;
          const timelineResponse = await fetch(timelineUrl);
          let timelineFrames = [];
          if (timelineResponse.ok) {
            const timelineJson = await timelineResponse.json();
            timelineFrames = timelineJson.info?.frames || [];
          } else {
            console.warn(`Nie udało się pobrać timeline dla meczu ${matchId}. Status: ${timelineResponse.status}`);
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


            const processedTimeline = processTimelineData(
                timelineFrames, 
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
              timelineData: processedTimeline,
            };
            await setDoc(matchDocRef, matchDataToStore, { merge: true });
            totalNewMatchesActuallyStored++; newMatchesProcessedForThisAccount++;
          }
        }
      } catch (err) {
        console.error(`Błąd przetwarzania konta ${account.name}#${account.tag}:`, err);
        setError(`Błąd aktualizacji ${account.name}. Sprawdź konsolę.`);
      }
    }
    setUpdateProgress(`Aktualizacja zakończona. Zapisano/Zaktualizowano ${totalNewMatchesActuallyStored} meczów z pełnymi szczegółami.`);
    setIsUpdatingAllMatches(false);
    fetchAllMatchesFromDb();
  };

  const handleOpenNotes = (match) => { setSelectedMatchForNotes(match); };
  const handleCloseNotes = () => { setSelectedMatchForNotes(null); };

  const handleSaveNotes = async (matchDocumentId, newNotes, newGoals) => {
    if (!selectedMatchForNotes || !db || !selectedMatchForNotes.trackedAccountDocId) {
      setError("Błąd: Nie można zapisać notatek. Brak danych meczu lub konta.");
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
      console.error("Błąd zapisu notatek:", err);
      setError("Nie udało się zapisać notatek. Spróbuj ponownie.");
    }
    finally { setIsSavingNotes(false); }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    setExpandedMatchId(null);
  };

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

  const toggleExpandMatch = (matchId) => {
    setExpandedMatchId(prevId => (prevId === matchId ? null : matchId));
  };

  if (!RIOT_API_KEY && !error.includes("Błąd Konfiguracji")) {
      return (
          <div className="p-4 sm:p-6 md:p-8 text-gray-100 flex flex-col items-center justify-center h-full">
              <AlertTriangle size={48} className="text-red-500 mb-4" />
              <h2 className="text-2xl font-semibold text-red-400 mb-2">Błąd Konfiguracji</h2>
              <p className="text-gray-300 text-center max-w-md">
                  Brak klucza API Riot. Upewnij się, że jest poprawnie ustawiony w zmiennych środowiskowych (VITE_RIOT_API_KEY).
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
                Aktualizuj Wszystko
                </button>
            </header>

            {isUpdatingAllMatches && updateProgress && (
                <div className="mb-4 p-3 bg-sky-900/50 text-sky-300 border border-sky-700/50 rounded-md text-sm text-center max-w-4xl mx-auto px-4 sm:px-6 md:px-8">
                <p>{updateProgress}</p>
                </div>
            )}
            {error && (
                <div className="mb-6 p-4 bg-red-900/30 text-red-300 border border-red-700/50 rounded-md max-w-4xl mx-auto px-4 sm:px-6 md:px-8">
                <p><AlertTriangle size={18} className="inline mr-2" />Błąd: {error}</p>
                </div>
            )}

            {isLoadingMatches && !isUpdatingAllMatches && (
                <div className="flex flex-col items-center justify-center p-10 bg-gray-800/80 backdrop-blur-md rounded-xl shadow-xl border border-gray-700/50 max-w-4xl mx-auto mt-8">
                <Loader2 size={40} className="text-orange-500 animate-spin" />
                <p className="text-gray-300 mt-4 text-lg">Ładowanie meczów...</p>
                </div>
            )}

            {!isLoadingMatches && Object.keys(groupedMatches).length === 0 && !error && !isUpdatingAllMatches && (
                <div className="text-center py-10 px-6 bg-gray-800/80 backdrop-blur-md rounded-xl shadow-xl border border-dashed border-gray-700/50 max-w-4xl mx-auto mt-8">
                    <ListChecks size={48} className="text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 text-lg">Nie znaleziono meczów dla tej strony.</p>
                    {allMatchesFromDb.length > 0 && <p className="text-gray-500 text-sm">Spróbuj innej strony lub zaktualizuj mecze.</p>}
                    {allMatchesFromDb.length === 0 && <p className="text-gray-500 text-sm">Kliknij "Aktualizuj Wszystko", aby pobrać ostatnie gry, lub dodaj konta na stronie 'Konta'.</p>}
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
                                                    <img src={playerRoleIcon} alt={match.teamPosition || "Rola"} className="absolute -bottom-1 -left-1 w-5 h-5 p-0.5 bg-gray-950 rounded-full border border-gray-500 shadow-sm" />
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
                                                        {summoner1Img ? <img src={summoner1Img} alt="Cz. Przyw. 1" className="w-5 h-5 rounded-sm" /> : <div className="w-5 h-5 rounded-sm bg-gray-700"></div>}
                                                    </div>
                                                    <div className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center border border-gray-600/50">
                                                        {summoner2Img ? <img src={summoner2Img} alt="Cz. Przyw. 2" className="w-5 h-5 rounded-sm" /> : <div className="w-5 h-5 rounded-sm bg-gray-700"></div>}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col space-y-0.5">
                                                    <div className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center border border-gray-600/50 p-px">
                                                        {primaryRuneImg ? <img src={primaryRuneImg} alt="Główna Runa" className="w-5 h-5 rounded-sm" /> : <div className="w-4 h-4 rounded-sm bg-gray-700"></div>}
                                                    </div>
                                                    <div className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center border border-gray-600/50 p-px">
                                                        {subStyleImg ? <img src={subStyleImg} alt="Drugorzędny Styl Run" className="w-4 h-4 rounded-sm" /> : <div className="w-4 h-4 rounded-sm bg-gray-700"></div>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col space-y-0.5">
                                                <div className="flex space-x-0.5">
                                                    {itemsRow1.map((itemSrc, idx) => (
                                                        <div key={`item-r1-${idx}`} className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center border border-gray-600/50">
                                                            {itemSrc ? <img src={itemSrc} alt={`Przedmiot ${idx+1}`} className="w-5 h-5 rounded-sm"/> : <div className="w-5 h-5 rounded-sm bg-gray-700"></div>}
                                                        </div>
                                                    ))}
                                                    <div className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center border border-gray-600/50">
                                                        {trinketImg ? <img src={trinketImg} alt="Talizman" className="w-5 h-5 rounded-sm"/> : <div className="w-5 h-5 rounded-sm bg-gray-700"></div> }
                                                    </div>
                                                </div>
                                                <div className="flex space-x-0.5">
                                                    {itemsRow2.map((itemSrc, idx) => (
                                                        <div key={`item-r2-${idx}`} className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center border border-gray-600/50">
                                                            {itemSrc ? <img src={itemSrc} alt={`Przedmiot ${idx+4}`} className="w-5 h-5 rounded-sm"/> : <div className="w-5 h-5 rounded-sm bg-gray-700"></div>}
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
                                                title={hasNotesOrGoals ? "Zobacz/Edytuj Notatki" : "Dodaj Notatki"}
                                            >
                                                {hasNotesOrGoals ? <MessageSquare size={18} /> : <Edit size={18} />}
                                            </button>
                                        </div>
                                    </div>

                                    <button
                                        className={`flex items-center justify-center ${expandButtonBgClass} transition-colors w-8 cursor-pointer ${isExpanded ? 'rounded-tr-lg' : 'rounded-r-lg'}`}
                                        title={isExpanded ? "Zwiń Szczegóły" : "Rozwiń Szczegóły"}
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
                                        roleIconMap={ROLE_ICON_MAP} // Przekaż mapowanie ikon ról
                                        roleOrder={ROLE_ORDER} // Przekaż kolejność ról
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
