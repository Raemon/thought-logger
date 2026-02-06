import React, { useState, Children, isValidElement } from "react";

interface TabProps {
  id: string;
  label: string;
  badge?: number;
  children: React.ReactNode;
}

interface TabContainerProps {
  defaultTab?: string;
  children: React.ReactNode;
}

const TabButton = ({
  selected,
  onClick,
  children,
  badge,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  badge?: number;
}) => (
  <button
    onClick={onClick}
    className={
      `px-4 py-2 cursor-pointer mr-0.5 -mb-px flex items-center ` +
      (selected
        ? "bg-white border-t border-l border-r border-gray-300 border-b-0"
        : "border-transparent border-t border-l border-r")
    }
  >
    {children}
    {badge !== undefined && badge > 0 && (
      <span className="ml-2 px-2 py-0.5 text-xs font-semibold text-red-700 bg-red-100 rounded-full">
        {badge}
      </span>
    )}
  </button>
);

export function Tab({ children }: TabProps) {
  return <>{children}</>;
}

export function TabContainer({ defaultTab, children }: TabContainerProps) {
  const tabs = Children.toArray(children).filter(
    (child): child is React.ReactElement<TabProps> =>
      isValidElement(child) && child.type === Tab,
  );

  const firstTabId = defaultTab || tabs[0]?.props.id;
  const [activeTab, setActiveTab] = useState(firstTabId);

  return (
    <>
      <div className="border-b border-gray-300 mb-4 flex">
        {tabs.map((tab) => (
          <TabButton
            key={tab.props.id}
            selected={activeTab === tab.props.id}
            onClick={() => setActiveTab(tab.props.id)}
            badge={tab.props.badge}
          >
            {tab.props.label}
          </TabButton>
        ))}
      </div>
      {tabs.find((tab) => tab.props.id === activeTab)}
    </>
  );
}
