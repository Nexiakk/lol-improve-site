// src/pages/MatchHistoryPage.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { db } from '../dexieConfig';
import {
    Loader2, AlertTriangle, ListChecks, MessageSquare, Edit, ChevronDown, ChevronUp
} from 'lucide-react';
import MatchNotesPanel from '../components/MatchNotesPanel';
import PaginationControls from '../components/PaginationControls';
import ExpandedMatchDetails from '../components/ExpandedMatchDetails';
import MatchHistoryHeader from '../components/MatchHistoryHeader';
import {
    getContinentalRoute, delay, timeAgo, formatGameDurationMMSS, formatGameMode,
    getKDAColorClass, getKDAStringSpans, getKDARatio, getCSString,
    processTimelineData, QUEUE_IDS
} from '../utils/matchCalculations';

import topIcon from '../assets/top_icon.svg';
import jungleIcon from '../assets/jungle_icon.svg';
import middleIcon from '../assets/mid_icon.svg';
import bottomIcon from '../assets/bottom_icon.svg';
import supportIcon from '../assets/support_icon.svg';

const RIOT_API_KEY = import.meta.env.VITE_RIOT_API_KEY;
const MATCH_COUNT_PER_FETCH = 20; 
const HISTORICAL_MATCH_COUNT_PER_FETCH = 100; 
const MATCH_DETAILS_TO_PROCESS_PER_ACCOUNT_UPDATE = 10;
const API_CALL_DELAY_MS = 1250;
const MATCHES_PER_PAGE = 10;
const ANIMATION_DURATION_MS = 500;
const GAMES_FOR_SUMMARY_PROP = 20;

export const ROLE_ICON_MAP = { TOP: topIcon, JUNGLE: jungleIcon, MIDDLE: middleIcon, BOTTOM: bottomIcon, UTILITY: supportIcon };
export const ROLE_ORDER = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];
const INITIAL_FILTERS_STATE = { patch: [], champion: '', withPlayer: '', dateRange: { startDate: '', endDate: '' }, role: '' };

