// src/pages/NotesGoalsCommandCenterPage.jsx
import React, { useState, useEffect, useCallback, memo } from 'react';
import { Target, Edit3, BarChart3, Zap, PlusCircle, ListChecks, TrendingUp, XCircle, Loader2, AlertTriangle, Activity, CalendarClock, Lightbulb, MessageSquareWarning, Smile, MehIcon, SmilePlus } from 'lucide-react'; // Added more icons
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { db } from '../dexieConfig';
import { format, subDays, eachDayOfInterval } from 'date-fns';

// Initial state for stats, to be updated by fetched data
const initialStats = {
  overallGoalAchievementRate: 0,
  averageGameRating: 0,
  averageMentalRating: 0,
  totalGamesWithGoalsSet: 0,
  totalGamesWithGameRating: 0,
  totalGamesWithMentalRating: 0,
  reviewedLastYGamesCount: 0,
  lastYGamesTotal: 0,
  notesStreak: 0,
  reviewConsistencyData: [], 
};

// Memoized Form Component (no changes)
const GoalTemplateForm = memo(({ onAddTemplate, isSaving }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [formError, setFormError] = useState('');

  const commonInputClass = "w-full p-2.5 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-100 placeholder-gray-500 text-sm";
  const commonButtonClass = "bg-orange-600 hover:bg-orange-500 text-white font-semibold py-2 px-4 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:ring-offset-gray-800 flex items-center justify-center disabled:opacity-60 transition-colors";

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError("Template title cannot be empty.");
      return;
    }
    setFormError('');
    onAddTemplate({
      title: title.trim(),
      description: description.trim(),
      category: category.trim() || 'General',
    });
    setTitle('');
    setDescription('');
    setCategory('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-3 bg-gray-700/50 rounded-md">
      <h3 className="text-md font-medium text-gray-200">Create New Template</h3>
      {formError && <p className="text-xs text-red-400 bg-red-900/20 p-1.5 rounded-sm">{formError}</p>}
      <div>
        <label htmlFor="templateTitle" className="text-xs text-gray-400 block mb-1">Title</label>
        <input type="text" id="templateTitle" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Early Game CSing" className={commonInputClass} disabled={isSaving} />
      </div>
      <div>
        <label htmlFor="templateDesc" className="text-xs text-gray-400 block mb-1">Description/Criteria</label>
        <textarea id="templateDesc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g., Achieve 80 CS by 10 minutes." rows="2" className={commonInputClass} disabled={isSaving}></textarea>
      </div>
      <div>
        <label htmlFor="templateCategory" className="text-xs text-gray-400 block mb-1">Category (Optional)</label>
        <input type="text" id="templateCategory" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g., Laning, Macro, Mechanics" className={commonInputClass} disabled={isSaving} />
      </div>
      <button type="submit" className={`${commonButtonClass} text-sm`} disabled={isSaving || !title.trim()}>
        {isSaving ? <Loader2 size={18} className="mr-2 animate-spin" /> : <PlusCircle size={18} className="mr-2" />}
        {isSaving ? 'Saving...' : 'Add Template'}
      </button>
    </form>
  );
});
GoalTemplateForm.displayName = 'GoalTemplateForm';


