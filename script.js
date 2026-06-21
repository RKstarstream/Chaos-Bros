/**
 * CHAOS BROS - Complete Game Engine
 * A chaotic side-scrolling platformer
 * 
 * Architecture:
 * - GameState: Central state management
 * - InputHandler: Keyboard/mouse input
 * - Player: Character classes (Dwayne, Shaq)
 * - Enemy: All enemy types
 * - Platform: Static, moving, falling platforms
 * - Coin: Collectible coins
 * - Projectile: Special ability projectiles
 * - LevelManager: Level generation
 * - MiniGameManager: WarioWare-style challenges
 * - UIManager: HUD and menus
 * - EffectsManager: Visual effects
 * - Game: Main game loop
 */

// ==================== GAME STATE ====================
const GameState = {
    currentLevel: 1,
    score: 0,
    coins: 0,
    lives: 3,
    selectedCharacter: 'dwayne',
    isPaused: false,
    isPlaying: false,
    levelProgress: 0,
    levelLength: 3000,
    cameraX: 0,
    screenShake: 0,
    screenShakeTimer: 0,
    screenShakeActive: false,
    slowMotion: false,
    slowMotionTimer: 0,
    cinematicTransition: false,
    cinematicTimer: 0,
    cinematicType: '',
    cinematicChar: '',
    isFakeDoor: false,
    fakeDoorExitX: 0,
    messages: [],
    cooldowns: {
        dwayne: 0,
        shaq: 0
    },
    maxCooldowns: {
        dwayne: 4000,  // 4 seconds
        shaq: 5000    // 5 seconds
    },
    // Level structure
    levelSections: [],
    // Active lucky blocks
    activeLuckyBlocks: [],
    // Active spikes
    activeSpikes: [],
    // Current level theme (set during level generation)
    levelTheme: null
};

// ==================== INPUT HANDLER ====================
class InputHandler {
    constructor() {
        this.keys = {};
        this.mouse = { x: 0, y: 0, clicked: false };
        this.setupListeners();
    }

    setupListeners() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        window.addEventListener('blur', () => {
            this.keys = {};
        });

        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });

        window.addEventListener('mousedown', () => {
            this.mouse.clicked = true;
        });

        window.addEventListener('mouseup', () => {
            this.mouse.clicked = false;
        });
    }

    isPressed(key) {
        return this.keys[key] || false;
    }

    wasClicked(element) {
        if (!this.mouse.clicked) return false;
        const rect = element.getBoundingClientRect();
        return (
            this.mouse.x >= rect.left &&
            this.mouse.x <= rect.right &&
            this.mouse.y >= rect.top &&
            this.mouse.y <= rect.bottom
        );
    }

    clearClick() {
        this.mouse.clicked = false;
    }
}

// ==================== PLAYER CLASS ====================
class Player {
    constructor(x, y, character, gameRef) {
        this.x = x;
        this.y = y;
        this.width = character === 'dwayne' ? 42 : 62;
        this.height = character === 'dwayne' ? 62 : 82;
        this.velocityX = 0;
        this.velocityY = 0;
        this.speed = character === 'dwayne' ? 4.2 : 3.4;
        this.jumpPower = character === 'dwayne' ? -13 : -11;
        this.gravity = 0.65;
        this.grounded = false;
        this.jumps = 0;
        this.maxJumps = 2; // Double jump
        this.facing = 1; // 1 = right, -1 = left
        this.character = character;
        this.invincible = false;
        this.invincibleTimer = 0;
        this.stunned = false;
        this.stunTimer = 0;
        this.animFrame = 0;
        this.animTimer = 0;
        this.state = 'idle'; // idle, run, jump, fall, stunned
        this.flexAnim = 0;
        this.dunkAnim = 0;
        
        // Health system
        this.health = 3;
        this.maxHealth = 3;
        
        // Movement physics (Mario-style - smoother and more responsive)
        this.acceleration = 3.0;
        this.deceleration = 3.5;
        this.airAcceleration = 1.8;
        this.airDrag = 0.97;
        this.maxFallSpeed = 13;
        this.coyoteTime = 0;
        this.coyoteTimeMax = 120;
        this.jumpBuffered = 0;
        this.jumpBufferTime = 100;
        this.jumpHeld = false;
        this.squashX = 1;
        this.squashY = 1;
        this.squashRecovery = 0.25;
        
        // Camera tracking
        this.cameraTargetX = 0;
        this.cameraLookAhead = 60;
        
        // Reference to game instance
        this.gameRef = gameRef;
    }

    update(dt, platforms) {
        // Handle input
        const input = this.gameRef.input;

        if (this.stunned) {
            this.stunTimer -= dt;
            if (this.stunTimer <= 0) {
                this.stunned = false;
                this.state = 'fall';
            }
            this.velocityX *= 0.98;
        } else {
            // Horizontal movement with acceleration/deceleration
            if (input.isPressed('ArrowLeft') || input.isPressed('KeyA')) {
                if (this.grounded) {
                    this.velocityX -= this.acceleration * (dt / 16);
                    if (this.velocityX < -this.speed) this.velocityX = -this.speed;
                } else {
                    this.velocityX -= this.airAcceleration * (dt / 16);
                    if (this.velocityX < -this.speed * 0.95) this.velocityX = -this.speed * 0.95;
                }
                this.facing = -1;
                this.state = 'run';
            } else if (input.isPressed('ArrowRight') || input.isPressed('KeyD')) {
                if (this.grounded) {
                    this.velocityX += this.acceleration * (dt / 16);
                    if (this.velocityX > this.speed) this.velocityX = this.speed;
                } else {
                    this.velocityX += this.airAcceleration * (dt / 16);
                    if (this.velocityX > this.speed * 0.95) this.velocityX = this.speed * 0.95;
                }
                this.facing = 1;
                this.state = 'run';
            } else {
                // Deceleration when no input - clamp to prevent overshoot past zero
                if (this.grounded) {
                    const decel = this.deceleration * (dt / 16);
                    if (Math.abs(this.velocityX) <= decel) {
                        this.velocityX = 0;
                    } else {
                        this.velocityX -= Math.sign(this.velocityX) * decel;
                    }
                } else {
                    this.velocityX *= this.airDrag;
                    if (Math.abs(this.velocityX) < 0.1) this.velocityX = 0;
                }
                if (this.grounded && Math.abs(this.velocityX) < 0.5) {
                    this.state = 'idle';
                }
            }

            // Jump buffering
            if (input.isPressed('Space') && !this.jumpHeld) {
                this.jumpBuffered = this.jumpBufferTime;
                this.jumpHeld = true;
            }
            if (!input.isPressed('Space')) {
                this.jumpHeld = false;
            }

            // Jump buffer countdown
            if (this.jumpBuffered > 0) {
                this.jumpBuffered -= dt;
            }

            // Coyote time countdown
            if (!this.grounded && this.coyoteTime > 0) {
                this.coyoteTime -= dt;
            }

            // Jump execution
            if (this.jumpBuffered > 0) {
                if (this.coyoteTime > 0 || this.jumps < this.maxJumps) {
                    this.velocityY = this.jumpPower;
                    this.jumps++;
                    this.grounded = false;
                    this.coyoteTime = 0;
                    this.jumpBuffered = 0;
                    this.jumpHeld = false;
                    
                    // Squash and stretch on jump
                    this.squashX = 0.7;
                    this.squashY = 1.3;
                    
                    // Jump particles
                    if (this.coyoteTime > 0 || this.jumps === 1) {
                        EffectsManager.createParticles(this.x + this.width/2, this.y + this.height, 6, 'rgba(255,255,255,0.8)');
                    }
                    
                    // Cool jump animation
                    if (this.jumps > 1) {
                        EffectsManager.addFloatingText('DOUBLE JUMP!', this.x + this.width/2, this.y - 30, '#4ECDC4');
                        EffectsManager.createStarBurst(this.x + this.width/2, this.y + this.height, '#4ECDC4');
                    }
                }
            }

            // Variable jump height - cut velocity when button released early
            if (!input.isPressed('Space') && this.velocityY < 0) {
                this.velocityY *= 0.85;
            }
        }

        // Apply gravity with max fall speed
        this.velocityY += this.gravity * (dt / 16);
        if (this.velocityY > this.maxFallSpeed) {
            this.velocityY = this.maxFallSpeed;
        }

        // Update position (frame-rate independent)
        this.x += this.velocityX * (dt / 16);
        this.y += this.velocityY * (dt / 16);

        // Platform collision
        let landed = false;
        this.grounded = false;
        
        // Calculate previous position for continuous collision detection
        const prevY = this.y - this.velocityY * (dt / 16);
        const prevX = this.x - this.velocityX * (dt / 16);
        const prevBottom = prevY + this.height;
        const prevTop = prevY;
        const currBottom = this.y + this.height;
        const playerLeft = this.x;
        const playerRight = this.x + this.width;
        
        for (const platform of platforms) {
            if (!platform.visible) continue;
            if (platform.isLandmine && platform.exploded) continue;
            
            const platformTop = platform.y;
            const platformBottom = platform.y + platform.height;
            const platformLeft = platform.x;
            const platformRight = platform.x + platform.width;
            
            // Lucky blocks act as full-collision platforms (prevent falling through gaps) and trigger openLuckyBlock
            if (platform.isLuckyBlock && !platform.replacedWithPlatform) {
                // Landing on top
                if (this.velocityY > 0) {
                    const playerBottom = this.y + this.height;
                    const horizontalOverlap = Math.min(playerRight, platformRight) - Math.max(playerLeft, platformLeft);
                    if (horizontalOverlap > 4) {
                        const standardLanding = prevBottom <= platformTop && currBottom >= platformTop;
                        const fastFall = playerBottom > platformTop && playerBottom <= platformTop + Math.max(this.velocityY, 8);
                        if (standardLanding || fastFall) {
                            this.y = platformTop - this.height;
                            this.velocityY = 0;
                            this.grounded = true;
                            this.coyoteTime = this.coyoteTimeMax;
                            this.jumps = 0;
                            if (!platform.used) {
                                this.openLuckyBlock(platform);
                            }
                            continue;
                        }
                    }
                }
                // Overlap resolution (side/ceiling) — keeps the player from falling through gaps
                if (this.checkCollision(this, platform)) {
                    const verticalOverlap = Math.min(this.y + this.height, platformBottom) - Math.max(this.y, platformTop);
                    // Ceiling hit (player hits block from below)
                    if (this.velocityY < 0 && prevBottom >= platformTop) {
                        this.y = platformBottom;
                        this.velocityY = 0;
                        if (!platform.used) {
                            this.openLuckyBlock(platform);
                        }
                    }
                    // Side collision — only when there's meaningful vertical overlap
                    else if (this.velocityX !== 0 && verticalOverlap > 10) {
                        if (this.velocityX > 0 && prevX + this.width <= platformLeft + 4) {
                            this.x = platformLeft - this.width;
                            this.velocityX = 0;
                        } else if (this.velocityX < 0 && prevX >= platformRight - 4) {
                            this.x = platformRight;
                            this.velocityX = 0;
                        }
                    }
                }
                continue;
            }
            
            // === LANDING DETECTION ===
            // Only treat as landing if the player was above the platform last frame
            // and is falling, with meaningful horizontal overlap
            if (this.velocityY > 0 && prevBottom <= platformTop && currBottom >= platformTop) {
                const horizontalOverlap = Math.min(playerRight, platformRight) - Math.max(playerLeft, platformLeft);
                if (horizontalOverlap > 4) {
                    this.y = platformTop - this.height;
                    const landingVelocity = this.velocityY;
                    this.velocityY = 0;
                    this.grounded = true;
                    landed = true;
                    
                    // Coyote time reset
                    this.coyoteTime = this.coyoteTimeMax;
                    
                    // Squash on landing
                    const landImpact = Math.min(landingVelocity / 10, 1);
                    this.squashX = 1 + landImpact * 0.35;
                    this.squashY = 1 - landImpact * 0.35;
                    
                    // Dust effect on landing
                    if (landImpact > 0.2) {
                        EffectsManager.createParticles(
                            this.x + this.width/2, 
                            this.y + this.height, 
                            Math.floor(3 + landImpact * 5), 
                            'rgba(210,180,140,0.8)'
                        );
                    }
                    
                    this.jumps = 0;
                    
                    // Landmine trigger
                    if (platform.isLandmine && !platform.exploded) {
                        this.triggerLandmine(platform);
                    }
                    
                    // Moving platform carry
                    if (platform.moving) {
                        this.x += platform.velocityX || 0;
                    }
                    
                    // Falling platform
                    if (platform.falling && !platform.fallen) {
                        platform.fallTimer = (platform.fallTimer || 0) + dt;
                        if (platform.fallTimer > 500) {
                            platform.fallen = true;
                            platform.visible = false;
                            setTimeout(() => {
                                platform.fallen = false;
                                platform.visible = true;
                                platform.y = platform.originalY + 200;
                            }, 3000);
                        }
                    }
                    
                    if (this.state === 'stunned') {
                        this.stunned = false;
                        this.state = 'flat';
                        this.rotationSpeed = 0;
                    }
                    
                    continue; // Skip to next platform
                }
            }
            
            // === OVERLAP CORRECTION ===
            // If the player is overlapping a platform (from side movement or fast frame),
            // resolve only if the player is NOT falling through it from above.
            if (this.checkCollision(this, platform)) {
                // If player bottom is at or below platform top, skip — they should have
                // been handled by the landing detection above. This prevents side walls
                // from snapping the player when they're falling in a gap.
                if (this.y + this.height >= platformTop && this.y + this.height <= platformTop + 6 && this.velocityY >= 0) {
                    continue;
                }
                
                // Bottom collision (hitting ceiling)
                if (this.velocityY < 0 && prevBottom >= platformTop) {
                    this.y = platformBottom;
                    this.velocityY = 0;
                }
                // Side collisions — only resolve when player is actually moving sideways
                // and there's meaningful vertical overlap (not just brushing a corner)
                else if (this.velocityX !== 0 && this.velocityY <= 0) {
                    const verticalOverlap = Math.min(this.y + this.height, platformBottom) - Math.max(this.y, platformTop);
                    const MIN_VERTICAL_OVERLAP = 10;
                    
                    if (verticalOverlap > MIN_VERTICAL_OVERLAP) {
                        if (this.velocityX > 0 && prevX + this.width <= platformLeft + 4) {
                            this.x = platformLeft - this.width;
                            this.velocityX = 0;
                        }
                        else if (this.velocityX < 0 && prevX >= platformRight - 4) {
                            this.x = platformRight;
                            this.velocityX = 0;
                        }
                    }
                }
            }
        }

        // If not grounded and didn't just land, reset squash
        if (!landed && this.grounded) {
            // Already handled above
        }

        // Fall death
        if (this.y > 800) {
            this.die();
        }

        // Invincibility timer
        if (this.invincible) {
            this.invincibleTimer -= dt;
            if (this.invincibleTimer <= 0) {
                this.invincible = false;
            }
        }

        // Drift guard: kill residual velocity when grounded with no input
        if (this.grounded && Math.abs(this.velocityX) < 0.5 &&
            !input.isPressed('ArrowLeft') && !input.isPressed('KeyA') &&
            !input.isPressed('ArrowRight') && !input.isPressed('KeyD')) {
            this.velocityX = 0;
        }

        // Squash and stretch recovery
        this.squashX += (1 - this.squashX) * this.squashRecovery * (dt / 16);
        this.squashY += (1 - this.squashY) * this.squashRecovery * (dt / 16);

        // Animation
        this.animTimer += dt;
        if (this.animTimer > 100) {
            this.animFrame = (this.animFrame + 1) % 4;
            this.animTimer = 0;
        }

        // Ability animations
        if (this.flexAnim > 0) this.flexAnim -= dt;
        if (this.dunkAnim > 0) this.dunkAnim -= dt;
    }

