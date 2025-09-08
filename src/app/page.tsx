"use client";
import React from "react";
import SimulatorPanel from "./components/SimulatorPanel";

export default function Home() {
  const [pane, setPane] = React.useState<'main'|'suggested'|'rangebin'>("main");
  return (
    <div className="font-sans min-h-screen p-6 md:p-8 lg:p-10">
      <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
        <aside className="card-light h-max p-3 sticky top-6 self-start">
          <nav className="space-y-2">
            <button className={`w-full text-left px-3 py-2 rounded border border-[var(--border)] text-[var(--foreground)] ${pane==='main'?'bg-[#111827]':'bg-[#0b0d10] hover:bg-[#111827]'}`} onClick={()=>setPane('main')}>Main</button>
            <button className={`w-full text-left px-3 py-2 rounded border border-[var(--border)] text-[var(--foreground)] ${pane==='suggested'?'bg-[#111827]':'bg-[#0b0d10] hover:bg-[#111827]'}`} onClick={()=>setPane('suggested')}>Suggested range</button>
            <button className={`w-full text-left px-3 py-2 rounded border border-[var(--border)] text-[var(--foreground)] ${pane==='rangebin'?'bg-[#111827]':'bg-[#0b0d10] hover:bg-[#111827]'}`} onClick={()=>setPane('rangebin')}>Range–Bin calc</button>
          </nav>
        </aside>
        <main className="space-y-6">
          <SimulatorPanel pane={pane} />
        </main>
      </div>
    </div>
  );
}