function MatchHistoryPage() {
    const [trackedAccounts, setTrackedAccounts] = useState([]);
    const [allMatchesFromDb, setAllMatchesFromDb] = useState([]);
    const [groupedMatches, setGroupedMatches] = useState({});
    const [selectedMatchForNotes, setSelectedMatchForNotes] = useState(null);
    const [expandedMatchId, setExpandedMatchId] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
    const [isLoadingMatches, setIsLoadingMatches] = useState(false);
    const [isUpdatingAllMatches, setIsUpdatingAllMatches] = useState(false);
    const [isSavingNotes, setIsSavingNotes] = useState(false);
    const [updateProgress, setUpdateProgress] = useState('');
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [ddragonVersion, setDdragonVersion] = useState('');
    const [summonerSpellsMap, setSummonerSpellsMap] = useState({});
    const [runesMap, setRunesMap] = useState({});
    const [championData, setChampionData] = useState(null);
    const [runesDataFromDDragon, setRunesDataFromDDragon] = useState([]);
    const [filters, setFilters] = useState(INITIAL_FILTERS_STATE);
    const [updateFetchDates, setUpdateFetchDates] = useState({ startDate: '', endDate: '' });
    const [goalTemplates, setGoalTemplates] = useState([]);

    const matchListContainerRef = useRef(null);
    const prevPageRef = useRef(currentPage);

    const fetchGoalTemplatesForHeader = useCallback(async () => { /* ... (same as v6) ... */ try { const templatesFromDb = await db.goalTemplates.orderBy('title').toArray(); setGoalTemplates(templatesFromDb); } catch (err) { console.error("Error fetching goal templates for header:", err); } }, []);
    useEffect(() => { fetchGoalTemplatesForHeader(); }, [fetchGoalTemplatesForHeader]);
    useEffect(() => { /* ... DDragon fetch (same as v6) ... */ if (!RIOT_API_KEY) setError("Configuration Error: Riot API Key is missing."); fetch('https://ddragon.leagueoflegends.com/api/versions.json').then(res => res.json()).then(versions => { if (versions && versions.length > 0) { const latestVersion = versions[0]; setDdragonVersion(latestVersion); const staticDataFetches = [ fetch(`https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/en_US/summoner.json`).then(res => res.json()), fetch(`https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/en_US/runesReforged.json`).then(res => res.json()), fetch(`https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/en_US/champion.json`).then(res => res.json()) ]; Promise.all(staticDataFetches).then(([summonerData, rawRunesData, champData]) => { const spells = {}; if (summonerData && summonerData.data) { for (const key in summonerData.data) spells[summonerData.data[key].key] = summonerData.data[key]; } setSummonerSpellsMap(spells); const flatRunes = {}; if (rawRunesData && Array.isArray(rawRunesData)) { rawRunesData.forEach(style => { flatRunes[style.id] = { icon: style.icon, name: style.name, key: style.key }; style.slots.forEach(slot => slot.runes.forEach(rune => flatRunes[rune.id] = { icon: rune.icon, name: rune.name, key: rune.key, styleId: style.id })); }); setRunesDataFromDDragon(rawRunesData); } setRunesMap(flatRunes); if (champData && champData.data) setChampionData(champData.data); }).catch(err => { console.error("Error fetching DDragon static data:", err); setError("Failed to load essential game data (DDragon)."); }); } }).catch(err => { console.error("Failed to fetch DDragon versions:", err); setError("Failed to load DDragon versions."); }); }, []);
    const fetchTrackedAccounts = useCallback(async () => { /* ... (same as v6) ... */ setIsLoadingAccounts(true); try { const accountsFromDb = await db.trackedAccounts.toArray(); setTrackedAccounts(accountsFromDb.map(acc => ({ ...acc, docId: acc.id }))); } catch (err) { console.error("Error fetching tracked accounts from Dexie:", err); setError("Could not load tracked accounts."); } finally { setIsLoadingAccounts(false); } }, []);
    useEffect(() => { fetchTrackedAccounts(); }, [fetchTrackedAccounts]);
    const fetchAllMatchesFromDb = useCallback(async () => { /* ... (same as v6) ... */ if (trackedAccounts.length === 0 && !isLoadingAccounts) { setAllMatchesFromDb([]); setIsLoadingMatches(false); return; } if (trackedAccounts.length === 0 && isLoadingAccounts) return; setIsLoadingMatches(true); setError(''); try { let combinedMatches = []; for (const account of trackedAccounts) { const accountMatches = await db.matches.where('trackedAccountDocId').equals(account.id).toArray(); const matchesWithAccountInfo = accountMatches.map(match => ({ ...match, trackedAccountDocId: account.id, trackedAccountName: `${account.name}#${account.tag}`, trackedAccountPlatform: account.platformId })); combinedMatches = [...combinedMatches, ...matchesWithAccountInfo]; } combinedMatches.sort((a, b) => (b.gameCreation || 0) - (a.gameCreation || 0)); setAllMatchesFromDb(combinedMatches); } catch (err) { console.error(`Error fetching stored matches from Dexie:`, err); setError(`Failed to load stored matches.`); } finally { setIsLoadingMatches(false); } }, [trackedAccounts, isLoadingAccounts]);
    useEffect(() => { if (!isLoadingAccounts) fetchAllMatchesFromDb(); }, [isLoadingAccounts, fetchAllMatchesFromDb]);
    const availableChampions = useMemo(() => { /* ... (same as v6) ... */ const champNames = new Set(allMatchesFromDb.map(match => match.championName).filter(Boolean)); return Array.from(champNames).sort(); }, [allMatchesFromDb]);
    const availablePatches = useMemo(() => { /* ... (same as v6) ... */ const patchVersions = new Set(allMatchesFromDb.map(match => match.gamePatchVersion).filter(p => p && p !== 'N/A')); return Array.from(patchVersions).sort((a, b) => { const [aMajor, aMinor] = a.split('.').map(Number); const [bMajor, bMinor] = b.split('.').map(Number); if (aMajor !== bMajor) return bMajor - aMajor; return bMinor - aMinor; }); }, [allMatchesFromDb]);
    const handleFilterChange = useCallback((e) => { /* ... (same as v6) ... */ const { name, value } = e.target; if (name === "dateRange") { setFilters(prev => ({ ...prev, dateRange: value })); } else { setFilters(prev => ({ ...prev, [name]: value })); } setCurrentPage(1); setExpandedMatchId(null); }, []);
    const handleDatePresetFilter = useCallback((preset) => { /* ... (same as v6) ... */ const today = new Date(); let startDate = ''; let endDate = today.toISOString().split('T')[0]; if (preset === 'last7days') { const sevenDaysAgo = new Date(today); sevenDaysAgo.setDate(today.getDate() - 7); startDate = sevenDaysAgo.toISOString().split('T')[0]; } else if (preset === 'last30days') { const thirtyDaysAgo = new Date(today); thirtyDaysAgo.setDate(today.getDate() - 30); startDate = thirtyDaysAgo.toISOString().split('T')[0]; } else if (preset === 'thisMonth') { const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1); startDate = firstDayOfMonth.toISOString().split('T')[0]; } setFilters(prev => ({ ...prev, dateRange: { startDate, endDate } })); setCurrentPage(1); setExpandedMatchId(null); }, []);
    const handleUpdateFetchDateChange = useCallback((e) => { /* ... (same as v6) ... */ if (e.target.name === 'dateRange') { setUpdateFetchDates(e.target.value); } }, []);
    const handleClearFilters = useCallback(() => { /* ... (same as v6) ... */ setFilters(INITIAL_FILTERS_STATE); setCurrentPage(1); setExpandedMatchId(null); }, []);
    const filteredMatches = useMemo(() => { /* ... (same as v6) ... */ return allMatchesFromDb.filter(match => { if (filters.patch && filters.patch.length > 0) { if (!filters.patch.includes(match.gamePatchVersion)) return false; } if (filters.champion && match.championName !== filters.champion) return false; if (filters.role && match.teamPosition && match.teamPosition.toUpperCase() !== filters.role) return false; if (filters.withPlayer) { const [name, tag] = filters.withPlayer.toLowerCase().split('#'); const foundPlayer = match.allParticipants?.some(p => (p.riotIdGameName?.toLowerCase() === name && p.riotIdTagline?.toLowerCase() === tag) || p.summonerName?.toLowerCase() === name ); if (!foundPlayer) return false; } if (filters.dateRange.startDate) { const matchDate = new Date(match.gameCreation); const startDate = new Date(filters.dateRange.startDate); startDate.setHours(0, 0, 0, 0); if (matchDate < startDate) return false; } if (filters.dateRange.endDate) { const matchDate = new Date(match.gameCreation); const endDate = new Date(filters.dateRange.endDate); endDate.setHours(23, 59, 59, 999); if (matchDate > endDate) return false; } return true; }); }, [allMatchesFromDb, filters]);
    const totalPages = useMemo(() => { /* ... (same as v6) ... */ const TPages = Math.ceil(filteredMatches.length / MATCHES_PER_PAGE); return TPages > 0 ? TPages : 1; }, [filteredMatches]);
    useEffect(() => { /* ... (same as v6) ... */ if (totalPages === 1 && currentPage !== 1) { setCurrentPage(1); } else if (currentPage > totalPages && totalPages > 0) { setCurrentPage(totalPages); } }, [totalPages, currentPage, filteredMatches.length]);
    useEffect(() => { /* ... (same as v6) ... */ if (filteredMatches.length === 0) { setGroupedMatches({}); return; } const startIndex = (currentPage - 1) * MATCHES_PER_PAGE; const endIndex = startIndex + MATCHES_PER_PAGE; const matchesForCurrentPage = filteredMatches.slice(startIndex, endIndex); const groups = matchesForCurrentPage.reduce((acc, match) => { if (!match.gameCreation) return acc; const dateObj = new Date(match.gameCreation); const currentYear = new Date().getFullYear(); let dateKey = dateObj.getFullYear() === currentYear ? dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); if (!acc[dateKey]) acc[dateKey] = []; acc[dateKey].push(match); return acc; }, {}); setGroupedMatches(groups); }, [currentPage, filteredMatches]);
    useEffect(() => { /* ... (same as v6) ... */ const pageActuallyChanged = prevPageRef.current !== currentPage; prevPageRef.current = currentPage; if (pageActuallyChanged && matchListContainerRef.current) { setTimeout(() => { if (matchListContainerRef.current && matchListContainerRef.current.scrollHeight > matchListContainerRef.current.clientHeight) { matchListContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' }); } }, 0); } }, [currentPage, groupedMatches]);
    useEffect(() => { /* ... (same as v6) ... */ const matchesWithNewFlag = allMatchesFromDb.filter(m => m.isNew); if (matchesWithNewFlag.length > 0) { const timer = setTimeout(() => { setAllMatchesFromDb(prevMatches => prevMatches.map(m => (m.isNew ? { ...m, isNew: false } : m))); }, ANIMATION_DURATION_MS + 100); return () => clearTimeout(timer); } }, [allMatchesFromDb]);
    
    // Match Update Logic
    const handleUpdateAllMatches = async (customStartDate, customEndDate) => {
        // ... (Existing update logic)
        // IMPORTANT: When creating matchDataToStore for a new match, initialize vibeTags
        // const matchDataToStore = {
        //   // ... other properties
        //   vibeTags: [], // Initialize as empty array
        //   // ... other note properties
        // };
        // ... (rest of the existing update logic)
         if (!RIOT_API_KEY) { setError("Riot API Key is missing."); return; } if (trackedAccounts.length === 0) { setError("No tracked accounts to update."); return; } setIsUpdatingAllMatches(true); setError(''); setSuccessMessage(''); setUpdateProgress(`Starting update for ${trackedAccounts.length} accounts...`); let totalNewMatchesActuallyStoredThisSession = 0; let startTimeEpoch = null; let endTimeEpoch = null; let countToFetch = MATCH_COUNT_PER_FETCH; if (customStartDate) { startTimeEpoch = Math.floor(new Date(customStartDate).setHours(0,0,0,0) / 1000); countToFetch = HISTORICAL_MATCH_COUNT_PER_FETCH; } else { startTimeEpoch = Math.floor((Date.now() - 14 * 24 * 60 * 60 * 1000) / 1000); } if (customEndDate) { endTimeEpoch = Math.floor(new Date(customEndDate).setHours(23,59,59,999) / 1000); } for (let i = 0; i < trackedAccounts.length; i++) { const account = trackedAccounts[i]; if (!account.puuid || !account.platformId) { setUpdateProgress(`Skipped ${account.name}#${account.tag} (missing PUUID/Platform). (${i + 1}/${trackedAccounts.length})`); continue; } setUpdateProgress(`Updating ${account.name}#${account.tag} (${i + 1}/${trackedAccounts.length})...`); try { const continentalRoute = getContinentalRoute(account.platformId); let matchlistUrl = `https://${continentalRoute}.api.riotgames.com/lol/match/v5/matches/by-puuid/${account.puuid}/ids?`; if (startTimeEpoch) matchlistUrl += `startTime=${startTimeEpoch}&`; if (endTimeEpoch) matchlistUrl += `endTime=${endTimeEpoch}&`; matchlistUrl += `queue=${QUEUE_IDS.RANKED_SOLO}&count=${countToFetch}&api_key=${RIOT_API_KEY}`; await delay(API_CALL_DELAY_MS); const response = await fetch(matchlistUrl); if (!response.ok) { const errData = await response.json().catch(() => ({ message: "Unknown Riot API error (fetching match IDs)" })); console.error(`Riot API error for ${account.name} (Match IDs): ${response.status}`, errData); setError(`Error for ${account.name} (IDs): ${errData.status?.message || response.statusText}`); continue; } const matchIdsFromApi = await response.json(); if (matchIdsFromApi.length === 0) { setUpdateProgress(`No new API matches for ${account.name}#${account.tag} in the specified range. (${i + 1}/${trackedAccounts.length})`); if (!customStartDate && !customEndDate) { await db.trackedAccounts.update(account.id, { lastUpdated: new Date().getTime() }); } continue; } setUpdateProgress(`Found ${matchIdsFromApi.length} IDs for ${account.name}. Checking & fetching...`); let newMatchesProcessedForThisAccount = 0; for (const matchId of matchIdsFromApi) { if (!customStartDate && newMatchesProcessedForThisAccount >= MATCH_DETAILS_TO_PROCESS_PER_ACCOUNT_UPDATE) break; const existingMatch = await db.matches.get(matchId); const needsTimelineFetch = !existingMatch || !existingMatch.rawTimelineFrames || existingMatch.rawTimelineFrames.length === 0; if (existingMatch && !needsTimelineFetch) continue; setUpdateProgress(`Fetching details: ${matchId} for ${account.name}...`); await delay(API_CALL_DELAY_MS); const matchDetailUrl = `https://${continentalRoute}.api.riotgames.com/lol/match/v5/matches/${matchId}?api_key=${RIOT_API_KEY}`; const detailResponse = await fetch(matchDetailUrl); if (!detailResponse.ok) { console.warn(`Failed to fetch details for ${matchId}. Status: ${detailResponse.status}`); continue; } const matchDetail = await detailResponse.json(); let gameSpecificPatch = 'N/A'; if (matchDetail.info && matchDetail.info.gameVersion) { const versionString = matchDetail.info.gameVersion; const versionParts = versionString.split('.'); if (versionParts.length >= 2) gameSpecificPatch = `${versionParts[0]}.${versionParts[1]}`; else gameSpecificPatch = versionString; } let currentRawTimelineFrames = existingMatch?.rawTimelineFrames || []; if (needsTimelineFetch) { setUpdateProgress(`Fetching timeline: ${matchId}...`); await delay(API_CALL_DELAY_MS); const timelineUrl = `https://${continentalRoute}.api.riotgames.com/lol/match/v5/matches/${matchId}/timeline?api_key=${RIOT_API_KEY}`; const timelineResponse = await fetch(timelineUrl); if (timelineResponse.ok) { const timelineJson = await timelineResponse.json(); currentRawTimelineFrames = timelineJson.info?.frames || []; } else { console.warn(`Failed to fetch timeline for ${matchId}. Status: ${timelineResponse.status}`); } } const playerParticipant = matchDetail.info.participants.find(p => p.puuid === account.puuid); if (playerParticipant) { let opponentParticipant = null; let opponentParticipantIdForTimeline = null; if (playerParticipant.teamPosition && playerParticipant.teamPosition !== '') { opponentParticipant = matchDetail.info.participants.find(p => p.teamId !== playerParticipant.teamId && p.teamPosition === playerParticipant.teamPosition); } if (opponentParticipant) opponentParticipantIdForTimeline = matchDetail.info.participants.findIndex(p => p.puuid === opponentParticipant.puuid) + 1; const playerParticipantIdForTimeline = matchDetail.info.participants.findIndex(p => p.puuid === playerParticipant.puuid) + 1; const processedTimeline = processTimelineData(currentRawTimelineFrames, playerParticipantIdForTimeline, opponentParticipantIdForTimeline, matchDetail.info.gameDuration); const matchDataToStore = { matchId: matchDetail.metadata.matchId, trackedAccountDocId: account.id, gameCreation: matchDetail.info.gameCreation, gameDuration: matchDetail.info.gameDuration, gameMode: matchDetail.info.gameMode, queueId: matchDetail.info.queueId, gamePatchVersion: gameSpecificPatch, platformId: account.platformId, puuid: account.puuid, win: playerParticipant.win, championName: playerParticipant.championName, championId: playerParticipant.championId, championLevel: playerParticipant.champLevel, teamPosition: playerParticipant.teamPosition, kills: playerParticipant.kills, deaths: playerParticipant.deaths, assists: playerParticipant.assists, totalMinionsKilled: playerParticipant.totalMinionsKilled, neutralMinionsKilled: playerParticipant.neutralMinionsKilled, goldEarned: playerParticipant.goldEarned, item0: playerParticipant.item0, item1: playerParticipant.item1, item2: playerParticipant.item2, item3: playerParticipant.item3, item4: playerParticipant.item4, item5: playerParticipant.item5, item6: playerParticipant.item6, summoner1Id: playerParticipant.summoner1Id, summoner2Id: playerParticipant.summoner2Id, perks: playerParticipant.perks, opponentChampionName: opponentParticipant ? opponentParticipant.championName : null, mainGoal: existingMatch?.mainGoal || "", goalAchieved: existingMatch?.goalAchieved || "", goalDifficultyReason: existingMatch?.goalDifficultyReason || "", positiveMoment: existingMatch?.positiveMoment || "", keyMistake: existingMatch?.keyMistake || "", actionableTakeaway: existingMatch?.actionableTakeaway || "", gameRating: existingMatch?.gameRating || null, mentalRating: existingMatch?.mentalRating || null, generalNotes: existingMatch?.generalNotes || "", vibeTags: existingMatch?.vibeTags || [], notes: existingMatch?.notes || "", goals: existingMatch?.goals || "", rating: existingMatch?.rating || null, allParticipants: matchDetail.info.participants.map(p => ({ puuid: p.puuid, summonerName: p.summonerName, riotIdGameName: p.riotIdGameName, riotIdTagline: p.riotIdTagline, championName: p.championName, champLevel: p.champLevel, teamId: p.teamId, teamPosition: p.teamPosition, kills: p.kills, deaths: p.deaths, assists: p.assists, totalMinionsKilled: p.totalMinionsKilled, neutralMinionsKilled: p.neutralMinionsKilled, goldEarned: p.goldEarned, totalDamageDealtToChampions: p.totalDamageDealtToChampions, visionScore: p.visionScore, wardsPlaced: p.wardsPlaced, wardsKilled: p.wardsKilled, visionWardsBoughtInGame: p.visionWardsBoughtInGame, item0: p.item0, item1: p.item1, item2: p.item2, item3: p.item3, item4: p.item4, item5: p.item5, item6: p.item6, summoner1Id: p.summoner1Id, summoner2Id: p.summoner2Id, perks: p.perks })), teamObjectives: matchDetail.info.teams.map(t => ({ teamId: t.teamId, win: t.win, objectives: t.objectives })), processedTimelineForTrackedPlayer: processedTimeline, rawTimelineFrames: currentRawTimelineFrames, }; await db.matches.put(matchDataToStore); const matchForDisplay = { ...matchDataToStore, trackedAccountName: `${account.name}#${account.tag}`, trackedAccountPlatform: account.platformId, isNew: true }; setAllMatchesFromDb(prevMatches => { const newMatchesList = prevMatches.filter(m => m.matchId !== matchForDisplay.matchId); newMatchesList.push(matchForDisplay); newMatchesList.sort((a, b) => (b.gameCreation || 0) - (a.gameCreation || 0)); return newMatchesList; }); if (!existingMatch || needsTimelineFetch) totalNewMatchesActuallyStoredThisSession++; newMatchesProcessedForThisAccount++; } } if (!customStartDate && !customEndDate) { await db.trackedAccounts.update(account.id, { lastUpdated: new Date().getTime() }); } } catch (err) { console.error(`Error processing account ${account.name}#${account.tag}:`, err); setError(`Update error for ${account.name}. Check console.`); } } setUpdateProgress(`Update finished. Newly stored/updated with timeline: ${totalNewMatchesActuallyStoredThisSession}.`); if (totalNewMatchesActuallyStoredThisSession > 0) { setSuccessMessage(`${totalNewMatchesActuallyStoredThisSession} matches updated/added.`); } else { setSuccessMessage(`No new matches found to update this session.`); } setTimeout(() => setSuccessMessage(''), 4000); setIsUpdatingAllMatches(false); };

    // Note Handling
    const handleOpenNotes = (match) => {
        let activePreGameGoalFromStorage = null;
        try {
            const storedGoal = localStorage.getItem('activePreGameGoal');
            if (storedGoal) {
                activePreGameGoalFromStorage = JSON.parse(storedGoal);
            }
        } catch (error) {
            console.error("Error reading pre-game goal from localStorage:", error);
        }
        setSelectedMatchForNotes({...match, activePreGameGoal: activePreGameGoalFromStorage });
    };
    const handleCloseNotes = () => { setSelectedMatchForNotes(null); };
    const handleSaveNotes = async (matchIdToSave, newNotesData) => { 
        if (!matchIdToSave) { setError("Error: Cannot save notes. Missing match ID."); return; } 
        setIsSavingNotes(true); setError(''); setSuccessMessage(''); 
        try { 
            await db.matches.update(matchIdToSave, { ...newNotesData }); 
            setAllMatchesFromDb(prevMatches => prevMatches.map(m => m.matchId === matchIdToSave ? { ...m, ...newNotesData, isNew: false } : m )); 
            setSelectedMatchForNotes(prev => prev && prev.matchId === matchIdToSave ? {...prev, ...newNotesData} : prev ); 
            setSuccessMessage("Review saved successfully!"); 
            setTimeout(() => setSuccessMessage(''), 3000); 
        } catch (err) { 
            console.error("Error saving notes to Dexie in MatchHistoryPage:", err); 
            setError("Failed to save notes. Check console for details."); 
        } finally { 
            setIsSavingNotes(false); 
        } 
    };
    
    // Page Navigation
    const handlePageChange = (page) => { setCurrentPage(page); setExpandedMatchId(null); };

    // DDragon Image/Data Getters
    const getChampionInfo = (championKeyApi) => { if (!championData || !championKeyApi) return { displayName: championKeyApi, imageName: championKeyApi + ".png", ddragonId: championKeyApi }; let ddragonKeyToLookup = championKeyApi === "Fiddlesticks" ? "FiddleSticks" : championKeyApi; const championInfo = championData[ddragonKeyToLookup] || Object.values(championData).find(c => c.id.toLowerCase() === championKeyApi.toLowerCase()); return championInfo ? { displayName: championInfo.name, imageName: championInfo.image.full, ddragonId: championInfo.id } : { displayName: championKeyApi, imageName: championKeyApi + ".png", ddragonId: championKeyApi }; };
    const getChampionImage = (championKeyApi) => !championKeyApi || !ddragonVersion || !championData ? `https://placehold.co/56x56/2D2D2D/666?text=${championKeyApi ? championKeyApi.substring(0,1) : '?'}` : `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${getChampionInfo(championKeyApi).imageName}`;
    const getChampionDisplayName = (championKeyApi) => !championKeyApi || !championData ? (championKeyApi || 'N/A') : getChampionInfo(championKeyApi).displayName;
    const getItemImage = (itemId) => !itemId || !ddragonVersion || itemId === 0 ? null : `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/item/${itemId}.png`;
    const getSummonerSpellImage = (spellId) => !spellId || !ddragonVersion || !summonerSpellsMap[spellId] ? null : `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/spell/${summonerSpellsMap[spellId].image.full}`;
    const getRuneImage = (runeId) => { if (!runeId || !ddragonVersion || Object.keys(runesMap).length === 0) return null; const runeInfo = runesMap[runeId]; if (!runeInfo || !runeInfo.icon) { return null; } return `https://ddragon.leagueoflegends.com/cdn/img/${runeInfo.icon}`; };
    const toggleExpandMatch = (matchIdToToggle) => { setExpandedMatchId(prevId => (prevId === matchIdToToggle ? null : matchIdToToggle)); };

    // Render
    if (!RIOT_API_KEY && !error.includes("Configuration Error")) { return ( <div className="p-4 sm:p-6 md:p-8 text-gray-100 flex flex-col items-center justify-center h-full"> <AlertTriangle size={48} className="text-red-500 mb-4" /> <h2 className="text-2xl font-semibold text-red-400 mb-2">Configuration Error</h2> <p className="text-gray-300 text-center max-w-md"> Riot API Key is missing. </p> </div> ); }
    const summaryMatches = useMemo(() => { return filteredMatches; }, [filteredMatches]);

    return (
        <div className="flex flex-1 overflow-hidden h-[calc(100vh-4rem)]">
            <div
                ref={matchListContainerRef}
                className={`text-gray-100 transition-all duration-300 ease-in-out overflow-y-auto h-full
                            ${selectedMatchForNotes ? 'w-full md:w-3/5 lg:w-2/3 xl:w-3/4' : 'w-full'}`}
            >
                <MatchHistoryHeader
                    filteredMatches={summaryMatches} 
                    allMatches={allMatchesFromDb} 
                    championData={championData}
                    getChampionImage={getChampionImage}
                    getChampionDisplayName={getChampionDisplayName}
                    handleUpdateAllMatches={handleUpdateAllMatches}
                    isUpdatingAllMatches={isUpdatingAllMatches}
                    isLoadingAccounts={isLoadingAccounts}
                    trackedAccounts={trackedAccounts}
                    ddragonVersion={ddragonVersion}
                    runesMap={runesMap}
                    updateProgress={updateProgress}
                    gamesForSummaryCount={GAMES_FOR_SUMMARY_PROP}
                    filters={filters}
                    onFilterChange={handleFilterChange}
                    onDatePresetFilter={handleDatePresetFilter}
                    onUpdateFetchDateChange={handleUpdateFetchDateChange}
                    updateFetchDates={updateFetchDates}
                    onClearFilters={handleClearFilters}
                    availableChampions={availableChampions}
                    availablePatches={availablePatches}
                    ROLE_ICON_MAP={ROLE_ICON_MAP}
                    ROLE_ORDER={ROLE_ORDER}
                    goalTemplates={goalTemplates} 
                />

                <div className="max-w-4xl mx-auto w-full mb-2 flex items-center justify-center px-4 sm:px-6 md:px-8">
                    {error && !isUpdatingAllMatches && ( <div className="w-full p-2.5 bg-red-900/40 text-red-300 border border-red-700/60 rounded-md text-sm text-center"> <AlertTriangle size={18} className="inline mr-2" />Error: {error} </div> )}
                    {successMessage && !error && !isUpdatingAllMatches && ( <div className="w-full p-2.5 bg-green-800/40 text-green-300 border border-green-700/60 rounded-md text-sm text-center"> {successMessage} </div> )}
                </div>

                {(isLoadingMatches && !isUpdatingAllMatches && allMatchesFromDb.length === 0) && ( <div className="flex flex-col items-center justify-center p-10 bg-gray-800/80 backdrop-blur-md rounded-xl shadow-xl border border-gray-700/50 max-w-4xl mx-auto mt-8"> <Loader2 size={40} className="text-orange-500 animate-spin" /> <p className="text-gray-300 mt-4 text-lg">Loading matches...</p> </div> )}
                {!isLoadingMatches && Object.keys(groupedMatches).length === 0 && !error && !isUpdatingAllMatches && (
                    <div className="max-w-4xl mx-auto w-full mt-8 px-4 sm:px-6 md:px-8"> {/* Outer wrapper for width, centering, and padding */}
                        <div className="text-center py-10 bg-gray-800/80 backdrop-blur-md rounded-xl shadow-xl border border-dashed border-gray-700/50 min-h-[180px] flex flex-col items-center justify-center"> {/* Inner div for styling and content layout */}
                            <ListChecks size={48} className="text-gray-600 mx-auto mb-4" />
                            <p className="text-gray-400 text-lg">
                                {allMatchesFromDb.length > 0 && filteredMatches.length === 0 ? "No matches found for the current filters." : "No matches found."}
                            </p>
                            {allMatchesFromDb.length > 0 && filteredMatches.length === 0 && (
                                <p className="text-gray-500 text-sm">Try adjusting or clearing the filters.</p>
                            )}
                            {allMatchesFromDb.length === 0 && (
                                <p className="text-gray-500 text-sm">Click "Update Matches" to fetch recent games, or add accounts on the 'Accounts' page.</p>
                            )}
                        </div>
                    </div>
                )}

                {!isLoadingMatches && Object.keys(groupedMatches).length > 0 && (
                    <div className="space-y-3 max-w-4xl mx-auto px-4 sm:px-6 md:px-8 pb-8">
                        {Object.entries(groupedMatches).map(([dateKey, matchesOnDate]) => (
                            <div key={dateKey}> <h2 className="text-lg font-semibold text-gray-100 pb-1.5"> {dateKey} </h2> <div className="space-y-1">
                                    {matchesOnDate.map(match => {
                                        const participantData = match; const isWin = typeof match.win === 'boolean' ? match.win : null; const kdaStringSpans = getKDAStringSpans(participantData); const kdaRatio = getKDARatio(participantData); const kdaColorClass = getKDAColorClass(participantData.kills, participantData.deaths, participantData.assists); const csString = getCSString(participantData); const gameModeDisplay = formatGameMode(match.gameMode, match.queueId); const gameDurationFormatted = formatGameDurationMMSS(match.gameDuration); const itemsRow1 = [match.item0, match.item1, match.item2].map(id => getItemImage(id)); const itemsRow2 = [match.item3, match.item4, match.item5].map(id => getItemImage(id)); const trinketImg = getItemImage(match.item6); const summoner1Img = getSummonerSpellImage(match.summoner1Id); const summoner2Img = getSummonerSpellImage(match.summoner2Id); let primaryPerkId = null; let subStyleId = null; let primaryRuneImg = null; let subStyleImgPath = null; if (match.perks && match.perks.styles && Array.isArray(match.perks.styles) && Object.keys(runesMap).length > 0 && ddragonVersion) { const primaryStyleInfo = match.perks.styles.find(s => s.description === 'primaryStyle'); const subStyleInfo = match.perks.styles.find(s => s.description === 'subStyle'); if (primaryStyleInfo?.selections?.[0]?.perk) { primaryPerkId = primaryStyleInfo.selections[0].perk; primaryRuneImg = getRuneImage(primaryPerkId); } if (subStyleInfo?.style) { subStyleId = subStyleInfo.style; subStyleImgPath = getRuneImage(subStyleId); } } const playerRoleIcon = match.teamPosition ? ROLE_ICON_MAP[match.teamPosition.toUpperCase()] : null; 
                                        const hasMeaningfulNotes = (match.mainGoal && match.mainGoal.trim() !== '') || (match.actionableTakeaway && match.actionableTakeaway.trim() !== '') || (match.generalNotes && match.generalNotes.trim() !== '') || (match.positiveMoment && match.positiveMoment.trim() !== '') || (match.keyMistake && match.keyMistake.trim() !== '');
                                        const notesButtonIcon = hasMeaningfulNotes ? MessageSquare : Edit; const notesButtonTitle = hasMeaningfulNotes ? "View/Edit Review" : "Add Review"; const notesButtonBgClass = hasMeaningfulNotes ? 'bg-sky-600 hover:bg-sky-500 text-white' : 'bg-orange-600 hover:bg-orange-500 text-white';
                                        const resultBgOverlayClass = isWin === null ? 'bg-gray-800/25' : (isWin ? 'bg-blue-900/20' : 'bg-red-900/20'); const expandButtonBgClass = isWin === null ? 'bg-gray-700/60 hover:bg-gray-600/80' : (isWin ? 'bg-blue-900/25 hover:bg-[#304A80]' : 'bg-red-900/25 hover:bg-[#582C3A]'); const isExpanded = expandedMatchId === match.matchId; const animationClass = match.isNew ? 'match-item-enter-active' : '';
                                        return ( <div key={match.matchId} className={`rounded-lg shadow-lg overflow-hidden group ${resultBgOverlayClass} ${animationClass}`}> <div className={`flex items-stretch ${isExpanded ? 'rounded-t-lg' : 'rounded-lg'} ${resultBgOverlayClass}`}> <div className="flex flex-1 items-stretch p-3 ml-1"> <div className="flex flex-col justify-around items-start w-40 flex-shrink-0 mr-2 space-y-0.5"> <p className={`text-md font-semibold text-gray-50`}>{gameModeDisplay}</p> <div className="flex justify-start items-baseline w-full text-xs"> <span className="text-gray-200 mr-2.5">{gameDurationFormatted}</span> <span className="text-gray-400">{timeAgo(match.gameCreation / 1000)}</span> </div> <div className="text-xs text-gray-400 truncate w-full pt-0.5" title={`${match.trackedAccountName} (${match.trackedAccountPlatform?.toUpperCase()})`}> <span className="truncate">{match.trackedAccountName}</span> </div> </div> <div className="flex items-center justify-center space-x-1.5 flex-shrink-0 mx-1"> <div className="relative"> <img src={getChampionImage(match.championName)} alt={getChampionDisplayName(match.championName)} className="w-12 h-12 rounded-md border-2 border-gray-600 shadow-md" onError={(e) => { (e.target.src = `https://placehold.co/48x48/222/ccc?text=${match.championName ? match.championName.substring(0,1) : '?'}`); }} /> {playerRoleIcon && <img src={playerRoleIcon} alt={match.teamPosition || "Role"} className="absolute -bottom-1 -left-1 w-5 h-5 p-0.5 bg-gray-950 rounded-full border border-gray-500 shadow-sm" />} </div> <div className="text-gray-400 text-sm font-light self-center px-0.5">vs</div> <div className="relative"> {match.opponentChampionName ? ( <img src={getChampionImage(match.opponentChampionName)} alt={getChampionDisplayName(match.opponentChampionName)} className="w-12 h-12 rounded-md border-2 border-gray-700 opacity-90 shadow-md" onError={(e) => { (e.target.src = `https://placehold.co/48x48/222/ccc?text=${match.opponentChampionName ? match.opponentChampionName.substring(0,1) : '?'}`); }}/> ) : ( <div className="w-12 h-12 bg-gray-700/50 rounded-md flex items-center justify-center border border-gray-600 shadow-md"> <ListChecks size={20} className="text-gray-500" /> </div> )} </div> </div> <div className="w-px bg-gray-700/60 self-stretch mx-3"></div> <div className="flex items-center space-x-2 bg-gray-900/70 p-2 rounded-lg shadow-inner border border-gray-700/50 flex-shrink-0"> <div className="flex space-x-1"> <div className="flex flex-col space-y-0.5"> <div className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center border border-gray-600/50"> {summoner1Img ? <img src={summoner1Img} alt="Summoner Spell 1" className="w-5 h-5 rounded-sm" /> : <div className="w-5 h-5 rounded-sm bg-gray-700"></div>} </div> <div className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center border border-gray-600/50"> {summoner2Img ? <img src={summoner2Img} alt="Summoner Spell 2" className="w-5 h-5 rounded-sm" /> : <div className="w-5 h-5 rounded-sm bg-gray-700"></div>} </div> </div> <div className="flex flex-col space-y-0.5"> <div className="w-6 h-6 bg-black/20 rounded flex items-center justify-center border border-gray-600/50 p-0.5"> {primaryRuneImg ? (<img src={primaryRuneImg} alt={runesMap[primaryPerkId]?.name || "Keystone"} className="w-full h-full object-contain" onError={(e) => { e.target.style.display = 'none'; const parent = e.target.parentNode; if(parent) parent.innerHTML = '<div class="w-full h-full rounded-sm bg-gray-700/50 flex items-center justify-center text-xs text-gray-500">K?</div>'; }} />) : <div className="w-full h-full rounded-sm bg-gray-700/50 flex items-center justify-center text-xs text-gray-500">K?</div>} </div> <div className="w-6 h-6 bg-black/20 rounded flex items-center justify-center border border-gray-600/50 p-0.5"> {subStyleImgPath ? (<img src={subStyleImgPath} alt={runesMap[subStyleId]?.name || "Secondary Tree"} className="w-full h-full object-contain" onError={(e) => { e.target.style.display = 'none'; const parent = e.target.parentNode; if(parent) parent.innerHTML = '<div class="w-full h-full rounded-sm bg-gray-700/50 flex items-center justify-center text-xs text-gray-500">S?</div>'; }} />) : <div className="w-full h-full rounded-sm bg-gray-700/50 flex items-center justify-center text-xs text-gray-500">S?</div>} </div> </div> </div> <div className="flex flex-col space-y-0.5"> <div className="flex space-x-0.5"> {itemsRow1.map((itemSrc, idx) => ( <div key={`item-r1-${idx}-${match.matchId}`} className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center border border-gray-600/50"> {itemSrc ? <img src={itemSrc} alt={`Item ${idx+1}`} className="w-5 h-5 rounded-sm"/> : <div className="w-5 h-5 rounded-sm bg-gray-700"></div>} </div> ))} <div className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center border border-gray-600/50"> {trinketImg ? <img src={trinketImg} alt="Trinket" className="w-5 h-5 rounded-sm"/> : <div className="w-5 h-5 rounded-sm bg-gray-700"></div> } </div> </div> <div className="flex space-x-0.5"> {itemsRow2.map((itemSrc, idx) => ( <div key={`item-r2-${idx}-${match.matchId}`} className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center border border-gray-600/50"> {itemSrc ? <img src={itemSrc} alt={`Item ${idx+4}`} className="w-5 h-5 rounded-sm"/> : <div className="w-5 h-5 rounded-sm bg-gray-700"></div>} </div> ))} <div className="w-6 h-6"></div> </div> </div> </div> <div className="w-px bg-gray-700/60 self-stretch mx-3"></div> <div className="flex flex-col justify-center flex-grow min-w-[100px] space-y-0.5"> <p className="text-sm">{kdaStringSpans}</p> <p><span className={`text-xs ${kdaColorClass}`}>{kdaRatio}</span> <span className="text-[10px] text-gray-400 ml-1">KDA</span></p> <p className="text-gray-300 text-xs mt-0.5">{csString}</p> </div> <div className="flex items-center ml-auto pl-0.5"> <button onClick={() => handleOpenNotes(match)} className={`p-1.5 rounded-md transition-all duration-150 shadow-sm hover:shadow-md flex items-center justify-center mr-2.5 w-auto h-auto ${notesButtonBgClass}`} title={notesButtonTitle} > <notesButtonIcon size={18} /> </button> </div> </div> <button className={`flex items-center justify-center ${expandButtonBgClass} transition-colors w-8 cursor-pointer ${isExpanded ? 'rounded-tr-lg' : 'rounded-r-lg'}`} title={isExpanded ? "Collapse Details" : "Expand Details"} onClick={() => toggleExpandMatch(match.matchId)}> {isExpanded ? <ChevronUp size={18} className="text-gray-300 group-hover:text-orange-300"/> : <ChevronDown size={18} className="text-gray-400"/>} </button> </div> {isExpanded && ( <ExpandedMatchDetails match={match} ddragonVersion={ddragonVersion} championData={championData} summonerSpellsMap={summonerSpellsMap} runesMap={runesMap} runesDataFromDDragon={runesDataFromDDragon} getChampionImage={getChampionImage} getSummonerSpellImage={getSummonerSpellImage} getItemImage={getItemImage} getRuneImage={getRuneImage} getChampionDisplayName={getChampionDisplayName} isTrackedPlayerWin={isWin} roleIconMap={ROLE_ICON_MAP} roleOrder={ROLE_ORDER} processTimelineDataForPlayer={processTimelineData} /> )} </div> );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {!isLoadingMatches && totalPages > 1 && ( <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} /> )}
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
