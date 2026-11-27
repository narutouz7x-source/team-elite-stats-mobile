import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { Bell, Check, ChevronLeft, ChevronRight, Copy, Home, Image as ImageIcon, Play, Plus, RefreshCw, Shield, Swords, Trophy, Users, X } from 'lucide-react';
import { api } from './api';
import type { Clip, Creator, Match, Notification, Player, PlayerStat, Settings, Stage, Tournament } from './types';
import ogEliteLogo from '../assets/og-elite-icon.png';
import { initializeNativeNotifications } from './nativeNotifications';
import packageJson from '../package.json';

type Tab = 'home' | 'matches' | 'team' | 'clips' | 'crew' | 'alerts';
type Category = 'official' | 'scrim';
type AppUpdate = { version: string; url: string; notes?: string };
type ClipForm = { url: string; title: string; submittedBy: string; creatorName: string };

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const mediaUrl = (value?: string) => {
  if (!value) return '';
  const raw = value.trim();
  if (!raw) return '';
  if (raw.startsWith('//')) return 'https:' + raw;
  if (raw.startsWith('/')) return API_BASE + raw;
  if (raw.startsWith('http://')) return 'https://' + raw.slice(7);
  return raw;
};

const clipImageUrl = (clip: Clip) => {
  const provided = mediaUrl(clip.thumbnailUrl || '');
  if (provided) {
    return API_BASE + '/api/clips/thumbnail?url=' + encodeURIComponent(provided);
  }

  try {
    const url = new URL(clip.url);
    if (url.hostname.includes('youtube.com') || url.hostname === 'youtu.be' || url.hostname.includes('youtube-nocookie.com')) {
      const videoId = url.hostname === 'youtu.be'
        ? url.pathname.slice(1).split('/')[0]
        : url.searchParams.get('v') || url.pathname.match(/(?:shorts|embed|live)\/([^/?]+)/)?.[1];
      if (videoId) {
        const thumbnail = 'https://i.ytimg.com/vi/' + videoId + '/hqdefault.jpg';
        return API_BASE + '/api/clips/thumbnail?url=' + encodeURIComponent(thumbnail);
      }
    }
  } catch {
    // Keep the fallback state when the clip URL is malformed.
  }
  return '';
};

const backgroundOptions = [
  { id: 'default', name: 'Original', src: '' },
  { id: 'one', name: 'Background 1', src: new URL('../assets/background/9df826020ed4c832e0db0a28bf9e0a8d.jpg', import.meta.url).href },
  { id: 'two', name: 'Background 2', src: new URL('../assets/background/d4ed50b73caed239ffec2db3fd06178d.jpg', import.meta.url).href },
  { id: 'three', name: 'Background 3', src: new URL('../assets/background/f54846636d8d1268f37cd3fedacc58a2.jpg', import.meta.url).href }
];

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

const matchKills = (match: Match) => (match.playerStats || []).reduce((n, p) => n + (Number(p.kills) || 0), 0);
const statusLabel = (status: Tournament['status']) => status.charAt(0).toUpperCase() + status.slice(1);

