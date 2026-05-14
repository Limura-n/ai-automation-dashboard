'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Play, Pause, Trash2, Edit3, ChevronDown, ChevronRight,
  Clock, Zap, AlertTriangle, Calendar, Tag, Loader2, Filter, X,
  MessageSquare, Star, ThumbsUp, ThumbsDown, CheckCircle2, XCircle,
  Wand2, Layout, Sparkles, Paperclip, File, Download, Image,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import {
  useUserTasks, useCreateUserTask, useUpdateUserTask, useDeleteUserTask,
  useCreateFeedback, useMissions, useTriggerOrchestrator,
  type Task,
} from '@/hooks/use-dashboard-data'
import { TASK_TEMPLATES, type TaskTemplate } from '@/lib/task-templates'

// ─── Styles ──────────────────────────────────────────────────
const statusBadge: Record<string, string> = {
  pending: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
  scheduled: 'bg-sky-500/15 text-sky-400 border-sky-500/20',
  in_progress: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  completed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  failed: 'bg-rose-500/15 text-rose-400 border-rose-500/20',
  paused: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
}

const priorityBadge: Record<string, string> = {
  normal: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
  high: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  urgent: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
}

const priorityIcon: Record<string, JSX.Element> = {
  normal: <span className="w-2 h-2 rounded-full bg-slate-400" />,
  high: <AlertTriangle className="w-3 h-3 text-amber-400" />,
  urgent: <Zap className="w-3 h-3 text-rose-400" />,
}

