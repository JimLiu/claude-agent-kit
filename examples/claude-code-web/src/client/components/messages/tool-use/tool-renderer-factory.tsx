import type { ClaudeMessageContext } from '../types';
import { BaseToolRenderer } from './renderers/base-tool-renderer';
import { BashToolRenderer } from './renderers/bash-tool-renderer';
import { TaskRenderer } from './renderers/task-tool-renderer';
import { TodoReadRenderer, TodoWriteRenderer } from './renderers/todo-tool-renderers';
import {
  EditRenderer,
  NotebookEditRenderer,
  ReadCoalescedRenderer,
  ReadRenderer,
  WriteRenderer,
} from './renderers/file-tool-renderers';
import { GlobRenderer, GrepRenderer, SearchRenderer } from './renderers/search-tool-renderers';
import { WebFetchRenderer } from './renderers/webfetch-tool-renderer';
import { PlanExitRenderer } from './renderers/plan-exit-renderer';
import { SlashCommandRenderer } from './renderers/slash-command-renderer';
import { DefaultToolRenderer } from './renderers/default-tool-renderer';

export function getToolRenderer(name: string, context: ClaudeMessageContext): BaseToolRenderer {
  switch (name) {
    case 'Bash':
      return new BashToolRenderer(context);
    case 'Task':
      return new TaskRenderer();
    case 'TodoRead':
      return new TodoReadRenderer();
    case 'TodoWrite':
      return new TodoWriteRenderer();
    case 'Read':
      return new ReadRenderer(context);
    case 'Write':
      return new WriteRenderer(context);
    case 'Edit':
      return new EditRenderer(context);
    case 'Glob':
      return new GlobRenderer(context);
    case 'Grep':
      return new GrepRenderer(context);
    case 'Search':
      return new SearchRenderer();
    case 'WebFetch':
      return new WebFetchRenderer(context);
    case 'ExitPlanMode':
      return new PlanExitRenderer();
    case 'ReadCoalesced':
      return new ReadCoalescedRenderer(context);
    case 'NotebookEdit':
      return new NotebookEditRenderer(context);
    case 'SlashCommand':
      return new SlashCommandRenderer();
    default:
      return new DefaultToolRenderer(name);
  }
}
