import React, { useState, useEffect, useCallback } from "react";
import { Target, PlusCircle, X, Edit } from "lucide-react";

const Sidebar = () => {
  const [goals, setGoals] = useState([]);
  const [newGoalText, setNewGoalText] = useState("");

  useEffect(() => {
    try {
      const storedGoals = localStorage.getItem("activeFocusGoals");
      if (storedGoals) {
        setGoals(JSON.parse(storedGoals));
      }
    } catch (error) {
      console.error("Error loading active focus goals from localStorage:", error);
      setGoals([]);
    }
  }, []);

  const saveGoals = (newGoals) => {
    setGoals(newGoals);
    localStorage.setItem("activeFocusGoals", JSON.stringify(newGoals));
  };

  const handleAddGoal = () => {
    if (newGoalText.trim()) {
      const newGoal = {
        id: Date.now(),
        text: newGoalText.trim(),
        // You can add more properties to the goal object if needed
      };
      saveGoals([...goals, newGoal]);
      setNewGoalText("");
    }
  };

  const handleRemoveGoal = (goalId) => {
    const updatedGoals = goals.filter((goal) => goal.id !== goalId);
    saveGoals(updatedGoals);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleAddGoal();
    }
  };

  return (
    <div className="w-64 bg-gray-800 p-4 flex flex-col h-full border-r border-gray-700/50">
      <h2 className="text-lg font-semibold text-orange-400 mb-4 flex items-center">
        <Target size={20} className="mr-2" />
        Active Focus
      </h2>

      <div className="flex-grow space-y-2 overflow-y-auto">
        {goals.length > 0 ? (
          goals.map((goal) => (
            <div key={goal.id} className="bg-gray-700/50 p-2 rounded-md flex items-center justify-between text-sm">
              <span className="text-gray-200">{goal.text}</span>
              <button onClick={() => handleRemoveGoal(goal.id)} className="text-red-500 hover:text-red-400" title="Remove Goal">
                <X size={16} />
              </button>
            </div>
          ))
        ) : (
          <p className="text-gray-500 text-sm italic text-center py-4">No active goals set.</p>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-700/50">
        <div className="relative">
          <input type="text" value={newGoalText} onChange={(e) => setNewGoalText(e.target.value)} onKeyDown={handleKeyDown} placeholder="Add a new focus goal..." className="w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm pl-3 pr-10 py-2 text-sm text-gray-100 placeholder-gray-400" />
          <button onClick={handleAddGoal} className="absolute right-0 top-0 h-full px-3 text-orange-400 hover:text-orange-300" title="Add Goal">
            <PlusCircle size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
