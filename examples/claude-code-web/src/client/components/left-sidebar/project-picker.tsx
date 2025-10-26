import { Check, ChevronsUpDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

import { ProjectWithActivity } from './types'

type ProjectPickerProps = {
  projects: ProjectWithActivity[]
  selectedProjectId: string | null
  isLoading: boolean
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (projectId: string) => void
}

export function ProjectPicker({
  projects,
  selectedProjectId,
  isLoading,
  isOpen,
  onOpenChange,
  onSelect,
}: ProjectPickerProps) {
  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          className="w-full justify-between"
          disabled={isLoading || projects.length === 0}
        >
          {selectedProjectId
            ? projects.find((project) => project.id === selectedProjectId)?.name ??
              'Select project'
            : 'Select project'}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search projects..." />
          <CommandEmpty>No projects found.</CommandEmpty>
          <CommandList>
            <CommandGroup>
              {projects.map((project) => (
                <CommandItem
                  key={project.id}
                  value={`${project.name}-${project.id}`}
                  onSelect={() => onSelect(project.id)}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      project.id === selectedProjectId ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <span className="truncate">{project.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
