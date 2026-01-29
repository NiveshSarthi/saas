import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Users,
  Upload,
  FileText,
  Calendar,
  MessageSquare,
  Eye,
  CheckCircle,
  XCircle,
  AlertCircle,
  Plus,
  Search,
  Filter,
  UserPlus,
  Clock,
  Edit,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

export default function Recruitment() {
  const [user, setUser] = useState(null);
  const [candidateDialogOpen, setCandidateDialogOpen] = useState(false);
  const [interviewDialogOpen, setInterviewDialogOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [selectedInterview, setSelectedInterview] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [uploading, setUploading] = useState(false);
  const [parsingResume, setParsingResume] = useState(false);
  const queryClient = useQueryClient();

  const [candidateForm, setCandidateForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    current_position: '',
    current_company: '',
    experience_years: '',
    skills: '',
    education: '',
    expected_salary: '',
    current_salary: '',
    location: '',
    source: 'job_portal',
    priority: 'medium',
    tags: '',
    resume: null
  });

  const [interviewForm, setInterviewForm] = useState({
    candidate_id: '',
    interviewer_email: '',
    interview_type: 'technical',
    round: 1,
    scheduled_date: '',
    duration_minutes: 60,
    notes: '',
    meeting_link: ''
  });

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (e) {
        console.log('User not logged in');
      }
    };
    fetchUser();
  }, []);

  // Check for Access
  const hasAccess = user && (
    user.role_id === 'hr' ||
    user.role === 'admin' ||
    user.role_id === 'admin' ||
    user.role_id === 'super_admin' ||
    (user.department_id && user.department_name && (user.department_name.toLowerCase().includes('administration') || user.department_name.toLowerCase() === 'admin'))
  );

  // Get all candidates
  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ['candidates'],
    queryFn: () => base44.entities.Candidate.list('-created_at'),
    enabled: !!hasAccess,
  });

  // Get all interviews
  const { data: interviews = [] } = useQuery({
    queryKey: ['interviews'],
    queryFn: () => base44.entities.Interview.list('-scheduled_date'),
    enabled: !!hasAccess,
  });

  // Get all users for interviewer selection
  const { data: users = [] } = useQuery({
    queryKey: ['users-for-interviews'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!hasAccess,
  });

  // Create candidate mutation
  const createCandidateMutation = useMutation({
    mutationFn: async (candidateData) => {
      // Handle file upload if resume is provided
      let resumeUrl = null;
      if (candidateData.resume) {
        try {
          const formData = new FormData();
          formData.append('resume', candidateData.resume);
          const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

          const uploadRes = await fetch(`${API_BASE}/functions/v1/invoke/uploadResume`, {
            method: 'POST',
            body: formData
          });

          const uploadData = await uploadRes.json();
          if (uploadData.success && uploadData.url) {
            // Ensure URL is absolute for viewing
            resumeUrl = `${API_BASE}${uploadData.url}`;
          } else {
            console.error('Upload failed:', uploadData);
          }
        } catch (uploadErr) {
          console.error('Resume upload error:', uploadErr);
          toast.error('Failed to upload resume file');
        }
      }

      const data = {
        ...candidateData,
        skills: candidateData.skills.split(',').map(s => s.trim()).filter(s => s),
        education: candidateData.education.split('\n').filter(e => e.trim()),
        tags: candidateData.tags.split(',').map(t => t.trim()).filter(t => t),
        resume_url: resumeUrl,
        created_by: user.email,
        assigned_to: user.email
      };

      delete data.resume; // Remove file object
      return await base44.entities.Candidate.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      setCandidateDialogOpen(false);
      setCandidateForm({
        full_name: '',
        email: '',
        phone: '',
        current_position: '',
        current_company: '',
        experience_years: '',
        skills: '',
        education: '',
        expected_salary: '',
        current_salary: '',
        location: '',
        source: 'job_portal',
        priority: 'medium',
        tags: '',
        resume: null
      });
      toast.success('Candidate added successfully');
    },
    onError: (error) => {
      toast.error('Failed to add candidate: ' + error.message);
    },
  });

  // Update candidate details mutation
  const updateCandidateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      return await base44.entities.Candidate.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      setCandidateDialogOpen(false);
      setCandidateForm({
        full_name: '',
        email: '',
        phone: '',
        current_position: '',
        current_company: '',
        experience_years: '',
        skills: '',
        education: '',
        expected_salary: '',
        current_salary: '',
        location: '',
        source: 'job_portal',
        priority: 'medium',
        tags: '',
        resume: null
      });
      setEditingCandidateId(null);
      toast.success('Candidate updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update candidate: ' + error.message);
    },
  });

  const [editingCandidateId, setEditingCandidateId] = useState(null);

  const handleEditCandidate = (candidate) => {
    setCandidateForm({
      full_name: candidate.full_name || '',
      email: candidate.email || '',
      phone: candidate.phone || '',
      current_position: candidate.current_position || '',
      current_company: candidate.current_company || '',
      experience_years: candidate.experience_years || '',
      skills: candidate.skills ? candidate.skills.join(', ') : '',
      education: candidate.education ? candidate.education.join('\n') : '',
      expected_salary: candidate.expected_salary || '',
      current_salary: candidate.current_salary || '',
      location: candidate.location || '',
      source: candidate.source || 'job_portal',
      priority: candidate.priority || 'medium',
      tags: candidate.tags ? candidate.tags.join(', ') : '',
      resume: null // keep null for now, or handle existing file display
    });
    setEditingCandidateId(candidate.id);
    setCandidateDialogOpen(true);
  };

  // Create interview mutation
  const createInterviewMutation = useMutation({
    mutationFn: async (interviewData) => {
      const candidate = candidates.find(c => c.id === interviewData.candidate_id);
      const interviewer = users.find(u => u.email === interviewData.interviewer_email);

      const data = {
        ...interviewData,
        candidate_name: candidate?.full_name,
        candidate_email: candidate?.email,
        interviewer_name: interviewer?.full_name,
        created_by: user.email
      };

      return await base44.entities.Interview.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
      setInterviewDialogOpen(false);
      setInterviewForm({
        candidate_id: '',
        interviewer_email: '',
        interview_type: 'technical',
        round: 1,
        scheduled_date: '',
        duration_minutes: 60,
        notes: '',
        meeting_link: ''
      });
      toast.success('Interview scheduled successfully');
    },
    onError: (error) => {
      toast.error('Failed to schedule interview: ' + error.message);
    },
  });

  // Update candidate status mutation
  const updateCandidateStatusMutation = useMutation({
    mutationFn: async ({ candidateId, status }) => {
      // Create activity log
      await base44.entities.CandidateActivity.create({
        candidate_id: candidateId,
        activity_type: 'status_changed',
        description: `Candidate status changed to ${status}`,
        performed_by: user.email,
        metadata: { old_status: selectedCandidate?.status, new_status: status }
      });

      return await base44.entities.Candidate.update(candidateId, {
        status: status,
        updated_at: new Date()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      toast.success('Candidate status updated');
      setSelectedCandidate(null);
    },
  });

  const filteredCandidates = candidates.filter(candidate => {
    const matchesSearch = !searchTerm ||
      candidate.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      candidate.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      candidate.skills?.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || candidate.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status) => {
    const statusConfig = {
      new: { label: 'New', color: 'bg-blue-100 text-blue-700' },
      screening: { label: 'Screening', color: 'bg-yellow-100 text-yellow-700' },
      interviewed: { label: 'Interviewed', color: 'bg-purple-100 text-purple-700' },
      offered: { label: 'Offered', color: 'bg-green-100 text-green-700' },
      hired: { label: 'Hired', color: 'bg-emerald-100 text-emerald-700' },
      rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
    };
    const config = statusConfig[status] || statusConfig.new;
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const getPriorityBadge = (priority) => {
    const priorityConfig = {
      high: { label: 'High', color: 'bg-red-100 text-red-700' },
      medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-700' },
      low: { label: 'Low', color: 'bg-green-100 text-green-700' },
    };
    const config = priorityConfig[priority] || priorityConfig.medium;
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const handleFileUpload = async (event) => {
    try {
      const file = event.target.files[0];
      if (file) {
        setCandidateForm(prev => ({ ...prev, resume: file }));
        setParsingResume(true);
        const toastId = toast.loading('Parsing resume...');

        try {
          const formData = new FormData();
          formData.append('resume', file);

          const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
          const response = await fetch(`${API_BASE}/functions/v1/invoke/parseResume`, {
            method: 'POST',
            body: formData
          });

          const result = await response.json();

          if (result.success && result.data) {
            const data = result.data;
            setCandidateForm(prev => ({
              ...prev,
              full_name: data.full_name || prev.full_name,
              email: data.email || prev.email,
              phone: data.phone || prev.phone,
              current_position: data.current_position || prev.current_position,
              current_company: data.current_company || prev.current_company,
              experience_years: data.experience_years || prev.experience_years,
              skills: data.skills || prev.skills,
              education: data.education || prev.education,
              location: data.location || prev.location,
              expected_salary: data.expected_salary || prev.expected_salary,
              current_salary: data.current_salary || prev.current_salary
            }));
            toast.success('Information extracted from resume!', { id: toastId });
          } else {
            toast.error(result.error || 'Failed to parse resume', { id: toastId });
          }
        } catch (error) {
          console.error('Resume Parse Error:', error);
          toast.error('Error parsing resume', { id: toastId });
        } finally {
          setParsingResume(false);
        }
      }
    } catch (e) {
      console.error('File upload error:', e);
    }
  };

  if (!user) {
    return (
      <div className="p-6 lg:p-8 text-center">
        <h2 className="text-xl font-semibold text-slate-900">Access Denied</h2>
        <p className="text-slate-500 mt-2">Please log in to access recruitment.</p>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="p-6 lg:p-8 text-center">
        <h2 className="text-xl font-semibold text-slate-900">Access Restricted</h2>
        <p className="text-slate-500 mt-2">Only HR managers and administrators can access recruitment.</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Recruitment Management</h1>
            <p className="text-slate-600 mt-1">Manage candidates, interviews, and hiring pipeline</p>
          </div>
          <div className="flex items-center gap-4">
            <Button onClick={() => setCandidateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Candidate
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Candidates</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{candidates.length}</div>
            <p className="text-xs text-muted-foreground">In pipeline</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Interviews</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {interviews.filter(i => i.status === 'scheduled').length}
            </div>
            <p className="text-xs text-muted-foreground">Scheduled</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Offers Extended</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {candidates.filter(c => c.status === 'offered').length}
            </div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hired</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {candidates.filter(c => c.status === 'hired').length}
            </div>
            <p className="text-xs text-muted-foreground">Successfully placed</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="candidates" className="space-y-6">
        <TabsList>
          <TabsTrigger value="candidates">Candidates</TabsTrigger>
          <TabsTrigger value="interviews">Interviews</TabsTrigger>
        </TabsList>

        {/* Candidates Tab */}
        <TabsContent value="candidates" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-64">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Search candidates..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="screening">Screening</SelectItem>
                    <SelectItem value="interviewed">Interviewed</SelectItem>
                    <SelectItem value="offered">Offered</SelectItem>
                    <SelectItem value="hired">Hired</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Candidates Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Candidates ({filteredCandidates.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-slate-500 mt-4">Loading candidates...</p>
                </div>
              ) : filteredCandidates.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Experience</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCandidates.map((candidate) => (
                      <TableRow key={candidate.id}>
                        <TableCell className="font-medium">
                          <div>
                            <div className="font-semibold">{candidate.full_name}</div>
                            <div className="text-sm text-slate-500">{candidate.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{candidate.current_position}</div>
                            <div className="text-sm text-slate-500">{candidate.current_company}</div>
                          </div>
                        </TableCell>
                        <TableCell>{candidate.experience_years} years</TableCell>
                        <TableCell>{getPriorityBadge(candidate.priority)}</TableCell>
                        <TableCell>{getStatusBadge(candidate.status)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{candidate.source}</Badge>
                        </TableCell>
                        <TableCell>
                          {candidate.created_at ? format(parseISO(candidate.created_at), 'MMM d, yyyy') : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedCandidate(candidate)}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditCandidate(candidate)}
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setInterviewForm(prev => ({ ...prev, candidate_id: candidate.id }));
                                setInterviewDialogOpen(true);
                              }}
                            >
                              <Calendar className="w-4 h-4 mr-1" />
                              Interview
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">No candidates found</h3>
                  <p className="text-slate-500">Add your first candidate to get started</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Interviews Tab */}
        <TabsContent value="interviews" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Scheduled Interviews</CardTitle>
              <p className="text-sm text-muted-foreground">Manage interview schedules and feedback</p>
            </CardHeader>
            <CardContent>
              {interviews.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Candidate</TableHead>
                      <TableHead>Interview</TableHead>
                      <TableHead>Interviewer</TableHead>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {interviews.map((interview) => (
                      <TableRow key={interview.id}>
                        <TableCell className="font-medium">
                          <div>
                            <div className="font-semibold">{interview.candidate_name}</div>
                            <div className="text-sm text-slate-500">{interview.candidate_email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">Round {interview.round}</div>
                            <div className="text-sm text-slate-500">{interview.interview_type}</div>
                          </div>
                        </TableCell>
                        <TableCell>{interview.interviewer_name}</TableCell>
                        <TableCell>
                          {interview.scheduled_date ? (
                            <div>
                              <div className="font-medium">
                                {format(parseISO(interview.scheduled_date), 'MMM d, yyyy')}
                              </div>
                              <div className="text-sm text-slate-500">
                                {format(parseISO(interview.scheduled_date), 'HH:mm')} ({interview.duration_minutes}m)
                              </div>
                            </div>
                          ) : 'Not scheduled'}
                        </TableCell>
                        <TableCell>
                          <Badge className={
                            interview.status === 'completed' ? 'bg-green-100 text-green-700' :
                              interview.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                interview.status === 'no_show' ? 'bg-orange-100 text-orange-700' :
                                  'bg-blue-100 text-blue-700'
                          }>
                            {interview.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedInterview(interview)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">No interviews scheduled</h3>
                  <p className="text-slate-500">Schedule your first interview</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Candidate Dialog */}
      <Dialog open={candidateDialogOpen} onOpenChange={(open) => {
        setCandidateDialogOpen(open);
        if (!open) {
          setEditingCandidateId(null);
          setCandidateForm({
            full_name: '',
            email: '',
            phone: '',
            current_position: '',
            current_company: '',
            experience_years: '',
            skills: '',
            education: '',
            expected_salary: '',
            current_salary: '',
            location: '',
            source: 'job_portal',
            priority: 'medium',
            tags: '',
            resume: null
          });
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCandidateId ? 'Edit Candidate' : 'Add New Candidate'}</DialogTitle>
            <DialogDescription>
              {editingCandidateId ? 'Update candidate information' : 'Enter candidate information and upload their resume'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => {
            e.preventDefault();
            if (editingCandidateId) {
              // Prepare data for update
              const updateData = {
                ...candidateForm,
                skills: typeof candidateForm.skills === 'string' ? candidateForm.skills.split(',').map(s => s.trim()).filter(s => s) : candidateForm.skills,
                education: typeof candidateForm.education === 'string' ? candidateForm.education.split('\n').filter(e => e.trim()) : candidateForm.education,
                tags: typeof candidateForm.tags === 'string' ? candidateForm.tags.split(',').map(t => t.trim()).filter(t => t) : candidateForm.tags,
              };
              delete updateData.resume; // don't update file directly via update for now
              updateCandidateMutation.mutate({ id: editingCandidateId, data: updateData });
            } else {
              createCandidateMutation.mutate(candidateForm);
            }
          }}>
            <div className="space-y-4">
              <div className="relative mb-4">
                <Label htmlFor="resume">Resume/CV (Upload to Auto-fill)</Label>
                <div className="relative mt-1">
                  <Input
                    id="resume"
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileUpload}
                    disabled={parsingResume}
                    className={parsingResume ? "pr-10" : ""}
                  />
                  {parsingResume && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    </div>
                  )}
                </div>
              </div>


              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="full_name">Full Name *</Label>
                  <Input
                    id="full_name"
                    required
                    value={candidateForm.full_name}
                    onChange={(e) => setCandidateForm(prev => ({ ...prev, full_name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={candidateForm.email}
                    onChange={(e) => setCandidateForm(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={candidateForm.phone}
                    onChange={(e) => setCandidateForm(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={candidateForm.location}
                    onChange={(e) => setCandidateForm(prev => ({ ...prev, location: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="current_position">Current Position</Label>
                  <Input
                    id="current_position"
                    value={candidateForm.current_position}
                    onChange={(e) => setCandidateForm(prev => ({ ...prev, current_position: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="current_company">Current Company</Label>
                  <Input
                    id="current_company"
                    value={candidateForm.current_company}
                    onChange={(e) => setCandidateForm(prev => ({ ...prev, current_company: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="experience_years">Experience (Years)</Label>
                  <Input
                    id="experience_years"
                    type="number"
                    value={candidateForm.experience_years}
                    onChange={(e) => setCandidateForm(prev => ({ ...prev, experience_years: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="expected_salary">Expected Salary</Label>
                  <Input
                    id="expected_salary"
                    type="number"
                    value={candidateForm.expected_salary}
                    onChange={(e) => setCandidateForm(prev => ({ ...prev, expected_salary: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="current_salary">Current Salary</Label>
                  <Input
                    id="current_salary"
                    type="number"
                    value={candidateForm.current_salary}
                    onChange={(e) => setCandidateForm(prev => ({ ...prev, current_salary: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="skills">Skills (comma-separated)</Label>
                <Input
                  id="skills"
                  placeholder="JavaScript, React, Node.js"
                  value={candidateForm.skills}
                  onChange={(e) => setCandidateForm(prev => ({ ...prev, skills: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="education">Education (one per line)</Label>
                <Textarea
                  id="education"
                  placeholder="MBA, Harvard Business School, 2020, 3.8 GPA"
                  rows={3}
                  value={candidateForm.education}
                  onChange={(e) => setCandidateForm(prev => ({ ...prev, education: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="source">Source</Label>
                  <Select
                    value={candidateForm.source}
                    onValueChange={(value) => setCandidateForm(prev => ({ ...prev, source: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="job_portal">Job Portal</SelectItem>
                      <SelectItem value="referral">Referral</SelectItem>
                      <SelectItem value="linkedin">LinkedIn</SelectItem>
                      <SelectItem value="direct">Direct</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={candidateForm.priority}
                    onValueChange={(value) => setCandidateForm(prev => ({ ...prev, priority: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input
                  id="tags"
                  placeholder="remote, senior, frontend"
                  value={candidateForm.tags}
                  onChange={(e) => setCandidateForm(prev => ({ ...prev, tags: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button type="button" variant="outline" onClick={() => setCandidateDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createCandidateMutation.isPending || updateCandidateMutation.isPending}
              >
                {createCandidateMutation.isPending || updateCandidateMutation.isPending ? 'Saving...' : (editingCandidateId ? 'Update Candidate' : 'Add Candidate')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Schedule Interview Dialog */}
      <Dialog open={interviewDialogOpen} onOpenChange={setInterviewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Interview</DialogTitle>
            <DialogDescription>
              Set up an interview for the selected candidate
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => {
            e.preventDefault();
            createInterviewMutation.mutate(interviewForm);
          }}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="interviewer">Interviewer</Label>
                <Select
                  value={interviewForm.interviewer_email}
                  onValueChange={(value) => setInterviewForm(prev => ({ ...prev, interviewer_email: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select interviewer" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map(user => (
                      <SelectItem key={user.email} value={user.email}>
                        {user.full_name || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="interview_type">Type</Label>
                  <Select
                    value={interviewForm.interview_type}
                    onValueChange={(value) => setInterviewForm(prev => ({ ...prev, interview_type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="technical">Technical</SelectItem>
                      <SelectItem value="hr">HR</SelectItem>
                      <SelectItem value="managerial">Managerial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="round">Round</Label>
                  <Select
                    value={interviewForm.round.toString()}
                    onValueChange={(value) => setInterviewForm(prev => ({ ...prev, round: parseInt(value) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map(num => (
                        <SelectItem key={num} value={num.toString()}>Round {num}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="scheduled_date">Date & Time</Label>
                  <Input
                    id="scheduled_date"
                    type="datetime-local"
                    required
                    value={interviewForm.scheduled_date}
                    onChange={(e) => setInterviewForm(prev => ({ ...prev, scheduled_date: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <Select
                    value={interviewForm.duration_minutes.toString()}
                    onValueChange={(value) => setInterviewForm(prev => ({ ...prev, duration_minutes: parseInt(value) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="45">45 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="90">1.5 hours</SelectItem>
                      <SelectItem value="120">2 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="meeting_link">Meeting Link</Label>
                <Input
                  id="meeting_link"
                  placeholder="https://meet.google.com/..."
                  value={interviewForm.meeting_link}
                  onChange={(e) => setInterviewForm(prev => ({ ...prev, meeting_link: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional notes or preparation details"
                  rows={3}
                  value={interviewForm.notes}
                  onChange={(e) => setInterviewForm(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button type="button" variant="outline" onClick={() => setInterviewDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createInterviewMutation.isPending}
              >
                {createInterviewMutation.isPending ? 'Scheduling...' : 'Schedule Interview'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Candidate Details Dialog */}
      <Dialog open={!!selectedCandidate} onOpenChange={() => setSelectedCandidate(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedCandidate?.full_name}</DialogTitle>
            <DialogDescription>
              {selectedCandidate?.current_position} at {selectedCandidate?.current_company}
            </DialogDescription>
          </DialogHeader>

          {selectedCandidate && (
            <div className="space-y-6">
              {/* Status and Actions */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusBadge(selectedCandidate.status)}
                  {getPriorityBadge(selectedCandidate.priority)}
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={selectedCandidate.status}
                    onValueChange={(status) => updateCandidateStatusMutation.mutate({
                      candidateId: selectedCandidate.id,
                      status
                    })}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="screening">Screening</SelectItem>
                      <SelectItem value="interviewed">Interviewed</SelectItem>
                      <SelectItem value="offered">Offered</SelectItem>
                      <SelectItem value="hired">Hired</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Contact Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <span className="text-sm text-gray-500">Email</span>
                  <div className="font-medium">{selectedCandidate.email}</div>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Phone</span>
                  <div className="font-medium">{selectedCandidate.phone || 'N/A'}</div>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Location</span>
                  <div className="font-medium">{selectedCandidate.location || 'N/A'}</div>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Experience</span>
                  <div className="font-medium">{selectedCandidate.experience_years} years</div>
                </div>
              </div>

              {/* Skills */}
              {selectedCandidate.skills && selectedCandidate.skills.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Skills</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedCandidate.skills.map((skill, index) => (
                      <Badge key={index} variant="secondary">{skill}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Resume */}
              {selectedCandidate.resume_url && (
                <div>
                  <h4 className="font-medium mb-2">Resume</h4>
                  <Button variant="outline" asChild>
                    <a href={selectedCandidate.resume_url} target="_blank" rel="noopener noreferrer">
                      <FileText className="w-4 h-4 mr-2" />
                      View Resume
                    </a>
                  </Button>
                </div>
              )}

              {/* Education */}
              {selectedCandidate.education && selectedCandidate.education.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Education</h4>
                  <div className="space-y-2">
                    {selectedCandidate.education.map((edu, index) => (
                      <div key={index} className="text-sm p-2 bg-gray-50 rounded">
                        {edu}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div >
  );
}