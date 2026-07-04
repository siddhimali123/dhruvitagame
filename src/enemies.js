// AI Trader Robots Classes
// Handles: Day Trader (standard), Bear Trader (heavy homing), Short Squeezer (fast charging),
// pathfinding, targeting, health systems, above-head profit badges, and custom enemy bullets.
import * as THREE from 'three';
import { audio } from './audio.js';

class EnemyManager {
    constructor(scene, particles) {
        this.scene = scene;
        this.particles = particles;
        
        this.enemies = [];
        this.enemyBullets = [];
        
        this.spawnTimer = 0.0;
        this.spawnInterval = 3.5; // seconds between spawns
        this.maxEnemies = 15;
        this.waveMultiplier = 1.0;

        // Shared geometries/materials for bullets to optimize
        this.bulletGeom = new THREE.SphereGeometry(0.18, 6, 6);
        this.bulletMat = new THREE.MeshBasicMaterial({ color: 0xff3131 }); // red bad trades
        
        this.heavyBulletGeom = new THREE.DodecahedronGeometry(0.3, 1);
        this.heavyBulletMat = new THREE.MeshStandardMaterial({
            color: 0xff3131,
            emissive: 0x660000,
            emissiveIntensity: 2.0,
            roughness: 0.1
        });
    }

    // Spawn random AI trader robots based on position
    spawnEnemy(playerPos) {
        if (this.enemies.length >= this.maxEnemies) return;

        // Choose a spawn point outside a radius around the player
        const spawnRadius = 25 + Math.random() * 15;
        const angle = Math.random() * Math.PI * 2;
        const x = playerPos.x + Math.cos(angle) * spawnRadius;
        const z = playerPos.z + Math.sin(angle) * spawnRadius;
        const y = 1.0; // spawn slightly above ground
        
        // Boundaries checks
        const bound = 45.0;
        const boundedX = Math.max(-bound, Math.min(bound, x));
        const boundedZ = Math.max(-bound, Math.min(bound, z));
        const spawnPos = new THREE.Vector3(boundedX, y, boundedZ);

        // Randomize enemy type
        // 60% Day Trader, 25% Short Squeezer, 15% Bear Tank
        const roll = Math.random();
        let enemy;
        
        if (roll < 0.60) {
            enemy = new DayTrader(this.scene, spawnPos);
        } else if (roll < 0.85) {
            enemy = new ShortSqueezer(this.scene, spawnPos);
        } else {
            enemy = new BearTrader(this.scene, spawnPos);
        }

        this.scene.add(enemy.meshGroup);
        this.enemies.push(enemy);
    }

    update(dt, playerController, worldCandlesticks) {
        const timeScale = playerController.slowMoActive ? 0.25 : 1.0;
        const playerPos = playerController.position;

        // 1. Spawning ticker
        this.spawnTimer += dt * timeScale;
        if (this.spawnTimer >= this.spawnInterval) {
            this.spawnTimer = 0;
            this.spawnEnemy(playerPos);
            // Gradually speed up spawns over time
            this.spawnInterval = Math.max(1.8, 3.5 - playerController.score * 0.00005);
        }

        // 2. Update AI robots
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            
            // Damage flashing fadeout
            if (e.damageFlashTimer > 0) {
                e.damageFlashTimer -= dt * timeScale;
                if (e.damageFlashTimer <= 0) {
                    e.setFlash(false);
                }
            }

            // AI specific behavior updates
            const alive = e.update(dt * timeScale, playerPos, (bulletPos, bulletDir, isHoming) => {
                this.spawnEnemyBullet(bulletPos, bulletDir, isHoming);
            }, worldCandlesticks);

            if (!alive) {
                // Remove enemy mesh
                this.scene.remove(e.meshGroup);
                e.dispose();
                this.enemies.splice(i, 1);
                
                // Trigger score and reward particles
                this.particles.spawnBurst(e.position, e.rewardCoins);
                playerController.incrementKills();
                playerController.addScore(e.scoreReward);
                continue;
            }
        }

        // 3. Update Enemy Bullets (Bad Trades)
        for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
            const b = this.enemyBullets[i];
            b.age += dt * timeScale;

            if (b.age >= b.maxAge) {
                this.scene.remove(b.mesh);
                if (!b.isHoming) b.mesh.geometry.dispose(); // Homings share geom
                this.enemyBullets.splice(i, 1);
                continue;
            }

