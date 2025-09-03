import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import '../styles/Lobby.css';

const Lobby: React.FC = () => {
  const navigate = useNavigate();

  const handlePlayBot = () => {
    // переходим в игру, указываем режим через query param
    navigate('/game?mode=bot');
  };

  const handlePlayFriends = () => {
    // пока заглушка — можно реализовать create/join в следующем шаге
    navigate('/game?mode=friend');
  };

  const handleLobby = () => {
    // заглушка для лобби (coming soon)
    navigate('/game?mode=lobby');
  };

  return (
    <div className="lobby-page">
      <motion.div
        className="lobby-card"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1>Выберите режим игры</h1>
        <p className="lobby-sub">
          Играйте в BlackJack — выберите режим. Режим «С ботом» уже доступен. Режимы для друзей и лобби — в разработке.
        </p>

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
