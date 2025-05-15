// src/pages/MatchHistoryPage.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, doc, getDoc, setDoc, Timestamp, query, orderBy, limit, updateDoc } from 'firebase/firestore';
import {
    Loader2, AlertTriangle, ListChecks, MessageSquare, RefreshCw, ImageOff, ChevronDown, ChevronUp, Edit,
    Users, BarChart2, // Assuming these are for other tabs/placeholders
    Star, TrendingUp, MapPin, Layers, Settings, Gamepad2 // Gamepad2 for general game icon
} from 'lucide-react';
import MatchNotesPanel from '../components/MatchNotesPanel';
import PaginationControls from '../components/PaginationControls';

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
    processTimelineData, // New import
    QUEUE_IDS
} from '../utils/matchCalculations';


// Import role icons
import topIcon from '../assets/top_icon.svg';
import jungleIcon from '../assets/jungle_icon.svg';
import middleIcon from '../assets/mid_icon.svg';
import bottomIcon from '../assets/bottom_icon.svg';
import supportIcon from '../assets/support_icon.svg';

const RIOT_API_KEY = import.meta.env.VITE_RIOT_API_KEY;
// Moved queue IDs to matchCalculations.js

const MATCH_COUNT_PER_FETCH = 20; // How many match IDs to fetch per account
const MATCH_DETAILS_TO_PROCESS_PER_ACCOUNT_UPDATE = 10; // Max new match details to process to avoid hitting rate limits too fast
const API_CALL_DELAY_MS = 1250; // Delay between Riot API calls
const MATCHES_PER_PAGE = 10;

