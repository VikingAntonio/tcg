import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class SpiritViewerInstance {
    constructor(container) {
        this.container = container;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.character = null;
        this.frameId = null;
        this.loader = new GLTFLoader();
        this.textureLoader = new THREE.TextureLoader();

        this.init();
    }

    init() {
        this.scene = new THREE.Scene();
        // Transparent background to show CSS gradient
        this.scene.background = null;

        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        this.camera.position.set(0, 1, 5);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setClearColor(0x000000, 0);
        this.container.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        // Disable zoom by default to avoid interference with scrolling, or just leave it
        this.controls.enableZoom = true;

        const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
        directionalLight.position.set(5, 10, 7);
        this.scene.add(directionalLight);

        this.animate = this.animate.bind(this);
        this.animate();
    }

    animate() {
        this.frameId = requestAnimationFrame(this.animate);
        if (this.controls) this.controls.update();
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    loadModel(modelUrl, textureUrl) {
        if (!this.scene) return;

        if (this.character) {
            this.scene.remove(this.character);
            this.character = null;
        }

        if (!modelUrl) return;

        if (modelUrl.toLowerCase().endsWith('.png') || modelUrl.toLowerCase().endsWith('.webp')) {
            this.textureLoader.load(modelUrl, (texture) => {
                const material = new THREE.SpriteMaterial({ map: texture });
                this.character = new THREE.Sprite(material);
                this.character.scale.set(2, 2, 1);
                this.scene.add(this.character);
            });
        } else {
            this.loader.load(modelUrl, (gltf) => {
                this.character = gltf.scene;

                if (textureUrl) {
                    this.textureLoader.load(textureUrl, (tex) => {
                        tex.flipY = false;
                        this.character.traverse((child) => {
                            if (child.isMesh && child.material) {
                                child.material.map = tex;
                                child.material.needsUpdate = true;
                            }
                        });
                    });
                }

                const box = new THREE.Box3().setFromObject(this.character);
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());

                const maxDim = Math.max(size.x, size.y, size.z);
                const scale = 2.5 / maxDim;
                this.character.scale.set(scale, scale, scale);

                this.character.position.x = -center.x * scale;
                this.character.position.y = -center.y * scale;
                this.character.position.z = -center.z * scale;

                this.scene.add(this.character);
            });
        }
    }

    resize() {
        if (!this.container || !this.camera || !this.renderer) return;
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    cleanup() {
        if (this.frameId) {
            cancelAnimationFrame(this.frameId);
        }
        if (this.renderer) {
            this.renderer.dispose();
            if (this.renderer.domElement && this.renderer.domElement.parentElement) {
                this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
            }
        }
        if (this.controls) {
            this.controls.dispose();
        }
        this.scene = null;
        this.camera = null;
        this.character = null;
    }
}

// Map to keep track of instances
const instances = new Map();

export function initViewer(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // For optimization, if we are using a main viewer, we might want to cleanup others
    // For now, just ensure the specific container is clean
    if (instances.has(containerId)) {
        // If it's the same container, we don't necessarily need to re-init everything,
        // but it's safer for a clean state.
        instances.get(containerId).cleanup();
    } else {
        // If we are initiating a new one, maybe cleanup ALL others to save WebGL contexts
        cleanupAllViewers();
    }

    const instance = new SpiritViewerInstance(container);
    instances.set(containerId, instance);
    return instance;
}

export function loadModel(containerId, modelUrl, textureUrl) {
    const instance = instances.get(containerId);
    if (instance) {
        instance.loadModel(modelUrl, textureUrl);
    }
}

export function cleanupViewer(containerId) {
    const instance = instances.get(containerId);
    if (instance) {
        instance.cleanup();
        instances.delete(containerId);
    }
}

export function cleanupAllViewers() {
    instances.forEach(instance => instance.cleanup());
    instances.clear();
}
