// src/components/MatchNotesPanel.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Save, XCircle, Target, Edit2, Star, Brain, Loader2, ListCollapse, ChevronDown, ThumbsUp, CheckSquare, Meh, Frown, Tag } from 'lucide-react'; // Added Tag
import { db } from '../dexieConfig'; 

// Predefined Match Vibe Tags
const PREDEFINED_VIBE_TAGS = [
  { label: 'Stomp (Win)', value: 'stomp_win', color: 'bg-green-500 hover:bg-green-600', activeColor: 'bg-green-600 ring-green-400' },
  { label: 'Close Win', value: 'close_win', color: 'bg-green-400 hover:bg-green-500', activeColor: 'bg-green-500 ring-green-300' },
  { label: 'Team Effort (Win)', value: 'team_effort_win', color: 'bg-sky-500 hover:bg-sky-600', activeColor: 'bg-sky-600 ring-sky-400' },
  { label: 'Solo Carry (Win)', value: 'solo_carry_win', color: 'bg-yellow-500 hover:bg-yellow-600', activeColor: 'bg-yellow-600 ring-yellow-400' },
  { label: 'Even Game', value: 'even_game', color: 'bg-gray-500 hover:bg-gray-600', activeColor: 'bg-gray-600 ring-gray-400' },
  { label: 'Stomped (Loss)', value: 'stomped_loss', color: 'bg-red-600 hover:bg-red-700', activeColor: 'bg-red-700 ring-red-500' },
  { label: 'Close Loss', value: 'close_loss', color: 'bg-red-500 hover:bg-red-600', activeColor: 'bg-red-600 ring-red-400' },
  { label: 'Team Diff (Loss)', value: 'team_diff_loss', color: 'bg-rose-600 hover:bg-rose-700', activeColor: 'bg-rose-700 ring-rose-500' },
  { label: 'Felt Tilted', value: 'felt_tilted', color: 'bg-purple-500 hover:bg-purple-600', activeColor: 'bg-purple-600 ring-purple-400' },
  { label: 'Good Synergy', value: 'good_synergy', color: 'bg-teal-500 hover:bg-teal-600', activeColor: 'bg-teal-600 ring-teal-400' },
  { label: 'Bad Synergy', value: 'bad_synergy', color: 'bg-pink-500 hover:bg-pink-600', activeColor: 'bg-pink-600 ring-pink-400' },
  { label: 'Learning Game', value: 'learning_game', color: 'bg-indigo-500 hover:bg-indigo-600', activeColor: 'bg-indigo-600 ring-indigo-400' },
];


// Helper component for rating buttons (1-5)
const RatingButtons = ({ rating, onRatingChange, maxRating = 5, icon: Icon, label }) => { /* ... (same as v5) ... */ return ( <div> {label && <label className="text-sm font-medium text-gray-300 mb-1.5 block">{label}</label>} <div className="flex space-x-1.5 items-center"> {Icon && <Icon size={18} className="text-orange-400 mr-1" />} {Array.from({ length: maxRating }, (_, i) => i + 1).map((value) => ( <button key={value} type="button" onClick={() => onRatingChange(value)} className={`w-7 h-7 sm:w-8 sm:h-8 rounded-md text-xs sm:text-sm font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-gray-700 focus:ring-orange-500 ${rating === value ? 'bg-orange-500 text-white shadow-md scale-105' : 'bg-gray-600 hover:bg-gray-500 text-gray-300 hover:text-white'}`} > {value} </button> ))} {rating !== null && ( <button type="button" onClick={() => onRatingChange(null)} className="ml-1 p-1 rounded-full hover:bg-red-500/20 text-gray-400 hover:text-red-400" title="Clear rating" > <XCircle size={16} /> </button> )} </div> </div> ); };
RatingButtons.displayName = 'RatingButtons';

