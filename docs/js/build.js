/**
 * build.js - Logic for the Build System
 */

let currentUser = null;
let droppedGltfFile = null;
let droppedExtraFiles = [];
let droppedPosterUrl = '';

$(document).ready(async function() {
    await checkSession();
    initTheme();
    setupEventListeners();
});

async function checkSession() {
    const { data: { session } } = await _supabase.auth.getSession();
    if (!session) {
        $('#login-modal').addClass('active');
    } else {
        const { data: user, error } = await _supabase
            .from('usuarios')
            .select('*')
            .eq('id', session.user.id)
            .single();

        if (error || !user) {
            await _supabase.auth.signOut();
            window.location.reload();
            return;
        }

        currentUser = user;
        if (currentUser.role !== 'admin' && currentUser.role !== 'admin_store') {
            Swal.fire('Acceso Denegado', 'Solo administradores pueden acceder a esta sección.', 'error')
                .then(() => window.location.href = 'index.html');
            return;
        }

        showAuthenticatedContent();
    }
}

function showAuthenticatedContent() {
    $('#login-modal').removeClass('active');
    $('#authenticated-content').show();
    $('#top-panel').show();
    $('#dropdown-user-name').text(currentUser.username);
    loadBuildAssets();
    loadBuildAssignments();
}

function setupEventListeners() {
    // Tabs
    $('.tab-pill').click(function() {
        $('.tab-pill').removeClass('active');
        $(this).addClass('active');
        const tab = $(this).data('tab');
        $('.tab-content').hide();
        $(`#${tab}`).show();
    });

    // Modal Tabs
    $('.slot-tab-btn').click(function() {
        const parent = $(this).closest('.overlay-content');
        parent.find('.slot-tab-btn').removeClass('active');
        $(this).addClass('active');
        const tab = $(this).data('tab');
        parent.find('.slot-tab-content').removeClass('active');
        parent.find(`#${tab}`).addClass('active');
    });

    // Upload Build Modal
    $('#btn-open-upload-build').click(function() {
        resetBuildForm();
        $('#build-upload-modal').addClass('active');
    });

    $('#close-build-upload-modal').click(function() {
        $('#build-upload-modal').removeClass('active');
    });

    // Assignment Modal
    $('#close-assignment-modal').click(function() {
        $('#assignment-modal').removeClass('active');
    });

    // Drop Zone - Build Model
    $(document).on('dragover dragenter', '#drop-zone-build', function(e) { e.preventDefault(); e.stopPropagation(); $(this).addClass('dragover'); });
    $(document).on('dragleave dragend drop', '#drop-zone-build', function(e) { e.preventDefault(); e.stopPropagation(); $(this).removeClass('dragover'); });
    $(document).on('drop', '#drop-zone-build', function(e) {
        const files = e.originalEvent.dataTransfer.files;
        if (files.length > 0) {
            droppedGltfFile = null;
            droppedExtraFiles = [];
            processBuildFiles(files);
        }
    });
    $('#input-build-files').change(function() {
        if (this.files.length > 0) {
            droppedGltfFile = null;
            droppedExtraFiles = [];
            processBuildFiles(this.files);
        }
    });

    // Drop Zone - Poster
    $(document).on('dragover dragenter', '#drop-zone-build-poster', function(e) { e.preventDefault(); e.stopPropagation(); $(this).addClass('dragover'); });
    $(document).on('dragleave dragend drop', '#drop-zone-build-poster', function(e) { e.preventDefault(); e.stopPropagation(); $(this).removeClass('dragover'); });
    $(document).on('drop', '#drop-zone-build-poster', function(e) {
        const files = e.originalEvent.dataTransfer.files;
        if (files.length > 0) handlePosterUpload(files[0]);
    });
    $('#input-build-poster').change(function() {
        if (this.files.length > 0) handlePosterUpload(this.files[0]);
    });

    // Save Asset
    $('#btn-save-build-asset').click(saveBuildAsset);

    // Confirm Assignment
    $('#btn-confirm-assignment').click(confirmAssignment);

    // Login
    $('#btn-login').click(handleLogin);

    // Logout
    $('#menu-btn-logout').click(handleLogout);

    // Theme
    $('.theme-btn-small').click(function() {
        const theme = $(this).data('theme');
        setTheme(theme);
    });
}

function processBuildFiles(files) {
    const fileArray = Array.from(files);
    let foundGltf = false;

    fileArray.forEach(file => {
        const name = file.name.toLowerCase();
        if (!foundGltf && (name.endsWith('.gltf') || name.endsWith('.glb'))) {
            droppedGltfFile = file;
            foundGltf = true;
        } else {
            droppedExtraFiles.push(file);
        }
    });

    updateBuildDropZoneUI(fileArray);
}

