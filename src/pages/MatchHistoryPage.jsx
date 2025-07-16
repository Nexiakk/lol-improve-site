// src/pages/MatchHistoryPage.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef, useLayoutEffect } from "react";
import { db } from "../dexieConfig";
import { Tooltip, Popover } from "antd";
import { Loader2, AlertTriangle, ListChecks, MessageSquare, Edit, ChevronDown, ChevronUp, Star, Brain, Target, Tag, Goal, History, Radio, PinOff, CheckCircle, Trash2 } from "lucide-react";

import MatchNotesPanel from "../components/MatchNotesPanel";
import PaginationControls from "../components/PaginationControls";
import ExpandedMatchDetails from "../components/ExpandedMatchDetails";
import MatchHistoryHeader from "../components/MatchHistoryHeader";
import RuneDisplay from "../components/common/RuneDisplay";
import LiveGamePage from "../components/LiveGamePage";
import riotApiFetchWithRetry from "../components/common/apiFetch";
import { getContinentalRoute, delay, timeAgo, formatGameDurationMMSS, formatGameMode, getKDAColorClass, getKDAStringSpans, getKDARatio, getCSString, processTimelineData, QUEUE_IDS } from "../utils/matchCalculations";
import SideContainer from "../components/SideContainer";

import topIcon from "../assets/top_icon.svg";
import jungleIcon from "../assets/jungle_icon.svg";
import middleIcon from "../assets/mid_icon.svg";
import bottomIcon from "../assets/bottom_icon.svg";
import supportIcon from "../assets/support_icon.svg";

const ViewSwitcher = ({ activeView, setActiveView }) => {
  const buttonBaseClass = "relative group flex items-center gap-2 px-4 py-1.5 text-sm font-semibold rounded-md transition-colors duration-150 ease-in-out cursor-pointer focus:outline-none";

  return (
    <div className="w-full bg-black-800 py-1 rounded-b-4xl">
      <div className="mx-auto px-4 sm:px-6 lg:px-8 flex justify-center">
        <div className="flex p-1 rounded-lg">
          <button onClick={() => setActiveView("matchHistory")} className={`${buttonBaseClass} ${activeView === "matchHistory" ? "text-white" : "text-gray-400 hover:text-white"}`}>
            <History size={16} className={`flex-shrink-0 transition-colors ${activeView === "matchHistory" ? "text-orange-400" : "text-gray-500 group-hover:text-orange-400"}`} />
            <span>Match List</span>
            <span
              className={`
                absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-[3px] bg-orange-500 rounded-t-sm
                transition-all duration-300 ease-in-out
                ${activeView === "matchHistory" ? "w-1/3" : "w-0"}
              `}
            />
          </button>
          <button onClick={() => setActiveView("liveGame")} className={`${buttonBaseClass} ${activeView === "liveGame" ? "text-white" : "text-gray-400 hover:text-white"}`}>
            <Radio size={16} className={`flex-shrink-0 transition-colors ${activeView === "liveGame" ? "text-orange-400" : "text-gray-500 group-hover:text-orange-400"}`} />
            <span>Live Game</span>
            <span
              className={`
                absolute bottom-0 left-1/2 -translate-x-1/2 h-[3px] bg-orange-500 rounded-t-sm
                transition-all duration-300 ease-in-out
                ${activeView === "liveGame" ? "w-1/3" : "w-0"}
              `}
            />
          </button>
        </div>
      </div>
    </div>
  );
};
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
const INITIAL_FILTERS_STATE = { patch: [], champion: "", opponentChampion: "", withPlayer: "", dateRange: { startDate: "", endDate: "" }, role: "" };

const PREDEFINED_MISTAKE_TAGS = [
  { label: "Positioning Error", value: "positioning_error" },
  { label: "Vision Gap", value: "vision_gap" },
  { label: "Trade timers", value: "bad_trade" },
  { label: "Wave Management", value: "wave_management" },
  { label: "Overextended", value: "overextended" },
  { label: "Map Awareness", value: "map_awareness" },
  { label: "Failed Mechanics", value: "failed_mechanics" },
  { label: "Poor Objective Control", value: "objective_control" },
  { label: "Rotations", value: "rotations_problem" },
];

const MISTAKE_TAGS_MAP = PREDEFINED_MISTAKE_TAGS.reduce((acc, tag) => {
  acc[tag.value] = tag.label;
  return acc;
}, {});

