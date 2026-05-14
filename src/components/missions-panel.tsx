'use client'

import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Target, Plus, Play, Pause, Trash2, RefreshCw, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, Loader2, FileText, Link2, Send, Layers, List,
  AlertTriangle, Ban, ArrowRightCircle, MessageSquare, Star,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { toast } from '@/hooks/use-toast'
import { useProjectContext } from '@/lib/project-context'
import {
  useMissions, usePhases, useSprints, useCreateMission,
  useCreatePhase, useCreateSprint,
  useAgentTasks, useUserTasks, useTriggerOrchestrator, useCreateFeedback,
  type Mission, type AgentTask, type Task,
} from '@/hooks/use-dashboard-data'

// ─── Styles ──────────────────────────────────────────────────
const statusColors: Record<string, string> = {
  pending: 'text-slate-400', analyzing: 'text-purple-400', assigning: 'text-cyan-400',
  in_progress: 'text-amber-400', completed: 'text-emerald-400', failed: 'text-rose-400',
  blocked: 'text-red-400', awaiting_feedback: 'text-yellow-400',
}
const statusBg: Record<string, string> = {
  pending: 'bg-slate-500/10 border-slate-500/20', analyzing: 'bg-purple-500/10 border-purple-500/20',
  assigning: 'bg-cyan-500/10 border-cyan-500/20', in_progress: 'bg-amber-500/10 border-amber-500/20',
  completed: 'bg-emerald-500/10 border-emerald-500/20', failed: 'bg-rose-500/10 border-rose-500/20',
  blocked: 'bg-red-500/10 border-red-500/20', awaiting_feedback: 'bg-yellow-500/10 border-yellow-500/20',
}
const statusDot: Record<string, string> = {
  pending: 'bg-slate-500', analyzing: 'bg-purple-400 animate-pulse', assigning: 'bg-cyan-400 animate-pulse',
  in_progress: 'bg-amber-400 animate-pulse', completed: 'bg-emerald-400', failed: 'bg-rose-400',
  blocked: 'bg-red-400', awaiting_feedback: 'bg-yellow-400',
}

const STATUS_TABS = [
  { key: '', label: 'All' }, { key: 'pending', label: 'Pending' },
  { key: 'in_progress', label: 'In Progress' }, { key: 'completed', label: 'Completed' },
  { key: 'failed', label: 'Failed' }, { key: 'blocked', label: 'Blocked' },
]

