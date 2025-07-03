// src/components/MatchNotesPanel.jsx
import React, { useState, useEffect, useCallback, useRef, memo } from "react";
import { Save, XCircle, Target, Edit2, Star, Brain, Loader2, ListCollapse, ChevronDown, ThumbsUp, CheckSquare, Meh, Frown, Tag, Lightbulb, Repeat, ClipboardCheck, ChevronsUpDown, PlusCircle, Trash2 } from "lucide-react";
import { db } from "../dexieConfig";

// Predefined Match Vibe Tags
const PREDEFINED_VIBE_TAGS = [
  { label: "Stomp (Win)", value: "stomp_win", color: "bg-green-500 hover:bg-green-600", activeColor: "bg-green-600 ring-green-400" },
  { label: "Close Win", value: "close_win", color: "bg-green-400 hover:bg-green-500", activeColor: "bg-green-500 ring-green-300" },
  { label: "Team Effort (Win)", value: "team_effort_win", color: "bg-sky-500 hover:bg-sky-600", activeColor: "bg-sky-600 ring-sky-400" },
  { label: "Solo Carry (Win)", value: "solo_carry_win", color: "bg-yellow-500 hover:bg-yellow-600", activeColor: "bg-yellow-600 ring-yellow-400" },
  { label: "Even Game", value: "even_game", color: "bg-gray-500 hover:bg-gray-600", activeColor: "bg-gray-600 ring-gray-400" },
  { label: "Stomped (Loss)", value: "stomped_loss", color: "bg-red-600 hover:bg-red-700", activeColor: "bg-red-700 ring-red-500" },
  { label: "Close Loss", value: "close_loss", color: "bg-red-500 hover:bg-red-600", activeColor: "bg-red-600 ring-red-400" },
  { label: "Team Diff (Loss)", value: "team_diff_loss", color: "bg-rose-600 hover:bg-rose-700", activeColor: "bg-rose-700 ring-rose-500" },
  { label: "Felt Tilted", value: "felt_tilted", color: "bg-purple-500 hover:bg-purple-600", activeColor: "bg-purple-600 ring-purple-400" },
  { label: "Good Synergy", value: "good_synergy", color: "bg-teal-500 hover:bg-teal-600", activeColor: "bg-teal-600 ring-teal-400" },
  { label: "Bad Synergy", value: "bad_synergy", color: "bg-pink-500 hover:bg-pink-600", activeColor: "bg-pink-600 ring-pink-400" },
  { label: "Learning Game", value: "learning_game", color: "bg-indigo-500 hover:bg-indigo-600", activeColor: "bg-indigo-600 ring-indigo-400" },
];

// Predefined Mistake Tags - A key 'Investment' for the user.
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

// Reusable component for accordian-style collapsible sections
const CollapsibleSection = ({ title, icon, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const Icon = icon;

  useEffect(() => {
    setIsOpen(defaultOpen);
  }, [defaultOpen]);

  return (
    <div className="bg-gray-800/30 rounded-lg border border-gray-700/50 overflow-hidden">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full p-3 flex justify-between items-center text-left cursor-pointer">
        <span className="text-sm font-semibold text-gray-300 flex items-center">
          {Icon && <Icon size={16} className="mr-2 text-orange-500" />} {title}
        </span>
        <ChevronsUpDown size={16} className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className="p-3 pt-0">
          <hr className="border-t border-gray-700/50 -mx-3 mb-3" />
          <div className="space-y-3">{children}</div>
        </div>
      )}
    </div>
  );
};
CollapsibleSection.displayName = "CollapsibleSection";

