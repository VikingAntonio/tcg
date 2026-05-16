/**
 * Modern build.js - Visual & Intuitive
 */

let currentUser = null;
let myAssets = [];
let myAssignments = [];
let droppedGltf = null;
let droppedExtras = [];
let currentAssignView = null;
let currentAssignTarget = 'public';

const VIEW_CONFIG = [
    { key: 'albums', name: 'Álbumes', icon: 'fa-book' },
    { key: 'decks', name: 'Decks', icon: 'fa-layer-group' },
    { key: 'auctions', name: 'Subastas', icon: 'fa-gavel' },
    { key: 'sealed', name: 'Producto Sellado', icon: 'fa-box' },
    { key: 'preorders', name: 'Preventas', icon: 'fa-fire' },
    { key: 'wishlist', name: 'Buscamos', icon: 'fa-heart' },
    { key: 'investments', name: 'Inversiones', icon: 'fa-chart-line' },
    { key: 'claims', name: 'Claims', icon: 'fa-hand-holding-heart' },
    { key: 'events', name: 'Eventos', icon: 'fa-calendar-alt' }
];

$(document).ready(async function() {
    await checkSession();
    setupEvents();
});

async function checkSession() {
    const { data: { session } } = await _supabase.auth.getSession();
    if (!session) { window.location.href = 'admin.html'; return; }

    const { data: user } = await _supabase.from('usuarios').select('*').eq('id', session.user.id).single();
    if (!user) { window.location.href = 'admin.html'; return; }

    currentUser = user;
    loadInitialData();
}

async function loadInitialData() {
    const [assetsRes, assignsRes] = await Promise.all([
        _supabase.from('build_assets').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }),
        _supabase.from('build_assignments').select('*').eq('user_id', currentUser.id)
    ]);

    myAssets = assetsRes.data || [];
    myAssignments = assignsRes.data || [];

    renderViewGrid();
    renderAssetsGrid();
}

function renderViewGrid() {
    const $grid = $('#view-grid');
    $grid.empty();

    VIEW_CONFIG.forEach(view => {
        const publicAss = myAssignments.find(a => a.view_name === view.key && a.target === 'public');
        const adminAss = myAssignments.find(a => a.view_name === view.key && a.target === 'admin');

        const isPublicActive = publicAss && publicAss.is_active;
        const isAdminActive = adminAss && adminAss.is_active;

        const publicModel = publicAss ? myAssets.find(a => a.id === publicAss.asset_id) : null;
        const adminModel = adminAss ? myAssets.find(a => a.id === adminAss.asset_id) : null;

        const $card = $(`
            <div class="view-card" data-view="${view.key}">
                <div class="view-card-header">
                    <div class="view-icon"><i class="fas ${view.icon}"></i></div>
                    <div class="view-status ${isPublicActive || isAdminActive ? 'status-build' : 'status-live'}">
                        ${isPublicActive || isAdminActive ? 'Construcción' : 'En Vivo'}
                    </div>
                </div>
                <h3>${view.name}</h3>

                <div class="view-card-controls">
                    <div class="target-selector">
                        <button class="target-btn active" data-target="public">PÚBLICO</button>
                        <button class="target-btn" data-target="admin">ADMIN</button>
                    </div>

                    <div class="model-picker-trigger" id="trigger-${view.key}">
                        ${renderPickerContent(view.key, 'public', publicModel)}
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                        <span style="font-size: 0.8rem; font-weight: 700; color: #888;">ESTADO ACTIVO</span>
                        <label class="build-toggle">
                            <input type="checkbox" class="toggle-view" data-view="${view.key}" ${isPublicActive ? 'checked' : ''}>
                            <span class="build-slider"></span>
                        </label>
                    </div>
                </div>
            </div>
        `);

        // Target switch logic
        $card.find('.target-btn').click(function() {
            const $btn = $(this);
            const target = $btn.data('target');
            $card.find('.target-btn').removeClass('active');
            $btn.addClass('active');

            // Update toggle and picker for the selected target
            const ass = myAssignments.find(a => a.view_name === view.key && a.target === target);
            const model = ass ? myAssets.find(a => a.id === ass.asset_id) : null;

            $card.find('.model-picker-trigger').html(renderPickerContent(view.key, target, model));
            $card.find('.toggle-view').prop('checked', ass ? ass.is_active : false);
        });

        // Open picker logic
        $card.find('.model-picker-trigger').click(function() {
            currentAssignView = view.key;
            currentAssignTarget = $card.find('.target-btn.active').data('target');
            openModelPicker();
        });

        // Toggle visibility logic
        $card.find('.toggle-view').change(async function() {
            const active = $(this).is(':checked');
            const target = $card.find('.target-btn.active').data('target');

            const ass = myAssignments.find(a => a.view_name === view.key && a.target === target);
            if (!ass) {
                $(this).prop('checked', false);
                return Swal.fire('Atención', 'Primero selecciona un modelo para esta vista', 'warning');
            }

            const { error } = await _supabase.from('build_assignments').update({ is_active: active }).eq('id', ass.id);
            if (error) return Swal.fire('Error', 'No se pudo actualizar', 'error');

            ass.is_active = active;
            updateStatusLabel($card, view.key);
        });

        $grid.append($card);
    });
}

