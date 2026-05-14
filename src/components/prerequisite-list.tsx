'use client'

import { useState } from 'react'
import { CheckCircle2, Circle, AlertTriangle, ShieldBan, Loader2, Plus } from 'lucide-react'

interface PrerequisiteItem {
  id: string
  fieldKey: string
  label: string
  description?: string
  fieldType: string
  required: boolean
  value?: string
  status: string
  category: string
}

interface PrerequisiteListProps {
  prerequisites: PrerequisiteItem[]
  categories: Record<string, PrerequisiteItem[]>
  summary: { total: number; filled: number; required: number; requiredFilled: number; blocked: boolean; ready: boolean }
  projectId: string
  onUpdate: () => void
  loading?: boolean
}

const CATEGORY_LABELS: Record<string, string> = {
  setup: '🏗️ Store & Website',
  branding: '🎨 Branding',
  legal: '⚖️ Legal & Compliance',
  payment: '💳 Payments',
  support: '💬 Customer Support',
  marketing: '📣 Marketing',
}

const FIELD_TYPE_PLACEHOLDERS: Record<string, string> = {
  text: 'Enter value...',
  url: 'https://...',
  yesno: 'Yes / No',
  file: 'File path...',
}

export default function PrerequisiteList({ prerequisites, categories, summary, projectId, onUpdate, loading }: PrerequisiteListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newFieldType, setNewFieldType] = useState('text')
  const [newCategory, setNewCategory] = useState('setup')
  const [newRequired, setNewRequired] = useState(true)
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (!newLabel.trim()) return
    setCreating(true)
    try {
      const fieldKey = newLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      await fetch('/api/prerequisites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          fieldKey,
          label: newLabel.trim(),
          description: newDescription.trim() || undefined,
          fieldType: newFieldType,
          required: newRequired,
          category: newCategory,
        }),
      })
      setNewLabel('')
      setNewDescription('')
      setNewFieldType('text')
      setNewCategory('setup')
      setNewRequired(true)
      setShowAddForm(false)
      onUpdate()
    } catch (err) { console.error('Failed to create prerequisite:', err) }
    setCreating(false)
  }

  if (loading) {
    return (
      <div className="p-4 text-center">
        <Loader2 className="w-5 h-5 text-slate-500 animate-spin mx-auto mb-2" />
        <p className="text-xs text-slate-500">Loading prerequisites...</p>
      </div>
    )
  }

  if (prerequisites.length === 0) {
    return (
      <div className="p-4 text-center">
        {showAddForm ? (
          <div className="space-y-3 text-left">
            <h4 className="text-xs font-semibold text-slate-300">New Prerequisite</h4>
            <input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="Label (e.g. Domain name)"
              className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-500/40"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowAddForm(false) }}
            />
            <input
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
              placeholder="Description (optional)"
              className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-500/40"
            />
            <div className="flex gap-2">
              <select
                value={newFieldType}
                onChange={e => setNewFieldType(e.target.value)}
                className="flex-1 px-2 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-500/40"
              >
                <option value="text">Text</option>
                <option value="url">URL</option>
                <option value="yesno">Yes / No</option>
                <option value="file">File</option>
              </select>
              <select
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                className="flex-1 px-2 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-500/40"
              >
                <option value="setup">Store & Website</option>
                <option value="branding">Branding</option>
                <option value="legal">Legal & Compliance</option>
                <option value="payment">Payments</option>
                <option value="support">Customer Support</option>
                <option value="marketing">Marketing</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-400">
              <input
                type="checkbox"
                checked={newRequired}
                onChange={e => setNewRequired(e.target.checked)}
                className="rounded bg-white/10 border-white/20"
              />
              Required (blocks execution if unfilled)
            </label>
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={creating || !newLabel.trim()}
                className="flex-1 text-xs px-3 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-40"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-xs px-3 py-2 rounded-lg bg-slate-500/20 text-slate-400 hover:bg-slate-500/30 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-xs text-slate-400">No prerequisites defined</p>
            <p className="text-[10px] text-slate-600 mt-1">The main agent can add them, or you can add manually</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-3 inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors border border-cyan-500/20"
            >
              <Plus className="w-3 h-3" />
              Add Prerequisite
            </button>
          </>
        )}
      </div>
    )
  }

  const handleSave = async (id: string) => {
    setSaving(true)
    try {
      await fetch('/api/prerequisites', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, value: editValue, status: editValue ? 'filled' : 'pending' }),
      })
      onUpdate()
    } catch (err) { console.error('Failed to save prerequisite:', err) }
    setEditingId(null)
    setSaving(false)
  }

  const handleSkip = async (id: string) => {
    try {
      await fetch('/api/prerequisites', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'skipped' }),
      })
      onUpdate()
    } catch (err) { console.error('Failed to skip prerequisite:', err) }
  }

  const handleUnskip = async (id: string) => {
    try {
      await fetch('/api/prerequisites', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'pending' }),
      })
      onUpdate()
    } catch (err) { console.error('Failed to unskip prerequisite:', err) }
  }

  const startEdit = (p: PrerequisiteItem) => {
    setEditingId(p.id)
    setEditValue(p.value || '')
  }

  return (
    <div className="space-y-5">
      {/* Summary bar */}
      <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
        {summary.blocked ? (
          <ShieldBan className="w-4 h-4 text-amber-400 shrink-0" />
        ) : summary.ready ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-slate-500 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          {summary.blocked ? (
            <p className="text-xs text-amber-400">
              ⚠️ {summary.required - summary.requiredFilled} of {summary.required} required items pending — execution paused
            </p>
          ) : summary.ready ? (
            <p className="text-xs text-emerald-400">✅ All prerequisites met — ready to execute</p>
          ) : (
            <p className="text-xs text-slate-400">No required prerequisites</p>
          )}
        </div>
        <span className="text-[10px] text-slate-500 font-mono shrink-0">
          {summary.requiredFilled}/{summary.required} req · {summary.filled}/{summary.total} total
        </span>
        <button
          onClick={() => setShowAddForm(true)}
          className="text-[10px] inline-flex items-center gap-1 px-2 py-1 rounded bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/20 transition-colors shrink-0"
          title="Add prerequisite"
        >
          <Plus className="w-2.5 h-2.5" />
          Add
        </button>
      </div>

      {showAddForm && (
        <div className="space-y-3 p-4 rounded-xl bg-white/5 border border-white/10">
          <h4 className="text-xs font-semibold text-slate-300">New Prerequisite</h4>
          <input
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder="Label (e.g. Domain name)"
            className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-500/40"
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowAddForm(false) }}
          />
          <input
            value={newDescription}
            onChange={e => setNewDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-500/40"
          />
          <div className="flex gap-2">
            <select
              value={newFieldType}
              onChange={e => setNewFieldType(e.target.value)}
              className="flex-1 px-2 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-500/40"
            >
              <option value="text">Text</option>
              <option value="url">URL</option>
              <option value="yesno">Yes / No</option>
              <option value="file">File</option>
            </select>
            <select
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              className="flex-1 px-2 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-500/40"
            >
              <option value="setup">Store & Website</option>
              <option value="branding">Branding</option>
              <option value="legal">Legal & Compliance</option>
              <option value="payment">Payments</option>
              <option value="support">Customer Support</option>
              <option value="marketing">Marketing</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={newRequired}
              onChange={e => setNewRequired(e.target.checked)}
              className="rounded bg-white/10 border-white/20"
            />
            Required (blocks execution if unfilled)
          </label>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={creating || !newLabel.trim()}
              className="flex-1 text-xs px-3 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-40"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-xs px-3 py-2 rounded-lg bg-slate-500/20 text-slate-400 hover:bg-slate-500/30 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Categories */}
      {Object.entries(categories).map(([category, items]) => (
        <div key={category} className="space-y-2">
          <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-1">
            {CATEGORY_LABELS[category] || category}
          </h4>
          <div className="space-y-1.5">
            {items.map((p) => {
              const isFilled = p.status === 'filled'
              const isSkipped = p.status === 'skipped'
              const isEditing = editingId === p.id

              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-colors ${
                    isFilled
                      ? 'bg-emerald-500/5 border-emerald-500/20'
                      : isSkipped
                      ? 'bg-slate-500/5 border-slate-500/10 opacity-60'
                      : 'bg-white/5 border-white/10'
                  }`}
                >
                  {/* Status icon */}
                  {isFilled ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : isSkipped ? (
                    <Circle className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  ) : (
                    <Circle className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  )}

                  {/* Label & value */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className={`text-xs truncate ${isFilled ? 'text-emerald-300' : isSkipped ? 'text-slate-500 line-through' : 'text-slate-300'}`}>
                        {p.label}
                      </p>
                      {p.required && (
                        <span className={`text-[9px] shrink-0 ${isFilled ? 'text-emerald-600' : 'text-rose-500/80'}`}>
                          *required
                        </span>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="flex items-center gap-1 mt-1">
                        {p.fieldType === 'yesno' ? (
                          <select
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            className="px-2 py-1 rounded bg-white/10 border border-white/10 text-white text-[10px] focus:outline-none focus:border-cyan-500/40"
                            autoFocus
                          >
                            <option value="">Select...</option>
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                          </select>
                        ) : (
                          <input
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            placeholder={FIELD_TYPE_PLACEHOLDERS[p.fieldType] || 'Enter...'}
                            className="flex-1 px-2 py-1 rounded bg-white/10 border border-white/10 text-white text-[10px] focus:outline-none focus:border-cyan-500/40"
                            autoFocus
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleSave(p.id)
                              if (e.key === 'Escape') setEditingId(null)
                            }}
                          />
                        )}
                        <button
                          onClick={() => handleSave(p.id)}
                          disabled={saving}
                          className="text-[10px] px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors shrink-0"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-[10px] px-2 py-1 rounded bg-slate-500/20 text-slate-400 hover:bg-slate-500/30 transition-colors shrink-0"
                        >
                          ✕
                        </button>
                      </div>
                    ) : isFilled ? (
                      <p className="text-[10px] text-emerald-500/70 mt-0.5 truncate">{p.value}</p>
                    ) : (
                      p.description && (
                        <p className="text-[10px] text-slate-600 mt-0.5 truncate">{p.description}</p>
                      )
                    )}
                  </div>

                  {/* Actions */}
                  {isFilled ? (
                    <button
                      onClick={() => startEdit(p)}
                      className="text-[10px] text-slate-500 hover:text-cyan-400 px-1.5 py-0.5 rounded hover:bg-white/5 transition-colors shrink-0"
                      title="Edit"
                    >
                      ✎
                    </button>
                  ) : isSkipped ? (
                    <button
                      onClick={() => handleUnskip(p.id)}
                      className="text-[10px] text-slate-500 hover:text-cyan-400 px-1.5 py-0.5 rounded hover:bg-white/5 transition-colors shrink-0"
                      title="Mark as needed"
                    >
                      ↻
                    </button>
                  ) : (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={() => startEdit(p)}
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 px-1.5 py-0.5 rounded hover:bg-white/5 transition-colors"
                        title="Fill"
                      >
                        ✎
                      </button>
                      {!p.required && (
                        <button
                          onClick={() => handleSkip(p.id)}
                          className="text-[10px] text-slate-600 hover:text-slate-400 px-1 py-0.5 rounded hover:bg-white/5 transition-colors"
                          title="Skip (not required)"
                        >
                          ⏭
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
