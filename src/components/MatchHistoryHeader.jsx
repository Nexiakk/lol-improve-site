// src/components/MatchHistoryHeader.jsx
import React, { useMemo } from 'react';
import { TrendingUp, RefreshCw, Loader2 } from 'lucide-react';

// Helper to calculate KDA for a single game
const calculateSingleGameKDA = (kills, deaths, assists) => {
  if (deaths === 0) {
    return (kills > 0 || assists > 0) ? (kills + assists) * 2 : 0; 
  }
  return (kills + assists) / deaths;
};

// Half-Circle Radial Progress Chart Component
const WinrateHalfRadialChart = ({ winrate, wins, losses, radius = 50, strokeWidth = 10 }) => {
  const r = radius - strokeWidth / 2;
  const centerX = radius;
  const centerY = radius; 

  const polarToCartesian = (cX, cY, currentRadius, angleInDegrees) => {
    const angleInRadians = ((angleInDegrees - 180) * Math.PI) / 180.0; 
    return {
      x: cX + currentRadius * Math.cos(angleInRadians),
      y: cY + currentRadius * Math.sin(angleInRadians),
    };
  };

  const describeArc = (x, y, currentRadius, startAngle, endAngle) => {
    const start = polarToCartesian(x, y, currentRadius, endAngle);
    const end = polarToCartesian(x, y, currentRadius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    const d = [
      "M", start.x, start.y,
      "A", currentRadius, currentRadius, 0, largeArcFlag, 0, end.x, end.y,
    ].join(" ");
    return d;
  };

  const angle = (winrate / 100) * 180; 

  const trackPath = describeArc(centerX, centerY, r, 0, 180); 
  const progressPath = describeArc(centerX, centerY, r, 0, angle); 

  const winColor = 'hsl(var(--chart-wins-hsl))'; 
  const trackColor = 'hsl(var(--chart-losses-bg-hsl))'; 

  return (
    <div className="relative" style={{ width: radius * 2, height: radius + strokeWidth / 2 }}>
      <svg width={radius * 2} height={radius + strokeWidth / 2} viewBox={`0 0 ${radius * 2} ${radius + strokeWidth /2}`}>
        <path
          d={trackPath}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {winrate > 0 && ( 
            <path
            d={progressPath}
            fill="none"
            stroke={winColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            />
        )}
      </svg>
      <div 
        className="absolute top-[90%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center text-center" // Changed top from 55% to 70%
        style={{ width: '100%' }} 
      >
        <span className="text-sm font-bold" style={{ color: winColor }}>
          {winrate.toFixed(0)}%
        </span>
        <span className="text-xs text-gray-300 font-semibold -mt-0.5">Winrate</span>
        <span className="text-sm text-gray-300 font-semibold mt-2">
          {wins}W - {losses}L
        </span>
      </div>
    </div>
  );
};


function MatchHistoryHeader({
  matches, 
  championData,
  getChampionImage,
  getChampionDisplayName,
  handleUpdateAllMatches,
  isUpdatingAllMatches,
  isLoadingAccounts,
  trackedAccounts,
  ddragonVersion,
  runesMap, 
  updateProgress,
  gamesForSummaryCount = 20,
}) {
  const summaryData = useMemo(() => {
    if (!matches || matches.length === 0) {
      return {
        totalGames: 0, wins: 0, losses: 0, winrate: 0,
        avgKills: 0, avgDeaths: 0, avgAssists: 0, avgKDA: 0,
        topChampions: [],
      };
    }

    const recentMatches = matches.slice(0, gamesForSummaryCount);
    const totalGames = recentMatches.length;
    let wins = 0;
    let totalKills = 0;
    let totalDeaths = 0;
    let totalAssists = 0;
    const championStats = {};

    recentMatches.forEach(match => {
      const player = match; 
      if (player.win) wins++;
      totalKills += player.kills || 0;
      totalDeaths += player.deaths || 0;
      totalAssists += player.assists || 0;

      if (player.championName) {
        if (!championStats[player.championName]) {
          championStats[player.championName] = {
            name: player.championName, games: 0, wins: 0,
            kills: 0, deaths: 0, assists: 0,
          };
        }
        championStats[player.championName].games++;
        if (player.win) championStats[player.championName].wins++;
        championStats[player.championName].kills += player.kills || 0;
        championStats[player.championName].deaths += player.deaths || 0;
        championStats[player.championName].assists += player.assists || 0;
      }
    });

    const losses = totalGames - wins;
    const winrate = totalGames > 0 ? (wins / totalGames) * 100 : 0;
    const avgKills = totalGames > 0 ? totalKills / totalGames : 0;
    const avgDeaths = totalGames > 0 ? totalDeaths / totalGames : 0;
    const avgAssists = totalGames > 0 ? totalAssists / totalGames : 0;
    const avgKDA = calculateSingleGameKDA(avgKills, avgDeaths, avgAssists);

    const sortedChampions = Object.values(championStats)
      .sort((a, b) => b.games - a.games)
      .slice(0, 3)
      .map(champ => ({
        ...champ,
        winrate: champ.games > 0 ? (champ.wins / champ.games) * 100 : 0,
        kda: calculateSingleGameKDA(champ.kills / champ.games, champ.deaths / champ.games, champ.assists / champ.games),
      }));

    return {
      totalGames, wins, losses, winrate,
      avgKills, avgDeaths, avgAssists,
      avgKDA: typeof avgKDA === 'number' ? avgKDA.toFixed(1) : avgKDA,
      topChampions: sortedChampions,
    };
  }, [matches, gamesForSummaryCount]);

  const getWinrateColor = (wr) => {
    if (wr >= 60) return 'text-green-400';
    if (wr >= 50) return 'text-blue-400';
    if (wr >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };
  const getKDAColor = (kda) => {
    if (typeof kda === 'string' && kda.toLowerCase() === 'perfect') return 'text-yellow-400';
    const kdaValue = parseFloat(kda);
    if (kdaValue >= 5) return 'text-green-400';
    if (kdaValue >= 3) return 'text-blue-400';
    if (kdaValue >= 1.5) return 'text-sky-400';
    return 'text-gray-400';
  };

  const updateButtonDisabled = isUpdatingAllMatches || isLoadingAccounts || trackedAccounts.length === 0 || !ddragonVersion || !championData || !runesMap || Object.keys(runesMap).length === 0;

  return (
    <div className="px-4 sm:px-6 mx-auto md:px-8 mt-4 mb-2">
      {/* Summary Section */}
      {summaryData.totalGames > 0 && (
        <div className="max-w-4xl mx-auto bg-gray-800/60 backdrop-blur-md border border-gray-700/50 pt-3 pb-3 h-fit rounded-lg flex flex-col items-center justify-center gap-y-2 text-xs font-light text-gray-300 text-center shadow-xl mb-4">
          <div className="flex items-center gap-2 mx-auto">
            <TrendingUp size={15} className="text-gray-400" />
            <span className="text-xs text-gray-200 font-semibold">
              Last {summaryData.totalGames > gamesForSummaryCount ? gamesForSummaryCount : summaryData.totalGames} Games Performance 
            </span>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-around w-full px-3 md:px-6 gap-5 md:gap-8">
            <div className="relative min-h-[80px] min-w-[100px]">
              <WinrateHalfRadialChart
                winrate={summaryData.winrate}
                wins={summaryData.wins}
                losses={summaryData.losses}
                radius={50} 
                strokeWidth={10} 
              />
            </div>
            <div className="flex flex-col items-center md:items-start justify-center gap-2">
              {summaryData.topChampions.map(champ => (
                <div key={champ.name} className="flex gap-2.5 items-center text-sm font-semibold text-center w-full md:w-auto">
                  <img
                    alt={getChampionDisplayName(champ.name)}
                    loading="lazy"
                    width="32" 
                    height="32"
                    decoding="async"
                    src={getChampionImage(champ.name)}
                    className="w-8 h-8 scale-100 rounded-md object-cover border-2 border-gray-600 shadow-md" 
                    style={{ color: 'transparent' }}
                  />
                  <div className="flex flex-col items-start opacity-90">
                    <div className="flex items-center gap-2">
                      <span className={`min-w-[32px] text-start font-bold text-xs ${getWinrateColor(champ.winrate)}`}>{champ.winrate.toFixed(0)}%</span>
                      <span className="text-gray-400 text-xs">{champ.wins}W-{champ.games - champ.wins}L</span>
                    </div>
                    <span className="flex gap-1.5 items-center text-xs font-normal">
                        <span className={getKDAColor(champ.kda)}>{typeof champ.kda === 'number' ? champ.kda.toFixed(1) : champ.kda}</span> 
                        <span className="text-gray-400">KDA</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden lg:flex flex-col items-center justify-center h-full gap-2.5 min-w-[100px]">
              <div className="flex flex-col font-semibold text-gray-300 text-sm items-center gap-1">
                Overall KDA
                <span className={`font-bold text-2xl ${getKDAColor(summaryData.avgKDA)}`}>
                  {summaryData.avgKDA}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-gray-100">{summaryData.avgKills.toFixed(1)}</span>
                <span className="text-gray-500 font-light">/</span>
                <span className="text-red-400">{summaryData.avgDeaths.toFixed(1)}</span>
                <span className="text-gray-500 font-light">/</span>
                <span className="text-gray-100">{summaryData.avgAssists.toFixed(1)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
      {summaryData.totalGames === 0 && matches && matches.length > 0 && (
         <div className="max-w-4xl mx-auto bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 p-3 h-fit rounded-lg text-sm font-light text-gray-400 text-center shadow-lg mb-3"> 
            Not enough match data for a summary (need at least 1 game from the last {gamesForSummaryCount}).
        </div>
      )}

      {/* Controls Section */}
      <div className="max-w-4xl mx-auto flex flex-col items-end mt-2 mb-3">
        <div className="w-full flex justify-end items-center mb-1.5"> 
            <button
                onClick={handleUpdateAllMatches}
                disabled={updateButtonDisabled}
                className="bg-orange-600 hover:bg-orange-500 text-white font-semibold py-2.5 px-4 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:ring-offset-gray-900 flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed transition-opacity min-w-[140px] text-sm"
            >
                {isUpdatingAllMatches ? <Loader2 size={18} className="animate-spin mr-2" /> : <RefreshCw size={18} className="mr-2" />}
                Update All
            </button>
        </div>

        {isUpdatingAllMatches && updateProgress && (
            <div className="w-full p-2.5 bg-sky-900/50 text-sky-300 border border-sky-700/50 rounded-md text-sm text-center">
            <p>{updateProgress}</p>
            </div>
        )}
      </div>
    </div>
  );
}

export default MatchHistoryHeader;
