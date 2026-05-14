'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Sparkles, Zap, Pencil, CheckCircle2, Loader2, XCircle, Search, Play, ShieldBan, ChevronDown, ChevronRight, FileText, Copy, Check } from 'lucide-react'
import VisionTree from './vision-tree'
import BlueprintRenderer from './blueprint-renderer'
import PrerequisiteList from './prerequisite-list'
import { useProjectContext } from '@/lib/project-context'
import { toast } from 'sonner'

interface MissionData { id: string; title: string; description: string; status: string; taskId?: string; agentTasks?: any[]; recommendedAgentRole?: string; deliverable?: string }
interface TaskData { id: string; title: string; description: string; status: string; priority: string; dependsOnTaskId?: string | null; missionCount: number; missions: MissionData[] }
interface AgentData { id: string; name: string; role: string; model?: string; status: string }

export default function VisionPanel() {
  const { projectId } = useProjectContext()
  const [vision, setVision] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [missions, setMissions] = useState<MissionData[]>([])
  const [milestones, setMilestones] = useState<any[]>([])
  const [generating, setGenerating] = useState(false)
  const [genStage, setGenStage] = useState('')  // researching, planning, saving
  const [blueprintTasks, setBlueprintTasks] = useState<TaskData[]>([])
  const [agents, setAgents] = useState<AgentData[]>([])

  // Prerequisites
  const [prerequisites, setPrerequisites] = useState<any[]>([])
  const [prereqCategories, setPrereqCategories] = useState<Record<string, any[]>>({})
  const [prereqSummary, setPrereqSummary] = useState({ total: 0, filled: 0, required: 0, requiredFilled: 0, blocked: false, ready: false })
  const [prereqsLoading, setPrereqsLoading] = useState(true)

  // Milestone editing
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newTarget, setNewTarget] = useState('')
  const [newUnit, setNewUnit] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [editingRoadmap, setEditingRoadmap] = useState(false)
  const [editRoadmapContent, setEditRoadmapContent] = useState('')
  const [savingRoadmap, setSavingRoadmap] = useState(false)

  // Blueprint content viewer
  const [showBlueprint, setShowBlueprint] = useState(false)
  const [copiedBlueprint, setCopiedBlueprint] = useState(false)

  const visionParams = projectId ? `?projectId=${projectId}` : ''
  const milestoneParams = projectId ? `?projectId=${projectId}` : ''

  const fetchData = useCallback(() => {
    Promise.all([
      fetch(`/api/vision${visionParams}`).then(r => r.json()),
      fetch(`/api/missions?limit=100`).then(r => r.json()),
      fetch(`/api/vision/milestones${milestoneParams}`).then(r => r.json()),
      fetch(`/api/tasks?limit=100${projectId ? `&projectId=${projectId}` : ''}`).then(r => r.json()),
      fetch('/api/agent/subagents').then(r => r.json()),
      fetch(`/api/prerequisites?projectId=${projectId || ''}`).then(r => r.json()),
    ]).then(([v, m, ms, tasksResp, agentsResp, prereqResp]) => {
      if (!v.hasVision && projectId) {
        fetch('/api/vision').then(r => r.json()).then(globalV => {
          setVision(globalV.hasVision ? globalV : v)
        }).catch(() => setVision(v))
      } else {
        setVision(v)
      }

      const allMissions: MissionData[] = (m.missions || []).map((mi: any) => ({
        id: mi.id, title: mi.title, description: mi.description,
        status: mi.status, taskId: mi.taskId,
        agentTasks: mi.tasks || [],
      }))

      setMissions(allMissions)

      // Build blueprint tasks from real Task data + missions
      const tasks: TaskData[] = (tasksResp.tasks || []).map((t: any) => {
        const taskMissions = allMissions.filter(mi => mi.taskId === t.id)
        return {
          id: t.id, title: t.title, description: t.description || '',
          status: t.status, priority: t.priority || 'normal',
          dependsOnTaskId: t.dependsOnTaskId || null,
          missionCount: taskMissions.length,
          missions: taskMissions,
        }
      })
      setBlueprintTasks(tasks)

      setMilestones(ms.milestones || [])
      setAgents(agentsResp.subAgents || agentsResp || [])

      // Prerequisites
      setPrerequisites(prereqResp.prerequisites || [])
      setPrereqCategories(prereqResp.categories || {})
      setPrereqSummary(prereqResp.summary || { total: 0, filled: 0, required: 0, requiredFilled: 0, blocked: false, ready: false })
      setPrereqsLoading(false)
      setLoading(false)
    }).catch(() => {
      setLoading(false)
      setPrereqsLoading(false)
    })
  }, [visionParams, milestoneParams, projectId])

  useEffect(() => { fetchData() }, [fetchData])

  // Check for ongoing generation on mount (recovery from tab switch)
  useEffect(() => {
    const params = projectId ? `?projectId=${projectId}` : ''
    fetch(`/api/vision/blueprint${params}`).then(r => r.json()).then(data => {
      if (data.status === 'generating' || data.status === 'researching' || data.status === 'planning' || data.status === 'saving') {
        setGenerating(true)
        // The polling effect below will pick it up
      }
    }).catch(() => {})
  }, [])

  // Ref-based fetch that survives component unmount (tab switch)
  const abortRef = useRef<AbortController | null>(null)

  // Poll for background blueprint generation status using setTimeout (survives tab switch)
  // setInterval is throttled to ~1/sec in background tabs; setTimeout + visibilitychange avoids this
  useEffect(() => {
    if (!generating) return

    let timeoutId: ReturnType<typeof setTimeout>
    let poll = async () => {
      try {
        const params = projectId ? `?projectId=${projectId}` : ''
        const res = await fetch(`/api/vision/blueprint${params}`)
        const data = await res.json()
        setGenStage(data.stage || data.status || '')
        if (data.status === 'done') {
          setGenerating(false)
          setGenStage('')
          toast({ title: '🧬 Blueprint created!', description: 'Research complete — tasks and missions generated.' })
          fetchData()
        } else if (data.status === 'failed') {
          setGenerating(false)
          setGenStage('')
          toast({ title: 'Blueprint failed', description: data.error || 'Generation failed', variant: 'destructive' })
        } else {
          // Schedule next poll — browsers don't throttle setTimeout the same way in background tabs
          timeoutId = setTimeout(poll, 2000)
        }
      } catch { /* ignore poll errors */ }
    }

    // Start polling immediately
    timeoutId = setTimeout(poll, 2000)

    // Resume polling immediately when user switches back to this tab
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(poll, 500) // short delay on resume
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [generating, projectId, fetchData])

  // ─── HANDLERS ───────────────────────────────────────────────

  const handleGenerateBlueprint = async () => {
    setGenerating(true)
    setGenStage('generating')
    // Use a ref-based AbortController that we DON'T abort on unmount
    // This keeps the fetch alive even if the user navigates to another tab
    const controller = new AbortController()
    abortRef.current = controller

    try {
      // keepalive: true so the fetch survives tab navigation/close
      const res = await fetch('/api/vision/blueprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
        signal: controller.signal,
        keepalive: true,
      })
      const data = await res.json()
      if (data.success) {
        setGenerating(false)
        setGenStage('')
        toast({ title: '🧬 Blueprint created!', description: `${data.tasks?.length || 0} tasks with ${data.totalMissions} total missions` })
        fetchData()
      } else if (data.error) {
        setGenerating(false)
        setGenStage('')
        toast({ title: 'Blueprint failed', description: data.error, variant: 'destructive' })
      }
    } catch (err: any) {
      // Only show error if it's NOT an abort (abort means user deliberately cancelled, but we don't abort)
      if (err.name !== 'AbortError') {
        setGenerating(false)
        setGenStage('')
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    }
  }

  // Clean up abort controller on unmount — but DON'T abort the fetch
  useEffect(() => {
    return () => {
      // Just clear the ref — don't call .abort()
      abortRef.current = null
    }
  }, [])

  const handleReplan = async () => {
    setGenerating(true)
    try {
      await fetch('/api/vision', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId }) })
      toast({ title: '🧭 Vision refreshed', description: 'New roadmap generated.' })
      fetchData()
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }) }
    setGenerating(false)
  }

  const handleSaveRoadmap = async () => {
    const planId = vision?.plan?.id
    if (!planId || !editRoadmapContent.trim()) return
    setSavingRoadmap(true)
    try {
      const res = await fetch('/api/vision', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, content: editRoadmapContent.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'Roadmap updated' })
        setVision((prev: any) => ({ ...prev, plan: { ...prev.plan, content: editRoadmapContent.trim() } }))
        setEditingRoadmap(false)
      }
    } catch { toast({ title: 'Save failed', variant: 'destructive' }) }
    setSavingRoadmap(false)
  }

  const updateMilestone = async (id: string, currentValue: number) => {
    try {
      await fetch('/api/vision/milestones', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, currentValue, projectId }),
      })
      fetchData()
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }) }
  }

  const deleteMilestone = async (id: string) => {
    try {
      await fetch(`/api/vision/milestones?id=${id}${projectId ? `&projectId=${projectId}` : ''}`, { method: 'DELETE' })
      toast({ title: 'Milestone deleted' })
      fetchData()
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }) }
  }

  const addMilestone = async () => {
    if (!newTitle.trim() || !newTarget.trim()) return
    try {
      await fetch('/api/vision/milestones', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(), targetValue: Number(newTarget),
          unit: newUnit.trim(), description: newDesc.trim() || undefined, projectId,
        }),
      })
      toast({ title: 'Milestone added!' })
      setShowAddForm(false)
      setNewTitle(''); setNewTarget(''); setNewUnit(''); setNewDesc('')
      fetchData()
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }) }
  }

  // ─── COMPUTED ───────────────────────────────────────────────

  const progress = vision?.progress ?? 0
  const totalMissions = missions.length
  const completedMissions = missions.filter(m => m.status === 'completed').length
  const pendingMissions = missions.filter(m => m.status === 'pending').length
  const inProgressMissions = missions.filter(m => ['in_progress', 'analyzing', 'assigning'].includes(m.status)).length
  const pendingApprovalMissions = missions.filter(m => m.status === 'pending_approval').length
  const hasVision = vision?.hasVision
  const planContent = vision?.plan?.content || ''
  const hasBlueprint = blueprintTasks.length > 0

  // ─── LOADING ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse glass-card p-10 text-center">
          <Loader2 className="w-6 h-6 text-cyan-400 animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-400">Loading vision data...</p>
        </div>
      </div>
    )
  }

  // ─── NO VISION SET ───────────────────────────────────────────

  if (!hasVision) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            Vision Plan
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Track progress toward your long-term vision</p>
        </div>
        <div className="glass-card p-10 text-center">
          <Sparkles className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400 mb-1">No vision set yet</p>
          <p className="text-xs text-slate-600">Go to Project Settings to set your mission and vision.</p>
        </div>
      </div>
    )
  }

  // ─── MAIN VIEW ───────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            Vision Plan
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Blueprint, tasks, missions &amp; prerequisites</p>
        </div>
        <div className="flex items-center gap-2">
          {!hasBlueprint && (
            <button
              onClick={handleGenerateBlueprint}
              disabled={generating}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xs font-medium hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {generating ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {genStage === 'researching' ? 'Researching...' : genStage === 'planning' ? 'Planning...' : genStage === 'saving' ? 'Saving...' : 'Generating...'}</>
              ) : (
                <><Search className="w-3.5 h-3.5" /> Generate Blueprint</>
              )}
            </button>
          )}
          <button
            onClick={handleReplan}
            disabled={generating}
            className="px-3 py-2 rounded-xl bg-cyan-500/10 text-cyan-400 text-xs font-medium border border-cyan-500/20 hover:bg-cyan-500/20 transition-all disabled:opacity-50"
          >
            {generating ? '🔄 ...' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <div className="text-2xl font-bold text-white">{Math.round(progress * 100)}%</div>
          <div className="text-xs text-slate-400 mt-1">Vision Progress</div>
          <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-purple-600 transition-all" style={{ width: `${Math.min(progress * 100, 100)}%` }} />
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="text-2xl font-bold text-emerald-400">{completedMissions}</div>
          <div className="text-xs text-slate-400 mt-1">Completed Missions</div>
        </div>
        <div className="glass-card p-4">
          <div className="text-2xl font-bold text-amber-400">{inProgressMissions}</div>
          <div className="text-xs text-slate-400 mt-1">In Progress</div>
        </div>
        <div className="glass-card p-4">
          <div className="text-2xl font-bold text-cyan-400">{pendingMissions}</div>
          <div className="text-xs text-slate-400 mt-1">Pending</div>
        </div>
        {pendingApprovalMissions > 0 && (
          <div className="glass-card p-4 border-blue-500/30 bg-blue-500/5">
            <div className="text-2xl font-bold text-blue-400">{pendingApprovalMissions}</div>
            <div className="text-xs text-blue-400/70 mt-1">Awaiting Your Approval</div>
          </div>
        )}
      </div>

      {/* ─── BLUEPRINT CONTENT ──────────────────────────────── */}
      {planContent && (
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              Blueprint Content
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(planContent).then(() => {
                    setCopiedBlueprint(true)
                    setTimeout(() => setCopiedBlueprint(false), 2000)
                  })
                }}
                className="text-[10px] px-3 py-1.5 rounded-lg bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 hover:text-white transition-all flex items-center gap-1.5"
              >
                {copiedBlueprint ? <><Check className="w-3 h-3 text-emerald-400" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy</>}
              </button>
              <button
                onClick={() => setShowBlueprint(!showBlueprint)}
                className="text-[10px] px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all flex items-center gap-1.5"
              >
                {showBlueprint ? <><ChevronDown className="w-3 h-3" /> Hide</> : <><ChevronRight className="w-3 h-3" /> View</>}
              </button>
            </div>
          </div>

          {showBlueprint && (
            <div className="mt-3 p-4 rounded-xl bg-white/[0.03] border border-white/10 max-h-[500px] overflow-y-auto">
              <div className="prose prose-invert prose-sm max-w-none">
                <style>{`
                  .blueprint-content h1 { font-size: 1.1rem; font-weight: 700; color: #e2e8f0; margin-top: 1.25rem; margin-bottom: 0.5rem; }
                  .blueprint-content h2 { font-size: 0.95rem; font-weight: 600; color: #cbd5e1; margin-top: 1rem; margin-bottom: 0.4rem; }
                  .blueprint-content h3 { font-size: 0.85rem; font-weight: 600; color: #94a3b8; margin-top: 0.75rem; margin-bottom: 0.3rem; }
                  .blueprint-content p { color: #94a3b8; font-size: 0.8rem; line-height: 1.6; margin-bottom: 0.5rem; }
                  .blueprint-content ul { list-style: none; padding-left: 0; }
                  .blueprint-content ul li { color: #94a3b8; font-size: 0.8rem; padding-left: 1rem; position: relative; margin-bottom: 0.25rem; }
                  .blueprint-content ul li::before { content: '→'; position: absolute; left: 0; color: #22d3ee; }
                  .blueprint-content strong { color: #e2e8f0; font-weight: 600; }
                  .blueprint-content em { color: #a78bfa; }
                  .blueprint-content code { background: rgba(255,255,255,0.08); padding: 0.1rem 0.3rem; border-radius: 3px; font-size: 0.75rem; }
                  .blueprint-content hr { border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 1rem 0; }
                  .blueprint-content table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
                  .blueprint-content th { text-align: left; color: #94a3b8; font-weight: 500; border-bottom: 1px solid rgba(255,255,255,0.1); padding: 0.3rem 0.5rem; }
                  .blueprint-content td { color: #cbd5e1; padding: 0.3rem 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); }
                `}</style>
                <BlueprintRenderer content={planContent} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── PREREQUISITE GATE ─────────────────────────────── */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <ShieldBan className="w-4 h-4 text-amber-400" />
            Prerequisite Checklist
          </h3>
          {prereqSummary.blocked && (
            <span className="text-[10px] px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Execution Paused
            </span>
          )}
          {prereqSummary.ready && prerequisites.length > 0 && (
            <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Ready to Execute
            </span>
          )}
        </div>
        <PrerequisiteList
          prerequisites={prerequisites}
          categories={prereqCategories}
          summary={prereqSummary}
          projectId={projectId}
          onUpdate={fetchData}
          loading={prereqsLoading}
        />
      </div>

      {/* ─── BLUEPRINT TREE ────────────────────────────────── */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Search className="w-4 h-4 text-cyan-400" />
            Blueprint — Tasks &amp; Missions
          </h3>
          {hasBlueprint && (
            <span className="text-[10px] text-slate-500 font-mono">
              {blueprintTasks.length} tasks · {missions.length} missions
            </span>
          )}
        </div>
        <VisionTree
          tasks={blueprintTasks}
          agents={agents}
          loading={false}
        />
      </div>

      {/* ─── MILESTONES ────────────────────────────────────── */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-400" />
            Real-World Milestones
          </h3>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="text-[10px] px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors"
          >
            {showAddForm ? 'Cancel' : '+ Add Milestone'}
          </button>
        </div>

        {showAddForm && (
          <div className="mb-4 p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Milestone title (e.g. Monthly Revenue)" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-500/40 placeholder:text-slate-600" />
            <div className="flex gap-3">
              <input value={newTarget} onChange={e => setNewTarget(e.target.value)} placeholder="Target (e.g. 5000)" type="number" className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-500/40 placeholder:text-slate-600" />
              <input value={newUnit} onChange={e => setNewUnit(e.target.value)} placeholder="Unit ($, users)" className="w-24 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-500/40 placeholder:text-slate-600" />
            </div>
            <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description (optional)" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-500/40 placeholder:text-slate-600" />
            <button onClick={addMilestone} disabled={!newTitle.trim() || !newTarget.trim()} className="w-full py-2 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs font-medium border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors disabled:opacity-40">Create Milestone</button>
          </div>
        )}

        {milestones.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs">No milestones yet</p>
            <p className="text-[10px] text-slate-600 mt-1">Add your first real-world goal above</p>
          </div>
        ) : (
          <div className="space-y-4">
            {milestones.map((m: any) => {
              const pct = m.targetValue > 0 ? Math.min(Math.round((m.currentValue / m.targetValue) * 100), 100) : 0
              const isEditing = editingId === m.id
              return (
                <div key={m.id} className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium text-white">{m.title}</h4>
                        {m.unit && <span className="text-[10px] text-slate-500">({m.unit})</span>}
                      </div>
                      {m.description && <p className="text-[10px] text-slate-500 mt-0.5">{m.description}</p>}
                    </div>
                    <button onClick={() => deleteMilestone(m.id)} className="text-[10px] text-rose-500/60 hover:text-rose-400 p-1 ml-2 shrink-0">✕</button>
                  </div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-purple-600 transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-slate-400 font-mono shrink-0">{pct}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500">Progress:</span>
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input value={editValue} onChange={e => setEditValue(e.target.value)} type="number" className="w-20 px-2 py-1 rounded bg-white/5 border border-white/10 text-white text-[10px] focus:outline-none focus:border-cyan-500/40" autoFocus onKeyDown={e => {
                          if (e.key === 'Enter') { updateMilestone(m.id, Number(editValue)); setEditingId(null) }
                          if (e.key === 'Escape') setEditingId(null)
                        }} />
                        <span className="text-[10px] text-slate-500">/ {m.targetValue} {m.unit}</span>
                        <button onClick={() => { updateMilestone(m.id, Number(editValue)); setEditingId(null) }} className="text-[10px] text-emerald-400 hover:text-emerald-300 ml-1">✓</button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditingId(m.id); setEditValue(String(m.currentValue)) }} className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 group">
                        <span>{m.currentValue}</span>
                        <span className="text-slate-500">/ {m.targetValue} {m.unit}</span>
                        <Pencil className="w-2.5 h-2.5 text-slate-600 group-hover:text-cyan-400 ml-0.5" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
