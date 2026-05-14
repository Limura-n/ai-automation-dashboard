'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, Sparkles, Lightbulb, AlertTriangle, ThumbsUp,
  BookOpen, Zap, Star, Trash2, TrendingUp, TrendingDown,
  Loader2, Shield, Clock, ArrowUp, ArrowDown, CheckCircle2, RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useLearnings, useFeedback, useCreateFeedback } from '@/hooks/use-dashboard-data'
import { toast } from '@/hooks/use-toast'
import type { Learning, Feedback } from '@/hooks/use-dashboard-data'

// ─── Styles ──────────────────────────────────────────────────
const categoryStyles: Record<string, { icon: JSX.Element; color: string; bg: string; label: string }> = {
  workflow: {
    icon: <BookOpen className="w-4 h-4" />,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10 border-cyan-500/20',
    label: 'Workflow',
  },
  preference: {
    icon: <Star className="w-4 h-4" />,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
    label: 'Preference',
  },
  mistake: {
    icon: <AlertTriangle className="w-4 h-4" />,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10 border-rose-500/20',
    label: 'Mistake',
  },
}

const confidenceColor = (c: number) => {
  if (c >= 0.8) return 'text-emerald-400'
  if (c >= 0.5) return 'text-amber-400'
  return 'text-rose-400'
}

const confidenceBar = (c: number) => {
  if (c >= 0.8) return 'bg-emerald-500'
  if (c >= 0.5) return 'bg-amber-500'
  return 'bg-rose-500'
}

// ─── Learning Card ───────────────────────────────────────────
function LearningCard({ learning }: { learning: Learning }) {
  const cat = categoryStyles[learning.category] || categoryStyles.workflow

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-4 transition-all duration-200 hover:border-white/10 ${cat.bg}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <span className={cat.color}>{cat.icon}</span>
          <Badge variant="outline" className={`text-[10px] ${cat.color} ${cat.bg}`}>
            {cat.label}
          </Badge>
          <span className="text-[10px] text-slate-500">{learning.agentName}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-mono font-medium ${confidenceColor(learning.confidence)}`}>
            {Math.round(learning.confidence * 100)}%
          </span>
          {learning.appliedCount > 0 && (
            <Badge variant="outline" className="text-[10px] border-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />
              {learning.appliedCount}x
            </Badge>
          )}
        </div>
      </div>

      {/* Insight */}
      <p className="text-sm text-slate-300 leading-relaxed">{learning.insight}</p>

      {/* Evidence */}
      {learning.evidence && (
        <p className="text-[10px] text-slate-600 mt-2 italic">{learning.evidence}</p>
      )}

      {/* Confidence bar */}
      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${confidenceBar(learning.confidence)}`}
            style={{ width: `${learning.confidence * 100}%` }}
          />
        </div>
        <span className="text-[9px] text-slate-600">confidence</span>
      </div>
    </motion.div>
  )
}

// ─── Stats Bar ───────────────────────────────────────────────
function StatsBar({ learnings }: { learnings: Learning[] }) {
  const workflow = learnings.filter(l => l.category === 'workflow')
  const preference = learnings.filter(l => l.category === 'preference')
  const mistake = learnings.filter(l => l.category === 'mistake')
  const avgConf = learnings.length > 0
    ? Math.round(learnings.reduce((s, l) => s + l.confidence, 0) / learnings.length * 100)
    : 0
  const highConf = learnings.filter(l => l.confidence >= 0.7).length

  const stats = [
    { label: 'Total Learnings', value: learnings.length, icon: <Brain className="w-3.5 h-3.5" />, color: 'text-purple-400' },
    { label: 'Workflows', value: workflow.length, icon: <BookOpen className="w-3.5 h-3.5" />, color: 'text-cyan-400' },
    { label: 'Preferences', value: preference.length, icon: <Star className="w-3.5 h-3.5" />, color: 'text-amber-400' },
    { label: 'Mistakes Avoided', value: mistake.length, icon: <AlertTriangle className="w-3.5 h-3.5" />, color: 'text-rose-400' },
    { label: 'Avg Confidence', value: `${avgConf}%`, icon: <Shield className="w-3.5 h-3.5" />, color: 'text-emerald-400' },
    { label: 'Ready to Promote', value: highConf, icon: <Sparkles className="w-3.5 h-3.5" />, color: 'text-amber-400' },
  ]

  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
      {stats.map(s => (
        <div key={s.label} className="rounded-xl bg-white/[0.02] border border-white/5 p-3 text-center">
          <div className={`flex justify-center mb-1 ${s.color}`}>{s.icon}</div>
          <div className="text-lg font-bold text-white">{s.value}</div>
          <div className="text-[9px] text-slate-500 uppercase tracking-wider">{s.label}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Main Learning Panel ─────────────────────────────────────
export default function LearningPanel() {
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const { data, isLoading, isError, refetch } = useLearnings(undefined, '')
  const learnings = data?.learnings || []

  const filtered = categoryFilter
    ? learnings.filter(l => l.category === categoryFilter)
    : learnings

  // Sort by confidence desc
  const sorted = [...filtered].sort((a, b) => b.confidence - a.confidence)

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-400" />
            Agent Learning
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Accumulated wisdom from feedback and experience
          </p>
        </div>
      </div>

      {/* Stats */}
      <StatsBar learnings={learnings} />

      {/* Category filter */}
      <div className="flex gap-1.5 mb-3 shrink-0">
        {[
          { key: '', label: 'All', icon: <Brain className="w-3 h-3" /> },
          { key: 'workflow', label: 'Workflows', icon: <BookOpen className="w-3 h-3" /> },
          { key: 'preference', label: 'Preferences', icon: <Star className="w-3 h-3" /> },
          { key: 'mistake', label: 'Mistakes', icon: <AlertTriangle className="w-3 h-3" /> },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setCategoryFilter(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              categoryFilter === tab.key
                ? 'bg-white/10 text-white'
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <Separator className="bg-white/5 mb-3" />

      {/* Learning list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
              <AlertTriangle className="w-7 h-7 text-red-500" />
            </div>
            <p className="text-sm text-white font-medium mb-1">Failed to load learnings</p>
            <p className="text-xs text-slate-500 max-w-xs mb-4">
              Something went wrong while fetching your learnings.
            </p>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <Brain className="w-7 h-7 text-slate-600" />
            </div>
            <p className="text-sm text-white font-medium mb-1">No learnings yet</p>
            <p className="text-xs text-slate-500 max-w-xs">
              Learnings appear when you leave feedback on completed tasks.
              The Learning Agent processes feedback every 30 minutes.
            </p>
          </div>
        ) : (
          <>
            <div className="text-[10px] text-slate-600 mb-1">
              Showing {sorted.length} of {learnings.length} learnings
              {categoryFilter && ` (filtered by ${categoryFilter})`}
            </div>
            <AnimatePresence mode="popLayout">
              {sorted.map(learning => (
                <LearningCard key={learning.id} learning={learning} />
              ))}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  )
}