// Goal Achievement Buttons (no changes from v5)
const GoalAchievementButtons = ({ achievementStatus, onAchievementChange }) => { /* ... (same as v5) ... */ const options = [ { label: 'Nailed it!', value: 'achieved', icon: CheckSquare, color: 'bg-green-500 hover:bg-green-600', activeColor: 'bg-green-600 ring-green-400' }, { label: 'Mostly', value: 'partial', icon: ThumbsUp, color: 'bg-sky-500 hover:bg-sky-600', activeColor: 'bg-sky-600 ring-sky-400' }, { label: 'Okay', value: 'neutral', icon: Meh, color: 'bg-yellow-500 hover:bg-yellow-600', activeColor: 'bg-yellow-600 ring-yellow-400' }, { label: 'Missed it', value: 'missed', icon: Frown, color: 'bg-red-500 hover:bg-red-600', activeColor: 'bg-red-600 ring-red-400' }, ]; return ( <div> <label className="text-sm font-medium text-gray-300 mb-1.5 block">Did you achieve your main goal?</label> <div className="grid grid-cols-2 sm:grid-cols-4 gap-2"> {options.map(opt => { const Icon = opt.icon; const isActive = achievementStatus === opt.value; return ( <button key={opt.value} type="button" onClick={() => onAchievementChange(isActive ? '' : opt.value)} className={`p-2.5 rounded-md text-xs font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-gray-700 flex flex-col items-center justify-center space-y-1 h-full ${isActive ? `${opt.activeColor} text-white shadow-lg scale-105` : `${opt.color} text-white opacity-80 hover:opacity-100 hover:shadow-md`}`} > <Icon size={20} /> <span>{opt.label}</span> </button> ); })} </div> </div> ); };
GoalAchievementButtons.displayName = 'GoalAchievementButtons';

