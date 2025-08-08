import React, { ReactElement, useEffect, useState } from "react";

export default function TypeaheadDropdown({
    value,
    onChange,
    items,
}: {
    value: string;
    onChange: (item: string) => void;
    items: string[];
}): ReactElement {
    const [focused, setFocused] = useState<boolean>(false);
    const [displayedItems, setDisplayedItems] = useState<string[]>(items);
    const [selected, setSelected] = useState<number>(0);

    useEffect(() => {
        setDisplayedItems(items.filter((item) => item.includes(value)));
        setSelected(0);
    }, [value]);

    return (
        <div className="inline-block relative w-fit">
            <input
                className="border-2 rounded p-2"
                value={value}
                onChange={(e) => {
                    onChange(e.currentTarget.value);
                    setFocused(true);
                }}
                onKeyDown={(e) => {
                    switch (e.key) {
                        case "Enter":
                            e.preventDefault();
                            onChange(
                                items.find((item) => item.includes(value)),
                            );
                            setFocused(false);
                            break;
                        case "ArrowDown":
                            setSelected(selected + 1);
                            break;
                        case "ArrowUp":
                            setSelected(selected - 1);
                            break;
                    }
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
            />
            {focused && (
                <ul className="absolute left-0 bg-slate-50 border-2 rounded w-full">
                    {displayedItems.map((item, idx) => {
                        const className =
                            "p-2 w-full" +
                            (idx === selected ? " bg-sky-200" : "");
                        return <li className={className}>{item}</li>;
                    })}
                </ul>
            )}
        </div>
    );
}
