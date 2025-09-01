import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableRoleItemProps {
  role: {
    _id: Id<"roles">;
    name: string;
    displayName?: string;
    isActive: boolean;
    order?: number;
  };
  onEdit: (role: any) => void;
  onDelete: (id: Id<"roles">) => void;
}

function SortableRoleItem({ role, onEdit, onDelete }: SortableRoleItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: role._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 ${
        isDragging ? 'shadow-lg ring-2 ring-blue-200' : ''
      }`}
    >
      <div className="flex items-center space-x-4">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-2 text-gray-400 hover:text-gray-600 transition-colors"
          title="Drag to reorder"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </div>
        
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{role.displayName || role.name}</h3>
          <div className="flex items-center space-x-2 mt-1">
            {role.displayName && (
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {role.name}
              </span>
            )}
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              role.isActive 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {role.isActive ? 'Actief' : 'Inactief'}
            </span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        <button
          onClick={() => onEdit(role)}
          className="px-4 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all duration-200"
        >
          Bewerken
        </button>
        <button
          onClick={() => onDelete(role._id)}
          className="px-4 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-all duration-200"
        >
          Verwijderen
        </button>
      </div>
    </div>
  );
}

export function RoleManager() {
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDisplayName, setNewRoleDisplayName] = useState("");
  const [editingRole, setEditingRole] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [roleOrder, setRoleOrder] = useState<string[]>([]);

  const rolesData = useQuery(api.roles.list);
  const createRole = useMutation(api.roles.create);
  const updateRole = useMutation(api.roles.update);
  const updateOrder = useMutation(api.roles.updateOrder);
  const removeRole = useMutation(api.roles.remove);

  // Initialize role order when data loads
  const roles = rolesData || [];
  if (roles.length > 0 && roleOrder.length === 0) {
    // Sort by order if available, otherwise by name
    const sortedRoles = [...roles].sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) {
        return a.order - b.order;
      }
      return a.name.localeCompare(b.name);
    });
    setRoleOrder(sortedRoles.map(r => r._id));
  }

  // Sort roles according to current order
  const sortedRoles = roleOrder.length > 0 
    ? roleOrder.map(id => roles.find(r => r._id === id)).filter(Boolean) as typeof roles
    : roles;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = roleOrder.findIndex((id) => id === active.id);
      const newIndex = roleOrder.findIndex((id) => id === over?.id);

      const newOrder = arrayMove(roleOrder, oldIndex, newIndex);
      setRoleOrder(newOrder);
      
      // Update the order in the database
      try {
        const roleOrders = newOrder.map((id, index) => ({
          id: id as Id<"roles">,
          order: index + 1,
        }));
        
        await updateOrder({ roleOrders });
        toast.success("Volgorde bijgewerkt - deze wordt gebruikt in Excel exports");
      } catch (error) {
        toast.error("Fout bij bijwerken volgorde");
        // Revert the order on error
        setRoleOrder(arrayMove(newOrder, newIndex, oldIndex));
      }
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;

    try {
      const newRoleId = await createRole({ 
        name: newRoleName.trim(),
        displayName: newRoleDisplayName.trim() || undefined
      });
      setNewRoleName("");
      setNewRoleDisplayName("");
      // Add new role to the end of the order
      setRoleOrder(prev => [...prev, newRoleId]);
      toast.success("Functie aangemaakt");
    } catch (error) {
      toast.error("Fout bij aanmaken functie");
    }
  };

  const handleEdit = (role: any) => {
    setEditingRole(role);
    setEditName(role.name);
    setEditDisplayName(role.displayName || role.name);
    setEditActive(role.isActive);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRole || !editName.trim()) return;

    try {
      await updateRole({
        id: editingRole._id,
        name: editName.trim(),
        displayName: editDisplayName.trim() || undefined,
        isActive: editActive,
      });
      setEditingRole(null);
      toast.success("Functie bijgewerkt");
    } catch (error) {
      toast.error("Fout bij bijwerken functie");
    }
  };

  const handleDelete = async (id: Id<"roles">) => {
    if (!confirm("Weet je zeker dat je deze functie wilt verwijderen?")) return;

    try {
      await removeRole({ id });
      // Remove from order
      setRoleOrder(prev => prev.filter(roleId => roleId !== id));
      toast.success("Functie verwijderd");
    } catch (error: any) {
      toast.error(error.message || "Fout bij verwijderen functie");
    }
  };

  // Store the current role order in localStorage for the Excel export
  if (roleOrder.length > 0) {
    localStorage.setItem('roleOrder', JSON.stringify(roleOrder));
  }

  if (!rolesData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="modern-card p-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Functies Beheren</h2>
        <p className="text-gray-600">Beheer de functies die medewerkers kunnen hebben. Sleep om de volgorde te wijzigen.</p>
      </div>

      {/* Create New Role */}
      <div className="modern-card p-8">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">Nieuwe Functie Toevoegen</h3>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Korte Naam (ID)
              </label>
              <input
                type="text"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="bijv. FA, BA, FOH ..."
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Gebruikt voor interne identificatie</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Weergavenaam
              </label>
              <input
                type="text"
                value={newRoleDisplayName}
                onChange={(e) => setNewRoleDisplayName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
              <p className="text-xs text-gray-500 mt-1">Wordt getoond aan gebruikers</p>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="btn-primary px-8 py-3"
            >
              Toevoegen
            </button>
          </div>
        </form>
      </div>

      {/* Roles List with Drag and Drop */}
      <div className="modern-card p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900">Functies ({roles.length})</h3>
          <div className="text-sm text-gray-500">
            💡 Sleep functies om de volgorde te wijzigen. Deze volgorde wordt gebruikt in Excel exports.
          </div>
        </div>
        
        {roles.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m-8 0V6a2 2 0 00-2 2v6" />
              </svg>
            </div>
            <h4 className="text-lg font-semibold text-gray-900 mb-2">Geen functies</h4>
            <p className="text-gray-600">Voeg je eerste functie toe om te beginnen.</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={roleOrder} strategy={verticalListSortingStrategy}>
              <div className="space-y-4">
                {sortedRoles.map((role) => (
                  <SortableRoleItem
                    key={role._id}
                    role={role}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Edit Role Modal */}
      {editingRole && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">Functie Bewerken</h3>
            <form onSubmit={handleUpdate} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Korte Naam (ID)
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Gebruikt voor interne identificatie</p>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Weergavenaam
                </label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
                <p className="text-xs text-gray-500 mt-1">Wordt getoond aan gebruikers</p>
              </div>
              
              <div>
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={editActive}
                    onChange={(e) => setEditActive(e.target.checked)}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Actief</span>
                </label>
              </div>
              
              <div className="flex gap-4">
                <button
                  type="submit"
                  className="flex-1 btn-primary py-3"
                >
                  Opslaan
                </button>
                <button
                  type="button"
                  onClick={() => setEditingRole(null)}
                  className="flex-1 btn-secondary py-3"
                >
                  Annuleren
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
