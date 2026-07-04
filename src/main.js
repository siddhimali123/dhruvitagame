// Main Game Coordinator
// Sets up Three.js WebGL scene, handles state machine, screen resizing, mouse pointer locks,
// bullet-to-enemy/world collision engine, and renders the minimap radar.
import * as THREE from 'three';
import { audio } from './audio.js';
import WorldManager from './world.js';
import PlayerController from './player.js';
import EnemyManager from './enemies.js';
import ParticleSystem from './particles.js';

class GameCoordinator {
    constructor() {
        this.gameState = 'LOADING'; // LOADING, MENU, PLAYING, GAMEOVER, VICTORY
        
        this.container = document.getElementById('game-container');
        this.clock = new THREE.Clock();
        
        // 1. Initial Scene Setup
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.container.appendChild(this.renderer.domElement);

        // 2. Initialize Game Systems
        this.particles = new ParticleSystem(this.scene);
        this.world = new WorldManager(this.scene);
        
        // Build environment
        this.world.buildWorld();
        
        this.player = new PlayerController(this.scene, this.camera, this.renderer.domElement);
        this.enemies = new EnemyManager(this.scene, this.particles);

        // 3. Mini-map / Radar setup
        this.radarCanvas = document.getElementById('radar-canvas');
        this.radarCtx = this.radarCanvas.getContext('2d');
        this.radarSweepAngle = 0;

        // 4. Hook up HUD button listeners
        this.setupUI();
        
        // Window resizing
        window.addEventListener('resize', () => this.onWindowResize());

        // Finished loading
        this.setGameState('MENU');
        
        // Start animation loop
        this.animate();
    }

    setGameState(state) {
        this.gameState = state;

        // Hide all screens
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('main-menu').classList.add('hidden');
        document.getElementById('controls-modal').classList.add('hidden');
        document.getElementById('game-hud').classList.add('hidden');
        document.getElementById('game-over-screen').classList.add('hidden');
        document.getElementById('victory-screen').classList.add('hidden');
        document.getElementById('crosshair').classList.add('hidden');

        if (state === 'MENU') {
            document.getElementById('main-menu').classList.remove('hidden');
            audio.stopMusic();
            document.exitPointerLock();
        } else if (state === 'PLAYING') {
            document.getElementById('game-hud').classList.remove('hidden');
            document.getElementById('crosshair').classList.remove('hidden');
            
            this.player.reset();
            this.enemies.clear();
            this.particles.clear();
            
            // Spawn initial wave of enemies
            for(let i=0; i<3; i++) {
                this.enemies.spawnEnemy(this.player.position);
            }
            
            audio.startMusic();
        } else if (state === 'GAMEOVER') {
            document.getElementById('game-over-screen').classList.remove('hidden');
            audio.stopMusic();
            document.exitPointerLock();
            
            // Sync final stats
            document.getElementById('end-score').innerText = `$${this.player.score.toLocaleString()}`;
            document.getElementById('end-kills').innerText = this.player.kills;
            document.getElementById('end-combo').innerText = `${this.player.combo}x`;
            
            // Random funny quote
            const bankruptQuotes = [
                "Bailout denied! The Federal Reserve replaced your credit card with a coupon for a free coffee.",
                "Margin Called! Your AI brokers took the liquidity and fled to the Cayman Server Islands.",
                "Stonks went down. You bought high and sold low. The robots are laughing at your portfolio.",
                "Bankruptcy declared. Your bounty hunter license has been repossessed to pay for trading gas fees."
            ];
            document.getElementById('funny-bankrupt-text').innerText = `"${bankruptQuotes[Math.floor(Math.random() * bankruptQuotes.length)]}"`;
        } else if (state === 'VICTORY') {
            document.getElementById('victory-screen').classList.remove('hidden');
            audio.stopMusic();
            document.exitPointerLock();

            // Sync stats
            document.getElementById('vic-score').innerText = `$${this.player.score.toLocaleString()}`;
            document.getElementById('vic-kills').innerText = this.player.kills;
            document.getElementById('vic-combo').innerText = `${this.player.combo}x`;
        }
    }

