import React, { ReactElement } from "react";
import { format, startOfWeek, endOfWeek, setDefaultOptions } from "date-fns";
import { SerializedLog, SerializedScopeTypes } from "../types/files.d";

setDefaultOptions({
  weekStartsOn: 1,
});

function formatDateHeader(date: Date, weekly: boolean = false) {
  const weekStart = startOfWeek(date);
  const weekEnd = endOfWeek(date);
  const weekStartStr = weekStart.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const weekEndStr = weekEnd.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const dayDateStr = date.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return weekly ? `Week of ${weekStartStr} to ${weekEndStr}` : dayDateStr;
}

export default function Summary({ log }: { log: SerializedLog }): ReactElement {
  const date = log.date;
  const dateStr = format(date, "yyyy-MM-dd");
  return (
    <div key={dateStr} className="mb-2.5" id={`day-${dateStr}`}>
      <div className="mb-1 font-bold flex items-center">
        <span className="mr-auto">
          {formatDateHeader(date, log.scope === SerializedScopeTypes.Week)}
        </span>
        <button
          className={
            (log.loading
              ? "bg-gray-300 opacity-50 cursor-not-allowed "
              : "bg-blue-500 hover:bg-blue-700 ") +
            "text-white font-bold rounded ml-2 px-2 py-0.5 text-xs"
          }
          onClick={() => window.userData.generateAISummary(log)}
          disabled={log.loading}
        >
          regenerate summary
        </button>
        {log.rawPath && (
          <button
            className="ml-2 px-2 py-2 text-xs text-blue-800 font-normal"
            onClick={() =>
              window.userData.openExternalUrl(`file://${log.rawPath}`)
            }
          >
            Raw
          </button>
        )}
        {log.appPath && (
          <button
            className="ml-2 px-2 py-0.5 text-xs text-green-800 font-normal"
            onClick={() =>
              window.userData.openExternalUrl(`file://${log.appPath}`)
            }
          >
            By App
          </button>
        )}
        {log.chronoPath && (
          <button
            className="ml-2 px-2 py-0.5 text-xs text-green-800 font-normal"
            onClick={() =>
              window.userData.openExternalUrl(`file://${log.chronoPath}`)
            }
          >
            Chronological
          </button>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <div
          className={
            "whitespace-pre-wrap p-3 rounded text-sm " +
            (log.scope === SerializedScopeTypes.Day
              ? "bg-gray-100"
              : "bg-sky-50")
          }
        >
          {log.loading && "Generating a summary..."}
          {log.summaryContents && !log.loading && log.summaryContents}
        </div>
      </div>
    </div>
  );
}