export function App() {
  const [tab, setTab] = useState<Tab>('home');
  const navPointerStart = useRef<number | null>(null);
  const navDragActive = useRef(false);
  const [navPosition, setNavPosition] = useState(0);
  const [navDragging, setNavDragging] = useState(false);
  const navLastX = useRef<number | null>(null);
  const [navStretch, setNavStretch] = useState(1);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [playerStats, setPlayerStats] = useState<Record<string, PlayerStat>>({});
  const [clips, setClips] = useState<Clip[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [copied, setCopied] = useState(false);
  const [clipSubmitOpen, setClipSubmitOpen] = useState(false);
  const [clipActionsOpen, setClipActionsOpen] = useState(false);
  const [clipBusy, setClipBusy] = useState(false);
  const [clipMessage, setClipMessage] = useState('');
  const [clipForm, setClipForm] = useState<ClipForm>({ url: '', title: '', submittedBy: '', creatorName: '' });
  const [selectedStage, setSelectedStage] = useState<string>('overall');
  const [selectedCategory, setSelectedCategory] = useState<Category>('official');
  const [selectedHistoryTournamentId, setSelectedHistoryTournamentId] = useState<string | null>(null);
  const [historyStages, setHistoryStages] = useState<Stage[]>([]);
  const [historyStage, setHistoryStage] = useState('overall');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [appUpdate, setAppUpdate] = useState<AppUpdate | null>(null);
  const [backgroundPickerOpen, setBackgroundPickerOpen] = useState(false);
  const [selectedBackground, setSelectedBackground] = useState(() => localStorage.getItem('og-test-background') || 'default');



  async function handleViewMatch(match: Match) {
    setSelectedMatch(match);
  }

  async function handleWatchClip(url: string) {
    window.open(url, '_system');
  }

  const activeTournament = tournaments.find(t => t.active && (t.category || 'official') === selectedCategory) ?? tournaments.find(t => (t.category || 'official') === selectedCategory) ?? tournaments[0];

  async function load() {
    setLoading(true); setError('');
    try {
      const [s, t, p, m, n, pstats, clipsData, creatorsData] = await Promise.all([
        api.settings(), api.tournaments(), api.players(), api.matches(), api.notifications(), api.playerStats(), api.clips(), api.creators()
      ]);
      setSettings(s); setTournaments(t); setPlayers(p); setMatches(m); setNotifications(n); setPlayerStats(pstats); setClips(clipsData); setCreators(creatorsData);
      const latestByCategory = { official: 0, scrim: 0 };
      for (const match of m) {
        const category = match.category === 'scrim' ? 'scrim' : 'official';
        const timestamp = Number(match.timestamp) || 0;
        if (timestamp > latestByCategory[category]) latestByCategory[category] = timestamp;
      }
      const latestCategory = latestByCategory.scrim > latestByCategory.official ? 'scrim' : 'official';
      setSelectedCategory(latestCategory);
      const firstTournament = t.find(x => x.active && (x.category || 'official') === latestCategory)
        ?? t.find(x => (x.category || 'official') === latestCategory)
        ?? t[0];
      if (firstTournament) setStages(await api.stages(firstTournament.id));
    } catch (e) { setError('Connect the app to your production API using VITE_API_URL.'); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    const selected = backgroundOptions.find(option => option.id === selectedBackground) || backgroundOptions[0];
    document.body.dataset.appBackground = selected.id;
    document.body.style.backgroundImage = selected.src ? 'linear-gradient(180deg, rgba(5,7,6,.66), rgba(5,7,6,.82)), url(' + selected.src + ')' : '';
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundAttachment = 'fixed';
    localStorage.setItem('og-test-background', selected.id);
  }, [selectedBackground]);

  useEffect(() => {
    void load();
    void initializeNativeNotifications().then(diagnostic => {
      if (diagnostic?.error) console.warn('[FCM diagnostic] app status:', diagnostic);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const checkForUpdate = async () => {
      try {
        const response = await fetch('https://api.github.com/repos/narutouz7x-source/team-elite-stats-mobile/releases/latest', {
          headers: { Accept: 'application/vnd.github+json' },
          cache: 'no-store'
        });
        if (!response.ok) return;
        const release = await response.json();
        const latest = String(release.tag_name || '').replace(/^v/i, '');
        const current = String(packageJson.version || '0.0.0');
        const compareVersions = (a: string, b: string) => {
          const pa = a.split('.').map(Number);
          const pb = b.split('.').map(Number);
          for (let i = 0; i < 3; i++) {
            const av = Number.isFinite(pa[i]) ? pa[i] : 0;
            const bv = Number.isFinite(pb[i]) ? pb[i] : 0;
            if (av !== bv) return av - bv;
          }
          return 0;
        };
        if (!cancelled && latest && compareVersions(latest, current) > 0) {
          const apk = Array.isArray(release.assets)
            ? release.assets.find((asset: { name?: string }) => String(asset.name || '').toLowerCase().endsWith('.apk'))
            : null;
          setAppUpdate({
            version: latest,
            url: apk?.browser_download_url || release.html_url,
            notes: String(release.body || '').trim()
          });
        }
      } catch {
        // Update checks are optional and must never block the app.
      }
    };
    void checkForUpdate();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { setSelectedStage('overall'); if (!activeTournament) { setStages([]); return; } api.stages(activeTournament.id).then(setStages).catch(() => setStages([])); }, [activeTournament?.id]);

  const selectedHistoryTournament = tournaments.find(t => t.id === selectedHistoryTournamentId) ?? null;
  useEffect(() => {
    if (!selectedHistoryTournamentId) { setHistoryStages([]); setHistoryStage('overall'); return; }
    setHistoryStage('overall');
    api.stages(selectedHistoryTournamentId).then(setHistoryStages).catch(() => setHistoryStages([]));
  }, [selectedHistoryTournamentId]);
  const categoryMatches = useMemo(() => matches.filter(m => (m.category || tournaments.find(t => t.id === m.tournamentId)?.category || 'official') === selectedCategory), [matches, tournaments, selectedCategory]);

  const tournamentMatches = useMemo(() => categoryMatches
    .filter(m => !activeTournament || m.tournamentId === activeTournament.id)
    .slice()
    .sort((a,b) => b.timestamp - a.timestamp), [categoryMatches, activeTournament?.id]);

  useEffect(() => {
    if (selectedStage !== 'overall' && !stages.some(stage => stage.id === selectedStage)) setSelectedStage('overall');
  }, [selectedCategory, activeTournament?.id, stages, selectedStage]);

  const visibleMatches = useMemo(() => (selectedStage === 'overall'
    ? tournamentMatches
    : tournamentMatches.filter(m => m.weekId === selectedStage)
  ).slice().sort((a,b) => b.timestamp-a.timestamp), [tournamentMatches, selectedStage]);

  const selectedStageName = stages.find(stage => stage.id === selectedStage)?.name;
  const totalKills = visibleMatches.reduce((sum,m) => sum + matchKills(m),0);
  const totalPoints = visibleMatches.reduce((sum,m) => sum + (Number(m.totalPoints)||0),0);

  const squadOutput = useMemo(() => players.map(player => {
    const kills = visibleMatches.flatMap(match => (match.playerStats || []).filter(stat => stat.playerId === player.id)).reduce((n, stat) => n + (Number(stat.kills) || 0), 0);
    return { player, kills };
  }).sort((a, b) => b.kills - a.kills), [players, visibleMatches]);
  const squadMax = Math.max(1, ...squadOutput.map(row => row.kills));
  const rosterMaxKills = Math.max(1, ...players.map(player => playerStats[player.id]?.kills ?? 0));

  const goTab = (next: Tab, position?: number) => {
    if (position !== undefined) setNavPosition(position);
    setTab(next);
    setClipActionsOpen(false);
  };

  return <div className="app-shell">
    <div className={'sync-bar' + (loading ? ' on' : '')} aria-hidden="true"/>
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark"><img src={ogEliteLogo} alt="OG ELITE" /></div>
        <div className="brand-copy"><strong>{settings?.teamName || 'OG ELITE'}</strong><span>{settings?.game || 'Free Fire MAX'}</span></div>
      </div>
      <div className="topbar-actions">
        <button className="icon-button background-picker-trigger" onClick={() => setBackgroundPickerOpen(true)} aria-label="Choose background" title="Choose background"><ImageIcon size={18}/></button>
        <button className={'icon-button' + (loading ? ' spinning' : '')} onClick={() => void load()} aria-label="Refresh data" title="Refresh data"><RefreshCw size={18}/></button>
        <button className={'icon-button' + (tab === 'alerts' ? ' current' : '')} onClick={() => setTab('alerts')} aria-label="Notifications"><Bell size={19}/>{notifications.length > 0 && <i/>}</button>
      </div>
    </header>

    <main key={tab} className="view">
      {tab === 'home' && <>
        <section className="hybrid-tournament-card" aria-label="Current tournament">
          <div className="hybrid-tournament-top">
            <div className="hybrid-tournament-label"><span className="hybrid-live-mark"/><span>{activeTournament?.active ? 'CURRENT TOURNAMENT' : activeTournament ? statusLabel(activeTournament.status).toUpperCase() : 'TOURNAMENT'}</span></div>
            <Segmented value={selectedCategory} onChange={setSelectedCategory} label="Match category"/>
          </div>
          <div className="hybrid-tournament-main">
            <div className="hybrid-tournament-copy">
              <h1>{activeTournament?.name || 'No active tournament'}</h1>
              <p>{selectedCategory === 'scrim' ? 'Recent scrim performance, synced from the OG ELITE ledger.' : 'Official competitive performance, synced from the OG ELITE ledger.'}</p>
            </div>
            {activeTournament && typeof activeTournament.currentRank === 'number' && activeTournament.currentRank > 0 && <div className="hybrid-rank-block"><strong>#{activeTournament.currentRank}</strong><span>RUNNING RANK</span></div>}
          </div>
          {activeTournament?.rankDescription && <div className="hybrid-rank-note">{activeTournament.rankDescription}</div>}
        </section>

        {selectedCategory === 'official' && activeTournament && <StagePicker stages={stages} selected={selectedStage} onSelect={setSelectedStage}/>}

        <section className="readouts" aria-label="Summary">
          <article className="readout slab"><small>Team points</small><strong>{totalPoints}</strong><span>{selectedStageName || 'Live results'}</span></article>
          <article className="readout"><small>Eliminations</small><strong>{totalKills}</strong><span>Player total</span></article>
          <article className="readout"><small>Matches played</small><strong>{visibleMatches.length}</strong><span>{selectedStageName || 'Recorded matches'}</span></article>
          <article className="readout"><small>Roster</small><strong>{players.length}</strong><span>Active players</span></article>
        </section>

        <HomePerformanceGraphs matches={visibleMatches} players={players}/>

        <section className="panel">
          <div className="panel-head">
            <div><span>Latest results</span><h2>{selectedStageName ? selectedStageName + ' performance' : selectedCategory === 'official' ? 'Official match performance' : 'Recent scrim performance'}</h2></div>
            <button className="text-action" onClick={() => setTab('matches')}>View history<ChevronRight size={15}/></button>
          </div>
          <div className="match-list">
            {visibleMatches.length === 0 ? <EmptyState text="No match results for this stage yet."/> : visibleMatches.slice(0, 8).map(match => <MatchCard key={match.id} match={match} onView={handleViewMatch}/>)}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div><span>Table</span><h2>Squad output</h2></div>
            <button className="text-action" onClick={() => setTab('team')}>Full roster<ChevronRight size={15}/></button>
          </div>
          <div className="output-list">
            {squadOutput.map(({ player, kills }, index) => <div className="output-row" key={player.id}>
              <span className="output-rank">{index + 1}</span>
              <strong>{player.name}</strong>
              <div className="output-track"><i style={{ width: Math.max(kills > 0 ? 3 : 0, (kills / squadMax) * 100) + '%' }}/></div>
              <b>{kills}</b>
            </div>)}
            {players.length === 0 && <EmptyState text="No roster data available yet."/>}
          </div>
        </section>
      </>}

      {tab === 'matches' && <>
        <PageHeading title="Match history" subtitle="Choose a tournament to explore its recorded matches."/>
        <div className="toolbar"><Segmented value={selectedCategory} onChange={value => { setSelectedCategory(value); setSelectedHistoryTournamentId(null); }} label="Match category"/></div>
        {selectedHistoryTournament ? <>
          <section className="history-head">
            <button className="text-action back" onClick={() => setSelectedHistoryTournamentId(null)}><ChevronLeft size={16}/>All tournaments</button>
            <h2>{selectedHistoryTournament.name}</h2>
            <p><span className="pill ghost">{statusLabel(selectedHistoryTournament.status)}</span>{categoryMatches.filter(m => m.tournamentId === selectedHistoryTournament.id).length} matches</p>
          </section>
          <StagePicker stages={historyStages} selected={historyStage} onSelect={setHistoryStage}/>
          <MatchList matches={categoryMatches.filter(m => m.tournamentId === selectedHistoryTournament.id).filter(m => historyStage === 'overall' || m.weekId === historyStage).slice().sort((a, b) => b.timestamp - a.timestamp)} onView={handleViewMatch}/>
        </> : <TournamentHistoryList tournaments={tournaments.filter(t => (t.category || 'official') === selectedCategory)} matches={matches.filter(m => (m.category || tournaments.find(t => t.id === m.tournamentId)?.category || 'official') === selectedCategory)} onSelect={setSelectedHistoryTournamentId}/>}
      </>}

      {tab === 'team' && <>
        <section className="page-heading with-count">
          <div><h1>Meet the squad</h1><p>Player profiles, roles and live competitive output managed from the OG ELITE control center.</p></div>
          <div className="count-chip"><strong>{String(players.length).padStart(2, '0')}</strong><span>Active<br/>players</span></div>
        </section>
        <div className="player-grid">
          {players.map((player, index) => {
            const stat = playerStats[player.id];
            const kills = stat?.kills ?? 0;
            const played = stat?.played ?? 0;
            const avg = played ? (kills / played).toFixed(2) : '0.00';
            return <article className="player-card" key={player.id}>
              <Portrait src={mediaUrl(player.imageUrl)} name={player.name} className="player-portrait" eager={false}/>
              <div className="player-body">
                <div className="player-id">
                  <div><strong>{player.name}</strong><small>{player.role}</small></div>
                  <span className="player-no">{String(index + 1).padStart(2, '0')}</span>
                </div>
                <div className="player-stats">
                  <div><strong>{kills}</strong><span>Kills</span></div>
                  <div><strong>{played}</strong><span>Matches</span></div>
                  <div><strong>{avg}</strong><span>Avg</span></div>
                </div>
                <div className="player-share" aria-hidden="true"><i style={{ width: Math.max(kills > 0 ? 3 : 0, (kills / rosterMaxKills) * 100) + '%' }}/></div>
              </div>
            </article>;
          })}
        </div>
        {players.length === 0 && <EmptyState text="No player records available yet."/>}
      </>}

      {tab === 'clips' && <ClipsPanel clips={clips} onWatchClip={url => void handleWatchClip(url)} clipSubmitOpen={clipSubmitOpen} setClipSubmitOpen={setClipSubmitOpen} clipBusy={clipBusy} setClipBusy={setClipBusy} clipMessage={clipMessage} setClipMessage={setClipMessage} clipForm={clipForm} setClipForm={setClipForm} setClips={setClips}/>}

      {tab === 'crew' && <>
        <PageHeading title="Our crew" subtitle="Meet the creators and personalities building the OG ELITE community."/>
        <section className="crew-grid">
          {creators.length ? creators.map(creator => <article className="crew-card" key={creator.id}>
            <Portrait src={mediaUrl(creator.imageUrl)} name={creator.name} className="crew-portrait" eager/>
            <div className="crew-body">
              <div className="crew-id">
                <div><h2>{creator.name}</h2>{creator.handle && <span>{creator.handle}</span>}</div>
                {creator.featured && <em className="pill ghost">Featured</em>}
              </div>
              <p>{creator.bio || 'OG ELITE community creator.'}</p>
              <div className="crew-links">
                {creator.youtube && <a className="chip-link" href={creator.youtube} target="_blank" rel="noreferrer" aria-label={'Open ' + creator.name + "'s YouTube"}><SocialIcon type="youtube"/><span>YouTube</span></a>}
                {creator.instagram && <a className="chip-link" href={creator.instagram} target="_blank" rel="noreferrer" aria-label={'Open ' + creator.name + "'s Instagram"}><SocialIcon type="instagram"/><span>Instagram</span></a>}
                {creator.discord && <a className="chip-link" href={creator.discord} target="_blank" rel="noreferrer" aria-label={'Open ' + creator.name + "'s Discord"}><span>Discord</span></a>}
              </div>
            </div>
          </article>) : <div className="feature-empty"><b>Creators will appear here</b></div>}
        </section>
      </>}

      {tab === 'alerts' && <>
        <PageHeading title="Notifications" subtitle="Match updates, content drops and admin announcements."/>
        <div className="notification-list">
          {notifications.length === 0 && <EmptyState text="No notifications yet."/>}
          {notifications.map(item => <article className="notification" key={item.id}>
            <div className="notification-icon">{item.type === 'esports' ? <Trophy size={18}/> : item.type === 'content' ? <Play size={18}/> : <Bell size={18}/>}</div>
            <div><strong>{item.title}</strong><p>{item.message || item.type}</p><time>{relativeTime(item.createdAt)}</time></div>
          </article>)}
        </div>
      </>}

      {error && <div className="error-banner" role="alert"><span>{error}</span><button onClick={() => void load()}>Try again</button></div>}
      {loading && <div className="loading" role="status">Syncing live data…</div>}
      <footer className="app-footer">Powered by Lumina HQ</footer>
    </main>

    <nav className="bottom-nav" aria-label="Main navigation">
      <div className={`nav-tabs${navDragging ? ' dragging' : ''}${tab === 'clips' ? ' clips-active' : ''}`}
        onPointerDown={event => { navPointerStart.current = event.clientX; navLastX.current = event.clientX; navDragActive.current = true; setNavDragging(false); setNavStretch(1); }}
        onPointerMove={event => { if (!navDragActive.current || navPointerStart.current === null) return; const totalDelta = event.clientX - navPointerStart.current; if (!navDragging && Math.abs(totalDelta) < 7) return; if (!navDragging) { setNavDragging(true); event.currentTarget.setPointerCapture(event.pointerId); } const rect = event.currentTarget.getBoundingClientRect(); const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left)); const next = Math.max(0, Math.min(4, Math.floor((x / rect.width) * 5))); const delta = navLastX.current === null ? 0 : event.clientX - navLastX.current; navLastX.current = event.clientX; setNavPosition(next); setNavStretch(Math.min(1.3, 1 + Math.abs(delta) * .014)); }}
        onPointerUp={event => { if (!navDragActive.current) return; const wasDragged = navDragging; navDragActive.current = false; navPointerStart.current = null; setNavDragging(false); navLastX.current = null; setNavStretch(1); if (wasDragged) { const rect = event.currentTarget.getBoundingClientRect(); const index = Math.max(0, Math.min(4, Math.floor(((event.clientX - rect.left) / rect.width) * 5))); const nextTab = (['home', 'matches', 'clips', 'team', 'crew'] as Tab[])[index]; setNavPosition(index); setTab(nextTab); setClipActionsOpen(false); } }}
        onPointerCancel={() => { navDragActive.current = false; navPointerStart.current = null; setNavDragging(false); navLastX.current = null; setNavStretch(1); setNavPosition(({ home: 0, matches: 1, clips: 2, team: 3, crew: 4 } as Record<string, number>)[tab] ?? 0); }}
        style={{ '--active-shift': (navPosition * 100) + '%', '--nav-stretch': navStretch } as CSSProperties}>
        <span className="nav-liquid-indicator" aria-hidden="true"/>
        <NavButton active={tab === 'home'} label="Home" icon={<Home size={20}/>} onClick={() => goTab('home', 0)}/>
        <NavButton active={tab === 'matches'} label="Matches" icon={<Swords size={20}/>} onClick={() => goTab('matches', 1)}/>
        <div className="nav-center-slot">
          <button type="button" className="nav-create-button" aria-label="Clips actions" aria-expanded={clipActionsOpen}
            onPointerDown={event => event.stopPropagation()}
            onClick={() => setClipActionsOpen(value => !value)}><Plus size={22} strokeWidth={2.6}/></button>
          <span className="nav-create-label">Clips</span>
          {clipActionsOpen && <div className="nav-clip-menu" role="menu" onPointerDown={event => event.stopPropagation()}>
            <button type="button" role="menuitem" onClick={() => { setTab('clips'); setNavPosition(2); setClipActionsOpen(false); }}><Play size={16}/><span><b>Browse clips</b><small>Watch community highlights</small></span></button>
            <button type="button" role="menuitem" onClick={() => { setTab('clips'); setNavPosition(2); setClipActionsOpen(false); setClipMessage(''); setClipSubmitOpen(true); }}><Plus size={16}/><span><b>Submit a clip</b><small>Add a new highlight</small></span></button>
          </div>}
        </div>
        <NavButton active={tab === 'team'} label="Team" icon={<Shield size={20}/>} onClick={() => goTab('team', 3)}/>
        <NavButton active={tab === 'crew'} label="Crew" icon={<Users size={20}/>} onClick={() => goTab('crew', 4)}/>
      </div>
    </nav>

    {backgroundPickerOpen && <div className="background-picker-backdrop" onClick={() => setBackgroundPickerOpen(false)}>
      <section className="background-picker" role="dialog" aria-modal="true" aria-labelledby="background-picker-title" onClick={event => event.stopPropagation()}>
        <div className="background-picker-head"><div><span>TEST BUILD ONLY</span><h2 id="background-picker-title">Choose a background</h2></div><button onClick={() => setBackgroundPickerOpen(false)} aria-label="Close background picker"><X size={19}/></button></div>
        <div className="background-picker-options">
          {backgroundOptions.map(option => <button key={option.id} className={selectedBackground === option.id ? "background-choice active" : "background-choice"} onClick={() => setSelectedBackground(option.id)}>
            <span className="background-choice-preview" style={option.src ? { backgroundImage: 'url(' + option.src + ')' } : undefined}>{!option.src && <ImageIcon size={22}/>}</span>
            <span>{option.name}</span>{selectedBackground === option.id && <b>✓</b>}
          </button>)}
        </div>
        <p>Changes apply instantly and stay selected on this test install.</p>
      </section>
    </div>}

    {appUpdate && <div className="sheet-backdrop center"><section className="update-card" role="dialog" aria-modal="true" aria-labelledby="app-update-title">
      <div className="update-icon"><RefreshCw size={20}/></div>
      <h2 id="app-update-title">New update available</h2>
      <p>Version {appUpdate.version} is ready. Update the app to get the latest fixes and features.</p>
      {appUpdate.notes && <div className="update-notes">{appUpdate.notes.slice(0, 280)}</div>}
      <div className="update-actions">
        <button className="btn ghost" onClick={() => setAppUpdate(null)}>Later</button>
        <button className="btn primary" onClick={() => window.open(appUpdate.url, '_system')}>Update now</button>
      </div>
    </section></div>}

    {selectedMatch && <MatchDetails match={selectedMatch} players={players} onClose={() => { setSelectedMatch(null); setCopied(false); }} copied={copied} onCopy={async () => { await navigator.clipboard?.writeText(matchCopyText(selectedMatch, players, tournaments, matches, selectedStage)); setCopied(true); setTimeout(() => setCopied(false), 1600); }}/>}
  </div>;
}

function Segmented({ value, onChange, label }: { value: Category; onChange: (value: Category) => void; label: string }) {
  return <div className="segmented" role="group" aria-label={label}>
    <button className={value === 'official' ? 'active' : ''} aria-pressed={value === 'official'} onClick={() => onChange('official')}>Official</button>
    <button className={value === 'scrim' ? 'active' : ''} aria-pressed={value === 'scrim'} onClick={() => onChange('scrim')}>Scrims</button>
  </div>;
}

function Portrait({ src, name, className, eager }: { src: string; name: string; className: string; eager: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  const showImage = !!src && !failed;
  return <div className={className + (showImage ? '' : ' empty')}>
    {showImage
      ? <img src={src} alt={name} loading={eager ? 'eager' : 'lazy'} decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)}/>
      : <span aria-hidden="true">{name.slice(0, 2).toUpperCase()}</span>}
  </div>;
}

function HomePerformanceGraphs({ matches, players }: { matches: Match[]; players: Player[] }) {
  const [selectedPlayerId, setSelectedPlayerId] = useState(players[0]?.id || '');
  useEffect(() => { if (!players.some(player => player.id === selectedPlayerId)) setSelectedPlayerId(players[0]?.id || ''); }, [players, selectedPlayerId]);
  const ordered = matches.slice().sort((a, b) => a.timestamp - b.timestamp).slice(-12);
  const teamValues = ordered.map(matchKills);
  const selectedPlayer = players.find(player => player.id === selectedPlayerId);
  const playerValues = ordered.map(match => (match.playerStats || []).filter(row => row.playerId === selectedPlayerId).reduce((sum, row) => sum + (Number(row.kills) || 0), 0));
  const total = teamValues.reduce((sum, value) => sum + value, 0);
  const playerTotal = playerValues.reduce((sum, value) => sum + value, 0);
  return <section className="graphs">
    <div className="section-head"><div><h2>Performance graphs</h2><p>Match-by-match output from the same saved results as the website.</p></div><span className="pill ghost">{ordered.length} matches</span></div>
    <article className="graph-card">
      <div className="graph-title"><div><span>Team performance</span><h3>Squad eliminations</h3></div><div className="graph-total"><strong>{total}</strong><small>total kills</small></div></div>
      <PerformanceLineChart matches={ordered} values={teamValues} chartId="team"/>
    </article>
    <article className="graph-card">
      <div className="graph-title"><div><span>Individual performance</span><h3>{selectedPlayer?.name || 'Player kills'}</h3></div><div className="graph-total"><strong>{playerTotal}</strong><small>total kills</small></div></div>
      <label className="select-field"><span>Player</span>
        <select value={selectedPlayerId} onChange={event => setSelectedPlayerId(event.target.value)} disabled={!players.length}>
          <option value="">Select player</option>{players.map(player => <option key={player.id} value={player.id}>{player.name}</option>)}
        </select>
      </label>
      <PerformanceLineChart matches={ordered} values={playerValues} chartId="player"/>
    </article>
    {!ordered.length && <EmptyState text="Match-by-match graphs will appear as results are added."/>}
  </section>;
}

const CHART_W = 360;
const CHART_H = 172;
const CHART_PAD_L = 28;
const CHART_PAD_R = 14;
const CHART_TOP = 14;
const CHART_BASE = 138;

function PerformanceLineChart({ matches, values, chartId }: { matches: Match[]; values: number[]; chartId: string }) {
  const [picked, setPicked] = useState<number | null>(null);
  if (!values.length) return <EmptyState text="No match results available for this graph yet."/>;
  const max = Math.max(1, ...values);
  const span = CHART_W - CHART_PAD_L - CHART_PAD_R;
  const step = values.length > 1 ? span / (values.length - 1) : 0;
  const points = values.map((value, index) => ({
    x: values.length > 1 ? CHART_PAD_L + index * step : CHART_PAD_L + span / 2,
    y: CHART_BASE - (value / max) * (CHART_BASE - CHART_TOP)
  }));
  const active = Math.min(picked ?? values.length - 1, values.length - 1);
  const path = points.map((point, index) => (index ? 'L' : 'M') + ' ' + point.x.toFixed(1) + ' ' + point.y.toFixed(1)).join(' ');
  const area = path + ' L ' + points[points.length - 1].x.toFixed(1) + ' ' + CHART_BASE + ' L ' + points[0].x.toFixed(1) + ' ' + CHART_BASE + ' Z';
  const gradientId = 'graphArea-' + chartId;
  const labelEvery = values.length > 8 ? 2 : 1;
  const pick = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    const x = ((event.clientX - rect.left) / rect.width) * CHART_W;
    const index = step ? Math.round((x - CHART_PAD_L) / step) : 0;
    setPicked(Math.max(0, Math.min(values.length - 1, index)));
  };
  const activeMatch = matches[active];
  return <div className="chart">
    <div className="chart-readout" aria-live="polite">
      <strong>{values[active]}</strong><span>kills in M{activeMatch?.matchNumber}</span>
    </div>
    <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} role="img" aria-label={chartId === 'team' ? 'Team kills per match' : 'Selected player kills per match'} onPointerDown={pick} onPointerMove={event => { if (event.buttons || event.pointerType === 'touch') pick(event); }}>
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" className="area-top"/><stop offset="100%" className="area-bottom"/></linearGradient>
      </defs>
      {[0, 0.5, 1].map(level => {
        const y = CHART_BASE - level * (CHART_BASE - CHART_TOP);
        return <g key={level}><line className="grid-line" x1={CHART_PAD_L} x2={CHART_W - CHART_PAD_R} y1={y} y2={y}/><text className="axis-text" x={CHART_PAD_L - 8} y={y + 3.5} textAnchor="end">{Math.round(max * level)}</text></g>;
      })}
      <path className="chart-area" d={area} fill={'url(#' + gradientId + ')'} key={'a' + chartId + values.join('-')}/>
      <line className="guide" x1={points[active].x} x2={points[active].x} y1={CHART_TOP - 4} y2={CHART_BASE}/>
      <path className="chart-line" d={path} pathLength={1} key={'l' + chartId + values.join('-')}/>
      {points.map((point, index) => index !== active && <circle className="dot" key={matches[index].id} cx={point.x} cy={point.y} r="3.2"/>)}
      <circle className="dot-active-halo" cx={points[active].x} cy={points[active].y} r="10"/>
      <circle className="dot-active" cx={points[active].x} cy={points[active].y} r="5.5"/>
      {points.map((point, index) => (index % labelEvery === 0 || index === active) && <text key={'x' + matches[index].id} className={'axis-text x' + (index === active ? ' on' : '')} x={point.x} y={CHART_BASE + 22} textAnchor="middle">M{matches[index].matchNumber}</text>)}
    </svg>
  </div>;
}

