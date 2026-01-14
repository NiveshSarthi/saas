import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Target, 
  Calendar, 
  Users, 
  TrendingUp, 
  Footprints, 
  Briefcase, 
  Phone,
  CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function SalesSummaryCards({ 
  mtdBookings,
  teamBookingTarget,
  mtdPerformancePct,
  forecastBookings,
  todayWalkIns,
  todayMeetings,
  todayFollowups,
  mtdWalkIns,
  forecastWalkIns,
  todayClosures,
  teamWalkInTarget = 0
}) {
  const [meetingFilter, setMeetingFilter] = useState('today');
  const [customDate, setCustomDate] = useState('');
  
  const MetricCard = ({ label, value, subValue, icon: Icon, colorClass, bgClass }) => (
    <Card className={`border-l-4 ${colorClass.replace('text-', 'border-')} shadow-sm`}>
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{value}</h3>
            {subValue && <p className="text-xs text-slate-400 mt-1">{subValue}</p>}
          </div>
          <div className={`p-2 rounded-lg ${bgClass} ${colorClass}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const SplitMetricCard = ({ label, value1, label1, value2, label2, icon: Icon, colorClass, bgClass }) => (
    <Card className={`border-l-4 ${colorClass.replace('text-', 'border-')} shadow-sm`}>
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-3">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <div className={`p-2 rounded-lg ${bgClass} ${colorClass}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-slate-400">{label1}</p>
            <h3 className="text-xl font-bold text-slate-900 mt-1">{value1}</h3>
          </div>
          <div>
            <p className="text-xs text-slate-400">{label2}</p>
            <h3 className="text-xl font-bold text-slate-900 mt-1">{value2}</h3>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. MTD Booking Target - Walk-ins & Closures */}
        <SplitMetricCard 
          label="MTD Booking Target"
          value1={`${mtdWalkIns || 0} / ${teamWalkInTarget}`}
          label1="Walk-ins"
          value2={`${mtdBookings} / ${teamBookingTarget}`}
          label2="Closures"
          icon={Target}
          colorClass="text-indigo-600"
          bgClass="bg-indigo-50"
        />

        {/* 2. Month Forecast - Walk-ins & Closures */}
        <SplitMetricCard 
          label="Month Forecast"
          value1={forecastWalkIns || 0}
          label1="Walk-ins"
          value2={forecastBookings}
          label2="Closures"
          icon={TrendingUp}
          colorClass="text-emerald-600"
          bgClass="bg-emerald-50"
        />

        {/* 3. Today's Achievement - Walk-ins & Closures */}
        <SplitMetricCard 
          label="Today's Achievement"
          value1={todayWalkIns}
          label1="Walk-ins"
          value2={todayClosures || 0}
          label2="Closures"
          icon={CheckCircle2}
          colorClass="text-blue-600"
          bgClass="bg-blue-50"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 4. Today's Meetings with Filters */}
        <Card className="border-l-4 border-purple-600 shadow-sm">
          <CardContent className="p-4">
            <div className="flex justify-between items-start mb-3">
              <p className="text-sm font-medium text-slate-500">Today's Meetings</p>
              <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                <Briefcase className="w-5 h-5" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-3">{todayMeetings}</h3>
            <div className="flex gap-2 flex-wrap">
              <Button 
                size="sm" 
                variant={meetingFilter === 'today' ? 'default' : 'outline'}
                onClick={() => setMeetingFilter('today')}
                className="h-7 text-xs"
              >
                Today
              </Button>
              <Button 
                size="sm" 
                variant={meetingFilter === 'tomorrow' ? 'default' : 'outline'}
                onClick={() => setMeetingFilter('tomorrow')}
                className="h-7 text-xs"
              >
                Tomorrow
              </Button>
              <Button 
                size="sm" 
                variant={meetingFilter === 'custom' ? 'default' : 'outline'}
                onClick={() => setMeetingFilter('custom')}
                className="h-7 text-xs"
              >
                Custom
              </Button>
            </div>
            {meetingFilter === 'custom' && (
              <Input 
                type="date" 
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="mt-2 h-8 text-xs"
                placeholder="Select date"
              />
            )}
          </CardContent>
        </Card>

        {/* 5. MTD Performance - Walk-ins & Closures */}
        <SplitMetricCard 
          label="MTD Performance"
          value1={`${mtdPerformancePct}%`}
          label1="Walk-ins"
          value2={`${mtdPerformancePct}%`}
          label2="Closures"
          icon={Users}
          colorClass="text-cyan-600"
          bgClass="bg-cyan-50"
        />
      </div>
    </div>
  );
}