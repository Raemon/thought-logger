import React, { useEffect, useState, useCallback } from "react";
import { getWeek, getMonth, format, compareDesc } from "date-fns";

import Summary from "./Summary";
import { SerializedLog, SerializedScopeTypes } from "../types/files.d";

function openFolder() {
  window.userData.openUserDataFolder();
}

export function FileInfo() {
  const [dataFolder, setDataFolder] = useState("(loading)");
  const [serializedLogs, setSerializedLogs] = useState<SerializedLog[]>([]);

  useEffect(() => {
    window.userData.getUserDataFolder().then(setDataFolder);
    window.userData.getRecentLogs().then(setSerializedLogs);
  }, []);

  // FIXME Probably doesn't need to happen every render
  const tocByMonth: Record<string, Record<string, string[]>> = {};
  serializedLogs
    .filter(({ scope }) => scope === SerializedScopeTypes.Day)
    .forEach(({ date }) => {
      console.log(date);
      const month = format(date, "yyyy-MM");
      const week = format(date, "yyyy-'W'ww");
      if (!tocByMonth[month]) tocByMonth[month] = {};
      if (!tocByMonth[month][week]) tocByMonth[month][week] = [];
      tocByMonth[month][week].push(format(date, "yyyy-MM-dd"));
    });

  const getFormattedFile = (file: SerializedLog) => {
    const content = file.summaryContents;
    if (!content) return "Loading...";
    if (!content.match(/1\. /)) {
      return content;
    }
    const newContent = "1. " + content.split("1.")[1];
    const paragraphs = newContent.split(/\n\s*\n/);
    // Check if the last paragraph starts with a number
    const last = paragraphs[paragraphs.length - 1];
    if (last && !/^\d/.test(last.trim())) {
      paragraphs.pop();
    }
    return paragraphs.join("\n\n");
  };

  return (
    <div>
      <h3>User files</h3>
      <p>
        This app takes screenshots at regular intervals (configurable below),
        and logs mouse and keyboard inputs.
      </p>
      <button onClick={openFolder} className="ml-0">
        Open Files Folder
      </button>
      <span className="ml-2 text-xs text-gray-500">{dataFolder}</span>

      <div className="flex gap-2.5">
        <a
          href="http://localhost:8765/today"
          onClick={(e) => {
            e.preventDefault();
            window.userData.openExternalUrl("http://localhost:8765/today");
          }}
          className="text-blue-600 no-underline cursor-pointer"
        >
          today
        </a>
        <a
          href="http://localhost:8765/yesterday"
          onClick={(e) => {
            e.preventDefault();
            window.userData.openExternalUrl("http://localhost:8765/yesterday");
          }}
          className="text-blue-600 no-underline cursor-pointer"
        >
          yesterday
        </a>
        <a
          href="http://localhost:8765/last7days"
          onClick={(e) => {
            e.preventDefault();
            window.userData.openExternalUrl("http://localhost:8765/week");
          }}
          className="text-blue-600 no-underline cursor-pointer"
        >
          week
        </a>
      </div>

      <div className="flex gap-5 mt-5">
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
                        .sort((a, b) => b.localeCompare(a))
                        .map((day) => (
                          <div key={day}>
                            <a
                              href={`#day-${day}`}
                              className="text-blue-700 hover:underline"
                              style={{ fontSize: 13 }}
                              onClick={(e) => {
                                e.preventDefault();
                                const el = document.getElementById(
                                  `day-${day}`,
                                );
                                if (el)
                                  el.scrollIntoView({
                                    behavior: "smooth",
                                    block: "start",
                                  });
                              }}
                            >
                              {new Date(day).toLocaleDateString("en-US", {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                              })}
                            </a>
                          </div>
                        ))}
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
              <Summary log={log} />
            ))}
        </div>
      </div>
    </div>
  );
}