            // Homing tracking logic
            if (b.isHoming) {
                const target = playerPos.clone().add(new THREE.Vector3(0, 1.0, 0));
                const dirToPlayer = target.sub(b.mesh.position).normalize();
                // Slowly rotate bullet direction vector towards player
                b.dir.lerp(dirToPlayer, dt * 2.5 * timeScale).normalize();
                
                // Homing rocket spins
                b.mesh.rotation.x += 5.0 * dt * timeScale;
                b.mesh.rotation.y += 5.0 * dt * timeScale;
            }

            // Move bullet
            b.mesh.position.addScaledVector(b.dir, b.speed * dt * timeScale);

            // Collide with Player?
            const distToPlayer = b.mesh.position.distanceTo(playerPos.clone().add(new THREE.Vector3(0, 1, 0)));
            if (distToPlayer < 1.2) { // Player hit!
                playerController.takeDamage(b.damage);
                
                this.scene.remove(b.mesh);
                if (!b.isHoming) b.mesh.geometry.dispose();
                this.enemyBullets.splice(i, 1);
                continue;
            }

            // Collide with floor or wall?
            if (b.mesh.position.y <= 0.1 || Math.abs(b.mesh.position.x) > 50 || Math.abs(b.mesh.position.z) > 50) {
                this.scene.remove(b.mesh);
                if (!b.isHoming) b.mesh.geometry.dispose();
                this.enemyBullets.splice(i, 1);
                continue;
            }
        }
    }

    // Spawn a bad trade red laser
    spawnEnemyBullet(pos, dir, isHoming = false) {
        let mesh;
        let speed = 25.0;
        let damage = 10;
        let maxAge = 3.0;

        if (isHoming) {
            // Giant inflation bubble
            mesh = new THREE.Mesh(this.heavyBulletGeom, this.heavyBulletMat);
            mesh.castShadow = true;
            
            const light = new THREE.PointLight(0xff3131, 2.0, 4);
            mesh.add(light);
            
            speed = 12.0; // slower homing
            damage = 25; // high damage
            maxAge = 6.0;
        } else {
            // Standard red energy beam
            mesh = new THREE.Mesh(this.bulletGeom, this.bulletMat);
            const light = new THREE.PointLight(0xff3131, 1.0, 2);
            mesh.add(light);
        }

        mesh.position.copy(pos);
        this.scene.add(mesh);

        this.enemyBullets.push({
            mesh: mesh,
            dir: dir.clone(),
            speed: speed,
            damage: damage,
            isHoming: isHoming,
            age: 0,
            maxAge: maxAge
        });
    }

    clear() {
        this.enemies.forEach(e => {
            this.scene.remove(e.meshGroup);
            e.dispose();
        });
        this.enemies = [];

        this.enemyBullets.forEach(b => {
            this.scene.remove(b.mesh);
        });
        this.enemyBullets = [];
    }
}

// --- BASE AI ENEMY CLASS ---
class BaseEnemy {
    constructor(scene, position, typeName) {
        this.scene = scene;
        this.position = position.clone();
        this.typeName = typeName;
        
        // Physics & Attributes
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.speed = 5.0;
        this.health = 50;
        this.maxHealth = 50;
        
        this.scoreReward = 100;
        this.rewardCoins = 8;
        this.damageFlashTimer = 0.0;
        
        this.meshGroup = new THREE.Group();
        this.meshGroup.position.copy(this.position);

        // State trackers
        this.shootCooldown = 1.0 + Math.random() * 2.0;
        this.stateTimer = 0;
        this.wanderAngle = Math.random() * Math.PI * 2;
        this.wanderTimer = 0.0;

        // Subclass constructor must call buildMesh and buildFloatingBadge!
    }

    // Create above-head text billboard
    buildFloatingBadge(text, isGreen = true) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        const color = isGreen ? '#39ff14' : '#ff3131';
        ctx.fillStyle = 'rgba(6, 9, 19, 0.7)';
        ctx.fillRect(0, 0, 128, 64);
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(2, 2, 124, 60);

