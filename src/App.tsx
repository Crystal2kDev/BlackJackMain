import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useState } from 'react';
import Navbar from './components/Navbar';
import Landing from './pages/Landing';
import Game from './pages/Game';
import FAQ from './pages/FAQ';
import WhyUs from './components/WhyUs';
import LoginModal from './components/LoginModal';
import './styles/App.css';

function App() {
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  const openLogin = () => setIsLoginOpen(true);
  const closeLogin = () => setIsLoginOpen(false);

  return (
    <Router>
      <Navbar onLoginClick={openLogin} />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/game" element={<Game />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/why-us" element={<WhyUs />} />
      </Routes>

      <LoginModal isOpen={isLoginOpen} onClose={closeLogin} />
    </Router>
  );
}

export default App;
