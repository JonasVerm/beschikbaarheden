import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ShowsManager } from "./ShowsManager";
import { PeopleManager } from "./PeopleManager";
import { RoleManager } from "./RoleManager";
import { GroupManager } from "./GroupManager";
import { MonthlyAssignments } from "./MonthlyAssignments";
import { StaffOverview } from "./StaffOverview";
import { AdminAvailabilityEditor } from "./AdminAvailabilityEditor";
import { MessagesManager } from "./MessagesManager";
import { OrganizationSettings } from "./OrganizationSettings";
import { AdminManager } from "./AdminManager";
import { DatabaseCleanup } from "./DatabaseCleanup";
import { RoleConfigManager } from "./RoleConfigManager";

type TabType = 
  | 'shows' 
  | 'people' 
  | 'roles' 
  | 'groups' 
  | 'assignments' 
  | 'overview' 
  | 'availability' 
  | 'messages' 
  | 'settings' 
  | 'admins' 
  | 'cleanup'
  | 'roleconfig';

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('shows');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  const currentUser = useQuery(api.auth.loggedInUser);
  const isSuperAdmin = currentUser?.adminRole === 'superadmin';

  // Section 1: Operations & Shows
  const operationsMenuItems = [
    {
      id: 'shows' as TabType,
      label: 'Voorstellingen',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      available: true
    },
    {
      id: 'assignments' as TabType,
      label: 'Toewijzingen',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
      available: true
    },
    {
      id: 'overview' as TabType,
      label: 'Overzicht',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      available: true
    },
    {
      id: 'availability' as TabType,
      label: 'Beschikbaarheid',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a1 1 0 01-1-1V9a1 1 0 011-1h1a2 2 0 100-4H4a1 1 0 01-1-1V4a1 1 0 011-1h3a1 1 0 011 1v1z" />
        </svg>
      ),
      available: true
    },
    {
      id: 'messages' as TabType,
      label: 'Berichten',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      available: true
    }
  ];

  // Section 2: Management
  const managementMenuItems = [
    {
      id: 'people' as TabType,
      label: 'Medewerkers',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      available: true
    },
    {
      id: 'roles' as TabType,
      label: 'Functies',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 00-2 2H8a2 2 0 00-2-2V6m8 0H8m0 0v-.5A2.5 2.5 0 0110.5 3h3A2.5 2.5 0 0116 5.5V6m-8 0h8" />
        </svg>
      ),
      available: true
    },
    {
      id: 'roleconfig' as TabType,
      label: 'Functie Config',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
        </svg>
      ),
      available: isSuperAdmin
    },
    {
      id: 'groups' as TabType,
      label: 'Groepen',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      available: true
    },
    {
      id: 'settings' as TabType,
      label: 'Instellingen',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      available: true
    }
  ];

  // Section 3: System (Super Admin only)
  const systemMenuItems = [
    {
      id: 'admins' as TabType,
      label: 'Beheerders',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      available: isSuperAdmin
    },
    {
      id: 'cleanup' as TabType,
      label: 'Database Cleanup',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      ),
      available: isSuperAdmin
    }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'shows':
        return <ShowsManager />;
      case 'people':
        return <PeopleManager />;
      case 'roles':
        return <RoleManager />;
      case 'groups':
        return <GroupManager />;
      case 'assignments':
        return <MonthlyAssignments />;
      case 'overview':
        return <StaffOverview />;
      case 'availability':
        return <AdminAvailabilityEditor />;
      case 'messages':
        return <MessagesManager />;
      case 'settings':
        return <OrganizationSettings />;
      case 'admins':
        return <AdminManager />;
      case 'roleconfig':
        return <RoleConfigManager />;
      case 'cleanup':
        return <DatabaseCleanup />;
      default:
        return <ShowsManager />;
    }
  };

  const renderMenuSection = (items: typeof operationsMenuItems, sectionTitle?: string) => (
    <div className="mb-6">
      {!sidebarCollapsed && sectionTitle && (
        <div className="px-4 mb-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{sectionTitle}</h3>
        </div>
      )}
      <div className="space-y-1">
        {items.filter(item => item.available).map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2' : 'px-4'} py-3 rounded-xl text-left transition-all duration-200 group ${
              activeTab === item.id
                ? 'text-white shadow-lg bg-brand-primary'
                : 'text-gray-700 hover:bg-white/20 hover:shadow-md'
            }`}
            title={sidebarCollapsed ? item.label : undefined}
          >
            <span className={`flex-shrink-0 ${activeTab === item.id ? 'text-white' : 'text-gray-600 group-hover:text-gray-800'}`}>
              {item.icon}
            </span>
            {!sidebarCollapsed && (
              <span className="ml-3 font-medium">{item.label}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex h-full w-full">
      {/* Sidebar */}
      <div className={`${sidebarCollapsed ? 'w-16' : 'w-64'} transition-all duration-300 ease-in-out flex-shrink-0`}>
        <div className="h-full glass-effect border-r border-white/20 shadow-lg">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-white/20">
            <div className="flex items-center justify-between">
              {!sidebarCollapsed && (
                <h2 className="text-lg font-bold text-gray-900">Admin Menu</h2>
              )}
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-2 rounded-lg hover:bg-white/20 transition-all duration-200"
                title={sidebarCollapsed ? "Uitklappen" : "Inklappen"}
              >
                <svg 
                  className={`w-5 h-5 text-gray-700 transition-transform duration-300 ${sidebarCollapsed ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Menu Items */}
          <nav className="p-2 overflow-y-auto h-full">
            {/* Operations & Shows Section */}
            {renderMenuSection(operationsMenuItems, sidebarCollapsed ? undefined : "Operaties")}
            
            {/* Separator */}
            {!sidebarCollapsed && <div className="border-t border-white/20 mx-4 mb-6"></div>}
            
            {/* Management Section */}
            {renderMenuSection(managementMenuItems, sidebarCollapsed ? undefined : "Beheer")}
            
            {/* System Section (Super Admin only) */}
            {isSuperAdmin && (
              <>
                {!sidebarCollapsed && <div className="border-t border-white/20 mx-4 mb-6"></div>}
                {renderMenuSection(systemMenuItems, sidebarCollapsed ? undefined : "Systeem")}
              </>
            )}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto">
          <div className="min-h-full p-6">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
