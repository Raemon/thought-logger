import React from "react";
import { groupBy } from "lodash";
import { endpointList } from "../../constants/endpoints";

const BASE_URL = "http://localhost:8765";

const EndpointLinks = () => {
  const groupedByFirstLetter = groupBy(endpointList, (e) => e.label[0]);
  return (
    <div className="flex flex-col gap-1 mb-4">
      {Object.entries(groupedByFirstLetter).map(([letter, endpoints]) => (
        <div key={letter} className="flex flex-wrap gap-2.5">
          {endpoints.map((endpoint) => (
            <a
              key={endpoint.path}
              href={`${BASE_URL}${endpoint.path}`}
              onClick={(e) => {
                e.preventDefault();
                window.userData.openExternalUrl(`${BASE_URL}${endpoint.path}`);
              }}
              className="text-blue-600 no-underline cursor-pointer text-xs"
              title={endpoint.path === "/log" ? `${endpoint.description} (start/end: ms or YYYY-MM-DD_HH.MM.SSAM|PM)` : endpoint.description}
            >
              {endpoint.label}
              {endpoint.path === "/log" ? <span className="text-gray-500"> ?start=&amp;end=&amp;search=&amp;type=keylog|screenshot</span> : null}
            </a>
          ))}
        </div>
      ))}
    </div>
  );
};

export default EndpointLinks;
