/**
 * michatbot-mobile3d.js
 * Visor GLTF ligero (Three.js) para MÓVIL únicamente.
 *
 * Motivo: en celulares, `model-viewer` (v3.3.0) es pesado, dimensiona su buffer
 * según `devicePixelRatio` y reasigna memoria en cada cambio de tamaño. Además,
 * la web llega a tener varios contextos WebGL vivos a la vez (asistente, tarjetas
 * de espíritus, pantalla de carga), y los móviles solo permiten unos pocos: al
 * pasarse, el navegador libera el más antiguo -> el asistente queda en blanco y
 * al recargar ya no renderiza.
 *
 * Solución: un único visor Three.js, reutilizado para la esquina, el chat y el
 * detalle; un solo contexto WebGL; render bajo demanda (solo cuando algo cambia);
 * DPR limitado; y recuperación automática del contexto. En PC no se usa: allí
 * sigue `model-viewer`.
 *
 * API pública (usada por michatbot.js):
 *   window.MichatbotMobile3D = {
 *     isSupported(), create(container, opts), moveTo(container), release(),
 *     setModel(url), pause(), resume(), getContextCount()
 *   }
 */
(function () {
    'use strict';

    const VIEWER_CLASS = 'michatbot-mobile-viewer';
    // If the page already declares a "three" import map (e.g. carrito.html /
    // public.html for the loading screen), reuse it so the browser keeps a single
    // Three.js instance instead of downloading a second copy.
    const HAS_IMPORTMAP = !!document.querySelector('script[type="importmap"]');
    const THREE_BASE = HAS_IMPORTMAP ? 'three' : 'https://esm.sh/three@0.160.0';
    const ADDONS_BASE = HAS_IMPORTMAP ? 'three/addons/' : 'https://esm.sh/three@0.160.0/examples/jsm/';
    const GLTF_URL = ADDONS_BASE + 'loaders/GLTFLoader.js';
    const DRACO_URL = ADDONS_BASE + 'loaders/DRACOLoader.js';
    const MESHOPT_URL = ADDONS_BASE + 'libs/meshopt_decoder.module.js';
    const DRACO_DECODER_PATH = 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';

    // Rotación en grados por segundo (equivalente a rotation-speed de model-viewer).
    const AUTO_ROTATE_DPS = 30;
    const MAX_DPR = 1.5;
    const TARGET_FPS = 30;

    // Rotación manual: el usuario arrastra para girar el modelo (como con
    // camera-controls de model-viewer). El auto-rotado se pausa mientras
    // arrastra y se reanuda tras unos segundos de inactividad.
    const ROTATE_SPEED = 0.008;                       // radianes por píxel
    const PHI_MIN = 20 * Math.PI / 180;               // límite superior (visto desde arriba)
    const PHI_MAX = 120 * Math.PI / 180;              // límite inferior (visto desde abajo)
    const IDLE_RESUME_MS = 4000;                      // inactividad antes de reanudar auto-rotado
    const NO_INTERACTION = -1e9;                      // "nunca interactuó" -> auto-rotado desde el inicio

    // Vista de cámara: mismo encuadre que usa model-viewer en el asistente.
    const CAMERA_ORBIT = { theta: 0, phi: 75 * Math.PI / 180 };
    const FOV = 30;

    let modulesPromise = null;
    function loadModules() {
        if (!modulesPromise) {
            modulesPromise = Promise.all([
                import(/* @vite-ignore */ THREE_BASE),
                import(/* @vite-ignore */ GLTF_URL),
                import(/* @vite-ignore */ DRACO_URL),
                import(/* @vite-ignore */ MESHOPT_URL)
            ]).then(([three, gltf, draco, meshopt]) => ({
                THREE: three,
                GLTFLoader: gltf.GLTFLoader,
                DRACOLoader: draco.DRACOLoader,
                MeshoptDecoder: meshopt.MeshoptDecoder
            }));
        }
        return modulesPromise;
    }

    // Cached: probing WebGL creates a real context, so we must probe once and
    // release it immediately, otherwise every check leaks a context (phones cap
    // how many can exist and then start dropping them -> white box).
    let _supported = null;
    function isSupported() {
        if (_supported !== null) return _supported;
        try {
            const c = document.createElement('canvas');
            const gl = c.getContext('webgl2') || c.getContext('webgl');
            _supported = !!gl;
            if (gl) {
                const ext = gl.getExtension('WEBGL_lose_context');
                if (ext) ext.loseContext();
            }
        } catch (e) {
            _supported = false;
        }
        return _supported;
    }

    class Mobile3DViewer {
        constructor(container, opts = {}) {
            this.container = container;
            this.opts = opts;
            this.autoRotate = opts.autoRotate !== false;
            this._destroyed = false;
            this._raf = 0;
            this._lastDraw = 0;
            this._dirty = true;
            this._paused = false;
            this._modelUrl = null;
            this._model = null;
            this._draco = null;
            this._contextLost = false;
            this._restoreTimer = null;
            this._resizeObs = null;
            // Rotación manual
            this._theta = CAMERA_ORBIT.theta;
            this._phi = CAMERA_ORBIT.phi;
            this._dragging = false;
            this._dragId = null;
            this._lastPX = 0;
            this._lastPY = 0;
            this._lastInteract = NO_INTERACTION;
            this._draggingBound = false;
            this._onLost = this._onLost.bind(this);
            this._onRestored = this._onRestored.bind(this);
            this._tick = this._tick.bind(this);
            this._applySize = this._applySize.bind(this);
            this._onPointerDown = this._onPointerDown.bind(this);
            this._onPointerMove = this._onPointerMove.bind(this);
            this._onPointerUp = this._onPointerUp.bind(this);
        }

        async init() {
            const mods = await loadModules();
            if (this._destroyed) return;
            this.mods = mods;
            const { THREE } = mods;

            this.scene = new THREE.Scene();

            this.renderer = new THREE.WebGLRenderer({
                alpha: true,
                antialias: false,
                powerPreference: 'default',
                preserveDrawingBuffer: false,
                failIfMajorPerformanceCaveat: false
            });
            this.renderer.setClearColor(0x000000, 0);
            this.renderer.outputColorSpace = THREE.SRGBColorSpace;
            if ('useLegacyLights' in this.renderer) this.renderer.useLegacyLights = true;
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));

            this.domElement = this.renderer.domElement;
            this.domElement.className = VIEWER_CLASS;
            this.domElement.style.display = 'block';
            this.domElement.style.width = '100%';
            this.domElement.style.height = '100%';
            this.domElement.style.background = 'transparent';
            this.container.appendChild(this.domElement);

            this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 2000);
            this.scene.add(new THREE.AmbientLight(0xffffff, 2.6));
            const key = new THREE.DirectionalLight(0xffffff, 2.2);
            key.position.set(3, 8, 6);
            this.scene.add(key);
            const fill = new THREE.DirectionalLight(0xffffff, 0.9);
            fill.position.set(-4, -2, -5);
            this.scene.add(fill);

            const gl = this.renderer.getContext();
            if (gl && gl.canvas) {
                gl.canvas.addEventListener('webglcontextlost', this._onLost, false);
                gl.canvas.addEventListener('webglcontextrestored', this._onRestored, false);
            }

            this._applySize();
            if (window.ResizeObserver) {
                this._resizeObs = new ResizeObserver(this._applySize);
                this._resizeObs.observe(this.container);
            } else {
                window.addEventListener('resize', this._applySize);
            }

            this._loadCurrentModel();
            this._raf = requestAnimationFrame(this._tick);
            return this;
        }

        _applySize() {
            if (this._destroyed || !this.renderer) return;
            const r = this.container.getBoundingClientRect();
            const w = Math.max(1, Math.round(r.width));
            const h = Math.max(1, Math.round(r.height));
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
            this.renderer.setSize(w, h, false);
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
            // touch-action: none para que arrastrar sobre el visor rote el modelo
            // sin que la página haga scroll. El scroll de la página/overlay sigue
            // funcionando fuera del canvas.
            this.domElement.style.touchAction = 'none';
            this._bindDrag();
            this._dirty = true;
        }

        _bindDrag() {
            if (this._draggingBound || this._destroyed) return;
            const el = this.domElement;
            if (!el || !el.addEventListener) return;
            el.addEventListener('pointerdown', this._onPointerDown, { passive: true });
            el.addEventListener('pointermove', this._onPointerMove, { passive: true });
            el.addEventListener('pointerup', this._onPointerUp, { passive: true });
            el.addEventListener('pointercancel', this._onPointerUp, { passive: true });
            this._draggingBound = true;
        }

        _unbindDrag() {
            if (!this._draggingBound) return;
            const el = this.domElement;
            if (el && el.removeEventListener) {
                el.removeEventListener('pointerdown', this._onPointerDown);
                el.removeEventListener('pointermove', this._onPointerMove);
                el.removeEventListener('pointerup', this._onPointerUp);
                el.removeEventListener('pointercancel', this._onPointerUp);
            }
            this._draggingBound = false;
        }

        _onPointerDown(e) {
            if (this._paused) return;
            if (this._dragId !== null) return; // ya hay un dedo rotando
            this._dragging = true;
            this._dragId = e.pointerId;
            this._lastPX = e.clientX;
            this._lastPY = e.clientY;
            // Capturar el puntero hace que pointermove siga llegando aunque el
            // dedo se salga del canvas (arrastre fluido sin cortes).
            try { this.domElement.setPointerCapture(e.pointerId); } catch (err) {}
        }

        _onPointerMove(e) {
            if (!this._dragging || e.pointerId !== this._dragId) return;
            const dx = e.clientX - this._lastPX;
            const dy = e.clientY - this._lastPY;
            this._lastPX = e.clientX;
            this._lastPY = e.clientY;
            this._theta -= dx * ROTATE_SPEED;
            this._phi = Math.min(PHI_MAX, Math.max(PHI_MIN, this._phi + dy * ROTATE_SPEED));
            this._lastInteract = performance.now();
            this._dirty = true;
        }

        _onPointerUp(e) {
            if (e.pointerId !== this._dragId) return;
            this._dragging = false;
            this._dragId = null;
            this._lastInteract = performance.now();
            try { this.domElement.releasePointerCapture(e.pointerId); } catch (err) {}
        }

        async _loadCurrentModel() {
            const url = this._modelUrl;
            if (!url || this._destroyed) return;
            const { THREE, GLTFLoader, DRACOLoader, MeshoptDecoder } = this.mods;

            if (this._model) {
                this.scene.remove(this._model);
                disposeObject(this._model);
                this._model = null;
            }

            const loader = new GLTFLoader();
            if (DRACOLoader) {
                const draco = new DRACOLoader();
                draco.setDecoderPath(DRACO_DECODER_PATH);
                loader.setDRACOLoader(draco);
                this._draco = draco;
            }
            if (MeshoptDecoder) loader.setMeshoptDecoder(MeshoptDecoder);

            try {
                const gltf = await loader.loadAsync(url);
                if (this._destroyed || this._modelUrl !== url) return;
                const model = gltf.scene;
                model.traverse((o) => {
                    if (o.isMesh && o.material) {
                        const mats = Array.isArray(o.material) ? o.material : [o.material];
                        mats.forEach((m) => { m.side = THREE.FrontSide; });
                    }
                });
                this.scene.add(model);
                this._model = model;
                this._fitCamera(model);
                this._dirty = true;
            } catch (e) {
                console.warn('[Michatbot 3D móvil] No se pudo cargar el modelo:', e && e.message);
            }
        }

        _fitCamera(model) {
            const { THREE } = this.mods;
            const box = new THREE.Box3().setFromObject(model);
            if (box.isEmpty()) return;
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z) || 1;

            // Centrar el modelo en el origen para que la órbita gire a su alrededor.
            model.position.sub(center);

            // Ajustar tanto en vertical como en horizontal para que el modelo no
            // se recorte en pantallas estrechas.
            const aspect = this.camera.aspect || 1;
            const fitV = (maxDim * 0.5) / Math.tan((FOV * Math.PI / 180) / 2);
            const fitH = fitV / aspect;
            this._orbitRadius = Math.max(fitV, fitH, maxDim) * 1.15;
            this._updateCameraPosition(0);
        }

        _updateCameraPosition() {
            const r = this._orbitRadius || 3;
            const theta = this._theta;
            const phi = this._phi;
            const x = r * Math.sin(phi) * Math.sin(theta);
            const y = r * Math.cos(phi);
            const z = r * Math.sin(phi) * Math.cos(theta);
            this.camera.position.set(x, y, z);
            this.camera.lookAt(0, 0, 0);
        }

        _tick(now) {
            if (this._destroyed) return;
            this._raf = requestAnimationFrame(this._tick);
            if (this._paused || this._contextLost) return;
            if (now - this._lastDraw < 1000 / TARGET_FPS) return;
            const dt = Math.min((now - this._lastDraw) / 1000 || 0, 0.1);
            // Auto-rotado: solo si está activo, no se está arrastrando y el
            // usuario lleva un rato sin tocar (para no pelear con su rotación).
            const idle = now - this._lastInteract > IDLE_RESUME_MS;
            const autoRotating = this.autoRotate && this._model && !this._dragging && idle;
            if (!this._dirty && !autoRotating) return;
            this._lastDraw = now;
            this._dirty = false;
            if (autoRotating) this._theta += dt * AUTO_ROTATE_DPS * Math.PI / 180;
            try {
                this._updateCameraPosition();
                this.renderer.render(this.scene, this.camera);
            } catch (e) { /* contexto perdido en mitad del frame */ }
        }

        setModel(url) {
            if (!url || url === this._modelUrl) return;
            this._modelUrl = url;
            this._dirty = true;
            if (this.mods) this._loadCurrentModel();
        }

        setAutoRotate(on) {
            this.autoRotate = !!on;
            this._dirty = true;
        }

        pause() { this._paused = true; }
        resume() { this._paused = false; this._dirty = true; }

        moveTo(container) {
            if (!container || this._destroyed) return false;
            this.container = container;
            container.appendChild(this.domElement);
            this._applySize();
            return true;
        }

        _onLost(e) {
            if (e && e.preventDefault) e.preventDefault();
            this._contextLost = true;
            console.warn('[Michatbot 3D móvil] Contexto WebGL perdido; se intentará recuperar.');
            // Muchos celulares NUNCA disparan "webglcontextrestored". Si no llega
            // en un tiempo corto, recreamos el renderer sobre el MISMO canvas (sin
            // añadir otro contexto) y recargamos el modelo desde la caché.
            if (this._restoreTimer) clearTimeout(this._restoreTimer);
            this._restoreTimer = setTimeout(() => this._rebuild(), 1500);
        }

        _onRestored() {
            if (this._restoreTimer) { clearTimeout(this._restoreTimer); this._restoreTimer = null; }
            this._contextLost = false;
            this._dirty = true;
            console.log('[Michatbot 3D móvil] Contexto WebGL restaurado; repintando.');
        }

        _rebuild() {
            this._restoreTimer = null;
            if (this._destroyed || !this._contextLost) return;
            try {
                const THREE = this.mods.THREE;
                const oldCanvas = this.domElement;
                // Un canvas cuyo contexto se perdió devuelve ESE mismo contexto
                // perdido si se vuelve a pedir: hay que estrenar un canvas nuevo.
                try { this.renderer.dispose(); } catch (e) {}

                this.renderer = new THREE.WebGLRenderer({
                    alpha: true,
                    antialias: false,
                    powerPreference: 'default',
                    preserveDrawingBuffer: false,
                    failIfMajorPerformanceCaveat: false
                });
                this.renderer.setClearColor(0x000000, 0);
                this.renderer.outputColorSpace = THREE.SRGBColorSpace;
                if ('useLegacyLights' in this.renderer) this.renderer.useLegacyLights = true;
                this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));

                this.domElement = this.renderer.domElement;
                this.domElement.className = VIEWER_CLASS;
                this.domElement.style.display = 'block';
                this.domElement.style.width = '100%';
                this.domElement.style.height = '100%';
                this.domElement.style.background = 'transparent';
                if (oldCanvas && oldCanvas.parentElement) {
                    oldCanvas.parentElement.replaceChild(this.domElement, oldCanvas);
                } else {
                    this.container.appendChild(this.domElement);
                }

                const gl = this.renderer.getContext();
                if (gl && gl.canvas) {
                    gl.canvas.addEventListener('webglcontextlost', this._onLost, false);
                    gl.canvas.addEventListener('webglcontextrestored', this._onRestored, false);
                }
                this._contextLost = false;
                this._draggingBound = false; // el canvas es nuevo: reenganchar el arrastre
                this._dragging = false;
                this._dragId = null;
                this._applySize();
                // Recrear los recursos GPU del modelo en el contexto nuevo.
                if (this._modelUrl) this._loadCurrentModel();
                else this._dirty = true;
                console.log('[Michatbot 3D móvil] Visor reconstruido tras pérdida de contexto.');
            } catch (e) {
                console.warn('[Michatbot 3D móvil] No se pudo reconstruir el visor:', e && e.message);
            }
        }

        destroy() {
            this._destroyed = true;
            if (this._restoreTimer) { clearTimeout(this._restoreTimer); this._restoreTimer = null; }
            if (this._raf) cancelAnimationFrame(this._raf);
            this._unbindDrag();
            if (this._resizeObs) this._resizeObs.disconnect();
            else window.removeEventListener('resize', this._applySize);
            try {
                if (this.renderer) {
                    const gl = this.renderer.getContext();
                    if (gl && gl.canvas) {
                        gl.canvas.removeEventListener('webglcontextlost', this._onLost);
                        gl.canvas.removeEventListener('webglcontextrestored', this._onRestored);
                    }
                    if (this._model) disposeObject(this._model);
                    this.renderer.dispose();
                    const lose = gl && gl.getExtension('WEBGL_lose_context');
                    if (lose) lose.loseContext();
                }
            } catch (e) {}
            if (this.domElement && this.domElement.parentElement) {
                this.domElement.parentElement.removeChild(this.domElement);
            }
        }
    }

    function disposeObject(root) {
        try {
            root.traverse((o) => {
                if (o.geometry) o.geometry.dispose();
                if (o.material) {
                    const mats = Array.isArray(o.material) ? o.material : [o.material];
                    mats.forEach((m) => {
                        for (const k in m) {
                            const v = m[k];
                            if (v && v.isTexture) v.dispose();
                        }
                        m.dispose();
                    });
                }
            });
        } catch (e) {}
    }

    // --- Singleton ---
    let instance = null;
    let creating = null;

    window.MichatbotMobile3D = {
        isSupported,
        isCreated: () => !!instance,
        getViewer: () => instance,
        getContextCount() {
            try {
                const c = instance && instance.renderer && instance.renderer.getContext();
                return c ? 1 : 0;
            } catch (e) { return 0; }
        },
        async create(container, opts) {
            if (instance) {
                instance.moveTo(container);
                if (opts && opts.autoRotate !== undefined) instance.setAutoRotate(opts.autoRotate);
                return instance;
            }
            // Concurrent calls (initMichatbot can run several times) must share a
            // single viewer; building two would leak a WebGL context.
            if (creating) return creating;
            creating = (async () => {
                const v = new Mobile3DViewer(container, opts);
                try {
                    await v.init();
                } catch (e) {
                    console.warn('[Michatbot 3D móvil] No se pudo iniciar; se usará model-viewer:', e && e.message);
                    v.destroy();
                    creating = null;
                    return null;
                }
                if (v._destroyed) { creating = null; return null; }
                instance = v;
                creating = null;
                return instance;
            })();
            return creating;
        },
        moveTo(container) {
            return instance ? instance.moveTo(container) : false;
        },
        setModel(url) {
            if (instance) instance.setModel(url);
        },
        setAutoRotate(on) {
            if (instance) instance.setAutoRotate(on);
        },
        pause() { if (instance) instance.pause(); },
        resume() { if (instance) instance.resume(); },
        release() {
            if (instance) { instance.destroy(); instance = null; }
        }
    };

    // --- Guardas de móvil ---
    // El visor expandido (#expanded-gltf-viewer) de las vistas de espíritus crea
    // un contexto WebGL aunque esté oculto. En móvil lo dejamos como marcador y
    // lo creamos solo cuando el usuario abre una carta, para no gastar contextos
    // (son un recurso escaso y su agotamiento es lo que deja el asistente en blanco).
    function isMobile() {
        try {
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
        } catch (e) { return window.innerWidth <= 768; }
    }

    function deferExpandedViewer() {
        if (!isMobile()) return;
        const el = document.getElementById('expanded-gltf-viewer');
        if (!el || el.tagName.toLowerCase() !== 'model-viewer') return;

        const placeholder = document.createElement('div');
        placeholder.id = 'expanded-gltf-viewer';
        el.replaceWith(placeholder);

        document.addEventListener('click', (e) => {
            const card = e.target && e.target.closest ? e.target.closest('.spirit-card') : null;
            if (!card) return;
            const current = document.getElementById('expanded-gltf-viewer');
            if (!current || current.tagName.toLowerCase() === 'model-viewer') return;
            const mv = document.createElement('model-viewer');
            mv.id = 'expanded-gltf-viewer';
            mv.setAttribute('loading', 'eager');
            mv.setAttribute('camera-controls', '');
            mv.setAttribute('auto-rotate', '');
            mv.setAttribute('shadow-intensity', '0');
            mv.setAttribute('environment-image', 'neutral');
            mv.setAttribute('exposure', '1.2');
            mv.setAttribute('oncontextmenu', 'return false;');
            current.replaceWith(mv);
        }, true);
    }

    // Ejecutar cuanto antes (antes de que el módulo de model-viewer "mejore" el
    // elemento y cree su contexto) y de nuevo tras el parseo por si el elemento
    // aparece más abajo en el documento. La función es idempotente.
    deferExpandedViewer();
    document.addEventListener('DOMContentLoaded', deferExpandedViewer);
    window.addEventListener('load', deferExpandedViewer);
})();
