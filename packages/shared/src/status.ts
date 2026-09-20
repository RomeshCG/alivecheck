import type { MonitorEventType } from './notifications.js';

export type MonitorStatus = 'NEW' | 'UP' | 'DOWN' | 'RECOVERED';

export type MonitorState = {
  currentStatus: MonitorStatus;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  failureThreshold: number;
  recoveryThreshold: number;
};

export type StateTransition = {
  currentStatus: MonitorStatus;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  event: MonitorEventType | null;
  openedIncident: boolean;
  resolvedIncident: boolean;
};

export function applyCheckResult(state: MonitorState, success: boolean): StateTransition {
  if (success) {
    const consecutiveSuccesses = state.consecutiveSuccesses + 1;
    const consecutiveFailures = 0;

    if (state.currentStatus === 'DOWN' && consecutiveSuccesses >= state.recoveryThreshold) {
      return {
        currentStatus: 'UP',
        consecutiveFailures,
        consecutiveSuccesses,
        event: 'monitor.recovered',
        openedIncident: false,
        resolvedIncident: true,
      };
    }

    if (state.currentStatus === 'NEW') {
      return {
        currentStatus: 'UP',
        consecutiveFailures,
        consecutiveSuccesses,
        event: null,
        openedIncident: false,
        resolvedIncident: false,
      };
    }

    return {
      currentStatus: state.currentStatus === 'RECOVERED' ? 'UP' : state.currentStatus,
      consecutiveFailures,
      consecutiveSuccesses,
      event: null,
      openedIncident: false,
      resolvedIncident: false,
    };
  }

  const consecutiveFailures = state.consecutiveFailures + 1;
  const consecutiveSuccesses = 0;
  const wasUp =
    state.currentStatus === 'UP' ||
    state.currentStatus === 'NEW' ||
    state.currentStatus === 'RECOVERED';

  if (wasUp && consecutiveFailures >= state.failureThreshold) {
    return {
      currentStatus: 'DOWN',
      consecutiveFailures,
      consecutiveSuccesses,
      event: 'monitor.down',
      openedIncident: true,
      resolvedIncident: false,
    };
  }

  return {
    currentStatus: state.currentStatus,
    consecutiveFailures,
    consecutiveSuccesses,
    event: null,
    openedIncident: false,
    resolvedIncident: false,
  };
}
