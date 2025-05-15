// src/pages/MatchHistoryPage.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, doc, getDoc, setDoc, Timestamp, query, orderBy, limit, updateDoc } from 'firebase/firestore';
import {
    Loader2, AlertTriangle, ListChecks, MessageSquare, RefreshCw, ImageOff, ChevronDown, ChevronUp, Gamepad2, Edit,
    Users, BarChart2, Shield, Swords, Eye, Target, Briefcase, // Icons for General Tab (Players, Damage, Team, KP, CS)
    Flame, Skull, ShieldHalf, Crown, Castle, Bug, // Icons for Objectives
    Star, TrendingUp, MapPin, Layers, Settings, // Icons for Details Tab (placeholders)
    TowerControl, // Already imported, can be used for tower icon
} from 'lucide-react';
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
const MATCH_DETAILS_TO_PROCESS_PER_ACCOUNT_UPDATE = 10; // Consider increasing if API limits allow and full data is often missing
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
const ROLE_ORDER = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];


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

// Komponent dla rozszerzonych szczegółów meczu
const ExpandedMatchDetails = ({ match, ddragonVersion, championData, summonerSpellsMap, runesMap, getChampionImage, getSummonerSpellImage, getItemImage, getRuneImage, getChampionDisplayName }) => {
    const [activeTab, setActiveTab] = useState('General');
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [selectedChampionForDetails, setSelectedChampionForDetails] = useState(null);

    const { allParticipants = [], teamObjectives = [], gameDuration } = match;

    const blueTeam = allParticipants.filter(p => p.teamId === 100).sort((a, b) => ROLE_ORDER.indexOf(a.teamPosition?.toUpperCase()) - ROLE_ORDER.indexOf(b.teamPosition?.toUpperCase()));
    const redTeam = allParticipants.filter(p => p.teamId === 200).sort((a, b) => ROLE_ORDER.indexOf(a.teamPosition?.toUpperCase()) - ROLE_ORDER.indexOf(b.teamPosition?.toUpperCase()));

    const blueTeamData = teamObjectives.find(t => t.teamId === 100) || { objectives: {}, win: false };
    const redTeamData = teamObjectives.find(t => t.teamId === 200) || { objectives: {}, win: false };

    const maxDamageInGame = Math.max(...allParticipants.map(p => p.totalDamageDealtToChampions || 0), 0);

    // Helper to create K/D/A spans with colors
    const getKDASpans = (kills, deaths, assists) => (
        <>
            <span className="text-gray-100">{kills}</span>
            <span className="text-gray-500"> / </span>
            <span className="text-red-400">{deaths}</span>
            <span className="text-gray-500"> / </span>
            <span className="text-gray-100">{assists}</span>
        </>
    );
    
    const renderPlayerRow = (player, teamTotalKills) => {
        const items = [player.item0, player.item1, player.item2, player.item3, player.item4, player.item5];
        const trinket = player.item6;
        const kdaColor = getKDAColorClass(player.kills, player.deaths, player.assists);
        const kdaRatio = gameDuration > 0 ? (player.deaths === 0 ? (player.kills > 0 || player.assists > 0 ? 'Perfect' : '0.00') : ((player.kills + player.assists) / player.deaths).toFixed(2)) : '0.00';
        const kp = teamTotalKills > 0 ? (((player.kills + player.assists) / teamTotalKills) * 100).toFixed(0) + '%' : '0%';
        const cs = (player.totalMinionsKilled || 0) + (player.neutralMinionsKilled || 0);
        const csPerMin = gameDuration > 0 ? (cs / (gameDuration / 60)).toFixed(1) : '0.0';
        const damageDealt = player.totalDamageDealtToChampions || 0;
        const damagePerMin = gameDuration > 0 ? (damageDealt / (gameDuration / 60)).toFixed(0) : '0';
        const damagePercentage = maxDamageInGame > 0 ? (damageDealt / maxDamageInGame) * 100 : 0;

        const playerPrimaryPerk = player.perks?.styles?.find(s => s.description === 'primaryStyle')?.selections?.[0]?.perk;
        const playerSubStyle = player.perks?.styles?.find(s => s.description === 'subStyle')?.style;
        const roleIcon = ROLE_ICON_MAP[player.teamPosition?.toUpperCase()];

        return (
            <div key={player.puuid || player.summonerName} className="flex items-center gap-x-2 sm:gap-x-3 py-0.5 px-1 border-b border-gray-700/30 last:border-b-0 text-xs hover:bg-gray-700/10 transition-colors duration-150">
                {/* 1. Champion Info */}
                <div className="flex items-center space-x-1.5 w-[120px] sm:w-[140px] flex-shrink-0">
                    <div className="relative w-9 h-9"> {/* Increased size slightly */}
                        <img src={getChampionImage(player.championName)} alt={getChampionDisplayName(player.championName)} className="w-full h-full rounded-md border border-gray-600" />
                        <span className="absolute -bottom-1 -right-1 bg-black bg-opacity-80 text-white text-[9px] px-1 rounded-sm leading-tight border border-gray-500/50">{player.champLevel}</span>
                        {roleIcon && (
                            <img src={roleIcon} alt={player.teamPosition} className="absolute -top-1 -left-1 w-4 h-4 p-0.5 bg-gray-800 rounded-full border border-gray-400/70 shadow-sm" />
                        )}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                        <span className="font-semibold text-gray-100 truncate" title={player.riotIdGameName || player.summonerName}>
                            {player.riotIdGameName || player.summonerName || 'Player'}
                        </span>
                        <span className="text-gray-400 text-[10px]">Rank Placeholder</span> {/* Placeholder */}
                    </div>
                </div>

                {/* 2. Build Info (Summoners, Runes, Items with slots) */}
                <div className="flex items-center space-x-1 flex-shrink-0">
                    {/* Summoners */}
                    <div className="flex flex-col space-y-0.5">
                        <div className="w-5 h-5 bg-black/30 rounded border border-gray-600 flex items-center justify-center"><img src={getSummonerSpellImage(player.summoner1Id)} alt="S1" className="w-full h-full rounded-sm" onError={(e) => e.target.style.display='none'}/></div>
                        <div className="w-5 h-5 bg-black/30 rounded border border-gray-600 flex items-center justify-center"><img src={getSummonerSpellImage(player.summoner2Id)} alt="S2" className="w-full h-full rounded-sm" onError={(e) => e.target.style.display='none'}/></div>
                    </div>
                    {/* Runes */}
                    <div className="flex flex-col space-y-0.5">
                         <div className="w-5 h-5 bg-black/30 rounded border border-gray-600 flex items-center justify-center p-px"><img src={getRuneImage(playerPrimaryPerk)} alt="R1" className="w-full h-full object-contain" onError={(e) => e.target.style.display='none'}/></div>
                         <div className="w-5 h-5 bg-black/30 rounded border border-gray-600 flex items-center justify-center p-px"><img src={getRuneImage(playerSubStyle)} alt="R2" className="w-full h-full object-contain" onError={(e) => e.target.style.display='none'}/></div>
                    </div>
                    {/* Items */}
                    <div className="flex flex-col space-y-0.5">
                        <div className="flex space-x-0.5">
                            {[items[0], items[1], items[2], trinket].map((item, idx) => (
                                <div key={`item-top-${idx}`} className="w-5 h-5 bg-black/30 rounded border border-gray-600 flex items-center justify-center">
                                    {item && item !== 0 ? <img src={getItemImage(item)} alt={`Item ${idx}`} className="w-full h-full rounded-sm"/> : <div className="w-4 h-4 bg-gray-700/50 rounded-sm"></div>}
                                </div>
                            ))}
                        </div>
                        <div className="flex space-x-0.5">
                            {[items[3], items[4], items[5]].map((item, idx) => (
                                 <div key={`item-bot-${idx}`} className="w-5 h-5 bg-black/30 rounded border border-gray-600 flex items-center justify-center">
                                    {item && item !== 0 ? <img src={getItemImage(item)} alt={`Item ${idx+3}`} className="w-full h-full rounded-sm"/> : <div className="w-4 h-4 bg-gray-700/50 rounded-sm"></div>}
                                </div>
                            ))}
                             <div className="w-5 h-5"></div> {/* Placeholder for alignment */}
                        </div>
                    </div>
                </div>

                {/* 3. Stats Block */}
                <div className="flex flex-1 justify-around items-start gap-x-1 sm:gap-x-2 text-center">
                    {/* KDA Group */}
                    <div className="flex flex-col items-center min-w-[55px] sm:min-w-[65px]">
                        <span className="font-semibold text-gray-100">{getKDASpans(player.kills, player.deaths, player.assists)}</span>
                        <span className={`text-[10px] ${kdaColor}`}>{kdaRatio} KDA</span>
                    </div>
                    {/* KP Group */}
                    <div className="flex flex-col items-center min-w-[30px] sm:min-w-[35px]">
                        <span className="text-gray-200">{kp}</span>
                        <span className="text-[10px] text-gray-500">KP</span>
                    </div>
                    {/* CS Group */}
                    <div className="flex flex-col items-center min-w-[55px] sm:min-w-[65px]">
                        <span className="text-gray-200">{cs}</span>
                        <span className="text-[10px] text-gray-500">{csPerMin} CS/m</span>
                    </div>
                    {/* Damage Group */}
                    <div className="flex flex-col items-center flex-grow min-w-[70px] sm:min-w-[90px] max-w-[120px]">
                        <div className="flex justify-between w-full items-baseline">
                            <span className="text-gray-200 text-[10px] font-medium">{damageDealt}</span>
                            <span className="text-gray-400 text-[9px]">{damagePerMin} DPM</span>
                        </div>
                        <div className="h-1.5 bg-gray-500 rounded-full w-full overflow-hidden my-0.5">
                            <div className={`h-full ${player.teamId === 100 ? 'bg-blue-500' : 'bg-red-500'}`} style={{ width: `${damagePercentage}%` }}></div>
                        </div>
                    </div>
                    {/* Wards Group */}
                    <div className="flex flex-col items-center min-w-[50px] sm:min-w-[60px]">
                        <span className="text-gray-200">{player.visionWardsBoughtInGame || 0} CW</span>
                        <span className="text-[10px] text-gray-500">{player.wardsPlaced || 0}/{player.wardsKilled || 0} W</span>
                    </div>
                </div>
            </div>
        );
    };

    const renderTeamSection = (team, teamData, teamName) => {
        const totalKills = teamData?.objectives?.champion?.kills || 0;
        const teamSide = teamName === 'Blue Team' ? 'Blue Side' : 'Red Side';
        const teamColor = teamName === 'Blue Team' ? 'blue' : 'red';
        
        return (
            <div className={`p-2 sm:p-3 rounded-md ${teamColor === 'blue' ? 'bg-blue-900/20' : 'bg-red-900/20'}`}>
                <div className="flex items-center mb-1.5 pb-1 border-b border-gray-600/70">
                    <h3 className={`text-md sm:text-lg font-semibold ${teamColor === 'blue' ? 'text-blue-400' : 'text-red-400'}`}>
                        {teamData.win ? 'Victory' : 'Defeat'}
                        <span className="text-xs sm:text-sm text-gray-400 font-normal ml-1.5 mr-2 sm:mr-3">
                            ({teamSide})
                        </span>
                    </h3>
                    <div className="flex space-x-1.5 sm:space-x-2 items-center text-xs">
                        <span title="Grubs"><Bug size={12} smSize={14} className={`inline text-${teamColor}-400/80`}/> {teamData.objectives?.horde?.kills || 0}</span>
                        <span title="Dragons"><Flame size={12} smSize={14} className={`inline text-${teamColor}-400/80`}/> {teamData.objectives?.dragon?.kills || 0}</span>
                        <span title="Barons"><Skull size={12} smSize={14} className={`inline text-${teamColor}-400/80`}/> {teamData.objectives?.baron?.kills || 0}</span>
                        <span title="Heralds"><ShieldHalf size={12} smSize={14} className={`inline text-${teamColor}-400/80`}/> {teamData.objectives?.riftHerald?.kills || 0}</span>
                        {/* Placeholder for Elder Dragon - assuming 'elderDragon' key if available */}
                        {teamData.objectives?.elderDragon && <span title="Elder Dragons"><Crown size={12} smSize={14} className="inline text-yellow-400/80"/> {teamData.objectives.elderDragon.kills || 0}</span>}
                        <span title="Towers"><TowerControl size={12} smSize={14} className="inline text-gray-400/80"/> {teamData.objectives?.tower?.kills || 0}</span>
                    </div>
                </div>
                {/* Header Row for player stats */}
                <div className="flex items-center gap-x-2 sm:gap-x-3 py-0.5 px-1 text-gray-400 text-[9px] sm:text-[10px] font-medium border-b border-gray-600/50">
                    <div className="w-[120px] sm:w-[140px] flex-shrink-0">Player</div>
                    <div className="flex-shrink-0 mr-1">Build</div>
                    <div className="flex flex-1 justify-around items-center text-center">
                        <div className="min-w-[55px] sm:min-w-[65px]">KDA</div>
                        <div className="min-w-[30px] sm:min-w-[35px]">KP</div>
                        <div className="min-w-[55px] sm:min-w-[65px]">CS</div>
                        <div className="flex-grow min-w-[70px] sm:min-w-[90px] max-w-[120px]">Damage</div>
                        <div className="min-w-[50px] sm:min-w-[60px]">Wards</div>
                    </div>
                </div>
                {team.map(player => renderPlayerRow(player, totalKills))}
            </div>
        );
    };

    const GeneralTabContent = () => (
        <div className="space-y-3"> {/* Reduced space between team sections */}
            {renderTeamSection(blueTeam, blueTeamData, "Blue Team")}
            {renderTeamSection(redTeam, redTeamData, "Red Team")}
        </div>
    );

    const DetailsTabContent = () => {
        const renderChampionIconForDetails = (player) => (
            <button
                key={player.puuid || player.summonerName}
                onClick={() => setSelectedChampionForDetails(player)}
                className={`p-1 rounded-md hover:bg-gray-600 transition-all ${selectedChampionForDetails?.puuid === player.puuid ? 'bg-orange-600 ring-2 ring-orange-400' : 'bg-gray-700/80 border border-gray-600'}`}
                title={`View details for ${getChampionDisplayName(player.championName)}`}
            >
                <img
                    src={getChampionImage(player.championName)}
                    alt={getChampionDisplayName(player.championName)}
                    className="w-10 h-10 rounded"
                />
            </button>
        );

        return (
            <div className="p-3 sm:p-4">
                <h3 className="text-md sm:text-lg font-semibold text-gray-200 mb-2 sm:mb-3">Select a Champion to View Details</h3>
                <div className="mb-3 sm:mb-4">
                    <p className="text-xs sm:text-sm text-blue-400 mb-1">Blue Team</p>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                        {blueTeam.map(renderChampionIconForDetails)}
                    </div>
                </div>
                <div className="mb-3 sm:mb-4">
                    <p className="text-xs sm:text-sm text-red-400 mb-1">Red Team</p>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                        {redTeam.map(renderChampionIconForDetails)}
                    </div>
                </div>

                {isLoadingDetails && selectedChampionForDetails && (
                     <div className="flex justify-center items-center mt-4 sm:mt-6">
                        <Loader2 size={24} smSize={28} className="text-orange-500 animate-spin mr-2" />
                        Loading details for {getChampionDisplayName(selectedChampionForDetails.championName)}...
                    </div>
                )}

                {selectedChampionForDetails && !isLoadingDetails && (
                    <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-gray-700/40 rounded-lg border border-gray-600/50">
                        <h4 className="text-lg sm:text-xl font-bold text-orange-400 mb-2 sm:mb-3">
                            {getChampionDisplayName(selectedChampionForDetails.championName)} - Detailed Stats (Placeholder)
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                            <div>
                                <h5 className="font-semibold text-gray-300 mb-1">Laning Phase (at 15 min)</h5>
                                <p>CS Diff: <span className="text-gray-100">N/A</span></p>
                                <p>Gold Diff: <span className="text-gray-100">N/A</span></p>
                                <p>XP Diff: <span className="text-gray-100">N/A</span></p>
                                <p>First Level 2?: <span className="text-gray-100">N/A</span></p>
                            </div>
                            <div>
                                <h5 className="font-semibold text-gray-300 mb-1">Wards</h5>
                                <p>Wards Placed: <span className="text-gray-100">{selectedChampionForDetails.wardsPlaced || 0}</span></p>
                                <p>Wards Destroyed: <span className="text-gray-100">{selectedChampionForDetails.wardsKilled || 0}</span></p>
                                <p>Control Wards Bought: <span className="text-gray-100">{selectedChampionForDetails.visionWardsBoughtInGame || 0}</span></p>
                            </div>
                             <div>
                                <h5 className="font-semibold text-gray-300 mb-1">Global Stats</h5>
                                <p>CS/min: <span className="text-gray-100">{( ( (selectedChampionForDetails.totalMinionsKilled || 0) + (selectedChampionForDetails.neutralMinionsKilled || 0) ) / (gameDuration / 60) ).toFixed(1) || '0.0'}</span></p>
                                <p>Vision Score/min: <span className="text-gray-100">{gameDuration > 0 ? ((selectedChampionForDetails.visionScore || 0) / (gameDuration / 60)).toFixed(2) : '0.00'}</span></p>
                                <p>DMG/min: <span className="text-gray-100">{gameDuration > 0 ? ((selectedChampionForDetails.totalDamageDealtToChampions || 0) / (gameDuration / 60)).toFixed(0) : '0'}</span></p>
                                <p>Gold/min: <span className="text-gray-100">{gameDuration > 0 ? ((selectedChampionForDetails.goldEarned || 0) / (gameDuration / 60)).toFixed(0) : '0'}</span></p>
                            </div>
                            <div>
                                <h5 className="font-semibold text-gray-300 mb-1">Build Order (Placeholder)</h5>
                                <p className="text-gray-400">Item timeline data not yet implemented.</p>
                            </div>
                            <div>
                                <h5 className="font-semibold text-gray-300 mb-1">Runes (Placeholder)</h5>
                                <p className="text-gray-400">Rune tree display not yet implemented.</p>
                            </div>
                            <div>
                                <h5 className="font-semibold text-gray-300 mb-1">Skill Order (Placeholder)</h5>
                                <p className="text-gray-400">Skill order display not yet implemented.</p>
                            </div>
                        </div>
                    </div>
                )}
                 {!selectedChampionForDetails && !isLoadingDetails && (
                    <p className="text-center text-gray-400 mt-4 sm:mt-6 text-sm">Select a champion icon above to see their specific details.</p>
                )}
            </div>
        );
    };


    return (
        <div className="mt-0.5 p-2 sm:p-3 bg-gray-800/50 backdrop-blur-sm rounded-b-lg border-t border-gray-700/50 shadow-inner">
            <div className="flex border-b border-gray-600/80 mb-2 sm:mb-3">
                <button
                    onClick={() => setActiveTab('General')}
                    className={`py-1.5 sm:py-2 px-3 sm:px-4 text-xs sm:text-sm font-medium transition-colors focus:outline-none
                        ${activeTab === 'General' ? 'text-orange-400 border-b-2 border-orange-500' : 'text-gray-400 hover:text-gray-200 hover:border-b-2 hover:border-gray-500'}`}
                >
                    General
                </button>
                <button
                    onClick={() => setActiveTab('Details')}
                    className={`py-1.5 sm:py-2 px-3 sm:px-4 text-xs sm:text-sm font-medium transition-colors focus:outline-none
                        ${activeTab === 'Details' ? 'text-orange-400 border-b-2 border-orange-500' : 'text-gray-400 hover:text-gray-200 hover:border-b-2 hover:border-gray-500'}`}
                >
                    Details
                </button>
            </div>
            {activeTab === 'General' && <GeneralTabContent />}
            {activeTab === 'Details' && <DetailsTabContent />}
        </div>
    );
};


