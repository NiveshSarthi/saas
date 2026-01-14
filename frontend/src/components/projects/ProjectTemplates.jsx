import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import {
  FolderOpen,
  Code,
  Home,
  Briefcase,
  Rocket,
  Bug,
  Loader2,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const projectTemplates = [
  {
    id: 'blank',
    name: 'Blank Project',
    description: 'Start from scratch with a clean slate',
    icon: FolderOpen,
    color: '#6366F1',
    workflow: ['backlog', 'todo', 'in_progress', 'review', 'done'],
    domain: 'generic'
  },
  {
    id: 'software',
    name: 'Software Development',
    description: 'Agile workflow with sprints and code reviews',
    icon: Code,
    color: '#3B82F6',
    workflow: ['backlog', 'todo', 'in_progress', 'code_review', 'testing', 'done'],
    domain: 'it',
    defaultTasks: [
      { title: 'Setup development environment', task_type: 'task', priority: 'high' },
      { title: 'Create project documentation', task_type: 'task', priority: 'medium' },
      { title: 'Define API endpoints', task_type: 'story', priority: 'high' },
    ]
  },
  {
    id: 'marketing',
    name: 'Marketing Campaign',
    description: 'Plan and execute marketing initiatives',
    icon: Rocket,
    color: '#EC4899',
    workflow: ['ideas', 'planning', 'in_progress', 'review', 'published'],
    domain: 'generic',
    defaultTasks: [
      { title: 'Define target audience', task_type: 'task', priority: 'high' },
      { title: 'Create content calendar', task_type: 'task', priority: 'high' },
      { title: 'Design campaign assets', task_type: 'task', priority: 'medium' },
    ]
  },
  {
    id: 'realestate',
    name: 'Real Estate Project',
    description: 'Property development and sales tracking',
    icon: Home,
    color: '#10B981',
    workflow: ['prospecting', 'negotiation', 'documentation', 'closing', 'completed'],
    domain: 'real_estate',
    defaultTasks: [
      { title: 'Property assessment', task_type: 'task', priority: 'high' },
      { title: 'Legal documentation review', task_type: 'task', priority: 'high' },
      { title: 'Client meeting', task_type: 'task', priority: 'medium' },
    ]
  },
  {
    id: 'bugtracker',
    name: 'Bug Tracker',
    description: 'Track and resolve software issues',
    icon: Bug,
    color: '#EF4444',
    workflow: ['reported', 'confirmed', 'in_progress', 'testing', 'resolved'],
    domain: 'it',
    defaultTasks: [
      { title: 'Setup issue tracking workflow', task_type: 'task', priority: 'high' },
      { title: 'Define severity levels', task_type: 'task', priority: 'medium' },
    ]
  },
];

export default function ProjectTemplates({ open, onOpenChange }) {
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [projectName, setProjectName] = useState('');
  const [step, setStep] = useState('select'); // 'select' or 'configure'

  const createMutation = useMutation({
    mutationFn: async () => {
      const template = projectTemplates.find(t => t.id === selectedTemplate);
      
      // Create project
      const project = await base44.entities.Project.create({
        name: projectName,
        domain: template.domain,
        color: template.color,
        workflow_states: template.workflow,
        status: 'active',
      });

      // Create default tasks if any
      if (template.defaultTasks) {
        for (const task of template.defaultTasks) {
          await base44.entities.Task.create({
            ...task,
            project_id: project.id,
            status: template.workflow[0],
          });
        }
      }

      return project;
    },
    onSuccess: (project) => {
      window.location.href = createPageUrl(`ProjectBoard?id=${project.id}`);
    },
  });

  const handleTemplateSelect = (templateId) => {
    setSelectedTemplate(templateId);
    const template = projectTemplates.find(t => t.id === templateId);
    setProjectName(`New ${template.name}`);
    setStep('configure');
  };

  const handleBack = () => {
    setStep('select');
    setSelectedTemplate(null);
  };

  const handleCreate = () => {
    if (projectName.trim()) {
      createMutation.mutate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {step === 'select' ? 'Choose a Template' : 'Configure Project'}
          </DialogTitle>
          <DialogDescription>
            {step === 'select' 
              ? 'Select a template to get started quickly'
              : 'Customize your project settings'}
          </DialogDescription>
        </DialogHeader>

        {step === 'select' ? (
          <div className="grid grid-cols-2 gap-4 py-4">
            {projectTemplates.map((template) => {
              const Icon = template.icon;
              return (
                <button
                  key={template.id}
                  onClick={() => handleTemplateSelect(template.id)}
                  className="p-4 rounded-xl border-2 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all text-left group"
                >
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                    style={{ backgroundColor: `${template.color}20` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: template.color }} />
                  </div>
                  <h3 className="font-semibold text-slate-900 group-hover:text-indigo-600">
                    {template.name}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">{template.description}</p>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="py-4 space-y-4">
            {selectedTemplate && (
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                {(() => {
                  const template = projectTemplates.find(t => t.id === selectedTemplate);
                  const Icon = template.icon;
                  return (
                    <>
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${template.color}20` }}
                      >
                        <Icon className="w-5 h-5" style={{ color: template.color }} />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{template.name}</p>
                        <p className="text-xs text-slate-500">{template.workflow.join(' → ')}</p>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            <div>
              <Label>Project Name</Label>
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Enter project name"
                className="mt-1"
              />
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending || !projectName.trim()}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    Create Project
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}