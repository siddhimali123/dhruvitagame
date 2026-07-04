// Cyberpunk Bounty Hunter Character Controller & Weapon Mechanics
// Handles: WASD player movement, PointerLock aiming, camera tracking, jumping, weapon swapping, and projectile spawning.
import * as THREE from 'three';
import { audio } from './audio.js';

class PlayerController {
    constructor(scene, camera, domElement) {
        this.scene = scene;
        this.camera = camera;
        this.domElement = domElement;

        // Position & Physics state
        this.position = new THREE.Vector3(0, 0, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.speed = 12.0; // normal speed
        this.jumpForce = 7.0;
        this.gravity = -22.0;
        
        this.height = 2.0;
        this.radius = 0.8;
        this.isGrounded = true;
        this.jumpCount = 0;
        this.maxJumps = 2; // Double jump!

        // Dash parameters
        this.canDash = true;
        this.isDashing = false;
        this.dashTimer = 0.0;
        this.dashDuration = 0.25;
        this.dashCooldown = 1.0;
        this.dashSpeedMultiplier = 2.8;

        // Mouse look sensitivity
        this.pitch = 0.0;
        this.yaw = 0.0;
        this.lookSpeed = 0.002;
        
        // Input tracking
        this.keys = { w: false, a: false, s: false, d: false, space: false };
        this.mouseLeft = false;
        this.mouseRight = false;

        // Weapon states
        // 0: Margin Call Blaster, 1: Short Seller Shotgun, 2: Bull Run Rocket Launcher
        this.activeWeaponIndex = 0;
        this.weapons = [
            {
                name: 'MARGIN CALL BLASTER',
                type: 'blaster',
                fireRate: 0.15, // seconds per shot
                maxAmmo: 30,
                ammo: 30,
                reloadTime: 1.2,
                isReloading: false,
                damage: 25,
                bulletSpeed: 90
            },
            {
                name: 'SHORT SELLER SHOTGUN',
                type: 'shotgun',
                fireRate: 0.75,
                maxAmmo: 8,
                ammo: 8,
                reloadTime: 1.8,
                isReloading: false,
                damage: 18, // per coin pellet (fires 6 pellets)
                bulletSpeed: 60
            },
            {
                name: 'BULL RUN ROCKET LAUNCHER',
                type: 'rocket',
                fireRate: 1.2,
                maxAmmo: 4,
                ammo: 4,
                reloadTime: 2.5,
                isReloading: false,
                damage: 120,
                bulletSpeed: 45
            }
        ];
        
        this.fireCooldown = 0.0;
        this.reloadTimer = 0.0;
        this.bullets = [];

        // Player statistics
        this.maxHealth = 100;
        this.health = 100;
        this.score = 0;
        this.kills = 0;
        this.combo = 1;
        this.comboTimer = 0.0;
        
        // Ability state (Market Crash charger)
        this.crashCharge = 100.0; // Starts full
        this.maxCrashCharge = 100.0;
        this.slowMoActive = false;

        // Visual group
        this.meshGroup = new THREE.Group();
        this.scene.add(this.meshGroup);

        this.buildPlayerMesh();
        this.setupInputListeners();
    }

    // Model the bounty hunter character using 3D shapes
    buildPlayerMesh() {
        // Metallic Blue & Cyan highlights
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0x07152b,
            metalness: 0.9,
            roughness: 0.2,
            emissive: 0x051025
        });
        const glowMat = new THREE.MeshStandardMaterial({
            color: 0x00f0ff,
            emissive: 0x00f0ff,
            emissiveIntensity: 2.0
        });
        const visorMat = new THREE.MeshBasicMaterial({
            color: 0x39ff14 // Glowing green visor!
        });

        // 1. Armored Torso (Chest plate)
        const torsoGeo = new THREE.CylinderGeometry(0.5, 0.35, 1.2, 8);
        const torso = new THREE.Mesh(torsoGeo, bodyMat);
        torso.position.y = 1.0;
        torso.castShadow = true;
        torso.receiveShadow = true;
        this.meshGroup.add(torso);

        // Cyber light strip down the back of torso
        const spineGeo = new THREE.BoxGeometry(0.1, 0.9, 0.1);
        const spineGlow = new THREE.Mesh(spineGeo, glowMat);
        spineGlow.position.set(0, 1.0, -0.45);
        this.meshGroup.add(spineGlow);

