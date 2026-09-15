/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * QIP Formal State Machine & Event-Sourced Protocol Core
 */

import { QipFsmState, QipEventAuditEntry } from '../types/qip';

export type FsmTransitionListener = (
  oldState: QipFsmState,
  newState: QipFsmState,
  trigger: string
) => void;

export class QipProtocolStateMachine {
  private currentState: QipFsmState = QipFsmState.IDLE;
  private listeners: Set<FsmTransitionListener> = new Set();
  private auditLog: QipEventAuditEntry[] = [];
  private maxAuditEntries: number = 200;

  // Valid formal state transitions
  private static readonly VALID_TRANSITIONS: Record<QipFsmState, QipFsmState[]> = {
    [QipFsmState.IDLE]: [QipFsmState.DISCOVERING, QipFsmState.HANDSHAKING, QipFsmState.TRANSFERRING, QipFsmState.CANCELLED],
    [QipFsmState.DISCOVERING]: [QipFsmState.HANDSHAKING, QipFsmState.NEGOTIATING, QipFsmState.IDLE, QipFsmState.FAILED],
    [QipFsmState.HANDSHAKING]: [QipFsmState.NEGOTIATING, QipFsmState.AUTHENTICATING, QipFsmState.TRANSFERRING, QipFsmState.FAILED, QipFsmState.CANCELLED],
    [QipFsmState.NEGOTIATING]: [QipFsmState.AUTHENTICATING, QipFsmState.TRANSFERRING, QipFsmState.FAILED, QipFsmState.CANCELLED],
    [QipFsmState.AUTHENTICATING]: [QipFsmState.VERIFIED, QipFsmState.TRANSFERRING, QipFsmState.FAILED, QipFsmState.CANCELLED],
    [QipFsmState.VERIFIED]: [QipFsmState.TRANSFERRING, QipFsmState.SYNCHRONIZING, QipFsmState.IDLE],
    [QipFsmState.TRANSFERRING]: [QipFsmState.RECOVERING, QipFsmState.SYNCHRONIZING, QipFsmState.COMPLETING, QipFsmState.FAILED, QipFsmState.CANCELLED],
    [QipFsmState.RECOVERING]: [QipFsmState.TRANSFERRING, QipFsmState.FAILED, QipFsmState.CANCELLED],
    [QipFsmState.SYNCHRONIZING]: [QipFsmState.COMPLETING, QipFsmState.RECOVERING, QipFsmState.FAILED, QipFsmState.CANCELLED],
    [QipFsmState.COMPLETING]: [QipFsmState.IDLE, QipFsmState.TRANSFERRING],
    [QipFsmState.FAILED]: [QipFsmState.IDLE, QipFsmState.DISCOVERING],
    [QipFsmState.CANCELLED]: [QipFsmState.IDLE],
  };

  constructor(initialState: QipFsmState = QipFsmState.IDLE) {
    this.currentState = initialState;
    this.logAudit('StateUpdated', `FSM Initialized in state [${initialState}]`);
  }

  public getState(): QipFsmState {
    return this.currentState;
  }

  public canTransitionTo(nextState: QipFsmState): boolean {
    const allowed = QipProtocolStateMachine.VALID_TRANSITIONS[this.currentState] || [];
    return allowed.includes(nextState);
  }

  public transition(nextState: QipFsmState, reason: string): boolean {
    if (this.currentState === nextState) return true;

    if (!this.canTransitionTo(nextState)) {
      console.warn(`[QIP FSM] Invalid transition attempt: ${this.currentState} -> ${nextState} (${reason})`);
      this.logAudit('StateUpdated', `Disallowed transition rejected: ${this.currentState} -> ${nextState}`);
      return false;
    }

    const previous = this.currentState;
    this.currentState = nextState;
    this.logAudit('StateUpdated', `State transition: ${previous} -> ${nextState} (${reason})`);

    this.listeners.forEach(fn => fn(previous, nextState, reason));
    return true;
  }

  public onTransition(listener: FsmTransitionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public logAudit(
    eventType: QipEventAuditEntry['eventType'],
    details: string,
    raw?: any
  ): QipEventAuditEntry {
    const entry: QipEventAuditEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      eventType,
      details,
      raw,
    };

    this.auditLog.unshift(entry);
    if (this.auditLog.length > this.maxAuditEntries) {
      this.auditLog.pop();
    }
    return entry;
  }

  public getAuditLog(): QipEventAuditEntry[] {
    return [...this.auditLog];
  }

  public clearAuditLog(): void {
    this.auditLog = [];
  }
}