const ConditionalTagTooltip = ({ label }) => {
  const textRef = useRef(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useLayoutEffect(() => {
    const element = textRef.current;
    if (element && element.scrollWidth > element.clientWidth) {
      setIsOverflowing(true);
    } else {
      setIsOverflowing(false);
    }
  }, [label]);

  return (
    <Tooltip title={isOverflowing ? label : null} classNames={{ root: "custom-tooltip" }}>
      <span ref={textRef} className="flex-1 text-center px-1.5 py-0.5 text-[10px] font-semibold text-red-200 bg-red-900/70 rounded-md truncate flex items-center justify-center">
        {label}
      </span>
    </Tooltip>
  );
};

const ReviewHub = ({ match, onOpenNotes }) => {
  const hasMeaningfulReview = (Array.isArray(match.goals) && match.goals.some((g) => g.text?.trim())) || match.actionableTakeaway?.trim() || match.generalNotes?.trim() || match.positiveMoment?.trim() || match.keyMistake?.trim() || match.vibeTags?.length > 0;

  if (!hasMeaningfulReview) {
    return (
      <div className="h-[77px] p-0.5 rounded-lg bg-gradient-to-br from-orange-500/40 via-orange-600/40 to-amber-500/40 group-hover:from-orange-500/70 group-hover:to-amber-500/70 transition-all cursor-pointer" onClick={() => onOpenNotes(match)}>
        <div className="bg-gray-800/80 hover:bg-gray-800/95 h-full rounded-md flex flex-col items-center justify-center text-center p-2">
          <div className="w-8 h-8 rounded-full bg-orange-600/30 flex items-center justify-center mb-1 animate-pulse group-hover:animate-none">
            <Edit size={16} className="text-orange-400" />
          </div>
          <p className="text-sm font-semibold text-orange-400">Add Insights</p>
          <p className="text-xs text-gray-500">Review this game</p>
        </div>
      </div>
    );
  }

  const MAX_GOALS_TO_SHOW = 1;
  const MAX_TAGS_TO_SHOW = 2;

  const validGoals = Array.isArray(match.goals) ? match.goals.filter((g) => g.text?.trim()) : [];
  const validTags = match.keyMistakeTags || [];

  const visibleGoal = validGoals[0];
  const hiddenGoalsCount = Math.max(0, validGoals.length - MAX_GOALS_TO_SHOW);

  const visibleTags = validTags.slice(0, MAX_TAGS_TO_SHOW);
  const hiddenTagsCount = validTags.length - visibleTags.length;

  const goalTextRef = useRef(null);
  const [isGoalOverflowing, setIsGoalOverflowing] = useState(false);

  useLayoutEffect(() => {
    const element = goalTextRef.current;
    if (element) {
      setIsGoalOverflowing(element.scrollWidth > element.clientWidth);
    }
  }, [visibleGoal]);

  const goalPopoverContent = (
    <div className="flex flex-col gap-1.5">
      {validGoals.slice(MAX_GOALS_TO_SHOW).map((goal, index) => (
        <div key={`goal-popover-${index}`} className="bg-gray-950/50 p-2 rounded-md max-w-xs text-left">
          <p className="text-sm text-gray-300">{goal.text}</p>
        </div>
      ))}
    </div>
  );

  const tagsPopoverContent = (
    <div className="flex flex-col gap-1.5 max-w-xs">
      {validTags.slice(MAX_TAGS_TO_SHOW).map((tag) => (
        <span key={`tag-popover-${tag}`} className="px-1.5 py-0.5 text-[10px] text-center font-semibold text-red-200 bg-red-900/70 rounded-md">
          {MISTAKE_TAGS_MAP[tag] || tag}
        </span>
      ))}
    </div>
  );

  return (
    <div className="relative bg-gray-900/40 p-2.5 rounded-lg border border-gray-700/80 hover:border-sky-500/80 transition-all cursor-pointer h-full group flex flex-col justify-between" onClick={() => onOpenNotes(match)}>
      <div className="space-y-1 flex flex-col flex-grow">
        <div className="flex items-stretch justify-between gap-1.5">
          {visibleGoal ? (
            <Tooltip title={isGoalOverflowing ? visibleGoal.text : null} classNames={{ root: "custom-tooltip" }} overlayClassName="goal-title-tooltip">
              <div className="flex-grow bg-gray-950/30 p-2 rounded-md min-w-0">
                <div className="flex items-start">
                  <Target size={14} className="text-orange-500 mr-1 mt-0.5 flex-shrink-0" />
                  <p ref={goalTextRef} className="text-[0.7rem] leading-snug text-gray-200 truncate">
                    {visibleGoal.text}
                  </p>
                </div>
              </div>
            </Tooltip>
          ) : (
            <div className="flex items-center h-full flex-grow">
              <h4 className="text-xs font-bold text-sky-400 uppercase tracking-wider">Review</h4>
            </div>
          )}
          {hiddenGoalsCount > 0 && (
            <Popover content={goalPopoverContent} trigger="hover" placement="top" overlayInnerStyle={{ padding: "8px", backgroundColor: "#18181b", borderRadius: "6px", border: "1px solid #3f3f46" }}>
              <div className="flex-shrink-0 w-6 bg-sky-700 rounded text-white text-xs font-bold flex items-center justify-center cursor-pointer hover:bg-sky-500" onClick={(e) => e.stopPropagation()}>
                +{hiddenGoalsCount}
              </div>
            </Popover>
          )}
        </div>

        <div className="flex items-stretch gap-1.5 mt-auto">
          {visibleTags.map((tag) => (
            <ConditionalTagTooltip key={tag} label={MISTAKE_TAGS_MAP[tag] || tag} />
          ))}
          {hiddenTagsCount > 0 && (
            <Popover content={tagsPopoverContent} trigger="hover" placement="bottom" overlayInnerStyle={{ padding: "8px", backgroundColor: "#18181b", borderRadius: "6px", border: "1px solid #3f3f46" }}>
              <div className="flex-shrink-0 w-5 bg-red-800/80 rounded text-white text-[10px] font-bold flex items-center justify-center cursor-pointer hover:bg-red-700" onClick={(e) => e.stopPropagation()}>
                +{hiddenTagsCount}
              </div>
            </Popover>
          )}
        </div>
      </div>
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
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [isUpdatingAllMatches, setIsUpdatingAllMatches] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [updateProgress, setUpdateProgress] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [ddragonVersion, setDdragonVersion] = useState("");
  const [summonerSpellsMap, setSummonerSpellsMap] = useState({});
  const [runesMap, setRunesMap] = useState({});
  const [championData, setChampionData] = useState(null);
  const [itemData, setItemData] = useState(null);
  const [runesDataFromDDragon, setRunesDataFromDDragon] = useState([]);
  const [filters, setFilters] = useState(INITIAL_FILTERS_STATE);
  const [updateFetchDates, setUpdateFetchDates] = useState({ startDate: "", endDate: "" });
  const [goalTemplates, setGoalTemplates] = useState([]);
  const [activeView, setActiveView] = useState("matchHistory");
  const [activePreGameGoals, setActivePreGameGoals] = useState([]);

  const [showPreGameGoalSetter, setShowPreGameGoalSetter] = useState(false);
  const [customPreGameGoalText, setCustomPreGameGoalText] = useState("");
  const [selectedPreGameTemplateId, setSelectedPreGameTemplateId] = useState("");
  const preGameGoalSetterRef = useRef(null);

  const matchListContainerRef = useRef(null);
  const prevPageRef = useRef(currentPage);

  useEffect(() => {
    try {
      const storedGoals = localStorage.getItem("activePreGameGoals");
      if (storedGoals) {
        setActivePreGameGoals(JSON.parse(storedGoals));
      }
    } catch (error) {
      console.error("Error loading pre-game goals from localStorage:", error);
      setActivePreGameGoals([]);
    }
  }, []);

  const handleAddPreGameGoal = (templateId = null, customText = null) => {
    let newGoal = null;
    
    // Use passed parameters if provided, otherwise fall back to state
    const templateIdToUse = templateId !== null ? templateId : selectedPreGameTemplateId;
    const customTextToUse = customText !== null ? customText : customPreGameGoalText;
    
    if (templateIdToUse) {
      const template = goalTemplates.find((t) => t.id.toString() === templateIdToUse);
      if (template) {
        newGoal = { id: Date.now(), text: template.title, templateId: template.id, category: template.category, setAt: Date.now() };
      }
    } else if (customTextToUse && customTextToUse.trim()) {
      newGoal = { id: Date.now(), text: customTextToUse.trim(), setAt: Date.now() };
    }

    if (newGoal) {
      const updatedGoals = [...activePreGameGoals, newGoal];
      localStorage.setItem("activePreGameGoals", JSON.stringify(updatedGoals));
      setActivePreGameGoals(updatedGoals);
      setCustomPreGameGoalText("");
      setSelectedPreGameTemplateId("");
    }
  };

  const handleRemovePreGameGoal = (goalId) => {
    const updatedGoals = activePreGameGoals.filter((g) => g.id !== goalId);
    localStorage.setItem("activePreGameGoals", JSON.stringify(updatedGoals));
    setActivePreGameGoals(updatedGoals);
  };

  const handleClearPreGameFocus = () => {
    localStorage.removeItem("activePreGameGoals");
    setActivePreGameGoals([]);
    setShowPreGameGoalSetter(false);
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

  const fetchGoalTemplatesForHeader = useCallback(async () => {
    try {
      const templatesFromDb = await db.goalTemplates.orderBy("title").toArray();
      setGoalTemplates(templatesFromDb);
    } catch (err) {
      console.error("Error fetching goal templates for header:", err);
    }
  }, []);

  useEffect(() => {
    fetchGoalTemplatesForHeader();
  }, [fetchGoalTemplatesForHeader]);

  useEffect(() => {
    if (!RIOT_API_KEY) setError("Configuration Error: Riot API Key is missing.");
    fetch("https://ddragon.leagueoflegends.com/api/versions.json")
      .then((res) => res.json())
      .then((versions) => {
        if (versions && versions.length > 0) {
          const latestVersion = versions[0];
          setDdragonVersion(latestVersion);
          const staticDataFetches = [
            fetch(`https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/en_US/summoner.json`).then((res) => res.json()),
            fetch(`https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/en_US/runesReforged.json`).then((res) => res.json()),
            fetch(`https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/en_US/champion.json`).then((res) => res.json()),
            fetch(`https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/en_US/item.json`).then((res) => res.json()),
          ];
          Promise.all(staticDataFetches)
            .then(([summonerData, rawRunesData, champData, newItemData]) => {
              const spells = {};
              if (summonerData && summonerData.data) {
                for (const key in summonerData.data) spells[summonerData.data[key].key] = summonerData.data[key];
              }
              setSummonerSpellsMap(spells);
              const flatRunes = {};
              if (rawRunesData && Array.isArray(rawRunesData)) {
                rawRunesData.forEach((style) => {
                  flatRunes[style.id] = { icon: style.icon, name: style.name, key: style.key };
                  style.slots.forEach((slot) => slot.runes.forEach((rune) => (flatRunes[rune.id] = { icon: rune.icon, name: rune.name, key: rune.key, styleId: style.id })));
                });
                setRunesDataFromDDragon(rawRunesData);
              }
              setRunesMap(flatRunes);
              if (champData && champData.data) setChampionData(champData.data);
              if (newItemData && newItemData.data) setItemData(newItemData.data);
            })
            .catch((err) => {
              console.error("Error fetching DDragon static data:", err);
              setError("Failed to load essential game data (DDragon).");
            });
        }
      })
      .catch((err) => {
        console.error("Failed to fetch DDragon versions:", err);
        setError("Failed to load DDragon versions.");
      });
  }, []);
  const fetchTrackedAccounts = useCallback(async () => {
    setIsLoadingAccounts(true);
    try {
      const accountsFromDb = await db.trackedAccounts.toArray();
      setTrackedAccounts(accountsFromDb.map((acc) => ({ ...acc, docId: acc.id })));
    } catch (err) {
      console.error("Error fetching tracked accounts from Dexie:", err);
      setError("Could not load tracked accounts.");
    } finally {
      setIsLoadingAccounts(false);
    }
  }, []);
  useEffect(() => {
    fetchTrackedAccounts();
  }, [fetchTrackedAccounts]);
  const fetchAllMatchesFromDb = useCallback(async () => {
    if (trackedAccounts.length === 0 && !isLoadingAccounts) {
      setAllMatchesFromDb([]);
      setIsLoadingMatches(false);
      return;
    }
    if (trackedAccounts.length === 0 && isLoadingAccounts) return;
    setIsLoadingMatches(true);
    setError("");
    try {
      let combinedMatches = [];
      for (const account of trackedAccounts) {
        const accountMatches = await db.matches.where("trackedAccountDocId").equals(account.id).toArray();
        const matchesWithAccountInfo = accountMatches.map((match) => ({ ...match, trackedAccountDocId: account.id, trackedAccountName: `${account.name}#${account.tag}`, trackedAccountPlatform: account.platformId }));
        combinedMatches = [...combinedMatches, ...matchesWithAccountInfo];
      }
      combinedMatches.sort((a, b) => (b.gameCreation || 0) - (a.gameCreation || 0));
      setAllMatchesFromDb(combinedMatches);
    } catch (err) {
      console.error(`Error fetching stored matches from Dexie:`, err);
      setError(`Failed to load stored matches.`);
    } finally {
      setIsLoadingMatches(false);
    }
  }, [trackedAccounts, isLoadingAccounts]);
  useEffect(() => {
    if (!isLoadingAccounts) fetchAllMatchesFromDb();
  }, [isLoadingAccounts, fetchAllMatchesFromDb]);
  const availableChampions = useMemo(() => {
    const champNames = new Set(allMatchesFromDb.map((match) => match.championName).filter(Boolean));
    return Array.from(champNames).sort();
  }, [allMatchesFromDb]);
  const availableOpponentChampions = useMemo(() => {
    const champNames = new Set(allMatchesFromDb.map((match) => match.opponentChampionName).filter(Boolean));
    return Array.from(champNames).sort();
  }, [allMatchesFromDb]);
  const availablePatches = useMemo(() => {
    const patchVersions = new Set(allMatchesFromDb.map((match) => match.gamePatchVersion).filter((p) => p && p !== "N/A"));
    return Array.from(patchVersions).sort((a, b) => {
      const [aMajor, aMinor] = a.split(".").map(Number);
      const [bMajor, bMinor] = b.split(".").map(Number);
      if (aMajor !== bMajor) return bMajor - aMajor;
      return bMinor - aMinor;
    });
  }, [allMatchesFromDb]);
  const handleFilterChange = useCallback((e) => {
    const { name, value } = e.target;
    if (name === "dateRange") {
      setFilters((prev) => ({ ...prev, dateRange: value }));
    } else {
      setFilters((prev) => ({ ...prev, [name]: value }));
    }
    setCurrentPage(1);
    setExpandedMatchId(null);
  }, []);
  const handleDatePresetFilter = useCallback((preset) => {
    const today = new Date();
    let startDate = "";
    let endDate = today.toISOString().split("T")[0];
    if (preset === "last7days") {
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);
      startDate = sevenDaysAgo.toISOString().split("T")[0];
    } else if (preset === "last30days") {
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);
      startDate = thirtyDaysAgo.toISOString().split("T")[0];
    } else if (preset === "thisMonth") {
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      startDate = firstDayOfMonth.toISOString().split("T")[0];
    }
    setFilters((prev) => ({ ...prev, dateRange: { startDate, endDate } }));
    setCurrentPage(1);
    setExpandedMatchId(null);
  }, []);
  const handleUpdateFetchDateChange = useCallback((e) => {
    if (e.target.name === "dateRange") {
      setUpdateFetchDates(e.target.value);
    }
  }, []);
  const handleClearFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS_STATE);
    setCurrentPage(1);
    setExpandedMatchId(null);
  }, []);
  const filteredMatches = useMemo(() => {
    return allMatchesFromDb.filter((match) => {
      if (filters.patch && filters.patch.length > 0) {
        if (!filters.patch.includes(match.gamePatchVersion)) return false;
      }
      if (filters.champion && match.championName !== filters.champion) return false;
      if (filters.opponentChampion && match.opponentChampionName !== filters.opponentChampion) return false;
      if (filters.role && match.teamPosition && match.teamPosition.toUpperCase() !== filters.role) return false;
      if (filters.withPlayer) {
        const [name, tag] = filters.withPlayer.toLowerCase().split("#");
        const foundPlayer = match.allParticipants?.some((p) => (p.riotIdGameName?.toLowerCase() === name && p.riotIdTagline?.toLowerCase() === tag) || p.summonerName?.toLowerCase() === name);
        if (!foundPlayer) return false;
      }
      if (filters.dateRange.startDate) {
        const matchDate = new Date(match.gameCreation);
        const startDate = new Date(filters.dateRange.startDate);
        startDate.setHours(0, 0, 0, 0);
        if (matchDate < startDate) return false;
      }
      if (filters.dateRange.endDate) {
        const matchDate = new Date(match.gameCreation);
        const endDate = new Date(filters.dateRange.endDate);
        endDate.setHours(23, 59, 59, 999);
        if (matchDate > endDate) return false;
      }
      return true;
    });
  }, [allMatchesFromDb, filters]);
  const totalPages = useMemo(() => {
    const TPages = Math.ceil(filteredMatches.length / MATCHES_PER_PAGE);
    return TPages > 0 ? TPages : 1;
  }, [filteredMatches]);
  useEffect(() => {
    if (totalPages === 1 && currentPage !== 1) {
      setCurrentPage(1);
    } else if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage, filteredMatches.length]);
  useEffect(() => {
    if (filteredMatches.length === 0) {
      setGroupedMatches({});
      return;
    }
    const startIndex = (currentPage - 1) * MATCHES_PER_PAGE;
    const endIndex = startIndex + MATCHES_PER_PAGE;
    const matchesForCurrentPage = filteredMatches.slice(startIndex, endIndex);
    const groups = matchesForCurrentPage.reduce((acc, match) => {
      if (!match.gameCreation) return acc;
      const dateObj = new Date(match.gameCreation);
      const currentYear = new Date().getFullYear();
      let dateKey = dateObj.getFullYear() === currentYear ? dateObj.toLocaleDateString("en-US", { month: "long", day: "numeric" }) : dateObj.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(match);
      return acc;
    }, {});
    setGroupedMatches(groups);
  }, [currentPage, filteredMatches]);
  useEffect(() => {
    const pageActuallyChanged = prevPageRef.current !== currentPage;
    prevPageRef.current = currentPage;
    if (pageActuallyChanged && matchListContainerRef.current) {
      setTimeout(() => {
        if (matchListContainerRef.current && matchListContainerRef.current.scrollHeight > matchListContainerRef.current.clientHeight) {
          matchListContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
        }
      }, 0);
    }
  }, [currentPage, groupedMatches]);
  useEffect(() => {
    const matchesWithNewFlag = allMatchesFromDb.filter((m) => m.isNew);
    if (matchesWithNewFlag.length > 0) {
      const timer = setTimeout(() => {
        setAllMatchesFromDb((prevMatches) => prevMatches.map((m) => (m.isNew ? { ...m, isNew: false } : m)));
      }, ANIMATION_DURATION_MS + 100);
      return () => clearTimeout(timer);
    }
  }, [allMatchesFromDb]);

  const handleUpdateAllMatches = async (customStartDate, customEndDate) => {
    if (!RIOT_API_KEY) {
      setError("Riot API Key is missing.");
      return;
    }
    if (trackedAccounts.length === 0) {
      setError("No tracked accounts to update.");
      return;
    }
    setIsUpdatingAllMatches(true);
    setError("");
    setSuccessMessage("");
    setUpdateProgress(`Starting update for ${trackedAccounts.length} accounts...`);
    let totalNewMatchesActuallyStoredThisSession = 0;
    let startTimeEpoch = null;
    let endTimeEpoch = null;
    let countToFetch = MATCH_COUNT_PER_FETCH;
    if (customStartDate) {
      startTimeEpoch = Math.floor(new Date(customStartDate).setHours(0, 0, 0, 0) / 1000);
      countToFetch = HISTORICAL_MATCH_COUNT_PER_FETCH;
    } else {
      startTimeEpoch = Math.floor((Date.now() - 14 * 24 * 60 * 60 * 1000) / 1000);
    }
    if (customEndDate) {
      endTimeEpoch = Math.floor(new Date(customEndDate).setHours(23, 59, 59, 999) / 1000);
    }
    for (let i = 0; i < trackedAccounts.length; i++) {
      const account = trackedAccounts[i];
      if (!account.puuid || !account.platformId) {
        setUpdateProgress(`Skipped ${account.name}#${account.tag} (missing PUUID/Platform). (${i + 1}/${trackedAccounts.length})`);
        continue;
      }
      setUpdateProgress(`Updating ${account.name}#${account.tag} (${i + 1}/${trackedAccounts.length})...`);
      try {
        const continentalRoute = getContinentalRoute(account.platformId);
        let matchlistUrl = `https://${continentalRoute}.api.riotgames.com/lol/match/v5/matches/by-puuid/${account.puuid}/ids?`;
        if (startTimeEpoch) matchlistUrl += `startTime=${startTimeEpoch}&`;
        if (endTimeEpoch) matchlistUrl += `endTime=${endTimeEpoch}&`;
        matchlistUrl += `queue=${QUEUE_IDS.RANKED_SOLO}&count=${countToFetch}&api_key=${RIOT_API_KEY}`;
        await delay(API_CALL_DELAY_MS);
        const response = await riotApiFetchWithRetry(matchlistUrl);
        if (!response.ok) {
          const errData = await response.json().catch(() => ({ message: "Unknown Riot API error (fetching match IDs)" }));
          console.error(`Riot API error for ${account.name} (Match IDs): ${response.status}`, errData);
          setError(`Error for ${account.name} (IDs): ${errData.status?.message || response.statusText}`);
          continue;
        }
        const matchIdsFromApi = await response.json();
        if (matchIdsFromApi.length === 0) {
          setUpdateProgress(`No new API matches for ${account.name}#${account.tag} in the specified range. (${i + 1}/${trackedAccounts.length})`);
          if (!customStartDate && !customEndDate) {
            await db.trackedAccounts.update(account.id, { lastUpdated: new Date().getTime() });
          }
          continue;
        }
        setUpdateProgress(`Found ${matchIdsFromApi.length} IDs for ${account.name}. Checking & fetching...`);
        let newMatchesProcessedForThisAccount = 0;
        for (const [index, matchId] of matchIdsFromApi.entries()) {
          if (!customStartDate && newMatchesProcessedForThisAccount >= MATCH_DETAILS_TO_PROCESS_PER_ACCOUNT_UPDATE) break;
          const existingMatch = await db.matches.get(matchId);
          const needsTimelineFetch = !existingMatch || !existingMatch.rawTimelineFrames || existingMatch.rawTimelineFrames.length === 0;
          if (existingMatch && !needsTimelineFetch) continue;

          setUpdateProgress(
            <span>
              Updating {account.name}#{account.tag} ({index + 1}/{matchIdsFromApi.length})
            </span>
          );

          await delay(API_CALL_DELAY_MS);
          const matchDetailUrl = `https://${continentalRoute}.api.riotgames.com/lol/match/v5/matches/${matchId}?api_key=${RIOT_API_KEY}`;
          const detailResponse = await riotApiFetchWithRetry(matchDetailUrl);
          if (!detailResponse.ok) {
            console.warn(`Failed to fetch details for ${matchId}. Status: ${detailResponse.status}`);
            continue;
          }
          const matchDetail = await detailResponse.json();
          let gameSpecificPatch = "N/A";
          if (matchDetail.info && matchDetail.info.gameVersion) {
            const versionString = matchDetail.info.gameVersion;
            const versionParts = versionString.split(".");
            if (versionParts.length >= 2) gameSpecificPatch = `${versionParts[0]}.${versionParts[1]}`;
            else gameSpecificPatch = versionString;
          }

          let ranks = {};
          if (matchDetail.info && matchDetail.info.participants) {
            await delay(API_CALL_DELAY_MS);
            const rankPromises = matchDetail.info.participants.map((p) => {
              const url = `https://${account.platformId}.api.riotgames.com/lol/league/v4/entries/by-puuid/${p.puuid}?api_key=${RIOT_API_KEY}`;
              return riotApiFetchWithRetry(url).then((res) => res.json());
            });

            const results = await Promise.allSettled(rankPromises);
            results.forEach((result, pIndex) => {
              const puuid = matchDetail.info.participants[pIndex].puuid;
              if (result.status === "fulfilled" && result.value) {
                const rankedSoloInfo = result.value.find((q) => q.queueType === "RANKED_SOLO_5x5");
                ranks[puuid] = rankedSoloInfo || { tier: "UNRANKED", rank: "" };
              } else {
                ranks[puuid] = { tier: "UNRANKED" };
              }
            });
          }

          let currentRawTimelineFrames = existingMatch?.rawTimelineFrames || [];
          if (needsTimelineFetch) {
            await delay(API_CALL_DELAY_MS);
            const timelineUrl = `https://${continentalRoute}.api.riotgames.com/lol/match/v5/matches/${matchId}/timeline?api_key=${RIOT_API_KEY}`;
            const timelineResponse = await riotApiFetchWithRetry(timelineUrl);
            if (timelineResponse.ok) {
              const timelineJson = await timelineResponse.json();
              currentRawTimelineFrames = timelineJson.info?.frames || [];
            } else {
              console.warn(`Failed to fetch timeline for ${matchId}. Status: ${timelineResponse.status}`);
            }
          }
          const playerParticipant = matchDetail.info.participants.find((p) => p.puuid === account.puuid);
          if (playerParticipant) {
            let opponentParticipant = null;
            let opponentParticipantIdForTimeline = null;
            if (playerParticipant.teamPosition && playerParticipant.teamPosition !== "") {
              opponentParticipant = matchDetail.info.participants.find((p) => p.teamId !== playerParticipant.teamId && p.teamPosition === playerParticipant.teamPosition);
            }
            if (opponentParticipant) opponentParticipantIdForTimeline = matchDetail.info.participants.findIndex((p) => p.puuid === opponentParticipant.puuid) + 1;
            const playerParticipantIdForTimeline = matchDetail.info.participants.findIndex((p) => p.puuid === playerParticipant.puuid) + 1;
            const processedTimeline = processTimelineData(currentRawTimelineFrames, playerParticipantIdForTimeline, opponentParticipantIdForTimeline, matchDetail.info.gameDuration);
            const matchDataToStore = {
              matchId: matchDetail.metadata.matchId,
              trackedAccountDocId: account.id,
              gameCreation: matchDetail.info.gameCreation,
              gameDuration: matchDetail.info.gameDuration,
              gameMode: matchDetail.info.gameMode,
              queueId: matchDetail.info.queueId,
              gamePatchVersion: gameSpecificPatch,
              platformId: account.platformId,
              puuid: account.puuid,
              win: playerParticipant.win,
              championName: playerParticipant.championName,
              championId: playerParticipant.championId,
              championLevel: playerParticipant.champLevel,
              teamPosition: playerParticipant.teamPosition,
              kills: playerParticipant.kills,
              deaths: playerParticipant.deaths,
              assists: playerParticipant.assists,
              totalMinionsKilled: playerParticipant.totalMinionsKilled,
              neutralMinionsKilled: playerParticipant.neutralMinionsKilled,
              goldEarned: playerParticipant.goldEarned,
              item0: playerParticipant.item0,
              item1: playerParticipant.item1,
              item2: playerParticipant.item2,
              item3: playerParticipant.item3,
              item4: playerParticipant.item4,
              item5: playerParticipant.item5,
              item6: playerParticipant.item6,
              summoner1Id: playerParticipant.summoner1Id,
              summoner2Id: playerParticipant.summoner2Id,
              perks: playerParticipant.perks,
              opponentChampionName: opponentParticipant ? opponentParticipant.championName : null,
              mainGoal: existingMatch?.mainGoal || "",
              goalAchieved: existingMatch?.goalAchieved || "",
              goalDifficultyReason: existingMatch?.goalDifficultyReason || "",
              positiveMoment: existingMatch?.positiveMoment || "",
              keyMistake: existingMatch?.keyMistake || "",
              actionableTakeaway: existingMatch?.actionableTakeaway || "",
              gameRating: existingMatch?.gameRating || null,
              mentalRating: existingMatch?.mentalRating || null,
              generalNotes: existingMatch?.generalNotes || "",
              vibeTags: existingMatch?.vibeTags || [],
              notes: existingMatch?.notes || "",
              goals: existingMatch?.goals || "",
              rating: existingMatch?.rating || null,
              allParticipants: matchDetail.info.participants.map((p) => ({
                puuid: p.puuid,
                summonerName: p.summonerName,
                riotIdGameName: p.riotIdGameName,
                riotIdTagline: p.riotIdTagline,
                championName: p.championName,
                champLevel: p.champLevel,
                teamId: p.teamId,
                teamPosition: p.teamPosition,
                kills: p.kills,
                deaths: p.deaths,
                assists: p.assists,
                totalMinionsKilled: p.totalMinionsKilled,
                neutralMinionsKilled: p.neutralMinionsKilled,
                goldEarned: p.goldEarned,
                totalDamageDealtToChampions: p.totalDamageDealtToChampions,
                damageDealtToTurrets: p.damageDealtToTurrets,
                visionScore: p.visionScore,
                wardsPlaced: p.wardsPlaced,
                wardsKilled: p.wardsKilled,
                visionWardsBoughtInGame: p.visionWardsBoughtInGame,
                item0: p.item0,
                item1: p.item1,
                item2: p.item2,
                item3: p.item3,
                item4: p.item4,
                item5: p.item5,
                item6: p.item6,
                summoner1Id: p.summoner1Id,
                summoner2Id: p.summoner2Id,
                perks: p.perks,
                rankInfo: ranks[p.puuid] || { tier: "UNRANKED", rank: "" },
              })),
              teamObjectives: matchDetail.info.teams.map((t) => ({ teamId: t.teamId, win: t.win, objectives: t.objectives })),
              processedTimelineForTrackedPlayer: processedTimeline,
              rawTimelineFrames: currentRawTimelineFrames,
            };
            await db.matches.put(matchDataToStore);
            const matchForDisplay = { ...matchDataToStore, trackedAccountName: `${account.name}#${account.tag}`, trackedAccountPlatform: account.platformId, isNew: true };
            setAllMatchesFromDb((prevMatches) => {
              const newMatchesList = prevMatches.filter((m) => m.matchId !== matchForDisplay.matchId);
              newMatchesList.push(matchForDisplay);
              newMatchesList.sort((a, b) => (b.gameCreation || 0) - (a.gameCreation || 0));
              return newMatchesList;
            });
            if (!existingMatch || needsTimelineFetch) totalNewMatchesActuallyStoredThisSession++;
            newMatchesProcessedForThisAccount++;
          }
        }
        if (!customStartDate && !customEndDate) {
          await db.trackedAccounts.update(account.id, { lastUpdated: new Date().getTime() });
        }
      } catch (err) {
        console.error(`Error processing account ${account.name}#${account.tag}:`, err);
        setError(`Update error for ${account.name}. Check console.`);
      }
    }
    setUpdateProgress(`Update finished. Newly stored/updated with timeline: ${totalNewMatchesActuallyStoredThisSession}.`);
    if (totalNewMatchesActuallyStoredThisSession > 0) {
      setSuccessMessage(`${totalNewMatchesActuallyStoredThisSession} matches updated/added.`);
    } else {
      setSuccessMessage(`No new matches found to update this session.`);
    }
    setTimeout(() => setSuccessMessage(""), 4000);
    setIsUpdatingAllMatches(false);
  };

  const handleOpenNotes = (match) => {
    setSelectedMatchForNotes({
      ...match,
      activePreGameGoal: activePreGameGoals,
      getChampionImage: getChampionImage,
      getChampionDisplayName: getChampionDisplayName,
    });
  };

  const handleCloseNotes = () => {
    setSelectedMatchForNotes(null);
  };

  const handleSaveNotes = async (matchIdToSave, newNotesData) => {
    if (!matchIdToSave) {
      setError("Error: Cannot save notes. Missing match ID.");
      return;
    }
    setIsSavingNotes(true);
    setError("");
    setSuccessMessage("");
    try {
      await db.matches.update(matchIdToSave, { ...newNotesData });
      setAllMatchesFromDb((prevMatches) => prevMatches.map((m) => (m.matchId === matchIdToSave ? { ...m, ...newNotesData, isNew: false } : m)));
      setSelectedMatchForNotes((prev) => (prev && prev.matchId === matchIdToSave ? { ...prev, ...newNotesData } : prev));
      setSuccessMessage("Review saved successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      console.error("Error saving notes to Dexie in MatchHistoryPage:", err);
      setError("Failed to save notes. Check console for details.");
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    setExpandedMatchId(null);
  };

  const getChampionInfo = (championKeyApi) => {
    if (!championData || !championKeyApi) return { displayName: championKeyApi, imageName: championKeyApi + ".png", ddragonId: championKeyApi };
    let ddragonKeyToLookup = championKeyApi === "Fiddlesticks" ? "FiddleSticks" : championKeyApi;
    const championInfo = championData[ddragonKeyToLookup] || Object.values(championData).find((c) => c.id.toLowerCase() === championKeyApi.toLowerCase());
    return championInfo ? { displayName: championInfo.name, imageName: championInfo.image.full, ddragonId: championInfo.id } : { displayName: championKeyApi, imageName: championKeyApi + ".png", ddragonId: championKeyApi };
  };
  const getChampionImage = (identifier) => {
    if (!identifier || !ddragonVersion || !championData) {
      return `https://placehold.co/56x56/2D2D2D/666?text=?`;
    }

    let championInfo = null;

    if (!isNaN(parseInt(identifier))) {
      championInfo = Object.values(championData).find((c) => c.key == identifier);
    } else {
      let ddragonKeyToLookup = identifier === "Fiddlesticks" ? "FiddleSticks" : identifier;
      championInfo = championData[ddragonKeyToLookup] || Object.values(championData).find((c) => c.id.toLowerCase() === identifier.toLowerCase());
    }

    if (championInfo) {
      return `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${championInfo.image.full}`;
    }

    return `https://placehold.co/56x56/2D2D2D/666?text=${String(identifier).substring(0, 1)}`;
  };
  const getChampionDisplayName = (championKeyApi) => (!championKeyApi || !championData ? championKeyApi || "N/A" : getChampionInfo(championKeyApi).displayName);
  const getItemImage = (itemId) => (!itemId || !ddragonVersion || itemId === 0 ? null : `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/item/${itemId}.png`);
  const getSummonerSpellImage = (spellId) => (!spellId || !ddragonVersion || !summonerSpellsMap[spellId] ? null : `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/spell/${summonerSpellsMap[spellId].image.full}`);
  const getRuneImage = (runeId) => {
    if (!runeId || !ddragonVersion || Object.keys(runesMap).length === 0) return null;
    const runeInfo = runesMap[runeId];
    if (!runeInfo || !runeInfo.icon) {
      return null;
    }
    return `https://ddragon.leagueoflegends.com/cdn/img/${runeInfo.icon}`;
  };
  const toggleExpandMatch = (matchIdToToggle) => {
    setExpandedMatchId((prevId) => (prevId === matchIdToToggle ? null : matchIdToToggle));
  };

  const getItemTooltipContent = (itemId) => {
    if (!itemData || !itemId || !itemData[itemId]) return null;
    const { name, plaintext } = itemData[itemId];
    return (
      <div className="text-left max-w-xs">
        <p className="font-bold text-orange-400 text-base mb-1">{name}</p>
        <p className="text-xs text-gray-300" dangerouslySetInnerHTML={{ __html: plaintext }}></p>
      </div>
    );
  };

  const getSummonerSpellTooltipContent = (spellId) => {
    if (!summonerSpellsMap || !spellId || !summonerSpellsMap[spellId]) return null;
    const { name, description } = summonerSpellsMap[spellId];
    return (
      <div className="text-left max-w-xs">
        <p className="font-bold text-orange-400 text-base mb-1">{name}</p>
        <p className="text-xs text-gray-300" dangerouslySetInnerHTML={{ __html: description }}></p>
      </div>
    );
  };

  const getRuneTooltipContent = (runeId) => {
    if (!runesMap || !runeId || !runesMap[runeId]) return null;
    const { name } = runesMap[runeId];
    return <span className="font-semibold">{name}</span>;
  };

  const MatchItemSkeleton = () => (
    <div className="rounded-lg shadow-lg overflow-hidden group bg-gray-800/40 animate-pulse">
      <div className="flex items-stretch rounded-lg bg-gray-800/40">
        <div className="flex flex-1 items-stretch p-3 ml-1">
          <div className="flex flex-col justify-around items-start w-40 flex-shrink-0 mr-2 space-y-0.5">
            <div className="h-4 bg-gray-700 rounded w-3/4"></div>
            <div className="h-3 bg-gray-700 rounded w-1/2"></div>
            <div className="h-3 bg-gray-700 rounded w-2/3"></div>
          </div>

          <div className="flex items-center justify-center space-x-1.5 flex-shrink-0 mx-1">
            <div className="relative w-13 h-13 rounded-md bg-gray-700"></div>
            <div className="text-gray-400 text-[0.9rem] font-light self-center px-0.5">vs</div>
            <div className="relative w-13 h-13 rounded-md bg-gray-700"></div>
          </div>
          <div className="w-px bg-gray-700/60 self-stretch mx-3"></div>

          <div className="flex items-center space-x-2 bg-gray-900/70 p-2 rounded-lg shadow-inner border border-gray-700/50 flex-shrink-0">
            <div className="flex space-x-1">
              <div className="flex flex-col space-y-0.5">
                <div className="w-6 h-6 bg-gray-700 rounded"></div>
                <div className="w-6 h-6 bg-gray-700 rounded"></div>
              </div>
              <div className="flex flex-col space-y-0.5">
                <div className="w-6 h-6 bg-gray-700 rounded"></div>
                <div className="w-6 h-6 bg-gray-700 rounded"></div>
              </div>
            </div>
            <div className="flex flex-col space-y-0.5">
              <div className="flex space-x-0.5">
                <div className="w-6 h-6 bg-gray-700 rounded"></div>
                <div className="w-6 h-6 bg-gray-700 rounded"></div>
                <div className="w-6 h-6 bg-gray-700 rounded"></div>
                <div className="w-6 h-6 bg-gray-700 rounded"></div>
              </div>
              <div className="flex space-x-0.5">
                <div className="w-6 h-6 bg-gray-700 rounded"></div>
                <div className="w-6 h-6 bg-gray-700 rounded"></div>
                <div className="w-6 h-6 bg-gray-700 rounded"></div>
                <div className="w-6 h-6"></div>
              </div>
            </div>
          </div>
          <div className="w-px bg-gray-700/60 self-stretch mx-3"></div>

          <div className="flex flex-col justify-center flex-grow min-w-[90px] space-y-0.5">
            <div className="h-4 bg-gray-700 rounded w-full"></div>
            <div className="h-3 bg-gray-700 rounded w-1/2"></div>
            <div className="h-3 bg-gray-700 rounded w-2/3"></div>
          </div>
          <div className="flex-shrink-0 flex-grow-0 w-66 mr-4">
            <div className="h-[77px] bg-gray-700 rounded-lg"></div>
          </div>
        </div>
        <div className="flex items-center justify-center bg-gray-700/60 w-8 rounded-r-lg">
          <div className="h-5 w-5 bg-gray-600 rounded-full"></div>
        </div>
      </div>
    </div>
  );

  if (!RIOT_API_KEY && !error.includes("Configuration Error")) {
    return (
      <div className="p-4 sm:p-6 md:p-8 text-gray-100 flex flex-col items-center justify-center h-full">
        <AlertTriangle size={48} className="text-red-500 mb-4" /> <h2 className="text-2xl font-semibold text-red-400 mb-2">Configuration Error</h2> <p className="text-gray-300 text-center max-w-md"> Riot API Key is missing. </p>
      </div>
    );
  }
  const summaryMatches = useMemo(() => {
    return filteredMatches;
  }, [filteredMatches]);

  return (
    <div className="flex flex-1 overflow-hidden h-[calc(100vh)] pt-[90px]">
      <div
        ref={matchListContainerRef}
        className={`text-gray-100 transition-all duration-300 ease-in-out overflow-y-auto custom-scrollbar h-full w-full
                            ${selectedMatchForNotes ? "md:w-3/5 lg:w-2/3 xl:w-3/4" : "w-full"}`}
      >
        <div className="fixed top-[40px] left-0 right-0 z-10">
          <ViewSwitcher activeView={activeView} setActiveView={setActiveView} />
        </div>

        {activeView === "matchHistory" ? (
          <div className="max-w-[81rem] w-full mx-auto flex flex-row items-start gap-4">
            <div className="w-80 flex-shrink-0 hidden lg:block">
              <div className="sticky top-4 mt-4">
                <SideContainer
                  isLoading={isLoadingAccounts && allMatchesFromDb.length === 0}
                  activePreGameGoals={activePreGameGoals}
                  handleClearPreGameFocus={handleClearPreGameFocus}
                  handleRemovePreGameGoal={handleRemovePreGameGoal}
                  showPreGameGoalSetter={showPreGameGoalSetter}
                  setShowPreGameGoalSetter={setShowPreGameGoalSetter}
                  preGameGoalSetterRef={preGameGoalSetterRef}
                  goalTemplates={goalTemplates}
                  selectedPreGameTemplateId={selectedPreGameTemplateId}
                  setSelectedPreGameTemplateId={setSelectedPreGameTemplateId}
                  customPreGameGoalText={customPreGameGoalText}
                  setCustomPreGameGoalText={setCustomPreGameGoalText}
                  handleAddPreGameGoal={handleAddPreGameGoal}
                />
              </div>
            </div>

            <main className="flex-1 min-w-0">
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
                availableOpponentChampions={availableOpponentChampions}
                availablePatches={availablePatches}
                ROLE_ICON_MAP={ROLE_ICON_MAP}
                ROLE_ORDER={ROLE_ORDER}
              />

              <div className="w-full mb-2 flex items-center justify-center">
                {error && !isUpdatingAllMatches && (
                  <div className="w-full p-2.5 bg-red-900/40 text-red-300 border border-red-700/60 rounded-md text-sm text-center">
                    <AlertTriangle size={18} className="inline mr-2" />
                    Error: {error}
                  </div>
                )}
                {successMessage && !error && !isUpdatingAllMatches && <div className="w-full p-2.5 bg-green-800/40 text-green-300 border border-green-700/60 rounded-md text-sm text-center"> {successMessage} </div>}
              </div>

              {isLoadingMatches && !isUpdatingAllMatches && allMatchesFromDb.length === 0 ? (
                <div className="w-full mt-8">
                  <div className="space-y-3">
                    <div className="h-6 bg-gray-700/60 rounded w-1/4 mb-3 animate-pulse"></div>
                    {Array.from({ length: MATCHES_PER_PAGE }).map((_, index) => (
                      <MatchItemSkeleton key={index} />
                    ))}
                  </div>
                </div>
              ) : !isLoadingMatches && filteredMatches.length === 0 && !error && !isUpdatingAllMatches ? (
                <div className="w-full mt-8">
                  <div className="text-center py-10 bg-gray-800/80 backdrop-blur-md rounded-xl shadow-xl border border-dashed border-gray-700/50 min-h-[180px] flex flex-col items-center justify-center">
                    <ListChecks size={48} className="text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 text-lg">{allMatchesFromDb.length > 0 && filteredMatches.length === 0 ? "No matches found for the current filters." : "No matches found."}</p>
                    {allMatchesFromDb.length > 0 && filteredMatches.length === 0 && <p className="text-gray-500 text-sm">Try adjusting or clearing the filters.</p>}
                    {allMatchesFromDb.length === 0 && <p className="text-gray-500 text-sm">Click "Update Matches" to fetch recent games, or add accounts on the 'Accounts' page.</p>}
                  </div>
                </div>
              ) : (
                !isLoadingMatches &&
                Object.keys(groupedMatches).length > 0 && (
                  <div className="space-y-3 pb-8">
                    {Object.entries(groupedMatches).map(([dateKey, matchesOnDate]) => (
                      <div key={dateKey}>
                        <h2 className="text-lg font-semibold text-gray-100 pb-1.5"> {dateKey} </h2>
                        <div className="space-y-1">
                          {matchesOnDate.map((match) => {
                            const participantData = match;
                            const isWin = typeof match.win === "boolean" ? match.win : null;
                            const kdaStringSpans = getKDAStringSpans(participantData);
                            const kdaRatio = getKDARatio(participantData);
                            const kdaColorClass = getKDAColorClass(participantData.kills, participantData.deaths, participantData.assists);
                            const csString = getCSString(participantData);
                            const gameModeDisplay = formatGameMode(match.gameMode, match.queueId);
                            const gameDurationFormatted = formatGameDurationMMSS(match.gameDuration);
                            let primaryPerkId = null;
                            let subStyleId = null;
                            if (match.perks && match.perks.styles && Array.isArray(match.perks.styles) && Object.keys(runesMap).length > 0 && ddragonVersion) {
                              const primaryStyleInfo = match.perks.styles.find((s) => s.description === "primaryStyle");
                              const subStyleInfo = match.perks.styles.find((s) => s.description === "subStyle");
                              if (primaryStyleInfo?.selections?.[0]?.perk) primaryPerkId = primaryStyleInfo.selections[0].perk;
                              if (subStyleInfo?.style) subStyleId = subStyleInfo.style;
                            }
                            const playerRoleIcon = match.teamPosition ? ROLE_ICON_MAP[match.teamPosition.toUpperCase()] : null;
                            const resultBgOverlayClass = isWin === null ? "bg-gray-800/25" : isWin ? "bg-blue-900/20" : "bg-red-900/20";
                            const expandButtonBgClass = isWin === null ? "bg-gray-700/60 hover:bg-gray-600/80" : isWin ? "bg-blue-900/25 hover:bg-[#304A80]" : "bg-red-900/25 hover:bg-[#582C3A]";
                            const isExpanded = expandedMatchId === match.matchId;
                            const animationClass = match.isNew ? "match-item-enter-active" : "";
                            const summoner1Img = getSummonerSpellImage(match.summoner1Id);
                            const summoner2Img = getSummonerSpellImage(match.summoner2Id);
                            const trinketImg = getItemImage(match.item6);
                            return (
                              <div key={match.matchId} className={`rounded-lg shadow-lg overflow-hidden group ${resultBgOverlayClass} ${animationClass}`}>
                                <div className={`flex items-stretch ${isExpanded ? "rounded-t-lg" : "rounded-lg"} ${resultBgOverlayClass}`}>
                                  <div className="flex flex-1 items-stretch p-3 ml-1">
                                    <div className="flex flex-col justify-around items-start w-40 flex-shrink-0 mr-2 space-y-0.5">
                                      <p className={`text-md font-semibold text-gray-50`}>{gameModeDisplay}</p>
                                      <div className="flex justify-start items-baseline w-full text-xs">
                                        <span className="text-gray-200 mr-2.5">{gameDurationFormatted}</span> <span className="text-gray-400">{timeAgo(match.gameCreation / 1000)}</span>
                                      </div>
                                      <div className="text-xs text-gray-400 truncate w-full pt-0.5" title={`${match.trackedAccountName} (${match.trackedAccountPlatform?.toUpperCase()})`}>
                                        <span className="truncate">{match.trackedAccountName}</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-center space-x-1.5 flex-shrink-0 mx-1">
                                      <Tooltip title={getChampionDisplayName(match.championName)} classNames={{ root: "custom-tooltip" }}>
                                        <div className="relative">
                                          <img
                                            src={getChampionImage(match.championName)}
                                            alt={getChampionDisplayName(match.championName)}
                                            className="w-13 h-13 rounded-md border-2 border-gray-600 shadow-md"
                                            onError={(e) => {
                                              e.target.src = `https://placehold.co/48x48/222/ccc?text=${match.championName ? match.championName.substring(0, 1) : "?"}`;
                                            }}
                                          />
                                          {playerRoleIcon && <img src={playerRoleIcon} alt={match.teamPosition || "Role"} className="absolute -bottom-1 -left-1 w-5 h-5 p-0.5 bg-gray-950 rounded-full border border-gray-500 shadow-sm" />}
                                        </div>
                                      </Tooltip>
                                      <div className="text-gray-400 text-[0.9rem] font-light self-center px-0.5">vs</div>
                                      <Tooltip title={getChampionDisplayName(match.opponentChampionName)} classNames={{ root: "custom-tooltip" }}>
                                        <div className="relative">
                                          {match.opponentChampionName ? (
                                            <img
                                              src={getChampionImage(match.opponentChampionName)}
                                              alt={getChampionDisplayName(match.opponentChampionName)}
                                              className="w-13 h-13 rounded-md border-2 border-gray-700 opacity-90 shadow-md"
                                              onError={(e) => {
                                                e.target.src = `https://placehold.co/48x48/222/ccc?text=${match.opponentChampionName ? match.opponentChampionName.substring(0, 1) : "?"}`;
                                              }}
                                            />
                                          ) : (
                                            <div className="w-12 h-12 bg-gray-700/50 rounded-md flex items-center justify-center border border-gray-600 shadow-md">
                                              <ListChecks size={20} className="text-gray-500" />
                                            </div>
                                          )}
                                        </div>
                                      </Tooltip>
                                    </div>
                                    <div className="w-px bg-gray-700/60 self-stretch mx-3"></div>
                                    <div className="flex items-center space-x-2 bg-gray-900/70 p-2 rounded-lg shadow-inner border border-gray-700/50 flex-shrink-0">
                                      <div className="flex space-x-1">
                                        <div className="flex flex-col space-y-0.5">
                                          <Popover content={getSummonerSpellTooltipContent(match.summoner1Id)} placement="top" trigger="hover" classNames={{ root: "custom-popover" }}>
                                            <div className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center border border-gray-600/50"> {summoner1Img ? <img src={summoner1Img} alt="Summoner Spell 1" className="w-5 h-5 rounded-sm" /> : <div className="w-5 h-5 rounded-sm bg-gray-700"></div>} </div>
                                          </Popover>
                                          <Popover content={getSummonerSpellTooltipContent(match.summoner2Id)} placement="bottom" trigger="hover" classNames={{ root: "custom-popover" }}>
                                            <div className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center border border-gray-600/50"> {summoner2Img ? <img src={summoner2Img} alt="Summoner Spell 2" className="w-5 h-5 rounded-sm" /> : <div className="w-5 h-5 rounded-sm bg-gray-700"></div>} </div>
                                          </Popover>
                                        </div>
                                        <RuneDisplay
                                          perks={match.perks}
                                          runesDataFromDDragon={runesDataFromDDragon}
                                          runesMap={runesMap}
                                          getRuneImage={getRuneImage}
                                          layout="compact"
                                          size="md"
                                          playerCardRef={matchListContainerRef}
                                          popoverProps={{
                                            trigger: "hover",
                                            placement: "top",
                                            overlayInnerStyle: { backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "8px" },
                                          }}
                                        >
                                          <div className="flex flex-col space-y-0.5">
                                            <div className="w-6 h-6 bg-black/20 rounded flex items-center justify-center border border-gray-600/50">
                                              {getRuneImage(primaryPerkId) ? (
                                                <img
                                                  src={getRuneImage(primaryPerkId)}
                                                  alt={runesMap[primaryPerkId]?.name || "Keystone"}
                                                  className="w-full h-full object-contain"
                                                  onError={(e) => {
                                                    e.target.style.display = "none";
                                                    e.target.parentNode.innerHTML = '<div class="w-full h-full rounded-sm bg-gray-700/50 flex items-center justify-center text-xs text-gray-500">K?</div>';
                                                  }}
                                                />
                                              ) : (
                                                <div className="w-full h-full rounded-sm bg-gray-700/50 flex items-center justify-center text-xs text-gray-500">K?</div>
                                              )}
                                            </div>
                                            <div className="w-6 h-6 bg-black/20 rounded flex items-center justify-center border border-gray-600/50 p-0.5">
                                              {getRuneImage(subStyleId) ? (
                                                <img
                                                  src={getRuneImage(subStyleId)}
                                                  alt={runesMap[subStyleId]?.name || "Secondary Tree"}
                                                  className="w-full h-full object-contain"
                                                  onError={(e) => {
                                                    e.target.style.display = "none";
                                                    e.target.parentNode.innerHTML = '<div class="w-full h-full rounded-sm bg-gray-700/50 flex items-center justify-center text-xs text-gray-500">S?</div>';
                                                  }}
                                                />
                                              ) : (
                                                <div className="w-full h-full rounded-sm bg-gray-700/50 flex items-center justify-center text-xs text-gray-500">S?</div>
                                              )}
                                            </div>
                                          </div>
                                        </RuneDisplay>
                                      </div>
                                      <div className="flex flex-col space-y-0.5">
                                        <div className="flex space-x-0.5">
                                          {[match.item0, match.item1, match.item2].map((itemId, idx) => (
                                            <Popover key={`item-top-${idx}`} content={getItemTooltipContent(itemId)} trigger="hover" placement="top" classNames={{ root: "custom-popover" }}>
                                              <div className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center border border-gray-600/50">{getItemImage(itemId) ? <img src={getItemImage(itemId)} alt={`Item ${idx}`} className="w-5 h-5 rounded-sm" /> : <div className="w-5 h-5 rounded-sm bg-gray-700"></div>}</div>
                                            </Popover>
                                          ))}
                                          <Popover content={getItemTooltipContent(match.item6)} trigger="hover" placement="top" classNames={{ root: "custom-popover" }}>
                                            <div className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center border border-gray-600/50">{trinketImg ? <img src={trinketImg} alt="Trinket" className="w-5 h-5 rounded-sm" /> : <div className="w-5 h-5 rounded-sm bg-gray-700"></div>}</div>
                                          </Popover>
                                        </div>
                                        <div className="flex space-x-0.5">
                                          {[match.item3, match.item4, match.item5].map((itemId, idx) => (
                                            <Popover key={`item-bot-${idx}`} content={getItemTooltipContent(itemId)} trigger="hover" placement="bottom" classNames={{ root: "custom-popover" }}>
                                              <div className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center border border-gray-600/50">{getItemImage(itemId) ? <img src={getItemImage(itemId)} alt={`Item ${idx + 3}`} className="w-5 h-5 rounded-sm" /> : <div className="w-5 h-5 rounded-sm bg-gray-700"></div>}</div>
                                            </Popover>
                                          ))}
                                          <div className="w-6 h-6"></div>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="w-px bg-gray-700/60 self-stretch mx-3"></div>
                                    <div className="flex flex-col justify-center flex-grow min-w-[90px] space-y-0.5">
                                      <p className="text-sm">{kdaStringSpans}</p>
                                      <p>
                                        <span className={`text-xs ${kdaColorClass}`}>{kdaRatio}</span> <span className="text-[10px] text-gray-400 ml-1">KDA</span>
                                      </p>
                                      <p className="text-gray-300 text-xs mt-0.5">{csString}</p>
                                    </div>
                                    <div className="flex-shrink-0 flex-grow-0 w-66 mr-4">
                                      <ReviewHub match={match} onOpenNotes={handleOpenNotes} />
                                    </div>
                                  </div>
                                  <button className={`flex items-center justify-center ${expandButtonBgClass} transition-colors w-8 cursor-pointer ${isExpanded ? "rounded-tr-lg" : "rounded-r-lg"}`} title={isExpanded ? "Collapse Details" : "Expand Details"} onClick={() => toggleExpandMatch(match.matchId)}>
                                    {isExpanded ? <ChevronUp size={18} className="text-gray-300 group-hover:text-orange-300" /> : <ChevronDown size={18} className="text-gray-400" />}
                                  </button>
                                </div>
                                {isExpanded && (
                                  <ExpandedMatchDetails
                                    match={match}
                                    ddragonVersion={ddragonVersion}
                                    championData={championData}
                                    summonerSpellsMap={summonerSpellsMap}
                                    runesMap={runesMap}
                                    runesDataFromDDragon={runesDataFromDDragon}
                                    getChampionImage={getChampionImage}
                                    getSummonerSpellImage={getSummonerSpellImage}
                                    getItemImage={getItemImage}
                                    getRuneImage={getRuneImage}
                                    getChampionDisplayName={getChampionDisplayName}
                                    isTrackedPlayerWin={isWin}
                                    roleIconMap={ROLE_ICON_MAP}
                                    roleOrder={ROLE_ORDER}
                                    processTimelineDataForPlayer={processTimelineData}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    {!isLoadingMatches && totalPages > 1 && <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />}
                  </div>
                )
              )}
            </main>
          </div>
        ) : (
          <LiveGamePage trackedAccounts={trackedAccounts} getChampionImage={getChampionImage} getSummonerSpellImage={getSummonerSpellImage} getRuneImage={getRuneImage} runesDataFromDDragon={runesDataFromDDragon} runesMap={runesMap} championData={championData} ddragonVersion={ddragonVersion} />
        )}
      </div>
      {selectedMatchForNotes && <MatchNotesPanel match={selectedMatchForNotes} championData={championData} ddragonVersion={ddragonVersion} onSave={handleSaveNotes} onClose={handleCloseNotes} isLoading={isSavingNotes} getChampionImage={getChampionImage} getChampionDisplayName={getChampionDisplayName} />}
    </div>
  );
}

export default MatchHistoryPage;