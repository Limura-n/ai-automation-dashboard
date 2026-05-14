'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Activity, Zap, Loader2, CheckCircle2, Clock, AlertTriangle,
  Radio, ChevronRight, ArrowRight, Play, Pause, Brain, RefreshCw,
} from 'lucide-react'
import { useUserTasks, useMissions, useAgentTasks, useHeartbeat, useTriggerOrchestrator, useLearnings } from '@/hooks/use-dashboard-data'
import type { Task, Mission } from '@/hooks/use-dashboard-data'
import { toast } from '@/hooks/use-toast'

function timeAgo(dateStr: string): string {
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

// ─── Activity Event ──────────────────────────────────────────
interface ActivityEvent {
  id: string
  type: 'task_created' | 'task_started' | 'task_completed' | 'task_failed' |
        'mission_created' | 'mission_started' | 'mission_completed' |
        'agent_task_completed' | 'learning_extracted'
  message: string
  time: string
  status: 'active' | 'done' | 'error'
}

export default function LiveActivityPanel() {
  const tasksQ = useUserTasks(undefined, undefined, undefined, '')  // empty = no project filter
  const missionsQ = useMissions(undefined, '')  // empty = no project filter
  const agentTasksQ = useAgentTasks(undefined, '')  // empty = no project filter
  const learningsQ = useLearnings()

  const isLoading = tasksQ.isLoading || missionsQ.isLoading || agentTasksQ.isLoading || learningsQ.isLoading
  const isError = tasksQ.isError || missionsQ.isError || agentTasksQ.isError || learningsQ.isError

  const tasksData = tasksQ.data
  const missionsData = missionsQ.data
  const agentTasksData = agentTasksQ.data
  const learningsData = learningsQ.data
  const heartbeat = useHeartbeat()
  const triggerOrch = useTriggerOrchestrator()

  const tasks = tasksData?.tasks || []
  const missions = missionsData?.missions || []
  const agentTasks = agentTasksData?.tasks || []
  const heartbeatActive = heartbeat.query.data?.active ?? true

  // Current active job — check user tasks first, then missions
  const activeTask = tasks.find(t => t.status === 'in_progress')
  const pendingTasks = tasks.filter(t => t.status === 'pending')
  const activeMission = missions.find(m =>
    m.status === 'in_progress' || m.status === 'analyzing' || m.status === 'assigning'
  )
  const pendingMissions = missions.filter(m =>
    m.status === 'pending' || m.status === 'blocked'
  )
  const scheduledTasks = tasks.filter(t => t.status === 'scheduled')
  const activeMissions = missions.filter(m => 
    m.status === 'in_progress' || m.status === 'analyzing' || m.status === 'assigning'
  )
  const recentlyCompleted = tasks.filter(t => t.status === 'completed').slice(0, 3)
  const recentlyCompletedMissions = missions.filter(m => m.status === 'completed').slice(0, 3)
  const activeAgentTasks = agentTasks.filter(t => t.status === 'in_progress' || t.status === 'assigned')

  const hasWork = !!(activeTask || activeMission || activeAgentTasks.length > 0)
  const hasQueued = !!(pendingTasks.length > 0 || pendingMissions.length > 0)

  // Build activity timeline
  const activityEvents = useMemo<ActivityEvent[]>(() => {
    const events: ActivityEvent[] = []

    // Active missions
    activeMissions.forEach(m => {
      events.push({
        id: m.id,
        type: 'mission_started',
        message: `Mission "${m.title.slice(0, 40)}" — ${m.status.replace('_', ' ')}`,
        time: m.createdAt,
        status: 'active',
      })
    })

    // Active agent tasks
    activeAgentTasks.slice(0, 5).forEach(t => {
      events.push({
        id: t.id,
        type: 'agent_task_completed' as any,
        message: `${t.agentName || 'Agent'}: ${t.task.slice(0, 50)}`,
        time: t.createdAt,
        status: 'active',
      })
    })

    // Recently completed tasks
    recentlyCompleted.forEach(t => {
      events.push({
        id: t.id,
        type: 'task_completed',
        message: `✅ "${t.title.slice(0, 50)}" completed`,
        time: t.completedAt || t.updatedAt,
        status: 'done',
      })
    })

    // Recent learnings
    ;(learningsData?.learnings || []).slice(0, 2).forEach(l => {
      events.push({
        id: l.id,
        type: 'learning_extracted',
        message: `🧠 Learned: ${l.insight.slice(0, 60)}`,
        time: l.createdAt,
        status: 'done',
      })
    })

    return events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 10)
  }, [activeMissions, activeAgentTasks, recentlyCompleted, learningsData])

  const handleTrigger = () => {
    triggerOrch.mutate()
    toast({ title: 'Orchestrator triggered', description: 'Limura is checking for work now.' })
  }

  return (
    <div className="space-y-3">
      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
        </div>
      )}

      {/* Error state */}
      {isError && !isLoading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7 text-red-500" />
          </div>
          <p className="text-sm text-white font-medium mb-1">Failed to load activity</p>
          <p className="text-xs text-slate-500 max-w-xs mb-4">
            Could not reach the server. Check your connection and try again.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => { tasksQ.refetch(); missionsQ.refetch(); agentTasksQ.refetch(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        </div>
      )}

      {/* ── Status Row ────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {/* Heartbeat */}
        <div className={`rounded-xl border p-3 ${heartbeatActive ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-slate-500/20 bg-slate-500/5'}`}>
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-2 h-2 rounded-full ${heartbeatActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
            <span className={`text-[10px] font-medium uppercase tracking-wider ${heartbeatActive ? 'text-emerald-400' : 'text-slate-500'}`}>
              {heartbeatActive ? 'Live' : 'Paused'}
            </span>
          </div>
          <div className="text-lg font-bold text-white">{hasWork ? 'Working' : hasQueued ? 'Queued' : 'Idle'}</div>
          <div className="text-[9px] text-slate-500">
            {activeTask ? 'Processing task' : activeMission ? `Mission: ${activeMission.title.slice(0, 30)}` : activeAgentTasks.length > 0 ? `${activeAgentTasks.length} agent tasks` : hasQueued ? `${pendingTasks.length + pendingMissions.length} queued` : 'Nothing in queue'}
          </div>
        </div>

        {/* Active Job */}
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 md:col-span-2">
          <div className="flex items-center gap-2 mb-1">
            {hasWork ? (
              <Loader2 className="w-3 h-3 text-cyan-400 animate-spin" />
            ) : (
              <Activity className="w-3 h-3 text-slate-500" />
            )}
            <span className="text-[10px] font-medium uppercase tracking-wider text-cyan-400">Current Job</span>
          </div>
          {activeTask ? (
            <>
              <div className="text-sm font-medium text-white truncate">{activeTask.title}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">in progress</span>
                <span className="text-[9px] text-slate-500">
                  {activeTask.missionCount} missions • {activeTask.completedMissions} done
                </span>
              </div>
            </>
          ) : activeMission ? (
            <>
              <div className="text-sm font-medium text-white truncate">{activeMission.title}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">{activeMission.status}</span>
                <span className="text-[9px] text-slate-500">
                  {activeMission.completedTasks || 0}/{activeMission.taskCount || 0} tasks
                </span>
              </div>
            </>
          ) : activeAgentTasks.length > 0 ? (
            <>
              <div className="text-sm font-medium text-white truncate">{activeAgentTasks[0].task}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">agent task</span>
                <span className="text-[9px] text-slate-500">{activeAgentTasks[0].agentName || 'Agent'}</span>
              </div>
            </>
          ) : pendingMissions.length > 0 ? (
            <>
              <div className="text-sm font-medium text-white truncate">{pendingMissions[0].title}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">queued</span>
                <span className="text-[9px] text-slate-500">{pendingMissions.length} missions waiting</span>
              </div>
            </>
          ) : pendingTasks.length > 0 ? (
            <>
              <div className="text-sm font-medium text-white truncate">{pendingTasks[0].title}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">pending</span>
                <span className="text-[9px] text-slate-500">Waiting for orchestrator</span>
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-500">No active jobs</div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 flex flex-col justify-center items-center gap-2">
          <button
            onClick={handleTrigger}
            disabled={triggerOrch.isPending}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-cyan-600/80 hover:bg-cyan-500 text-white text-[10px] font-medium transition-all disabled:opacity-50"
          >
            {triggerOrch.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            Run Now
          </button>
          <p className="text-[8px] text-slate-600 text-center">Trigger orchestrator immediately</p>
        </div>
      </div>

      {/* ── Recent Completions ──────────────────────────── */}
      {(recentlyCompleted.length > 0 || recentlyCompletedMissions.length > 0) && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-400">Recently Completed</span>
          </div>
          {recentlyCompleted.map(task => (
            <div key={task.id} className="flex items-center justify-between py-1">
              <div className="flex-1 min-w-0">
                <span className="text-xs text-white truncate block">{task.title}</span>
                <span className="text-[9px] text-slate-500">
                  {task.completedMissions}/{task.missionCount} missions • {task.completedAt ? timeAgo(task.completedAt) : 'just now'}
                </span>
              </div>
              <a href={`?view=tasks`} className="text-[9px] text-cyan-400 hover:text-cyan-300 ml-2 shrink-0">View →</a>
            </div>
          ))}
          {recentlyCompleted.length === 0 && recentlyCompletedMissions.slice(0, 2).map(m => (
            <div key={m.id} className="flex items-center justify-between py-1">
              <div className="flex-1 min-w-0">
                <span className="text-xs text-white truncate block">✅ {m.title}</span>
                <span className="text-[9px] text-slate-500">Mission completed {m.completedAt ? timeAgo(m.completedAt) : 'just now'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Activity Timeline ─────────────────────────────── */}
      {activityEvents.length > 0 && (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <div className="flex items-center gap-2 mb-2">
            <Radio className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Live Activity</span>
          </div>
          <div className="space-y-1 max-h-[200px] overflow-y-auto custom-scrollbar">
            {activityEvents.map((event, i) => (
              <motion.div
                key={event.id + i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`flex items-center gap-2 py-1.5 px-2 rounded-lg text-xs ${
                  event.status === 'active' ? 'bg-cyan-500/5' : 'bg-transparent'
                }`}
              >
                {event.status === 'active' ? (
                  <Loader2 className="w-3 h-3 text-cyan-400 animate-spin shrink-0" />
                ) : event.status === 'error' ? (
                  <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                )}
                <span className="flex-1 text-slate-300 truncate">{event.message}</span>
                <span className="text-[9px] text-slate-600 shrink-0">{timeAgo(event.time)}</span>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty State ───────────────────────────────────── */}
      {activityEvents.length === 0 && pendingTasks.length === 0 && pendingMissions.length === 0 && !hasWork && (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6 text-center">
          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-2">
            <Activity className="w-5 h-5 text-slate-600" />
          </div>
          <p className="text-sm text-slate-400 font-medium">No activity yet</p>
          <p className="text-xs text-slate-600 mt-0.5">
            Create a task and click "Run Now" to start processing
          </p>
        </div>
      )}
    </div>
  )
}
