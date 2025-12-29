
import React, { useEffect, useRef, useState } from 'react';
import { audioService } from './services/audioService';
import { getMissionText } from './services/geminiService';
import { LeaderboardService } from './services/leaderboardService';
import { Point, Laser, Enemy, GameState, LeaderboardEntry, Boss, BossProjectile } from './types';

const BOSS_THRESHOLD = 1000;

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    health: 100,
    gameOver: false,
    gameStarted: false,
    missionText: "Loading briefing...",
    isBossPhase: false
  });

  const [isMobile, setIsMobile] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [playerName, setPlayerName] = useState("PILOT-CAT");
  const [aiComment, setAiComment] = useState("");
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const mouseRef = useRef<Point>({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const catPos = { x: 120, y: 120 };
  const lasersRef = useRef<Laser[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const bossProjectilesRef = useRef<BossProjectile[]>([]);
  const starsRef = useRef<{x: number, y: number, s: number}[]>([]);
  const bossRef = useRef<Boss | null>(null);
  
  // Visual FX refs
  const shakeIntensityRef = useRef(0);
  const flashOpacityRef = useRef(0);

  const isFiringRef = useRef(false);
  const isChargingRef = useRef(false);
  const blinkTimerRef = useRef(0);
  const earTwitchTimerRef = useRef(0);
  const isBlinkingRef = useRef(false);
  const twitchSideRef = useRef(0);

  const [nextBossScore, setNextBossScore] = useState(BOSS_THRESHOLD);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
    };
    checkMobile();
    setLeaderboard(LeaderboardService.getScores());

    const stars = [];
    for (let i = 0; i < 150; i++) {
      stars.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        s: Math.random() * 1.5 + 0.5
      });
    }
    starsRef.current = stars;

    const fetchMission = async () => {
      const text = await getMissionText();
      setGameState(prev => ({ ...prev, missionText: text }));
    };
    fetchMission();
    audioService.preloadChildVoice();
  }, []);

  const startGame = () => {
    setGameState({
      score: 0,
      health: 100,
      gameOver: false,
      gameStarted: true,
      missionText: "Initial briefing active.",
      isBossPhase: false
    });
    enemiesRef.current = [];
    lasersRef.current = [];
    bossProjectilesRef.current = [];
    bossRef.current = null;
    shakeIntensityRef.current = 0;
    flashOpacityRef.current = 0;
    setNextBossScore(BOSS_THRESHOLD);
    setAiComment("");
  };

  const handleGameOver = async (finalScore: number) => {
    const updated = LeaderboardService.saveScore(playerName, finalScore);
    setLeaderboard(updated);
    const comment = await LeaderboardService.getAIPuns(finalScore);
    setAiComment(comment);
  };

  useEffect(() => {
    if (gameState.gameOver) {
      handleGameOver(gameState.score);
    }
  }, [gameState.gameOver]);

  const triggerDamageEffects = () => {
    shakeIntensityRef.current = 15;
    flashOpacityRef.current = 0.6;
  };

  const fireBurst = (targetX?: number, targetY?: number) => {
    if (isFiringRef.current || isChargingRef.current || gameState.gameOver || !gameState.gameStarted) return;
    
    if (targetX !== undefined && targetY !== undefined) {
      mouseRef.current = { x: targetX, y: targetY };
    }

    isChargingRef.current = true;
    
    setTimeout(() => {
      if (gameState.gameOver || !gameState.gameStarted) {
        isChargingRef.current = false;
        return;
      }
      
      isChargingRef.current = false;
      isFiringRef.current = true;
      const burstInterval = 120;
      audioService.playPew();

      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          if (gameState.gameOver || !gameState.gameStarted) return;
          
          const currentTargetX = mouseRef.current.x;
          const currentTargetY = mouseRef.current.y;
          const angle = Math.atan2(currentTargetY - (catPos.y - 10), currentTargetX - catPos.x);

          const eyeOffsets = [-15, 15];
          eyeOffsets.forEach(offsetX => {
            lasersRef.current.push({
              id: Math.random().toString(),
              start: { x: catPos.x + offsetX, y: catPos.y - 10 },
              target: { x: currentTargetX, y: currentTargetY },
              currentX: catPos.x + offsetX,
              currentY: catPos.y - 10,
              angle: angle + (Math.random() * 0.05 - 0.025),
              speed: 25,
              active: true
            });
          });

          if (i === 2) isFiringRef.current = false;
        }, i * burstInterval);
      }
    }, 150);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const spawnEnemy = () => {
      if (gameState.isBossPhase) return;
      if (Math.random() > 0.97) {
        const side = Math.random() > 0.5 ? 1 : 2;
        let x, y;
        if (side === 1) { x = canvas.width + 50; y = Math.random() * canvas.height; }
        else { x = Math.random() * canvas.width; y = canvas.height + 50; }

        enemiesRef.current.push({
          id: Math.random().toString(),
          x, y,
          radius: 15 + Math.random() * 25,
          speed: 0.8 + Math.random() * 1.5,
          health: 1,
          type: Math.random() > 0.4 ? 'dog' : 'yarn'
        });
      }
    };

    const update = () => {
      if (!gameState.gameStarted || gameState.gameOver) return;

      const now = Date.now();

      // Decay effects
      if (shakeIntensityRef.current > 0) shakeIntensityRef.current *= 0.9;
      if (flashOpacityRef.current > 0) flashOpacityRef.current -= 0.04;

      // Check for Boss Spawn
      if (gameState.score >= nextBossScore && !gameState.isBossPhase) {
        setGameState(prev => ({ ...prev, isBossPhase: true }));
        bossRef.current = {
          x: canvas.width + 200,
          y: canvas.height / 2,
          width: 180,
          height: 180,
          health: 1500,
          maxHealth: 1500,
          active: true,
          velocity: 2,
          lastFireTime: now
        };
      }

      // Boss Logic
      if (bossRef.current && bossRef.current.active) {
        const b = bossRef.current;
        // Move into screen
        if (b.x > canvas.width - 250) {
          b.x -= 2;
        } else {
          // Vertical hover
          b.y += b.velocity;
          if (b.y > canvas.height - 150 || b.y < 150) {
            b.velocity *= -1;
          }
        }

        // Fire Projectiles
        if (now - b.lastFireTime > 1500) {
          b.lastFireTime = now;
          const angle = Math.atan2(catPos.y - b.y, catPos.x - b.x);
          bossProjectilesRef.current.push({
            id: Math.random().toString(),
            x: b.x - 50,
            y: b.y,
            vx: Math.cos(angle) * 7,
            vy: Math.sin(angle) * 7,
            radius: 20,
            active: true
          });
        }

        // Collision with Lasers
        lasersRef.current.forEach(l => {
          if (l.active) {
            const dx = l.currentX - b.x;
            const dy = l.currentY - b.y;
            if (Math.abs(dx) < b.width / 2 && Math.abs(dy) < b.height / 2) {
              b.health -= 15;
              l.active = false;
              if (b.health <= 0) {
                b.active = false;
                setGameState(s => ({ ...s, score: s.score + 2000, isBossPhase: false }));
                setNextBossScore(n => n + 2000);
                audioService.playExplosion();
                audioService.playExplosion();
              }
            }
          }
        });
      }

      // Update Boss Projectiles
      bossProjectilesRef.current.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        
        // Collision with Cat
        const dx = p.x - catPos.x;
        const dy = p.y - catPos.y;
        if (Math.sqrt(dx * dx + dy * dy) < p.radius + 40) {
          p.active = false;
          triggerDamageEffects();
          setGameState(s => {
            const newHealth = s.health - 15;
            if (newHealth <= 0) return { ...s, health: 0, gameOver: true };
            return { ...s, health: newHealth };
          });
        }

        if (p.x < -100 || p.x > canvas.width + 100 || p.y < -100 || p.y > canvas.height + 100) {
          p.active = false;
        }
      });
      bossProjectilesRef.current = bossProjectilesRef.current.filter(p => p.active);

      if (!isBlinkingRef.current && now > blinkTimerRef.current) {
          isBlinkingRef.current = true;
          setTimeout(() => {
              isBlinkingRef.current = false;
              blinkTimerRef.current = Date.now() + 3000 + Math.random() * 4000;
          }, 150);
      }

      if (twitchSideRef.current === 0 && now > earTwitchTimerRef.current) {
          twitchSideRef.current = Math.random() > 0.5 ? 1 : 2;
          setTimeout(() => {
              twitchSideRef.current = 0;
              earTwitchTimerRef.current = Date.now() + 2000 + Math.random() * 3000;
          }, 200);
      }

      lasersRef.current.forEach(l => {
        l.currentX += Math.cos(l.angle) * l.speed;
        l.currentY += Math.sin(l.angle) * l.speed;
        if (l.currentX < 0 || l.currentX > canvas.width || l.currentY < 0 || l.currentY > canvas.height) {
          l.active = false;
        }
      });
      lasersRef.current = lasersRef.current.filter(l => l.active);

      spawnEnemy();
      enemiesRef.current.forEach(e => {
        const angle = Math.atan2(catPos.y - e.y, catPos.x - e.x);
        e.x += Math.cos(angle) * e.speed;
        e.y += Math.sin(angle) * e.speed;

        lasersRef.current.forEach(l => {
          const dx = l.currentX - e.x;
          const dy = l.currentY - e.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < e.radius) {
            e.health = 0;
            l.active = false;
            setGameState(s => ({ ...s, score: s.score + 10 }));
            audioService.playExplosion();
          }
        });

        const dx = catPos.x - e.x;
        const dy = catPos.y - e.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < e.radius + 50) {
          e.health = 0;
          triggerDamageEffects();
          setGameState(s => {
            const newHealth = s.health - 5;
            if (newHealth <= 0) return { ...s, health: 0, gameOver: true };
            return { ...s, health: newHealth };
          });
        }
      });
      enemiesRef.current = enemiesRef.current.filter(e => e.health > 0);
    };

    const drawCat = () => {
      ctx.save();
      ctx.translate(catPos.x, catPos.y);
      ctx.shadowBlur = 20;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.fillStyle = '#4a4a4a';
      ctx.beginPath();
      ctx.ellipse(0, 40, 50, 60, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#666666';
      ctx.beginPath();
      ctx.moveTo(-45, -10);
      ctx.quadraticCurveTo(-50, 30, 0, 45);
      ctx.quadraticCurveTo(50, 30, 45, -10);
      ctx.quadraticCurveTo(40, -40, 0, -45);
      ctx.quadraticCurveTo(-40, -40, -45, -10);
      ctx.fill();

      const drawEar = (side: number) => {
        ctx.save();
        ctx.scale(side, 1);
        const isTwitching = (side === 1 && twitchSideRef.current === 1) || (side === -1 && twitchSideRef.current === 2);
        const twitchAngle = isTwitching ? -0.15 : 0;
        ctx.rotate(twitchAngle);
        ctx.fillStyle = '#555555';
        ctx.beginPath();
        ctx.moveTo(15, -35);
        ctx.lineTo(45, -75);
        ctx.lineTo(40, -20);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#333333';
        ctx.beginPath();
        ctx.moveTo(20, -35);
        ctx.lineTo(38, -60);
        ctx.lineTo(35, -25);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      };
      drawEar(1);
      drawEar(-1);

      if (isFiringRef.current) {
        ctx.shadowBlur = 30;
        ctx.shadowColor = '#ff0000';
      } else if (isChargingRef.current) {
        ctx.shadowBlur = 40;
        ctx.shadowColor = '#ffff00';
      }

      const drawEye = (x: number) => {
        if (isBlinkingRef.current && !isFiringRef.current && !isChargingRef.current) {
            ctx.strokeStyle = '#222';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x - 8, -10);
            ctx.lineTo(x + 8, -10);
            ctx.stroke();
            return;
        }
        ctx.fillStyle = isFiringRef.current || isChargingRef.current ? '#ff3333' : '#222222';
        ctx.beginPath();
        ctx.arc(x, -10, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = isFiringRef.current ? '#ffffff' : (isChargingRef.current ? '#ffff00' : '#ff0000');
        ctx.beginPath();
        ctx.arc(x, -10, 3, 0, Math.PI * 2);
        ctx.fill();
      };
      drawEye(-18);
      drawEye(18);

      ctx.shadowBlur = 0;
      ctx.fillStyle = '#555555';
      ctx.beginPath();
      ctx.arc(0, 15, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.moveTo(-4, 10);
      ctx.lineTo(4, 10);
      ctx.lineTo(0, 16);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 1;
      [-1, 1].forEach(s => {
        ctx.beginPath(); ctx.moveTo(s * 10, 18); ctx.lineTo(s * 50, 12); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s * 10, 21); ctx.lineTo(s * 50, 25); ctx.stroke();
      });
      ctx.restore();
    };

    const draw = () => {
      ctx.save();
      
      // Apply screen shake
      if (shakeIntensityRef.current > 0.5) {
        const sx = (Math.random() - 0.5) * shakeIntensityRef.current;
        const sy = (Math.random() - 0.5) * shakeIntensityRef.current;
        ctx.translate(sx, sy);
      }

      ctx.fillStyle = gameState.isBossPhase ? '#0a0000' : '#050508';
      ctx.fillRect(-50, -50, canvas.width + 100, canvas.height + 100);
      
      // Stars
      ctx.fillStyle = '#fff';
      starsRef.current.forEach(s => {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.s, 0, Math.PI * 2);
        ctx.fill();
      });

      // Boss
      if (bossRef.current && bossRef.current.active) {
        const b = bossRef.current;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.font = '160px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 50;
        ctx.shadowColor = 'rgba(255, 0, 0, 0.5)';
        ctx.fillText('🐶', 0, 0);
        
        // Boss Health Bar
        ctx.restore();
        const barWidth = 200;
        ctx.fillStyle = '#222';
        ctx.fillRect(b.x - barWidth/2, b.y - 120, barWidth, 10);
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(b.x - barWidth/2, b.y - 120, barWidth * (b.health / b.maxHealth), 10);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(b.x - barWidth/2, b.y - 120, barWidth, 10);
        ctx.fillStyle = '#fff';
        ctx.font = '10px monospace';
        ctx.fillText('VOID HOUND MK-I', b.x - barWidth/2, b.y - 130);
      }

      // Boss Projectiles
      bossProjectilesRef.current.forEach(p => {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.font = '30px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ff0000';
        ctx.fillText('🦴', 0, 0);
        ctx.restore();
      });

      lasersRef.current.forEach(l => {
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ff0000';
        ctx.beginPath();
        ctx.moveTo(l.currentX, l.currentY);
        ctx.lineTo(l.currentX - Math.cos(l.angle) * 30, l.currentY - Math.sin(l.angle) * 30);
        ctx.stroke();
        ctx.shadowBlur = 0;
      });

      drawCat();
      enemiesRef.current.forEach(e => {
        ctx.font = `${e.radius * 1.5}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(e.type === 'dog' ? '🐶' : '🧶', e.x, e.y);
      });

      ctx.restore();

      // Apply damage flash (overlay)
      if (flashOpacityRef.current > 0.01) {
        ctx.fillStyle = `rgba(255, 0, 0, ${flashOpacityRef.current})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    };

    const loop = () => {
      update();
      draw();
      animationFrameId = requestAnimationFrame(loop);
    };

    loop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState.gameStarted, gameState.gameOver, gameState.isBossPhase, nextBossScore]);

  return (
    <div 
      className="relative w-full h-screen overflow-hidden bg-black select-none cursor-crosshair touch-none" 
      onMouseMove={(e) => mouseRef.current = { x: e.clientX, y: e.clientY }}
      onMouseDown={(e) => e.button === 0 && fireBurst()}
      onTouchStart={(e) => fireBurst(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchMove={(e) => mouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }}
    >
      <canvas ref={canvasRef} width={window.innerWidth} height={window.innerHeight} className="absolute inset-0" />

      {/* Boss Incoming Overlay */}
      {gameState.isBossPhase && (
        <div className="absolute inset-0 pointer-events-none border-[10px] border-red-900/20 animate-pulse flex items-center justify-center">
          <div className="text-red-600 font-black text-4xl sm:text-6xl tracking-[0.5em] opacity-10 uppercase select-none">Boss Encounter</div>
        </div>
      )}

      {/* HUD */}
      <div className="absolute top-2 left-2 right-2 flex flex-col sm:flex-row justify-between items-start pointer-events-none gap-2">
        <div className="bg-black/60 p-3 sm:p-4 border-l-4 border-red-600 rounded-r-lg backdrop-blur-md sm:ml-[220px]">
          <div className="text-red-500 font-bold text-xs sm:text-lg mb-0 sm:mb-1 tracking-widest uppercase flex items-center">
            <span className="w-2 h-2 bg-red-600 rounded-full mr-2 animate-pulse"></span>
            Tactical Briefing
          </div>
          <div className="text-gray-100 text-[10px] sm:text-sm max-w-[200px] sm:max-w-md font-medium leading-tight sm:leading-relaxed italic">
            {gameState.isBossPhase ? '"VOID HOUND DETECTED. ALL PLASMA POWER TO EYES!"' : `"${gameState.missionText}"`}
          </div>
        </div>
        <div className="bg-black/60 p-3 sm:p-4 border-r-4 border-yellow-500 rounded-l-lg backdrop-blur-md text-right min-w-[150px] sm:min-w-[200px] self-end sm:self-auto">
          <div className="text-yellow-400 font-mono text-xl sm:text-3xl font-bold tracking-tighter">
            {gameState.score.toString().padStart(6, '0')}
          </div>
          <div className="text-[8px] sm:text-[10px] text-yellow-500/70 uppercase tracking-[0.2em] mb-1 sm:mb-2">Credits Earned</div>
          <div className="w-full h-1.5 sm:h-2 bg-gray-900 rounded-full overflow-hidden border border-gray-800">
            <div className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-300" style={{ width: `${gameState.health}%` }} />
          </div>
          <div className="text-[7px] sm:text-[9px] text-gray-500 mt-1 uppercase tracking-widest">Deflector Status</div>
        </div>
      </div>

      {/* Initial Screen */}
      {!gameState.gameStarted && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 z-50">
          <div className="text-center p-6 sm:p-12 bg-gray-950 border border-gray-800 rounded-3xl shadow-[0_0_50px_rgba(220,38,38,0.2)] max-w-xl w-full">
            <h1 className="text-4xl sm:text-6xl font-black text-white mb-2 tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-500">STATION-CAT</h1>
            <p className="text-red-500 font-mono text-xs sm:text-sm mb-6 tracking-[0.3em] uppercase">Void-Bound Guard Unit</p>
            
            <div className="mb-6">
              <label className="block text-gray-500 text-[10px] uppercase tracking-widest mb-2 text-left px-2">Pilot Callsign</label>
              <input 
                type="text" 
                maxLength={15}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value.toUpperCase())}
                className="w-full bg-gray-900 border border-gray-800 p-4 rounded-xl text-white font-mono focus:outline-none focus:border-red-600 transition-colors"
              />
            </div>

            <button onClick={startGame} className="group relative w-full bg-red-600 hover:bg-red-500 text-white font-black py-4 px-8 rounded-2xl text-xl transition-all active:scale-95 shadow-2xl mb-4">
              <span className="relative z-10">INITIALIZE MISSION</span>
            </button>
            <button onClick={() => setShowLeaderboard(!showLeaderboard)} className="text-gray-500 hover:text-white text-xs uppercase tracking-widest font-bold transition-colors">
              {showLeaderboard ? 'Close Hall of Fame' : 'View Hall of Fame'}
            </button>

            {showLeaderboard && (
              <div className="mt-8 bg-gray-900/50 rounded-xl p-4 border border-gray-800 max-h-[250px] overflow-y-auto">
                <table className="w-full text-left text-[11px] sm:text-xs">
                  <thead className="text-gray-600 border-b border-gray-800">
                    <tr><th className="pb-2">RANK</th><th className="pb-2">PILOT</th><th className="pb-2 text-right">SCORE</th></tr>
                  </thead>
                  <tbody className="text-gray-300 font-mono">
                    {leaderboard.map((entry, i) => (
                      <tr key={i} className={`border-b border-gray-800/50 ${entry.isPlayer ? 'text-yellow-400' : ''}`}>
                        <td className="py-2">#{(i+1).toString().padStart(2, '0')}</td>
                        <td className="py-2">{entry.name}</td>
                        <td className="py-2 text-right">{entry.score.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState.gameOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-950/40 backdrop-blur-md p-4 z-50">
          <div className="text-center p-8 sm:p-12 bg-black border-2 border-red-600 rounded-[30px] shadow-[0_0_100px_rgba(220,38,38,0.5)] w-full max-w-xl">
            <div className="text-red-600 text-[10px] font-mono tracking-[0.5em] mb-4 uppercase">System Defeat</div>
            <h2 className="text-5xl sm:text-7xl font-black text-white mb-2 tracking-tighter">SCRATCHED</h2>
            
            <div className="bg-gray-900/40 p-4 rounded-xl border border-gray-800 my-6">
              <div className="text-3xl text-red-500 font-mono font-bold">{gameState.score.toLocaleString()} PTS</div>
              <div className="text-gray-400 text-sm mt-2 font-medium italic">"{aiComment || 'Retrieving debrief...'}"</div>
            </div>

            <div className="mb-8 text-left bg-gray-900/80 p-4 rounded-xl border border-gray-800">
              <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-3 border-b border-gray-800 pb-1">Top Sector Guard Scores</div>
              <div className="space-y-1">
                {leaderboard.slice(0, 5).map((entry, i) => (
                  <div key={i} className={`flex justify-between font-mono text-xs ${entry.isPlayer ? 'text-yellow-400 bg-yellow-400/10 rounded px-1' : 'text-gray-400'}`}>
                    <span>{i+1}. {entry.name}</span>
                    <span>{entry.score.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={startGame} className="bg-white hover:bg-gray-200 text-black font-black py-4 px-12 rounded-2xl text-xl transition-all shadow-xl w-full">
              RE-ENGAGE DEFENSES
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