    useAbility() {
        const cooldown = GameState.cooldowns[this.character];
        if (cooldown > 0) return;

        if (this.character === 'dwayne') {
            // BOULDER THROW - The Rock throws a giant boulder
            GameState.cooldowns[this.character] = GameState.maxCooldowns[this.character];
            this.flexAnim = 1000;

            // Create giant boulder projectile
            const boulder = new Projectile(
                this.x + this.width,
                this.y + this.height - 15,
                10,
                -2,
                'boulder',
                999, // instant kill
                this.gameRef
            );
            boulder.width = 50;
            boulder.height = 50;
            this.gameRef.projectiles.push(boulder);

            // Immediate visual feedback - no pop-up
            EffectsManager.createParticles(this.x + this.width, this.y + this.height / 2, 20, '#7F8C8D');
            EffectsManager.screenShake(12);

            // Rock voice line as floating text (brief, doesn't cover gameplay)
            EffectsManager.addFloatingText('CAN YOU FEEL THE POWER?!', this.x + this.width, this.y - 50, '#FFD700');

        } else if (this.character === 'shaq') {
            // SHAQ GRAB-SPIN-SLAM - Much more dramatic with clear phases
            GameState.cooldowns[this.character] = GameState.maxCooldowns[this.character];
            this.dunkAnim = 2500;
            this.invincible = true;
            this.invincibleTimer = 1500;

            // Find nearest enemy
            let nearestEnemy = null;
            let nearestDist = 200; // Grab range

            for (const enemy of this.gameRef.levelManager.enemies) {
                if (!enemy.alive) continue;
                const dist = Math.sqrt(
                    Math.pow(enemy.x - this.x, 2) + Math.pow(enemy.y - this.y, 2)
                );
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestEnemy = enemy;
                }
            }

            if (nearestEnemy) {
                // Phase 1: Jump toward enemy with directional movement
                const dx = (nearestEnemy.x + nearestEnemy.width / 2) - (this.x + this.width / 2);
                const dy = (nearestEnemy.y + nearestEnemy.height / 2) - (this.y + this.height / 2);
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // Normalize and apply velocity
                const speed = 14;
                this.velocityX = (dx / distance) * speed;
                this.velocityY = -16;
                this.grounded = false;
                this.jumps = 0;
                
                // Face the enemy
                this.facing = dx > 0 ? 1 : -1;

                // Phase 2: Spin effect particles during jump
                for (let i = 0; i < 24; i++) {
                    const angle = (i / 24) * Math.PI * 2;
                    const particle = new Projectile(
                        this.x + this.width / 2,
                        this.y + this.height / 2,
                        Math.cos(angle) * 5,
                        Math.sin(angle) * 5,
                        'shockwave',
                        0,
                        this.gameRef
                    );
                    particle.width = 8;
                    particle.height = 8;
                    this.gameRef.projectiles.push(particle);
                }

                // Phase 3: Massive slam effect when Shaq lands
                setTimeout(() => {
                    if (!this.gameRef.player) return;
                    
                    const player = this.gameRef.player;
                    // Force landing
                    player.velocityY = 0;
                    player.grounded = true;
                    
                    // Squash and stretch on slam
                    player.squashX = 1.4;
                    player.squashY = 0.6;

                    // Shockwave on landing
                    EffectsManager.screenShake(25);
                    EffectsManager.createParticles(
                        player.x + player.width / 2,
                        player.y + player.height,
                        50,
                        '#FF8C00'
                    );
                    EffectsManager.screenFlash(250, '#FF8C00');

                    // Phase 4: Shockwave ring effect - expand outward
                    for (let i = 0; i < 24; i++) {
                        const angle = (i / 24) * Math.PI * 2;
                        const shockwave = new Projectile(
                            player.x + player.width / 2,
                            player.y + player.height,
                            Math.cos(angle) * 10,
                            Math.sin(angle) * 10,
                            'shockwave',
                            0,
                            this.gameRef
                        );
                        shockwave.width = 12;
                        shockwave.height = 12;
                        this.gameRef.projectiles.push(shockwave);
                    }

                    // Defeat all nearby enemies from shockwave
                    for (const enemy of this.gameRef.levelManager.enemies) {
                        if (!enemy.alive) continue;
                        const dist = Math.sqrt(
                            Math.pow(enemy.x - player.x, 2) +
                            Math.pow(enemy.y - player.y, 2)
                        );
                        if (dist < 180) {
                            enemy.alive = false;
                            GameState.score += 100;
                            EffectsManager.createParticles(
                                enemy.x + enemy.width / 2,
                                enemy.y + enemy.height / 2,
                                15,
                                enemy.color
                            );
                            EffectsManager.addFloatingText('BOOM!', enemy.x, enemy.y - 30, '#FF4500');
                        }
                    }

                    EffectsManager.addFloatingText('SHAQ SLAM!', player.x, player.y - 70, '#DC143C');
                    
                    // Reset squash after a moment
                    setTimeout(() => {
                        if (this.gameRef.player) {
                            this.gameRef.player.squashX = 1;
                            this.gameRef.player.squashY = 1;
                        }
                    }, 300);
                }, 600);

                EffectsManager.addFloatingText('SHAQ GRAB!', nearestEnemy.x, nearestEnemy.y - 30, '#DC143C');
            } else {
                // No enemy nearby - just do a powerful ground slam
                this.velocityY = -18;
                this.grounded = false;
                this.jumps = 0;
                
                // Spin effect particles
                for (let i = 0; i < 16; i++) {
                    const angle = (i / 16) * Math.PI * 2;
                    const particle = new Projectile(
                        this.x + this.width / 2,
                        this.y + this.height / 2,
                        Math.cos(angle) * 4,
                        Math.sin(angle) * 4,
                        'shockwave',
                        0,
                        this.gameRef
                    );
                    particle.width = 6;
                    particle.height = 6;
                    this.gameRef.projectiles.push(particle);
                }

                setTimeout(() => {
                    if (!this.gameRef.player) return;
                    
                    const player = this.gameRef.player;
                    player.velocityY = 0;
                    player.grounded = true;
                    
                    // Squash on landing
                    player.squashX = 1.3;
                    player.squashY = 0.7;
                    
                    EffectsManager.screenShake(18);
                    EffectsManager.createParticles(
                        player.x + player.width / 2,
                        player.y + player.height,
                        30,
                        '#FF8C00'
                    );
                    EffectsManager.screenFlash(200, '#FF8C00');

                    for (let i = 0; i < 16; i++) {
                        const angle = (i / 16) * Math.PI * 2;
                        const shockwave = new Projectile(
                            player.x + player.width / 2,
                            player.y + player.height,
                            Math.cos(angle) * 8,
                            Math.sin(angle) * 8,
                            'shockwave',
                            0,
                            this.gameRef
                        );
                        shockwave.width = 10;
                        shockwave.height = 10;
                        this.gameRef.projectiles.push(shockwave);
                    }
                    
                    EffectsManager.addFloatingText('SLAM!', player.x, player.y - 60, '#DC143C');
                    
                    // Reset squash
                    setTimeout(() => {
                        if (this.gameRef.player) {
                            this.gameRef.player.squashX = 1;
                            this.gameRef.player.squashY = 1;
                        }
                    }, 300);
                }, 700);

                EffectsManager.addFloatingText('SHAQ SLAM!', this.x, this.y - 50, '#DC143C');
            }
        }
    }

    openLuckyBlock(platform) {
        if (platform.used) return;
        platform.used = true;
        platform.playerLandedOnTop = true;

        // Apply reward based on block type
        if (platform.reward === 'coin3') {
            GameState.coins += 3;
            GameState.score += 300;
            EffectsManager.addFloatingText('+3 COINS!', platform.x, platform.y - 30, '#FFD700');
            EffectsManager.createCoinSparkle(platform.x + 20, platform.y);
            EffectsManager.createCoinSparkle(platform.x + 10, platform.y);
            EffectsManager.createCoinSparkle(platform.x + 30, platform.y);
            EffectsManager.screenFlash(100, '#FFD700');
            EffectsManager.screenShake(3);
        } else if (platform.reward === 'coin1') {
            GameState.coins++;
            GameState.score += 100;
            EffectsManager.addFloatingText('+1 COIN!', platform.x, platform.y - 30, '#FFD700');
            EffectsManager.createCoinSparkle(platform.x + 20, platform.y);
            EffectsManager.screenFlash(50, '#FFD700');
        } else if (platform.reward === 'powerup') {
            // Give player a temporary speed boost
            this.speed += 1;
            setTimeout(() => { this.speed -= 1; }, 5000);
            EffectsManager.addFloatingText('SPEED UP!', platform.x, platform.y - 30, '#4ECDC4');
            EffectsManager.createParticles(platform.x + 20, platform.y + 20, 15, '#4ECDC4');
            EffectsManager.screenShake(4);
        }

        // Visual feedback - block opens
        EffectsManager.createParticles(platform.x + 20, platform.y + 20, 12, '#F39C12');
        
        // Replace with solid platform block after animation
        setTimeout(() => {
            platform.replacedWithPlatform = true;
            platform.platformType = 'static';
            platform.platformColor = '#8B7355';
            // Keep isLuckyBlock true so this object remains handled by the lucky block render path
        }, 300);

        UIManager.updateHUD();
    }

    checkCollision(player, platform) {
        return (
            player.x < platform.x + platform.width &&
            player.x + player.width > platform.x &&
            player.y < platform.y + platform.height &&
            player.y + player.height > platform.y
        );
    }

    takeDamage(amount = 1) {
        if (this.invincible) return;
        
        this.health -= amount;
        this.health = Math.max(0, this.health);
        
        if (this.health <= 0) {
            // No health left - lose a life and respawn
            GameState.lives--;
            UIManager.updateHUD();
            
            if (GameState.lives <= 0) {
                this.die();
            } else {
                // Respawn with full health
                this.invincible = true;
                this.invincibleTimer = 2000;
                this.health = this.maxHealth;
                this.x = 100;
                this.y = 300;
                this.velocityX = 0;
                this.velocityY = 0;
                // Snap to nearest platform below to prevent fall-through
                const platforms = this.gameRef?.levelManager?.platforms;
                if (platforms) {
                    let closestPlat = null;
                    let closestDist = Infinity;
                    for (const plat of platforms) {
                        if (plat.isLuckyBlock && !plat.replacedWithPlatform) continue;
                        if (this.x < plat.x + plat.width && this.x + this.width > plat.x) {
                            const pBottom = this.y + this.height;
                            if (pBottom <= plat.y) {
                                const dist = plat.y - pBottom;
                                if (dist < closestDist) {
                                    closestDist = dist;
                                    closestPlat = plat;
                                }
                            }
                        }
                    }
                    if (closestPlat) {
                        this.y = closestPlat.y - this.height;
                        this.grounded = true;
                    }
                }
                EffectsManager.screenShake(5);
                UIManager.addFloatingText('RESPAWN!', this.x, this.y - 40, '#4ecdc4');
            }
        } else {
            // Still have health - just get invincible briefly (reduced effects)
            this.invincible = true;
            this.invincibleTimer = 600;
            EffectsManager.screenShake(3);
            UIManager.addFloatingText('OOF!', this.x, this.y - 40, '#ff4757');
        }
        
        UIManager.updateHUD();
    }

    triggerLandmine(platform) {
        platform.exploded = true;
        platform.visible = false;
        this.velocityY = -22;
        this.velocityX = 14 * this.facing;
        this.stunned = true;
        this.stunTimer = 1300;
        this.state = 'stunned';

        EffectsManager.createParticles(this.x + this.width / 2, this.y + this.height / 2, 32, '#ff4757');
        EffectsManager.screenShake(14);
        UIManager.addFloatingText('BOOM!', this.x, this.y - 20, '#ff4757');

        setTimeout(() => {
            platform.exploded = false;
            platform.visible = true;
            platform.respawnTimer = 0;
        }, 4000);
    }

    die() {
        GameState.lives = 0;
        UIManager.updateHUD();
        this.gameRef.gameOver();
    }

    draw(ctx) {
        ctx.save();
        
        // Blink when invincible
        if (this.invincible && Math.floor(Date.now() / 100) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }

        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;

        if (this.character === 'dwayne') {
            this.drawDwayne(ctx, centerX, centerY);
        } else {
            this.drawShaq(ctx, centerX, centerY);
        }

        // Draw health bar above player
        this.drawHealthBar(ctx);

        ctx.restore();
    }

    drawDwayne(ctx, cx, cy) {
        const flexOffset = this.flexAnim > 0 ? Math.sin(this.flexAnim / 100) * 5 : 0;
        const breathe = Math.sin(Date.now() / 500) * 1.5;
        const runBounce = this.state === 'run' ? Math.abs(Math.sin(this.animFrame * Math.PI / 2)) * 2 : 0;
        
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(this.squashX, this.squashY);
        ctx.translate(-cx, -cy);
        
        // Shadow under character
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(cx, cy + 42, 22, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Tiny legs - blue jeans
        ctx.fillStyle = '#4169E1';
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 2.5;
        // Left leg
        ctx.beginPath();
        ctx.roundRect(cx - 14, cy + 18 + runBounce, 10, 20, 3);
        ctx.fill();
        ctx.stroke();
        // Right leg
        ctx.beginPath();
        ctx.roundRect(cx + 4, cy + 18 + runBounce, 10, 20, 3);
        ctx.fill();
        ctx.stroke();
        
        // Shoes - gold
        ctx.fillStyle = '#FFD700';
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(cx - 16, cy + 34 + runBounce, 14, 7, 3);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.roundRect(cx + 2, cy + 34 + runBounce, 14, 7, 3);
        ctx.fill();
        ctx.stroke();
        
        // Massive torso - gold tank top
        ctx.fillStyle = '#FFD700';
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(cx - 24, cy - 18 + breathe, 48, 38, 6);
        ctx.fill();
        ctx.stroke();
        
        // Tank top V-neck detail
        ctx.strokeStyle = '#DAA520';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 8, cy - 18 + breathe);
        ctx.lineTo(cx, cy - 5 + breathe);
        ctx.lineTo(cx + 8, cy - 18 + breathe);
        ctx.stroke();
        
        // Belt
        ctx.fillStyle = '#222';
        ctx.fillRect(cx - 22, cy + 12 + breathe, 44, 8);
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - 22, cy + 12 + breathe, 44, 8);
        // Belt buckle
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(cx - 7, cy + 13 + breathe, 14, 6);
        ctx.strokeStyle = '#1a1a2e';
        ctx.strokeRect(cx - 7, cy + 13 + breathe, 14, 6);
        
        // Massive arms - muscle definition
        ctx.fillStyle = '#8B4513';
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 2.5;
        
        // Left arm - bicep
        ctx.save();
        ctx.translate(cx - 26, cy - 8 + breathe);
        if (this.flexAnim > 0) {
            ctx.rotate(-0.6 + flexOffset * 0.05);
        } else {
            ctx.rotate(-0.35);
        }
        ctx.beginPath();
        ctx.roundRect(-8, -22, 16, 28, 6);
        ctx.fill();
        ctx.stroke();
        // Bicep bulge
        ctx.beginPath();
        ctx.arc(0, -12, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        
        // Right arm - bicep
        ctx.save();
        ctx.translate(cx + 26, cy - 8 + breathe);
        if (this.flexAnim > 0) {
            ctx.rotate(0.6 - flexOffset * 0.05);
        } else {
            ctx.rotate(0.35);
        }
        ctx.beginPath();
        ctx.roundRect(-8, -22, 16, 28, 6);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, -12, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        
        // Head - large anime style
        ctx.fillStyle = '#8B4513';
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(cx, cy - 32 + breathe, 18, 20, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Hair - short fade
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.ellipse(cx, cy - 42 + breathe, 16, 10, 0, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Eyes - large and expressive
        const eyeY = cy - 34 + breathe;
        // White
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(cx - 7, eyeY, 6, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(cx + 7, eyeY, 6, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Pupils - looking in movement direction
        ctx.fillStyle = '#2c1810';
        ctx.beginPath();
        ctx.arc(cx - 6 + this.facing * 2, eyeY + 1, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 8 + this.facing * 2, eyeY + 1, 2.5, 0, Math.PI * 2);
        ctx.fill();
        
        // Eye shine
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(cx - 5 + this.facing * 2, eyeY - 1, 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 9 + this.facing * 2, eyeY - 1, 1, 0, Math.PI * 2);
        ctx.fill();
        
        // Eyebrows - thick and expressive
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        const browY = cy - 40 + breathe;
        // Left eyebrow - raised
        ctx.beginPath();
        ctx.moveTo(cx - 13, browY + 2);
        ctx.quadraticCurveTo(cx - 7, browY - 4 + (this.flexAnim > 0 ? -3 : 0), cx - 1, browY + 2);
        ctx.stroke();
        // Right eyebrow - raised higher (signature look)
        ctx.beginPath();
        ctx.moveTo(cx + 1, browY + 2);
        ctx.quadraticCurveTo(cx + 7, browY - 6 + (this.flexAnim > 0 ? -4 : 0), cx + 13, browY + 2);
        ctx.stroke();
        
        // Confident smirk
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx + 4, cy - 24 + breathe, 7, 0.3, Math.PI - 0.3);
        ctx.stroke();
        
        // Jawline definition
        ctx.strokeStyle = '#6B3410';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - 10, cy - 22 + breathe);
        ctx.quadraticCurveTo(cx, cy - 18 + breathe, cx + 10, cy - 22 + breathe);
        ctx.stroke();
        
        ctx.restore();
    }

    drawShaq(ctx, cx, cy) {
        const dunkOffset = this.dunkAnim > 0 ? Math.sin(this.dunkAnim / 100) * 8 : 0;
        const breathe = Math.sin(Date.now() / 600) * 1.2;
        const runBounce = this.state === 'run' ? Math.abs(Math.sin(this.animFrame * Math.PI / 2)) * 2.5 : 0;
        
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(this.squashX, this.squashY);
        ctx.translate(-cx, -cy);
        
        // Shadow under character
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(cx, cy + 52, 30, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Large legs - red jersey shorts
        ctx.fillStyle = '#DC143C';
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 2.5;
        // Left leg
        ctx.beginPath();
        ctx.roundRect(cx - 22, cy + 25 + runBounce, 16, 25, 4);
        ctx.fill();
        ctx.stroke();
        // Right leg
        ctx.beginPath();
        ctx.roundRect(cx + 6, cy + 25 + runBounce, 16, 25, 4);
        ctx.fill();
        ctx.stroke();
        
        // Shorts number stripe
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 14, cy + 28 + runBounce);
        ctx.lineTo(cx - 14, cy + 45 + runBounce);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + 14, cy + 28 + runBounce);
        ctx.lineTo(cx + 14, cy + 45 + runBounce);
        ctx.stroke();
        
        // Big shoes - white with red accent
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(cx - 24, cy + 46 + runBounce, 20, 10, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#DC143C';
        ctx.fillRect(cx - 22, cy + 50 + runBounce, 16, 3);
        ctx.beginPath();
        ctx.roundRect(cx + 4, cy + 46 + runBounce, 20, 10, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#DC143C';
        ctx.fillRect(cx + 6, cy + 50 + runBounce, 16, 3);
        
        // HUGE body - basketball jersey
        ctx.fillStyle = '#DC143C';
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(cx - 32, cy - 25 + breathe, 64, 52, 8);
        ctx.fill();
        ctx.stroke();
        
        // Jersey stripes on sides
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx - 28, cy - 18 + breathe);
        ctx.lineTo(cx - 28, cy + 18 + breathe);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + 28, cy - 18 + breathe);
        ctx.lineTo(cx + 28, cy + 18 + breathe);
        ctx.stroke();
        
        // Jersey number 32
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 2;
        ctx.font = 'bold 22px Impact';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('32', cx, cy + 5 + breathe);
        ctx.strokeText('32', cx, cy + 5 + breathe);
        
        // Massive arms
        ctx.fillStyle = '#654321';
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 2.5;
        
        // Left arm
        ctx.save();
        ctx.translate(cx - 34, cy - 15 + breathe);
        if (this.dunkAnim > 0) {
            ctx.rotate(-1.3 + dunkOffset * 0.1);
        } else {
            ctx.rotate(-0.4);
        }
        ctx.beginPath();
        ctx.roundRect(-8, -28, 16, 32, 6);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        
        // Right arm
        ctx.save();
        ctx.translate(cx + 34, cy - 15 + breathe);
        if (this.dunkAnim > 0) {
            ctx.rotate(1.3 - dunkOffset * 0.1);
        } else {
            ctx.rotate(0.4);
        }
        ctx.beginPath();
        ctx.roundRect(-8, -28, 16, 32, 6);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        
        // Basketball when dunking
        if (this.dunkAnim > 0) {
            ctx.fillStyle = '#FF8C00';
            ctx.strokeStyle = '#8B4513';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx + 35 + dunkOffset, cy - 35, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            // Basketball lines
            ctx.strokeStyle = '#8B4513';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(cx + 23 + dunkOffset, cy - 35);
            ctx.lineTo(cx + 47 + dunkOffset, cy - 35);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(cx + 35 + dunkOffset, cy - 47);
            ctx.lineTo(cx + 35 + dunkOffset, cy - 23);
            ctx.stroke();
        }
        
        // HUGE head - anime style
        ctx.fillStyle = '#654321';
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(cx, cy - 42 + breathe, 22, 24, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Hair - short and neat
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.ellipse(cx, cy - 54 + breathe, 18, 12, 0, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Big expressive eyes
        const eyeY = cy - 44 + breathe;
        // White
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(cx - 8, eyeY, 7, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(cx + 8, eyeY, 7, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Pupils
        ctx.fillStyle = '#2c1810';
        ctx.beginPath();
        ctx.arc(cx - 7 + this.facing * 2.5, eyeY + 1, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 9 + this.facing * 2.5, eyeY + 1, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Eye shine
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(cx - 6 + this.facing * 2.5, eyeY - 1.5, 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 10 + this.facing * 2.5, eyeY - 1.5, 1.2, 0, Math.PI * 2);
        ctx.fill();
        
        // Friendly eyebrows
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - 14, eyeY - 9);
        ctx.quadraticCurveTo(cx - 8, eyeY - 12, cx - 2, eyeY - 9);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + 2, eyeY - 9);
        ctx.quadraticCurveTo(cx + 8, eyeY - 12, cx + 14, eyeY - 9);
        ctx.stroke();
        
        // Big grin
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx, cy - 32 + breathe, 12, 0.2, Math.PI - 0.2);
        ctx.stroke();
        
        // Teeth
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - 8, cy - 33 + breathe, 16, 5);
        
        // Nose
        ctx.fillStyle = '#543321';
        ctx.beginPath();
        ctx.ellipse(cx, cy - 36 + breathe, 4, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }

    drawHealthBar(ctx) {
        const barWidth = this.width;
        const barHeight = 4;
        const healthPercent = this.health / this.maxHealth;
        
        ctx.fillStyle = '#000';
        ctx.fillRect(this.x, this.y - 10, barWidth, barHeight);
        
        ctx.fillStyle = healthPercent > 0.5 ? '#2ed573' : '#ff4757';
        ctx.fillRect(this.x, this.y - 10, barWidth * healthPercent, barHeight);
    }
}

// ==================== ENEMY CLASS ====================
class Enemy {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.width = 40;
        this.height = 40;
        this.type = type;
        this.velocityX = -0.9;
        this.velocityY = 0;
        this.gravity = 0.6;
        this.health = 1;
        this.maxHealth = 1;
        this.alive = true;
        this.animFrame = 0;
        this.animTimer = 0;
        this.startX = x;
        this.patrolDistance = 150;
        this.facing = -1;
        
        // Type-specific properties
        this.setupType();
    }

    setupType() {
        switch(this.type) {
            case 'goofball':
                this.width = 35;
                this.height = 35;
                this.health = 1;
                this.color = '#ff6b6b';
                break;
            case 'chicken':
                this.width = 30;
                this.height = 45;
                this.health = 1;
                this.color = '#ffe66d';
                this.velocityX = -1.5;
                break;
            case 'taxcollector':
                this.width = 45;
                this.height = 55;
                this.health = 3;
                this.maxHealth = 3;
                this.color = '#4ecdc4';
                this.velocityX = -0.7;
                break;
            case 'grandma':
                this.width = 40;
                this.height = 50;
                this.health = 2;
                this.maxHealth = 2;
                this.color = '#a8e6cf';
                this.velocityX = -0.8;
                break;
            case 'flyingmeme':
                this.width = 35;
                this.height = 35;
                this.health = 1;
                this.color = '#ff8b94';
                this.flying = true;
                this.flyOffset = 0;
                this.startY = this.y;
                break;
        }
    }

    update(dt, platforms) {
        if (!this.alive) return;

        // Patrol movement
        this.x += this.velocityX;

        // Find the platform this enemy stands on to detect edges
        let standingPlat = null;
        for (const p of platforms) {
            if (p.isLuckyBlock && !p.replacedWithPlatform) continue;
            if (this.x + this.width > p.x && this.x < p.x + p.width &&
                Math.abs((this.y + this.height) - p.y) < 5) {
                standingPlat = p;
                break;
            }
        }

        if (this.velocityX < 0 && this.x <= (standingPlat ? standingPlat.x : this.startX - this.patrolDistance)) {
            this.velocityX = Math.abs(this.velocityX);
            this.facing = 1;
        } else if (this.velocityX > 0 && this.x + this.width >= (standingPlat ? standingPlat.x + standingPlat.width : this.startX + this.patrolDistance)) {
            this.velocityX = -Math.abs(this.velocityX);
            this.facing = -1;
        }

        // Flying enemies bob up and down
        if (this.flying) {
            this.flyOffset += 0.05;
            this.y = this.startY + Math.sin(this.flyOffset) * 30;
        }

        // Apply gravity for non-flying
        if (!this.flying) {
            this.velocityY += this.gravity;
            this.y += this.velocityY;

            // Platform collision
            for (const platform of platforms) {
                if (this.checkCollision(this, platform) && this.velocityY > 0) {
                    this.y = platform.y - this.height;
                    this.velocityY = 0;
                }
            }
        }

        // Animation with personality
        this.animTimer += dt;
        if (this.animTimer > 150) {
            this.animFrame = (this.animFrame + 1) % 4;
            this.animTimer = 0;
        }
        
        // Idle expression changes
        this.expressionTimer = (this.expressionTimer || 0) + dt;
        if (this.expressionTimer > 3000) {
            this.expressionFrame = (this.expressionFrame || 0) + 1;
            this.expressionTimer = 0;
        }
    }

    checkCollision(enemy, platform) {
        return (
            enemy.x < platform.x + platform.width &&
            enemy.x + enemy.width > platform.x &&
            enemy.y < platform.y + platform.height &&
            enemy.y + enemy.height > platform.y
        );
    }

    takeDamage(amount = 1) {
        this.health -= amount;
        if (this.health <= 0) {
            this.alive = false;
            GameState.score += 100;
            UIManager.addFloatingText('+100', this.x, this.y, '#ffe66d');
            EffectsManager.createParticles(this.x + this.width/2, this.y + this.height/2, 8, this.color);
        } else {
            UIManager.addFloatingText('HIT!', this.x, this.y - 20, '#ff6b6b');
        }
        UIManager.updateHUD();
    }

    draw(ctx) {
        if (!this.alive) return;

        ctx.save();
        
        // Wobble animation
        const wobble = Math.sin(this.animFrame * Math.PI / 2) * 3;
        
        ctx.translate(this.x + this.width/2, this.y + this.height/2);
        ctx.rotate(wobble * 0.05);
        ctx.translate(-(this.x + this.width/2), -(this.y + this.height/2));

        // Draw enemy based on type
        switch(this.type) {
            case 'goofball':
                this.drawGoofball(ctx);
                break;
            case 'chicken':
                this.drawChicken(ctx);
                break;
            case 'taxcollector':
                this.drawTaxCollector(ctx);
                break;
            case 'grandma':
                this.drawGrandma(ctx);
                break;
            case 'flyingmeme':
                this.drawFlyingMeme(ctx);
                break;
        }

        ctx.restore();
    }

    drawGoofball(ctx) {
        const cx = this.x + this.width/2;
        const cy = this.y + this.height/2;
        
        // Squash/stretch based on animation
        const bounce = Math.sin(this.animFrame * Math.PI / 2) * 2;
        
        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.beginPath();
        ctx.ellipse(cx, this.y + this.height + 2, this.width/2, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body (bouncy ball with gradient)
        const bodyGrad = ctx.createRadialGradient(cx - 5, cy - 5, 2, cx, cy, this.width/2);
        bodyGrad.addColorStop(0, '#fff5b8');
        bodyGrad.addColorStop(0.5, this.color);
        bodyGrad.addColorStop(1, '#e6c600');
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.arc(cx, cy + bounce, this.width/2, 0, Math.PI * 2);
        ctx.fill();
        
        // Thick outline
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Sparkle highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.arc(cx - 6, cy - 8 + bounce, 4, 0, Math.PI * 2);
        ctx.fill();

        // Eyes (big and expressive with crossed pupils)
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(this.x + 10, this.y + 14 + bounce, 7, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        ctx.beginPath();
        ctx.ellipse(this.x + 25, this.y + 14 + bounce, 7, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Crossed pupils
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(this.x + 13, this.y + 15 + bounce, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(this.x + 22, this.y + 13 + bounce, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Eye shine
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(this.x + 11, this.y + 12 + bounce, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(this.x + 20, this.y + 10 + bounce, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Dumb but cute smile
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(cx, this.y + 24 + bounce, 7, 0.3, Math.PI - 0.3);
        ctx.stroke();

        // Rosy cheeks
        ctx.fillStyle = 'rgba(255, 150, 150, 0.4)';
        ctx.beginPath();
        ctx.ellipse(this.x + 6, this.y + 22 + bounce, 4, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(this.x + 29, this.y + 22 + bounce, 4, 3, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    drawChicken(ctx) {
        const cx = this.x + this.width/2;
        const cy = this.y + this.height/2;
        const facing = this.facing;
        
        // Wing flap animation
        const wingFlap = Math.sin(this.animFrame * Math.PI) * 8;
        
        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.beginPath();
        ctx.ellipse(cx, this.y + this.height + 2, this.width/2, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Tail feathers
        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.moveTo(this.x + (facing > 0 ? 0 : this.width), this.y + 20);
        ctx.lineTo(this.x + (facing > 0 ? -12 : this.width + 12), this.y + 10);
        ctx.lineTo(this.x + (facing > 0 ? -8 : this.width + 8), this.y + 25);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(this.x + (facing > 0 ? 0 : this.width), this.y + 28);
        ctx.lineTo(this.x + (facing > 0 ? -10 : this.width + 10), this.y + 22);
        ctx.lineTo(this.x + (facing > 0 ? -6 : this.width + 6), this.y + 32);
        ctx.closePath();
        ctx.fill();

        // Body (plump chicken body with gradient)
        const bodyGrad = ctx.createRadialGradient(cx - 5, cy - 8, 3, cx, cy, this.width/2);
        bodyGrad.addColorStop(0, '#FFFFFF');
        bodyGrad.addColorStop(0.7, this.color);
        bodyGrad.addColorStop(1, '#e6d88a');
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.ellipse(cx, cy + 5, this.width/2, this.height/2 - 5, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Thick outline
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Wing (with flap animation)
        ctx.fillStyle = '#F5F5DC';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(cx + (facing > 0 ? -5 : 5), cy - 2 + wingFlap, 10, 14, facing * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Wing feather detail
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx + (facing > 0 ? -8 : 8), cy + wingFlap);
        ctx.lineTo(cx + (facing > 0 ? 2 : -2), cy + 8 + wingFlap);
        ctx.stroke();

        // Comb (red crest on top)
        ctx.fillStyle = '#DC143C';
        ctx.beginPath();
        ctx.arc(cx - 4, this.y + 6, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 2, this.y + 4, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 8, this.y + 6, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Beak
        ctx.fillStyle = '#FF8C00';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx + (facing * 12), this.y + 16);
        ctx.lineTo(cx + (facing * 22), this.y + 20);
        ctx.lineTo(cx + (facing * 12), this.y + 24);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Beak line
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx + (facing * 12), this.y + 20);
        ctx.lineTo(cx + (facing * 20), this.y + 20);
        ctx.stroke();

        // Eye (big and expressive)
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(cx + (facing * 6), this.y + 13, 7, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Pupil
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(cx + (facing * 8), this.y + 14, 4, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eye shine
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(cx + (facing * 6), this.y + 11, 2, 0, Math.PI * 2);
        ctx.fill();

        // Angry/serious eyebrow
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx + (facing * 2), this.y + 6);
        ctx.lineTo(cx + (facing * 12), this.y + 10);
        ctx.stroke();

        // Wattle (red hanging part under beak)
        ctx.fillStyle = '#DC143C';
        ctx.beginPath();
        ctx.ellipse(cx + (facing * 10), this.y + 27, 3, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Feet
        ctx.fillStyle = '#FF8C00';
        ctx.beginPath();
        ctx.ellipse(cx - 6, this.y + this.height - 2, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + 6, this.y + this.height - 2, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Toe lines
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 1;
        for (let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.moveTo(cx - 6 + i * 2, this.y + this.height - 4);
            ctx.lineTo(cx - 6 + i * 3, this.y + this.height + 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(cx + 6 + i * 2, this.y + this.height - 4);
            ctx.lineTo(cx + 6 + i * 3, this.y + this.height + 2);
            ctx.stroke();
        }
    }

    drawTaxCollector(ctx) {
        const cx = this.x + this.width/2;
        const cy = this.y + this.height/2;
        const facing = this.facing;
        
        // Subtle body bob
        const bob = Math.sin(this.animFrame * Math.PI / 2) * 2;
        
        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.ellipse(cx, this.y + this.height + 3, this.width/2, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Legs (dark pants)
        ctx.fillStyle = '#1a252f';
        ctx.fillRect(cx - 12, this.y + this.height - 18, 10, 18);
        ctx.fillRect(cx + 2, this.y + this.height - 18, 10, 18);
        
        // Shoes
        ctx.fillStyle = '#0a0a0a';
        ctx.beginPath();
        ctx.ellipse(cx - 7, this.y + this.height, 7, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + 7, this.y + this.height, 7, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body (fancy suit with gradient)
        const suitGrad = ctx.createLinearGradient(this.x, this.y, this.x + this.width, this.y + this.height);
        suitGrad.addColorStop(0, '#34495e');
        suitGrad.addColorStop(0.5, '#2c3e50');
        suitGrad.addColorStop(1, '#1a252f');
        ctx.fillStyle = suitGrad;
        ctx.beginPath();
        ctx.roundRect(this.x - 2, this.y + 25 + bob, this.width + 4, this.height - 35, 6);
        ctx.fill();
        
        // Suit outline
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Suit lapels
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, this.y + 28 + bob);
        ctx.lineTo(cx - 12, this.y + 45 + bob);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, this.y + 28 + bob);
        ctx.lineTo(cx + 12, this.y + 45 + bob);
        ctx.stroke();

        // Shirt (white V)
        ctx.fillStyle = '#ecf0f1';
        ctx.beginPath();
        ctx.moveTo(cx - 8, this.y + 28 + bob);
        ctx.lineTo(cx, this.y + 42 + bob);
        ctx.lineTo(cx + 8, this.y + 28 + bob);
        ctx.closePath();
        ctx.fill();

        // Tie (red with detail)
        ctx.fillStyle = '#c0392b';
        ctx.beginPath();
        ctx.moveTo(cx, this.y + 30 + bob);
        ctx.lineTo(cx - 4, this.y + 35 + bob);
        ctx.lineTo(cx - 3, this.y + 50 + bob);
        ctx.lineTo(cx, this.y + 55 + bob);
        ctx.lineTo(cx + 3, this.y + 50 + bob);
        ctx.lineTo(cx + 4, this.y + 35 + bob);
        ctx.closePath();
        ctx.fill();
        
        // Tie knot
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.arc(cx, this.y + 30 + bob, 3, 0, Math.PI * 2);
        ctx.fill();

        // Tie shine
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.fillRect(cx - 1, this.y + 35 + bob, 2, 15);
        ctx.fill();

        // Arms
        ctx.fillStyle = '#2c3e50';
        // Left arm
        ctx.beginPath();
        ctx.roundRect(this.x - 8, this.y + 30 + bob, 10, 25, 4);
        ctx.fill();
        ctx.stroke();
        // Right arm (holding briefcase)
        ctx.beginPath();
        ctx.roundRect(this.x + this.width - 2, this.y + 30 + bob, 10, 25, 4);
        ctx.fill();
        ctx.stroke();

        // Hands
        ctx.fillStyle = '#f5d6b8';
        ctx.beginPath();
        ctx.arc(this.x - 3, this.y + 57 + bob, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(this.x + this.width + 3, this.y + 57 + bob, 4, 0, Math.PI * 2);
        ctx.fill();

        // Briefcase (in right hand)
        ctx.fillStyle = '#6b3e26';
        ctx.strokeStyle = '#4a2e1a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(this.x + this.width - 2, this.y + 55 + bob, 18, 14, 2);
        ctx.fill();
        ctx.stroke();
        
        // Briefcase handle
        ctx.strokeStyle = '#8b6914';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x + this.width + 7, this.y + 55 + bob, 5, Math.PI, 0);
        ctx.stroke();
        
        // Briefcase lock
        ctx.fillStyle = '#8b6914';
        ctx.beginPath();
        ctx.arc(this.x + this.width + 7, this.y + 62 + bob, 2, 0, Math.PI * 2);
        ctx.fill();

        // Head (with gradient)
        const headGrad = ctx.createRadialGradient(cx - 3, this.y + 12, 2, cx, this.y + 12, 14);
        headGrad.addColorStop(0, '#fce4c5');
        headGrad.addColorStop(1, '#e8c39e');
        ctx.fillStyle = headGrad;
        ctx.beginPath();
        ctx.arc(cx, this.y + 14 + bob, 13, 0, Math.PI * 2);
        ctx.fill();
        
        // Head outline
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Hair (sleek, professional)
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath();
        ctx.arc(cx, this.y + 10 + bob, 13, Math.PI, 0);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx - 10, this.y + 12 + bob, 5, 8, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + 10, this.y + 12 + bob, 5, 8, 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Glasses (round, sophisticated)
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx - 6, this.y + 13 + bob, 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx + 6, this.y + 13 + bob, 6, 0, Math.PI * 2);
        ctx.stroke();
        
        // Glasses bridge
        ctx.beginPath();
        ctx.moveTo(cx - 1, this.y + 13 + bob);
        ctx.lineTo(cx + 1, this.y + 13 + bob);
        ctx.stroke();
        
        // Glasses arm
        ctx.beginPath();
        ctx.moveTo(cx - 12, this.y + 13 + bob);
        ctx.lineTo(cx - 16, this.y + 11 + bob);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + 12, this.y + 13 + bob);
        ctx.lineTo(cx + 16, this.y + 11 + bob);
        ctx.stroke();

        // Glass shine
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx - 6, this.y + 11 + bob, 4, -0.5, 0.8);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx + 6, this.y + 11 + bob, 4, -0.5, 0.8);
        ctx.stroke();

        // Eyes (behind glasses)
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(cx - 6, this.y + 14 + bob, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 6, this.y + 14 + bob, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Pupils (serious look)
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(cx - 6 + (facing * 1.5), this.y + 14 + bob, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 6 + (facing * 1.5), this.y + 14 + bob, 2, 0, Math.PI * 2);
        ctx.fill();

        // Eye shine
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(cx - 5, this.y + 13 + bob, 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 7, this.y + 13 + bob, 1, 0, Math.PI * 2);
        ctx.fill();

        // Confident smirk
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - 5, this.y + 22 + bob);
        ctx.quadraticCurveTo(cx + (facing * 3), this.y + 25 + bob, cx + 8, this.y + 21 + bob);
        ctx.stroke();

        // Money bag icon on suit (personality)
        ctx.fillStyle = '#27ae60';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('$', cx, this.y + 75 + bob);
    }

    drawGrandma(ctx) {
        const cx = this.x + this.width/2;
        const cy = this.y + this.height/2;
        const facing = this.facing;
        
        // Subtle hover animation
        const hover = Math.sin(this.animFrame * Math.PI / 2) * 3;
        
        // Shadow (moves with hover)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.beginPath();
        ctx.ellipse(cx, this.y + this.height + 15 - hover, this.width/2, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Rocket flames (back thrust)
        const flameFlicker = Math.random() * 8;
        const flameGrad = ctx.createLinearGradient(cx - 15, this.y + this.height, cx - 15, this.y + this.height + 25);
        flameGrad.addColorStop(0, '#fff');
        flameGrad.addColorStop(0.3, '#ffeb3b');
        flameGrad.addColorStop(0.7, '#ff9800');
        flameGrad.addColorStop(1, 'rgba(255, 87, 34, 0)');
        ctx.fillStyle = flameGrad;
        ctx.beginPath();
        ctx.moveTo(cx - 20, this.y + this.height - 5);
        ctx.lineTo(cx - 15, this.y + this.height + 15 + flameFlicker);
        ctx.lineTo(cx - 10, this.y + this.height - 5);
        ctx.closePath();
        ctx.fill();
        
        const flameGrad2 = ctx.createLinearGradient(cx + 10, this.y + this.height, cx + 10, this.y + this.height + 25);
        flameGrad2.addColorStop(0, '#fff');
        flameGrad2.addColorStop(0.3, '#ffeb3b');
        flameGrad2.addColorStop(0.7, '#ff9800');
        flameGrad2.addColorStop(1, 'rgba(255, 87, 34, 0)');
        ctx.fillStyle = flameGrad2;
        ctx.beginPath();
        ctx.moveTo(cx + 10, this.y + this.height - 5);
        ctx.lineTo(cx + 15, this.y + this.height + 15 + flameFlicker);
        ctx.lineTo(cx + 20, this.y + this.height - 5);
        ctx.closePath();
        ctx.fill();

        // Rocket exhaust smoke
        ctx.fillStyle = 'rgba(150, 150, 150, 0.4)';
        ctx.beginPath();
        ctx.arc(cx - 15 + Math.random() * 4 - 2, this.y + this.height + 20 + Math.random() * 10, 4 + Math.random() * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 15 + Math.random() * 4 - 2, this.y + this.height + 18 + Math.random() * 8, 3 + Math.random() * 2, 0, Math.PI * 2);
        ctx.fill();

        // Dress (flowing, with gradient)
        const dressGrad = ctx.createLinearGradient(this.x, this.y + 30, this.x, this.y + this.height);
        dressGrad.addColorStop(0, '#9b59b6');
        dressGrad.addColorStop(0.5, '#8e44ad');
        dressGrad.addColorStop(1, '#7d3c98');
        ctx.fillStyle = dressGrad;
        ctx.beginPath();
        ctx.moveTo(cx, this.y + 30);
        ctx.lineTo(this.x - 5, this.y + this.height + hover);
        ctx.lineTo(this.x + this.width + 5, this.y + this.height + hover);
        ctx.closePath();
        ctx.fill();
        
        // Dress outline
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Dress pattern (floral dots)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        for (let i = 0; i < 5; i++) {
            const dotX = this.x + 8 + (i % 3) * 12;
            const dotY = this.y + 40 + Math.floor(i / 3) * 15 + hover * (i % 2);
            ctx.beginPath();
            ctx.arc(dotX, dotY, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Belt/sash
        ctx.fillStyle = '#f39c12';
        ctx.beginPath();
        ctx.roundRect(this.x - 3, this.y + 45 + hover, this.width + 6, 6, 2);
        ctx.fill();
        
        // Belt buckle
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.arc(cx, this.y + 48 + hover, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#d4ac0d';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Arms (outstretched, dramatic)
        ctx.fillStyle = '#f5d6b8';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 1.5;
        // Left arm
        ctx.beginPath();
        ctx.ellipse(this.x - 12, this.y + 38 + hover, 8, 5, -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Right arm
        ctx.beginPath();
        ctx.ellipse(this.x + this.width + 12, this.y + 38 + hover, 8, 5, 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Hands (pointing)
        ctx.fillStyle = '#f5d6b8';
        ctx.beginPath();
        ctx.arc(this.x - 18, this.y + 35 + hover, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(this.x + this.width + 18, this.y + 35 + hover, 4, 0, Math.PI * 2);
        ctx.fill();

        // Head (with gradient)
        const headGrad = ctx.createRadialGradient(cx - 3, this.y + 12, 2, cx, this.y + 12, 14);
        headGrad.addColorStop(0, '#fce4c5');
        headGrad.addColorStop(1, '#e8c39e');
        ctx.fillStyle = headGrad;
        ctx.beginPath();
        ctx.arc(cx, this.y + 16 + hover, 14, 0, Math.PI * 2);
        ctx.fill();
        
        // Head outline
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Hair (voluminous curl style)
        ctx.fillStyle = '#bdc3c7';
        // Left bun
        ctx.beginPath();
        ctx.arc(cx - 14, this.y + 8 + hover, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();
        // Right bun
        ctx.beginPath();
        ctx.arc(cx + 14, this.y + 8 + hover, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Top hair
        ctx.fillStyle = '#bdc3c7';
        ctx.beginPath();
        ctx.arc(cx, this.y + 6 + hover, 14, Math.PI + 0.3, -0.3);
        ctx.fill();
        ctx.stroke();
        
        // Hair shine
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.ellipse(cx - 5, this.y + 3 + hover, 5, 3, -0.3, 0, Math.PI * 2);
        ctx.fill();

        // Glasses (round, perched)
        ctx.strokeStyle = '#8b4513';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx - 6, this.y + 15 + hover, 6.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx + 6, this.y + 15 + hover, 6.5, 0, Math.PI * 2);
        ctx.stroke();
        
        // Glasses bridge
        ctx.beginPath();
        ctx.moveTo(cx - 1, this.y + 14 + hover);
        ctx.quadraticCurveTo(cx, this.y + 12 + hover, cx + 1, this.y + 14 + hover);
        ctx.stroke();

        // Glass shine
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx - 7, this.y + 13 + hover, 4, -0.8, 0.5);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx + 5, this.y + 13 + hover, 4, -0.8, 0.5);
        ctx.stroke();

        // Eyes (determined, slightly narrowed)
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(cx - 6, this.y + 16 + hover, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 6, this.y + 16 + hover, 4, 0, Math.PI * 2);
        ctx.fill();

        // Pupils (focused)
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath();
        ctx.arc(cx - 6 + (facing * 1.5), this.y + 16 + hover, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 6 + (facing * 1.5), this.y + 16 + hover, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Eye shine
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(cx - 5, this.y + 15 + hover, 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 7, this.y + 15 + hover, 1.2, 0, Math.PI * 2);
        ctx.fill();

        // Determined eyebrow (above glasses)
        ctx.strokeStyle = '#95a5a6';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - 11, this.y + 9 + hover);
        ctx.lineTo(cx - 3, this.y + 11 + hover);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + 11, this.y + 9 + hover);
        ctx.lineTo(cx + 3, this.y + 11 + hover);
        ctx.stroke();

        // Determined mouth (small, set jaw)
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - 4, this.y + 25 + hover);
        ctx.lineTo(cx + 4, this.y + 25 + hover);
        ctx.stroke();
        
        // Small laugh lines
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - 7, this.y + 23 + hover);
        ctx.lineTo(cx - 9, this.y + 21 + hover);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + 7, this.y + 23 + hover);
        ctx.lineTo(cx + 9, this.y + 21 + hover);
        ctx.stroke();
    }

    drawFlyingMeme(ctx) {
        const cx = this.x + this.width/2;
        const cy = this.y + this.height/2;
        
        // Floating bob animation
        const bob = Math.sin(this.animFrame * Math.PI / 2) * 5;
        const tilt = Math.sin(this.animFrame * Math.PI / 3) * 0.1;
        
        // Shadow (fades with height)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.beginPath();
        ctx.ellipse(cx, this.y + this.height + 15 - bob, this.width/2.5, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.translate(cx, cy + bob);
        ctx.rotate(tilt);
        ctx.translate(-cx, -cy);

        // Glow effect (meme energy)
        const glowGrad = ctx.createRadialGradient(cx, cy, this.width/3, cx, cy, this.width);
        glowGrad.addColorStop(0, 'rgba(255, 139, 148, 0.3)');
        glowGrad.addColorStop(1, 'rgba(255, 139, 148, 0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, this.width, 0, Math.PI * 2);
        ctx.fill();

        // Body (round, cute, Pikachu-inspired)
        const bodyGrad = ctx.createRadialGradient(cx - 5, cy - 5, 3, cx, cy, this.width/2);
        bodyGrad.addColorStop(0, '#ffe066');
        bodyGrad.addColorStop(0.5, this.color);
        bodyGrad.addColorStop(1, '#e67a82');
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, this.width/2, 0, Math.PI * 2);
        ctx.fill();
        
        // Thick outline
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Cheek blush (red circles, Pikachu-style)
        ctx.fillStyle = 'rgba(255, 80, 80, 0.5)';
        ctx.beginPath();
        ctx.ellipse(cx - 12, cy + 5, 6, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + 12, cy + 5, 6, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eyes (huge, surprised, anime-style)
        // White of eyes
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(cx - 8, cy - 5, 9, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(cx + 8, cy - 5, 9, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Pupils (tiny, shocked)
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(cx - 8, cy - 4, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 8, cy - 4, 4.5, 0, Math.PI * 2);
        ctx.fill();

        // Eye shine (big, cute)
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(cx - 5, cy - 8, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 11, cy - 8, 2.5, 0, Math.PI * 2);
        ctx.fill();
        // Small shine
        ctx.beginPath();
        ctx.arc(cx - 9, cy - 2, 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 7, cy - 2, 1.2, 0, Math.PI * 2);
        ctx.fill();

        // Open mouth (surprised "O" shape)
        ctx.fillStyle = '#000';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy + 12, 7, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Tongue
        ctx.fillStyle = '#ff6b81';
        ctx.beginPath();
        ctx.arc(cx, cy + 16, 4, 0, Math.PI);
        ctx.fill();

        // Eyebrows (raised high, surprised)
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - 14, cy - 18);
        ctx.quadraticCurveTo(cx - 8, cy - 22, cx - 2, cy - 18);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + 2, cy - 18);
        ctx.quadraticCurveTo(cx + 8, cy - 22, cx + 14, cy - 18);
        ctx.stroke();

        // "WOW" text bubble (comic style)
        ctx.save();
        ctx.translate(cx, this.y - 12 + bob);
        
        // Text shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('WOW!', 2, 2);
        
        // Text
        ctx.fillStyle = '#ff6b6b';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.strokeText('WOW!', 0, 0);
        ctx.fillText('WOW!', 0, 0);
        
        // Exclamation sparkle
        ctx.fillStyle = '#ffe66d';
        ctx.beginPath();
        ctx.moveTo(14, -6);
        ctx.lineTo(16, -2);
        ctx.lineTo(20, 0);
        ctx.lineTo(16, 2);
        ctx.lineTo(14, 6);
        ctx.lineTo(12, 2);
        ctx.lineTo(8, 0);
        ctx.lineTo(12, -2);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();

        // Tiny arms (raised in surprise)
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - this.width/2, cy + 2);
        ctx.lineTo(cx - this.width/2 - 6, cy - 8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + this.width/2, cy + 2);
        ctx.lineTo(cx + this.width/2 + 6, cy - 8);
        ctx.stroke();

        // Feet (tiny, cute)
        ctx.fillStyle = '#e67a82';
        ctx.beginPath();
        ctx.ellipse(cx - 8, cy + this.height/2 + 2, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + 8, cy + this.height/2 + 2, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

// ==================== PLATFORM CLASS ====================
class Platform {
    constructor(x, y, width, height, type = 'static') {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.type = type; // static, moving, falling, spring, landmine
        this.originalX = x;
        this.originalY = y;
        this.visible = true;
        this.fallen = false;
        this.fallTimer = 0;
        this.exploded = false;
        
        // Block-based rendering
        this.blockSize = 40; // Size of each block
        this.blocks = this.generateBlocks();
        
        // Moving platform
        this.moving = type === 'moving';
        this.moveSpeed = 2;
        this.moveDistance = 100;
        this.moveAxis = 'x'; // x or y
        this.moveOffset = 0;
        this.velocityX = 0; // For moving platform carry

        // Spring
        this.isSpring = type === 'spring';
        this.springPower = -20;
        this.compressed = false;
        this.springTimer = 0;

        // Landmine
        this.isLandmine = type === 'landmine';
        this.minePulse = 0;
    }

    generateBlocks() {
        // Generate individual blocks that make up this platform
        const blocks = [];
        const cols = Math.ceil(this.width / this.blockSize);
        const rows = Math.ceil(this.height / this.blockSize);
        
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const blockX = this.x + col * this.blockSize;
                const blockY = this.y + row * this.blockSize;
                
                // Check if this block is within the platform bounds
                if (blockX < this.x + this.width && blockY < this.y + this.height) {
                    blocks.push({
                        x: blockX,
                        y: blockY,
                        width: Math.min(this.blockSize, this.x + this.width - blockX),
                        height: Math.min(this.blockSize, this.y + this.height - blockY),
                        isTop: row === 0,
                        isLeft: col === 0,
                        isRight: col === cols - 1 && blockX + this.blockSize >= this.x + this.width,
                        isBottom: row === rows - 1 && blockY + this.blockSize >= this.y + this.height
                    });
                }
            }
        }
        return blocks;
    }

    update(dt) {
        let oldX = this.x;
        let oldY = this.y;
        
        if (this.type === 'moving' && !this.fallen) {
            this.moveOffset += this.moveSpeed * 0.015 * (dt / 16);
            if (this.moveAxis === 'x') {
                this.x = this.originalX + Math.sin(this.moveOffset) * this.moveDistance;
            } else {
                // For vertical moving platforms, clamp to keep them visible
                const newY = this.originalY + Math.sin(this.moveOffset) * this.moveDistance;
                this.y = Math.max(200, Math.min(newY, this.originalY + 80));
            }
        }

        if (this.isSpring && this.compressed) {
            this.springTimer += dt;
            if (this.springTimer > 200) {
                this.compressed = false;
                this.springTimer = 0;
            }
        }

        if (this.isLandmine) {
            this.minePulse += dt * 0.01;
        }
        
        // Update block positions based on platform movement
        this.velocityX = this.x - oldX;
        this.velocityY = this.y - oldY;
        
        // Recalculate all block positions from scratch
        for (let i = 0; i < this.blocks.length; i++) {
            const block = this.blocks[i];
            const localX = block.originalLocalX || (block.x - oldX);
            const localY = block.originalLocalY || (block.y - oldY);
            block.x = this.x + localX;
            block.y = this.y + localY;
            
            // Store local positions for next frame
            if (!block.originalLocalX) {
                block.originalLocalX = localX;
                block.originalLocalY = localY;
            }
        }
    }

    draw(ctx) {
        if (!this.visible) return;

        // Skip drawing if this is a lucky block (drawn separately)
        if (this.isLuckyBlock) return;

        ctx.save();

        if (this.isSpring) {
            // Draw spring as individual blocks
            const springY = this.compressed ? this.y + 10 : this.y;
            for (const block of this.blocks) {
                ctx.fillStyle = '#f39c12';
                ctx.fillRect(block.x, springY + (block.y - this.y), block.width - 2, block.height - 2);
                
                // Block border
                ctx.strokeStyle = '#e67e22';
                ctx.lineWidth = 1;
                ctx.strokeRect(block.x, springY + (block.y - this.y), block.width - 2, block.height - 2);
            }
            
            // Spring coils
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            for (let i = 0; i < 3; i++) {
                const y = springY + (this.height / 4) * (i + 0.5);
                ctx.beginPath();
                ctx.moveTo(this.x + 5, y);
                ctx.lineTo(this.x + this.width - 5, y);
                ctx.stroke();
            }
        } else if (this.isLandmine) {
            const pulse = Math.sin(this.minePulse) * 4;
            // Draw landmine as individual blocks
            for (const block of this.blocks) {
                ctx.fillStyle = '#8b0000';
                ctx.fillRect(block.x - pulse/2, block.y - pulse/2, block.width - 2 + pulse, block.height - 2 + pulse);
                
                ctx.fillStyle = '#2c3e50';
                ctx.fillRect(block.x, block.y, block.width - 2, block.height - 2);
                
                // X pattern on each block
                ctx.strokeStyle = '#e74c3c';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(block.x + 4, block.y + 4);
                ctx.lineTo(block.x + block.width - 6, block.y + block.height - 6);
                ctx.moveTo(block.x + block.width - 6, block.y + 4);
                ctx.lineTo(block.x + 4, block.y + block.height - 6);
                ctx.stroke();
            }
        } else if (this.type === 'falling' && this.fallen) {
            // Don't draw fallen platform
        } else {
            // Draw each block individually with brick-like appearance
            for (const block of this.blocks) {
                // Main block color with gradient effect
                const brightness = block.isTop ? 1.1 : (block.isBottom ? 0.9 : 1.0);
                const theme = GameState.levelTheme || { ground: '#27ae60', groundTop: '#2ecc71', accent: '#1e8449' };

                if (block.isTop) {
                    ctx.fillStyle = theme.groundTop;
                    ctx.fillRect(block.x, block.y, block.width - 2, 6);
                }

                // Block body — parse theme ground color and apply brightness
                const hex = theme.ground.replace('#', '');
                const r = Math.min(255, Math.floor(parseInt(hex.substring(0, 2), 16) * brightness));
                const g = Math.min(255, Math.floor(parseInt(hex.substring(2, 4), 16) * brightness));
                const b = Math.min(255, Math.floor(parseInt(hex.substring(4, 6), 16) * brightness));
                ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                ctx.fillRect(block.x, block.y + (block.isTop ? 6 : 0), block.width - 2, block.height - 2 - (block.isTop ? 6 : 0));

                // Block border/outline
                ctx.strokeStyle = theme.accent;
                ctx.lineWidth = 1.5;
                ctx.strokeRect(block.x, block.y, block.width - 2, block.height - 2);

                // Brick pattern - horizontal line in middle for taller blocks
                if (block.height >= 40 && !block.isTop) {
                    ctx.strokeStyle = theme.accent + '80';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(block.x, block.y + block.height / 2);
                    ctx.lineTo(block.x + block.width - 2, block.y + block.height / 2);
                    ctx.stroke();
                }
                
                // Subtle highlight on top edge
                if (block.isTop) {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                    ctx.fillRect(block.x + 2, block.y + 1, block.width - 6, 2);
                }
                
                // Shadow on bottom edge
                if (block.isBottom) {
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
                    ctx.fillRect(block.x + 2, block.y + block.height - 3, block.width - 6, 2);
                }
            }
        }

        ctx.restore();
    }
}

// ==================== COIN CLASS ====================
class Coin {
    constructor(x, y, collected = false) {
        this.x = x;
        this.y = y;
        this.width = 25;
        this.height = 25;
        this.collected = collected;
        this.animFrame = 0;
        this.animTimer = 0;
    }

    update(dt) {
        this.animTimer += dt;
        if (this.animTimer > 100) {
            this.animFrame = (this.animFrame + 1) % 4;
            this.animTimer = 0;
        }
    }

    draw(ctx) {
        if (this.collected) return;

        ctx.save();
        
        // Spin effect
        const scaleX = Math.cos(this.animFrame * Math.PI / 2);
        ctx.translate(this.x + this.width/2, this.y + this.height/2);
        ctx.scale(scaleX, 1);
        ctx.translate(-(this.x + this.width/2), -(this.y + this.height/2));

        // Coin
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.arc(this.x + this.width/2, this.y + this.height/2, this.width/2, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#f39c12';
        ctx.lineWidth = 2;
        ctx.stroke();

        // $ symbol
        ctx.fillStyle = '#f39c12';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', this.x + this.width/2, this.y + this.height/2);

        ctx.restore();
    }
}

// ==================== PROJECTILE CLASS ====================
class Projectile {
    constructor(x, y, velocityX, velocityY, type, damage, gameRef) {
        this.x = x;
        this.y = y;
        this.width = type === 'rock' ? 30 : type === 'boulder' ? 50 : 20;
        this.height = type === 'rock' ? 30 : type === 'boulder' ? 50 : 20;
        this.velocityX = velocityX;
        this.velocityY = velocityY;
        this.type = type;
        this.damage = damage;
        this.alive = true;
        this.gravity = type === 'rock' ? 0.3 : type === 'boulder' ? 0.5 : 0;
        this.gameRef = gameRef;
    }

    update(dt) {
        this.velocityY += this.gravity;
        this.x += this.velocityX;
        this.y += this.velocityY;

        // Remove if off screen
        if (this.x < GameState.cameraX - 100 || 
            this.x > GameState.cameraX + this.gameRef.canvas.width + 100 ||
            this.y > 800) {
            this.alive = false;
        }
    }

    draw(ctx) {
        ctx.save();

        switch(this.type) {
            case 'rock':
                // Boulder
                ctx.fillStyle = '#7f8c8d';
                ctx.beginPath();
                ctx.arc(this.x + this.width/2, this.y + this.height/2, this.width/2, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#95a5a6';
                ctx.lineWidth = 3;
                ctx.stroke();
                
                // Cracks
                ctx.strokeStyle = '#2c3e50';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(this.x + 5, this.y + 5);
                ctx.lineTo(this.x + this.width - 5, this.y + this.height - 5);
                ctx.stroke();
                break;

            case 'boulder':
                // GIANT BOULDER - The Rock's special attack
                // Rotation effect
                const boulderCx = this.x + this.width / 2;
                const boulderCy = this.y + this.height / 2;
                const rotation = this.x * 0.05;

                ctx.translate(boulderCx, boulderCy);
                ctx.rotate(rotation);
                ctx.translate(-boulderCx, -boulderCy);

                // Shadow
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.beginPath();
                ctx.ellipse(boulderCx + 5, this.y + this.height + 5, this.width / 2, 8, 0, 0, Math.PI * 2);
                ctx.fill();

                // Main boulder body
                const boulderGrad = ctx.createRadialGradient(
                    boulderCx - 10, boulderCy - 10, 5,
                    boulderCx, boulderCy, this.width / 2
                );
                boulderGrad.addColorStop(0, '#95A5A6');
                boulderGrad.addColorStop(0.5, '#7F8C8D');
                boulderGrad.addColorStop(1, '#5D6D7E');
                ctx.fillStyle = boulderGrad;
                ctx.beginPath();
                ctx.arc(boulderCx, boulderCy, this.width / 2, 0, Math.PI * 2);
                ctx.fill();

                // Thick outline
                ctx.strokeStyle = '#2C3E50';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(boulderCx, boulderCy, this.width / 2, 0, Math.PI * 2);
                ctx.stroke();

                // Cracks and details
                ctx.strokeStyle = '#2C3E50';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(boulderCx - 15, boulderCy - 10);
                ctx.lineTo(boulderCx - 5, boulderCy + 5);
                ctx.lineTo(boulderCx + 10, boulderCy);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(boulderCx + 5, boulderCy - 15);
                ctx.lineTo(boulderCx + 15, boulderCy + 5);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(boulderCx - 10, boulderCy + 10);
                ctx.lineTo(boulderCx + 5, boulderCy + 18);
                ctx.stroke();

                // Highlight
                ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.beginPath();
                ctx.arc(boulderCx - 12, boulderCy - 12, 8, 0, Math.PI * 2);
                ctx.fill();

                // Trail particles
                if (Math.random() < 0.5) {
                    EffectsManager.createParticles(
                        this.x + Math.random() * 10,
                        this.y + this.height / 2 + Math.random() * 10 - 5,
                        2,
                        '#7F8C8D'
                    );
                }
                break;
                
            case 'shockwave':
                // Shockwave ring
                ctx.strokeStyle = '#FF8C00';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(this.x + this.width/2, this.y + this.height/2, this.width/2, 0, Math.PI * 2);
                ctx.stroke();
                break;
                
            case 'cookie':
                // Giant cookie
                ctx.fillStyle = '#d4a574';
                ctx.beginPath();
                ctx.arc(this.x + this.width/2, this.y + this.height/2, this.width/2, 0, Math.PI * 2);
                ctx.fill();
                
                // Chocolate chips
                ctx.fillStyle = '#3e2723';
                ctx.beginPath();
                ctx.arc(this.x + 8, this.y + 8, 3, 0, Math.PI * 2);
                ctx.arc(this.x + 15, this.y + 12, 3, 0, Math.PI * 2);
                ctx.arc(this.x + 10, this.y + 18, 3, 0, Math.PI * 2);
                ctx.fill();
                break;
                
            case 'money':
                // Money bag
                ctx.fillStyle = '#27ae60';
                ctx.beginPath();
                ctx.roundRect(this.x, this.y, this.width, this.height, 5);
                ctx.fill();
                ctx.fillStyle = '#2ecc71';
                ctx.font = 'bold 14px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('$', this.x + this.width/2, this.y + this.height/2 + 5);
                break;
        }

        ctx.restore();
    }
}

// ==================== LEVEL MANAGER ====================
class LevelManager {
    constructor() {
        this.platforms = [];
        this.enemies = [];
        this.coins = [];
        this.luckyBlocks = [];
        this.spikes = [];
        this.exitX = 0;
        this.levelThemes = {
            1: { name: 'green hills', ground: '#27ae60', groundTop: '#2ecc71', bg: '#87CEEB', hill: '#7CB342', tree: '#4CAF50', accent: '#FFD700' },
            2: { name: 'blue depths', ground: '#2471A3', groundTop: '#2E86C1', bg: '#5DADE2', hill: '#5499C7', tree: '#2E86C1', accent: '#85C1E9' },
            3: { name: 'red inferno', ground: '#B03A2E', groundTop: '#E74C3C', bg: '#F1948A', hill: '#C0392B', tree: '#922B21', accent: '#F5B041' },
            4: { name: 'purple void', ground: '#6C3483', groundTop: '#8E44AD', bg: '#D2B4DE', hill: '#7D3C98', tree: '#4A235A', accent: '#E8DAEF' },
            5: { name: 'dark abyss', ground: '#1B2631', groundTop: '#2C3E50', bg: '#5D6D7E', hill: '#34495E', tree: '#212F3D', accent: '#F39C12' }
        };
    }

    generateLevel(levelNum) {
        this.platforms = [];
        this.enemies = [];
        this.coins = [];
        this.luckyBlocks = [];
        this.spikes = [];
        GameState.activeLuckyBlocks = [];
        GameState.activeSpikes = [];

        const theme = this.levelThemes[Math.min(levelNum, 5)] || this.levelThemes[1];
        GameState.levelTheme = theme;
        const baseLength = 3500 + levelNum * 800;
        GameState.levelLength = baseLength;

        let currentX = 0;
        let groundY = 580;

        // === SECTION 1: Safe starting area (same for all levels) ===
        this.platforms.push(new Platform(0, groundY, 400, 80, 'static'));
        currentX = 400;
        this.addCoinArc(200, groundY - 80, 3);
        this.addLuckyBlock(500, groundY - 40, 'coin1');

        if (levelNum === 1) {
            // ============ LEVEL 1: GREEN HILLS (Original 9-section, reduced enemies) ============

            // === SECTION 2: Introduction to gaps and elevation ===
            for (let i = 0; i < 4; i++) {
                const gapSize = 70 + i * 15;
                const platWidth = Math.round((120 + Math.random() * 60) / 40) * 40;
                const yVar = i % 2 === 0 ? 0 : -40;
                currentX += gapSize;
                const platY = groundY + yVar;
                this.platforms.push(new Platform(currentX, platY, platWidth, 80, 'static'));
                this.addCoinArc(currentX + platWidth / 2, platY - 80, 2);
                if (i % 3 === 0) {
                    this.addLuckyBlock(currentX + platWidth / 2, platY - 40, 'coin1');
                }
                currentX += platWidth;
            }

            // === SECTION 3: Moving platforms introduction ===
            const movePlatX = currentX + 80;
            const movePlat = new Platform(movePlatX, 540, 120, 20, 'moving');
            movePlat.moveSpeed = 1.0;
            movePlat.moveDistance = 40;
            movePlat.moveAxis = 'y';
            this.platforms.push(movePlat);
            currentX = movePlatX + 160;
            this.platforms.push(new Platform(currentX, groundY, 200, 80, 'static'));
            this.addCoinArc(currentX + 100, groundY - 80, 3);
            currentX += 200;

            // === SECTION 4: Vertical challenge with multiple elevations ===
            const elevations = [groundY, groundY - 60, groundY - 100, groundY - 40, groundY];
            for (let i = 0; i < elevations.length - 1; i++) {
                const platWidth = Math.round((100 + Math.random() * 40) / 40) * 40;
                const gap = Math.round((80 + Math.random() * 20) / 40) * 40;
                currentX += gap;
                this.platforms.push(new Platform(currentX, elevations[i + 1], platWidth, 80, 'static'));
                this.addCoinArc(currentX + platWidth / 2, elevations[i + 1] - 70, 2);
                if (i % 2 === 0) {
                    this.addLuckyBlock(currentX + platWidth / 2, elevations[i + 1] - 40, 'coin1');
                }
                if (i === 3) {
                    this.addEnemy(currentX + platWidth / 2, elevations[i + 1] - 40, 'goofball');
                }
                currentX += platWidth;
            }

            // === SECTION 5: Spike introduction ===
            currentX += 80;
            const spikeSection = currentX;
            this.platforms.push(new Platform(currentX, groundY, 320, 80, 'static'));
            this.addSpike(spikeSection + 90, groundY, 3000);
            this.addSpike(spikeSection + 210, groundY, 5000);
            this.addCoinArc(spikeSection + 50, groundY - 80, 2);
            this.addCoinArc(spikeSection + 250, groundY - 80, 2);
            currentX += 320;

            // === SECTION 6: Flying enemies and vertical platforms ===
            for (let i = 0; i < 3; i++) {
                const platY = groundY - 80 - i * 40;
                const platX = currentX + i * 120;
                this.platforms.push(new Platform(platX, platY, 120, 20, 'static'));
                this.addCoinArc(platX + 60, platY - 50, 2);
                currentX += 120;
            }
            this.platforms.push(new Platform(currentX, groundY, 200, 80, 'static'));
            currentX += 200;

            // === SECTION 7: Challenge section - combined elements ===
            const challengeGaps = [
                { gap: 80, plat: 120, enemy: false, spike: false },
                { gap: 80, plat: 120, enemy: false, spike: true },
                { gap: 120, plat: 160, enemy: true, spike: true },
                { gap: 80, plat: 120, enemy: false, spike: false }
            ];
            for (const ch of challengeGaps) {
                currentX += ch.gap;
                this.platforms.push(new Platform(currentX, groundY, ch.plat, 80, 'static'));
                this.addCoinArc(currentX + ch.plat / 2, groundY - 80, 3);
                if (ch.enemy) {
                    this.addEnemy(currentX + ch.plat / 2, groundY - 40, 'goofball');
                }
                if (ch.spike) {
                    this.addSpike(currentX + ch.plat / 2, groundY, 2000);
                }
                currentX += ch.plat;
            }

            // === SECTION 8: Moving platform gauntlet ===
            for (let i = 0; i < 3; i++) {
                const moveX = currentX + i * 160;
                const moveY = 540 + (i % 2) * 20;
                const movePlat2 = new Platform(moveX, moveY, 120, 20, 'moving');
                movePlat2.moveSpeed = 0.8 + i * 0.2;
                movePlat2.moveDistance = 50;
                movePlat2.moveAxis = i % 2 === 0 ? 'x' : 'y';
                this.platforms.push(movePlat2);
            }
            currentX += 480;
            this.platforms.push(new Platform(currentX, groundY, 200, 80, 'static'));
            this.addCoinArc(currentX + 100, groundY - 80, 2);
            currentX += 200;

            // === SECTION 9: Final challenge before exit ===
            this.platforms.push(new Platform(currentX, groundY, 160, 80, 'static'));
            this.platforms.push(new Platform(currentX + 40, groundY - 120, 80, 20, 'static'));
            this.addCoinArc(currentX + 80, groundY - 170, 2);
            currentX += 240;
            this.platforms.push(new Platform(currentX, groundY, 320, 80, 'static'));
            this.addCoinArc(currentX + 160, groundY - 80, 5);
            this.addLuckyBlock(currentX + 160, groundY - 40, 'coin1');
            this.addEnemy(currentX + 160, groundY - 40, 'goofball');
            currentX += 40;

        } else if (levelNum === 2) {
            // ============ LEVEL 2: BLUE DEPTHS (reduced enemies) ============

            // === SECTION 2: Staircase platforms down then up ===
            for (let i = 0; i < 5; i++) {
                const gapSize = 70 + i * 10;
                const platWidth = 120;
                const yOff = (i < 3 ? i : 4 - i) * 30;
                currentX += gapSize;
                const platY = groundY - yOff;
                this.platforms.push(new Platform(currentX, platY, platWidth, i < 2 || i > 2 ? 80 : 20, 'static'));
                this.addCoinArc(currentX + platWidth / 2, platY - 70, 2);
                currentX += platWidth;
            }

            // === SECTION 3: Moving platforms over deep gap ===
            currentX += 40;
            for (let i = 0; i < 3; i++) {
                const mx = currentX + i * 130;
                const my = 520 + i * 25;
                const mp = new Platform(mx, my, 100, 20, 'moving');
                mp.moveSpeed = 0.8 + i * 0.3;
                mp.moveDistance = 40 + i * 10;
                mp.moveAxis = i % 2 === 0 ? 'x' : 'y';
                this.platforms.push(mp);
                if (i === 1) this.addLuckyBlock(mx + 30, my - 40, 'coin1');
            }
            currentX += 420;
            this.platforms.push(new Platform(currentX, groundY, 200, 80, 'static'));
            this.addCoinArc(currentX + 100, groundY - 80, 3);
            this.addEnemy(currentX + 80, groundY - 40, 'chicken');
            currentX += 240;

            // === SECTION 4: Vertical climb with flying enemies ===
            for (let i = 0; i < 4; i++) {
                const platY = groundY - 60 - i * 60;
                const platX = currentX + i * 80;
                this.platforms.push(new Platform(platX, platY, 80, 20, 'static'));
                this.addCoinArc(platX + 40, platY - 50, 1);
                currentX += 80;
            }
            // Descending back to ground
            for (let i = 0; i < 3; i++) {
                const platY = groundY - 60 - (2 - i) * 50;
                currentX += 70;
                this.platforms.push(new Platform(currentX, platY, 100, 20, 'static'));
                this.addCoinArc(currentX + 50, platY - 50, 2);
                currentX += 100;
            }
            this.platforms.push(new Platform(currentX, groundY, 180, 80, 'static'));
            currentX += 220;

            // === SECTION 5: Spike gauntlet with narrow platforms ===
            for (let i = 0; i < 4; i++) {
                const gap = 90;
                const pw = 100;
                currentX += gap;
                this.platforms.push(new Platform(currentX, groundY, pw, 80, 'static'));
                this.addCoinArc(currentX + pw / 2, groundY - 80, 2);
                if (i > 0) this.addSpike(currentX + 20, groundY, 2000 + i * 800);
                currentX += pw;
            }

            // === SECTION 6: Elevated enemy platforms ===
            currentX += 60;
            this.platforms.push(new Platform(currentX, groundY, 200, 80, 'static'));
            this.addCoinArc(currentX + 100, groundY - 80, 3);
            currentX += 240;
            // Elevated double platform
            this.platforms.push(new Platform(currentX, groundY - 80, 120, 20, 'static'));
            this.addCoinArc(currentX + 60, groundY - 130, 2);
            currentX += 140;
            this.platforms.push(new Platform(currentX, groundY - 120, 100, 20, 'static'));
            this.addCoinArc(currentX + 50, groundY - 170, 2);
            currentX += 120;
            // Back to ground
            this.platforms.push(new Platform(currentX, groundY, 200, 80, 'static'));
            this.addEnemy(currentX + 100, groundY - 40, 'grandma');
            currentX += 240;

            // === SECTION 7: Final stretch ===
            this.platforms.push(new Platform(currentX, groundY, 300, 80, 'static'));
            this.addCoinArc(currentX + 150, groundY - 80, 4);
            this.addLuckyBlock(currentX + 130, groundY - 40, 'coin3');
            this.addEnemy(currentX + 200, groundY - 40, 'goofball');
            currentX += 40;

        } else {
            // ============ LEVEL 3: RED INFERNO (reduced enemies) ============

            // === SECTION 2: Wide gaps with enemies ===
            for (let i = 0; i < 4; i++) {
                const gap = 80 + i * 20;
                const pw = 100;
                currentX += gap;
                this.platforms.push(new Platform(currentX, groundY, pw, 80, 'static'));
                this.addCoinArc(currentX + pw / 2, groundY - 80, 2);
                if (i === 1) this.addEnemy(currentX + pw / 2, groundY - 40, 'goofball');
                if (i === 3) this.addEnemy(currentX + pw / 2, groundY - 40, 'chicken');
                currentX += pw;
            }

            // === SECTION 3: Spike floor run ===
            currentX += 60;
            this.platforms.push(new Platform(currentX, groundY, 320, 80, 'static'));
            this.addSpike(currentX + 80, groundY, 1500);
            this.addSpike(currentX + 160, groundY, 2500);
            this.addSpike(currentX + 240, groundY, 3500);
            this.addCoinArc(currentX + 160, groundY - 80, 3);
            currentX += 360;

            // === SECTION 4: Elevated staircase ===
            for (let i = 0; i < 4; i++) {
                const platY = groundY - 60 - i * 35;
                currentX += 80;
                this.platforms.push(new Platform(currentX, platY, 80, 20, 'static'));
                this.addCoinArc(currentX + 40, platY - 50, 2);
                if (i === 2) this.addFlyingEnemy(currentX + 40, platY - 60);
                currentX += 100;
            }

            // === SECTION 5: Descending platforms ===
            for (let i = 0; i < 3; i++) {
                const platY = groundY - 120 + i * 40;
                currentX += 70;
                this.platforms.push(new Platform(currentX, platY, 100, 20, 'static'));
                this.addCoinArc(currentX + 50, platY - 50, 1);
                if (i === 1) this.addLuckyBlock(currentX + 30, platY - 40, 'coin1');
                currentX += 110;
            }
            this.platforms.push(new Platform(currentX, groundY, 160, 80, 'static'));
            this.addCoinArc(currentX + 80, groundY - 80, 2);
            currentX += 200;

            // === SECTION 6: Moving platform gauntlet over spikes ===
            for (let i = 0; i < 4; i++) {
                const mx = currentX + i * 120;
                const my = 520 + (i % 2) * 30;
                const mp = new Platform(mx, my, 90, 20, 'moving');
                mp.moveSpeed = 1.0 + i * 0.2;
                mp.moveDistance = 30 + i * 10;
                mp.moveAxis = i % 2 === 0 ? 'x' : 'y';
                this.platforms.push(mp);
                if (i === 2) this.addLuckyBlock(mx + 25, my - 40, 'coin1');
            }
            currentX += 500;
            this.platforms.push(new Platform(currentX, groundY, 200, 80, 'static'));
            this.addCoinArc(currentX + 100, groundY - 80, 3);
            currentX += 240;

            // === SECTION 7: Final stretch with all enemy types ===
            this.platforms.push(new Platform(currentX, groundY, 200, 80, 'static'));
            this.addCoinArc(currentX + 100, groundY - 80, 3);
            this.addEnemy(currentX + 80, groundY - 40, 'grandma');
            currentX += 240;
            this.platforms.push(new Platform(currentX, groundY, 400, 80, 'static'));
            this.addCoinArc(currentX + 150, groundY - 80, 5);
            this.addLuckyBlock(currentX + 130, groundY - 40, 'coin3');
            this.addEnemy(currentX + 200, groundY - 40, 'chicken');
            currentX += 60;
        }

        // === EXIT (overlaps with final platform for seamless transition) ===
        this.exitX = currentX + 240;
        this.platforms.push(new Platform(this.exitX, groundY, 200, 80, 'static'));

        // Apply difficulty scaling — each creature's speed stays constant per level
        const speedBase = [1.0, 1.15, 1.35];
        const speedMult = speedBase[Math.min(levelNum - 1, 2)];
        for (const enemy of this.enemies) {
            enemy.velocityX *= speedMult;
        }
    }

    addCoinArc(x, y, count) {
        for (let i = 0; i < count; i++) {
            this.coins.push(new Coin(x + i * 30, y - Math.sin(i / count * Math.PI) * 40, false));
        }
    }

    addEnemy(x, y, type) {
        this.enemies.push(new Enemy(x, y, type));
    }

    addFlyingEnemy(x, y) {
        this.enemies.push(new Enemy(x, y, 'flyingmeme'));
    }

    addLuckyBlock(x, y, reward) {
        // Snap to 40px grid - must be exactly on grid
        const gridX = Math.round(x / 40) * 40;
        const gridY = Math.round(y / 40) * 40;
        
        // Check for overlap with existing lucky blocks (minimum 60px spacing)
        for (const existing of this.luckyBlocks) {
            const dx = Math.abs((gridX + 20) - (existing.x + 20));
            const dy = Math.abs(gridY - existing.y);
            if (dx < 60 && dy < 60) {
                return;
            }
        }
        
        // Check if there's a platform at the lucky block position
        // Split the platform to create a gap for the lucky block (Minecraft-style)
        const luckyBlockWidth = 40;
        const luckyBlockHeight = 40;
        let attachSide = null;
        
        for (let i = 0; i < this.platforms.length; i++) {
            const platform = this.platforms[i];
            if (platform.isLuckyBlock) continue;
            
            // Check if the platform overlaps with the lucky block position horizontally
            if (gridX + luckyBlockWidth > platform.x && gridX < platform.x + platform.width) {
                const blockBottom = gridY + luckyBlockHeight;
                const blockTop = gridY;
                const platformTop = platform.y;
                const platformBottom = platform.y + platform.height;
                
                if (Math.abs(blockBottom - platformTop) < 5) {
                    attachSide = 'top';
                } else if (Math.abs(blockTop - platformBottom) < 5) {
                    attachSide = 'bottom';
                }
                
                if (attachSide) {
                    // Platform overlaps with lucky block position
                    // Split the platform into two parts with a gap for the lucky block
                    const leftWidth = gridX - platform.x;
                    const rightStartX = gridX + luckyBlockWidth;
                    const rightWidth = (platform.x + platform.width) - rightStartX;
                    
                    // Remove the original platform
                    this.platforms.splice(i, 1);
                    
                    // Add left part (if any)
                    if (leftWidth > 0) {
                        const leftPlatform = new Platform(platform.x, platform.y, leftWidth, platform.height, platform.type);
                        leftPlatform.platformColor = platform.platformColor;
                        leftPlatform.moving = platform.moving;
                        leftPlatform.moveSpeed = platform.moveSpeed;
                        leftPlatform.moveDistance = platform.moveDistance;
                        leftPlatform.moveAxis = platform.moveAxis;
                        this.platforms.splice(i, 0, leftPlatform);
                        i++;
                    }
                    
                    // Add right part (if any)
                    if (rightWidth > 0) {
                        const rightPlatform = new Platform(rightStartX, platform.y, rightWidth, platform.height, platform.type);
                        rightPlatform.platformColor = platform.platformColor;
                        rightPlatform.moving = platform.moving;
                        rightPlatform.moveSpeed = platform.moveSpeed;
                        rightPlatform.moveDistance = platform.moveDistance;
                        rightPlatform.moveAxis = platform.moveAxis;
                        this.platforms.splice(i, 0, rightPlatform);
                    }
                    
                    break;
                }
            }
        }
        
        const block = {
            x: gridX,
            y: gridY,
            width: 40,
            height: 40,
            reward: reward,
            used: false,
            bounceTimer: 0,
            attachSide: attachSide,
            bounceAmount: 0,
            isLuckyBlock: true,
            visible: true,
            replacedWithPlatform: false,
            platformType: 'static',
            platformColor: '#8B7355',
            playerLandedOnTop: false,
            playerHitFromBelow: false
        };
        this.luckyBlocks.push(block);
        GameState.activeLuckyBlocks.push(block);
        // Add to platforms for collision detection
        this.platforms.push(block);
    }

    addSpike(x, groundY, delay) {
        const spike = {
            x: x - 15,
            y: groundY,
            width: 30,
            height: 30,
            delay: delay,
            triggered: false,
            emerged: false,
            visible: true,
            pulseTimer: 0
        };
        this.spikes.push(spike);
        GameState.activeSpikes.push(spike);
    }

    drawBackground(ctx, theme) {
        const currentTheme = theme || this.levelThemes[Math.min(GameState.currentLevel, 3)] || this.levelThemes[1];

        // Sky gradient
        const skyGrad = ctx.createLinearGradient(0, 0, 0, 600);
        skyGrad.addColorStop(0, currentTheme.bg);
        skyGrad.addColorStop(1, '#B0E0E6');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, ctx.canvas.width, 600);

        // Sun (parallax 0.05)
        const sunX = 700 - GameState.cameraX * 0.05;
        ctx.fillStyle = 'rgba(255, 255, 200, 0.4)';
        ctx.beginPath();
        ctx.arc(sunX, 80, 70, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 200, 0.7)';
        ctx.beginPath();
        ctx.arc(sunX, 80, 45, 0, Math.PI * 2);
        ctx.fill();

        // Far mountains (parallax 0.1)
        ctx.fillStyle = currentTheme.hill;
        for (let i = 0; i < 15; i++) {
            const mtnX = (i * 400 - GameState.cameraX * 0.1) % (ctx.canvas.width + 600);
            const mtnDrawX = mtnX > -200 ? mtnX : mtnX + ctx.canvas.width + 600;
            this.drawMountain(ctx, mtnDrawX, 580, 100 + (i % 4) * 30);
        }

        // Mid hills (parallax 0.2)
        ctx.fillStyle = currentTheme.tree;
        for (let i = 0; i < 20; i++) {
            const hillX = (i * 300 + 150 - GameState.cameraX * 0.2) % (ctx.canvas.width + 500);
            const hillDrawX = hillX > -150 ? hillX : hillX + ctx.canvas.width + 500;
            this.drawHill(ctx, hillDrawX, 600, 60 + (i % 3) * 20);
        }

        // Trees (parallax 0.3)
        for (let i = 0; i < 25; i++) {
            const treeX = (i * 250 + 80 - GameState.cameraX * 0.3) % (ctx.canvas.width + 400);
            const treeDrawX = treeX > -80 ? treeX : treeX + ctx.canvas.width + 400;
            this.drawTree(ctx, treeDrawX, 590, 0.6 + (i % 4) * 0.2);
        }

        // Clouds (parallax 0.15)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        for (let i = 0; i < 18; i++) {
            const cloudX = (i * 280 + 40 - GameState.cameraX * 0.15) % (ctx.canvas.width + 400);
            const cloudDrawX = cloudX > -120 ? cloudX : cloudX + ctx.canvas.width + 400;
            const cloudY = 30 + (i % 5) * 40;
            this.drawCloud(ctx, cloudDrawX, cloudY);
        }

        // Bushes (parallax 0.4)
        for (let i = 0; i < 30; i++) {
            const bushX = (i * 180 + 60 - GameState.cameraX * 0.4) % (ctx.canvas.width + 300);
            const bushDrawX = bushX > -80 ? bushX : bushX + ctx.canvas.width + 300;
            this.drawBush(ctx, bushDrawX, 605, 0.5 + (i % 3) * 0.2);
        }

        // Decorative flowers/grass details (parallax 0.5)
        ctx.fillStyle = 'rgba(46, 204, 113, 0.6)';
        for (let i = 0; i < 40; i++) {
            const grassX = (i * 120 + 30 - GameState.cameraX * 0.5) % (ctx.canvas.width + 200);
            const grassDrawX = grassX > -40 ? grassX : grassX + ctx.canvas.width + 200;
            ctx.beginPath();
            ctx.arc(grassDrawX, 600, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawHill(ctx, x, baseY, height) {
        ctx.beginPath();
        ctx.moveTo(x, baseY);
        ctx.quadraticCurveTo(x + 60, baseY - height, x + 120, baseY);
        ctx.closePath();
        ctx.fill();
    }

    drawTree(ctx, x, baseY, scale) {
        const treeH = 60 * scale;
        const trunkW = 12 * scale;
        const canopyR = 25 * scale;
        
        // Trunk
        ctx.fillStyle = '#5D4037';
        ctx.fillRect(x - trunkW / 2, baseY - treeH + canopyR, trunkW, treeH - canopyR);
        
        // Canopy layers
        ctx.fillStyle = '#4CAF50';
        ctx.beginPath();
        ctx.arc(x, baseY - treeH + canopyR, canopyR, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#66BB6A';
        ctx.beginPath();
        ctx.arc(x - canopyR * 0.5, baseY - treeH + canopyR + 5, canopyR * 0.7, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#81C784';
        ctx.beginPath();
        ctx.arc(x + canopyR * 0.5, baseY - treeH + canopyR + 8, canopyR * 0.6, 0, Math.PI * 2);
        ctx.fill();
    }

    drawBush(ctx, x, baseY, scale) {
        const bushR = 15 * scale;
        ctx.fillStyle = '#388E3C';
        ctx.beginPath();
        ctx.arc(x, baseY - bushR, bushR, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4CAF50';
        ctx.beginPath();
        ctx.arc(x + bushR * 0.6, baseY - bushR * 0.8, bushR * 0.7, 0, Math.PI * 2);
        ctx.fill();
    }

    drawCloud(ctx, x, y) {
        ctx.beginPath();
        ctx.arc(x, y, 30, 0, Math.PI * 2);
        ctx.arc(x + 30, y - 10, 35, 0, Math.PI * 2);
        ctx.arc(x + 60, y, 30, 0, Math.PI * 2);
        ctx.fill();
    }

    drawMountain(ctx, x, baseY, height) {
        ctx.beginPath();
        ctx.moveTo(x, baseY);
        ctx.lineTo(x + 80, baseY - height);
        ctx.lineTo(x + 160, baseY);
        ctx.closePath();
        ctx.fill();
    }

    // ==================== LUCKY BLOCK DRAWING ====================
    drawLuckyBlocks(ctx) {
        for (const block of this.luckyBlocks) {
            if (block.used) continue;

            // Bounce animation (move up only so lucky blocks do not overlap the platform below)
            block.bounceTimer += 16;
            block.bounceAmount = Math.abs(Math.sin(block.bounceTimer * 0.005)) * 3;

            const drawY = block.y - block.bounceAmount;

            ctx.save();

            // Draw as individual blocks (2x2 grid for 40x40 block)
            const blockSize = 20;
            const cols = 2;
            const rows = 2;
            
            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    const bx = block.x + col * blockSize;
                    const by = drawY + row * blockSize;
                    const bw = Math.min(blockSize, block.width - col * blockSize);
                    const bh = Math.min(blockSize, block.height - row * blockSize);
                    
                    // Determine if this is a top/bottom row based on attachment
                    const isTopRow = row === 0;
                    const isBottomRow = row === rows - 1;
                    
                    // Block body with gradient
                    const blockGrad = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
                    blockGrad.addColorStop(0, '#F39C12');
                    blockGrad.addColorStop(0.5, '#F1C40F');
                    blockGrad.addColorStop(1, '#E67E22');
                    ctx.fillStyle = blockGrad;
                    ctx.fillRect(bx, by, bw - 2, bh - 2);
                    
                    // Block border
                    ctx.strokeStyle = '#D68910';
                    ctx.lineWidth = 1.5;
                    ctx.strokeRect(bx, by, bw - 2, bh - 2);
                    
                    // If attached to ground (top), add grass on top edge
                    if (block.attachSide === 'top' && isTopRow) {
                        ctx.fillStyle = '#2ecc71';
                        ctx.fillRect(bx, by, bw - 2, 6);
                        ctx.strokeStyle = '#1e8449';
                        ctx.lineWidth = 1.5;
                        ctx.strokeRect(bx, by, bw - 2, bh - 2);
                    }
                    
                    // If attached to ceiling (bottom), add grass on bottom edge
                    if (block.attachSide === 'bottom' && isBottomRow) {
                        ctx.fillStyle = '#2ecc71';
                        ctx.fillRect(bx, by + bh - 6, bw - 2, 6);
                        ctx.strokeStyle = '#1e8449';
                        ctx.lineWidth = 1.5;
                        ctx.strokeRect(bx, by, bw - 2, bh - 2);
                    }
                    
                    // Subtle highlight on top edge
                    if (isTopRow) {
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                        ctx.fillRect(bx + 2, by + 1, bw - 6, 2);
                    }
                    
                    // Shadow on bottom edge
                    if (isBottomRow) {
                        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
                        ctx.fillRect(bx + 2, by + bh - 3, bw - 6, 2);
                    }
                }
            }

            // Question mark (only on top-left block)
            ctx.fillStyle = '#FFF';
            ctx.strokeStyle = '#D68910';
            ctx.lineWidth = 2;
            ctx.font = 'bold 24px Impact';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.strokeText('?', block.x + block.width / 2, drawY + block.height / 2 + 1);
            ctx.fillText('?', block.x + block.width / 2, drawY + block.height / 2 + 1);

            // Corner rivets
            ctx.fillStyle = '#D68910';
            ctx.beginPath();
            ctx.arc(block.x + 5, drawY + 5, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(block.x + block.width - 5, drawY + 5, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(block.x + 5, drawY + block.height - 5, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(block.x + block.width - 5, drawY + block.height - 5, 2, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }
    }

    drawUsedLuckyBlocks(ctx) {
        for (const block of this.luckyBlocks) {
            if (!block.used) continue;

            ctx.save();

            // If replaced with platform (player landed on top), draw as solid platform block
            if (block.replacedWithPlatform) {
                const blockSize = 20;
                const cols = 2;
                const rows = 2;
                
                for (let row = 0; row < rows; row++) {
                    for (let col = 0; col < cols; col++) {
                        const bx = block.x + col * blockSize;
                        const by = block.y + row * blockSize;
                        const bw = Math.min(blockSize, block.width - col * blockSize);
                        const bh = Math.min(blockSize, block.height - row * blockSize);
                        
                        // Draw as regular platform block (brown with border)
                        ctx.fillStyle = block.platformColor || '#8B7355';
                        ctx.fillRect(bx, by, bw - 2, bh - 2);
                        
                        // Block border
                        ctx.strokeStyle = '#6B5340';
                        ctx.lineWidth = 1.5;
                        ctx.strokeRect(bx, by, bw - 2, bh - 2);
                        
                        // Grass top for platform blocks
                        if (row === 0) {
                            ctx.fillStyle = '#27AE60';
                            ctx.fillRect(bx, by, bw - 2, 4);
                        }
                    }
                }
            } else {
                // Draw used block with X marks (hit from below)
                const blockSize = 20;
                const cols = 2;
                const rows = 2;
                
                for (let row = 0; row < rows; row++) {
                    for (let col = 0; col < cols; col++) {
                        const bx = block.x + col * blockSize;
                        const by = block.y + row * blockSize;
                        const bw = Math.min(blockSize, block.width - col * blockSize);
                        const bh = Math.min(blockSize, block.height - row * blockSize);
                        
                        ctx.fillStyle = '#8B7355';
                        ctx.fillRect(bx, by, bw - 2, bh - 2);
                        
                        ctx.strokeStyle = '#6B5340';
                        ctx.lineWidth = 1.5;
                        ctx.strokeRect(bx, by, bw - 2, bh - 2);
                    }
                }

                // Small X marks on each block
                ctx.strokeStyle = '#6B5340';
                ctx.lineWidth = 2;
                for (let row = 0; row < rows; row++) {
                    for (let col = 0; col < cols; col++) {
                        const bx = block.x + col * blockSize + 2;
                        const by = block.y + row * blockSize + 2;
                        const bw = Math.min(blockSize, block.width - col * blockSize) - 4;
                        const bh = Math.min(blockSize, block.height - row * blockSize) - 4;
                        
                        ctx.beginPath();
                        ctx.moveTo(bx + 4, by + 4);
                        ctx.lineTo(bx + bw - 4, by + bh - 4);
                        ctx.moveTo(bx + bw - 4, by + 4);
                        ctx.lineTo(bx + 4, by + bh - 4);
                        ctx.stroke();
                    }
                }
            }

            ctx.restore();
        }
    }

    // ==================== SPIKE DRAWING ====================
    drawSpikes(ctx) {
        for (const spike of this.spikes) {
            if (!spike.visible) continue;

            ctx.save();

            if (spike.emerged) {
                // Draw spikes (triangular)
                ctx.fillStyle = '#7F8C8D';
                ctx.strokeStyle = '#5D6D7E';
                ctx.lineWidth = 1.5;

                const spikeCount = 3;
                const spikeWidth = spike.width / spikeCount;

                for (let i = 0; i < spikeCount; i++) {
                    const sx = spike.x + i * spikeWidth;
                    ctx.beginPath();
                    ctx.moveTo(sx, spike.y);
                    ctx.lineTo(sx + spikeWidth / 2, spike.y - spike.height);
                    ctx.lineTo(sx + spikeWidth, spike.y);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                }

                // Danger glow
                ctx.shadowColor = 'rgba(231, 76, 60, 0.5)';
                ctx.shadowBlur = 8;
                ctx.fillStyle = 'rgba(231, 76, 60, 0.3)';
                ctx.beginPath();
                ctx.arc(spike.x + spike.width / 2, spike.y - spike.height / 2, 15, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            } else {
                // Hidden spike - subtle ground indicator
                spike.pulseTimer += 16;
                const pulseAlpha = 0.15 + Math.sin(spike.pulseTimer * 0.003) * 0.1;

                // Very subtle red tint in the ground
                ctx.fillStyle = `rgba(231, 76, 60, ${pulseAlpha})`;
                ctx.beginPath();
                ctx.roundRect(spike.x - 2, spike.y - 2, spike.width + 4, 4, 2);
                ctx.fill();
            }

            ctx.restore();
        }
    }
}

// ==================== UI MANAGER ====================
class UIManager {
    static updateHUD() {
        // Lives
        const livesEl = document.getElementById('hud-lives');
        if (livesEl) {
            livesEl.textContent = '❤️'.repeat(Math.max(0, GameState.lives));
        }

        // Coins
        const coinsEl = document.getElementById('hud-coins');
        if (coinsEl) {
            coinsEl.textContent = `🪙 x${GameState.coins}`;
        }

        // Score
        const scoreEl = document.getElementById('hud-score');
        if (scoreEl) {
            scoreEl.textContent = GameState.score.toLocaleString();
        }

        // Level
        const levelEl = document.getElementById('hud-level');
        if (levelEl) {
            levelEl.textContent = `LV. ${GameState.currentLevel}`;
        }

        // Progress
        const progressEl = document.getElementById('hud-progress');
        if (progressEl) {
            const progress = Math.min((GameState.cameraX / GameState.levelLength) * 100, 100);
            progressEl.style.width = `${progress}%`;
        }

        // Ability cooldown
        const abilityFill = document.getElementById('ability-cooldown-fill');
        if (abilityFill) {
            const cooldown = GameState.cooldowns[GameState.selectedCharacter];
            const maxCooldown = GameState.maxCooldowns[GameState.selectedCharacter];
            
            if (cooldown > 0) {
                const percent = ((maxCooldown - cooldown) / maxCooldown) * 100;
                abilityFill.style.width = `${percent}%`;
            } else {
                abilityFill.style.width = '100%';
            }
        }
    }

    static addFloatingText(text, x, y, color = '#ffe66d') {
        const container = document.getElementById('floating-messages');
        if (!container) return;
        
        const message = document.createElement('div');
        message.className = 'floating-message';
        message.textContent = text;
        message.style.color = color;
        message.style.left = `${Math.min(Math.max(x, 50), window.innerWidth - 100)}px`;
        message.style.top = `${Math.min(Math.max(y, 50), window.innerHeight - 50)}px`;
        
        container.appendChild(message);
        
        setTimeout(() => {
            if (message.parentNode) message.remove();
        }, 2000);
    }

    static showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        const screen = document.getElementById(screenId);
        if (screen) {
            screen.classList.add('active');
        }
    }

    static hideAllScreens() {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
    }
}

// ==================== EFFECTS MANAGER ====================
class EffectsManager {
    static particles = [];
    static floatingTexts = [];
    static screenFlashTimer = 0;
    static screenFlashColor = '#fff';
    static starBursts = [];

    static createParticles(x, y, count, color) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: x,
                y: y,
                velocityX: (Math.random() - 0.5) * 8,
                velocityY: (Math.random() - 0.5) * 8 - 3,
                life: 1000,
                maxLife: 1000,
                color: color,
                size: 3 + Math.random() * 4
            });
        }
    }

    // Mario-style star burst effect
    static createStarBurst(x, y, color = '#FFD700') {
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            this.starBursts.push({
                x: x,
                y: y,
                angle: angle,
                distance: 0,
                maxDistance: 40 + Math.random() * 30,
                speed: 2 + Math.random() * 2,
                color: color,
                life: 600,
                maxLife: 600,
                size: 4 + Math.random() * 3
            });
        }
    }

    // Mario-style coin sparkles
    static createCoinSparkle(x, y) {
        for (let i = 0; i < 8; i++) {
            this.particles.push({
                x: x,
                y: y,
                velocityX: (Math.random() - 0.5) * 4,
                velocityY: -3 - Math.random() * 4,
                life: 600,
                maxLife: 600,
                color: '#FFD700',
                size: 2 + Math.random() * 3,
                sparkle: true
            });
        }
    }

    // Mario-style level complete fireworks
    static createFirework(x, y) {
        const colors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#A8E6CF', '#FF8B94', '#FFFFFF'];
        for (let i = 0; i < 30; i++) {
            const angle = (i / 30) * Math.PI * 2;
            const speed = 3 + Math.random() * 5;
            this.particles.push({
                x: x,
                y: y,
                velocityX: Math.cos(angle) * speed,
                velocityY: Math.sin(angle) * speed,
                life: 1500,
                maxLife: 1500,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: 3 + Math.random() * 4,
                firework: true
            });
        }
    }

    // Mario-style "100!" floating text
    static addFloatingText(text, x, y, color = '#FFFFFF') {
        this.floatingTexts.push({
            text: text,
            x: x,
            y: y,
            velocityY: -2,
            life: 1000,
            maxLife: 1000,
            color: color,
            scale: 1.5,
            targetScale: 1
        });
    }

    // Screen flash effect
    static screenFlash(duration = 200, color = '#FFFFFF') {
        this.screenFlashTimer = duration;
        this.screenFlashColor = color;
    }

    static update(dt) {
        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.velocityY += p.firework ? 0.05 : 0.2;
            p.x += p.velocityX;
            p.y += p.velocityY;
            p.life -= dt;
            
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // Update star bursts
        for (let i = this.starBursts.length - 1; i >= 0; i--) {
            const s = this.starBursts[i];
            s.distance += s.speed;
            s.life -= dt;
            
            if (s.life <= 0 || s.distance >= s.maxDistance) {
                this.starBursts.splice(i, 1);
            }
        }

        // Update floating texts
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const t = this.floatingTexts[i];
            t.y += t.velocityY;
            t.scale += (t.targetScale - t.scale) * 0.1;
            t.life -= dt;
            
            if (t.life <= 0) {
                this.floatingTexts.splice(i, 1);
            }
        }

        // Update screen flash
        if (this.screenFlashTimer > 0) {
            this.screenFlashTimer -= dt;
        }

        // Update shake
        this.updateShake(dt);
    }

    static draw(ctx) {
        // Draw particles
        for (const p of this.particles) {
            const alpha = p.life / p.maxLife;
            ctx.globalAlpha = alpha;
            
            if (p.sparkle) {
                // Star-shaped sparkle
                ctx.fillStyle = p.color;
                ctx.beginPath();
                for (let j = 0; j < 4; j++) {
                    const angle = (j / 4) * Math.PI * 2;
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p.x + Math.cos(angle) * p.size, p.y + Math.sin(angle) * p.size);
                }
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;

        // Draw star bursts
        for (const s of this.starBursts) {
            const alpha = s.life / s.maxLife;
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = s.color;
            ctx.lineWidth = 2;
            
            const px = s.x + Math.cos(s.angle) * s.distance;
            const py = s.y + Math.sin(s.angle) * s.distance;
            
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(
                px - Math.cos(s.angle) * s.size,
                py - Math.sin(s.angle) * s.size
            );
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Draw floating texts
        for (const t of this.floatingTexts) {
            const alpha = Math.min(t.life / 300, 1);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = t.color;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.lineWidth = 3;
            ctx.font = `bold ${Math.floor(20 * t.scale)}px Impact`;
            ctx.textAlign = 'center';
            ctx.strokeText(t.text, t.x, t.y);
            ctx.fillText(t.text, t.x, t.y);
        }
        ctx.globalAlpha = 1;

        // Draw screen flash (draw in screen-space regardless of world transform)
        if (this.screenFlashTimer > 0) {
            ctx.save();
            // Reset transform so full-screen fillRect uses canvas coordinates
            if (typeof ctx.setTransform === 'function') ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.globalAlpha = Math.min(this.screenFlashTimer / 200, 1);
            ctx.fillStyle = this.screenFlashColor;
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.globalAlpha = 1;
            ctx.restore();
        }
    }

    static screenShake(intensity = 2, duration = 150) {
        GameState.screenShake = intensity;
        GameState.screenShakeTimer = duration;
        GameState.screenShakeActive = true;
    }

    static updateShake(dt) {
        if (GameState.screenShakeActive && GameState.screenShakeTimer > 0) {
            GameState.screenShakeTimer -= dt;
            if (GameState.screenShakeTimer <= 0) {
                GameState.screenShake = 0;
                GameState.screenShakeActive = false;
            }
        }
    }
}

// ==================== MEME POP CLASS ====================
class MemePop {
    constructor(x, y, memeIndex, scale = 1.0) {
        this.x = x;
        this.y = y;
        this.memeIndex = memeIndex;
        this.scale = scale;
        this.targetScale = scale;
        this.life = 1200; // ms
        this.maxLife = 1200;
        this.active = true;
        this.rotation = 0;
        this.vignetteAlpha = 0;
        this.flashAlpha = 0;
    }

    update(dt) {
        this.life -= dt;
        if (this.life <= 0) {
            this.active = false;
            return;
        }

        const progress = 1 - (this.life / this.maxLife);

        // Pop-in animation (scale up quickly then settle)
        if (progress < 0.15) {
            const t = progress / 0.15;
            this.scale = this.targetScale * (0.3 + t * 1.5); // overshoot
        } else if (progress > 0.7) {
            // Fade out at end
            const fadeT = (progress - 0.7) / 0.3;
            this.scale = this.targetScale * (1 - fadeT * 0.3);
        } else {
            this.scale = this.targetScale;
        }

        // Vignette and flash at start
        if (progress < 0.1) {
            this.vignetteAlpha = (1 - progress / 0.1) * 0.6;
            this.flashAlpha = (1 - progress / 0.05) * 0.8;
        } else {
            this.vignetteAlpha = 0;
            this.flashAlpha = 0;
        }
    }

    draw(ctx, canvasWidth, canvasHeight, gameRef) {
        if (!this.active) return;

        const img = gameRef?.memeImages?.[this.memeIndex] || null;
        if (!img || !img.complete || !img.naturalWidth) return;

        ctx.save();

        // Flash effect
        if (this.flashAlpha > 0) {
            ctx.globalAlpha = this.flashAlpha;
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
            ctx.globalAlpha = 1;
        }

        // Vignette overlay
        if (this.vignetteAlpha > 0) {
            ctx.globalAlpha = this.vignetteAlpha;
            const vignetteGrad = ctx.createRadialGradient(
                canvasWidth / 2, canvasHeight / 2, canvasHeight * 0.3,
                canvasWidth / 2, canvasHeight / 2, canvasHeight * 0.9
            );
            vignetteGrad.addColorStop(0, 'transparent');
            vignetteGrad.addColorStop(1, 'rgba(0,0,0,0.8)');
            ctx.fillStyle = vignetteGrad;
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
            ctx.globalAlpha = 1;
        }

        // Draw meme image centered on screen with pop-out effect
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;

        ctx.translate(centerX, centerY);

        const displayWidth = Math.min(img.naturalWidth * this.scale, canvasWidth * 0.8);
        const displayHeight = img.naturalHeight * this.scale * (displayWidth / (img.naturalWidth * this.scale));

        // Shadow behind meme
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 30;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 10;

        try {
            ctx.drawImage(img, -displayWidth / 2, -displayHeight / 2, displayWidth, displayHeight);
        } catch (e) {
            // Silently skip if image fails to render
        }

        ctx.restore();
    }
}

// ==================== MAIN GAME CLASS ====================
class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.input = new InputHandler();
        this.levelManager = new LevelManager();
        
        this.player = null;
        this.projectiles = [];
        this.worldEvents = [];
        this.memePops = [];
        
        // Load meme images
        this.memeImages = [];
        this.memeImageCount = 0;
        const memeFiles = ['Pasted Image.png', 'Pasted Image 2.png'];
        memeFiles.forEach((path, i) => {
            const img = new Image();
            img.onload = () => {
                this.memeImageCount++;
            };
            img.onerror = () => {
                console.warn(`Failed to load meme image: ${path}`);
            };
            img.src = path;
            this.memeImages[i] = img;
        });
        
        this.lastTime = 0;
        this.running = false;
        this.animFrameId = null;
        
        this.setupCanvas();
        this.setupEventListeners();
        this.setupMenuListeners();
        
        window.addEventListener('resize', () => this.setupCanvas());
    }

    setupCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    setupEventListeners() {
        // Escape for pause
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Escape') {
                this.togglePause();
            }
            
            // E for ability (when game is running)
            if (e.code === 'KeyE' && this.player && this.running && !GameState.isPaused) {
                this.player.useAbility();
            }
            
            // World event key handlers
            if (e.code === 'KeyF' && this.worldEvents.length > 0) {
                for (const event of this.worldEvents) {
                    if (event.type === 'buttonmash' && event.active) {
                        event.mashCount += 2;
                    }
                }
            }
        });
    }

    setupMenuListeners() {
        // Start button
        document.getElementById('btn-start')?.addEventListener('click', () => {
            UIManager.showScreen('character-select');
        });

        // Character selection
        document.querySelectorAll('.character-card').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('.character-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                GameState.selectedCharacter = card.dataset.character;
            });
        });

        // Select character and start
        document.querySelectorAll('.select-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const card = btn.closest('.character-card');
                if (card) {
                    GameState.selectedCharacter = card.dataset.character;
                    this.startGame();
                }
            });
        });

        // Back to menu
        document.getElementById('btn-back-menu')?.addEventListener('click', () => {
            UIManager.showScreen('main-menu');
        });

        // Controls
        document.getElementById('btn-controls')?.addEventListener('click', () => {
            UIManager.showScreen('controls-screen');
        });

        document.getElementById('btn-back-from-controls')?.addEventListener('click', () => {
            UIManager.showScreen('main-menu');
        });

        // Pause menu
        document.getElementById('btn-resume')?.addEventListener('click', () => {
            this.togglePause();
        });

        document.getElementById('btn-restart')?.addEventListener('click', () => {
            this.togglePause();
            this.startLevel(GameState.currentLevel);
        });

        document.getElementById('btn-quit')?.addEventListener('click', () => {
            this.running = false;
            GameState.isPaused = false;
            UIManager.hideAllScreens();
            UIManager.showScreen('main-menu');
        });

        // Game over
        document.getElementById('btn-retry')?.addEventListener('click', () => {
            UIManager.hideAllScreens();
            this.startLevel(GameState.currentLevel);
        });

        document.getElementById('btn-quit-go')?.addEventListener('click', () => {
            UIManager.hideAllScreens();
            UIManager.showScreen('main-menu');
        });

        // Victory
        document.getElementById('btn-play-again')?.addEventListener('click', () => {
            UIManager.hideAllScreens();
            this.startGame();
        });
    }

    startGame() {
        GameState.currentLevel = 1;
        GameState.score = 0;
        GameState.coins = 0;
        GameState.lives = 3;
        
        UIManager.hideAllScreens();
        this.startLevel(1);
    }

    startLevel(levelNum) {
        GameState.currentLevel = levelNum;
        GameState.isPaused = false;
        GameState.cameraX = 0;
        GameState.cooldowns[GameState.selectedCharacter] = 0;
        
        // Generate level first so starting platform exists
        this.levelManager.generateLevel(levelNum);
        
        // Find starting platform and spawn on top of it
        const startPlat = this.levelManager.platforms.find(p => p.x === 0 && p.width >= 400);
        const groundY = startPlat ? startPlat.y : 580;
        const playerHeight = GameState.selectedCharacter === 'dwayne' ? 62 : 82;
        this.player = new Player(100, groundY - playerHeight - 50, GameState.selectedCharacter, this);
        // Snap player onto the starting platform below them
        for (const plat of this.levelManager.platforms) {
            if (plat.isLuckyBlock && !plat.replacedWithPlatform) continue;
            const pBottom = this.player.y + this.player.height;
            if (this.player.x < plat.x + plat.width && this.player.x + this.player.width > plat.x) {
                if (pBottom >= plat.y && pBottom <= plat.y + plat.height) {
                    this.player.y = plat.y - this.player.height;
                    this.player.grounded = true;
                    break;
                }
            }
        }
        this.projectiles = [];
        this.worldEvents = [];
        
        UIManager.hideAllScreens();
        UIManager.updateHUD();
        
        this.running = true;
        this.lastTime = performance.now();
        if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
        this.animFrameId = requestAnimationFrame((t) => this.gameLoop(t));
    }

    togglePause() {
        if (!this.running) return;
        
        GameState.isPaused = !GameState.isPaused;
        
        if (GameState.isPaused) {
            UIManager.showScreen('pause-menu');
        } else {
            UIManager.hideAllScreens();
            this.lastTime = performance.now();
            if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
            this.animFrameId = requestAnimationFrame((t) => this.gameLoop(t));
        }
    }

    gameLoop(timestamp) {
        if (!this.running || GameState.isPaused) return;

        // Cap dt to prevent physics tunneling on first frame or after lag spikes
        const dt = Math.min(timestamp - this.lastTime, 33);
        this.lastTime = timestamp;

        // Slow motion
        if (GameState.slowMotion) {
            GameState.slowMotionTimer -= dt;
            if (GameState.slowMotionTimer <= 0) {
                GameState.slowMotion = false;
            }
            this.update(dt * 0.3);
        } else {
            this.update(dt);
        }

        this.render();

        this.animFrameId = requestAnimationFrame((t) => this.gameLoop(t));
    }

    update(dt) {
        // Update player
        this.player.update(dt, this.levelManager.platforms);

        // Update camera - smooth follow
        const targetX = this.player.x - this.canvas.width * 0.35;
        const camDiff = targetX - GameState.cameraX;
        if (Math.abs(camDiff) < 1) {
            GameState.cameraX = targetX;
        } else {
            GameState.cameraX += camDiff * 0.18 * (dt / 16);
        }
        GameState.cameraX = Math.max(0, GameState.cameraX);

        // Update platforms; some lucky block entries are plain objects and do not have update()
        for (const platform of this.levelManager.platforms) {
            if (typeof platform.update === 'function') {
                platform.update(dt);
            }
        }

        // Update enemies
        for (const enemy of this.levelManager.enemies) {
            enemy.update(dt, this.levelManager.platforms);
            
            // Check collision with player
            if (enemy.alive && this.checkCollision(this.player, enemy)) {
                // Stomp from above
                if (this.player.velocityY > 0 && this.player.y < enemy.y) {
                    enemy.takeDamage();
                    this.player.velocityY = -10;
                    GameState.score += 50;
                    UIManager.updateHUD();
                    
                    // Cool Mario-style enemy defeat animation
                    EffectsManager.createStarBurst(enemy.x + enemy.width/2, enemy.y + enemy.height/2, '#FF6B6B');
                    EffectsManager.addFloatingText('BUMP!', enemy.x, enemy.y - 20, '#FFFFFF');
                    EffectsManager.screenFlash(100, '#FF6B6B');
                    EffectsManager.screenShake(4);
                    
                    // Meme pop on enemy defeat
                    const memeIdx = this.player.character === 'dwayne' ? 1 : 0;
                    this.memePops.push(new MemePop(enemy.x, enemy.y, memeIdx, 0.4));
                } else {
                    this.player.takeDamage();
                }
            }
        }

        // Update coins
        for (const coin of this.levelManager.coins) {
            coin.update(dt);
            
            if (!coin.collected && this.checkCollision(this.player, coin)) {
                coin.collected = true;
                GameState.coins++;
                GameState.score += 100;
                EffectsManager.addFloatingText('+100', coin.x, coin.y - 20, '#FFD700');
                EffectsManager.createCoinSparkle(coin.x + 12, coin.y + 12);
                UIManager.updateHUD();
            }
        }

        // Update projectiles
        for (const projectile of this.projectiles) {
            projectile.update(dt);
            
            // Check collision with enemies
            for (const enemy of this.levelManager.enemies) {
                if (enemy.alive && projectile.alive && this.checkCollision(projectile, enemy)) {
                    const wasAlive = enemy.alive;
                    enemy.takeDamage(projectile.damage);
                    projectile.alive = false;
                    EffectsManager.createParticles(projectile.x, projectile.y, 8, '#fff');
                    if (wasAlive && !enemy.alive && this.player) {
                        const memeIdx = this.player.character === 'dwayne' ? 1 : 0;
                        this.memePops.push(new MemePop(enemy.x, enemy.y, memeIdx, 0.4));
                    }
                }
            }
        }

        // Remove dead projectiles
        this.projectiles = this.projectiles.filter(p => p.alive);

        // Update meme pops and remove finished ones
        for (const meme of this.memePops) {
            meme.update(dt);
        }
        this.memePops = this.memePops.filter(m => m.active);

        // Update global effects state (screen flash, shake, particles)
        EffectsManager.update(dt);

        // Check spring collisions
        for (const platform of this.levelManager.platforms) {
            if (platform.isSpring && this.checkCollision(this.player, platform)) {
                if (this.player.velocityY > 0 && this.player.y + this.player.height <= platform.y + 8) {
                    this.player.velocityY = platform.springPower;
                    this.player.grounded = false;
                    this.player.jumps = 0;
                    platform.compressed = true;
                    platform.springTimer = 0;
                    UIManager.addFloatingText('BOING!', this.player.x, this.player.y - 40, '#f39c12');
                    EffectsManager.createParticles(this.player.x + this.player.width/2, this.player.y + this.player.height, 8, '#f39c12');
                }
            }
        }

        // Check exit — player center passed the flag
        if (this.player.x + this.player.width / 2 >= this.levelManager.exitX) {
            this.nextLevel();
            return;
        }
    }

    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        // Save context and apply camera transform for world-space rendering
        this.ctx.save();
        // Apply camera shake offset if active
        const shakeX = GameState.screenShakeActive ? (Math.random() * 2 - 1) * GameState.screenShake : 0;
        const shakeY = GameState.screenShakeActive ? (Math.random() * 2 - 1) * GameState.screenShake * 0.5 : 0;
        this.ctx.translate(-GameState.cameraX + shakeX, shakeY);

        // Draw platforms (skip lucky blocks - they're drawn separately)
        for (const platform of this.levelManager.platforms) {
            if (!platform.isLuckyBlock && typeof platform.draw === 'function') {
                platform.draw(this.ctx);
            }
        }

        // Draw coins
        for (const coin of this.levelManager.coins) {
            coin.draw(this.ctx);
        }

        // Draw enemies
        for (const enemy of this.levelManager.enemies) {
            enemy.draw(this.ctx);
        }

        // Draw projectiles
        for (const projectile of this.projectiles) {
            projectile.draw(this.ctx);
        }

        // Draw lucky blocks
        this.levelManager.drawLuckyBlocks(this.ctx);
        this.levelManager.drawUsedLuckyBlocks(this.ctx);

        // Draw spikes
        this.levelManager.drawSpikes(this.ctx);

        // Draw exit
        this.drawExit(this.ctx, this.levelManager.exitX, 500);

        // Draw player
        if (this.player) {
            this.player.draw(this.ctx);
        }

        // Draw world-space effects (particles, starbursts, floating texts) while camera transform is active
        EffectsManager.draw(this.ctx);

        // Restore to screen-space for UI and full-screen overlays
        this.ctx.restore(); // Restore camera

        // Draw meme pops (they expect screen coordinates)
        for (const meme of this.memePops) {
            meme.draw(this.ctx, this.canvas.width, this.canvas.height, this);
        }

        // Draw world events (screen-space overlays)
        this.drawWorldEvents(this.ctx);

        // Draw ability instructions
        this.drawAbilityInstructions(this.ctx);

        // Draw cinematic transition
        this.drawCinematicTransition(this.ctx);
    }

    drawExit(ctx, x, y) {
        // Simple Mario-style flag pole
        ctx.fillStyle = '#95a5a6';
        ctx.fillRect(x, y, 6, 120);
        
        // Ball on top
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(x + 3, y, 10, 0, Math.PI * 2);
        ctx.fill();
        
        // Flag
        ctx.fillStyle = '#2ecc71';
        ctx.beginPath();
        ctx.moveTo(x + 6, y + 10);
        ctx.lineTo(x + 50, y + 30);
        ctx.lineTo(x + 6, y + 50);
        ctx.closePath();
        ctx.fill();
        
        // Flag border
        ctx.strokeStyle = '#27ae60';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    drawCinematicTransition(ctx) {
        if (!GameState.cinematicTransition) return;
        
        const progress = 1 - (GameState.cinematicTimer / 2500);
        const alpha = progress < 0.2 ? progress / 0.2 : progress > 0.8 ? (1 - progress) / 0.2 : 1;
        
        ctx.save();
        ctx.globalAlpha = alpha * 0.9;
        
        // Full screen background
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        ctx.globalAlpha = alpha;
        
        if (GameState.cinematicChar === 'dwayne') {
            // The Rock cinematic - Mewing meme pose
            const cx = this.canvas.width / 2;
            const cy = this.canvas.height / 2;
            
            // Sparkle effects
            for (let i = 0; i < 12; i++) {
                const sparkleX = cx + Math.sin(Date.now() / 300 + i * 1.5) * 200;
                const sparkleY = cy + Math.cos(Date.now() / 400 + i * 1.2) * 120;
                const sparkleSize = 3 + Math.sin(Date.now() / 200 + i) * 2;
                
                ctx.fillStyle = `rgba(255, 215, 0, ${0.5 + Math.sin(Date.now() / 300 + i) * 0.5})`;
                ctx.beginPath();
                // Draw star sparkle
                for (let j = 0; j < 4; j++) {
                    const angle = (j / 4) * Math.PI * 2 + Date.now() / 500;
                    ctx.moveTo(sparkleX, sparkleY);
                    ctx.lineTo(sparkleX + Math.cos(angle) * sparkleSize * 2, sparkleY + Math.sin(angle) * sparkleSize * 2);
                }
                ctx.stroke();
            }
            
            // Glowing eyes effect
            const eyeGlow = 0.5 + Math.sin(Date.now() / 400) * 0.3;
            ctx.shadowColor = '#fff';
            ctx.shadowBlur = 30;
            ctx.fillStyle = `rgba(255, 255, 255, ${eyeGlow})`;
            ctx.beginPath();
            ctx.arc(cx - 20, cy - 40, 8, 0, Math.PI * 2);
            ctx.arc(cx + 20, cy - 40, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            
            // Jawline glow
            ctx.strokeStyle = `rgba(255, 215, 0, ${0.3 + Math.sin(Date.now() / 500) * 0.2})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(cx - 30, cy - 20);
            ctx.quadraticCurveTo(cx, cy + 10, cx + 30, cy - 20);
            ctx.stroke();
            
            // Wind lines
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = 2;
            for (let i = 0; i < 8; i++) {
                const windY = cy - 80 + i * 25;
                const windOffset = (Date.now() / 10 + i * 50) % 400;
                ctx.beginPath();
                ctx.moveTo(cx - 200 + windOffset, windY);
                ctx.lineTo(cx - 150 + windOffset, windY);
                ctx.stroke();
            }
            
            // Text
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 52px Impact';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(255, 215, 0, 0.8)';
            ctx.shadowBlur = 20;
            ctx.fillText('THE ROCK IS', cx, cy + 80);
            ctx.fillText('LOCKED IN', cx, cy + 140);
            ctx.shadowBlur = 0;
            
            // Gold accent line
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(cx - 150, cy + 160);
            ctx.lineTo(cx + 150, cy + 160);
            ctx.stroke();
            
        } else if (GameState.cinematicChar === 'shaq') {
            // Shaq cinematic - Shocked mode
            const cx = this.canvas.width / 2;
            const cy = this.canvas.height / 2;
            
            // Blue energy effects
            for (let i = 0; i < 15; i++) {
                const energyX = cx + Math.sin(Date.now() / 250 + i * 2) * 250;
                const energyY = cy + Math.cos(Date.now() / 350 + i * 1.8) * 150;
                const energySize = 4 + Math.sin(Date.now() / 200 + i) * 3;
                
                ctx.fillStyle = `rgba(0, 150, 255, ${0.3 + Math.sin(Date.now() / 300 + i) * 0.4})`;
                ctx.beginPath();
                ctx.arc(energyX, energyY, energySize, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // Basketball particles
            for (let i = 0; i < 6; i++) {
                const ballX = cx + Math.sin(Date.now() / 500 + i * 1.2) * 180;
                const ballY = cy + Math.cos(Date.now() / 600 + i * 0.8) * 100 - 50;
                
                ctx.fillStyle = '#FF8C00';
                ctx.strokeStyle = '#8B4513';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(ballX, ballY, 12, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
            
            // Shocked face outline
            ctx.strokeStyle = 'rgba(0, 150, 255, 0.4)';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(cx, cy - 30, 50, 0, Math.PI * 2);
            ctx.stroke();
            
            // "O" mouth
            ctx.fillStyle = 'rgba(0, 150, 255, 0.3)';
            ctx.beginPath();
            ctx.ellipse(cx, cy + 10, 20, 25, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Text
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 52px Impact';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0, 150, 255, 0.8)';
            ctx.shadowBlur = 20;
            ctx.fillText('SHAQ MODE', cx, cy + 80);
            ctx.fillText('ACTIVATED', cx, cy + 140);
            ctx.shadowBlur = 0;
            
            // Blue accent line
            ctx.strokeStyle = '#0096FF';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(cx - 150, cy + 160);
            ctx.lineTo(cx + 150, cy + 160);
            ctx.stroke();
        }
        
        ctx.restore();
    }

    triggerCinematicTransition(char) {
        GameState.cinematicTransition = true;
        GameState.cinematicTimer = 2500;
        GameState.cinematicType = 'levelComplete';
        GameState.cinematicChar = char;
        GameState.slowMotion = true;
        GameState.slowMotionTimer = 2500;
    }

    isFakeDoor = false;
    fakeDoorX = 0;
    fakeDoorTriggered = false;
    fakeDoorTimer = 0;

    handleFakeDoor(exitX, exitY) {
        if (this.fakeDoorTriggered) return;
        this.fakeDoorTriggered = true;
        this.fakeDoorX = exitX;
        
        // Move the door away
        const originalExitX = exitX;
        const doorMoveDistance = 200;
        
        // Animate door moving away
        let doorPos = exitX;
        const moveSpeed = 3;
        
        const animateDoor = () => {
            if (doorPos < exitX + doorMoveDistance) {
                doorPos += moveSpeed;
                this.drawExit(this.ctx, doorPos, exitY);
                requestAnimationFrame(animateDoor);
            } else {
                // Show character reaction
                this.showFakeDoorReaction();
            }
        };
        
        animateDoor();
    }

    showFakeDoorReaction() {
        const container = document.getElementById('floating-messages');
        if (!container) return;
        
        const message = document.createElement('div');
        message.className = 'floating-message';
        
        if (GameState.selectedCharacter === 'dwayne') {
            message.textContent = 'Really?';
            message.style.color = '#FFD700';
            message.style.fontSize = '3rem';
        } else {
            message.textContent = "AIN'T NO WAY";
            message.style.color = '#0096FF';
            message.style.fontSize = '2.8rem';
        }
        
        message.style.left = `${this.canvas.width / 2 - 100}px`;
        message.style.top = '30%';
        container.appendChild(message);
        
        // Comic effect particles
        EffectsManager.createParticles(this.canvas.width / 2, this.canvas.height / 2, 20, GameState.selectedCharacter === 'dwayne' ? '#FFD700' : '#0096FF');
        
        setTimeout(() => {
            if (message.parentNode) message.remove();
        }, 2000);
        
        // Resume gameplay - reset and let player continue
        setTimeout(() => {
            this.fakeDoorTriggered = false;
            // Move the actual exit to a new position
            this.levelManager.exitX = this.fakeDoorX + 300;
        }, 1500);
    }

    checkCollision(a, b) {
        return (
            a.x < b.x + b.width &&
            a.x + a.width > b.x &&
            a.y < b.y + b.height &&
            a.y + a.height > b.y
        );
    }

    nextLevel() {
        // Level complete effects (lightweight)
        EffectsManager.createFirework(this.canvas.width / 2, this.canvas.height / 2);
        EffectsManager.createFirework(this.canvas.width / 3, this.canvas.height / 3);
        EffectsManager.createFirework(this.canvas.width * 2 / 3, this.canvas.height / 3);
        EffectsManager.addFloatingText('LEVEL COMPLETE!', this.canvas.width / 2, this.canvas.height / 2 - 50, '#FFFFFF');
        EffectsManager.screenFlash(200, '#FFFFFF');

        if (GameState.currentLevel >= 3) {
            // Victory — all 3 levels completed
            this.running = false;
            document.getElementById('v-score').textContent = GameState.score.toLocaleString();
            document.getElementById('v-coins').textContent = GameState.coins;
            document.getElementById('victory-message').textContent = 'All 3 Levels Complete!';
            UIManager.showScreen('victory-screen');
            return;
        }

        GameState.currentLevel++;
        GameState.score += 500;

        // Immediate transition to next level
        this.startLevel(GameState.currentLevel);
    }

    gameOver() {
        this.running = false;
        
        // Show game over screen
        const message = this.getGameOverMessage();
        document.getElementById('game-over-message').textContent = message;
        document.getElementById('go-score').textContent = GameState.score.toLocaleString();
        document.getElementById('go-coins').textContent = GameState.coins;
        document.getElementById('go-level').textContent = `${Math.floor(GameState.currentLevel / 10)}.${GameState.currentLevel % 10}`;
        
        UIManager.showScreen('game-over');
    }

    getGameOverMessage() {
        const messages = [
            'Skill Issue',
            'LOL WRONG FLAG',
            'Certified Goober',
            'Grandma Wins',
            'Nice Try!',
            'Try Again, Goober!',
            'Chaos Wins!'
        ];
        return messages[Math.floor(Math.random() * messages.length)];
    }

    // ==================== WORLD EVENTS ====================
    spawnWorldEvent(type, x, y) {
        const event = {
            type: type,
            x: x,
            y: y,
            active: true,
            timer: 0,
            mashCount: 0,
            targetMash: 30,
            triggered: false,
            particles: [],
            flashTimer: 0,
            progress: 0
        };
        this.worldEvents.push(event);
    }

    updateWorldEvents(dt) {
        for (let i = this.worldEvents.length - 1; i >= 0; i--) {
            const event = this.worldEvents[i];
            
            if (!event.active) {
                // Remove finished events
                if (event.particles && event.particles.length === 0) {
                    this.worldEvents.splice(i, 1);
                }
                continue;
            }

            event.timer += dt;

            // Check if player is near
            const dist = Math.abs(this.player.x + this.player.width/2 - event.x);
            
            if (event.type === 'bonus_target' && dist < 100 && !event.triggered) {
                event.triggered = true;
                event.flashTimer = 500;
                GameState.score += 200;
                UIManager.addFloatingText('+200 BONUS!', event.x, event.y - 30, '#4ecdc4');
                EffectsManager.createParticles(event.x, event.y, 15, '#4ecdc4');
                EffectsManager.screenShake(2, 100);
                
                setTimeout(() => {
                    event.active = false;
                }, 500);
            }

            if (event.type === 'button_mash' && dist < 120 && !event.triggered) {
                // Player holds space to mash
                if (game.input.isPressed('Space')) {
                    event.mashCount += 0.5 * (dt / 16);
                    if (event.mashCount >= event.targetMash) {
                        event.triggered = true;
                        GameState.score += 300;
                        UIManager.addFloatingText('+300 STRONG!', event.x, event.y - 40, '#ff6b35');
                        EffectsManager.createParticles(event.x, event.y, 20, '#ff6b35');
                        EffectsManager.screenShake(3, 200);
                        
                        setTimeout(() => {
                            event.active = false;
                        }, 800);
                    }
                }
            }

            if (event.type === 'memory_crystal' && dist < 100 && !event.triggered) {
                event.triggered = true;
                event.flashTimer = 1000;
                GameState.score += 250;
                UIManager.addFloatingText('+250 MEMORY!', event.x, event.y - 30, '#a8e6cf');
                EffectsManager.createParticles(event.x, event.y, 12, '#a8e6cf');
                
                setTimeout(() => {
                    event.active = false;
                }, 1000);
            }

            if (event.type === 'falling_memes' && dist < 400 && !event.triggered) {
                event.triggered = true;
                event.spawnTimer = 0;
                event.duration = 5000;
            }

            if (event.type === 'falling_memes' && event.triggered && event.timer < event.duration) {
                event.spawnTimer += dt;
                if (event.spawnTimer > 300) {
                    event.spawnTimer = 0;
                    event.particles.push({
                        x: event.x + (Math.random() - 0.5) * 300,
                        y: event.y - 50,
                        vy: 2 + Math.random() * 3,
                        emoji: Math.random() > 0.5 ? '🍌' : '🐔',
                        life: 3000
                    });
                }
                
                // Update particles
                for (let j = event.particles.length - 1; j >= 0; j--) {
                    const p = event.particles[j];
                    p.y += p.vy * (dt / 16);
                    p.life -= dt;
                    if (p.life <= 0 || p.y > 1000) {
                        event.particles.splice(j, 1);
                    }
                }
                
                if (event.timer > event.duration) {
                    event.active = false;
                }
            }

            // Clean up old particles
            if (event.particles && event.particles.length > 50) {
                event.particles.splice(0, event.particles.length - 50);
            }
        }
    }

    drawWorldEvents(ctx) {
        for (const event of this.worldEvents) {
            if (!event.active && event.particles.length === 0) continue;

            ctx.save();

            if (event.type === 'bonus_target') {
                // Glowing target in the world
                const pulse = Math.sin(event.timer / 200) * 5;
                const radius = 25 + pulse;
                
                // Outer glow
                const grad = ctx.createRadialGradient(event.x, event.y, 0, event.x, event.y, radius * 2);
                grad.addColorStop(0, 'rgba(78, 205, 196, 0.4)');
                grad.addColorStop(1, 'rgba(78, 205, 196, 0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(event.x, event.y, radius * 2, 0, Math.PI * 2);
                ctx.fill();
                
                // Target circles
                ctx.strokeStyle = event.triggered ? '#2ed573' : '#4ecdc4';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(event.x, event.y, radius, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(event.x, event.y, radius * 0.6, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(event.x, event.y, radius * 0.3, 0, Math.PI * 2);
                ctx.fill();
                
                // "BONUS" text
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 16px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('BONUS', event.x, event.y - radius - 10);
                
                if (event.flashTimer > 0) {
                    event.flashTimer -= 16;
                    ctx.globalAlpha = event.flashTimer / 500;
                }
            }

            if (event.type === 'button_mash') {
                // Heavy block to push
                const blockY = event.y;
                const progress = event.mashCount / event.targetMash;
                
                // Block
                ctx.fillStyle = event.triggered ? '#2ed573' : '#8b6914';
                ctx.beginPath();
                ctx.roundRect(event.x - 30, blockY - 20, 60, 40, 5);
                ctx.fill();
                ctx.strokeStyle = '#6b5310';
                ctx.lineWidth = 3;
                ctx.stroke();
                
                // Progress bar
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(event.x - 25, blockY - 30, 50, 8);
                ctx.fillStyle = event.triggered ? '#2ed573' : '#ff6b35';
                ctx.fillRect(event.x - 25, blockY - 30, 50 * Math.min(progress, 1), 8);
                
                // Instruction text
                if (!event.triggered) {
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 14px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText('HOLD SPACE', event.x, blockY - 40);
                    ctx.fillText('TO PUSH', event.x, blockY - 25);
                } else {
                    ctx.fillStyle = '#2ed573';
                    ctx.font = 'bold 18px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText('PUSHED!', event.x, blockY - 35);
                }
            }

            if (event.type === 'memory_crystal') {
                // Glowing crystal
                const pulse = Math.sin(event.timer / 300) * 3;
                const size = 20 + pulse;
                
                // Glow
                const grad = ctx.createRadialGradient(event.x, event.y, 0, event.x, event.y, size * 2);
                grad.addColorStop(0, 'rgba(168, 230, 207, 0.5)');
                grad.addColorStop(1, 'rgba(168, 230, 207, 0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(event.x, event.y, size * 2, 0, Math.PI * 2);
                ctx.fill();
                
                // Crystal shape
                ctx.fillStyle = event.triggered ? '#fff' : '#a8e6cf';
                ctx.beginPath();
                ctx.moveTo(event.x, event.y - size);
                ctx.lineTo(event.x + size * 0.7, event.y);
                ctx.lineTo(event.x, event.y + size);
                ctx.lineTo(event.x - size * 0.7, event.y);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = '#7dcea0';
                ctx.lineWidth = 2;
                ctx.stroke();
                
                // Sparkle
                ctx.fillStyle = 'rgba(255,255,255,0.8)';
                ctx.beginPath();
                ctx.arc(event.x - 5, event.y - 8, 3, 0, Math.PI * 2);
                ctx.fill();
                
                // "MEMORY" text
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 14px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('MEMORY', event.x, event.y - size - 15);
                
                if (event.flashTimer > 0) {
                    event.flashTimer -= 16;
                    ctx.globalAlpha = 0.5 + (event.flashTimer / 1000) * 0.5;
                }
            }

            if (event.type === 'falling_memes') {
                // Draw falling emojis
                for (const p of event.particles) {
                    ctx.font = '24px Arial';
                    ctx.textAlign = 'center';
                    ctx.globalAlpha = Math.min(p.life / 1000, 1);
                    ctx.fillText(p.emoji, p.x, p.y);
                }
                ctx.globalAlpha = 1;
                
                // Warning text at start
                if (event.triggered && event.timer < 1000) {
                    ctx.fillStyle = '#ff6b6b';
                    ctx.font = 'bold 24px Arial';
                    ctx.textAlign = 'center';
                    ctx.globalAlpha = 1 - event.timer / 1000;
                    ctx.fillText('DODGE!', event.x, event.y - 100);
                    ctx.globalAlpha = 1;
                }
            }

            ctx.restore();
        }
    }

    // ==================== ABILITY INSTRUCTIONS ====================
    drawAbilityInstructions(ctx) {
        if (!this.player) return;
        
        const cooldown = GameState.cooldowns[this.player.character];
        const maxCooldown = GameState.maxCooldowns[this.player.character];
        const ready = cooldown <= 0;
        
        // Show ability hint at start of level
        if (GameState.currentLevel === 1 && this.player.x < 300) {
            const alpha = Math.min(this.player.x / 200, 0.8);
            ctx.globalAlpha = alpha;
            
            // Ability icon and text
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.beginPath();
            ctx.roundRect(this.player.x - 60, this.player.y - 70, 120, 50, 8);
            ctx.fill();
            
            ctx.fillStyle = ready ? '#ffe66d' : '#888';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            
            if (this.player.character === 'dwayne') {
                ctx.fillText('🪨 E = Rock Throw', this.player.x, this.player.y - 48);
            } else {
                ctx.fillText('🏀 E = Mega Dunk', this.player.x, this.player.y - 48);
            }
            
            ctx.globalAlpha = 1;
        }
        
        // Show cooldown indicator near player during gameplay
        if (cooldown > 0 && this.player.x > 300) {
            const barWidth = 40;
            const barHeight = 6;
            const x = this.player.x + this.player.width/2 - barWidth/2;
            const y = this.player.y - 20;
            
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.beginPath();
            ctx.roundRect(x, y, barWidth, barHeight, 3);
            ctx.fill();
            
            const fillWidth = barWidth * (1 - cooldown / maxCooldown);
            ctx.fillStyle = '#ff6b35';
            ctx.beginPath();
            ctx.roundRect(x, y, fillWidth, barHeight, 3);
            ctx.fill();
        }
    }
}

// ==================== INITIALIZE GAME ====================
var game;

window.addEventListener('load', () => {
    // Simulate loading
    const loadingBar = document.getElementById('loading-bar');
    if (loadingBar) {
        let progress = 0;
        const loadInterval = setInterval(() => {
            progress += 10;
            loadingBar.style.width = `${progress}%`;
            if (progress >= 100) {
                clearInterval(loadInterval);
                setTimeout(() => {
                    UIManager.showScreen('main-menu');
                }, 500);
            }
        }, 100);
    }
    
    // Initialize game
    game = new Game();
    window.game = game;
});
