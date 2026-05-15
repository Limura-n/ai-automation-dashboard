'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Cpu, Users, Briefcase, FileText, Send, Plus, Loader2,
  CheckCircle2, XCircle, Clock, AlertTriangle, Activity,
  Zap, UserPlus, Radio, ArrowRight, Play, Pause, RefreshCw,
  MessageCircle, ChevronRight, Eye, List, LayoutDashboard,
  Sparkles, Search, Trash2, ExternalLink, BarChart3, Terminal,
  Pencil, ListTodo, Brain, Target, User, SlidersHorizontal, Save,
  FolderKanban, ArrowLeft, ChevronDown, FolderOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { LimuraTerminal } from '@/components/chat-dialog'
import TasksPanel from '@/components/tasks-panel'
import MissionsPanel from '@/components/missions-panel'
import LearningPanel from '@/components/learning-panel'
import ProfilePanel from '@/components/profile-panel'
import UserProfilePanel from '@/components/user-profile-panel'
import LiveActivityPanel from '@/components/live-activity-panel'
import ProjectsPanel, { ProjectDialog } from '@/components/projects-panel'
import ErrorBoundary from '@/components/error-boundary'
import VisionPanel from '@/components/vision-panel'
import { toast } from '@/hooks/use-toast'
import { useQueryClient } from '@tanstack/react-query'
import { MODEL_GROUPS, getModelProvider } from '@/lib/models'
import { ProjectProvider, useProjectContext } from '@/lib/project-context'
import {
  useProjects,
  useCreateProject,
  useAgents, useCreateAgent, useUpdateAgent, useDeleteAgent,
  useMissions, useCreateMission,
  useAgentTasks, useCreateTask,
  useReports, useDashboardStats,
  useHeartbeat, useTriggerOrchestrator,
  type Agent, type Mission, type AgentTask, type Report,
  type Project,
} from '@/hooks/use-dashboard-data'

