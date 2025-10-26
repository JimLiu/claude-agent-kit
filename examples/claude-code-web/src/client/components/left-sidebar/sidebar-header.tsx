import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { formatRelativeTime } from './utils'

type SidebarHeaderProps = {
  onNewSession?: () => void
  disabled: boolean
  projectName: string | null
  latestActivity: number | null
}

export function SidebarHeader({
  onNewSession,
  disabled,
  projectName,
  latestActivity,
}: SidebarHeaderProps) {
  return (
    <>
      <div className="border-b px-3 py-2">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2"
          onClick={onNewSession}
          disabled={disabled}
        >
          <Plus className="h-4 w-4" />
          New Session
        </Button>
      </div>
      <div className="px-3 pb-2 pt-3">
        <p className="text-xs font-medium uppercase text-muted-foreground">
          {projectName ?? 'Projects'}
        </p>
        {projectName && latestActivity !== null ? (
          <p className="text-xs text-muted-foreground">
            Active {formatRelativeTime(latestActivity)}
          </p>
        ) : null}
      </div>
    </>
  )
}
