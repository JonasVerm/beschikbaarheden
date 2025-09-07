import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ShowsManager } from "./ShowsManager";
import { PeopleManager } from "./PeopleManager";
import { RoleManager } from "./RoleManager";
import { RoleConfigManager } from "./RoleConfigManager";
import { GroupManager } from "./GroupManager";
import { StaffOverview } from "./StaffOverview";
import { OrganizationSettings } from "./OrganizationSettings";
import { AdminManager } from "./AdminManager";
import { DatabaseCleanup } from "./DatabaseCleanup";
import { MessagesManager } from "./MessagesManager";
import { MonthlyAssignments } from "./MonthlyAssignments";
import { AdminAvailabilityEditor } from "./AdminAvailabilityEditor";

type TabType = 'shows' | 'people' | 'roles' | 'roleconfig' | 'groups' | 'overview' | 'assignments' | 'availability' | 'messages' | 'settings' | 'admins' | 'cleanup';

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('shows');
  const [isManagementExpanded, setIsManagementExpanded] = useState(false);
  const unreadCount = useQuery(api.messages.getUnreadCount);
  const currentUser = useQuery(api.auth.loggedInUser);

  // Define primary tabs (always visible)
  const primaryTabs = [
    { id: 'shows' as TabType, label: 'Shows', adminLevel: 'admin' },
    { id: 'assignments' as TabType, label: 'Toewijzingen', adminLevel: 'admin' },
    { id: 'availability' as TabType, label: 'Beschikbaarheid', adminLevel: 'admin' },
    { id: 'overview' as TabType, label: 'Overzicht', adminLevel: 'admin' },
    { id: 'messages' as TabType, label: 'Berichten', badge: unreadCount || 0, adminLevel: 'admin' },
  ];

  // Define management tabs (collapsible)
  const managementTabs = [
    { id: 'people' as TabType, label: 'Medewerkers', adminLevel: 'admin' },
    { id: 'roles' as TabType, label: 'Functies', adminLevel: 'admin' },
    { id: 'roleconfig' as TabType, label: 'Functie Tijden', adminLevel: 'admin' },
    { id: 'groups' as TabType, label: 'Groepen', adminLevel: 'admin' },
    { id: 'settings' as TabType, label: 'Instellingen', adminLevel: 'admin' },
    { id: 'admins' as TabType, label: 'Beheerders', adminLevel: 'superadmin' },
    { id: 'cleanup' as TabType, label: 'Database', adminLevel: 'superadmin' },
  ];

  // Filter tabs based on user's admin level
  const filteredPrimaryTabs = primaryTabs.filter(tab => {
    if (tab.adminLevel === 'superadmin') {
      return currentUser?.adminRole === 'superadmin';
    }
    return currentUser?.adminRole === 'admin' || currentUser?.adminRole === 'superadmin';
  });

  const filteredManagementTabs = managementTabs.filter(tab => {
    if (tab.adminLevel === 'superadmin') {
      return currentUser?.adminRole === 'superadmin';
    }
    return currentUser?.adminRole === 'admin' || currentUser?.adminRole === 'superadmin';
  });

  // Check if active tab is in management section
  const isManagementTabActive = filteredManagementTabs.some(tab => tab.id === activeTab);

  // Auto-expand management section if a management tab is active
  const shouldExpandManagement = isManagementExpanded || isManagementTabActive;

  const renderContent = () => {
    switch (activeTab) {
      case 'shows':
        return <ShowsManager />;
      case 'people':
        return <PeopleManager />;
      case 'roles':
        return <RoleManager />;
      case 'roleconfig':
        return <RoleConfigManager />;
      case 'groups':
        return <GroupManager />;
      case 'overview':
        return <StaffOverview />;
      case 'assignments':
        return <MonthlyAssignments />;
      case 'availability':
        return <AdminAvailabilityEditor />;
      case 'messages':
        return <MessagesManager />;
      case 'settings':
        return <OrganizationSettings />;
      case 'admins':
        return <AdminManager />;
      case 'cleanup':
        return <DatabaseCleanup />;
      default:
        return <ShowsManager />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="py-6">
            
            {/* Primary Navigation */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                  Planning & Overzicht
                </h2>
                <div className="h-px bg-gray-200 flex-1 ml-4"></div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {filteredPrimaryTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative group px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 text-center ${
                      activeTab === tab.id
                        ? 'text-white shadow-lg'
                        : 'text-gray-700 bg-white border border-gray-200 hover:border-gray-300 hover:shadow-md'
                    }`}
                    style={activeTab === tab.id ? { backgroundColor: '#161616' } : {}}
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <span>{tab.label}</span>
                      {tab.badge !== undefined && tab.badge > 0 && (
                        <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[20px] animate-pulse">
                          {tab.badge > 99 ? '99+' : tab.badge}
                        </span>
                      )}
                    </div>
                    {activeTab === tab.id && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 rounded-b-lg" style={{ backgroundColor: '#FAE682' }}></div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Management Navigation */}
            <div>
              <button
                onClick={() => setIsManagementExpanded(!isManagementExpanded)}
                className="w-full flex items-center justify-between mb-4 p-3 rounded-lg hover:bg-gray-50 transition-colors duration-200"
              >
                <div className="flex items-center space-x-3">
                  <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                    Beheer & Instellingen
                  </h2>
                  {isManagementTabActive && (
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#FAE682' }}></div>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <div className="h-px bg-gray-200 w-16"></div>
                  <svg 
                    className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${shouldExpandManagement ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>
              
              {/* Collapsible Management Tabs */}
              <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
                shouldExpandManagement ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
              }`}>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pl-6">
                  {filteredManagementTabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        if (!isManagementExpanded) {
                          setIsManagementExpanded(true);
                        }
                      }}
                      className={`relative group px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 text-center ${
                        activeTab === tab.id
                          ? 'text-black shadow-lg'
                          : 'text-gray-700 bg-white border border-gray-200 hover:border-gray-300 hover:shadow-md'
                      }`}
                      style={activeTab === tab.id ? { backgroundColor: '#FAE682' } : {}}
                    >
                      <div className="flex items-center justify-center space-x-2">
                        <span>{tab.label}</span>
                        {tab.adminLevel === 'superadmin' && (
                          <span className="px-1.5 py-0.5 bg-gray-800 text-white text-xs rounded font-bold">SA</span>
                        )}
                      </div>
                      {activeTab === tab.id && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 rounded-b-lg" style={{ backgroundColor: '#161616' }}></div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {renderContent()}
      </main>
    </div>
  );
}
