// src/components/AccountsPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PlusCircle, Trash2, Loader2, ImageOff, Globe, Search } from 'lucide-react';
import { db } from '../firebaseConfig';
import { collection, addDoc, getDocs, deleteDoc, doc, query, where, serverTimestamp } from 'firebase/firestore';

const RIOT_API_KEY = import.meta.env.VITE_RIOT_API_KEY; 
const RIOT_ACCOUNT_API_ROUTE = 'europe';

const PLATFORM_OPTIONS = [
  { value: 'euw1', label: 'EU West' },
  { value: 'eun1', label: 'EU Nordic & East' },
];

function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [riotIdInput, setRiotIdInput] = useState('');
  const [selectedPlatformId, setSelectedPlatformId] = useState(PLATFORM_OPTIONS[0].value);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [ddragonVersion, setDdragonVersion] = useState('');


  useEffect(() => {
    if (!RIOT_API_KEY) {
      console.error("RIOT API Key is not loaded. Make sure it's set in your .env file as VITE_RIOT_API_KEY and you've restarted the dev server.");
      setError("Configuration error: Riot API Key is missing. Please contact support or check setup.");
    }
  }, []);
  
  useEffect(() => {
    fetch('https://ddragon.leagueoflegends.com/api/versions.json')
      .then(res => res.json())
      .then(versions => {
        if (versions && versions.length > 0) {
          setDdragonVersion(versions[0]);
        }
      })
      .catch(err => console.error("Failed to fetch DDragon versions:", err));
  }, []);

  const accountsCollectionRef = useMemo(() => {
    if (!db) return null;
    return collection(db, "trackedAccounts");
  }, []);

  const fetchAccounts = useCallback(async () => {
    if (!accountsCollectionRef) {
      setError("Firestore connection error. Check console or extensions.");
      setIsFetching(false);
      return;
    }
    setIsFetching(true);
    setError('');
    try {
      const data = await getDocs(accountsCollectionRef);
      const fetchedAccounts = data.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
      fetchedAccounts.sort((a, b) => {
        const aHasTimestamp = a.addedAt && typeof a.addedAt.seconds === 'number';
        const bHasTimestamp = b.addedAt && typeof b.addedAt.seconds === 'number';
        if (aHasTimestamp && bHasTimestamp) return a.addedAt.seconds - b.addedAt.seconds;
        if (aHasTimestamp) return -1;
        if (bHasTimestamp) return 1;
        return (a.name || "").localeCompare(b.name || "");
      });
      setAccounts(fetchedAccounts);
    } catch (err) {
      console.error("Error fetching accounts from Firestore: ", err);
      setError("Failed to fetch accounts. Check network or browser extensions.");
    } finally {
      setIsFetching(false);
    }
  }, [accountsCollectionRef]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleAddAccount = async (e) => {
    e.preventDefault();
    if (!accountsCollectionRef || !ddragonVersion) {
      setError(!accountsCollectionRef ? "Firestore error." : "DDragon data not ready.");
      return;
    }
    setError('');
    setSuccessMessage('');
    setIsLoading(true);

    if (!riotIdInput.includes('#')) {
      setError('Invalid Riot ID. Use GameName#TagLine.');
      setIsLoading(false);
      return;
    }
    const [namePart, tagPart] = riotIdInput.split('#');
    if (!namePart || !tagPart) {
      setError('Game Name and TagLine are required.');
      setIsLoading(false);
      return;
    }

    const trimmedName = namePart.trim();
    const trimmedTag = tagPart.trim();
    const fullRiotId = `${trimmedName}#${trimmedTag}`;
    const lowerCaseRiotId = fullRiotId.toLowerCase();

    const q = query(accountsCollectionRef, 
        where("riotId", "==", lowerCaseRiotId),
        where("platformId", "==", selectedPlatformId)
    );

    try {
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const platformLabel = PLATFORM_OPTIONS.find(p => p.value === selectedPlatformId)?.label || selectedPlatformId.toUpperCase();
        setError(`Account ${fullRiotId} on ${platformLabel} is already added.`);
        setIsLoading(false);
        return;
      }

      const puuidApiUrl = `https://${RIOT_ACCOUNT_API_ROUTE}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(trimmedName)}/${encodeURIComponent(trimmedTag)}?api_key=${RIOT_API_KEY}`;
      const puuidResponse = await fetch(puuidApiUrl);
      if (!puuidResponse.ok) {
        const errorData = await puuidResponse.json().catch(() => ({ message: "Unknown Riot API error (PUUID fetch)" }));
        throw { status: puuidResponse.status, data: errorData, step: "PUUID fetch" };
      }
      const accountDataFromApi = await puuidResponse.json();
      const puuid = accountDataFromApi.puuid;
      if (!puuid) {
        setError("PUUID not found in Riot API response.");
        setIsLoading(false);
        return;
      }

      const summonerApiUrl = `https://${selectedPlatformId}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}?api_key=${RIOT_API_KEY}`;
      const summonerResponse = await fetch(summonerApiUrl);
      let profileIconId = null;
      if (summonerResponse.ok) {
        const summonerData = await summonerResponse.json();
        profileIconId = summonerData.profileIconId;
      } else {
        const errorData = await summonerResponse.json().catch(() => ({ message: "Unknown Riot API error (Summoner fetch)" }));
        console.warn(`Could not fetch LoL summoner data for ${fullRiotId} on ${selectedPlatformId}. Status:`, summonerResponse.status, errorData);
      }

      const newAccountData = {
        riotId: lowerCaseRiotId,
        name: trimmedName,
        tag: trimmedTag,
        puuid: puuid,
        profileIconId: profileIconId,
        platformId: selectedPlatformId,
        addedAt: serverTimestamp(),
      };

      await addDoc(accountsCollectionRef, newAccountData);
      const platformLabel = PLATFORM_OPTIONS.find(p => p.value === selectedPlatformId)?.label || selectedPlatformId.toUpperCase();
      setSuccessMessage(`Account ${fullRiotId} (${platformLabel}) added!`);
      setRiotIdInput('');
      fetchAccounts();
    } catch (err) {
      console.error("Error during add account process: ", err);
      let errorMessage = "Failed to add account. ";
      if (err.step) {
        errorMessage += `Error during ${err.step}: ${err.status}. `;
        if (err.status === 403) errorMessage += "Forbidden. Check API key.";
        else if (err.status === 404 && err.step === "PUUID fetch") errorMessage += "Riot Account not found.";
        else errorMessage += err.data?.status?.message || err.data?.message || "Try again.";
      } else if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
          errorMessage = "Network error or CORS issue. Ensure CORS is handled.";
      } else errorMessage += "Try again.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveAccount = async (accountId, displayRiotId) => {
    if (!accountsCollectionRef) {
      setError("Firestore connection error.");
      return;
    }
    setIsLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      const accountDoc = doc(db, "trackedAccounts", accountId);
      await deleteDoc(accountDoc);
      setSuccessMessage(`Account ${displayRiotId || 'selected'} removed.`);
      fetchAccounts();
    } catch (err) {
      console.error("Error removing account from Firestore: ", err);
      setError("Failed to remove account.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const getProfileIconUrl = (profileIconId) => {
    if (!profileIconId || !ddragonVersion) return null;
    return `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/profileicon/${profileIconId}.png`;
  };

  // Style for the shining background effect
  const backgroundStyle = {
    backgroundImage: `radial-gradient(ellipse at 50% -20%, hsla(28, 100%, 50%, 0.1) 0%, transparent 60%), radial-gradient(ellipse at 10% 0%, hsla(28, 100%, 50%, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 90% 0%, hsla(28, 100%, 50%, 0.08) 0%, transparent 50%)`,
    backgroundAttachment: 'fixed', // Keep gradient fixed during scroll
  };


  return (
    // Updated main container with new background and style object
    <div 
      className="w-full min-h-screen bg-gray-900 text-gray-200 flex flex-col items-center p-4 sm:p-6 md:p-8"
      style={backgroundStyle}
    >
      {/* Reduced max-width for the main content wrapper */}
      <div className="w-full max-w-2xl"> 
        <header className="mb-12 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-orange-500 tracking-tight">Manage Accounts</h1>
          <p className="text-gray-500 mt-3 text-lg">Add your League of Legends accounts to start tracking.</p>
        </header>

        {/* "Add New Account" section with updated background and reduced bottom margin */}
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
                  placeholder="Summoner Name#TAG"
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
              disabled={isLoading || isFetching || !ddragonVersion}
            >
              {(isLoading && !isFetching) ? <Loader2 size={20} className="mr-2 animate-spin" /> : <PlusCircle size={20} className="mr-2" />}
              Add Account
            </button>
            {!ddragonVersion && !isFetching && <p className="text-xs text-gray-500 mt-1 text-center">Initializing data...</p>}
            {error && <p className="text-red-400 text-sm mt-2 break-words text-center py-2 px-3 bg-red-900/30 rounded-md border border-red-700/50">{error}</p>}
            {successMessage && !error && <p className="text-green-400 text-sm mt-2 text-center py-2 px-3 bg-green-900/30 rounded-md border border-green-700/50">{successMessage}</p>}
          </form>
        </section>

        {/* Accounts list section */}
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
                let platformLabel = 'Unknown Platform';
                if (account.platformId) {
                    const foundPlatform = PLATFORM_OPTIONS.find(p => p.value === account.platformId);
                    platformLabel = foundPlatform ? foundPlatform.label : account.platformId.toUpperCase();
                }

                return (
                  <li
                    key={account.id}
                    className="bg-gray-800/70 backdrop-blur-md border border-gray-700/60 p-4 rounded-lg shadow-lg flex items-center justify-between transition-all duration-200 ease-in-out hover:bg-gray-700/90 hover:shadow-xl hover:border-gray-600"
                  >
                    <div className="flex items-center overflow-hidden flex-1 min-w-0">
                      {profileIconUrl ? (
                        <img src={profileIconUrl} alt="Profile Icon" className="w-12 h-12 rounded-full mr-4 flex-shrink-0 border-2 border-gray-600"/>
                      ) : (
                        <div className="w-12 h-12 rounded-full mr-4 bg-gray-700 flex items-center justify-center flex-shrink-0 border-2 border-gray-600">
                           <ImageOff size={24} className="text-gray-500" />
                        </div>
                      )}
                      <div className="flex-grow min-w-0">
                        <span className="font-semibold text-lg text-gray-100 block truncate" title={`${account.name || 'N/A'}#${account.tag || 'N/A'} (${platformLabel})`}>
                          {account.name || 'No Name'} <span className="text-gray-400 font-normal">#{account.tag || 'N/A'}</span>
                        </span>
                        <span className="block text-sm text-orange-400/80 flex items-center mt-0.5">
                            <Globe size={14} className="mr-1.5 flex-shrink-0 text-orange-500/70"/> {platformLabel}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveAccount(account.id, `${account.name || 'N/A'}#${account.tag || 'N/A'}`)}
                      className="text-gray-500 hover:text-red-500 transition-colors p-2 rounded-md hover:bg-red-500/10 disabled:opacity-50 flex-shrink-0 ml-3"
                      aria-label={`Remove account ${account.name || 'N/A'}#${account.tag || 'N/A'}`}
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