function renderPickerContent(view, target, model) {
    if (model) {
        return `
            <div class="model-preview-small">
                <img src="${model.poster_url || 'https://via.placeholder.com/100?text=3D'}" alt="Preview">
                <div style="text-align: left;">
                    <div style="font-size: 0.8rem; font-weight: 800;">${model.name}</div>
                    <div style="font-size: 0.7rem; color: var(--build-primary);">Cambiar Modelo</div>
                </div>
            </div>
        `;
    } else {
        return `<i class="fas fa-plus-circle"></i> ASIGNAR MODELO`;
    }
}

function updateStatusLabel($card, viewKey) {
    const pub = myAssignments.find(a => a.view_name === viewKey && a.target === 'public');
    const adm = myAssignments.find(a => a.view_name === viewKey && a.target === 'admin');
    const isAnyActive = (pub && pub.is_active) || (adm && adm.is_active);

    $card.find('.view-status')
        .removeClass('status-live status-build')
        .addClass(isAnyActive ? 'status-build' : 'status-live')
        .text(isAnyActive ? 'Construcción' : 'En Vivo');
}

function renderAssetsGrid() {
    const $grid = $('#assets-grid');
    $grid.empty();

    myAssets.forEach(asset => {
        const $el = $(`
            <div class="asset-card">
                <div class="asset-viewer-container">
                    <model-viewer
                        src="${asset.gltf_url}"
                        poster="${asset.poster_url || ''}"
                        loading="lazy"
                        camera-controls
                        auto-rotate
                        style="width: 100%; height: 100%;">
                    </model-viewer>
                </div>
                <div class="asset-info">
                    <h4 style="margin: 0; font-size: 1.1rem;">${asset.name}</h4>
                </div>
                <div class="asset-actions">
                    <button class="btn-build-main btn-edit-asset" style="padding: 10px; background: rgba(255,255,255,0.05); color: white;">
                        <i class="fas fa-edit"></i> EDITAR
                    </button>
                    <button class="btn-build-main btn-delete-asset" style="padding: 10px; background: rgba(255,71,87,0.1); color: #ff4757;">
                        <i class="fas fa-trash"></i> BORRAR
                    </button>
                </div>
            </div>
        `);

        $el.find('.btn-edit-asset').click(() => openAssetModal(asset));
        $el.find('.btn-delete-asset').click(() => deleteAsset(asset.id));

        $grid.append($el);
    });
}

function openModelPicker() {
    const $grid = $('#picker-grid');
    $grid.empty();

    myAssets.forEach(asset => {
        const $option = $(`
            <div class="model-option">
                <img src="${asset.poster_url || 'https://via.placeholder.com/150?text=3D'}" alt="${asset.name}">
                <div style="font-weight: bold; font-size: 0.9rem;">${asset.name}</div>
            </div>
        `);

        $option.click(async () => {
            await assignModelToView(asset.id);
            $('#model-picker').removeClass('active');
        });

        $grid.append($option);
    });

    if (myAssets.length === 0) {
        $grid.html('<div style="grid-column: 1/-1; text-align: center; color: #888;">Primero debes subir un modelo 3D.</div>');
    }

    $('#model-picker').addClass('active');
}

async function assignModelToView(assetId) {
    Swal.fire({ title: 'Asignando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const assData = {
            user_id: currentUser.id,
            view_name: currentAssignView,
            target: currentAssignTarget,
            asset_id: assetId,
            is_active: true
        };

        const { error } = await _supabase.from('build_assignments').upsert(assData, { onConflict: 'user_id,view_name,target' });
        if (error) throw error;

        await loadInitialData(); // Refresh UI
        Swal.fire('¡Éxito!', 'Modelo asignado correctamente', 'success');
    } catch (e) {
        console.error(e);
        Swal.fire('Error', 'No se pudo asignar el modelo', 'error');
    }
}

// --- Asset CRUD ---

