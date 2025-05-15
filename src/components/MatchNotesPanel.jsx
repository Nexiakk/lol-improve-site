// src/components/MatchNotesPanel.jsx
import React, { useState, useEffect } from 'react';
import { Save, XCircle, Target, Edit2 } from 'lucide-react';

function MatchNotesPanel({ match, championData, ddragonVersion, onSave, onClose, isLoading }) {
  const [notes, setNotes] = useState('');
  const [goals, setGoals] = useState('');

  useEffect(() => {
    if (match) {
      setNotes(match.notes || '');
      setGoals(match.goals || '');
    } else {
      setNotes('');
      setGoals('');
    }
  }, [match]);

  const handleSave = () => {
    // Ensure 'match' and 'match.matchId' are present.
    // 'match.matchId' is the primary key for the 'matches' table in Dexie.
    if (match && match.matchId) {
      onSave(match.matchId, notes, goals); // Pass match.matchId to the onSave handler
    } else {
      console.error("MatchNotesPanel: Cannot save, match or matchId is missing.", match);
      // Optionally, provide user feedback here if critical
    }
  };

  if (!match) {
    return null;
  }

  const getChampionDisplayNameFromPanel = (championKeyApi) => {
    if (!championData || !championKeyApi) return championKeyApi || 'Champion';
    let ddragonKeyToLookup = championKeyApi;
    if (championKeyApi === "Fiddlesticks") ddragonKeyToLookup = "FiddleSticks"; // Common DDragon key correction
    const championInfo = championData[ddragonKeyToLookup] || Object.values(championData).find(c => c.id.toLowerCase() === championKeyApi.toLowerCase());
    return championInfo ? championInfo.name : championKeyApi;
  };

  const championNameDisplay = getChampionDisplayNameFromPanel(match.championName);
  // gameCreation is stored as milliseconds from epoch in Dexie
  const gameDate = match.gameCreation ? new Date(match.gameCreation).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A';


  return (
    <div className="fixed top-16 right-0 w-full md:w-1/3 lg:w-1/4 h-[calc(100vh-4rem)] bg-gray-850 border-l border-gray-700 shadow-2xl p-6 flex flex-col space-y-4 overflow-y-auto z-10">
      <div className="flex justify-between items-center pb-3 border-b border-gray-700">
        <h2 className="text-xl font-semibold text-orange-400">
          Game Review: <span className="text-gray-200">{championNameDisplay}</span> <span className="text-sm text-gray-500">({gameDate})</span>
        </h2>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-red-400 transition-colors"
          aria-label="Close notes panel"
        >
          <XCircle size={24} />
        </button>
      </div>

      <div>
        <label htmlFor="gameGoals" className="text-sm font-medium text-gray-300 mb-1.5 flex items-center">
          <Target size={16} className="mr-2 text-orange-500" /> Goals & Focus
        </label>
        <textarea
          id="gameGoals"
          rows="4"
          className="w-full p-2.5 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-100 placeholder-gray-500 text-sm"
          placeholder="What was your main focus this game? (e.g., CSing, map awareness, specific matchup, objective control)"
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          disabled={isLoading}
        />
      </div>

      <div>
        <label htmlFor="gameNotes" className="text-sm font-medium text-gray-300 mb-1.5 flex items-center">
          <Edit2 size={16} className="mr-2 text-orange-500" /> Reflections & Learnings
        </label>
        <textarea
          id="gameNotes"
          rows="10"
          className="w-full p-2.5 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-100 placeholder-gray-500 text-sm"
          placeholder="1. What went well this game?&#10;2. What was one key mistake? How to avoid it?&#10;3. What's the main takeaway or learning?"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={isLoading}
        />
      </div>

      <button
        onClick={handleSave}
        disabled={isLoading || !match || !match.matchId} // Disable if match or matchId is missing
        className="w-full mt-2 bg-orange-600 hover:bg-orange-500 text-white font-semibold py-2.5 px-4 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:ring-offset-gray-850 flex items-center justify-center disabled:opacity-60"
      >
        <Save size={18} className="mr-2" />
        {isLoading ? 'Saving...' : 'Save Review'}
      </button>
    </div>
  );
}

export default MatchNotesPanel;
