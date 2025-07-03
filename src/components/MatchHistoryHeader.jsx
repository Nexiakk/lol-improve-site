// src/components/MatchHistoryHeader.jsx
import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { TrendingUp, RefreshCw, Loader2, CalendarDays, Users, ShieldCheck, User, Swords, Search, X, ChevronDown, ChevronUp, ListFilter, Edit, CheckCircle, Pin, PinOff, Target as TargetIcon } from "lucide-react"; // Added TargetIcon
import DatePicker from "react-datepicker";
import Select from "react-select"; // Assuming react-select is installed for patch filter
import "react-datepicker/dist/react-datepicker.css";
import "./react-datepicker-dark.css"; // Your custom dark theme for datepicker
import { format } from "date-fns";

// Helper to normalize text for searching
const normalizeText = (str) => {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['\s]/g, "");
};

// Champion Filter with Autocomplete Suggestions
const ChampionFilterWithSuggestions = ({ name, value, placeholder, onChange, availableChampions, getChampionDisplayName, getChampionImage, commonInputClass }) => {
  const [inputText, setInputText] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const wrapperRef = useRef(null);

  // NEW: Add a ref to hold the debounce timer
  const debounceTimeout = useRef(null);

  useEffect(() => {
    if (value === "") setInputText("");
    else setInputText(getChampionDisplayName(value) || value);
  }, [value, getChampionDisplayName]);

  // This cleanup effect will clear any pending timer if the component unmounts
  useEffect(() => {
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, []);

  const handleInputChange = (e) => {
    const newText = e.target.value;
    setInputText(newText); // Update the input text immediately
    setActiveSuggestionIndex(-1);

    // Clear any existing timer to reset the debounce period
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    // If input is cleared, update the filter immediately
    if (newText.trim() === "") {
      setSuggestions([]);
      setShowSuggestions(false);
      onChange({ target: { name: name, value: "" } });
      return;
    }

    // Set a new timer to perform the search after a short delay
    debounceTimeout.current = setTimeout(() => {
      const normalizedInput = normalizeText(newText);
      const filteredSuggestions = availableChampions
        .map((apiName) => ({
          apiName,
          displayName: getChampionDisplayName(apiName) || apiName,
          normalizedDisplayName: normalizeText(getChampionDisplayName(apiName) || apiName),
          normalizedApiName: normalizeText(apiName),
        }))
        .filter((champ) => champ.normalizedDisplayName.includes(normalizedInput) || champ.normalizedApiName.includes(normalizedInput))
        .slice(0, 7);
      setSuggestions(filteredSuggestions);
      setShowSuggestions(filteredSuggestions.length > 0);
    }, 250); // 250ms delay
  };

  const handleSuggestionClick = (championApiName) => {
    setInputText(getChampionDisplayName(championApiName) || championApiName);
    onChange({ target: { name: name, value: championApiName } });
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const attemptDirectMatchAndSelect = () => {
    if (inputText.trim() === "") {
      onChange({ target: { name: name, value: "" } });
      return;
    }
    const normalizedInput = normalizeText(inputText);
    const directMatch = availableChampions.find((apiName) => normalizeText(getChampionDisplayName(apiName) || apiName) === normalizedInput || normalizeText(apiName) === normalizedInput);
    if (directMatch) handleSuggestionClick(directMatch);
    else if (suggestions.length > 0) handleSuggestionClick(suggestions[0].apiName);
    setShowSuggestions(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // Clear any pending search so it doesn't pop up after selecting
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
      if (showSuggestions && activeSuggestionIndex >= 0 && activeSuggestionIndex < suggestions.length) {
        handleSuggestionClick(suggestions[activeSuggestionIndex].apiName);
      } else {
        attemptDirectMatchAndSelect();
      }
      setShowSuggestions(false);
      return;
    }
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestionIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestionIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setShowSuggestions(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  return (
    <div className="relative h-9" ref={wrapperRef}>
      <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      <input
        type="text"
        name="championSearch"
        value={inputText}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (inputText.trim() && suggestions.length > 0) setShowSuggestions(true);
        }}
        placeholder={placeholder || "Champion..."}
        className={`${commonInputClass} pl-8 pr-2 w-full h-full`}
        autoComplete="off"
      />
      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute z-20 w-full bg-gray-700 border border-gray-600 rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto py-1">
          {suggestions.map((champion, index) => (
            <li key={champion.apiName} className={`px-3 py-2 text-xs cursor-pointer hover:bg-orange-500/20 flex items-center gap-2 ${index === activeSuggestionIndex ? "bg-orange-500/20" : ""}`} onClick={() => handleSuggestionClick(champion.apiName)} onMouseEnter={() => setActiveSuggestionIndex(index)}>
              <img
                src={getChampionImage(champion.apiName)}
                alt=""
                className="w-5 h-5 rounded-sm"
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
              <span className="text-gray-200">{champion.displayName}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
ChampionFilterWithSuggestions.displayName = "ChampionFilterWithSuggestions";

// Role Filter Component
const RoleFilter = ({ selectedRole, onRoleChange, commonInputClass, ROLE_ICON_MAP, ROLE_ORDER }) => {
  if (!ROLE_ICON_MAP || !ROLE_ORDER) return null;
  return (
    <div className={`flex items-center bg-gray-700/80 border border-gray-600 rounded-l-md shadow-sm h-9 px-1.5`}>
      {" "}
      {/* Ensure h-9 */}
      {ROLE_ORDER.map((roleKey) => {
        const IconComponent = ROLE_ICON_MAP[roleKey];
        const isActive = selectedRole === roleKey;
        return (
          <button
            key={roleKey}
            type="button"
            onClick={() => onRoleChange(isActive ? "" : roleKey)}
            title={`Filter by ${roleKey.charAt(0).toUpperCase() + roleKey.slice(1).toLowerCase()}`}
            className={`p-1 rounded-sm transition-all duration-150 focus:outline-none flex items-center justify-center
                                    ${isActive ? "bg-white/20 scale-105 shadow-md" : "hover:bg-gray-600/70 opacity-70 hover:opacity-100"}`}
          >
            {IconComponent && <img src={IconComponent} alt={roleKey} className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
        );
      })}
    </div>
  );
};
RoleFilter.displayName = "RoleFilter";

// WinrateHalfRadialChart
const WinrateHalfRadialChart = ({ winrate, wins, losses, radius = 50, strokeWidth = 10 }) => {
  const r = radius - strokeWidth / 2;
  const centerX = radius;
  const centerY = radius;
  const polarToCartesian = (cX, cY, currentRadius, angleInDegrees) => {
    const angleInRadians = ((angleInDegrees - 180) * Math.PI) / 180.0;
    return { x: cX + currentRadius * Math.cos(angleInRadians), y: cY + currentRadius * Math.sin(angleInRadians) };
  };
  const describeArc = (x, y, currentRadius, startAngle, endAngle) => {
    const start = polarToCartesian(x, y, currentRadius, endAngle);
    const end = polarToCartesian(x, y, currentRadius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return ["M", start.x, start.y, "A", currentRadius, currentRadius, 0, largeArcFlag, 0, end.x, end.y].join(" ");
  };
  const angle = (winrate / 100) * 180;
  const winColor = "hsl(var(--chart-wins-hsl))";
  const trackColor = "hsl(var(--chart-losses-bg-hsl))";
  const trackPath = describeArc(centerX, centerY, r, 0, 180);
  const progressPath = describeArc(centerX, centerY, r, 0, angle);
  return (
    <div className="relative" style={{ width: radius * 2, height: radius + strokeWidth / 2 }}>
      <svg width={radius * 2} height={radius + strokeWidth / 2} viewBox={`0 0 ${radius * 2} ${radius + strokeWidth / 2}`}>
        <path d={trackPath} fill="none" stroke={trackColor} strokeWidth={strokeWidth} strokeLinecap="round" />
        {winrate > 0 && <path d={progressPath} fill="none" stroke={winColor} strokeWidth={strokeWidth} strokeLinecap="round" />}
      </svg>
      <div className="absolute top-[90%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center text-center" style={{ width: "100%" }}>
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
WinrateHalfRadialChart.displayName = "WinrateHalfRadialChart";

// FilterInput
const FilterInput = ({ label, icon: Icon, children, htmlFor }) => (
  <div className="flex-1 min-w-[150px]">
    {" "}
    <label htmlFor={htmlFor} className="block text-xs font-medium text-gray-400 mb-1 flex items-center">
      {" "}
      {Icon && <Icon size={14} className="mr-1.5 text-orange-400" />} {label}{" "}
    </label>{" "}
    {children}{" "}
  </div>
);
FilterInput.displayName = "FilterInput";

// Styles for react-select
const selectStyles = {
  control: (p, s) => ({ ...p, backgroundColor: "var(--color-gray-700, #4a5568)", borderColor: s.isFocused ? "var(--color-orange-500, #ed8936)" : "var(--color-gray-600, #718096)", boxShadow: s.isFocused ? "0 0 0 1px var(--color-orange-500, #ed8936)" : null, borderRadius: "0.375rem", minHeight: "36px", height: "36px", fontSize: "0.75rem", color: "var(--color-gray-200, #e2e8f0)", "&:hover": { borderColor: "var(--color-orange-500, #ed8936)" } }),
  valueContainer: (p) => ({ ...p, padding: "0px 6px", height: "36px" }),
  input: (p) => ({ ...p, color: "var(--color-gray-100, #f7fafc)", margin: "0px", paddingBottom: "0px", paddingTop: "0px" }),
  placeholder: (p) => ({ ...p, color: "var(--color-gray-400, #a0aec0)" }),
  singleValue: (p) => ({ ...p, color: "var(--color-gray-100, #f7fafc)" }),
  multiValue: (p) => ({ ...p, backgroundColor: "var(--color-orange-600, #dd6b20)", borderRadius: "0.25rem", color: "white" }),
  multiValueLabel: (p) => ({ ...p, color: "white", fontSize: "0.75rem", padding: "2px", paddingLeft: "6px" }),
  multiValueRemove: (p) => ({ ...p, color: "white", borderRadius: "0 0.25rem 0.25rem 0", "&:hover": { backgroundColor: "var(--color-orange-700, #c05621)", color: "white" } }),
  menu: (p) => ({ ...p, backgroundColor: "var(--color-gray-700, #4a5568)", borderRadius: "0.375rem", marginTop: "4px", zIndex: 20 }),
  menuList: (p) => ({ ...p, paddingTop: "0px", paddingBottom: "0px" }),
  option: (p, s) => ({ ...p, backgroundColor: s.isSelected ? "var(--color-orange-600, #dd6b20)" : s.isFocused ? "var(--color-orange-500-alpha20, rgba(237, 137, 54, 0.2))" : "transparent", color: s.isSelected ? "white" : "var(--color-gray-200, #e2e8f0)", fontSize: "0.75rem", padding: "6px 10px", "&:active": { backgroundColor: "var(--color-orange-700, #c05621)" } }),
  indicatorSeparator: () => ({ display: "none" }),
  dropdownIndicator: (p) => ({ ...p, padding: "4px", color: "var(--color-gray-400, #a0aec0)", "&:hover": { color: "var(--color-gray-200, #e2e8f0)" } }),
  clearIndicator: (p) => ({ ...p, padding: "4px", color: "var(--color-gray-400, #a0aec0)", "&:hover": { color: "var(--color-red-400, #f87171)" } }),
  loadingIndicator: (p) => ({ ...p, color: "var(--color-orange-500, #ed8936)" }),
};

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
  availableOpponentChampions, // <-- Destructure the new prop
  availablePatches,
  ROLE_ICON_MAP,
  ROLE_ORDER,
  goalTemplates, // NEW PROP
}) {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showAdvancedUpdateOptions, setShowAdvancedUpdateOptions] = useState(false);
  const advancedUpdateOptionsRef = useRef(null);

  const [activePreGameGoal, setActivePreGameGoal] = useState(null);
  const [showPreGameGoalSetter, setShowPreGameGoalSetter] = useState(false);
  const [customPreGameGoalText, setCustomPreGameGoalText] = useState("");
  const [selectedPreGameTemplateId, setSelectedPreGameTemplateId] = useState("");
  const preGameGoalSetterRef = useRef(null);

  const [championFilterMode, setChampionFilterMode] = useState("player"); // 'player' or 'opponent'

  const handleFilterModeToggle = () => {
    const filterToClear = championFilterMode === "player" ? "champion" : "opponentChampion";
    onFilterChange({ target: { name: filterToClear, value: "" } });
    setChampionFilterMode((prev) => (prev === "player" ? "opponent" : "player"));
  };

  useEffect(() => {
    try {
      const storedGoal = localStorage.getItem("activePreGameGoal");
      if (storedGoal) {
        setActivePreGameGoal(JSON.parse(storedGoal));
      }
    } catch (error) {
      console.error("Error loading pre-game goal from localStorage:", error);
    }
  }, []);

  const handleSetPreGameFocus = () => {
    let goalToSet = null;
    if (selectedPreGameTemplateId) {
      const template = goalTemplates.find((t) => t.id.toString() === selectedPreGameTemplateId);
      if (template) {
        goalToSet = { text: template.title, templateId: template.id, category: template.category, setAt: Date.now() };
      }
    } else if (customPreGameGoalText.trim()) {
      goalToSet = { text: customPreGameGoalText.trim(), setAt: Date.now() };
    }

    if (goalToSet) {
      localStorage.setItem("activePreGameGoal", JSON.stringify(goalToSet));
      setActivePreGameGoal(goalToSet);
      setShowPreGameGoalSetter(false);
      setCustomPreGameGoalText("");
      setSelectedPreGameTemplateId("");
    }
  };

  const handleClearPreGameFocus = () => {
    localStorage.removeItem("activePreGameGoal");
    setActivePreGameGoal(null);
    setShowPreGameGoalSetter(false); // Also close setter if open
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (preGameGoalSetterRef.current && !preGameGoalSetterRef.current.contains(event.target)) {
        const toggleButton = document.getElementById("pre-game-focus-toggle");
        if (toggleButton && toggleButton.contains(event.target)) return;
        setShowPreGameGoalSetter(false);
      }
    }
    if (showPreGameGoalSetter) document.addEventListener("mousedown", handleClickOutside);
    else document.removeEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showPreGameGoalSetter]);

  const calculateSingleGameKDA = (kills, deaths, assists) => {
    if (deaths === 0) return kills > 0 || assists > 0 ? (kills + assists) * 2 : 0;
    return (kills + assists) / deaths;
  };
  const summaryData = useMemo(() => {
    if (!filteredMatches || filteredMatches.length === 0) {
      /* ... initial state ... */
    }

    const isDateFilterActive = filters.dateRange && (filters.dateRange.startDate || filters.dateRange.endDate);
    const matchesForSummaryCalc = isDateFilterActive ? filteredMatches : filteredMatches.slice(0, gamesForSummaryCount);

    const totalGames = matchesForSummaryCalc.length;
    // ... rest of the calculation using matchesForSummaryCalc instead of recentMatches
    // Ensure all variables like wins, totalKills, championStats, etc., are based on matchesForSummaryCalc

    // Example for totalGames:
    // const totalGames = matchesForSummaryCalc.length; // Use this instead of recentMatches.length

    // ... (previous calculations for wins, totalKills, totalDeaths, totalAssists, championStats using matchesForSummaryCalc) ...

    let wins = 0,
      totalKills = 0,
      totalDeaths = 0,
      totalAssists = 0;
    const championStats = {};
    matchesForSummaryCalc.forEach((match) => {
      // Use matchesForSummaryCalc here
      const player = match; // Assuming match object directly contains player stats
      if (player.win) wins++;
      totalKills += player.kills || 0;
      totalDeaths += player.deaths || 0;
      totalAssists += player.assists || 0;
      if (player.championName) {
        if (!championStats[player.championName]) {
          championStats[player.championName] = {
            name: player.championName,
            games: 0,
            wins: 0,
            kills: 0,
            deaths: 0,
            assists: 0,
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
    const avgKDAValue = calculateSingleGameKDA(avgKills, avgDeaths, avgAssists); // calculateSingleGameKDA might need to be imported or defined
    const avgKDA = typeof avgKDAValue === "number" ? avgKDAValue.toFixed(1) : avgKDAValue;

    const sortedChampions = Object.values(championStats)
      .sort((a, b) => b.games - a.games)
      .slice(0, 3)
      .map((champ) => ({
        ...champ,
        winrate: champ.games > 0 ? (champ.wins / champ.games) * 100 : 0,
        kda: calculateSingleGameKDA(champ.games > 0 ? champ.kills / champ.games : 0, champ.games > 0 ? champ.deaths / champ.games : 0, champ.games > 0 ? champ.assists / champ.games : 0),
      }));

    return {
      totalGames,
      wins,
      losses,
      winrate,
      avgKills,
      avgDeaths,
      avgAssists,
      avgKDA,
      topChampions: sortedChampions,
    };
  }, [filteredMatches, gamesForSummaryCount, getChampionDisplayName, filters.dateRange]); // Add filters.dateRange to dependency array
  const getWinrateColor = (wr) => {
    if (wr >= 60) return "text-green-400";
    if (wr >= 50) return "text-blue-400";
    if (wr >= 40) return "text-yellow-400";
    return "text-red-400";
  };
  const getKDAColor = (kda) => {
    if (typeof kda === "string" && kda.toLowerCase() === "perfect") return "text-yellow-400";
    const kdaValue = parseFloat(kda);
    if (kdaValue >= 5) return "text-green-400";
    if (kdaValue >= 3) return "text-blue-400";
    if (kdaValue >= 1.5) return "text-sky-400";
    return "text-gray-400";
  };
  const updateButtonDisabled = isUpdatingAllMatches || isLoadingAccounts || (trackedAccounts && trackedAccounts.length === 0) || !ddragonVersion || !championData || !runesMap || Object.keys(runesMap).length === 0;
  const commonInputClass = "w-full bg-gray-700/80 border border-gray-600 rounded-md shadow-sm focus:border-orange-500 text-gray-200 placeholder-gray-400 text-xs px-2.5";
  const controlElementHeightClass = "h-9";
  const datePresetButtonClass = "px-2.5 py-1 bg-gray-600/70 hover:bg-gray-500/70 text-gray-300 text-xs rounded-md transition-colors";
  const handleFilterDateChange = (dates) => {
    const [start, end] = dates;
    onFilterChange({ target: { name: "dateRange", value: { startDate: start ? format(start, "yyyy-MM-dd") : null, endDate: end ? format(end, "yyyy-MM-dd") : null } } });
  };
  const handleUpdateFetchDateRangeChange = (dates) => {
    const [start, end] = dates;
    onUpdateFetchDateChange({ target: { name: "dateRange", value: { startDate: start ? format(start, "yyyy-MM-dd") : null, endDate: end ? format(end, "yyyy-MM-dd") : null } } });
  };
  const handlePatchChange = (selectedOptions) => {
    const patchValues = selectedOptions ? selectedOptions.map((option) => option.value) : [];
    onFilterChange({ target: { name: "patch", value: patchValues } });
  };
  const handleRoleFilterChange = (roleValue) => {
    onFilterChange({ target: { name: "role", value: roleValue } });
  };
  const isAnyFilterActive = Object.values(filters).some((val) => {
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === "object" && val !== null) return val.startDate || val.endDate || (val.role && val.role !== "");
    return val && typeof val === "string" && val !== "";
  });
  const patchOptions = useMemo(() => availablePatches.map((p) => ({ value: p, label: p })), [availablePatches]);
  const selectedPatchValues = useMemo(() => {
    if (Array.isArray(filters.patch)) return filters.patch.map((p) => ({ value: p, label: p }));
    return [];
  }, [filters.patch]);
  useEffect(() => {
    function handleClickOutside(event) {
      if (advancedUpdateOptionsRef.current && !advancedUpdateOptionsRef.current.contains(event.target)) {
        const toggleButton = document.getElementById("advanced-update-toggle");
        if (toggleButton && toggleButton.contains(event.target)) return;
        setShowAdvancedUpdateOptions(false);
      }
    }
    if (showAdvancedUpdateOptions) document.addEventListener("mousedown", handleClickOutside);
    else document.removeEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAdvancedUpdateOptions]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8 mt-4 mb-2">
      {/* Pre-Game Focus Section */}
      <div className="mb-3 relative" ref={preGameGoalSetterRef}>
        <div className="flex items-center justify-between bg-gray-800/50 p-2 rounded-lg border border-gray-700/50">
          {" "}
          {/* Ensure min height */}
          <div className="flex items-center">
            <TargetIcon size={18} className="mr-2 text-orange-400 flex-shrink-0" />
            {activePreGameGoal ? (
              <div className="text-xs">
                <span className="text-gray-400 mr-1">Active Focus:</span>
                <span className="text-orange-300 font-semibold">{activePreGameGoal.text}</span>
                {activePreGameGoal.category && <span className="text-gray-500 text-[10px] ml-1">({activePreGameGoal.category})</span>}
              </div>
            ) : (
              <span className="text-xs text-gray-400">No active pre-game focus set.</span>
            )}
          </div>
          <div className="flex items-center">
            {activePreGameGoal && (
              <button onClick={handleClearPreGameFocus} className="p-1 text-red-500 hover:text-red-400 mr-1.5" title="Clear Active Focus">
                <PinOff size={16} />
              </button>
            )}
            <button id="pre-game-focus-toggle" onClick={() => setShowPreGameGoalSetter(!showPreGameGoalSetter)} className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-md text-gray-300 hover:text-orange-300 transition-colors" title={showPreGameGoalSetter ? "Close Focus Setter" : "Set Pre-Game Focus"}>
              {showPreGameGoalSetter ? <ChevronUp size={16} /> : <Edit size={16} />}
            </button>
          </div>
        </div>
        {showPreGameGoalSetter && (
          <div className="absolute top-full left-0 mt-1 z-30 bg-gray-800 p-3 rounded-lg shadow-xl border border-gray-700 w-full sm:w-auto min-w-[300px] space-y-2">
            <h4 className="text-sm font-semibold text-gray-200 mb-1">Set Your Pre-Game Focus</h4>
            {goalTemplates && goalTemplates.length > 0 && (
              <select
                value={selectedPreGameTemplateId}
                onChange={(e) => {
                  setSelectedPreGameTemplateId(e.target.value);
                  if (e.target.value) setCustomPreGameGoalText("");
                }}
                className={`${commonInputClass} ${controlElementHeightClass}`}
              >
                <option value="">Select from templates...</option>
                {goalTemplates.map((t) => (
                  <option key={t.id} value={t.id.toString()}>
                    {t.title} ({t.category || "General"})
                  </option>
                ))}
              </select>
            )}
            <p className="text-xs text-gray-400 text-center my-1">OR</p>
            <input
              type="text"
              value={customPreGameGoalText}
              onChange={(e) => {
                setCustomPreGameGoalText(e.target.value);
                if (e.target.value) setSelectedPreGameTemplateId("");
              }}
              placeholder="Type a custom focus..."
              className={`${commonInputClass} ${controlElementHeightClass}`}
            />
            <button onClick={handleSetPreGameFocus} className={`w-full bg-green-600 hover:bg-green-500 text-white text-xs py-1.5 px-3 rounded-md flex items-center justify-center ${controlElementHeightClass}`}>
              <CheckCircle size={16} className="mr-1.5" /> Set Focus
            </button>
          </div>
        )}
      </div>

      {/* Summary Section */}
      {summaryData.totalGames > 0 && (
        <div className="max-w-5xl mx-auto bg-gray-800/60 backdrop-blur-md border border-gray-700/50 pt-3 pb-3 h-[160px] rounded-lg flex flex-col items-center justify-center gap-y-2 text-xs font-light text-gray-300 text-center shadow-xl mb-2 min-h-[160px]">
          {" "}
          <div className="flex items-center gap-2 mx-auto">
            {" "}
            <TrendingUp size={15} className="text-gray-400" />
            <span className="text-xs text-gray-200 font-semibold"> {isAnyFilterActive ? `Filtered Performance (${summaryData.totalGames} Game${summaryData.totalGames === 1 ? "" : "s"})` : `Last ${summaryData.totalGames > gamesForSummaryCount ? gamesForSummaryCount : summaryData.totalGames} Games Performance`} </span>{" "}
          </div>{" "}
          <div className="flex flex-col md:flex-row items-center justify-around w-full px-3 md:px-6 gap-5 md:gap-8">
            {" "}
            <div className="relative min-h-[80px] min-w-[100px]">
              {" "}
              <WinrateHalfRadialChart winrate={summaryData.winrate} wins={summaryData.wins} losses={summaryData.losses} radius={50} strokeWidth={10} />{" "}
            </div>{" "}
            <div className="flex flex-col items-center md:items-start justify-center gap-2">
              {" "}
              {summaryData.topChampions.map((champ) => (
                <div key={champ.name} className="flex gap-2.5 items-center text-sm font-semibold text-center w-full md:w-auto">
                  {" "}
                  <img alt={getChampionDisplayName(champ.name)} loading="lazy" width="32" height="32" decoding="async" src={getChampionImage(champ.name)} className="w-8 h-8 scale-100 rounded-md object-cover border-2 border-gray-600 shadow-md" style={{ color: "transparent" }} />{" "}
                  <div className="flex flex-col items-start opacity-90">
                    {" "}
                    <div className="flex items-center gap-2">
                      {" "}
                      <span className={`min-w-[32px] text-start font-bold text-xs ${getWinrateColor(champ.winrate)}`}>{champ.winrate.toFixed(0)}%</span>{" "}
                      <span className="text-gray-400 text-xs">
                        {champ.wins}W-{champ.games - champ.wins}L
                      </span>{" "}
                    </div>{" "}
                    <span className="flex gap-1.5 items-center text-xs font-normal">
                      {" "}
                      <span className={getKDAColor(champ.kda)}>{typeof champ.kda === "number" ? champ.kda.toFixed(1) : champ.kda}</span> <span className="text-gray-400">KDA</span>{" "}
                    </span>{" "}
                  </div>{" "}
                </div>
              ))}{" "}
            </div>{" "}
            <div className="hidden lg:flex flex-col items-center justify-center h-full gap-2.5 min-w-[100px]">
              {" "}
              <div className="flex flex-col font-semibold text-gray-300 text-sm items-center gap-1">
                Overall KDA <span className={`font-bold text-2xl ${getKDAColor(summaryData.avgKDA)}`}>{summaryData.avgKDA}</span>
              </div>{" "}
              <div className="flex items-center gap-1.5 text-xs">
                {" "}
                <span className="text-gray-100">{summaryData.avgKills.toFixed(1)}</span>
                <span className="text-gray-500 font-light">/</span> <span className="text-red-400">{summaryData.avgDeaths.toFixed(1)}</span>
                <span className="text-gray-500 font-light">/</span> <span className="text-gray-100">{summaryData.avgAssists.toFixed(1)}</span>{" "}
              </div>{" "}
            </div>{" "}
          </div>{" "}
        </div>
      )}
      {summaryData.totalGames === 0 && filteredMatches && filteredMatches.length === 0 && allMatches && allMatches.length > 0 && <div className="max-w-5xl mx-auto bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 p-3 rounded-lg text-sm font-light text-gray-400 text-center shadow-lg mb-2 h-[160px] flex items-center justify-center"> No matches found for the current filters. Try adjusting or clearing them. </div>}
      {allMatches && allMatches.length === 0 && !isLoadingAccounts && <div className="max-w-5xl mx-auto bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 p-3 rounded-lg h-[160px] text-sm font-light text-gray-400 text-center shadow-lg mb-4 min-h-[160px] flex items-center justify-center"> No matches found. Add accounts or click "Update Matches". </div>}

      {/* Top control bar */}
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-2 mb-1">
        {" "}
        <div className="flex items-stretch relative">
          {" "}
          <button
            onClick={() => handleUpdateAllMatches(updateFetchDates.startDate, updateFetchDates.endDate)}
            disabled={updateButtonDisabled}
            className={`bg-orange-600 hover:bg-orange-500 text-white font-semibold py-0 px-3 sm:px-4 rounded-l-lg shadow-md focus:outline-none focus:ring-offset-2 focus:ring-offset-gray-900 flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed transition-opacity text-xs sm:text-sm ${controlElementHeightClass}`}
            style={{ minWidth: "100px" }}
          >
            {" "}
            {isUpdatingAllMatches ? <Loader2 size={18} className="animate-spin mr-1 sm:mr-2" /> : <RefreshCw size={16} className="mr-1 sm:mr-2" />} Update{" "}
          </button>{" "}
          <button id="advanced-update-toggle" onClick={() => setShowAdvancedUpdateOptions((prev) => !prev)} className={`p-1.5 bg-orange-700 hover:bg-orange-800 rounded-r-lg text-gray-200 hover:text-white transition-colors flex items-center justify-center w-[34px] sm:w-[38px] flex-shrink-0 border-l border-orange-800/50 ${controlElementHeightClass}`} title={showAdvancedUpdateOptions ? "Hide Update Date Range" : "Show Update Date Range"}>
            {" "}
            {showAdvancedUpdateOptions ? <ChevronUp size={18} /> : <ChevronDown size={18} />}{" "}
          </button>{" "}
          {showAdvancedUpdateOptions && (
            <div ref={advancedUpdateOptionsRef} className="absolute top-full left-0 mt-1 z-20 bg-gray-800 p-3 rounded-lg shadow-xl border border-gray-700 w-auto min-w-[280px]">
              {" "}
              <label htmlFor="updateDateRange" className="block text-xs text-gray-400 mb-1">
                Fetch Specific Date Range:
              </label>{" "}
              <DatePicker
                selectsRange
                startDate={updateFetchDates.startDate ? new Date(updateFetchDates.startDate) : null}
                endDate={updateFetchDates.endDate ? new Date(updateFetchDates.endDate) : null}
                onChange={handleUpdateFetchDateRangeChange}
                isClearable
                placeholderText="Select range for update..."
                dateFormat="yyyy/MM/dd"
                className={`${commonInputClass} w-full ${controlElementHeightClass}`}
                wrapperClassName="w-full"
                calendarClassName="react-datepicker-dark"
                popperPlacement="bottom-start"
                disabled={isUpdatingAllMatches}
              />{" "}
            </div>
          )}{" "}
        </div>{" "}
        <div className="flex items-stretch rounded-lg shadow-sm">
          {" "}
          <div className={`${controlElementHeightClass}`}>
            {" "}
            <RoleFilter selectedRole={filters.role} onRoleChange={handleRoleFilterChange} commonInputClass={commonInputClass} ROLE_ICON_MAP={ROLE_ICON_MAP} ROLE_ORDER={ROLE_ORDER} />{" "}
          </div>{" "}
          <button onClick={handleFilterModeToggle} title={championFilterMode === "player" ? "Switch to Opponent filter" : "Switch to Player filter"} className={`p-1.5 bg-gray-700/80 hover:bg-gray-600/80 text-gray-300 hover:text-orange-300 transition-colors flex items-center justify-center w-[34px] sm:w-[38px] flex-shrink-0 border-y border-gray-600 ${controlElementHeightClass}`}>
            {championFilterMode === "player" ? <User size={18} /> : <Swords size={18} />}
          </button>
          <div className={`flex-grow w-[150px] sm:w-[180px] ${controlElementHeightClass}`}>
            {championFilterMode === "player" ? (
              <ChampionFilterWithSuggestions name="champion" value={filters.champion} placeholder="Your Champion..." onChange={onFilterChange} availableChampions={availableChampions} getChampionDisplayName={getChampionDisplayName} getChampionImage={getChampionImage} commonInputClass={`${commonInputClass} rounded-none border-x-0`} />
            ) : (
              <ChampionFilterWithSuggestions name="opponentChampion" value={filters.opponentChampion} placeholder="Opponent..." onChange={onFilterChange} availableChampions={availableOpponentChampions} getChampionDisplayName={getChampionDisplayName} getChampionImage={getChampionImage} commonInputClass={`${commonInputClass} rounded-none border-x-0`} />
            )}
          </div>
          <button onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} className={`p-1.5 bg-gray-700/80 hover:bg-gray-600/80 rounded-r-lg text-gray-300 hover:text-orange-300 transition-colors flex items-center justify-center w-[34px] sm:w-[38px] flex-shrink-0 border border-gray-600 border-l-0 ${controlElementHeightClass}`} title={showAdvancedFilters ? "Hide Advanced Filters" : "Show Advanced Filters"}>
            {" "}
            <ListFilter size={18} />{" "}
          </button>{" "}
        </div>{" "}
      </div>
      <div className="max-w-5xl mx-auto w-full mb-2 flex items-center justify-center">
        {" "}
        {isUpdatingAllMatches && updateProgress && (
          <div className="w-full p-2.5 bg-sky-900/50 text-sky-300 border border-gray-700/50 rounded-md text-sm text-center">
            {" "}
            <p>{updateProgress}</p>{" "}
          </div>
        )}{" "}
      </div>
      {showAdvancedFilters && (
        <div className="relative z-10 max-w-5xl mx-auto bg-gray-800/40 backdrop-blur-sm border border-gray-700/30 p-3 rounded-lg shadow-md mb-3 space-y-3">
          {" "}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 items-end">
            {" "}
            <FilterInput label="Patch(es)" icon={ShieldCheck} htmlFor="filterPatch">
              {" "}
              <Select id="filterPatch" name="patch" isMulti options={patchOptions} value={selectedPatchValues} onChange={handlePatchChange} className="text-xs react-select-container" classNamePrefix="react-select" styles={selectStyles} placeholder="Select patch(es)..." isClearable />{" "}
            </FilterInput>{" "}
            <FilterInput label="With Player (Name#Tag)" icon={Users} htmlFor="filterWithPlayer">
              {" "}
              <input type="text" id="filterWithPlayer" name="withPlayer" value={filters.withPlayer} onChange={onFilterChange} placeholder="e.g., Teammate#EUW" className={`${commonInputClass} ${controlElementHeightClass}`} />{" "}
            </FilterInput>{" "}
            <div className="md:col-span-1">
              {" "}
              <FilterInput label="Date Range" icon={CalendarDays} htmlFor="filterDateRange">
                {" "}
                <DatePicker selectsRange startDate={filters.dateRange?.startDate ? new Date(filters.dateRange.startDate) : null} endDate={filters.dateRange?.endDate ? new Date(filters.dateRange.endDate) : null} onChange={handleFilterDateChange} isClearable placeholderText="Select date range..." dateFormat="yyyy/MM/dd" className={`${commonInputClass} ${controlElementHeightClass}`} wrapperClassName="w-full" calendarClassName="react-datepicker-dark" popperPlacement="bottom-start" />{" "}
              </FilterInput>{" "}
            </div>{" "}
            <div className="md:col-span-2 flex flex-col">
              {" "}
              <label className="block text-xs font-medium text-gray-400 mb-1 flex items-center"> Date Presets </label>{" "}
              <div className="flex flex-wrap gap-1.5">
                {" "}
                <button onClick={() => onDatePresetFilter("last7days")} className={datePresetButtonClass}>
                  Last 7 Days
                </button>{" "}
                <button onClick={() => onDatePresetFilter("last30days")} className={datePresetButtonClass}>
                  Last 30 Days
                </button>{" "}
                <button onClick={() => onDatePresetFilter("thisMonth")} className={datePresetButtonClass}>
                  This Month
                </button>{" "}
              </div>{" "}
            </div>{" "}
            <div className="flex items-end">
              {" "}
              <button onClick={onClearFilters} className={`w-full bg-gray-600 hover:bg-gray-500 text-white font-medium py-0 px-3 rounded-md shadow-sm text-xs flex items-center justify-center transition-colors ${controlElementHeightClass}`}>
                {" "}
                <X size={14} className="mr-1" /> Clear Filters{" "}
              </button>{" "}
            </div>{" "}
          </div>{" "}
        </div>
      )}
    </div>
  );
}
MatchHistoryHeader.displayName = "MatchHistoryHeader";

export default MatchHistoryHeader;
