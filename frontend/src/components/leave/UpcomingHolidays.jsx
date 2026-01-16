import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, PartyPopper } from 'lucide-react';
import { format, isAfter, parseISO } from 'date-fns';

export default function UpcomingHolidays({ workDays = [] }) {
    // Filter for future holidays and sort by date
    const upcomingHolidays = workDays
        .filter(day => day.is_holiday && isAfter(parseISO(day.date), new Date()))
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 5); // Show next 5 holidays

    if (upcomingHolidays.length === 0) {
        return (
            <Card className="h-full">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <PartyPopper className="w-5 h-5 text-pink-500" />
                        Upcoming Holidays
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center text-slate-500 py-4">
                        No upcoming holidays found.
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="h-full border-t-4 border-t-pink-500 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <PartyPopper className="w-5 h-5 text-pink-500" />
                    Upcoming Holidays
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {upcomingHolidays.map((holiday) => (
                        <div
                            key={holiday.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-pink-50/50 border border-pink-100 hover:bg-pink-50 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className="flex flex-col items-center bg-white p-2 rounded border border-pink-200 min-w-[3rem]">
                                    <span className="text-xs font-bold text-pink-600 uppercase">
                                        {format(parseISO(holiday.date), 'MMM')}
                                    </span>
                                    <span className="text-lg font-black text-slate-700">
                                        {format(parseISO(holiday.date), 'dd')}
                                    </span>
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900">{holiday.name || 'Holiday'}</p>
                                    <p className="text-xs text-slate-500">
                                        {format(parseISO(holiday.date), 'EEEE')}
                                    </p>
                                </div>
                            </div>
                            <Badge variant="outline" className="border-pink-200 text-pink-700 bg-white">
                                Holiday
                            </Badge>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
