// src/components/Sidebar.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Target as TargetIcon, Edit, CheckCircle, PinOff, Trash2, PlusCircle, ChevronUp, ChevronDown, ListCollapse } from "lucide-react";

const Sidebar = ({
  preGameGoals,
  setPreGameGoals,
  goalTemplates,
  commonInputClass, // Assuming this will be passed for consistent styling
  controlElementHeightClass, // Assuming this will be passed for consistent styling
}) => {
  const [showPreGameGoalSetter, setShowPreGameGoalSetter] = useState(false);
  const [newPreGameGoalText, setNewPreGameGoalText] = useState("");
  const [selectedPreGameTemplateId, setSelectedPreGameTemplateId] = useState("");
  const preGameGoalSetterRef = useRef(null);

  // Load goals from localStorage on mount
  useEffect(() => {
    try {
      const storedGoals = localStorage.getItem("preGameGoals");
      if (storedGoals) {
        setPreGameGoals(JSON.parse(storedGoals));
      }
    } catch (error) {
      console.error("Error loading pre-game goals from localStorage:", error);
    }
  }, [setPreGameGoals]);

  // Add a new pre-game goal
  const handleAddPreGameGoal = () => {
    let goalToAdd = null;
    if (selectedPreGameTemplateId) {
      const template = goalTemplates.find((t) => t.id.toString() === selectedPreGameTemplateId);
      if (template) {
        goalToAdd = { id: Date.now(), text: template.title, templateId: template.id, category: template.category, setAt: Date.now(), isCompleted: false };
      }
    } else if (newPreGameGoalText.trim()) {
      goalToAdd = { id: Date.now(), text: newPreGameGoalText.trim(), setAt: Date.now(), isCompleted: false };
    }

    if (goalToAdd) {
      const updatedGoals = [...preGameGoals, goalToAdd];
      localStorage.setItem("preGameGoals", JSON.stringify(updatedGoals));
      setPreGameGoals(updatedGoals);
      setNewPreGameGoalText("");
      setSelectedPreGameTemplateId("");
    }
  };

  // Toggle completion status of an individual goal
  const handleToggleGoalCompletion = (id) => {
    const updatedGoals = preGameGoals.map((goal) => (goal.id === id ? { ...goal, isCompleted: !goal.isCompleted } : goal));
    localStorage.setItem("preGameGoals", JSON.stringify(updatedGoals));
    setPreGameGoals(updatedGoals);
  };

  // Delete an individual goal
  const handleDeletePreGameGoal = (id) => {
    const updatedGoals = preGameGoals.filter((goal) => goal.id !== id);
    localStorage.setItem("preGameGoals", JSON.stringify(updatedGoals));
    setPreGameGoals(updatedGoals);
  };

  // Clear all pre-game goals
  const handleClearAllPreGameGoals = () => {
    localStorage.removeItem("preGameGoals");
    setPreGameGoals([]);
    setShowPreGameGoalSetter(false);
  };

  // Click outside handler for the goal setter popover
  useEffect(() => {
    function handleClickOutside(event) {
      if (preGameGoalSetterRef.current && !preGameGoalSetterRef.current.contains(event.target)) {
        const toggleButton = document.getElementById("pre-game-focus-toggle");
        if (toggleButton && toggleButton.contains(event.target)) return;
        setShowPreGameGoalSetter(false);
      }
    }
    if (showPreGameGoalSetter) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showPreGameGoalSetter]);


  return (
    <div className="w-72 bg-gray-900/40 border-r border-gray-700/80 p-4 pt-2 flex-shrink-0 overflow-y-auto custom-scrollbar"> {/* Added overflow-y-auto here */}
      <div className="mb-3 relative"> {/* Removed ref from here, added to direct child for better control */}
        <div className="flex items-start justify-between bg-gray-800/50 p-2 rounded-lg border border-gray-700/50" ref={preGameGoalSetterRef}> {/* Ref moved here */}
          <div className="flex flex-col flex-grow">
            <div className="flex items-center mb-1">
              <TargetIcon size={18} className="mr-2 text-orange-400 flex-shrink-0" />
              <span className="text-xs text-gray-400 font-semibold">Your Active Game Goals:</span>
            </div>
            {preGameGoals.length > 0 ? (
              <ul className="space-y-1 ml-1 text-sm text-gray-300">
                {preGameGoals.map((goal) => (
                  <li key={goal.id} className="flex items-center justify-between">
                    <span className={`flex-grow ${goal.isCompleted ? "line-through text-gray-500" : "text-orange-300 font-semibold"}`}>
                      {goal.text}
                      {goal.category && <span className="text-gray-500 text-[10px] ml-1">({goal.category})</span>}
                    </span>
                    <div className="flex items-center space-x-1 ml-2">
                      <button onClick={() => handleToggleGoalCompletion(goal.id)} className={`p-1 rounded-full ${goal.isCompleted ? "text-green-500 hover:text-green-400" : "text-gray-400 hover:text-green-500"}`} title={goal.isCompleted ? "Mark as Incomplete" : "Mark as Complete"}>
                        <CheckCircle size={16} />
                      </button>
                      <button onClick={() => handleDeletePreGameGoal(goal.id)} className="p-1 rounded-full text-red-500 hover:text-red-400" title="Remove Goal">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-400 ml-1">No active pre-game goals set. Click the edit icon to add some!</p>
            )}
          </div>
          <div className="flex items-center flex-shrink-0 pl-2">
            {preGameGoals.length > 0 && (
              <button onClick={handleClearAllPreGameGoals} className="p-1 text-red-500 hover:text-red-400 mr-1.5" title="Clear All Active Goals">
                <PinOff size={16} />
              </button>
            )}
            <button id="pre-game-focus-toggle" onClick={() => setShowPreGameGoalSetter(!showPreGameGoalSetter)} className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-md text-gray-300 hover:text-orange-300 transition-colors" title={showPreGameGoalSetter ? "Close Goal Setter" : "Manage Game Goals"}>
              {showPreGameGoalSetter ? <ChevronUp size={16} /> : <Edit size={16} />}
            </button>
          </div>
        </div>
        {showPreGameGoalSetter && (
          <div className="absolute top-full right-0 mt-1 z-30 bg-gray-800 p-3 rounded-lg shadow-xl border border-gray-700 w-full sm:w-auto min-w-[280px] space-y-2">
            <h4 className="text-sm font-semibold text-gray-200 mb-1">Add a New Game Goal</h4>
            {goalTemplates && goalTemplates.length > 0 && (
              <select
                value={selectedPreGameTemplateId}
                onChange={(e) => {
                  setSelectedPreGameTemplateId(e.target.value);
                  if (e.target.value) setNewPreGameGoalText("");
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
              value={newPreGameGoalText}
              onChange={(e) => {
                setNewPreGameGoalText(e.target.value);
                if (e.target.value) setSelectedPreGameTemplateId("");
              }}
              placeholder="Type a custom goal..."
              className={`${commonInputClass} ${controlElementHeightClass}`}
            />
            <button onClick={handleAddPreGameGoal} className={`w-full bg-green-600 hover:bg-green-500 text-white text-xs py-1.5 px-3 rounded-md flex items-center justify-center ${controlElementHeightClass}`}>
              <PlusCircle size={16} className="mr-1.5" /> Add Goal
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;