function setupEvents() {
    // Tabs switching
    $('.slot-tab-btn').click(function() {
        $('.slot-tab-btn').removeClass('active');
        $(this).addClass('active');
        $('.slot-tab-content').removeClass('active');
        $(`#${$(this).data('tab')}`).addClass('active');
    });

    $('#btn-open-upload').click(() => openAssetModal());

    // Save
    $('#btn-save-asset').click(saveAsset);

    // Dropzone
    const $zone = $('#drop-zone-asset');
    $zone.on('dragover dragenter', function(e) { e.preventDefault(); $(this).addClass('dragover'); });
    $zone.on('dragleave dragend drop', function(e) { e.preventDefault(); $(this).removeClass('dragover'); });
    $zone.on('drop', function(e) {
        const files = e.originalEvent.dataTransfer.files;
        handleFiles(files);
    });
    $('#input-asset-files').on('change', function() { handleFiles(this.files); });
}

function handleFiles(files) {
    droppedGltf = null;
    droppedExtras = [];
    Array.from(files).forEach(f => {
        if (f.name.toLowerCase().endsWith('.gltf') || f.name.toLowerCase().endsWith('.glb')) droppedGltf = f;
        else droppedExtras.push(f);
    });

    const $label = $('#drop-zone-asset .file-name');
    if (droppedGltf) {
        $label.html(`¡Listo! Principal: ${droppedGltf.name} <br> <small>${droppedExtras.length} archivos extras</small>`);
    } else {
        $label.text('No se detectó archivo .gltf o .glb');
    }
}

function openAssetModal(asset = null) {
    $('#asset-modal-title').text(asset ? 'EDITAR MODELO' : 'NUEVO MODELO');
    $('#asset-id').val(asset ? asset.id : '');
    $('#asset-name').val(asset ? asset.name : '');
    $('#asset-animation').val(asset ? asset.animation_type : 'orbit');
    $('#asset-scale').val(asset ? asset.scale : 1.8);
    $('#drop-zone-asset .file-name').text('');
    droppedGltf = null;
    droppedExtras = [];

    $('#modal-asset').addClass('active');
}

async function saveAsset() {
    const name = $('#asset-name').val();
    const id = $('#asset-id').val();
    const animation = $('#asset-animation').val();
    const scale = parseFloat($('#asset-scale').val());
    const posterFile = $('#input-poster')[0].files[0];

    if (!name) return Swal.fire('Aviso', 'El nombre es obligatorio', 'warning');
    if (!id && !droppedGltf) return Swal.fire('Aviso', 'Debes subir el archivo 3D', 'warning');

    Swal.fire({ title: 'Guardando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        let gltfUrl = null;
        let posterUrl = null;

        // 1. Upload Poster to Cloudinary
        if (posterFile) {
            posterUrl = await CloudinaryUpload.uploadImage(posterFile);
        }

        // 2. Upload GLTF to Supabase
        if (droppedGltf) {
            const folder = Date.now();
            const mainPath = `build_models/${currentUser.id}/${folder}/${droppedGltf.name}`;
            await _supabase.storage.from('spirits').upload(mainPath, droppedGltf);
            gltfUrl = _supabase.storage.from('spirits').getPublicUrl(mainPath).data.publicUrl;

            for (const f of droppedExtras) {
                await _supabase.storage.from('spirits').upload(`build_models/${currentUser.id}/${folder}/${f.name}`, f);
            }
        }

        const data = {
            name, animation_type: animation, scale, user_id: currentUser.id
        };
        if (gltfUrl) data.gltf_url = gltfUrl;
        if (posterUrl) data.poster_url = posterUrl;

        let res;
        if (id) res = await _supabase.from('build_assets').update(data).eq('id', id);
        else res = await _supabase.from('build_assets').insert([data]);

        if (res.error) throw res.error;

        await loadInitialData();
        $('#modal-asset').removeClass('active');
        Swal.fire('¡Éxito!', 'Modelo guardado correctamente', 'success');
    } catch (e) {
        console.error(e);
        Swal.fire('Error', 'No se pudo guardar: ' + e.message, 'error');
    }
}

async function deleteAsset(id) {
    const { isConfirmed } = await Swal.fire({
        title: '¿Eliminar modelo?',
        text: 'Esto también quitará las asignaciones activas.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff4757'
    });

    if (isConfirmed) {
        const { error } = await _supabase.from('build_assets').delete().eq('id', id);
        if (error) return Swal.fire('Error', 'No se pudo borrar', 'error');

        await loadInitialData();
        Swal.fire('Eliminado', '', 'success');
    }
}