function updateBuildDropZoneUI(files) {
    const $zone = $('#drop-zone-build');
    const $fileName = $zone.find('.file-name');
    if (files && files.length > 0) {
        let html = "";
        if (droppedGltfFile) {
            html += `<div style="color: #00d2ff; font-weight: bold; margin-bottom: 5px;"><i class="fas fa-file-code"></i> Principal: ${droppedGltfFile.name}</div>`;
        }
        if (droppedExtraFiles.length > 0) {
            html += `<div style="font-size: 11px; color: #aaa;"><i class="fas fa-paperclip"></i> ${droppedExtraFiles.length} archivos adicionales</div>`;
        }
        $fileName.html(html);
        $zone.find('p').hide();
        $zone.find('i.fa-cloud-upload-alt').hide();
    } else {
        $fileName.text('');
        $zone.find('p').show();
        $zone.find('i.fa-cloud-upload-alt').show();
    }
}

async function handlePosterUpload(file) {
    Swal.fire({ title: 'Subiendo poster...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    try {
        const url = await uploadToCloudinary(file);
        droppedPosterUrl = url;
        $('#drop-zone-build-poster .file-name').text('¡Cargado!').css('color', '#00ff88');
        Swal.close();
    } catch (err) {
        Swal.fire('Error', 'No se pudo subir el poster', 'error');
    }
}

function resetBuildForm() {
    $('#edit-build-id').val('');
    $('#input-build-name').val('');
    $('#input-build-animation').val('orbit');
    $('#input-build-scale').val(1.8);
    $('#input-build-particle-movement').val('falling');
    droppedGltfFile = null;
    droppedExtraFiles = [];
    droppedPosterUrl = '';
    updateBuildDropZoneUI([]);
    $('#drop-zone-build-poster .file-name').text('');
}

async function saveBuildAsset() {
    const name = $('#input-build-name').val();
    const editId = $('#edit-build-id').val();
    const animation = $('#input-build-animation').val();
    const scale = parseFloat($('#input-build-scale').val()) || 1.8;
    const particleMovement = $('#input-build-particle-movement').val();

    if (!name) return Swal.fire('Atención', 'El nombre es obligatorio', 'warning');
    if (!editId && !droppedGltfFile) return Swal.fire('Atención', 'El archivo GLTF es obligatorio', 'warning');

    Swal.fire({ title: 'Guardando...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    try {
        let gltfUrl = null;
        let textureUrl = null;

        if (droppedGltfFile) {
            const folderId = Date.now() + '_' + Math.floor(Math.random() * 1000);
            const gltfPath = `build-models/${folderId}/${droppedGltfFile.name}`;

            const { error: gltfErr } = await _supabase.storage.from('spirits').upload(gltfPath, droppedGltfFile);
            if (gltfErr) throw gltfErr;
            gltfUrl = _supabase.storage.from('spirits').getPublicUrl(gltfPath).data.publicUrl;

            for (const file of droppedExtraFiles) {
                const path = `build-models/${folderId}/${file.name}`;
                await _supabase.storage.from('spirits').upload(path, file);
                if (file.type.startsWith('image/')) {
                    textureUrl = _supabase.storage.from('spirits').getPublicUrl(path).data.publicUrl;
                }
            }
        }

        const assetData = {
            name,
            animation_type: animation,
            scale,
            particle_movement_type: particleMovement,
            poster_url: droppedPosterUrl,
            user_id: currentUser.id
        };

        if (gltfUrl) {
            assetData.gltf_url = gltfUrl;
            assetData.texture_url = textureUrl;
        }

        let dbRes;
        if (editId) {
            dbRes = await _supabase.from('build_assets').update(assetData).eq('id', editId);
        } else {
            dbRes = await _supabase.from('build_assets').insert([assetData]);
        }

        if (dbRes.error) throw dbRes.error;

        Swal.fire('¡Éxito!', 'Modelo guardado correctamente', 'success');
        $('#build-upload-modal').removeClass('active');
        loadBuildAssets();
    } catch (err) {
        console.error(err);
        Swal.fire('Error', 'No se pudo guardar el modelo', 'error');
    }
}

async function loadBuildAssets() {
    const { data: assets, error } = await _supabase
        .from('build_assets')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (error) return $('#build-assets-grid').html('<div class="error">Error al cargar.</div>');
    if (!assets || assets.length === 0) return $('#build-assets-grid').html('<div class="empty">No tienes modelos build.</div>');

    const $grid = $('#build-assets-grid');
    $grid.empty();

    assets.forEach(asset => {
        const $card = $(`
            <div class="build-card">
                <model-viewer
                    src="${asset.gltf_url}"
                    poster="${asset.poster_url || ''}"
                    loading="lazy"
                    camera-controls
                    auto-rotate
                    style="width: 100%; height: 200px; background: rgba(0,0,0,0.2); border-radius: 10px;">
                </model-viewer>
                <h3>${asset.name}</h3>
                <button class="btn btn-add-assignment" data-id="${asset.id}"><i class="fas fa-link"></i> ASIGNAR A VISTA</button>
                <div style="display: flex; gap: 10px;">
                    <button class="btn btn-secondary btn-edit-asset" style="flex: 1;"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger btn-delete-asset" data-id="${asset.id}" style="flex: 1;"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `);

        $card.find('.btn-add-assignment').click(() => {
            $('#assign-asset-id').val(asset.id);
            $('#assignment-modal').addClass('active');
        });

        $card.find('.btn-edit-asset').click(() => editBuildAsset(asset));
        $card.find('.btn-delete-asset').click(() => deleteBuildAsset(asset.id));

        $grid.append($card);
    });
}

async function editBuildAsset(asset) {
    resetBuildForm();
    $('#edit-build-id').val(asset.id);
    $('#input-build-name').val(asset.name);
    $('#input-build-animation').val(asset.animation_type);
    $('#input-build-scale').val(asset.scale);
    $('#input-build-particle-movement').val(asset.particle_movement_type);
    droppedPosterUrl = asset.poster_url;
    if (asset.poster_url) $('#drop-zone-build-poster .file-name').text('¡Cargado!');
    $('#build-upload-modal').addClass('active');
}

async function deleteBuildAsset(id) {
    const result = await Swal.fire({
        title: '¿Eliminar modelo?',
        text: "Se borrará permanentemente",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff4757'
    });
    if (result.isConfirmed) {
        await _supabase.from('build_assets').delete().eq('id', id);
        loadBuildAssets();
    }
}

async function confirmAssignment() {
    const assetId = $('#assign-asset-id').val();
    const viewName = $('#assign-view-name').val();
    const target = $('#assign-target').val();

    Swal.fire({ title: 'Asignando...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    try {
        // Use upsert-like logic: Delete existing assignment for this view/target/user first
        await _supabase
            .from('build_assignments')
            .delete()
            .eq('user_id', currentUser.id)
            .eq('view_name', viewName)
            .eq('target', target);

        const { error } = await _supabase.from('build_assignments').insert([{
            user_id: currentUser.id,
            view_name,
            asset_id: assetId,
            target,
            is_active: true
        }]);

        if (error) throw error;

        Swal.fire('¡Éxito!', 'Vista asignada correctamente', 'success');
        $('#assignment-modal').removeClass('active');
        loadBuildAssignments();
    } catch (err) {
        console.error(err);
        Swal.fire('Error', 'No se pudo realizar la asignación', 'error');
    }
}

async function loadBuildAssignments() {
    const { data: assignments, error } = await _supabase
        .from('build_assignments')
        .select('*, build_assets(name)')
        .eq('user_id', currentUser.id);

    if (error) return $('#build-assignments-list').html('<div class="error">Error al cargar.</div>');
    if (!assignments || assignments.length === 0) return $('#build-assignments-list').html('<div class="empty">No hay asignaciones activas.</div>');

    const $list = $('#build-assignments-list');
    $list.empty();

    assignments.forEach(ass => {
        const $row = $(`
            <div class="assignment-row">
                <div class="assignment-info">
                    <span class="assignment-view">${ass.view_name}</span>
                    <span class="assignment-target">${ass.target === 'public' ? 'Link Público' : 'Link Admin'}</span>
                    <div style="font-size: 0.8rem; margin-top: 5px;">Modelo: <strong>${ass.build_assets.name}</strong></div>
                </div>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <label class="switch">
                        <input type="checkbox" class="toggle-assignment" data-id="${ass.id}" ${ass.is_active ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                    <button class="btn btn-danger btn-sm btn-delete-assignment" data-id="${ass.id}"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `);

        $row.find('.toggle-assignment').change(async function() {
            const active = $(this).is(':checked');
            await _supabase.from('build_assignments').update({ is_active: active }).eq('id', ass.id);
        });

        $row.find('.btn-delete-assignment').click(async function() {
            await _supabase.from('build_assignments').delete().eq('id', ass.id);
            loadBuildAssignments();
        });

        $list.append($row);
    });
}

// Reuse some logic from utils.js/admin.js if necessary, but keep it clean
async function handleLogin() {
    const username = $('#login-username').val();
    const password = $('#login-password').val();
    const { data, error } = await _supabase.auth.signInWithPassword({ email: username + '@viking.com', password });
    if (error) Swal.fire('Error', 'Credenciales incorrectas', 'error');
    else window.location.reload();
}

async function handleLogout() {
    await _supabase.auth.signOut();
    window.location.reload();
}

function initTheme() {
    const savedTheme = localStorage.getItem('viking-theme') || 'theme-dark';
    setTheme(savedTheme);
}

function setTheme(theme) {
    $('body').attr('class', theme);
    localStorage.setItem('viking-theme', theme);
}
