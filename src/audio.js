// Procedural Audio Synthesizer using Web Audio API
// Generates cyberpunk sound effects and dynamic background music loops completely in code.

class AudioManager {
    constructor() {
        this.ctx = null;
        this.masterVolume = null;
        this.musicVolume = null;
        this.sfxVolume = null;
        
        this.enabled = true;
        this.musicPlaying = false;
        
        // Music sequencer parameters
        this.tempo = 120; // BPM
        this.noteLength = 60 / this.tempo / 4; // Sixteenth note duration
        this.schedulerTimer = null;
        this.nextNoteTime = 0.0;
        this.currentBeat = 0;
        
        // Cyberpunk bassline notes (frequencies in Hz)
        // Root notes: E1, G1, A1, C2
        this.bassNotes = [
            41.20, 41.20, 41.20, 41.20,
            49.00, 49.00, 49.00, 49.00,
            55.00, 55.00, 55.00, 55.00,
            65.41, 65.41, 65.41, 55.00
        ];
        
        // Arpeggiator synth melody notes
        // Scale: E Minor Pentatonic
        this.melodyNotes = [
            0, 329.63, 0, 392.00, 0, 440.00, 0, 587.33,
            0, 587.33, 440.00, 392.00, 329.63, 0, 293.66, 0
        ];
    }

