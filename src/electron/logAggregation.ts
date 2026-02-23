export type LogEventLike = {
  timestamp: number;
  keystrokes: string;
  applicationName: string;
  windowTitle: string;
};

export type AggregatedLogEventGroup = {
  startTimestamp: number;
  endTimestamp: number;
  applicationName: string;
  windowTitle: string;
  keystrokes: string;
};

export function aggregateLogEventsByAppWindowAndGap(
  eventsNewestFirst: LogEventLike[],
  { maxGapMs = 5 * 60 * 1000 }: { maxGapMs?: number } = {},
): AggregatedLogEventGroup[] {
  const groups: AggregatedLogEventGroup[] = [];
  let current:
    | null
    | {
        startTimestamp: number;
        endTimestamp: number;
        applicationName: string;
        windowTitle: string;
        previousTimestampInGroup: number;
        keystrokesNewestFirst: string[];
      } = null;

  for (const event of eventsNewestFirst) {
    if (!current) {
      current = {
        startTimestamp: event.timestamp,
        endTimestamp: event.timestamp,
        applicationName: event.applicationName,
        windowTitle: event.windowTitle,
        previousTimestampInGroup: event.timestamp,
        keystrokesNewestFirst: [event.keystrokes],
      };
      continue;
    }

    const sameApp = current.applicationName === event.applicationName;
    const sameWindow = current.windowTitle === event.windowTitle;
    const gapMs = current.previousTimestampInGroup - event.timestamp;
    const withinGap = gapMs <= maxGapMs;

    if (sameApp && sameWindow && withinGap) {
      current.startTimestamp = event.timestamp;
      current.previousTimestampInGroup = event.timestamp;
      current.keystrokesNewestFirst.push(event.keystrokes);
    } else {
      const keystrokes = current.keystrokesNewestFirst.slice().reverse().join("");
      groups.push({
        startTimestamp: current.startTimestamp,
        endTimestamp: current.endTimestamp,
        applicationName: current.applicationName,
        windowTitle: current.windowTitle,
        keystrokes,
      });
      current = {
        startTimestamp: event.timestamp,
        endTimestamp: event.timestamp,
        applicationName: event.applicationName,
        windowTitle: event.windowTitle,
        previousTimestampInGroup: event.timestamp,
        keystrokesNewestFirst: [event.keystrokes],
      };
    }
  }

  if (current) {
    const keystrokes = current.keystrokesNewestFirst.slice().reverse().join("");
    groups.push({
      startTimestamp: current.startTimestamp,
      endTimestamp: current.endTimestamp,
      applicationName: current.applicationName,
      windowTitle: current.windowTitle,
      keystrokes,
    });
  }

  return groups;
}
