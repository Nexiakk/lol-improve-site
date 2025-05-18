// src/components/MatchHistoryHeader.jsx
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { TrendingUp, RefreshCw, Loader2, CalendarDays, Users, ShieldCheck, Search, X, ChevronDown, ChevronUp } from 'lucide-react';

// React Aria hooks (from react-aria)
import {
  useComboBox, useFilter, useButton as useAriaButtonHook, 
  useListBox, useOption,
  useTextField, 
  mergeProps,
} from 'react-aria';
// React Stately hooks (from react-stately)
import {
  useComboBoxState, useListState, 
  useDateRangePickerState, useOverlayTriggerState 
} from 'react-stately';
// React Aria Components (from react-aria-components)
import { 
    Popover as RACPopover, 
    Dialog as RACDialog, 
    RangeCalendar as RACRangeCalendar,
    ComboBox as RACComboBox,
    ListBox as RACListBox,
    ListBoxItem as RACListBoxItem,
    Input as RACInput,
    Button as RACButton, 
    DateRangePicker as RACDateRangePicker,
    DateField as RACDateField,
    DateInput as RACDateInput, 
    DateSegment as RACDateSegment,
    Group as RACGroup, 
    Label as RACLabel, 
    FieldError, 
} from 'react-aria-components';

// Corrected import: Removed DateValue
import { CalendarDate, parseDate, today, getLocalTimeZone } from '@internationalized/date';

