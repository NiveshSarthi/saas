import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, AlertCircle, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'react-hot-toast';

export default function PaymentsCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const { data: receivables = [] } = useQuery({
    queryKey: ['receivables-calendar'],
    queryFn: () => base44.entities.PaymentReceivable.list('-payment_date', 1000),
  });

  const { data: payables = [] } = useQuery({
    queryKey: ['payables-calendar'],
    queryFn: () => base44.entities.PaymentPayable.list('-due_date', 1000),
  });

  const { data: salaries = [] } = useQuery({
    queryKey: ['salaries-calendar'],
    queryFn: () => base44.entities.SalaryRecord.list('-month', 500),
  });

  const { data: pettyCash = [] } = useQuery({
    queryKey: ['pettycash-calendar'],
    queryFn: () => base44.entities.PettyCashReimbursement.filter({ status: 'approved' }),
  });

  const getPaymentsForDate = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    
    const receivablesOnDate = receivables.filter(r => r.payment_date === dateStr);
    const payablesOnDate = payables.filter(p => p.due_date === dateStr);
    
    return {
      receivables: receivablesOnDate,
      payables: payablesOnDate,
      totalReceivable: receivablesOnDate.reduce((sum, r) => sum + (r.pending_amount || 0), 0),
      totalPayable: payablesOnDate.reduce((sum, p) => sum + (p.pending_amount || 0), 0)
    };
  };

  const handleExport = async () => {
    try {
      const monthStr = format(currentDate, 'yyyy-MM');
      const response = await base44.functions.invoke('exportPaymentsCalendar', { month: monthStr });
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payments_calendar_${monthStr}.csv`;
      a.click();
      toast.success('Calendar exported');
    } catch (error) {
      toast.error('Export failed');
    }
  };

  const selectedDatePayments = selectedDate ? getPaymentsForDate(selectedDate) : null;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <CalendarIcon className="w-8 h-8 text-indigo-600" />
            Payments Calendar
          </h1>
          <p className="text-slate-600 mt-1">Upcoming receivables and payables timeline</p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-2xl font-bold">{format(currentDate, 'MMMM yyyy')}</h2>
        <Button variant="outline" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-7 gap-2 mb-4">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center font-semibold text-slate-600 text-sm">
                    {day}
                  </div>
                ))}
              </div>
              
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: daysInMonth[0].getDay() }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                
                {daysInMonth.map(day => {
                  const payments = getPaymentsForDate(day);
                  const hasPayments = payments.receivables.length > 0 || payments.payables.length > 0;
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  
                  return (
                    <button
                      key={day.toString()}
                      onClick={() => setSelectedDate(day)}
                      className={`
                        aspect-square p-2 rounded-lg border transition-all
                        ${isSelected ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300'}
                        ${isToday(day) ? 'ring-2 ring-indigo-600' : ''}
                        ${hasPayments ? 'bg-yellow-50' : 'bg-white'}
                      `}
                    >
                      <div className="text-sm font-medium">{format(day, 'd')}</div>
                      {hasPayments && (
                        <div className="mt-1 space-y-1">
                          {payments.totalReceivable > 0 && (
                            <div className="text-xs text-green-600 font-medium">
                              +₹{(payments.totalReceivable / 1000).toFixed(0)}K
                            </div>
                          )}
                          {payments.totalPayable > 0 && (
                            <div className="text-xs text-red-600 font-medium">
                              -₹{(payments.totalPayable / 1000).toFixed(0)}K
                            </div>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedDate ? format(selectedDate, 'MMM dd, yyyy') : 'Select a date'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedDatePayments ? (
                <div className="space-y-4">
                  {selectedDatePayments.receivables.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-green-700 flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4" />
                        Receivables ({selectedDatePayments.receivables.length})
                      </h3>
                      <div className="space-y-2">
                        {selectedDatePayments.receivables.map(r => (
                          <div key={r.id} className="p-2 bg-green-50 rounded border border-green-200">
                            <div className="font-medium text-sm">{r.category}</div>
                            <div className="text-xs text-slate-600">{r.lead_id || r.project_id || 'N/A'}</div>
                            <div className="text-sm font-bold text-green-700">₹{(r.pending_amount || 0).toLocaleString()}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedDatePayments.payables.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-red-700 flex items-center gap-2 mb-2">
                        <TrendingDown className="w-4 h-4" />
                        Payables ({selectedDatePayments.payables.length})
                      </h3>
                      <div className="space-y-2">
                        {selectedDatePayments.payables.map(p => (
                          <div key={p.id} className="p-2 bg-red-50 rounded border border-red-200">
                            <div className="font-medium text-sm">{p.category}</div>
                            <div className="text-xs text-slate-600">{p.vendor_name || 'N/A'}</div>
                            <div className="text-sm font-bold text-red-700">₹{(p.pending_amount || 0).toLocaleString()}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedDatePayments.receivables.length === 0 && selectedDatePayments.payables.length === 0 && (
                    <div className="text-center text-slate-500 py-8">
                      No payments scheduled
                    </div>
                  )}

                  <div className="pt-4 border-t">
                    <div className="flex justify-between font-bold">
                      <span>Net Position:</span>
                      <span className={selectedDatePayments.totalReceivable - selectedDatePayments.totalPayable >= 0 ? 'text-green-700' : 'text-red-700'}>
                        ₹{((selectedDatePayments.totalReceivable - selectedDatePayments.totalPayable) / 1000).toFixed(2)}K
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-slate-500 py-8">
                  Click on a date to view payments
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}