// Helper component for rating buttons (1-5)
const RatingButtons = ({ rating, onRatingChange, maxRating = 5, icon: Icon, label }) => {
  return (
    <div>
      {label && <label className="text-sm font-medium text-gray-300 mb-1.5 block">{label}</label>}
      <div className="flex space-x-1.5 items-center">
        {Icon && <Icon size={18} className="text-orange-400 mr-1" />}
        {Array.from({ length: maxRating }, (_, i) => i + 1).map((value) => (
          <button key={value} type="button" onClick={() => onRatingChange(value)} className={`w-7 h-7 sm:w-8 sm:h-8 rounded-md text-xs sm:text-sm font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-gray-700 focus:ring-orange-500 cursor-pointer ${rating === value ? "bg-orange-500 text-white shadow-md scale-105" : "bg-gray-600 hover:bg-gray-500 text-gray-300 hover:text-white"}`}>
            {value}
          </button>
        ))}
        {rating !== null && (
          <button type="button" onClick={() => onRatingChange(null)} className="ml-1 p-1 rounded-full hover:bg-red-500/20 text-gray-400 hover:text-red-400 cursor-pointer" title="Clear rating">
            <XCircle size={16} />
          </button>
        )}
      </div>
    </div>
  );
};
RatingButtons.displayName = "RatingButtons";