// Helper to normalize text for searching
const normalizeText = (str) => {
  if (!str) return '';
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/['\s]/g, "");
};

// --- Champion ComboBox using React Aria Components ---
const ChampionComboBox = ({
  value, onChange, availableChampions, getChampionDisplayName, getChampionImage, commonInputClass,
}) => {
  const items = useMemo(() => availableChampions.map(apiName => ({
    id: apiName, name: getChampionDisplayName(apiName) || apiName, apiName: apiName
  })), [availableChampions, getChampionDisplayName]);

  const filterFunction = (textValue, inputValue) => {
    return normalizeText(textValue).includes(normalizeText(inputValue));
  };

  return (
    <RACComboBox
      label="Filter by Champion" 
      className="relative w-full group" 
      items={items}
      selectedKey={value}
      onSelectionChange={(key) => onChange({ target: { name: 'champion', value: key || '' } })}
      inputValue={value ? (getChampionDisplayName(value) || value) : undefined} 
      onInputChange={(text) => {
        if (text === '') {
            onChange({ target: { name: 'champion', value: '' } });
        }
      }}
      defaultFilter={filterFunction}
      allowsCustomValue={false} 
      menuTrigger="focus" 
    >
      <RACLabel className="sr-only">Champion</RACLabel>
      <RACGroup className={`relative flex items-center ${commonInputClass} pl-8 pr-2 group-focus-within:ring-1 group-focus-within:ring-orange-500 group-focus-within:border-orange-500`}>
        <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <RACInput className="bg-transparent outline-none w-full h-full text-gray-200 placeholder-gray-400 text-xs" placeholder="Champion..." />
      </RACGroup>
      <RACPopover className="w-[--trigger-width] z-20 mt-1"> 
        <RACListBox
          className="bg-gray-700 border border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto py-1"
        >
          {(item) => ( 
            <RACListBoxItem textValue={item.name} key={item.id} id={item.id}
              className="px-3 py-2 text-xs cursor-pointer flex items-center gap-2 outline-none data-[focused]:bg-orange-500/30 data-[selected]:bg-orange-600/50 data-[selected]:text-white data-[disabled]:text-gray-500 data-[disabled]:cursor-not-allowed text-gray-200 hover:bg-orange-500/20"
            >
              {getChampionImage && item.apiName && <img src={getChampionImage(item.apiName)} alt="" className="w-5 h-5 rounded-sm flex-shrink-0" onError={(e) => { e.target.style.display='none';}}/>}
              {item.name}
            </RACListBoxItem>
          )}
        </RACListBox>
      </RACPopover>
    </RACComboBox>
  );
};


// --- Patch ComboBox using React Aria Components ---
const PatchComboBox = ({ value, onChange, availablePatches, commonInputClass }) => {
  const items = useMemo(() => availablePatches.map(patch => ({ id: patch, name: patch })), [availablePatches]);
  const filterFunction = (textValue, inputValue) => normalizeText(textValue).includes(normalizeText(inputValue));

  return (
    <RACComboBox
      label="Filter by Patch"
      className="relative w-full group"
      items={items}
      selectedKey={value}
      onSelectionChange={(key) => onChange({ target: { name: 'patch', value: key || '' } })}
      inputValue={value || undefined}
      onInputChange={(text) => { if (text === '') onChange({ target: { name: 'patch', value: '' } });}}
      defaultFilter={filterFunction}
      allowsCustomValue={false}
      menuTrigger="focus"
    >
      <RACLabel className="sr-only">Patch</RACLabel>
      <RACGroup className={`${commonInputClass} group-focus-within:ring-1 group-focus-within:ring-orange-500 group-focus-within:border-orange-500`}>
        <RACInput className="bg-transparent outline-none w-full h-full text-gray-200 placeholder-gray-400 text-xs" placeholder="Patch..." />
      </RACGroup>
      <RACPopover className="w-[--trigger-width] z-20 mt-1">
        <RACListBox
          className="bg-gray-700 border border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto py-1"
        >
          {(item) => (
            <RACListBoxItem textValue={item.name} key={item.id} id={item.id}
             className="px-3 py-2 text-xs cursor-pointer outline-none data-[focused]:bg-orange-500/30 data-[selected]:bg-orange-600/50 data-[selected]:text-white data-[disabled]:text-gray-500 text-gray-200 hover:bg-orange-500/20"
            >
              {item.name}
            </RACListBoxItem>
          )}
        </RACListBox>
      </RACPopover>
    </RACComboBox>
  );
};

// --- DateRangePicker using React Aria Components ---
const DateFilterRangePicker = ({ value, onChange, commonInputClass }) => {
  const dateValue = useMemo(() => {
    if (value && value.startDate && value.endDate) {
      try {
        return {
          start: parseDate(value.startDate),
          end: parseDate(value.endDate)
        };
      } catch (e) { return null; } 
    }
    return null;
  }, [value]);

  const handleDateChange = (range) => {
    onChange({
      target: { name: 'dateRange', value: range ? {
        startDate: range.start?.toString(),
        endDate: range.end?.toString()
      } : { startDate: '', endDate: '' }}
    });
  };

  return (
    <RACDateRangePicker
      label="Date Range" 
      className="relative inline-flex flex-col items-start group" 
      value={dateValue}
      onChange={handleDateChange}
      granularity="day"
    >
      <RACLabel className="sr-only">Date Range</RACLabel>
      <RACGroup className={`flex items-center rounded-md border border-gray-600 group-focus-within:ring-1 group-focus-within:ring-orange-500 group-focus-within:border-orange-500`}>
        <RACDateField slot="start" className="flex">
          {(segment) => <RACDateSegment segment={segment} className={`${commonInputClass} rounded-none border-0 border-r border-gray-600 focus:ring-0 focus:border-transparent bg-transparent px-1.5 py-1 text-center tabular-nums w-[90px] data-[placeholder]:text-gray-500 outline-none`} />}
        </RACDateField>
        <span aria-hidden="true" className="px-1 text-gray-400">–</span>
        <RACDateField slot="end" className="flex">
          {(segment) => <RACDateSegment segment={segment} className={`${commonInputClass} rounded-none border-0 focus:ring-0 focus:border-transparent bg-transparent px-1.5 py-1 text-center tabular-nums w-[90px] data-[placeholder]:text-gray-500 outline-none`} />}
        </RACDateField>
        <RACButton className="p-1.5 text-gray-300 hover:text-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-500 rounded-r-md bg-gray-700/80 hover:bg-gray-600/80 h-full">
          <CalendarDays size={16} />
        </RACButton>
      </RACGroup>
      <RACPopover className="z-20 mt-1"> 
        <RACDialog className="bg-gray-700 p-0 rounded-md shadow-lg border border-gray-600 outline-none"> 
          <RACRangeCalendar /> 
        </RACDialog>
      </RACPopover>
    </RACDateRangePicker>
  );
};


// --- Half-Circle Radial Progress Chart Component --- (no changes)
const WinrateHalfRadialChart = ({ winrate, wins, losses, radius = 50, strokeWidth = 10 }) => {
    const r = radius - strokeWidth / 2; const centerX = radius; const centerY = radius;
    const polarToCartesian = (cX, cY, currentRadius, angleInDegrees) => { const angleInRadians = ((angleInDegrees - 180) * Math.PI) / 180.0; return { x: cX + currentRadius * Math.cos(angleInRadians), y: cY + currentRadius * Math.sin(angleInRadians) }; };
    const describeArc = (x, y, currentRadius, startAngle, endAngle) => { const start = polarToCartesian(x, y, currentRadius, endAngle); const end = polarToCartesian(x, y, currentRadius, startAngle); const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1"; return ["M", start.x, start.y, "A", currentRadius, currentRadius, 0, largeArcFlag, 0, end.x, end.y].join(" "); };
    const angle = (winrate / 100) * 180; const winColor = 'hsl(var(--chart-wins-hsl))'; const trackColor = 'hsl(var(--chart-losses-bg-hsl))';
    const trackPath = describeArc(centerX, centerY, r, 0, 180); const progressPath = describeArc(centerX, centerY, r, 0, angle);
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
      </div>);
};
  
// Filter Input Component (for "With Player" text field)
const FilterInput = ({ label, icon: Icon, children, htmlFor }) => (
    <div> 
      <label htmlFor={htmlFor} className="block text-xs font-medium text-gray-400 mb-1 flex items-center">
        {Icon && <Icon size={14} className="mr-1.5 text-orange-400" />}
        {label}
      </label>
      {children}
    </div>
);

// --- Main Header Component ---
function MatchHistoryHeader({
  filteredMatches, allMatches, championData, getChampionImage, getChampionDisplayName,
  handleUpdateAllMatches, isUpdatingAllMatches, isLoadingAccounts, trackedAccounts,
  ddragonVersion, runesMap, updateProgress, gamesForSummaryCount = 20,
  filters, onFilterChange, onDatePresetFilter, onUpdateFetchDateChange,
  updateFetchDates, onClearFilters, availableChampions, availablePatches,
}) {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showAdvancedUpdateOptions, setShowAdvancedUpdateOptions] = useState(false);

  const calculateSingleGameKDA = (kills, deaths, assists) => {
    if (deaths === 0) return (kills > 0 || assists > 0) ? (kills + assists) * 2 : 0;
    return (kills + assists) / deaths;
  };

  const summaryData = useMemo(() => {
    if (!filteredMatches || filteredMatches.length === 0) return { totalGames: 0, wins: 0, losses: 0, winrate: 0, avgKills: 0, avgDeaths: 0, avgAssists: 0, avgKDA: 0, topChampions: [] };
    const recentMatches = filteredMatches.slice(0, gamesForSummaryCount);
    const totalGames = recentMatches.length; let wins = 0; let totalKills = 0; let totalDeaths = 0; let totalAssists = 0; const championStats = {};
    recentMatches.forEach(match => {
      const player = match; if (player.win) wins++; totalKills += player.kills || 0; totalDeaths += player.deaths || 0; totalAssists += player.assists || 0;
      if (player.championName) {
        if (!championStats[player.championName]) championStats[player.championName] = { name: player.championName, games: 0, wins: 0, kills: 0, deaths: 0, assists: 0 };
        championStats[player.championName].games++; if (player.win) championStats[player.championName].wins++;
        championStats[player.championName].kills += player.kills || 0; championStats[player.championName].deaths += player.deaths || 0; championStats[player.championName].assists += player.assists || 0;
      }
    });
    const losses = totalGames - wins; const winrate = totalGames > 0 ? (wins / totalGames) * 100 : 0;
    const avgKills = totalGames > 0 ? totalKills / totalGames : 0; const avgDeaths = totalGames > 0 ? totalDeaths / totalGames : 0; const avgAssists = totalGames > 0 ? totalAssists / totalGames : 0;
    const avgKDA = calculateSingleGameKDA(avgKills, avgDeaths, avgAssists);
    const sortedChampions = Object.values(championStats).sort((a, b) => b.games - a.games).slice(0, 3)
      .map(champ => ({ ...champ, winrate: champ.games > 0 ? (champ.wins / champ.games) * 100 : 0, kda: calculateSingleGameKDA(champ.kills / champ.games, champ.deaths / champ.games, champ.assists / champ.games) }));
    return { totalGames, wins, losses, winrate, avgKills, avgDeaths, avgAssists, avgKDA: typeof avgKDA === 'number' ? avgKDA.toFixed(1) : avgKDA, topChampions: sortedChampions };
  }, [filteredMatches, gamesForSummaryCount, getChampionDisplayName, calculateSingleGameKDA]);

  const getWinrateColor = (wr) => { if (wr >= 60) return 'text-green-400'; if (wr >= 50) return 'text-blue-400'; if (wr >= 40) return 'text-yellow-400'; return 'text-red-400'; };
  const getKDAColor = (kda) => { if (typeof kda === 'string' && kda.toLowerCase() === 'perfect') return 'text-yellow-400'; const kdaValue = parseFloat(kda); if (kdaValue >= 5) return 'text-green-400'; if (kdaValue >= 3) return 'text-blue-400'; if (kdaValue >= 1.5) return 'text-sky-400'; return 'text-gray-400'; };

  const updateButtonDisabled = isUpdatingAllMatches || isLoadingAccounts || (trackedAccounts && trackedAccounts.length === 0) || !ddragonVersion || !championData || !runesMap || Object.keys(runesMap).length === 0;
  const commonInputClass = "bg-gray-700/80 border border-gray-600 rounded-md shadow-sm text-gray-200 placeholder-gray-400 text-xs px-2.5 py-1.5 outline-none data-[focused]:ring-1 data-[focused]:ring-orange-500 data-[focused]:border-orange-500"; 
  const datePresetButtonClass = "px-2.5 py-1 bg-gray-600/70 hover:bg-gray-500/70 text-gray-300 text-xs rounded-md transition-colors focus:outline-none data-[focus-visible]:ring-1 data-[focus-visible]:ring-orange-500";
  
  const withPlayerRef = useRef();
  const {labelProps: withPlayerLabelProps, inputProps: withPlayerInputProps} = useTextField({
    label: "With Player (Name#Tag)",
    name: "withPlayer", 
    value: filters.withPlayer,
    onChange: (val) => onFilterChange({target: {name: "withPlayer", value: val}}), 
    placeholder: "e.g., Teammate#EUW"
  }, withPlayerRef);


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
           <div className="relative min-h-[80px] min-w-[100px]"> <WinrateHalfRadialChart winrate={summaryData.winrate} wins={summaryData.wins} losses={summaryData.losses} radius={50} strokeWidth={10} /> </div>
           <div className="flex flex-col items-center md:items-start justify-center gap-2">
             {summaryData.topChampions.map(champ => (
               <div key={champ.name} className="flex gap-2.5 items-center text-sm font-semibold text-center w-full md:w-auto">
                 <img alt={getChampionDisplayName(champ.name)} loading="lazy" width="32" height="32" decoding="async" src={getChampionImage(champ.name)} className="w-8 h-8 scale-100 rounded-md object-cover border-2 border-gray-600 shadow-md" style={{ color: 'transparent' }} />
                 <div className="flex flex-col items-start opacity-90">
                   <div className="flex items-center gap-2"><span className={`min-w-[32px] text-start font-bold text-xs ${getWinrateColor(champ.winrate)}`}>{champ.winrate.toFixed(0)}%</span><span className="text-gray-400 text-xs">{champ.wins}W-{champ.games - champ.wins}L</span></div>
                   <span className="flex gap-1.5 items-center text-xs font-normal"><span className={getKDAColor(champ.kda)}>{typeof champ.kda === 'number' ? champ.kda.toFixed(1) : champ.kda}</span> <span className="text-gray-400">KDA</span></span>
                 </div></div>))}</div>
           <div className="hidden lg:flex flex-col items-center justify-center h-full gap-2.5 min-w-[100px]">
             <div className="flex flex-col font-semibold text-gray-300 text-sm items-center gap-1">Overall KDA <span className={`font-bold text-2xl ${getKDAColor(summaryData.avgKDA)}`}>{summaryData.avgKDA}</span></div>
             <div className="flex items-center gap-1.5 text-xs"><span className="text-gray-100">{summaryData.avgKills.toFixed(1)}</span><span className="text-gray-500 font-light">/</span><span className="text-red-400">{summaryData.avgDeaths.toFixed(1)}</span><span className="text-gray-500 font-light">/</span><span className="text-gray-100">{summaryData.avgAssists.toFixed(1)}</span></div>
           </div></div></div>)}
      {summaryData.totalGames === 0 && filteredMatches && filteredMatches.length === 0 && allMatches && allMatches.length > 0 && (
         <div className="max-w-4xl mx-auto bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 p-3 h-fit rounded-lg text-sm font-light text-gray-400 text-center shadow-lg mb-3"> No matches found for the current filters. Try adjusting or clearing them.</div>)}

      {/* Filter and Update Control Bar */}
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-start gap-3 mb-3">
        <div className="flex items-stretch gap-2 w-full sm:w-auto">
            <RACButton onPress={() => handleUpdateAllMatches(updateFetchDates.startDate, updateFetchDates.endDate)} isDisabled={updateButtonDisabled}
                className="flex-grow sm:flex-none bg-orange-600 hover:bg-orange-500 text-white font-semibold py-2 px-4 rounded-lg shadow-md focus:outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-orange-400 data-[focus-visible]:ring-offset-2 data-[focus-visible]:ring-offset-gray-900 flex items-center justify-center data-[disabled]:opacity-60 data-[disabled]:cursor-not-allowed transition-opacity min-w-[140px] text-sm h-full">
                {isUpdatingAllMatches ? <Loader2 size={18} className="animate-spin mr-2" /> : <RefreshCw size={18} className="mr-2" />}
                Update Matches
            </RACButton>
            <RACButton onPress={() => setShowAdvancedUpdateOptions(!showAdvancedUpdateOptions)} aria-expanded={showAdvancedUpdateOptions} aria-controls="advanced-update-options-section"
              className="p-2 bg-gray-700/80 hover:bg-gray-600/80 rounded-lg text-gray-300 hover:text-orange-300 transition-colors h-full flex items-center justify-center w-[38px] flex-shrink-0 focus:outline-none data-[focus-visible]:ring-1 data-[focus-visible]:ring-orange-500"
              title={showAdvancedUpdateOptions ? "Hide Date Range for Update" : "Show Date Range for Update"} style={{ lineHeight: '0' }}>
              {showAdvancedUpdateOptions ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </RACButton>
        </div>
        
        <div className="flex items-stretch gap-2 w-full sm:w-auto">
          <div className="flex-grow sm:flex-grow-0 w-full sm:w-48 md:w-56"> 
            <ChampionComboBox value={filters.champion} onChange={onFilterChange} availableChampions={availableChampions} getChampionDisplayName={getChampionDisplayName} getChampionImage={getChampionImage} commonInputClass={commonInputClass}/>
          </div>
          <RACButton onPress={() => setShowAdvancedFilters(!showAdvancedFilters)} aria-expanded={showAdvancedFilters} aria-controls="advanced-filters-section"
            className="p-1.5 bg-gray-700/80 hover:bg-gray-600/80 rounded-md text-gray-300 hover:text-orange-300 transition-colors h-full flex items-center justify-center w-[38px] flex-shrink-0 focus:outline-none data-[focus-visible]:ring-1 data-[focus-visible]:ring-orange-500"
            title={showAdvancedFilters ? "Hide Advanced Filters" : "Show Advanced Filters"} style={{ lineHeight: '0' }}>
            {showAdvancedFilters ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </RACButton>
        </div>
      </div>
      
      {showAdvancedUpdateOptions && (
        <div id="advanced-update-options-section" className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-end items-center gap-2 mb-3 p-3 bg-gray-800/40 rounded-lg border border-gray-700/30">
            <div className="flex flex-col items-start w-full sm:w-auto">
                <label htmlFor="updateStartDate" className="text-xs text-gray-400 mb-0.5">Fetch Start Date:</label>
                <input type="date" id="updateStartDate" name="startDate" value={updateFetchDates.startDate || ''} onChange={onUpdateFetchDateChange} className={`${commonInputClass} w-full sm:w-auto`} disabled={isUpdatingAllMatches}/>
            </div>
            <div className="flex flex-col items-start w-full sm:w-auto">
                <label htmlFor="updateEndDate" className="text-xs text-gray-400 mb-0.5">Fetch End Date:</label>
                <input type="date" id="updateEndDate" name="endDate" value={updateFetchDates.endDate || ''} onChange={onUpdateFetchDateChange} className={`${commonInputClass} w-full sm:w-auto`} disabled={isUpdatingAllMatches}/>
            </div>
        </div> )}

      {showAdvancedFilters && (
        <div id="advanced-filters-section" className="max-w-4xl mx-auto bg-gray-800/40 backdrop-blur-sm border border-gray-700/30 p-3 rounded-lg shadow-md mb-3 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-4 items-start">
            <div>
                <RACLabel className="block text-xs font-medium text-gray-400 mb-1 flex items-center"> <ShieldCheck size={14} className="mr-1.5 text-orange-400" /> Patch </RACLabel>
                <PatchComboBox value={filters.patch} onChange={onFilterChange} availablePatches={availablePatches} commonInputClass={commonInputClass}/>
            </div>
            <div>
                <RACLabel {...withPlayerLabelProps} className="block text-xs font-medium text-gray-400 mb-1 flex items-center"> <Users size={14} className="mr-1.5 text-orange-400" /> {withPlayerLabelProps.children} </RACLabel>
                <input {...withPlayerInputProps} ref={withPlayerRef} className={commonInputClass} />
            </div>
            <div className="sm:col-span-2 md:col-span-1"> 
                <RACLabel className="block text-xs font-medium text-gray-400 mb-1 flex items-center"> <CalendarDays size={14} className="mr-1.5 text-orange-400" /> Date Range </RACLabel>
                <DateFilterRangePicker value={filters.dateRange} onChange={onFilterChange} commonInputClass={commonInputClass} />
            </div>
            <div className="sm:col-span-2 md:col-span-3 flex flex-col items-start">
                 <RACLabel className="block text-xs font-medium text-gray-400 mb-1">Date Presets</RACLabel>
                <div className="flex flex-wrap gap-1.5">
                    <RACButton onPress={() => onDatePresetFilter('last7days')} className={datePresetButtonClass}>Last 7 Days</RACButton>
                    <RACButton onPress={() => onDatePresetFilter('last30days')} className={datePresetButtonClass}>Last 30 Days</RACButton>
                    <RACButton onPress={() => onDatePresetFilter('thisMonth')} className={datePresetButtonClass}>This Month</RACButton>
                </div></div></div>
          <div className="flex justify-end mt-3">
                <RACButton onPress={onClearFilters}
                    className="bg-gray-600 hover:bg-gray-500 text-white font-medium py-1.5 px-3 rounded-md shadow-sm text-xs flex items-center justify-center transition-colors focus:outline-none data-[focus-visible]:ring-1 data-[focus-visible]:ring-orange-500">
                    <X size={14} className="mr-1" /> Clear All Filters
                </RACButton>
            </div></div>)}

      {isUpdatingAllMatches && updateProgress && (
        <div className="max-w-4xl mx-auto w-full p-2.5 bg-sky-900/50 text-sky-300 border border-gray-700/50 rounded-md text-sm text-center mb-2">
          <p>{updateProgress}</p>
        </div> )}
    </div>);
}

export default MatchHistoryHeader;
