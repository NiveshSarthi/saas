import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  User,
  Bell,
  Palette,
  Shield,
  Building2,
  Users,
  Mail,
  Save,
  Loader2,
  Check,
  Sliders,
  Building,
  TrendingUp
} from 'lucide-react';
import CustomFieldsManager from '@/components/admin/CustomFieldsManager';
import TagManager from '@/components/admin/TagManager';
import DepartmentManager from '@/components/admin/DepartmentManager';
import SalesKPISettingsPanel from '@/components/admin/SalesKPISettings';
import BuilderManager from '@/components/admin/BuilderManager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Settings() {
  const [user, setUser] = useState(null);
  const [saved, setSaved] = useState(false);
  const [profileData, setProfileData] = useState({
    full_name: '',
    timezone: 'UTC',
    language: 'en'
  });
  const [notifications, setNotifications] = useState({
    email_tasks: true,
    email_comments: true,
    email_mentions: true,
    email_digest: false,
    push_enabled: true
  });

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
        setProfileData({
          full_name: userData.full_name || '',
          timezone: userData.timezone || 'UTC',
          language: userData.language || 'en'
        });
        if (userData.notifications) {
          setNotifications(userData.notifications);
        }
      } catch (e) {
        console.log('User not logged in');
      }
    };
    fetchUser();
  }, []);

  const { data: organization } = useQuery({
    queryKey: ['organization'],
    queryFn: async () => {
      const orgs = await base44.entities.Organization.list();
      return orgs[0];
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data) => base44.auth.updateMe(data),
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const handleSaveProfile = () => {
    updateProfileMutation.mutate(profileData);
  };

  const handleSaveNotifications = () => {
    updateProfileMutation.mutate({ notifications });
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const isAdmin = user?.role === 'admin';

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-4xl mx-auto overflow-x-hidden w-full">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">Manage your account and preferences</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4 sm:space-y-6">
        <TabsList className="bg-slate-100 p-1 overflow-x-auto flex-nowrap w-full justify-start sm:justify-center">
          <div className="flex gap-1">
            <TabsTrigger value="profile" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap">
              <User className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap">
              <Bell className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Notifications</span>
            </TabsTrigger>
          {isAdmin && (
            <>
              <TabsTrigger value="organization" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap">
                <Building2 className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden lg:inline">Organization</span>
              </TabsTrigger>
              <TabsTrigger value="departments" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap">
                <Building className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden lg:inline">Departments</span>
              </TabsTrigger>
              <TabsTrigger value="custom-fields" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap">
                <Sliders className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden lg:inline">Fields</span>
              </TabsTrigger>
              <TabsTrigger value="tags" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap">
                <Sliders className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden lg:inline">Tags</span>
              </TabsTrigger>
              <TabsTrigger value="sales-kpi" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap">
                <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden lg:inline">Sales KPI</span>
              </TabsTrigger>
              <TabsTrigger value="builders" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap">
                <Building className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden lg:inline">Builders</span>
              </TabsTrigger>
            </>
          )}
          </div>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <Avatar className="w-20 h-20">
                  <AvatarFallback className="text-2xl bg-indigo-100 text-indigo-600">
                    {getInitials(profileData.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <Button variant="outline" size="sm">Change Avatar</Button>
                  <p className="text-xs text-slate-500 mt-1">JPG, PNG. Max 2MB</p>
                </div>
              </div>

              <Separator />

              {/* Name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    value={profileData.full_name}
                    onChange={(e) => setProfileData(prev => ({ ...prev, full_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={user?.email || ''}
                    disabled
                    className="bg-slate-50"
                  />
                </div>
              </div>

              {/* Preferences */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Select 
                    value={profileData.timezone}
                    onValueChange={(value) => setProfileData(prev => ({ ...prev, timezone: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="America/New_York">Eastern Time</SelectItem>
                      <SelectItem value="America/Chicago">Central Time</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                      <SelectItem value="Europe/London">London</SelectItem>
                      <SelectItem value="Europe/Paris">Paris</SelectItem>
                      <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                      <SelectItem value="Asia/Kolkata">India</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select 
                    value={profileData.language}
                    onValueChange={(value) => setProfileData(prev => ({ ...prev, language: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                      <SelectItem value="de">German</SelectItem>
                      <SelectItem value="pt">Portuguese</SelectItem>
                      <SelectItem value="hi">Hindi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end">
                <Button 
                  onClick={handleSaveProfile}
                  disabled={updateProfileMutation.isPending}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {updateProfileMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : saved ? (
                    <Check className="w-4 h-4 mr-2" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  {saved ? 'Saved!' : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Control how you receive notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-slate-900 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email Notifications
                </h3>
                
                <div className="space-y-4 pl-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Task Assignments</p>
                      <p className="text-xs text-slate-500">Get notified when assigned to a task</p>
                    </div>
                    <Switch
                      checked={notifications.email_tasks}
                      onCheckedChange={(checked) => 
                        setNotifications(prev => ({ ...prev, email_tasks: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Comments</p>
                      <p className="text-xs text-slate-500">Get notified on new comments</p>
                    </div>
                    <Switch
                      checked={notifications.email_comments}
                      onCheckedChange={(checked) => 
                        setNotifications(prev => ({ ...prev, email_comments: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Mentions</p>
                      <p className="text-xs text-slate-500">Get notified when mentioned</p>
                    </div>
                    <Switch
                      checked={notifications.email_mentions}
                      onCheckedChange={(checked) => 
                        setNotifications(prev => ({ ...prev, email_mentions: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Daily Digest</p>
                      <p className="text-xs text-slate-500">Receive a daily summary email</p>
                    </div>
                    <Switch
                      checked={notifications.email_digest}
                      onCheckedChange={(checked) => 
                        setNotifications(prev => ({ ...prev, email_digest: checked }))
                      }
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-sm font-medium text-slate-900 flex items-center gap-2">
                  <Bell className="w-4 h-4" />
                  Push Notifications
                </h3>
                
                <div className="pl-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Enable Push Notifications</p>
                      <p className="text-xs text-slate-500">Receive browser push notifications</p>
                    </div>
                    <Switch
                      checked={notifications.push_enabled}
                      onCheckedChange={(checked) => 
                        setNotifications(prev => ({ ...prev, push_enabled: checked }))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button 
                  onClick={handleSaveNotifications}
                  disabled={updateProfileMutation.isPending}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Preferences
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="departments">
            <Card>
              <CardHeader>
                <CardTitle>Department Management</CardTitle>
                <CardDescription>Manage departments and teams</CardDescription>
              </CardHeader>
              <CardContent>
                <DepartmentManager />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Organization Tab (Admin only) */}
        {isAdmin && (
          <TabsContent value="organization">
            <Card>
              <CardHeader>
                <CardTitle>Organization Settings</CardTitle>
                <CardDescription>Manage your organization settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Organization Name</Label>
                    <Input
                      value={organization?.name || ''}
                      placeholder="Enter organization name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Domain</Label>
                    <Select value={organization?.domain || 'generic'}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="it">IT / Software</SelectItem>
                        <SelectItem value="real_estate">Real Estate</SelectItem>
                        <SelectItem value="generic">Generic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-slate-900 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Team Management
                  </h3>
                  <p className="text-sm text-slate-500">
                    Manage team members from the Team page
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button className="bg-indigo-600 hover:bg-indigo-700">
                    <Save className="w-4 h-4 mr-2" />
                    Save Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="custom-fields">
            <Card>
              <CardHeader>
                <CardTitle>Custom Fields</CardTitle>
                <CardDescription>Manage custom fields across the organization</CardDescription>
              </CardHeader>
              <CardContent>
                <CustomFieldsManager />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="tags">
            <Card>
              <CardHeader>
                <CardTitle>Tag Management</CardTitle>
                <CardDescription>Create standardized tags to keep your organization consistent</CardDescription>
              </CardHeader>
              <CardContent>
                <TagManager />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="sales-kpi">
            <SalesKPISettingsPanel />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="builders">
            <Card>
              <CardHeader>
                <CardTitle>Builder Management</CardTitle>
                <CardDescription>Create and manage builders and their assigned sales team members</CardDescription>
              </CardHeader>
              <CardContent>
                <BuilderManager />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}