import React, { useState, useEffect } from "react";
import TopNavbar, { VIEWS } from "./components/TopNavbar"; // Import VIEWS from TopNavbar
import AccountsPage from "./components/AccountsPage";
import MatchHistoryPage from "./pages/MatchHistoryPage";
import NotesGoalsCommandCenterPage from "./pages/NotesGoalsCommandCenterPage"; // Import the new page
import StatsPage from "./pages/StatsPage";

// Placeholder pages
const DashboardPage = () => <div className="p-10 text-3xl text-white bg-gray-800 rounded-lg m-4">Dashboard Page Content</div>;
const VodReviewPage = () => <div className="p-10 text-3xl text-white bg-gray-800 rounded-lg m-4">VOD Review Page Content</div>;

function App() {
  const [currentView, setCurrentView] = useState(VIEWS.MATCH_HISTORY);

  useEffect(() => {
    console.log(`App.jsx: currentView is now: ${currentView}`);
  }, [currentView]);

  const backgroundStyle = {
    backgroundImage: `radial-gradient(ellipse at 50% -20%, hsla(28, 100%, 50%, 0.1) 0%, transparent 60%), radial-gradient(ellipse at 10% 0%, hsla(28, 100%, 50%, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 90% 0%, hsla(28, 100%, 50%, 0.08) 0%, transparent 50%)`,
    backgroundAttachment: "fixed",
  };

  const renderView = () => {
    switch (currentView) {
      case VIEWS.DASHBOARD:
        return <DashboardPage />;
      case VIEWS.MATCH_HISTORY:
        return <MatchHistoryPage />;
      case VIEWS.NOTES_GOALS_COMMAND_CENTER: // New case
        return <NotesGoalsCommandCenterPage />;
      case VIEWS.STATS:
        return <StatsPage />;
      case VIEWS.VOD_REVIEW:
        return <VodReviewPage />;
      case VIEWS.MANAGE_ACCOUNTS:
        return <AccountsPage />;
      default:
        return <MatchHistoryPage />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-900" style={backgroundStyle}>
      <TopNavbar currentView={currentView} setCurrentView={setCurrentView} />
      <main className="flex-1 pt-[50px] w-full">{renderView()}</main>
    </div>
  );
}

export default App;