// ─── Cron Presets ────────────────────────────────────────────
const SCHEDULE_PRESETS = [
  { label: 'No schedule (on-demand)', value: '' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 3 hours', value: '0 */3 * * *' },
  { label: 'Daily at 9 AM', value: '0 9 * * *' },
  { label: 'Daily at 6 PM', value: '0 18 * * *' },
  { label: 'Every Monday 9 AM', value: '0 9 * * 1' },
  { label: 'Every weekday 9 AM', value: '0 9 * * 1-5' },
  { label: '1st of month', value: '0 9 1 * *' },
  { label: 'Custom cron...', value: '__custom__' },
]

// ─── Date Range Schedule Helpers ──────────────────────────
// Schedule is stored as JSON: {"sd":"2026-05-05","ed":"2026-05-10","st":"09:00","et":"18:00"}
// Or as a cron expression string for legacy/backward compat.

interface DateRangeSchedule {
  sd: string // start date YYYY-MM-DD
  ed: string // end date YYYY-MM-DD
  st: string // start time HH:MM
  et: string // end time HH:MM
}

function isDateRangeSchedule(s: string): boolean {
  try {
    const parsed = JSON.parse(s)
    return parsed && typeof parsed === 'object' && 'sd' in parsed
  } catch { return false }
}

function parseDateRangeSchedule(s: string): DateRangeSchedule | null {
  try {
    const parsed = JSON.parse(s)
    if (parsed && typeof parsed === 'object' && parsed.sd && parsed.ed) {
      return { sd: parsed.sd, ed: parsed.ed, st: parsed.st || '', et: parsed.et || '' }
    }
    return null
  } catch { return null }
}

function formatDateRangeSchedule(s: string): string {
  const dr = parseDateRangeSchedule(s)
  if (!dr) return s // fallback — show raw cron string
  const fmtDate = (d: string) => {
    const [y, m, day] = d.split('-')
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return `${months[parseInt(m)-1]} ${parseInt(day)}, ${y}`
  }
  const fmtTime = (t: string) => {
    if (!t) return ''
    const [h, m] = t.split(':')
    const hour = parseInt(h)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${hour12}:${m} ${ampm}`
  }
  let label = `${fmtDate(dr.sd)} → ${fmtDate(dr.ed)}`
  if (dr.st && dr.et) label += `, ${fmtTime(dr.st)} — ${fmtTime(dr.et)}`
  else if (dr.st) label += `, starting ${fmtTime(dr.st)}`
  return label
}

function emptyDateRangeSchedule(): string {
  return JSON.stringify({ sd: '', ed: '', st: '', et: '' })
}

// ─── Status Filter Tabs ──────────────────────────────────────
const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'paused', label: 'Paused' },
]

// ─── Create Task Dialog (NL + Templates + Advanced) ──────────
function CreateTaskDialog({
  open, setOpen,
}: {
  open: boolean
  setOpen: (v: boolean) => void
}) {
  const [mode, setMode] = useState<'quick' | 'advanced'>('quick')
  const [nlInput, setNlInput] = useState('')
  const [nlParsing, setNlParsing] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null)

  // Advanced form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [schedule, setSchedule] = useState('')      // raw string: cron or JSON date-range
  const [customSchedule, setCustomSchedule] = useState('')
  const [priority, setPriority] = useState('normal')
  const [category, setCategory] = useState('')

  // Date-range schedule state
  const [scheduleMode, setScheduleMode] = useState<'none' | 'range' | 'cron'>('none')
  const [rangeStartDate, setRangeStartDate] = useState('')
  const [rangeEndDate, setRangeEndDate] = useState('')
  const [rangeStartTime, setRangeStartTime] = useState('')
  const [rangeEndTime, setRangeEndTime] = useState('')

  // Attachment state
  const [attachments, setAttachments] = useState<Array<{
    name: string; path: string; size: number; savedAs: string; mimetype?: string
  }>>([])
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const createTask = useCreateUserTask()
  const triggerOrch = useTriggerOrchestrator()

  // ── File Upload ─────────────────────────────────────────
  const uploadFile = useCallback(async (file: File) => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.success) {
        setAttachments(prev => [...prev, {
          name: data.file.name,
          path: data.file.path,
          size: data.file.size,
          savedAs: data.file.savedAs,
          mimetype: file.type,
        }])
        toast({ title: 'Uploaded', description: `${data.file.name} attached ✓` })
      } else {
        toast({ title: 'Upload failed', description: data.error || 'Could not upload file.', variant: 'destructive' })
      }
    } catch (err: any) {
      toast({ title: 'Upload error', description: err.message, variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    for (let i = 0; i < files.length; i++) uploadFile(files[i])
    e.target.value = ''
  }, [uploadFile])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = e.dataTransfer.files
    for (let i = 0; i < files.length; i++) uploadFile(files[i])
  }, [uploadFile])

  const removeAttachment = useCallback((index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }, [])

  // ── NL Parsing ──────────────────────────────────────────
  const handleNlParse = useCallback(async () => {
    if (!nlInput.trim()) return
    setNlParsing(true)
    try {
      const res = await fetch('/api/tasks/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: nlInput }),
      })
      const data = await res.json()
      if (data.success) {
        const p = data.parsed
        setTitle(p.title)
        setDescription(p.description || '')
        setPriority(p.priority || 'normal')
        setSchedule(p.schedule || '')
        setCategory(p.category || '')
        setSelectedTemplate(null)
        setMode('advanced')
        toast({
          title: 'Parsed! ✨',
          description: `${p.scheduleHuman ? '⏰ ' + p.scheduleHuman + ' • ' : ''}⚡ ${p.priority} • 🏷️ ${p.category || 'none'}`,
        })
      } else {
        toast({ title: 'Could not parse', description: 'Try being more specific, or use Advanced mode.', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Parser error', description: 'Falling back to Advanced mode.', variant: 'destructive' })
      setMode('advanced')
    } finally {
      setNlParsing(false)
    }
  }, [nlInput])

  // ── Template Selection ──────────────────────────────────
  const handleTemplateSelect = useCallback((template: TaskTemplate) => {
    setSelectedTemplate(template)
    setTitle(template.defaultTitle)
    setDescription(template.defaultDescription)
    setCategory(template.defaultCategory)
    setPriority(template.defaultPriority)
    setSchedule(template.suggestedSchedule || '')
    setScheduleMode(template.suggestedSchedule ? 'cron' : 'none')
    setRangeStartDate(''); setRangeEndDate('')
    setRangeStartTime(''); setRangeEndTime('')
    setNlInput('')
  }, [])

  // ── Submit ──────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!title.trim()) return
    // Build schedule string from whatever mode is active
    let finalSchedule: string | null = null
    if (scheduleMode === 'range' && rangeStartDate && rangeEndDate) {
      finalSchedule = JSON.stringify({
        sd: rangeStartDate, ed: rangeEndDate,
        st: rangeStartTime || '', et: rangeEndTime || '',
      })
    } else if (scheduleMode === 'cron') {
      finalSchedule = schedule === '__custom__' ? (customSchedule || null) : (schedule || null)
    }
    try {
      const res = await createTask.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        schedule: finalSchedule,
        priority,
        category: category.trim() || undefined,
        attachments: attachments.length > 0
          ? attachments.map(a => ({ name: a.name, path: a.path, size: a.size, mimetype: a.mimetype }))
          : undefined,
      })
      if (res.success) {
        toast({ title: 'Task created ✨', description: `"${title.slice(0, 40)}${title.length > 40 ? '...' : ''}" ${finalSchedule ? '⏰ scheduled' : '▶️ starting now'}` })
        if (!finalSchedule) triggerOrch.mutate()
        // Reset
        setNlInput(''); setTitle(''); setDescription(''); setSchedule('')
        setCustomSchedule(''); setPriority('normal'); setCategory('')
        setScheduleMode('none'); setRangeStartDate(''); setRangeEndDate('')
        setRangeStartTime(''); setRangeEndTime('')
        setSelectedTemplate(null); setMode('quick'); setAttachments([])
        setOpen(false)
      } else {
        toast({ title: 'Failed', description: res.error || 'Could not create task.', variant: 'destructive' })
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    }
  }, [title, description, scheduleMode, rangeStartDate, rangeEndDate, rangeStartTime, rangeEndTime, schedule, customSchedule, priority, category, createTask, triggerOrch, setOpen])

  const handleClose = () => {
    setNlInput(''); setTitle(''); setDescription(''); setSchedule('')
    setCustomSchedule(''); setPriority('normal'); setCategory('')
    setScheduleMode('none'); setRangeStartDate(''); setRangeEndDate('')
    setRangeStartTime(''); setRangeEndTime('')
    setSelectedTemplate(null); setMode('quick'); setAttachments([])
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[560px] bg-[#0a0f1a] border-white/10 text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            New Task
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Type a sentence or pick a template. The parser figures out the rest.
          </DialogDescription>
        </DialogHeader>

        {/* Mode Tabs */}
        <div className="flex gap-1 mb-3 bg-white/5 rounded-lg p-1">
          <button
            onClick={() => setMode('quick')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all ${
              mode === 'quick' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5" /> Quick Create
          </button>
          <button
            onClick={() => setMode('advanced')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all ${
              mode === 'advanced' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Layout className="w-3.5 h-3.5" /> Advanced
          </button>
        </div>

        {mode === 'quick' ? (
          /* ── QUICK CREATE (NL Input) ──────────────────── */
          <div className="space-y-3">
            <div className="relative">
              <Textarea
                value={nlInput}
                onChange={e => setNlInput(e.target.value)}
                placeholder='"Research competitor pricing every Monday at 9am high priority"'
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 min-h-[60px] resize-none text-sm"
                rows={2}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleNlParse()
                  }
                }}
              />
              <button
                onClick={handleNlParse}
                disabled={!nlInput.trim() || nlParsing}
                className="absolute bottom-2 right-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 disabled:opacity-50 transition-all"
              >
                {nlParsing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                Parse
              </button>
            </div>

            {/* Templates */}
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Or pick a template</p>
              <div className="grid grid-cols-2 gap-1.5">
                {TASK_TEMPLATES.map(tmpl => (
                  <button
                    key={tmpl.id}
                    onClick={() => handleTemplateSelect(tmpl)}
                    className={`flex items-center gap-2 p-2.5 rounded-lg text-left text-xs transition-all border ${
                      selectedTemplate?.id === tmpl.id
                        ? 'border-cyan-500/30 bg-cyan-500/10 text-white'
                        : 'border-white/5 bg-white/[0.02] text-slate-400 hover:text-white hover:border-white/10'
                    }`}
                  >
                    <span className="text-base">{tmpl.icon}</span>
                    <div className="min-w-0">
                      <div className="font-medium text-[11px]">{tmpl.label}</div>
                      <div className="text-[9px] text-slate-600 truncate">{tmpl.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* ── ADVANCED MODE ────────────────────────────── */
          <div className="space-y-3 mt-1">
            <div>
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5 block">Title *</label>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="What needs to be done?"
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 h-10"
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5 block">Description</label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Details, context, requirements..."
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 min-h-[60px] resize-none text-sm"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5 block">Priority</label>
                <div className="flex gap-1">
                  {(['normal', 'high', 'urgent'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setPriority(p)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium border transition-all ${
                        priority === p ? 'border-white/30 bg-white/10 text-white' : 'border-white/5 bg-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      {p === 'urgent' ? <Zap className="w-2.5 h-2.5" /> : p === 'high' ? <AlertTriangle className="w-2.5 h-2.5" /> : <span className="w-2 h-2 rounded-full bg-slate-400" />}
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5 block">Category</label>
                <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g., research, ops" className="bg-white/5 border-white/10 text-white h-10 text-sm" />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5 block flex items-center gap-1.5">
                <Calendar className="w-3 h-3" /> Schedule
              </label>

              {/* Schedule mode selector */}
              <div className="flex gap-1.5 mb-2">
                <button
                  onClick={() => setScheduleMode('none')}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
                    scheduleMode === 'none'
                      ? 'border-slate-500/30 bg-white/10 text-white'
                      : 'border-white/5 bg-white/5 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  No schedule
                </button>
                <button
                  onClick={() => setScheduleMode('range')}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
                    scheduleMode === 'range'
                      ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
                      : 'border-white/5 bg-white/5 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Date range
                </button>
                <button
                  onClick={() => setScheduleMode('cron')}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
                    scheduleMode === 'cron'
                      ? 'border-purple-500/30 bg-purple-500/10 text-purple-300'
                      : 'border-white/5 bg-white/5 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Recurring
                </button>
              </div>

              {/* Date range inputs */}
              {scheduleMode === 'range' && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-600 mb-1 block">Start date</label>
                      <input type="date" value={rangeStartDate}
                        onChange={e => setRangeStartDate(e.target.value)}
                        className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-500/40 transition-all [color-scheme:dark]" />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-600 mb-1 block">End date</label>
                      <input type="date" value={rangeEndDate}
                        onChange={e => setRangeEndDate(e.target.value)}
                        min={rangeStartDate || undefined}
                        className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-500/40 transition-all [color-scheme:dark]" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-600 mb-1 block">Start time</label>
                      <input type="time" value={rangeStartTime}
                        onChange={e => setRangeStartTime(e.target.value)}
                        className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-500/40 transition-all [color-scheme:dark]" />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-600 mb-1 block">End time</label>
                      <input type="time" value={rangeEndTime}
                        onChange={e => setRangeEndTime(e.target.value)}
                        className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-500/40 transition-all [color-scheme:dark]" />
                    </div>
                  </div>
                </div>
              )}

              {/* Cron schedule (recurring) */}
              {scheduleMode === 'cron' && (
                <>
                  <select value={schedule} onChange={e => setSchedule(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white h-10">
                    {SCHEDULE_PRESETS.map(p => (
                      <option key={p.value} value={p.value} className="bg-[#0a0f1a]">{p.label}</option>
                    ))}
                  </select>
                  {schedule === '__custom__' && (
                    <Input value={customSchedule} onChange={e => setCustomSchedule(e.target.value)}
                      placeholder="e.g., 0 9 * * 1 (5-field cron)"
                      className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 h-9 text-sm mt-2 font-mono" />
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── ATTACHMENTS (both modes) ────────────────────── */}
        <div className="mt-3">
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-upload-input')?.click()}
            className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-4 cursor-pointer transition-all ${
              dragOver
                ? 'border-cyan-400/50 bg-cyan-500/10'
                : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
            }`}
          >
            <input
              id="file-upload-input"
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            {uploading ? (
              <Loader2 className="w-6 h-6 text-cyan-400 animate-spin mb-1" />
            ) : (
              <Paperclip className="w-5 h-5 text-slate-500 mb-1" />
            )}
            <p className="text-xs text-slate-500">
              {uploading ? 'Uploading...' : 'Drop files here or click to attach'}
            </p>
          </div>

          {/* Attached files list */}
          {attachments.length > 0 && (
            <div className="mt-2 space-y-1">
              {attachments.map((a, i) => (
                <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <File className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="text-slate-300 truncate">{a.name}</span>
                    <span className="text-slate-600 shrink-0">
                      {a.size > 1024 ? `${(a.size / 1024).toFixed(1)} MB` : `${a.size} KB`}
                    </span>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); removeAttachment(i) }}
                    className="text-slate-600 hover:text-rose-400 transition-colors shrink-0 ml-2"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={handleClose} className="text-slate-400 hover:text-white">Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || createTask.isPending}
            className="bg-cyan-600 hover:bg-cyan-500 text-white"
          >
            {createTask.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Plus className="w-4 h-4 mr-1.5" />}
            Create Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Feedback Widget ─────────────────────────────────────────
function FeedbackWidget({ taskId }: { taskId: string }) {
  const [expanded, setExpanded] = useState(false)
  const [note, setNote] = useState('')
  const createFeedback = useCreateFeedback()

  const submitFeedback = useCallback(async (type: string, rating?: number) => {
    try {
      await createFeedback.mutateAsync({ taskId, type, content: note || undefined, rating })
      toast({ title: 'Thanks!', description: 'Your feedback helps Limura improve.' })
      setNote('')
      setExpanded(false)
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    }
  }, [taskId, note, createFeedback])

  return (
    <div className="mt-2 pt-2 border-t border-white/5">
      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          <MessageSquare className="w-3 h-3" /> Leave feedback
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <button onClick={() => submitFeedback('praise')} className="p-1 rounded hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400" title="Praise">
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => submitFeedback('correction')} className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400" title="Correction">
              <ThumbsDown className="w-3.5 h-3.5" />
            </button>
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} onClick={() => submitFeedback('rating', n)} className="p-1 rounded hover:bg-amber-500/20 text-slate-400 hover:text-amber-400" title={`${n} stars`}>
                <Star className={`w-3.5 h-3.5 ${n <= 3 ? 'fill-none' : ''}`} />
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            <Input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Quick note (optional)..."
              className="bg-white/5 border-white/10 text-white text-xs h-7 placeholder:text-slate-600"
            />
            <button onClick={() => { setNote(''); setExpanded(false) }} className="text-slate-500 hover:text-slate-300">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Task Card ───────────────────────────────────────────────
function TaskCard({
  task,
  onStart,
  onPause,
  onDelete,
  onEdit,
}: {
  task: Task
  onStart: (id: string) => void
  onPause: (id: string) => void
  onDelete: (id: string) => void
  onEdit: (task: Task) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const { data: missionsData } = useMissions()

  const childMissions = missionsData?.missions?.filter(m =>
    // We show missions that are associated with this task via the taskId field
    // Since the GET /api/missions doesn't yet return taskId, we skip the filter for now
    false
  ) || []

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={`rounded-xl border p-3.5 transition-all duration-200 ${
        task.status === 'in_progress'
          ? 'border-amber-500/30 bg-amber-500/5'
          : task.status === 'completed'
          ? 'border-emerald-500/20 bg-emerald-500/5'
          : task.status === 'failed'
          ? 'border-rose-500/20 bg-rose-500/5'
          : 'border-white/5 bg-white/[0.02] hover:border-white/10'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: expand + content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Expand/collapse */}
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-slate-500 hover:text-slate-300 shrink-0 mt-0.5"
            >
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>

            {/* Title */}
            <span className={`text-sm font-medium truncate ${
              task.status === 'completed' ? 'text-slate-400' : 'text-white'
            }`}>
              {task.title}
            </span>

            {/* Priority */}
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${priorityBadge[task.priority]}`}>
              {priorityIcon[task.priority]}
              {task.priority}
            </span>

            {/* Status */}
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${statusBadge[task.status]}`}>
              {task.status === 'in_progress' && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
              {task.status === 'completed' && <CheckCircle2 className="w-2.5 h-2.5" />}
              {task.status === 'failed' && <XCircle className="w-2.5 h-2.5" />}
              {task.status === 'scheduled' && <Calendar className="w-2.5 h-2.5" />}
              {task.status.replace('_', ' ')}
            </span>

            {/* Schedule indicator */}
            {task.schedule && (
              <span className="text-[10px] text-slate-500 flex items-center gap-1" title={task.schedule}>
                <Clock className="w-2.5 h-2.5" />
                {isDateRangeSchedule(task.schedule) ? formatDateRangeSchedule(task.schedule) : task.schedule}
              </span>
            )}

            {/* Category */}
            {task.category && (
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <Tag className="w-2.5 h-2.5" />{task.category}
              </span>
            )}

            {/* Attachment count */}
            {task.attachments && task.attachments.length > 0 && (
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <Paperclip className="w-2.5 h-2.5" />{task.attachments.length}
              </span>
            )}
          </div>

          {/* Description preview */}
          {task.description && (
            <p className="text-xs text-slate-500 mt-1 line-clamp-2 ml-6">{task.description}</p>
          )}

          {/* Mission progress */}
          {task.missionCount > 0 && (
            <div className="ml-6 mt-2">
              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                <span>Missions: {task.completedMissions}/{task.missionCount}</span>
                <div className="w-20 h-1 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-cyan-500 transition-all"
                    style={{ width: `${task.missionCount > 0 ? (task.completedMissions / task.missionCount) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Expanded: feedback widget */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="ml-6 overflow-hidden"
              >
                {task.description && (
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">{task.description}</p>
                )}

                {/* Attachments in expanded view */}
                {task.attachments && task.attachments.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                      <Paperclip className="w-3 h-3" /> Attachments ({task.attachments.length})
                    </p>
                    {task.attachments.map(att => (
                      <div key={att.id} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          {att.mimetype?.startsWith('image/') ? (
                            <Image className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          ) : (
                            <File className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          )}
                          <span className="text-slate-300 truncate">{att.filename}</span>
                          <span className="text-slate-600 shrink-0">
                            {att.size > 1024 ? `${(att.size / 1024).toFixed(1)} MB` : `${att.size} KB`}
                          </span>
                        </div>
                        <a
                          href={`/api/upload/download?path=${encodeURIComponent(att.filepath)}&name=${encodeURIComponent(att.filename)}`}
                          download={att.filename}
                          className="text-slate-500 hover:text-cyan-400 transition-colors shrink-0 ml-2"
                          title="Download"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}

                <FeedbackWidget taskId={task.id} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          {task.status === 'pending' && (
            <button
              onClick={() => onStart(task.id)}
              className="p-1.5 rounded-lg hover:bg-emerald-500/20 text-slate-500 hover:text-emerald-400 transition-colors"
              title="Start now"
            >
              <Play className="w-3.5 h-3.5" />
            </button>
          )}
          {task.status === 'in_progress' && (
            <button
              onClick={() => onPause(task.id)}
              className="p-1.5 rounded-lg hover:bg-amber-500/20 text-slate-500 hover:text-amber-400 transition-colors"
              title="Pause"
            >
              <Pause className="w-3.5 h-3.5" />
            </button>
          )}
          {task.status === 'paused' && (
            <button
              onClick={() => onStart(task.id)}
              className="p-1.5 rounded-lg hover:bg-emerald-500/20 text-slate-500 hover:text-emerald-400 transition-colors"
              title="Resume"
            >
              <Play className="w-3.5 h-3.5" />
            </button>
          )}
          {(task.status === 'completed' || task.status === 'failed') && (
            <button
              onClick={() => onStart(task.id)}
              className="p-1.5 rounded-lg hover:bg-emerald-500/20 text-slate-500 hover:text-emerald-400 transition-colors"
              title="Rerun"
            >
              <Play className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => onEdit(task)}
            className="p-1.5 rounded-lg hover:bg-sky-500/20 text-slate-500 hover:text-sky-400 transition-colors"
            title="Edit"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(task.id)}
            className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Edit Task Dialog ────────────────────────────────────────
function EditTaskDialog({
  task, open, setOpen,
}: {
  task: Task | null
  open: boolean
  setOpen: (v: boolean) => void
}) {
  const [title, setTitle] = useState(task?.title || '')
  const [description, setDescription] = useState(task?.description || '')
  const [priority, setPriority] = useState(task?.priority || 'normal')
  const [category, setCategory] = useState(task?.category || '')
  const [schedule, setSchedule] = useState(task?.schedule || '')
  const [customSchedule, setCustomSchedule] = useState('')

  // Date-range schedule state
  const [scheduleMode, setScheduleMode] = useState<'none' | 'range' | 'cron'>('none')
  const [rangeStartDate, setRangeStartDate] = useState('')
  const [rangeEndDate, setRangeEndDate] = useState('')
  const [rangeStartTime, setRangeStartTime] = useState('')
  const [rangeEndTime, setRangeEndTime] = useState('')

  const updateTask = useUpdateUserTask()

  // Sync state when task prop changes
  useState(() => {
    if (task) {
      setTitle(task.title)
      setDescription(task.description || '')
      setPriority(task.priority)
      setCategory(task.category || '')
      const sched = task.schedule || ''
      setSchedule(sched)
      // Detect schedule type
      if (!sched) {
        setScheduleMode('none')
      } else if (isDateRangeSchedule(sched)) {
        setScheduleMode('range')
        const dr = parseDateRangeSchedule(sched)
        if (dr) {
          setRangeStartDate(dr.sd)
          setRangeEndDate(dr.ed)
          setRangeStartTime(dr.st)
          setRangeEndTime(dr.et)
        }
      } else {
        setScheduleMode('cron')
        setCustomSchedule('')
      }
    }
  })

  const handleSave = useCallback(async () => {
    if (!task || !title.trim()) return
    // Build schedule string from whatever mode is active
    let finalSchedule: string | null = null
    if (scheduleMode === 'range' && rangeStartDate && rangeEndDate) {
      finalSchedule = JSON.stringify({
        sd: rangeStartDate, ed: rangeEndDate,
        st: rangeStartTime || '', et: rangeEndTime || '',
      })
    } else if (scheduleMode === 'cron') {
      finalSchedule = schedule === '__custom__' ? (customSchedule || null) : (schedule || null)
    }
    try {
      await updateTask.mutateAsync({
        id: task.id,
        title: title.trim(),
        description: description.trim() || null,
        priority,
        category: category.trim() || null,
        schedule: finalSchedule,
      })
      toast({ title: 'Task updated', description: `"${title}" saved.` })
      setOpen(false)
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    }
  }, [task, title, description, priority, category, scheduleMode, rangeStartDate, rangeEndDate, rangeStartTime, rangeEndTime, schedule, customSchedule, updateTask, setOpen])

  if (!task) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[520px] bg-[#0a0f1a] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-sky-400" /> Edit Task
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5 block">Title</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} className="bg-white/5 border-white/10 text-white h-10" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5 block">Description</label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} className="bg-white/5 border-white/10 text-white min-h-[80px] resize-none" rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5 block">Priority</label>
              <div className="flex gap-1.5">
                {(['normal', 'high', 'urgent'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      priority === p ? 'border-white/30 bg-white/10 text-white' : 'border-white/5 bg-white/5 text-slate-400'
                    }`}
                  >
                    {priorityIcon[p]} {p}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5 block">Category</label>
              <Input value={category} onChange={e => setCategory(e.target.value)} className="bg-white/5 border-white/10 text-white h-10 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5 block flex items-center gap-1.5">
              <Calendar className="w-3 h-3" /> Schedule
            </label>

            {/* Schedule mode selector */}
            <div className="flex gap-1.5 mb-2">
              <button
                onClick={() => { setScheduleMode('none'); setSchedule('') }}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
                  scheduleMode === 'none'
                    ? 'border-slate-500/30 bg-white/10 text-white'
                    : 'border-white/5 bg-white/5 text-slate-500 hover:text-slate-300'
                }`}
              >
                No schedule
              </button>
              <button
                onClick={() => setScheduleMode('range')}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
                  scheduleMode === 'range'
                    ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
                    : 'border-white/5 bg-white/5 text-slate-500 hover:text-slate-300'
                }`}
              >
                Date range
              </button>
              <button
                onClick={() => setScheduleMode('cron')}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
                  scheduleMode === 'cron'
                    ? 'border-purple-500/30 bg-purple-500/10 text-purple-300'
                    : 'border-white/5 bg-white/5 text-slate-500 hover:text-slate-300'
                }`}
              >
                Recurring
              </button>
            </div>

            {/* Date range inputs */}
            {scheduleMode === 'range' && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-600 mb-1 block">Start date</label>
                    <input type="date" value={rangeStartDate}
                      onChange={e => setRangeStartDate(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-500/40 transition-all [color-scheme:dark]" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-600 mb-1 block">End date</label>
                    <input type="date" value={rangeEndDate}
                      onChange={e => setRangeEndDate(e.target.value)}
                      min={rangeStartDate || undefined}
                      className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-500/40 transition-all [color-scheme:dark]" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-600 mb-1 block">Start time</label>
                    <input type="time" value={rangeStartTime}
                      onChange={e => setRangeStartTime(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-500/40 transition-all [color-scheme:dark]" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-600 mb-1 block">End time</label>
                    <input type="time" value={rangeEndTime}
                      onChange={e => setRangeEndTime(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-500/40 transition-all [color-scheme:dark]" />
                  </div>
                </div>
                {rangeStartDate && rangeEndDate && (
                  <p className="text-[10px] text-cyan-500/70">
                    {formatDateRangeSchedule(JSON.stringify({
                      sd: rangeStartDate, ed: rangeEndDate,
                      st: rangeStartTime || '', et: rangeEndTime || '',
                    }))}
                  </p>
                )}
              </div>
            )}

            {/* Cron schedule (recurring) */}
            {scheduleMode === 'cron' && (
              <>
                <select value={schedule} onChange={e => setSchedule(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white h-10">
                  {SCHEDULE_PRESETS.map(p => (
                    <option key={p.value} value={p.value} className="bg-[#0a0f1a]">{p.label}</option>
                  ))}
                </select>
                {schedule === '__custom__' && (
                  <Input value={customSchedule} onChange={e => setCustomSchedule(e.target.value)}
                    placeholder="e.g., 0 9 * * 1 (5-field cron)"
                    className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 h-9 text-sm mt-2 font-mono" />
                )}
              </>
            )}
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={() => setOpen(false)} className="text-slate-400">Cancel</Button>
          <Button onClick={handleSave} disabled={!title.trim()} className="bg-sky-600 hover:bg-sky-500 text-white">Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Tasks Panel ────────────────────────────────────────
export default function TasksPanel() {
  const [activeFilter, setActiveFilter] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  const { data, isLoading } = useUserTasks(activeFilter || undefined, undefined, undefined, '')
  const updateTask = useUpdateUserTask()
  const deleteTask = useDeleteUserTask()
  const triggerOrch = useTriggerOrchestrator()

  const tasks = data?.tasks || []

  const handleStart = useCallback(async (taskId: string) => {
    try {
      await updateTask.mutateAsync({ id: taskId, status: 'pending' })
      triggerOrch.mutate()
      toast({ title: 'Task started', description: 'Limura will process it now.' })
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    }
  }, [updateTask, triggerOrch])

  const handlePause = useCallback(async (taskId: string) => {
    await updateTask.mutateAsync({ id: taskId, status: 'paused' })
    toast({ title: 'Task paused', description: 'It can be resumed later.' })
  }, [updateTask])

  const handleDelete = useCallback(async (taskId: string) => {
    await deleteTask.mutateAsync(taskId)
    toast({ title: 'Task deleted' })
  }, [deleteTask])

  const handleEdit = useCallback((task: Task) => {
    setEditTask(task)
    setEditOpen(true)
  }, [])

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Task Queue</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Create tasks for Limura to decompose and execute
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-cyan-600 hover:bg-cyan-500 text-white h-9 text-sm"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          New Task
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 mb-3 overflow-x-auto shrink-0 pb-1">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              activeFilter === tab.key
                ? 'bg-white/10 text-white'
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Separator className="bg-white/5 mb-3" />

      {/* Task List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
              <Filter className="w-5 h-5 text-slate-600" />
            </div>
            <p className="text-sm text-slate-500">No tasks found</p>
            <p className="text-xs text-slate-600 mt-1">
              {activeFilter ? 'Try a different filter or ' : ''}
              create your first task above.
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {tasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onStart={handleStart}
                onPause={handlePause}
                onDelete={handleDelete}
                onEdit={handleEdit}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Dialogs */}
      <CreateTaskDialog open={createOpen} setOpen={setCreateOpen} />
      <EditTaskDialog task={editTask} open={editOpen} setOpen={setEditOpen} />
    </div>
  )
}