    init() {
        if (this.ctx) return;
        
        // Create context
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        
        // Setup gain nodes for routing
        this.masterVolume = this.ctx.createGain();
        this.masterVolume.gain.value = 0.4; // Master volume
        this.masterVolume.connect(this.ctx.destination);
        
        this.musicVolume = this.ctx.createGain();
        this.musicVolume.gain.value = 0.5; // Music volume
        this.musicVolume.connect(this.masterVolume);
        
        this.sfxVolume = this.ctx.createGain();
        this.sfxVolume.gain.value = 0.8; // SFX volume
        this.sfxVolume.connect(this.masterVolume);
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleAudio() {
        this.enabled = !this.enabled;
        if (this.masterVolume) {
            this.masterVolume.gain.value = this.enabled ? 0.4 : 0.0;
        }
        return this.enabled;
    }

    // --- SOUND EFFECTS (SFX) GENERATION ---

    // 1. Margin Call Blaster Shoot (Laser)
    playShootLaser() {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.12);
        
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        
        // Cyberpunk styling: Bandpass filter for digital "laser beam" feel
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1000, now);
        filter.frequency.exponentialRampToValueAtTime(200, now + 0.12);
        filter.Q.value = 3.0;

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxVolume);
        
        osc.start(now);
        osc.stop(now + 0.13);
    }

    // 2. Short Seller Shotgun Shoot (Coin Spray)
    playShootShotgun() {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        const now = this.ctx.currentTime;
        const duration = 0.25;
        
        // Multi-oscillator cluster for heavy metal shot
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const noise = this.createNoiseNode(duration);
        const gain = this.ctx.createGain();
        
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(180, now);
        osc1.frequency.exponentialRampToValueAtTime(40, now + duration);

        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(350, now);
        osc2.frequency.exponentialRampToValueAtTime(60, now + duration);
        
        // Lowpass filter for punchy explosion feel
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, now);
        filter.frequency.exponentialRampToValueAtTime(100, now + duration);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc1.connect(filter);
        osc2.connect(filter);
        if (noise) noise.connect(filter);
        
        filter.connect(gain);
        gain.connect(this.sfxVolume);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + duration);
        osc2.stop(now + duration);
    }

    // 3. Bull Run Rocket Launch (Arrow Projectile)
    playShootRocket() {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        const now = this.ctx.currentTime;
        const duration = 0.4;
        
        const osc = this.ctx.createOscillator();
        const noise = this.createNoiseNode(duration);
        const gain = this.ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + duration); // sweeps up!

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(120, now);
        filter.frequency.exponentialRampToValueAtTime(600, now + duration);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(filter);
        if (noise) noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxVolume);

        osc.start(now);
        osc.stop(now + duration);
    }

    // Helper: Generate white noise buffer
    createNoiseNode(duration) {
        if (!this.ctx) return null;
        
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noiseNode = this.ctx.createBufferSource();
        noiseNode.buffer = buffer;
        noiseNode.start(this.ctx.currentTime);
        return noiseNode;
    }

    // 4. Explosion SFX (Enemy liquidated)
    playExplosion() {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        const now = this.ctx.currentTime;
        const duration = 0.6;
        
        // Red noise-like filter explosion
        const noise = this.createNoiseNode(duration);
        const subOsc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        subOsc.type = 'triangle';
        subOsc.frequency.setValueAtTime(100, now);
        subOsc.frequency.linearRampToValueAtTime(20, now + duration);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, now);
        filter.frequency.exponentialRampToValueAtTime(40, now + duration);
        filter.Q.value = 1.0;

        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        if (noise) noise.connect(filter);
        subOsc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxVolume);
        
        subOsc.start(now);
        subOsc.stop(now + duration);

        // Add a secondary coin blast pitch to make it sound financial!
        setTimeout(() => this.playCoinBlastChime(), 50);
    }

    playCoinBlastChime() {
        if (!this.enabled || !this.ctx) return;
        const now = this.ctx.currentTime;
        
        // Quick burst of 3 chimes
        for (let i = 0; i < 3; i++) {
            const chimeDelay = i * 0.05;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = 'sine';
            const freq = 1200 + i * 400 + Math.random() * 200;
            osc.frequency.setValueAtTime(freq, now + chimeDelay);
            osc.frequency.exponentialRampToValueAtTime(freq / 2, now + chimeDelay + 0.15);
            
            gain.gain.setValueAtTime(0.12, now + chimeDelay);
            gain.gain.exponentialRampToValueAtTime(0.001, now + chimeDelay + 0.15);
            
            osc.connect(gain);
            gain.connect(this.sfxVolume);
            osc.start(now + chimeDelay);
            osc.stop(now + chimeDelay + 0.16);
        }
    }

    // 5. Coin Collection SFX (Bling!)
    playCoinPickup() {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sine';
        // Classic retro chime: two short notes
        osc.frequency.setValueAtTime(987.77, now); // B5
        osc.frequency.setValueAtTime(1318.51, now + 0.06); // E6
        
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.setValueAtTime(0.18, now + 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        
        osc.connect(gain);
        gain.connect(this.sfxVolume);
        
        osc.start(now);
        osc.stop(now + 0.16);
    }

    // 6. Cash Bundle Collection SFX (Paper Rustle + Chime)
    playCashPickup() {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        const now = this.ctx.currentTime;
        const duration = 0.12;
        const noise = this.createNoiseNode(duration);
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.exponentialRampToValueAtTime(1174.66, now + duration); // D6 sweep
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1000, now);
        
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        
        osc.connect(gain);
        if (noise) noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxVolume);
        
        osc.start(now);
        osc.stop(now + duration);
        
        // Also play a standard coin pickup for extra chime
        setTimeout(() => this.playCoinPickup(), 30);
    }

    // 7. Player Damage SFX (Lost equity!)
    playPlayerDamage() {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.linearRampToValueAtTime(80, now + 0.2);
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 300;

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxVolume);
        
        osc.start(now);
        osc.stop(now + 0.23);
    }

    // 8. Market Crash (Slow-Motion) Activation Sweep
    playSlowMo(active) {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'triangle';
        
        if (active) {
            // Sweep down
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.exponentialRampToValueAtTime(55, now + 0.4);
            // Lower tempo
            this.tempo = 60;
        } else {
            // Sweep up
            osc.frequency.setValueAtTime(55, now);
            osc.frequency.exponentialRampToValueAtTime(440, now + 0.4);
            // Restore tempo
            this.tempo = 120;
        }
        
        this.noteLength = 60 / this.tempo / 4;

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        
        osc.connect(gain);
        gain.connect(this.sfxVolume);
        
        osc.start(now);
        osc.stop(now + 0.41);
    }

    // 9. Weapon Switch SFX (Digital reload/slide)
    playWeaponSwitch() {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.setValueAtTime(600, now + 0.05);
        osc.frequency.setValueAtTime(800, now + 0.1);
        
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        
        osc.connect(gain);
        gain.connect(this.sfxVolume);
        
        osc.start(now);
        osc.stop(now + 0.16);
    }

    // --- MUSIC SEQUENCER ---

    startMusic() {
        if (this.musicPlaying) return;
        this.init();
        this.resume();
        this.musicPlaying = true;
        this.nextNoteTime = this.ctx.currentTime;
        this.currentBeat = 0;
        this.scheduler();
    }

    stopMusic() {
        this.musicPlaying = false;
        if (this.schedulerTimer) {
            clearTimeout(this.schedulerTimer);
        }
    }

    scheduler() {
        if (!this.musicPlaying) return;
        
        // Schedule notes for the next 100ms
        while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
            this.scheduleNote(this.currentBeat, this.nextNoteTime);
            this.advanceBeat();
        }
        
        this.schedulerTimer = setTimeout(() => this.scheduler(), 25);
    }

    advanceBeat() {
        this.currentBeat = (this.currentBeat + 1) % 16;
        this.nextNoteTime += this.noteLength;
    }

    scheduleNote(beat, time) {
        if (!this.enabled || !this.ctx) return;
        
        // Play bass note on selected beats (every 8th note)
        if (beat % 2 === 0) {
            const bassIdx = Math.floor(beat / 2) + (Math.random() > 0.8 ? 1 : 0);
            const freq = this.bassNotes[bassIdx % this.bassNotes.length];
            this.playBassSynth(freq, time);
        }

        // Play melody notes based on sequencer pattern
        const melodyFreq = this.melodyNotes[beat];
        if (melodyFreq > 0 && Math.random() > 0.3) {
            this.playArpSynth(melodyFreq, time);
        }

        // Play procedural drum hit (synthesized hi-hat or kick)
        if (beat % 4 === 0) {
            this.playSynthKick(time);
        } else if (beat % 4 === 2) {
            this.playSynthSnare(time);
        } else {
            this.playSynthHiHat(time);
        }
    }

    // Synth Drum: Kick Drum
    playSynthKick(time) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, time);
        osc.frequency.exponentialRampToValueAtTime(30, time + 0.15);
        
        gain.gain.setValueAtTime(0.35, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
        
        osc.connect(gain);
        gain.connect(this.musicVolume);
        
        osc.start(time);
        osc.stop(time + 0.16);
    }

    // Synth Drum: Snare / Clap
    playSynthSnare(time) {
        const duration = 0.1;
        const noise = this.createNoiseNodeAtTime(duration, time);
        if (!noise) return;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1000, time);
        
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.15, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicVolume);
    }

    // Synth Drum: Hi-Hat
    playSynthHiHat(time) {
        if (Math.random() > 0.5) return; // play sporadically

        const duration = 0.03;
        const noise = this.createNoiseNodeAtTime(duration, time);
        if (!noise) return;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(8000, time);
        
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.06, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicVolume);
    }

    // Helper: White noise at scheduled time
    createNoiseNodeAtTime(duration, time) {
        if (!this.ctx) return null;
        
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noiseNode = this.ctx.createBufferSource();
        noiseNode.buffer = buffer;
        noiseNode.start(time);
        return noiseNode;
    }

    // Bass Synth Node
    playBassSynth(frequency, time) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(frequency, time);
        // Slight detune for fat sound
        osc.detune.setValueAtTime(-10, time);
        
        // Lowpass filter for deep sub bass
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(140, time);
        filter.frequency.exponentialRampToValueAtTime(80, time + this.noteLength * 2);

        gain.gain.setValueAtTime(0.2, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + this.noteLength * 1.8);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicVolume);
        
        osc.start(time);
        osc.stop(time + this.noteLength * 2);
    }

    // Arpeggiated Melody Synth Node
    playArpSynth(frequency, time) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(frequency, time);
        
        // Bandpass filter for digital chirpy vibe
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(frequency * 1.5, time);
        filter.frequency.exponentialRampToValueAtTime(frequency * 0.8, time + this.noteLength * 0.8);
        filter.Q.value = 2.0;

        gain.gain.setValueAtTime(0.07, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + this.noteLength * 0.8);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicVolume);
        
        osc.start(time);
        osc.stop(time + this.noteLength * 0.85);
    }
}

// Export a singleton instance
export const audio = new AudioManager();
export default audio;
