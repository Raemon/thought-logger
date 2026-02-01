import React from "react";
import { format, compareAsc } from "date-fns";

type TocByMonth = Record<string, Record<string, Date[]>>;

const TableOfContents = ({ tocByMonth }: { tocByMonth: TocByMonth }) => {
  const scrollToElement = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <div
      className="min-w-[220px] max-w-[250px] pr-2 border-r border-gray-200 text-sm sticky top-0 h-screen overflow-y-auto thin-scrollbar"
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
                      scrollToElement(`week-${week}`);
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
                              scrollToElement(`day-${dateString}`);
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
  );
};

export default TableOfContents;
