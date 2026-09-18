import { useEffect, useMemo, useState } from 'react';
import { Bell, ChevronRight, Flame, Home, RefreshCw, Shield, Swords, Trophy, Users } from 'lucide-react';
import { api } from './api';
import type { Match, Notification, Player, Settings, Stage, Tournament } from './types';

type Tab = 'home' | 'matches' | 'team' | 'alerts';

const relativeTime = (timestamp?: number) => {
  if (!timestamp) return '—';
  const diff = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const activeTournament = tournaments.find(t => t.active && (t.category || 'official') === 'official') ?? tournaments[0];

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [s, t, p, m, n] = await Promise.all([
        api.settings(), api.tournaments(), api.players(), api.matches(), api.notifications()
      ]);
      setSettings(s);
      setTournaments(t);
      setPlayers(p);
      setMatches(m);
      setNotifications(n);
      if (t[0]) setStages(await api.stages(t[0].id));
    } catch (e) {
      setError('Connect the app to your production API using VITE_API_URL.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!activeTournament) return;
    api.stages(activeTournament.id).then(setStages).catch(() => setStages([]));
  }, [activeTournament?.id]);

  const visibleMatches = useMemo(() => {
    const filtered = selectedStage === 'all'
      ? matches
      : matches.filter(m => m.weekId === selectedStage);
    return filtered.slice().sort((a, b) => b.timestamp - a.timestamp);
  }, [matches, selectedStage]);

  const totalKills = matches.reduce((sum, m) =>
    sum + (m.playerStats || []).reduce((n, p) => n + (Number(p.kills) || 0), 0), 0);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            {settings?.logoUrl ? <img src={settings.logoUrl} alt="" /> : <Shield size={22} />}
          </div>
          <div>
            <strong>{settings?.teamName || 'OG ELITE'}</strong>
            <span>{settings?.game || 'Free Fire MAX'}</span>
          </div>
        </div>
        <button className="icon-button" onClick={() => setTab('alerts')} aria-label="Notifications">
          <Bell size={20} />
          {notifications.length > 0 && <i />}
        </button>
      </header>

      <main>
        {tab === 'home' && (
          <>
            <section className="hero-card">
              <div className="eyebrow"><Flame size={14} /> LIVE PERFORMANCE CENTER</div>
              <h1>{settings?.tagline || 'Discipline Builds Champions.'}</h1>
              <p>Track official results, stages, players and the latest OG ELITE updates.</p>
              <button className="primary-button" onClick={() => setTab('matches')}>
                View match history <ChevronRight size={17} />
              </button>
            </section>

            <section className="section">
              <div className="section-title"><span>Current campaign</span><Trophy size={18} /></div>
              <div className="campaign-card">
                <div>
                  <small>{activeTournament?.category === 'scrim' ? 'SCRIM' : 'OFFICIAL'}</small>
                  <h2>{activeTournament?.name || 'No active tournament'}</h2>
                  <p>{activeTournament?.rankDescription || 'Awaiting tournament data'}</p>
                </div>
                <div className="rank">
                  <span>#</span>{activeTournament?.currentRank || '—'}
                </div>
              </div>
            </section>

            <section className="stats-grid">
              <div><Users size={18} /><strong>{players.length}</strong><span>Players</span></div>
              <div><Swords size={18} /><strong>{matches.length}</strong><span>Matches</span></div>
              <div><Flame size={18} /><strong>{totalKills}</strong><span>Total kills</span></div>
            </section>

            <StagePicker stages={stages} selected={selectedStage} onSelect={setSelectedStage} />
            <MatchList matches={visibleMatches.slice(0, 4)} />
          </>
        )}

        {tab === 'matches' && (
          <>
            <PageHeading title="Match History" subtitle="Every recorded result, synced from the OG ELITE ledger." />
            <StagePicker stages={stages} selected={selectedStage} onSelect={setSelectedStage} />
            <MatchList matches={visibleMatches} />
          </>
        )}

        {tab === 'team' && (
          <>
            <PageHeading title="The Squad" subtitle="Current active roster from the live database." />
            <div className="player-grid">
              {players.map(player => (
                <article className="player-card" key={player.id}>
                  {player.imageUrl ? <img src={player.imageUrl} alt="" /> : <div className="player-avatar">{player.name.slice(0, 1)}</div>}
                  <div><strong>{player.name}</strong><span>{player.role}</span></div>
                </article>
              ))}
            </div>
          </>
        )}

        {tab === 'alerts' && (
          <>
            <PageHeading title="Notifications" subtitle="Match updates, content drops and admin announcements." />
            <div className="notification-list">
              {notifications.length === 0 && <EmptyState text="No notifications yet." />}
              {notifications.map(item => (
                <article className="notification" key={item.id}>
                  <div className="notification-icon"><Bell size={17} /></div>
                  <div><strong>{item.title}</strong><p>{item.message || item.type}</p><time>{relativeTime(item.createdAt)}</time></div>
                </article>
              ))}
            </div>
          </>
        )}

        {error && <div className="error-banner">{error}</div>}
        {loading && <div className="loading">Syncing live data…</div>}
      </main>

      <nav className="bottom-nav">
        <NavButton active={tab === 'home'} label="Home" icon={<Home size={20} />} onClick={() => setTab('home')} />
        <NavButton active={tab === 'matches'} label="Matches" icon={<Swords size={20} />} onClick={() => setTab('matches')} />
        <NavButton active={tab === 'team'} label="Team" icon={<Users size={20} />} onClick={() => setTab('team')} />
        <NavButton active={tab === 'alerts'} label="Alerts" icon={<Bell size={20} />} onClick={() => setTab('alerts')} />
        <button className="refresh" onClick={() => void load()} aria-label="Refresh"><RefreshCw size={18} /></button>
      </nav>

      <footer>Powered by Lumina HQ</footer>
    </div>
  );
}

function NavButton({ active, label, icon, onClick }: { active: boolean; label: string; icon: React.ReactNode; onClick: () => void }) {
  return <button className={active ? 'nav-item active' : 'nav-item'} onClick={onClick}>{icon}<span>{label}</span></button>;
}

function PageHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return <section className="page-heading"><span>OG ELITE</span><h1>{title}</h1><p>{subtitle}</p></section>;
}

function StagePicker({ stages, selected, onSelect }: { stages: Stage[]; selected: string; onSelect: (value: string) => void }) {
  if (!stages.length) return null;
  return <div className="stage-scroll">
    <button className={selected === 'all' ? 'stage active' : 'stage'} onClick={() => onSelect('all')}>All</button>
    {stages.map(stage => <button key={stage.id} className={selected === stage.id ? 'stage active' : 'stage'} onClick={() => onSelect(stage.id)}>{stage.name}</button>)}
  </div>;
}

function MatchList({ matches }: { matches: Match[] }) {
  return <section className="section">
    <div className="section-title"><span>Recent results</span><Swords size={18} /></div>
    <div className="match-list">
      {matches.length === 0 && <EmptyState text="No match results for this stage yet." />}
      {matches.map(match => <article className="match-card" key={match.id}>
        <div className="match-number">M{match.matchNumber}</div>
        <div className="match-info"><strong>{match.mapName || 'Battle Royale'}</strong><span>{match.category === 'scrim' ? 'SCRIM' : 'OFFICIAL'} · {relativeTime(match.timestamp)}</span></div>
        <div className="match-result"><strong>#{match.position}</strong><span>{match.totalPoints} pts</span></div>
      </article>)}
    </div>
  </section>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}
