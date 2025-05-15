// src/components/ExpandedMatchDetails.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { ImageOff } from 'lucide-react';
import {
    formatGameDurationMMSS,
    getKDAColorClass,
    getKDAStringSpans,
} from '../utils/matchCalculations';


// --- OBJECTIVE ICONS ---
// (Objective Icons remain the same as previously defined)
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


// Component for expanded match details
const ExpandedMatchDetails = ({ 
    match, 
    ddragonVersion, 
    championData, 
    summonerSpellsMap, 
    runesMap, 
    getChampionImage, 
    getSummonerSpellImage, 
    getItemImage, 
    getRuneImage, 
    getChampionDisplayName, 
    isTrackedPlayerWin, 
    roleIconMap, 
    roleOrder,
    processTimelineDataForPlayer // New prop to process timeline for any player
}) => {
    const [activeTab, setActiveTab] = useState('General');
    // PUUID of the player whose details are currently being viewed in the "Details" tab
    const [selectedPlayerForDetailsPuuid, setSelectedPlayerForDetailsPuuid] = useState(match.puuid); 
    // State to hold the processed timeline data for the currently selected player in the "Details" tab
    const [currentSelectedPlayerTimeline, setCurrentSelectedPlayerTimeline] = useState(null);


    // Destructure necessary fields from the match object
    const { 
        allParticipants = [], 
        teamObjectives = [], 
        gameDuration, 
        puuid: trackedPlayerPuuid, // PUUID of the player this match was originally tracked for
        processedTimelineForTrackedPlayer, // Pre-processed timeline for the tracked player
        rawTimelineFrames // Raw timeline frames for on-demand processing
    } = match;

    // Effect to reset selected player and timeline when the match prop changes
    useEffect(() => {
        setSelectedPlayerForDetailsPuuid(match.puuid); // Default to the tracked player
        // Initially, set the timeline to the pre-processed one for the tracked player
        setCurrentSelectedPlayerTimeline(processedTimelineForTrackedPlayer || null); 
        setActiveTab('General'); 
    }, [match.id, match.puuid, processedTimelineForTrackedPlayer]);


    // Effect to re-process timeline data when selectedPlayerForDetailsPuuid changes
    useEffect(() => {
        if (activeTab !== 'Details') return; // Only process if details tab is active

        if (selectedPlayerForDetailsPuuid === trackedPlayerPuuid) {
            // If it's the tracked player, use the pre-processed data
            setCurrentSelectedPlayerTimeline(processedTimelineForTrackedPlayer || null);
        } else if (rawTimelineFrames && processTimelineDataForPlayer && selectedPlayerForDetailsPuuid) {
            // If it's a different player, process their timeline data on the fly
            const selectedParticipant = allParticipants.find(p => p.puuid === selectedPlayerForDetailsPuuid);
            if (selectedParticipant) {
                // Find the Riot's participantId (1-10) for the selected player
                const targetParticipantId = allParticipants.findIndex(p => p.puuid === selectedPlayerForDetailsPuuid) + 1;
                
                // Determine opponent for laning phase comparison (if applicable for this selected player)
                let opponentForSelected = null;
                let opponentIdForSelectedTimeline = null;
                if (selectedParticipant.teamPosition && selectedParticipant.teamPosition !== '') {
                    opponentForSelected = allParticipants.find(p => 
                        p.teamId !== selectedParticipant.teamId && 
                        p.teamPosition === selectedParticipant.teamPosition
                    );
                }
                if (opponentForSelected) {
                    opponentIdForSelectedTimeline = allParticipants.findIndex(p => p.puuid === opponentForSelected.puuid) + 1;
                }

                if (targetParticipantId > 0) {
                    const timeline = processTimelineDataForPlayer(
                        rawTimelineFrames,
                        targetParticipantId,
                        opponentIdForSelectedTimeline, // Pass opponent for laning comparison
                        gameDuration
                    );
                    setCurrentSelectedPlayerTimeline(timeline);
                } else {
                    setCurrentSelectedPlayerTimeline(null); // Should not happen if selectedPlayerForDetailsPuuid is valid
                }
            } else {
                setCurrentSelectedPlayerTimeline(null); // Player not found in allParticipants
            }
        } else {
            setCurrentSelectedPlayerTimeline(null); // Missing necessary data/functions
        }
    }, [selectedPlayerForDetailsPuuid, activeTab, rawTimelineFrames, processTimelineDataForPlayer, allParticipants, trackedPlayerPuuid, processedTimelineForTrackedPlayer, gameDuration]);


    const blueTeam = allParticipants.filter(p => p.teamId === 100).sort((a, b) => roleOrder.indexOf(a.teamPosition?.toUpperCase()) - roleOrder.indexOf(b.teamPosition?.toUpperCase()));
    const redTeam = allParticipants.filter(p => p.teamId === 200).sort((a, b) => roleOrder.indexOf(a.teamPosition?.toUpperCase()) - roleOrder.indexOf(b.teamPosition?.toUpperCase()));

    const blueTeamData = teamObjectives.find(t => t.teamId === 100) || { objectives: {}, win: false };
    const redTeamData = teamObjectives.find(t => t.teamId === 200) || { objectives: {}, win: false };

    const maxDamageInGame = Math.max(...allParticipants.map(p => p.totalDamageDealtToChampions || 0), 0);
    // Calculate max damage separately for each team to highlight top damage dealer within that team
    const maxDamageBlueTeam = Math.max(0, ...blueTeam.map(p => p.totalDamageDealtToChampions || 0));
    const maxDamageRedTeam = Math.max(0, ...redTeam.map(p => p.totalDamageDealtToChampions || 0));

    // Function to render a player row in the scoreboard
    const renderPlayerRow = (player, teamTotalKills, isTopDamageInTeam, isTrackedPlayerRow) => {
        const items = [player.item0, player.item1, player.item2, player.item3, player.item4, player.item5];
        const trinket = player.item6;
        const kdaColor = getKDAColorClass(player.kills, player.deaths, player.assists);
        // Calculate KDA ratio, ensuring gameDuration is positive to avoid division by zero
        const kdaRatio = gameDuration > 0 ? (player.deaths === 0 ? (player.kills > 0 || player.assists > 0 ? 'Perfect' : '0.00') : ((player.kills + player.assists) / player.deaths).toFixed(2)) : '0.00';
        const kp = teamTotalKills > 0 ? (((player.kills + player.assists) / teamTotalKills) * 100).toFixed(0) + '%' : '0%';
        const cs = (player.totalMinionsKilled || 0) + (player.neutralMinionsKilled || 0);
        const csPerMin = gameDuration > 0 ? (cs / (gameDuration / 60)).toFixed(1) : '0.0';
        const damageDealt = player.totalDamageDealtToChampions || 0;
        const damagePerMin = gameDuration > 0 ? (damageDealt / (gameDuration / 60)).toFixed(0) : '0';
        // Calculate damage percentage relative to the absolute max damage in the game
        const damagePercentage = maxDamageInGame > 0 ? (damageDealt / maxDamageInGame) * 100 : 0;

        const playerPrimaryPerk = player.perks?.styles?.find(s => s.description === 'primaryStyle')?.selections?.[0]?.perk;
        const playerSubStyle = player.perks?.styles?.find(s => s.description === 'subStyle')?.style;
        const roleIcon = roleIconMap[player.teamPosition?.toUpperCase()];

        // Determine text and bar color for damage, highlighting top damage dealer in their team
        const damageTextColorClass = isTopDamageInTeam ? 'text-white font-semibold' : 'text-gray-200';
        const damageBarColorClass = isTopDamageInTeam
            ? (player.teamId === 100 ? 'neon-bg-blue' : 'neon-bg-red') // Neon for top damage in team
            : (player.teamId === 100 ? 'bg-blue-500' : 'bg-red-500'); // Standard team color otherwise

        const trackedPlayerClass = isTrackedPlayerRow ? 'tracked-player-highlight' : ''; // Apply highlight class

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
                        <span className="text-gray-400 text-[10px]">Unranked</span> {/* Placeholder for rank */}
                    </div>
                </div>

                {/* Build Info */}
                <div className="flex items-center space-x-1 flex-shrink-0">
                    {/* Spells */}
                    <div className="flex flex-col space-y-0.5">
                        <div className="w-5 h-5 bg-black/30 rounded border border-gray-600 flex items-center justify-center"><img src={getSummonerSpellImage(player.summoner1Id)} alt="S1" className="w-full h-full rounded-sm" onError={(e) => e.target.style.display = 'none'} /></div>
                        <div className="w-5 h-5 bg-black/30 rounded border border-gray-600 flex items-center justify-center"><img src={getSummonerSpellImage(player.summoner2Id)} alt="S2" className="w-full h-full rounded-sm" onError={(e) => e.target.style.display = 'none'} /></div>
                    </div>
                    {/* Runes */}
                    <div className="flex flex-col space-y-0.5">
                        <div className="w-5 h-5 bg-black/30 rounded border border-gray-600 flex items-center justify-center p-px"><img src={getRuneImage(playerPrimaryPerk)} alt="R1" className="w-full h-full object-contain" onError={(e) => e.target.style.display = 'none'} /></div>
                        <div className="w-5 h-5 bg-black/30 rounded border border-gray-600 flex items-center justify-center p-px"><img src={getRuneImage(playerSubStyle)} alt="R2" className="w-full h-full object-contain" onError={(e) => e.target.style.display = 'none'} /></div>
                    </div>
                    {/* Items */}
                    <div className="flex flex-col space-y-0.5">
                        <div className="flex space-x-0.5">
                            {[items[0], items[1], items[2], trinket].map((item, idx) => ( // Trinket in first row
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
                            <div className="w-5 h-5"></div> {/* Spacer for alignment with trinket row */}
                        </div>
                    </div>
                </div>

                {/* Stats Block */}
                <div className="flex flex-1 justify-around items-start gap-x-1 sm:gap-x-2 text-center min-w-0">
                    {/* KDA */}
                    <div className="flex flex-col items-center min-w-[55px] sm:min-w-[65px]">
                        <span className="text-gray-100">{getKDAStringSpans(player)}</span>
                        <div>
                            <span className={`text-xs ${kdaColor}`}>{kdaRatio}</span>
                            <span className="text-[10px] text-gray-300 ml-0.5 sm:ml-1">KDA</span>
                        </div>
                    </div>
                    {/* KP */}
                    <div className="flex flex-col items-center min-w-[30px] sm:min-w-[35px]">
                        <span className="text-gray-200">{kp}</span>
                        <span className="text-[10px] text-gray-300">KP</span>
                    </div>
                    {/* CS */}
                    <div className="flex flex-col items-center min-w-[55px] sm:min-w-[65px]">
                        <span className="text-gray-200">{cs}</span>
                        <span className="text-[10px] text-gray-300">{csPerMin} CS/m</span>
                    </div>
                    {/* Damage */}
                    <div className="flex flex-col items-center flex-grow min-w-[70px] sm:min-w-[90px] max-w-[120px]">
                        <div className="flex justify-between w-full items-baseline">
                            <span className={`${damageTextColorClass} text-[10px]`}>{damageDealt.toLocaleString()}</span>
                            <span className="text-gray-300 text-[9px]">{damagePerMin} DPM</span>
                        </div>
                        <div className="h-1.5 bg-gray-500 rounded-full w-full overflow-hidden my-0.5">
                            <div className={`h-full ${damageBarColorClass}`} style={{ width: `${damagePercentage}%` }}></div>
                        </div>
                    </div>
                    {/* Vision */}
                    <div className="flex flex-col items-center min-w-[50px] sm:min-w-[60px]">
                        <span className="text-gray-200">{player.visionWardsBoughtInGame || 0}</span>
                        <span className="text-[10px] text-gray-300">{player.wardsPlaced || 0}/{player.wardsKilled || 0}</span>
                    </div>
                </div>
            </div>
        );
    };
    
    // Function to render a team section in the scoreboard
    const renderTeamSection = (team, teamData, teamName, teamMaxDamage) => {
        const totalKills = teamData?.objectives?.champion?.kills || 0;
        const teamSide = teamName === 'Blue Team' ? 'Blue Side' : 'Red Side';
        const teamColorForText = teamName === 'Blue Team' ? 'text-blue-400' : 'text-red-400';
        const objectiveIconSize = "w-5 h-5"; // Consistent size for objective icons

        return (
            <div className="p-2 sm:p-3 rounded-md">
                {/* Team Header: Win/Loss, Side, Objectives */}
                <div className="flex items-center mb-1.5 pb-1">
                    <h3 className={`text-md sm:text-lg font-semibold ${teamColorForText}`}>
                        {teamData.win ? 'Victory' : 'Defeat'}
                        <span className="text-xs sm:text-sm text-gray-400 font-normal ml-1.5 mr-2 sm:mr-3">
                            ({teamSide})
                        </span>
                    </h3>
                    {/* Objective Icons */}
                    <div className="flex space-x-1.5 sm:space-x-2 items-center text-xs">
                        <span title="Voidgrubs" className="flex items-center"><GrubIcon className={`${objectiveIconSize} mr-0.5`} /> {teamData.objectives?.horde?.kills || 0}</span>
                        <span title="Dragons" className="flex items-center"><DragonIcon className={`${objectiveIconSize} mr-0.5`} /> {teamData.objectives?.dragon?.kills || 0}</span>
                        <span title="Barons" className="flex items-center"><BaronIcon className={`${objectiveIconSize} mr-0.5`} /> {teamData.objectives?.baron?.kills || 0}</span>
                        <span title="Heralds" className="flex items-center"><HeraldIcon className={`${objectiveIconSize} mr-0.5`} /> {teamData.objectives?.riftHerald?.kills || 0}</span>
                        {teamData.objectives?.elderDragon?.kills > 0 && <span title="Elder Dragons" className="flex items-center"><ElderDragonIcon className={`${objectiveIconSize} mr-0.5`} /> {teamData.objectives.elderDragon.kills || 0}</span>}
                        <span title="Towers" className="flex items-center"><TowerIcon className={`${objectiveIconSize} mr-0.5`} /> {teamData.objectives?.tower?.kills || 0}</span>
                    </div>
                </div>
                {/* Player Rows */}
                {team.map(player => renderPlayerRow(
                    player,
                    totalKills,
                    player.totalDamageDealtToChampions === teamMaxDamage && teamMaxDamage > 0, // Check if this player is top damage in their team
                    player.puuid === trackedPlayerPuuid // Highlight only if it's the tracked player for this match
                ))}
            </div>
        );
    };

    // Content for the "General" (Scoreboard) tab
    const GeneralTabContent = () => (
        <div className="space-y-3">
            {renderTeamSection(blueTeam, blueTeamData, "Blue Team", maxDamageBlueTeam)}
            {renderTeamSection(redTeam, redTeamData, "Red Team", maxDamageRedTeam)}
        </div>
    );

    // Content for the "Details" tab
    const DetailsTabContent = () => {
        const currentPlayerForDisplay = allParticipants.find(p => p.puuid === selectedPlayerForDetailsPuuid);
        
        if (!currentPlayerForDisplay) return <p className="text-gray-400 p-4">Player data not found for selection.</p>;

        // Use currentSelectedPlayerTimeline which is updated based on selection
        const timelineToDisplay = currentSelectedPlayerTimeline; 
        
        const snapshot15min = timelineToDisplay?.snapshots?.find(s => s.minute === 15);
        const firstToLvl2Display = timelineToDisplay?.laningPhase?.firstToLvl2 || "N/A";

        // Helper component for stat items
        const StatItem = ({ value, label, title }) => (
            <div className="flex flex-col items-center text-center" title={title}>
                <span className="text-gray-100 font-medium text-sm sm:text-base">{value !== undefined && value !== null ? value : 'N/A'}</span>
                <span className="text-gray-400 text-[10px] sm:text-xs leading-tight mt-0.5">{label}</span>
            </div>
        );
        
        // Renders champion icons for selection in the Details tab
        const renderChampionIconWithRole = (player) => {
            const roleIconSrc = roleIconMap[player.teamPosition?.toUpperCase()];
            const isSelected = player.puuid === selectedPlayerForDetailsPuuid;
            return (
                <button 
                    key={player.puuid} 
                    className={`relative w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 focus:outline-none transition-all duration-150
                                ${isSelected ? 'ring-2 ring-orange-500 rounded-md scale-110' : 'opacity-75 hover:opacity-100'}`}
                    title={`Show stats for ${getChampionDisplayName(player.championName)}`}
                    onClick={() => setSelectedPlayerForDetailsPuuid(player.puuid)} // Update selected PUUID
                >
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
                </button>
            );
        };

        return (
            <div className="p-3 sm:p-4 text-gray-200 space-y-4">
                {/* Champion Icons Header for selecting player */}
                <div className="flex items-center justify-center space-x-2 sm:space-x-3 mb-4 p-2 rounded-lg">
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
                    <div className="bg-gray-700/40 p-3 rounded-lg border border-gray-600/50 min-h-[100px] flex flex-col justify-center">
                        <h4 className="font-semibold text-gray-300 mb-3 text-sm sm:text-base text-center">Laning Phase</h4>
                        {timelineToDisplay && timelineToDisplay.snapshots ? (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-2 gap-y-3">
                                <StatItem value={snapshot15min?.diff?.cs !== undefined ? (snapshot15min.diff.cs > 0 ? `+${snapshot15min.diff.cs}` : snapshot15min.diff.cs) : 'N/A'} label="CS Diff @15" />
                                <StatItem value={snapshot15min?.diff?.gold !== undefined ? (snapshot15min.diff.gold > 0 ? `+${snapshot15min.diff.gold.toLocaleString()}` : snapshot15min.diff.gold.toLocaleString()) : 'N/A'} label="Gold Diff @15" />
                                <StatItem value={snapshot15min?.diff?.xp !== undefined ? (snapshot15min.diff.xp > 0 ? `+${snapshot15min.diff.xp.toLocaleString()}` : snapshot15min.diff.xp.toLocaleString()) : 'N/A'} label="XP Diff @15" />
                                <StatItem 
                                    value={firstToLvl2Display} 
                                    label="First to Lvl 2" 
                                    title={
                                        firstToLvl2Display === "Yes" ? "You (or same time) reached level 2 first." :
                                        firstToLvl2Display === "No" ? "Opponent reached level 2 first." :
                                        firstToLvl2Display.includes("Player N/A") ? "Opponent reached level 2; your data N/A." :
                                        firstToLvl2Display.includes("Opponent N/A") ? "You reached level 2; opponent data N/A." :
                                        "Level 2 race data not available."
                                    }
                                />
                            </div>
                        ) : (
                            <p className="text-gray-500 text-center text-sm italic">Missing detailed laning stats for this player.</p>
                        )}
                    </div>

                    {/* Wards */}
                    <div className="bg-gray-700/40 p-3 rounded-lg border border-gray-600/50">
                        <h4 className="font-semibold text-gray-300 mb-3 text-sm sm:text-base text-center">Wards</h4>
                        <div className="grid grid-cols-3 gap-x-2 gap-y-3">
                            <StatItem value={currentPlayerForDisplay.wardsPlaced || 0} label="Placed" />
                            <StatItem value={currentPlayerForDisplay.wardsKilled || 0} label="Killed" />
                            <StatItem value={currentPlayerForDisplay.visionWardsBoughtInGame || 0} label="Control" />
                        </div>
                    </div>

                    {/* Global Stats */}
                    <div className="bg-gray-700/40 p-3 rounded-lg border border-gray-600/50">
                        <h4 className="font-semibold text-gray-300 mb-3 text-sm sm:text-base text-center">Global Stats</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-2 gap-y-3">
                            <StatItem value={gameDuration > 0 ? (((currentPlayerForDisplay.totalMinionsKilled || 0) + (currentPlayerForDisplay.neutralMinionsKilled || 0)) / (gameDuration / 60)).toFixed(1) : '0.0'} label="CS/min" />
                            <StatItem value={gameDuration > 0 ? ((currentPlayerForDisplay.visionScore || 0) / (gameDuration / 60)).toFixed(2) : '0.00'} label="VS/min" />
                            <StatItem value={gameDuration > 0 ? ((currentPlayerForDisplay.totalDamageDealtToChampions || 0) / (gameDuration / 60)).toFixed(0) : '0'} label="DMG/min" />
                            <StatItem value={gameDuration > 0 ? ((currentPlayerForDisplay.goldEarned || 0) / (gameDuration / 60)).toFixed(0) : '0'} label="Gold/min" />
                        </div>
                    </div>
                </div>

                {/* Build Order */}
                <div className="bg-gray-700/40 p-3 rounded-lg border border-gray-600/50 min-h-[80px] flex flex-col justify-center">
                    <h4 className="font-semibold text-gray-300 mb-2 text-sm sm:text-base">Build Order</h4>
                    {timelineToDisplay && timelineToDisplay.buildOrder && timelineToDisplay.buildOrder.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                            {timelineToDisplay.buildOrder.map((itemEvent, index) => (
                                getItemImage(itemEvent.itemId) ?
                                <img
                                    key={`build-${index}-${itemEvent.itemId}-${itemEvent.timestamp}`} // Added timestamp for better key uniqueness
                                    src={getItemImage(itemEvent.itemId)}
                                    alt={`Item ${itemEvent.itemId}`}
                                    className="w-8 h-8 sm:w-9 sm:h-9 rounded border border-gray-500"
                                    title={`@ ${formatGameDurationMMSS(itemEvent.timestamp / 1000)} (${itemEvent.type})`}
                                />
                                : null
                            ))}
                        </div>
                    ) : <p className="text-gray-500 text-xs sm:text-sm italic">Missing build order data for this player.</p>}
                </div>

                {/* Skill Order */}
                <div className="bg-gray-700/40 p-3 rounded-lg border border-gray-600/50 min-h-[60px] flex flex-col justify-center">
                    <h4 className="font-semibold text-gray-300 mb-2 text-sm sm:text-base">Skill Order (QWER)</h4>
                    {timelineToDisplay && timelineToDisplay.skillOrder && timelineToDisplay.skillOrder.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                            {timelineToDisplay.skillOrder.map((skill, index) => (
                                <span 
                                    key={`skill-${index}-${skill.skillSlot}-${skill.timestamp}`} // Added timestamp for better key
                                    className="bg-gray-800 px-2 py-1 rounded text-orange-300 text-xs sm:text-sm border border-gray-600" 
                                    title={`Lvl ${skill.levelTakenAt} (Skill Lvl ${skill.skillLevel}) @ ${formatGameDurationMMSS(skill.timestamp / 1000)}`}
                                >
                                    {['Q', 'W', 'E', 'R'][skill.skillSlot - 1] || '?'}
                                </span>
                            ))}
                        </div>
                    ) : <p className="text-gray-500 text-xs sm:text-sm italic">Missing skill order data for this player.</p>}
                </div>
                
                {/* Runes (Placeholder - Full rune display can be complex) */}
                <div className="bg-gray-700/40 p-3 rounded-lg border border-gray-600/50">
                    <h4 className="font-semibold text-gray-300 mb-2 text-sm sm:text-base">Runes</h4>
                    {/* You can display primary and secondary tree names, and keystone here */}
                    {/* Example: currentPlayerForDisplay.perks.styles... */}
                    <p className="text-gray-400 text-xs sm:text-sm">Detailed rune display not yet implemented.</p>
                </div>
            </div>
        );
    };
    
    // Determine background color for the expanded section based on win/loss of the tracked player
    const expandedBgClass = isTrackedPlayerWin === null
    ? 'bg-gray-950/40' // Neutral if win status is unknown
    : isTrackedPlayerWin
        ? 'bg-blue-950/30' // Blue tint for win
        : 'bg-red-950/30';  // Red tint for loss

    return (
        <div className={`mt-0.5 p-2 sm:p-3 ${expandedBgClass} backdrop-blur-sm rounded-b-lg border-t border-gray-700/50 shadow-inner`}>
            {/* Tabs for switching between General Scoreboard and Detailed View */}
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
                    Details
                </button>
            </div>
            {/* Render content based on active tab */}
            {activeTab === 'General' && <GeneralTabContent />}
            {activeTab === 'Details' && <DetailsTabContent />}
        </div>
    );
};

export default ExpandedMatchDetails;
