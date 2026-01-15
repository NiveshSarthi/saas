import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePermissions } from '@/components/rbac/PermissionsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import {
    Plus,
    Calendar as CalendarIcon,
    List,
    ChevronLeft,
    ChevronRight,
    Check,
    Clock,
    Target,
    AlertTriangle,
    Filter
} from 'lucide-react';
import { toast } from 'sonner';
import {
    format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths,
    addWeeks, subWeeks, isSameDay, isSameMonth, isToday, parseISO, startOfYear, endOfYear,
    addYears, subYears, getWeek, startOfDay
} from 'date-fns';

// Color palette
const COLOR_PALETTE = [
    '#EF4444', '#F97316', '#F59E0B', '#22C55E', '#10B981',
    '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899'
];

// Days of week for recurrence
const DAYS_OF_WEEK = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' }
];

export default function MarketingCalendarPage() {
    const { isAdmin } = usePermissions();
    const queryClient = useQueryClient();
    const [user, setUser] = useState(null);
    const [viewMode, setViewMode] = useState('calendar'); // calendar | list
    const [calendarView, setCalendarView] = useState('month'); // day | week | month | year
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedGoal, setSelectedGoal] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);
    const [statusFilter, setStatusFilter] = useState('all');

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        goal_type: 'custom',
        target_date: '',
        start_date: '',
        end_date: '',
        recurrence_days: [],
        color: '#6366F1'
    });

    // Load user
    useEffect(() => {
        const loadUser = async () => {
            try {
                const userData = await base44.auth.me();
                setUser(userData);
            } catch (e) {
                console.error('Failed to load user');
            }
        };
        loadUser();
    }, []);

    // Fetch goals
    const { data: goals = [], isLoading } = useQuery({
        queryKey: ['marketing-goals'],
        queryFn: () => base44.entities.MarketingGoal.list('-created_at', 500),
    });

    // Save mutation
    const saveMutation = useMutation({
        mutationFn: async (data) => {
            if (selectedGoal) {
                return base44.entities.MarketingGoal.update(selectedGoal.id || selectedGoal._id, data);
            } else {
                return base44.entities.MarketingGoal.create({ ...data, created_by: user?.email });
            }
        },
        onSuccess: () => {
            toast.success(selectedGoal ? 'Goal updated successfully' : 'Goal created successfully');
            queryClient.invalidateQueries(['marketing-goals']);
            handleCloseModal();
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to save goal');
        }
    });

    // Toggle done mutation
    const toggleDoneMutation = useMutation({
        mutationFn: async ({ goalId, isDone }) => {
            return base44.entities.MarketingGoal.update(goalId, {
                status: isDone ? 'done' : 'pending',
                completed_at: isDone ? new Date() : null,
                completed_by: isDone ? user?.email : null
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['marketing-goals']);
            toast.success('Goal status updated');
        }
    });

    // Navigation handlers
    const navigatePrev = () => {
        switch (calendarView) {
            case 'day':
                setCurrentDate(addDays(currentDate, -1));
                break;
            case 'week':
                setCurrentDate(subWeeks(currentDate, 1));
                break;
            case 'month':
                setCurrentDate(subMonths(currentDate, 1));
                break;
            case 'year':
                setCurrentDate(subYears(currentDate, 1));
                break;
        }
    };

    const navigateNext = () => {
        switch (calendarView) {
            case 'day':
                setCurrentDate(addDays(currentDate, 1));
                break;
            case 'week':
                setCurrentDate(addWeeks(currentDate, 1));
                break;
            case 'month':
                setCurrentDate(addMonths(currentDate, 1));
                break;
            case 'year':
                setCurrentDate(addYears(currentDate, 1));
                break;
        }
    };

    const goToToday = () => setCurrentDate(new Date());

    // Get calendar title
    const getCalendarTitle = () => {
        switch (calendarView) {
            case 'day':
                return format(currentDate, 'EEEE, MMMM d, yyyy');
            case 'week':
                const weekStart = startOfWeek(currentDate);
                const weekEnd = endOfWeek(currentDate);
                return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
            case 'month':
                return format(currentDate, 'MMMM yyyy');
            case 'year':
                return format(currentDate, 'yyyy');
        }
    };

    // Generate calendar days for month view
    const calendarDays = useMemo(() => {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);

        const days = [];
        let day = startDate;

        while (day <= endDate) {
            days.push(day);
            day = addDays(day, 1);
        }

        return days;
    }, [currentDate]);

    // Get goals for a specific date
    const getGoalsForDate = (date) => {
        return goals.filter(goal => {
            const goalDate = goal.target_date ? parseISO(goal.target_date) : null;
            if (!goalDate) return false;
            return isSameDay(goalDate, date);
        });
    };

    // Filter goals for list view
    const filteredGoals = useMemo(() => {
        let filtered = [...goals];

        if (statusFilter !== 'all') {
            filtered = filtered.filter(g => g.status === statusFilter);
        }

        // Sort by date
        filtered.sort((a, b) => {
            const dateA = a.target_date ? new Date(a.target_date) : new Date();
            const dateB = b.target_date ? new Date(b.target_date) : new Date();
            return dateA - dateB;
        });

        return filtered;
    }, [goals, statusFilter]);

    // Group goals by period for list view
    const groupedGoals = useMemo(() => {
        const groups = {};

        filteredGoals.forEach(goal => {
            const date = goal.target_date ? parseISO(goal.target_date) : new Date();
            const key = format(date, 'yyyy-MM-dd');
            if (!groups[key]) {
                groups[key] = { date, goals: [] };
            }
            groups[key].goals.push(goal);
        });

        return Object.values(groups).sort((a, b) => a.date - b.date);
    }, [filteredGoals]);

    // Modal handlers
    const handleOpenModal = (goal = null, date = null) => {
        if (goal) {
            setSelectedGoal(goal);
            setFormData({
                title: goal.title || '',
                description: goal.description || '',
                goal_type: goal.goal_type || 'custom',
                target_date: goal.target_date ? format(parseISO(goal.target_date), 'yyyy-MM-dd') : '',
                start_date: goal.start_date ? format(parseISO(goal.start_date), 'yyyy-MM-dd') : '',
                end_date: goal.end_date ? format(parseISO(goal.end_date), 'yyyy-MM-dd') : '',
                recurrence_days: goal.recurrence_days || [],
                color: goal.color || '#6366F1'
            });
        } else {
            setSelectedGoal(null);
            setFormData({
                title: '',
                description: '',
                goal_type: 'custom',
                target_date: date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
                start_date: '',
                end_date: '',
                recurrence_days: [],
                color: '#6366F1'
            });
        }
        setSelectedDate(date);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedGoal(null);
        setSelectedDate(null);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.title.trim()) {
            toast.error('Goal title is required');
            return;
        }
        if (!formData.target_date && formData.goal_type === 'custom') {
            toast.error('Target date is required');
            return;
        }
        saveMutation.mutate(formData);
    };

    const handleToggleDone = (goal) => {
        const isDone = goal.status !== 'done';
        toggleDoneMutation.mutate({ goalId: goal.id || goal._id, isDone });
    };

    const handleDayRecurrenceToggle = (dayValue) => {
        const current = formData.recurrence_days || [];
        if (current.includes(dayValue)) {
            setFormData({ ...formData, recurrence_days: current.filter(d => d !== dayValue) });
        } else {
            setFormData({ ...formData, recurrence_days: [...current, dayValue].sort() });
        }
    };

    // Render goal pill
    const GoalPill = ({ goal, compact = false }) => {
        const isDone = goal.status === 'done';
        return (
            <div
                onClick={(e) => { e.stopPropagation(); handleOpenModal(goal); }}
                className={`group flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium cursor-pointer transition-all ${isDone
                        ? 'bg-green-100 text-green-700 line-through opacity-70'
                        : 'hover:opacity-80'
                    }`}
                style={{
                    backgroundColor: isDone ? undefined : `${goal.color}20`,
                    color: isDone ? undefined : goal.color,
                    borderLeft: `3px solid ${isDone ? '#22C55E' : goal.color}`
                }}
            >
                <button
                    onClick={(e) => { e.stopPropagation(); handleToggleDone(goal); }}
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isDone
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'border-current hover:bg-current/10'
                        }`}
                >
                    {isDone && <Check className="w-3 h-3" />}
                </button>
                <span className="truncate">{goal.title}</span>
            </div>
        );
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 w-full max-w-[1800px] mx-auto min-h-[calc(100vh-64px)] flex flex-col">
            {/* Header */}
            <div className="relative mb-6">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 rounded-3xl blur-3xl -z-10" />
                <div className="bg-white/80 backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-lg border border-white/20 p-4 sm:p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                                <Target className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                                    Marketing Calendar
                                </h1>
                                <p className="text-sm text-slate-600 mt-0.5">
                                    Plan and track your marketing goals
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            {/* View Mode Toggle */}
                            <div className="flex items-center bg-white/90 rounded-xl border border-slate-200 p-1">
                                <Button
                                    variant={viewMode === 'calendar' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setViewMode('calendar')}
                                    className={viewMode === 'calendar' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white' : ''}
                                >
                                    <CalendarIcon className="w-4 h-4 mr-1" />
                                    Calendar
                                </Button>
                                <Button
                                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setViewMode('list')}
                                    className={viewMode === 'list' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white' : ''}
                                >
                                    <List className="w-4 h-4 mr-1" />
                                    List
                                </Button>
                            </div>

                            {/* Add Goal Button */}
                            <Button
                                onClick={() => handleOpenModal()}
                                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/30"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Add Goal
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Calendar View */}
            {viewMode === 'calendar' && (
                <div className="flex-1 bg-white rounded-xl shadow-lg border overflow-hidden">
                    {/* Calendar Header */}
                    <div className="flex items-center justify-between p-4 border-b bg-slate-50">
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={navigatePrev}>
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={goToToday}>
                                Today
                            </Button>
                            <Button variant="outline" size="sm" onClick={navigateNext}>
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                            <h2 className="text-lg font-semibold text-slate-800 ml-2">
                                {getCalendarTitle()}
                            </h2>
                        </div>

                        <div className="flex items-center bg-white rounded-lg border p-1">
                            {['day', 'week', 'month', 'year'].map((view) => (
                                <Button
                                    key={view}
                                    variant={calendarView === view ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setCalendarView(view)}
                                    className={calendarView === view ? 'bg-indigo-600 text-white' : ''}
                                >
                                    {view.charAt(0).toUpperCase() + view.slice(1)}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Month View Calendar Grid */}
                    {calendarView === 'month' && (
                        <div className="p-4">
                            {/* Day headers */}
                            <div className="grid grid-cols-7 gap-1 mb-2">
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                                    <div key={day} className="text-center text-sm font-medium text-slate-500 py-2">
                                        {day}
                                    </div>
                                ))}
                            </div>

                            {/* Calendar days */}
                            <div className="grid grid-cols-7 gap-1">
                                {calendarDays.map((day, idx) => {
                                    const dayGoals = getGoalsForDate(day);
                                    const isCurrentMonth = isSameMonth(day, currentDate);
                                    const isTodayDate = isToday(day);

                                    return (
                                        <div
                                            key={idx}
                                            onClick={() => handleOpenModal(null, day)}
                                            className={`min-h-[100px] p-2 rounded-lg border cursor-pointer transition-colors ${isCurrentMonth ? 'bg-white hover:bg-slate-50' : 'bg-slate-50 opacity-50'
                                                } ${isTodayDate ? 'ring-2 ring-indigo-500' : ''}`}
                                        >
                                            <div className={`text-sm font-medium mb-1 ${isTodayDate ? 'text-indigo-600' : isCurrentMonth ? 'text-slate-800' : 'text-slate-400'
                                                }`}>
                                                {format(day, 'd')}
                                            </div>
                                            <div className="space-y-1 max-h-[60px] overflow-y-auto">
                                                {dayGoals.slice(0, 3).map((goal) => (
                                                    <GoalPill key={goal.id || goal._id} goal={goal} compact />
                                                ))}
                                                {dayGoals.length > 3 && (
                                                    <div className="text-xs text-slate-500">+{dayGoals.length - 3} more</div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Week View */}
                    {calendarView === 'week' && (
                        <div className="p-4">
                            <div className="grid grid-cols-7 gap-2">
                                {Array.from({ length: 7 }).map((_, i) => {
                                    const day = addDays(startOfWeek(currentDate), i);
                                    const dayGoals = getGoalsForDate(day);
                                    const isTodayDate = isToday(day);

                                    return (
                                        <div
                                            key={i}
                                            onClick={() => handleOpenModal(null, day)}
                                            className={`min-h-[300px] p-3 rounded-lg border cursor-pointer ${isTodayDate ? 'ring-2 ring-indigo-500 bg-indigo-50/50' : 'bg-white hover:bg-slate-50'
                                                }`}
                                        >
                                            <div className={`text-center mb-3 pb-2 border-b ${isTodayDate ? 'text-indigo-600' : ''}`}>
                                                <div className="text-xs text-slate-500">{format(day, 'EEE')}</div>
                                                <div className="text-lg font-semibold">{format(day, 'd')}</div>
                                            </div>
                                            <div className="space-y-2">
                                                {dayGoals.map((goal) => (
                                                    <GoalPill key={goal.id || goal._id} goal={goal} />
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Day View */}
                    {calendarView === 'day' && (
                        <div className="p-6">
                            <div
                                onClick={() => handleOpenModal(null, currentDate)}
                                className={`min-h-[400px] p-4 rounded-xl border bg-white cursor-pointer ${isToday(currentDate) ? 'ring-2 ring-indigo-500' : ''
                                    }`}
                            >
                                <div className="space-y-3">
                                    {getGoalsForDate(currentDate).length === 0 ? (
                                        <div className="text-center py-16 text-slate-400">
                                            <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                            <p>No goals for this day</p>
                                            <p className="text-sm">Click to add a goal</p>
                                        </div>
                                    ) : (
                                        getGoalsForDate(currentDate).map((goal) => (
                                            <div
                                                key={goal.id || goal._id}
                                                onClick={(e) => { e.stopPropagation(); handleOpenModal(goal); }}
                                                className={`p-4 rounded-lg border-l-4 cursor-pointer transition-all ${goal.status === 'done'
                                                        ? 'bg-green-50 border-green-500 opacity-70'
                                                        : 'bg-white hover:shadow-md'
                                                    }`}
                                                style={{ borderLeftColor: goal.status === 'done' ? undefined : goal.color }}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleToggleDone(goal); }}
                                                        className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${goal.status === 'done'
                                                                ? 'bg-green-500 border-green-500 text-white'
                                                                : 'border-slate-300 hover:border-indigo-500'
                                                            }`}
                                                    >
                                                        {goal.status === 'done' && <Check className="w-3 h-3" />}
                                                    </button>
                                                    <div className="flex-1">
                                                        <h3 className={`font-medium ${goal.status === 'done' ? 'line-through text-slate-500' : 'text-slate-800'}`}>
                                                            {goal.title}
                                                        </h3>
                                                        {goal.description && (
                                                            <p className="text-sm text-slate-500 mt-1">{goal.description}</p>
                                                        )}
                                                        <div className="flex items-center gap-2 mt-2">
                                                            <Badge variant="outline" className="text-xs">
                                                                {goal.goal_type}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Year View */}
                    {calendarView === 'year' && (
                        <div className="p-4">
                            <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
                                {Array.from({ length: 12 }).map((_, monthIdx) => {
                                    const monthDate = new Date(currentDate.getFullYear(), monthIdx, 1);
                                    const monthGoals = goals.filter(g => {
                                        if (!g.target_date) return false;
                                        const gDate = parseISO(g.target_date);
                                        return gDate.getMonth() === monthIdx && gDate.getFullYear() === currentDate.getFullYear();
                                    });

                                    return (
                                        <div
                                            key={monthIdx}
                                            onClick={() => { setCurrentDate(monthDate); setCalendarView('month'); }}
                                            className="p-4 rounded-lg border bg-white hover:shadow-md cursor-pointer transition-all"
                                        >
                                            <div className="font-medium text-slate-800 mb-2">
                                                {format(monthDate, 'MMMM')}
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {monthGoals.filter(g => g.status === 'pending').length} pending
                                                </span>
                                                <span className="flex items-center gap-1 text-green-600">
                                                    <Check className="w-3 h-3" />
                                                    {monthGoals.filter(g => g.status === 'done').length} done
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* List View */}
            {viewMode === 'list' && (
                <div className="flex-1 bg-white rounded-xl shadow-lg border overflow-hidden">
                    {/* List Header */}
                    <div className="flex items-center justify-between p-4 border-b bg-slate-50">
                        <h2 className="text-lg font-semibold text-slate-800">All Goals</h2>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[150px]">
                                <Filter className="w-4 h-4 mr-2" />
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="done">Done</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="p-4 max-h-[600px] overflow-y-auto">
                        {groupedGoals.length === 0 ? (
                            <div className="text-center py-16 text-slate-400">
                                <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                <p>No goals found</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {groupedGoals.map(({ date, goals: dayGoals }) => (
                                    <div key={date.toISOString()}>
                                        <div className={`text-sm font-medium mb-2 ${isToday(date) ? 'text-indigo-600' : 'text-slate-500'}`}>
                                            {isToday(date) ? 'Today' : format(date, 'EEEE, MMMM d, yyyy')}
                                        </div>
                                        <div className="space-y-2">
                                            {dayGoals.map((goal) => (
                                                <div
                                                    key={goal.id || goal._id}
                                                    onClick={() => handleOpenModal(goal)}
                                                    className={`p-4 rounded-lg border-l-4 cursor-pointer transition-all ${goal.status === 'done'
                                                            ? 'bg-green-50 border-green-500'
                                                            : 'bg-white hover:shadow-md'
                                                        }`}
                                                    style={{ borderLeftColor: goal.status === 'done' ? undefined : goal.color }}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleToggleDone(goal); }}
                                                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${goal.status === 'done'
                                                                    ? 'bg-green-500 border-green-500 text-white'
                                                                    : 'border-slate-300 hover:border-indigo-500'
                                                                }`}
                                                        >
                                                            {goal.status === 'done' && <Check className="w-3 h-3" />}
                                                        </button>
                                                        <div className="flex-1">
                                                            <span className={goal.status === 'done' ? 'line-through text-slate-500' : 'text-slate-800 font-medium'}>
                                                                {goal.title}
                                                            </span>
                                                        </div>
                                                        <Badge variant="outline" className="text-xs">
                                                            {goal.goal_type}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Add/Edit Goal Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {selectedGoal ? 'Edit Goal' : 'Create New Goal'}
                        </DialogTitle>
                        <DialogDescription>
                            {selectedGoal ? 'Update your marketing goal' : 'Add a new goal to your marketing calendar'}
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="title">Goal Title *</Label>
                            <Input
                                id="title"
                                placeholder="e.g., Post 3 reels on Instagram"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                placeholder="Additional details..."
                                rows={2}
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Goal Type</Label>
                                <Select
                                    value={formData.goal_type}
                                    onValueChange={(v) => setFormData({ ...formData, goal_type: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="custom">One-time</SelectItem>
                                        <SelectItem value="daily">Daily</SelectItem>
                                        <SelectItem value="weekly">Weekly</SelectItem>
                                        <SelectItem value="biweekly">Biweekly</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Target Date *</Label>
                                <Input
                                    type="date"
                                    value={formData.target_date}
                                    onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        {/* Weekly recurrence days */}
                        {formData.goal_type === 'weekly' && (
                            <div className="space-y-2">
                                <Label>Repeat on days</Label>
                                <div className="flex flex-wrap gap-2">
                                    {DAYS_OF_WEEK.map((day) => (
                                        <Button
                                            key={day.value}
                                            type="button"
                                            variant={formData.recurrence_days?.includes(day.value) ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => handleDayRecurrenceToggle(day.value)}
                                            className={formData.recurrence_days?.includes(day.value) ? 'bg-indigo-600' : ''}
                                        >
                                            {day.label.slice(0, 3)}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* End date for recurring goals */}
                        {formData.goal_type !== 'custom' && (
                            <div className="space-y-2">
                                <Label>End Date (optional)</Label>
                                <Input
                                    type="date"
                                    value={formData.end_date}
                                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                />
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>Color</Label>
                            <div className="flex items-center gap-2">
                                <div
                                    className="w-8 h-8 rounded-lg border-2"
                                    style={{ backgroundColor: formData.color }}
                                />
                                <div className="flex gap-1 flex-wrap">
                                    {COLOR_PALETTE.map((color) => (
                                        <button
                                            key={color}
                                            type="button"
                                            className={`w-6 h-6 rounded-md transition-transform hover:scale-110 ${formData.color === color ? 'ring-2 ring-offset-1 ring-slate-800' : ''
                                                }`}
                                            style={{ backgroundColor: color }}
                                            onClick={() => setFormData({ ...formData, color })}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={handleCloseModal}>
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={saveMutation.isPending}
                                className="bg-gradient-to-r from-indigo-600 to-purple-600"
                            >
                                {saveMutation.isPending ? 'Saving...' : (selectedGoal ? 'Update' : 'Create')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
