import React, { useEffect, useState } from "react";
import { format, compareDesc, compareAsc } from "date-fns";

import SummaryComponent from "./Summary";
import { Summary, SummaryScopeTypes } from "../types/files.d";
import { endpointList } from "../constants/endpoints";

const BASE_URL = "http://localhost:8765";

export function FileInfo() {
  const [serializedLogs, setSerializedLogs] = useState<Summary[]>([]);

  useEffect(() => {
    window.userData.getRecentLogs().then(setSerializedLogs);
    window.userData.onUpdateRecentLogs((logs) => setSerializedLogs(logs));
  }, []);

  // FIXME Probably doesn't need to happen every render
  const tocByMonth: Record<string, Record<string, Date[]>> = {};
  serializedLogs
    .filter(({ scope }) => scope === SummaryScopeTypes.Day)
    .forEach(({ date }) => {
      const month = format(date, "yyyy-MM");
      const week = format(date, "yyyy-'W'ww");
      if (!tocByMonth[month]) tocByMonth[month] = {};
      if (!tocByMonth[month][week]) tocByMonth[month][week] = [];
      tocByMonth[month][week].push(date);
    });

  return (
    <div>
      <div className="flex flex-wrap gap-2.5 mb-4">
        {endpointList.map((endpoint) => (
          <a
            key={endpoint.path}
            href={`${BASE_URL}${endpoint.path}`}
            onClick={(e) => {
              e.preventDefault();
              window.userData.openExternalUrl(`${BASE_URL}${endpoint.path}`);
            }}
            className="text-blue-600 border border-gray-300 rounded-sm px-2 py-1 no-underline cursor-pointer text-sm"
            title={endpoint.description}
          >
            {endpoint.label}
          </a>
        ))}
      </div>
      <div className="flex gap-5">
        <div
          className="min-w-[220px] max-w-[250px] pr-2 border-r border-gray-200 text-sm"
          style={{ maxHeight: 600, overflowY: "auto" }}
        >
          <div className="font-bold mb-2">Table of Contents</div>
          {Object.entries(tocByMonth).map(([month, weeks]) => (
            <div key={month} className="mb-2">
              <div className="font-semibold">{month}</div>
              <div style={{ marginLeft: 10 }}>
                {Object.entries(weeks).map(([week, days]) => (
                  <div key={week} className="mb-1">
                    <div className="text-xs text-gray-600">
                      <a
                        href={`#week-${week}`}
                        className="text-blue-500 hover:underline"
                        onClick={(e) => {
                          e.preventDefault();
                          const el = document.getElementById(`week-${week}`);
                          if (el)
                            el.scrollIntoView({
                              behavior: "smooth",
                              block: "start",
                            });
                        }}
                      >
                        {week}
                      </a>
                    </div>
                    <div style={{ marginLeft: 10 }}>
                      {days
                        .sort((a, b) => compareAsc(a, b))
                        .map((day) => {
                          const dateString = format(day, "yyyy-MM-dd");
                          return (
                            <div key={dateString}>
                              <a
                                href={`#day-${dateString}`}
                                className="text-blue-700 hover:underline"
                                style={{ fontSize: 13 }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  const el = document.getElementById(
                                    `day-${dateString}`,
                                  );
                                  if (el)
                                    el.scrollIntoView({
                                      behavior: "smooth",
                                      block: "start",
                                    });
                                }}
                              >
                                {format(day, "EEE, MMM d")}
                              </a>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="min-w-[300px] flex-1">
          {serializedLogs
            .sort((a, b) => compareDesc(a.date, b.date))
            .map((log) => (
              <SummaryComponent key={log.date.toISOString()} log={log} />
            ))}
        </div>
      </div>
    </div>
  );
}