function ClipMedia({ clip }: { clip: Clip }) {
  const imageUrl = clipImageUrl(clip);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [imageUrl]);
  if (!imageUrl || failed) return <div className="clip-fallback"><span>{clip.platform}</span></div>;
  return <img src={imageUrl} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)}/>;
}

function SocialIcon({ type }: { type: 'youtube' | 'instagram' }) {
  if (type === 'youtube') return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="6" width="18" height="12" rx="4" fill="currentColor"/><path d="m10 9 5 3-5 3V9Z" className="icon-cutout" stroke="none"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none"/><circle cx="12" cy="12" r="4" fill="none"/><circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" stroke="none"/></svg>;
}

function NavButton({ active, label, icon, onClick }: { active: boolean; label: string; icon: ReactNode; onClick: () => void }) {
  return <button className={active ? 'nav-item active' : 'nav-item'} aria-current={active ? 'page' : undefined} onClick={onClick}>{icon}<span>{label}</span></button>;
}

function PageHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return <section className="page-heading"><h1>{title}</h1><p>{subtitle}</p></section>;
}

function StagePicker({ stages, selected, onSelect }: { stages: Stage[]; selected: string; onSelect: (value: string) => void }) {
  if (!stages.length) return null;
  return <section className="stage-picker" aria-label="Week or phase">
    <div className="stage-scroll">
      <button className={selected === 'overall' ? 'stage active' : 'stage'} onClick={() => onSelect('overall')}>Overall</button>
      {stages.map(stage => <button key={stage.id} className={selected === stage.id ? 'stage active' : 'stage'} onClick={() => onSelect(stage.id)}>{stage.name}</button>)}
    </div>
  </section>;
}

