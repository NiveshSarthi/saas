import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import {
  Settings,
  Mail,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FolderKanban,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export default function Profile() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (e) {}
    };
    fetchUser();
  }, []);

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['profile-tasks'],
    queryFn: () => base44.entities.Task.list('-updated_date', 500),
    enabled: !!user,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['profile-projects'],
    queryFn: () => base44.entities.Project.list(),
    enabled: !!user,
  });

  const myTasks = tasks.filter(t => t.assignee_email === user?.email);
  const completedTasks = myTasks.filter(t => t.status === 'done');
  const inProgressTasks = myTasks.filter(t => t.status === 'in_progress');
  const overdueTasks = myTasks.filter(t => 
    t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done'
  );

  const myProjects = projects.filter(p => 
    p.owner_email === user?.email || (p.members || []).includes(user?.email)
  );

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const completionRate = myTasks.length > 0 
    ? Math.round((completedTasks.length / myTasks.length) * 100) 
    : 0;

  if (!user || tasksLoading) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-48 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      {/* Profile Header */}
      <Card>
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <Avatar className="w-24 h-24">
              <AvatarFallback className="text-3xl bg-indigo-100 text-indigo-600 font-bold">
                {getInitials(user.full_name)}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-slate-900">{user.full_name || 'User'}</h1>
              <div className="flex items-center gap-2 mt-2 text-slate-500">
                <Mail className="w-4 h-4" />
                <span>{user.email}</span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-slate-500">
                <Calendar className="w-4 h-4" />
                <span>Joined {user.created_date ? format(new Date(user.created_date), 'MMMM yyyy') : 'Recently'}</span>
              </div>
              <Badge className="mt-3 capitalize bg-indigo-100 text-indigo-700">
                {user.role || 'user'}
              </Badge>
            </div>

            <Link to={createPageUrl('Settings')}>
              <Button variant="outline">
                <Settings className="w-4 h-4 mr-2" />
                Edit Profile
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6 text-indigo-600" />
            </div>
            <p className="text-3xl font-bold text-slate-900">{myTasks.length}</p>
            <p className="text-sm text-slate-500">Total Tasks</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <p className="text-3xl font-bold text-slate-900">{completedTasks.length}</p>
            <p className="text-sm text-slate-500">Completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center mx-auto mb-3">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
            <p className="text-3xl font-bold text-slate-900">{inProgressTasks.length}</p>
            <p className="text-sm text-slate-500">In Progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <p className="text-3xl font-bold text-red-600">{overdueTasks.length}</p>
            <p className="text-sm text-slate-500">Overdue</p>
          </CardContent>
        </Card>
      </div>

      {/* Completion Rate */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Task Completion Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Progress value={completionRate} className="flex-1 h-3" />
            <span className="text-2xl font-bold text-indigo-600">{completionRate}%</span>
          </div>
          <p className="text-sm text-slate-500 mt-2">
            {completedTasks.length} of {myTasks.length} tasks completed
          </p>
        </CardContent>
      </Card>

      {/* My Projects */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">My Projects</CardTitle>
          <Link to={createPageUrl('Projects')}>
            <Button variant="ghost" size="sm">
              View All
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {myProjects.length > 0 ? (
            <div className="space-y-3">
              {myProjects.slice(0, 5).map((project) => {
                const projectTasks = tasks.filter(t => t.project_id === project.id);
                const completed = projectTasks.filter(t => t.status === 'done').length;
                const progress = projectTasks.length > 0 
                  ? Math.round((completed / projectTasks.length) * 100) 
                  : 0;

                return (
                  <Link 
                    key={project.id}
                    to={createPageUrl(`ProjectBoard?id=${project.id}`)}
                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 border border-slate-100"
                  >
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${project.color || '#6366F1'}20` }}
                    >
                      <FolderKanban className="w-5 h-5" style={{ color: project.color || '#6366F1' }} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-slate-900">{project.name}</h4>
                      <p className="text-xs text-slate-500">{projectTasks.length} tasks</p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium text-slate-900">{progress}%</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <FolderKanban className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>No projects yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}