// Goal Achievement Buttons
const GoalAchievementButtons = ({ achievementStatus, onAchievementChange }) => {
  const options = [
    { label: "Nailed it!", value: "achieved", icon: CheckSquare, color: "bg-green-500 hover:bg-green-600", activeColor: "bg-green-600 ring-green-400" },
    { label: "Mostly", value: "partial", icon: ThumbsUp, color: "bg-sky-500 hover:bg-sky-600", activeColor: "bg-sky-600 ring-sky-400" },
    { label: "Okay", value: "neutral", icon: Meh, color: "bg-yellow-500 hover:bg-yellow-600", activeColor: "bg-yellow-600 ring-yellow-400" },
    { label: "Missed it", value: "missed", icon: Frown, color: "bg-red-500 hover:bg-red-600", activeColor: "bg-red-600 ring-red-400" },
  ];
  return (
    <div>
      <label className="text-sm font-medium text-gray-300 mb-1.5 block">How did you do on your main goal?</label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {options.map((opt) => {
          const Icon = opt.icon;
          const isActive = achievementStatus === opt.value;
          return (
            <button key={opt.value} type="button" onClick={() => onAchievementChange(isActive ? "" : opt.value)} className={`p-2.5 rounded-md text-xs font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-gray-700 flex flex-col items-center justify-center space-y-1 h-full cursor-pointer ${isActive ? `${opt.activeColor} text-white shadow-lg scale-105` : `${opt.color} text-white opacity-80 hover:opacity-100 hover:shadow-md`}`}>
              <Icon size={20} />
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
GoalAchievementButtons.displayName = "GoalAchievementButtons";

// Component for Vibe Tags
const VibeTagButtons = ({ selectedVibes, onVibeToggle }) => {
  return (
    <div>
      <label className="text-sm font-medium text-gray-300 mb-1.5 flex items-center">
        <Tag size={16} className="mr-2" /> Match Vibe (Select up to 3)
      </label>
      <div className="flex flex-wrap gap-2">
        {PREDEFINED_VIBE_TAGS.map((tag) => {
          const isActive = selectedVibes.includes(tag.value);
          return (
            <button
              key={tag.value}
              type="button"
              onClick={() => onVibeToggle(tag.value)}
              disabled={!isActive && selectedVibes.length >= 3}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-gray-700 cursor-pointer
                            ${isActive ? `${tag.activeColor} text-white shadow-md` : `${tag.color} text-white opacity-80 hover:opacity-100 disabled:opacity-50 disabled:cursor-not-allowed`}
                          `}
            >
              {tag.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
VibeTagButtons.displayName = "VibeTagButtons";

// Component for Mistake Tagging
const MistakeTagger = ({ selectedTags, onTagToggle }) => {
  return (
    <div>
      <label className="text-xs font-medium text-gray-400 mb-1.5 flex items-center">Categorize this mistake (helps find patterns later):</label>
      <div className="flex flex-wrap gap-1.5">
        {PREDEFINED_MISTAKE_TAGS.map((tag) => {
          const isActive = selectedTags.includes(tag.value);
          return (
            <button
              key={tag.value}
              type="button"
              onClick={() => onTagToggle(tag.value)}
              className={`px-2 py-1 rounded-md text-xs font-medium transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-offset-gray-700 cursor-pointer
                ${isActive ? "bg-red-500 text-white ring-red-400" : "bg-gray-600 hover:bg-gray-500 text-gray-300"}`}
            >
              {tag.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
MistakeTagger.displayName = "MistakeTagger";

// NEW: Reusable component for auto-expanding textareas
const AutoExpandingTextarea = ({ className, ...props }) => {
  const textareaRef = useRef(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto"; // Reset height to recalculate
      const scrollHeight = el.scrollHeight;
      el.style.height = `${scrollHeight}px`; // Set height to content size
    }
  }, [props.value]); // Reruns when the text value changes

  return <textarea ref={textareaRef} className={`${className} resize-none overflow-hidden`} {...props} />;
};
AutoExpandingTextarea.displayName = "AutoExpandingTextarea";

const GoalItem = memo(({ goal, onUpdate, onDelete, isSaving }) => {
  const commonTextareaClass = "w-full p-2.5 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-100 placeholder-gray-500 text-sm transition-all duration-200 resize-none overflow-hidden";
  const commonInputClass = "w-full p-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-100 placeholder-gray-500 text-sm";

  const handleTextChange = (e) => {
    onUpdate(goal.id, { ...goal, text: e.target.value });
  };

  const handleStatusChange = (newStatus) => {
    const newGoalData = { ...goal, status: newStatus };
    if (newStatus === "achieved" || newStatus === "") {
      newGoalData.difficultyReason = ""; // Clear reason if achieved or cleared
    }
    onUpdate(goal.id, newGoalData);
  };

  const handleReasonChange = (e) => {
    onUpdate(goal.id, { ...goal, difficultyReason: e.target.value });
  };

  return (
    <div className="p-3 bg-gray-900/40 border border-gray-700/80 rounded-lg space-y-3">
      <div className="flex justify-between items-center">
        <label htmlFor={`goal-text-${goal.id}`} className="text-sm font-semibold text-gray-300">
          Goal:
        </label>
        <button onClick={() => onDelete(goal.id)} className="text-red-500 hover:text-red-400 p-1 flex-shrink-0" title="Delete Goal">
          <Trash2 size={16} />
        </button>
      </div>
      <input type="text" id={`goal-text-${goal.id}`} className={commonInputClass} placeholder="e.g., Die less than 3 times in lane" value={goal.text} onChange={handleTextChange} disabled={isSaving} />
      <div className="pt-1">
        <GoalAchievementButtons achievementStatus={goal.status} onAchievementChange={handleStatusChange} />
      </div>
      {(goal.status === "partial" || goal.status === "neutral" || goal.status === "missed") && (
        <div className="mt-2">
          <label htmlFor={`goal-reason-${goal.id}`} className="text-xs font-medium text-gray-400">
            What made it difficult? (Optional)
          </label>
          <textarea id={`goal-reason-${goal.id}`} rows="2" className={commonTextareaClass} placeholder="e.g., Heavy ganks, poor trades, matchup..." value={goal.difficultyReason} onChange={handleReasonChange} disabled={isSaving} />
        </div>
      )}
    </div>
  );
});
GoalItem.displayName = "GoalItem";

function MatchNotesPanel({ match, championData, ddragonVersion, onSave, onClose, isLoading: isSavingNotes }) {
  const [goals, setGoals] = useState([]);
  const [positiveMoment, setPositiveMoment] = useState("");
  const [keyMistake, setKeyMistake] = useState("");
  const [keyMistakeTags, setKeyMistakeTags] = useState([]);
  const [actionableTakeaway, setActionableTakeaway] = useState("");
  const [gameRating, setGameRating] = useState(null);
  const [mentalRating, setMentalRating] = useState(null);
  const [generalNotes, setGeneralNotes] = useState("");
  const [selectedVibeTags, setSelectedVibeTags] = useState([]);

  const [goalTemplates, setGoalTemplates] = useState([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  useEffect(() => {
    if (match) {
      if (Array.isArray(match.goals) && match.goals.length > 0) {
        setGoals(match.goals.map((g) => ({ ...g, id: g.id || Date.now() + Math.random() })));
      } else if (match.mainGoal) {
        let initialGoalText = match.mainGoal;
        if (!match.mainGoal && match.activePreGameGoal?.text) {
          initialGoalText = match.activePreGameGoal.text;
        }
        setGoals([
          {
            id: Date.now(),
            text: initialGoalText,
            status: match.goalAchieved || "",
            difficultyReason: match.goalDifficultyReason || "",
          },
        ]);
      } else {
        let initialText = match.activePreGameGoal?.text || "";
        setGoals([{ id: Date.now(), text: initialText, status: "", difficultyReason: "" }]);
      }

      setPositiveMoment(match.positiveMoment || "");
      setKeyMistake(match.keyMistake || "");
      setActionableTakeaway(match.actionableTakeaway || "");
      setGameRating(match.gameRating || null);
      setMentalRating(match.mentalRating || null);
      setGeneralNotes(match.generalNotes || "");
      setSelectedVibeTags(Array.isArray(match.vibeTags) ? match.vibeTags : []);
      setKeyMistakeTags(Array.isArray(match.keyMistakeTags) ? match.keyMistakeTags : []);
    } else {
      setGoals([{ id: Date.now(), text: "", status: "", difficultyReason: "" }]);
      setPositiveMoment("");
      setKeyMistake("");
      setActionableTakeaway("");
      setGameRating(null);
      setMentalRating(null);
      setGeneralNotes("");
      setSelectedVibeTags([]);
      setKeyMistakeTags([]);
    }
  }, [match]);

  const fetchGoalTemplates = useCallback(async () => {
    if (!match) return;
    setIsLoadingTemplates(true);
    try {
      const templatesFromDb = await db.goalTemplates.orderBy("title").toArray();
      setGoalTemplates(templatesFromDb);
    } catch (err) {
      console.error("Error fetching goal templates for MatchNotesPanel:", err);
    } finally {
      setIsLoadingTemplates(false);
    }
  }, [match]);

  useEffect(() => {
    fetchGoalTemplates();
  }, [fetchGoalTemplates]);

  const handleAddGoal = () => {
    setGoals((prev) => [...prev, { id: Date.now(), text: "", status: "", difficultyReason: "" }]);
  };

  const handleUpdateGoal = (id, updatedGoal) => {
    setGoals((prev) => prev.map((g) => (g.id === id ? updatedGoal : g)));
  };

  const handleDeleteGoal = (id) => {
    if (goals.length > 1) {
      setGoals((prev) => prev.filter((g) => g.id !== id));
    } else {
      setGoals([{ id: Date.now(), text: "", status: "", difficultyReason: "" }]);
    }
  };

  const handleTemplateSelect = (event) => {
    const templateId = event.target.value;
    setSelectedTemplateId(templateId);
    if (templateId) {
      const selectedTemplate = goalTemplates.find((t) => t.id.toString() === templateId);
      if (selectedTemplate) {
        const newGoal = {
          id: Date.now(),
          text: selectedTemplate.title,
          status: "",
          difficultyReason: "",
        };
        if (goals.length === 1 && goals[0].text.trim() === "") {
          setGoals([newGoal]);
        } else {
          setGoals((prev) => [...prev, newGoal]);
        }
      }
      setTimeout(() => setSelectedTemplateId(""), 100);
    }
  };

  const handleVibeTagToggle = (tagValue) => {
    setSelectedVibeTags((prev) => (prev.includes(tagValue) ? prev.filter((t) => t !== tagValue) : prev.length < 3 ? [...prev, tagValue] : prev));
  };

  const handleMistakeTagToggle = (tagValue) => {
    setKeyMistakeTags((prev) => (prev.includes(tagValue) ? prev.filter((t) => t !== tagValue) : [...prev, tagValue]));
  };

  const handleSetAsGoal = () => {
    if (actionableTakeaway) {
      const newGoal = {
        id: Date.now(),
        text: actionableTakeaway,
        status: "",
        difficultyReason: "",
      };
      if (goals.length === 1 && goals[0].text.trim() === "") {
        setGoals([newGoal]);
      } else {
        setGoals((prev) => [...prev, newGoal]);
      }
    }
  };

  const handleSave = () => {
    if (match?.matchId) {
      const notesData = {
        goals: goals.filter((g) => g.text.trim() !== ""),
        mainGoal: null,
        goalAchieved: null,
        goalDifficultyReason: null,
        positiveMoment,
        keyMistake,
        keyMistakeTags,
        actionableTakeaway,
        gameRating,
        mentalRating,
        generalNotes,
        vibeTags: selectedVibeTags,
      };
      onSave(match.matchId, notesData);
    } else {
      console.error("MatchNotesPanel: Cannot save, match or matchId is missing.", match);
    }
  };

  if (!match) return null;

  const getChampionDisplayNameFromPanel = (championKeyApi) => {
    if (!championData || !championKeyApi) return championKeyApi || "Champion";
    let ddragonKeyToLookup = championKeyApi;
    if (championKeyApi === "Fiddlesticks") ddragonKeyToLookup = "FiddleSticks";
    const championInfo = championData[ddragonKeyToLookup] || Object.values(championData).find((c) => c.id.toLowerCase() === championKeyApi.toLowerCase());
    return championInfo ? championInfo.name : championKeyApi;
  };

  const championNameDisplay = getChampionDisplayNameFromPanel(match.championName);
  const gameDate = match.gameCreation ? new Date(match.gameCreation).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "N/A";
  const commonTextareaClass = "w-full p-2.5 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-100 placeholder-gray-500 text-sm transition-all duration-200";
  const commonInputClass = "w-full p-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-100 placeholder-gray-500 text-sm";

  const isExistingReview = !!(match.mainGoal || match.positiveMoment || match.keyMistake || match.generalNotes || match.vibeTags?.length > 0 || match.gameRating);

  const hasGoalContent = !!(match.mainGoal || match.goalAchieved);
  const hasVibeContent = !!(match.vibeTags?.length > 0);
  const hasDecisionsContent = !!(match.positiveMoment || match.keyMistake || match.actionableTakeaway || match.keyMistakeTags?.length > 0);
  const hasAssessmentContent = !!(match.gameRating || match.mentalRating);
  const hasGeneralNotesContent = !!match.generalNotes;

  return (
    <div className="fixed top-16 right-0 w-full md:w-2/5 lg:w-1/3 xl:w-[30%] 2xl:w-1/4 h-[calc(100vh-4rem)] bg-gray-850 border-l border-gray-700 shadow-2xl flex flex-col z-10 custom-scrollbar">
      {/* Panel Header */}
      <div className="p-4 sm:p-5 pb-2 border-b border-gray-700">
        <div className="flex justify-between items-center">
          <h2 className="flex items-baseline truncate">
            {match.opponentChampionName ? (
              <>
                <span className="text-xl font-bold text-gray-100">{championNameDisplay}</span>
                <span className="mx-2 text-sm font-normal text-gray-500">vs</span>
                <span className="text-sm font-medium text-gray-300">{getChampionDisplayNameFromPanel(match.opponentChampionName)}</span>
              </>
            ) : (
              <span className="text-xl font-bold text-gray-100">Game Review: {championNameDisplay}</span>
            )}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-red-400 transition-colors cursor-pointer" aria-label="Close notes panel">
            <XCircle size={22} />
          </button>
        </div>
        <p className="text-sm text-gray-400">{gameDate}</p>
      </div>

      {/* Main content area with scrolling */}
      <div className="flex-grow p-4 sm:p-5 space-y-3 overflow-y-auto custom-scrollbar">
        <CollapsibleSection title="Review Your Game Goals" icon={Target} defaultOpen={true}>
          <div className="space-y-4">
            {/* Goal Template Selector */}
            {goalTemplates.length > 0 && (
              <div className="relative">
                <ListCollapse size={16} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
                <select id="goalTemplateSelect" value={selectedTemplateId} onChange={handleTemplateSelect} className={`${commonInputClass} pl-8 appearance-none cursor-pointer`} disabled={isSavingNotes || isLoadingTemplates}>
                  <option value="">+ Add Goal from Template...</option>
                  {goalTemplates.map((template) => (
                    <option key={template.id} value={template.id.toString()}>
                      {template.title} ({template.category || "General"})
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            )}

            {/* List of Goals */}
            <div className="space-y-3">
              {goals.map((goal) => (
                <GoalItem key={goal.id} goal={goal} onUpdate={handleUpdateGoal} onDelete={handleDeleteGoal} isSaving={isSavingNotes} />
              ))}
            </div>

            {/* Add Goal Button */}
            <div className="flex justify-center pt-2">
              <button onClick={handleAddGoal} className="flex items-center text-sm font-semibold text-orange-400 hover:text-orange-300 transition-colors py-1.5 px-3 rounded-md bg-gray-700/60 hover:bg-gray-700">
                <PlusCircle size={16} className="mr-2" /> Add Goal
              </button>
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="How Did The Game Feel?" icon={Tag} defaultOpen={hasVibeContent}>
          <VibeTagButtons selectedVibes={selectedVibeTags} onVibeToggle={handleVibeTagToggle} />
        </CollapsibleSection>

        <CollapsibleSection title="Deconstruct Your Decisions" icon={Lightbulb} defaultOpen={isExistingReview ? hasDecisionsContent : true}>
          <div>
            <label htmlFor="positiveMoment" className="text-xs font-medium text-gray-400">
              What is one thing you did well?
            </label>
            <AutoExpandingTextarea id="positiveMoment" rows="2" className={commonTextareaClass} placeholder="e.g., A good roam, tracking the jungler, a key outplay..." value={positiveMoment} onChange={(e) => setPositiveMoment(e.target.value)} disabled={isSavingNotes} />
          </div>
          <div className="space-y-2">
            <label htmlFor="keyMistake" className="text-xs font-medium text-gray-400">
              What is one key mistake you made?
            </label>
            <AutoExpandingTextarea id="keyMistake" rows="2" className={commonTextareaClass} placeholder="Describe the mistake. What was your thought process at that moment?" value={keyMistake} onChange={(e) => setKeyMistake(e.target.value)} disabled={isSavingNotes} />
            {keyMistake && <MistakeTagger selectedTags={keyMistakeTags} onTagToggle={handleMistakeTagToggle} />}
          </div>
          <div className="space-y-2">
            <label htmlFor="actionableTakeaway" className="text-xs font-medium text-gray-400">
              To improve, what will you do differently next time?
            </label>
            <AutoExpandingTextarea id="actionableTakeaway" rows="2" className={commonTextareaClass} placeholder="I will focus on X to prevent this mistake..." value={actionableTakeaway} onChange={(e) => setActionableTakeaway(e.target.value)} disabled={isSavingNotes} />
            {actionableTakeaway && (
              <div className="flex justify-end">
                <button onClick={handleSetAsGoal} className="flex items-center text-xs font-semibold text-orange-400 hover:text-orange-300 transition-colors py-1 px-2 rounded-md bg-gray-700 hover:bg-gray-600 cursor-pointer" title="Set this as your main goal for the next review">
                  <ClipboardCheck size={14} className="mr-1.5" /> Set as Next Goal
                </button>
              </div>
            )}
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Self-Assessment" icon={Star} defaultOpen={hasAssessmentContent}>
          <div className="space-y-2.5">
            <RatingButtons rating={gameRating} onRatingChange={setGameRating} icon={Star} label="Overall Game Performance:" />
            <RatingButtons rating={mentalRating} onRatingChange={setMentalRating} icon={Brain} label="Mental State / Focus:" />
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="General Notes & Timestamps" icon={Edit2} defaultOpen={hasGeneralNotesContent}>
          <AutoExpandingTextarea id="generalNotes" rows="3" className={commonTextareaClass} placeholder="Any other thoughts, observations, or VOD timestamps..." value={generalNotes} onChange={(e) => setGeneralNotes(e.target.value)} disabled={isSavingNotes} />
        </CollapsibleSection>
      </div>

      {/* Save Button */}
      <div className="p-4 sm:p-5 pt-3 border-t border-gray-700">
        <button onClick={handleSave} disabled={isSavingNotes || !match?.matchId} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-semibold py-2.5 px-4 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:ring-offset-gray-850 flex items-center justify-center cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed">
          <Save size={18} className="mr-2" />
          {isSavingNotes ? "Saving Review..." : "Save Game Review"}
        </button>
      </div>
    </div>
  );
}
MatchNotesPanel.displayName = "MatchNotesPanel";

export default MatchNotesPanel;
