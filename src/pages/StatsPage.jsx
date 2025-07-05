import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { db } from "../dexieConfig";
import { Loader2, AlertTriangle, Percent, Swords, Coins, ChevronsUpDown, Eye, Zap, Target, Users, Shield, TowerControl, ChevronDown, ChevronUp } from "lucide-react";
import Select from "react-select";
import DatePicker from "react-datepicker";
import { subDays } from "date-fns";
import { calculateSummaryStatsForPeriod, getKDAColorClass } from "../utils/matchCalculations";
import { ROLE_ICON_MAP, ROLE_ORDER } from "../pages/MatchHistoryPage";
import RuneDisplay from "../components/common/RuneDisplay";

// --- CSS IMPORTS ---
import "react-datepicker/dist/react-datepicker.css";

const RunesSummaryPanel = ({ runePages, getRuneImage, runesMap, runesDataFromDDragon }) => {
  return (
    <Panel title="Rune Pages" headers={["Games", "WR"]} hasScrollbar>
      <div className="space-y-1 h-full overflow-y-scroll custom-scrollbar pr-1">
        {runePages.map((page) => {
          const [primaryRunesKey, secondaryRunesKey, statShardsKey] = page.key.split("|");

          const primaryRunes = primaryRunesKey.split(",").map((id) => ({ id: id, data: runesMap[id] }));
          const secondaryRunes = secondaryRunesKey.split(",").map((id) => ({ id: id, data: runesMap[id] }));

          return (
            <StatRow key={page.key} games={page.games} winRate={page.winRate}>
              <div className="flex items-center space-x-3">
                {/* Render rune icons directly for the summary list */}
                <div className="flex items-center space-x-1.5">{primaryRunes.map((runeInfo, index) => runeInfo && runeInfo.data && <img key={runeInfo.id + index} src={getRuneImage(runeInfo.id)} title={runeInfo.data.name} className={index === 0 ? "w-8 h-8 rounded-full" : "w-6 h-6"} />)}</div>
                <div className="w-px h-7 bg-gray-700"></div>
                <div className="flex items-center space-x-1.5">{secondaryRunes.map((runeInfo, index) => runeInfo && runeInfo.data && <img key={runeInfo.id + index} src={getRuneImage(runeInfo.id)} title={runeInfo.data.name} className="w-6 h-6" />)}</div>
              </div>
            </StatRow>
          );
        })}
      </div>
    </Panel>
  );
};

const getSkillPriority = (skillOrderString) => {
  if (!skillOrderString) return [];
  const skillCounts = { Q: 0, W: 0, E: 0 };
  const skills = skillOrderString.split(",").slice(0, 9);
  for (const skill of skills) {
    if (skill !== "R") {
      skillCounts[skill]++;
    }
  }
  return Object.entries(skillCounts)
    .sort(([, countA], [, countB]) => countB - countA)
    .map(([skill]) => skill);
};

const getSkillAbilityIconUrl = (championDdragonId, skillChar) => {
  if (!championDdragonId || !skillChar) return null;
  const lowerSkillChar = skillChar.toLowerCase();
  return `https://cdn.communitydragon.org/latest/champion/${championDdragonId}/ability-icon/${lowerSkillChar}`;
};

