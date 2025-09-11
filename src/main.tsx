// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Navbar from './components/Navbar';
import Landing from './pages/Landing';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import Store from './pages/Store';
import FAQ from './pages/FAQ';
import Login from './pages/Login';
import Poker from './pages/Poker';
import Rules from './pages/Rules';
import PokerRules from './pages/PokerRules';
import BlackJackRules from './pages/BlackJackRules';
import Support from './pages/Support';

import './styles/Navbar.css';
import './styles/faq.css';
import './styles/game.css';
import './styles/Lobby.css';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/lobby" element={<Lobby />} />
        <Route path="/game" element={<Game />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/login" element={<Login />} />
        <Route path="/store" element={<Store />} />
        <Route path="/poker" element={<Poker />} />
        <Route path="/rules" element={<Rules />} />
        <Route path="/poker-rules" element={<PokerRules />} />
        <Route path="/blackjack-rules" element={<BlackJackRules />} />
        <Route path="/support" element={<Support />} />
        {/* добавляйте другие маршруты здесь */}
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
