'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  User, Target, Eye, Brain, Cpu, Clock, MessageCircle,
  Code, Palette, Zap, PenTool, Globe, Loader2, CheckCircle2,
  Pencil, Save, XCircle, ChevronRight, FolderKanban,
  UserPlus, AlertTriangle, RefreshCw,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { MODEL_GROUPS, getModelProvider } from '@/lib/models'
import { useProjectContext } from '@/lib/project-context'

// ─── Types ──────────────────────────────────────────────────
interface Profile {
  id: string
  name: string | null
  role: string | null
  skills: string | null
  workStyle: string | null
  experienceLevel: string | null
  mission: string | null
  vision: string | null
  personality: string | null
  communicationPref: string | null
  activeHours: string | null
  model: string | null
  preferences: Record<string, unknown> | null
  workflows: Record<string, unknown> | null
  setupComplete: boolean
  createdAt: string
  updatedAt: string
}

interface ProfilePanelProps {
  setActiveView?: (view: string) => void
}

// ─── Color helpers ──────────────────────────────────────────
const styleColors: Record<string, string> = {
  'hands-on': 'from-blue-500 to-blue-600',
  'hands-off': 'from-emerald-500 to-emerald-600',
  collaborative: 'from-purple-500 to-purple-600',
}

const levelColors: Record<string, string> = {
  beginner: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  intermediate: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
  advanced: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  expert: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
}

const skillIcons: Record<string, React.ReactNode> = {
  python: <Code className="w-3.5 h-3.5" />,
  design: <PenTool className="w-3.5 h-3.5" />,
  automation: <Zap className="w-3.5 h-3.5" />,
  content: <PenTool className="w-3.5 h-3.5" />,
  code: <Code className="w-3.5 h-3.5" />,
  writing: <PenTool className="w-3.5 h-3.5" />,
}

function getSkillIcon(skill: string): React.ReactNode {
  const key = Object.keys(skillIcons).find(k => skill.toLowerCase().includes(k))
  return key ? skillIcons[key] : <Cpu className="w-3.5 h-3.5" />
}