        ctx.font = 'bold 24px "Orbitron"';
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 64, 32);

        this.badgeTexture = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({
            map: this.badgeTexture,
            transparent: true
        });
        
        this.badgeSprite = new THREE.Sprite(mat);
        this.badgeSprite.position.set(0, 1.8, 0); // hover above head
        this.badgeSprite.scale.set(1.6, 0.8, 1);
        this.meshGroup.add(this.badgeSprite);
    }

    setFlash(active) {
        this.robotMesh.material.color.setHex(active ? 0xffffff : this.baseColor);
        this.robotMesh.material.emissive.setHex(active ? 0xffffff : this.emissiveColor);
        this.robotMesh.material.emissiveIntensity = active ? 4.0 : 1.0;
    }

    hit(damage) {
        this.health -= damage;
        this.damageFlashTimer = 0.1;
        this.setFlash(true);
        
        // Play spark sounds
        audio.playCoinPickup(); // pitch chime
        
        return this.health > 0;
    }

    update(dt, playerPos, fireCallback, worldCandlesticks) {
        if (this.health <= 0) return false;

        // Sync local position variable
        this.position.copy(this.meshGroup.position);
        
        // Badge bobbing animation
        this.badgeSprite.position.y = 1.8 + Math.sin(this.stateTimer * 6.0) * 0.1;
        this.stateTimer += dt;

        // Standard boundary pushing
        const bound = 46.0;
        if (Math.abs(this.position.x) > bound) {
            this.position.x = Math.sign(this.position.x) * bound;
            this.wanderAngle += Math.PI;
        }
        if (Math.abs(this.position.z) > bound) {
            this.position.z = Math.sign(this.position.z) * bound;
            this.wanderAngle += Math.PI;
        }

        // Subclass overrides movement and shooting
        this.aiThink(dt, playerPos, fireCallback, worldCandlesticks);

        // Sync visual mesh
        this.meshGroup.position.copy(this.position);
        return true;
    }

    dispose() {
        this.meshGroup.traverse(node => {
            if (node.isMesh || node.isSprite) {
                if (node.geometry) node.geometry.dispose();
                if (node.material) {
                    if (node.material.map) node.material.map.dispose();
                    node.material.dispose();
                }
            }
        });
        if (this.badgeTexture) this.badgeTexture.dispose();
    }
}

// 1. DAY TRADER DRONE (Standard Fast Floating Robot)
class DayTrader extends BaseEnemy {
    constructor(scene, position) {
        super(scene, position, 'DayTrader');
        
        this.speed = 6.0;
        this.health = 50;
        this.maxHealth = 50;
        this.scoreReward = 150;
        this.rewardCoins = 10;

        this.baseColor = 0x39ff14; // Green theme
        this.emissiveColor = 0x054400;

        this.buildMesh();
        
        const badgeText = Math.random() > 0.5 ? 'BUY ▲' : 'STONK';
        this.buildFloatingBadge(badgeText, true);
    }

    buildMesh() {
        const mat = new THREE.MeshStandardMaterial({
            color: this.baseColor,
            roughness: 0.1,
            metalness: 0.8,
            emissive: this.emissiveColor,
            emissiveIntensity: 1.2
        });

        // Floating spherical core
        const coreGeo = new THREE.SphereGeometry(0.5, 10, 10);
        this.robotMesh = new THREE.Mesh(coreGeo, mat);
        this.robotMesh.position.y = 0.8;
        this.robotMesh.castShadow = true;
        this.meshGroup.add(this.robotMesh);

        // Side wing blasters
        const wingGeo = new THREE.BoxGeometry(0.8, 0.15, 0.25);
        const wingL = new THREE.Mesh(wingGeo, mat);
        wingL.position.set(-0.6, 0.8, 0);
        this.meshGroup.add(wingL);

        const wingR = wingL.clone();
        wingR.position.set(0.6, 0.8, 0);
        this.meshGroup.add(wingR);

        // Jet booster glow at bottom
        const boosterGeo = new THREE.ConeGeometry(0.15, 0.3, 6);
        boosterGeo.rotateX(Math.PI);
        const glowMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
        const booster = new THREE.Mesh(boosterGeo, glowMat);
        booster.position.set(0, 0.4, 0);
        this.meshGroup.add(booster);
    }

