$(document).ready(async function() {
    let currentUser = null;
    let selectedLogoFile = null;

    await checkSession();
    initTheme();

    async function checkSession() {
        try {
            const { data: { session } } = await _supabase.auth.getSession();
            if (session) {
                const { data, error } = await _supabase
                    .from('usuarios')
                    .select('*')
                    .eq('id', session.user.id)
                    .maybeSingle();

                if (data) {
                    currentUser = data;
                    localStorage.setItem('tcg_session', JSON.stringify(data));
                    loadProfileData();
                    updateHeader();
                    $('.admin-container').show();
                    return;
                } else if (error) {
                    console.warn("Error loading user profile:", error);
                }
            }
        } catch (e) {
            console.error("Session check exception:", e);
        }

        // Fallback to cached session in localStorage if auth session check fails or offline
        const cachedUser = localStorage.getItem('tcg_session');
        if (cachedUser) {
            try {
                currentUser = JSON.parse(cachedUser);
                loadProfileData();
                updateHeader();
                $('.admin-container').show();
                return;
            } catch (err) {
                console.error("Error parsing cached tcg_session:", err);
            }
        }

        window.location.href = 'admin.html';
    }

    function loadProfileData() {
        $('#profile-username').val(currentUser.username);
        $('#profile-email').val(currentUser.email || '');

        // Always show and load WhatsApp/Messenger/Domain for all users
        $('#profile-whatsapp').val(currentUser.whatsapp_link || '');
        $('#profile-messenger').val(currentUser.messenger_link || '');
        $('#profile-domain').val(currentUser.custom_domain || '');

        if (currentUser.is_store) {
            $('.store-only-field').show();
            $('#profile-store-name').val(currentUser.store_name || '');
            $('#profile-horario').val(currentUser.horario || '');
            $('#profile-ubicacion').val(currentUser.ubicacion || '');

            if (currentUser.store_logo) {
                $('#profile-logo-preview').attr('src', currentUser.store_logo);
            }
        } else {
            $('.store-only-field').hide();
        }

        loadAdditionalInfoBlocks();
    }

    function loadAdditionalInfoBlocks() {
        const $container = $('#additional-info-container');
        $container.empty();

        let blocks = [];
        if (currentUser.additional_info) {
            if (typeof currentUser.additional_info === 'string') {
                try { blocks = JSON.parse(currentUser.additional_info); } catch (e) { blocks = []; }
            } else if (Array.isArray(currentUser.additional_info)) {
                blocks = currentUser.additional_info;
            }
        }

        if (blocks.length === 0) {
            // Render default empty block placeholder if none exist
            addInfoBlockUI('', '');
        } else {
            blocks.forEach(block => {
                addInfoBlockUI(block.title || '', block.description || '');
            });
        }
    }

    function addInfoBlockUI(title = '', description = '') {
        const $container = $('#additional-info-container');
        const blockHtml = `
            <div class="info-block-card" style="background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 16px; position: relative;">
                <button type="button" class="btn-remove-info-block" style="position: absolute; top: 12px; right: 12px; background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 6px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer;" title="Eliminar bloque">
                    <i class="fas fa-times"></i>
                </button>
                <div class="form-group" style="margin-bottom: 12px; padding-right: 35px;">
                    <label style="font-size: 0.85rem; color: #cbd5e1; font-weight: 500;">Título</label>
                    <input type="text" class="info-block-title" value="${title.replace(/"/g, '&quot;')}" style="width: 100%; font-size: 0.9rem;">
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <label style="font-size: 0.85rem; color: #cbd5e1; font-weight: 500;">Descripción</label>
                    <textarea class="info-block-desc" rows="3" placeholder="Agrega información adicional para que tu asistente conozca más de tu negocio" style="width: 100%; font-size: 0.88rem; background: rgba(0,0,0,0.3); color: #f8fafc; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; padding: 10px; resize: vertical;">${description}</textarea>
                </div>
            </div>
        `;
        $container.append(blockHtml);
    }

    $('#btn-add-info-block').click(function() {
        addInfoBlockUI('', '');
    });

    $(document).on('click', '.btn-remove-info-block', function() {
        $(this).closest('.info-block-card').remove();
    });

    function updateHeader() {
        if (currentUser.is_store) {
            $('#dropdown-user-logo').show().attr('src', currentUser.store_logo || 'https://midominio.com/placeholder-logo.png');
            $('#dropdown-user-name').text(currentUser.store_name || currentUser.username);
            $('#dropdown-user-role').hide();
        } else {
            $('#dropdown-user-logo').hide();
            $('#dropdown-user-name').text(currentUser.username);
            $('#dropdown-user-role').hide();
        }

        if (typeof Cart !== 'undefined') {
            $('#cart-count').text(Cart.getCount());
        }
    }

    // --- Logo Upload Logic ---
    $('#btn-change-logo').click(function() {
        $('#input-logo-file').click();
    });

    $('#input-logo-file').change(function() {
        const file = this.files[0];
        if (file) {
            selectedLogoFile = file;
            const reader = new FileReader();
            reader.onload = function(e) {
                $('#profile-logo-preview').attr('src', e.target.result);
            };
            reader.readAsDataURL(file);
        }
    });

    // --- Save Profile ---
    $('#btn-save-profile').click(async function() {
        const email = $('#profile-email').val().trim();
        const storeName = $('#profile-store-name').val().trim();
        const whatsapp = $('#profile-whatsapp').val().trim();
        const messenger = $('#profile-messenger').val().trim();
        const horario = $('#profile-horario').val().trim();
        const ubicacion = $('#profile-ubicacion').val().trim();

        Swal.fire({
            title: 'Guardando...',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        try {
            // --- Duplicate Store Name Check ---
            if (storeName && storeName !== currentUser.store_name) {
                // Check if store_name already exists for another user
                const { data: existingStore, error: storeCheckError } = await _supabase
                    .from('usuarios')
                    .select('id')
                    .eq('store_name', storeName)
                    .neq('id', currentUser.id)
                    .maybeSingle();

                // Also check if any user has this storeName as their username
                const { data: existingUser, error: userCheckError } = await _supabase
                    .from('usuarios')
                    .select('id')
                    .eq('username', storeName)
                    .neq('id', currentUser.id)
                    .maybeSingle();

                if (existingStore || existingUser) {
                    Swal.fire({
                        title: 'Atención',
                        text: 'Este nombre de tienda ya está en uso. Por favor, elige otro.',
                        icon: 'warning'
                    });
                    return;
                }
            }

            let logoUrl = currentUser.store_logo;

            // 1. Upload Logo if changed (Only for stores)
            if (currentUser.is_store && selectedLogoFile) {
                const fileExt = selectedLogoFile.name.split('.').pop();
                const fileName = `${currentUser.id}_${Date.now()}.${fileExt}`;
                const filePath = `${fileName}`;

                const { data, error: uploadError } = await _supabase.storage
                    .from('logos')
                    .upload(filePath, selectedLogoFile);

                if (uploadError) throw uploadError;

                const { data: publicData } = _supabase.storage
                    .from('logos')
                    .getPublicUrl(filePath);

                logoUrl = publicData.publicUrl;
            }

            const domainVal = $('#profile-domain').val().trim();
            const cleanDomainStr = domainVal ? domainVal.toLowerCase().replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].split(':')[0].trim() : null;

            // Gather Additional Info Blocks
            const additionalInfoBlocks = [];
            $('.info-block-card').each(function() {
                const bTitle = $(this).find('.info-block-title').val().trim();
                const bDesc = $(this).find('.info-block-desc').val().trim();
                if (bTitle || bDesc) {
                    additionalInfoBlocks.push({
                        title: bTitle,
                        description: bDesc
                    });
                }
            });

            // 2. Update DB
            // Start with fields common to all users
            const updateData = {
                whatsapp_link: whatsapp || null,
                messenger_link: messenger || null,
                custom_domain: cleanDomainStr,
                additional_info: additionalInfoBlocks
            };

            if (cleanDomainStr) {
                await _supabase.from('widget_domains').upsert([
                    { user_id: currentUser.id, domain: cleanDomainStr, widget_type: 'chatbot', is_active: true }
                ], { onConflict: 'user_id,domain,widget_type' });
            }

            // Only add store-specific fields if the user is a store
            if (currentUser.is_store) {
                updateData.store_name = storeName || null;
                updateData.horario = horario || null;
                updateData.ubicacion = ubicacion || null;
                updateData.store_logo = logoUrl || null;
            }

            const { error: dbError } = await _supabase
                .from('usuarios')
                .update(updateData)
                .eq('id', currentUser.id);

            if (dbError) throw dbError;

            // Update local session
            const newUserData = { ...currentUser, ...updateData };
            localStorage.setItem('tcg_session', JSON.stringify(newUserData));
            currentUser = newUserData;

            Swal.fire({
                title: '¡Actualizado!',
                text: 'Tu perfil ha sido guardado correctamente.',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });

        } catch (err) {
            console.error(err);
            Swal.fire('Error', 'No se pudo actualizar el perfil: ' + (err.message || ''), 'error');
        }
    });

    // --- Header Actions ---
    $('#avatar-btn').click(function(e) {
        e.stopPropagation();
        $('#user-dropdown').toggleClass('active');
    });

    $(document).on('click', function(e) {
        if (!$(e.target).closest('.user-menu-container').length) {
            $('#user-dropdown').removeClass('active');
        }
    });

    $('#btn-logout').click(async function(e) {
        e.preventDefault();
        await _supabase.auth.signOut();
        localStorage.removeItem('tcg_session');
        window.location.href = 'index.html';
    });

    // --- Theme Logic ---
    function initTheme() {
        const savedTheme = localStorage.getItem('tcg_theme') || 'theme-dark';
        applyTheme(savedTheme);
    }

    function applyTheme(theme) {
        $('body').removeClass('theme-light theme-medium theme-dark theme-purple').addClass(theme);
        localStorage.setItem('tcg_theme', theme);
        $('.theme-btn-small').removeClass('active');
        $(`.theme-btn-small[data-theme="${theme}"]`).addClass('active');
    }

    $('.theme-btn-small').click(function() {
        const theme = $(this).data('theme');
        applyTheme(theme);
    });


    // --- Schedule Helper & Slot Management Logic ---
    let scheduleSlots = [];
    let activeScheduleDays = [];

    // Custom Interactive Time Picker Modal Implementation
    if (typeof window.openCustomTimePickerModal !== 'function') {
        window.openCustomTimePickerModal = function(inputElement) {
            const $input = $(inputElement);
            let currentVal = $input.val().trim();

            let selectedHour = "09";
            let selectedMin = "00";
            let selectedMeridiem = "AM";

            if ($input.attr('id') === 'sched-end') {
                selectedHour = "06";
                selectedMin = "00";
                selectedMeridiem = "PM";
            }

            if (currentVal) {
                const match = currentVal.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|A|P)?/i);
                if (match) {
                    let h = parseInt(match[1], 10);
                    if (h >= 1 && h <= 12) selectedHour = String(h).padStart(2, '0');
                    selectedMin = match[2];
                    if (match[3]) {
                        selectedMeridiem = match[3].toUpperCase().startsWith('P') ? 'PM' : 'AM';
                    }
                }
            }

            const hours = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
            const mins = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

            function buildPills(items, selectedVal, type) {
                return items.map(item => {
                    const activeClass = (item === selectedVal) ? 'active' : '';
                    return `<button type="button" class="swal-time-pill ${type}-pill ${activeClass}" data-val="${item}">${item}</button>`;
                }).join('');
            }

            const html = `
                <div class="swal-time-picker-container">
                    <div id="swal-time-preview" style="font-size: 2.2rem; font-weight: 900; color: var(--primary-color, #00f0ff); margin-bottom: 20px; background: rgba(0,0,0,0.5); padding: 12px; border-radius: 16px; border: 2px solid rgba(255,255,255,0.1); text-align: center;">
                        <span id="swal-preview-hour">${selectedHour}</span>:<span id="swal-preview-min">${selectedMin}</span> <span id="swal-preview-meridiem">${selectedMeridiem}</span>
                    </div>

                    <div style="margin-bottom: 15px; text-align: left;">
                        <label style="font-size: 0.75rem; font-weight: 800; color: #888; text-transform: uppercase; display: block; margin-bottom: 8px;">HORA</label>
                        <div class="swal-time-grid" id="swal-hour-grid">
                            ${buildPills(hours, selectedHour, 'hour')}
                        </div>
                    </div>

                    <div style="margin-bottom: 15px; text-align: left;">
                        <label style="font-size: 0.75rem; font-weight: 800; color: #888; text-transform: uppercase; display: block; margin-bottom: 8px;">MINUTOS</label>
                        <div class="swal-time-grid" id="swal-min-grid">
                            ${buildPills(mins, selectedMin, 'min')}
                        </div>
                    </div>

                    <div style="margin-bottom: 10px; text-align: left;">
                        <label style="font-size: 0.75rem; font-weight: 800; color: #888; text-transform: uppercase; display: block; margin-bottom: 8px;">PERIODO</label>
                        <div style="display: flex; gap: 10px;">
                            <button type="button" class="swal-time-pill meridiem-pill ${selectedMeridiem === 'AM' ? 'active' : ''}" data-val="AM" style="flex: 1; padding: 12px; font-size: 1.1rem;">AM</button>
                            <button type="button" class="swal-time-pill meridiem-pill ${selectedMeridiem === 'PM' ? 'active' : ''}" data-val="PM" style="flex: 1; padding: 12px; font-size: 1.1rem;">PM</button>
                        </div>
                    </div>
                </div>
                <style>
                    .swal-time-grid {
                        display: grid;
                        grid-template-columns: repeat(6, 1fr);
                        gap: 8px;
                    }
                    @media (max-width: 480px) {
                        .swal-time-grid {
                            grid-template-columns: repeat(4, 1fr);
                        }
                    }
                    .swal-time-pill {
                        background: rgba(255, 255, 255, 0.05);
                        border: 1px solid rgba(255, 255, 255, 0.15);
                        color: #ffffff;
                        border-radius: 12px;
                        padding: 10px 4px;
                        font-size: 0.95rem;
                        font-weight: 800;
                        cursor: pointer;
                        transition: all 0.2s ease;
                    }
                    .swal-time-pill:hover {
                        background: rgba(255, 255, 255, 0.15);
                    }
                    .swal-time-pill.active {
                        background: var(--primary-color, #00f0ff) !important;
                        border-color: var(--primary-color, #00f0ff) !important;
                        color: #000000 !important;
                        box-shadow: 0 4px 10px rgba(0, 240, 255, 0.3);
                    }
                </style>
            `;

            Swal.fire({
                title: 'AJUSTAR HORA',
                html: html,
                showCancelButton: true,
                confirmButtonText: 'ACEPTAR',
                cancelButtonText: 'CANCELAR',
                confirmButtonColor: 'var(--primary-color, #00f0ff)',
                cancelButtonColor: '#adb5bd',
                didOpen: (el) => {
                    const $popup = $(el);

                    $popup.on('click', '.hour-pill', function() {
                        $popup.find('.hour-pill').removeClass('active');
                        $(this).addClass('active');
                        selectedHour = $(this).data('val');
                        $popup.find('#swal-preview-hour').text(selectedHour);
                    });

                    $popup.on('click', '.min-pill', function() {
                        $popup.find('.min-pill').removeClass('active');
                        $(this).addClass('active');
                        selectedMin = $(this).data('val');
                        $popup.find('#swal-preview-min').text(selectedMin);
                    });

                    $popup.on('click', '.meridiem-pill', function() {
                        $popup.find('.meridiem-pill').removeClass('active');
                        $(this).addClass('active');
                        selectedMeridiem = $(this).data('val');
                        $popup.find('#swal-preview-meridiem').text(selectedMeridiem);
                    });
                }
            }).then((result) => {
                if (result.isConfirmed) {
                    const finalVal = `${selectedHour}:${selectedMin} ${selectedMeridiem}`;
                    $input.val(finalVal).trigger('change');
                }
            });
        };
    }

    $(document).on('click', '.time-picker-simple', function(e) {
        e.preventDefault();
        window.openCustomTimePickerModal(this);
    });

    $('#sched-is-closed').change(function() {
        if ($(this).is(':checked')) {
            $('#sched-start, #sched-end').prop('disabled', true).css('opacity', '0.4');
        } else {
            $('#sched-start, #sched-end').prop('disabled', false).css('opacity', '1');
        }
    });

    function parseHorarioToSlots(horarioStr) {
        if (!horarioStr || !horarioStr.trim()) return [];
        const rawSlots = horarioStr.split(',').map(s => s.trim()).filter(Boolean);
        return rawSlots;
    }

    function renderScheduleSlots() {
        const $container = $('#schedule-slots-container');
        $container.empty();

        if (scheduleSlots.length === 0) {
            $container.html('<div style="font-size:0.85rem; color:#888; font-style:italic;">No hay horarios configurados. Agrega uno usando el panel de abajo.</div>');
            $('#profile-horario').val('');
            return;
        }

        scheduleSlots.forEach((slotText, idx) => {
            $container.append(`
                <div class="sched-slot-badge" data-index="${idx}">
                    <span>${slotText}</span>
                    <i class="fas fa-times btn-remove-slot" title="Eliminar este horario"></i>
                </div>
            `);
        });

        $('#profile-horario').val(scheduleSlots.join(', '));
    }

    // Initialize slots from user profile load
    function initScheduleSlots() {
        const horarioVal = currentUser.horario || '';
        scheduleSlots = parseHorarioToSlots(horarioVal);
        renderScheduleSlots();
    }

    // Hook initScheduleSlots into loadProfileData
    const origLoadProfileData = loadProfileData;
    loadProfileData = function() {
        origLoadProfileData();
        initScheduleSlots();
    };

    $(document).on('click', '.btn-remove-slot', function() {
        const idx = $(this).closest('.sched-slot-badge').data('index');
        scheduleSlots.splice(idx, 1);
        renderScheduleSlots();
    });

    $('.preset-btn').click(function() {
        const preset = $(this).data('preset');
        $('.preset-btn').removeClass('active');
        $(this).addClass('active');
        $('.day-pill').removeClass('active');
        activeScheduleDays = [];

        if (preset === 'Lun - Vie') {
            ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'].forEach(d => {
                $(`.day-pill[data-day="${d}"]`).addClass('active');
                activeScheduleDays.push(d);
            });
        } else if (preset === 'Sáb - Dom') {
            ['Sáb', 'Dom'].forEach(d => {
                $(`.day-pill[data-day="${d}"]`).addClass('active');
                activeScheduleDays.push(d);
            });
        } else if (preset === 'Toda la semana') {
            $('.day-pill').each(function() {
                $(this).addClass('active');
                activeScheduleDays.push($(this).data('day'));
            });
        }
    });

    $(document).on('click', '.day-pill', function() {
        $('.preset-btn').removeClass('active');
        const day = $(this).data('day');
        $(this).toggleClass('active');

        if ($(this).hasClass('active')) {
            if (!activeScheduleDays.includes(day)) activeScheduleDays.push(day);
        } else {
            activeScheduleDays = activeScheduleDays.filter(d => d !== day);
        }
    });

    $('#btn-apply-sched').click(function() {
        if (activeScheduleDays.length === 0) {
            Swal.fire('Atención', 'Por favor, selecciona al menos un día.', 'info');
            return;
        }

        const isClosed = $('#sched-is-closed').is(':checked');
        let timeStr = '';

        if (isClosed) {
            timeStr = 'Cerrado';
        } else {
            const startVal = $('#sched-start').val().trim();
            const endVal = $('#sched-end').val().trim();
            timeStr = `${startVal} - ${endVal}`;
        }

        let daysLabel = '';
        const dayOrder = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
        const sortedDays = activeScheduleDays.sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));

        if (sortedDays.length === 5 && ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'].every(d => sortedDays.includes(d))) {
            daysLabel = 'Lun - Vie';
        } else if (sortedDays.length === 2 && sortedDays.includes('Sáb') && sortedDays.includes('Dom')) {
            daysLabel = 'Sáb - Dom';
        } else if (sortedDays.length === 7) {
            daysLabel = 'Toda la semana';
        } else {
            daysLabel = sortedDays.join(', ');
        }

        const slotText = `${daysLabel} ${timeStr}`;
        scheduleSlots.push(slotText);
        renderScheduleSlots();

        Swal.fire({
            title: '¡Horario Añadido!',
            text: slotText,
            icon: 'success',
            timer: 1500,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
        });
    });
});
