import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { PeopleManager } from "./PeopleManager";
import { RoleManager } from "./RoleManager";
import { ShowsManager } from "./ShowsManager";
import { MonthlyAssignments } from "./MonthlyAssignments";
import { StaffOverview } from "./StaffOverview";
import { GroupManager } from "./GroupManager";
import { RoleConfigManager } from "./RoleConfigManager";
import { OrganizationSettings } from "./OrganizationSettings";
import { AdminManager } from "./AdminManager";
import { DatabaseCleanup } from "./DatabaseCleanup";

type Tab = 'people' | 'roles' | 'shows' | 'assignments' | 'staff-overview' | 'groups' | 'role-config' | 'settings' | 'admin' | 'cleanup';

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('shows');
  const loggedInUser = useQuery(api.auth.loggedInUser);

  const allTabs = [
    { id: 'shows' as Tab, name: 'Shows Beheren' },
    { id: 'assignments' as Tab, name: 'Toewijzingen' },
    { id: 'staff-overview' as Tab, name: 'Personeelsoverzicht' },
    { id: 'people' as Tab, name: 'Medewerkers' },
    { id: 'roles' as Tab, name: 'Functies' },
	  { id: 'role-config' as Tab, name: 'Functie Config' },
    { id: 'groups' as Tab, name: 'Groepen' },
    { id: 'settings' as Tab, name: 'Instellingen' },
    { id: 'admin' as Tab, name: 'Beheerders', superAdminOnly: true },
    { id: 'cleanup' as Tab, name: 'Database', superAdminOnly: true },
  ];

  // Filter tabs based on user role
  const tabs = allTabs.filter(tab => {
    if (tab.superAdminOnly) {
      return loggedInUser?.adminRole === 'superadmin';
    }
    return true;
  });

  // Redirect regular admins away from restricted tabs
  useEffect(() => {
    if (loggedInUser?.adminRole === 'admin' && (activeTab === 'admin' || activeTab === 'cleanup')) {
      setActiveTab('shows');
    }
  }, [loggedInUser?.adminRole, activeTab]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Navigation */}
      <div className="bg-white shadow-sm border-b border-gray-200 mb-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex space-x-2 overflow-x-auto py-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 whitespace-nowrap border-2 ${
                  activeTab === tab.id
                    ? 'bg-brand-primary text-brand-dark border-brand-primary shadow-md'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 border-transparent hover:border-gray-200'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 pb-12">
        {activeTab === 'people' && <PeopleManager />}
        {activeTab === 'roles' && <RoleManager />}
        {activeTab === 'shows' && <ShowsManager />}
        {activeTab === 'assignments' && <MonthlyAssignments />}
        {activeTab === 'staff-overview' && <StaffOverview />}
        {activeTab === 'groups' && <GroupManager />}
        {activeTab === 'role-config' && <RoleConfigManager />}
        {activeTab === 'settings' && <OrganizationSettings />}
        {activeTab === 'admin' && <AdminManager />}
        {activeTab === 'cleanup' && <DatabaseCleanup />}
      </div>
    </div>
  );
}
