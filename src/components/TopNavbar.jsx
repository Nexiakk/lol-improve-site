// src/components/TopNavbar.jsx
import React from 'react';
// Correctly import all necessary icons
import { History, Users, NotebookText, BarChart2 } from 'lucide-react';

export const VIEWS = {
  DASHBOARD: 'DASHBOARD',
  MATCH_HISTORY: 'MATCH_HISTORY',
  STATS: 'STATS',
  VOD_REVIEW: 'VOD_REVIEW',
  MANAGE_ACCOUNTS: 'MANAGE_ACCOUNTS',
  NOTES_GOALS_COMMAND_CENTER: 'NOTES_GOALS_COMMAND_CENTER',
};

// Adjusted padding to vertically center content within the new 50px navbar height.
const NavItem = ({ icon: Icon, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`
      relative group flex items-center px-3 py-3 text-sm font-medium
      transition-colors duration-150 ease-in-out cursor-pointer
      focus:outline-none
      ${isActive ? 'text-white' : 'text-gray-400 hover:text-white'}
    `}
  >
    {Icon && <Icon size={16} className={`mr-2 flex-shrink-0 transition-colors ${isActive ? 'text-orange-400' : 'text-gray-500 group-hover:text-orange-400'}`} />}
    <span>{label}</span>
    
    {/* Custom underline */}
    <span
      className={`
        absolute bottom-0 left-1/2 -translate-x-1/2 h-[3px] bg-orange-500 rounded-t-sm
        transition-all duration-300 ease-in-out
        ${isActive ? 'w-1/2' : 'w-0'}
      `}
    />
  </button>
);


function TopNavbar({ currentView, setCurrentView }) {
  const mainNavItems = [
    { id: VIEWS.MATCH_HISTORY, label: 'Match History', icon: History },
    { id: VIEWS.NOTES_GOALS_COMMAND_CENTER, label: 'Goals Hub', icon: NotebookText },
    { id: VIEWS.STATS, label: 'Stats', icon: BarChart2 },
  ];

  const accountNavItem = { id: VIEWS.MANAGE_ACCOUNTS, label: 'Accounts', icon: Users };

  const handleNavClick = (viewId) => {
    setCurrentView(viewId);
  };

  return (
    <nav className="w-full bg-gray-900 shadow-md fixed top-0 left-0 right-0 z-20 border-b border-gray-700/50">
      {/* Removed max-w-7xl to allow content to span to the screen edges */}
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        {/* Set specific height to 50px */}
        <div className="flex items-center justify-between h-[50px]">
          
          {/* Left-aligned Navigation Links */}
          <div className="flex items-center space-x-1">
            {mainNavItems.map((item) => (
              <NavItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                isActive={currentView === item.id}
                onClick={() => handleNavClick(item.id)}
              />
            ))}
          </div>
          
          {/* Right-aligned Account Link */}
          <div className="flex items-center">
             <NavItem
                key={accountNavItem.id}
                icon={accountNavItem.icon}
                label={accountNavItem.label}
                isActive={currentView === accountNavItem.id}
                onClick={() => handleNavClick(accountNavItem.id)}
              />
          </div>

        </div>
      </div>
    </nav>
  );
}

export default TopNavbar;