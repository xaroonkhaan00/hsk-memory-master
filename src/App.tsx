import { useEffect } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useStore } from './store';

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

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function TabBar() {
  const tabs = [
    { to: '/', icon: '🏠', label: 'Today' },
    { to: '/map', icon: '🗺️', label: 'Map' },
    { to: '/games', icon: '🎮', label: 'Train' },
    { to: '/browse', icon: '🔍', label: 'Words' },
    { to: '/dashboard', icon: '📊', label: 'Progress' },
  ];
  return (
    <nav className="tabbar" aria-label="Main">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.to === '/'}>
          <span className="ico" aria-hidden>
            {t.icon}
          </span>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function App() {
  const { state, ready } = useStore();

  useEffect(() => {
    const theme = state.settings.theme;
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [state.settings.theme]);

  if (!ready) {
    return (
      <div className="app">
        <div className="page center" style={{ paddingTop: 80 }}>
          <p className="muted">Loading your progress…</p>
        </div>
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
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/today" element={<Today />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/learn/:packId" element={<PackLearn />} />
        <Route path="/word/:id" element={<WordPage />} />
        <Route path="/browse" element={<Browse />} />
        <Route path="/lists" element={<Lists />} />
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
