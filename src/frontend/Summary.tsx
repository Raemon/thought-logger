import React, { ReactElement } from "react";
import { format, startOfWeek, endOfWeek, setDefaultOptions } from "date-fns";
import { Summary, SummaryScopeTypes } from "../types/files.d";
import { dynamicEndpoints } from "../constants/endpoints";

setDefaultOptions({
  weekStartsOn: 1,
});

function formatTokenCount(chars: number | undefined): string {
  if (chars === undefined) return "?";
  const tokens = Math.round(chars / 4);
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
  return tokens.toString();
}

function formatDateHeader(date: Date, weekly = false) {
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

export default function SummaryComponent({
  log,
}: {
  log: Summary;
}): ReactElement {
  const date = log.date;
  const dateStr = format(date, "yyyy-MM-dd");
  const weekStr = format(date, "YYYY'W'ww", {
    useAdditionalWeekYearTokens: true,
  });
  const week = log.scope === SummaryScopeTypes.Week;
  const dateEndpoints = dynamicEndpoints.filter(e => e.path.includes("YYYY-MM-DD"));
  return (
    <div
      key={dateStr}
      className="mb-2.5"
      id={week ? `week-${weekStr}` : `day-${dateStr}`}
    >
      <div className="mb-1 font-bold flex items-center">
        <span className="mr-auto">
          {formatDateHeader(date, log.scope === SummaryScopeTypes.Week)}
        </span>
        {log.path && (
          <button
            className={
              (log.loading
                ? "text-gray-400 cursor-not-allowed "
                : "text-gray-600 hover:text-blue-600 ") +
              "group relative ml-2 p-1"
            }
            onClick={() => window.userData.generateAISummary(log)}
            disabled={log.loading}
          >
            <span className="absolute right-full mr-1 top-1/2 -translate-y-1/2 whitespace-nowrap text-xs bg-gray-800 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none">
              Regenerate summary
            </span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}
      
      </div>
      <div className="flex flex-col gap-1">
        <div
          className={
            "whitespace-pre-wrap p-3 rounded text-sm " +
            (log.scope === SummaryScopeTypes.Day ? "bg-gray-100" : "bg-sky-50")
          }
        >
          {log.loading ? "Generating a summary..." : log.contents}
        </div>
      </div>
      {log.scope === SummaryScopeTypes.Day && (
        <div className="flex gap-3 p-1">
          {dateEndpoints.map(endpoint => {
            const url = `http://localhost:8765${endpoint.path.replace("YYYY-MM-DD", dateStr)}`;
            const charCount = endpoint.path === "/YYYY-MM-DD" ? log.keylogCharCount
              : endpoint.path === "/YYYY-MM-DD/screenshots/summaries" ? log.screenshotSummaryCharCount
              : undefined;
            const tokenStr = charCount !== undefined ? ` (${formatTokenCount(charCount)})` : "";
            return (
              <button
                key={endpoint.path}
                className="text-xs text-blue-800 font-normal"
                onClick={() => window.userData.openExternalUrl(url)}
              >
                {endpoint.label}{tokenStr}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