function NotesGoalsCommandCenterPage() {
  const [goalTemplates, setGoalTemplates] = useState([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [pageError, setPageError] = useState(''); 

  const [stats, setStats] = useState(initialStats);
  const [nudges, setNudges] = useState([]);   
  const [isLoadingData, setIsLoadingData] = useState(true);

  const fetchGoalTemplates = useCallback(async () => {
    setIsLoadingTemplates(true);
    try {
      const templatesFromDb = await db.goalTemplates.orderBy('createdAt').reverse().toArray();
      setGoalTemplates(templatesFromDb);
    } catch (err) {
      console.error("Error fetching goal templates:", err);
      setPageError("Failed to load goal templates. Please try refreshing.");
    } finally {
      setIsLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    fetchGoalTemplates();
  }, [fetchGoalTemplates]);

  const isMatchReviewed = (match) => {
    return (
      (match.mainGoal && match.mainGoal.trim() !== '') ||
      (match.generalNotes && match.generalNotes.trim() !== '') ||
      (match.gameRating !== null && match.gameRating > 0) || 
      (match.mentalRating !== null && match.mentalRating > 0)
    );
  };

  const fetchDataAndNudges = useCallback(async () => {
    setIsLoadingData(true);
    setPageError('');
    try {
      const matches = await db.matches.orderBy('gameCreation').reverse().toArray();
      const newNudges = [];
      
      if (matches.length === 0) {
        setStats(initialStats);
        setNudges([]);
        setIsLoadingData(false);
        return;
      }

      let achievedGoalsCount = 0;
      let totalGoalsSetCount = 0;
      let sumGameRating = 0;
      let countGameRating = 0;
      let sumMentalRating = 0;
      let countMentalRating = 0;
      let currentNotesStreak = 0;
      let reviewedInLastY = 0;
      const lastYGamesCount = Math.min(matches.length, 20);
      const today = new Date();
      const last7DaysInterval = eachDayOfInterval({ start: subDays(today, 6), end: today });
      const dailyReviewCounts = last7DaysInterval.map(day => ({ name: format(day, 'MMM d'), shortName: format(day, 'E'), reviews: 0 }));
      let sumGameRatingHighMental = 0;
      let countGameRatingHighMental = 0;
      const mentalThreshold = 4;
      const achievedGoalTitles = {};

      matches.forEach((match, index) => {
        const reviewed = isMatchReviewed(match);
        if (index < lastYGamesCount && reviewed) reviewedInLastY++;
        
        // Streak calculation: only count if it's part of a continuous sequence from the most recent game
        if (currentNotesStreak === index && reviewed) {
            currentNotesStreak++;
        }
        
        if (match.mainGoal && match.mainGoal.trim() !== '') { 
            totalGoalsSetCount++;
            if (match.goalAchieved === 'achieved') { 
                achievedGoalsCount++;
                const title = match.mainGoal.trim();
                achievedGoalTitles[title] = (achievedGoalTitles[title] || 0) + 1;
            }
        }
        if (typeof match.gameRating === 'number' && match.gameRating > 0) {
            sumGameRating += match.gameRating;
            countGameRating++;
            if (typeof match.mentalRating === 'number' && match.mentalRating >= mentalThreshold) {
                sumGameRatingHighMental += match.gameRating;
                countGameRatingHighMental++;
            }
        }
        if (typeof match.mentalRating === 'number' && match.mentalRating > 0) {
            sumMentalRating += match.mentalRating;
            countMentalRating++;
        }

        if (match.gameCreation && reviewed) {
            const gameDate = new Date(match.gameCreation);
            const formattedGameDate = format(gameDate, 'MMM d');
            const dayData = dailyReviewCounts.find(d => d.name === formattedGameDate);
            if (dayData) dayData.reviews++;
        }

        const extractKeywords = (text, keywordMap) => {
            if (text && typeof text === 'string') {
                text.toLowerCase().replace(/[^\w\s]|_/g, "").replace(/\s+/g, " ")
                    .split(/\s+/).filter(word => word.length > 3 && !commonWordsToIgnore.has(word))
                    .forEach(word => keywordMap[word] = (keywordMap[word] || 0) + 1);
            }
        };
      });
      
      const getTopKeywords = (keywordsObj, count = 1) => {
        return Object.entries(keywordsObj)
            .sort(([,a],[,b]) => b-a).slice(0, count)
            .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));
      };

      const calculatedStats = {
        overallGoalAchievementRate: totalGoalsSetCount > 0 ? Math.round((achievedGoalsCount / totalGoalsSetCount) * 100) : 0,
        averageGameRating: countGameRating > 0 ? (sumGameRating / countGameRating) : 0,
        averageMentalRating: countMentalRating > 0 ? (sumMentalRating / countMentalRating) : 0,
        totalGamesWithGoalsSet: totalGoalsSetCount,
        totalGamesWithGameRating: countGameRating,
        totalGamesWithMentalRating: countMentalRating,
        reviewedLastYGamesCount: reviewedInLastY,
        lastYGamesTotal: lastYGamesCount,
        notesStreak: currentNotesStreak,
        reviewConsistencyData: dailyReviewCounts, 
      };
      setStats(calculatedStats);

      // --- Generate Nudges ---
      const unreviewedLastY = calculatedStats.lastYGamesTotal - calculatedStats.reviewedLastYGamesCount;
      if (unreviewedLastY > 0 && calculatedStats.lastYGamesTotal > 0) {
          newNudges.push({ text: `You have ${unreviewedLastY} unreviewed game${unreviewedLastY > 1 ? 's' : ''} in your last ${calculatedStats.lastYGamesTotal}. Take a moment to reflect!`, icon: MessageSquareWarning, color: "sky"});
      }
      if (calculatedStats.overallGoalAchievementRate >= 70 && calculatedStats.totalGamesWithGoalsSet >= 5) {
          newNudges.push({ text: `Great work! Your overall goal achievement rate is ${calculatedStats.overallGoalAchievementRate}%. Keep setting and hitting those targets!`, icon: Target, color: "green"});
      } else if (calculatedStats.overallGoalAchievementRate < 40 && calculatedStats.totalGamesWithGoalsSet >= 5) {
          newNudges.push({ text: `Your goal achievement rate is ${calculatedStats.overallGoalAchievementRate}%. Try setting smaller, more specific goals or use a template to stay focused.`, icon: Edit3, color: "yellow"});
      }
      if (calculatedStats.averageMentalRating >= 4 && calculatedStats.totalGamesWithMentalRating >= 5) {
          newNudges.push({ text: `Your average mental state rating is ${calculatedStats.averageMentalRating.toFixed(1)}/5. A strong mindset is key!`, icon: SmilePlus, color: "purple"});
      } else if (calculatedStats.averageMentalRating < 3 && calculatedStats.totalGamesWithMentalRating >= 5) {
          newNudges.push({ text: `Your average mental state rating is ${calculatedStats.averageMentalRating.toFixed(1)}/5. Remember to take breaks and manage tilt for better performance.`, icon: MehIcon, color: "red"});
      }
      if (newNudges.length === 0 && matches.length > 0) {
        newNudges.push({text: "Looking good! Keep up the consistent reviews and goal setting.", icon: Smile, color: "green"});
      }
      setNudges(newNudges);


    } catch (err) {
      console.error("Error fetching/calculating data:", err);
      setPageError("Failed to calculate data. Please try refreshing.");
      setStats(initialStats);
      setNudges([]);
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    fetchDataAndNudges();
  }, [fetchDataAndNudges]);


  const handleAddTemplate = async (templateData) => {
    setIsSavingTemplate(true);
    setPageError('');
    const newTemplate = { ...templateData, createdAt: new Date() };
    try {
      await db.goalTemplates.add(newTemplate);
      fetchGoalTemplates(); 
    } catch (err) {
      console.error("Error saving goal template:", err);
      setPageError("Failed to save template. Please try again.");
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!templateId) return;
    if (window.confirm("Are you sure you want to delete this goal template?")) {
        setPageError('');
        try {
            await db.goalTemplates.delete(templateId);
            fetchGoalTemplates();
        } catch (err) {
            console.error("Error deleting goal template:", err);
            setPageError("Failed to delete template. Please try again.");
        }
    }
  };

  const Section = ({ title, icon: Icon, children, isLoading, error, className = "" }) => (
    <div className={`bg-gray-800/70 backdrop-blur-md p-4 sm:p-6 rounded-xl shadow-lg border border-gray-700/50 ${className}`}>
      <h2 className="text-xl sm:text-2xl font-semibold text-orange-400 mb-4 flex items-center">
        {Icon && <Icon size={24} className="mr-3 text-orange-500" />}
        {title}
      </h2>
      {isLoading && (
        <div className="flex justify-center items-center py-4">
          <Loader2 size={28} className="animate-spin text-orange-500" />
          <span className="ml-2 text-gray-400">Loading...</span>
        </div>
      )}
      {error && !isLoading && (
         <div className="p-3 bg-red-900/30 text-red-300 border border-red-700/50 rounded-md text-sm flex items-center">
            <AlertTriangle size={18} className="mr-2" /> {error}
        </div>
      )}
      {!isLoading && !error && <div className="space-y-4">{children}</div>}
    </div>
  );

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-700/80 backdrop-blur-sm text-white p-2 rounded-md shadow-lg border border-gray-600 text-xs">
          <p className="font-semibold">{`${label}`}</p>
          <p className="text-orange-300">{`Reviews: ${payload[0].value}`}</p>
        </div>
      );
    }
    return null;
  };


  return (
    <div className="p-4 sm:p-6 md:p-8 text-gray-100 max-w-7xl mx-auto">
      {pageError && !pageError.includes("goal templates") && !pageError.includes("statistics") && (
         <div className="mb-6 p-3 bg-red-900/30 text-red-300 border border-red-700/50 rounded-md text-sm flex items-center max-w-3xl mx-auto">
            <AlertTriangle size={18} className="mr-2" /> {pageError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <div className="lg:col-span-1 space-y-6">
            <Section title="Goal Templates" icon={ListChecks} isLoading={isLoadingTemplates} error={pageError.includes("goal templates") ? pageError : ""}>
                <GoalTemplateForm onAddTemplate={handleAddTemplate} isSaving={isSavingTemplate} />
                <div className="mt-4 space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-700/50 pr-2">
                <h3 className="text-md font-medium text-gray-200 sticky top-0 bg-gray-800/95 backdrop-blur-sm py-1 z-10">Your Templates:</h3>
                {goalTemplates.length === 0 && !isLoadingTemplates ? (
                    <p className="text-gray-500 text-sm italic py-2">No templates created yet.</p>
                ) : (
                    goalTemplates.map(template => (
                    <div key={template.id} className="bg-gray-700/30 p-3 rounded-md flex justify-between items-start hover:bg-gray-700/50 transition-colors">
                        <div>
                        <h4 className="font-semibold text-orange-300">{template.title}</h4>
                        <p className="text-xs text-gray-300 whitespace-pre-wrap">{template.description}</p>
                        {template.category && <span className="text-xs mt-1 inline-block bg-gray-600 px-2 py-0.5 rounded-full text-gray-300">{template.category}</span>}
                        </div>
                        <button onClick={() => handleDeleteTemplate(template.id)} className="text-red-500 hover:text-red-400 p-1 ml-2 flex-shrink-0" title="Delete template">
                        <XCircle size={18} />
                        </button>
                    </div>
                    ))
                )}
                </div>
            </Section>
        </div>

        <div className="lg:col-span-2 space-y-6 lg:space-y-8">
            <Section title="Performance Statistics" icon={BarChart3} isLoading={isLoadingData} error={pageError.includes("statistics") ? pageError : ""}> 
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 text-sm">
                    <div className="bg-gray-700/30 p-3 rounded-md sm:col-span-1 xl:col-span-1">
                        <h4 className="font-semibold text-orange-300 mb-1 flex items-center"><Activity size={16} className="mr-1.5"/>Review Activity</h4>
                        <p className="text-lg font-bold text-sky-400">
                            {stats.reviewedLastYGamesCount} / {stats.lastYGamesTotal}
                        </p>
                        <p className="text-xs text-gray-400">games reviewed (last {stats.lastYGamesTotal})</p>
                    </div>
                    <div className="bg-gray-700/30 p-3 rounded-md sm:col-span-1 xl:col-span-1">
                        <h4 className="font-semibold text-orange-300 mb-1 flex items-center"><Zap size={16} className="mr-1.5"/>Notes Streak</h4>
                        <p className="text-2xl font-bold text-yellow-400">{stats.notesStreak} 🔥</p>
                        <p className="text-xs text-gray-400">consecutive games reviewed</p>
                    </div>
                     <div className="bg-gray-700/30 p-3 rounded-md sm:col-span-2 xl:col-span-1"> 
                        <h4 className="font-semibold text-orange-300 mb-1 flex items-center"><CalendarClock size={16} className="mr-1.5"/>Review Consistency (Last 7 Days)</h4>
                        {stats.reviewConsistencyData && stats.reviewConsistencyData.length > 0 ? (
                            <div style={{ width: '100%', height: 80 }}>
                                <ResponsiveContainer>
                                    <BarChart data={stats.reviewConsistencyData} margin={{ top: 10, right: 0, left: -25, bottom: -10 }}>
                                        <XAxis dataKey="shortName" tick={{ fontSize: 10, fill: '#a0aec0' }} axisLine={{ stroke: '#4a5568' }} tickLine={{ stroke: '#4a5568' }} />
                                        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#a0aec0' }} axisLine={{ stroke: '#4a5568' }} tickLine={{ stroke: '#4a5568' }} />
                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }}/>
                                        <Bar dataKey="reviews" radius={[3, 3, 0, 0]}>
                                            {stats.reviewConsistencyData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.reviews > 0 ? '#ed8936' : '#718096'} /> 
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="text-xs text-gray-400 italic h-[50px] flex items-center justify-center">
                                No review data for the last 7 days.
                            </div>
                        )}
                    </div>

                    <div className="bg-gray-700/30 p-3 rounded-md">
                        <h4 className="font-semibold text-orange-300 mb-1">Goal Achievement Rate:</h4>
                        <p className="text-2xl font-bold text-green-400">{stats.overallGoalAchievementRate}%</p>
                        <p className="text-xs text-gray-400">({stats.totalGamesWithGoalsSet} games with goals)</p>
                    </div>
                    <div className="bg-gray-700/30 p-3 rounded-md">
                        <h4 className="font-semibold text-orange-300 mb-1">Average Game Rating:</h4>
                        <p className="text-2xl font-bold text-sky-400">{stats.averageGameRating.toFixed(1)} / 5</p>
                        <p className="text-xs text-gray-400">({stats.totalGamesWithGameRating} games rated)</p>
                    </div>
                    <div className="bg-gray-700/30 p-3 rounded-md">
                        <h4 className="font-semibold text-orange-300 mb-1">Average Mental Rating:</h4>
                        <p className="text-2xl font-bold text-purple-400">{stats.averageMentalRating.toFixed(1)} / 5</p>
                        <p className="text-xs text-gray-400">({stats.totalGamesWithMentalRating} games rated)</p>
                    </div>
                </div>
            </Section>

            <Section title="Gentle Nudges" icon={Zap} isLoading={isLoadingData} error={""}>
                {nudges.length > 0 ? (
                <ul className="space-y-2">
                    {nudges.map((nudge, index) => {
                        const NudgeIcon = nudge.icon || Zap;
                        let bgColor = 'bg-sky-800/30';
                        let textColor = 'text-sky-300';
                        let borderColor = 'border-sky-700/50';
                        let iconColor = 'text-sky-400';

                        if (nudge.color === 'green') {
                            bgColor = 'bg-green-800/30'; textColor = 'text-green-300'; borderColor = 'border-green-700/50'; iconColor = 'text-green-400';
                        } else if (nudge.color === 'yellow') {
                            bgColor = 'bg-yellow-800/30'; textColor = 'text-yellow-300'; borderColor = 'border-yellow-700/50'; iconColor = 'text-yellow-400';
                        } else if (nudge.color === 'red') {
                            bgColor = 'bg-red-800/30'; textColor = 'text-red-300'; borderColor = 'border-red-700/50'; iconColor = 'text-red-400';
                        } else if (nudge.color === 'purple') {
                            bgColor = 'bg-purple-800/30'; textColor = 'text-purple-300'; borderColor = 'border-purple-700/50'; iconColor = 'text-purple-400';
                        }

                        return (
                            <li key={index} className={`p-2.5 rounded-md text-sm flex items-start ${bgColor} ${textColor} border ${borderColor}`}>
                                <NudgeIcon size={18} className={`mr-2.5 mt-0.5 flex-shrink-0 ${iconColor}`} />
                                {nudge.text}
                            </li>
                        );
                    })}
                </ul>
                ) : (
                <p className="text-gray-500 text-sm italic">
                    {isLoadingData ? "Checking for nudges..." : "All caught up! No nudges for now."}
                </p>
                )}
            </Section>
        </div>
      </div>
    </div>
  );
}

export default NotesGoalsCommandCenterPage;
