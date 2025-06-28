// src/components/AccountsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { PlusCircle, Trash2, Loader2, ImageOff, Globe, Search } from 'lucide-react';
// Import the Dexie db instance - This is kept as is to integrate with your project.
import { db } from '../dexieConfig'; 

// RIOT_API_KEY is kept as is to integrate with your project's environment variables.
const RIOT_API_KEY = import.meta.env.VITE_RIOT_API_KEY;
const DEFAULT_RIOT_ACCOUNT_API_ROUTE = 'europe';

const PLATFORM_OPTIONS = [
  { value: 'euw1', label: 'EU West', route: 'europe' },
  { value: 'eun1', label: 'EU Nordic & East', route: 'europe' },
  { value: 'na1', label: 'North America', route: 'americas' },
  { value: 'kr', label: 'Korea', route: 'asia' },
];

// Helper to get continental route from platformId
const getContinentalRouteForPlatform = (platformId) => {
  const platform = PLATFORM_OPTIONS.find(p => p.value === platformId);
  return platform ? platform.route : DEFAULT_RIOT_ACCOUNT_API_ROUTE;
};


function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [riotIdInput, setRiotIdInput] = useState('');
  const [selectedPlatformId, setSelectedPlatformId] = useState(PLATFORM_OPTIONS[0].value);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [ddragonVersion, setDdragonVersion] = useState('');

  // Effect to check for RIOT_API_KEY
  useEffect(() => {
    if (!RIOT_API_KEY) {
      console.error("RIOT API Key is not loaded. Make sure it's set in your .env file as VITE_RIOT_API_KEY and you've restarted the dev server.");
      setError("Configuration error: Riot API Key is missing. Please contact support or check setup.");
    }
  }, []);

  // Effect to fetch DDragon versions
  useEffect(() => {
    fetch('https://ddragon.leagueoflegends.com/api/versions.json')
      .then(res => res.json())
      .then(versions => {
        if (versions && versions.length > 0) {
          setDdragonVersion(versions[0]);
        }
      })
      .catch(err => {
        console.error("Failed to fetch DDragon versions:", err);
        setError("Could not fetch essential game data (DDragon versions). Some features might not work.");
      });
  }, []);

  // Callback to fetch accounts from Dexie
  const fetchAccounts = useCallback(async () => {
    setIsFetching(true);
    setError('');
    try {
      // Fetch accounts from Dexie and sort by 'addedAt'
      const fetchedAccounts = await db.trackedAccounts.orderBy('addedAt').toArray();
      setAccounts(fetchedAccounts);
    } catch (err) {
      console.error("Error fetching accounts from Dexie: ", err);
      setError("Failed to fetch accounts. Check console or browser extensions.");
    } finally {
      setIsFetching(false);
    }
  }, []);

  // Effect to fetch accounts on component mount
  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Handler to add a new account
  const handleAddAccount = async (e) => {
    e.preventDefault();
    if (!ddragonVersion) {
      setError("DDragon data not ready. Please wait a moment.");
      return;
    }
    setError('');
    setSuccessMessage('');
    setIsLoading(true);

    if (!riotIdInput.includes('#')) {
      setError('Invalid Riot ID. Format must be GameName#TagLine.');
      setIsLoading(false);
      return;
    }
    const [namePart, tagPart] = riotIdInput.split('#');
    if (!namePart || !tagPart) {
      setError('Both Game Name and TagLine are required.');
      setIsLoading(false);
      return;
    }

    const trimmedName = namePart.trim();
    const trimmedTag = tagPart.trim();
    const lowerCaseRiotId = `${trimmedName.toLowerCase()}#${trimmedTag.toLowerCase()}`;

    try {
      const existingAccount = await db.trackedAccounts
        .where({ riotId: lowerCaseRiotId, platformId: selectedPlatformId })
        .first();

      if (existingAccount) {
        const platformLabel = PLATFORM_OPTIONS.find(p => p.value === selectedPlatformId)?.label || selectedPlatformId.toUpperCase();
        setError(`Account ${trimmedName}#${trimmedTag} on ${platformLabel} is already added.`);
        setIsLoading(false);
        return;
      }

      const continentalRoute = getContinentalRouteForPlatform(selectedPlatformId);
      const puuidApiUrl = `https://${continentalRoute}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(trimmedName)}/${encodeURIComponent(trimmedTag)}?api_key=${RIOT_API_KEY}`;

      const puuidResponse = await fetch(puuidApiUrl);
      if (!puuidResponse.ok) {
        const errorData = await puuidResponse.json().catch(() => ({ message: "Unknown Riot API error (PUUID fetch)" }));
        throw { status: puuidResponse.status, data: errorData, step: "PUUID fetch" };
      }
      const accountDataFromApi = await puuidResponse.json();
      const puuid = accountDataFromApi.puuid;
      if (!puuid) {
        setError("PUUID not found in Riot API response. The Riot ID might be incorrect or the account non-existent on the selected route.");
        setIsLoading(false);
        return;
      }

      let profileIconId = null;
      try {
        const summonerApiUrl = `https://${selectedPlatformId}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}?api_key=${RIOT_API_KEY}`;
        const summonerResponse = await fetch(summonerApiUrl);
        if (summonerResponse.ok) {
          const summonerData = await summonerResponse.json();
          profileIconId = summonerData.profileIconId;
        } else {
          console.warn(`Could not fetch LoL summoner data for ${trimmedName}#${trimmedTag} on ${selectedPlatformId}.`);
        }
      } catch (summonerErr) {
         console.warn(`Error fetching summoner data for profile icon: `, summonerErr);
      }


      const newAccountData = {
        riotId: lowerCaseRiotId,
        name: trimmedName,
        tag: trimmedTag,
        puuid: puuid,
        profileIconId: profileIconId,
        platformId: selectedPlatformId,
        addedAt: new Date(),
        lastUpdated: null,
      };

      await db.trackedAccounts.add(newAccountData);
      setSuccessMessage(`Account ${trimmedName}#${trimmedTag} added!`);
      setRiotIdInput('');
      fetchAccounts(); 
    } catch (err) {
      console.error("Error during add account process: ", err);
      let errorMessage = "Failed to add account. ";
      if (err.step) {
        errorMessage += `Error during ${err.step}: ${err.status || 'Unknown status'}. `;
        if (err.status === 403) errorMessage += "Forbidden. Check API key permissions or rate limits.";
        else if (err.status === 404 && err.step === "PUUID fetch") errorMessage += "Riot Account not found on the selected region's routing server.";
        else errorMessage += err.data?.status?.message || err.data?.message || "Please try again.";
      } else if (err.name === 'ConstraintError') {
        errorMessage = `Account already exists or another constraint failed.`;
      } else if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
          errorMessage = "Network error. Please check your internet connection or if Riot API is down.";
      } else {
        errorMessage += (err.message || "An unexpected error occurred. Please try again.");
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveAccount = (accountId, displayRiotId) => {
      // Using a custom modal or confirmation dialog is better than window.confirm
      // For this example, we'll keep it simple.
      const isConfirmed = window.confirm(`Are you sure you want to remove ${displayRiotId}? This will also remove all locally stored matches for this account.`);
      if (isConfirmed) {
          const performRemove = async () => {
              setIsLoading(true);
              setError('');
              setSuccessMessage('');
              try {
                  await db.transaction('rw', db.trackedAccounts, db.matches, async () => {
                      await db.matches.where('trackedAccountDocId').equals(accountId).delete();
                      await db.trackedAccounts.delete(accountId);
                  });
                  setSuccessMessage(`Account ${displayRiotId || 'selected'} and its matches removed.`);
                  fetchAccounts();
              } catch (err) {
                  console.error("Error removing account from Dexie: ", err);
                  setError("Failed to remove account. Check console.");
              } finally {
                  setIsLoading(false);
              }
          };
          performRemove();
      }
  };


  const getProfileIconUrl = (profileIconId) => {
    if (!profileIconId || !ddragonVersion) return `https://placehold.co/48x48/333/ccc?text=?`;
    return `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/profileicon/${profileIconId}.png`;
  };
  
  const scrollbarStyles = `
    .custom-scrollbar::-webkit-scrollbar {
      width: 8px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 10px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: rgba(234, 88, 12, 0.5);
      border-radius: 10px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: rgba(234, 88, 12, 0.7);
    }
  `;

  const backgroundStyle = {
    backgroundImage: `radial-gradient(ellipse at 50% -20%, hsla(28, 100%, 50%, 0.1) 0%, transparent 60%), radial-gradient(ellipse at 10% 0%, hsla(28, 100%, 50%, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 90% 0%, hsla(28, 100%, 50%, 0.08) 0%, transparent 50%)`,
    backgroundAttachment: 'fixed',
  };

return (
    // THE ULTIMATE FIX:
    // This single container does everything correctly.
    // - `min-h-screen`: Ensures the container is at least as tall as the screen.
    // - `w-full`: Full width.
    // - `flex items-center justify-center`: This is the classic way to center a child element both vertically and horizontally.
    // - `p-4`: Provides padding around the content so it never touches the screen edges.
    //
    // HOW IT WORKS:
    // - On large screens: The content fits, so `justify-center` centers it vertically.
    // - On small screens: The content is taller than the screen. The container grows to fit the tall content,
    //   and the browser creates a SINGLE, NORMAL page scrollbar, which is the correct and expected behavior.
    <div
      className="w-full h-[calc(100vh-4rem)] bg-gray-900 text-gray-200 flex items-center justify-center p-4"
      style={backgroundStyle}
    >
      <style>{scrollbarStyles}</style>
      
      {/* This child grid is now perfectly centered by its parent and needs no special classes. */}
      <div className="w-full max-w-3xl grid grid-cols-1 lg:grid-cols-11 gap-4 lg:gap-0 items-center">
        
        {/* ==================================================================== */}
        {/* ========= NO CHANGES ARE NEEDED BELOW THIS LINE ==================== */}
        {/* ==================================================================== */}

        <section className="lg:col-span-6 bg-black/30 backdrop-blur-md rounded-l-xl shadow-2xl border border-gray-700/50 p-6 sm:p-8 flex flex-col h-[410px]">
            <h2 className="text-2xl sm:text-3xl font-semibold text-orange-400 mb-6 text-center sm:text-left">Add Account</h2>
            <div className="flex-grow">
                <form onSubmit={handleAddAccount} className="space-y-6">
                  <div>
                      <label htmlFor="riotIdInput" className="block text-sm font-medium text-gray-400 mb-1.5">
                          Riot ID (GameName#TagLine)
                      </label>
                      <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <Search size={18} className="text-gray-500" />
                          </div>
                          <input
                              type="text"
                              id="riotIdInput"
                              value={riotIdInput}
                              onChange={(e) => setRiotIdInput(e.target.value)}
                              placeholder="YourGameName#TAG"
                              className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-100 placeholder-gray-500 transition-colors"
                              required
                              disabled={isLoading || isFetching || !ddragonVersion}
                          />
                      </div>
                  </div>

                  <div>
                      <label htmlFor="platformId" className="block text-sm font-medium text-gray-400 mb-1.5">
                          Platform
                      </label>
                      <select
                          id="platformId"
                          value={selectedPlatformId}
                          onChange={(e) => setSelectedPlatformId(e.target.value)}
                          className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-100 transition-colors"
                          disabled={isLoading || isFetching || !ddragonVersion}
                      >
                          {PLATFORM_OPTIONS.map(option => (
                              <option key={option.value} value={option.value} className="bg-gray-800 text-gray-200">{option.label}</option>
                          ))}
                      </select>
                  </div>

                  <button
                      type="submit"
                      className="w-full bg-orange-600 hover:bg-orange-500 text-white font-semibold py-3.5 px-4 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:ring-offset-gray-900 flex items-center justify-center transition-all duration-150 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed"
                      disabled={isLoading || isFetching || !ddragonVersion || !RIOT_API_KEY}
                  >
                      {(isLoading && !isFetching) ? <Loader2 size={20} className="mr-2 animate-spin" /> : <PlusCircle size={20} className="mr-2" />}
                      Add Account
                  </button>
                </form>
            </div>
            <div>
              {!ddragonVersion && !isFetching && <p className="text-xs text-gray-500 mt-1 text-center">Initializing data...</p>}
              {!RIOT_API_KEY && <p className="text-xs text-red-500 mt-1 text-center">API Key missing. Cannot add accounts.</p>}
              {error && <p className="text-red-400 text-sm mt-2 break-words text-center py-2 px-3 bg-red-900/30 rounded-md border border-red-700/50">{error}</p>}
              {successMessage && !error && <p className="text-green-400 text-sm mt-2 text-center py-2 px-3 bg-green-900/30 rounded-md border border-green-700/50">{successMessage}</p>}
            </div>
        </section>

        <section className="lg:col-span-5 bg-black/50 backdrop-blur-md rounded-r-xl shadow-2xl p-6 sm:p-6 flex flex-col h-96 border-t border-r border-b border-gray-700/50">
            <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 -mr-2">
              {isFetching ? (
                    <div className="flex flex-col justify-center items-center h-full">
                        <Loader2 size={40} className="text-orange-500 animate-spin" />
                        <p className="ml-3 text-gray-400 mt-4 text-lg">Loading accounts...</p>
                    </div>
                ) : accounts.length === 0 ? (
                    <div className="text-center h-full flex flex-col justify-center items-center py-10 px-6 bg-gray-900/50 rounded-xl border border-dashed border-gray-700">
                        <Search size={48} className="text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-500 text-lg">No accounts added yet.</p>
                        <p className="text-gray-600 text-sm">Use the form to start tracking.</p>
                    </div>
                ) : (
                    <ul className="space-y-4">
                        {accounts.map((account) => {
                            const profileIconUrl = getProfileIconUrl(account.profileIconId);
                            const platformLabel = PLATFORM_OPTIONS.find(p => p.value === account.platformId)?.label || account.platformId.toUpperCase();
                            const displayRiotId = `${account.name || 'N/A'}#${account.tag || 'N/A'}`;

                            return (
                                <li
                                    key={account.id}
                                    className="bg-gray-800/70 border border-gray-700/60 p-3 rounded-lg shadow-lg flex items-center justify-between transition-all duration-200 ease-in-out hover:bg-gray-700/90 hover:shadow-xl hover:border-gray-600"
                                >
                                    <div className="flex items-center overflow-hidden flex-1 min-w-0">
                                        {account.profileIconId ? (
                                            <img src={profileIconUrl} alt="Profile Icon" className="w-11 h-11 rounded-full mr-4 flex-shrink-0 border-2 border-gray-600" onError={(e) => e.target.src = `https://placehold.co/48x48/333/ccc?text=${account.name ? account.name.substring(0,1) : '?'}`}/>
                                        ) : (
                                            <div className="w-11 h-11 rounded-full mr-4 bg-gray-700 flex items-center justify-center flex-shrink-0 border-2 border-gray-600">
                                                <ImageOff size={22} className="text-gray-500" />
                                            </div>
                                        )}
                                        <div className="flex-grow min-w-0">
                                            <span className="font-semibold text-sm text-gray-100 block truncate" title={`${displayRiotId} (${platformLabel})`}>
                                                {account.name || 'No Name'} <span className="text-gray-400 font-normal">#{account.tag || 'N/A'}</span>
                                            </span>
                                            <span className="text-sm text-orange-400/80 flex items-center mt-0.5">
                                                <Globe size={14} className="mr-1.5 flex-shrink-0 text-orange-500/70" /> {platformLabel}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleRemoveAccount(account.id, displayRiotId)}
                                        className="text-gray-500 hover:text-red-500 transition-colors p-2 rounded-md hover:bg-red-500/10 disabled:opacity-50 flex-shrink-0 ml-3"
                                        aria-label={`Remove account ${displayRiotId}`}
                                        disabled={isLoading}
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </section>
      </div>
    </div>
  );
}

export default AccountsPage;