// --- OBJECTIVE ICONS ---
const GrubIcon = ({ className = "" }) => (
  <svg viewBox="0 0 32 32" className={`inline-block text-purple-500 ${className}`} xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" clipRule="evenodd" d="M24 7.26397C27 7.26397 27 10.264 27 11.264C27 14.264 24 15.264 24 15.264H27C26.0189 15.918 25.3587 17.1069 24.6345 18.4107C23.1444 21.0938 21.3837 24.264 16 24.264C10.6163 24.264 8.85561 21.0938 7.36548 18.4107C6.64135 17.1069 5.9811 15.918 5 15.264H8C8 15.264 5 14.264 5 11.264C5 10.264 5 7.26397 8 7.26397H9.58357C10.5151 7.26397 11.4337 7.0471 12.2669 6.63052L15.1056 5.21115C15.6686 4.92962 16.3314 4.92962 16.8944 5.21115L19.7331 6.63051C20.5663 7.0471 21.4849 7.26397 22.4164 7.26397H24ZM19.5354 12.264L15.9999 8.72845L12.4644 12.264L13.7322 13.5319L10.4646 16.7995L14.0001 20.335L15.9993 18.3359L17.9984 20.335L21.5339 16.7995L18.2669 13.5325L19.5354 12.264Z" fill="currentColor"></path>
  </svg>
);
const DragonIcon = ({ className = "" }) => (
  <svg viewBox="0 0 32 32" className={`inline-block text-yellow-400 ${className}`} xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" clipRule="evenodd" d="M23 5.5V11.5H28L23 16.5V20.5L18 24.5L17 27.5H15L14 24.5L9 20.5V16.5L4 11.5H9V5.5L13.5 10L16 4.5L18.4965 10L23 5.5ZM17 17.5L22 14.5L19 20.5L17 19.5V17.5ZM10 14.5L15 17.5V19.5L13 20.5L10 14.5Z" fill="currentColor"></path>
  </svg>
);
const BaronIcon = ({ className = "" }) => (
  <svg viewBox="0 0 32 32" className={`inline-block text-purple-400 ${className}`} xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" clipRule="evenodd" d="M18.2557 5.31855L26.3761 9.8299C26.7612 10.0438 27 10.4497 27 10.8902C27 11.0785 26.9562 11.2642 26.872 11.4326L24.5883 16C24.0923 21.0584 20.4607 25.5315 19.333 26.8109C19.1841 26.9799 18.9147 26.9207 18.8435 26.7069L18 24.1765H14L13.1565 26.7069C13.0853 26.9207 12.8159 26.9799 12.667 26.8109C11.5393 25.5315 7.90768 21.0584 7.41174 16L5.12805 11.4326C5.04384 11.2642 5 11.0785 5 10.8902C5 10.4497 5.23881 10.0438 5.62386 9.8299L13.7443 5.31855C13.8276 5.27226 13.9223 5.35774 13.8848 5.44536L11 12.1765C11.8333 13.0098 14 13.7765 16 10.1765C18 13.7765 20.1667 13.0098 21 12.1765L18.1152 5.44536C18.0777 5.35774 18.1724 5.27226 18.2557 5.31855ZM16 17.1765C16.8284 17.1765 17.5 16.5049 17.5 15.6765C17.5 14.8481 16.8284 14.1765 16 14.1765C15.1716 14.1765 14.5 14.8481 14.5 15.6765C14.5 16.5049 15.1716 17.1765 16 17.1765ZM16 22.1765C16.8284 22.1765 17.5 21.5049 17.5 20.6765C17.5 19.8481 16.8284 19.1765 16 19.1765C15.1716 19.1765 14.5 19.8481 14.5 20.6765C14.5 21.5049 15.1716 22.1765 16 22.1765ZM20.25 18.1765C20.25 19.0049 19.5784 19.6765 18.75 19.6765C17.9216 19.6765 17.25 19.0049 17.25 18.1765C17.25 17.3481 17.9216 16.6765 18.75 16.6765C19.5784 16.6765 20.25 17.3481 20.25 18.1765ZM13.25 19.6765C14.0784 19.6765 14.75 19.0049 14.75 18.1765C14.75 17.3481 14.0784 16.6765 13.25 16.6765C12.4216 16.6765 11.75 17.3481 11.75 18.1765C11.75 19.0049 12.4216 19.6765 13.25 19.6765Z" fill="currentColor"></path>
  </svg>
);
const HeraldIcon = ({ className = "" }) => (
  <svg viewBox="0 0 32 32" className={`inline-block text-purple-300 ${className}`} xmlns="http://www.w3.org/2000/svg">
    <path d="M15.9997 19.339C16.7132 19.339 17.2917 17.9477 17.2917 16.7586C17.2917 15.5694 16.7132 15.0327 15.9997 15.0327C15.2862 15.0327 14.7079 15.5694 14.7079 16.7586C14.7079 17.9477 15.2862 19.339 15.9997 19.339Z" fill="currentColor"></path><path fillRule="evenodd" clipRule="evenodd" d="M11.6803 11.0327H12.3511C13.4192 10.3975 14.667 10.0327 15.9999 10.0327C17.3329 10.0327 18.5806 10.3975 19.6488 11.0327H20.3195C20.3195 9.03271 20.3195 8.03553 18.9999 6.03271C21.3332 6.53271 25.9999 9.43271 25.9999 17.0327C24.3362 17.6982 23.0184 19.4492 22.3345 20.4989C21.1392 22.777 18.751 24.3309 15.9999 24.3309C13.2488 24.3309 10.8606 22.777 9.66527 20.4989C8.98137 19.4492 7.66364 17.6982 5.9999 17.0327C5.9999 9.43271 10.6666 6.53271 12.9999 6.03271C11.6803 8.03553 11.6803 9.03271 11.6803 11.0327ZM19.7496 16.3329C19.7496 19.1532 18.0709 21.0327 16 21.0327C13.9291 21.0327 12.2502 19.1532 12.2502 16.3329C12.2502 14.262 13.9967 13.5333 16 13.5333C18.0034 13.5333 19.7496 14.262 19.7496 16.3329Z" fill="currentColor"></path><path d="M22.1668 25.0509C22.3553 24.4995 22.678 24.0152 23.0006 23.5309C23.4138 22.9108 23.8269 22.2909 23.9576 21.5307C24.0044 21.2585 24.2404 21.0099 24.4829 21.142C24.6688 21.2433 24.7837 21.4011 24.8964 21.556C25.0726 21.798 25.2434 22.0327 25.6711 22.0327C26.6434 22.0327 27 22.0327 27 23.0332C27 23.9184 25.4367 25.585 22.997 25.9576C22.451 26.041 21.9881 25.5736 22.1668 25.0509Z" fill="currentColor"></path><path d="M8.99936 23.5309C9.322 24.0152 9.64473 24.4995 9.83321 25.0509C10.0119 25.5736 9.549 26.041 9.00297 25.9576C6.56334 25.585 5 23.9184 5 23.0332C5 22.0327 5.35661 22.0327 6.32887 22.0327C6.75662 22.0327 6.92743 21.798 7.10356 21.556C7.21629 21.4011 7.33121 21.2433 7.51707 21.142C7.75959 21.0099 7.99559 21.2585 8.0424 21.5307C8.17314 22.2909 8.58618 22.9108 8.99936 23.5309Z" fill="currentColor"></path>
  </svg>
);
const ElderDragonIcon = ({ className = "" }) => (
  <svg viewBox="0 0 32 32" className={`inline-block text-yellow-200 ${className}`} xmlns="http://www.w3.org/2000/svg">
    <path d="M18.25 9.375C17.75 7.625 16 5.125 16 5.125C16 5.125 14.25 7.625 13.75 9.375C14.25 11.125 16 13.625 16 13.625C16 13.625 17.75 11.125 18.25 9.375Z" fill="currentColor"></path><path d="M9.75004 10.125C8.25004 11.125 6.75004 13.875 8.75004 15.625C9.14284 13.4646 9.68995 12.7854 10.3913 11.9146C10.5828 11.677 10.7856 11.4251 11 11.125L13.25 12.625C13.25 12.625 13.5 10.625 12.75 9.125C11.25 8.125 9.75004 7.875 9.75004 7.875V10.125Z" fill="currentColor"></path><path d="M22.25 10.125C23.75 11.125 25.25 13.875 23.25 15.625C22.8572 13.4646 22.3101 12.7854 21.6087 11.9146C21.4172 11.677 21.2144 11.4251 21 11.125L18.75 12.625C18.75 12.625 18.5 10.625 19.25 9.125C20.75 8.125 22.25 7.875 22.25 7.875V10.125Z" fill="currentColor"></path><path fillRule="evenodd" clipRule="evenodd" d="M11 13.125C9 15.125 9.25 17.125 9.25 17.125C7.75 15.125 5.25 14.625 3.25 14.625C4.12371 16.3724 5.7608 18.2153 7.39008 20.0493C9.49035 22.4136 11.5776 24.7632 12 26.875V22.125C12 22.125 13.75 23.625 16 24.375C18.25 23.625 20 22.125 20 22.125V26.875C20.4224 24.7632 22.5096 22.4136 24.6099 20.0493C26.2392 18.2153 27.8763 16.3724 28.75 14.625C26.75 14.625 24.25 15.125 22.75 17.125C22.75 17.125 23 15.125 21 13.125C21 13.125 19.75 15.625 16 16.625C12.25 15.625 11 13.125 11 13.125ZM10.6135 16.9637C12.9319 17.7524 14.0552 18.8518 14.2942 20.5726C11.2589 20.2141 10.6135 18.5651 10.6135 16.9637ZM21.3865 16.9637C19.0681 17.7524 17.9448 18.8518 17.7058 20.5726C20.7411 20.2141 21.3865 18.5651 21.3865 16.9637Z" fill="currentColor"></path>
  </svg>
);
const TowerIcon = ({ className = "" }) => (
  <svg viewBox="0 0 32 32" className={`inline-block text-lime-400 ${className}`} xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" clipRule="evenodd" d="M22.5068 10.3065L16 3.79968L9.49317 10.3065L11.3867 12.2001H8L16 20.2001L24 12.2001H20.6133L22.5068 10.3065ZM19.8207 10.3064L16 6.48567L12.1793 10.3064L16 14.1271L19.8207 10.3064Z" fill="currentColor"></path><path d="M13.1429 28.2001L10.2857 15.6286L16 22.4858L21.7143 15.6286L18.8571 28.2001H13.1429Z" fill="currentColor"></path>
  </svg>
);
// --- END OBJECTIVE ICONS ---