        // 2. Helmet / Visor
        const headGeo = new THREE.SphereGeometry(0.35, 12, 12);
        const head = new THREE.Mesh(headGeo, bodyMat);
        head.position.y = 1.8;
        head.castShadow = true;
        this.meshGroup.add(head);

        const visorGeo = new THREE.BoxGeometry(0.45, 0.12, 0.35);
        const visor = new THREE.Mesh(visorGeo, visorMat);
        visor.position.set(0, 1.85, 0.22); // front of head
        this.meshGroup.add(visor);

        // 3. Cybernetic Weapon Cannon (Rifle) attached to Right Arm
        this.weaponGroup = new THREE.Group();
        this.weaponGroup.position.set(0.6, 1.0, 0.3); // right shoulder position
        this.meshGroup.add(this.weaponGroup);

        const cannonGeo = new THREE.CylinderGeometry(0.12, 0.1, 1.1, 8);
        cannonGeo.rotateX(Math.PI / 2); // point forward
        const cannon = new THREE.Mesh(cannonGeo, bodyMat);
        cannon.position.set(0, 0, 0.4);
        cannon.castShadow = true;
        this.weaponGroup.add(cannon);

        // Barrel muzzle glow ring
        const muzzleGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.1, 8);
        muzzleGeo.rotateX(Math.PI / 2);
        this.muzzleMesh = new THREE.Mesh(muzzleGeo, glowMat);
        this.muzzleMesh.position.set(0, 0, 0.95);
        this.weaponGroup.add(this.muzzleMesh);

        // 4. Armored legs (procedural cylinders)
        const legGeo = new THREE.CylinderGeometry(0.15, 0.1, 0.8, 6);
        const leftLeg = new THREE.Mesh(legGeo, bodyMat);
        leftLeg.position.set(-0.25, 0.4, 0);
        leftLeg.castShadow = true;
        this.meshGroup.add(leftLeg);

        const rightLeg = leftLeg.clone();
        rightLeg.position.set(0.25, 0.4, 0);
        this.meshGroup.add(rightLeg);
    }

    setupInputListeners() {
        // Keyboard inputs
        window.addEventListener('keydown', (e) => {
            const k = e.key.toLowerCase();
            if (k === 'w' || k === 'arrowup') this.keys.w = true;
            if (k === 'a' || k === 'arrowleft') this.keys.a = true;
            if (k === 's' || k === 'arrowdown') this.keys.s = true;
            if (k === 'd' || k === 'arrowright') this.keys.d = true;
            if (k === ' ') {
                e.preventDefault();
                this.jump();
            }
            if (k === 'shift') this.triggerDash();
            if (k === 'r') this.reloadActiveWeapon();
            if (k === '1' || k === 'q') this.switchWeapon(0);
            if (k === '2' || k === 'e') this.switchWeapon(1);
            if (k === '3') this.switchWeapon(2);
        });

        window.addEventListener('keyup', (e) => {
            const k = e.key.toLowerCase();
            if (k === 'w' || k === 'arrowup') this.keys.w = false;
            if (k === 'a' || k === 'arrowleft') this.keys.a = false;
            if (k === 's' || k === 'arrowdown') this.keys.s = false;
            if (k === 'd' || k === 'arrowright') this.keys.d = false;
        });

        // Mouse click pointer locks & trigger aiming/shooting
        this.domElement.addEventListener('mousedown', (e) => {
            if (document.pointerLockElement !== this.domElement) {
                this.domElement.requestPointerLock();
                return;
            }
            
            if (e.button === 0) this.mouseLeft = true;
            if (e.button === 2) this.mouseRight = true; // right click for slowmo
        });

        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.mouseLeft = false;
            if (e.button === 2) this.mouseRight = false;
        });

        // Pointer Lock Mouse look
        document.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement !== this.domElement) return;

            this.yaw -= e.movementX * this.lookSpeed;
            this.pitch -= e.movementY * this.lookSpeed;

            // Restrict vertical look pitch
            this.pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.pitch));
        });
    }

    jump() {
        if (this.jumpCount < this.maxJumps) {
            this.velocity.y = this.jumpForce;
            this.jumpCount++;
            this.isGrounded = false;
            
            // Retro chime jump effect
            audio.playCoinPickup();
        }
    }

    triggerDash() {
        if (!this.canDash || this.isDashing) return;
        
        this.isDashing = true;
        this.canDash = false;
        this.dashTimer = this.dashDuration;

        // Reset dash cooldown
        setTimeout(() => { this.canDash = true; }, this.dashCooldown * 1000);
        audio.playShootRocket(); // boost rocket sound
    }

    switchWeapon(index) {
        if (index === this.activeWeaponIndex || index >= this.weapons.length) return;
        
        // Interrupt reloading
        this.weapons[this.activeWeaponIndex].isReloading = false;
        this.activeWeaponIndex = index;
        
        // Glow barrel weapon specific color
        const glowColors = [0x00f0ff, 0xffd700, 0x39ff14];
        this.muzzleMesh.material.color.setHex(glowColors[index]);
        this.muzzleMesh.material.emissive.setHex(glowColors[index]);

        audio.playWeaponSwitch();
        this.updateHUDWeapon();
    }

    reloadActiveWeapon() {
        const weapon = this.weapons[this.activeWeaponIndex];
        if (weapon.isReloading || weapon.ammo === weapon.maxAmmo) return;
        
        weapon.isReloading = true;
        this.reloadTimer = weapon.reloadTime;
        audio.playWeaponSwitch();
    }

    takeDamage(amount) {
        this.health -= amount;
        this.health = Math.max(0, this.health);
        
        // Trigger damage flash overlay
        const flash = document.getElementById('damage-vignette');
        if (flash) {
            flash.classList.add('damage');
            setTimeout(() => { flash.classList.remove('damage'); }, 150);
        }

        // Play damage sound
        audio.playPlayerDamage();
        
        // Interrupt multiplier/combo
        this.combo = 1;
        this.updateHUDHealth();
    }

    addScore(amount) {
        const multiplied = amount * this.combo;
        this.score += multiplied;
        
        // Maintain combo
        this.comboTimer = 5.0; // 5 seconds combo window
        
        this.updateHUDScore();
    }

    incrementKills() {
        this.kills++;
        
        // Increase combo multiplier
        this.combo++;
        this.combo = Math.min(10, this.combo); // cap at 10x
        this.comboTimer = 5.0;
        
        // Recharge some market crash capital
        this.crashCharge = Math.min(this.maxCrashCharge, this.crashCharge + 15.0);
    }

    // --- GAME ENGINE UPDATE STEP ---
    update(dt, worldCandlesticks) {
        // Slow-mo coefficient
        const timeScale = this.slowMoActive ? 0.25 : 1.0;

        // 1. Double Jump / Dash timers
        if (this.isDashing) {
            this.dashTimer -= dt;
            if (this.dashTimer <= 0) {
                this.isDashing = false;
            }
        }

        // 2. Slow-motion Right-Click activation
        if (this.mouseRight && this.crashCharge > 0) {
            if (!this.slowMoActive) {
                this.slowMoActive = true;
                audio.playSlowMo(true);
                document.getElementById('slowmo-overlay').classList.add('active');
                document.getElementById('cinematic-bars').classList.remove('hidden');
                document.getElementById('cinematic-bars').classList.add('active');
            }
            // Consume charge over time
            this.crashCharge -= dt * 35.0 * timeScale; 
            if (this.crashCharge <= 0) {
                this.crashCharge = 0;
                this.deactivateSlowMo();
            }
        } else {
            if (this.slowMoActive) {
                this.deactivateSlowMo();
            }
            // Regenerate charge slowly when not in use
            if (!this.mouseRight && this.crashCharge < this.maxCrashCharge) {
                this.crashCharge = Math.min(this.maxCrashCharge, this.crashCharge + dt * 10.0 * timeScale);
            }
        }

        // 3. Combo decay timer
        if (this.comboTimer > 0) {
            this.comboTimer -= dt * timeScale;
            if (this.comboTimer <= 0) {
                this.combo = 1;
                document.getElementById('combo-container').classList.add('hidden');
            } else {
                const comboContainer = document.getElementById('combo-container');
                comboContainer.classList.remove('hidden');
                document.getElementById('combo-val').innerText = `x${this.combo}`;
            }
        }

        // 4. Movement math
        // Calculate move vector relative to camera look angle
        const moveVector = new THREE.Vector3(0, 0, 0);
        if (this.keys.w) moveVector.z += 1;
        if (this.keys.s) moveVector.z -= 1;
        if (this.keys.a) moveVector.x += 1;
        if (this.keys.d) moveVector.x -= 1;
        
        moveVector.normalize();

        // Project movement on camera horizontal yaw direction
        const yawEuler = new THREE.Euler(0, this.yaw, 0, 'YXZ');
        moveVector.applyEuler(yawEuler);

        // Apply Speed & Dash boost
        let currentSpeed = this.speed;
        if (this.isDashing) {
            currentSpeed *= this.dashSpeedMultiplier;
        }
        
        this.velocity.x = moveVector.x * currentSpeed;
        this.velocity.z = moveVector.z * currentSpeed;

        // Apply gravity
        this.velocity.y += this.gravity * dt * timeScale;
        
        // Update horizontal position
        const deltaPos = this.velocity.clone().multiplyScalar(dt * timeScale);
        
        // Prevent moving outside play area borders
        const bound = 48.0;
        const targetPos = this.position.clone().add(deltaPos);
        if (Math.abs(targetPos.x) < bound) this.position.x = targetPos.x;
        if (Math.abs(targetPos.z) < bound) this.position.z = targetPos.z;
        this.position.y = targetPos.y; // height updated below with collision check

        // 5. Floor & Candlestick platform Collisions
        let platformY = 0;
        let onPlatform = false;

        // Playable area boundary collision check with candlesticks boxes
        const playerBBox = new THREE.Box3(
            new THREE.Vector3(this.position.x - this.radius, this.position.y, this.position.z - this.radius),
            new THREE.Vector3(this.position.x + this.radius, this.position.y + this.height, this.position.z + this.radius)
        );

        worldCandlesticks.forEach(c => {
            if (playerBBox.intersectsBox(c.bbox)) {
                // If player is falling onto the top of the candle
                const candleTop = c.mesh.position.y + c.size.y/2;
                if (this.position.y >= candleTop - 0.6 && this.velocity.y <= 0) {
                    platformY = candleTop;
                    onPlatform = true;
                } else {
                    // Push player out horizontally if hit sides
                    const overlap = playerBBox.clone().intersect(c.bbox);
                    const size = new THREE.Vector3();
                    overlap.getSize(size);
                    
                    if (size.x < size.z) {
                        // push along x axis
                        const pushSign = this.position.x > c.mesh.position.x ? 1 : -1;
                        this.position.x += size.x * pushSign;
                    } else {
                        // push along z axis
                        const pushSign = this.position.z > c.mesh.position.z ? 1 : -1;
                        this.position.z += size.z * pushSign;
                    }
                }
            }
        });

        // Resolve landing
        if (this.position.y <= platformY) {
            this.position.y = platformY;
            this.velocity.y = 0;
            this.isGrounded = true;
            this.jumpCount = 0;
        }

        // Sync player visual model position and rotation
        this.meshGroup.position.copy(this.position);
        this.meshGroup.rotation.y = this.yaw;

        // Weapon tilt aiming (vertically aligned with pitch)
        this.weaponGroup.rotation.x = this.pitch;

        // 6. Camera Follow Behind Player (TPS view)
        const cameraDistance = 5.0;
        const cameraHeight = 2.2;
        
        // Calculate offset vector relative to player rotation
        const offset = new THREE.Vector3(0, cameraHeight, -cameraDistance);
        offset.applyEuler(new THREE.Euler(this.pitch * 0.4, this.yaw, 0, 'YXZ')); // slightly dampen vertical pitch camera tilt

        const desiredCamPos = this.position.clone().add(offset);
        this.camera.position.lerp(desiredCamPos, 0.15); // smooth tracking camera

        // Make camera look at character head / center crosshair target slightly above player
        const targetLookAt = this.position.clone().add(new THREE.Vector3(0, 1.4, 0));
        
        // Adjust camera target offset based on yaw/pitch
        const forwardDir = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
        const cameraLookTarget = targetLookAt.add(forwardDir.multiplyScalar(10.0));
        this.camera.lookAt(cameraLookTarget);

        // 7. Weapon Firing & Reload logic
        this.fireCooldown -= dt * timeScale;
        
        const activeWeapon = this.weapons[this.activeWeaponIndex];
        
        if (activeWeapon.isReloading) {
            this.reloadTimer -= dt * timeScale;
            document.getElementById('ammo-count').innerText = "RELOADING...";
            document.getElementById('ammo-bar').style.width = `${((activeWeapon.reloadTime - this.reloadTimer) / activeWeapon.reloadTime) * 100}%`;
            
            if (this.reloadTimer <= 0) {
                activeWeapon.ammo = activeWeapon.maxAmmo;
                activeWeapon.isReloading = false;
                this.updateHUDAmmo();
            }
        } else {
            if (this.mouseLeft && this.fireCooldown <= 0) {
                this.shoot(activeWeapon);
            }
        }

        // 8. Update Bullets Projectiles
        this.updateBullets(dt, timeScale);
        
        // 9. Update UI indicators
        this.updateHUDCharge();
    }

    deactivateSlowMo() {
        this.slowMoActive = false;
        audio.playSlowMo(false);
        document.getElementById('slowmo-overlay').classList.remove('active');
        document.getElementById('cinematic-bars').classList.add('hidden');
        document.getElementById('cinematic-bars').classList.remove('active');
    }

    // Spawn 3D bullet projectiles matching the active weapon config
    shoot(weapon) {
        if (weapon.ammo <= 0) {
            this.reloadActiveWeapon();
            return;
        }

        weapon.ammo--;
        this.fireCooldown = weapon.fireRate;
        this.updateHUDAmmo();

        // Calculate fire position from barrel muzzle
        const muzzleWorldPos = new THREE.Vector3();
        this.muzzleMesh.getWorldPosition(muzzleWorldPos);

        // Aim vector pointing forward from camera
        const aimDir = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ')).normalize();

        // Add a slight weapon recoil animation
        this.weaponGroup.position.z -= 0.15;
        setTimeout(() => { this.weaponGroup.position.z = 0.3; }, 80);

        if (weapon.type === 'blaster') {
            audio.playShootLaser();
            this.spawnBlasterBullet(muzzleWorldPos, aimDir, weapon);
        } else if (weapon.type === 'shotgun') {
            audio.playShootShotgun();
            // Fire spread of 6 coin pellets in a slight cone
            const numPellets = 6;
            for (let i = 0; i < numPellets; i++) {
                const spreadDir = aimDir.clone();
                // Add random spread vectors
                spreadDir.x += (Math.random() - 0.5) * 0.15;
                spreadDir.y += (Math.random() - 0.5) * 0.15;
                spreadDir.z += (Math.random() - 0.5) * 0.15;
                spreadDir.normalize();
                this.spawnShotgunCoin(muzzleWorldPos, spreadDir, weapon);
            }
        } else if (weapon.type === 'rocket') {
            audio.playShootRocket();
            this.spawnRocketArrow(muzzleWorldPos, aimDir, weapon);
        }
    }

    // Bullet Spawner helpers
    spawnBlasterBullet(pos, dir, weapon) {
        const geom = new THREE.SphereGeometry(0.12, 6, 6);
        const mat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.copy(pos);
        this.scene.add(mesh);
        
        // Glowing cyan light trail
        const light = new THREE.PointLight(0x00f0ff, 1.5, 3);
        mesh.add(light);

        this.bullets.push({
            mesh: mesh,
            type: 'blaster',
            dir: dir,
            speed: weapon.bulletSpeed,
            damage: weapon.damage,
            age: 0,
            maxAge: 2.0 // auto-cleanup after 2s
        });
    }

    spawnShotgunCoin(pos, dir, weapon) {
        // Small gold coin cylinder pellet
        const geom = new THREE.CylinderGeometry(0.08, 0.08, 0.02, 6);
        geom.rotateX(Math.PI / 2);
        const mat = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            metalness: 0.9,
            roughness: 0.1,
            emissive: 0x553300
        });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.copy(pos);
        this.scene.add(mesh);

        this.bullets.push({
            mesh: mesh,
            type: 'shotgun_pellet',
            dir: dir,
            speed: weapon.bulletSpeed,
            damage: weapon.damage,
            age: 0,
            maxAge: 1.0 // shotgun has shorter range
        });
    }

    spawnRocketArrow(pos, dir, weapon) {
        // 3D Arrow mesh pointing in fly direction
        const geom = new THREE.ConeGeometry(0.2, 0.9, 5);
        geom.rotateX(Math.PI / 2);
        const mat = new THREE.MeshStandardMaterial({
            color: 0x39ff14,
            emissive: 0x0a5c00,
            emissiveIntensity: 1.5
        });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.copy(pos);
        mesh.lookAt(pos.clone().add(dir));
        this.scene.add(mesh);
        
        const light = new THREE.PointLight(0x39ff14, 2.0, 5);
        mesh.add(light);

        this.bullets.push({
            mesh: mesh,
            type: 'rocket_arrow',
            dir: dir,
            speed: weapon.bulletSpeed,
            damage: weapon.damage,
            age: 0,
            maxAge: 3.0
        });
    }

    // Move bullet meshes, check collisions on world boundary
    updateBullets(dt, timeScale) {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            b.age += dt * timeScale;

            if (b.age >= b.maxAge) {
                this.scene.remove(b.mesh);
                b.mesh.geometry.dispose();
                this.bullets.splice(i, 1);
                continue;
            }

            // Move
            const moveDelta = b.dir.clone().multiplyScalar(b.speed * dt * timeScale);
            b.mesh.position.add(moveDelta);
            
            // Spin coin pellet for visual sparkle
            if (b.type === 'shotgun_pellet') {
                b.mesh.rotation.y += 15.0 * dt * timeScale;
            }

            // Collision check: Hit floor y=0?
            if (b.mesh.position.y <= 0) {
                this.scene.remove(b.mesh);
                b.mesh.geometry.dispose();
                this.bullets.splice(i, 1);
                continue;
            }
        }
    }

    // --- UI UPDATERS ---
    updateHUDHealth() {
        const bar = document.getElementById('health-bar');
        const txt = document.getElementById('health-value');
        const margin = document.getElementById('margin-status');
        
        if (bar && txt) {
            bar.style.width = `${this.health}%`;
            txt.innerText = `${Math.floor(this.health)}%`;
            
            if (this.health <= 30) {
                bar.classList.add('health-low');
                margin.innerText = 'WARNING: MARGIN CALL!';
                margin.className = 'text-red';
            } else {
                bar.classList.remove('health-low');
                margin.innerText = 'SECURE';
                margin.className = 'text-green';
            }
        }
    }

    updateHUDScore() {
        const scoreVal = document.getElementById('score-val');
        if (scoreVal) {
            // pad with zeroes
            scoreVal.innerText = String(this.score).padStart(6, '0');
        }
    }

    updateHUDAmmo() {
        const weapon = this.weapons[this.activeWeaponIndex];
        const ammoCount = document.getElementById('ammo-count');
        const ammoBar = document.getElementById('ammo-bar');
        
        if (ammoCount && ammoBar) {
            ammoCount.innerText = `${weapon.ammo} / ${weapon.maxAmmo}`;
            ammoBar.style.width = `${(weapon.ammo / weapon.maxAmmo) * 100}%`;
        }
    }

    updateHUDWeapon() {
        const weaponName = document.getElementById('weapon-name');
        if (weaponName) {
            weaponName.innerText = this.weapons[this.activeWeaponIndex].name;
        }
        this.updateHUDAmmo();
    }

    updateHUDCharge() {
        const chargeBar = document.getElementById('crash-charge-bar');
        const chargeStatus = document.getElementById('crash-charge-status');
        
        if (chargeBar && chargeStatus) {
            chargeBar.style.width = `${this.crashCharge}%`;
            if (this.crashCharge >= 100.0) {
                chargeStatus.innerText = 'CRASH READY (RIGHT-CLICK)';
                chargeBar.classList.add('ready-glow');
            } else if (this.slowMoActive) {
                chargeStatus.innerText = 'CRASH ACTIVE!';
                chargeBar.classList.remove('ready-glow');
            } else {
                chargeStatus.innerText = `CHARGING: ${Math.floor(this.crashCharge)}%`;
                chargeBar.classList.remove('ready-glow');
            }
        }
    }

    reset() {
        this.health = 100;
        this.score = 0;
        this.kills = 0;
        this.combo = 1;
        this.comboTimer = 0.0;
        this.crashCharge = 100.0;
        this.slowMoActive = false;
        
        // Reset weapon ammo
        this.weapons.forEach(w => {
            w.ammo = w.maxAmmo;
            w.isReloading = false;
        });

        // Clear bullets
        this.bullets.forEach(b => this.scene.remove(b.mesh));
        this.bullets = [];

        this.position.set(0, 0.5, 0);
        this.velocity.set(0, 0, 0);
        this.yaw = 0;
        this.pitch = 0;

        this.updateHUDHealth();
        this.updateHUDScore();
        this.updateHUDWeapon();
    }
}

export default PlayerController;
