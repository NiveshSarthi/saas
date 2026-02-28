// @ts-nocheck
import React, { useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ChevronDown, ChevronRight, Video, Search, CheckCircle2, Circle, Clock, SlidersHorizontal, X, Download, FileText, CalendarDays } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// All workflow stages in order
const STAGES = [
    { id: 'shoot', label: 'Shoot', color: '#F59E0B', bg: '#FEF3C7', text: '#92400E' },
    { id: 'editing', label: 'Editing', color: '#3B82F6', bg: '#DBEAFE', text: '#1E3A8A' },
    { id: 'review', label: 'Review', color: '#A855F7', bg: '#F3E8FF', text: '#4C1D95' },
    { id: 'revision', label: 'Revision', color: '#F97316', bg: '#FFEDD5', text: '#7C2D12' },
    { id: 'approval', label: 'Approval', color: '#EAB308', bg: '#FEF9C3', text: '#713F12' },
    { id: 'posting', label: 'Posting', color: '#06B6D4', bg: '#CFFAFE', text: '#164E63' },
    { id: 'posted', label: 'Posted', color: '#10B981', bg: '#D1FAE5', text: '#064E3B' },
    { id: 'trash', label: 'Trash', color: '#EF4444', bg: '#FEE2E2', text: '#991B1B' },
];

