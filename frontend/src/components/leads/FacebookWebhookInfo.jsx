import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Facebook, Copy, Check, Webhook, Info, TestTube } from 'lucide-react';
import { toast } from 'sonner';

export default function FacebookWebhookInfo() {
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);

  const productionUrl = 'https://tracker.niveshsarthi.com/api/functions/v1/metaWebhook';
  const isPreview = window.location.hostname.includes('preview-sandbox');
  const webhookUrl = isPreview ? productionUrl : `${window.location.origin}/api/functions/v1/metaWebhook`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success('Webhook URL copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const testWebhook = async () => {
    setTesting(true);
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          full_name: 'Test Lead',
          phone_number: '9999999999',
          campaign_id: 'test_campaign',
          ad_id: 'test_ad',
          secret: 'base44_meta_verify_token'
        })
      });

      if (response.ok) {
        toast.success('Test successful! Check your leads list for the test lead.');
      } else {
        toast.error('Test failed. Check console for details.');
      }
    } catch (error) {
      toast.error('Test failed: ' + error.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Facebook className="w-4 h-4 text-blue-600" />
          <span>FB Ads Setup</span>
          <Badge variant="secondary" className="text-xs">Active</Badge>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Facebook className="w-5 h-5 text-blue-600" />
            Facebook Ads Lead Integration
          </DialogTitle>
          <DialogDescription>
            Automatically capture leads from your Facebook & Instagram ads
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Status */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Check className="w-5 h-5 text-green-600" />
              <span className="font-semibold text-green-900">Integration Active</span>
            </div>
            <p className="text-sm text-green-700">
              Your webhook is configured and ready to receive leads from Facebook Lead Ads
            </p>
          </div>

          {/* Preview Warning */}
          {isPreview && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-blue-800">
                    You're viewing this in preview mode. The URL below is your production webhook URL.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Webhook URL */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Webhook className="w-4 h-4" />
              Production Webhook URL
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={webhookUrl}
                readOnly
                className="flex-1 px-3 py-2 bg-slate-50 border rounded-lg text-sm font-mono"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={copyToClipboard}
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={testWebhook}
                disabled={testing}
              >
                {testing ? (
                  <>Testing...</>
                ) : (
                  <>
                    <TestTube className="w-4 h-4 mr-1" />
                    Test
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-2">
              <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-2">
                <h4 className="font-semibold text-blue-900">Setup Instructions</h4>
                <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
                  <li>Go to your Facebook Page Settings → Lead Ads Forms</li>
                  <li>Select the form you want to integrate</li>
                  <li>Click on "Manage Leads" → "Download or Integrate"</li>
                  <li>Choose "CRM Integration" → "Webhook"</li>
                  <li>Paste the webhook URL above</li>
                  <li>Verify token is: <code className="bg-blue-100 px-1 py-0.5 rounded">base44_meta_verify_token</code></li>
                  <li>Test the connection and save</li>
                </ol>
              </div>
            </div>
          </div>

          {/* What Happens */}
          <div className="space-y-2">
            <h4 className="font-semibold text-slate-900">What Happens Next?</h4>
            <ul className="text-sm text-slate-600 space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">✓</span>
                <span>Leads from Facebook & Instagram ads automatically appear here</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">✓</span>
                <span>Duplicate leads are automatically filtered by phone number</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">✓</span>
                <span>Lead source is tagged as "Facebook" or "Instagram"</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">✓</span>
                <span>Campaign and Ad details are saved in lead notes</span>
              </li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}