// ─── Edit Modal ─────────────────────────────────────────────
function EditProfileModal({ profile, onSave, onClose }: {
  profile: Profile
  onSave: (data: Partial<Profile>) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState({
    name: profile.name || '',
    role: profile.role || '',
    workStyle: profile.workStyle || 'collaborative',
    experienceLevel: profile.experienceLevel || 'advanced',
    mission: profile.mission || '',
    vision: profile.vision || '',
    personality: profile.personality || '',
    communicationPref: profile.communicationPref || 'telegram',
    activeHours: profile.activeHours || '',
    model: profile.model || '',
  })
  const [skillsArray, setSkillsArray] = useState<string[]>(
    () => profile.skills?.split(',').map(s => s.trim()).filter(Boolean) || []
  )
  const [skillInput, setSkillInput] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [saving, setSaving] = useState(false)

  const addSkill = () => {
    const trimmed = skillInput.trim()
    if (!trimmed) return
    if (skillsArray.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
      toast({ title: 'Skill already added', description: `"${trimmed}" is already in your skills.`, variant: 'destructive' })
      return
    }
    setSkillsArray([...skillsArray, trimmed])
    setSkillInput('')
  }

  const removeSkill = (index: number) => {
    setSkillsArray(skillsArray.filter((_, i) => i !== index))
  }

  const startEditSkill = (index: number) => {
    setEditingIndex(index)
    setEditingValue(skillsArray[index])
  }

  const saveEditSkill = () => {
    const trimmed = editingValue.trim()
    if (!trimmed || editingIndex === null) {
      setEditingIndex(null)
      return
    }
    const newSkills = [...skillsArray]
    newSkills[editingIndex] = trimmed
    setSkillsArray(newSkills)
    setEditingIndex(null)
    setEditingValue('')
  }

  const cancelEditSkill = () => {
    setEditingIndex(null)
    setEditingValue('')
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave({ ...form, skills: skillsArray.join(', ') })
      toast({ title: 'Profile updated', description: 'Your personality profile has been saved.' })
      onClose()
    } catch {
      toast({ title: 'Failed to save', description: 'Something went wrong.', variant: 'destructive' })
    }
    setSaving(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto glass-card p-6 mx-4 custom-scrollbar"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600">
              <Pencil className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-base font-bold text-white">Edit Profile</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-all">
            <XCircle className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Name</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                className="w-full h-9 px-3 mt-1 rounded-lg bg-white/5 border border-white/10 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40 transition-all" />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Role</label>
              <input value={form.role} onChange={e => setForm({...form, role: e.target.value})}
                className="w-full h-9 px-3 mt-1 rounded-lg bg-white/5 border border-white/10 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40 transition-all" />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Skills</label>
            <div className="flex gap-2 mt-1">
              <input
                value={skillInput}
                onChange={e => setSkillInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill() } }}
                placeholder="Add a skill..."
                className="flex-1 h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40 transition-all"
              />
              <button
                onClick={addSkill}
                disabled={!skillInput.trim()}
                className="h-9 px-4 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 disabled:opacity-40 text-white text-xs font-medium transition-all"
              >
                Add
              </button>
            </div>
            {skillsArray.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {skillsArray.map((skill, i) => (
                  <div key={`${skill}-${i}`} className="group relative">
                    {editingIndex === i ? (
                      <div className="flex items-center gap-1">
                        <input
                          value={editingValue}
                          onChange={e => setEditingValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveEditSkill()
                            if (e.key === 'Escape') cancelEditSkill()
                          }}
                          onBlur={saveEditSkill}
                          autoFocus
                          className="h-7 px-2 w-28 rounded-lg bg-white/10 border border-cyan-500/40 text-white text-xs focus:outline-none"
                        />
                        <button onClick={cancelEditSkill} className="p-0.5 text-slate-500 hover:text-white transition-colors">
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEditSkill(i)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer"
                      >
                        {getSkillIcon(skill)}
                        <span>{skill}</span>
                        <span
                          onClick={(e) => { e.stopPropagation(); removeSkill(i) }}
                          className="ml-1 p-0.5 rounded text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        >
                          <XCircle className="w-3 h-3" />
                        </span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {skillsArray.length === 0 && (
              <p className="text-[10px] text-slate-600 mt-1.5">No skills added yet. Type a skill and click Add.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Work Style</label>
              <select value={form.workStyle} onChange={e => setForm({...form, workStyle: e.target.value})}
                className="w-full h-9 px-3 mt-1 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-500/40 transition-all appearance-none">
                <option value="hands-on">Hands-on</option>
                <option value="hands-off">Hands-off</option>
                <option value="collaborative">Collaborative</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Experience</label>
              <select value={form.experienceLevel} onChange={e => setForm({...form, experienceLevel: e.target.value})}
                className="w-full h-9 px-3 mt-1 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-500/40 transition-all appearance-none">
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="expert">Expert</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Mission</label>
            <textarea value={form.mission} onChange={e => setForm({...form, mission: e.target.value})} rows={2}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40 transition-all resize-none" />
          </div>

          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Vision</label>
            <textarea value={form.vision} onChange={e => setForm({...form, vision: e.target.value})} rows={2}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40 transition-all resize-none" />
          </div>

          <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-cyan-500/10 border border-amber-500/20">
            <label className="text-[10px] text-slate-400 uppercase tracking-wider font-medium flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" />
              Main Goal (what success looks like)
            </label>
            <div className="flex gap-2 mt-1">
              <input value={form.mainGoal || ''} onChange={e => setForm({...form, mainGoal: e.target.value})}
                placeholder="e.g. Make $1M in one year"
                className="flex-1 h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-amber-500/40 transition-all" />
              <input value={form.mainGoalTarget || ''} onChange={e => setForm({...form, mainGoalTarget: e.target.value})}
                placeholder="Target ($)"
                type="number"
                className="w-28 h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-amber-500/40 transition-all" />
            </div>
            <p className="text-[9px] text-slate-600 mt-1">Your primary measurable goal — the vision progress bar will track this</p>
          </div>

          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Personality</label>
            <input value={form.personality} onChange={e => setForm({...form, personality: e.target.value})}
              className="w-full h-9 px-3 mt-1 rounded-lg bg-white/5 border border-white/10 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40 transition-all" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Communication</label>
              <select value={form.communicationPref} onChange={e => setForm({...form, communicationPref: e.target.value})}
                className="w-full h-9 px-3 mt-1 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-500/40 transition-all appearance-none">
                <option value="telegram">Telegram</option>
                <option value="dashboard">Dashboard</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Active Hours</label>
              <input value={form.activeHours} onChange={e => setForm({...form, activeHours: e.target.value})}
                className="w-full h-9 px-3 mt-1 rounded-lg bg-white/5 border border-white/10 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40 transition-all" />
            </div>
          </div>

          {/* AI Model Selection */}
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">AI Model (Main Agent)</label>
            <p className="text-[9px] text-slate-600 mt-0.5 mb-1.5">Select which AI model Limura uses to orchestrate your missions</p>
            <select value={form.model} onChange={e => setForm({...form, model: e.target.value})}
              className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-500/40 transition-all appearance-none">
              <option value="" className="text-slate-900">Use Default (deepseek-v4-flash)</option>
              {MODEL_GROUPS.map(group => (
                <optgroup key={group.provider} label={group.displayName} className="text-slate-500">
                  {group.models.map(model => (
                    <option key={model} value={model} className="text-slate-900">{model}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <Button onClick={handleSave} disabled={saving}
            className="flex-1 h-10 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-medium rounded-xl text-xs">
            {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving...</> : <><Save className="w-3.5 h-3.5 mr-1.5" /> Save Profile</>}
          </Button>
          <Button variant="ghost" onClick={onClose}
            className="h-10 px-4 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl text-xs">
            Cancel
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Main Profile Panel ────────────────────────────────────
export default function ProfilePanel({ setActiveView }: ProfilePanelProps) {
  const { activeProject, projectId } = useProjectContext()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showEdit, setShowEdit] = useState(false)

  const profileUrl = projectId ? `/api/profile?projectId=${projectId}` : '/api/profile'

  const fetchProfile = () => {
    setLoading(true)
    setError(null)
    fetch(profileUrl)
      .then(r => {
        if (!r.ok) throw new Error('Failed to load profile')
        return r.json()
      })
      .then(data => {
        // If project profile is empty, fall back to global
        if (data.profile && !data.profile.name && projectId) {
          fetch('/api/profile').then(r => r.json()).then(globalData => {
            setProfile(globalData.profile || data.profile)
            setLoading(false)
          }).catch(() => {
            setProfile(data.profile)
            setLoading(false)
          })
        } else {
          setProfile(data.profile)
          setLoading(false)
        }
      })
      .catch(err => {
        setError(err.message || 'Something went wrong')
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchProfile()
  }, [profileUrl])

  const handleSave = async (data: Partial<Profile>) => {
    let res
    if (profile) {
      res = await fetch(`/api/profile${projectId ? `?projectId=${projectId}` : ''}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, projectId }),
      })
    } else {
      res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, projectId }),
      })
    }
    const result = await res.json()
    if (result.success) {
      setProfile(result.profile)
      setShowEdit(false)
    } else {
      throw new Error(result.error || 'Failed to save profile')
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-48 bg-white/5 rounded-xl" />
        <Skeleton className="h-40 bg-white/5 rounded-2xl" />
        <Skeleton className="h-32 bg-white/5 rounded-2xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white">Your Profile</h2>
        <div className="glass-card p-8 text-center">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-rose-400" />
          <p className="text-sm text-rose-400 mb-3">{error}</p>
          <Button onClick={fetchProfile} variant="outline" className="text-xs border-white/10 text-slate-300 hover:bg-white/5">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Try Again
          </Button>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-bold text-white">Your Profile</h2>
          <p className="text-xs text-slate-400 mt-0.5">Set up your personality profile so I can work smarter for you</p>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 text-center"
        >
          <User className="w-12 h-12 mx-auto mb-3 text-slate-600" />
          <p className="text-sm text-slate-400 mb-1">No profile yet</p>
          <p className="text-xs text-slate-600 mb-4">Run setup.sh or create one below</p>
          <Button
            onClick={() => setShowEdit(true)}
            className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white rounded-xl text-xs h-10 px-5"
          >
            <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Create Profile
          </Button>
        </motion.div>
        {showEdit && (
          <EditProfileModal
            profile={{
              id: '',
              name: null, role: null, skills: null, workStyle: null,
              experienceLevel: null, mission: null, vision: null,
              personality: null, communicationPref: null, activeHours: null, model: null,
              preferences: null, workflows: null, setupComplete: false,
              createdAt: '', updatedAt: '',
            }}
            onSave={handleSave}
            onClose={() => setShowEdit(false)}
          />
        )}
      </div>
    )
  }

  const skills = profile.skills?.split(',').map(s => s.trim()).filter(Boolean) || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Your Profile</h2>
          <p className="text-xs text-slate-400 mt-0.5">I use this to adapt how I work for you</p>
        </div>
        <Button
          variant="ghost"
          onClick={() => setShowEdit(true)}
          className="text-xs text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
        >
          <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
        </Button>
      </div>

      {/* Identity Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-5"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <span className="text-2xl font-bold text-white">
              {profile.name?.[0] || '?'}
            </span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white">{profile.name || 'Unknown'}</h3>
              {profile.role && (
                <Badge variant="outline" className="bg-white/5 text-slate-400 border-white/10 text-[10px]">
                  {profile.role}
                </Badge>
              )}
              {activeProject && (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] flex items-center gap-1">
                  <FolderKanban className="w-2.5 h-2.5" />
                  {activeProject.name}
                </Badge>
              )}
            </div>
            {profile.personality && (
              <p className="text-xs text-slate-400 mt-1">{profile.personality}</p>
            )}
            <div className="flex items-center gap-3 mt-2 text-[10px]">
              {profile.workStyle && (
                <Badge variant="outline" className={`bg-gradient-to-r ${styleColors[profile.workStyle] || 'from-slate-500 to-slate-600'} bg-opacity-10 text-white border-white/10`}>
                  {profile.workStyle === 'hands-on' ? '✋ Hands-on' : profile.workStyle === 'hands-off' ? '🚀 Hands-off' : '🤝 Collaborative'}
                </Badge>
              )}
              {profile.experienceLevel && (
                <Badge variant="outline" className={`${levelColors[profile.experienceLevel] || 'bg-slate-500/15 text-slate-400'} text-[10px] capitalize`}>
                  {profile.experienceLevel}
                </Badge>
              )}
              {profile.communicationPref && (
                <span className="text-slate-500 flex items-center gap-1">
                  <MessageCircle className="w-3 h-3" />
                  {profile.communicationPref}
                </span>
              )}
              {profile.activeHours && (
                <span className="text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {profile.activeHours}
                </span>
              )}
              {profile.model && (
                <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-[10px] flex items-center gap-1">
                  <Cpu className="w-2.5 h-2.5" />
                  {profile.model}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Skills */}
      {skills.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-5"
        >
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
            <Code className="w-4 h-4 text-cyan-400" />
            Skills
          </h3>
          <div className="flex flex-wrap gap-2">
            {skills.map((skill, i) => (
              <motion.div
                key={skill}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300"
              >
                {getSkillIcon(skill)}
                {skill}
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Agent Requests — pending info needed */}
      <AgentRequestsSection projectId={projectId} />

      {/* Mission & Vision */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {profile.mission && (
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400">
                <Target className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-white">Mission</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{profile.mission}</p>
          </div>
        )}
        {profile.vision && (
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-purple-500/15 text-purple-400">
                <Eye className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-white">Vision</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{profile.vision}</p>
          </div>
        )}
        {profile.mainGoal && (
          <div className="glass-card p-5 border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400">
                <Zap className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-white">Main Goal</h3>
              {profile.mainGoalTarget && (
                <span className="text-[10px] text-amber-400/60 font-mono">Target: ${Number(profile.mainGoalTarget).toLocaleString()}</span>
              )}
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{profile.mainGoal}</p>
          </div>
        )}
      </motion.div>

      {/* How this affects my work */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card p-5"
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400">
            <Brain className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-semibold text-white">How this changes how I work</h3>
        </div>
        <div className="space-y-2 text-xs text-slate-400">
          <p>🔹 <span className="text-slate-300">Task planning:</span> I tailor mission decomposition to your skill level and work style</p>
          <p>🔹 <span className="text-slate-300">Sub-agent hiring:</span> I fill gaps in your skills, not duplicate them</p>
          <p>🔹 <span className="text-slate-300">Reporting:</span> You get the level of detail you prefer ({profile.communicationPref || 'telegram'})</p>
          <p>🔹 <span className="text-slate-300">Scheduling:</span> Heavy missions run during your active hours ({profile.activeHours || 'anytime'})</p>
          <p>🔹 <span className="text-slate-300">Alignment:</span> Every task ties back to your mission and vision</p>
        </div>
      </motion.div>

      {/* Edit Modal */}
      {showEdit && (
        <EditProfileModal
          profile={profile}
          onSave={handleSave}
          onClose={() => setShowEdit(false)}
        />
      )}
    </div>
  )
}

// ─── Agent Requests Section ──────────────────────────────────
function AgentRequestsSection({ projectId }: { projectId?: string }) {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [answers, setAnswers] = useState<Record<string, string>>({})

  const fetchQuestions = useCallback(() => {
    const params = projectId ? `?projectId=${projectId}&status=pending` : '?status=pending'
    fetch(`/api/agent/questions${params}`)
      .then(r => r.json())
      .then(data => {
        setRequests(data.questions || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [projectId])

  useEffect(() => {
    fetchQuestions()
  }, [fetchQuestions])

  // Poll for new questions every 30s
  useEffect(() => {
    const interval = setInterval(fetchQuestions, 30000)
    return () => clearInterval(interval)
  }, [fetchQuestions])

  const handleSubmit = async (id: string) => {
    const value = answers[id]?.trim()
    if (!value) return
    try {
      const res = await fetch(`/api/agent/questions?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: value }),
      })
      if (!res.ok) throw new Error('Failed to submit')
      setRequests(prev => prev.filter(r => r.id !== id))
      toast({ title: '✅ Answer submitted!', description: 'The agent has what it needs.' })
    } catch {
      toast({ title: 'Failed to submit', description: 'Could not send your answer.', variant: 'destructive' })
    }
  }

  const handleDismiss = async (id: string) => {
    try {
      await fetch(`/api/agent/questions?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: '', status: 'dismissed' }),
      })
      setRequests(prev => prev.filter(r => r.id !== id))
    } catch {}
  }

  if (loading) return null
  if (requests.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-5 border-amber-500/20"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400">
          <MessageCircle className="w-4 h-4" />
        </div>
        <h3 className="text-sm font-semibold text-white">Agent Needs Your Input</h3>
        <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/20 text-[10px]">
          {requests.length} pending
        </Badge>
      </div>

      <div className="space-y-4">
        {requests.map(req => (
          <div key={req.id} className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-white">{req.question}</span>
                  <Badge className="bg-rose-500/15 text-rose-400 border-rose-500/20 text-[9px]">Pending</Badge>
                </div>
                {req.context && (
                  <p className="text-[10px] text-slate-500 mt-0.5">{req.context}</p>
                )}
              </div>
              <button
                onClick={() => handleDismiss(req.id)}
                className="text-[10px] text-slate-600 hover:text-slate-400 ml-2 shrink-0"
              >
                ✕
              </button>
            </div>
            <div className="flex gap-2">
              <input
                value={answers[req.id] || ''}
                onChange={e => setAnswers({...answers, [req.id]: e.target.value})}
                placeholder="Type your answer..."
                className="flex-1 h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-amber-500/40 transition-all"
              />
              <button
                onClick={() => handleSubmit(req.id)}
                disabled={!answers[req.id]?.trim()}
                className="px-4 h-9 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-medium hover:bg-amber-500/25 transition-colors disabled:opacity-40"
              >
                Submit
              </button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
