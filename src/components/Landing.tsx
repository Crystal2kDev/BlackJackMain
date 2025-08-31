import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import Navbar from './Navbar';
import WhyUs from './WhyUs';
import '../styles/Landing.css';

const Landing: React.FC = () => {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const cardImages = [
    '/assets/cards/ace_of_spades.png',
    '/assets/cards/3_of_spades.png',
    '/assets/cards/jack_of_clubs2.png',
  ];

  return (
    <div className="landing">
      <Navbar />
      <div className="landing-hero">
        <div className="landing-text">
          <h1 className="landing-text-title">
            BlackJack <span>Online</span>
          </h1>
          <p className="landing-text-description">
            Присоединяйтесь к захватывающей игре в BlackJack! Испытайте удачу, соревнуйтесь с дилером и выигрывайте крупные призы.
          </p>
          <Link to="/game">
            <motion.button
              className="landing-button"
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              Начать игру
            </motion.button>
          </Link>
        </div>
        <div className="landing-cards-container">
          <div className="landing-cards">
            {cardImages.map((src, index) => (
              <motion.img
                key={index}
                src={src}
                alt={`Card ${index + 1}`}
                className={`landing-card ${index === 0 ? 'landing-card-left' : index === 2 ? 'landing-card-right' : ''}`}
                initial={{ y: -100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut', delay: index * 0.2 }}
                whileHover={{ scale: 1.05, boxShadow: '0 6px 12px rgba(0, 209, 255, 0.5)' }}
                onHoverStart={() => setHoveredCard(src)}
                onHoverEnd={() => setHoveredCard(null)}
                onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                  console.error('Card image error:', e.currentTarget.src);
                  e.currentTarget.src = 'https://via.placeholder.com/152x216?text=Card';
                }}
              />
            ))}
          </div>
        </div>
      </div>
      <WhyUs />
    </div>
  );
};

export default Landing;