    aiThink(dt, playerPos, fireCallback, worldCandlesticks) {
        const distToPlayer = this.position.distanceTo(playerPos);
        
        // 1. Move behavior: wander or orbit player
        if (distToPlayer > 18.0) {
            // Wander towards player
            const dirToPlayer = playerPos.clone().sub(this.position).normalize();
            this.velocity.copy(dirToPlayer.multiplyScalar(this.speed));
        } else {
            // Orbit: circle around player
            const dirToPlayer = playerPos.clone().sub(this.position).normalize();
            const tangent = new THREE.Vector3(-dirToPlayer.z, 0, dirToPlayer.x); // orthogonal vector
            this.velocity.copy(tangent.multiplyScalar(this.speed));
            
            // Add a bit of swaying back and forth
            this.velocity.addScaledVector(dirToPlayer, (distToPlayer - 12.0) * 0.5); 
        }

        // Apply movement
        this.position.addScaledVector(this.velocity, dt);
        
        // Hover bobbing
        this.position.y = 1.0 + Math.sin(this.stateTimer * 4.0) * 0.15;

        // Face player yaw rotation
        const lookTarget = playerPos.clone();
        lookTarget.y = this.position.y;
        this.meshGroup.lookAt(lookTarget);

        // 2. Shoot behavior
        this.shootCooldown -= dt;
        if (this.shootCooldown <= 0 && distToPlayer < 25.0) {
            this.shootCooldown = 2.0 + Math.random() * 1.5;
            
            // Spawn fire target direction vector
            const firePos = this.position.clone().add(new THREE.Vector3(0, 0.8, 0));
            const targetPos = playerPos.clone().add(new THREE.Vector3(0, 0.8, 0)); // aim chest
            const fireDir = targetPos.sub(firePos).normalize();
            
            // Play laser shoot chime on enemy
            fireCallback(firePos, fireDir, false);
        }
    }
}

// 2. BEAR TRADER TANK (Heavy Red Robot that fires homing bubbles)
class BearTrader extends BaseEnemy {
    constructor(scene, position) {
        super(scene, position, 'BearTrader');
        
        this.speed = 3.0;
        this.health = 140;
        this.maxHealth = 140;
        this.scoreReward = 400;
        this.rewardCoins = 22;

        this.baseColor = 0xff3131; // Red theme
        this.emissiveColor = 0x550000;

        this.buildMesh();
        this.buildFloatingBadge('SELL ▼', false);
    }

    buildMesh() {
        const mat = new THREE.MeshStandardMaterial({
            color: this.baseColor,
            roughness: 0.3,
            metalness: 0.6,
            emissive: this.emissiveColor,
            emissiveIntensity: 1.0
        });

        // Large cubic armored chest
        const chestGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
        this.robotMesh = new THREE.Mesh(chestGeo, mat);
        this.robotMesh.position.y = 0.9;
        this.robotMesh.castShadow = true;
        this.meshGroup.add(this.robotMesh);

        // Thick shoulders cylinders
        const shoulderGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.6, 6);
        shoulderGeo.rotateX(Math.PI / 2);
        const shoulderL = new THREE.Mesh(shoulderGeo, mat);
        shoulderL.position.set(-0.8, 0.9, 0);
        this.meshGroup.add(shoulderL);
        
        const shoulderR = shoulderL.clone();
        shoulderR.position.set(0.8, 0.9, 0);
        this.meshGroup.add(shoulderR);

        // Giant cannon barrels
        const cannonGeo = new THREE.CylinderGeometry(0.18, 0.18, 1.0, 6);
        cannonGeo.rotateX(Math.PI / 2);
        const cannon = new THREE.Mesh(cannonGeo, mat);
        cannon.position.set(0, 0.9, 0.6);
        this.meshGroup.add(cannon);
    }

    aiThink(dt, playerPos, fireCallback, worldCandlesticks) {
        const distToPlayer = this.position.distanceTo(playerPos);
        
        // Slowly advance directly towards player
        const dirToPlayer = playerPos.clone().sub(this.position).normalize();
        this.velocity.copy(dirToPlayer.multiplyScalar(this.speed));
        
        // Keep grounded
        this.position.addScaledVector(this.velocity, dt);
        this.position.y = 0.6; // heavy, sits close to grid

        // Rotate face towards player
        const lookTarget = playerPos.clone();
        lookTarget.y = this.position.y;
        this.meshGroup.lookAt(lookTarget);

        // Shoot homing bubble
        this.shootCooldown -= dt;
        if (this.shootCooldown <= 0 && distToPlayer < 30.0) {
            this.shootCooldown = 4.0 + Math.random() * 2.0; // heavy homings are slow to reload
            
            const firePos = this.position.clone().add(new THREE.Vector3(0, 0.9, 1.0));
            const targetPos = playerPos.clone().add(new THREE.Vector3(0, 1.0, 0));
            const fireDir = targetPos.sub(firePos).normalize();
            
            // Fire homing inflation bubble!
            fireCallback(firePos, fireDir, true);
        }
    }
}

