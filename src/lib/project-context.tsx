'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import type { Project } from '@/hooks/use-dashboard-data'

interface ProjectContextType {
  activeProject: Project | null
  setActiveProject: (project: Project | null) => void
  exitProject: () => void
  projectId: string | undefined
}

const ProjectContext = createContext<ProjectContextType>({
  activeProject: null,
  setActiveProject: () => {},
  exitProject: () => {},
  projectId: undefined,
})

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [activeProject, setActiveProject] = useState<Project | null>(null)

  const exitProject = useCallback(() => {
    setActiveProject(null)
  }, [])

  const projectId = activeProject?.id

  return (
    <ProjectContext.Provider value={{ activeProject, setActiveProject, exitProject, projectId }}>
      {children}
    </ProjectContext.Provider>
  )
}

export function useProjectContext() {
  return useContext(ProjectContext)
}