function TournamentHistoryList({ tournaments, matches, onSelect }: { tournaments: Tournament[]; matches: Match[]; onSelect: (id: string) => void }) {
  if (!tournaments.length) return <section className="tournament-list"><EmptyState text="No tournaments in this category yet."/></section>;
  return <section className="tournament-list">
    <div className="section-head slim"><h2>Tournament archive</h2><span className="pill ghost">{tournaments.length} tournaments</span></div>
    {tournaments.slice().sort((a, b) => Number(b.active) - Number(a.active)).map(tournament => {
      const rows = matches.filter(match => match.tournamentId === tournament.id);
      const points = rows.reduce((sum, match) => sum + (Number(match.totalPoints) || 0), 0);
      const latest = rows.reduce((value, match) => Math.max(value, Number(match.timestamp) || 0), 0);
      const positions = rows.map(match => Number(match.position) || 0).filter(position => position > 0);
      const best = positions.length ? Math.min(...positions) : 0;
      return <button type="button" className={'tournament-card' + (tournament.active ? ' current' : '')} key={tournament.id} onClick={() => onSelect(tournament.id)}>
        <div className="tournament-top">
          <span className="tournament-mark"><Trophy size={20}/></span>
          <span className="tournament-copy"><strong>{tournament.name}</strong><small>{tournament.active ? 'Current tournament' : statusLabel(tournament.status)}{latest ? ' · ' + relativeTime(latest) : ''}</small></span>
          <ChevronRight className="tournament-arrow" size={18}/>
        </div>
        <div className="tournament-figs">
          <div><b>{rows.length}</b><small>Matches</small></div>
          <div><b>{points}</b><small>Points</small></div>
          <div><b>{best ? '#' + best : '—'}</b><small>Best place</small></div>
        </div>
      </button>;
    })}
  </section>;
}

