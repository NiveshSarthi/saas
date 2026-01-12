import React from 'react';
import { Database, Users, UserCheck, Target } from 'lucide-react';

export default function MasterDataStatsCards({ stats }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 shadow-lg text-white min-h-[120px] flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <span className="text-blue-100 text-xs font-medium">Total Records</span>
          <Database className="w-5 h-5 text-blue-200 flex-shrink-0" />
        </div>
        <p className="text-3xl font-bold mb-1">{stats.total.toLocaleString()}</p>
        <p className="text-xs text-blue-100">Complete dataset</p>
      </div>

      <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl p-4 shadow-lg text-white min-h-[120px] flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <span className="text-green-100 text-xs font-medium">Assigned</span>
          <UserCheck className="w-5 h-5 text-green-200 flex-shrink-0" />
        </div>
        <p className="text-3xl font-bold mb-1">{stats.assigned.toLocaleString()}</p>
        <p className="text-xs text-green-100">To team members</p>
      </div>

      <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-4 shadow-lg text-white min-h-[120px] flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <span className="text-orange-100 text-xs font-medium">Unassigned</span>
          <Users className="w-5 h-5 text-orange-200 flex-shrink-0" />
        </div>
        <p className="text-3xl font-bold mb-1">{stats.unassigned.toLocaleString()}</p>
        <p className="text-xs text-orange-100">Available pool</p>
      </div>

      <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 shadow-lg text-white min-h-[120px] flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <span className="text-purple-100 text-xs font-medium">My Assigned</span>
          <Target className="w-5 h-5 text-purple-200 flex-shrink-0" />
        </div>
        <p className="text-3xl font-bold mb-1">{stats.myAssigned.toLocaleString()}</p>
        <p className="text-xs text-purple-100">Your active leads</p>
      </div>
    </div>
  );
}