// Match Vibe Tag Buttons Component
const VibeTagButtons = ({ selectedVibes, onVibeToggle }) => {
  return (
    <div>
      <label className="text-sm font-medium text-gray-300 mb-1.5 flex items-center">
        <Tag size={16} className="mr-2 text-orange-500" /> Match Vibe (Select up to 3)
      </label>
      <div className="flex flex-wrap gap-2">
        {PREDEFINED_VIBE_TAGS.map(tag => {
          const isActive = selectedVibes.includes(tag.value);
          return (
            <button
              key={tag.value}
              type="button"
              onClick={() => onVibeToggle(tag.value)}
              disabled={!isActive && selectedVibes.length >= 3} // Disable adding more if 3 are selected
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-gray-700
                            ${isActive 
                                ? `${tag.activeColor} text-white shadow-md` 
                                : `${tag.color} text-white opacity-80 hover:opacity-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-500`}
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
VibeTagButtons.displayName = 'VibeTagButtons';


function MatchNotesPanel({ match, championData, ddragonVersion, onSave, onClose, isLoading: isSavingNotes }) {
  const [mainGoal, setMainGoal] = useState('');
  const [goalAchieved, setGoalAchieved] = useState(''); 
  const [goalDifficultyReason, setGoalDifficultyReason] = useState('');
  const [positiveMoment, setPositiveMoment] = useState('');
  const [keyMistake, setKeyMistake] = useState('');
  const [actionableTakeaway, setActionableTakeaway] = useState('');
  const [gameRating, setGameRating] = useState(null); 
  const [mentalRating, setMentalRating] = useState(null);
  const [generalNotes, setGeneralNotes] = useState('');
  const [selectedVibeTags, setSelectedVibeTags] = useState([]); // New state for vibe tags

  const [goalTemplates, setGoalTemplates] = useState([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  useEffect(() => {
    if (match) {
      let initialMainGoal = match.mainGoal || '';
      let initialSelectedTemplateId = '';
      if (!match.mainGoal && match.activePreGameGoal?.text) {
        initialMainGoal = match.activePreGameGoal.text;
        if (match.activePreGameGoal.templateId) {
          initialSelectedTemplateId = match.activePreGameGoal.templateId.toString();
        }
      }
      setMainGoal(initialMainGoal);
      setSelectedTemplateId(initialSelectedTemplateId);
      setGoalAchieved(match.goalAchieved || '');
      setGoalDifficultyReason(match.goalDifficultyReason || '');
      setPositiveMoment(match.positiveMoment || '');
      setKeyMistake(match.keyMistake || '');
      setActionableTakeaway(match.actionableTakeaway || '');
      setGameRating(match.gameRating || null);
      setMentalRating(match.mentalRating || null);
      setGeneralNotes(match.generalNotes || '');
      setSelectedVibeTags(Array.isArray(match.vibeTags) ? match.vibeTags : []); // Initialize vibe tags
    } else {
      setMainGoal(''); setGoalAchieved(''); setGoalDifficultyReason('');
      setPositiveMoment(''); setKeyMistake(''); setActionableTakeaway('');
      setGameRating(null); setMentalRating(null); setGeneralNotes('');
      setSelectedTemplateId('');
      setSelectedVibeTags([]);
    }
  }, [match]);

  const fetchGoalTemplates = useCallback(async () => { /* ... (same as v5) ... */ if (!match) return; setIsLoadingTemplates(true); try { const templatesFromDb = await db.goalTemplates.orderBy('title').toArray(); setGoalTemplates(templatesFromDb); } catch (err) { console.error("Error fetching goal templates for MatchNotesPanel:", err); } finally { setIsLoadingTemplates(false); } }, [match]); 
  useEffect(() => { fetchGoalTemplates(); }, [fetchGoalTemplates]);

  const handleTemplateSelect = (event) => { /* ... (same as v5) ... */ const templateId = event.target.value; setSelectedTemplateId(templateId); if (templateId) { const selectedTemplate = goalTemplates.find(t => t.id.toString() === templateId); if (selectedTemplate) { setMainGoal(selectedTemplate.title); } } };
  const handleGoalAchievedChange = (newStatus) => { /* ... (same as v5) ... */ setGoalAchieved(newStatus); if (newStatus === 'achieved' || newStatus === '') { setGoalDifficultyReason(''); } };

  const handleVibeTagToggle = (tagValue) => {
    setSelectedVibeTags(prev => {
      if (prev.includes(tagValue)) {
        return prev.filter(t => t !== tagValue); // Remove tag
      } else if (prev.length < 3) {
        return [...prev, tagValue]; // Add tag if less than 3 selected
      }
      return prev; // Max 3 tags
    });
  };

  const handleSave = () => {
    if (match && match.matchId) {
      const notesData = {
        mainGoal,
        goalAchieved,
        goalDifficultyReason: (goalAchieved === 'partial' || goalAchieved === 'neutral' || goalAchieved === 'missed') ? goalDifficultyReason : '',
        positiveMoment,
        keyMistake,
        actionableTakeaway,
        gameRating,
        mentalRating,
        generalNotes,
        vibeTags: selectedVibeTags, // Add vibe tags to saved data
      };
      onSave(match.matchId, notesData); 
    } else {
      console.error("MatchNotesPanel: Cannot save, match or matchId is missing.", match);
    }
  };

  if (!match) return null;
  const getChampionDisplayNameFromPanel = (championKeyApi) => { /* ... (same as v5) ... */ if (!championData || !championKeyApi) return championKeyApi || 'Champion'; let ddragonKeyToLookup = championKeyApi; if (championKeyApi === "Fiddlesticks") ddragonKeyToLookup = "FiddleSticks"; const championInfo = championData[ddragonKeyToLookup] || Object.values(championData).find(c => c.id.toLowerCase() === championKeyApi.toLowerCase()); return championInfo ? championInfo.name : championKeyApi; };
  const championNameDisplay = getChampionDisplayNameFromPanel(match.championName);
  const gameDate = match.gameCreation ? new Date(match.gameCreation).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A';
  const commonTextareaClass = "w-full p-2.5 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-100 placeholder-gray-500 text-sm";
  const commonInputClass = "w-full p-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-100 placeholder-gray-500 text-sm";
  const sectionSpacing = "space-y-2";

  return (
    <div className="fixed top-16 right-0 w-full md:w-2/5 lg:w-1/3 xl:w-[30%] 2xl:w-1/4 h-[calc(100vh-4rem)] bg-gray-850 border-l border-gray-700 shadow-2xl p-4 sm:p-5 flex flex-col space-y-3 overflow-y-auto z-10 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
      <div className="flex justify-between items-center pb-2 border-b border-gray-700"> <h2 className="text-lg sm:text-xl font-semibold text-orange-400"> Game Review: <span className="text-gray-200">{championNameDisplay}</span> <span className="text-sm text-gray-500">({gameDate})</span> </h2> <button onClick={onClose} className="text-gray-500 hover:text-red-400 transition-colors" aria-label="Close notes panel" > <XCircle size={22} /> </button> </div>
      
      {/* Goals Section */}
      <div className={`p-3 bg-gray-800/30 rounded-lg border border-gray-700/50 ${sectionSpacing}`}>
        <div className="flex justify-between items-center mb-1"> <label htmlFor="mainGoal" className="text-sm font-semibold text-gray-300 flex items-center"> <Target size={16} className="mr-2 text-orange-500" /> Main Goal: </label> {isLoadingTemplates && <Loader2 size={16} className="animate-spin text-gray-400" />} </div>
        {goalTemplates.length > 0 && !isLoadingTemplates && ( <div className="relative mb-2"> <ListCollapse size={16} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" /> <select id="goalTemplateSelect" value={selectedTemplateId} onChange={handleTemplateSelect} className={`${commonInputClass} pl-8 appearance-none`} disabled={isSavingNotes || isLoadingTemplates} > <option value="">Custom Goal / Select Template...</option> {goalTemplates.map(template => ( <option key={template.id} value={template.id.toString()}> {template.title} ({template.category || 'General'}) </option> ))} </select> <ChevronDown size={16} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" /> </div> )}
        <input type="text" id="mainGoal" className={commonInputClass} placeholder="e.g., Improve CS to 7/min, die less than 3 times in lane..." value={mainGoal} onChange={(e) => { setMainGoal(e.target.value); if (selectedTemplateId && e.target.value !== goalTemplates.find(t=>t.id.toString() === selectedTemplateId)?.title) { setSelectedTemplateId(''); } }} disabled={isSavingNotes} />
        <div className="pt-2"> <GoalAchievementButtons achievementStatus={goalAchieved} onAchievementChange={handleGoalAchievedChange} /> </div>
        {(goalAchieved === 'partial' || goalAchieved === 'neutral' || goalAchieved === 'missed') && ( <div className="mt-2"> <label htmlFor="goalDifficultyReason" className="text-sm font-medium text-gray-300"> What made it difficult? (Optional) </label> <textarea id="goalDifficultyReason" rows="2" className={commonTextareaClass} placeholder="e.g., Heavy ganks, poor trades, matchup..." value={goalDifficultyReason} onChange={(e) => setGoalDifficultyReason(e.target.value)} disabled={isSavingNotes} /> </div> )}
      </div>

      {/* Match Vibe Tags Section */}
      <div className={`p-3 bg-gray-800/30 rounded-lg border border-gray-700/50 ${sectionSpacing}`}>
        <VibeTagButtons selectedVibes={selectedVibeTags} onVibeToggle={handleVibeTagToggle} />
      </div>

      {/* Reflections Section */}
      <div className={`p-3 bg-gray-800/30 rounded-lg border border-gray-700/50 ${sectionSpacing}`}> <h3 className="text-sm font-semibold text-gray-300 flex items-center mb-1"> <Edit2 size={16} className="mr-2 text-orange-500" /> Reflections & Learnings </h3> <div> <label htmlFor="positiveMoment" className="text-xs font-medium text-gray-400">One thing I did well:</label> <textarea id="positiveMoment" rows="2" className={commonTextareaClass} placeholder="e.g., Good roam bot, tracked jungler well..." value={positiveMoment} onChange={(e) => setPositiveMoment(e.target.value)} disabled={isSavingNotes} /> </div> <div> <label htmlFor="keyMistake" className="text-xs font-medium text-gray-400">One key mistake I made:</label> <textarea id="keyMistake" rows="2" className={commonTextareaClass} placeholder="e.g., Overextended without vision, missed crucial skillshot..." value={keyMistake} onChange={(e) => setKeyMistake(e.target.value)} disabled={isSavingNotes} /> </div> <div> <label htmlFor="actionableTakeaway" className="text-xs font-medium text-gray-400">To improve, next time I will:</label> <textarea id="actionableTakeaway" rows="2" className={commonTextareaClass} placeholder="e.g., Ward deeper, focus on cooldowns before trading..." value={actionableTakeaway} onChange={(e) => setActionableTakeaway(e.target.value)} disabled={isSavingNotes} /> </div> </div>
      
      {/* Ratings Section */}
      <div className={`p-3 bg-gray-800/30 rounded-lg border border-gray-700/50 ${sectionSpacing}`}> <h3 className="text-sm font-semibold text-gray-300 flex items-center mb-2"> <Star size={16} className="mr-2 text-yellow-400" /> Game Ratings </h3> <div className="space-y-2.5"> <RatingButtons rating={gameRating} onRatingChange={setGameRating} icon={Star} label="Overall Game Performance:" /> <RatingButtons rating={mentalRating} onRatingChange={setMentalRating} icon={Brain} label="Mental State / Focus:" /> </div> </div>
      
      {/* General Notes Section */}
      <div className={`p-3 bg-gray-800/30 rounded-lg border border-gray-700/50 ${sectionSpacing}`}> <label htmlFor="generalNotes" className="text-sm font-semibold text-gray-300 flex items-center"> <Edit2 size={16} className="mr-2 text-orange-500" /> General Notes/VOD Timestamps: </label> <textarea id="generalNotes" rows="3" className={commonTextareaClass} placeholder="Any other thoughts, observations, or VOD timestamps..." value={generalNotes} onChange={(e) => setGeneralNotes(e.target.value)} disabled={isSavingNotes} /> </div>
      
      <button onClick={handleSave} disabled={isSavingNotes || !match || !match.matchId} className="w-full mt-auto sticky bottom-0 bg-orange-600 hover:bg-orange-500 text-white font-semibold py-2.5 px-4 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:ring-offset-gray-850 flex items-center justify-center disabled:opacity-60" > <Save size={18} className="mr-2" /> {isSavingNotes ? 'Saving...' : 'Save Review'} </button>
    </div>
  );
}
MatchNotesPanel.displayName = 'MatchNotesPanel';

export default MatchNotesPanel;