function MatchCard({ match, onView }: { match: Match; onView: (match: Match) => void }) {
  const tone = match.position === 1 ? 'first' : match.position > 0 && match.position <= 3 ? 'podium' : 'rest';
  return <button type="button" className="match-card" onClick={() => void onView(match)} aria-label={`Open match ${match.matchNumber} details`}>
    <div className={'match-place ' + tone}><small>Place</small><b>#{match.position}</b></div>
    <div className="match-main"><strong>{match.mapName || 'Free Fire MAX'}</strong><span>M{match.matchNumber} · {relativeTime(match.timestamp)}</span></div>
    <div className="match-figs"><div><b>{matchKills(match)}</b><small>Kills</small></div><div><b>{match.totalPoints}</b><small>Points</small></div></div>
    <ChevronRight className="match-arrow" size={18}/>
  </button>;
}

function MatchList({ matches, onView }: { matches: Match[]; onView: (match: Match) => void }) {
  return <section className="panel">
    <div className="panel-head"><div><span>Recent results</span><h2>{matches.length} {matches.length === 1 ? 'match' : 'matches'}</h2></div><Swords size={20} className="panel-icon"/></div>
    <div className="match-list">
      {matches.length === 0 && <EmptyState text="No match results for this stage yet."/>}
      {matches.map(match => <MatchCard key={match.id} match={match} onView={onView}/>)}
    </div>
  </section>;
}

