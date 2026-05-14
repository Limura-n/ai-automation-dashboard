'use client'

import { useState } from 'react'
import { ChevronRight, ChevronDown, Circle, CheckCircle2, Clock, AlertTriangle, Loader2, User, Sparkles } from 'lucide-react'

interface MissionNode {
  id: string
  title: string
  description: string
  status: string
  agentTasks?: AgentTaskNode[]
  recommendedAgentRole?: string
  deliverable?: string
}

interface AgentTaskNode {
  id: string
  task: string
  status: string
  agentName?: string
  agentModel?: string
}

interface TaskNode {
  id: string
  title: string
  description: string
  status: string
  priority: string
  dependsOnTaskId?: string | null
  missionCount: number
  missions: MissionNode[]
}

interface VisionTreeProps {
  tasks: TaskNode[]
  agents: { id: string; name: string; role: string; model?: string; status: string }[]
  loading?: boolean
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed': return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
    case 'in_progress': case 'analyzing': case 'assigning':
      return <Clock className="w-3.5 h-3.5 text-amber-400" />
    case 'failed': case 'blocked':
      return <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
    case 'pending': case 'pending_approval':
    default:
      return <Circle className="w-3.5 h-3.5 text-slate-600" />
  }
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    in_progress: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    analyzing: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    assigning: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    failed: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    blocked: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    pending: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    pending_approval: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    awaiting_feedback: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  }
  return (
    <span className={`text-[9px] px-2 py-0.5 rounded-full border ${colors[status] || colors.pending}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    urgent: 'text-rose-400 border-rose-500/30',
    high: 'text-amber-400 border-amber-500/30',
    normal: 'text-slate-400 border-slate-500/30',
  }
  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded border ${colors[priority] || colors.normal}`}>
      {priority}
    </span>
  )
}

