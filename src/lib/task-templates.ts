// ─── Task Templates ────────────────────────────────────────────
export interface TaskTemplate {
  id: string
  label: string
  icon: string
  description: string
  defaultTitle: string
  defaultDescription: string
  defaultCategory: string
  defaultPriority: string
  suggestedSchedule: string | null
  suggestedMissions: string[]
}

export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: 'research',
    label: 'Research',
    icon: '🔍',
    description: 'Investigate a topic, gather data, compare options',
    defaultTitle: 'Research [topic]',
    defaultDescription: 'Conduct thorough research on [topic]. Find sources, compare options, and identify key findings.',
    defaultCategory: 'research',
    defaultPriority: 'normal',
    suggestedSchedule: null,
    suggestedMissions: [
      'Gather sources and data on [topic]',
      'Analyze findings and identify patterns',
      'Write research summary with recommendations',
    ],
  },
  {
    id: 'report',
    label: 'Generate Report',
    icon: '📊',
    description: 'Create a structured report with data and insights',
    defaultTitle: 'Generate [topic] report',
    defaultDescription: 'Create a comprehensive report on [topic]. Include data, analysis, and actionable recommendations.',
    defaultCategory: 'reporting',
    defaultPriority: 'normal',
    suggestedSchedule: '0 9 * * 1', // Every Monday
    suggestedMissions: [
      'Collect data and metrics for report',
      'Analyze data and create visualizations',
      'Draft report with executive summary',
      'Review and finalize report',
    ],
  },
  {
    id: 'bugfix',
    label: 'Fix a Bug',
    icon: '🐛',
    description: 'Debug and resolve a software issue',
    defaultTitle: 'Fix: [bug description]',
    defaultDescription: 'Investigate and resolve the bug: [describe the issue, steps to reproduce, expected vs actual behavior].',
    defaultCategory: 'bugfix',
    defaultPriority: 'high',
    suggestedSchedule: null,
    suggestedMissions: [
      'Reproduce the bug and document steps',
      'Identify root cause',
      'Implement fix',
      'Test and verify the fix works',
    ],
  },
  {
    id: 'content',
    label: 'Write Content',
    icon: '✍️',
    description: 'Create written content: blog post, doc, guide',
    defaultTitle: 'Write: [content title]',
    defaultDescription: 'Create content about [topic]. Target audience: [audience]. Tone: [professional/casual/technical].',
    defaultCategory: 'content',
    defaultPriority: 'normal',
    suggestedSchedule: null,
    suggestedMissions: [
      'Research and outline [topic]',
      'Draft the first version',
      'Review and edit for clarity',
      'Final polish and formatting',
    ],
  },
  {
    id: 'analysis',
    label: 'Analyze Data',
    icon: '📈',
    description: 'Analyze data, find trends, create insights',
    defaultTitle: 'Analyze: [dataset/topic]',
    defaultDescription: 'Perform data analysis on [dataset/topic]. Look for trends, anomalies, and actionable insights.',
    defaultCategory: 'analysis',
    defaultPriority: 'normal',
    suggestedSchedule: '0 9 * * 5', // Every Friday
    suggestedMissions: [
      'Collect and clean the data',
      'Run statistical analysis',
      'Create visualizations',
      'Write findings report',
    ],
  },
  {
    id: 'deploy',
    label: 'Deploy / Release',
    icon: '🚀',
    description: 'Ship code, deploy updates, manage releases',
    defaultTitle: 'Deploy: [project/feature]',
    defaultDescription: 'Deploy [project/feature] to production. Verify all tests pass, documentation is updated, and rollback plan is ready.',
    defaultCategory: 'devops',
    defaultPriority: 'high',
    suggestedSchedule: null,
    suggestedMissions: [
      'Run pre-deployment checklist',
      'Execute deployment steps',
      'Verify deployment health',
      'Monitor for 24h post-deploy',
    ],
  },
]
