'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  User, UserCircle, Code, Clock, MessageCircle,
  Pencil, Save, XCircle, Loader2, Asterisk,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'

// ─── Types ──────────────────────────────────────────────────
interface UserProfile {
  id: string
  name: string | null
  role: string | null
  skills: string | null
  workStyle: string | null
  experienceLevel: string | null
  personality: string | null
  communicationPref: string | null
  activeHours: string | null
  model: string | null
  createdAt: string
  updatedAt: string
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

// ─── Required field helper ──────────────────────────────────
function RequiredLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[10px] text-slate-500 uppercase tracking-wider font-medium flex items-center gap-1">
      {children}
      <span className="text-rose-400 text-[8px]">*required</span>
    </label>
  )
}

// ─── Edit Modal ─────────────────────────────────────────────
interface EditUserProfileModalProps {
  profile: UserProfile
  onSave: (data: Partial<UserProfile>) => Promise<void>
  onClose: () => void
  onboarding?: boolean
}

function EditUserProfileModal({ profile, onSave, onClose, onboarding }: EditUserProfileModalProps) {
  const [form, setForm] = useState({
    name: profile.name || '',
    role: profile.role || '',
    workStyle: profile.workStyle || 'collaborative',
    experienceLevel: profile.experienceLevel || 'advanced',
    personality: profile.personality || '',
    communicationPref: profile.communicationPref || 'telegram',
    activeHours: profile.activeHours || '',
    model: profile.model || '',
  })
  const [skillsArray, setSkillsArray] = useState<string[]>(
    () => profile.skills?.split(',').map(s => s.trim()).filter(Boolean) || []
  )
  const [skillInput, setSkillInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const requiredFields = ['name', 'role', 'personality', 'activeHours']

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

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!form.name.trim()) newErrors.name = 'Name is required'
    if (!form.role.trim()) newErrors.role = 'Role is required'
    if (!form.personality.trim()) newErrors.personality = 'Personality is required'
    if (!form.activeHours.trim()) newErrors.activeHours = 'Active hours is required'
    if (skillsArray.length === 0) newErrors.skills = 'At least one skill is required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      await onSave({ ...form, skills: skillsArray.join(', ') })
      toast({ title: 'Profile saved', description: 'Your global profile has been set up.' })
      onClose()
    } catch {
      toast({ title: 'Failed to save', description: 'Something went wrong.', variant: 'destructive' })
    }
    setSaving(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    }
  }

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
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto overflow-x-hidden glass-card p-6 mx-4 custom-scrollbar"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600">
              <Pencil className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-base font-bold text-white">
              {onboarding ? 'Welcome! Tell Me About Yourself' : 'Edit About Me'}
            </h3>
          </div>
          {!onboarding && (
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-all">
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>

        {onboarding && (
          <p className="text-xs text-cyan-400 mb-4">Fill in all required fields to set up your profile.</p>
        )}

        <div className="space-y-4" onKeyDown={handleKeyDown}>
          {/* Name + Role */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <RequiredLabel>Name</RequiredLabel>
              <input value={form.name} onChange={e => { setForm({...form, name: e.target.value}); setErrors(prev => ({...prev, name: ''})) }}
                placeholder="Your name"
                className={`w-full h-9 px-3 mt-1 rounded-lg bg-white/5 border text-white text-xs placeholder:text-slate-600 focus:outline-none transition-all ${
                  errors.name ? 'border-rose-500/50' : 'border-white/10 focus:border-cyan-500/40'
                }`} />
              {errors.name && <p className="text-[9px] text-rose-400 mt-0.5">{errors.name}</p>}
            </div>
            <div>
              <RequiredLabel>Role</RequiredLabel>
              <input value={form.role} onChange={e => { setForm({...form, role: e.target.value}); setErrors(prev => ({...prev, role: ''})) }}
                placeholder="e.g., Creator, Developer"
                className={`w-full h-9 px-3 mt-1 rounded-lg bg-white/5 border text-white text-xs placeholder:text-slate-600 focus:outline-none transition-all ${
                  errors.role ? 'border-rose-500/50' : 'border-white/10 focus:border-cyan-500/40'
                }`} />
              {errors.role && <p className="text-[9px] text-rose-400 mt-0.5">{errors.role}</p>}
            </div>
          </div>

          {/* Skills */}
          <div>
            <RequiredLabel>Skills</RequiredLabel>
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
                  <div key={`${skill}-${i}`} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300">
                    <span>{skill}</span>
                    <button
                      onClick={() => removeSkill(i)}
                      className="p-0.5 rounded text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    >
                      <XCircle className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {skillsArray.length === 0 && (
              <p className="text-[10px] text-slate-600 mt-1.5">No skills added yet. Type a skill and click Add.</p>
            )}
            {errors.skills && <p className="text-[9px] text-rose-400 mt-0.5">{errors.skills}</p>}
          </div>

          {/* Work Style + Experience */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <RequiredLabel>Work Style</RequiredLabel>
              <select value={form.workStyle} onChange={e => setForm({...form, workStyle: e.target.value})}
                className="w-full h-9 px-3 mt-1 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-500/40 transition-all appearance-none">
                <option value="hands-on">Hands-on</option>
                <option value="hands-off">Hands-off</option>
                <option value="collaborative">Collaborative</option>
              </select>
            </div>
            <div>
              <RequiredLabel>Experience</RequiredLabel>
              <select value={form.experienceLevel} onChange={e => setForm({...form, experienceLevel: e.target.value})}
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
            <RequiredLabel>Personality Description</RequiredLabel>
            <input value={form.personality} onChange={e => { setForm({...form, personality: e.target.value}); setErrors(prev => ({...prev, personality: ''})) }}
              placeholder="Describe yourself — e.g., Pragmatic builder who values automation"
              className={`w-full h-9 px-3 mt-1 rounded-lg bg-white/5 border text-white text-xs placeholder:text-slate-600 focus:outline-none transition-all ${
                errors.personality ? 'border-rose-500/50' : 'border-white/10 focus:border-cyan-500/40'
              }`} />
            {errors.personality && <p className="text-[9px] text-rose-400 mt-0.5">{errors.personality}</p>}
          </div>

          {/* Communication + Active Hours */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <RequiredLabel>Communication</RequiredLabel>
              <select value={form.communicationPref} onChange={e => setForm({...form, communicationPref: e.target.value})}
                className="w-full h-9 px-3 mt-1 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-500/40 transition-all appearance-none">
                <option value="telegram">Telegram</option>
                <option value="dashboard">Dashboard</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div>
              <RequiredLabel>Active Hours</RequiredLabel>
              <input value={form.activeHours} onChange={e => { setForm({...form, activeHours: e.target.value}); setErrors(prev => ({...prev, activeHours: ''})) }}
                placeholder="e.g., 9am-11pm"
                className={`w-full h-9 px-3 mt-1 rounded-lg bg-white/5 border text-white text-xs placeholder:text-slate-600 focus:outline-none transition-all ${
                  errors.activeHours ? 'border-rose-500/50' : 'border-white/10 focus:border-cyan-500/40'
                }`} />
              {errors.activeHours && <p className="text-[9px] text-rose-400 mt-0.5">{errors.activeHours}</p>}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <Button onClick={handleSave} disabled={saving}
            className="flex-1 h-10 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-medium rounded-xl text-xs">
            {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving...</> : <><Save className="w-3.5 h-3.5 mr-1.5" /> Save Profile</>}
          </Button>
          {!onboarding && (
            <Button variant="ghost" onClick={onClose}
              className="h-10 px-4 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl text-xs">
              Cancel
            </Button>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── About Me Panel ─────────────────────────────────────────
export default function UserProfilePanel({ onClose, onboarding }: {
  onClose?: () => void
  onboarding?: boolean
}) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showEdit, setShowEdit] = useState(false)

  const fetchProfile = () => {
    setLoading(true)
    setError(null)
    fetch('/api/profile') // no projectId = global profile
      .then(r => {
        if (!r.ok) throw new Error('Failed to load profile')
        return r.json()
      })
      .then(data => {
        setProfile(data.profile)
        setLoading(false)
        // Auto-open edit if onboarding and no full profile
        if (onboarding && (!data.profile || !data.profile.name)) {
          setShowEdit(true)
        }
      })
      .catch(err => {
        setError(err.message || 'Something went wrong')
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchProfile()
  }, [])

  const handleSave = async (data: Partial<UserProfile>) => {
    let res
    if (profile) {
      res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
    } else {
      res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
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
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-full bg-white/5" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-32 bg-white/5 rounded" />
            <Skeleton className="h-3 w-20 bg-white/5 rounded" />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4">
        <p className="text-xs text-rose-400">{error}</p>
        <button onClick={fetchProfile} className="text-xs text-cyan-400 hover:text-cyan-300 mt-2">Try again</button>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="space-y-4">
        <div className="glass-card p-6 text-center rounded-xl">
          <UserCircle className="w-10 h-10 mx-auto mb-2 text-slate-600" />
          <p className="text-sm text-slate-400 mb-1">No profile yet</p>
          <p className="text-xs text-slate-600 mb-4">Tell me about yourself</p>
          <Button
            onClick={() => setShowEdit(true)}
            className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white rounded-xl text-xs h-9 px-4"
          >
            <User className="w-3.5 h-3.5 mr-1.5" /> Create Profile
          </Button>
        </div>
        {showEdit && (
          <EditUserProfileModal
            profile={{ id: '', name: null, role: null, skills: null, workStyle: null, experienceLevel: null, personality: null, communicationPref: null, activeHours: null, model: null, createdAt: '', updatedAt: '' }}
            onSave={handleSave}
            onClose={() => { setShowEdit(false); onClose?.() }}
            onboarding={onboarding}
          />
        )}
      </div>
    )
  }

  const skills = profile.skills?.split(',').map(s => s.trim()).filter(Boolean) || []

  return (
    <>
      {!onboarding && (
        <div className="space-y-3">
          {/* Identity section */}
          <div className="glass-card p-4 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 shrink-0">
                <span className="text-lg font-bold text-white">{profile.name?.[0] || '?'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white truncate">{profile.name || 'Unknown'}</h3>
                  {profile.role && (
                    <Badge variant="outline" className="bg-white/5 text-slate-400 border-white/10 text-[9px] shrink-0">
                      {profile.role}
                    </Badge>
                  )}
                </div>
                {profile.personality && (
                  <p className="text-[10px] text-slate-400 mt-0.5 truncate">{profile.personality}</p>
                )}
              </div>
              <button
                onClick={() => setShowEdit(true)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-cyan-400 transition-all shrink-0"
                title="Edit"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Details row */}
            <div className="flex flex-wrap items-center gap-2 mt-3 text-[10px]">
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
            </div>
          </div>

          {/* Skills */}
          {skills.length > 0 && (
            <div className="glass-card p-4 rounded-xl">
              <h4 className="text-xs font-semibold text-white flex items-center gap-1.5 mb-2">
                <Code className="w-3.5 h-3.5 text-cyan-400" />
                Skills
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {skills.map((skill, i) => (
                  <span key={skill} className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] text-slate-300">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showEdit && (
        <EditUserProfileModal
          profile={profile}
          onSave={handleSave}
          onClose={() => { setShowEdit(false); onClose?.() }}
          onboarding={onboarding}
        />
      )}
    </>
  )
}
