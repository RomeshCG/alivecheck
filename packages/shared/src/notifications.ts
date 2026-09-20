export type MonitorEventType = 'monitor.down' | 'monitor.recovered' | 'monitor.test';

export type MonitorEvent = {
  event: MonitorEventType;
  monitor: string;
  url: string;
  timestamp: string;
  httpStatus?: number | null;
  errorType?: string | null;
};

export function formatEventSubject(event: MonitorEvent): string {
  if (event.event === 'monitor.down') {
    return `[AliveCheck] DOWN: ${event.monitor}`;
  }
  if (event.event === 'monitor.recovered') {
    return `[AliveCheck] RECOVERED: ${event.monitor}`;
  }
  return `[AliveCheck] Test notification: ${event.monitor}`;
}

export function formatEventBody(event: MonitorEvent): string {
  const lines = [
    `Event: ${event.event}`,
    `Monitor: ${event.monitor}`,
    `URL: ${event.url}`,
    `Time: ${event.timestamp}`,
  ];
  if (event.httpStatus != null) {
    lines.push(`HTTP status: ${event.httpStatus}`);
  }
  if (event.errorType) {
    lines.push(`Error: ${event.errorType}`);
  }
  return lines.join('\n');
}
