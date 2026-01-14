import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Download, FileText, Mail, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ExportDialog({ leads, activities, fbPages, users, dateRange }) {
  const [format, setFormat] = useState('pdf');
  const [sections, setSections] = useState({
    overview: true,
    leadAnalytics: true,
    campaignAnalytics: true,
    teamAnalytics: true,
    recommendations: true
  });
  const [includeAI, setIncludeAI] = useState(true);
  const [loading, setLoading] = useState(false);
  const [emailReport, setEmailReport] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      // Generate AI summary
      let aiSummary = '';
      if (includeAI) {
        const totalLeads = leads.length;
        const converted = leads.filter(l => l.status === 'closed_won').length;
        const conversionRate = ((converted / totalLeads) * 100).toFixed(1);

        const prompt = `Generate a comprehensive executive summary for a CRM analytics report covering ${new Date(dateRange.start).toLocaleDateString()} to ${new Date(dateRange.end).toLocaleDateString()}.

Data:
- Total Leads: ${totalLeads}
- Conversions: ${converted} (${conversionRate}%)
- Active Team Members: ${users.length}
- Sales Activities: ${activities.length}
- Facebook Pages: ${fbPages.length}

Provide a 2-paragraph executive summary covering:
1. Overall performance highlights
2. Key insights and recommendations

Professional tone, specific numbers, actionable.`;

        aiSummary = await base44.integrations.Core.InvokeLLM({
          prompt,
          add_context_from_internet: false
        });
      }

      // Prepare export data
      const exportData = {
        metadata: {
          title: 'Analytics Report',
          period: `${new Date(dateRange.start).toLocaleDateString()} - ${new Date(dateRange.end).toLocaleDateString()}`,
          generatedAt: new Date().toLocaleString(),
          aiSummary
        },
        sections: {}
      };

      if (sections.overview) {
        exportData.sections.overview = {
          totalLeads: leads.length,
          conversions: leads.filter(l => l.status === 'closed_won').length,
          conversionRate: ((leads.filter(l => l.status === 'closed_won').length / leads.length) * 100).toFixed(1),
          activities: activities.length
        };
      }

      if (sections.leadAnalytics) {
        const sourceData = {};
        leads.forEach(l => {
          if (!sourceData[l.lead_source]) {
            sourceData[l.lead_source] = { total: 0, converted: 0 };
          }
          sourceData[l.lead_source].total++;
          if (l.status === 'closed_won') sourceData[l.lead_source].converted++;
        });
        exportData.sections.leadAnalytics = sourceData;
      }

      if (sections.teamAnalytics) {
        const teamData = users.map(u => {
          const userLeads = leads.filter(l => l.assigned_to === u.email);
          const converted = userLeads.filter(l => l.status === 'closed_won').length;
          return {
            name: u.full_name || u.email,
            leads: userLeads.length,
            converted,
            rate: userLeads.length > 0 ? ((converted / userLeads.length) * 100).toFixed(1) : 0
          };
        }).filter(u => u.leads > 0);
        exportData.sections.teamAnalytics = teamData;
      }

      // Export based on format
      if (format === 'excel') {
        exportToExcel(exportData);
      } else {
        exportToPDF(exportData);
      }

      // Send email if requested
      if (emailReport) {
        const user = await base44.auth.me();
        await base44.integrations.Core.SendEmail({
          to: user.email,
          subject: `Analytics Report - ${exportData.metadata.period}`,
          body: `Your analytics report has been generated.\n\n${aiSummary}\n\nPlease find the detailed report attached.`
        });
        toast.success('Report sent to your email');
      } else {
        toast.success('Report exported successfully');
      }
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export report');
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = (data) => {
    // Create CSV format
    let csv = `Analytics Report\n`;
    csv += `Period: ${data.metadata.period}\n`;
    csv += `Generated: ${data.metadata.generatedAt}\n\n`;
    
    if (data.metadata.aiSummary) {
      csv += `Executive Summary:\n${data.metadata.aiSummary}\n\n`;
    }

    if (data.sections.overview) {
      csv += `Overview\n`;
      csv += `Total Leads,Conversions,Conversion Rate,Activities\n`;
      csv += `${data.sections.overview.totalLeads},${data.sections.overview.conversions},${data.sections.overview.conversionRate}%,${data.sections.overview.activities}\n\n`;
    }

    if (data.sections.leadAnalytics) {
      csv += `Lead Analytics\n`;
      csv += `Source,Total Leads,Conversions,Conversion Rate\n`;
      Object.entries(data.sections.leadAnalytics).forEach(([source, data]) => {
        const rate = ((data.converted / data.total) * 100).toFixed(1);
        csv += `${source},${data.total},${data.converted},${rate}%\n`;
      });
      csv += `\n`;
    }

    if (data.sections.teamAnalytics) {
      csv += `Team Analytics\n`;
      csv += `Team Member,Leads,Conversions,Conversion Rate\n`;
      data.sections.teamAnalytics.forEach(member => {
        csv += `${member.name},${member.leads},${member.converted},${member.rate}%\n`;
      });
    }

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportToPDF = (data) => {
    // For now, export as formatted text
    let text = `ANALYTICS REPORT\n\n`;
    text += `Period: ${data.metadata.period}\n`;
    text += `Generated: ${data.metadata.generatedAt}\n\n`;
    
    if (data.metadata.aiSummary) {
      text += `EXECUTIVE SUMMARY\n${data.metadata.aiSummary}\n\n`;
    }

    if (data.sections.overview) {
      text += `OVERVIEW\n`;
      text += `Total Leads: ${data.sections.overview.totalLeads}\n`;
      text += `Conversions: ${data.sections.overview.conversions}\n`;
      text += `Conversion Rate: ${data.sections.overview.conversionRate}%\n`;
      text += `Activities: ${data.sections.overview.activities}\n\n`;
    }

    // Download as text file
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-report-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="w-4 h-4" />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export Analytics Report</DialogTitle>
          <DialogDescription>
            Customize and download your analytics report
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Format</Label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="excel">Excel / CSV</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>Include Sections</Label>
            {Object.entries(sections).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2">
                <Checkbox
                  checked={value}
                  onCheckedChange={(checked) => setSections({ ...sections, [key]: checked })}
                />
                <span className="text-sm capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Checkbox checked={includeAI} onCheckedChange={setIncludeAI} />
            <span className="text-sm">Include AI-generated insights</span>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox checked={emailReport} onCheckedChange={setEmailReport} />
            <span className="text-sm">Email report to me</span>
          </div>

          <Button
            onClick={handleExport}
            disabled={loading}
            className="w-full gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                Generate Report
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}