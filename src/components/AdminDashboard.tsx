import { useState } from "react";
import { ShowsManager } from "./ShowsManager";
import { PeopleManager } from "./PeopleManager";
import { MonthlyAssignments } from "./MonthlyAssignments";
import { AdminManager } from "./AdminManager";
import { RoleConfigManager } from "./RoleConfigManager";
import { RoleManager } from "./RoleManager";
import { GroupManager } from "./GroupManager";
import { OrganizationSettings } from "./OrganizationSettings";
import { DatabaseCleanup } from "./DatabaseCleanup";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

type TabType = 'shows' | 'people' | 'assignments' | 'admins' | 'roles' | 'groups' | 'roleConfig' | 'settings' | 'cleanup';

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('shows');
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const isSuperAdmin = loggedInUser?.adminRole === "superadmin";

  const tabs = [
    { id: 'shows' as TabType, name: 'Shows', description: 'Beheer voorstellingen' },
    { id: 'people' as TabType, name: 'Personeel', description: 'Beheer medewerkers' },
    { id: 'assignments' as TabType, name: 'Planning', description: 'Maandelijkse planning' },
    { id: 'roles' as TabType, name: 'Functies', description: 'Beheer functies' },
    { id: 'groups' as TabType, name: 'Groepen', description: 'Beheer groepen' },
    { id: 'roleConfig' as TabType, name: 'Start Tijden', description: 'Functie start tijden' },
    { id: 'settings' as TabType, name: 'Instellingen', description: 'Organisatie instellingen' },
    ...(isSuperAdmin ? [
      { id: 'admins' as TabType, name: 'Admins', description: 'Beheer administrators' },
      { id: 'cleanup' as TabType, name: 'Database', description: 'Database beheer' }
    ] : [])
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'shows':
        return <ShowsManager />;
      case 'people':
        return <PeopleManager />;
      case 'assignments':
        return <MonthlyAssignments />;
      case 'roles':
        return <RoleManager />;
      case 'groups':
        return <GroupManager />;
      case 'roleConfig':
        return <RoleConfigManager />;
      case 'settings':
        return <OrganizationSettings />;
      case 'admins':
        return isSuperAdmin ? <AdminManager /> : null;
      case 'cleanup':
        return isSuperAdmin ? <DatabaseCleanup /> : null;
      default:
        return <ShowsManager />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up">
      {/* Welcome Section */}
      <div className="modern-card p-8 gradient-brand text-brand-dark">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              Welkom, {loggedInUser?.name || 'Admin'}!
            </h1>
            <p className="text-brand-dark/80 text-lg">
              Beheer het beschikbaarheidssysteem van Capitole Gent
            </p>
          </div>
          <div className="hidden md:block">
            <div className="w-24 h-24 bg-brand-dark/10 rounded-full flex items-center justify-center">
              <div className="w-12 h-12 bg-brand-dark rounded-lg"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="modern-card p-2">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-3 px-6 py-4 rounded-xl transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-brand-primary text-brand-dark shadow-lg transform scale-105'
                  : 'text-gray-600 hover:bg-brand-light hover:text-brand-dark'
              }`}
            >
              <div className="text-left">
                <div className="font-semibold">{tab.name}</div>
                <div className={`text-xs ${
                  activeTab === tab.id ? 'text-brand-dark/70' : 'text-gray-500'
                }`}>
                  {tab.description}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="animate-fade-in-up">
        {renderContent()}
      </div>
    </div>
  );
}
