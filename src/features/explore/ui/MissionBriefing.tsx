'use client';

import { ArrowUpRight, MoveUpRight, Orbit, Radio, Wind } from 'lucide-react';

export function MissionBriefing({ onStart }: { onStart: () => void }) {
  return (
    <main className="briefing">
      <div className="briefing-orbit" aria-hidden="true"><div className="briefing-planet" /><span>04° 35′ S · 137° 26′ E</span></div>
      <header className="briefing-brand"><Orbit size={26} /> MISSIONLAB <span>ASTRONAUT FIELD TRAINING</span></header>
      <section className="briefing-copy">
        <div className="mission-eyebrow"><span className="status-dot" /> MISSION 01 / MARS · SOL 2045</div>
        <h1>The Red<br /><em>Storm.</em></h1>
        <p className="briefing-lead">Four crew. One habitat.<br />Every system is connected.</p>
        <p className="briefing-description">A dust storm has cut solar power. Enter Ares Research Station, protect essential systems and investigate equipment warnings. Keep your crew safe for 72 mission hours.</p>
        <div className="briefing-goals"><span><Wind size={17} /> Survive the storm</span><span><Radio size={17} /> Restore the habitat</span></div>
        <button type="button" onClick={onStart} className="start-mission">Start Mission <ArrowUpRight size={22} /></button>
        <p className="briefing-controls"><kbd>W A S D</kbd> move <span>·</span> <kbd>SHIFT</kbd> run <span>·</span> <kbd>E</kbd> interact</p>
      </section>
      <aside className="briefing-coordinate"><MoveUpRight size={20} /><div>ARES RESEARCH STATION<br /><span>Your first destination: Power Room →</span></div></aside>
      <footer className="briefing-footer"><span>LUMEN 2.0 / BEYOND 2030</span><span>Explore. Investigate. Understand.</span></footer>
    </main>
  );
}