const SkillIcon = ({ championDdragonId, skillKey }) => {
  const [imgError, setImgError] = useState(false);
  const skillIconUrl = getSkillAbilityIconUrl(championDdragonId, skillKey);

  useEffect(() => {
    setImgError(false);
  }, [championDdragonId, skillKey]);

  if (!skillIconUrl || imgError) {
    return (
      <div className="relative">
        <div className="w-7 h-7 bg-gray-700 rounded-md flex items-center justify-center">
          <span className="text-white font-bold">{skillKey}</span>
        </div>
        <span className="absolute -bottom-1 -right-1 text-[9px] bg-gray-900 px-1 py-0 rounded-sm font-mono border border-gray-600 leading-none">{skillKey}</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <img src={skillIconUrl} alt={skillKey} className="w-7 h-7 rounded-md object-contain" onError={() => setImgError(true)} />
      <span className="absolute -bottom-1 -right-1 text-[9px] bg-gray-900 px-1 py-0 rounded-sm font-mono border border-gray-600 leading-none">{skillKey}</span>
    </div>
  );
};

const SkillPathPanel = ({ details, championInfo }) => {
  if (!details) {
    return (
      <div className="bg-gray-800/50 rounded-md p-2 mt-4">
        <div className="bg-gray-900/40 p-3 rounded-md text-center">
          <p className="text-gray-500 text-sm italic">No skill path data available.</p>
        </div>
      </div>
    );
  }

  const { key, games, winRate } = details;
  const skillPriority = getSkillPriority(key);
  const fullSkillOrder = key.split(",").slice(0, 11);
  const championDdragonId = championInfo?.id;

  const SKILL_COLORS = {
    Q: "text-blue-400",
    W: "text-orange-400",
    E: "text-purple-400",
    R: "text-red-400",
  };

  return (
    <div className="bg-gray-800/50 rounded-md p-2">
      <div className="flex justify-between items-center text-gray-400 text-[10px] font-bold uppercase px-2 pb-0.5">
        <span>Skill Path</span>
        <div className="flex">
          <span className="w-20 text-center">Games</span>
          <span className="w-20 text-center">WR</span>
        </div>
      </div>
      <div className="bg-gray-900/40 p-2 rounded-md flex items-center justify-between">
        <div className="flex items-center gap-x-4">
          <div className="flex items-center gap-x-2">
            {skillPriority.map((skill, index) => (
              <React.Fragment key={index}>
                <SkillIcon championDdragonId={championDdragonId} skillKey={skill} />
                {index < skillPriority.length - 1 && <span className="text-gray-500 font-semibold">&gt;</span>}
              </React.Fragment>
            ))}
          </div>

          <div className="flex items-center gap-x-1">
            {fullSkillOrder.map((skill, index) => (
              <div key={index} className={`w-6 h-6 bg-gray-800/80 rounded-sm flex font-semibold items-center justify-center ${SKILL_COLORS[skill] || "text-gray-400"} text-xs`}>
                {skill}
              </div>
            ))}
          </div>
        </div>

        <div className="flex text-sm">
          <p className="w-20 text-center text-gray-200">{games.toLocaleString()}</p>
          <p className={`w-20 text-center font-bold ${winRate >= 50 ? "text-green-400" : "text-red-400"}`}>{Math.round(winRate)}%</p>
        </div>
      </div>
    </div>
  );
};

// region: --- Filter Components ---
const RoleFilter = ({ selectedRole, onRoleChange, ROLE_ICON_MAP, ROLE_ORDER }) => (
  <div className="flex items-center bg-gray-700/80 border border-gray-600 rounded-l-md shadow-sm h-9 px-1.5">
    {ROLE_ORDER.map((roleKey) => {
      const iconSrc = ROLE_ICON_MAP[roleKey];
      const isActive = selectedRole === roleKey;
      return (
        <button key={roleKey} type="button" onClick={() => onRoleChange(isActive ? "" : roleKey)} title={`Filter by ${roleKey}`} className={`p-1 rounded-sm transition-all ${isActive ? "bg-white/20 scale-105" : "hover:bg-gray-600/70 opacity-70 hover:opacity-100"}`}>
          {iconSrc && <img src={iconSrc} alt={roleKey} className="w-5 h-5" />}
        </button>
      );
    })}
  </div>
);

const PatchFilter = ({ selectedPatches, availablePatches, onPatchChange }) => {
  const patchOptions = useMemo(() => availablePatches.map((p) => ({ value: p, label: p })), [availablePatches]);
  const selectedValues = useMemo(() => selectedPatches.map((p) => ({ value: p, label: p })), [selectedPatches]);

  const selectStyles = {
    control: (p, s) => ({ ...p, backgroundColor: "#2d3748", border: "1px solid #4a5563", borderRadius: "0", minHeight: "36px", height: "36px", borderLeft: "none", opacity: s.isDisabled ? 0.6 : 1, boxShadow: "none" }),
    valueContainer: (p) => ({ ...p, padding: "0px 8px", height: "36px" }),
    input: (p) => ({ ...p, color: "#e2e8f0" }),
    placeholder: (p) => ({ ...p, color: "#a0aec0", fontSize: "0.75rem" }),
    multiValue: (p) => ({ ...p, backgroundColor: "#dd6b20" }),
    multiValueLabel: (p) => ({ ...p, color: "white", fontSize: "0.75rem" }),
    menu: (p) => ({ ...p, backgroundColor: "#2d3748", zIndex: 20 }),
    option: (p, s) => ({ ...p, backgroundColor: s.isSelected ? "#dd6b20" : s.isFocused ? "rgba(237, 137, 54, 0.2)" : "transparent", fontSize: "0.8rem" }),
    indicatorSeparator: () => ({ display: "none" }),
  };

  return (
    <div className="w-full sm:w-56 h-9">
      <Select isMulti options={patchOptions} value={selectedValues} onChange={(opts) => onPatchChange(opts ? opts.map((o) => o.value) : [])} styles={selectStyles} placeholder={availablePatches.length > 0 ? "Filter by Patch..." : "No patches found"} isDisabled={availablePatches.length === 0} />
    </div>
  );
};

const ChampionFilters = ({ filters, onFilterChange, onDatePresetChange, availablePatches, ROLE_ICON_MAP, ROLE_ORDER }) => {
  const handleRoleFilterChange = (roleValue) => onFilterChange({ role: roleValue, activePreset: null });
  const handlePatchChange = (patchValues) => onFilterChange({ patch: patchValues, activePreset: null });

  const handleDateChange = (dates) => {
    const [start, end] = dates || [null, null];
    onFilterChange({ dateRange: { startDate: start, endDate: end }, activePreset: null });
  };

  const presetButtonBaseClass = "px-3 py-1.5 bg-gray-700/60 hover:bg-gray-700 border border-transparent text-gray-300 text-xs font-semibold rounded-md";
  const presetButtonActiveClass = "bg-orange-600/80 text-white border-orange-500/50 hover:bg-orange-600";

  return (
    <div className="flex justify-end items-center flex-shrink-0 gap-x-1">
      <div className="flex items-center shadow-sm">
        <RoleFilter selectedRole={filters.role} onRoleChange={handleRoleFilterChange} ROLE_ICON_MAP={ROLE_ICON_MAP} ROLE_ORDER={ROLE_ORDER} />
        <PatchFilter selectedPatches={filters.patch} availablePatches={availablePatches} onPatchChange={handlePatchChange} />
        <DatePicker selectsRange startDate={filters.dateRange.startDate} endDate={filters.dateRange.endDate} onChange={handleDateChange} isClearable placeholderText="Filter by date..." dateFormat="yyyy/MM/dd" popperPlacement="bottom-end" className="bg-gray-700/80 border-y border-r border-gray-600 text-gray-200 placeholder-gray-400 text-xs px-2.5 focus:border-orange-500 h-9 w-full rounded-r-md" wrapperClassName="w-48" calendarClassName="react-datepicker-dark" />
      </div>

      <div className="flex items-center gap-x-1">
        <button onClick={() => onDatePresetChange("last7days")} className={`${presetButtonBaseClass} ${filters.activePreset === "last7days" ? presetButtonActiveClass : ""}`}>
          Last 7 Days
        </button>
        <button onClick={() => onDatePresetChange("last30days")} className={`${presetButtonBaseClass} ${filters.activePreset === "last30days" ? presetButtonActiveClass : ""}`}>
          Last 30 Days
        </button>
      </div>
    </div>
  );
};
// endregion

// region: --- Core UI Components ---
const MicroStatCard = ({ title, value, previousValue, icon, format = "number", higherIsBetter = true }) => {
  const formatValue = (val) => {
    if (val === "N/A" || typeof val !== "number") return "N/A";
    if (format === "percent") return `${val.toFixed(1)}%`;
    if (format === "decimal1") return val.toFixed(1);
    if (format === "decimal2") return val.toFixed(2);
    if (format === "diff") return `${val > 0 ? "+" : ""}${Math.round(val)}`;
    return Math.round(val).toLocaleString();
  };
  const percentChange = useMemo(() => {
    if (typeof value !== "number" || typeof previousValue !== "number" || previousValue === 0) {
      return null;
    }
    return ((value - previousValue) / Math.abs(previousValue)) * 100;
  }, [value, previousValue]);
  let trendIndicator = null;
  if (percentChange !== null && percentChange !== 0) {
    const isImprovement = higherIsBetter ? percentChange > 0 : percentChange < 0;
    const trendIcon = isImprovement ? "▲" : "▼";
    const trendColor = isImprovement ? "text-green-500" : "text-red-500";
    trendIndicator = (
      <div className={`flex items-center font-semibold ${trendColor}`}>
        <span>{trendIcon}</span>
        <span className="ml-0.5 text-[10px]">{Math.abs(percentChange).toFixed(0)}%</span>
      </div>
    );
  }
  return (
    <div className="bg-gray-800/50 p-2 rounded-lg border border-gray-700/60 flex items-center space-x-2">
      <div className="flex-shrink-0 text-gray-400">{icon}</div>
      <div className="flex-1 overflow-hidden">
        <p className="text-xs text-gray-400 truncate" title={title}>
          {title}
        </p>
        <div className="flex items-baseline space-x-1.5">
          <p className="text-base font-bold text-white">{formatValue(value)}</p>
          {trendIndicator}
        </div>
      </div>
    </div>
  );
};

const PerformanceStats = ({ stats }) => {
  const overviewStats = stats.current
    ? [
        { title: "Win Rate", key: "winRate", value: stats.current.winRate, icon: <Percent size={16} />, format: "percent" },
        { title: "KDA Ratio", key: "kdaRatio", value: stats.current.kdaRatio, icon: <Target size={16} />, format: "decimal1" },
        { title: "KP%", key: "killParticipation", value: stats.current.killParticipation, icon: <Users size={16} />, format: "percent" },
        { title: "DPM", key: "damagePerMin", value: stats.current.damagePerMin, icon: <Zap size={16} />, format: "number" },
        { title: "GPM", key: "goldPerMin", value: stats.current.goldPerMin, icon: <Coins size={16} />, format: "number" },
        { title: "CSPM", key: "csPerMin", value: stats.current.csPerMin, icon: <Swords size={16} />, format: "decimal1" },
        { title: "VSPM", key: "visionPerMin", value: stats.current.visionPerMin, icon: <Eye size={16} />, format: "decimal1" },
        { title: "Dmg % Team", key: "damagePercentOfTeam", value: stats.current.damagePercentOfTeam, icon: <Zap size={16} />, format: "percent" },
        { title: "Gold Diff @ 14", key: "goldDiff14", value: stats.current.goldDiff14, icon: <Coins size={16} />, format: "diff" },
        { title: "CS Diff @ 14", key: "csDiff14", value: stats.current.csDiff14, icon: <Swords size={16} />, format: "diff" },
        { title: "Dmg Diff @ 14", value: stats.current.damageDiff14, icon: <Zap size={16} />, format: "diff" },
        { title: "KP Diff", key: "avgKpDiff", value: stats.current.avgKpDiff, icon: <Swords size={16} />, format: "diff" },
        { title: "Dmg/Gold", key: "damagePerGold", value: stats.current.damagePerGold, icon: <Zap size={16} />, format: "decimal2" },
        { title: "Wards Placed", key: "avgWardsPlaced", value: stats.current.avgWardsPlaced, icon: <Eye size={16} />, format: "decimal1" },
        { title: "Wards Killed", key: "avgWardsKilled", value: stats.current.avgWardsKilled, icon: <Shield size={16} />, format: "decimal1" },
        { title: "Dmg to Towers", key: "avgDmgToTowers", value: stats.current.avgDmgToTowers, icon: <TowerControl size={16} />, format: "number" },
      ]
    : [];
  if (!stats.current || stats.current.totalGames === 0) {
    return <div className="col-span-full text-gray-400 text-sm h-full flex items-center justify-center p-4">No data for this period.</div>;
  }
  return (
    <div className="grid grid-cols-4 sm:grid-cols-8 grid-rows-2 gap-2">
      {overviewStats.map((stat) => (
        <MicroStatCard key={stat.title} {...stat} previousValue={stats.previous ? stats.previous[stat.key] : null} />
      ))}
    </div>
  );
};
const ActivityCalendar = ({ matches }) => {
  const gamesByDate = useMemo(() => {
    return matches.reduce((acc, match) => {
      const date = new Date(match.gameCreation).toISOString().split("T")[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});
  }, [matches]);
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const startDate = new Date(year, month, 1);
  const getColor = (count) => {
    if (count === 0) return "bg-gray-700/40";
    if (count <= 2) return "bg-emerald-800";
    if (count <= 4) return "bg-emerald-700";
    if (count <= 6) return "bg-emerald-600";
    return "bg-emerald-500";
  };
  const calendarCells = [];
  const dayOffset = startDate.getDay() === 0 ? 6 : startDate.getDay() - 1;
  for (let i = 0; i < dayOffset; i++) {
    calendarCells.push(<div key={`empty-start-${i}`} />);
  }
  for (let day = 1; day <= new Date(year, month + 1, 0).getDate(); day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const gamesCount = gamesByDate[dateStr] || 0;
    calendarCells.push(<div key={`day-${day}`} className={`${getColor(gamesCount)} rounded-[3px]`} title={`${gamesCount} games on ${dateStr}`} />);
  }
  while (calendarCells.length < 42) {
    calendarCells.push(<div key={`empty-end-${calendarCells.length}`} />);
  }
  return (
    <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/60 h-full flex flex-col">
      <p className="text-sm font-semibold text-gray-200 mb-2 flex-shrink-0">{startDate.toLocaleString("default", { month: "long" })} Activity</p>
      <div className="grid grid-cols-7 grid-rows-6 gap-1 flex-grow">{calendarCells}</div>
    </div>
  );
};

const formatDiff = (value) => {
  if (typeof value !== "number" || isNaN(value)) return "N/A";
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded}`;
};

const formatNumber = (value) => {
  if (typeof value !== "number" || isNaN(value)) return "0";
  const fixed = value.toFixed(1);
  return fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed;
};

const getKDAStringHTML = (kills, deaths, assists) => {
  const f = (n) => formatNumber(n || 0);
  return `<span class="text-gray-400 text-[10px]">
            <span class="font-semibold text-gray-100">${f(kills)}</span> / <span class="font-semibold text-red-400">${f(deaths)}</span> / <span class="font-semibold text-gray-100">${f(assists)}</span>
          </span>`;
};

// Centralized configuration for all statistic columns to ensure perfect alignment
const STATS_COLUMNS = [
  { header: "WR%", width: "w-[7%]", getValue: (s) => [{ value: `${Math.round(s.winRate || 0)}%`, color: (s.winRate || 0) >= 50 ? "text-green-400" : "text-red-400" }] },
  {
    header: "KDA",
    width: "w-[10%]",
    getValue: (s) => {
      const kdaRatio = s.kdaRatio;
      const kdaDisplay = kdaRatio === "Perfect" ? "Perfect" : (kdaRatio || 0).toFixed(2);
      const kdaColorClass = getKDAColorClass(s.avgKills, s.avgDeaths, s.avgAssists);

      return [
        {
          value: `${kdaDisplay} <span class="ml-0.5 text-gray-400 text-[10px] font-normal">KDA</span>`,
          color: kdaColorClass,
        },
        {
          value: getKDAStringHTML(s.avgKills, s.avgDeaths, s.avgAssists),
        },
      ];
    },
  },
  { header: "KP%", width: "w-[7%]", getValue: (s) => [{ value: `${formatNumber(s.killParticipation || 0)}%` }, { value: `<span class="text-gray-400 text-[10px]">${formatDiff(s.avgKpDiff || 0)}</span>` }] },
  { header: "DMG/DPM", width: "w-[11%]", getValue: (s) => [{ value: `${((s.avgDamageDealt || 0) / 1000).toFixed(1)}k <span class="ml-0.5 text-gray-400 text-[10px] font-normal">(${formatNumber(s.damagePercentOfTeam || 0)}%)</span>` }, { value: `<span class="text-gray-400 text-[10px]">${Math.round(s.damagePerMin || 0)}/min</span>` }] },
  { header: "DPMD@14", width: "w-[6%]", getValue: (s) => [{ value: formatDiff(s.damageDiff14 || 0) }] },
  { header: "TD", width: "w-[6%]", getValue: (s) => [{ value: Math.round(s.avgDmgToTowers || 0).toLocaleString() }] },
  { header: "DMG/G", width: "w-[6%]", getValue: (s) => [{ value: (s.damagePerGold || 0).toFixed(2) }] },
  { header: "CS", width: "w-[6%]", getValue: (s) => [{ value: formatNumber(s.avgCs || 0) }, { value: `<span class="text-gray-400 text-[10px]">${formatNumber(s.csPerMin || 0)}/min</span>` }] },
  { header: "CSD@14", width: "w-[6%]", getValue: (s) => [{ value: formatDiff(s.csDiff14 || 0) }] },
  { header: "GOLD", width: "w-[6%]", getValue: (s) => [{ value: Math.round(s.avgGold || 0).toLocaleString() }, { value: `<span class="text-gray-400 text-[10px]">${Math.round(s.goldPerMin || 0)}/min</span>` }] },
  { header: "GD@14", width: "w-[6%]", getValue: (s) => [{ value: formatDiff(s.goldDiff14 || 0) }] },
  { header: "VISION", width: "w-[10%]", getValue: (s) => [{ value: Math.round(s.avgVisionScore || 0) }, { value: `<span class="text-gray-400 text-[10px]">${Math.round(s.avgControlWardsBought || 0)} (${Math.round(s.avgWardsPlaced || 0)}/${Math.round(s.avgWardsKilled || 0)})</span>` }] },
];
const ChampionStatDisplay = ({ items = [], className }) => (
  <div className={`flex flex-col justify-center px-1 ${className}`}>
    {items.map((item, i) => (
      <p key={i} className={`font-bold text-[0.7rem] leading-tight text-center ${item.color || "text-white"}`} dangerouslySetInnerHTML={{ __html: item.value }} />
    ))}
  </div>
);

const ChampionList = ({ champions, onChampionClick, onMatchupSelect, getChampionImage, getChampionDisplayName, selectedMatchup, selectedChampion, expandedChampion }) => {
  return (
    <div className="bg-gray-800/30 rounded-lg flex flex-col h-full">
      <div className="flex-shrink-0">
        <div className="flex items-center px-7 py-1 text-[0.7rem] font-semibold text-gray-400 bg-gray-900/50 rounded-t-lg flex-shrink-0">
          <div className="w-[14%]">CHAMPION</div>
          {STATS_COLUMNS.map((col) => (
            <div key={col.header} className={`${col.width} text-center`}>
              {col.header}
            </div>
          ))}
          <div className="w-8 ml-auto" />
        </div>
      </div>
      <div className="overflow-y-auto flex-grow custom-scrollbar">
        <div className="space-y-1 p-2">
          {champions.map((champ) => (
            <ChampionListItem key={champ.championName} champion={champ} isSelected={selectedChampion?.championName === champ.championName} isExpanded={expandedChampion === champ.championName} onClick={() => onChampionClick(champ)} onMatchupSelect={onMatchupSelect} getChampionImage={getChampionImage} getChampionDisplayName={getChampionDisplayName} selectedMatchup={selectedMatchup} />
          ))}
        </div>
      </div>
    </div>
  );
};

const ChampionListItem = ({ champion, isSelected, isExpanded, onClick, onMatchupSelect, getChampionImage, getChampionDisplayName, selectedMatchup }) => {
  const { championName, gamesPlayed, stats, matchups } = champion;

  const getItemClasses = () => {
    if (isSelected && isExpanded) {
      return "bg-orange-500/20";
    }
    if (isSelected) {
      return "bg-orange-500/10 hover:bg-orange-500/20";
    }
    return "bg-gray-800/60 hover:bg-gray-700/60";
  };

  return (
    <div className={`rounded-md ${getItemClasses()}`}>
      <div className={`flex items-center ml-2 px-2 py-2 cursor-pointer border border-transparent ${isSelected ? "border-orange-500/50" : ""}`} onClick={onClick}>
        <div className="w-[14%] flex items-center space-x-2">
          <img src={getChampionImage(championName)} alt={getChampionDisplayName(championName)} className="w-10 h-10 rounded-md" />
          <div>
            <p className="text-sm font-bold text-white truncate">{getChampionDisplayName(championName)}</p>
            <p className="text-[10px] text-gray-400">{gamesPlayed} games</p>
          </div>
        </div>
        {STATS_COLUMNS.map((col) => (
          <ChampionStatDisplay key={col.header} className={col.width} items={col.getValue(stats)} />
        ))}
        <div className="w-8 ml-auto text-gray-400 pl-2">{isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</div>
      </div>
      {isExpanded && <MatchupList matchups={matchups} onMatchupSelect={onMatchupSelect} getChampionImage={getChampionImage} getChampionDisplayName={getChampionDisplayName} selectedMatchup={selectedMatchup} />}
    </div>
  );
};

const MatchupList = ({ matchups, onMatchupSelect, getChampionImage, getChampionDisplayName, selectedMatchup }) => {
  const [visibleCount, setVisibleCount] = useState(5);

  useEffect(() => {
    setVisibleCount(5);
  }, [matchups]);

  if (matchups.length === 0) {
    return (
      <div className="p-2 border-t border-gray-700/50">
        <p className="text-xs text-center text-gray-500 italic py-1">No specific matchup data available.</p>
      </div>
    );
  }

  const handleShowMore = () => {
    setVisibleCount((currentCount) => currentCount + 5);
  };

  const visibleMatchups = matchups.slice(0, visibleCount);

  return (
    <div className="p-1 border-t border-gray-700/50 space-y-1">
      {visibleMatchups.map((m) => (
        <MatchupListItem key={m.opponentChampionName} matchupData={m} onSelect={() => onMatchupSelect(m)} getChampionImage={getChampionImage} getChampionDisplayName={getChampionDisplayName} isSelected={selectedMatchup?.opponentChampionName === m.opponentChampionName} />
      ))}
      {matchups.length > visibleCount && (
        <div className="pt-1">
          <button onClick={handleShowMore} className="w-full text-center py-1.5 px-3 bg-gray-700/60 hover:bg-gray-700 text-gray-300 text-xs font-semibold rounded-md">
            Show More
          </button>
        </div>
      )}
    </div>
  );
};

const MatchupListItem = ({ matchupData, onSelect, getChampionImage, getChampionDisplayName, isSelected }) => {
  const { opponentChampionName, gamesPlayed, stats } = matchupData;
  return (
    <div className={`flex items-center py-1.5 px-1.5 rounded-md cursor-pointer ${isSelected ? "bg-orange-900/60 ring-1 ring-orange-500" : "bg-gray-900/50 hover:bg-gray-900"}`} onClick={onSelect}>
      <div className="w-[15%] flex items-center">
        <p className="w-8 text-center text-xs font-semibold text-gray-400 flex-shrink-0">VS</p>
        <img src={getChampionImage(opponentChampionName)} alt={getChampionDisplayName(opponentChampionName)} className="w-8 h-8 rounded ml-1" />
        <div className="ml-2 flex-grow min-w-0">
          <p className="font-semibold text-[0.8rem] text-gray-200 truncate">{getChampionDisplayName(opponentChampionName)}</p>
          <p className="text-[9px] text-gray-400">{gamesPlayed} games</p>
        </div>
      </div>
      {STATS_COLUMNS.map((col) => (
        <ChampionStatDisplay key={col.header} className={col.width} items={col.getValue(stats)} />
      ))}
      <div className="w-8 ml-auto" />
    </div>
  );
};

const ChampionDetailView = ({ championName, matches, stats, getChampionImage, getChampionDisplayName, ddragonVersion, itemData, runesMap, ddragonChampions, runesDataFromDDragon, getRuneImage, getItemImage, summonerSpellsMap }) => {
  const [selectedRuneCoreKey, setSelectedRuneCoreKey] = useState("summary");
  const [selectedItemBuildTab, setSelectedItemBuildTab] = useState(3);

  useEffect(() => {
    setSelectedRuneCoreKey("summary");
    setSelectedItemBuildTab(3);
  }, [matches]);

  const championInfo = useMemo(() => {
    if (!ddragonChampions || !championName) return null;
    return Object.values(ddragonChampions).find((c) => c.name === championName) || ddragonChampions[championName];
  }, [championName, ddragonChampions]);

  const details = useMemo(() => {
    if (!matches || matches.length === 0 || !itemData || !runesMap || Object.keys(runesMap).length === 0) {
      return null;
    }

    const getStartingItemsFromEvents = (match) => {
      const buildOrder = match.processedTimelineForTrackedPlayer?.buildOrder;
      if (!buildOrder) return null;

      const firstPurchase = buildOrder.find((e) => e.type === "purchased");
      if (!firstPurchase) return null;

      const buyWindowEndTime = firstPurchase.timestamp + 20000;
      const purchasesInWindow = buildOrder.filter((e) => e.type === "purchased" && e.timestamp <= buyWindowEndTime);

      const candidateIds = [...new Set(purchasesInWindow.map((p) => p.itemId))];
      if (candidateIds.length === 0) return null;

      const STARTING_GOLD_LIMIT = 550;
      let bestCombination = [];
      let bestGoldValue = 0;

      const numCandidates = candidateIds.length;
      for (let i = 0; i < 1 << numCandidates; i++) {
        let currentCombination = [];
        let currentGoldValue = 0;
        let hasHealthPotion = false;
        let hasRefillablePotion = false;

        for (let j = 0; j < numCandidates; j++) {
          if ((i & (1 << j)) > 0) {
            const itemId = candidateIds[j];
            const item = itemData[itemId];
            if (item) {
              currentCombination.push(itemId);
              currentGoldValue += item.gold.base;
              if (itemId === 2003) hasHealthPotion = true;
              if (itemId === 2031) hasRefillablePotion = true;
            }
          }
        }

        const isOverGoldLimit = currentGoldValue > STARTING_GOLD_LIMIT;
        const hasBothPotions = hasHealthPotion && hasRefillablePotion;

        if (!isOverGoldLimit && !hasBothPotions) {
          if (currentGoldValue > bestGoldValue) {
            bestGoldValue = currentGoldValue;
            bestCombination = currentCombination;
          }
        }
      }

      if (bestCombination.length === 0) return null;

      const finalItems = bestCombination.filter((id) => {
        const item = itemData[id];
        return item && item.inStore !== false && !item.tags?.includes("Trinket");
      });

      return finalItems.sort().join(",");
    };

    const getFirstLegendaryItem = (match) => {
      const buildOrder = match.processedTimelineForTrackedPlayer?.buildOrder;
      if (!buildOrder || !itemData) return null;
      const BOOT_IDS = new Set(Object.keys(itemData).filter((id) => itemData[id].tags?.includes("Boots")));
      for (const event of buildOrder) {
        if (event.type === "purchased") {
          const item = itemData[event.itemId];
          if (item && item.gold.total >= 2200 && !BOOT_IDS.has(String(event.itemId)) && !item.tags?.includes("Trinket") && !item.tags?.includes("Consumable")) {
            return event.itemId;
          }
        }
      }
      return null;
    };

    const groupAndCalcStats = (collection, keyFunc, dpmFunc = null) => {
      const groups = collection.reduce((acc, item) => {
        const keyOrKeyInfo = keyFunc(item); // This can be a string or { key, perksObject }

        let key;
        let perksObject;

        if (typeof keyOrKeyInfo === "object" && keyOrKeyInfo !== null && "key" in keyOrKeyInfo) {
          key = keyOrKeyInfo.key;
          perksObject = keyOrKeyInfo.perksObject;
        } else {
          key = keyOrKeyInfo;
        }

        if (key === null || key === undefined || key === "") return acc;

        if (!acc[key]) {
          acc[key] = { games: 0, wins: 0, dpms: [] };
          if (perksObject) {
            acc[key].perksObject = perksObject; // Store the full perks object here if provided
          }
        }

        acc[key].games++;
        if (item.win) acc[key].wins++;
        if (dpmFunc) {
          const player = item.allParticipants.find((p) => p.puuid === item.puuid);
          if (player) {
            const dpm = player.totalDamageDealtToChampions / (item.gameDuration / 60);
            acc[key].dpms.push(dpm);
          }
        }
        return acc;
      }, {});

      return Object.entries(groups)
        .map(([key, data]) => {
          const result = { key, games: data.games, winRate: (data.wins / data.games) * 100 };
          if (data.perksObject) result.perksObject = data.perksObject; // Ensure perksObject is passed through
          if (dpmFunc) {
            result.dpm = data.dpms.length > 0 ? data.dpms.reduce((a, b) => a + b, 0) / data.dpms.length : 0;
          }
          return result;
        })
        .sort((a, b) => b.games - a.games);
    };

    // runeCores: keyFunc returns a string (keystoneId|firstLegendary)
    const runeCores = groupAndCalcStats(matches, (match) => {
      const primaryStyle = match.perks.styles?.find((s) => s.description === "primaryStyle");
      if (!primaryStyle) return null;
      const keystoneId = primaryStyle.selections[0]?.perk;
      const firstLegendary = getFirstLegendaryItem(match);
      if (!keystoneId || !firstLegendary) return null;
      return `${keystoneId}|${firstLegendary}`;
    });

    const selectedMatches =
      selectedRuneCoreKey === "summary"
        ? matches
        : matches.filter((match) => {
            const primaryStyle = match.perks.styles?.find((s) => s.description === "primaryStyle");
            if (!primaryStyle) return false;
            const keystoneId = primaryStyle.selections[0]?.perk;
            const firstLegendary = getFirstLegendaryItem(match);
            return `${keystoneId}|${firstLegendary}` === selectedRuneCoreKey;
          });

    if (selectedMatches.length === 0) return { runeCores, filteredDetails: null };

    const calcFilteredDetails = (matches) => {
      // fullRunes: keyFunc returns { key: string, perksObject: object }
      const fullRunes = groupAndCalcStats(matches, (m) => {
        const perks = m.perks;
        if (!perks?.styles || perks.styles.length < 2 || !perks.statPerks) return null;
        const statPerksInOrder = [perks.statPerks.offense, perks.statPerks.flex, perks.statPerks.defense];
        return {
          key: `${perks.styles[0].selections.map((s) => s.perk).join(",")}|${perks.styles[1].selections.map((s) => s.perk).join(",")}|${statPerksInOrder.join(",")}`,
          perksObject: perks, // Pass the full perks object here
        };
      });
      const spells = groupAndCalcStats(matches, (m) => [m.summoner1Id, m.summoner2Id].sort().join(","));
      const startingItems = groupAndCalcStats(matches, getStartingItemsFromEvents);
      const BOOT_IDS = new Set(Object.keys(itemData).filter((id) => itemData[id].tags?.includes("Boots")));
      const boots = groupAndCalcStats(matches, (m) => {
        for (let i = 0; i <= 6; i++) if (BOOT_IDS.has(String(m[`item${i}`]))) return m[`item${i}`];
        return null;
      });
      const skillPaths = groupAndCalcStats(
        matches,
        (m) =>
          (m.processedTimelineForTrackedPlayer?.skillOrder || [])
            .slice(0, 11)
            .map((s) => "QWER"[s.skillSlot - 1])
            .join(",") || null
      );
      const getCoreItemsInOrder = (match) => {
        const buildOrder = match.processedTimelineForTrackedPlayer?.buildOrder;
        if (!buildOrder || !itemData) return [];
        const coreItems = [];
        const itemSet = new Set();
        for (const event of buildOrder) {
          if (event.type === "purchased") {
            const itemId = String(event.itemId);
            const item = itemData[itemId];
            if (item && item.gold.total >= 2200 && !BOOT_IDS.has(itemId) && !item.tags?.includes("Trinket") && !item.tags?.includes("Consumable") && !itemSet.has(itemId)) {
              coreItems.push(itemId);
              itemSet.add(itemId);
            }
          }
        }
        return coreItems;
      };
      const itemBuilds = {};
      for (let i = 2; i <= 5; i++) {
        itemBuilds[i] = groupAndCalcStats(
          matches,
          (m) => {
            const orderedCoreItems = getCoreItemsInOrder(m);
            if (orderedCoreItems.length < i) return null;
            return orderedCoreItems.slice(0, i).join(",");
          },
          true
        );
      }
      return { fullRunes, spells: spells.slice(0, 2), startingItems: startingItems.slice(0, 2), boots: boots.slice(0, 2), skillPaths: skillPaths.slice(0, 1), itemBuilds };
    };

    return { runeCores, filteredDetails: calcFilteredDetails(selectedMatches) };
  }, [matches, selectedRuneCoreKey, itemData, runesMap]);

  if (!matches) {
    return (
      <div className="flex items-center justify-center h-full text-center p-4 bg-gray-800/30 rounded-lg">
        <p className="text-gray-400">Click a champion on the left to see detailed stats.</p>
      </div>
    );
  }
  if (!details) {
    return (
      <div className="flex items-center justify-center h-full text-center p-4 bg-gray-800/30 rounded-lg">
        <p className="text-gray-400">Not enough data for {getChampionDisplayName(championName)} with the current filters.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/30 rounded-lg h-full p-1 flex gap-0.5">
      <div className="w-1/5 bg-gray-900/40 rounded-md p-2 flex flex-col">
        <div className="flex items-center text-gray-400 text-[9px] font-bold uppercase px-1 pb-1">
          <span className="w-6/12">RUNE-ITEM</span>
          <span className="w-3/12 text-center">Games</span>
          <span className="w-3/12 text-center">WR</span>
        </div>
        <div className="space-y-1 overflow-y-auto custom-scrollbar">
          <RuneCoreRow runeCore={{ key: "summary", games: matches.length, winRate: stats.winRate }} isSelected={selectedRuneCoreKey === "summary"} onClick={() => setSelectedRuneCoreKey("summary")} getRuneImage={getRuneImage} getItemImage={getItemImage} />
          {details.runeCores.map((core) => (
            <RuneCoreRow key={core.key} runeCore={core} isSelected={selectedRuneCoreKey === core.key} onClick={() => setSelectedRuneCoreKey(core.key)} getRuneImage={getRuneImage} getItemImage={getItemImage} />
          ))}
        </div>
      </div>
      <div className="w-4/5 bg-gray-900/40 rounded-md p-0.5 overflow-y-auto custom-scrollbar">
        {!details.filteredDetails ? (
          <div className="flex items-center justify-center h-full text-center">
            <p className="text-gray-500">No data for this rune combination.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 h-[340px] flex flex-col">
                {selectedRuneCoreKey === "summary" ? (
                  <RunesSummaryPanel runePages={details.filteredDetails.fullRunes} getRuneImage={getRuneImage} runesMap={runesMap} runesDataFromDDragon={runesDataFromDDragon} />
                ) : details.filteredDetails.fullRunes && details.filteredDetails.fullRunes.length > 0 ? (
                  // Display full RuneDisplay for selected Rune-Item combination
                  <div className="bg-gray-800/50 rounded-md p-2 flex flex-col h-full items-center justify-center">
                    {/* REMOVE PANEL HEADER HERE */}
                    {/* <PanelHeader>
                      <span className="flex-1">Full Rune Page</span>
                      <span className="w-10 text-right">Games</span>
                      <span className="w-10 text-right">WR</span>
                    </PanelHeader> */}
                    <RuneDisplay
                      perks={details.filteredDetails.fullRunes[0].perksObject} // Pass the full perks object
                      runesDataFromDDragon={runesDataFromDDragon}
                      runesMap={runesMap}
                      getRuneImage={getRuneImage}
                      layout="full"
                      size="lg"
                    />
                    <div className="text-right text-xs mt-4">
                      <p className="text-gray-200">{details.filteredDetails.fullRunes[0].games} Games</p>
                      <p className={`font-bold ${details.filteredDetails.fullRunes[0].winRate >= 50 ? "text-green-400" : "text-red-400"}`}>{details.filteredDetails.fullRunes[0].winRate.toFixed(0)}% WR</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 text-center text-gray-500">No complete rune page data found for this specific rune-item core.</div>
                )}
              </div>

              <div className="lg:col-span-1 h-[340px] flex flex-col space-y-2">
                <SpellsPanel details={details.filteredDetails.spells} ddragonVersion={ddragonVersion} summonerSpellsMap={summonerSpellsMap} />
                <StartingItemsPanel details={details.filteredDetails.startingItems} getItemImage={getItemImage} />
                <BootsPanel details={details.filteredDetails.boots} getItemImage={getItemImage} />
              </div>
            </div>

            <SkillPathPanel details={details.filteredDetails.skillPaths[0]} championInfo={championInfo} />

            <ItemBuildsPanel details={details.filteredDetails.itemBuilds} selectedTab={selectedItemBuildTab} onTabClick={setSelectedItemBuildTab} getItemImage={getItemImage} />
          </div>
        )}
      </div>
    </div>
  );
};

// --- ALL HELPER COMPONENTS ---

const RuneCoreRow = ({ runeCore, isSelected, onClick, getRuneImage, getItemImage }) => {
  const isSummary = runeCore.key === "summary";
  const [keystoneId, firstItemId] = isSummary ? [null, null] : runeCore.key.split("|");
  return (
    <div onClick={onClick} className={`flex items-center p-0.5 rounded-md cursor-pointer ${isSelected ? "bg-orange-500/20" : "hover:bg-gray-700/50"}`}>
      <div className="flex items-center space-x-1 w-2/3">
        {isSummary ? (
          <div className="w-7 h-7 flex items-center justify-center bg-gray-700 rounded-full text-green-400 font-bold">Σ</div>
        ) : (
          <>
            <img src={getRuneImage(keystoneId)} alt="Keystone" className="w-7 h-7 rounded-full" />
            <img src={getItemImage(firstItemId)} alt="First Item" className="w-7 h-7 rounded-md" />
          </>
        )}
      </div>
      <p className="w-1/3 text-center text-xs text-gray-300">{runeCore.games}</p>
      <p className={`w-1/3 text-center text-xs font-bold ${runeCore.winRate >= 50 ? "text-green-400" : "text-red-400"}`}>{`${runeCore.winRate.toFixed(0)}%`}</p>
    </div>
  );
};

const PanelHeader = ({ children }) => <div className="flex items-center text-gray-400 text-[10px] font-bold uppercase px-1 pb-1 border-b border-gray-700/50 mb-1">{children}</div>;
const Panel = ({ title, children, headers, hasScrollbar }) => (
  <div className="bg-gray-800/50 rounded-md p-2 flex flex-col h-full">
    <div className={hasScrollbar ? "pr-1" : ""}>
      <PanelHeader>
        <span className="flex-1">{title}</span>
        {headers &&
          headers.map((h) => (
            // Adjusted width for better spacing in Rune Summary Panel's StatRow
            <span key={h} className="w-[45px] text-right pr-2">
              {" "}
              {/* Increased width from w-10 to w-45px */}
              {h}
            </span>
          ))}
      </PanelHeader>
    </div>
    <div className="flex-grow min-h-0">{children}</div>
  </div>
);

const StatRow = ({ children, games, winRate, dpm, maxDpm }) => (
  <div className="flex items-center text-xs py-1 px-1 hover:bg-white/5 rounded-sm">
    <div className="flex-1">{children}</div>
    {dpm !== undefined && (
      <div className="w-24 mx-2">
        <div className="text-white text-center text-[10px] pb-1">{Math.round(dpm)}</div>
        <div className="h-1.5 w-full bg-gray-700 rounded-full">
          <div className="h-1.5 bg-red-500 rounded-full" style={{ width: `${(dpm / (maxDpm || 1)) * 100}%` }}></div>
        </div>
      </div>
    )}
    <div className="w-[45px] text-right text-gray-300">{games}</div> {/* Standardized width */}
    <div className={`w-[55px] text-right font-bold ${winRate >= 50 ? "text-green-400" : "text-orange-400"}`}>{winRate.toFixed(0)}%</div> {/* Standardized width */}
  </div>
);
const SpellsPanel = ({ details, ddragonVersion, summonerSpellsMap }) => {
  return (
    <Panel title="Spells" headers={["Games", "WR"]}>
      {details.length > 0 ? (
        details.map((r) => (
          <StatRow key={r.key} games={r.games} winRate={r.winRate}>
            <div className="flex space-x-1">
              {r.key.split(",").map((id) => {
                const spellData = summonerSpellsMap[id];
                if (!spellData) return null;
                return <img key={id} src={`https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/spell/${spellData.image.full}`} className="w-6 h-6 rounded" title={spellData.name} />;
              })}
            </div>
          </StatRow>
        ))
      ) : (
        <p className="text-xs text-gray-500 text-center p-2">No data</p>
      )}
    </Panel>
  );
};

const StartingItemsPanel = ({ details, getItemImage }) => (
  <Panel title="Starting Items" headers={["Games", "WR"]}>
    {details.length > 0 ? (
      details.map((r) => (
        <StatRow key={r.key} games={r.games} winRate={r.winRate}>
          <div className="flex space-x-1">
            {r.key.split(",").map((id) => (
              <img key={id} src={getItemImage(id)} className="w-6 h-6 rounded" />
            ))}
          </div>
        </StatRow>
      ))
    ) : (
      <p className="text-xs text-gray-500 text-center p-2">No data</p>
    )}
  </Panel>
);
const BootsPanel = ({ details, getItemImage }) => (
  <Panel title="Boots" headers={["Games", "WR"]}>
    {details.length > 0 ? (
      details.map((r) => (
        <StatRow key={r.key} games={r.games} winRate={r.winRate}>
          <div className="flex space-x-1">
            <img src={getItemImage(r.key)} className="w-6 h-6 rounded" />
          </div>
        </StatRow>
      ))
    ) : (
      <p className="text-xs text-gray-500 text-center p-2">No data</p>
    )}
  </Panel>
);

const ItemBuildsPanel = ({ details, selectedTab, onTabClick, getItemImage }) => {
  const TABS = [2, 3, 4, 5];
  const builds = details[selectedTab] || [];
  const maxDpm = Math.max(...builds.map((b) => b.dpm), 0);
  return (
    <div className="bg-gray-800/50 rounded-md p-2">
      <div className="flex mb-2 border-b border-gray-700">
        {TABS.map((t) => (
          <button key={t} onClick={() => onTabClick(t)} className={`px-3 py-1 text-xs font-semibold rounded-t-md ${selectedTab === t ? "bg-gray-700 text-white" : "text-gray-400 hover:bg-gray-700/50"}`}>
            {t} Items
          </button>
        ))}
      </div>
      <div className="pr-1">
        <PanelHeader>
          <span className="flex-1">Item Builds</span>
          <span className="w-28 mx-2 text-center">Damage Per Minute</span>
          <span className="w-[55px] text-right">Games</span> {/* Corrected width */}
          <span className="w-[50px] text-right pr-3">WR</span> {/* Corrected width */}
        </PanelHeader>
      </div>

      <div className="space-y-1 h-[105px] overflow-y-scroll custom-scrollbar pr-1">
        {builds.length > 0 ? (
          builds.map((r) => (
            <StatRow key={r.key} games={r.games} winRate={r.winRate} dpm={r.dpm} maxDpm={maxDpm}>
              <div className="flex items-center space-x-1">
                {r.key.split(",").map((id, i) => (
                  <React.Fragment key={id}>
                    <img src={getItemImage(id)} className="w-6 h-6 rounded" />
                    {i < r.key.split(",").length - 1 && <span className="text-gray-500 text-sm">&gt;</span>}
                  </React.Fragment>
                ))}
              </div>
            </StatRow>
          ))
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-gray-500 text-center p-4">No data for this item count</p>
          </div>
        )}
      </div>
    </div>
  );
};

// region: --- Main Stats Page Component ---
function StatsPage() {
  // region: --- State ---
  const [allMatches, setAllMatches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [ddragonVersion, setDdragonVersion] = useState("");
  const [ddragonChampions, setDdragonChampions] = useState(null);
  const [summonerSpellsMap, setSummonerSpellsMap] = useState({});
  const [itemData, setItemData] = useState(null);
  const [runesData, setRunesData] = useState(null);
  const [selectedChampion, setSelectedChampion] = useState(null);
  const [selectedMatchup, setSelectedMatchup] = useState(null);
  const [expandedChampion, setExpandedChampion] = useState(null);
  const [performancePeriod, setPerformancePeriod] = useState("last7days");
  const [performanceStats, setPerformanceStats] = useState({ current: null, previous: null });
  const [championFilters, setChampionFilters] = useState({ role: "", patch: [], dateRange: { startDate: null, endDate: null }, activePreset: null });
  // endregion

  // region: --- Data & Callbacks ---
  useEffect(() => {
    fetch("https://ddragon.leagueoflegends.com/api/versions.json")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch DDragon versions, status: ${res.status}`);
        }
        return res.json();
      })
      .then((versions) => {
        const latestVersion = versions[0];
        if (!latestVersion) {
          throw new Error("DDragon API returned no versions.");
        }
        setDdragonVersion(latestVersion);

        const dataFetches = [
          fetch(`https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/en_US/champion.json`).then((res) => res.json()),
          fetch(`https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/en_US/item.json`).then((res) => res.json()),
          fetch(`https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/en_US/runesReforged.json`).then((res) => res.json()),
          fetch(`https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/en_US/summoner.json`).then((res) => res.json()),
        ];

        return Promise.all(dataFetches);
      })
      .then(([championJson, itemJson, runesJson, summonerJson]) => {
        setDdragonChampions(championJson.data);
        setItemData(itemJson.data);
        setRunesData(runesJson);

        const spells = {};
        if (summonerJson && summonerJson.data) {
          for (const key in summonerJson.data) {
            spells[summonerJson.data[key].key] = summonerJson.data[key];
          }
        }
        setSummonerSpellsMap(spells);
      })
      .catch((err) => {
        console.error("DDragon data fetch failed:", err);
        setError("Could not load required game data from Riot's services. The API might be down or you may have a network issue.");
      });
  }, []);
  useEffect(() => {
    const fetchMatches = async () => {
      setIsLoading(true);
      setError("");
      try {
        const matchesFromDb = await db.matches.toArray();
        setAllMatches(matchesFromDb.sort((a, b) => b.gameCreation - a.gameCreation));
      } catch (err) {
        setError("Could not load match data from database.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchMatches();
  }, []);

  const runesMap = useMemo(() => {
    if (!runesData) return {};
    const flatRunes = {};
    runesData.forEach((style) => {
      flatRunes[style.id] = { icon: style.icon, name: style.name, key: style.key };
      style.slots.forEach((slot) => slot.runes.forEach((rune) => (flatRunes[rune.id] = { icon: rune.icon, name: rune.name, key: rune.key, styleId: style.id })));
    });
    return flatRunes;
  }, [runesData]);

  const getChampionImage = useCallback(
    (championName) => {
      if (!ddragonVersion || !ddragonChampions || !championName) return "";
      const championInfo = ddragonChampions[championName] || Object.values(ddragonChampions).find((c) => c.name === championName);
      return championInfo ? `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${championInfo.image.full}` : "";
    },
    [ddragonVersion, ddragonChampions]
  );
  const getChampionDisplayName = useCallback(
    (championName) => {
      if (!ddragonChampions || !championName) return championName;
      return ddragonChampions[championName]?.name || championName;
    },
    [ddragonChampions]
  );
  const getRuneImage = useCallback(
    (runeId) => {
      if (!runeId || !ddragonVersion || !runesMap || !runesMap[runeId]) return null;
      return `https://ddragon.leagueoflegends.com/cdn/img/${runesMap[runeId].icon}`;
    },
    [ddragonVersion, runesMap]
  );
  const getItemImage = useCallback(
    (itemId) => {
      if (!itemId || !ddragonVersion || !itemData) return null;
      return `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/item/${itemId}.png`;
    },
    [ddragonVersion, itemData]
  );
  const processChampionAndMatchupData = useCallback((matches) => {
    if (!matches || matches.length === 0) return [];

    const matchesByChampion = matches.reduce((acc, match) => {
      const champName = match.championName;
      if (!champName) return acc;
      if (!acc[champName]) acc[champName] = [];
      acc[champName].push(match);
      return acc;
    }, {});

    return Object.keys(matchesByChampion)
      .map((champName) => {
        const championMatches = matchesByChampion[champName];
        const championStats = calculateSummaryStatsForPeriod(championMatches, 0, Date.now());

        const matchups = championMatches.reduce((acc, match) => {
          const player = match.allParticipants.find((p) => p.puuid === match.puuid);
          const opponent = match.allParticipants.find((p) => p.teamId !== player?.teamId && p.teamPosition === player?.teamPosition);
          if (opponent?.championName) {
            const opponentName = opponent.championName;
            if (!acc[opponentName]) acc[opponentName] = [];
            acc[opponentName].push(match);
          }
          return acc;
        }, {});

        const matchupStats = Object.keys(matchups)
          .map((opponentName) => ({
            opponentChampionName: opponentName,
            gamesPlayed: matchups[opponentName].length,
            stats: calculateSummaryStatsForPeriod(matchups[opponentName], 0, Date.now()),
            matches: matchups[opponentName],
          }))
          .sort((a, b) => b.gamesPlayed - a.gamesPlayed);

        return { championName: champName, gamesPlayed: championMatches.length, stats: championStats, matchups: matchupStats, matches: championMatches };
      })
      .sort((a, b) => b.gamesPlayed - a.gamesPlayed);
  }, []);
  const availablePatches = useMemo(() => {
    if (!allMatches.length) return [];
    const patchSet = new Set();
    allMatches.forEach((m) => {
      if (m.gamePatchVersion) {
        patchSet.add(m.gamePatchVersion);
      }
    });
    return Array.from(patchSet).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  }, [allMatches]);
  useEffect(() => {
    if (allMatches.length === 0 && !isLoading) return;
    const now = new Date();
    let days;
    switch (performancePeriod) {
      case "last7days":
        days = 7;
        break;
      case "last30days":
        days = 30;
        break;
      case "last90days":
        days = 90;
        break;
      case "allTime":
        days = 9999;
        break;
      default:
        days = 7;
    }
    const currentStartDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).getTime();
    const filteredMatches = allMatches.filter((m) => m.gameCreation >= currentStartDate);
    const currentStats = calculateSummaryStatsForPeriod(filteredMatches, 0, Date.now());
    const previousEndDate = currentStartDate;
    const previousStartDate = new Date(previousEndDate - days * 24 * 60 * 60 * 1000).getTime();
    const previousPeriodMatches = allMatches.filter((m) => m.gameCreation >= previousStartDate && m.gameCreation < previousEndDate);
    const previousStats = performancePeriod !== "allTime" ? calculateSummaryStatsForPeriod(previousPeriodMatches, 0, Date.now()) : null;
    setPerformanceStats({ current: currentStats, previous: previousStats });
  }, [allMatches, performancePeriod, isLoading]);
  const filteredChampionData = useMemo(() => {
    if (allMatches.length === 0) return [];
    return processChampionAndMatchupData(
      allMatches.filter((match) => {
        const { role, patch, dateRange } = championFilters;
        if (role && match.teamPosition !== role) return false;
        if (patch.length > 0 && !patch.includes(match.gamePatchVersion)) return false;
        const matchTime = match.gameCreation;
        if (dateRange.startDate && matchTime < dateRange.startDate.setHours(0, 0, 0, 0)) return false;
        if (dateRange.endDate && matchTime > dateRange.endDate.setHours(23, 59, 59, 999)) return false;
        return true;
      })
    );
  }, [allMatches, championFilters, processChampionAndMatchupData]);

  const handleMatchupSelect = (matchup) => {
    setSelectedMatchup((prev) => (prev?.opponentChampionName === matchup?.opponentChampionName ? null : matchup));
  };

  const handleChampionClick = useCallback(
    (champion) => {
      const champName = champion.championName;

      if (selectedChampion?.championName !== champName) {
        setSelectedChampion(champion);
        setExpandedChampion(champName);
        setSelectedMatchup(null);
        return;
      }

      if (selectedMatchup) {
        setSelectedMatchup(null);
      } else {
        setExpandedChampion((current) => (current === champName ? null : champName));
      }
    },
    [selectedChampion, selectedMatchup]
  );

  const handleChampionFilterChange = useCallback(
    (newFilterValues) => {
      setChampionFilters((prevFilters) => ({ ...prevFilters, ...newFilterValues }));
      handleChampionClick(null); // Clear selected champion and collapse when filters change
    },
    [handleChampionClick]
  );

  useEffect(() => {
    if (!isLoading && filteredChampionData.length > 0 && !selectedChampion) {
      handleChampionClick(filteredChampionData[0]);
    }
  }, [isLoading, filteredChampionData, selectedChampion, handleChampionClick]);

  const matchesForDetailView = useMemo(() => {
    if (selectedMatchup) return selectedMatchup.matches;
    if (selectedChampion) return selectedChampion.matches;
    return null;
  }, [selectedChampion, selectedMatchup]);

  const handleDatePresetChange = (preset) => {
    const now = new Date();
    let startDate;
    if (championFilters.activePreset === preset) {
      handleChampionFilterChange({ dateRange: { startDate: null, endDate: null }, activePreset: null });
      return;
    }

    if (preset === "last7days") startDate = subDays(now, 7);
    if (preset === "last30days") startDate = subDays(now, 30);

    handleChampionFilterChange({
      dateRange: { startDate, endDate: now },
      activePreset: preset,
    });
  };
  // endregion

  // region: --- Render ---
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-10 text-red-400">
        <AlertTriangle size={40} className="mb-4" />
        <p className="text-lg">{error}</p>
      </div>
    );
  }

  if (isLoading || !ddragonChampions || !itemData || !runesData) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-10 text-white">
        <Loader2 size={40} className="text-orange-500 animate-spin" />
        <p className="mt-4 text-lg">Loading statistics...</p>
      </div>
    );
  }

  return (
    <div className="p-4 text-white h-[calc(100vh-4rem)] flex flex-col gap-4">
      <header className="flex-shrink-0 grid grid-cols-10 gap-4">
        <div className="col-span-10 xl:col-span-7">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-semibold text-gray-200">Performance Overview</h2>
            <div className="relative w-full max-w-[150px]">
              <select id="period-select" value={performancePeriod} onChange={(e) => setPerformancePeriod(e.target.value)} className="w-full appearance-none bg-gray-700/50 border border-gray-600 text-white text-sm px-3 py-1.5 rounded-md focus:outline-none focus:border-orange-500">
                <option value="last7days">Last 7 Days</option>
                <option value="last30days">Last 30 Days</option>
                <option value="last90days">Last 90 Days</option>
                <option value="allTime">All Time</option>
              </select>
              <ChevronsUpDown size={16} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <PerformanceStats stats={performanceStats} />
        </div>
        <div className="hidden xl:block xl:col-span-3">
          <ActivityCalendar matches={allMatches} />
        </div>
      </header>

      <main className="flex-grow grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
        <div className="min-h-0 flex flex-col gap-2">
          <ChampionFilters filters={championFilters} onFilterChange={handleChampionFilterChange} onDatePresetChange={handleDatePresetChange} availablePatches={availablePatches} ROLE_ICON_MAP={ROLE_ICON_MAP} ROLE_ORDER={ROLE_ORDER} />
          <div className="flex-grow min-h-0">
            <ChampionList champions={filteredChampionData} onChampionClick={handleChampionClick} onMatchupSelect={handleMatchupSelect} selectedChampion={selectedChampion} selectedMatchup={selectedMatchup} expandedChampion={expandedChampion} getChampionImage={getChampionImage} getChampionDisplayName={getChampionDisplayName} />
          </div>
        </div>
        <div className="min-h-0">
          <ChampionDetailView
            championName={selectedChampion?.championName}
            matches={matchesForDetailView}
            stats={selectedMatchup ? selectedMatchup.stats : selectedChampion?.stats}
            getChampionImage={getChampionImage}
            getChampionDisplayName={getChampionDisplayName}
            itemData={itemData}
            runesMap={runesMap}
            ddragonVersion={ddragonVersion}
            ddragonChampions={ddragonChampions}
            runesDataFromDDragon={runesData}
            getRuneImage={getRuneImage}
            getItemImage={getItemImage}
            summonerSpellsMap={summonerSpellsMap}
          />
        </div>
      </main>
    </div>
  );
}

export default StatsPage;
