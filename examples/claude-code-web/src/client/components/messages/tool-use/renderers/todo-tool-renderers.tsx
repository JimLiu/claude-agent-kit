import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Check, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ToolResultContentBlock } from '@claude-agent-kit/messages';
import type { ClaudeMessageContext } from '../../types';
import { ToolBody } from '../tool-body';
import { BaseToolRenderer } from './base-tool-renderer';
import { isNonEmptyRecord, type ToolInput } from './utils';

interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  id?: string | number;
  priority?: string | number;
}

type TodoStatus = TodoItem['status'];

type NormalizedTodo = {
  id: string;
  content: string;
  status: TodoStatus;
  priority?: string;
};

const STATUS_LABELS: Record<TodoStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
};

const normalizeTodos = (value: unknown): NormalizedTodo[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((raw, index) => {
      if (!raw || typeof raw !== 'object') {
        return null;
      }

      const record = raw as Record<string, unknown>;
      const content =
        typeof record.content === 'string' && record.content.trim().length > 0
          ? record.content.trim()
          : undefined;

      if (!content) {
        return null;
      }

      const rawStatus =
        typeof record.status === 'string' ? record.status.toLowerCase() : undefined;

      const status: TodoStatus =
        rawStatus === 'completed'
          ? 'completed'
          : rawStatus === 'in_progress'
            ? 'in_progress'
            : 'pending';

      const keySource = record.id ?? record.uuid ?? index;
      const id =
        typeof keySource === 'string' || typeof keySource === 'number'
          ? String(keySource)
          : String(index);

      const priorityValue =
        typeof record.priority === 'string'
          ? record.priority.trim()
          : typeof record.priority === 'number'
            ? String(record.priority)
            : undefined;

      return {
        id,
        content,
        status,
        priority: priorityValue && priorityValue.length > 0 ? priorityValue : undefined,
      };
    })
    .filter((todo): todo is NormalizedTodo => todo !== null);
};

type TodoListProps = {
  todos: NormalizedTodo[];
};

const TodoList = ({ todos }: TodoListProps) => {
  if (todos.length === 0) {
    return (
      <div className="flex min-h-[160px] items-center justify-center rounded-md border border-dashed border-border bg-muted/20 px-4 py-6">
        <p className="text-sm text-muted-foreground">No plan yet</p>
      </div>
    );
  }

  const total = todos.length;
  const completedCount = todos.filter((todo) => todo.status === 'completed').length;
  const inProgressIndex = todos.findIndex((todo) => todo.status === 'in_progress');

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {todos.map((todo, index) => (
          <TodoListItem key={todo.id} index={index} todo={todo} />
        ))}
      </div>
    </div>
  );
};

type TodoListItemProps = {
  todo: NormalizedTodo;
  index: number;
};

const TodoListItem = ({ todo, index }: TodoListItemProps) => {
  const isCompleted = todo.status === 'completed';
  const isInProgress = todo.status === 'in_progress';

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-3 text-sm shadow-sm transition-colors',
        isInProgress && 'border-primary/60 bg-primary/10',
        isCompleted && 'border-transparent bg-muted/30 text-muted-foreground',
      )}
      data-status={todo.status}
    >
      <StatusIndicator status={todo.status} index={index} />
      <p className={cn('flex-1 leading-6 text-sm', isCompleted && 'line-through')}>
        {todo.content}
      </p>
      <TodoBadge todo={todo} className="ml-auto" />
    </div>
  );
};

type StatusIndicatorProps = {
  status: TodoStatus;
  index: number;
};

const StatusIndicator = ({ status, index }: StatusIndicatorProps) => {
  if (status === 'completed') {
    return (
      <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-emerald-500 bg-emerald-500/10 text-emerald-600">
        <Check className="size-3.5" aria-hidden="true" />
      </span>
    );
  }

  if (status === 'in_progress') {
    return (
      <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-primary/60 bg-primary/10">
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
      </span>
    );
  }

  return (
    <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-border text-xs font-semibold text-muted-foreground">
      {index + 1}
    </span>
  );
};

type TodoBadgeProps = {
  todo: NormalizedTodo;
  className?: string;
};

const TodoBadge = ({ todo, className }: TodoBadgeProps) => {
  const label = todo.priority ?? STATUS_LABELS[todo.status];
  const variant = todo.priority ? 'secondary' : 'outline';

  return (
    <Badge
      variant={variant}
      className={cn(
        'text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground',
        !todo.priority && 'capitalize',
        className,
      )}
    >
      {label}
    </Badge>
  );
};

export class TodoReadRenderer extends BaseToolRenderer {
  constructor() {
    super('Read Todos');
  }

  body(
    _context: ClaudeMessageContext,
    _input: ToolInput,
    result: ToolResultContentBlock | undefined,
  ): ReactNode {
    if (!result || typeof result.content !== 'string') {
      return null;
    }

    try {
      const parsed = JSON.parse(result.content);
      const todosSource =
        parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>).todos : undefined;
      const todos = normalizeTodos(todosSource);

      return (
        <ToolBody>
          <TodoList todos={todos} />
        </ToolBody>
      );
    } catch {
      return super.body(_context, _input, result);
    }
  }
}

export class TodoWriteRenderer extends BaseToolRenderer {
  constructor() {
    super('Update Todos');
  }

  body(
    _context: ClaudeMessageContext,
    input: ToolInput,
    result: ToolResultContentBlock | undefined,
  ): ReactNode {
    if (!isNonEmptyRecord(input) || !Array.isArray(input.todos)) {
      return super.body(_context, input, result);
    }

    const todos = normalizeTodos(input.todos);

    return (
      <ToolBody>
        <TodoList todos={todos} />
      </ToolBody>
    );
  }
}
