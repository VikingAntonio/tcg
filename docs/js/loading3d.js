import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let scene, camera, renderer, character, clock;
let isAnimating = false;
let cherryTexture;
const particles = [];
let lastParticleTime = 0;

function init() {
    const container = document.getElementById('loading-3d-container');
    if (!container) return;

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

    // Load Ash
    loader.load('ash.gltf', (gltf) => {
        character = gltf.scene;

        // --- AJUSTE DE TAMAÑO DE ASH ---
        // Cambia el valor 1.8 para hacer el personaje más grande o más chico
        const box = new THREE.Box3().setFromObject(character);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scaleMultiplier = 1.8;
        const scale = scaleMultiplier / maxDim;
        character.scale.set(scale, scale, scale);

        // Centrar el personaje en su eje
        const center = box.getCenter(new THREE.Vector3());
        character.position.y = -center.y * scale;

        scene.add(character);
    }, undefined, (error) => {
        console.warn('Waiting for ash.gltf to be uploaded...');
    });

    // Load Cherry Texture for particles
    textureLoader.load('cherry.png', (texture) => {
        cherryTexture = texture;
    });

    window.addEventListener('resize', onWindowResize);
    animate();
}

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
        const radius = 2.2;
        const speed = 2.0;

        if (character) {
            // Giro a la derecha (sentido horario)
            const x = Math.sin(time * speed) * radius;
            const z = Math.cos(time * speed) * radius;

            character.position.x = x;
            character.position.z = z;

            // Orientación: que el personaje mire hacia donde avanza
            character.rotation.y = time * speed;

            // Efecto de flotación (opcional)
            character.position.y = Math.sin(time * 3) * 0.2;

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

const loadingScreen = document.getElementById('loading-screen');
const loadingText = loadingScreen ? loadingScreen.querySelector('.loading-message') : null;

window.addEventListener('show-loading', (e) => {
    isAnimating = true;
    if (loadingScreen) loadingScreen.classList.add('active');
    if (loadingText && e.detail && e.detail.message) {
        loadingText.textContent = e.detail.message;
    }
    if (!scene) {
        init();
    }
});

window.addEventListener('hide-loading', () => {
    if (loadingScreen) loadingScreen.classList.remove('active');

    // Esperar a que termine la transición de CSS (0.5s) antes de detener el bucle
    setTimeout(() => {
        isAnimating = false;
        // Limpiar partículas al ocultar
        if (scene) {
            particles.forEach(p => {
                if (p.material) p.material.dispose();
                scene.remove(p);
            });
            particles.length = 0;
        }
    }, 500);
});

// Check initial state in case app.js already started loading
if (window.isLoading) {
    isAnimating = true;
    if (loadingScreen) loadingScreen.classList.add('active');
    if (loadingText && window.loadingMessage) {
        loadingText.textContent = window.loadingMessage;
    }
    if (!scene) {
        init();
    }
}
