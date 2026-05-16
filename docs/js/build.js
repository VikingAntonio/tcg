/**
 * Build Management System - Refined Logic
 */

let currentUser = null;
let myAssets = [];
let myAssignments = [];

// Drag & Drop State
let droppedGltf = null;
let droppedExtras = [];
let droppedPoster = null;

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

// --- UI Rendering ---

function renderViewGrid() {
    const $grid = $('#view-grid');
    $grid.empty();

    VIEW_CONFIG.forEach(view => {
        const publicAss = myAssignments.find(a => a.view_name === view.key && a.target === 'public');
        const adminAss = myAssignments.find(a => a.view_name === view.key && a.target === 'admin');

        const isPublicActive = publicAss && publicAss.is_active;
        const isAdminActive = adminAss && adminAss.is_active;

        const publicModel = publicAss ? myAssets.find(a => a.id === publicAss.asset_id) : null;

        const $card = $(`
            <div class="view-card" data-view="${view.key}">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
                    <div class="view-icon"><i class="fas ${view.icon}"></i></div>
                    <div class="view-status ${isPublicActive || isAdminActive ? 'status-build' : 'status-live'}">
                        ${isPublicActive || isAdminActive ? 'Build' : 'Live'}
                    </div>
                </div>
                <h3 style="margin: 0 0 5px 0;">${view.name}</h3>

                <div class="target-selector">
                    <button class="target-btn active" data-target="public">PÚBLICO</button>
                    <button class="target-btn" data-target="admin">ADMIN</button>
                </div>

                <div class="model-picker-trigger" id="trigger-${view.key}">
                    ${renderPickerContent(publicModel)}
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 0.75rem; color: #888; font-weight: bold;">ACTIVAR OVERLAY</span>
                    <label class="build-toggle">
                        <input type="checkbox" class="toggle-view" ${isPublicActive ? 'checked' : ''}>
                        <span class="build-slider"></span>
                    </label>
                </div>
            </div>
        `);

        // Target switch logic
        $card.find('.target-btn').click(function() {
            const target = $(this).data('target');
            $card.find('.target-btn').removeClass('active');
            $(this).addClass('active');

            const ass = myAssignments.find(a => a.view_name === view.key && a.target === target);
            const model = ass ? myAssets.find(a => a.id === ass.asset_id) : null;

            $card.find('.model-picker-trigger').html(renderPickerContent(model));
            $card.find('.toggle-view').prop('checked', ass ? ass.is_active : false);
        });

        // Open picker
        $card.find('.model-picker-trigger').click(function() {
            currentAssignView = view.key;
            currentAssignTarget = $card.find('.target-btn.active').data('target');
            openModelPicker();
        });

        // Toggle logic
        $card.find('.toggle-view').change(async function() {
            const active = $(this).is(':checked');
            const target = $card.find('.target-btn.active').data('target');
            const ass = myAssignments.find(a => a.view_name === view.key && a.target === target);

            if (!ass) {
                $(this).prop('checked', false);
                return Swal.fire('Atención', 'Selecciona un modelo primero', 'warning');
            }

            const { error } = await _supabase.from('build_assignments').update({ is_active: active }).eq('id', ass.id);
            if (!error) {
                ass.is_active = active;
                updateStatusLabel($card, view.key);
            }
        });

        $grid.append($card);
    });
}

function renderPickerContent(model) {
    if (!model) return `<i class="fas fa-plus-circle"></i> ASIGNAR`;
    return `
        <div style="display: flex; align-items: center; gap: 10px; text-align: left;">
            <img src="${model.poster_url || 'https://via.placeholder.com/40'}" style="width: 30px; height: 30px; border-radius: 5px; object-fit: cover;">
            <div style="font-size: 0.75rem; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;">
                ${model.name}
            </div>
        </div>
    `;
}

function updateStatusLabel($card, viewKey) {
    const pub = myAssignments.find(a => a.view_name === viewKey && a.target === 'public');
    const adm = myAssignments.find(a => a.view_name === viewKey && a.target === 'admin');
    const active = (pub && pub.is_active) || (adm && adm.is_active);
    $card.find('.view-status').removeClass('status-live status-build').addClass(active ? 'status-build' : 'status-live').text(active ? 'Build' : 'Live');
}

function renderAssetsGrid() {
    const $grid = $('#assets-grid');
    $grid.empty();

    myAssets.forEach(asset => {
        const $el = $(`
            <div class="asset-card">
                <div class="asset-viewer-container">
                    <model-viewer src="${asset.gltf_url}" poster="${asset.poster_url || ''}" loading="lazy" auto-rotate style="width:100%; height:100%;"></model-viewer>
                </div>
                <div style="padding: 15px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 800; font-size: 0.85rem;">${asset.name}</span>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn-edit" style="background: none; border: none; color: #888; cursor: pointer;"><i class="fas fa-edit"></i></button>
                        <button class="btn-delete" style="background: none; border: none; color: #ff4757; cursor: pointer;"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            </div>
        `);

        $el.find('.btn-edit').click(() => openAssetModal(asset));
        $el.find('.btn-delete').click(() => deleteAsset(asset.id));
        $grid.append($el);
    });
}

// --- Side Panel & Modal Events ---

