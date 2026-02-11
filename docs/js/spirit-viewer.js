import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, controls, character, frameId;

export function initViewer(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Clear previous renderer if any
    cleanupViewer();

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);

    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    camera.position.set(0, 1, 5);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
    directionalLight.position.set(5, 10, 7);
    scene.add(directionalLight);

    const pointLight = new THREE.PointLight(0xffffff, 1);
    pointLight.position.set(-5, -5, -5);
    scene.add(pointLight);

    animate();

    window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
    const container = document.getElementById('spirit-viewer-container');
    if (!container || !camera || !renderer) return;

    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

function animate() {
    frameId = requestAnimationFrame(animate);
    if (controls) controls.update();
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

export function loadModel(modelUrl, textureUrl) {
    if (!scene) return;

    // Remove previous character
    if (character) {
        scene.remove(character);
        character = null;
    }

    const loadingEl = document.getElementById('spirit-viewer-loading');
    if (loadingEl) loadingEl.style.display = 'block';

    const loader = new GLTFLoader();
    const textureLoader = new THREE.TextureLoader();

    if (modelUrl.toLowerCase().endsWith('.png') || modelUrl.toLowerCase().endsWith('.webp')) {
        textureLoader.load(modelUrl, (texture) => {
            const material = new THREE.SpriteMaterial({ map: texture });
            character = new THREE.Sprite(material);
            character.scale.set(2, 2, 1);
            scene.add(character);
            if (loadingEl) loadingEl.style.display = 'none';
        });
    } else {
        loader.load(modelUrl, (gltf) => {
            character = gltf.scene;

            // Ensure textures are loaded/applied (only if mesh doesn't have a map)
            if (textureUrl) {
                textureLoader.load(textureUrl, (tex) => {
                    tex.flipY = false;
                    character.traverse((child) => {
                        if (child.isMesh && child.material) {
                            if (!child.material.map) {
                                child.material.map = tex;
                                child.material.needsUpdate = true;
                            }
                        }
                    });
                });
            }

            // Center and scale model
            const box = new THREE.Box3().setFromObject(character);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());

            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 2.5 / maxDim;
            character.scale.set(scale, scale, scale);

            character.position.x = -center.x * scale;
            character.position.y = -center.y * scale;
            character.position.z = -center.z * scale;

            scene.add(character);
            if (loadingEl) loadingEl.style.display = 'none';
        },
        (xhr) => {
            // progress
        },
        (error) => {
            console.error('Error loading model:', error);
            if (loadingEl) loadingEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error al cargar';
        });
    }
}

export function cleanupViewer() {
    if (frameId) {
        cancelAnimationFrame(frameId);
        frameId = null;
    }

    window.removeEventListener('resize', onWindowResize);

    if (renderer) {
        renderer.dispose();
        if (renderer.domElement && renderer.domElement.parentElement) {
            renderer.domElement.parentElement.removeChild(renderer.domElement);
        }
        renderer = null;
    }

    if (controls) {
        controls.dispose();
        controls = null;
    }

    scene = null;
    camera = null;
    character = null;
}
