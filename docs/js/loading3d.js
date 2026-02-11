import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let scene, camera, renderer, character, clock;
let isAnimating = false;
let cherryModel;
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

    // Load Ash
    loader.load('ash.gltf', (gltf) => {
        character = gltf.scene;
        // Normalize size
        const box = new THREE.Box3().setFromObject(character);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 2.5 / maxDim;
        character.scale.set(scale, scale, scale);

        // Center it
        const center = box.getCenter(new THREE.Vector3());
        character.position.y = -center.y * scale;

        scene.add(character);
    }, undefined, (error) => {
        console.warn('Waiting for ash.gltf to be uploaded...');
    });

    // Load Cherry
    loader.load('cherry.gltf', (gltf) => {
        cherryModel = gltf.scene;
        const box = new THREE.Box3().setFromObject(cherryModel);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 0.4 / maxDim;
        cherryModel.scale.set(scale, scale, scale);
    }, undefined, (error) => {
        console.warn('Waiting for cherry.gltf to be uploaded...');
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
    if (!cherryModel) return;

    const p = cherryModel.clone();
    p.position.copy(pos);
    // Add some randomness to position
    p.position.x += (Math.random() - 0.5) * 0.5;
    p.position.y += (Math.random() - 0.5) * 0.5;
    p.position.z += (Math.random() - 0.5) * 0.5;

    p.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

    p.userData.life = 1.0;
    p.userData.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 0.02,
        -0.01 - Math.random() * 0.02,
        (Math.random() - 0.5) * 0.02
    );
    p.userData.rotSpeed = new THREE.Vector3(
        Math.random() * 0.05,
        Math.random() * 0.05,
        Math.random() * 0.05
    );

    scene.add(p);
    particles.push(p);
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.userData.life -= 0.008;
        p.position.add(p.userData.velocity);
        p.rotation.x += p.userData.rotSpeed.x;
        p.rotation.y += p.userData.rotSpeed.y;
        p.rotation.z += p.userData.rotSpeed.z;

        // Scale down as it dies
        const s = p.userData.life;
        p.scale.set(s * 0.4, s * 0.4, s * 0.4);

        if (p.userData.life <= 0) {
            scene.remove(p);
            particles.splice(i, 1);
        }
    }
}

function animate() {
    requestAnimationFrame(animate);

    if (isAnimating) {
        const time = clock.getElapsedTime();
        const radius = 3.5;
        const speed = 1.2;

        if (character) {
            const x = Math.cos(time * speed) * radius;
            const z = Math.sin(time * speed) * radius;

            character.position.x = x;
            character.position.z = z;

            // Facing direction
            character.rotation.y = -time * speed + Math.PI / 2;
            // Slight hover bobbing
            character.position.y = Math.sin(time * 3) * 0.2;

            // Trail
            if (time - lastParticleTime > 0.1) {
                spawnParticle(character.position.clone());
                lastParticleTime = time;
            }
        }

        updateParticles();
        renderer.render(scene, camera);
    }
}

document.addEventListener('show-loading', () => {
    isAnimating = true;
    if (!scene) {
        init();
    }
});

document.addEventListener('hide-loading', () => {
    isAnimating = false;
    // Clear particles when hidden to start fresh
    if (scene) {
        particles.forEach(p => scene.remove(p));
        particles.length = 0;
    }
});
