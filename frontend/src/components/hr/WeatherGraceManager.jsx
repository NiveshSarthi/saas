
import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, AlertCircle, CloudRain, Sun, Wind, CloudSnow, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function WeatherGraceManager({ user }) {
    const [graceActive, setGraceActive] = useState(false);
    const [graceLoading, setGraceLoading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [weather, setWeather] = useState(null);
    const [location, setLocation] = useState(null);
    const [weatherLoading, setWeatherLoading] = useState(true);
    const today = format(new Date(), 'yyyy-MM-dd');

    useEffect(() => {
        checkGraceStatus();
        fetchLocation();
    }, []);

    useEffect(() => {
        if (location) {
            fetchWeather();
        }
    }, [location]);

    const fetchLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setLocation({
                        lat: position.coords.latitude,
                        lon: position.coords.longitude
                    });
                },
                () => {
                    // Default to New Delhi if location denied
                    setLocation({ lat: 28.61, lon: 77.20 });
                }
            );
        } else {
            setLocation({ lat: 28.61, lon: 77.20 });
        }
    };

    const fetchWeather = async () => {
        try {
            setWeatherLoading(true);
            const response = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&current=temperature_2m,precipitation,rain,showers,snowfall,wind_speed_10m&timezone=auto`
            );
            const data = await response.json();
            setWeather(data.current);
        } catch (e) {
            console.error('Weather fetch failed', e);
        } finally {
            setWeatherLoading(false);
        }
    };

    const checkGraceStatus = async () => {
        try {
            setLoading(true);
            const res = await base44.functions.invoke('getGracePeriod', { date: today });
            if (res.data) {
                setGraceActive(true);
            }
        } catch (e) {
            console.log('Error checking grace status', e);
        } finally {
            setLoading(false);
        }
    };

    const handleActivateGrace = async () => {
        try {
            setGraceLoading(true);
            await base44.functions.invoke('setGracePeriod', {
                date: today,
                minutes: 30,
                reason: 'Manual Grace Period - HR Admin',
                created_by: user?.email
            });
            setGraceActive(true);
            toast.success('30-minute Grace Period Activated!');
        } catch (e) {
            toast.error('Failed to activate grace period');
        } finally {
            setGraceLoading(false);
        }
    };

    const handleDeactivateGrace = async () => {
        try {
            setGraceLoading(true);
            await base44.functions.invoke('deleteGracePeriod', { date: today });
            setGraceActive(false);
            toast.success('Grace Period Deactivated');
        } catch (e) {
            toast.error('Failed to deactivate grace period');
        } finally {
            setGraceLoading(false);
        }
    };

    const getWeatherCondition = () => {
        if (!weather) return 'Unknown';
        if (weather.snowfall > 0) return 'Snow';
        if (weather.rain > 0 || weather.showers > 0) return 'Rain';
        if (weather.precipitation > 0) return 'Drizzle';
        if (weather.wind_speed_10m > 30) return 'Windy';
        return 'Clear';
    };

    const getWeatherIcon = () => {
        const condition = getWeatherCondition();
        switch (condition) {
            case 'Rain':
            case 'Drizzle': return <CloudRain className="w-12 h-12 text-blue-500" />;
            case 'Snow': return <CloudSnow className="w-12 h-12 text-blue-300" />;
            case 'Windy': return <Wind className="w-12 h-12 text-slate-500" />;
            default: return <Sun className="w-12 h-12 text-amber-500" />;
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-slate-500">Loading grace period status...</div>;
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Weather Display Card - For Reference Only */}
            <Card className="border-slate-200">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-indigo-500" />
                        Current Weather
                    </CardTitle>
                    <CardDescription>
                        Real-time conditions at office location (for reference)
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {weatherLoading ? (
                        <div className="text-center py-8 text-slate-400">Loading weather...</div>
                    ) : weather ? (
                        <>
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl mb-6">
                                <div className="flex items-center gap-4">
                                    {getWeatherIcon()}
                                    <div>
                                        <h2 className="text-3xl font-bold text-slate-900">{weather.temperature_2m}°C</h2>
                                        <p className="text-slate-600 font-medium">{getWeatherCondition()}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="flex items-center justify-end gap-1 text-slate-500 text-sm mb-1">
                                        <Wind className="w-4 h-4" />
                                        {weather.wind_speed_10m} km/h
                                    </div>
                                    <div className="text-xs text-slate-400">
                                        Lat: {location?.lat?.toFixed(2)}, Lon: {location?.lon?.toFixed(2)}
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-3 border border-slate-100 rounded-lg">
                                    <span className="text-sm font-medium text-slate-600">Rainfall</span>
                                    <span className="font-bold text-slate-900">{weather.rain} mm</span>
                                </div>
                                <div className="flex items-center justify-between p-3 border border-slate-100 rounded-lg">
                                    <span className="text-sm font-medium text-slate-600">Wind Speed</span>
                                    <span className="font-bold text-slate-900">{weather.wind_speed_10m} km/h</span>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-8 text-slate-400">Weather data unavailable</div>
                    )}
                </CardContent>
            </Card>

            {/* Grace Period Control - Manual Only */}
            <Card className={`border-slate-200 ${graceActive ? 'bg-green-50/50 border-green-200' : ''}`}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Clock className={`w-5 h-5 ${graceActive ? 'text-green-600' : 'text-slate-500'}`} />
                        Attendance Grace Control
                    </CardTitle>
                    <CardDescription>
                        Manually manage attendance exceptions
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8">
                        {graceActive ? (
                            <div className="space-y-4">
                                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                                    <CheckCircle className="w-10 h-10 text-green-600" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold text-green-700">Grace Period Active</h3>
                                    <p className="text-green-600 mt-2">30 minutes grace applied for today</p>
                                </div>
                                <Badge variant="outline" className="bg-white text-slate-600 border-slate-200 mt-4">
                                    Applied by: {user?.full_name || 'Admin User'}
                                </Badge>
                                <Button
                                    size="lg"
                                    variant="destructive"
                                    onClick={handleDeactivateGrace}
                                    disabled={graceLoading}
                                    className="w-full max-w-sm mx-auto mt-4"
                                >
                                    {graceLoading ? 'Deactivating...' : 'Deactivate Grace Period'}
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto">
                                    <AlertCircle className="w-10 h-10 text-indigo-600" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold text-slate-900">No Grace Period Active</h3>
                                    <p className="text-slate-500 mt-2 max-w-md mx-auto">
                                        Click the button below to manually activate a 30-minute grace period for today's attendance.
                                    </p>
                                </div>
                                <Button
                                    size="lg"
                                    onClick={handleActivateGrace}
                                    disabled={graceLoading}
                                    className="w-full max-w-sm mx-auto bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all font-bold"
                                >
                                    {graceLoading ? 'Activating...' : 'Activate 30m Grace Period'}
                                </Button>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
