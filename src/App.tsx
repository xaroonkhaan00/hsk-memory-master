import { useEffect } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from './store';
import { applyStatusBarTheme, initNativeShell } from './services/platform';
import { BrandLockup } from './brand/Logo';
import { Icon, type IconName } from './brand/icons';
import { stop } from './services/audio';

import Home from './pages/Home';
import Onboarding from './pages/Onboarding';
import MapPage from './pages/MapPage';
import PackLearn from './pages/PackLearn';
import WordPage from './pages/WordPage';
import Browse from './pages/Browse';
import Games from './pages/Games';
import GamePlay from './pages/GamePlay';
import Today from './pages/Today';
import ToneTrainer from './pages/ToneTrainer';
import PinyinTrainer from './pages/PinyinTrainer';
import Confusion from './pages/Confusion';
import Families from './pages/Families';
import CharacterHub from './pages/CharacterHub';
import StoryChainPage from './pages/StoryChain';
import Dialogues from './pages/Dialogues';
import Palace from './pages/Palace';
import Journey from './pages/Journey';
import Boss from './pages/Boss';
import Cram from './pages/Cram';
import Dashboard from './pages/Dashboard';
import Heatmap from './pages/Heatmap';
import Notebook from './pages/Notebook';
import MeasureWordsPage from './pages/MeasureWords';
import Achievements from './pages/Achievements';
import Settings from './pages/Settings';
import QA from './pages/QA';
import Lists from './pages/Lists';
import StoryList, { StoryPlayer } from './pages/Story';
import CinemaList, { CinemaPlayer } from './pages/Cinema';
import Saved from './pages/Saved';
import About from './pages/About';

/** Every navigation starts at the top of the new screen and silences any audio
    left running by the screen being left. */
function OnNavigate() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    stop();
  }, [pathname]);
  return null;
}

function TabBar() {
  const tabs: { to: string; icon: IconName; label: string }[] = [
    { to: '/', icon: 'home', label: 'Home' },
    { to: '/stories', icon: 'book', label: 'Stories' },
    { to: '/cinema', icon: 'film', label: 'Cinema' },
    { to: '/browse', icon: 'search', label: 'Words' },
    { to: '/dashboard', icon: 'chart', label: 'Progress' },
  ];
  return (
    <nav className="tabbar" aria-label="Main">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.to === '/'}>
          <span className="ico">
            <Icon name={t.icon} size={21} />
          </span>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function App() {
  const { state, ready } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    const theme = state.settings.theme;
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    const dark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    applyStatusBarTheme(dark);
  }, [state.settings.theme]);

  // The Android back button walks the app's own history and only leaves the app
  // from the home screen, so a study session is never dropped by one press.
  useEffect(() => {
    initNativeShell(
      () => navigate(-1),
      () => window.location.hash === '#/' || window.location.hash === '',
    );
  }, [navigate]);

  if (!ready) {
    // A branded hold rather than a bare spinner: on a phone this is the first
    // thing the learner sees while progress is read from storage.
    return (
      <div className="splash">
        <BrandLockup size={92} stacked />
      </div>
    );
  }

  if (!state.settings.onboarded) {
    return (
      <div className="app" style={{ paddingBottom: 0 }}>
        <Onboarding />
      </div>
    );
  }

  return (
    <div className="app">
      <OnNavigate />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/today" element={<Today />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/learn/:packId" element={<PackLearn />} />
        <Route path="/word/:id" element={<WordPage />} />
        <Route path="/browse" element={<Browse />} />
        <Route path="/lists" element={<Lists />} />
        <Route path="/stories" element={<StoryList />} />
        <Route path="/stories/:id" element={<StoryPlayer />} />
        <Route path="/cinema" element={<CinemaList />} />
        <Route path="/cinema/:id" element={<CinemaPlayer />} />
        <Route path="/saved" element={<Saved />} />
        <Route path="/about" element={<About />} />
        <Route path="/games" element={<Games />} />
        <Route path="/games/:mode" element={<GamePlay />} />
        <Route path="/tone" element={<ToneTrainer />} />
        <Route path="/pinyin" element={<PinyinTrainer />} />
        <Route path="/confusion" element={<Confusion />} />
        <Route path="/families" element={<Families />} />
        <Route path="/families/char/:char" element={<CharacterHub />} />
        <Route path="/dialogues" element={<Dialogues />} />
        <Route path="/story" element={<StoryChainPage />} />
        <Route path="/story/:packId" element={<StoryChainPage />} />
        <Route path="/palace" element={<Palace />} />
        <Route path="/palace/:room" element={<Palace />} />
        <Route path="/journey" element={<Journey />} />
        <Route path="/boss" element={<Boss />} />
        <Route path="/boss/:band" element={<Boss />} />
        <Route path="/cram" element={<Cram />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/heatmap" element={<Heatmap />} />
        <Route path="/notebook" element={<Notebook />} />
        <Route path="/measure-words" element={<MeasureWordsPage />} />
        <Route path="/achievements" element={<Achievements />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/qa" element={<QA />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <TabBar />
    </div>
  );
}
