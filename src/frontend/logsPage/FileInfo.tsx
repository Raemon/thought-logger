import React, { useEffect, useState } from "react";
import { format, compareDesc } from "date-fns";

import SummaryComponent from "./Summary";
import EndpointLinks from "./EndpointLinks";
import TableOfContents from "./TableOfContents";
import { Summary, SummaryScopeTypes } from "../../types/files";

export function FileInfo() {
  const [serializedLogs, setSerializedLogs] = useState<Summary[]>([]);
  const [loadedAll, setLoadedAll] = useState(false);

  useEffect(() => {
    console.log("useEffect");
    window.userData.getRecentLogs().then(setSerializedLogs);
    window.userData.onUpdateRecentLogs((logs) => setSerializedLogs(logs));
  }, []);

  const loadAll = () => {
    window.userData.getAllLogs().then((logs) => {
      // console.log("logs", logs.length);
      // console.log("logs 2", logs.map(({ date }) => date));
      // console.log("logs 3", logs.map(({ path }) => path));
      setSerializedLogs(logs);
      setLoadedAll(true);
    });
  };

  // console.log("serializedLogs", serializedLogs.length);
  // console.log("serializedLogs 2", serializedLogs.map(({ date }) => date));
  // console.log("serializedLogs 3", serializedLogs.map(({ path }) => path));

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
      <EndpointLinks />
      <div className="flex gap-5">
        <TableOfContents tocByMonth={tocByMonth} />
        <div className="min-w-[300px] flex-1 space-y-12">
          {serializedLogs
            .sort((a, b) => compareDesc(a.date, b.date))
            .map((log) => (
              <SummaryComponent key={log.date.toISOString()} log={log} loadedAll={loadedAll} />
            ))}
          {!loadedAll && (
            <button
              onClick={loadAll}
              className="text-blue-600 hover:underline text-sm"
            >
              Load all
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