// Native date helpers
function isToday(d) {
    const n = new Date();
    return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
}
function isYesterday(d) {
    const y = new Date(); y.setDate(y.getDate() - 1);
    return d.getDate() === y.getDate() && d.getMonth() === y.getMonth() && d.getFullYear() === y.getFullYear();
}
function fmtDate(dateStr) {
    if (!dateStr) return null;
    try {
        const d = new Date(dateStr);
        if (isToday(d)) return 'Today';
        if (isYesterday(d)) return 'Yesterday';
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return null; }
}
function fmtTime(dateStr) {
    if (!dateStr) return null;
    try {
        return new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch { return null; }
}
function getObjectIdDate(video) {
    const rawId = video._id || video.id || '';
    const hex = rawId.substring(0, 8);
    if (hex.length === 8) {
        const secs = parseInt(hex, 16);
        if (!isNaN(secs)) return new Date(secs * 1000).toISOString();
    }
    return null;
}

// Build the stage map: for each stage, what date was it first entered?
function buildStageMap(video, logs) {
    const map = {};
    const createdAt = video.created_at || getObjectIdDate(video);
    if (createdAt) map['shoot'] = map['shoot'] || createdAt;

    const sorted = [...logs]
        .filter(l => l.action === 'status_changed' && l.details?.to)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    sorted.forEach(log => {
        const to = log.details.to;
        if (!map[to]) map[to] = log.created_at;
    });
    return map;
}

function getCurrentStageIndex(status) {
    return STAGES.findIndex(s => s.id === status);
}

// ──────────────────────────────────────────────
// Single video timeline row
// ──────────────────────────────────────────────
function VideoTimelineRow({ video, logs, categories, emailToName = {} }) {
    const [expanded, setExpanded] = useState(false);
    const category = categories.find(c => (c.id || c._id) === video.category_id);
    const stageMap = useMemo(() => buildStageMap(video, logs), [video, logs]);
    const currentIdx = getCurrentStageIndex(video.status);
    const isTrashed = video.status === 'trash';

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-shadow hover:shadow-md">
            {/* Header */}
            <div className="px-5 py-4 flex items-start gap-3 cursor-pointer" onClick={() => setExpanded(e => !e)}>
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <span className="font-semibold text-slate-800 text-sm truncate max-w-[260px]">{video.title}</span>
                        {/* Editing level badge */}
                        {video.editing_level && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${video.editing_level === 'A+' ? 'bg-violet-100 text-violet-700 border-violet-300' :
                                video.editing_level === 'A' ? 'bg-blue-100 text-blue-700 border-blue-300' :
                                    'bg-slate-100 text-slate-600 border-slate-300'
                                }`}>
                                {video.editing_level}
                            </span>
                        )}
                        {category && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium border"
                                style={{ backgroundColor: category.color + '20', color: category.color, borderColor: category.color + '40' }}>
                                {category.name}
                            </span>
                        )}
                        {isTrashed && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-500 border border-slate-200">Trashed</span>
                        )}
                    </div>
                    <p className="text-xs text-slate-400">
                        Created: {fmtDate(video.created_at || getObjectIdDate(video))}
                        {logs.length > 0 && ` · ${logs.filter(l => l.action === 'status_changed').length} moves`}
                    </p>
                </div>
                <button className="flex-shrink-0 p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors mt-0.5">
                    {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
            </div>

            {/* Horizontal stage progress */}
            <div className="px-5 pb-4">
                <div className="flex items-start gap-0 overflow-x-auto pb-1">
                    {STAGES.map((stage, idx) => {
                        const reached = stageMap[stage.id];

                        return (
                            <React.Fragment key={stage.id}>
                                <div className="flex flex-col items-center gap-1 flex-shrink-0" style={{ minWidth: 72 }}>
                                    <div
                                        className="w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all"
                                        style={{
                                            backgroundColor: reached ? stage.color : '#F1F5F9',
                                            borderColor: reached ? stage.color : '#CBD5E1',
                                        }}
                                    >
                                        {reached
                                            ? <CheckCircle2 className="w-4 h-4 text-white" />
                                            : <Circle className="w-4 h-4 text-slate-400" />
                                        }
                                    </div>
                                    <span className="text-[10px] font-semibold text-center" style={{ color: reached ? stage.color : '#94A3B8' }}>
                                        {stage.label}
                                    </span>
                                    {reached
                                        ? <span className="text-[9px] text-slate-500 text-center whitespace-nowrap">{fmtDate(reached)}</span>
                                        : <span className="text-[9px] text-slate-300 text-center">—</span>
                                    }
                                </div>
                                {idx < STAGES.length - 1 && (
                                    <div className="flex-1 h-0.5 mt-4 mx-0.5 flex-shrink-0" style={{
                                        minWidth: 12,
                                        background: (reached && stageMap[STAGES[idx + 1].id]) ? stage.color : '#E2E8F0'
                                    }} />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>

            {/* Expanded: stage history with exact times */}
            {expanded && (
                <div className="border-t border-slate-100 px-5 py-4 space-y-2 bg-slate-50/60">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Stage History</p>
                    <div className="relative">
                        <div className="absolute left-3 top-2 bottom-2 w-px bg-slate-200" />
                        <div className="space-y-4 pl-8">
                            {STAGES.map(stage => {
                                const date = stageMap[stage.id];
                                if (!date) return null;
                                const isCurrent = video.status === stage.id;
                                return (
                                    <div key={stage.id} className="relative">
                                        <div className="absolute -left-8 w-4 h-4 rounded-full border-2 border-white"
                                            style={{ backgroundColor: stage.color, top: 1 }} />
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full border"
                                                style={{ backgroundColor: stage.bg, color: stage.text, borderColor: stage.color + '60' }}>
                                                {stage.label}
                                            </span>
                                            {isCurrent && (
                                                <span className="text-[10px] bg-indigo-100 text-indigo-600 font-semibold px-2 py-0.5 rounded-full">Current</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Clock className="w-3 h-3 text-slate-400" />
                                            <span className="text-xs text-slate-500">
                                                {fmtDate(date)}
                                                {fmtTime(date) && <span className="text-slate-400"> · {fmtTime(date)}</span>}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    {/* Assigned team */}
                    {(video.assigned_director || video.assigned_cameraman || video.assigned_editor || video.assigned_manager) && (
                        <div className="mt-4 pt-3 border-t border-slate-200">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Assigned Team</p>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { role: 'Director', val: video.assigned_director },
                                    { role: 'Cameraman', val: video.assigned_cameraman },
                                    { role: 'Editor', val: video.assigned_editor },
                                    { role: 'Manager', val: video.assigned_manager },
                                ].filter(r => r.val).map(r => (
                                    <div key={r.role} className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1">
                                        <span className="text-[10px] font-semibold text-slate-500">{r.role}:</span>
                                        <span className="text-xs text-slate-700">{emailToName[r.val] || r.val}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ──────────────────────────────────────────────
// Main VideoTimeline export
// ──────────────────────────────────────────────
export default function VideoTimeline({ videos, logs = [], categories = [], users = [] }) {
    const [search, setSearch] = useState('');
    const [filterCurrentStage, setFilterCurrentStage] = useState('all');
    const [filterReachedStage, setFilterReachedStage] = useState('all');
    const [filterEditingLevel, setFilterEditingLevel] = useState('all');
    const [filterCategory, setFilterCategory] = useState('all');
    const [filterAssignedTo, setFilterAssignedTo] = useState('all');
    const [filterDateMode, setFilterDateMode] = useState('all'); // all | month | year | custom
    const [filterMonth, setFilterMonth] = useState(''); // 'YYYY-MM'
    const [filterYear, setFilterYear] = useState(''); // 'YYYY'
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Generate month options (last 24 months)
    const monthOptions = useMemo(() => {
        const opts = [];
        const now = new Date();
        for (let i = 0; i < 24; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const label = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
            opts.push({ val, label });
        }
        return opts;
    }, []);

    // Generate year options (last 6 years)
    const yearOptions = useMemo(() => {
        const y = new Date().getFullYear();
        return Array.from({ length: 6 }, (_, i) => String(y - i));
    }, []);

    // Build email→name lookup from users list
    const emailToName = useMemo(() => {
        const map = {};
        users.forEach(u => {
            const email = u.email;
            if (email) map[email] = u.full_name || u.name || email;
        });
        return map;
    }, [users]);

    // Build a flat list of unique assigned users as {email, name} pairs
    const assignableUsers = useMemo(() => {
        const emailSet = new Set();
        videos.forEach(v => {
            [v.assigned_director, v.assigned_cameraman, v.assigned_editor, v.assigned_manager]
                .filter(Boolean).forEach(e => emailSet.add(e));
        });
        return Array.from(emailSet)
            .map(email => ({ email, name: emailToName[email] || email }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [videos, emailToName]);

    // Group logs by video id
    const logsByVideoId = useMemo(() => {
        const map = {};
        logs.forEach(log => {
            const vid = String(log.video_id);
            if (!map[vid]) map[vid] = [];
            map[vid].push(log);
        });
        return map;
    }, [logs]);

    const getLogsForVideo = (video) =>
        logsByVideoId[String(video.id || video._id || '')] || [];

    const hasActiveFilters = filterCurrentStage !== 'all' || filterReachedStage !== 'all' ||
        filterEditingLevel !== 'all' || filterCategory !== 'all' || filterAssignedTo !== 'all' ||
        filterDateMode !== 'all';

    const clearFilters = () => {
        setFilterCurrentStage('all');
        setFilterReachedStage('all');
        setFilterEditingLevel('all');
        setFilterCategory('all');
        setFilterAssignedTo('all');
        setFilterDateMode('all');
        setFilterMonth('');
        setFilterYear('');
        setFilterDateFrom('');
        setFilterDateTo('');
    };

    // Filter + sort
    const filtered = useMemo(() => {
        let result = [...videos].filter(v => !v.is_deleted);

        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(v => v.title?.toLowerCase().includes(q) || v.description?.toLowerCase().includes(q));
        }

        // Current stage
        if (filterCurrentStage !== 'all') {
            result = result.filter(v => v.status === filterCurrentStage);
        }

        // Editing level
        if (filterEditingLevel !== 'all') {
            result = result.filter(v => v.editing_level === filterEditingLevel);
        }

        // Category
        if (filterCategory !== 'all') {
            result = result.filter(v => (v.category_id === filterCategory));
        }

        // Assigned to (any role)
        if (filterAssignedTo !== 'all') {
            result = result.filter(v =>
                v.assigned_director === filterAssignedTo ||
                v.assigned_cameraman === filterAssignedTo ||
                v.assigned_editor === filterAssignedTo ||
                v.assigned_manager === filterAssignedTo
            );
        }

        // Reached stage filter — check via logs
        if (filterReachedStage !== 'all') {
            result = result.filter(v => {
                const vLogs = getLogsForVideo(v);
                const stageMap = buildStageMap(v, vLogs);
                return !!stageMap[filterReachedStage];
            });
        }

        // Date filters — show video if ANY stage date falls within the selected period
        if (filterDateMode !== 'all') {
            result = result.filter(v => {
                const vLogs = getLogsForVideo(v);
                const stageMap = buildStageMap(v, vLogs);

                // Collect all stage dates for this video
                const stageDates = Object.values(stageMap)
                    .filter(Boolean)
                    .map(raw => new Date(raw));

                if (stageDates.length === 0) return false;

                // Return true if ANY stage date matches the selected period
                return stageDates.some(d => {
                    if (filterDateMode === 'month' && filterMonth) {
                        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                        return ym === filterMonth;
                    }
                    if (filterDateMode === 'year' && filterYear) {
                        return String(d.getFullYear()) === filterYear;
                    }
                    if (filterDateMode === 'custom') {
                        if (filterDateFrom) {
                            const [fy, fm, fd] = filterDateFrom.split('-').map(Number);
                            if (d < new Date(fy, fm - 1, fd, 0, 0, 0)) return false;
                        }
                        if (filterDateTo) {
                            const [ty, tm, td] = filterDateTo.split('-').map(Number);
                            if (d > new Date(ty, tm - 1, td, 23, 59, 59)) return false;
                        }
                        return true;
                    }
                    return false;
                });
            });
        }

        // Sort by most recently active
        return result.sort((a, b) => {
            const aLogs = getLogsForVideo(a);
            const bLogs = getLogsForVideo(b);
            const aLast = aLogs.length ? Math.max(...aLogs.map(l => new Date(l.created_at).getTime())) : (a.created_at ? new Date(a.created_at).getTime() : 0);
            const bLast = bLogs.length ? Math.max(...bLogs.map(l => new Date(l.created_at).getTime())) : (b.created_at ? new Date(b.created_at).getTime() : 0);
            return bLast - aLast;
        });
    }, [videos, search, filterCurrentStage, filterReachedStage, filterEditingLevel, filterCategory, filterAssignedTo, filterDateMode, filterMonth, filterYear, filterDateFrom, filterDateTo, logsByVideoId]);

    if (videos.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
                    <Video className="w-8 h-8 text-indigo-300" />
                </div>
                <p className="text-slate-500 text-sm">No videos to display</p>
            </div>
        );
    }
    // ── PDF Export ─────────────────────────────────────────────────
    const exportToPDF = () => {
        try {
            const getCategoryName = (id) => {
                const cat = categories.find(c => (c.id || c._id) === id);
                return cat?.name || '';
            };

            const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
            const ts = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

            // Title & Meta
            doc.setFontSize(16);
            doc.setTextColor('#4F46E5');
            doc.text('Video Stage Timeline', 14, 15);

            doc.setFontSize(9);
            doc.setTextColor('#94a3b8');
            let metaText = `Exported on ${ts}  ·  ${filtered.length} video${filtered.length !== 1 ? 's' : ''}`;
            if (hasActiveFilters) metaText += '  ·  (Filtered results)';

            if (filterDateMode !== 'all') {
                let dateStr = '';
                if (filterDateMode === 'month' && filterMonth) {
                    const [y, m] = filterMonth.split('-');
                    const d = new Date(y, m - 1, 1);
                    dateStr = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
                } else if (filterDateMode === 'year' && filterYear) {
                    dateStr = filterYear;
                } else if (filterDateMode === 'custom' && (filterDateFrom || filterDateTo)) {
                    const f = filterDateFrom ? new Date(filterDateFrom).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Start';
                    const t = filterDateTo ? new Date(filterDateTo).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'End';
                    dateStr = `${f} - ${t}`;
                }
                if (dateStr) metaText += `  ·  Activity Date: ${dateStr}`;
            }

            doc.text(metaText, 14, 21);

            let startY = 28;

            // Calculate stage counts for cards
            const stageCounts = STAGES.map(stage => {
                const count = filtered.filter(v => v.status === stage.id).length;
                return { ...stage, count };
            });

            // Convert hex to rgb for jsPDF bg colors
            const hexToRgb = (hex) => {
                const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [255, 255, 255];
            };

            const cards = [
                { label: 'TOTAL', count: filtered.length, color: '#475569', bg: '#F8FAFC', border: '#E2E8F0' },
                ...stageCounts.map(s => ({
                    label: s.label.toUpperCase(),
                    count: s.count,
                    color: s.text || s.color,
                    bg: s.bg || '#ffffff',
                    border: s.color
                }))
            ];

            // Draw Cards
            let cardX = 14;
            const cardWidth = 27.2; // calculated to precisely align 9 cards across table width (269)
            const cardHeight = 15;
            const cardSpacing = 3;

            cards.forEach(card => {
                // Background
                doc.setFillColor(...hexToRgb(card.bg));
                doc.setDrawColor(...hexToRgb(card.border));
                doc.setLineWidth(0.3);
                doc.roundedRect(cardX, startY, cardWidth, cardHeight, 1.5, 1.5, 'FD');

                // Label
                doc.setFontSize(7.5);
                doc.setTextColor(...hexToRgb(card.color));
                doc.setFont('helvetica', 'bold');
                doc.text(card.label, cardX + 3.5, startY + 5.5);

                // Count
                doc.setFontSize(15);
                doc.setFont('helvetica', 'bold');
                doc.text(String(card.count), cardX + 3.5, startY + 12.5);

                cardX += cardWidth + cardSpacing;
            });

            startY += cardHeight + 8; // Move down for table

            // Table Data
            const head = [[
                'S. No', 'Title', 'Category', 'Lvl', 'Stage',
                ...STAGES.map(s => s.label),
                'Director', 'Cameraman', 'Editor', 'Manager', 'Created'
            ]];

            const body = filtered.map((video, index) => {
                const vLogs = getLogsForVideo(video);
                const stageMap = buildStageMap(video, vLogs);

                const stageCells = STAGES.map(s => {
                    if (!stageMap[s.id]) return { content: '—', styles: { textColor: '#CBD5E1' } };
                    try {
                        return {
                            content: new Date(stageMap[s.id]).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
                            styles: { textColor: s.color, fontStyle: 'bold' }
                        };
                    } catch { return ''; }
                });

                const createdStr = (() => { try { const d = video.created_at || getObjectIdDate(video); return d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''; } catch { return ''; } })();

                return [
                    index + 1,
                    video.title || '',
                    getCategoryName(video.category_id),
                    video.editing_level || '',
                    video.status || '',
                    ...stageCells,
                    emailToName[video.assigned_director] || video.assigned_director || '',
                    emailToName[video.assigned_cameraman] || video.assigned_cameraman || '',
                    emailToName[video.assigned_editor] || video.assigned_editor || '',
                    emailToName[video.assigned_manager] || video.assigned_manager || '',
                    createdStr
                ];
            });

            autoTable(doc, {
                startY: startY,
                head: head,
                body: body,
                theme: 'grid',
                styles: { fontSize: 7, cellPadding: 1, overflow: 'linebreak' },
                headStyles: { fillColor: '#F8FAFC', textColor: '#64748B', lineWidth: 0.1, lineColor: '#E2E8F0', fontStyle: 'bold' },
                alternateRowStyles: { fillColor: '#FAFAFA' },
                columnStyles: {
                    0: { cellWidth: 8 },  // S. No
                    1: { cellWidth: 26 }, // title
                    2: { cellWidth: 14 }, // category
                    3: { cellWidth: 7 },  // level
                    4: { cellWidth: 14 }, // stage
                    // dates x8
                    5: { cellWidth: 14 },   // shoot
                    6: { cellWidth: 14 },   // editing
                    7: { cellWidth: 14 },   // review
                    8: { cellWidth: 14 },   // revision
                    9: { cellWidth: 14 },   // approval
                    10: { cellWidth: 14 },  // posting
                    11: { cellWidth: 14 },  // posted
                    12: { cellWidth: 14 },  // trash
                    // users x4
                    13: { cellWidth: 18 },  // director
                    14: { cellWidth: 18 },  // cameraman
                    15: { cellWidth: 16 },  // editor
                    16: { cellWidth: 16 },  // manager
                    // created
                    17: { cellWidth: 16 }
                }
            });

            // Trigger direct download
            doc.save(`video-timeline-${ts.replace(/ /g, '-')}.pdf`);
            toast.success("PDF generated successfully");
        } catch (error) {
            console.error("PDF Export error:", error);
            toast.error("Failed to generate PDF: " + error.message);
        }
    };

    // ── CSV Export ─────────────────────────────────────────────────
    const exportToCSV = () => {
        const headers = [
            'Title', 'Category', 'Editing Level', 'Current Stage',
            ...STAGES.map(s => `${s.label} Date`),
            'Director', 'Cameraman', 'Editor', 'Manager',
            'Created Date'
        ];

        const getCategoryName = (id) => {
            const cat = categories.find(c => (c.id || c._id) === id);
            return cat?.name || '';
        };

        const rows = filtered.map(video => {
            const vLogs = getLogsForVideo(video);
            const stageMap = buildStageMap(video, vLogs);

            const stageDates = STAGES.map(s => {
                if (!stageMap[s.id]) return '';
                try {
                    return new Date(stageMap[s.id]).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                } catch { return ''; }
            });

            const createdStr = (() => {
                const d = video.created_at || getObjectIdDate(video);
                if (!d) return '';
                try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
                catch { return ''; }
            })();

            return [
                `"${(video.title || '').replace(/"/g, '""')}"`,
                `"${getCategoryName(video.category_id)}"`,
                video.editing_level || '',
                video.status || '',
                ...stageDates,
                `"${emailToName[video.assigned_director] || video.assigned_director || ''}"`,
                `"${emailToName[video.assigned_cameraman] || video.assigned_cameraman || ''}"`,
                `"${emailToName[video.assigned_editor] || video.assigned_editor || ''}"`,
                `"${emailToName[video.assigned_manager] || video.assigned_manager || ''}"`,
                createdStr,
            ].join(',');
        });

        const csv = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const ts = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
        link.href = url;
        link.download = `video-timeline-${ts}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-4">

            {/* Search + Filter toggle row */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        placeholder="Search videos..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-9 bg-white border-slate-200 rounded-xl text-sm"
                    />
                </div>
                <Button
                    variant={showFilters ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShowFilters(f => !f)}
                    className={`gap-2 rounded-xl px-4 ${showFilters ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-white'}`}
                >
                    <SlidersHorizontal className="w-4 h-4" />
                    Filters
                    {hasActiveFilters && (
                        <span className="bg-white text-indigo-600 text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                            !
                        </span>
                    )}
                </Button>
                {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl px-2">
                        <X className="w-4 h-4" />
                    </Button>
                )}
            </div>

            {/* Filter panel */}
            {showFilters && (
                <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-4">
                    <div className="flex flex-wrap gap-3">

                        {/* Current Stage */}
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Current Stage</label>
                            <Select value={filterCurrentStage} onValueChange={setFilterCurrentStage}>
                                <SelectTrigger className="w-[140px] bg-white text-sm h-9 rounded-lg border-slate-200">
                                    <SelectValue placeholder="All Stages" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Stages</SelectItem>
                                    {STAGES.map(s => (
                                        <SelectItem key={s.id} value={s.id}>
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                                                {s.label}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Has Reached Stage */}
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Has Reached Stage</label>
                            <Select value={filterReachedStage} onValueChange={setFilterReachedStage}>
                                <SelectTrigger className="w-[160px] bg-white text-sm h-9 rounded-lg border-slate-200">
                                    <SelectValue placeholder="Any Stage" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Any Stage</SelectItem>
                                    {STAGES.map(s => (
                                        <SelectItem key={s.id} value={s.id}>
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                                                Reached {s.label}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Editing Level */}
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Editing Level</label>
                            <Select value={filterEditingLevel} onValueChange={setFilterEditingLevel}>
                                <SelectTrigger className="w-[130px] bg-white text-sm h-9 rounded-lg border-slate-200">
                                    <SelectValue placeholder="All Levels" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Levels</SelectItem>
                                    <SelectItem value="B">
                                        <div className="flex items-center gap-2"><span className="font-bold text-slate-600">B</span> Basic</div>
                                    </SelectItem>
                                    <SelectItem value="A">
                                        <div className="flex items-center gap-2"><span className="font-bold text-blue-600">A</span> Medium</div>
                                    </SelectItem>
                                    <SelectItem value="A+">
                                        <div className="flex items-center gap-2"><span className="font-bold text-violet-600">A+</span> Highest</div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Category */}
                        {categories.length > 0 && (
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Category</label>
                                <Select value={filterCategory} onValueChange={setFilterCategory}>
                                    <SelectTrigger className="w-[150px] bg-white text-sm h-9 rounded-lg border-slate-200">
                                        <SelectValue placeholder="All Categories" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Categories</SelectItem>
                                        {categories.map(cat => (
                                            <SelectItem key={cat.id || cat._id} value={cat.id || cat._id}>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                                                    {cat.name}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Assigned Person */}
                        {assignableUsers.length > 0 && (
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Assigned To</label>
                                <Select value={filterAssignedTo} onValueChange={setFilterAssignedTo}>
                                    <SelectTrigger className="w-[200px] bg-white text-sm h-9 rounded-lg border-slate-200">
                                        <SelectValue placeholder="Anyone" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Anyone</SelectItem>
                                        {assignableUsers.map(({ email, name }) => (
                                            <SelectItem key={email} value={email}>{name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Date Filter */}
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Activity Date</label>
                            <div className="flex flex-wrap gap-2 items-start">
                                <Select value={filterDateMode} onValueChange={v => { setFilterDateMode(v); setFilterMonth(''); setFilterYear(''); setFilterDateFrom(''); setFilterDateTo(''); }}>
                                    <SelectTrigger className="w-[140px] bg-white text-sm h-9 rounded-lg border-slate-200">
                                        <CalendarDays className="w-3.5 h-3.5 mr-1 text-slate-400" />
                                        <SelectValue placeholder="All Time" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Time</SelectItem>
                                        <SelectItem value="month">By Month</SelectItem>
                                        <SelectItem value="year">By Year</SelectItem>
                                        <SelectItem value="custom">Custom Range</SelectItem>
                                    </SelectContent>
                                </Select>

                                {filterDateMode === 'month' && (
                                    <Select value={filterMonth} onValueChange={setFilterMonth}>
                                        <SelectTrigger className="w-[170px] bg-white text-sm h-9 rounded-lg border-slate-200">
                                            <SelectValue placeholder="Select Month" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {monthOptions.map(o => (
                                                <SelectItem key={o.val} value={o.val}>{o.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}

                                {filterDateMode === 'year' && (
                                    <Select value={filterYear} onValueChange={setFilterYear}>
                                        <SelectTrigger className="w-[110px] bg-white text-sm h-9 rounded-lg border-slate-200">
                                            <SelectValue placeholder="Select Year" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {yearOptions.map(y => (
                                                <SelectItem key={y} value={y}>{y}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}

                                {filterDateMode === 'custom' && (
                                    <div className="flex items-center gap-1.5">
                                        <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
                                            className="h-9 px-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                                        <span className="text-xs text-slate-400">to</span>
                                        <input type="date" value={filterDateTo} min={filterDateFrom} onChange={e => setFilterDateTo(e.target.value)}
                                            className="h-9 px-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* Result count + Export */}
            <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">{filtered.length}</span> of {videos.filter(v => !v.is_deleted).length} video{filtered.length !== 1 ? 's' : ''}
                    {hasActiveFilters && <span className="text-indigo-500 font-medium"> · filtered</span>}
                    <span className="text-slate-400"> · Click any card for full stage history</span>
                </p>

                {filtered.length > 0 && (
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={exportToCSV}
                            className="gap-2 rounded-xl text-sm bg-white border-slate-200 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition-colors whitespace-nowrap"
                        >
                            <Download className="w-4 h-4" />
                            CSV
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={exportToPDF}
                            className="gap-2 rounded-xl text-sm bg-white border-slate-200 hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-colors whitespace-nowrap"
                        >
                            <FileText className="w-4 h-4" />
                            PDF
                        </Button>
                    </div>
                )}
            </div>

            {/* Video rows */}
            {filtered.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">No videos match the selected filters.</div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(video => (
                        <VideoTimelineRow
                            key={video.id || video._id}
                            video={video}
                            logs={getLogsForVideo(video)}
                            categories={categories}
                            users={users}
                            emailToName={emailToName}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
