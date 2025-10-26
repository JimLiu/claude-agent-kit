import { PermissionMode } from "@/types/session";

export interface PermissionModeButtonProps {
  mode: PermissionMode;
  onTap: () => void;
  className: string;
}

const EditAutomaticallyIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden="true"
    data-slot="icon"
    className="h-3 shrink-0"
  >
    <path d="M2.53 3.956A1 1 0 0 0 1 4.804v6.392a1 1 0 0 0 1.53.848l5.113-3.196c.16-.1.279-.233.357-.383v2.73a1 1 0 0 0 1.53.849l5.113-3.196a1 1 0 0 0 0-1.696L9.53 3.956A1 1 0 0 0 8 4.804v2.731a.992.992 0 0 0-.357-.383L2.53 3.956Z" />
  </svg>
);

const PlanModeIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden="true"
    data-slot="icon"
    className="h-3 shrink-0"
  >
    <path d="M4.5 2a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-11a.5.5 0 0 0-.5-.5h-1ZM10.5 2a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-11a.5.5 0 0 0-.5-.5h-1Z" />
  </svg>
);

const AskBeforeEditsIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden="true"
    data-slot="icon"
    className="h-3 shrink-0"
  >
    <path
      fillRule="evenodd"
      d="M11.013 2.513a1.75 1.75 0 0 1 2.475 2.474L6.226 12.25a2.751 2.751 0 0 1-.892.596l-2.047.848a.75.75 0 0 1-.98-.98l.848-2.047a2.75 2.75 0 0 1 .596-.892l7.262-7.261Z"
      clipRule="evenodd"
    />
  </svg>
);

export function PermissionModeButton({
  mode,
  onTap,
  className,
}: PermissionModeButtonProps) {
  switch (mode) {
    case "acceptEdits":
      return (
        <button
          type="button"
          className={className}
          onClick={onTap}
          title="Claude will edit your selected text or the whole file. Click, or press Shift+Tab, to switch modes."
        >
          <EditAutomaticallyIcon />
          <span>Edit automatically</span>
        </button>
      );
    case "plan":
      return (
        <button
          type="button"
          className={className}
          onClick={onTap}
          title="Claude will explore the code must present a plan before editing. Click, or press Shift+Tab, to switch modes."
        >
          <PlanModeIcon />
          <span>Plan mode</span>
        </button>
      );
    case "default":
    default:
      return (
        <button
          type="button"
          className={className}
          onClick={onTap}
          title="Claude will ask before each edit. Click, or press Shift+Tab, to switch modes."
        >
          <AskBeforeEditsIcon />
          <span>Ask before edits</span>
        </button>
      );
  }
}