// ─── Project Switcher Dropdown ────────────────────────────────
function ProjectSwitcherDropdown({
  activeProject,
  onSelectProject,
}: {
  activeProject: Project | null
  onSelectProject: (p: Project) => void
}) {
  const [open, setOpen] = useState(false)
  const { data: projectsData } = useProjects('active')
  const projects = projectsData?.projects || []
  const ref = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
        title="Switch project"
      >
        <FolderKanban className="w-3.5 h-3.5" />
        <span className="hidden sm:inline max-w-[100px] truncate">
          {activeProject ? activeProject.name : 'Select a project'}
        </span>
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-56 bg-[#0e1422] border border-white/10 rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-50">
          {projects.map(p => (
            <button
              key={p.id}
              onClick={() => {
                onSelectProject(p)
                setOpen(false)
              }}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs transition-all ${
                activeProject?.id === p.id
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <FolderKanban className="w-3.5 h-3.5 shrink-0" />
              <div className="text-left min-w-0">
                <div className="font-medium truncate">{p.name}</div>
                {p.mission && (
                  <div className="text-[9px] text-slate-500 truncate">{p.mission}</div>
                )}
              </div>
            </button>
          ))}

          {projects.length === 0 && (
            <div className="px-3.5 py-3 text-[10px] text-slate-500 text-center">
              No projects yet. Click "Add Project" to create one.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Combined Onboarding Dialog ───────────────────────────────
function OnboardingDialog({
  open, onComplete, createProject,
}: {
  open: boolean
  onComplete: () => void
  createProject: ReturnType<typeof useCreateProject>
}) {
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Profile fields
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [skillsArray, setSkillsArray] = useState<string[]>([])
  const [skillInput, setSkillInput] = useState('')
  const [workStyle, setWorkStyle] = useState('collaborative')
  const [experienceLevel, setExperienceLevel] = useState('advanced')
  const [personality, setPersonality] = useState('')
  const [communicationPref, setCommunicationPref] = useState('telegram')
  const [activeHours, setActiveHours] = useState('')

  // Project fields
  const [projectName, setProjectName] = useState('')
  const [description, setDescription] = useState('')
  const [mission, setMission] = useState('')
  const [vision, setVision] = useState('')
  const [mainGoal, setMainGoal] = useState('')

  // Model fields
  const [mainAgent, setMainAgent] = useState('deepseek-v4-pro')

  const requiredFields = ['name', 'role', 'personality', 'skills', 'projectName', 'description', 'mission', 'vision', 'mainGoal', 'workStyle', 'experienceLevel', 'communicationPref', 'mainAgent']

  const addSkill = () => {
    const trimmed = skillInput.trim()
    if (!trimmed) return
    if (skillsArray.some(s => s.toLowerCase() === trimmed.toLowerCase())) return
    setSkillsArray([...skillsArray, trimmed])
    setSkillInput('')
  }

  const removeSkill = (index: number) => {
    setSkillsArray(skillsArray.filter((_, i) => i !== index))
  }

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Name is required'
    if (!role.trim()) e.role = 'Role is required'
    if (!personality.trim()) e.personality = 'Personality is required'
    if (skillsArray.length === 0) e.skills = 'At least one skill is required'
    if (!projectName.trim()) e.projectName = 'Project name is required'
    if (!description.trim()) e.description = 'Description is required'
    if (!mission.trim()) e.mission = 'Mission is required'
    if (!vision.trim()) e.vision = 'Vision is required'
    if (!mainGoal.trim()) e.mainGoal = 'Main goal is required'
    if (!mainAgent) e.mainAgent = 'AI Model is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      // Step 1: Save profile
      const profileRes = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          role: role.trim(),
          skills: skillsArray.join(', '),
          workStyle,
          experienceLevel,
          personality: personality.trim(),
          communicationPref,
          activeHours: activeHours.trim() || null,
        }),
      })
      const profileData = await profileRes.json()
      if (!profileData.success) throw new Error(profileData.error || 'Failed to save profile')

      // Step 2: Create project
      await createProject.mutateAsync({
        name: projectName.trim(),
        description: description.trim(),
        mission: mission.trim(),
        vision: vision.trim(),
        mainGoal: mainGoal.trim(),
      })

      // Step 3: Save agent model
      await fetch('/api/agents/main', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: mainAgent }),
      })

      toast({ title: '🎉 All set!', description: 'Your profile, project, and AI model are ready.' })
      onComplete()
    } catch (err: any) {
      toast({ title: 'Something went wrong', description: err?.message || 'Please try again', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  if (!open) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onKeyDown={handleKeyDown}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-xl max-h-[85vh] overflow-y-auto overflow-x-hidden glass-card p-6 mx-4 custom-scrollbar"
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-6">
          <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Welcome! Let's Get Started</h3>
            <p className="text-[10px] text-cyan-400 mt-0.5">Fill in all required fields to begin.</p>
          </div>
        </div>

        {/* ─── About You ─────────────────────────────── */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 rounded-full bg-gradient-to-b from-cyan-400 to-purple-500" />
            <h4 className="text-xs font-semibold text-white tracking-wide">About You</h4>
          </div>

          <div className="space-y-4">
            {/* Name + Role */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider font-medium flex items-center gap-1">
                  Name <span className="text-rose-400 text-[8px]">*required</span>
                </label>
                <input value={name} onChange={e => { setName(e.target.value); setErrors(prev => ({...prev, name: ''})) }}
                  placeholder="Your name"
                  className={`w-full h-9 px-3 mt-1 rounded-lg bg-white/5 border text-white text-xs placeholder:text-slate-600 focus:outline-none transition-all ${
                    errors.name ? 'border-rose-500/50' : 'border-white/10 focus:border-cyan-500/40'
                  }`} />
                {errors.name && <p className="text-[9px] text-rose-400 mt-0.5">{errors.name}</p>}
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider font-medium flex items-center gap-1">
                  Role <span className="text-rose-400 text-[8px]">*required</span>
                </label>
                <input value={role} onChange={e => { setRole(e.target.value); setErrors(prev => ({...prev, role: ''})) }}
                  placeholder="e.g., Creator, Developer"
                  className={`w-full h-9 px-3 mt-1 rounded-lg bg-white/5 border text-white text-xs placeholder:text-slate-600 focus:outline-none transition-all ${
                    errors.role ? 'border-rose-500/50' : 'border-white/10 focus:border-cyan-500/40'
                  }`} />
                {errors.role && <p className="text-[9px] text-rose-400 mt-0.5">{errors.role}</p>}
              </div>
            </div>

            {/* Skills */}
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider font-medium flex items-center gap-1">
                Skills <span className="text-rose-400 text-[8px]">*required</span>
              </label>
              <div className="flex gap-2 mt-1">
                <input value={skillInput} onChange={e => setSkillInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill() } }}
                  placeholder="Add a skill..."
                  className="flex-1 h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40 transition-all" />
                <button onClick={addSkill} disabled={!skillInput.trim()}
                  className="h-9 px-4 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 disabled:opacity-40 text-white text-xs font-medium transition-all">
                  Add
                </button>
              </div>
              {skillsArray.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {skillsArray.map((skill, i) => (
                    <div key={`${skill}-${i}`} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300">
                      <span>{skill}</span>
                      <button onClick={() => removeSkill(i)} className="p-0.5 rounded text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all">
                        <XCircle className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {skillsArray.length === 0 && <p className="text-[10px] text-slate-600 mt-1.5">No skills added yet.</p>}
              {errors.skills && <p className="text-[9px] text-rose-400 mt-0.5">{errors.skills}</p>}
            </div>

            {/* Work Style + Experience */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider font-medium flex items-center gap-1">
                  Work Style <span className="text-rose-400 text-[8px]">*required</span>
                </label>
                <select value={workStyle} onChange={e => setWorkStyle(e.target.value)}
                  className="w-full h-9 px-3 mt-1 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-500/40 transition-all appearance-none">
                  <option value="hands-on">Hands-on</option>
                  <option value="hands-off">Hands-off</option>
                  <option value="collaborative">Collaborative</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider font-medium flex items-center gap-1">
                  Experience <span className="text-rose-400 text-[8px]">*required</span>
                </label>
                <select value={experienceLevel} onChange={e => setExperienceLevel(e.target.value)}
                  className="w-full h-9 px-3 mt-1 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-500/40 transition-all appearance-none">
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                  <option value="expert">Expert</option>
                </select>
              </div>
            </div>

            {/* Personality */}
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider font-medium flex items-center gap-1">
                Personality <span className="text-rose-400 text-[8px]">*required</span>
              </label>
              <input value={personality} onChange={e => { setPersonality(e.target.value); setErrors(prev => ({...prev, personality: ''})) }}
                placeholder="Describe yourself — e.g., Pragmatic builder who values automation"
                className={`w-full h-9 px-3 mt-1 rounded-lg bg-white/5 border text-white text-xs placeholder:text-slate-600 focus:outline-none transition-all ${
                  errors.personality ? 'border-rose-500/50' : 'border-white/10 focus:border-cyan-500/40'
                }`} />
              {errors.personality && <p className="text-[9px] text-rose-400 mt-0.5">{errors.personality}</p>}
            </div>

            {/* Communication + Active Hours */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider font-medium flex items-center gap-1">
                  Communication <span className="text-rose-400 text-[8px]">*required</span>
                </label>
                <select value={communicationPref} onChange={e => setCommunicationPref(e.target.value)}
                  className="w-full h-9 px-3 mt-1 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-500/40 transition-all appearance-none">
                  <option value="telegram">Telegram</option>
                  <option value="dashboard">Dashboard</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider font-medium flex items-center gap-1">
                  Active Hours
                </label>
                <input value={activeHours} onChange={e => setActiveHours(e.target.value)}
                  placeholder="e.g., 9am-11pm"
                  className="w-full h-9 px-3 mt-1 rounded-lg bg-white/5 border border-white/10 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40 transition-all" />
              </div>
            </div>
          </div>
        </div>

        {/* ─── Your Project ──────────────────────────── */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 rounded-full bg-gradient-to-b from-emerald-400 to-teal-500" />
            <h4 className="text-xs font-semibold text-white tracking-wide">Your Project</h4>
          </div>

          <div className="space-y-4">
            {/* Project Name */}
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider font-medium flex items-center gap-1">
                Project Name <span className="text-rose-400 text-[8px]">*required</span>
              </label>
              <input value={projectName} onChange={e => { setProjectName(e.target.value); setErrors(prev => ({...prev, projectName: ''})) }}
                placeholder="e.g., Halal Vector Marketplace"
                className={`w-full h-9 px-3 mt-1 rounded-lg bg-white/5 border text-white text-xs placeholder:text-slate-600 focus:outline-none transition-all ${
                  errors.projectName ? 'border-rose-500/50' : 'border-white/10 focus:border-cyan-500/40'
                }`} />
              {errors.projectName && <p className="text-[9px] text-rose-400 mt-0.5">{errors.projectName}</p>}
            </div>

            {/* Description + Main Goal side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider font-medium flex items-center gap-1">
                  Description <span className="text-rose-400 text-[8px]">*required</span>
                </label>
                <textarea value={description} onChange={e => { setDescription(e.target.value); setErrors(prev => ({...prev, description: ''})) }}
                  placeholder="What is this project about?"
                  className={`w-full min-h-[72px] px-3 py-2 mt-1 rounded-lg bg-white/5 border text-white text-xs placeholder:text-slate-600 focus:outline-none transition-all resize-none ${
                    errors.description ? 'border-rose-500/50' : 'border-white/10 focus:border-cyan-500/40'
                  }`} />
                {errors.description && <p className="text-[9px] text-rose-400 mt-0.5">{errors.description}</p>}
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider font-medium flex items-center gap-1">
                  Main Goal <span className="text-rose-400 text-[8px]">*required</span>
                </label>
                <textarea value={mainGoal} onChange={e => { setMainGoal(e.target.value); setErrors(prev => ({...prev, mainGoal: ''})) }}
                  placeholder="What does success look like?"
                  className={`w-full min-h-[72px] px-3 py-2 mt-1 rounded-lg bg-white/5 border text-white text-xs placeholder:text-slate-600 focus:outline-none transition-all resize-none ${
                    errors.mainGoal ? 'border-rose-500/50' : 'border-white/10 focus:border-cyan-500/40'
                  }`} />
                {errors.mainGoal && <p className="text-[9px] text-rose-400 mt-0.5">{errors.mainGoal}</p>}
              </div>
            </div>

            {/* Mission + Vision vertical */}
            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider font-medium flex items-center gap-1">
                  Mission <span className="text-rose-400 text-[8px]">*required</span>
                </label>
                <textarea value={mission} onChange={e => { setMission(e.target.value); setErrors(prev => ({...prev, mission: ''})) }}
                  placeholder="Driving purpose"
                  className={`w-full min-h-[100px] px-3 py-2 mt-1 rounded-lg bg-white/5 border text-white text-xs placeholder:text-slate-600 focus:outline-none transition-all resize-none ${
                    errors.mission ? 'border-rose-500/50' : 'border-white/10 focus:border-cyan-500/40'
                  }`} />
                {errors.mission && <p className="text-[9px] text-rose-400 mt-0.5">{errors.mission}</p>}
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider font-medium flex items-center gap-1">
                  Vision <span className="text-rose-400 text-[8px]">*required</span>
                </label>
                <textarea value={vision} onChange={e => { setVision(e.target.value); setErrors(prev => ({...prev, vision: ''})) }}
                  placeholder="Long-term destination"
                  className={`w-full min-h-[100px] px-3 py-2 mt-1 rounded-lg bg-white/5 border text-white text-xs placeholder:text-slate-600 focus:outline-none transition-all resize-none ${
                    errors.vision ? 'border-rose-500/50' : 'border-white/10 focus:border-cyan-500/40'
                  }`} />
                {errors.vision && <p className="text-[9px] text-rose-400 mt-0.5">{errors.vision}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* ─── AI Model ──────────────────────────────── */}
        <div className="mb-2">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 rounded-full bg-gradient-to-b from-purple-400 to-cyan-500" />
            <h4 className="text-xs font-semibold text-white tracking-wide">AI Model</h4>
          </div>

          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider font-medium flex items-center gap-1">
              Main Agent (Limura) <span className="text-rose-400 text-[8px]">*required</span>
            </label>
            <select value={mainAgent} onChange={e => setMainAgent(e.target.value)}
              className={`w-full h-9 px-3 mt-1 rounded-lg bg-white/5 border text-white text-xs focus:outline-none focus:border-cyan-500/40 transition-all appearance-none ${
                errors.mainAgent ? 'border-rose-500/50' : 'border-white/10'
              }`}>
              {MODEL_GROUPS.map(group => (
                <optgroup key={group.provider} label={group.displayName}>
                  {group.models.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            {errors.mainAgent && <p className="text-[9px] text-rose-400 mt-0.5">{errors.mainAgent}</p>}
            <p className="text-[9px] text-slate-600 mt-1">Orchestrates all sub-agents, assigns tasks, and processes results.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 mt-6">
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 h-10 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 disabled:opacity-50 text-white font-medium rounded-xl text-xs">
            {saving ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin inline" /> Setting up...</>
            ) : (
              <><Zap className="w-3.5 h-3.5 mr-1.5 inline" /> Create & Start</>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Color Palette ──────────────────────────────────────────
const COLORS = {
  cyan: '#06b6d4',
  teal: '#0ea5e9',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  purple: '#a855f7',
  slate: '#64748b',
}

const statusColors: Record<string, string> = {
  idle: 'text-slate-400',
  busy: 'text-amber-400',
  completed: 'text-emerald-400',
  error: 'text-rose-400',
  pending: 'text-slate-400',
  assigned: 'text-sky-400',
  in_progress: 'text-amber-400',
  failed: 'text-rose-400',
  analyzing: 'text-purple-400',
  assigning: 'text-cyan-400',
  awaiting_feedback: 'text-yellow-400',
}

const statusBg: Record<string, string> = {
  idle: 'bg-slate-500/15 border-slate-500/20',
  busy: 'bg-amber-500/15 border-amber-500/20',
  completed: 'bg-emerald-500/15 border-emerald-500/20',
  error: 'bg-rose-500/15 border-rose-500/20',
  pending: 'bg-slate-500/15 border-slate-500/20',
  assigned: 'bg-sky-500/15 border-sky-500/20',
  in_progress: 'bg-amber-500/15 border-amber-500/20',
  failed: 'bg-rose-500/15 border-rose-500/20',
  analyzing: 'bg-purple-500/15 border-purple-500/20',
  assigning: 'bg-cyan-500/15 border-cyan-500/20',
  awaiting_feedback: 'bg-yellow-500/15 border-yellow-500/20',
}

// ─── Helpers ────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function LiveClock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }))
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [])
  return <span className="text-sm font-mono text-slate-300">{time}</span>
}

function StatusDot({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    idle: 'bg-slate-500',
    busy: 'bg-amber-400 animate-pulse',
    completed: 'bg-emerald-400',
    error: 'bg-rose-400',
    pending: 'bg-slate-500',
    in_progress: 'bg-amber-400 animate-pulse',
    failed: 'bg-rose-400',
    analyzing: 'bg-purple-400 animate-pulse',
    assigning: 'bg-cyan-400 animate-pulse',
  }
  return <span className={`w-2 h-2 rounded-full shrink-0 ${colorMap[status] || 'bg-slate-500'}`} />
}

// ─── Sidebar ────────────────────────────────────────────────
const NAV_ITEMS = [
  { key: 'overview', label: 'Mission Control', icon: <LayoutDashboard className="w-4 h-4" />, color: 'text-cyan-400' },
  { key: 'profile', label: 'Project Settings', icon: <User className="w-4 h-4" />, color: 'text-cyan-400' },
  { key: 'tasks', label: 'Tasks', icon: <ListTodo className="w-4 h-4" />, color: 'text-amber-400' },
  { key: 'missions', label: 'Missions', icon: <Target className="w-4 h-4" />, color: 'text-purple-400' },
  { key: 'brief', label: 'Brief Mission', icon: <Send className="w-4 h-4" />, color: 'text-emerald-400' },
  { key: 'agents', label: 'Active Agents', icon: <Cpu className="w-4 h-4" />, color: 'text-purple-400' },
  { key: 'models', label: 'Agent Model', icon: <SlidersHorizontal className="w-4 h-4" />, color: 'text-cyan-400' },
  { key: 'learning', label: 'Learning', icon: <Brain className="w-4 h-4" />, color: 'text-purple-400' },
  { key: 'reports', label: 'Reports', icon: <FileText className="w-4 h-4" />, color: 'text-amber-400' },
  { key: 'vision', label: 'Vision Plan', icon: <Sparkles className="w-4 h-4" />, color: 'text-cyan-400' },
]

function Sidebar({ activeView, setActiveView, stats }: {
  activeView: string
  setActiveView: (v: string) => void
  stats: { agentCount: number; missionCount: number; activeAgents: number; pendingTasks: number }
}) {
  const heartbeat = useHeartbeat()
  const heartbeatActive = heartbeat.query.data?.active ?? true
  const heartbeatInterval = heartbeat.query.data?.checkInterval ?? 10
  const [intervalInput, setIntervalInput] = useState(heartbeatInterval)
  const [pendingRequests, setPendingRequests] = useState(0)

  // Fetch pending agent questions for badge
  useEffect(() => {
    fetch('/api/agent/questions?status=pending')
      .then(r => r.json())
      .then(data => setPendingRequests(data.pending || 0))
      .catch(() => {})
  }, [])

  // Sync input when data loads
  useEffect(() => {
    setIntervalInput(heartbeatInterval)
  }, [heartbeatInterval])

  const handleIntervalChange = useCallback((val: string) => {
    const num = Number(val)
    if (!isNaN(num) && num >= 1 && num <= 120) {
      setIntervalInput(num)
    }
  }, [])

  const handleIntervalBlur = useCallback(() => {
    if (intervalInput !== heartbeatInterval) {
      heartbeat.setInterval.mutate(intervalInput)
    }
  }, [intervalInput, heartbeatInterval, heartbeat.setInterval])

  return (
    <div className="w-[220px] p-4 h-full flex flex-col overflow-y-auto custom-scrollbar shrink-0 border-r border-white/5 bg-[#060a13]/80 backdrop-blur-xl">
      {/* Navigation */}
      <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-3 px-1">Operations</div>
      <nav className="space-y-1 flex-1">
        {NAV_ITEMS.map(item => (
          <button
            key={item.key}
            onClick={() => setActiveView(item.key)}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
              activeView === item.key
                ? 'bg-white/10 text-white shadow-lg shadow-white/5'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className={activeView !== item.key ? item.color : ''}>{item.icon}</span>
            <span className="flex-1 text-left">{item.label}</span>
            {item.key === 'profile' && pendingRequests > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center">
                {pendingRequests}
              </span>
            )}
          </button>
        ))}
      </nav>

      <Separator className="my-4 bg-white/5" />

      {/* Quick Stats */}
      <div className="space-y-2 px-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Agents</span>
          <span className="text-white font-medium">{stats.agentCount}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Missions</span>
          <span className="text-white font-medium">{stats.missionCount}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Active</span>
          <span className="text-amber-400 font-medium">{stats.activeAgents}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Pending Tasks</span>
          <span className="text-cyan-400 font-medium">{stats.pendingTasks}</span>
        </div>
      </div>

      {/* Heartbeat Toggle */}
      <div className="mt-2 p-3 rounded-xl bg-white/5 border border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${heartbeatActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
            <span className={`text-xs font-medium ${heartbeatActive ? 'text-emerald-400' : 'text-slate-500'}`}>
              {heartbeatActive ? 'Heartbeat On' : 'Heartbeat Off'}
            </span>
          </div>
          <button
            onClick={() => heartbeat.toggle.mutate(!heartbeatActive)}
            disabled={heartbeat.toggle.isPending}
            className={`relative w-10 h-5 rounded-full transition-all ${
              heartbeatActive ? 'bg-emerald-500' : 'bg-slate-700'
            }`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
              heartbeatActive ? 'left-[22px]' : 'left-0.5'
            }`} />
          </button>
        </div>

        {/* Check Interval Input */}
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={120}
            value={intervalInput}
            onChange={e => handleIntervalChange(e.target.value)}
            onBlur={handleIntervalBlur}
            disabled={!heartbeatActive}
            className="w-16 h-7 px-2 rounded-lg bg-white/5 border border-white/10 text-white text-[10px] text-center font-mono
              focus:outline-none focus:border-cyan-500/40 transition-all disabled:opacity-40"
          />
          <span className="text-[10px] text-slate-500">min interval</span>
          {heartbeat.setInterval.isPending && (
            <Loader2 className="w-3 h-3 text-slate-500 animate-spin ml-auto" />
          )}
        </div>

        <p className="text-[10px] text-slate-500 mt-1.5">
          {heartbeatActive
            ? `Checking for missions every ${intervalInput} min`
            : 'No periodic checks — missions run on demand'}
        </p>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// PANEL 1: MISSION CONTROL (Overview)
// ═══════════════════════════════════════════════════════════════


function OverviewPanel({ setActiveView }: { setActiveView: (v: string) => void }) {
  const { projectId } = useProjectContext()
  const { data: stats, isLoading: statsLoading, isError: statsError } = useDashboardStats('')
  const { data: missionsData } = useMissions(undefined, '')
  const { data: agentsData } = useAgents(undefined, '')
  const { data: tasksData } = useAgentTasks('pending', undefined, undefined, '')
  const { data: reportsData, isLoading: reportsLoading } = useReports(undefined, undefined, '')
  const triggerOrch = useTriggerOrchestrator()
  const [expandedMission, setExpandedMission] = useState<string | null>(null)
  const createMission = useCreateMission()
  const [profileData, setProfileData] = useState<any>(null)

  // Poll Claude Code proxy health
  const [ccConnected, setCcConnected] = useState(false)
  const [ccData, setCcData] = useState<any>(null)
  useEffect(() => {
    let cancelled = false
    const poll = () => {
      fetch('http://localhost:8099/health')
        .then(r => r.json())
        .then(data => {
          if (!cancelled) { setCcConnected(true); setCcData(data) }
        })
        .catch(() => { if (!cancelled) { setCcConnected(false); setCcData(null) } })
    }
    poll()
    const interval = setInterval(poll, 15000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  // Fetch profile for main agent model (project-scoped so model shows up)
  useEffect(() => {
    fetch(`/api/profile${projectId ? `?projectId=${projectId}` : ''}`)
      .then(r => r.json())
      .then(data => setProfileData(data.profile))
      .catch(() => {})
  }, [projectId])

  const handleRerunMission = (title: string, description: string) => {
    createMission.mutate({ title, description, projectId })
  }

  const handleStopMission = async (missionId: string) => {
    const res = await fetch(`/api/missions?id=${missionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'failed', summary: 'Mission cancelled by user.' }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast({ title: 'Failed', description: err.error || 'Could not stop mission', variant: 'destructive' })
      return
    }
    toast({ title: 'Mission stopped', description: 'Mission has been cancelled.' })
  }

  const handleStartMission = async (missionId: string) => {
    const res = await fetch(`/api/missions?id=${missionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pending', summary: '' }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast({ title: 'Failed', description: err.error || 'Could not start mission', variant: 'destructive' })
      return
    }
    toast({ title: 'Mission queued', description: 'Click Start in the header to begin processing.' })
  }

  const handleDeleteMission = async (missionId: string) => {
    const res = await fetch(`/api/missions?id=${missionId}`, { method: 'DELETE' })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast({ title: 'Failed', description: err.error || 'Could not delete mission', variant: 'destructive' })
      return
    }
    toast({ title: 'Mission deleted', description: 'Mission has been removed.' })
  }

  const [editingMission, setEditingMission] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')

  const handleStartEdit = (mission: Mission) => {
    setEditingMission(mission.id)
    setEditTitle(mission.title)
    setEditDescription(mission.description.split('--- Attached Files ---')[0].trim())
  }

  const handleSaveEdit = async (missionId: string) => {
    if (!editTitle.trim() || !editDescription.trim()) return
    await fetch(`/api/missions?id=${missionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editTitle.trim(), description: editDescription.trim() }),
    })
    toast({ title: 'Mission updated', description: 'Mission changes saved.' })
    setEditingMission(null)
  }

  const missions = missionsData?.missions || []
  const agents = agentsData?.agents || []
  const pendingTasks = tasksData?.tasks || []
  const reports = reportsData?.reports || []

  // Toast on mission completion
  const prevCompletedRef = useRef(0)
  useEffect(() => {
    const completed = missions.filter(m => m.status === 'completed').length
    if (completed > prevCompletedRef.current && prevCompletedRef.current > 0) {
      const newMission = missions.find(m => m.status === 'completed' && m.completedTasks === m.taskCount && m.taskCount > 0)
      if (newMission) {
        toast({
          title: 'Mission Complete',
          description: `"${newMission.title}" finished with ${newMission.completedTasks} tasks.`,
          variant: 'default',
        })
      }
    }
    prevCompletedRef.current = completed
  }, [missions])

  // Toast on agent task completion
  const prevAgentDoneRef = useRef(0)
  useEffect(() => {
    const done = agents.filter(a => a.status === 'completed').length
    if (done > prevAgentDoneRef.current && prevAgentDoneRef.current > 0) {
      const agent = agents.find(a => a.status === 'completed')
      if (agent) {
        toast({
          title: 'Agent Finished',
          description: `${agent.name} completed its task.`,
        })
      }
    }
    prevAgentDoneRef.current = done
  }, [agents])

  return (
    <div className="space-y-6">
      {/* Top KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: <Cpu className="w-4 h-4" />, label: 'Total Agents', value: stats?.agentCount ?? 0, color: 'from-purple-500 to-purple-600', delay: 0, navigateTo: 'agents' },
          { icon: <Activity className="w-4 h-4" />, label: 'Active Now', value: stats?.activeAgents ?? 0, color: 'from-amber-500 to-amber-600', delay: 0.1, navigateTo: 'agents' },
          { icon: <Briefcase className="w-4 h-4" />, label: 'Missions', value: stats?.missionCount ?? 0, color: 'from-cyan-500 to-cyan-600', delay: 0.2, navigateTo: 'missions' },
          { icon: <FileText className="w-4 h-4" />, label: 'Reports', value: reportsLoading ? '...' : reports.length, color: 'from-emerald-500 to-emerald-600', delay: 0.3, navigateTo: 'reports' },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: card.delay }}
            className="glass-card p-4 cursor-pointer hover:bg-white/[0.07] transition-all duration-200 group"
            onClick={() => setActiveView(card.navigateTo)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`p-2.5 rounded-xl bg-gradient-to-br ${card.color} bg-opacity-10`}>
                {card.icon}
              </div>
            </div>
            {statsLoading ? (
              <Skeleton className="h-8 w-20 bg-white/5 rounded" />
            ) : statsError ? (
              <div className="text-2xl font-bold text-slate-600 mb-1">—</div>
            ) : (
              <div className="text-2xl font-bold text-white mb-1">{card.value}</div>
            )}
            <div className="text-xs text-slate-400 font-medium">{card.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Vision Progress Card */}
      <VisionProgressCard setActiveView={setActiveView} />

      {/* Live Activity Panel */}
      <LiveActivityPanel />

      {/* Main Agent Status */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="glass-card p-5"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Zap className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white">Limura</h3>
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1" />
                Online
              </Badge>
              {profileData?.model ? (
                <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-[10px]">
                  <Cpu className="w-2.5 h-2.5 mr-1" />
                  {profileData.model}
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-slate-500/10 text-slate-500 border-slate-500/20 text-[10px]">
                  <Cpu className="w-2.5 h-2.5 mr-1" />
                  default
                </Badge>
              )}
            </div>
            <p className="text-sm text-slate-400 mt-0.5">Main Orchestrator Agent — manages all sub-agents, assigns tasks, collects reports</p>
            {/* Current task live status */}
            {(() => {
              const activeMission = missions.find((m: any) => ['in_progress','analyzing','assigning'].includes(m.status))
              if (activeMission) {
                const label = activeMission.status === 'in_progress' ? 'Processing' : activeMission.status === 'analyzing' ? 'Analyzing' : 'Assigning'
                return (
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[11px] text-amber-400 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      {label}: {activeMission.title}
                    </span>
                  </div>
                )
              }
              if (agents.some((a: any) => a.status === 'busy')) {
                return (
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[11px] text-cyan-400 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      Sub-agents working
                    </span>
                  </div>
                )
              }
              return (
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                    Idle — waiting for new missions
                  </span>
                </div>
              )
            })()}
            <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
              <span>{agents.length} sub-agents</span>
              <span>{pendingTasks.length} pending tasks</span>
              <span>{reportsLoading ? <span className="text-slate-600">...</span> : `${reports.length} completed reports`}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Claude Code Status Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="glass-card p-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center shadow-lg shadow-orange-500/10">
            <Terminal className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-semibold text-white">Claude Code</h4>
              <Badge className={`text-[9px] ${ccConnected ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/15 text-rose-400 border-rose-500/20'}`}>
                <span className={`w-1 h-1 rounded-full mr-1 ${ccConnected ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                {ccConnected ? 'Proxy Online' : 'Offline'}
              </Badge>
              <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-[9px]">
                <Cpu className="w-2 h-2 mr-0.5" />
                {ccData?.default_model || 'deepseek-v4-flash-free'}
              </Badge>
            </div>
            <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
              <span>Code: <span className="text-slate-400">{ccData?.default_model || 'deepseek-v4-flash-free'}</span></span>
              <span>Blueprint: <span className="text-slate-400">{ccData?.blueprint_model || 'glm-5'}</span></span>
            </div>
          </div>
        </div>
      </motion.div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 min-w-0">
        {/* Active Agents */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="glass-card p-5 min-w-0 overflow-hidden"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-purple-400" />
              Active Sub-Agents
            </h3>
            <Badge variant="outline" className="bg-white/5 text-slate-400 text-[10px]">{agents.length} total</Badge>
          </div>
          {agents.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Cpu className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">No agents deployed yet</p>
              <p className="text-[10px] text-slate-600 mt-1">Brief a mission and I'll hire sub-agents</p>
            </div>
          ) : (
            <ScrollArea className="h-[280px] custom-scrollbar pr-2">
              <div className="space-y-2">
                {agents.slice(0, 10).map((agent, i) => (
                  <motion.div
                    key={agent.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.03 }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <div className={`p-2 rounded-lg shrink-0 ${
                      agent.status === 'busy' ? 'bg-amber-500/15 text-amber-400' :
                      agent.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400' :
                      agent.status === 'error' ? 'bg-rose-500/15 text-rose-400' :
                      'bg-purple-500/15 text-purple-400'
                    }`}>
                      <Cpu className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-200">{agent.name}</span>
                        <StatusDot status={agent.status} />
                        {agent.model && (
                          <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-[9px] px-1.5 py-0">
                            <Cpu className="w-2 h-2 mr-0.5" />
                            {agent.model}
                          </Badge>
                        )}
                      </div>
                      {agent.role && <p className="text-[11px] text-slate-500 truncate">{agent.role}</p>}
                      {agent.currentTask && (
                        <p className={`text-[10px] truncate mt-0.5 flex items-center gap-1 ${
                          agent.status === 'busy' ? 'text-amber-400' : 'text-slate-500'
                        }`}>
                          {agent.status === 'busy' && <span className="w-1 h-1 rounded-full bg-amber-400 animate-pulse" />}
                          {agent.currentTask}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${statusBg[agent.status] || 'bg-slate-500/15'} ${statusColors[agent.status] || 'text-slate-400'}`}>
                      {agent.status}
                    </Badge>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          )}
        </motion.div>

        {/* Recent Missions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="glass-card p-5 min-w-0 overflow-hidden"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-cyan-400" />
              Missions
            </h3>
            <Badge variant="outline" className="bg-white/5 text-slate-400 text-[10px]">{missions.length} total</Badge>
          </div>
          {missions.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Send className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">No missions yet</p>
              <p className="text-[10px] text-slate-600 mt-1">Go to Brief Mission to give me a task</p>
            </div>
          ) : (
            <div className="h-[280px] overflow-y-auto custom-scrollbar pr-2 space-y-2 w-full">
                {missions.slice(0, 8).map((mission, i) => (
                  <motion.div
                    key={mission.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.04 }}
                    className={`w-full p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer overflow-hidden min-w-0 group ${
                      expandedMission === mission.id ? 'ring-1 ring-cyan-500/30' : ''
                    }`}
                    onClick={() => setExpandedMission(expandedMission === mission.id ? null : mission.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 p-1.5 rounded-md shrink-0 ${
                        mission.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400' :
                        mission.status === 'failed' ? 'bg-rose-500/15 text-rose-400' :
                        'bg-cyan-500/15 text-cyan-400'
                      }`}>
                        {mission.status === 'completed' ? <CheckCircle2 className="w-3 h-3" /> :
                         mission.status === 'failed' ? <XCircle className="w-3 h-3" /> :
                         <Loader2 className="w-3 h-3 animate-spin" />}
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-200 truncate">{mission.title}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{mission.description}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <Badge variant="outline" className={`text-[10px] ${statusBg[mission.status]} ${statusColors[mission.status]}`}>
                              {mission.status}
                            </Badge>
                            <span className="text-[10px] text-slate-600">{mission.completedTasks}/{mission.taskCount} tasks</span>
                            <span className="text-[10px] text-slate-600">{timeAgo(mission.createdAt)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteMission(mission.id) }}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
                            title="Delete mission"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <ChevronRight className={`w-4 h-4 text-slate-600 transition-transform duration-200 ${
                            expandedMission === mission.id ? 'rotate-90' : ''
                          }`} />
                        </div>
                      </div>
                    </div>
                    {expandedMission === mission.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-3 pt-3 border-t border-white/10 space-y-3"
                      >
                        {editingMission === mission.id ? (
                          /* ─── EDIT MODE ─── */
                          <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                            <div>
                              <label className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Title</label>
                              <input
                                type="text"
                                value={editTitle}
                                onChange={e => setEditTitle(e.target.value)}
                                className="w-full h-9 px-3 mt-1 rounded-lg bg-white/5 border border-white/10 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40 transition-all"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Description</label>
                              <textarea
                                value={editDescription}
                                onChange={e => setEditDescription(e.target.value)}
                                rows={4}
                                className="w-full mt-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40 transition-all resize-none"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSaveEdit(mission.id)}
                                disabled={!editTitle.trim() || !editDescription.trim()}
                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors text-xs font-medium disabled:opacity-50"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Save Changes
                              </button>
                              <button
                                onClick={() => setEditingMission(null)}
                                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-500/10 text-slate-400 hover:bg-slate-500/20 transition-colors text-xs font-medium"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* ─── VIEW MODE ─── */
                          <>
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-[11px] text-slate-400 leading-relaxed break-words flex-1">{mission.description.split('--- Attached Files ---')[0]}</p>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleStartEdit(mission) }}
                                className="shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-cyan-400 hover:bg-white/5 transition-all"
                                title="Edit mission"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            {mission.description.includes('--- Attached Files ---') && (
                              <div className="flex flex-wrap gap-1.5">
                                {mission.description.split('\n').filter(l => l.startsWith('[Attached:')).map((line, i) => {
                                  const parts = line.replace('[Attached: ', '').replace(']', '').split(' (')
                                  const fileName = parts[0] || ''
                                  const fileSize = parts[1] ? parts[1].replace(' KB)', '') : ''
                                  return (
                                    <div key={i} className="flex items-center gap-1 px-2 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-[10px] text-cyan-300">
                                      <FileText className="w-3 h-3 shrink-0" />
                                      <span className="truncate max-w-[120px]">{fileName}</span>
                                      <span className="text-cyan-500/60">({fileSize} KB)</span>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                            {mission.summary && (
                              <div>
                                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Summary</span>
                                <p className="text-[11px] text-slate-300 mt-1 bg-white/5 p-2.5 rounded-lg whitespace-pre-wrap break-words">{mission.summary}</p>
                              </div>
                            )}
                            <div className="flex flex-col gap-2 pt-1">
                              {mission.status === 'failed' && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleStartMission(mission.id) }}
                                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors text-xs font-medium"
                                >
                                  <Play className="w-3.5 h-3.5" />
                                  Start Mission
                                </button>
                              )}
                              {mission.status === 'completed' && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleRerunMission(mission.title, mission.description) }}
                                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors text-xs font-medium"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                  Rerun Mission
                                </button>
                              )}
                              {(mission.status === 'pending' || mission.status === 'in_progress' || mission.status === 'analyzing' || mission.status === 'assigning') && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleStopMission(mission.id) }}
                                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors text-xs font-medium"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  Stop Mission
                                </button>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteMission(mission.id) }}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-500/10 text-slate-400 hover:bg-slate-500/20 hover:text-slate-300 transition-colors text-xs font-medium"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete Mission
                              </button>
                            </div>
                          </>
                        )}
                      </motion.div>
                    )}
                  </motion.div>
                ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Pending Tasks Feed */}
      {pendingTasks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="glass-card p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              Pending Tasks
            </h3>
            <Badge variant="outline" className="bg-amber-500/15 text-amber-400 text-[10px]">{pendingTasks.length} awaiting</Badge>
          </div>
          <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar">
            {pendingTasks.slice(0, 5).map((task, i) => (
              <div key={task.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/5">
                <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                <p className="text-xs text-slate-300 flex-1 truncate">{task.task}</p>
                {task.agentName && (
                  <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-400 border-purple-500/20">
                    {task.agentName}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}

// ─── Vision Progress Card ──────────────────────────────────────
function VisionProgressCard({ setActiveView }: { setActiveView: (v: string) => void }) {
  const { projectId } = useProjectContext()
  const [vision, setVision] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  // Try global first, fall back to project-scoped
  const [visionUrl, setVisionUrl] = useState('/api/vision')

  const fetchVision = useCallback(async () => {
    try {
      const res = await fetch(visionUrl)
      const data = await res.json()
      if (data.hasVision) {
        setVision(data)
      } else if (projectId) {
        // Fall back to global vision if project has none
        const globalRes = await fetch('/api/vision')
        const globalData = await globalRes.json()
        setVision(globalData.hasVision ? globalData : data)
      } else {
        setVision(data)
      }
    } catch {}
    setLoading(false)
  }, [visionUrl, projectId])

  useEffect(() => {
    fetchVision()
  }, [fetchVision])

  const handleReplan = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/vision', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId }) })
      const data = await res.json()
      if (data.success) {
        setVision((prev: any) => ({ ...prev, plan: data.plan, progress: data.progress }))
        toast({ title: '🧭 New vision roadmap ready!', description: 'Check the Terminal chat to review it.' })
      }
    } catch (err) { console.error('[page.tsx] Caught error:', err) }
    setGenerating(false)
  }

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-5"
      >
        <div className="animate-pulse flex gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/5" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-white/5 rounded w-1/3" />
            <div className="h-3 bg-white/5 rounded w-2/3" />
          </div>
        </div>
      </motion.div>
    )
  }

  if (!vision?.hasVision) return null

  const progress = vision.progress ?? 0
  const hasPendingPlan = vision.plan?.status === 'pending'
  const visionChanged = vision.visionChanged

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="glass-card p-5 cursor-pointer hover:bg-white/[0.05] transition-all duration-200 group"
      onClick={() => setActiveView('profile')}
    >
      <div className="flex items-start gap-4">
        {/* Progress Ring */}
        <div className="relative w-16 h-16 shrink-0">
          <svg className="w-16 h-16 -rotate-90" viewBox="0 0 72 72">
            <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
            <circle
              cx="36" cy="36" r="30"
              fill="none" stroke="url(#visionGradient)" strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 30}`}
              strokeDashoffset={`${2 * Math.PI * 30 * (1 - Math.min(progress, 100) / 100)}`}
              className="transition-all duration-1000"
            />
            <defs>
              <linearGradient id="visionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-white">{progress}%</span>
          </div>
        </div>

        {/* Vision Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              Vision Progress
            </h3>
            {hasPendingPlan && (
              <Badge className="bg-cyan-500/15 text-cyan-400 border-cyan-500/20 text-[10px]">
                Plan ready
              </Badge>
            )}
            {visionChanged && (
              <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/20 text-[10px]">
                Updated
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-300 truncate">{vision.profile?.mission}</p>
          <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{vision.profile?.vision}</p>

          {/* Progress bar (mobile-friendly) */}
          <div className="mt-2 flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-purple-600 transition-all duration-1000"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); handleReplan() }}
              disabled={generating}
              className="text-[10px] text-cyan-400 hover:text-cyan-300 disabled:text-slate-600 shrink-0 transition-colors"
            >
              {generating ? 'Generating...' : 'Replan ↻'}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════
// PANEL 2: BRIEF MISSION
// ═══════════════════════════════════════════════════════════════
function BriefMissionPanel() {
  const { projectId } = useProjectContext()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const createMission = useCreateMission()
  const triggerOrch = useTriggerOrchestrator()
  const [success, setSuccess] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState<Array<{name: string; path: string; size: number}>>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      toast({ title: 'Mission created', description: 'Click Start in the header to begin processing.' })
      setTitle('')
      setDescription('')
      setAttachedFiles([])
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      toast({ title: 'Failed to create mission', description: err?.message || 'Please try again.', variant: 'destructive' })
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500">
            <Send className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Brief a Mission</h2>
            <p className="text-xs text-slate-400">Give me a high-level task. I'll analyze it, hire sub-agents with the right skills, and orchestrate the work.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">Mission Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g., Create 10 Adobe Stock vectors of Islamic geometric patterns"
              className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/40 transition-all"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">Mission Description</label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe what needs to be done in detail. Include requirements, specifications, deadlines, and any reference information..."
              className="min-h-[180px] bg-white/5 border-white/10 text-white text-sm placeholder:text-slate-600 rounded-xl focus:border-emerald-500/40"
            />
          </div>

          {/* File Attachment */}
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">Attachments (optional)</label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
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

          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || !description.trim() || createMission.isPending}
            className="w-full h-11 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-medium rounded-xl"
          >
            {createMission.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing Mission...</>
            ) : (
              <><Send className="w-4 h-4 mr-2" /> Deploy Mission</>
            )}
          </Button>

          {success && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Mission deployed! I'll analyze it and start hiring sub-agents.
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* How it works */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card p-5"
      >
        <h3 className="text-sm font-semibold text-white mb-3">How the Super Agent handles it</h3>
        <div className="space-y-3">
          {[
            { step: '1', icon: <Search className="w-4 h-4" />, title: 'Analyze', desc: 'I break down your mission into specialized sub-tasks and identify the skills needed.' },
            { step: '2', icon: <UserPlus className="w-4 h-4" />, title: 'Hire', desc: 'I search online for best practices and create sub-agents with targeted expertise for each area.' },
            { step: '3', icon: <Radio className="w-4 h-4" />, title: 'Assign', desc: 'I distribute tasks to sub-agents based on their skills and monitor progress.' },
            { step: '4', icon: <Activity className="w-4 h-4" />, title: 'Monitor & Reassign', desc: 'I track progress, collect reports, and reassign if anything needs rework.' },
            { step: '5', icon: <FileText className="w-4 h-4" />, title: 'Report', desc: 'I compile everything into a final report with results, insights, and next steps.' },
          ].map((item, i) => (
            <div key={item.step} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center shrink-0 text-xs font-bold text-slate-400">
                {item.step}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-cyan-400">{item.icon}</span>
                  <span className="text-sm font-medium text-white">{item.title}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// PANEL 3: ACTIVE AGENTS
// ═══════════════════════════════════════════════════════════════
function ActiveAgentsPanel() {
  const { data, isLoading } = useAgents(undefined, '')
  const deleteAgent = useDeleteAgent()
  const updateAgent = useUpdateAgent()
  const agents = data?.agents || []
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [editingModel, setEditingModel] = useState<string | null>(null)

  const filteredAgents = filter === 'all' ? agents : agents.filter(a => a.status === filter)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Active Agents</h2>
          <p className="text-xs text-slate-400 mt-0.5">{agents.length} sub-agents deployed by the main orchestrator</p>
        </div>
        {/* Filter */}
        <div className="flex gap-1">
          {['all', 'idle', 'busy', 'completed', 'error'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                filter === f ? 'bg-white/10 text-white' : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 bg-white/5 rounded-2xl" />)}
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Cpu className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No agents found</p>
          <p className="text-xs text-slate-600 mt-1">Brief a mission and I'll hire sub-agents automatically</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAgents.map((agent, i) => (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
              className={`glass-card p-4 hover:bg-white/[0.07] transition-all duration-200 cursor-pointer group ${
                selectedAgent?.id === agent.id ? 'ring-1 ring-cyan-500/30' : ''
              }`}
              onClick={() => setSelectedAgent(selectedAgent?.id === agent.id ? null : agent)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2.5 rounded-xl ${
                  agent.status === 'busy' ? 'bg-amber-500/15 text-amber-400' :
                  agent.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400' :
                  agent.status === 'error' ? 'bg-rose-500/15 text-rose-400' :
                  'bg-purple-500/15 text-purple-400'
                }`}>
                  <Cpu className="w-5 h-5" />
                </div>
                <StatusDot status={agent.status} />
              </div>
              <h3 className="text-sm font-bold text-white">{agent.name}</h3>
              {agent.role && <p className="text-xs text-slate-400 mt-0.5">{agent.role}</p>}
              {agent.skills && <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{agent.skills}</p>}
              <div className="flex items-center gap-2 mt-3">
                <Badge variant="outline" className={`text-[10px] ${statusBg[agent.status] || 'bg-slate-500/15'} ${statusColors[agent.status] || 'text-slate-400'} capitalize`}>
                  {agent.status}
                </Badge>
                {agent.currentTask && <span className="text-[10px] text-slate-600 truncate">{agent.currentTask}</span>}
              </div>

              {/* Expanded details */}
                  {selectedAgent?.id === agent.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-4 pt-3 border-t border-white/10 space-y-3"
                    >
                      {/* Editable Model selector */}
                      <div>
                        <label className="text-[10px] text-slate-500 uppercase tracking-wider font-medium block mb-1">Model</label>
                        <div className="flex items-center gap-2">
                          {editingModel === agent.id ? (
                            <>
                              <select
                                value={agent.model || ''}
                                onChange={(e) => {
                                  const newModel = e.target.value
                                  updateAgent.mutate({ id: agent.id, model: newModel || null })
                                  setEditingModel(null)
                                }}
                                className="flex-1 h-8 px-2 rounded-lg bg-white/5 border border-white/10 text-white text-[10px] focus:outline-none focus:border-cyan-500/40 transition-all appearance-none"
                                autoFocus
                                onBlur={() => setEditingModel(null)}
                              >
<option value="" className="text-slate-900">Default (deepseek-v4-flash)</option>
                      {MODEL_GROUPS.map(group => (
                        <optgroup key={group.provider} label={group.displayName} className="text-slate-500">
                          {group.models.map(m => (
                            <option key={m} value={m} className="text-slate-900">{m}</option>
                                    ))}
                                  </optgroup>
                                ))}
                              </select>
                            </>
                          ) : (
                            <>
                              <span className="text-[11px] text-slate-300 flex-1">
                                {agent.model ? (
                                  <><Cpu className="w-3 h-3 inline mr-1 text-purple-400" />{agent.model}</>
                                ) : (
                                  <span className="text-slate-500 italic">Default (deepseek-v4-flash)</span>
                                )}
                              </span>
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingModel(agent.id) }}
                                className="p-1 rounded text-slate-500 hover:text-cyan-400 hover:bg-white/5 transition-all"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                  {agent.recentTasks && agent.recentTasks.length > 0 && (
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">Recent Tasks</span>
                      <div className="mt-1 space-y-1">
                        {agent.recentTasks.slice(0, 3).map(t => (
                          <div key={t.id} className="flex items-center gap-2 text-[10px]">
                            <StatusDot status={t.status} />
                            <span className="text-slate-400 truncate">{t.task}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Agent Insights */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="p-2 rounded-lg bg-white/5">
                      <div className="text-[18px] font-bold text-white">{agent.completedTasks || 0}</div>
                      <div className="text-[9px] text-slate-500 uppercase tracking-wider">Tasks Done</div>
                    </div>
                    <div className="p-2 rounded-lg bg-white/5">
                      <div className="text-[18px] font-bold text-emerald-400">
                        {agent.recentTasks && agent.recentTasks.length > 0
                          ? Math.round((agent.recentTasks.filter(t => t.status === 'completed').length / agent.recentTasks.length) * 100)
                          : 0}%
                      </div>
                      <div className="text-[9px] text-slate-500 uppercase tracking-wider">Success Rate</div>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                      onClick={(e) => { e.stopPropagation(); deleteAgent.mutate(agent.id) }}
                    >
                      <Trash2 className="w-3 h-3 mr-1" /> Retire
                    </Button>
                    {agent.status === 'idle' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                        onClick={(e) => { e.stopPropagation(); updateAgent.mutate({ id: agent.id, status: 'busy', currentTask: 'Awaiting assignment' }) }}
                      >
                        <Play className="w-3 h-3 mr-1" /> Activate
                      </Button>
                    )}
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// PANEL 4: REPORTS
// ═══════════════════════════════════════════════════════════════
function ReportsPanel() {
  const { data, isLoading } = useReports(undefined, undefined, '')
  const reports = data?.reports || []
  const taskReports = data?.taskReports || []
  const [expandedReport, setExpandedReport] = useState<string | null>(null)
  const [expandedTask, setExpandedTask] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'task' | 'agent'>('task')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Reports</h2>
          <p className="text-xs text-slate-400 mt-0.5">Final deliverables from completed tasks and sub-agents</p>
        </div>
        {/* View toggle */}
        <div className="flex gap-1 bg-white/5 rounded-lg p-1">
          <button
            onClick={() => setViewMode('task')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              viewMode === 'task'
                ? 'bg-cyan-500/20 text-cyan-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Task Reports
            {taskReports.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-[9px]">{taskReports.length}</span>
            )}
          </button>
          <button
            onClick={() => setViewMode('agent')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              viewMode === 'agent'
                ? 'bg-purple-500/20 text-purple-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Agent Logs
            {reports.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-purple-500/20 text-[9px]">{reports.length}</span>
            )}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 bg-white/5 rounded-xl" />)}
        </div>
      ) : viewMode === 'task' ? (
        /* ═══════ TASK-LEVEL REPORTS ═══════ */
        taskReports.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No completed task reports yet</p>
            <p className="text-xs text-slate-600 mt-1">
              When a task finishes, I'll write a consolidated final report here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {taskReports.map((tr, i) => (
              <motion.div
                key={tr.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
                className="glass-card overflow-hidden"
              >
                <button
                  onClick={() => setExpandedTask(expandedTask === tr.id ? null : tr.id)}
                  className="w-full p-4 flex items-start gap-3 text-left hover:bg-white/[0.05] transition-colors"
                >
                  <div className="p-2 rounded-lg bg-cyan-500/15 text-cyan-400 shrink-0 mt-0.5">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-200 truncate">{tr.title}</span>
                      <ChevronRight className={`w-3.5 h-3.5 text-slate-600 shrink-0 transition-transform ${
                        expandedTask === tr.id ? 'rotate-90' : ''
                      }`} />
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-[10px]">
                      <Badge variant="outline" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 text-[10px]">
                        {tr.missionCount} mission{tr.missionCount !== 1 ? 's' : ''}
                      </Badge>
                      {tr.priority && (
                        <span className={`text-[10px] capitalize ${
                          tr.priority === 'urgent' ? 'text-rose-400' :
                          tr.priority === 'high' ? 'text-amber-400' : 'text-slate-500'
                        }`}>
                          {tr.priority}
                        </span>
                      )}
                      {tr.category && (
                        <span className="text-slate-500">{tr.category}</span>
                      )}
                      <span className="text-slate-600">{timeAgo(tr.completedAt || tr.createdAt)}</span>
                    </div>
                  </div>
                </button>

                {expandedTask === tr.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="px-4 pb-4 pt-0 border-t border-white/5"
                  >
                    {/* Task Report */}
                    {tr.report && (
                      <div className="mt-3">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Final Report</span>
                        <div className="mt-1 bg-gradient-to-r from-cyan-500/5 to-purple-500/5 p-4 rounded-xl border border-white/5">
                          <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{tr.report}</p>
                        </div>
                      </div>
                    )}

                    {/* Child Missions */}
                    {tr.missions.length > 0 && (
                      <div className="mt-4">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
                          Completed Missions ({tr.missions.length})
                        </span>
                        <div className="mt-2 space-y-2">
                          {tr.missions.map(m => (
                            <div key={m.id} className="p-3 rounded-lg bg-white/5 border border-white/5">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                                <span className="text-xs text-slate-300 font-medium">{m.title}</span>
                              </div>
                              {m.summary && (
                                <p className="text-[11px] text-slate-500 mt-1 ml-5">{m.summary}</p>
                              )}
                              <div className="flex items-center gap-2 mt-1.5 ml-5 text-[9px] text-slate-600">
                                <span>{m.agentTaskCount} agent task{m.agentTaskCount !== 1 ? 's' : ''}</span>
                                {m.completedAt && <span>{timeAgo(m.completedAt)}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        )
      ) : (
        /* ═══════ AGENT-LEVEL LOGS ═══════ */
        reports.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No agent reports yet</p>
            <p className="text-xs text-slate-600 mt-1">Reports appear here when sub-agents complete their individual tasks</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report, i) => (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.03 }}
                className="glass-card overflow-hidden"
              >
                <button
                  onClick={() => setExpandedReport(expandedReport === report.id ? null : report.id)}
                  className="w-full p-4 flex items-start gap-3 text-left hover:bg-white/[0.05] transition-colors"
                >
                  <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400 shrink-0 mt-0.5">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-200 truncate">{report.task}</span>
                      <ChevronRight className={`w-3.5 h-3.5 text-slate-600 shrink-0 transition-transform ${
                        expandedReport === report.id ? 'rotate-90' : ''
                      }`} />
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-[10px]">
                      {report.agentName && (
                        <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-[10px]">
                          <Cpu className="w-2.5 h-2.5 mr-1" />
                          {report.agentName}
                        </Badge>
                      )}
                      {report.missionTitle && (
                        <span className="text-slate-500">Mission: {report.missionTitle}</span>
                      )}
                      <span className="text-slate-600">{timeAgo(report.completedAt || report.createdAt)}</span>
                    </div>
                  </div>
                </button>

                {expandedReport === report.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="px-4 pb-4 pt-0 border-t border-white/5"
                  >
                    {report.result && (
                      <div className="mt-3">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Result</span>
                        <p className="text-xs text-slate-300 mt-1 bg-white/5 p-3 rounded-lg">{report.result}</p>
                      </div>
                    )}
                    {report.report && (
                      <div className="mt-3">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Detailed Report</span>
                        <p className="text-xs text-slate-300 mt-1 bg-white/5 p-3 rounded-lg whitespace-pre-wrap">{report.report}</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        )
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// PANEL 7: MODELS — Centralized model configuration
// ═══════════════════════════════════════════════════════════════
function ModelsPanel() {
  const { projectId } = useProjectContext()
  const { data: agentsData, isLoading: agentsLoading } = useAgents(undefined, '')
  const updateAgent = useUpdateAgent()
  const agents = agentsData?.agents || []
  const [profileData, setProfileData] = useState<any>(null)
  const [mainModel, setMainModel] = useState('')
  const [defaultSubModel, setDefaultSubModel] = useState('')
  const [savingMain, setSavingMain] = useState(false)
  const [savingDefault, setSavingDefault] = useState(false)
  const [changingAgent, setChangingAgent] = useState<string | null>(null)

  const profileUrl = projectId ? `/api/profile?projectId=${projectId}` : '/api/profile'

  // Load profile + localStorage on mount
  useEffect(() => {
    fetch(profileUrl)
      .then(r => r.json())
      .then(data => {
        setProfileData(data.profile)
        setMainModel(data.profile?.model || '')
      })
      .catch(() => {})
    setDefaultSubModel(localStorage.getItem('defaultSubAgentModel') || '')
  }, [profileUrl])

  const handleSaveMainModel = async () => {
    setSavingMain(true)
    try {
      const res = await fetch(`/api/profile${projectId ? `?projectId=${projectId}` : ''}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: mainModel || null, projectId }),
      })
      const data = await res.json()
      if (data.success) {
        setProfileData(data.profile)
        toast({ title: 'Main model updated', description: `Limura will use "${mainModel || 'default'}"` })
      }
    } catch (err) { console.error('[page.tsx] Caught error:', err) }
    setSavingMain(false)
  }

  const handleSaveDefaultSubModel = () => {
    localStorage.setItem('defaultSubAgentModel', defaultSubModel)
    setSavingDefault(true)
    setTimeout(() => setSavingDefault(false), 800)
    toast({ title: 'Default saved', description: `New sub-agents will use "${defaultSubModel || 'default'}" model` })
  }

  const handleAgentModelChange = (agentId: string, model: string) => {
    updateAgent.mutate({ id: agentId, model: model || null })
    setChangingAgent(null)
  }

  if (agentsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-48 bg-white/5 rounded-xl" />
        <Skeleton className="h-40 bg-white/5 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <SlidersHorizontal className="w-5 h-5 text-cyan-400" />
          Agent Model
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">Configure AI models for the main agent and all sub-agents</p>
      </div>

      {/* ─── Main Agent Model ─── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-5"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Main Agent — Limura</h3>
            <p className="text-[10px] text-slate-400">The orchestrator that manages all missions and sub-agents</p>
          </div>
        </div>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="text-[10px] text-slate-500 uppercase tracking-wider font-medium block mb-1.5">AI Model</label>
            <select
              value={mainModel}
              onChange={e => setMainModel(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-500/40 transition-all appearance-none"
            >
<option value="" className="text-slate-900">Default (deepseek-v4-flash)</option>
                      {MODEL_GROUPS.map(group => (
                        <optgroup key={group.provider} label={group.displayName} className="text-slate-500">
                          {group.models.map(m => (
                            <option key={m} value={m} className="text-slate-900">{m}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <Button
            onClick={handleSaveMainModel}
            disabled={savingMain || !mainModel}
            className="h-10 px-5 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white text-xs font-medium rounded-xl shrink-0 disabled:opacity-50"
          >
            {savingMain ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span className="ml-1.5 hidden sm:inline">Save</span>
          </Button>
        </div>
        {profileData?.model && mainModel !== profileData.model && (
          <p className="text-[10px] text-amber-400 mt-2">Unsaved change — click Save to apply</p>
        )}
        {profileData?.model && (
          <p className="text-[10px] text-slate-500 mt-1.5">Currently active: <span className="text-slate-300">{profileData.model}</span></p>
        )}
      </motion.div>

      {/* ─── Default Sub-Agent Model ─── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-5"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Default Sub-Agent Model</h3>
            <p className="text-[10px] text-slate-400">Used when creating new sub-agents unless overridden individually</p>
          </div>
        </div>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="text-[10px] text-slate-500 uppercase tracking-wider font-medium block mb-1.5">Default Model</label>
            <select
              value={defaultSubModel}
              onChange={e => setDefaultSubModel(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-500/40 transition-all appearance-none"
            >
<option value="" className="text-slate-900">Default (deepseek-v4-flash)</option>
                      {MODEL_GROUPS.map(group => (
                        <optgroup key={group.provider} label={group.displayName} className="text-slate-500">
                          {group.models.map(m => (
                            <option key={m} value={m} className="text-slate-900">{m}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <Button
            onClick={handleSaveDefaultSubModel}
            disabled={savingDefault}
            className="h-10 px-5 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white text-xs font-medium rounded-xl shrink-0"
          >
            {savingDefault ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            <span className="ml-1.5 hidden sm:inline">Save Default</span>
          </Button>
        </div>
        {defaultSubModel && (
          <p className="text-[10px] text-slate-500 mt-1.5">New agents will use <span className="text-emerald-400">{defaultSubModel}</span></p>
        )}
      </motion.div>

      {/* ─── Sub-Agent Model List ─── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-purple-500/15 text-purple-400">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Sub-Agent Models</h3>
              <p className="text-[10px] text-slate-400">{agents.length} deployed agents</p>
            </div>
          </div>
        </div>

        {agents.length === 0 ? (
          <div className="text-center py-10 text-slate-500">
            <Cpu className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs">No sub-agents deployed yet</p>
            <p className="text-[10px] text-slate-600 mt-1">Brief a mission and agents will appear here</p>
          </div>
        ) : (
          <div className="space-y-2">
            {agents.map((agent, i) => (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
              >
                <div className={`p-2 rounded-lg shrink-0 ${
                  agent.status === 'busy' ? 'bg-amber-500/15 text-amber-400' :
                  agent.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400' :
                  agent.status === 'error' ? 'bg-rose-500/15 text-rose-400' :
                  'bg-purple-500/15 text-purple-400'
                }`}>
                  <Cpu className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-200">{agent.name}</span>
                    <StatusDot status={agent.status} />
                  </div>
                  {agent.role && <p className="text-[11px] text-slate-500 truncate">{agent.role}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {changingAgent === agent.id ? (
                    <select
                      value={agent.model || ''}
                      onChange={(e) => handleAgentModelChange(agent.id, e.target.value)}
                      className="h-8 px-2 rounded-lg bg-white/5 border border-white/10 text-white text-[10px] focus:outline-none focus:border-cyan-500/40 transition-all appearance-none w-36"
                      autoFocus
                      onBlur={() => setChangingAgent(null)}
                    >
<option value="" className="text-slate-900">Default (deepseek-v4-flash)</option>
                      {MODEL_GROUPS.map(group => (
                        <optgroup key={group.provider} label={group.displayName} className="text-slate-500">
                          {group.models.map(m => (
                            <option key={m} value={m} className="text-slate-900">{m}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  ) : (
                    <button
                      onClick={() => setChangingAgent(agent.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all text-[10px]"
                    >
                      {agent.model ? (
                        <><Cpu className="w-3 h-3 text-purple-400" /><span className="text-slate-300">{agent.model}</span></>
                      ) : (
                        <><span className="text-slate-500 italic">default</span></>
                      )}
                      <Pencil className="w-3 h-3 text-slate-500 ml-1" />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* ─── Model Reference ─── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card p-5"
      >
        <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-cyan-400" />
          Available Providers
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {MODEL_GROUPS.map(group => (
            <div key={group.provider} className="p-3 rounded-xl bg-white/5">
              <h4 className="text-xs font-medium text-slate-300 mb-1.5">{group.displayName}</h4>
              <div className="space-y-0.5">
                {group.models.slice(0, 4).map(m => (
                  <p key={m} className="text-[9px] text-slate-500 font-mono truncate">{m}</p>
                ))}
                {group.models.length > 4 && (
                  <p className="text-[8px] text-slate-600">+{group.models.length - 4} more</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// MAIN DASHBOARD PAGE
// ═══════════════════════════════════════════════════════════════
export default function DashboardPage() {
  return (
    <ProjectProvider>
      <DashboardInner />
    </ProjectProvider>
  )
}

function DashboardInner() {
  const { activeProject, setActiveProject, projectId } = useProjectContext()
  const [activeView, setActiveView] = useState('overview')
  const [chatOpen, setChatOpen] = useState(false)
  const [visionMessage, setVisionMessage] = useState<string | null>(null)
  const [visionLoading, setVisionLoading] = useState(false)
  const { data: stats } = useDashboardStats()
  const [showCreateProject, setShowCreateProject] = useState(false)
  const [aboutMeOpen, setAboutMeOpen] = useState(false)
  const [manualMode, setManualMode] = useState(false)
  const triggerOrch = useTriggerOrchestrator()
  const createProject = useCreateProject()
  const [onboarding, setOnboarding] = useState<'checking' | 'combined' | null>('checking')

  // ─── Onboarding Check ─────────────────────────────────────
  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const [profileRes, projectsRes] = await Promise.all([
          fetch('/api/profile'),
          fetch('/api/projects'),
        ])
        const profileData = await profileRes.json()
        const projectsData = await projectsRes.json()
        const hasProfile = !!(profileData.profile && profileData.profile.name && profileData.profile.role)
        const hasProjects = (projectsData.projects?.length || 0) > 0

        if (!hasProfile || !hasProjects) {
          setOnboarding('combined')
        } else {
          setOnboarding(null)
        }

        // Auto-select first project if none active
        if (hasProjects && !activeProject) {
          const projects = projectsData.projects || []
          if (projects.length > 0) {
            setActiveProject(projects[0])
          }
        }
      } catch {
        setOnboarding(null)
      }
    }
    // Wait a moment for the dashboard to render first
    const t = setTimeout(checkOnboarding, 500)
    return () => clearTimeout(t)
  }, [])

  // ─── Auto-trigger after onboarding ────────────────────────
  const wasOnboarded = useRef(false)
  useEffect(() => {
    // Only trigger when onboarding completed from the combined dialog
    if (onboarding === null && wasOnboarded.current) {
      const timer = setTimeout(() => {
        triggerOrch.mutate()
        toast({ title: '🚀 Onboarding complete', description: 'Limura is now processing your first project.' })
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [onboarding])

  // Track when onboarding was ever set to a real step
  useEffect(() => {
    if (onboarding === 'combined') {
      wasOnboarded.current = true
    }
  }, [onboarding])

  // ─── Combined onboarding complete ─────────────────────────
  const handleOnboardingComplete = useCallback(() => {
    setOnboarding(null)
  }, [])

  // ─── Non-onboarding project creation ───────────────────────
  const handleCreateProject = useCallback(async (data: { name: string; description?: string; mission?: string; vision?: string; mainGoal?: string }) => {
    try {
      await createProject.mutateAsync(data)
      setShowCreateProject(false)
      toast({ title: 'Project created', description: `"${data.name}" is ready with its own folder.` })
    } catch (err: any) {
      toast({ title: 'Failed to create project', description: err?.message || 'Unknown error', variant: 'destructive' })
    }
  }, [createProject])

  // ─── Invalidate queries when switching projects ────────────
  const queryClient = useQueryClient()
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['missions'] })
    queryClient.invalidateQueries({ queryKey: ['user-tasks'] })
    queryClient.invalidateQueries({ queryKey: ['agent-tasks'] })
    queryClient.invalidateQueries({ queryKey: ['agents'] })
    queryClient.invalidateQueries({ queryKey: ['feedback'] })
    queryClient.invalidateQueries({ queryKey: ['learnings'] })
    queryClient.invalidateQueries({ queryKey: ['agent-reports'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    queryClient.invalidateQueries({ queryKey: ['phases'] })
    queryClient.invalidateQueries({ queryKey: ['sprints'] })
  }, [activeProject, queryClient])

  // ─── Vision Auto-Plan ──────────────────────────────────────
  // Re-checks whenever user visits Mission Control (overview)
  const [visionStage, setVisionStage] = useState<string | null>(null)

  useEffect(() => {
    if (activeView !== 'overview') return
    if (visionLoading) return

    const timer = setTimeout(async () => {
      setVisionLoading(true)
      try {
        const visionParams = projectId ? `?projectId=${projectId}` : ''
        const statusRes = await fetch(`/api/vision${visionParams}`)
        const status = await statusRes.json()

        if (!status.hasVision) {
          setVisionLoading(false)
          return
        }

        // Pending plan exists and vision hasn't changed — show it
        if (status.plan && status.plan.status === 'pending' && !status.visionChanged) {
          setVisionMessage(status.plan.content)
          toast({ title: '🧭 Vision roadmap ready', description: 'Check the Terminal chat to review your plan.' })
          setVisionStage(null)
          setVisionLoading(false)
          return
        }

        // Vision changed — regenerate with live progress
        if (status.visionChanged) {
          setVisionStage('🧠 Analyzing your new vision...')
          await new Promise(r => setTimeout(r, 1000))

          // Phase 1: Research & Plan
          setVisionStage('🔍 Researching solutions and strategies...')
          const planRes = await fetch('/api/vision', { method: 'POST' })
          const plan = await planRes.json()

          if (plan.success && plan.plan) {
            setVisionStage('📋 Decomposing vision into missions...')
            // Fire decompose in background, show plan immediately
            const decompPromise = fetch('/api/vision/decompose', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId }) })
              .then(r => r.json())
              .then(d => setVisionStage(d.success ? `✅ ${d.count} missions created!` : '⚠️ Mission decomposition had issues'))
              .catch(() => setVisionStage('✅ Plan ready!'))
            
            setVisionMessage(plan.plan.content)
            
            // Wait for decompose or timeout after 5s
            await Promise.race([
              decompPromise,
              new Promise(r => setTimeout(r, 5000)),
            ])
            
            setTimeout(() => setVisionStage(null), 3000)
          }
          setVisionLoading(false)
          return
        }

        // Already approved/in_progress/completed — don't regenerate
        if (status.plan && ['approved', 'in_progress', 'completed'].includes(status.plan.status)) {
          setVisionLoading(false)
          return
        }

        // No plan at all — generate fresh with progress
        setVisionStage('🔍 Researching solutions and strategies...')
        await new Promise(r => setTimeout(r, 1000))

        const planRes = await fetch('/api/vision', { method: 'POST' })
        const plan = await planRes.json()

        if (plan.success && plan.plan) {
          setVisionStage('📋 Creating missions from your vision...')
          const decompPromise = fetch('/api/vision/decompose', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId }) })
            .then(r => r.json())
            .then(d => setVisionStage(d.success ? `✅ ${d.count} missions created!` : null))
            .catch(() => setVisionStage('✅ Plan ready!'))

          setVisionMessage(plan.plan.content)

          await Promise.race([
            decompPromise,
            new Promise(r => setTimeout(r, 5000)),
          ])
          setTimeout(() => setVisionStage(null), 3000)
        }
      } catch (err) {
        console.error('Vision check failed:', err)
      } finally {
        setVisionLoading(false)
      }
    }, 2000)

    return () => clearTimeout(timer)
  }, [activeView, projectId])

  const renderView = () => {
    switch (activeView) {
      case 'overview': return <OverviewPanel setActiveView={setActiveView} />
      case 'profile': return <ProfilePanel setActiveView={setActiveView} />
      case 'tasks': return <TasksPanel />
      case 'missions': return <MissionsPanel />
      case 'projects': return (
        <ProjectsPanel onEnterProject={(p) => {
          setActiveProject(p)
          setActiveView('overview')
        }} />
      )
      case 'brief': return <BriefMissionPanel />
      case 'agents': return <ActiveAgentsPanel />
      case 'models': return <ModelsPanel />
      case 'learning': return <LearningPanel />
      case 'reports': return <ReportsPanel />
      case 'vision': return <VisionPanel />
      default: return <OverviewPanel />
    }
  }

  return (
    <div className="min-h-screen bg-[#060a13] text-white relative overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-cyan-500/8 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-purple-500/8 blur-[120px]" />
        <div className="absolute top-[40%] right-[20%] w-[300px] h-[300px] rounded-full bg-emerald-500/5 blur-[100px]" />
        <div className="absolute inset-0 bg-grid opacity-40" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-white/5">
        <div className="flex items-center justify-between px-4 md:px-6 h-14">
          {/* Left: Always show current project */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center shrink-0">
                <FolderKanban className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white truncate max-w-[200px]">
                    {activeProject ? activeProject.name : 'Mission Control'}
                  </span>
                  {activeProject && (
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shrink-0">
                      {activeProject.status}
                    </span>
                  )}
                </div>
                {activeProject?.mission && (
                  <p className="text-[9px] text-slate-500 truncate max-w-[300px]">{activeProject.mission}</p>
                )}
                {!activeProject && (
                  <p className="text-[9px] text-slate-500 font-medium">Select or create a project to start</p>
                )}
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <LiveClock />

            {/* About Me — global user profile */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAboutMeOpen(true)}
              className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
              title="Your global profile"
            >
              <User className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline text-xs">About Me</span>
            </Button>

            {/* Project Switcher */}
            <ProjectSwitcherDropdown
              activeProject={activeProject}
              onSelectProject={(p) => {
                setActiveProject(p)
                setActiveView('overview')
              }}
            />

            {/* Projects List */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveView('projects')}
              className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
              title="View all projects"
            >
              <FolderOpen className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline text-xs">Projects</span>
            </Button>

            {/* Add Project */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCreateProject(true)}
              className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
              title="Create a new project"
            >
              <FolderKanban className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline text-xs">Add Project</span>
            </Button>

            {/* Mode Toggle: Auto / Manual */}
            <button
              onClick={() => setManualMode(!manualMode)}
              className={`relative w-[72px] h-7 rounded-full transition-all flex items-center px-1 ${
                manualMode ? 'bg-amber-500/25 border border-amber-500/40 justify-end' : 'bg-emerald-500/20 border border-emerald-500/30 justify-start'
              }`}
              title={manualMode ? 'Manual mode — Start button active' : 'Auto mode — orchestrator runs on schedule'}
            >
              <span
                className={`w-5 h-5 rounded-full bg-white shadow transition-all shrink-0 ${
                  manualMode ? 'bg-amber-400 order-2' : 'bg-emerald-400 order-1'
                }`}
              />
              <span className={`text-[9px] font-semibold mx-1 shrink-0 ${
                manualMode ? 'text-amber-300 order-1 mr-1' : 'text-emerald-300 order-2 ml-1'
              }`}>
                {manualMode ? 'MANUAL' : 'AUTO'}
              </span>
            </button>

            {/* Start */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => triggerOrch.mutate()}
              disabled={!manualMode || triggerOrch.isPending}
              className={`text-xs ${
                manualMode
                  ? 'text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10'
                  : 'text-slate-600 cursor-not-allowed'
              }`}
              title={manualMode ? 'Start processing all pending tasks and missions' : 'Switch to Manual mode to start'}
            >
              <Play className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline text-xs">Start</span>
            </Button>

            {/* Terminal */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setChatOpen(true)}
              className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
            >
              <Terminal className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline text-xs">Terminal</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex h-[calc(100vh-56px)]">
        {/* Left Sidebar */}
        <Sidebar
          activeView={activeView}
          setActiveView={setActiveView}
          stats={{
            agentCount: stats?.agentCount ?? 0,
            missionCount: stats?.missionCount ?? 0,
            activeAgents: stats?.activeAgents ?? 0,
            pendingTasks: stats?.pendingTasks ?? 0,
          }}
        />

        {/* Main Content */}
        <main className="flex-1 overflow-auto custom-scrollbar">
          <div className="p-4 md:p-6 max-w-[1200px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeView}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <ErrorBoundary>
                  {renderView()}
                </ErrorBoundary>
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Chat Dialog */}
      <LimuraTerminal open={chatOpen} onOpenChange={setChatOpen} initialMessage={visionMessage} visionStage={visionStage} projectId={projectId} />

      {/* About Me Dialog */}
      <Dialog open={aboutMeOpen} onOpenChange={setAboutMeOpen}>
        <DialogContent className="bg-[#0a0e1a] border-white/10 text-white max-w-lg max-h-[85vh] overflow-y-auto grid-cols-1 custom-scrollbar">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <User className="w-5 h-5 text-cyan-400" />
              About Me
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Your global identity — applies across all projects
            </DialogDescription>
          </DialogHeader>
          <UserProfilePanel
            onClose={() => setAboutMeOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Combined Onboarding Dialog */}
      <OnboardingDialog
        open={onboarding === 'combined'}
        onComplete={handleOnboardingComplete}
        createProject={createProject}
      />

      {/* Project Dialog (non-onboarding) */}
      <ProjectDialog
        open={showCreateProject}
        onOpenChange={setShowCreateProject}
        onSave={handleCreateProject}
      />
    </div>
  )
}
