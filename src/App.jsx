// src/App.jsx
import React, { useState, useEffect } from 'react';
// Ensure ONLY TopNavbar is imported for navigation
import TopNavbar, { VIEWS } from './components/TopNavbar'; 
import AccountsPage from './components/AccountsPage';
import MatchHistoryPage from './pages/MatchHistoryPage';

// Placeholder pages (create actual files in src/pages/ or keep these simple versions)
const DashboardPage = () => <div className="p-10 text-3xl text-white bg-gray-800 rounded-lg m-4">Dashboard Page Content</div>;
const StatsPage = () => <div className="p-10 text-3xl text-white bg-gray-800 rounded-lg m-4">Stats Page Content</div>;
const VodReviewPage = () => <div className="p-10 text-3xl text-white bg-gray-800 rounded-lg m-4">VOD Review Page Content</div>;


function App() {
  const [currentView, setCurrentView] = useState(VIEWS.MATCH_HISTORY); 

  useEffect(() => {
    // This log helps confirm the current view state
    console.log(`App.jsx: currentView is now: ${currentView}`);
  }, [currentView]);

  // Background style for the entire application
  const backgroundStyle = {
    backgroundImage: `radial-gradient(ellipse at 50% -20%, hsla(28, 100%, 50%, 0.1) 0%, transparent 60%), radial-gradient(ellipse at 10% 0%, hsla(28, 100%, 50%, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 90% 0%, hsla(28, 100%, 50%, 0.08) 0%, transparent 50%)`,
    backgroundAttachment: 'fixed',
  };

  const renderView = () => {
    switch (currentView) {
      case VIEWS.DASHBOARD:
         return <DashboardPage />;
      case VIEWS.MATCH_HISTORY:
        return <MatchHistoryPage />;
      case VIEWS.STATS:
         return <StatsPage />;
      case VIEWS.VOD_REVIEW:
         return <VodReviewPage />;
      case VIEWS.MANAGE_ACCOUNTS:
        return <AccountsPage />;
      default:
        // Fallback to a default view if currentView is somehow invalid
        return <MatchHistoryPage />; 
    }
  };

  return (
    // Main container uses flex-col for top navbar layout
    <div className="flex flex-col min-h-screen font-sans bg-gray-900" style={backgroundStyle}>
      {/* TopNavbar is rendered here */}
      <TopNavbar currentView={currentView} setCurrentView={setCurrentView} />
      
      {/* Main content area with padding-top to account for fixed navbar height (h-16 from TopNavbar = 4rem = 64px) */}
      {/* The content itself will be centered by the page components if needed */}
      <main className="flex-1 pt-16 w-full"> 
        {renderView()}
      </main>
    </div>
  );
}

export default App;