function placementPoints(position: number) { const rankPoints: Record<number, number> = { 1: 12, 2: 9, 3: 8, 4: 7, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1 }; return rankPoints[position] || 0; }

function matchCopyText(match: Match, players: Player[], tournaments: Tournament[], allMatches: Match[], selectedStage: string) {
  const tournament = tournaments.find(t => t.id === match.tournamentId);
  const category = match.category || tournament?.category || 'official';
  const stageMatches = allMatches
    .filter(m => (m.category || 'official') === category)
    .filter(m => m.tournamentId === match.tournamentId)
    .filter(m => selectedStage === 'overall' || selectedStage === 'all' || m.weekId === selectedStage);
  const overallPoints = stageMatches.reduce((sum, m) => sum + (Number(m.totalPoints) || 0), 0);
  const playerLines = (match.playerStats || []).map(s => { const player = players.find(p => p.id === s.playerId); return (player?.name || 'Unknown player') + ': ' + s.kills; }).join('\n');
  return [tournament?.name || (category === 'scrim' ? '9 pm scrims' : 'OG ELITE'), '', 'Match ' + match.matchNumber, (match.mapName || 'Free Fire MAX').toUpperCase(), ' ', playerLines || 'No player stats recorded.', '', 'Rank: #' + match.position + ' (' + placementPoints(match.position) + ' PTS)', 'Total: ' + match.totalPoints + ' PTS', 'Overall: ' + overallPoints + ' PTS'].join('\n');
}

