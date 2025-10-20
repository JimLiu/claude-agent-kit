import React from "react";
import type { SearchResultBlock } from "../types";

interface SearchResultsViewProps {
  block: SearchResultBlock;
}

export function SearchResultsView({ block }: SearchResultsViewProps) {
  return (
    <div className="space-y-2 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-700">
      <div className="text-[10px] uppercase tracking-wide text-gray-500">
        Search results for "{block.query}"
      </div>
      <ul className="space-y-2">
        {block.results.map((result) => (
          <li key={result.url}>
            <p className="font-medium text-indigo-700">{result.title}</p>
            <p>{result.snippet}</p>
            <a
              href={result.url}
              target="_blank"
              rel="noreferrer"
              className="text-indigo-600 hover:text-indigo-500"
            >
              {result.url}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
