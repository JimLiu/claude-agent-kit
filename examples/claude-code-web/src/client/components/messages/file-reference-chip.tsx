import type { ClaudeMessageContext, FileOpenLocation } from './types'

type FileReferenceChipProps = {
  label: string
  filePath: string
  location?: FileOpenLocation
  context: ClaudeMessageContext
}

export function FileReferenceChip({ label, filePath, location, context }: FileReferenceChipProps) {
  const handleClick = () => {
    context.fileOpener.open(filePath, location)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="my-1 inline-flex max-w-full items-center gap-2 rounded border border-border bg-card px-2 py-1 text-left text-[12px] text-muted-foreground hover:border-primary hover:text-primary"
    >
      <span className="truncate font-medium">{label}</span>
      <span className="truncate text-[0.85em] text-muted-foreground">{filePath}</span>
    </button>
  )
}
