import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let scene, camera, renderer, character, clock;
let isAnimating = false;
let cherryTexture;
const particles = [];
let lastParticleTime = 0;

function init() {
    console.log("Loading3D: Initializing...");
    const container = document.getElementById('loading-3d-container');
    if (!container) {
        console.warn("Loading3D: Container not found!");
        return;
    }

    scene = new THREE.Scene();

    // Camera setup
    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    camera.position.set(0, 1, 8);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(5, 10, 7);
    scene.add(directionalLight);

    clock = new THREE.Clock();

    const loader = new GLTFLoader();
    const textureLoader = new THREE.TextureLoader();

    loadSpiritModel();

    window.addEventListener('resize', onWindowResize);
    animate();
}

function loadSpiritModel() {
    if (character) {
        scene.remove(character);
        character = null;
    }

    const loader = new GLTFLoader();
    const textureLoader = new THREE.TextureLoader();

    const modelUrl = (window.currentSpirit && window.currentSpirit.gltf_url) || 'ash.gltf';
    const textureUrl = (window.currentSpirit && window.currentSpirit.texture_url) || null;

    loader.load(modelUrl, (gltf) => {
        console.log(`Loading3D: ${modelUrl} loaded successfully`);
        character = gltf.scene;

        // Apply custom texture if provided
        if (textureUrl) {
            textureLoader.load(textureUrl, (tex) => {
                tex.flipY = false;
                character.traverse((child) => {
                    // Only apply to meshes that already have a map or where it makes sense
                    if (child.isMesh && child.material) {
                        // If model has multiple meshes, this is still a bit aggressive but better than nothing.
                        // Ideally we'd match by mesh name, but we don't know it here.
                        child.material.map = tex;
                        child.material.needsUpdate = true;
                    }
                });
            });
        }

        // --- AJUSTE DE TAMAÑO ---
        const box = new THREE.Box3().setFromObject(character);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scaleMultiplier = 1;
        const scale = scaleMultiplier / maxDim;
        character.scale.set(scale, scale, scale);

        // Centrar el personaje en su eje
        const center = box.getCenter(new THREE.Vector3());
        character.position.y = -center.y * scale;

        scene.add(character);
    }, undefined, (error) => {
        console.warn(`Error loading model ${modelUrl}:`, error);
    });

    // Load Cherry Texture for particles
    textureLoader.load('cherry.png', (texture) => {
        cherryTexture = texture;
    });

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function spawnParticle(pos) {
    if (!cherryTexture) return;

    // Create particle as a Sprite using cherry.png
    const material = new THREE.SpriteMaterial({
        map: cherryTexture,
        transparent: true,
        opacity: 0.8
    });
    const p = new THREE.Sprite(material);

    p.position.copy(pos);
    // Randomize position a bit
    p.position.x += (Math.random() - 0.5) * 0.5;
    p.position.y += (Math.random() - 0.5) * 0.5;
    p.position.z += (Math.random() - 0.5) * 0.5;

    // Random size
    const s = 0.2 + Math.random() * 0.3;
    p.scale.set(s, s, 1);

    p.userData.life = 1.0;
    p.userData.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 0.02,
        -0.01 - Math.random() * 0.02, // Falling effect
        (Math.random() - 0.5) * 0.02
    );

    scene.add(p);
    particles.push(p);
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.userData.life -= 0.01;
        p.position.add(p.userData.velocity);

        // Fade out and shrink
        p.material.opacity = p.userData.life * 0.8;
        const s = p.userData.life * 0.4;
        p.scale.set(s, s, 1);

        if (p.userData.life <= 0) {
            p.material.dispose();
            scene.remove(p);
            particles.splice(i, 1);
        }
    }
}

function animate() {
    requestAnimationFrame(animate);

    if (isAnimating) {
        const time = clock.getElapsedTime();

        // --- AJUSTES DE ANIMACIÓN ---
        // radius: Radio de la circunferencia (menos de 3.5 para que no se salga en móviles)
        // speed: Velocidad de giro
        const radius = 1.5;
        const speed = 2.0;
        const animType = (window.currentSpirit && window.currentSpirit.animation_type) || 'orbit';

        if (character) {
            if (animType === 'float') {
                // Subtle floating and rotation in place
                character.position.x = 0;
                character.position.z = 0;
                character.position.y = Math.sin(time * 2) * 0.4;
                character.rotation.y += 0.01;
            } else {
                // Giro a la derecha (sentido horario) - Orbit
                const x = Math.sin(time * speed) * radius;
                const z = Math.cos(time * speed) * radius;

                character.position.x = x;
                character.position.z = z;

                // Orientación: que el personaje mire hacia donde avanza
                character.rotation.y = time * speed;

                // Efecto de flotación (opcional)
                character.position.y = Math.sin(time * 3) * 0.2;
            }

            // Generar rastro de pétalos
            if (time - lastParticleTime > 0.05) { // Spawn más frecuente para rastro denso
                spawnParticle(character.position.clone());
                lastParticleTime = time;
            }
        }

        updateParticles();
        renderer.render(scene, camera);
    }
}

function updateLoadingScreen(active, message = null) {
    const screen = document.getElementById('loading-screen');
    const text = screen ? screen.querySelector('.loading-message') : null;

    console.log(`Loading3D: updateLoadingScreen active=${active} message=${message}`);

    if (screen) {
        if (active) screen.classList.add('active');
        else screen.classList.remove('active');
    }
    if (text && message) {
        text.textContent = message;
    }
}

window.addEventListener('show-loading', (e) => {
    console.log("Loading3D: Received show-loading event");
    isAnimating = true;
    updateLoadingScreen(true, e.detail ? e.detail.message : null);

    // Check if the spirit changed while we were already initialized
    const newSpiritId = window.currentSpirit ? window.currentSpirit.id : null;
    if (scene) {
        if (window.lastLoadedSpiritId !== newSpiritId) {
            loadSpiritModel();
            window.lastLoadedSpiritId = newSpiritId;
        }
    } else {
        init();
        window.lastLoadedSpiritId = newSpiritId;
    }
});

window.addEventListener('hide-loading', () => {
    console.log("Loading3D: Received hide-loading event");
    updateLoadingScreen(false);

    // Esperar a que termine la transición de CSS (0.5s) antes de detener el bucle
    setTimeout(() => {
        if (!isAnimating) return; // Ya se detuvo
        isAnimating = false;
        // Limpiar partículas al ocultar
        if (scene) {
            particles.forEach(p => {
                if (p.material) p.material.dispose();
                scene.remove(p);
            });
            particles.length = 0;
        }
    }, 600);
});

// Check initial state in case app.js already started loading before this module initialized
console.log("Loading3D: Module loaded. window.isLoading =", window.isLoading);
if (window.isLoading) {
    isAnimating = true;
    updateLoadingScreen(true, window.loadingMessage);
    if (!scene) {
        init();
    }
}
