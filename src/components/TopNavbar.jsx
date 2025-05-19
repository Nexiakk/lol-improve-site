// src/components/TopNavbar.jsx
import React from 'react';
import { History, Users, LayoutDashboard, NotebookText } from 'lucide-react'; // Added NotebookText

// VIEWS constant should be imported from a shared location or defined here if not.
// For now, let's assume App.jsx will pass the VIEWS object or handle it.
// Or, we can redefine/import it here if Sidebar.jsx is being fully replaced.
export const VIEWS = {
  DASHBOARD: 'DASHBOARD',
  MATCH_HISTORY: 'MATCH_HISTORY',
  STATS: 'STATS',
  VOD_REVIEW: 'VOD_REVIEW',
  MANAGE_ACCOUNTS: 'MANAGE_ACCOUNTS',
  NOTES_GOALS_COMMAND_CENTER: 'NOTES_GOALS_COMMAND_CENTER', // New View
};

const NavItem = ({ icon: Icon, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`
      flex items-center px-3 py-2 mx-1 rounded-md text-sm font-medium transition-all duration-150 ease-in-out
      group hover:bg-gray-700/70 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-orange-500
      ${isActive ? 'bg-orange-600 text-white shadow-md' : 'text-gray-300 hover:text-white'}
    `}
  >
    {Icon && <Icon size={18} className={`mr-2 flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-orange-400'}`} />}
    <span>{label}</span>
  </button>
);

function TopNavbar({ currentView, setCurrentView }) {
  const navItems = [
    // { id: VIEWS.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
    { id: VIEWS.MATCH_HISTORY, label: 'Match History', icon: History },
    { id: VIEWS.NOTES_GOALS_COMMAND_CENTER, label: 'Goals Hub', icon: NotebookText }, // New Nav Item
    // { id: VIEWS.STATS, label: 'Stats', icon: BarChart3 },
    // { id: VIEWS.VOD_REVIEW, label: 'VOD Review', icon: Clapperboard }, // Placeholder
    { id: VIEWS.MANAGE_ACCOUNTS, label: 'Accounts', icon: Users },
  ];

  const handleNavClick = (viewId) => {
    console.log(`TopNavbar: Attempting to set view to: ${viewId}`);
    setCurrentView(viewId);
  };

  return (
    <nav className="w-full bg-gray-800 shadow-lg fixed top-0 left-0 right-0 z-20 border-b border-gray-700/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"> {/* Container for navbar items */}
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <div className="flex-shrink-0">
            <button 
              onClick={() => handleNavClick(VIEWS.MATCH_HISTORY)} // Or a dedicated dashboard/home view
              className="text-2xl font-bold text-orange-500 hover:text-orange-400 transition-colors"
            >
              LoL Pro Dev
            </button>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex md:items-center md:space-x-2">
            {navItems.map((item) => (
              <NavItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                isActive={currentView === item.id}
                onClick={() => handleNavClick(item.id)}
              />
            ))}
          </div>
          
          {/* Mobile Menu Button (Placeholder - functionality not implemented) */}
          <div className="md:hidden flex items-center">
            <button className="text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-orange-500 p-2 rounded-md">
              <svg className="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default TopNavbar;