    setupUI() {
        // Main Menu Start
        document.getElementById('start-game-btn').addEventListener('click', () => {
            this.setGameState('PLAYING');
            // Request Pointer Lock on start
            this.renderer.domElement.requestPointerLock();
        });

        // Controls modal
        document.getElementById('open-controls-btn').addEventListener('click', () => {
            document.getElementById('controls-modal').classList.remove('hidden');
        });
        document.getElementById('close-controls-btn').addEventListener('click', () => {
            document.getElementById('controls-modal').classList.add('hidden');
        });

        // Sound volume toggle
        const soundBtn = document.getElementById('toggle-audio-btn');
        soundBtn.addEventListener('click', () => {
            audio.init();
            const enabled = audio.toggleAudio();
            soundBtn.innerText = enabled ? 'AUDIO: PROCEDURAL ON' : 'AUDIO: MUTED';
        });

        // Restart buttons
        document.getElementById('restart-game-btn').addEventListener('click', () => {
            this.setGameState('PLAYING');
            this.renderer.domElement.requestPointerLock();
        });
        document.getElementById('victory-restart-game-btn').addEventListener('click', () => {
            this.setGameState('PLAYING');
            this.renderer.domElement.requestPointerLock();
        });

        // Exit to Menu buttons
        document.getElementById('exit-to-menu-btn').addEventListener('click', () => this.setGameState('MENU'));
        document.getElementById('victory-exit-to-menu-btn').addEventListener('click', () => this.setGameState('MENU'));
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // --- MAIN ENGINE ANIMATION LOOP ---
    animate() {
        requestAnimationFrame(() => this.animate());

        let dt = this.clock.getDelta();
        
        // Prevent massive delta jumps when tab loses focus
        if (dt > 0.1) dt = 0.1;

        if (this.gameState === 'PLAYING') {
            this.updatePlaying(dt);
        }

        // Render scene
        this.renderer.render(this.scene, this.camera);
    }

    updatePlaying(dt) {
        const timeScale = this.player.slowMoActive ? 0.25 : 1.0;

        // 1. Update Game Objects
        this.world.update(dt * timeScale);
        
        // Pass candlestick platforms for collision mesh detection
        this.player.update(dt, this.world.candlesticks);
        this.enemies.update(dt, this.player, this.world.candlesticks);
        this.particles.update(dt * timeScale, this.player.position, (val) => this.player.addScore(val));

        // 2. Perform Bullet Collisions (Player Bullets -> Enemies & World)
        this.handleBulletCollisions();

        // 3. Render HUD Mini-map Radar
        this.renderRadar(dt * timeScale);

        // 4. Check End Game states
        if (this.player.health <= 0) {
            this.setGameState('GAMEOVER');
        } else if (this.player.score >= 100000) { // Goal: Reach $100k
            this.setGameState('VICTORY');
        }

        // 5. Slowly regenerate Portfolio value if out of combat
        if (this.player.health < this.player.maxHealth && this.player.comboTimer <= 0) {
            this.player.health = Math.min(this.player.maxHealth, this.player.health + dt * 2.0 * timeScale);
            this.player.updateHUDHealth();
        }
    }

    handleBulletCollisions() {
        const bullets = this.player.bullets;
        const enemies = this.enemies.enemies;
        const candlesticks = this.world.candlesticks;

        // Check each player projectile
        for (let bIdx = bullets.length - 1; bIdx >= 0; bIdx--) {
            const bullet = bullets[bIdx];
            let bulletDestroyed = false;

            // 1. Collide with world candlesticks
            for (let cIdx = 0; cIdx < candlesticks.length; cIdx++) {
                const candle = candlesticks[cIdx];
                if (candle.bbox.containsPoint(bullet.mesh.position)) {
                    // Spawn wall hit spark
                    this.spawnImpactSparks(bullet.mesh.position, bullet.type);
                    
                    // Destroy projectile
                    this.scene.remove(bullet.mesh);
                    bullet.mesh.geometry.dispose();
                    bullets.splice(bIdx, 1);
                    bulletDestroyed = true;
                    break;
                }
            }

            if (bulletDestroyed) continue;

            // 2. Collide with AI trader robots
            for (let eIdx = enemies.length - 1; eIdx >= 0; eIdx--) {
                const enemy = enemies[eIdx];
                
                // Approximate bounding sphere check for robot torso
                const robotCenter = enemy.position.clone().add(new THREE.Vector3(0, 0.8, 0));
                const dist = bullet.mesh.position.distanceTo(robotCenter);
                
                if (dist < 1.1) { // Hit!
                    // Rocket explosions do area-of-effect splash damage
                    if (bullet.type === 'rocket_arrow') {
                        this.triggerRocketExplosion(bullet.mesh.position, bullet.damage);
                    } else {
                        // Standard single target hit
                        const alive = enemy.hit(bullet.damage);
                        this.spawnImpactSparks(bullet.mesh.position, bullet.type);
                    }
                    
                    // Destroy projectile
                    this.scene.remove(bullet.mesh);
                    bullet.mesh.geometry.dispose();
                    bullets.splice(bIdx, 1);
                    break;
                }
            }
        }
    }

    // Spawn tiny neon debris sparks on impact
    spawnImpactSparks(position, bulletType) {
        // We can just use the particle manager to spawn small indicator flashes or rely on the main particle system
        let sparkColor = 0x00f0ff; // Cyan standard
        if (bulletType === 'shotgun_pellet') sparkColor = 0xffd700; // Gold
        if (bulletType === 'rocket_arrow') sparkColor = 0x39ff14; // Green

        // Add visual text indicator occasionally
        const textWords = ['MARGIN!', 'SELL!', 'BUY!', 'GAIN', '+$10'];
        if (Math.random() > 0.8) {
            this.particles.spawnTextSprite(position, textWords[Math.floor(Math.random() * textWords.length)]);
        }
    }

    // Rocket Arrow splash damage expansion
    triggerRocketExplosion(position, baseDamage) {
        audio.playExplosion();
        
        // Spawn text bubble
        this.particles.spawnTextSprite(position, 'CATASTROPHIC DUMP!');

        // Spawn a large sphere mesh representing shockwave briefly
        const geom = new THREE.SphereGeometry(0.2, 8, 8);
        const mat = new THREE.MeshBasicMaterial({
            color: 0x39ff14,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.copy(position);
        this.scene.add(mesh);

        // Animate the shockwave scale expansion in code
        const start = performance.now();
        const duration = 250; // ms
        const blastRadius = 7.0;

        const animateExplosion = () => {
            const elapsed = performance.now() - start;
            const progress = elapsed / duration;

            if (progress < 1.0) {
                const currentRadius = blastRadius * progress;
                mesh.scale.set(currentRadius * 5, currentRadius * 5, currentRadius * 5);
                mesh.material.opacity = 0.8 * (1.0 - progress);
                requestAnimationFrame(animateExplosion);
            } else {
                this.scene.remove(mesh);
                mesh.geometry.dispose();
                mesh.material.dispose();
            }
        };
        animateExplosion();

        // Calculate damage to all nearby enemies
        const enemies = this.enemies.enemies;
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            const dist = enemy.position.distanceTo(position);
            
            if (dist < blastRadius) {
                // Damage drops off by distance
                const falloff = 1.0 - (dist / blastRadius);
                const finalDamage = Math.floor(baseDamage * falloff);
                
                if (finalDamage > 10) {
                    enemy.hit(finalDamage);
                }
            }
        }
    }

    // Draw the high-tech sci-fi green radar panel in HUD
    renderRadar(dt) {
        const ctx = this.radarCtx;
        const w = this.radarCanvas.width;
        const h = this.radarCanvas.height;
        const center = w / 2;
        const radius = center - 2;

        ctx.clearRect(0, 0, w, h);

        // 1. Radar border and rings
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(center, center, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
        ctx.beginPath();
        ctx.arc(center, center, radius * 0.66, 0, Math.PI * 2);
        ctx.arc(center, center, radius * 0.33, 0, Math.PI * 2);
        ctx.stroke();

        // Cross axes
        ctx.beginPath();
        ctx.moveTo(center, 0); ctx.lineTo(center, h);
        ctx.moveTo(0, center); ctx.lineTo(w, center);
        ctx.stroke();

        // 2. Scanner sweeping line
        this.radarSweepAngle += dt * 2.5;
        const endX = center + Math.cos(this.radarSweepAngle) * radius;
        const endY = center + Math.sin(this.radarSweepAngle) * radius;
        
        const scanGrad = ctx.createLinearGradient(center, center, endX, endY);
        scanGrad.addColorStop(0, 'rgba(0, 240, 255, 0.01)');
        scanGrad.addColorStop(1, 'rgba(0, 240, 255, 0.3)');
        ctx.strokeStyle = scanGrad;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(center, center);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // 3. Draw Player in Center (Cyan arrow pointing up)
        ctx.fillStyle = '#00f0ff';
        ctx.beginPath();
        ctx.moveTo(center, center - 6);
        ctx.lineTo(center - 4, center + 4);
        ctx.lineTo(center + 4, center + 4);
        ctx.closePath();
        ctx.fill();

        // 4. Draw enemies relative to player position and yaw rotation
        const pPos = this.player.position;
        const pYaw = this.player.yaw;
        const radarRange = 40.0; // matches radar radius distance in 3D

        this.enemies.enemies.forEach(e => {
            // Offset position vector
            const dx = e.position.x - pPos.x;
            const dz = e.position.z - pPos.z;

            // Rotate relative to player look angle (yaw) so player is always facing UP on radar
            const rx = dx * Math.cos(-pYaw) - dz * Math.sin(-pYaw);
            const rz = dx * Math.sin(-pYaw) + dz * Math.cos(-pYaw);

            // Scale to radar canvas size
            const canvasX = center + (rx / radarRange) * radius;
            const canvasY = center - (rz / radarRange) * radius; // subtract because z is positive forward but y is positive down

            // Clip boundaries
            if (canvasX >= 0 && canvasX <= w && canvasY >= 0 && canvasY <= h) {
                // Red glowing dot for trader robots
                ctx.fillStyle = '#ff3131';
                ctx.shadowColor = '#ff3131';
                ctx.shadowBlur = 6;
                ctx.beginPath();
                ctx.arc(canvasX, canvasY, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        // 5. Draw gold rewards particles
        this.particles.particles.forEach(p => {
            const dx = p.pos.x - pPos.x;
            const dz = p.pos.z - pPos.z;

            const rx = dx * Math.cos(-pYaw) - dz * Math.sin(-pYaw);
            const rz = dx * Math.sin(-pYaw) + dz * Math.cos(-pYaw);

            const canvasX = center + (rx / radarRange) * radius;
            const canvasY = center - (rz / radarRange) * radius;

            if (canvasX >= 0 && canvasX <= w && canvasY >= 0 && canvasY <= h) {
                // Gold dot for coin/cash rewards
                ctx.fillStyle = '#ffd700';
                ctx.shadowColor = '#ffd700';
                ctx.shadowBlur = 4;
                ctx.beginPath();
                ctx.arc(canvasX, canvasY, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        
        // Reset shadow settings
        ctx.shadowBlur = 0;
    }
}

// Bootstrap game initialization
window.addEventListener('DOMContentLoaded', () => {
    new GameCoordinator();
});
