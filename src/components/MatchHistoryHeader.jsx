// src/components/MatchHistoryHeader.jsx
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { TrendingUp, RefreshCw, Loader2, CalendarDays, Users, ShieldCheck, Search, X, ChevronDown, ChevronUp } from 'lucide-react';

// Helper to normalize text for searching (lowercase, remove diacritics, remove spaces and apostrophes)
const normalizeText = (str) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize("NFD") // Normalize to decompose combined graphemes
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/['\s]/g, ""); // Remove spaces and apostrophes
};


// Champion Filter with Autocomplete Suggestions
const ChampionFilterWithSuggestions = ({
  value, // The currently applied champion filter
  onChange, // Function to call when a champion is selected/filter is applied
  availableChampions, // Array of all available champion names (raw names from API)
  getChampionDisplayName, // Function to get display name
  getChampionImage, // Function to get champion image URL
  commonInputClass, // Common styling for inputs
}) => {
  const [inputText, setInputText] = useState(''); // Text currently in the input field
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const wrapperRef = useRef(null);

  // Effect to update inputText when the external filter value changes (e.g., cleared)
  useEffect(() => {
    if (value === '') { // If the filter is cleared externally
      setInputText('');
    } else {
      // If a filter is applied, set the input text to the display name of that champion
      const selectedChampionDisplayName = getChampionDisplayName(value);
      setInputText(selectedChampionDisplayName || value);
    }
  }, [value, getChampionDisplayName]);

  const handleInputChange = (e) => {
    const newText = e.target.value;
    setInputText(newText);
    setActiveSuggestionIndex(-1); // Reset active suggestion

    if (newText.trim() === '') {
      setSuggestions([]);
      setShowSuggestions(false);
      onChange({ target: { name: 'champion', value: '' } }); // Clear filter if input is empty
      return;
    }

    const normalizedInput = normalizeText(newText);
    const filteredSuggestions = availableChampions
      .map(apiName => ({
        apiName: apiName,
        displayName: getChampionDisplayName(apiName) || apiName,
        normalizedDisplayName: normalizeText(getChampionDisplayName(apiName) || apiName),
        normalizedApiName: normalizeText(apiName)
      }))
      .filter(champ => 
        champ.normalizedDisplayName.includes(normalizedInput) || 
        champ.normalizedApiName.includes(normalizedInput) // Also check against normalized API name
      )
      .slice(0, 7); // Limit number of suggestions

    setSuggestions(filteredSuggestions);
    setShowSuggestions(filteredSuggestions.length > 0);
  };

  const handleSuggestionClick = (championApiName) => {
    setInputText(getChampionDisplayName(championApiName) || championApiName); // Show display name in input
    onChange({ target: { name: 'champion', value: championApiName } }); // Filter by API name
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter' && inputText.trim() !== '') {
        // Attempt to match current input text if no suggestion selected
        const normalizedInput = normalizeText(inputText);
        const directMatch = availableChampions.find(apiName => normalizeText(getChampionDisplayName(apiName) || apiName) === normalizedInput || normalizeText(apiName) === normalizedInput);
        if (directMatch) {
          handleSuggestionClick(directMatch);
        }
        setShowSuggestions(false);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeSuggestionIndex >= 0 && activeSuggestionIndex < suggestions.length) {
        handleSuggestionClick(suggestions[activeSuggestionIndex].apiName);
      } else if (inputText.trim() !== '') { // If no suggestion is active, try to match current text
        const normalizedInput = normalizeText(inputText);
        const directMatch = availableChampions.find(apiName => normalizeText(getChampionDisplayName(apiName) || apiName) === normalizedInput || normalizeText(apiName) === normalizedInput);
        if (directMatch) {
          handleSuggestionClick(directMatch);
        }
      }
      setShowSuggestions(false);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };
  
  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);


  return (
    <div className="relative" ref={wrapperRef}>
      <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      <input
        type="text"
        name="championSearch" // Internal name for this input
        value={inputText}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (inputText.trim() && suggestions.length > 0) setShowSuggestions(true);}}
        placeholder="Filter by Champion..."
        className={`${commonInputClass} pl-8 pr-2 w-full`} // Ensure padding for icon
        autoComplete="off" // Disable browser autocomplete
      />
      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute z-10 w-full bg-gray-700 border border-gray-600 rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto py-1">
          {suggestions.map((champion, index) => (
            <li
              key={champion.apiName}
              className={`px-3 py-2 text-xs cursor-pointer hover:bg-orange-500/20 flex items-center gap-2 ${index === activeSuggestionIndex ? 'bg-orange-500/20' : ''}`}
              onClick={() => handleSuggestionClick(champion.apiName)}
              onMouseEnter={() => setActiveSuggestionIndex(index)}
            >
              <img 
                src={getChampionImage(champion.apiName)} 
                alt="" 
                className="w-5 h-5 rounded-sm"
                onError={(e) => { e.target.style.display='none';}} // Simple hide on error
              />
              <span className="text-gray-200">{champion.displayName}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
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
  const winColor = 'hsl(var(--chart-wins-hsl))';
  const trackColor = 'hsl(var(--chart-losses-bg-hsl))';
  const trackPath = describeArc(centerX, centerY, r, 0, 180);
  const progressPath = describeArc(centerX, centerY, r, 0, angle);

  return (
    <div className="relative" style={{ width: radius * 2, height: radius + strokeWidth / 2 }}>
      <svg width={radius * 2} height={radius + strokeWidth / 2} viewBox={`0 0 ${radius * 2} ${radius + strokeWidth /2}`}>
        <path d={trackPath} fill="none" stroke={trackColor} strokeWidth={strokeWidth} strokeLinecap="round" />
        {winrate > 0 && <path d={progressPath} fill="none" stroke={winColor} strokeWidth={strokeWidth} strokeLinecap="round" />}
      </svg>
      <div className="absolute top-[90%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center text-center" style={{ width: '100%' }}>
        <span className="text-sm font-bold" style={{ color: winColor }}>{winrate.toFixed(0)}%</span>
        <span className="text-xs text-gray-300 font-semibold -mt-0.5">Winrate</span>
        <span className="text-sm text-gray-300 font-semibold mt-2">{wins}W - {losses}L</span>
      </div>
    </div>
  );
};

// Filter Input Component (retained for advanced filters)
const FilterInput = ({ label, icon: Icon, children, htmlFor }) => (
  <div className="flex-1 min-w-[150px]">
    <label htmlFor={htmlFor} className="block text-xs font-medium text-gray-400 mb-1 flex items-center">
      {Icon && <Icon size={14} className="mr-1.5 text-orange-400" />}
      {label}
    </label>
    {children}
  </div>
);


function MatchHistoryHeader({
  filteredMatches,
  allMatches, 
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
  filters,
  onFilterChange,
  onDatePresetFilter,
  onUpdateFetchDateChange,
  updateFetchDates,
  onClearFilters,
  availableChampions, 
  availablePatches,
}) {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showAdvancedUpdateOptions, setShowAdvancedUpdateOptions] = useState(false);

  // MOVED calculateSingleGameKDA INSIDE the component to ensure scope
  const calculateSingleGameKDA = (kills, deaths, assists) => {
    if (deaths === 0) {
      return (kills > 0 || assists > 0) ? (kills + assists) * 2 : 0;
    }
    return (kills + assists) / deaths;
  };

  const summaryData = useMemo(() => {
    if (!filteredMatches || filteredMatches.length === 0) {
      return { totalGames: 0, wins: 0, losses: 0, winrate: 0, avgKills: 0, avgDeaths: 0, avgAssists: 0, avgKDA: 0, topChampions: [] };
    }
    const recentMatches = filteredMatches.slice(0, gamesForSummaryCount);
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
          championStats[player.championName] = { name: player.championName, games: 0, wins: 0, kills: 0, deaths: 0, assists: 0 };
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
    // avgKDA call is here (line 238 in previous error)
    const avgKDA = calculateSingleGameKDA(avgKills, avgDeaths, avgAssists); 
    const sortedChampions = Object.values(championStats)
      .sort((a, b) => b.games - a.games)
      .slice(0, 3)
      .map(champ => ({
        ...champ,
        winrate: champ.games > 0 ? (champ.wins / champ.games) * 100 : 0,
        // KDA calculation for individual champion (line 246 in previous error)
        kda: calculateSingleGameKDA(champ.kills / champ.games, champ.deaths / champ.games, champ.assists / champ.games),
      }));

    return {
      totalGames, wins, losses, winrate, avgKills, avgDeaths, avgAssists,
      avgKDA: typeof avgKDA === 'number' ? avgKDA.toFixed(1) : avgKDA,
      topChampions: sortedChampions,
    };
  }, [filteredMatches, gamesForSummaryCount, getChampionDisplayName, calculateSingleGameKDA]); // Added calculateSingleGameKDA to dependencies

  const getWinrateColor = (wr) => {
    if (wr >= 60) return 'text-green-400'; if (wr >= 50) return 'text-blue-400'; if (wr >= 40) return 'text-yellow-400'; return 'text-red-400';
  };
  const getKDAColor = (kda) => {
    if (typeof kda === 'string' && kda.toLowerCase() === 'perfect') return 'text-yellow-400';
    const kdaValue = parseFloat(kda);
    if (kdaValue >= 5) return 'text-green-400'; if (kdaValue >= 3) return 'text-blue-400'; if (kdaValue >= 1.5) return 'text-sky-400'; return 'text-gray-400';
  };

  const updateButtonDisabled = isUpdatingAllMatches || isLoadingAccounts || (trackedAccounts && trackedAccounts.length === 0) || !ddragonVersion || !championData || !runesMap || Object.keys(runesMap).length === 0;

  const commonInputClass = "w-full bg-gray-700/80 border border-gray-600 rounded-md shadow-sm focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-gray-200 placeholder-gray-400 text-xs px-2.5 py-1.5";
  const datePresetButtonClass = "px-2.5 py-1 bg-gray-600/70 hover:bg-gray-500/70 text-gray-300 text-xs rounded-md transition-colors";

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 mt-4 mb-2">
      {/* Summary Section */}
      {summaryData.totalGames > 0 && (
         <div className="max-w-4xl mx-auto bg-gray-800/60 backdrop-blur-md border border-gray-700/50 pt-3 pb-3 h-fit rounded-lg flex flex-col items-center justify-center gap-y-2 text-xs font-light text-gray-300 text-center shadow-xl mb-4">
         <div className="flex items-center gap-2 mx-auto">
           <TrendingUp size={15} className="text-gray-400" />
           <span className="text-xs text-gray-200 font-semibold">
             {Object.values(filters).some(val => val && (typeof val === 'string' ? val !== '' : true) && (typeof val === 'object' ? (val.startDate || val.endDate) : true)) ? 'Filtered Performance' : `Last ${summaryData.totalGames > gamesForSummaryCount ? gamesForSummaryCount : summaryData.totalGames} Games`}
             ({summaryData.totalGames} Game{summaryData.totalGames === 1 ? '' : 's'})
           </span>
         </div>
         <div className="flex flex-col md:flex-row items-center justify-around w-full px-3 md:px-6 gap-5 md:gap-8">
           <div className="relative min-h-[80px] min-w-[100px]">
             <WinrateHalfRadialChart winrate={summaryData.winrate} wins={summaryData.wins} losses={summaryData.losses} radius={50} strokeWidth={10} />
           </div>
           <div className="flex flex-col items-center md:items-start justify-center gap-2">
             {summaryData.topChampions.map(champ => (
               <div key={champ.name} className="flex gap-2.5 items-center text-sm font-semibold text-center w-full md:w-auto">
                 <img alt={getChampionDisplayName(champ.name)} loading="lazy" width="32" height="32" decoding="async" src={getChampionImage(champ.name)} className="w-8 h-8 scale-100 rounded-md object-cover border-2 border-gray-600 shadow-md" style={{ color: 'transparent' }} />
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
             <div className="flex flex-col font-semibold text-gray-300 text-sm items-center gap-1">Overall KDA <span className={`font-bold text-2xl ${getKDAColor(summaryData.avgKDA)}`}>{summaryData.avgKDA}</span></div>
             <div className="flex items-center gap-1.5 text-xs">
               <span className="text-gray-100">{summaryData.avgKills.toFixed(1)}</span><span className="text-gray-500 font-light">/</span>
               <span className="text-red-400">{summaryData.avgDeaths.toFixed(1)}</span><span className="text-gray-500 font-light">/</span>
               <span className="text-gray-100">{summaryData.avgAssists.toFixed(1)}</span>
             </div>
           </div>
         </div>
       </div>
      )}
      {summaryData.totalGames === 0 && filteredMatches && filteredMatches.length === 0 && allMatches && allMatches.length > 0 && (
         <div className="max-w-4xl mx-auto bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 p-3 h-fit rounded-lg text-sm font-light text-gray-400 text-center shadow-lg mb-3"> 
            No matches found for the current filters. Try adjusting or clearing them.
        </div>
      )}

      {/* Main Filter Input and Expander */}
      <div className="max-w-4xl mx-auto flex items-stretch gap-2 mb-3"> 
        <div className="flex-grow" style={{ maxWidth: 'calc(100% - 44px)' }}> 
          <ChampionFilterWithSuggestions
            value={filters.champion}
            onChange={onFilterChange}
            availableChampions={availableChampions}
            getChampionDisplayName={getChampionDisplayName}
            getChampionImage={getChampionImage}
            commonInputClass={commonInputClass}
          />
        </div>
        <button
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className="p-1.5 bg-gray-700/80 hover:bg-gray-600/80 rounded-md text-gray-300 hover:text-orange-300 transition-colors h-full flex items-center justify-center w-[38px] flex-shrink-0" 
          title={showAdvancedFilters ? "Hide Advanced Filters" : "Show Advanced Filters"}
          style={{ lineHeight: '0' }} 
        >
          {showAdvancedFilters ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>


      {/* Advanced Filter Inputs - Shown conditionally */}
      {showAdvancedFilters && (
        <div className="max-w-4xl mx-auto bg-gray-800/40 backdrop-blur-sm border border-gray-700/30 p-3 rounded-lg shadow-md mb-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 items-end">
            <FilterInput label="Patch" icon={ShieldCheck} htmlFor="filterPatch">
              <select id="filterPatch" name="patch" value={filters.patch} onChange={onFilterChange} className={commonInputClass}>
                <option value="">All Patches</option>
                {availablePatches.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </FilterInput>

            <FilterInput label="With Player (Name#Tag)" icon={Users} htmlFor="filterWithPlayer">
              <input type="text" id="filterWithPlayer" name="withPlayer" value={filters.withPlayer} onChange={onFilterChange} placeholder="e.g., Teammate#EUW" className={commonInputClass} />
            </FilterInput>
            
            <FilterInput label="Date Start" icon={CalendarDays} htmlFor="filterDateStart">
              <input type="date" id="filterDateStart" name="dateRangeStart" value={filters.dateRange?.startDate || ''} onChange={onFilterChange} className={commonInputClass} />
            </FilterInput>

            <FilterInput label="Date End" icon={CalendarDays} htmlFor="filterDateEnd">
              <input type="date" id="filterDateEnd" name="dateRangeEnd" value={filters.dateRange?.endDate || ''} onChange={onFilterChange} className={commonInputClass} />
            </FilterInput>

            <div className="md:col-span-2 flex flex-col">
                 <label className="block text-xs font-medium text-gray-400 mb-1 flex items-center">
                    Date Presets
                </label>
                <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => onDatePresetFilter('last7days')} className={datePresetButtonClass}>Last 7 Days</button>
                    <button onClick={() => onDatePresetFilter('last30days')} className={datePresetButtonClass}>Last 30 Days</button>
                    <button onClick={() => onDatePresetFilter('thisMonth')} className={datePresetButtonClass}>This Month</button>
                </div>
            </div>
             <div className="flex items-end">
                <button
                    onClick={onClearFilters}
                    className="w-full bg-gray-600 hover:bg-gray-500 text-white font-medium py-1.5 px-3 rounded-md shadow-sm text-xs flex items-center justify-center transition-colors"
                >
                    <X size={14} className="mr-1" /> Clear Filters
                </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Controls Section */}
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-end items-stretch gap-2 mt-1 mb-3"> 
        <div className="flex-grow hidden sm:block"> {/* Spacer */} </div>
        <div className="flex items-stretch gap-2 w-full sm:w-auto"> 
            <button
                onClick={() => handleUpdateAllMatches(updateFetchDates.startDate, updateFetchDates.endDate)}
                disabled={updateButtonDisabled}
                className="flex-grow sm:flex-none bg-orange-600 hover:bg-orange-500 text-white font-semibold py-2 px-4 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:ring-offset-gray-900 flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed transition-opacity min-w-[140px] text-sm h-full" 
            >
                {isUpdatingAllMatches ? <Loader2 size={18} className="animate-spin mr-2" /> : <RefreshCw size={18} className="mr-2" />}
                Update Matches
            </button>
            <button
              onClick={() => setShowAdvancedUpdateOptions(!showAdvancedUpdateOptions)}
              className="p-2 bg-gray-700/80 hover:bg-gray-600/80 rounded-lg text-gray-300 hover:text-orange-300 transition-colors h-full flex items-center justify-center w-[38px] flex-shrink-0" 
              title={showAdvancedUpdateOptions ? "Hide Date Range for Update" : "Show Date Range for Update"}
              style={{ lineHeight: '0' }}
            >
              {showAdvancedUpdateOptions ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
        </div>
      </div>
      {showAdvancedUpdateOptions && (
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-end items-center gap-2 mb-3 p-3 bg-gray-800/40 rounded-lg border border-gray-700/30">
            <div className="flex flex-col items-start w-full sm:w-auto">
                <label htmlFor="updateStartDate" className="text-xs text-gray-400 mb-0.5">Fetch Start Date:</label>
                <input
                    type="date"
                    id="updateStartDate"
                    name="startDate"
                    value={updateFetchDates.startDate || ''}
                    onChange={onUpdateFetchDateChange}
                    className={`${commonInputClass} w-full sm:w-auto`}
                    disabled={isUpdatingAllMatches}
                />
            </div>
            <div className="flex flex-col items-start w-full sm:w-auto">
                <label htmlFor="updateEndDate" className="text-xs text-gray-400 mb-0.5">Fetch End Date:</label>
                <input
                    type="date"
                    id="updateEndDate"
                    name="endDate"
                    value={updateFetchDates.endDate || ''}
                    onChange={onUpdateFetchDateChange}
                    className={`${commonInputClass} w-full sm:w-auto`}
                    disabled={isUpdatingAllMatches}
                />
            </div>
        </div>
      )}

      {isUpdatingAllMatches && updateProgress && (
        <div className="max-w-4xl mx-auto w-full p-2.5 bg-sky-900/50 text-sky-300 border border-gray-700/50 rounded-md text-sm text-center mb-2">
          <p>{updateProgress}</p>
        </div>
      )}
    </div>
  );
}

export default MatchHistoryHeader;
