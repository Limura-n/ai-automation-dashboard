'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FolderKanban, Plus, Archive, ExternalLink, FolderOpen,
  Target, Eye, Pencil, Trash2, CheckCircle2, XCircle,
  Loader2, Sparkles, FileText, MoreHorizontal, LayoutDashboard, AlertTriangle, RefreshCw,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import { MODEL_GROUPS } from '@/lib/models'
import {
  useProjects, useCreateProject, useUpdateProject, useArchiveProject,
  type Project,
} from '@/hooks/use-dashboard-data'

// ─── Status Styles ────────────────────────────────────────────
const statusBadge: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  archived: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
  completed: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
}

const statusIcon: Record<string, JSX.Element> = {
  active: <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />,
  archived: <Archive className="w-3 h-3 text-slate-400" />,
  completed: <CheckCircle2 className="w-3 h-3 text-cyan-400" />,
}

// ─── Create / Edit Dialog ─────────────────────────────────────
export function ProjectDialog({
  open, onOpenChange, project, onSave,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  project?: Project | null
  onSave: (data: { name: string; description?: string; mission?: string; vision?: string; mainGoal?: string }) => void
}) {
  const isEdit = !!project

  // Profile fields (only for new project)
  const [userName, setUserName] = useState('')
  const [role, setRole] = useState('')
  const [skillsArray, setSkillsArray] = useState<string[]>([])
  const [skillInput, setSkillInput] = useState('')
  const [workStyle, setWorkStyle] = useState('collaborative')
  const [experienceLevel, setExperienceLevel] = useState('advanced')
  const [personality, setPersonality] = useState('')
  const [communicationPref, setCommunicationPref] = useState('telegram')
  const [activeHours, setActiveHours] = useState('')

  // Project fields
  const [projectName, setProjectName] = useState(project?.name || '')
  const [description, setDescription] = useState(project?.description || '')
  const [mission, setMission] = useState(project?.mission || '')
  const [vision, setVision] = useState(project?.vision || '')
  const [mainGoal, setMainGoal] = useState('')

  // Model field (only for new project)
  const [mainAgent, setMainAgent] = useState('deepseek-v4-pro')

  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Sync form fields when project prop changes (edit mode)
  useEffect(() => {
    setProjectName(project?.name || '')
    setDescription(project?.description || '')
    setMission(project?.mission || '')
    setVision(project?.vision || '')
  }, [project])

  const resetForm = useCallback(() => {
    setUserName('')
    setRole('')
    setSkillsArray([])
    setSkillInput('')
    setWorkStyle('collaborative')
    setExperienceLevel('advanced')
    setPersonality('')
    setCommunicationPref('telegram')
    setActiveHours('')
    setProjectName(project?.name || '')
    setDescription(project?.description || '')
    setMission(project?.mission || '')
    setVision(project?.vision || '')
    setMainGoal('')
    setMainAgent('deepseek-v4-pro')
    setErrors({})
  }, [project])

  const handleClose = useCallback(() => {
    resetForm()
    onOpenChange(false)
  }, [resetForm, onOpenChange])

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
    // Profile fields (new project only)
    if (!isEdit) {
      if (!userName.trim()) e.userName = 'Name is required'
      if (!role.trim()) e.role = 'Role is required'
      if (!personality.trim()) e.personality = 'Personality is required'
      if (skillsArray.length === 0) e.skills = 'At least one skill is required'
      if (!mainAgent) e.mainAgent = 'AI Model is required'
    }
    // Project fields
    if (!projectName.trim()) e.projectName = 'Project name is required'
    if (!description.trim()) e.description = 'Description is required'
    if (!mission.trim()) e.mission = 'Mission is required'
    if (!vision.trim()) e.vision = 'Vision is required'
    if (!isEdit && !mainGoal.trim()) e.mainGoal = 'Main goal is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = useCallback(async () => {
    if (!validate()) return
    setSaving(true)
    try {
      // Save profile fields if new project
      if (!isEdit) {
        const profileRes = await fetch('/api/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: userName.trim(),
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

        // Save AI model
        await fetch('/api/agents/main', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: mainAgent }),
        })
      }

      // Save project
      await onSave({
        name: projectName.trim(),
        description: description.trim(),
        mission: mission.trim(),
        vision: vision.trim(),
        mainGoal: mainGoal.trim() || undefined,
      })
      handleClose()
    } catch (err: any) {
      toast({ title: 'Something went wrong', description: err?.message || 'Please try again', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }, [isEdit, userName, role, skillsArray, workStyle, experienceLevel, personality, communicationPref, activeHours, mainAgent, projectName, description, mission, vision, mainGoal, onSave, handleClose])

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
        className={`${isEdit ? 'max-w-lg' : 'max-w-xl'} w-full max-h-[85vh] overflow-y-auto overflow-x-hidden glass-card p-6 mx-4 custom-scrollbar`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600">
              <FolderKanban className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-base font-bold text-white">
              {project ? 'Edit Project' : 'New Project'}
            </h3>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-all">
            <XCircle className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4" onKeyDown={handleKeyDown}>

          {/* ─── About You (new project only) ──────────────── */}
          {!isEdit && (
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
                    <input value={userName} onChange={e => { setUserName(e.target.value); setErrors(prev => ({...prev, userName: ''})) }}
                      placeholder="Your name"
                      className={`w-full h-9 px-3 mt-1 rounded-lg bg-white/5 border text-white text-xs placeholder:text-slate-600 focus:outline-none transition-all ${
                        errors.userName ? 'border-rose-500/50' : 'border-white/10 focus:border-cyan-500/40'
                      }`} />
                    {errors.userName && <p className="text-[9px] text-rose-400 mt-0.5">{errors.userName}</p>}
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
                      className="h-9 px-4 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 disabled:opacity-40 text-white text-xs font-medium transition-all">Add</button>
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
          )}

          {/* ─── Your Project ──────────────────────────────── */}
          <div className={!isEdit ? 'mb-5' : ''}>
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

              {/* Description + Main Goal side by side (new project) */}
              {!isEdit ? (
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
              ) : (
                /* Description full width (edit mode) */
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider font-medium flex items-center gap-1">
                    Description <span className="text-rose-400 text-[8px]">*required</span>
                  </label>
                  <textarea value={description} onChange={e => { setDescription(e.target.value); setErrors(prev => ({...prev, description: ''})) }}
                    placeholder="What is this project about?"
                    className={`w-full min-h-[60px] px-3 py-2 mt-1 rounded-lg bg-white/5 border text-white text-xs placeholder:text-slate-600 focus:outline-none transition-all resize-none ${
                      errors.description ? 'border-rose-500/50' : 'border-white/10 focus:border-cyan-500/40'
                    }`} />
                  {errors.description && <p className="text-[9px] text-rose-400 mt-0.5">{errors.description}</p>}
                </div>
              )}

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

          {/* ─── AI Model (new project only) ────────────────── */}
          {!isEdit && (
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
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 mt-6">
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 h-10 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 disabled:opacity-50 text-white font-medium rounded-xl text-xs">
            {saving ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin inline" /> Saving...</>
            ) : (
              <><Plus className="w-3.5 h-3.5 mr-1.5 inline" /> {project ? 'Save Changes' : 'Create Project'}</>
            )}
          </button>
          <button onClick={handleClose}
            className="h-10 px-4 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl text-xs">
            Cancel
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Project Card ─────────────────────────────────────────────
function ProjectCard({
  project,
  onEdit,
  onArchive,
  onDelete,
  onUnarchive,
  onEnterProject,
}: {
  project: Project
  onEdit: (p: Project) => void
  onArchive: (id: string) => void
  onDelete: (id: string) => void
  onUnarchive: (id: string) => void
  onEnterProject?: (p: Project) => void
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const isArchived = project.status === 'archived'
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="group bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 hover:bg-white/[0.06] hover:border-white/10 transition-all cursor-pointer"
      onClick={() => onEnterProject?.(project)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center shrink-0">
            <FolderKanban className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-white truncate">{project.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusBadge[project.status] || statusBadge.active}`}>
                {statusIcon[project.status] || statusIcon.active}
                {project.status}
              </span>
              <span className="text-[10px] text-slate-500">
                {project.taskCount} {project.taskCount === 1 ? 'task' : 'tasks'}
              </span>
              {project.folderPath && (
                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                  <FolderOpen className="w-3 h-3" /> Folder
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onEnterProject?.(project)}
            className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 transition-all"
            title="Open project dashboard"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onEdit(project)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-all"
            title="Edit project"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          {isArchived ? (
            <>
              <button
                onClick={() => onUnarchive(project.id)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-emerald-400 transition-all"
                title="Restore to active"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-rose-400 transition-all"
                title="Delete project permanently"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <button
              onClick={() => onArchive(project.id)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-rose-400 transition-all"
              title="Archive project"
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Description */}
      {project.description && (
        <p className="text-sm text-slate-400 mt-3 line-clamp-2">{project.description}</p>
      )}

      {/* Mission & Vision */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        {project.mission && (
          <div className="bg-emerald-500/[0.04] border border-emerald-500/10 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-400 mb-1">
              <Target className="w-3 h-3" /> Mission
            </div>
            <p className="text-xs text-slate-300 line-clamp-2">{project.mission}</p>
          </div>
        )}
        {project.vision && (
          <div className="bg-purple-500/[0.04] border border-purple-500/10 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-purple-400 mb-1">
              <Eye className="w-3 h-3" /> Vision
            </div>
            <p className="text-xs text-slate-300 line-clamp-2">{project.vision}</p>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#0e1422] border border-white/10 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-rose-500/15">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Delete Project</h4>
                <p className="text-xs text-slate-400 mt-0.5">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-slate-300 mb-4">
              Are you sure you want to permanently delete <strong className="text-white">{project.name}</strong>?
              All associated missions, tasks, and data will be removed.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 h-9 rounded-lg border border-white/10 text-slate-300 text-xs font-medium hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => { onDelete(project.id); setShowDeleteConfirm(false) }}
                className="flex-1 h-9 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition-all"
              >
                <Trash2 className="w-3.5 h-3.5 inline mr-1" />
                Delete Permanently
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  )
}

// ─── Main Panel ────────────────────────────────────────────────
export default function ProjectsPanel({ onEnterProject }: { onEnterProject?: (project: Project) => void }) {
  const [statusFilter, setStatusFilter] = useState<string>('active')
  const [showDialog, setShowDialog] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)

  const projectsQuery = useProjects(statusFilter)
  const createProject = useCreateProject()
  const updateProject = useUpdateProject()
  const archiveProject = useArchiveProject()
  const deleteProject = useArchiveProject()  // Reuse — API hard-deletes if already archived

  const projects = projectsQuery.data?.projects || []
  const isLoading = projectsQuery.isLoading

  const handleCreate = useCallback(async (data: { name: string; description?: string; mission?: string; vision?: string; mainGoal?: string }) => {
    try {
      await createProject.mutateAsync(data)
      toast({ title: 'Project created', description: `"${data.name}" is ready with its own folder.` })
    } catch (err: any) {
      toast({ title: 'Failed to create project', description: err?.message || 'Unknown error', variant: 'destructive' })
    }
  }, [createProject])

  const handleUpdate = useCallback(async (data: { name: string; description?: string; mission?: string; vision?: string; mainGoal?: string }) => {
    if (!editingProject) return
    try {
      await updateProject.mutateAsync({ id: editingProject.id, ...data })
      toast({ title: 'Project updated', description: `"${data.name}" saved.` })
    } catch (err: any) {
      toast({ title: 'Failed to update project', description: err?.message || 'Unknown error', variant: 'destructive' })
    }
  }, [editingProject, updateProject])

  const handleArchive = useCallback(async (id: string) => {
    try {
      await archiveProject.mutateAsync(id)
      toast({ title: 'Project archived' })
    } catch (err: any) {
      toast({ title: 'Failed to archive', description: err?.message || 'Unknown error', variant: 'destructive' })
    }
  }, [archiveProject])

  const handleUnarchive = useCallback(async (id: string) => {
    try {
      await updateProject.mutateAsync({ id, status: 'active' })
      toast({ title: 'Project restored', description: 'Project is back to active.' })
    } catch (err: any) {
      toast({ title: 'Failed to restore', description: err?.message || 'Unknown error', variant: 'destructive' })
    }
  }, [updateProject])

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteProject.mutateAsync(id)
      toast({ title: 'Project deleted', description: 'The project has been permanently removed.' })
    } catch (err: any) {
      toast({ title: 'Failed to delete', description: err?.message || 'Unknown error', variant: 'destructive' })
    }
  }, [deleteProject])

  const handleEnterProject = useCallback((p: Project) => {
    if (onEnterProject) {
      onEnterProject(p)
    }
  }, [onEnterProject])

  const openEdit = useCallback((p: Project) => {
    setEditingProject(p)
    setShowDialog(true)
  }, [])

  const openCreate = useCallback(() => {
    setEditingProject(null)
    setShowDialog(true)
  }, [])

  const FILTERS = [
    { key: '', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'archived', label: 'Archived' },
    { key: 'completed', label: 'Completed' },
  ]

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-cyan-400" />
            Projects
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Each project is a separate entity with its own folder, mission, and vision.
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              statusFilter === f.key
                ? 'bg-white/10 text-white'
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Project list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20">
          <FolderKanban className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-400 mb-2">No projects yet</h3>
          <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
            Click <strong>Add Project</strong> in the header to create your first project with its own folder,
            mission, and vision.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <AnimatePresence>
            {projects.map(p => (
              <ProjectCard
                key={p.id}
                project={p}
                onEdit={openEdit}
                onArchive={handleArchive}
                onDelete={handleDelete}
                onUnarchive={handleUnarchive}
                onEnterProject={handleEnterProject}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <ProjectDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        project={editingProject}
        onSave={editingProject ? handleUpdate : handleCreate}
      />
    </div>
  )
}
