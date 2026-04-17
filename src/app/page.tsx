'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import {
  Image, Film, Sparkles, Clock, CheckCircle2, AlertTriangle,
  HardDrive, Loader2, Activity, Search, Bell, Settings,
  ChevronDown, ChevronUp, Layers, Zap, Pause, Play,
  Download, TrendingUp, TrendingDown, XCircle, Inbox,
  Monitor, BarChart3, Cpu, ArrowUpRight, ArrowDownRight,
  RefreshCw, LayoutGrid, List, MoreHorizontal,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { useDashboardStats, useTasks, useChartData, useRecentActivity } from '@/hooks/use-dashboard-data'

// ─── Color Palette ──────────────────────────────────────────
const COLORS = {
  teal: '#0ea5e9',
  cyan: '#06b6d4',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  purple: '#a855f7',
  slate: '#64748b',
}

const PIE_COLORS = [COLORS.teal, COLORS.emerald, COLORS.amber, COLORS.rose, COLORS.purple]

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  completed: { label: 'Completed', color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/20', icon: <CheckCircle2 className="w-3 h-3" /> },
  processing: { label: 'Processing', color: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/20', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  queued: { label: 'Queued', color: 'text-slate-400', bg: 'bg-slate-500/15 border-slate-500/20', icon: <Clock className="w-3 h-3" /> },
  failed: { label: 'Failed', color: 'text-rose-400', bg: 'bg-rose-500/15 border-rose-500/20', icon: <XCircle className="w-3 h-3" /> },
}

const typeIcons: Record<string, React.ReactNode> = {
  image: <Image className="w-4 h-4" />,
  video: <Film className="w-4 h-4" />,
  vector: <Sparkles className="w-4 h-4" />,
}

// ─── Helper Functions ───────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

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

// ─── KPI Card ───────────────────────────────────────────────
function KPICard({ icon, label, value, trend, trendValue, color, delay }: {
  icon: React.ReactNode; label: string; value: string | number
  trend?: 'up' | 'down'; trendValue?: string; color: string; delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="relative group"
    >
      <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${color} opacity-0 group-hover:opacity-10 transition-opacity duration-500`} />
      <div className="relative glass-card p-5 h-full">
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2.5 rounded-xl bg-gradient-to-br ${color} bg-opacity-10`}>
            {icon}
          </div>
          {trend && (
            <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
              trend === 'up' ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'
            }`}>
              {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {trendValue}
            </div>
          )}
        </div>
        <div className="text-2xl font-bold text-white mb-1">{value}</div>
        <div className="text-xs text-slate-400 font-medium">{label}</div>
      </div>
    </motion.div>
  )
}

// ─── Status Badge ───────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || statusConfig.queued
  return (
    <Badge variant="outline" className={`${config.bg} ${config.color} border gap-1.5 font-medium text-xs`}>
      {config.icon}
      {config.label}
    </Badge>
  )
}

// ─── Task Table ─────────────────────────────────────────────
function TaskTable({ type }: { type: string }) {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useTasks(type, undefined, page, 8)

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full bg-white/5 rounded-xl" />
        ))}
      </div>
    )
  }

  if (!data?.tasks.length) {
    return (
      <div className="text-center py-12 text-slate-500">
        <Inbox className="w-10 h-10 mx-auto mb-3 opacity-50" />
        <p className="text-sm">No tasks found</p>
      </div>
    )
  }

  return (
    <div>
      <div className="space-y-2">
        {data.tasks.map((task, i) => (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            className="glass-card p-4 flex items-center gap-4 hover:bg-white/[0.07] transition-all duration-200 group"
          >
            <div className={`p-2 rounded-lg shrink-0 ${
              task.type === 'image' ? 'bg-sky-500/10 text-sky-400' :
              task.type === 'video' ? 'bg-purple-500/10 text-purple-400' :
              'bg-emerald-500/10 text-emerald-400'
            }`}>
              {typeIcons[task.type]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-200 font-medium truncate">{task.prompt}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-slate-500">{task.aiModel}</span>
                {task.style && <span className="text-xs text-slate-600">• {task.style}</span>}
                {task.resolution && <span className="text-xs text-slate-600">• {task.resolution}</span>}
              </div>
            </div>
            <StatusBadge status={task.status} />
            {task.fileSize && (
              <span className="text-xs text-slate-500 hidden lg:block">{formatBytes(task.fileSize)}</span>
            )}
            <span className="text-xs text-slate-600 hidden xl:block">{timeAgo(task.createdAt)}</span>
          </motion.div>
        ))}
      </div>

      {data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-2">
          <span className="text-xs text-slate-500">
            Page {data.pagination.page} of {data.pagination.totalPages} • {data.pagination.total} total
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost" size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="text-xs text-slate-400 hover:text-white hover:bg-white/5"
            >
              Previous
            </Button>
            <Button
              variant="ghost" size="sm"
              disabled={page >= data.pagination.totalPages}
              onClick={() => setPage(p => p + 1)}
              className="text-xs text-slate-400 hover:text-white hover:bg-white/5"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Activity Feed ──────────────────────────────────────────
function ActivityFeed() {
  const { data: activities, isLoading } = useRecentActivity(15)

  if (isLoading) {
    return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full bg-white/5 rounded-xl" />)}</div>
  }

  return (
    <ScrollArea className="h-[400px] custom-scrollbar">
      <div className="space-y-2 pr-3">
        {activities?.map((a: any, i: number) => (
          <motion.div
            key={a.id + i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.04 }}
            className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors"
          >
            <div className={`mt-0.5 p-1.5 rounded-md shrink-0 ${
              a.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400' :
              a.status === 'processing' ? 'bg-amber-500/15 text-amber-400' :
              a.status === 'failed' ? 'bg-rose-500/15 text-rose-400' :
              'bg-slate-500/15 text-slate-400'
            }`}>
              {statusConfig[a.status]?.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-300 leading-relaxed">
                <span className="font-semibold capitalize text-white">{a.type}</span>{' '}
                {a.action}
              </p>
              <p className="text-xs text-slate-600 mt-0.5 truncate">{a.prompt}</p>
            </div>
            <span className="text-[10px] text-slate-600 shrink-0 mt-1">{timeAgo(a.updatedAt)}</span>
          </motion.div>
        ))}
      </div>
    </ScrollArea>
  )
}

// ─── Styles Distribution ────────────────────────────────────
function StylesDistribution() {
  const stylesData = [
    { name: 'Photorealistic', value: 32, color: COLORS.teal },
    { name: '3D Render', value: 24, color: COLORS.emerald },
    { name: 'Cinematic', value: 18, color: COLORS.amber },
    { name: 'Minimalist', value: 14, color: COLORS.purple },
    { name: 'Watercolor', value: 12, color: COLORS.rose },
  ]

  return (
    <div className="space-y-3">
      {stylesData.map((s, i) => (
        <div key={s.name} className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-medium">{s.name}</span>
            <span className="text-slate-500">{s.value}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${s.value}%` }}
              transition={{ duration: 1, delay: 0.5 + i * 0.1 }}
              className="h-full rounded-full"
              style={{ background: s.color }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Sidebar Navigation ─────────────────────────────────────
function SidebarNav({ activeFilter, setActiveFilter, counts }: {
  activeFilter: string; setActiveFilter: (f: string) => void
  counts: { image: number; video: number; vector: number; total: number; processing: number; failed: number }
}) {
  const navItems = [
    { key: 'all', label: 'All Assets', icon: <LayoutGrid className="w-4 h-4" />, count: counts.total, color: 'text-white' },
    { key: 'image', label: 'Images', icon: <Image className="w-4 h-4" />, count: counts.image, color: 'text-sky-400' },
    { key: 'video', label: 'Videos', icon: <Film className="w-4 h-4" />, count: counts.video, color: 'text-purple-400' },
    { key: 'vector', label: 'Vectors', icon: <Sparkles className="w-4 h-4" />, count: counts.vector, color: 'text-emerald-400' },
    { key: 'processing', label: 'In Progress', icon: <Loader2 className="w-4 h-4 animate-spin" />, count: counts.processing, color: 'text-amber-400' },
    { key: 'failed', label: 'Failed', icon: <XCircle className="w-4 h-4" />, count: counts.failed, color: 'text-rose-400' },
  ]

  return (
    <nav className="space-y-1">
      {navItems.map(item => (
        <button
          key={item.key}
          onClick={() => setActiveFilter(item.key)}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
            activeFilter === item.key
              ? 'bg-white/10 text-white shadow-lg shadow-white/5'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <span className={activeFilter !== item.key ? 'group-hover:text-white' : ''}>{item.icon}</span>
          <span className="flex-1 text-left">{item.label}</span>
          <Badge variant="secondary" className="bg-white/5 text-slate-400 text-[10px] h-5 px-1.5 font-medium">
            {item.count.toLocaleString()}
          </Badge>
        </button>
      ))}
    </nav>
  )
}

// ─── AI Models Pie ──────────────────────────────────────────
function AIModelsPie() {
  const data = [
    { name: 'Firefly 3.0', value: 38 },
    { name: 'SD XL', value: 26 },
    { name: 'DALL-E 3', value: 20 },
    { name: 'Midjourney', value: 10 },
    { name: 'Imagen 3', value: 6 },
  ]

  return (
    <div className="flex items-center gap-4">
      <div className="w-[120px] h-[120px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3} dataKey="value" stroke="none">
              {data.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-1.5 text-xs">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i] }} />
            <span className="text-slate-400">{d.name}</span>
            <span className="text-slate-600 ml-auto">{d.value}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Dashboard ─────────────────────────────────────────
export default function DashboardPage() {
  const [activeFilter, setActiveFilter] = useState('all')
  const [activeTab, setActiveTab] = useState('image')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)

  const { data: stats, isLoading: statsLoading } = useDashboardStats()
  const { data: chartData, isLoading: chartLoading } = useChartData(14)

  // Map active filter to tab
  const handleFilterChange = useCallback((filter: string) => {
    setActiveFilter(filter)
    if (['image', 'video', 'vector'].includes(filter)) {
      setActiveTab(filter)
    } else {
      setActiveTab('image')
    }
  }, [])

  const kpiCards = statsLoading
    ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[140px] w-full bg-white/5 rounded-2xl" />)
    : [
        <KPICard key="total" icon={<Image className="w-5 h-5 text-sky-400" />} label="Total Generated" value={stats?.totalGenerated?.toLocaleString() || '0'} trend="up" trendValue="12.5%" color="from-sky-500/20 to-cyan-500/20" delay={0} />,
        <KPICard key="processing" icon={<Loader2 className="w-5 h-5 text-amber-400" />} label="Processing Now" value={stats?.processingNow || 0} trend="up" trendValue="+3" color="from-amber-500/20 to-orange-500/20" delay={0.1} />,
        <KPICard key="success" icon={<CheckCircle2 className="w-5 h-5 text-emerald-400" />} label="Success Rate" value={`${stats?.successRate || 0}%`} trend="up" trendValue="1.2%" color="from-emerald-500/20 to-teal-500/20" delay={0.2} />,
        <KPICard key="avgtime" icon={<Clock className="w-5 h-5 text-cyan-400" />} label="Avg Gen Time" value={`${stats?.avgGenerationTime || 0}s`} trend="down" trendValue="0.8s" color="from-cyan-500/20 to-blue-500/20" delay={0.3} />,
        <KPICard key="storage" icon={<HardDrive className="w-5 h-5 text-rose-400" />} label="Storage Used" value={`${stats?.totalStorage?.toFixed(1) || 0} GB`} trend="up" trendValue="340MB" color="from-rose-500/20 to-pink-500/20" delay={0.4} />,
      ]

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-[#060a13] text-white relative overflow-hidden">
        {/* Background Effects */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-teal-500/8 blur-[120px]" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-purple-500/8 blur-[120px]" />
          <div className="absolute top-[40%] right-[20%] w-[300px] h-[300px] rounded-full bg-amber-500/5 blur-[100px]" />
          <div className="absolute inset-0 bg-grid opacity-40" />
        </div>

        {/* Header */}
        <header className="sticky top-0 z-50 glass border-b border-white/5">
          <div className="flex items-center justify-between px-4 md:px-6 h-16">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-lg hover:bg-white/5 transition-colors lg:hidden"
              >
                <Layers className="w-5 h-5 text-slate-400" />
              </button>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-teal-500/25">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-sm font-bold text-white tracking-tight">Mission Control</h1>
                  <p className="text-[10px] text-slate-500 font-medium">Adobe Stock Generation</p>
                </div>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-2 flex-1 max-w-md mx-8">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input
                  type="text"
                  placeholder="Search generation tasks..."
                  className="w-full h-9 pl-9 pr-4 rounded-xl bg-white/5 border border-white/5 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-teal-500/30 focus:ring-1 focus:ring-teal-500/20 transition-all"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden sm:block mr-2">
                <LiveClock />
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="relative p-2 rounded-lg hover:bg-white/5 transition-colors">
                    <Bell className="w-4.5 h-4.5 text-slate-400" />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full" />
                  </button>
                </TooltipTrigger>
                <TooltipContent><p>Notifications</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="relative p-2 rounded-lg hover:bg-white/5 transition-colors">
                    <Settings className="w-4.5 h-4.5 text-slate-400" />
                  </button>
                </TooltipTrigger>
                <TooltipContent><p>Settings</p></TooltipContent>
              </Tooltip>
              <button
                onClick={() => setRightPanelOpen(!rightPanelOpen)}
                className="hidden lg:flex p-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <BarChart3 className="w-4.5 h-4.5 text-slate-400" />
              </button>
            </div>
          </div>
        </header>

        {/* Main Layout */}
        <div className="flex h-[calc(100vh-64px)] relative">
          {/* Sidebar */}
          <AnimatePresence>
            {sidebarOpen && (
              <motion.aside
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 240, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="shrink-0 overflow-hidden border-r border-white/5 bg-[#060a13]/80 backdrop-blur-xl z-40"
              >
                <div className="w-[240px] p-4 h-full flex flex-col">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-3 px-1">Navigation</div>
                  {!statsLoading && stats && (
                    <SidebarNav
                      activeFilter={activeFilter}
                      setActiveFilter={handleFilterChange}
                      counts={{
                        image: stats.byType?.image?.total || 0,
                        video: stats.byType?.video?.total || 0,
                        vector: stats.byType?.vector?.total || 0,
                        total: stats.totalGenerated || 0,
                        processing: stats.processingNow || 0,
                        failed: (stats.byType?.image?.failed || 0) + (stats.byType?.video?.failed || 0) + (stats.byType?.vector?.failed || 0),
                      }}
                    />
                  )}

                  <Separator className="my-4 bg-white/5" />

                  <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-3 px-1">Quick Actions</div>
                  <div className="space-y-2">
                    <Button variant="ghost" className="w-full justify-start gap-2 text-sm text-slate-400 hover:text-white hover:bg-white/5">
                      <RefreshCw className="w-4 h-4" /> Refresh Data
                    </Button>
                    <Button variant="ghost" className="w-full justify-start gap-2 text-sm text-slate-400 hover:text-white hover:bg-white/5">
                      <Download className="w-4 h-4" /> Export Report
                    </Button>
                    <Button variant="ghost" className="w-full justify-start gap-2 text-sm text-slate-400 hover:text-white hover:bg-white/5">
                      <Pause className="w-4 h-4" /> Pause Queue
                    </Button>
                  </div>

                  <div className="mt-auto pt-4">
                    <div className="glass-card p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Monitor className="w-3.5 h-3.5 text-teal-400" />
                        <span className="text-xs font-medium text-slate-300">System Status</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[11px] text-emerald-400">All systems operational</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>

          {/* Main Content */}
          <main className="flex-1 overflow-auto custom-scrollbar">
            <div className="p-4 md:p-6 space-y-6 max-w-[1400px]">
              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {kpiCards}
              </div>

              {/* Chart + Content */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Generation Trend Chart */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  className="glass-card p-5"
                >
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="text-sm font-semibold text-white">Generation Trend</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Last 14 days overview</p>
                    </div>
                    <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 text-xs">
                      <TrendingUp className="w-3 h-3 mr-1" /> +8.3%
                    </Badge>
                  </div>
                  {chartLoading ? (
                    <Skeleton className="h-[240px] w-full bg-white/5 rounded-xl" />
                  ) : (
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gradCompleted" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={COLORS.teal} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={COLORS.teal} stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gradFailed" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={COLORS.rose} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={COLORS.rose} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v) => v.slice(5)} />
                        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                        <RechartsTooltip
                          contentStyle={{
                            background: 'rgba(15,23,42,0.95)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '12px',
                            fontSize: '12px',
                            color: '#e2e8f0',
                          }}
                          labelStyle={{ color: '#94a3b8' }}
                        />
                        <Area type="monotone" dataKey="completed" stroke={COLORS.teal} fill="url(#gradCompleted)" strokeWidth={2} name="Completed" />
                        <Area type="monotone" dataKey="failed" stroke={COLORS.rose} fill="url(#gradFailed)" strokeWidth={2} name="Failed" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </motion.div>

                {/* Type Distribution */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                  className="glass-card p-5"
                >
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="text-sm font-semibold text-white">Content Distribution</h3>
                      <p className="text-xs text-slate-500 mt-0.5">By asset type</p>
                    </div>
                  </div>

                  {!statsLoading && stats && (
                    <div className="space-y-5">
                      {[
                        { type: 'image', label: 'Images', icon: <Image className="w-4 h-4" />, data: stats.byType?.image, color: COLORS.teal },
                        { type: 'video', label: 'Videos', icon: <Film className="w-4 h-4" />, data: stats.byType?.video, color: COLORS.purple },
                        { type: 'vector', label: 'Vectors', icon: <Sparkles className="w-4 h-4" />, data: stats.byType?.vector, color: COLORS.emerald },
                      ].map((item, idx) => (
                        <motion.div
                          key={item.type}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.4, delay: 0.5 + idx * 0.1 }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`p-1.5 rounded-md`} style={{ backgroundColor: `${item.color}15`, color: item.color }}>
                                {item.icon}
                              </div>
                              <span className="text-sm font-medium text-slate-300">{item.label}</span>
                            </div>
                            <span className="text-sm font-semibold text-white">{item.data?.total?.toLocaleString() || 0}</span>
                          </div>
                          <div className="flex gap-3">
                            <div className="flex-1">
                              <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                                <span>Completed</span><span className="text-emerald-400">{item.data?.completed || 0}</span>
                              </div>
                              <Progress value={item.data?.total ? ((item.data?.completed || 0) / item.data.total) * 100 : 0} className="h-1.5 bg-white/5" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                                <span>Failed</span><span className="text-rose-400">{item.data?.failed || 0}</span>
                              </div>
                              <Progress value={item.data?.total ? ((item.data?.failed || 0) / item.data.total) * 100 : 0} className="h-1.5 bg-white/5 [&>div]:bg-rose-500" />
                            </div>
                          </div>
                        </motion.div>
                      ))}

                      {/* Queue Overview */}
                      <div className="pt-3 border-t border-white/5">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-400">
                              <Activity className="w-4 h-4" />
                            </div>
                            <span className="text-sm font-medium text-slate-300">Queue</span>
                          </div>
                          <span className="text-sm font-semibold text-white">{stats?.processingNow || 0} / {stats?.queueSize || 0}</span>
                        </div>
                        <Progress value={stats?.queueSize ? ((stats?.processingNow || 0) / stats.queueSize) * 100 : 0} className="h-2 bg-white/5" />
                        <p className="text-[10px] text-slate-600 mt-1">{stats?.queueSize || 0} tasks remaining in queue</p>
                      </div>
                    </div>
                  )}
                </motion.div>
              </div>

              {/* Generation Queue */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="glass-card p-5"
              >
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Generation Pipeline</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Track and manage generation tasks</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="hidden sm:flex items-center gap-1 text-xs text-slate-500 bg-white/5 px-3 py-1.5 rounded-lg">
                      <Clock className="w-3 h-3" /> Auto-refreshing
                    </div>
                  </div>
                </div>

                <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setActiveFilter(v); }}>
                  <TabsList className="bg-white/5 border border-white/5 p-0.5 h-9">
                    {[
                      { value: 'image', label: 'Images', count: stats?.byType?.image?.total },
                      { value: 'video', label: 'Videos', count: stats?.byType?.video?.total },
                      { value: 'vector', label: 'Vectors', count: stats?.byType?.vector?.total },
                    ].map(tab => (
                      <TabsTrigger
                        key={tab.value}
                        value={tab.value}
                        className="text-xs font-medium data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg gap-1.5 h-8 px-3"
                      >
                        {tab.value === 'image' && <Image className="w-3 h-3" />}
                        {tab.value === 'video' && <Film className="w-3 h-3" />}
                        {tab.value === 'vector' && <Sparkles className="w-3 h-3" />}
                        {tab.label}
                        {tab.count !== undefined && (
                          <span className="text-[10px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded-md">
                            {tab.count}
                          </span>
                        )}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  <div className="mt-4">
                    <TaskTable type={activeTab} />
                  </div>
                </Tabs>
              </motion.div>

              {/* Activity Feed */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="glass-card p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Live generation feed</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] text-emerald-400 font-medium">Live</span>
                  </div>
                </div>
                <ActivityFeed />
              </motion.div>
            </div>
          </main>

          {/* Right Panel */}
          <AnimatePresence>
            {rightPanelOpen && (
              <motion.aside
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 280, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="hidden xl:block shrink-0 overflow-hidden border-l border-white/5 bg-[#060a13]/80 backdrop-blur-xl z-40"
              >
                <div className="w-[280px] p-4 h-full overflow-auto custom-scrollbar space-y-5">
                  {/* AI Models */}
                  <div>
                    <h4 className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-3 px-1">AI Models</h4>
                    <div className="glass-card p-4">
                      <AIModelsPie />
                    </div>
                  </div>

                  {/* Top Styles */}
                  <div>
                    <h4 className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-3 px-1">Top Styles</h4>
                    <div className="glass-card p-4">
                      <StylesDistribution />
                    </div>
                  </div>

                  {/* Performance */}
                  <div>
                    <h4 className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-3 px-1">Performance</h4>
                    <div className="glass-card p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">Uptime</span>
                        <span className="text-xs font-semibold text-emerald-400">99.8%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">Avg Response</span>
                        <span className="text-xs font-semibold text-teal-400">{stats?.avgGenerationTime || 0}s</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">Error Rate</span>
                        <span className="text-xs font-semibold text-amber-400">1.2%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">Throughput</span>
                        <span className="text-xs font-semibold text-white">{stats?.todayGenerated || 0}/day</span>
                      </div>
                      <Separator className="bg-white/5" />
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">API Calls Today</span>
                        <span className="text-xs font-semibold text-white">{(stats?.todayGenerated || 0) * 3 + 892}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">Cost Today</span>
                        <span className="text-xs font-semibold text-amber-400">${((stats?.todayGenerated || 0) * 0.03 + 12.5).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* System Resources */}
                  <div>
                    <h4 className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-3 px-1">Resources</h4>
                    <div className="glass-card p-4 space-y-3">
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-slate-400">GPU Usage</span>
                          <span className="text-teal-400 font-medium">78%</span>
                        </div>
                        <Progress value={78} className="h-1.5 bg-white/5" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-slate-400">Memory</span>
                          <span className="text-amber-400 font-medium">62%</span>
                        </div>
                        <Progress value={62} className="h-1.5 bg-white/5" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-slate-400">Storage</span>
                          <span className="text-purple-400 font-medium">{stats?.totalStorage?.toFixed(1) || 0} GB</span>
                        </div>
                        <Progress value={45} className="h-1.5 bg-white/5" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-slate-400">Network I/O</span>
                          <span className="text-emerald-400 font-medium">Normal</span>
                        </div>
                        <Progress value={34} className="h-1.5 bg-white/5" />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
      </div>
    </TooltipProvider>
  )
}
