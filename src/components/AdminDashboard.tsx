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

type TabType = 'shows' | 'people' | 'roles' | 'roleconfig' | 'groups' | 'overview' | 'assignments' | 'messages' | 'settings' | 'admins' | 'cleanup';

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('shows');
  const unreadCount = useQuery(api.messages.getUnreadCount);
  const currentUser = useQuery(api.auth.loggedInUser);

  // Define all possible tabs with their required admin levels
  const allTabs = [
    { id: 'shows' as TabType, label: 'Shows', adminLevel: 'admin' },
    { id: 'assignments' as TabType, label: 'Toewijzingen', adminLevel: 'admin' },
    { id: 'overview' as TabType, label: 'Overzicht', adminLevel: 'admin' },
    { id: 'people' as TabType, label: 'Medewerkers', adminLevel: 'admin' },
    { id: 'roles' as TabType, label: 'Functies', adminLevel: 'admin' },
    { id: 'roleconfig' as TabType, label: 'Functie Tijden', adminLevel: 'admin' },
    { id: 'groups' as TabType, label: 'Groepen', adminLevel: 'admin' },
    { id: 'messages' as TabType, label: 'Berichten', badge: unreadCount || 0, adminLevel: 'admin' },
    { id: 'settings' as TabType, label: 'Instellingen', adminLevel: 'admin' },
    { id: 'admins' as TabType, label: 'Beheerders', adminLevel: 'superadmin' },
    { id: 'cleanup' as TabType, label: 'Database', adminLevel: 'superadmin' },
  ];

  // Filter tabs based on user's admin level
  const tabs = allTabs.filter(tab => {
    if (tab.adminLevel === 'superadmin') {
      return currentUser?.adminRole === 'superadmin';
    }
    return currentUser?.adminRole === 'admin' || currentUser?.adminRole === 'superadmin';
  });

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
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Horizontal Tab Navigation */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 overflow-x-auto py-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-200'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border border-transparent'
                }`}
              >
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[20px] text-center">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderContent()}
      </div>
    </div>
  );
}