function MatchDetails({ match, players, onClose, copied, onCopy }: { match: Match; players: Player[]; onClose: () => void; copied: boolean; onCopy: () => void }) {
  const rows = (match.playerStats || []);
  const maxKills = Math.max(1, ...rows.map(row => Number(row.kills) || 0));
  return <div className="sheet-backdrop" onClick={onClose}>
    <section className="sheet match-sheet" role="dialog" aria-modal="true" aria-label={`Match ${match.matchNumber} details`} onClick={e => e.stopPropagation()}>
      <div className="sheet-grip" aria-hidden="true"/>
      <button className="sheet-close" onClick={onClose} aria-label="Close match details"><X size={18}/></button>
      <p className="sheet-kicker">Match M{match.matchNumber}</p>
      <h2>{match.mapName || 'Battle Royale'}</h2>
      <div className="detail-grid">
        <div className="lead"><b>#{match.position}</b><small>Position</small></div>
        <div><b>{match.totalPoints}</b><small>Points</small></div>
        <div><b>{matchKills(match)}</b><small>Kills</small></div>
        <div><b>{match.category === 'scrim' ? 'Scrim' : 'Official'}</b><small>Type</small></div>
      </div>
      <div className="sheet-players">
        {rows.map(p => { const player = players.find(x => x.id === p.playerId); const kills = Number(p.kills) || 0; return <div className="sheet-player" key={p.playerId}>
          <span>{player?.name || 'Unknown player'}</span>
          <div className="sheet-track"><i style={{ width: Math.max(kills > 0 ? 4 : 0, (kills / maxKills) * 100) + '%' }}/></div>
          <b>{p.kills} kills</b>
        </div>; })}
      </div>
      <button className="btn primary block" onClick={onCopy}>{copied ? <Check size={16}/> : <Copy size={16}/>} {copied ? 'Copied' : 'Copy match data'}</button>
    </section>
  </div>;
}