function timeAgo(dateStr: string): string {
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

/** Format progress as percentage string */
function pct(progress: number): string {
  return `${Math.round(progress * 100)}%`
}

// ─── Progress Bar ────────────────────────────────────────────
function ProgressBar({ progress, size = 'sm', color = 'purple' }: {
  progress: number; size?: 'sm' | 'md'; color?: string
}) {
  const height = size === 'md' ? 'h-2' : 'h-1.5'
  const colors: Record<string, string> = {
    purple: 'bg-gradient-to-r from-purple-500 to-cyan-500',
    amber: 'bg-gradient-to-r from-amber-500 to-rose-500',
    emerald: 'bg-emerald-500',
    slate: 'bg-slate-600',
  }
  const bgColor = colors[color] || colors.purple
  return (
    <div className={`${height} rounded-full bg-white/5 overflow-hidden flex-1 max-w-[160px]`}>
      <div
        className={`${height} rounded-full ${bgColor} transition-all duration-700`}
        style={{ width: `${Math.min(progress * 100, 100)}%` }}
      />
    </div>
  )
}

// ─── Agent Task Row ──────────────────────────────────────────
function AgentTaskRow({ task }: { task: AgentTask }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="ml-8 border-l-2 border-white/5 pl-3 py-1.5">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 text-xs w-full text-left group">
        <span className={`w-1.5 h-1.5 rounded-full ${statusDot[task.status] || 'bg-slate-500'}`} />
        <span className="text-slate-300 truncate flex-1">{task.task}</span>
        <Badge variant="outline" className={`text-[9px] ${statusColors[task.status]} ${statusBg[task.status]}`}>{task.status}</Badge>
        {task.agentName && <span className="text-[9px] text-slate-600">{task.agentName}</span>}
        <ChevronRight className={`w-3 h-3 text-slate-600 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="mt-1.5 space-y-1">
          {task.result && <p className="text-[10px] text-slate-400 bg-white/5 p-2 rounded">Result: {task.result}</p>}
          {task.report && <p className="text-[10px] text-slate-500 bg-white/5 p-2 rounded whitespace-pre-wrap line-clamp-4">{task.report}</p>}
          {task.error && <p className="text-[10px] text-rose-400 bg-rose-500/5 p-2 rounded">{task.error}</p>}
        </div>
      )}
    </div>
  )
}

// ─── Sprint Card ─────────────────────────────────────────────
function SprintCard({ sprint, onRerun, onStop, onDelete }: {
  sprint: Mission; onRerun: (id: string) => void; onStop: (id: string) => void; onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false)
  const [showTasks, setShowTasks] = useState(false)
  const { data: tasksData } = useAgentTasks(undefined, expanded ? sprint.id : undefined)
  const childTasks = tasksData?.tasks || []
  const progPct = sprint.progress ?? 0

  return (
    <motion.div layout initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
      className={`rounded-lg border p-3 transition-all ml-6 ${statusBg[sprint.status]} ${
        sprint.status === 'blocked' ? 'border-red-500/30' : 'hover:border-white/10'
      }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => { setExpanded(!expanded); setShowTasks(false) }}
              className="text-slate-500 hover:text-slate-300 shrink-0">
              {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot[sprint.status]}`} />
            <span className="text-xs font-medium text-white truncate">{sprint.title}</span>
            <Badge variant="outline" className={`text-[8px] ${statusColors[sprint.status]} ${statusBg[sprint.status]}`}>
              {sprint.status.replace('_', ' ')}
            </Badge>
            {sprint.status === 'blocked' && sprint.blockedReason && (
              <span className="text-[9px] text-red-400 flex items-center gap-1">
                <Ban className="w-2.5 h-2.5" />{sprint.blockedReason.slice(0, 30)}
              </span>
            )}
          </div>
          {/* Sprint progress bar */}
          <div className="ml-7 mt-1.5 flex items-center gap-2">
            <ProgressBar progress={progPct} color={sprint.status === 'blocked' ? 'slate' : 'amber'} />
            <span className="text-[10px] text-slate-500 min-w-[3ch]">{pct(progPct)}</span>
            {sprint.taskCount > 0 && (
              <span className="text-[9px] text-slate-600">{sprint.completedTasks}/{sprint.taskCount} tasks</span>
            )}
            {sprint.completedAt && <span className="text-[9px] text-slate-600">{timeAgo(sprint.completedAt)}</span>}
          </div>
          {/* Expandable: description + agent tasks */}
          <AnimatePresence>
            {expanded && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="ml-7 overflow-hidden mt-2 space-y-2">
                <p className="text-[11px] text-slate-400 leading-relaxed">{sprint.description}</p>
                {sprint.summary && (
                  <div className="bg-white/5 rounded-lg p-2">
                    <span className="text-[8px] text-slate-500 uppercase tracking-wider">Summary</span>
                    <p className="text-[11px] text-slate-300 mt-0.5">{sprint.summary}</p>
                  </div>
                )}
                <button onClick={() => setShowTasks(!showTasks)}
                  className="flex items-center gap-1.5 text-[10px] text-purple-400 hover:text-purple-300">
                  <FileText className="w-3 h-3" />{showTasks ? 'Hide tasks' : `Agent tasks (${childTasks.length})`}
                </button>
                {showTasks && childTasks.length > 0 && (
                  <div className="space-y-0.5">{childTasks.map(t => <AgentTaskRow key={t.id} task={t} />)}</div>
                )}
                {showTasks && childTasks.length === 0 && (
                  <p className="text-[10px] text-slate-600 ml-5">No agent tasks yet.</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {(sprint.status === 'completed' || sprint.status === 'failed') && (
            <button onClick={() => onRerun(sprint.id)}
              className="p-1.5 rounded-lg hover:bg-emerald-500/15 text-slate-500 hover:text-emerald-400"
              title="Rerun"><RefreshCw className="w-3 h-3" /></button>
          )}
          {(sprint.status === 'analyzing' || sprint.status === 'assigning' || sprint.status === 'in_progress') && (
            <button onClick={() => onStop(sprint.id)}
              className="p-1.5 rounded-lg hover:bg-rose-500/15 text-slate-500 hover:text-rose-400"
              title="Stop"><Pause className="w-3 h-3" /></button>
          )}
          <button onClick={() => onDelete(sprint.id)}
            className="p-1.5 rounded-lg hover:bg-rose-500/15 text-slate-500 hover:text-rose-400"
            title="Delete"><Trash2 className="w-3 h-3" /></button>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Phase Card ──────────────────────────────────────────────
function PhaseCard({ phase, parentTask, onRerun, onStop, onDelete, onAddSprint }: {
  phase: Mission; parentTask?: Task | null;
  onRerun: (id: string) => void; onStop: (id: string) => void;
  onDelete: (id: string) => void; onAddSprint: (phaseId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true) // default expanded for phases
  const progPct = phase.progress ?? 0

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-4 transition-all ${
        phase.status === 'in_progress' ? 'border-amber-500/20 bg-amber-500/[0.02]' :
        phase.status === 'completed' ? 'border-emerald-500/20 bg-emerald-500/[0.02]' :
        phase.status === 'blocked' ? 'border-red-500/20 bg-red-500/[0.02]' :
        'border-white/5 bg-white/[0.01]'
      }`}>
      {/* Phase header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setExpanded(!expanded)} className="text-slate-500 hover:text-slate-300 shrink-0">
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{
              background: phase.status === 'completed' ? '#10b981' :
                          phase.status === 'in_progress' ? '#f59e0b' :
                          phase.status === 'blocked' ? '#ef4444' : '#64748b',
              boxShadow: phase.status === 'in_progress' ? '0 0 6px #f59e0b80' : 'none',
            }} />
            <span className="text-sm font-semibold text-white truncate">{phase.title}</span>
            <Badge variant="outline" className="text-[9px] border-purple-500/30 text-purple-400 bg-purple-500/10">
              Phase
            </Badge>
            <Badge variant="outline" className={`text-[9px] ${statusColors[phase.status]} ${statusBg[phase.status]}`}>
              {phase.status.replace('_', ' ')}
            </Badge>
            {parentTask && (
              <Badge variant="outline" className="text-[9px] border-cyan-500/20 text-cyan-400 bg-cyan-500/5">
                <Link2 className="w-2.5 h-2.5 mr-0.5" />{parentTask.title.slice(0, 25)}
              </Badge>
            )}
            {phase.status === 'blocked' && phase.blockedReason && (
              <span className="text-[10px] text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />{phase.blockedReason.slice(0, 40)}
              </span>
            )}
          </div>
          {/* Phase progress bar — prominent */}
          <div className="ml-9 mt-2.5 flex items-center gap-3">
            <ProgressBar progress={progPct} size="md" color={phase.status === 'completed' ? 'emerald' : 'purple'} />
            <span className="text-sm font-mono font-bold min-w-[4ch]"
              style={{ color: progPct >= 1 ? '#10b981' : '#a78bfa' }}>{pct(progPct)}</span>
            {phase.childCount > 0 && (
              <span className="text-[10px] text-slate-500">
                {phase.completedChildren}/{phase.childCount} sprints
              </span>
            )}
            {phase.completedAt && <span className="text-[10px] text-slate-600">{timeAgo(phase.completedAt)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {/* Add Sprint button (only when phase is active) */}
          {!['completed', 'failed', 'cancelled'].includes(phase.status) && (
            <button onClick={() => onAddSprint(phase.id)}
              className="p-1.5 rounded-lg hover:bg-purple-500/15 text-slate-500 hover:text-purple-400"
              title="Add Sprint"><Plus className="w-3.5 h-3.5" /></button>
          )}
          {(phase.status === 'completed' || phase.status === 'failed') && (
            <button onClick={() => onRerun(phase.id)}
              className="p-1.5 rounded-lg hover:bg-emerald-500/15 text-slate-500 hover:text-emerald-400"
              title="Rerun"><RefreshCw className="w-3.5 h-3.5" /></button>
          )}
          {(phase.status === 'in_progress' || phase.status === 'analyzing') && (
            <button onClick={() => onStop(phase.id)}
              className="p-1.5 rounded-lg hover:bg-rose-500/15 text-slate-500 hover:text-rose-400"
              title="Stop"><Pause className="w-3.5 h-3.5" /></button>
          )}
          <button onClick={() => onDelete(phase.id)}
            className="p-1.5 rounded-lg hover:bg-rose-500/15 text-slate-500 hover:text-rose-400"
            title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* Expandable: description + sprints */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} className="overflow-hidden mt-3 space-y-3">
            <p className="text-xs text-slate-400 leading-relaxed ml-9">{phase.description}</p>
            {phase.summary && (
              <div className="ml-9 bg-white/5 rounded-lg p-2.5">
                <span className="text-[9px] text-slate-500 uppercase tracking-wider">Phase Summary</span>
                <p className="text-xs text-slate-300 mt-0.5">{phase.summary}</p>
              </div>
            )}

            {/* Sprint list */}
            <div className="ml-2 space-y-1.5">
              <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase tracking-wider px-2">
                <Layers className="w-3 h-3" /> Sprints
                {phase.childCount > 0 && <span>({phase.completedChildren}/{phase.childCount} complete)</span>}
              </div>
              {phase.childMissions && phase.childMissions.length > 0 ? (
                <AnimatePresence mode="popLayout">
                  {phase.childMissions.map(cm => (
                    <SprintCard key={cm.id} sprint={cm as Mission}
                      onRerun={onRerun} onStop={onStop} onDelete={onDelete} />
                  ))}
                </AnimatePresence>
              ) : (
                <div className="flex flex-col items-center py-4 text-center ml-4">
                  <ArrowRightCircle className="w-5 h-5 text-slate-600 mb-1" />
                  <p className="text-xs text-slate-500">No sprints yet. Click <span className="text-purple-400">+</span> to add one.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Legacy Mission Card (for "All Missions" flat view) ─────
function LegacyMissionCard({ mission, parentTask, onRerun, onStop, onDelete }: {
  mission: Mission; parentTask?: Task | null;
  onRerun: (id: string) => void; onStop: (id: string) => void; onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false)
  const [showTasks, setShowTasks] = useState(false)
  const { data: tasksData } = useAgentTasks(undefined, expanded ? mission.id : undefined)
  const childTasks = tasksData?.tasks || []
  const progPct = mission.progress ?? 0

  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
      className={`rounded-xl border p-3.5 transition-all ${statusBg[mission.status]} ${
        mission.status === 'in_progress' ? 'hover:border-amber-500/30' : 'hover:border-white/10'
      }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setExpanded(!expanded)} className="text-slate-500 hover:text-slate-300 shrink-0">
              {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
            <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot[mission.status]}`} />
            <span className="text-sm font-medium text-white truncate">{mission.title}</span>
            {mission.type === 'phase' && <Badge variant="outline" className="text-[9px] border-purple-500/30 text-purple-400 bg-purple-500/10">Phase</Badge>}
            {mission.type === 'sprint' && <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-400 bg-amber-500/10">Sprint</Badge>}
            <Badge variant="outline" className={`text-[9px] ${statusColors[mission.status]} ${statusBg[mission.status]}`}>
              {mission.status.replace('_', ' ')}
            </Badge>
            {parentTask && (
              <Badge variant="outline" className="text-[9px] border-cyan-500/20 text-cyan-400 bg-cyan-500/5">
                <Link2 className="w-2.5 h-2.5 mr-0.5" />{parentTask.title.slice(0, 25)}
              </Badge>
            )}
          </div>
          {/* Progress bar */}
          {(mission.taskCount > 0 || mission.childCount > 0) && (
            <div className="ml-7 mt-2 flex items-center gap-2">
              <ProgressBar progress={progPct} />
              <span className="text-[10px] text-slate-500">{pct(progPct)}</span>
              {mission.childCount > 0 && (
                <span className="text-[9px] text-slate-600">{mission.completedChildren}/{mission.childCount} children</span>
              )}
              {mission.taskCount > 0 && !mission.childCount && (
                <span className="text-[9px] text-slate-600">{mission.completedTasks}/{mission.taskCount} tasks</span>
              )}
              {mission.completedAt && <span className="text-[9px] text-slate-600">{timeAgo(mission.completedAt)}</span>}
            </div>
          )}
          <AnimatePresence>
            {expanded && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="ml-7 overflow-hidden mt-2 space-y-2">
                <p className="text-xs text-slate-400 leading-relaxed">{mission.description}</p>
                {mission.summary && (
                  <div className="bg-white/5 rounded-lg p-2.5">
                    <span className="text-[9px] text-slate-500 uppercase tracking-wider">Summary</span>
                    <p className="text-xs text-slate-300 mt-0.5">{mission.summary}</p>
                  </div>
                )}
                <button onClick={() => setShowTasks(!showTasks)}
                  className="flex items-center gap-1.5 text-[10px] text-purple-400 hover:text-purple-300">
                  <FileText className="w-3 h-3" />{showTasks ? 'Hide agent tasks' : `View agent tasks (${childTasks.length})`}
                </button>
                {showTasks && childTasks.length > 0 && (
                  <div className="space-y-0.5">{childTasks.map(t => <AgentTaskRow key={t.id} task={t} />)}</div>
                )}
                {showTasks && childTasks.length === 0 && <p className="text-[10px] text-slate-600 ml-5">No agent tasks yet.</p>}

                {/* Feedback section — available for missions tied to a user task */}
                {mission.taskId && (mission.status === 'awaiting_feedback' || mission.status === 'completed') && (
                  <FeedbackWidget taskId={mission.taskId} />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {(mission.status === 'completed' || mission.status === 'failed') && (
            <button onClick={() => onRerun(mission.id)}
              className="p-1.5 rounded-lg hover:bg-emerald-500/15 text-slate-500 hover:text-emerald-400"
              title="Rerun"><RefreshCw className="w-3.5 h-3.5" /></button>
          )}
          {(mission.status === 'analyzing' || mission.status === 'assigning' || mission.status === 'in_progress') && (
            <button onClick={() => onStop(mission.id)}
              className="p-1.5 rounded-lg hover:bg-rose-500/15 text-slate-500 hover:text-rose-400"
              title="Stop"><Pause className="w-3.5 h-3.5" /></button>
          )}
          <button onClick={() => onDelete(mission.id)}
            className="p-1.5 rounded-lg hover:bg-rose-500/15 text-slate-500 hover:text-rose-400"
            title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Feedback Widget (inline in mission cards) ───────────────
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
    <div className="ml-7 mt-2 pt-2 border-t border-white/5">
      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1.5 text-xs text-yellow-400 hover:text-yellow-300 transition-colors"
        >
          <MessageSquare className="w-3 h-3" /> Leave feedback
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-[9px] text-slate-500 uppercase tracking-wider">How was the output?</p>
          <div className="flex items-center gap-1.5">
            <button onClick={() => submitFeedback('praise')} className="p-1 rounded hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400" title="Praise">
              👍
            </button>
            <button onClick={() => submitFeedback('correction')} className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400" title="Correction">
              👎
            </button>
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} onClick={() => submitFeedback('rating', n)} className="p-1 rounded hover:bg-amber-500/20 text-slate-400 hover:text-amber-400" title={`${n} stars`}>
                <Star className={`w-3.5 h-3.5 ${n <= 3 ? 'fill-none' : 'fill-amber-400'}`} />
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
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── New Sprint Dialog ───────────────────────────────────────
function NewSprintForm({ phaseId, onCreated, onClose }: {
  phaseId: string; onCreated: () => void; onClose: () => void;
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [success, setSuccess] = useState(false)
  const createSprint = useCreateSprint()

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) return
    try {
      await createSprint.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        parentMissionId: phaseId,
      })
      toast({ title: 'Sprint created!', description: 'Added to phase for execution.' })
      setTitle(''); setDescription('')
      setSuccess(true); setTimeout(() => { setSuccess(false); onCreated() }, 1500)
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="glass-card p-6 w-full max-w-[480px] m-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-rose-500">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white">New Sprint</h2>
            <p className="text-xs text-slate-400">Working mission within this phase.</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl leading-none">&times;</button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">Sprint Title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g., Research competitor pricing"
              className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-amber-500/40 transition-all" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">Sprint Description</label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="What needs to be done in this sprint?"
              className="min-h-[100px] bg-white/5 border-white/10 text-white text-sm placeholder:text-slate-600 rounded-xl focus:border-amber-500/40" />
          </div>
          <Button onClick={handleSubmit} disabled={!title.trim() || !description.trim() || createSprint.isPending}
            className="w-full h-11 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-white font-medium rounded-xl">
            {createSprint.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating Sprint...</>
            ) : (
              <><Layers className="w-4 h-4 mr-2" /> Create Sprint</>
            )}
          </Button>
          {success && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Sprint created!
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

// ─── New Mission Dialog ────────────────────────────────────────
function NewMissionForm({ onCreated, onClose }: {
  onCreated: () => void; onClose: () => void;
}) {
  const { projectId } = useProjectContext()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [success, setSuccess] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState<Array<{name: string; path: string; size: number}>>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const createMission = useCreateMission()

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/upload', { method: 'POST', body: formData })
        const data = await res.json()
        if (data.success) {
          setAttachedFiles(prev => [...prev, data.file])
        }
      }
    } catch (err) {
      console.error('Upload failed:', err)
      toast({ title: 'Upload failed', description: 'Could not upload file. Please try again.', variant: 'destructive' })
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeFile = (path: string) => {
    setAttachedFiles(prev => prev.filter(f => f.path !== path))
  }

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) return
    let fullDescription = description.trim()
    if (attachedFiles.length > 0) {
      const fileList = attachedFiles.map(f => `[Attached: ${f.name} (${f.size} KB)] -> ${f.path}`).join('\\n')
      fullDescription += `\\n\\n--- Attached Files ---\\n${fileList}`
    }
    try {
      await createMission.mutateAsync({ title: title.trim(), description: fullDescription, projectId })
      toast({ title: 'Mission created!', description: 'Click Start in the header to begin processing.' })
      setTitle(''); setDescription(''); setAttachedFiles([])
      setSuccess(true); setTimeout(() => { setSuccess(false); onCreated() }, 1500)
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="glass-card p-6 w-full max-w-[520px] m-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500">
            <Target className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white">New Mission</h2>
            <p className="text-xs text-slate-400">A standalone mission for Limura to execute. Attach files to provide context.</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl leading-none">&times;</button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">Mission Title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g., Research competitor pricing"
              className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-purple-500/40 transition-all" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">Mission Description</label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Describe what needs to be done in detail. Include requirements, specifications, and any reference information..."
              className="min-h-[120px] bg-white/5 border-white/10 text-white text-sm placeholder:text-slate-600 rounded-xl focus:border-purple-500/40" />
          </div>

          {/* File Attachment */}
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">Attachments (optional)</label>
            <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" />
            <div className="flex flex-wrap gap-2 mb-2">
              {attachedFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300">
                  <FileText className="w-3 h-3 text-cyan-400 shrink-0" />
                  <span className="truncate max-w-[150px]">{f.name}</span>
                  <span className="text-slate-600">({f.size} KB)</span>
                  <button onClick={() => removeFile(f.path)} className="text-slate-500 hover:text-rose-400 ml-1">&times;</button>
                </div>
              ))}
              {uploading && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 text-xs text-slate-500">
                  <Loader2 className="w-3 h-3 animate-spin" /> Uploading...
                </div>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 transition-colors disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" /> Attach file
            </button>
          </div>

          <Button onClick={handleSubmit} disabled={!title.trim() || !description.trim() || createMission.isPending}
            className="w-full h-11 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-400 hover:to-cyan-400 text-white font-medium rounded-xl">
            {createMission.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating Mission...</>
            ) : (
              <><Target className="w-4 h-4 mr-2" /> Deploy Mission</>
            )}
          </Button>
          {success && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Mission deployed!
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

// ─── New Phase Dialog ────────────────────────────────────────
function NewPhaseForm({ onCreated, onClose }: {
  onCreated: () => void; onClose: () => void;
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [success, setSuccess] = useState(false)
  const createPhase = useCreatePhase()

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) return
    try {
      await createPhase.mutateAsync({
        title: title.trim(),
        description: description.trim(),
      })
      toast({ title: 'Phase created!', description: 'The orchestrator will pick it up.' })
      setTitle(''); setDescription('')
      setSuccess(true); setTimeout(() => { setSuccess(false); onCreated() }, 1500)
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="glass-card p-6 w-full max-w-[520px] m-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500">
            <Target className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white">New Phase</h2>
            <p className="text-xs text-slate-400">A strategic segment of the vision plan with sequential sprints.</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl leading-none">&times;</button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">Phase Title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g., Infrastructure Setup"
              className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-purple-500/40 transition-all" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">Phase Description</label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Describe the strategic goal for this phase..."
              className="min-h-[120px] bg-white/5 border-white/10 text-white text-sm placeholder:text-slate-600 rounded-xl focus:border-purple-500/40" />
          </div>
          <Button onClick={handleSubmit} disabled={!title.trim() || !description.trim() || createPhase.isPending}
            className="w-full h-11 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-400 hover:to-cyan-400 text-white font-medium rounded-xl">
            {createPhase.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating Phase...</>
            ) : (
              <><Target className="w-4 h-4 mr-2" /> Create Phase</>
            )}
          </Button>
          {success && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Phase created!
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

// ─── Main Missions Panel ─────────────────────────────────────
export default function MissionsPanel() {
  const [filter, setFilter] = useState('')
  const [viewMode, setViewMode] = useState<'phases' | 'all'>('phases')
  const [showMissionForm, setShowMissionForm] = useState(false)
  const [sprintTarget, setSprintTarget] = useState<string | null>(null) // phaseId for sprint creation
  const [refreshKey, setRefreshKey] = useState(0)

  const { data: missionsData, isLoading } = useMissions(filter || undefined, '')
  const { data: phasesData } = usePhases(filter || undefined, '')
  const { data: tasksData } = useUserTasks(undefined, undefined, undefined, '')
  const triggerOrch = useTriggerOrchestrator()
  const missions = missionsData?.missions || []
  const phases = phasesData?.missions || []
  const allTasks = tasksData?.tasks || []
  const taskMap = new Map<string, Task>()
  allTasks.forEach(t => taskMap.set(t.id, t))

  const handleRerun = useCallback(async (id: string) => {
    await fetch(`/api/missions?id=${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pending', summary: '' }),
    })
    triggerOrch.mutate()
    toast({ title: 'Mission restarted' })
  }, [triggerOrch])

  const handleStop = useCallback(async (id: string) => {
    await fetch(`/api/missions?id=${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'failed', summary: 'Stopped by user.' }),
    })
    toast({ title: 'Mission stopped' })
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    const res = await fetch(`/api/missions?id=${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (data.error) {
      toast({ title: 'Cannot delete', description: data.error, variant: 'destructive' })
    } else {
      toast({ title: 'Mission deleted' })
      setRefreshKey(k => k + 1)
    }
  }, [])

  // Overall stats
  const totalPhases = phases.length
  const completedPhases = phases.filter(p => p.status === 'completed').length
  const inProgressPhases = phases.filter(p => p.status === 'in_progress').length
  const blockedPhases = phases.filter(p => p.status === 'blocked').length

  // Count all sprints across phases
  const allSprints = phases.flatMap(p => p.childMissions || [])
  const completedSprints = allSprints.filter(s => s.status === 'completed').length
  const totalSprints = allSprints.length

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-purple-400" /> Missions
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {viewMode === 'phases'
              ? `${totalPhases} phases · ${completedSprints}/${totalSprints} sprints done`
              : `${missions.length} total missions`
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowMissionForm(true)}
            className="bg-purple-600 hover:bg-purple-500 text-white h-9 text-sm">
            <Plus className="w-4 h-4 mr-1.5" /> New Mission
          </Button>
        </div>
      </div>

      {/* Phase stats bar (only in phase view) */}
      {viewMode === 'phases' && totalPhases > 0 && (
        <div className="flex gap-3 flex-wrap">
          <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs">
            <span className="text-slate-500">Phases: </span>
            <span className="text-white font-medium">{completedPhases}/{totalPhases}</span>
            <span className="text-emerald-400 ml-1">done</span>
          </div>
          {inProgressPhases > 0 && (
            <div className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs">
              <span className="text-amber-400 font-medium">{inProgressPhases} active</span>
            </div>
          )}
          {blockedPhases > 0 && (
            <div className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs">
              <span className="text-red-400 font-medium">{blockedPhases} blocked</span>
            </div>
          )}
        </div>
      )}

      {/* View mode toggle + filter tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          <button onClick={() => setViewMode('phases')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              viewMode === 'phases' ? 'bg-purple-500/20 text-purple-300' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
            }`}>
            <Layers className="w-3.5 h-3.5" /> Phases
          </button>
          <button onClick={() => setViewMode('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              viewMode === 'all' ? 'bg-purple-500/20 text-purple-300' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
            }`}>
            <List className="w-3.5 h-3.5" /> All Missions
          </button>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {STATUS_TABS.map(tab => (
            <button key={tab.key} onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                filter === tab.key ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
              }`}>{tab.label}</button>
          ))}
        </div>
      </div>
      <Separator className="bg-white/5" />

      {/* Phase/Sprint Hierarchy View */}
      {viewMode === 'phases' && (
        <div className="space-y-3 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
          ) : phases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-3">
                <Target className="w-6 h-6 text-slate-600" />
              </div>
              <p className="text-sm text-white font-medium mb-1">No phases yet</p>
              <p className="text-xs text-slate-500 max-w-xs">
                Phases are strategic segments of your vision plan. Create a phase, then add sequential sprints within it.
              </p>
              <Button onClick={() => setShowMissionForm(true)}
                className="mt-4 bg-purple-600 hover:bg-purple-500 text-white h-9 text-sm">
                <Plus className="w-4 h-4 mr-1.5" /> Create First Mission
              </Button>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {phases.map(p => (
                <PhaseCard key={p.id} phase={p} parentTask={p.taskId ? taskMap.get(p.taskId) : null}
                  onRerun={handleRerun} onStop={handleStop} onDelete={handleDelete}
                  onAddSprint={(phaseId) => setSprintTarget(phaseId)} />
              ))}
            </AnimatePresence>
          )}
        </div>
      )}

      {/* Flat All Missions View */}
      {viewMode === 'all' && (
        <div className="space-y-2 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
          ) : missions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-3">
                <List className="w-6 h-6 text-slate-600" />
              </div>
              <p className="text-sm text-white font-medium mb-1">No missions</p>
              <p className="text-xs text-slate-500 max-w-xs">
                {filter ? 'Try a different filter, or ' : ''}
                click New Mission above or let Limura decompose tasks into missions.
              </p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {missions.map(m => (
                <LegacyMissionCard key={m.id} mission={m} parentTask={m.taskId ? taskMap.get(m.taskId) : null}
                  onRerun={handleRerun} onStop={handleStop} onDelete={handleDelete} />
              ))}
            </AnimatePresence>
          )}
        </div>
      )}

      {/* Dialogs */}
      {showMissionForm && (
        <NewMissionForm onCreated={() => { setShowMissionForm(false); setRefreshKey(k => k + 1) }}
          onClose={() => setShowMissionForm(false)} />
      )}
      {sprintTarget && (
        <NewSprintForm phaseId={sprintTarget}
          onCreated={() => { setSprintTarget(null); setRefreshKey(k => k + 1) }}
          onClose={() => setSprintTarget(null)} />
      )}
    </div>
  )
}
