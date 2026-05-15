'use client'

import { useState, useEffect } from 'react'
import {
  ShoppingBag, Package, Users, TrendingUp,
  DollarSign, CreditCard, ArrowUpRight, ArrowDownRight,
  Loader2, AlertTriangle, RefreshCw, Eye, Calendar,
  BarChart3, Receipt, UserPlus,
} from 'lucide-react'
import { motion } from 'framer-motion'

interface StoreData {
  info: any
  revenue: any
  productsCount: number
  ordersCount: number
  customersCount: number
  categoriesCount: number
  settingsCount: number
}

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
}

function formatCurrency(amount: number, symbol = '$'): string {
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function StorePanel() {
  const [data, setData] = useState<StoreData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const [infoRes, revenueRes, productsRes, ordersRes, customersRes, categoriesRes, settingsRes] = await Promise.all([
        fetch('/api/store/info'),
        fetch('/api/store/stats/revenue'),
        fetch('/api/store/products?per_page=1'),
        fetch('/api/store/orders?per_page=1'),
        fetch('/api/store/customers?per_page=1'),
        fetch('/api/store/categories'),
        fetch('/api/store/settings'),
      ])

      const info = await infoRes.json()
      const revenue = await revenueRes.json()
      const products = await productsRes.json()
      const orders = await ordersRes.json()
      const customers = await customersRes.json()
      const categories = await categoriesRes.json()
      const settings = await settingsRes.json()

      if (!info.success && !info.message?.includes('API is running')) {
        throw new Error(info.message || 'Failed to connect')
      }

      setData({
        info: info.data || info,
        revenue: revenue.data || null,
        productsCount: products.meta?.total ?? products.data?.length ?? 0,
        ordersCount: orders.meta?.total ?? 0,
        customersCount: customers.meta?.total ?? 0,
        categoriesCount: categories.data?.length ?? 0,
        settingsCount: settings.data ? Object.keys(settings.data).length : 0,
      })
    } catch (err: any) {
      setError(err?.message || 'Failed to load store data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          <p className="text-xs text-slate-500">Connecting to store...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center mb-4">
          <AlertTriangle className="w-7 h-7 text-rose-400" />
        </div>
        <p className="text-sm text-white font-medium mb-1">Store Offline</p>
        <p className="text-xs text-slate-500 max-w-md mb-6">{error}</p>
        <div className="flex gap-2">
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
          <a
            href="http://localhost:8080"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 rounded-md transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            Open Store
          </a>
        </div>
      </div>
    )
  }

  const rev = data.revenue
  const sym = rev?.currency || '$'

  const revenueCards = rev ? [
    {
      label: 'Total Revenue',
      value: formatCurrency(rev.total_revenue, sym),
      sub: `${rev.orders.paid} paid orders`,
      icon: <DollarSign className="w-4 h-4" />,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
    },
    {
      label: 'This Month',
      value: formatCurrency(rev.month_revenue, sym),
      sub: `${new Date().toLocaleString('default', { month: 'long' })} earnings`,
      icon: <Calendar className="w-4 h-4" />,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10 border-cyan-500/20',
    },
    {
      label: 'Today',
      value: formatCurrency(rev.today_revenue, sym),
      sub: 'Earned today',
      icon: <BarChart3 className="w-4 h-4" />,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10 border-purple-500/20',
    },
    {
      label: 'Avg Order Value',
      value: formatCurrency(rev.avg_order_value, sym),
      sub: 'Per paid order',
      icon: <Receipt className="w-4 h-4" />,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
    },
  ] : []

  const statCards = [
    {
      label: 'Products',
      value: data.productsCount,
      icon: <Package className="w-4 h-4" />,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10 border-cyan-500/20',
    },
    {
      label: 'Orders',
      value: data.ordersCount,
      icon: <ShoppingBag className="w-4 h-4" />,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
    },
    {
      label: 'Customers',
      value: data.customersCount,
      icon: <Users className="w-4 h-4" />,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10 border-purple-500/20',
    },
    {
      label: 'Categories',
      value: data.categoriesCount,
      icon: <TrendingUp className="w-4 h-4" />,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
    },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Store Overview</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {data.info?.store_name || 'Pixelefy'} &middot; {data.info?.currency || 'USD'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
          <a
            href="http://localhost:8080"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 transition-all"
          >
            <Eye className="w-3 h-3" />
            View Site
          </a>
        </div>
      </div>

      {/* Income Summary */}
      {rev && (
        <div>
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            Income Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {revenueCards.map((c, i) => (
              <motion.div
                key={c.label}
                {...fadeUp}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                className={`rounded-xl border p-4 ${c.bg}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">{c.label}</span>
                  <span className={c.color}>{c.icon}</span>
                </div>
                <div className="text-xl font-bold text-white">{c.value}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{c.sub}</div>
              </motion.div>
            ))}
          </div>

          {/* Order Breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3"
          >
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <CreditCard className="w-3 h-3 text-emerald-400" />
                Paid Orders
              </div>
              <div className="text-lg font-bold text-white mt-1">{rev.orders.paid}</div>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <ArrowUpRight className="w-3 h-3 text-amber-400" />
                Pending
              </div>
              <div className="text-lg font-bold text-white mt-1">{rev.orders.pending}</div>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <ArrowDownRight className="w-3 h-3 text-cyan-400" />
                Processing
              </div>
              <div className="text-lg font-bold text-white mt-1">{rev.orders.processing}</div>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Receipt className="w-3 h-3 text-rose-400" />
                Refunded
              </div>
              <div className="text-lg font-bold text-white mt-1">{formatCurrency(rev.refunded_amount, sym)}</div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Separator */}
      <div className="h-px bg-white/5" />

      {/* Stats Grid */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-cyan-400" />
          Store Stats
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statCards.map((s, i) => (
            <motion.div
              key={s.label}
              {...fadeUp}
              transition={{ delay: i * 0.05 + 0.3, duration: 0.3 }}
              className={`rounded-xl border p-4 ${s.bg}`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className={s.color}>{s.icon}</span>
              </div>
              <div className="text-2xl font-bold text-white">{s.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Store Info */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rounded-xl border border-white/5 bg-white/[0.02] p-5"
      >
        <h3 className="text-sm font-semibold text-white mb-3">Store Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-slate-500">Store Name</span>
            <p className="text-white font-medium mt-0.5">{data.info?.store_name || '—'}</p>
          </div>
          <div>
            <span className="text-slate-500">Currency</span>
            <p className="text-white font-medium mt-0.5">{data.info?.currency || '—'}</p>
          </div>
          <div>
            <span className="text-slate-500">Theme</span>
            <p className="text-white font-medium mt-0.5 capitalize">{data.info?.active_theme || '—'}</p>
          </div>
          <div>
            <span className="text-slate-500">Timezone</span>
            <p className="text-white font-medium mt-0.5">{data.info?.timezone || '—'}</p>
          </div>
          <div>
            <span className="text-slate-500">Settings</span>
            <p className="text-white font-medium mt-0.5">{data.settingsCount} keys</p>
          </div>
          <div>
            <span className="text-slate-500">API Type</span>
            <p className="text-white font-medium mt-0.5 capitalize">{data.info?.api_key_type || '—'}</p>
          </div>
        </div>
      </motion.div>

      {/* Quick Links */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="rounded-xl border border-white/5 bg-white/[0.02] p-5"
      >
        <h3 className="text-sm font-semibold text-white mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <a
            href="http://localhost:8080/admin"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 hover:text-white transition-all"
          >
            <Users className="w-3.5 h-3.5 text-cyan-400" />
            Admin Panel
          </a>
          <a
            href="http://localhost:8080/products"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 hover:text-white transition-all"
          >
            <Package className="w-3.5 h-3.5 text-amber-400" />
            Products
          </a>
          <a
            href="http://localhost:8080/register"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 hover:text-white transition-all"
          >
            <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
            Register
          </a>
        </div>
      </motion.div>
    </div>
  )
}
