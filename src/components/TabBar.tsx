type Tab = 'map' | 'run' | 'leaderboard' | 'profile';

interface TabBarProps {
  active: Tab;
  onTabChange: (tab: Tab) => void;
}

const tabs: { id: Tab; icon: string; label: string }[] = [
  { id: 'map', icon: '⬡', label: 'MAP' },
  { id: 'run', icon: '▶', label: 'RUN' },
  { id: 'leaderboard', icon: '🏆', label: 'RANK' },
  { id: 'profile', icon: '👤', label: 'PROFILE' },
];

export function TabBar({ active, onTabChange }: TabBarProps) {
  return (
    <div className="tabbar">
      <div className="tabbar-pill">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tabbar-tab ${active === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            <span className="tabbar-icon">{tab.icon}</span>
            <span className="tabbar-label">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
