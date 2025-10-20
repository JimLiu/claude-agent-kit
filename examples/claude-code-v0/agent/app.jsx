import React from "react";

export const App: React.FC = () => {
  return (
    <div className="h-screen w-screen bg-gray-50 text-gray-900">
      <div className="flex flex-col h-full">
        <header className="h-16 bg-white shadow flex items-center justify-center">
          <h1 className="text-xl font-bold">Claude Code V0</h1>
        </header>
        <main className="flex-1 overflow-hidden">
          Hello world!
        </main>
      </div>
    </div>
  );
};

export default App;