function setupEvents() {
    // Side Panel
    $('#side-tab-trigger').click(() => {
        $('#build-side-panel, #side-panel-overlay').addClass('active');
        $('#side-tab-trigger').css('opacity', '0');
    });

    $('#side-panel-overlay').click(() => {
        $('#build-side-panel, #side-panel-overlay').removeClass('active');
        $('#side-tab-trigger').css('opacity', '1');
    });

    // Tabs
    $('.slot-tab-btn').click(function() {
        $('.slot-tab-btn').removeClass('active');
        $(this).addClass('active');
        $('.slot-tab-content').removeClass('active');
        $(`#${$(this).data('tab')}`).addClass('active');
    });

    $('#btn-open-upload').click(() => {
        $('#build-side-panel, #side-panel-overlay').removeClass('active');
        $('#side-tab-trigger').css('opacity', '1');
        openAssetModal();
    });

    // Asset Dropzone
    setupDropzone('#drop-zone-asset', (files) => {
        droppedGltf = null; droppedExtras = [];
        Array.from(files).forEach(f => {
            if (f.name.toLowerCase().endsWith('.gltf') || f.name.toLowerCase().endsWith('.glb')) droppedGltf = f;
            else droppedExtras.push(f);
        });
        const label = droppedGltf ? `OK: ${droppedGltf.name}` : 'No 3D file found';
        $('#drop-zone-asset .file-name').text(label);
    });

    // Poster Dropzone
    setupDropzone('#drop-zone-poster', (files) => {
        droppedPoster = files[0];
        if (droppedPoster) {
            const reader = new FileReader();
            reader.onload = (e) => {
                $('#drop-zone-poster').css('background-image', `url(${e.target.result})`).css('background-size', 'cover');
                $('#drop-zone-poster i, #drop-zone-poster p').hide();
            };
            reader.readAsDataURL(droppedPoster);
            $('#drop-zone-poster .file-name').text(droppedPoster.name);
        }
    });

    $('#btn-save-asset').click(saveAsset);
}

function setupDropzone(selector, callback) {
    const $zone = $(selector);
    $zone.on('dragover dragenter', function(e) { e.preventDefault(); $(this).addClass('dragover'); });
    $zone.on('dragleave dragend drop', function(e) { e.preventDefault(); $(this).removeClass('dragover'); });
    $zone.on('drop', function(e) { callback(e.originalEvent.dataTransfer.files); });
    $zone.find('input').on('change', function() { callback(this.files); });
    $zone.click(function() { $(this).find('input').click(); });
}

function openAssetModal(asset = null) {
    $('#asset-modal-title').text(asset ? 'EDITAR MODELO' : 'NUEVO MODELO');
    $('#asset-id').val(asset ? asset.id : '');
    $('#asset-name').val(asset ? asset.name : '');
    $('#asset-animation').val(asset ? asset.animation_type : 'orbit');
    $('#asset-scale').val(asset ? asset.scale : 1.8);
    $('#asset-particles').val(asset ? (asset.particle_asset || 'none') : 'none');

    // Reset dropzones
    $('.file-name').text('');
    $('#drop-zone-poster').css('background-image', 'none');
    $('#drop-zone-poster i, #drop-zone-poster p').show();
    droppedGltf = null; droppedExtras = []; droppedPoster = null;

    $('#modal-asset').addClass('active');
}

async function saveAsset() {
    const name = $('#asset-name').val();
    const id = $('#asset-id').val();
    if (!name) return Swal.fire('Aviso', 'Nombre requerido', 'warning');
    if (!id && !droppedGltf) return Swal.fire('Aviso', 'Sube un archivo 3D', 'warning');

    Swal.fire({ title: 'Guardando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        let gltfUrl = null, posterUrl = null;
        if (droppedPoster) posterUrl = await CloudinaryUpload.uploadImage(droppedPoster);

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
            name, user_id: currentUser.id,
            animation_type: $('#asset-animation').val(),
            scale: parseFloat($('#asset-scale').val()),
            particle_asset: $('#asset-particles').val()
        };
        if (gltfUrl) data.gltf_url = gltfUrl;
        if (posterUrl) data.poster_url = posterUrl;

        const res = id ? await _supabase.from('build_assets').update(data).eq('id', id) : await _supabase.from('build_assets').insert([data]);
        if (res.error) throw res.error;

        await loadInitialData();
        $('#modal-asset').removeClass('active');
        Swal.fire('¡Éxito!', 'Guardado', 'success');
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
}

async function deleteAsset(id) {
    const { isConfirmed } = await Swal.fire({ title: '¿Eliminar?', icon: 'warning', showCancelButton: true });
    if (isConfirmed) {
        const { error } = await _supabase.from('build_assets').delete().eq('id', id);
        if (!error) { await loadInitialData(); Swal.fire('Eliminado', '', 'success'); }
    }
}

function openModelPicker() {
    const $grid = $('#picker-grid').empty();
    myAssets.forEach(asset => {
        const $opt = $(`<div class="model-option"><img src="${asset.poster_url || ''}"><div style="font-weight:bold; font-size:0.8rem;">${asset.name}</div></div>`);
        $opt.click(async () => {
            const assData = { user_id: currentUser.id, view_name: currentAssignView, target: currentAssignTarget, asset_id: asset.id, is_active: true };
            await _supabase.from('build_assignments').upsert(assData, { onConflict: 'user_id,view_name,target' });
            await loadInitialData();
            $('#model-picker').removeClass('active');
        });
        $grid.append($opt);
    });
    $('#model-picker').addClass('active');
}
