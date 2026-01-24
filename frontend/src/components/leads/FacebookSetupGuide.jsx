import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen,
  Facebook,
  CheckCircle2,
  ArrowRight,
  Zap,
  RefreshCw,
  Bell,
  Link as LinkIcon
} from 'lucide-react';

export default function FacebookSetupGuide() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <BookOpen className="w-4 h-4 mr-2" />
          Setup Guide
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Facebook className="w-6 h-6 text-blue-600" />
            Facebook Lead Capture - Complete Guide
          </DialogTitle>
          <DialogDescription>
            Automatically capture leads from all Facebook & Instagram Lead Ads
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Overview */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">🎯 What This Does</h3>
            <p className="text-sm text-blue-800">
              Connects ALL lead forms from your Facebook Pages automatically. Any lead submitted through Facebook/Instagram ads
              instantly appears in your Lead Management system - no manual webhook setup per form required.
            </p>
          </div>

          {/* Architecture Explanation */}
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              How Facebook Leads Work
            </h3>
            <div className="bg-slate-50 border rounded-lg p-4 space-y-3">
              <div className="text-sm space-y-2">
                <div className="font-medium text-slate-700">Facebook Structure:</div>
                <div className="pl-4 border-l-2 border-slate-300 space-y-1 text-slate-600">
                  <div>📄 Facebook Page</div>
                  <div className="pl-4">├── Lead Form A</div>
                  <div className="pl-4">├── Lead Form B</div>
                  <div className="pl-4">└── Lead Form C</div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm">
                <div className="font-semibold text-amber-900 mb-1">❌ Common Misconception</div>
                <div className="text-amber-800">
                  Facebook does NOT send leads at the page level. Each lead form must be individually subscribed to your webhook.
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded p-3 text-sm">
                <div className="font-semibold text-green-900 mb-1">✅ Our Solution</div>
                <div className="text-green-800">
                  We automatically detect ALL forms on your page and subscribe them to the webhook. New forms are auto-discovered and connected.
                </div>
              </div>
            </div>
          </div>

          {/* Step by Step Setup */}
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Setup Instructions (One-Time)
            </h3>

            <div className="space-y-3">
              {/* Step 1 */}
              <div className="flex gap-3 p-4 bg-white border rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold">
                  1
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-slate-900 mb-1">Authorize Facebook</div>
                  <div className="text-sm text-slate-600 mb-2">
                    Click "Connect Facebook" in the dashboard settings or when prompted. This grants permission to:
                  </div>
                  <ul className="text-xs text-slate-600 space-y-1 pl-4">
                    <li>• Read your Facebook Pages</li>
                    <li>• Access Lead Forms</li>
                    <li>• Subscribe forms to webhooks</li>
                  </ul>
                  <Badge className="mt-2 text-xs">Required Permissions</Badge>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-3 p-4 bg-white border rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold">
                  2
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-slate-900 mb-1">Connect Your Pages</div>
                  <div className="text-sm text-slate-600 mb-2">
                    Go to Lead Management → Click "FB Pages" button → Click "Connect Facebook"
                  </div>
                  <div className="bg-slate-50 border rounded p-2 text-xs font-mono text-slate-700">
                    System will: Fetch all pages → Detect all lead forms → Auto-subscribe webhooks
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-3 p-4 bg-white border rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 bg-green-100 text-green-700 rounded-full flex items-center justify-center font-bold">
                  3
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-slate-900 mb-1">Done! 🎉</div>
                  <div className="text-sm text-slate-600">
                    All current and future lead forms are now connected. Leads will automatically appear in Lead Management.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Automatic Sync */}
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-purple-600" />
              Automatic Form Discovery
            </h3>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="text-sm text-purple-900 space-y-2">
                <div className="font-medium">What happens when you create a new lead form?</div>
                <div className="space-y-1 text-purple-800">
                  <div>✅ System syncs every 6-12 hours automatically</div>
                  <div>✅ New forms are detected and subscribed</div>
                  <div>✅ You get a notification when new forms are found</div>
                  <div>✅ Manual sync available anytime via "Sync Forms" button</div>
                </div>
              </div>
            </div>
          </div>

          {/* Lead Flow */}
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <ArrowRight className="w-5 h-5 text-indigo-600" />
              Lead Capture Flow
            </h3>
            <div className="bg-white border rounded-lg p-4">
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-xs">1</div>
                  <div className="text-slate-700">Customer submits Facebook/Instagram Lead Ad</div>
                </div>
                <div className="pl-5 border-l-2 border-slate-200 ml-4">
                  <ArrowRight className="w-4 h-4 text-slate-400 my-2" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold text-xs">2</div>
                  <div className="text-slate-700">Facebook sends webhook to your system</div>
                </div>
                <div className="pl-5 border-l-2 border-slate-200 ml-4">
                  <ArrowRight className="w-4 h-4 text-slate-400 my-2" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-700 font-bold text-xs">3</div>
                  <div className="text-slate-700">System checks for duplicates (phone/email)</div>
                </div>
                <div className="pl-5 border-l-2 border-slate-200 ml-4">
                  <ArrowRight className="w-4 h-4 text-slate-400 my-2" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-amber-700 font-bold text-xs">4</div>
                  <div className="text-slate-700">Lead created with source, campaign data & activity log</div>
                </div>
                <div className="pl-5 border-l-2 border-slate-200 ml-4">
                  <ArrowRight className="w-4 h-4 text-slate-400 my-2" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-xs">5</div>
                  <div className="text-slate-700">Lead appears in Lead Management (real-time)</div>
                </div>
              </div>
            </div>
          </div>

          {/* What Gets Captured */}
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Bell className="w-5 h-5 text-green-600" />
              What Information Is Captured
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 border rounded p-3 text-sm">
                <div className="font-semibold text-slate-900 mb-2">📋 Lead Data</div>
                <ul className="space-y-1 text-slate-600">
                  <li>✓ Full Name</li>
                  <li>✓ Phone Number</li>
                  <li>✓ Email Address</li>
                  <li>✓ Custom Form Fields</li>
                </ul>
              </div>
              <div className="bg-slate-50 border rounded p-3 text-sm">
                <div className="font-semibold text-slate-900 mb-2">📊 Campaign Data</div>
                <ul className="space-y-1 text-slate-600">
                  <li>✓ Campaign ID</li>
                  <li>✓ Ad Set ID</li>
                  <li>✓ Ad ID</li>
                  <li>✓ Lead Form Name</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Important Notes */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h4 className="font-semibold text-amber-900 mb-2 text-sm">⚠️ Important Notes</h4>
            <ul className="text-xs text-amber-800 space-y-1">
              <li>• Duplicate leads (same phone/email) are automatically skipped</li>
              <li>• Lead source is auto-detected (Facebook vs Instagram)</li>
              <li>• Webhook URL must remain stable (already configured)</li>
              <li>• Manual form setup via Facebook Business Manager is NOT needed</li>
            </ul>
          </div>

          {/* Webhook Info */}
          <div className="bg-slate-50 border rounded-lg p-4">
            <div className="flex items-start gap-2 mb-2">
              <LinkIcon className="w-4 h-4 text-slate-600 mt-0.5" />
              <div className="flex-1">
                <div className="font-semibold text-slate-900 text-sm mb-1">Webhook Endpoint</div>
                <ul className="text-xs text-slate-600 space-y-1">
                  <li><strong>Callback URL:</strong> <code className="bg-amber-100 px-1 py-0.5 rounded text-[10px]">{import.meta.env.VITE_BACKEND_URL || window.location.origin}/functions/v1/metaWebhook</code></li>
                  <li><strong>Verify Token:</strong> <code className="bg-amber-100 px-1 py-0.5 rounded text-[10px]">base44_meta_verify_token</code></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}