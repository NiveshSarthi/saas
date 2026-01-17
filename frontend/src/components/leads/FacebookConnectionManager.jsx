// @ts-nocheck
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Facebook,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  XCircle,
  FileText,
  Zap,
  Download,
  Trash2,
  Users
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

export default function FacebookConnectionManager() {
  const [connectLoading, setConnectLoading] = useState(false);
  const [diagnosticResults, setDiagnosticResults] = useState(null);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const queryClient = useQueryClient();

  const { data: pages = [], isLoading } = useQuery({
    queryKey: ['facebook-pages'],
    queryFn: () => base44.entities.FacebookPageConnection.list('-created_date'),
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  const connectMutation = useMutation({
    mutationFn: async ({ page_id, page_token }) => {
      const response = await base44.functions.invoke('connectFacebookPage', { page_id, page_token });
      return response.data;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['facebook-pages'] });
      toast.success(data.message || 'Facebook pages connected successfully');
    },
    onError: (error) => {
      console.error('Facebook connection error:', error);
      console.error('Error response data:', error.response?.data);
      const errorData = error.response?.data;

      // Check for rate limit
      if (error.response?.status === 429 || errorData?.isRateLimit) {
        toast.error('Facebook API rate limit reached', {
          description: 'Please wait a few minutes before trying again',
          duration: 8000,
        });
        return;
      }

      // Show detailed error in a dialog
      setDiagnosticResults({
        success: false,
        message: 'Connection Failed',
        results: {
          error: errorData?.error || error.message,
          hint: errorData?.hint,
          details: errorData?.details,
          fullResponse: errorData
        }
      });
      setShowDiagnostic(true);

      toast.error(errorData?.error || error.message || 'Failed to connect Facebook', {
        description: errorData?.hint || 'Click to view full error details',
        duration: 8000,
      });
    }
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('syncFacebookForms', {});
      return response.data;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['facebook-pages'] });
      const newForms = data.results?.reduce((sum, r) => sum + (r.new_forms || 0), 0) || 0;
      toast.success(newForms > 0 ? `Found ${newForms} new form(s)` : 'All forms are up to date');
    },
    onError: (error) => {
      console.error('Sync error:', error);
      console.error('Error response:', error.response);
      const errorData = error.response?.data;

      if (error.response?.status === 429 || errorData?.isRateLimit) {
        toast.error('Facebook API rate limit reached', {
          description: 'Please wait a few minutes before trying again',
          duration: 8000,
        });
        return;
      }

      toast.error(errorData?.error || error.message || 'Sync failed', {
        description: errorData?.hint || errorData?.details,
        duration: 8000,
      });
    }
  });

  const fetchLeadsMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('fetchFacebookLeads', {});
      return response.data;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['leads-management'] });
      await queryClient.invalidateQueries({ queryKey: ['facebook-pages'] });

      if (data.errors?.some(e => e.isRateLimit)) {
        toast.warning(`Imported ${data.newLeadsCreated} leads. Some forms hit rate limits - try again later.`);
      } else {
        toast.success(
          `${data.newLeadsCreated} new lead(s) imported from today's Facebook forms`,
          { description: data.duplicatesSkipped > 0 ? `${data.duplicatesSkipped} duplicates skipped` : undefined }
        );
      }
    },
    onError: (error) => {
      console.error('Fetch leads error:', error);
      console.error('Error response:', error.response);
      const errorData = error.response?.data;

      if (error.response?.status === 429 || errorData?.isRateLimit) {
        toast.error('Facebook API rate limit reached', {
          description: 'Please wait a few minutes before trying again',
          duration: 8000,
        });
        return;
      }

      toast.error(errorData?.error || error.message || 'Failed to fetch leads', {
        description: errorData?.hint || errorData?.details,
        duration: 8000,
      });
    }
  });

  const togglePageMutation = useMutation({
    mutationFn: async ({ pageId, newStatus }) => {
      await base44.entities.FacebookPageConnection.update(pageId, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facebook-pages'] });
      toast.success('Page status updated');
    },
    onError: (error) => {
      toast.error('Failed to update page status');
    }
  });

  const deletePageMutation = useMutation({
    mutationFn: async (id) => {
      await base44.entities.FacebookPageConnection.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facebook-pages'] });
      toast.success('Page connection removed');
    },
    onError: () => {
      toast.error('Failed to remove page connection');
    }
  });

  const handleTogglePage = (page) => {
    const newStatus = page.status === 'active' ? 'inactive' : 'active';
    togglePageMutation.mutate({ pageId: page.id, newStatus });
  };

  const [fbPageId, setFbPageId] = useState('');
  const [fbPageToken, setFbPageToken] = useState('');
  const [userToken, setUserToken] = useState('');

  const connectAccountMutation = useMutation({
    mutationFn: async ({ user_token }) => {
      const response = await base44.functions.invoke('connectFacebookAccount', { user_token });
      return response.data;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['facebook-pages'] });
      toast.success(data.message || 'All pages connected successfully');
      setUserToken('');
    },
    onError: (error) => {
      const msg = error.response?.data?.error || error.message || 'Unknown error';
      console.error('Connect Account Error:', error);
      toast.error(`Connection Failed: ${msg}`);
    }
  });

  const handleConnectAccount = () => {
    if (!userToken) {
      toast.error('Please enter User Access Token');
      return;
    }
    connectAccountMutation.mutate({ user_token: userToken });
  };

  const handleConnect = async () => {
    if (!fbPageId || !fbPageToken) {
      toast.error('Please enter both Page ID and Access Token');
      return;
    }
    setConnectLoading(true);
    try {
      await connectMutation.mutateAsync({ page_id: fbPageId, page_token: fbPageToken });
      setFbPageId('');
      setFbPageToken('');
    } finally {
      setConnectLoading(false);
    }
  };

  const totalForms = pages.reduce((sum, page) => sum + (page.lead_forms?.length || 0), 0);
  const subscribedForms = pages.reduce((sum, page) =>
    sum + (page.lead_forms?.filter(f => f.subscribed).length || 0), 0
  );

  return (
    <>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Facebook className="w-4 h-4 text-blue-600" />
            <span>FB Config</span>
            {pages.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {pages.length}
              </Badge>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Facebook className="w-5 h-5 text-blue-600" />
              Facebook Page Connections
            </DialogTitle>
            <DialogDescription>
              Automatically capture leads from all forms on your Facebook pages
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Connection Tabs */}
            <Tabs defaultValue="bulk" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="bulk">Connect All Pages</TabsTrigger>
                <TabsTrigger value="single">Connect Single Page</TabsTrigger>
              </TabsList>

              <TabsContent value="bulk" className="space-y-4 py-4">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-4">
                  <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-600" />
                    Bulk Connection (User Token)
                  </h4>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">User Access Token</label>
                    <input
                      type="password"
                      placeholder="Enter User Token (with pages_show_list)"
                      value={userToken}
                      onChange={(e) => setUserToken(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <p className="text-xs text-slate-500">
                      This will fetch and connect ALL pages where you are an admin.
                    </p>
                  </div>
                  <Button
                    onClick={handleConnectAccount}
                    disabled={connectAccountMutation.isPending}
                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                  >
                    {connectAccountMutation.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Connecting All Pages...
                      </>
                    ) : (
                      <>
                        <Users className="w-4 h-4 mr-2" />
                        Fetch & Connect All Pages
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="single" className="space-y-4 py-4">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-4">
                  <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-indigo-600" />
                    Single Page Connection
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Page ID</label>
                      <input
                        type="text"
                        placeholder="Enter Page ID"
                        value={fbPageId}
                        onChange={(e) => setFbPageId(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Page Access Token</label>
                      <input
                        type="password"
                        placeholder="Enter Page Token"
                        value={fbPageToken}
                        onChange={(e) => setFbPageToken(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleConnect}
                    disabled={connectLoading || connectMutation.isPending}
                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                  >
                    {connectLoading || connectMutation.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Facebook className="w-4 h-4 mr-2" />
                        Connect Page
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>

            <div className="grid grid-cols-2 gap-3">
              {pages.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending}
                  className="w-full"
                >
                  {syncMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Sync Forms
                    </>
                  )}
                </Button>
              )}
              {pages.length > 0 && (
                <Button
                  variant="default"
                  onClick={() => fetchLeadsMutation.mutate()}
                  disabled={fetchLeadsMutation.isPending}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {fetchLeadsMutation.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Fetch Leads
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Setup Instructions */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
              <div className="font-semibold text-amber-900 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                How to Get Your Facebook Page Access Token
              </div>
              <ol className="text-xs text-amber-800 space-y-1.5 list-decimal list-inside">
                <li>Go to <a href="https://developers.facebook.com/tools/explorer" target="_blank" className="underline font-medium">Facebook Graph API Explorer</a></li>
                <li>Grant these permissions: <code className="bg-amber-100 px-1 py-0.5 rounded text-[10px]">pages_show_list, leads_retrieval, pages_manage_ads, pages_manage_metadata</code></li>
                <li>Generate and copy a <strong>Page Access Token</strong> for your specific page.</li>
                <li>Enter the Page ID and Token above to connect.</li>
                <li className="pt-2 font-semibold">Webhooks for Real-time Sync:</li>
                <ul className="pl-4 list-disc space-y-1">
                  <li><strong>Callback URL:</strong> <code className="bg-amber-100 px-1 py-0.5 rounded text-[10px]">{window.location.origin.replace('3000', '5001')}/functions/webhooks/facebook</code></li>
                  <li><strong>Verify Token:</strong> Use the value of <code className="bg-amber-100 px-1 py-0.5 rounded text-[10px]">FACEBOOK_VERIFY_TOKEN</code> from your backend .env</li>
                  <li><strong>Subscription:</strong> Subscribe to <code className="bg-amber-100 px-1 py-0.5 rounded text-[10px]">leadgen</code> field in the "Page" object.</li>
                </ul>
              </ol>

              <Button
                variant="outline"
                size="sm"
                className="w-full mt-3"
                onClick={async () => {
                  try {
                    const response = await base44.functions.invoke('testFacebookToken', {});
                    setDiagnosticResults(response.data);
                    setShowDiagnostic(true);

                    if (response.data.results?.tests?.some(t => t.isRateLimit)) {
                      toast.warning('Some tests were rate limited. Please wait a few minutes.');
                    }
                  } catch (error) {
                    console.error('Token test failed:', error);
                    const errorData = error.response?.data;

                    if (error.response?.status === 429 || errorData?.isRateLimit) {
                      toast.error('Facebook API rate limit reached. Please wait a few minutes.');
                    } else {
                      toast.error('Token test failed: ' + error.message);
                    }
                  }
                }}
              >
                🔍 Test Token
              </Button>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Button
                  onClick={handleConnect}
                  disabled={connectLoading || connectMutation.isPending}
                  className="flex-1"
                >
                  {connectLoading || connectMutation.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Facebook className="w-4 h-4 mr-2" />
                      {pages.length > 0 ? 'Re-Connect Pages' : 'Connect Facebook'}
                    </>
                  )}
                </Button>
                {pages.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => syncMutation.mutate()}
                    disabled={syncMutation.isPending}
                  >
                    {syncMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Sync Forms
                      </>
                    )}
                  </Button>
                )}
              </div>

              {pages.length > 0 && (
                <Button
                  variant="default"
                  onClick={() => fetchLeadsMutation.mutate()}
                  disabled={fetchLeadsMutation.isPending}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {fetchLeadsMutation.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Fetching Leads...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Fetch Today's Leads
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Connected Pages List */}
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : pages.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-lg border-2 border-dashed">
                <Facebook className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="font-semibold text-slate-900 mb-1">No Pages Connected</h3>
                <p className="text-sm text-slate-500 mb-4">
                  Connect your Facebook page to automatically capture all leads
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pages.map((page) => (
                  <Card key={page.id} className="border-l-4 border-l-blue-500">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-base flex items-center gap-2">
                            {page.page_name}
                            {page.status === 'active' ? (
                              <Badge className="bg-green-100 text-green-700 border-green-200">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                                <XCircle className="w-3 h-3 mr-1" />
                                Inactive
                              </Badge>
                            )}
                          </CardTitle>
                          <CardDescription className="text-xs mt-1">
                            Page ID: {page.page_id}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                              if (confirm('Are you sure you want to remove this page connection?')) {
                                deletePageMutation.mutate(page.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          <Switch
                            checked={page.status === 'active'}
                            onCheckedChange={() => handleTogglePage(page)}
                            disabled={togglePageMutation.isPending}
                          />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-3">
                      {/* Stats */}
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <FileText className="w-4 h-4 text-blue-600" />
                          <span className="font-medium">{page.lead_forms?.length || 0}</span>
                          <span className="text-slate-500">forms</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Zap className="w-4 h-4 text-green-600" />
                          <span className="font-medium">
                            {page.lead_forms?.filter(f => f.subscribed).length || 0}
                          </span>
                          <span className="text-slate-500">subscribed</span>
                        </div>
                        {page.last_sync_date && (
                          <div className="text-xs text-slate-500">
                            Last sync: {formatDistanceToNow(new Date(page.last_sync_date), { addSuffix: true })}
                          </div>
                        )}
                      </div>

                      {/* Forms List */}
                      {page.lead_forms && page.lead_forms.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="text-xs font-medium text-slate-700">Lead Forms:</div>
                          {page.lead_forms.map((form, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-xs p-2 bg-slate-50 rounded"
                            >
                              <span className="font-medium text-slate-700 truncate flex-1">
                                {form.form_name}
                              </span>
                              {form.subscribed ? (
                                <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                                  <CheckCircle2 className="w-3 h-3 mr-0.5" />
                                  Webhook Active
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                                  <AlertCircle className="w-3 h-3 mr-0.5" />
                                  Not Subscribed
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Info Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2 text-sm">✨ How It Works</h4>
              <ul className="text-xs text-blue-800 space-y-1">
                <li>• All lead forms on your pages are automatically detected</li>
                <li>• Each form is subscribed to your webhook</li>
                <li>• New forms are auto-discovered and connected (sync every 6-12 hours)</li>
                <li>• Leads appear instantly in your Lead Management dashboard</li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diagnostic Results Dialog */}
      <Dialog open={showDiagnostic} onOpenChange={setShowDiagnostic}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Facebook Token Diagnostic Results</DialogTitle>
            <DialogDescription>
              Detailed test results for your Facebook token
            </DialogDescription>
          </DialogHeader>

          {diagnosticResults && (
            <div className="space-y-4">
              {/* Error from connectFacebookPage */}
              {diagnosticResults.success === false && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-semibold text-red-900 mb-2 flex items-center gap-2">
                    <XCircle className="w-5 h-5" />
                    {diagnosticResults.message}
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <strong className="text-red-800">Error:</strong>
                      <p className="text-red-700 mt-1">{diagnosticResults.results.error}</p>
                    </div>
                    {diagnosticResults.results.hint && (
                      <div>
                        <strong className="text-red-800">Hint:</strong>
                        <p className="text-red-700 mt-1">{diagnosticResults.results.hint}</p>
                      </div>
                    )}
                    {diagnosticResults.results.details && (
                      <div>
                        <strong className="text-red-800">Details:</strong>
                        <p className="text-red-700 mt-1">{diagnosticResults.results.details}</p>
                      </div>
                    )}
                    {diagnosticResults.results.fullResponse && (
                      <div className="mt-3">
                        <strong className="text-red-800">Full Response:</strong>
                        <pre className="mt-1 bg-red-100 p-2 rounded text-xs overflow-auto">
                          {JSON.stringify(diagnosticResults.results.fullResponse, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Diagnostic test results */}
              {diagnosticResults.results?.tokenLength && (
                <div className="bg-slate-50 rounded p-3">
                  <div className="text-sm font-medium text-slate-700">Token Length: {diagnosticResults.results.tokenLength} characters</div>
                </div>
              )}

              {diagnosticResults.results?.tests?.map((test, idx) => (
                <Card key={idx} className={test.success ? "border-green-200" : "border-red-200"}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      {test.success ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600" />
                      )}
                      {test.test}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {test.status && (
                      <div className="text-xs text-slate-500 mb-2">HTTP Status: {test.status}</div>
                    )}
                    {test.error && (
                      <div className="bg-red-50 text-red-700 p-2 rounded text-xs mb-2">
                        <strong>Error:</strong> {test.error}
                      </div>
                    )}
                    {test.response && (
                      <div className="bg-slate-100 p-3 rounded">
                        <div className="text-xs font-mono text-slate-800 whitespace-pre-wrap overflow-x-auto">
                          {JSON.stringify(test.response, null, 2)}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )) || null}

              {diagnosticResults.results?.tests && (
                <div className="bg-blue-50 border border-blue-200 rounded p-4 text-sm">
                  <strong className="text-blue-900">What to look for:</strong>
                  <ul className="list-disc list-inside text-blue-800 mt-2 space-y-1">
                    <li>If you see "Invalid OAuth access token" - Your token is expired or invalid</li>
                    <li>If you see "OAuthException" - Missing required permissions</li>
                    <li>If all tests pass - Your token is valid and the issue is elsewhere</li>
                  </ul>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}