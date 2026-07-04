// Cyberpunk Stock Market 3D World Generation
// Creates: Grid floor, Neon Candlesticks (Green/Red), Holographic Screens, 3D Ticker Arrows, Cyber Skyscrapers
import * as THREE from 'three';

class WorldManager {
    constructor(scene) {
        this.scene = scene;
        this.candlesticks = [];
        this.scrollingBillboards = [];
        this.floatingArrows = [];
        this.holographicLines = [];
        
        // Boundaries for gameplay area
        this.arenaSize = 80; // 80x80 playable area
    }

    buildWorld() {
        // 1. Ambient & Atmospheric Setup
        this.scene.background = new THREE.Color(0x04060b);
        this.scene.fog = new THREE.FogExp2(0x04060b, 0.018);

        // 2. Neon Floor Grid
        // Bottom solid floor for receiving shadows
        const floorGeo = new THREE.PlaneGeometry(200, 200);
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x050811,
            roughness: 0.8,
            metalness: 0.9,
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        // Neon grid lines helper
        const gridHelper = new THREE.GridHelper(200, 100, 0x00f0ff, 0x071e3d);
        gridHelper.position.y = 0.02;
        gridHelper.material.opacity = 0.35;
        gridHelper.material.transparent = true;
        this.scene.add(gridHelper);

        // 3. Lighting System
        // Blue/Green Ambient Light
        const ambientLight = new THREE.AmbientLight(0x0f2042, 1.2);
        this.scene.add(ambientLight);

        // Main Sun/Moon Directional Light (Casts shadows)
        const dirLight = new THREE.DirectionalLight(0x00f0ff, 2.0);
        dirLight.position.set(30, 60, 20);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 150;
        
        const d = 50;
        dirLight.shadow.camera.left = -d;
        dirLight.shadow.camera.right = d;
        dirLight.shadow.camera.top = d;
        dirLight.shadow.camera.bottom = -d;
        dirLight.shadow.bias = -0.0005;
        
        this.scene.add(dirLight);

        // Secondary gold light from opposite side
        const fillLight = new THREE.DirectionalLight(0xffd700, 0.8);
        fillLight.position.set(-30, 40, -20);
        this.scene.add(fillLight);

        // 4. Generate Arena Candlesticks
        this.generateCandlesticks();

        // 5. Generate Holographic Screens
        this.generateHolographicScreens();

        // 6. Generate Cyberpunk Skyline (Skyscrapers)
        this.generateSkyscrapers();

        // 7. Generate Spinning Market Arrows
        this.generateFloatingArrows();
    }