// 3. SHORT SQUEEZER (Fast Golden Melee Charging Droid)
class ShortSqueezer extends BaseEnemy {
    constructor(scene, position) {
        super(scene, position, 'ShortSqueezer');
        
        this.speed = 10.0;
        this.health = 60;
        this.maxHealth = 60;
        this.scoreReward = 250;
        this.rewardCoins = 14;

        this.baseColor = 0xffd700; // Gold theme
        this.emissiveColor = 0x553300;

        this.isCharging = false;
        this.chargeTimer = 0.0;

        this.buildMesh();
        this.buildFloatingBadge('SHRT %', true);
    }

    buildMesh() {
        const mat = new THREE.MeshStandardMaterial({
            color: this.baseColor,
            roughness: 0.1,
            metalness: 0.9,
            emissive: this.emissiveColor,
            emissiveIntensity: 1.5
        });

        // Slender tall pyramid/cone chest
        const chestGeo = new THREE.ConeGeometry(0.4, 1.4, 5);
        this.robotMesh = new THREE.Mesh(chestGeo, mat);
        this.robotMesh.position.y = 0.8;
        this.robotMesh.castShadow = true;
        this.meshGroup.add(this.robotMesh);

        // Spikes on head
        const spikeGeo = new THREE.ConeGeometry(0.1, 0.4, 4);
        const spike = new THREE.Mesh(spikeGeo, mat);
        spike.position.set(0, 1.5, 0);
        this.meshGroup.add(spike);

        // Blade limbs
        const bladeGeo = new THREE.BoxGeometry(0.1, 0.6, 0.1);
        this.leftBlade = new THREE.Mesh(bladeGeo, mat);
        this.leftBlade.position.set(-0.4, 0.8, 0.2);
        this.meshGroup.add(this.leftBlade);

        this.rightBlade = this.leftBlade.clone();
        this.rightBlade.position.set(0.4, 0.8, 0.2);
        this.meshGroup.add(this.rightBlade);
    }

    aiThink(dt, playerPos, fireCallback, worldCandlesticks) {
        const distToPlayer = this.position.distanceTo(playerPos);
        
        // Blade swinging animation
        this.leftBlade.rotation.x = Math.sin(this.stateTimer * 15.0) * 0.8;
        this.rightBlade.rotation.x = -Math.sin(this.stateTimer * 15.0) * 0.8;

        if (this.isCharging) {
            this.chargeTimer -= dt;
            
            // Move fast in charge direction
            this.position.addScaledVector(this.velocity, dt);
            
            // Check if hit player during charge
            if (distToPlayer < 1.4) {
                // Deal damage and end charge
                this.isCharging = false;
                this.speed = 10.0;
                audio.playPlayerDamage();
            }

            if (this.chargeTimer <= 0) {
                this.isCharging = false;
                this.speed = 10.0; // reset
            }
        } else {
            // Close in on player
            const dirToPlayer = playerPos.clone().sub(this.position).normalize();
            this.velocity.copy(dirToPlayer.multiplyScalar(this.speed));
            this.position.addScaledVector(this.velocity, dt);

            // Trigger charge if close enough
            if (distToPlayer < 12.0 && Math.random() > 0.98) {
                this.isCharging = true;
                this.chargeTimer = 0.8; // charge for 0.8s
                this.speed = 22.0; // extreme speed!
                this.velocity.copy(dirToPlayer.multiplyScalar(this.speed));
                
                // Play rocket charge sound
                audio.playShootRocket();
            }
        }

        this.position.y = 0.7; // sits on floor

        // Face player
        const lookTarget = playerPos.clone();
        lookTarget.y = this.position.y;
        this.meshGroup.lookAt(lookTarget);
    }
}

export default EnemyManager;
export { EnemyManager };