function MatchHistoryPage() {
  // Stany komponentu
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
          if (docSnap.exists() && docSnap.data().allParticipants && docSnap.data().teamObjectives) { // Check for both new fields
              console.log(`Match ${matchId} for ${account.name} already has full details. Skipping.`);
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
              notes: docSnap.exists() ? docSnap.data().notes || "" : "",
              goals: docSnap.exists() ? docSnap.data().goals || "" : "",
              rating: docSnap.exists() ? docSnap.data().rating || null : null,
              allParticipants: matchDetail.info.participants.map(p => ({
                puuid: p.puuid,
                summonerName: p.summonerName,
                riotIdGameName: p.riotIdGameName, // Added for display
                riotIdTagline: p.riotIdTagline, // Added for display
                championName: p.championName,
                champLevel: p.champLevel,
                teamId: p.teamId,
                teamPosition: p.teamPosition,
                kills: p.kills, deaths: p.deaths, assists: p.assists,
                totalMinionsKilled: p.totalMinionsKilled, neutralMinionsKilled: p.neutralMinionsKilled,
                goldEarned: p.goldEarned,
                totalDamageDealtToChampions: p.totalDamageDealtToChampions,
                visionScore: p.visionScore,
                wardsPlaced: p.wardsPlaced, wardsKilled: p.wardsKilled,
                visionWardsBoughtInGame: p.visionWardsBoughtInGame,
                item0: p.item0, item1: p.item1, item2: p.item2, item3: p.item3, item4: p.item4, item5: p.item5, item6: p.item6,
                summoner1Id: p.summoner1Id, summoner2Id: p.summoner2Id,
                perks: p.perks, // Store the whole perks object
              })),
              teamObjectives: matchDetail.info.teams.map(t => ({
                teamId: t.teamId,
                win: t.win,
                objectives: t.objectives // Store all objectives
              })),
            };
            await setDoc(matchDocRef, matchDataToStore, { merge: true });
            totalNewMatchesActuallyStored++; newMatchesProcessedForThisAccount++;
          }
        }
      } catch (err) {
        console.error(`Error processing account ${account.name}#${account.tag}:`, err);
        setError(`Error updating ${account.name}. Check console.`);
      }
    }
    setUpdateProgress(`Update finished. Stored/Updated ${totalNewMatchesActuallyStored} matches with full details.`);
    setIsUpdatingAllMatches(false);
    fetchAllMatchesFromDb();
  };

  const handleOpenNotes = (match) => { setSelectedMatchForNotes(match); };
  const handleCloseNotes = () => { setSelectedMatchForNotes(null); };

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

  const handlePageChange = (page) => {
    setCurrentPage(page);
    setExpandedMatchId(null);
  };

  const getKDAStringSpans = (p) => {
    if (!p || typeof p.kills === 'undefined') return <span className="text-gray-300">N/A</span>;
    return (
        <>
            <span className="text-gray-200">{p.kills}</span>
            <span className="text-gray-400"> / </span>
            <span className="text-red-400">{p.deaths}</span>
            <span className="text-gray-400"> / </span>
            <span className="text-gray-200">{p.assists}</span>
        </>
    );
  };

  const getKDARatio = (p) => {
    if (!p || typeof p.kills === 'undefined' || typeof p.deaths === 'undefined' || typeof p.assists === 'undefined') return '';
    if (p.deaths === 0 && (p.kills > 0 || p.assists > 0)) return 'Perfect';
    if (p.deaths === 0) return '0.00';
    return ((p.kills + p.assists) / p.deaths).toFixed(2);
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
  const getChampionImage = (key) => !key || !ddragonVersion || !championData ? `https://placehold.co/56x56/2D2D2D/666?text=${key ? key.substring(0,1) : '?'}` : `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${getChampionInfo(key).imageName}`;
  const getChampionDisplayName = (key) => !key || !championData ? (key || 'N/A') : getChampionInfo(key).displayName;
  const getItemImage = (id) => !id || !ddragonVersion || id === 0 ? null : `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/item/${id}.png`;
  const getSummonerSpellImage = (id) => !id || !ddragonVersion || !summonerSpellsMap[id] ? null : `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/spell/${summonerSpellsMap[id].image.full}`;
  const getRuneImage = (id) => {
    if (!id || !ddragonVersion || !runesMap[id] || !runesMap[id].icon) return null;
    return `https://ddragon.leagueoflegends.com/cdn/img/${runesMap[id].icon}`;
  };

  const toggleExpandMatch = (matchId) => {
    setExpandedMatchId(prevId => (prevId === matchId ? null : matchId));
  };

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

                        const resultBgOverlayClass = isWin === null ? '' : (isWin ? 'bg-blue-600/20' : 'bg-[#f7665e]/20');
                        const expandButtonBgClass = isWin === null ? 'bg-gray-700/60 hover:bg-gray-600/80' : (isWin ? 'bg-[#263964] hover:bg-[#304A80]' : 'bg-[#42212C] hover:bg-[#582C3A]');
                        const isExpanded = expandedMatchId === match.id;

                        return (
                            <div key={match.id} className={`rounded-lg shadow-lg overflow-hidden group ${isExpanded ? 'bg-gray-800/30' : resultBgOverlayClass}`}>
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
                                                    <div className="w-6 h-6"></div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="w-px bg-gray-700/60 self-stretch mx-3"></div>
                                        <div className="flex flex-col justify-center flex-grow min-w-[100px] space-y-0.5">
                                            <p className="font-semibold text-sm">{kdaStringSpans}</p>
                                            <p className={`text-xs ${kdaColorClass}`}>{kdaRatio} KDA</p>
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
                                                {hasNotesOrGoals ? <MessageSquare size={14} /> : <Edit size={18} />}
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
