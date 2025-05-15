// src/components/AccountsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { PlusCircle, Trash2, Loader2, ImageOff, Globe, Search } from 'lucide-react';
// Import the Dexie db instance instead of Firebase
import { db } from '../dexieConfig'; // Changed import

const RIOT_API_KEY = import.meta.env.VITE_RIOT_API_KEY;
// Define the Riot Account API route. This might vary based on the selected platform,
// but for Riot ID to PUUID, 'americas', 'asia', or 'europe' are common.
// We'll use 'europe' as a default and adjust if necessary based on platformId logic.
const DEFAULT_RIOT_ACCOUNT_API_ROUTE = 'europe';

const PLATFORM_OPTIONS = [
  { value: 'euw1', label: 'EU West', route: 'europe' },
  { value: 'eun1', label: 'EU Nordic & East', route: 'europe' },
  { value: 'na1', label: 'North America', route: 'americas' },
  { value: 'kr', label: 'Korea', route: 'asia' },
  // Add other platforms as needed, ensuring their continental route is specified
  // e.g., { value: 'br1', label: 'Brazil', route: 'americas' }
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
    // Store riotId in lowercase for case-insensitive duplicate checking, but display with original casing.
    const lowerCaseRiotId = `${trimmedName.toLowerCase()}#${trimmedTag.toLowerCase()}`;

    try {
      // Check if account already exists in Dexie
      const existingAccount = await db.trackedAccounts
        .where({ riotId: lowerCaseRiotId, platformId: selectedPlatformId })
        .first();

      if (existingAccount) {
        const platformLabel = PLATFORM_OPTIONS.find(p => p.value === selectedPlatformId)?.label || selectedPlatformId.toUpperCase();
        setError(`Account ${trimmedName}#${trimmedTag} on ${platformLabel} is already added.`);
        setIsLoading(false);
        return;
      }

      // Determine the correct continental route for the Riot Account API
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

      // Fetch summoner data for profileIconId (optional, can fail gracefully)
      let profileIconId = null;
      try {
        const summonerApiUrl = `https://${selectedPlatformId}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}?api_key=${RIOT_API_KEY}`;
        const summonerResponse = await fetch(summonerApiUrl);
        if (summonerResponse.ok) {
          const summonerData = await summonerResponse.json();
          profileIconId = summonerData.profileIconId;
        } else {
          const errorData = await summonerResponse.json().catch(() => ({ message: "Unknown Riot API error (Summoner fetch)" }));
          console.warn(`Could not fetch LoL summoner data for ${trimmedName}#${trimmedTag} on ${selectedPlatformId}. Status:`, summonerResponse.status, errorData);
        }
      } catch (summonerErr) {
         console.warn(`Error fetching summoner data for profile icon: `, summonerErr);
      }


      const newAccountData = {
        riotId: lowerCaseRiotId, // Store the lookup key
        name: trimmedName,       // Store original case for display
        tag: trimmedTag,         // Store original case for display
        puuid: puuid,
        profileIconId: profileIconId,
        platformId: selectedPlatformId,
        addedAt: new Date(), // Use JavaScript Date object for Dexie
        lastUpdated: null, // Initialize lastUpdated as null or a very old date
      };

      // Add to Dexie
      await db.trackedAccounts.add(newAccountData);
      const platformLabel = PLATFORM_OPTIONS.find(p => p.value === selectedPlatformId)?.label || selectedPlatformId.toUpperCase();
      setSuccessMessage(`Account ${trimmedName}#${trimmedTag} (${platformLabel}) added!`);
      setRiotIdInput('');
      fetchAccounts(); // Refresh the list
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

  // Handler to remove an account
  const handleRemoveAccount = async (accountId, displayRiotId) => {
    // accountId is the auto-incremented primary key from Dexie
    if (window.confirm(`Are you sure you want to remove ${displayRiotId}? This will also remove all locally stored matches for this account.`)) {
      setIsLoading(true);
      setError('');
      setSuccessMessage('');
      try {
        // Dexie uses the primary key directly for deletion
        await db.transaction('rw', db.trackedAccounts, db.matches, async () => {
          await db.matches.where('trackedAccountDocId').equals(accountId).delete();
          await db.trackedAccounts.delete(accountId);
        });
        setSuccessMessage(`Account ${displayRiotId || 'selected'} and its matches removed.`);
        fetchAccounts(); // Refresh the list
      } catch (err) {
        console.error("Error removing account from Dexie: ", err);
        setError("Failed to remove account. Check console.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Helper to get profile icon URL
  const getProfileIconUrl = (profileIconId) => {
    if (!profileIconId || !ddragonVersion) return `https://placehold.co/48x48/333/ccc?text=?`; // Fallback placeholder
    return `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/profileicon/${profileIconId}.png`;
  };

  // Background style for the page
  const backgroundStyle = {
    backgroundImage: `radial-gradient(ellipse at 50% -20%, hsla(28, 100%, 50%, 0.1) 0%, transparent 60%), radial-gradient(ellipse at 10% 0%, hsla(28, 100%, 50%, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 90% 0%, hsla(28, 100%, 50%, 0.08) 0%, transparent 50%)`,
    backgroundAttachment: 'fixed',
  };

  return (
    <div
      className="w-full min-h-screen bg-gray-900 text-gray-200 flex flex-col items-center p-4 sm:p-6 md:p-8"
      style={backgroundStyle}
    >
      <div className="w-full max-w-2xl">
        <header className="mb-12 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-orange-500 tracking-tight">Manage Accounts</h1>
          <p className="text-gray-500 mt-3 text-lg">Add your League of Legends accounts to start tracking locally.</p>
        </header>

        <section className="mb-8 bg-black/30 backdrop-blur-md p-6 sm:p-8 rounded-xl shadow-2xl border border-gray-700/50 max-w-md mx-auto">
          <h2 className="text-2xl sm:text-3xl font-semibold text-orange-400 mb-6 text-center sm:text-left">Add Account</h2>
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
            {!ddragonVersion && !isFetching && <p className="text-xs text-gray-500 mt-1 text-center">Initializing data...</p>}
             {!RIOT_API_KEY && <p className="text-xs text-red-500 mt-1 text-center">API Key missing. Cannot add accounts.</p>}
            {error && <p className="text-red-400 text-sm mt-2 break-words text-center py-2 px-3 bg-red-900/30 rounded-md border border-red-700/50">{error}</p>}
            {successMessage && !error && <p className="text-green-400 text-sm mt-2 text-center py-2 px-3 bg-green-900/30 rounded-md border border-green-700/50">{successMessage}</p>}
          </form>
        </section>

        <section className="w-full max-w-md mx-auto">
          {isFetching ? (
            <div className="flex flex-col justify-center items-center p-10 bg-gray-900/80 backdrop-blur-md rounded-xl border border-gray-700/50">
              <Loader2 size={40} className="text-orange-500 animate-spin" />
              <p className="ml-3 text-gray-400 mt-4 text-lg">Loading accounts...</p>
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-10 px-6 bg-gray-900/80 backdrop-blur-md rounded-xl border border-dashed border-gray-700">
              <Search size={48} className="text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No accounts added yet.</p>
              <p className="text-gray-600 text-sm">Use the form above to start tracking.</p>
            </div>
          ) : (
            <ul className="space-y-5">
              {accounts.map((account) => {
                const profileIconUrl = getProfileIconUrl(account.profileIconId);
                const platformLabel = PLATFORM_OPTIONS.find(p => p.value === account.platformId)?.label || account.platformId.toUpperCase();
                const displayRiotId = `${account.name || 'N/A'}#${account.tag || 'N/A'}`;

                return (
                  <li
                    key={account.id} // Dexie's auto-incremented 'id' is the key
                    className="bg-gray-800/70 backdrop-blur-md border border-gray-700/60 p-4 rounded-lg shadow-lg flex items-center justify-between transition-all duration-200 ease-in-out hover:bg-gray-700/90 hover:shadow-xl hover:border-gray-600"
                  >
                    <div className="flex items-center overflow-hidden flex-1 min-w-0">
                      {account.profileIconId ? (
                        <img src={profileIconUrl} alt="Profile Icon" className="w-12 h-12 rounded-full mr-4 flex-shrink-0 border-2 border-gray-600" onError={(e) => e.target.src = `https://placehold.co/48x48/333/ccc?text=${account.name ? account.name.substring(0,1) : '?'}`}/>
                      ) : (
                        <div className="w-12 h-12 rounded-full mr-4 bg-gray-700 flex items-center justify-center flex-shrink-0 border-2 border-gray-600">
                          <ImageOff size={24} className="text-gray-500" />
                        </div>
                      )}
                      <div className="flex-grow min-w-0">
                        <span className="font-semibold text-lg text-gray-100 block truncate" title={`${displayRiotId} (${platformLabel})`}>
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
                      <Trash2 size={20} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export default AccountsPage;
