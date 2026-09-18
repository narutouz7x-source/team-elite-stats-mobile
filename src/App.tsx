import { useEffect, useMemo, useState } from 'react';
import { Bell, ChevronRight, Copy, ExternalLink, Flame, Home, Play, RefreshCw, Shield, Swords, Trophy, Users, X } from 'lucide-react';
import { api } from './api';
import type { Clip, Creator, Match, Notification, Player, PlayerStat, Settings, Stage, Tournament } from './types';
import ogEliteLogo from '../assets/og-elite-icon.png';
import { initializeNativeNotifications } from './nativeNotifications';
import packageJson from '../package.json';

type Tab = 'home' | 'matches' | 'team' | 'clips' | 'crew' | 'alerts';

type AppUpdate = { version: string; url: string; notes?: string };

const mediaUrl = (value?: string) => {
  if (!value) return '';
  const raw = value.trim();
  if (!raw) return '';
  if (raw.startsWith('//')) return 'https:' + raw;
  if (raw.startsWith('/')) return ((import.meta.env.VITE_API_URL || '').replace(/\/$/, '')) + raw;
  if (raw.startsWith('http://')) return 'https://' + raw.slice(7);
  return raw;
};

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
  const [playerStats, setPlayerStats] = useState<Record<string, PlayerStat>>({});
  const [clips, setClips] = useState<Clip[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [copied, setCopied] = useState(false);
  const [clipSubmitOpen, setClipSubmitOpen] = useState(false);
  const [clipBusy, setClipBusy] = useState(false);
  const [clipMessage, setClipMessage] = useState('');
  const [clipForm, setClipForm] = useState({ url: '', title: '', submittedBy: '', creatorName: '' });
  const [selectedStage, setSelectedStage] = useState<string>('overall');
  const [selectedCategory, setSelectedCategory] = useState<'official' | 'scrim'>('official');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [appUpdate, setAppUpdate] = useState<AppUpdate | null>(null);

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

  useEffect(() => { setSelectedStage('all'); if (!activeTournament) { setStages([]); return; } api.stages(activeTournament.id).then(setStages).catch(() => setStages([])); }, [activeTournament?.id]);
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
  const totalKills = visibleMatches.reduce((sum,m) => sum + (m.playerStats || []).reduce((n,p) => n + (Number(p.kills)||0),0),0);
  const totalPoints = visibleMatches.reduce((sum,m) => sum + (Number(m.totalPoints)||0),0);

  return <div className="app-shell">
    <header className="topbar"><div className="brand"><div className="brand-mark"><img src={ogEliteLogo} alt="OG ELITE" /></div><div><strong>{settings?.teamName || 'OG ELITE'}</strong><span>{settings?.game || 'Free Fire MAX'}</span></div></div><button className="icon-button" onClick={() => setTab('alerts')} aria-label="Notifications"><Bell size={20}/>{notifications.length > 0 && <i/>}</button></header>
    <main>
      {tab === 'home' && <>
        <section className="mobile-overview-hero">
          <div><span>OG ELITE / LIVE PERFORMANCE CENTER</span><h1>{activeTournament?.name || 'NO ACTIVE TOURNAMENT'}</h1><p>{selectedCategory === 'scrim' ? 'Recent scrim performance, synced from the OG ELITE ledger.' : 'Official competitive performance, synced from the OG ELITE ledger.'}</p></div>
          <div className="mobile-overview-mode"><button className={selectedCategory==='scrim'?'active':''} onClick={()=>setSelectedCategory('scrim')}>SCRIMS</button><button className={selectedCategory==='official'?'active':''} onClick={()=>setSelectedCategory('official')}>OFFICIAL</button></div>
        </section>
        {selectedCategory === 'official' && activeTournament && <StagePicker stages={stages} selected={selectedStage} onSelect={setSelectedStage}/>}
        <section className="mobile-overview-stats">
          <article><small>TEAM POINTS</small><strong>{totalPoints}</strong><span>{selectedStageName || 'LIVE RESULTS'}</span></article>
          <article><small>ELIMINATIONS</small><strong>{totalKills}</strong><span>PLAYER TOTAL</span></article>
          <article><small>MATCHES PLAYED</small><strong>{visibleMatches.length}</strong><span>{selectedStageName || 'RECORDED MATCHES'}</span></article>
          <article className="accent"><small>ROSTER</small><strong>{players.length}</strong><span>ACTIVE PLAYERS</span></article>
        </section>
        <section className="mobile-overview-content">
          <div className="mobile-overview-panel mobile-overview-results">
            <div className="mobile-overview-panel-head"><div><span>LATEST RESULTS</span><h2>{selectedStageName ? selectedStageName + ' performance' : selectedCategory === 'official' ? 'Official match performance' : 'Recent scrim performance'}</h2></div><button onClick={()=>setTab('matches')}>VIEW HISTORY →</button></div>
            <div className="mobile-overview-match-list">
              {visibleMatches.length === 0 ? <EmptyState text="No match results for this stage yet."/> : visibleMatches.slice(0,8).map(match => <article className="mobile-overview-match" key={match.id} onClick={()=>setSelectedMatch(match)}>
                <div className="overview-match-no">M{match.matchNumber}</div><div className="overview-match-info"><strong>{match.mapName || 'Free Fire MAX'}</strong><span>{activeTournament?.name || 'TOURNAMENT'} • {match.category || selectedCategory}</span></div>
                <div className="overview-match-stat"><small>PLACE</small><b>#{match.position}</b></div><div className="overview-match-stat"><small>KILLS</small><b>{(match.playerStats || []).reduce((n,p)=>n+(Number(p.kills)||0),0)}</b></div><div className="overview-match-stat"><small>POINTS</small><b>{match.totalPoints}</b></div><span className="overview-match-view">VIEW</span>
              </article>)}
            </div>
          </div>
          <div className="mobile-overview-panel">
            <div className="mobile-overview-panel-head"><div><span>TABLE</span><h2>Squad output</h2></div><button onClick={()=>setTab('team')}>FULL ROSTER →</button></div>
            <div className="mobile-overview-bars">{players.map((player,index)=>{
              const rows=visibleMatches.flatMap(match=>(match.playerStats || []).filter(stat=>stat.playerId===player.id));
              const kills=rows.reduce((n,stat)=>n+(Number(stat.kills)||0),0);
              const width=Math.min(100,kills*4);
              return <div className="overview-bar-row" key={player.id}><div><span>{String(index+1).padStart(2,'0')}</span><strong>{player.name}</strong></div><div className="overview-bar-track"><i style={{width: width + '%'}}/></div><b>{kills}</b></div>;
            })}{players.length===0&&<EmptyState text="No roster data available yet."/>}</div>
          </div>
        </section>
      </>}

      {tab === 'matches' && <><PageHeading title="Match History" subtitle="Every recorded result, synced from the OG ELITE ledger."/><div className="stats-mode-switch matches-mode-switch"><button className={selectedCategory==='official'?'active':''} onClick={()=>setSelectedCategory('official')}>OFFICIAL</button><button className={selectedCategory==='scrim'?'active':''} onClick={()=>setSelectedCategory('scrim')}>SCRIMS</button></div><StagePicker stages={stages} selected={selectedStage} onSelect={setSelectedStage}/><MatchList matches={visibleMatches} onView={setSelectedMatch}/></>}

      {tab === 'team' && <><section className="mobile-players-intro"><div><span className="mobile-section-kicker">OG ELITE / FREE FIRE MAX</span><h1>Meet the <em>squad.</em></h1><p>Player profiles, roles and live competitive output managed from the OG ELITE control center.</p></div><div className="mobile-roster-count"><strong>{String(players.length).padStart(2,'0')}</strong><span>ACTIVE<br/>PLAYERS</span></div></section><div className="mobile-player-grid">{players.map((player,index)=>{const stat=playerStats[player.id];const kills=stat?.kills??0;const played=stat?.played??0;const avg=played?(kills/played).toFixed(2):'0.00';return <article className="mobile-public-player" key={player.id}><div className="mobile-public-player-image" style={player.imageUrl?{backgroundImage:'url('+player.imageUrl+')'}:undefined}><div className="mobile-public-player-identity"><strong>{player.name}</strong><small>{player.role}</small></div>{!player.imageUrl&&<span>{player.name.slice(0,2)}</span>}<b>#{String(index+1).padStart(2,'0')}</b><i>ACTIVE</i></div><div className="mobile-public-player-stats"><div><strong>{kills}</strong><span>KILLS</span></div><div><strong>{played}</strong><span>MATCHES</span></div><div><strong>{avg}</strong><span>AVG</span></div></div></article>})}</div>{players.length===0&&<div className="empty">No player records available yet.</div>}</>}

      {tab === 'clips' && <><section className="mobile-content-hero"><div><span>OG ELITE / COMMUNITY</span><h1>CLIPS</h1><p>Best plays, clutch moments and highlights from the OG ELITE community.</p></div><button className="clip-submit-button" onClick={()=>{setClipSubmitOpen(true);setClipMessage('')}}>+ SUBMIT A CLIP</button></section><section className="mobile-clips-grid">{clips.length===0?<div className="mobile-empty-feature"><b>NO CLIPS YET</b><span>Be the first fan to submit a highlight.</span><button onClick={()=>setClipSubmitOpen(true)}>SUBMIT YOUR CLIP</button></div>:clips.map(clip=><article className={'mobile-full-clip '+(clip.featured?'featured':'')} key={clip.id}><div className="mobile-clip-media"><span>{clip.platform}</span><b>▶</b></div><div className="mobile-clip-info">{clip.featured&&<small>FEATURED</small>}<h2>{clip.title}</h2><p>{clip.creatorName||clip.submittedBy}</p><a href={clip.url} target="_blank" rel="noreferrer">WATCH CLIP ↗</a></div></article>)}</section>{clipSubmitOpen&&<div className="clip-submit-modal" onClick={()=>setClipSubmitOpen(false)}><form onSubmit={async e=>{e.preventDefault();setClipBusy(true);setClipMessage('');try{const r=await fetch((import.meta.env.VITE_API_URL||'').replace(/\/$/,'')+'/api/clips',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(clipForm)});const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not submit clip.');setClipMessage('Submitted! Your clip is now waiting for OG ELITE moderation.');setClipForm({url:'',title:'',submittedBy:'',creatorName:''});setClips(await api.clips());}catch(e){setClipMessage(e instanceof Error?e.message:'Could not submit clip.')}finally{setClipBusy(false)}}} onClick={e=>e.stopPropagation()}><button type="button" className="clip-modal-close" onClick={()=>setClipSubmitOpen(false)}>×</button><span>COMMUNITY SUBMISSION</span><h2>Submit a clip</h2><p>Every submission is reviewed before it appears publicly.</p><label>CLIP URL<input required type="url" value={clipForm.url} onChange={e=>setClipForm({...clipForm,url:e.target.value})} placeholder="https://youtube.com/..."/></label><label>CLIP TITLE<input value={clipForm.title} onChange={e=>setClipForm({...clipForm,title:e.target.value})} placeholder="INSANE FINAL CIRCLE CLUTCH"/></label><label>YOUR NAME / USERNAME<input value={clipForm.submittedBy} onChange={e=>setClipForm({...clipForm,submittedBy:e.target.value})} placeholder="Your name"/></label><label>PLAYER / CREATOR (OPTIONAL)<input value={clipForm.creatorName} onChange={e=>setClipForm({...clipForm,creatorName:e.target.value})} placeholder="Player name"/></label>{clipMessage&&<div className="clip-message">{clipMessage}</div>}<button className="clip-submit-button" disabled={clipBusy}>{clipBusy?'SUBMITTING...':'SUBMIT FOR REVIEW'}</button></form></div>}</>}

      {tab === 'crew' && <><section className="mobile-content-hero"><div><span>OG ELITE / COMMUNITY</span><h1>OUR CREW</h1><p>Meet the creators and personalities building the OG ELITE community.</p></div></section><section className="mobile-creator-grid">{creators.length?creators.map(creator=><article className="mobile-creator-card" key={creator.id}><div className="mobile-creator-image">{creator.imageUrl?<img src={mediaUrl(creator.imageUrl)} alt={creator.name} loading="eager" decoding="async" referrerPolicy="no-referrer" onError={e=>{e.currentTarget.style.display='none'}}/>:<div className="mobile-creator-fallback">{creator.name.slice(0,2).toUpperCase()}</div>}<div className="mobile-creator-name"><h2>{creator.name}</h2>{creator.handle&&<span>{creator.handle}</span>}</div>{creator.featured&&<small>FEATURED</small>}</div><div className="mobile-creator-body"><p>{creator.bio||'OG ELITE community creator.'}</p><div className="mobile-creator-links">{creator.youtube&&<a className="creator-social" href={creator.youtube} target="_blank" rel="noreferrer" aria-label={"Open "+creator.name+"'s YouTube"}><SocialIcon type="youtube"/><span>YOUTUBE</span></a>}{creator.instagram&&<a className="creator-social" href={creator.instagram} target="_blank" rel="noreferrer" aria-label={"Open "+creator.name+"'s Instagram"}><SocialIcon type="instagram"/><span>INSTAGRAM</span></a>}{creator.discord&&<a href={creator.discord} target="_blank" rel="noreferrer" aria-label={"Open "+creator.name+"'s Discord"}>DISCORD ↗</a>}</div></div></article>):<div className="mobile-empty-feature"><b>CREATORS WILL APPEAR HERE</b></div>}</section></>}

      {tab === 'alerts' && <><PageHeading title="Notifications" subtitle="Match updates, content drops and admin announcements."/><div className="notification-list">{notifications.length===0&&<EmptyState text="No notifications yet."/>}{notifications.map(item=><article className="notification" key={item.id}><div className="notification-icon"><Bell size={17}/></div><div><strong>{item.title}</strong><p>{item.message||item.type}</p><time>{relativeTime(item.createdAt)}</time></div></article>)}</div></>}
      {error&&<div className="error-banner">{error}</div>}{loading&&<div className="loading">Syncing live data…</div>}
    </main>
    <nav className="bottom-nav"><NavButton active={tab==='home'} label="Home" icon={<Home size={20}/>} onClick={()=>setTab('home')}/><NavButton active={tab==='matches'} label="Matches" icon={<Swords size={20}/>} onClick={()=>setTab('matches')}/><NavButton active={tab==='team'} label="Team" icon={<Users size={20}/>} onClick={()=>setTab('team')}/><NavButton active={tab==='clips'} label="Clips" icon={<Play size={20}/>} onClick={()=>setTab('clips')}/><NavButton active={tab==='crew'} label="Crew" icon={<Users size={20}/>} onClick={()=>setTab('crew')}/><button className="refresh" onClick={()=>void load()} aria-label="Refresh"><RefreshCw size={18}/></button></nav>
    {appUpdate && <div className="app-update-backdrop">
      <section className="app-update-card" role="dialog" aria-modal="true" aria-labelledby="app-update-title">
        <div className="app-update-icon"><RefreshCw size={20}/></div>
        <span>OG ELITE STATS • UPDATE</span>
        <h2 id="app-update-title">New update available</h2>
        <p>Version {appUpdate.version} is ready. Update the app to get the latest fixes and features.</p>
        {appUpdate.notes && <div className="app-update-notes">{appUpdate.notes.slice(0, 280)}</div>}
        <div className="app-update-actions">
          <button className="app-update-later" onClick={() => setAppUpdate(null)}>LATER</button>
          <button className="app-update-now" onClick={() => window.open(appUpdate.url, '_system')}>UPDATE NOW ↗</button>
        </div>
      </section>
    </div>}
    <footer>Powered by Lumina HQ</footer>
    {selectedMatch&&<MatchDetails match={selectedMatch} players={players} onClose={()=>{setSelectedMatch(null);setCopied(false)}} copied={copied} onCopy={async()=>{await navigator.clipboard?.writeText(matchCopyText(selectedMatch,players,tournaments,matches,selectedStage));setCopied(true);setTimeout(()=>setCopied(false),1600)}}/>}
  </div>;
}

function SocialIcon({type}:{type:'youtube'|'instagram'}){if(type==='youtube')return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="6" width="18" height="12" rx="4" fill="currentColor"/><path d="m10 9 5 3-5 3V9Z" fill="#0a0d0b" stroke="none"/></svg>;return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none"/><circle cx="12" cy="12" r="4" fill="none"/><circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" stroke="none"/></svg>}
function NavButton({active,label,icon,onClick}:{active:boolean;label:string;icon:React.ReactNode;onClick:()=>void}){return <button className={active?'nav-item active':'nav-item'} onClick={onClick}>{icon}<span>{label}</span></button>}
function PageHeading({title,subtitle}:{title:string;subtitle:string}){return <section className="page-heading"><span>OG ELITE</span><h1>{title}</h1><p>{subtitle}</p></section>}
function StagePicker({stages,selected,onSelect}:{stages:Stage[];selected:string;onSelect:(value:string)=>void}){if(!stages.length)return null;return <section className="mobile-overview-stages"><span>WEEK / PHASE</span><div className="stage-scroll"><button className={selected==='overall'?'stage active':'stage'} onClick={()=>onSelect('overall')}>OVERALL</button>{stages.map(stage=><button key={stage.id} className={selected===stage.id?'stage active':'stage'} onClick={()=>onSelect(stage.id)}>{stage.name}</button>)}</div></section>}
function MatchList({matches,onView}:{matches:Match[];onView:(match:Match)=>void}){return <section className="section"><div className="section-title"><span>Recent results</span><Swords size={18}/></div><div className="match-list">{matches.length===0&&<EmptyState text="No match results for this stage yet."/>}{matches.map(match=><article className="match-card" key={match.id}><div className="match-number">M{match.matchNumber}</div><div className="match-info"><strong>{match.mapName||'Battle Royale'}</strong><span>{match.category==='scrim'?'SCRIM':'OFFICIAL'} · {relativeTime(match.timestamp)}</span></div><div className="match-result"><strong>#{match.position}</strong><span>{match.totalPoints} pts</span></div><button className="match-view" onClick={()=>onView(match)}><ExternalLink size={12}/> View</button></article>)}</div></section>}
function placementPoints(position:number){const rankPoints:Record<number,number>={1:12,2:9,3:8,4:7,5:6,6:5,7:4,8:3,9:2,10:1};return rankPoints[position]||0}
function matchCopyText(match:Match,players:Player[],tournaments:Tournament[],allMatches:Match[],selectedStage:string){const tournament=tournaments.find(t=>t.id===match.tournamentId);const category=match.category||tournament?.category||'official';const stageMatches=allMatches.filter(m=>(m.category||'official')===category).filter(m=>m.tournamentId===match.tournamentId).filter(m=>selectedStage==='all'||m.weekId===selectedStage);const overallPoints=stageMatches.reduce((sum,m)=>sum+(Number(m.totalPoints)||0),0);const playerLines=(match.playerStats||[]).map(s=>{const player=players.find(p=>p.id===s.playerId);return(player?.name||'Unknown player')+': '+s.kills}).join('\n');return[tournament?.name||(category==='scrim'?'9 pm scrims':'OG ELITE'),'','Match '+match.matchNumber,(match.mapName||'Free Fire MAX').toUpperCase(),' ',playerLines||'No player stats recorded.','','Rank: #'+match.position+' ('+placementPoints(match.position)+' PTS)','Total: '+match.totalPoints+' PTS','Overall: '+overallPoints+' PTS'].join('\n')}
function MatchDetails({match,players,onClose,copied,onCopy}:{match:Match;players:Player[];onClose:()=>void;copied:boolean;onCopy:()=>void}){return <div className="modal-backdrop" onClick={onClose}><section className="match-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={onClose}><X size={18}/></button><span className="modal-kicker">OG ELITE • MATCH M{match.matchNumber}</span><h2>{match.mapName||'Battle Royale'}</h2><div className="detail-grid"><div><b>#{match.position}</b><small>POSITION</small></div><div><b>{match.totalPoints}</b><small>POINTS</small></div><div><b>{(match.playerStats||[]).reduce((n,p)=>n+(Number(p.kills)||0),0)}</b><small>KILLS</small></div><div><b>{match.category==='scrim'?'SCRIM':'OFFICIAL'}</b><small>TYPE</small></div></div><div className="modal-player-list">{(match.playerStats||[]).map(p=>{const player=players.find(x=>x.id===p.playerId);return <div key={p.playerId}><span>{player?.name||'Unknown player'}</span><b>{p.kills} kills</b></div>})}</div><button className="copy-match" onClick={onCopy}><Copy size={15}/> {copied?'Copied!':'Copy match data'}</button></section></div>}
function ClipSection({clips}:{clips:Clip[]}){if(!clips.length)return null;return <section className="section"><div className="section-title"><span>Clips</span><Play size={18}/></div><div className="clip-grid">{clips.map(clip=><a className="clip-card" key={clip.id} href={clip.url} target="_blank" rel="noreferrer"><div className="clip-icon"><Play size={17}/></div><div><strong>{clip.title}</strong><span>{clip.platform}{clip.creatorName?' • '+clip.creatorName:''}</span></div><ExternalLink size={14}/></a>)}</div></section>}
function CrewSection({creators}:{creators:Creator[]}){if(!creators.length)return null;return <section className="section"><div className="section-title"><span>Crew</span><Users size={18}/></div><div className="crew-grid">{creators.map(creator=><article className="crew-card" key={creator.id}>{creator.imageUrl?<img src={creator.imageUrl} alt=""/>:<div className="crew-avatar">{creator.name.slice(0,1)}</div>}<div><strong>{creator.name}</strong><span>{creator.handle||'OG ELITE CREW'}</span>{creator.bio&&<p>{creator.bio}</p>}</div></article>)}</div></section>}
function EmptyState({text}:{text:string}){return <div className="empty">{text}</div>}
