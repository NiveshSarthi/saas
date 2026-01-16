import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Shield, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import AttendanceRulesManager from '@/components/attendance/AttendanceRulesManager';

export default function AttendanceRulesPage() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (e) {
        console.error('Failed to fetch user', e);
      }
    };
    fetchUser();
  }, []);

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list(),
    enabled: !!user,
  });

  useEffect(() => {
    if (user && departments.length > 0) {
      const hrDept = departments.find(d => d.name?.toLowerCase().includes('hr'));
      const isHR = user.department_id && hrDept && user.department_id === hrDept.id;
      setIsAdmin(user.role === 'admin' || isHR);
    }
  }, [user, departments]);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] text-center p-8">
        <Shield className="w-12 h-12 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
        <p className="text-slate-500 mb-4">Only admins and HR can manage attendance rules.</p>
        <Link to={createPageUrl('Attendance')}>
          <Button>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Attendance
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FC]">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-700 pb-32">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 mix-blend-soft-light"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent to-black/10"></div>

        <div className="relative max-w-6xl mx-auto px-6 lg:px-8 pt-8">
          <div className="flex items-center gap-4 mb-8">
            <Link to={createPageUrl('Attendance')}>
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full h-10 w-10 backdrop-blur-md">
                <ArrowLeft className="w-6 h-6" />
              </Button>
            </Link>

            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-black text-white tracking-tight">Attendance Rules</h1>
                <p className="text-indigo-100 font-medium">Configure policies & automation</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 lg:px-8 -mt-20 relative z-10 pb-12">
        <div className="bg-white/80 backdrop-blur-md rounded-3xl shadow-xl border border-white/20 p-1">
          <AttendanceRulesManager />
        </div>
      </div>
    </div>
  );
}