    // Generate green (Bullish) and red (Bearish) candlestick platforms
    generateCandlesticks() {
        const numCandles = 25;
        
        // Share geometries
        const wickGeo = new THREE.CylinderGeometry(0.12, 0.12, 1, 6);
        const wickMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9, roughness: 0.1 });

        for (let i = 0; i < numCandles; i++) {
            // Randomly green or red
            const isGreen = Math.random() > 0.45;
            const color = isGreen ? 0x39ff14 : 0xff3131;
            const emissiveColor = isGreen ? 0x054400 : 0x440000;
            
            // Candle height and width
            const candleHeight = 2 + Math.random() * 8;
            const candleWidth = 1.5 + Math.random() * 2.5;
            const candleDepth = 1.5 + Math.random() * 2.5;
            
            const candleGeo = new THREE.BoxGeometry(candleWidth, candleHeight, candleDepth);
            const candleMat = new THREE.MeshStandardMaterial({
                color: color,
                emissive: emissiveColor,
                emissiveIntensity: 1.5,
                roughness: 0.2,
                metalness: 0.3,
                transparent: true,
                opacity: 0.8
            });

            const candleMesh = new THREE.Mesh(candleGeo, candleMat);
            candleMesh.castShadow = true;
            candleMesh.receiveShadow = true;
            
            // Random placement in arena (avoiding center origin where player spawns)
            let x, z;
            do {
                x = (Math.random() - 0.5) * (this.arenaSize - 10);
                z = (Math.random() - 0.5) * (this.arenaSize - 10);
            } while (Math.sqrt(x*x + z*z) < 12); // Spawning buffer radius

            const y = candleHeight / 2;
            candleMesh.position.set(x, y, z);
            this.scene.add(candleMesh);
            
            // Add candle wick (cylinder sticking out top and bottom)
            const wickHeight = candleHeight * 1.4;
            const wickMesh = new THREE.Mesh(wickGeo, wickMat);
            wickMesh.scale.set(1, wickHeight, 1);
            wickMesh.position.copy(candleMesh.position);
            this.scene.add(wickMesh);

            // Save candlestick details for player/bullet collisions
            this.candlesticks.push({
                mesh: candleMesh,
                bbox: new THREE.Box3().setFromObject(candleMesh),
                isGreen: isGreen,
                size: new THREE.Vector3(candleWidth, candleHeight, candleDepth)
            });
        }
    }

    // Floating semi-transparent neon screens showing graphs
    generateHolographicScreens() {
        const numScreens = 8;
        for (let i = 0; i < numScreens; i++) {
            // Draw a high-tech graph onto a canvas
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 256;
            const ctx = canvas.getContext('2d');
            
            // Neon blue outline
            ctx.strokeStyle = '#00f0ff';
            ctx.lineWidth = 4;
            ctx.strokeRect(0, 0, 512, 256);
            
            // Grid background
            ctx.strokeStyle = 'rgba(0, 240, 255, 0.07)';
            ctx.lineWidth = 1;
            for (let x = 32; x < 512; x += 32) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke();
            }
            for (let y = 32; y < 256; y += 32) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
            }

            // Draw line graph (random walk)
            ctx.strokeStyle = Math.random() > 0.4 ? '#39ff14' : '#ff3131';
            ctx.lineWidth = 6;
            ctx.shadowColor = ctx.strokeStyle;
            ctx.shadowBlur = 12;
            ctx.beginPath();
            
            let curY = 128 + (Math.random() - 0.5) * 100;
            ctx.moveTo(0, curY);
            for (let x = 16; x <= 512; x += 32) {
                curY += (Math.random() - 0.5) * 60;
                curY = Math.max(30, Math.min(220, curY));
                ctx.lineTo(x, curY);
            }
            ctx.stroke();

            // Text text labels
            ctx.font = 'bold 20px "Orbitron"';
            ctx.fillStyle = '#ffd700';
            ctx.shadowBlur = 4;
            ctx.shadowColor = '#ffd700';
            ctx.fillText('NASDAQ: ROBOTX', 30, 40);
            ctx.fillText('MARGIN INDEX', 30, 70);
            
            // Flashing state
            ctx.fillStyle = '#00f0ff';
            ctx.shadowColor = '#00f0ff';
            ctx.fillText('SECURE INTERACTION: OK', 300, 220);

            const texture = new THREE.CanvasTexture(canvas);
            const material = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                opacity: 0.65,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending
            });

            const geom = new THREE.PlaneGeometry(12, 6);
            const mesh = new THREE.Mesh(geom, material);
            
            // Place floaty screens in high arena corners
            const angle = (i / numScreens) * Math.PI * 2;
            const radius = 25 + Math.random() * 10;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            const y = 8 + Math.random() * 6;
            
            mesh.position.set(x, y, z);
            mesh.rotation.y = -angle + Math.PI / 2; // face center
            mesh.rotation.x = 0.1; // slight tilt down
            
            this.scene.add(mesh);
            
            this.scrollingBillboards.push({
                mesh: mesh,
                originalY: y,
                floatSpeed: 0.5 + Math.random() * 0.5,
                floatOffset: Math.random() * 100,
                texture: texture,
                canvas: canvas,
                ctx: ctx,
                graphColor: ctx.strokeStyle,
                tickerCounter: 0
            });
        }
    }

    // Cyber Skyscrapers in the background grid edges
    generateSkyscrapers() {
        const numTowers = 40;
        const towerGeo = new THREE.BoxGeometry(10, 1, 10);
        
        for (let i = 0; i < numTowers; i++) {
            const towerHeight = 40 + Math.random() * 80;
            
            // Custom shader material for windows or procedural window mapping
            // To make it simple and extremely performant, let's use a standard material with window grid bump map/emissive map
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 256;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#010307';
            ctx.fillRect(0, 0, 128, 256);
            
            // Draw rows of windows
            const winColor = Math.random() > 0.5 ? 'rgba(0, 240, 255, 0.4)' : 'rgba(57, 255, 20, 0.4)';
            ctx.fillStyle = winColor;
            for (let y = 10; y < 250; y += 12) {
                for (let x = 8; x < 120; x += 12) {
                    if (Math.random() > 0.25) { // some windows on, some off
                        ctx.fillRect(x, y, 6, 8);
                    }
                }
            }
            
            const texture = new THREE.CanvasTexture(canvas);
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(1, towerHeight / 20); // stretch grid repeats vertically

            const towerMat = new THREE.MeshStandardMaterial({
                color: 0x050912,
                roughness: 0.4,
                metalness: 0.8,
                emissiveMap: texture,
                emissive: 0x00f0ff,
                emissiveIntensity: 0.25
            });

            const mesh = new THREE.Mesh(towerGeo, towerMat);
            mesh.scale.set(1, towerHeight, 1);
            
            // Position skyscrapers in a circular perimeter far outside the playable boundary
            const angle = (i / numTowers) * Math.PI * 2 + (Math.random() - 0.5) * 0.1;
            const radius = 65 + Math.random() * 25;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            
            mesh.position.set(x, towerHeight / 2 - 5, z);
            mesh.rotation.y = Math.random() * Math.PI;
            
            this.scene.add(mesh);
        }
    }

    // Upward-pointing green market arrows and downward red arrows
    generateFloatingArrows() {
        const numArrows = 12;
        
        for (let i = 0; i < numArrows; i++) {
            const isUp = Math.random() > 0.5;
            const color = isUp ? 0x39ff14 : 0xff3131;
            const emissiveColor = isUp ? 0x0a5c00 : 0x5c0000;
            
            // Build a 3D Arrow shape procedurally using ExtrudeGeometry
            const shape = new THREE.Shape();
            // Arrow pointing up
            shape.moveTo(-0.5, -1.0);
            shape.lineTo(0.5, -1.0);
            shape.lineTo(0.5, 0.2);
            shape.lineTo(1.2, 0.2);
            shape.lineTo(0, 1.3); // tip
            shape.lineTo(-1.2, 0.2);
            shape.lineTo(-0.5, 0.2);
            shape.lineTo(-0.5, -1.0);

            const extrudeSettings = {
                depth: 0.4,
                bevelEnabled: true,
                bevelSegments: 2,
                steps: 1,
                bevelSize: 0.05,
                bevelThickness: 0.05
            };

            const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            geom.center(); // align origin to center of mass

            const mat = new THREE.MeshStandardMaterial({
                color: color,
                emissive: emissiveColor,
                emissiveIntensity: 1.0,
                roughness: 0.1,
                metalness: 0.8
            });

            const mesh = new THREE.Mesh(geom, mat);
            
            // Position arrows floaty inside arena
            const x = (Math.random() - 0.5) * (this.arenaSize - 15);
            const z = (Math.random() - 0.5) * (this.arenaSize - 15);
            const y = 3 + Math.random() * 9;
            mesh.position.set(x, y, z);
            
            // Point down if red
            if (!isUp) {
                mesh.rotation.z = Math.PI;
            }

            this.scene.add(mesh);
            this.floatingArrows.push({
                mesh: mesh,
                originalY: y,
                rotSpeed: 0.5 + Math.random() * 0.8,
                floatSpeed: 1.0 + Math.random() * 1.5,
                floatOffset: Math.random() * 100
            });
        }
    }

    // Dynamic animations inside world (Holograms bobbing, ticker updates, arrows spinning)
    update(dt) {
        // 1. Hover/Bob floating holographic screens
        this.scrollingBillboards.forEach(b => {
            b.floatOffset += dt * b.floatSpeed;
            b.mesh.position.y = b.originalY + Math.sin(b.floatOffset) * 0.4;
            
            // Periodically redraw / scroll data on screen texture
            b.tickerCounter += dt;
            if (b.tickerCounter > 0.05) { // 20 fps texture updates
                b.tickerCounter = 0;
                this.updateHoloTexture(b);
            }
        });

        // 2. Rotate and bob floating arrows
        this.floatingArrows.forEach(a => {
            a.floatOffset += dt * a.floatSpeed;
            a.mesh.position.y = a.originalY + Math.sin(a.floatOffset) * 0.5;
            a.mesh.rotation.y += a.rotSpeed * dt;
        });
    }

    // Redraw random stock walks on holo screens
    updateHoloTexture(holo) {
        const ctx = holo.ctx;
        
        // Shift canvas content to left
        const imgData = ctx.getImageData(32, 0, 512 - 32, 256);
        ctx.fillStyle = '#060913';
        ctx.fillRect(0, 0, 512, 256);
        ctx.putImageData(imgData, 0, 0);
        
        // Redraw grid border
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 4;
        ctx.shadowBlur = 0;
        ctx.strokeRect(0, 0, 512, 256);
        
        // Draw last section of line
        ctx.strokeStyle = holo.graphColor;
        ctx.lineWidth = 6;
        ctx.shadowColor = holo.graphColor;
        ctx.shadowBlur = 12;
        
        const lastY = 128 + Math.sin(holo.floatOffset) * 50 + (Math.random() - 0.5) * 40;
        const boundedY = Math.max(30, Math.min(220, lastY));
        
        ctx.beginPath();
        ctx.moveTo(512 - 64, 128); // dummy connecting line
        ctx.lineTo(512 - 32, boundedY);
        ctx.stroke();

        // Write header text
        ctx.font = 'bold 20px "Orbitron"';
        ctx.fillStyle = '#ffd700';
        ctx.shadowBlur = 4;
        ctx.shadowColor = '#ffd700';
        ctx.fillText('NASDAQ: ROBOTX', 30, 40);
        ctx.fillText('MARGIN INDEX', 30, 70);

        holo.texture.needsUpdate = true;
    }
}

export default WorldManager;
