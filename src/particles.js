// Physical Particle System for Stock Market Visual Rewards
// Handles: Bouncing Golden Coins, Floating Cash Bundles, Spinning Profit Tokens, and Ramping Text Popups.
import * as THREE from 'three';
import { audio } from './audio.js';

class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
        this.textSprites = [];
        
        // Pre-create geometries and materials to avoid GC thrashing
        this.coinGeom = new THREE.CylinderGeometry(0.2, 0.2, 0.05, 8);
        this.coinMat = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            metalness: 0.9,
            roughness: 0.1,
            emissive: 0xaa8800,
            emissiveIntensity: 0.4
        });

        this.cashGeom = new THREE.PlaneGeometry(0.4, 0.2);
        this.cashMat = new THREE.MeshStandardMaterial({
            color: 0x39ff14,
            side: THREE.DoubleSide,
            roughness: 0.7,
            metalness: 0.1,
            emissive: 0x0a5500,
            emissiveIntensity: 0.3
        });
        
        // Create canvas for PROFIT texture
        this.profitTexture = this.createProfitTokenTexture();
        this.profitMat = new THREE.SpriteMaterial({
            map: this.profitTexture,
            transparent: true,
            blending: THREE.AdditiveBlending
        });
    }

    createProfitTokenTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        
        // Draw gold circular badge
        const grad = ctx.createRadialGradient(64, 64, 10, 64, 64, 60);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.3, '#ffd700');
        grad.addColorStop(1, 'rgba(15, 10, 0, 0)');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(64, 64, 60, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw '$' in center
        ctx.font = 'bold 64px "Orbitron"';
        ctx.fillStyle = '#060913';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', 64, 64);
        
        // Draw green outline glow
        ctx.strokeStyle = '#39ff14';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(64, 64, 48, 0, Math.PI * 2);
        ctx.stroke();

        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }

    // Spawn a burst of rewards at a position (e.g. enemy death)
    spawnBurst(position, count = 10) {
        const coinCount = Math.floor(count * 0.6);
        const cashCount = Math.floor(count * 0.3);
        const tokenCount = Math.max(1, count - coinCount - cashCount);

        // 1. Coins (Physics-based bouncing cylinders)
        for (let i = 0; i < coinCount; i++) {
            const mesh = new THREE.Mesh(this.coinGeom, this.coinMat);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.position.copy(position);
            
            // Random spin orientation
            mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
            this.scene.add(mesh);

            // Explosive initial velocity
            const theta = Math.random() * Math.PI * 2;
            const horizontalVel = 3 + Math.random() * 5;
            this.particles.push({
                mesh: mesh,
                type: 'coin',
                pos: mesh.position,
                vel: new THREE.Vector3(
                    Math.cos(theta) * horizontalVel,
                    4 + Math.random() * 8, // upward burst
                    Math.sin(theta) * horizontalVel
                ),
                rotVel: new THREE.Vector3(
                    (Math.random() - 0.5) * 15,
                    (Math.random() - 0.5) * 15,
                    (Math.random() - 0.5) * 15
                ),
                bounces: 0,
                age: 0,
                maxAge: 4 + Math.random() * 2,
                magnetized: false
            });
        }

        // 2. Cash Bundles (Floating green planes)
        for (let i = 0; i < cashCount; i++) {
            const mesh = new THREE.Mesh(this.cashGeom, this.cashMat);
            mesh.castShadow = true;
            mesh.position.copy(position);
            mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
            this.scene.add(mesh);

            const theta = Math.random() * Math.PI * 2;
            const horizontalVel = 1 + Math.random() * 3;
            this.particles.push({
                mesh: mesh,
                type: 'cash',
                pos: mesh.position,
                vel: new THREE.Vector3(
                    Math.cos(theta) * horizontalVel,
                    5 + Math.random() * 5,
                    Math.sin(theta) * horizontalVel
                ),
                rotVel: new THREE.Vector3(
                    (Math.random() - 0.5) * 5,
                    (Math.random() - 0.5) * 5,
                    (Math.random() - 0.5) * 5
                ),
                floatOffset: Math.random() * 100,
                age: 0,
                maxAge: 5 + Math.random() * 2,
                magnetized: false
            });
        }

        // 3. Profit Tokens (Spinning billboard sprites)
        for (let i = 0; i < tokenCount; i++) {
            const sprite = new THREE.Sprite(this.profitMat);
            sprite.scale.set(1.2, 1.2, 1.2);
            sprite.position.copy(position);
            this.scene.add(sprite);

            const theta = Math.random() * Math.PI * 2;
            const horizontalVel = 2 + Math.random() * 3;
            this.particles.push({
                mesh: sprite,
                type: 'token',
                pos: sprite.position,
                vel: new THREE.Vector3(
                    Math.cos(theta) * horizontalVel,
                    6 + Math.random() * 4,
                    Math.sin(theta) * horizontalVel
                ),
                rotVel: new THREE.Vector3(0, 0, (Math.random() - 0.5) * 8),
                age: 0,
                maxAge: 6 + Math.random() * 2,
                magnetized: false
            });
        }

        // 4. Floating indicator text popup
        const textOptions = ['+PROFIT!', '+$250', 'BUY!', 'MARGIN RECLAIMED', '+$500', 'BULL RUN!'];
        const textStr = textOptions[Math.floor(Math.random() * textOptions.length)];
        this.spawnTextSprite(position, textStr);
    }

    // Spawn floating HTML canvas-rendered text in 3D scene
    spawnTextSprite(position, text) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        ctx.font = 'bold 36px "Orbitron"';
        // Green and gold texts depending on contents
        const color = text.includes('PROFIT') || text.includes('$') || text.includes('BULL') ? '#ffd700' : '#39ff14';
        
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Add cyber glow shadow
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        
        ctx.fillText(text, 128, 32);

        const texture = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            blending: THREE.AdditiveBlending
        });

        const sprite = new THREE.Sprite(mat);
        sprite.position.copy(position);
        sprite.position.y += 1.5; // Hover slightly above death point
        sprite.scale.set(2.5, 0.625, 1);
        
        this.scene.add(sprite);

        this.textSprites.push({
            sprite: sprite,
            velY: 1.5,
            age: 0,
            maxAge: 1.5 // fades out quickly
        });
    }

    // Update particle velocities, positions, bounces, and collection magnet towards player
    update(dt, playerPos, scoreCallback) {
        const gravity = -9.8;
        const attractionRadius = 8.0; // range at which coins get sucked into player
        const collectRadius = 1.2;

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.age += dt;

            if (p.age >= p.maxAge) {
                this.scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                // do not dispose shared materials
                this.particles.splice(i, 1);
                continue;
            }

            // Magnet logic: If player is close, pull particle towards player
            const distToPlayer = p.pos.distanceTo(playerPos);
            if (distToPlayer < attractionRadius) {
                p.magnetized = true;
            }

            if (p.magnetized) {
                // Vector pointing from particle to player center
                const target = playerPos.clone().add(new THREE.Vector3(0, 1.0, 0)); // head/chest level
                const dir = target.sub(p.pos).normalize();
                
                // Accelerate towards player
                const speed = 20.0 + (p.age * 5); // accelerates over time
                p.vel.copy(dir.multiplyScalar(speed));
                
                // Rotation velocity increases as it gets sucked in
                p.rotVel.multiplyScalar(1.05);

                // Collect collision
                if (distToPlayer < collectRadius) {
                    this.scene.remove(p.mesh);
                    p.mesh.geometry.dispose();
                    this.particles.splice(i, 1);

                    // Add currency value & play audio chime
                    if (p.type === 'coin') {
                        audio.playCoinPickup();
                        scoreCallback(100);
                    } else if (p.type === 'cash') {
                        audio.playCashPickup();
                        scoreCallback(250);
                    } else {
                        audio.playCoinPickup();
                        scoreCallback(500);
                    }
                    continue;
                }
            } else {
                // Apply normal physics (gravity)
                if (p.type === 'coin') {
                    p.vel.y += gravity * dt;
                    p.pos.addScaledVector(p.vel, dt);
                    
                    // Rotation update
                    p.mesh.rotateOnAxis(new THREE.Vector3(1,0,0), p.rotVel.x * dt);
                    p.mesh.rotateOnAxis(new THREE.Vector3(0,1,0), p.rotVel.y * dt);
                    p.mesh.rotateOnAxis(new THREE.Vector3(0,0,1), p.rotVel.z * dt);
                    
                    // Bounce on floor (floor is at y=0)
                    if (p.pos.y < 0.1) {
                        p.pos.y = 0.1;
                        if (p.bounces < 3) {
                            p.vel.y = -p.vel.y * 0.55; // bounce energy loss
                            p.vel.x *= 0.7;
                            p.vel.z *= 0.7;
                            p.rotVel.multiplyScalar(0.6);
                            p.bounces++;
                        } else {
                            p.vel.set(0, 0, 0);
                            p.rotVel.set(0, 0, 0);
                        }
                    }
                } else if (p.type === 'cash') {
                    // Leaves/Paper air resistance: floats down slower
                    p.vel.y += gravity * 0.4 * dt;
                    // Add wind drift
                    p.floatOffset += dt * 4.0;
                    p.vel.x = Math.sin(p.floatOffset) * 1.5;
                    p.vel.z = Math.cos(p.floatOffset) * 1.5;
                    
                    p.pos.addScaledVector(p.vel, dt);

                    // Slowly rotate plane to look like falling paper
                    p.mesh.rotation.x = Math.sin(p.floatOffset) * 0.8;
                    p.mesh.rotation.y += p.rotVel.y * dt;

                    if (p.pos.y < 0.1) {
                        p.pos.y = 0.1;
                        p.vel.set(0,0,0);
                    }
                } else if (p.type === 'token') {
                    // Glowing badge flies up and floats in midair
                    p.vel.y += gravity * 0.25 * dt;
                    p.pos.addScaledVector(p.vel, dt);
                    
                    // Hover in midair once it loses upward momentum
                    if (p.vel.y < 0 && p.pos.y > 1) {
                        p.vel.y = Math.sin(p.age * 5.0) * 0.2; // gentle float
                    }
                    if (p.pos.y < 0.2) {
                        p.pos.y = 0.2;
                        p.vel.set(0,0,0);
                    }
                    
                    // Rotate the sprite texture angle (z-rotation for sprite material)
                    p.mesh.material.rotation += p.rotVel.z * dt;
                }
            }

            // Sync visual mesh position
            p.mesh.position.copy(p.pos);
        }

        // Update floating texts
        for (let i = this.textSprites.length - 1; i >= 0; i--) {
            const t = this.textSprites[i];
            t.age += dt;

            if (t.age >= t.maxAge) {
                this.scene.remove(t.sprite);
                t.sprite.material.map.dispose();
                t.sprite.material.dispose();
                this.textSprites.splice(i, 1);
                continue;
            }

            // Move upwards
            t.sprite.position.y += t.velY * dt;
            
            // Fade out
            const lifeRatio = t.age / t.maxAge;
            t.sprite.material.opacity = 1.0 - lifeRatio;
            t.sprite.scale.set(
                2.5 * (1.0 + lifeRatio * 0.2), // grow slightly
                0.625 * (1.0 + lifeRatio * 0.2),
                1
            );
        }
    }

    clear() {
        // Clear all arrays
        this.particles.forEach(p => {
            this.scene.remove(p.mesh);
            p.mesh.geometry.dispose();
        });
        this.particles = [];

        this.textSprites.forEach(t => {
            this.scene.remove(t.sprite);
            t.sprite.material.map.dispose();
            t.sprite.material.dispose();
        });
        this.textSprites = [];
    }
}

export default ParticleSystem;