export default function VisionTree({ tasks, agents, loading }: VisionTreeProps) {
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  const [expandedMissions, setExpandedMissions] = useState<Set<string>>(new Set())

  if (loading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="w-6 h-6 text-slate-500 animate-spin mx-auto mb-3" />
        <p className="text-xs text-slate-500">Loading blueprint...</p>
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className="p-8 text-center">
        <Sparkles className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <p className="text-sm text-slate-400 mb-1">No blueprint yet</p>
        <p className="text-xs text-slate-600">Click "Generate Blueprint" to research and plan your vision</p>
      </div>
    )
  }

  const toggleTask = (taskId: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  const toggleMission = (missionId: string) => {
    setExpandedMissions(prev => {
      const next = new Set(prev)
      if (next.has(missionId)) next.delete(missionId)
      else next.add(missionId)
      return next
    })
  }

  const getAgentForRole = (role?: string) => {
    if (!role) return null
    const normalized = role.toLowerCase()
    return agents.find(a =>
      a.role?.toLowerCase().includes(normalized) ||
      a.name?.toLowerCase().includes(normalized)
    ) || agents[0] // fallback to first agent
  }

  return (
    <div className="space-y-3">
      {tasks.map((task, taskIdx) => {
        const isExpanded = expandedTasks.has(task.id)
        const completedMissions = task.missions.filter(m => m.status === 'completed').length
        const totalMissions = task.missions.length
        const taskProgress = totalMissions > 0 ? Math.round((completedMissions / totalMissions) * 100) : 0

        return (
          <div key={task.id} className="rounded-xl bg-white/5 border border-white/10 overflow-hidden transition-all">
            {/* ── TASK ROW ────────────────────────────────── */}
            <div
              className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/[0.03] transition-colors"
              onClick={() => toggleTask(task.id)}
            >
              {/* Expand caret */}
              <button className="shrink-0 text-slate-500 hover:text-slate-300 transition-colors p-0.5">
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              {/* Status */}
              <StatusIcon status={task.status} />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] text-slate-500 font-mono shrink-0">T{taskIdx + 1}</span>
                  <h4 className="text-sm font-medium text-white truncate">{task.title}</h4>
                  <StatusBadge status={task.status} />
                  <PriorityBadge priority={task.priority} />
                </div>
                {task.description && (
                  <p className="text-[11px] text-slate-500 truncate ml-0">{task.description}</p>
                )}
              </div>

              {/* Progress */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-slate-400 font-mono">
                  {completedMissions}/{totalMissions}
                </span>
                <div className="w-16 h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-purple-600 transition-all duration-500"
                    style={{ width: `${taskProgress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* ── EXPANDED: MISSIONS ──────────────────────── */}
            {isExpanded && (
              <div className="border-t border-white/5">
                {task.missions.map((mission, mIdx) => {
                  const isMExpanded = expandedMissions.has(mission.id)
                  const missionHasAgent = !!mission.recommendedAgentRole
                  const agent = missionHasAgent ? getAgentForRole(mission.recommendedAgentRole) : null
                  const agentTasks = mission.agentTasks || []

                  return (
                    <div key={mission.id} className="border-b border-white/5 last:border-b-0">
                      {/* ── MISSION ROW ─────────────────── */}
                      <div
                        className="flex items-center gap-3 py-2.5 px-4 pl-12 cursor-pointer hover:bg-white/[0.03] transition-colors"
                        onClick={() => toggleMission(mission.id)}
                      >
                        <button className="shrink-0 text-slate-600 hover:text-slate-400 transition-colors p-0.5">
                          {isMExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        </button>
                        <StatusIcon status={mission.status} />
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <span className="text-[9px] text-slate-600 font-mono shrink-0">M{mIdx + 1}</span>
                          <span className="text-xs text-slate-300 truncate">{mission.title}</span>
                        </div>
                        <StatusBadge status={mission.status} />

                        {/* Agent assignment */}
                        {agent && (
                          <div className="flex items-center gap-1 shrink-0" title={`${agent.name} (${agent.role})`}>
                            <User className="w-3 h-3 text-slate-500" />
                            <span className="text-[9px] text-slate-500 truncate max-w-[80px]">{agent.name}</span>
                            {agent.model && (
                              <span className="text-[8px] text-slate-600 bg-slate-500/10 px-1 rounded">{agent.model}</span>
                            )}
                          </div>
                        )}

                        {/* Agent task progress (mini dots) */}
                        {agentTasks.length > 0 && (
                          <div className="flex items-center gap-0.5 shrink-0">
                            {agentTasks.map(at => (
                              <div
                                key={at.id}
                                className={`w-1.5 h-1.5 rounded-full ${
                                  at.status === 'completed' ? 'bg-emerald-500' :
                                  at.status === 'in_progress' ? 'bg-amber-500 animate-pulse' :
                                  at.status === 'failed' ? 'bg-rose-500' :
                                  'bg-slate-700'
                                }`}
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      {/* ── EXPANDED: AGENT TASKS ────────── */}
                      {isMExpanded && (
                        <div className="pl-20 pr-4 pb-2.5 space-y-1">
                          {mission.deliverable && (
                            <div className="flex items-center gap-1.5 py-1">
                              <span className="text-[9px] text-slate-600">🎯 Deliverable:</span>
                              <span className="text-[10px] text-slate-400">{mission.deliverable}</span>
                            </div>
                          )}

                          {agent && (
                            <div className="flex items-center gap-2 py-1 text-[10px]">
                              <span className="text-slate-600">Assigned to:</span>
                              <span className="text-cyan-400 font-medium">{agent.name}</span>
                              <span className="text-slate-500">({agent.role})</span>
                              {agent.model && (
                                <span className="text-[9px] text-slate-500 bg-slate-500/10 px-1 rounded">{agent.model}</span>
                              )}
                              <span className={`ml-auto text-[9px] px-1.5 py-0.5 rounded-full ${
                                agent.status === 'idle' ? 'bg-emerald-500/10 text-emerald-400' :
                                agent.status === 'busy' ? 'bg-amber-500/10 text-amber-400' :
                                'bg-slate-500/10 text-slate-400'
                              }`}>
                                {agent.status}
                              </span>
                            </div>
                          )}

                          {agentTasks.length > 0 ? (
                            <div className="space-y-1">
                              {agentTasks.map(at => (
                                <div key={at.id} className="flex items-center gap-2 py-1 text-[10px] rounded px-2 bg-white/[0.02]">
                                  <StatusIcon status={at.status} />
                                  <span className="text-slate-400 truncate flex-1">{at.task}</span>
                                  <StatusBadge status={at.status} />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[10px] text-slate-600 italic py-1">
                              No agent tasks yet — orchestrator will assign when execution starts
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {/* Legend */}
      <div className="flex items-center gap-4 px-1 pt-2 text-[9px] text-slate-600">
        <span>🟢 Complete</span>
        <span>🟡 In Progress</span>
        <span>⭕ Pending</span>
        <span>🔴 Blocked</span>
      </div>
    </div>
  )
}
