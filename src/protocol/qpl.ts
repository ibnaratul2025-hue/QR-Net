/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * QPL — QIP Programming Language
 * A safe, restricted, declarative protocol description language runtime
 */

export interface QplAstDevice {
  capabilities: string[];
}

export interface QplAstHandler {
  triggerEvent: string;
  triggerArg?: string;
  actions: QplAction[];
}

export interface QplAction {
  command: 'display' | 'emit' | 'request' | 'set_state' | 'ping' | 'show' | 'log';
  argument: string;
}

export interface QplWorkflowRule {
  whenEvent: string;
  thenAction: string;
  condition?: string;
  conditionThen?: string;
}

export interface QplProgram {
  rawSource: string;
  device?: QplAstDevice;
  handlers: QplAstHandler[];
  workflows: QplWorkflowRule[];
}

export interface QplExecutionContext {
  displayMessage: (msg: string) => void;
  emitEvent: (event: string, payload: any) => void;
  requestCapability: (cap: string) => void;
  setState: (key: string, val: any) => void;
  log: (msg: string) => void;
  availableCapabilities: string[];
}

/**
 * Parses safe declarative QPL source code into an AST
 */
export function parseQpl(source: string): { program: QplProgram; errors: string[] } {
  const errors: string[] = [];
  const lines = source.split('\n');
  const program: QplProgram = {
    rawSource: source,
    handlers: [],
    workflows: [],
  };

  let inDeviceBlock = false;
  const currentDeviceCaps: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line || line.startsWith('//') || line.startsWith('#')) continue;

    // DEVICE block
    if (line.startsWith('DEVICE') && line.includes('{')) {
      inDeviceBlock = true;
      continue;
    }
    if (inDeviceBlock) {
      if (line === '}') {
        inDeviceBlock = false;
        program.device = { capabilities: [...currentDeviceCaps] };
      } else {
        const caps = line.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
        currentDeviceCaps.push(...caps);
      }
      continue;
    }

    // ON receive("...") { ... }
    const onMatch = line.match(/^ON\s+receive\(["']([^"']+)["']\)\s*\{\s*(.*?)\s*\}?$/i);
    if (onMatch) {
      const trigger = onMatch[1];
      const body = onMatch[2];
      const actions = parseActions(body);
      program.handlers.push({
        triggerEvent: 'receive',
        triggerArg: trigger,
        actions,
      });
      continue;
    }

    // ON event("...") { ... }
    const onEventMatch = line.match(/^ON\s+event\(["']([^"']+)["']\)\s*\{\s*(.*?)\s*\}?$/i);
    if (onEventMatch) {
      const trigger = onEventMatch[1];
      const body = onEventMatch[2];
      const actions = parseActions(body);
      program.handlers.push({
        triggerEvent: trigger,
        actions,
      });
      continue;
    }

    // Workflow rule: WHEN <event> THEN <action> [IF <cond> THEN <condAction>]
    if (line.startsWith('WHEN ') || line.startsWith('when ')) {
      const wfRegex = /WHEN\s+([a-zA-Z0-9_.]+)\s+THEN\s+([a-zA-Z0-9_.\(\)"']+)(?:\s+IF\s+([a-zA-Z0-9_.]+)\s+THEN\s+([a-zA-Z0-9_.\(\)"']+))?/i;
      const wfMatch = line.match(wfRegex);
      if (wfMatch) {
        program.workflows.push({
          whenEvent: wfMatch[1],
          thenAction: wfMatch[2],
          condition: wfMatch[3],
          conditionThen: wfMatch[4],
        });
      } else {
        errors.push(`Line ${i + 1}: Malformed WHEN/THEN workflow: "${line}"`);
      }
      continue;
    }
  }

  return { program, errors };
}

function parseActions(body: string): QplAction[] {
  const actions: QplAction[] = [];
  if (!body) return actions;
  const statements = body.split(';').map(s => s.trim()).filter(Boolean);

  for (const stmt of statements) {
    const fnMatch = stmt.match(/^([a-zA-Z_]+)\(["']?([^"'\)]*)["']?\)$/);
    if (fnMatch) {
      const cmd = fnMatch[1].toLowerCase();
      const arg = fnMatch[2];
      if (['display', 'emit', 'request', 'set_state', 'ping', 'show', 'log'].includes(cmd)) {
        actions.push({
          command: cmd as QplAction['command'],
          argument: arg,
        });
      }
    }
  }
  return actions;
}

/**
 * Sandboxed interpreter for QPL program
 */
export class QplRuntime {
  private program: QplProgram | null = null;

  public loadProgram(source: string): { success: boolean; errors: string[] } {
    const result = parseQpl(source);
    if (result.errors.length > 0) {
      return { success: false, errors: result.errors };
    }
    this.program = result.program;
    return { success: true, errors: [] };
  }

  public getProgram(): QplProgram | null {
    return this.program;
  }

  public handleEvent(
    eventName: string,
    eventData: any,
    ctx: QplExecutionContext
  ): void {
    if (!this.program) return;

    // Check handlers
    for (const handler of this.program.handlers) {
      if (handler.triggerEvent === 'receive') {
        const targetArg = handler.triggerArg;
        const incomingPayload = typeof eventData === 'string' ? eventData : JSON.stringify(eventData);
        if (targetArg && incomingPayload.includes(targetArg)) {
          this.executeActions(handler.actions, ctx);
        }
      } else if (handler.triggerEvent === eventName) {
        this.executeActions(handler.actions, ctx);
      }
    }

    // Check workflows
    for (const wf of this.program.workflows) {
      if (wf.whenEvent === eventName) {
        this.executeWorkflowAction(wf.thenAction, ctx);

        if (wf.condition && wf.conditionThen) {
          // Check condition against available capabilities or state
          if (ctx.availableCapabilities.includes(wf.condition.toLowerCase()) || 
              ctx.availableCapabilities.includes(wf.condition.toUpperCase())) {
            this.executeWorkflowAction(wf.conditionThen, ctx);
          }
        }
      }
    }
  }

  private executeWorkflowAction(actionStr: string, ctx: QplExecutionContext): void {
    const actions = parseActions(actionStr);
    if (actions.length > 0) {
      this.executeActions(actions, ctx);
    } else {
      ctx.log(`Executed workflow action: ${actionStr}`);
    }
  }

  private executeActions(actions: QplAction[], ctx: QplExecutionContext): void {
    for (const act of actions) {
      switch (act.command) {
        case 'display':
        case 'show':
          ctx.displayMessage(act.argument);
          break;
        case 'emit':
          ctx.emitEvent(act.argument, { timestamp: Date.now() });
          break;
        case 'request':
          ctx.requestCapability(act.argument);
          break;
        case 'set_state':
          ctx.setState(act.argument, true);
          break;
        case 'log':
          ctx.log(act.argument);
          break;
      }
    }
  }
}
