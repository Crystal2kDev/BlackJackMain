// src/pages/Lobby.tsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import '../styles/Lobby.css';

const CARD_SOURCES = [
  '/assets/cards/king_of_diamonds2.png',
  '/assets/cards/queen_of_hearts.png',
  '/assets/cards/jack_of_clubs2.png',
  '/assets/cards/ace_of_spades.png',
  '/assets/cards/ten_of_hearts.png',
  '/assets/cards/cardRedBack.png',
];

const Lobby: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialModeParam = searchParams.get('mode');
  const initialMode = initialModeParam === 'blackjack' || initialModeParam === 'poker' ? (initialModeParam as 'blackjack' | 'poker') : null;

  const [selectedMode, setSelectedMode] = useState<'blackjack' | 'poker' | null>(initialMode);

  const handleSelectMode = (mode: 'blackjack' | 'poker') => {
    setSelectedMode(mode);
    // обновляем query param — удобно для сохранения/шеринга
    setSearchParams({ mode });
  };

  const handlePlayBot = () => navigate('/game?mode=bot');
  const handlePlayFriends = () => navigate('/game?mode=friend');
  const handleLobby = () => navigate('/game?mode=lobby');

  return (
    <div className="lobby-page">
      {/* decorative scattered cards in background */}
      <div className="bg-cards" aria-hidden>
        <img src={CARD_SOURCES[0]} className="bg-card bg-card--1" alt="card" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/assets/cards/cardRedBack.png'; }} />
        <img src={CARD_SOURCES[1]} className="bg-card bg-card--2" alt="card" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/assets/cards/cardRedBack.png'; }} />
        <img src={CARD_SOURCES[2]} className="bg-card bg-card--3" alt="card" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/assets/cards/cardRedBack.png'; }} />
        <img src={CARD_SOURCES[3]} className="bg-card bg-card--4" alt="card" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/assets/cards/cardRedBack.png'; }} />
        <img src={CARD_SOURCES[4]} className="bg-card bg-card--5" alt="card" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/assets/cards/cardRedBack.png'; }} />
        <img src={CARD_SOURCES[5]} className="bg-card bg-card--6" alt="card" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/assets/cards/cardRedBack.png'; }} />
      </div>

      <motion.div
        className="lobby-card"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1>Выберите режим игры</h1>
        <p className="lobby-sub">
          Выберите игру: BlackJack или Poker (No Limit Texas Hold'em). После выбора режима — выберите вариант игры (с ботом, с друзьями, лобби).
        </p>

        <div className="mode-row">
          <motion.button
            className={`mode-card ${selectedMode === 'blackjack' ? 'selected' : ''}`}
            whileHover={{ scale: 1.03 }}
            onClick={() => handleSelectMode('blackjack')}
            aria-label="BlackJack"
            aria-pressed={selectedMode === 'blackjack'}
          >
            <img src="/assets/cards/king_of_diamonds2.png" alt="BlackJack" className="mode-icon" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/assets/cards/cardRedBack.png'; }} />
            <div className="mode-text">
              <h3>BlackJack</h3>
              <p>Классический блекджек — цель набрать 21 или ближе к нему.</p>
            </div>
          </motion.button>

          <motion.button
            className={`mode-card ${selectedMode === 'poker' ? 'selected' : ''}`}
            whileHover={{ scale: 1.03 }}
            onClick={() => handleSelectMode('poker')}
            aria-label="Poker"
            aria-pressed={selectedMode === 'poker'}
          >
            <img src="/assets/cards/ace_of_spades.png" alt="Poker" className="mode-icon" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/assets/cards/cardRedBack.png'; }} />
            <div className="mode-text">
              <h3>Poker</h3>
              <p>No Limit Texas Hold'em — два закрытых, пять общих карт, ставки и блайнды.</p>
            </div>
          </motion.button>
        </div>

        <p className="lobby-sub small">Теперь выберите вариант игры внизу (С ботом / С друзьями / Лобби).</p>

        <div className="lobby-grid">
          <motion.div
            className="lobby-option"
            whileHover={{ scale: 1.03 }}
            onClick={handlePlayBot}
            role="button"
            tabIndex={0}
            aria-label="Играть с ботом"
          >
            <div className="option-icon">🤖</div>
            <h3>С ботом</h3>
            <p>Быстрая игра против умного бота. Режим доступен прямо сейчас.</p>
            <div className="option-cta">Играть</div>
          </motion.div>

          <motion.div
            className="lobby-option disabled"
            whileHover={{ scale: 1.01 }}
            onClick={handlePlayFriends}
            role="button"
            tabIndex={0}
            aria-label="Играть с друзьями"
          >
            <div className="option-icon">👥</div>
            <h3>С друзьями</h3>
            <p>Создавайте комнаты и приглашайте друзей. Скоро будет доступно.</p>
            <div className="option-cta">Скоро</div>
          </motion.div>

          <motion.div
            className="lobby-option disabled"
            whileHover={{ scale: 1.01 }}
            onClick={handleLobby}
            role="button"
            tabIndex={0}
            aria-label="Лобби"
          >
            <div className="option-icon">🏷️</div>
            <h3>Лобби / турниры</h3>
            <p>Собирайте игроков в публичных лобби и участвуйте в турнирах.</p>
            <div className="option-cta">Скоро</div>
          </motion.div>
        </div>

        <div className="lobby-footer">
          <small>
            У вас есть идеи по режимам? Напишите в поддержку — и мы добавим их в следующих апдейтах.
          </small>
        </div>
      </motion.div>
    </div>
  );
};

export default Lobby;