function EmptyState({ text }: { text: string }) { return <div className="empty">{text}</div>; }

function ClipsPanel({ clips, onWatchClip, clipSubmitOpen, setClipSubmitOpen, clipBusy, setClipBusy, clipMessage, setClipMessage, clipForm, setClipForm, setClips }: { clips: Clip[]; onWatchClip: (url: string) => void; clipSubmitOpen: boolean; setClipSubmitOpen: (v: boolean) => void; clipBusy: boolean; setClipBusy: (v: boolean) => void; clipMessage: string; setClipMessage: (v: string) => void; clipForm: ClipForm; setClipForm: (v: ClipForm) => void; setClips: (v: Clip[]) => void }) {
  return <>
    <section className="page-heading with-action">
      <div><h1>Clips</h1><p>Best plays, clutch moments and highlights from the OG ELITE community.</p></div>
      <button className="btn primary" onClick={() => { setClipSubmitOpen(true); setClipMessage(''); }}><Plus size={16}/>Submit a clip</button>
    </section>
    <section className="clip-grid">
      {clips.length === 0
        ? <div className="feature-empty"><b>No clips yet</b><span>Be the first fan to submit a highlight.</span><button className="btn primary" onClick={() => setClipSubmitOpen(true)}>Submit your clip</button></div>
        : clips.map(clip => <article className={'clip-card' + (clip.featured ? ' featured' : '')} key={clip.id}>
          <a className="clip-media" href={clip.url} onClick={e => { e.preventDefault(); onWatchClip(clip.url); }} aria-label={'Watch ' + clip.title}>
            <ClipMedia clip={clip}/>
            <i aria-hidden="true"><Play size={20} fill="currentColor"/></i>
          </a>
          <div className="clip-info">
            {clip.featured && <em className="pill ghost">Featured</em>}
            <h2>{clip.title}</h2>
            <p>{clip.creatorName || clip.submittedBy}</p>
            <a className="text-action" href={clip.url} onClick={e => { e.preventDefault(); onWatchClip(clip.url); }}>Watch clip<ChevronRight size={15}/></a>
          </div>
        </article>)}
    </section>
    {clipSubmitOpen && <div className="clip-submit-modal" onClick={() => setClipSubmitOpen(false)}>
      <form role="dialog" aria-modal="true" aria-labelledby="clip-submit-title" onSubmit={async e => {
        e.preventDefault(); setClipBusy(true); setClipMessage('');
        try {
          const r = await fetch((import.meta.env.VITE_API_URL || '').replace(/\/$/, '') + '/api/clips', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(clipForm) });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error || 'Could not submit clip.');
          setClipMessage('Submitted! Your clip is now waiting for OG ELITE moderation.');
          setClipForm({ url: '', title: '', submittedBy: '', creatorName: '' });
          setClips(await api.clips());
        } catch (e) { setClipMessage(e instanceof Error ? e.message : 'Could not submit clip.'); }
        finally { setClipBusy(false); }
      }} onClick={e => e.stopPropagation()}>
        <button type="button" className="clip-modal-close" aria-label="Close clip submission" onClick={() => setClipSubmitOpen(false)}><X size={18}/></button>
        <div className="clip-submit-head"><div className="clip-submit-icon"><Play size={18}/></div><div><span>OG ELITE / COMMUNITY</span><h2 id="clip-submit-title">Submit a clip</h2></div></div>
        <p className="clip-submit-subtitle">Share your best moment with the OG ELITE community. Every submission is reviewed before it goes live.</p>
        <label><span>CLIP URL</span><input required type="url" value={clipForm.url} onChange={e => setClipForm({ ...clipForm, url: e.target.value })} placeholder="https://youtube.com/..."/></label>
        <label><span>CLIP TITLE</span><input value={clipForm.title} onChange={e => setClipForm({ ...clipForm, title: e.target.value })} placeholder="Insane final circle clutch"/></label>
        <label><span>YOUR NAME / USERNAME</span><input value={clipForm.submittedBy} onChange={e => setClipForm({ ...clipForm, submittedBy: e.target.value })} placeholder="Your name"/></label>
        <label><span>PLAYER / CREATOR <em>OPTIONAL</em></span><input value={clipForm.creatorName} onChange={e => setClipForm({ ...clipForm, creatorName: e.target.value })} placeholder="Player name"/></label>
        {clipMessage && <div className="clip-message" role="status">{clipMessage}</div>}
        <button className="clip-submit-button" disabled={clipBusy}>{clipBusy ? 'SUBMITTING...' : 'SUBMIT FOR REVIEW'}</button>
      </form>
    </div>}
  </>;
}