// Mapowanie ról na ikony
const ROLE_ICON_MAP = {
    TOP: topIcon, JUNGLE: jungleIcon, MIDDLE: middleIcon,
    BOTTOM: bottomIcon, UTILITY: supportIcon // UTILITY is often used for Support in API
};
const ROLE_ORDER = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];


// Komponent dla rozszerzonych szczegółów meczu
const ExpandedMatchDetails = ({ match, ddragonVersion, championData, summonerSpellsMap, runesMap, getChampionImage, getSummonerSpellImage, getItemImage, getRuneImage, getChampionDisplayName, isTrackedPlayerWin }) => {
    const [activeTab, setActiveTab] = useState('General');

    const { allParticipants = [], teamObjectives = [], gameDuration, puuid: trackedPlayerPuuid, timelineData } = match;

    const blueTeam = allParticipants.filter(p => p.teamId === 100).sort((a, b) => ROLE_ORDER.indexOf(a.teamPosition?.toUpperCase()) - ROLE_ORDER.indexOf(b.teamPosition?.toUpperCase()));
    const redTeam = allParticipants.filter(p => p.teamId === 200).sort((a, b) => ROLE_ORDER.indexOf(a.teamPosition?.toUpperCase()) - ROLE_ORDER.indexOf(b.teamPosition?.toUpperCase()));

    const blueTeamData = teamObjectives.find(t => t.teamId === 100) || { objectives: {}, win: false };
    const redTeamData = teamObjectives.find(t => t.teamId === 200) || { objectives: {}, win: false };

    const maxDamageInGame = Math.max(...allParticipants.map(p => p.totalDamageDealtToChampions || 0), 0);
    const maxDamageBlueTeam = Math.max(0, ...blueTeam.map(p => p.totalDamageDealtToChampions || 0));
    const maxDamageRedTeam = Math.max(0, ...redTeam.map(p => p.totalDamageDealtToChampions || 0));

    const renderPlayerRow = (player, teamTotalKills, isTopDamageInTeam, isTrackedPlayer) => {
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

        const damageTextColorClass = isTopDamageInTeam ? 'text-white font-semibold' : 'text-gray-200';
        const damageBarColorClass = isTopDamageInTeam
            ? (player.teamId === 100 ? 'neon-bg-blue' : 'neon-bg-red')
            : (player.teamId === 100 ? 'bg-blue-500' : 'bg-red-500');

        const trackedPlayerClass = isTrackedPlayer ? 'tracked-player-highlight' : '';

        return (
            <div key={player.puuid || player.summonerName} className={`flex items-center gap-x-2 sm:gap-x-3 py-0.5 px-1 text-xs hover:bg-gray-700/10 transition-colors duration-150 ${trackedPlayerClass}`}>
                {/* Champion Info */}
                <div className="flex items-center space-x-1.5 w-[120px] sm:w-[140px] flex-shrink-0">
                    <div className="relative w-9 h-9">
                        <img src={getChampionImage(player.championName)} alt={getChampionDisplayName(player.championName)} className="w-full h-full rounded-md border border-gray-600" />
                        <span className="absolute -bottom-1 -right-1 bg-black bg-opacity-80 text-white text-[9px] px-1 rounded-sm leading-tight border border-gray-500/50">{player.champLevel}</span>
                        {roleIcon && (
                            <img src={roleIcon} alt={player.teamPosition || 'Role'} className="absolute -top-1 -left-1 w-4 h-4 p-0.5 bg-gray-800 rounded-full border border-gray-400/70 shadow-sm" />
                        )}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                        <span className="font-semibold text-gray-100 truncate" title={player.riotIdGameName || player.summonerName}>
                            {player.riotIdGameName || player.summonerName || 'Player'}
                        </span>
                        {/* Placeholder for rank - could be fetched or estimated */}
                        <span className="text-gray-400 text-[10px]">Unranked</span>
                    </div>
                </div>

                {/* Build Info */}
                <div className="flex items-center space-x-1 flex-shrink-0">
                    <div className="flex flex-col space-y-0.5">
                        <div className="w-5 h-5 bg-black/30 rounded border border-gray-600 flex items-center justify-center"><img src={getSummonerSpellImage(player.summoner1Id)} alt="S1" className="w-full h-full rounded-sm" onError={(e) => e.target.style.display = 'none'} /></div>
                        <div className="w-5 h-5 bg-black/30 rounded border border-gray-600 flex items-center justify-center"><img src={getSummonerSpellImage(player.summoner2Id)} alt="S2" className="w-full h-full rounded-sm" onError={(e) => e.target.style.display = 'none'} /></div>
                    </div>
                    <div className="flex flex-col space-y-0.5">
                        <div className="w-5 h-5 bg-black/30 rounded border border-gray-600 flex items-center justify-center p-px"><img src={getRuneImage(playerPrimaryPerk)} alt="R1" className="w-full h-full object-contain" onError={(e) => e.target.style.display = 'none'} /></div>
                        <div className="w-5 h-5 bg-black/30 rounded border border-gray-600 flex items-center justify-center p-px"><img src={getRuneImage(playerSubStyle)} alt="R2" className="w-full h-full object-contain" onError={(e) => e.target.style.display = 'none'} /></div>
                    </div>
                    <div className="flex flex-col space-y-0.5">
                        <div className="flex space-x-0.5">
                            {[items[0], items[1], items[2], trinket].map((item, idx) => (
                                <div key={`item-top-${idx}-${player.puuid}`} className="w-5 h-5 bg-black/30 rounded border border-gray-600 flex items-center justify-center">
                                    {item && item !== 0 ? <img src={getItemImage(item)} alt={`Item ${idx}`} className="w-full h-full rounded-sm" /> : <div className="w-4 h-4 bg-gray-700/50 rounded-sm"></div>}
                                </div>
                            ))}
                        </div>
                        <div className="flex space-x-0.5">
                            {[items[3], items[4], items[5]].map((item, idx) => (
                                <div key={`item-bot-${idx}-${player.puuid}`} className="w-5 h-5 bg-black/30 rounded border border-gray-600 flex items-center justify-center">
                                    {item && item !== 0 ? <img src={getItemImage(item)} alt={`Item ${idx + 3}`} className="w-full h-full rounded-sm" /> : <div className="w-4 h-4 bg-gray-700/50 rounded-sm"></div>}
                                </div>
                            ))}
                            <div className="w-5 h-5"></div> {/* Spacer for alignment */}
                        </div>
                    </div>
                </div>

                {/* Stats Block */}
                <div className="flex flex-1 justify-around items-start gap-x-1 sm:gap-x-2 text-center min-w-0">
                    <div className="flex flex-col items-center min-w-[55px] sm:min-w-[65px]">
                        <span className="text-gray-100">{getKDAStringSpans(player)}</span>
                        <div>
                            <span className={`text-xs ${kdaColor}`}>{kdaRatio}</span>
                            <span className="text-[10px] text-gray-300 ml-0.5 sm:ml-1">KDA</span>
                        </div>
                    </div>
                    <div className="flex flex-col items-center min-w-[30px] sm:min-w-[35px]">
                        <span className="text-gray-200">{kp}</span>
                        <span className="text-[10px] text-gray-300">KP</span>
                    </div>
                    <div className="flex flex-col items-center min-w-[55px] sm:min-w-[65px]">
                        <span className="text-gray-200">{cs}</span>
                        <span className="text-[10px] text-gray-300">{csPerMin} CS/m</span>
                    </div>
                    <div className="flex flex-col items-center flex-grow min-w-[70px] sm:min-w-[90px] max-w-[120px]">
                        <div className="flex justify-between w-full items-baseline">
                            <span className={`${damageTextColorClass} text-[10px]`}>{damageDealt.toLocaleString()}</span>
                            <span className="text-gray-300 text-[9px]">{damagePerMin} DPM</span>
                        </div>
                        <div className="h-1.5 bg-gray-500 rounded-full w-full overflow-hidden my-0.5">
                            <div className={`h-full ${damageBarColorClass}`} style={{ width: `${damagePercentage}%` }}></div>
                        </div>
                    </div>
                    <div className="flex flex-col items-center min-w-[50px] sm:min-w-[60px]">
                        <span className="text-gray-200">{player.visionWardsBoughtInGame || 0}</span>
                        <span className="text-[10px] text-gray-300">{player.wardsPlaced || 0}/{player.wardsKilled || 0}</span>
                    </div>
                </div>
            </div>
        );
    };

    const renderTeamSection = (team, teamData, teamName, teamMaxDamage) => {
        const totalKills = teamData?.objectives?.champion?.kills || 0;
        const teamSide = teamName === 'Blue Team' ? 'Blue Side' : 'Red Side';
        const teamColorForText = teamName === 'Blue Team' ? 'text-blue-400' : 'text-red-400';
        const objectiveIconSize = "w-5 h-5";

        return (
            <div className="p-2 sm:p-3 rounded-md">
                <div className="flex items-center mb-1.5 pb-1">
                    <h3 className={`text-md sm:text-lg font-semibold ${teamColorForText}`}>
                        {teamData.win ? 'Victory' : 'Defeat'}
                        <span className="text-xs sm:text-sm text-gray-400 font-normal ml-1.5 mr-2 sm:mr-3">
                            ({teamSide})
                        </span>
                    </h3>
                    <div className="flex space-x-1.5 sm:space-x-2 items-center text-xs">
                        <span title="Grubs" className="flex items-center"><GrubIcon className={`${objectiveIconSize} mr-0.5`} /> {teamData.objectives?.horde?.kills || 0}</span>
                        <span title="Dragons" className="flex items-center"><DragonIcon className={`${objectiveIconSize} mr-0.5`} /> {teamData.objectives?.dragon?.kills || 0}</span>
                        <span title="Barons" className="flex items-center"><BaronIcon className={`${objectiveIconSize} mr-0.5`} /> {teamData.objectives?.baron?.kills || 0}</span>
                        <span title="Heralds" className="flex items-center"><HeraldIcon className={`${objectiveIconSize} mr-0.5`} /> {teamData.objectives?.riftHerald?.kills || 0}</span>
                        {teamData.objectives?.elderDragon?.kills > 0 && <span title="Elder Dragons" className="flex items-center"><ElderDragonIcon className={`${objectiveIconSize} mr-0.5`} /> {teamData.objectives.elderDragon.kills || 0}</span>}
                        <span title="Towers" className="flex items-center"><TowerIcon className={`${objectiveIconSize} mr-0.5`} /> {teamData.objectives?.tower?.kills || 0}</span>
                    </div>
                </div>
                {team.map(player => renderPlayerRow(
                    player,
                    totalKills,
                    player.totalDamageDealtToChampions === teamMaxDamage && teamMaxDamage > 0,
                    player.puuid === trackedPlayerPuuid
                ))}
            </div>
        );
    };

    const GeneralTabContent = () => (
        <div className="space-y-3">
            {renderTeamSection(blueTeam, blueTeamData, "Blue Team", maxDamageBlueTeam)}
            {renderTeamSection(redTeam, redTeamData, "Red Team", maxDamageRedTeam)}
        </div>
    );

    const DetailsTabContent = () => {
        const trackedPlayer = allParticipants.find(p => p.puuid === trackedPlayerPuuid);
        const playerTimeline = timelineData || {};
        const snapshot15min = playerTimeline.snapshots?.find(s => s.minute === 15);

        if (!trackedPlayer) return <p className="text-gray-400 p-4">Tracked player data not found for this match.</p>;

        const StatItem = ({ value, label }) => (
            <div className="flex flex-col items-center text-center">
                <span className="text-gray-100 font-medium text-sm sm:text-base">{value}</span>
                <span className="text-gray-400 text-[10px] sm:text-xs leading-tight mt-0.5">{label}</span>
            </div>
        );
        
        const renderChampionIconWithRole = (player) => {
            const roleIconSrc = ROLE_ICON_MAP[player.teamPosition?.toUpperCase()];
            return (
                <div key={player.puuid} className="relative w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0" title={getChampionDisplayName(player.championName)}>
                    <img
                        src={getChampionImage(player.championName)}
                        alt={getChampionDisplayName(player.championName)}
                        className="w-full h-full rounded-md border-2 border-gray-600"
                    />
                    {roleIconSrc && (
                        <img
                            src={roleIconSrc}
                            alt={player.teamPosition || 'Role'}
                            className="absolute -bottom-1 -left-1 w-4 h-4 p-0.5 bg-gray-900 rounded-full border border-gray-500"
                        />
                    )}
                </div>
            );
        };


        return (
            <div className="p-3 sm:p-4 text-gray-200 space-y-4">
                {/* Champion Icons Header */}
                <div className="flex items-center justify-center space-x-2 sm:space-x-3 mb-4 p-2 bg-gray-800/50 rounded-lg">
                    <div className="flex space-x-1 sm:space-x-1.5">
                        {blueTeam.slice(0, 5).map(player => renderChampionIconWithRole(player))}
                    </div>
                    <span className="text-orange-500 font-bold text-sm sm:text-md">VS</span>
                    <div className="flex space-x-1 sm:space-x-1.5">
                        {redTeam.slice(0, 5).map(player => renderChampionIconWithRole(player))}
                    </div>
                </div>
                
                {/* Row 1: Laning, Wards, Global Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                    {/* Laning Phase (at 15 min) */}
                    <div className="bg-gray-700/40 p-3 rounded-lg border border-gray-600/50">
                        <h4 className="font-semibold text-gray-300 mb-3 text-sm sm:text-base text-center">Laning Phase (at 15 min)</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-2 gap-y-3">
                            <StatItem value={snapshot15min?.diff?.cs !== undefined ? (snapshot15min.diff.cs > 0 ? `+${snapshot15min.diff.cs}` : snapshot15min.diff.cs) : 'N/A'} label="CS Diff @15" />
                            <StatItem value={snapshot15min?.diff?.gold !== undefined ? (snapshot15min.diff.gold > 0 ? `+${snapshot15min.diff.gold.toLocaleString()}` : snapshot15min.diff.gold.toLocaleString()) : 'N/A'} label="Gold Diff @15" />
                            <StatItem value={snapshot15min?.diff?.xp !== undefined ? (snapshot15min.diff.xp > 0 ? `+${snapshot15min.diff.xp.toLocaleString()}` : snapshot15min.diff.xp.toLocaleString()) : 'N/A'} label="XP Diff @15" />
                            <StatItem value={playerTimeline.firstLevel2Time ? formatGameDurationMMSS(Math.floor(playerTimeline.firstLevel2Time / 1000)) : 'N/A'} label="First Lvl 2" />
                        </div>
                    </div>

                    {/* Wards */}
                    <div className="bg-gray-700/40 p-3 rounded-lg border border-gray-600/50">
                        <h4 className="font-semibold text-gray-300 mb-3 text-sm sm:text-base text-center">Wards</h4>
                        <div className="grid grid-cols-3 gap-x-2 gap-y-3">
                            <StatItem value={trackedPlayer.wardsPlaced || 0} label="Placed" />
                            <StatItem value={trackedPlayer.wardsKilled || 0} label="Killed" />
                            <StatItem value={trackedPlayer.visionWardsBoughtInGame || 0} label="Control" />
                        </div>
                    </div>

                    {/* Global Stats */}
                    <div className="bg-gray-700/40 p-3 rounded-lg border border-gray-600/50">
                        <h4 className="font-semibold text-gray-300 mb-3 text-sm sm:text-base text-center">Global Stats</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-2 gap-y-3">
                            <StatItem value={gameDuration > 0 ? (((trackedPlayer.totalMinionsKilled || 0) + (trackedPlayer.neutralMinionsKilled || 0)) / (gameDuration / 60)).toFixed(1) : '0.0'} label="CS/min" />
                            <StatItem value={gameDuration > 0 ? ((trackedPlayer.visionScore || 0) / (gameDuration / 60)).toFixed(2) : '0.00'} label="VS/min" />
                            <StatItem value={gameDuration > 0 ? ((trackedPlayer.totalDamageDealtToChampions || 0) / (gameDuration / 60)).toFixed(0) : '0'} label="DMG/min" />
                            <StatItem value={gameDuration > 0 ? ((trackedPlayer.goldEarned || 0) / (gameDuration / 60)).toFixed(0) : '0'} label="Gold/min" />
                        </div>
                    </div>
                </div>

                {/* Build Order */}
                <div className="bg-gray-700/40 p-3 rounded-lg border border-gray-600/50">
                    <h4 className="font-semibold text-gray-300 mb-2 text-sm sm:text-base">Build Order</h4>
                    {playerTimeline.buildOrder && playerTimeline.buildOrder.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                            {playerTimeline.buildOrder.map((itemEvent, index) => (
                                getItemImage(itemEvent.itemId) ?
                                <img
                                    key={`build-${index}-${itemEvent.itemId}`}
                                    src={getItemImage(itemEvent.itemId)}
                                    alt={`Item ${itemEvent.itemId}`}
                                    className="w-8 h-8 sm:w-9 sm:h-9 rounded border border-gray-500"
                                    title={`@ ${formatGameDurationMMSS(Math.floor(itemEvent.timestamp / 1000))}`}
                                />
                                : null
                            ))}
                        </div>
                    ) : <p className="text-gray-400 text-xs sm:text-sm">No build order data available.</p>}
                </div>

                {/* Skill Order */}
                <div className="bg-gray-700/40 p-3 rounded-lg border border-gray-600/50">
                    <h4 className="font-semibold text-gray-300 mb-2 text-sm sm:text-base">Skill Order (QWER)</h4>
                    {playerTimeline.skillOrder && playerTimeline.skillOrder.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                            {playerTimeline.skillOrder.map((skill, index) => (
                                <span key={`skill-${index}`} className="bg-gray-800 px-2 py-1 rounded text-orange-300 text-xs sm:text-sm border border-gray-600" title={`Level ${skill.level} @ ${formatGameDurationMMSS(Math.floor(skill.timestamp / 1000))}`}>
                                    {['Q', 'W', 'E', 'R'][skill.skillSlot - 1] || '?'}
                                </span>
                            ))}
                        </div>
                    ) : <p className="text-gray-400 text-xs sm:text-sm">No skill order data available.</p>}
                </div>
                
                {/* Runes (Placeholder) */}
                <div className="bg-gray-700/40 p-3 rounded-lg border border-gray-600/50">
                    <h4 className="font-semibold text-gray-300 mb-2 text-sm sm:text-base">Runes</h4>
                    <p className="text-gray-400 text-xs sm:text-sm">Detailed rune display not yet implemented.</p>
                </div>
            </div>
        );
    };
    
    const expandedBgClass = isTrackedPlayerWin === null
    ? 'bg-gray-950/40' 
    : isTrackedPlayerWin
        ? 'bg-blue-950/30' 
        : 'bg-red-950/30';

    return (
        <div className={`mt-0.5 p-2 sm:p-3 ${expandedBgClass} backdrop-blur-sm rounded-b-lg border-t border-gray-700/50 shadow-inner`}>
            <div className="flex border-b border-gray-600/80 mb-2 sm:mb-3">
                <button
                    onClick={() => setActiveTab('General')}
                    className={`py-1.5 sm:py-2 px-3 sm:px-4 text-xs sm:text-sm font-medium transition-colors focus:outline-none
                        ${activeTab === 'General' ? 'text-orange-400 border-b-2 border-orange-500' : 'text-gray-400 hover:text-gray-200 hover:border-b-2 hover:border-gray-500'}`}
                >
                    Scoreboard
                </button>
                <button
                    onClick={() => setActiveTab('Details')}
                    className={`py-1.5 sm:py-2 px-3 sm:px-4 text-xs sm:text-sm font-medium transition-colors focus:outline-none
                        ${activeTab === 'Details' ? 'text-orange-400 border-b-2 border-orange-500' : 'text-gray-400 hover:text-gray-200 hover:border-b-2 hover:border-gray-500'}`}
                >
                    Details {/* Changed from Performance */}
                </button>
            </div>
            {activeTab === 'General' && <GeneralTabContent />}
            {activeTab === 'Details' && <DetailsTabContent />}
        </div>
    );
};


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

  // Fetch DDragon static data (versions, champions, spells, runes)
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
                runes[style.id] = { icon: style.icon, name: style.name }; // Store style itself
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
        // Fetch more matches initially to ensure we have enough for pagination, can be adjusted
        const q = query(matchesSubCollectionRef, orderBy("gameCreation", "desc"), limit(200)); 
        const querySnapshot = await getDocs(q);
        const accountMatches = querySnapshot.docs.map(docData => ({
            id: docData.id, ...docData.data(),
            trackedAccountDocId: account.id, // Store parent doc ID for updates
            trackedAccountName: `${account.name}#${account.tag}`,
            trackedAccountPlatform: account.platformId
        }));
        combinedMatches = [...combinedMatches, ...accountMatches];
      }
      // Sort all combined matches by game creation date, descending
      combinedMatches.sort((a, b) => (b.gameCreation?.seconds || 0) - (a.gameCreation?.seconds || 0));
      setAllMatchesFromDb(combinedMatches);
      setTotalPages(Math.ceil(combinedMatches.length / MATCHES_PER_PAGE));
      setCurrentPage(1); // Reset to first page after fetching all
      prevPageRef.current = 1;
    } catch (err) { console.error(`Error fetching stored matches:`, err); setError(`Failed to load stored matches.`);
    } finally { setIsLoadingMatches(false); }
  }, [trackedAccounts]); // Depends on trackedAccounts

  // Effect to fetch matches when tracked accounts are loaded/changed
  useEffect(() => {
    if (trackedAccounts.length > 0) {
        fetchAllMatchesFromDb();
    } else {
        // Clear matches if no accounts are tracked
        setAllMatchesFromDb([]);
        setGroupedMatches({});
        setTotalPages(0);
    }
  }, [trackedAccounts, fetchAllMatchesFromDb]);

  // Effect for pagination and grouping matches by date
  useEffect(() => {
    if (allMatchesFromDb.length === 0) {
      setGroupedMatches({});
      return;
    }
    const startIndex = (currentPage - 1) * MATCHES_PER_PAGE;
    const endIndex = startIndex + MATCHES_PER_PAGE;
    const matchesForCurrentPage = allMatchesFromDb.slice(startIndex, endIndex);

    const groups = matchesForCurrentPage.reduce((acc, match) => {
      if (!match.gameCreation || !match.gameCreation.seconds) return acc; // Skip if no timestamp
      const dateObj = new Date(match.gameCreation.seconds * 1000);
      const today = new Date(); const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
      let dateKey = dateObj.toDateString() === today.toDateString() ? "Today" : dateObj.toDateString() === yesterday.toDateString() ? "Yesterday" : dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(match);
      return acc;
    }, {});
    setGroupedMatches(groups);
  }, [currentPage, allMatchesFromDb]);

  // Scroll to top when page changes
  useEffect(() => {
    const pageActuallyChanged = prevPageRef.current !== currentPage;
    prevPageRef.current = currentPage;

    if (pageActuallyChanged) {
      if (matchListContainerRef.current) {
        // Use a small timeout to ensure the DOM has updated if elements are changing height
        setTimeout(() => {
          if (matchListContainerRef.current) {
            // Check if scrolling is actually needed
            if (matchListContainerRef.current.scrollHeight > matchListContainerRef.current.clientHeight) {
              matchListContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }
        }, 0);
      }
    }
  }, [currentPage, groupedMatches, selectedMatchForNotes]); // Also re-run if notes panel opens/closes, as it affects layout

  // Function to update all matches for all tracked accounts
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
        const matchlistUrl = `https://${continentalRoute}.api.riotgames.com/lol/match/v5/matches/by-puuid/${account.puuid}/ids?startTime=${twoWeeksAgoEpochSeconds}&queue=${QUEUE_IDS.RANKED_SOLO}&count=${MATCH_COUNT_PER_FETCH}&api_key=${RIOT_API_KEY}`;
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

          // Only fetch full details if not exists or if timelineData is missing (new criteria)
          if (docSnap.exists() && docSnap.data().allParticipants && docSnap.data().teamObjectives && docSnap.data().timelineData) {
              console.log(`Match ${matchId} for ${account.name} already has full details including timeline. Skipping.`);
              continue;
          }

          setUpdateProgress(`Fetching details for match ${matchId} for ${account.name}...`);
          await delay(API_CALL_DELAY_MS);
          const matchDetailUrl = `https://${continentalRoute}.api.riotgames.com/lol/match/v5/matches/${matchId}?api_key=${RIOT_API_KEY}`;
          const detailResponse = await fetch(matchDetailUrl);

          if (!detailResponse.ok) {
            console.warn(`Failed to fetch details for match ${matchId} (Account: ${account.name}). Status: ${detailResponse.status}`);
            continue;
          }
          const matchDetail = await detailResponse.json();
          
          // Fetch timeline data
          await delay(API_CALL_DELAY_MS);
          const timelineUrl = `https://${continentalRoute}.api.riotgames.com/lol/match/v5/matches/${matchId}/timeline?api_key=${RIOT_API_KEY}`;
          const timelineResponse = await fetch(timelineUrl);
          let timelineFrames = [];
          if (timelineResponse.ok) {
            const timelineJson = await timelineResponse.json();
            timelineFrames = timelineJson.info?.frames || [];
          } else {
            console.warn(`Failed to fetch timeline for match ${matchId}. Status: ${timelineResponse.status}`);
          }

          const playerParticipant = matchDetail.info.participants.find(p => p.puuid === account.puuid);

          if (playerParticipant) {
            const perks = playerParticipant.perks || {};
            const primaryStyle = perks.styles?.find(s => s.description === 'primaryStyle');
            const subStyle = perks.styles?.find(s => s.description === 'subStyle');
            
            let opponentParticipant = null;
            let opponentParticipantIdForTimeline = null;
            // Ensure teamPosition exists and is not an empty string before trying to find an opponent.
            if (playerParticipant.teamPosition && playerParticipant.teamPosition !== '') {
                opponentParticipant = matchDetail.info.participants.find(p =>
                    p.teamId !== playerParticipant.teamId &&
                    p.teamPosition === playerParticipant.teamPosition
                );
            }
            if (opponentParticipant) {
                // Participant IDs for timeline are 1-based index in participants array
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
                perks: p.perks, // Storing the whole perks object for flexibility
              })),
              teamObjectives: matchDetail.info.teams.map(t => ({
                teamId: t.teamId, win: t.win, objectives: t.objectives
              })),
              timelineData: processedTimeline, // Store processed timeline data
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
    fetchAllMatchesFromDb(); // Refresh the match list from DB
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
      // Update local state to reflect changes immediately
      setAllMatchesFromDb(prevMatches => prevMatches.map(m =>
        m.id === matchDocumentId ? { ...m, notes: newNotes, goals: newGoals } : m
      ));
      setSelectedMatchForNotes(prev => prev && prev.id === matchDocumentId ? {...prev, notes: newNotes, goals: newGoals} : prev); // Update selected match too
    } catch (err) {
      console.error("Error saving notes:", err);
      setError("Failed to save notes. Please try again.");
    }
    finally { setIsSavingNotes(false); }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    setExpandedMatchId(null); // Collapse any expanded match when changing page
  };

  // Helper functions to get DDragon image URLs
  const getChampionInfo = (championKeyApi) => {
    if (!championData || !championKeyApi) return { displayName: championKeyApi, imageName: championKeyApi + ".png" };
    // Special case for Fiddlesticks (API returns "Fiddlesticks", DDragon uses "FiddleSticks")
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

  // Render fallback if API key is missing
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
    <div className="flex flex-1 overflow-hidden h-[calc(100vh-4rem)]"> {/* Main container for page content */}
        {/* Match List Section */}
        <div
            ref={matchListContainerRef} // Ref for scrolling
            className={`text-gray-100 transition-all duration-300 ease-in-out overflow-y-auto h-full
                        ${selectedMatchForNotes ? 'w-full md:w-3/5 lg:w-2/3 xl:w-3/4' : 'w-full'}`} // Adjust width when notes panel is open
        >
            {/* Header with Update Button */}
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

            {/* Progress and Error Messages */}
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

            {/* Loading State for Matches */}
            {isLoadingMatches && !isUpdatingAllMatches && ( // Show only if not already updating all
                <div className="flex flex-col items-center justify-center p-10 bg-gray-800/80 backdrop-blur-md rounded-xl shadow-xl border border-gray-700/50 max-w-4xl mx-auto mt-8">
                <Loader2 size={40} className="text-orange-500 animate-spin" />
                <p className="text-gray-300 mt-4 text-lg">Loading matches...</p>
                </div>
            )}

            {/* No Matches State */}
            {!isLoadingMatches && Object.keys(groupedMatches).length === 0 && !error && !isUpdatingAllMatches && (
                <div className="text-center py-10 px-6 bg-gray-800/80 backdrop-blur-md rounded-xl shadow-xl border border-dashed border-gray-700/50 max-w-4xl mx-auto mt-8">
                    <ListChecks size={48} className="text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 text-lg">No matches found for this page.</p>
                    {allMatchesFromDb.length > 0 && <p className="text-gray-500 text-sm">Try a different page or update matches.</p>}
                    {allMatchesFromDb.length === 0 && <p className="text-gray-500 text-sm">Click "Update All" to fetch recent games, or add accounts in the 'Accounts' page.</p>}
                </div>
            )}

            {/* Display Grouped Matches */}
            {!isLoadingMatches && Object.keys(groupedMatches).length > 0 && (
              <div className="space-y-3 max-w-4xl mx-auto px-4 sm:px-6 md:px-8 pb-8"> {/* Container for all date groups */}
                {Object.entries(groupedMatches).map(([dateKey, matchesOnDate]) => (
                  <div key={dateKey}>
                    <h2 className="text-lg font-semibold text-orange-400 mb-3 pb-1.5 border-b border-gray-700/80">
                        {dateKey}
                    </h2>
                    <div className="space-y-1"> {/* Container for matches within a date group */}
                        {matchesOnDate.map(match => {
                        const participantData = match; // Assuming 'match' itself contains the direct player stats we need for the summary row
                        const isWin = typeof match.win === 'boolean' ? match.win : null; // Handle cases where win status might be missing
                        const kdaStringSpans = getKDAStringSpans(participantData);
                        const kdaRatio = getKDARatio(participantData);
                        const kdaColorClass = getKDAColorClass(participantData.kills, participantData.deaths, participantData.assists);
                        const csString = getCSString(participantData);
                        const gameModeDisplay = formatGameMode(match.gameMode, match.queueId);
                        const gameDurationFormatted = formatGameDurationMMSS(match.gameDuration);

                        // Item images
                        const itemsRow1 = [match.item0, match.item1, match.item2].map(id => getItemImage(id));
                        const itemsRow2 = [match.item3, match.item4, match.item5].map(id => getItemImage(id));
                        const trinketImg = getItemImage(match.item6);

                        // Spell and Rune images
                        const summoner1Img = getSummonerSpellImage(match.summoner1Id);
                        const summoner2Img = getSummonerSpellImage(match.summoner2Id);
                        const primaryRuneImg = getRuneImage(match.primaryPerkId);
                        const subStyleImg = getRuneImage(match.subStyleId);

                        const playerRoleIcon = match.teamPosition ? ROLE_ICON_MAP[match.teamPosition.toUpperCase()] : null;
                        const hasNotesOrGoals = (match.notes && match.notes.trim() !== '') || (match.goals && match.goals.trim() !== '');

                        const resultBgOverlayClass = isWin === null
                        ? 'bg-gray-800/25' // Neutral if win status unknown
                        : (isWin ? 'bg-blue-900/20' : 'bg-red-900/20'); // Subtle win/loss background

                        const expandButtonBgClass = isWin === null ? 'bg-gray-700/60 hover:bg-gray-600/80' : (isWin ? 'bg-[#263964] hover:bg-[#304A80]' : 'bg-[#42212C] hover:bg-[#582C3A]');
                        const isExpanded = expandedMatchId === match.id;

                        return (
                              <div key={match.id} className={`rounded-lg shadow-lg overflow-hidden group ${resultBgOverlayClass}`}>
                                <div className={`flex items-stretch ${isExpanded ? 'rounded-t-lg' : 'rounded-lg'} ${resultBgOverlayClass}`}> {/* Main row for a match summary */}
                                    {/* Left side: Game Info, Champion vs Opponent, Build Summary */}
                                    <div className="flex flex-1 items-stretch p-3 ml-1"> {/* Increased padding slightly */}
                                        {/* Game Info Block */}
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

                                        {/* Champion vs Opponent Block */}
                                        <div className="flex items-center justify-center space-x-1.5 flex-shrink-0 mx-1">
                                            <div className="relative"> {/* Player Champion */}
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
                                            <div className="relative"> {/* Opponent Champion */}
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
                                        
                                        <div className="w-px bg-gray-700/60 self-stretch mx-3"></div> {/* Vertical Divider */}

                                        {/* Build Summary Block */}
                                        <div className="flex items-center space-x-2 bg-gray-900/70 p-2 rounded-lg shadow-inner border border-gray-700/50 flex-shrink-0">
                                            {/* Spells & Runes */}
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
                                            {/* Items */}
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
                                                    <div className="w-6 h-6"></div> {/* Spacer for alignment */}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="w-px bg-gray-700/60 self-stretch mx-3"></div> {/* Vertical Divider */}
                                        
                                        {/* KDA & CS Block */}
                                        <div className="flex flex-col justify-center flex-grow min-w-[100px] space-y-0.5">
                                            <p className="text-sm">{kdaStringSpans}</p>
                                            <p>
                                                <span className={`text-xs ${kdaColorClass}`}>{kdaRatio}</span>
                                                <span className="text-[10px] text-gray-400 ml-1">KDA</span>
                                            </p>
                                            <p className="text-gray-300 text-xs mt-0.5">{csString}</p>
                                        </div>

                                        {/* Notes Button */}
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

                                    {/* Expand Button (Right side) */}
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
                                        isTrackedPlayerWin={isWin} // Pass win status for background
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

            {/* Pagination Controls */}
            {!isLoadingMatches && totalPages > 1 && (
                <PaginationControls
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                />
            )}
        </div>

        {/* Notes Panel (conditionally rendered) */}
        {selectedMatchForNotes && (
            <MatchNotesPanel
                match={selectedMatchForNotes}
                championData={championData} // Pass championData for display names
                ddragonVersion={ddragonVersion} // Pass ddragonVersion for image URLs
                onSave={handleSaveNotes}
                onClose={handleCloseNotes}
                isLoading={isSavingNotes}
            />
        )}
    </div>
  );
}

export default MatchHistoryPage;
