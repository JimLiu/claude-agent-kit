
export type AttachmentChipType = 'image' | 'document'

export interface AttachmentChipProps {
  label: string;
  type: AttachmentChipType;
  onRemove?: () => void;
  onClick?: () => void;
}

const CHIP_CLASS =
  "group relative m-[2px] inline-flex max-w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1.5 transition-colors hover:border-primary hover:bg-muted/80";
const ICON_WRAPPER_CLASS = "flex shrink-0 items-center justify-center";
const ICON_CLASS = "h-4 w-4 text-muted-foreground";
const INFO_CLASS = "flex min-w-0 flex-1 flex-col gap-[2px]";
const TEXT_CLASS =
  "max-w-[50vw] overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-medium text-foreground";
const REMOVE_BUTTON_CLASS =
  "absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full border-0 bg-primary text-primary-foreground opacity-0 transition-opacity hover:opacity-80 focus-visible:opacity-100 group-hover:opacity-100";
const REMOVE_ICON_CLASS = "h-[14px] w-[14px] text-white";

const ImageIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    aria-hidden="true"
    data-slot="icon"
    className={ICON_CLASS}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
    />
  </svg>
);

const DocumentIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    aria-hidden="true"
    data-slot="icon"
    className={ICON_CLASS}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
    />
  </svg>
);

const RemoveIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    aria-hidden="true"
    data-slot="icon"
    className={REMOVE_ICON_CLASS}
  >
    <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
  </svg>
);

export function AttachmentChip({
  label,
  type,
  onRemove,
  onClick,
}: AttachmentChipProps) {
  const Icon = type === "image" ? ImageIcon : DocumentIcon;

  return (
    <div
      className={CHIP_CLASS}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className={ICON_WRAPPER_CLASS}>
        <Icon />
      </div>
      <div className={INFO_CLASS}>
        <div className={TEXT_CLASS} title={label}>
          {label}
        </div>
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          className={REMOVE_BUTTON_CLASS}
          title="Remove attachment"
        >
          <RemoveIcon />
        </button>
      )}
    </div>
  );
}
