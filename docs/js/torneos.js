let currentUser = null;
let currentTournament = null;
let currentParticipants = [];

$(document).ready(async function() {
    await checkSession();

    // Navigation & Tabs
    $('.mgmt-tab').click(function() {
        const target = $(this).data('target');
        $('.mgmt-tab').removeClass('active');
        $(this).addClass('active');
        $('.mgmt-section').removeClass('active');
        $(`#${target}`).addClass('active');
        if (target === 'tab-standings') renderStandingsChart();
    });

    $('#btn-back-to-list').click(() => {
        $('#view-tournament-mgmt').hide();
        $('#view-tournament-list').show();
        loadTournaments();
    });

    // Tournament Modal
    $('#btn-open-create-modal').click(() => {
        resetTournamentModal();
        $('#tournament-modal').addClass('active');
    });

    $('#close-modal').click(() => $('#tournament-modal').removeClass('active'));

    $('#btn-save-tournament').click(saveTournament);

    // Participant Modal
    $('#btn-add-participant').click(() => {
        resetParticipantModal();
        $('#participant-modal').addClass('active');
    });

    $('#close-p-modal').click(() => $('#participant-modal').removeClass('active'));

    $('#btn-save-participant').click(saveParticipant);

    // Deck Loading Logic
    $('#btn-load-user-deck').click(() => loadUserDecks(currentUser.id));
    $('#btn-load-customer-deck').click(function() {
        const userId = $(this).data('user-id');
        if (userId) loadUserDecks(userId);
    });
    $('#close-ds-modal').click(() => $('#deck-select-modal').removeClass('active'));

    $('#btn-search-user').click(searchUser);
    $('#p-user-search').keypress(function(e) { if (e.which == 13) searchUser(); });

    // Config Actions
    $('#mgmt-registration-enabled').change(updateRegistrationStatus);
    $('#btn-copy-mgmt-link').click(copyPublicLink);
    $('#btn-edit-tournament-meta').click(() => {
        populateTournamentModal(currentTournament);
        $('#tournament-modal').addClass('active');
    });
    $('#btn-delete-tournament').click(() => deleteTournament(currentTournament.id));

    // Round Logic
    $('#btn-generate-round').click(generateNextRound);
    $('#btn-finish-tournament').click(finishTournament);

    // UI Events
    $(document).on('click', '.btn-manage-tournament', function() {
        const tId = $(this).data('id');
        manageTournament(tId);
    });

    $(document).on('click', '#avatar-btn', function(e) {
        e.stopPropagation();
        $('#user-dropdown').toggleClass('active');
    });

    $('#menu-btn-logout').click(async (e) => {
        e.preventDefault();
        await _supabase.auth.signOut();
        window.location.href = 'admin.html';
    });
});

async function checkSession() {
    const { data: { session } } = await _supabase.auth.getSession();
    if (session) {
        const { data: user } = await _supabase
            .from('usuarios')
            .select('*')
            .eq('id', session.user.id)
            .single();

        if (user) {
            currentUser = user;
            $('#dropdown-user-name').text(user.username);
            $('#top-panel, #authenticated-content').show();
            loadTournaments();
        } else {
            window.location.href = 'admin.html';
        }
    } else {
        window.location.href = 'admin.html';
    }
}

async function loadTournaments() {
    $('#tournament-container').html('<div class="loading">Cargando torneos...</div>');
    const { data: items, error } = await _supabase
        .from('tournaments')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (error) {
        $('#tournament-container').html('<div class="error">Error al cargar datos.</div>');
        return;
    }

    if (!items || items.length === 0) {
        $('#tournament-container').html('<div class="empty">No tienes torneos creados.</div>');
        return;
    }

    $('#tournament-container').empty();
    items.forEach(t => {
        const $card = $(`
            <div class="tournament-card">
                <h3>${t.name}</h3>
                <div style="font-size: 12px; color: #aaa;">${t.tcg.toUpperCase()} | ${t.tournament_type.replace('_', ' ')}</div>
                <div><span class="tournament-status status-${t.status}">${t.status.toUpperCase()}</span></div>
                <button class="btn btn-manage-tournament" data-id="${t.id}" style="margin-top: 10px;">Gestionar</button>
            </div>
        `);
        $('#tournament-container').append($card);
    });
}

async function saveTournament() {
    const id = $('#edit-id').val();
    if (!id) {
        const { count } = await _supabase.from('tournaments').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id);
        if (count >= (currentUser.max_tournaments || 1)) {
            Swal.fire('Límite alcanzado', `Tu plan permite máximo ${currentUser.max_tournaments || 1} torneo(s).`, 'warning');
            return;
        }
    }

    const data = {
        user_id: currentUser.id,
        name: $('#input-name').val().trim(),
        tcg: $('#input-tcg').val(),
        tournament_type: $('#input-type').val(),
        max_participants: parseInt($('#input-max').val()) || 32,
        description: $('#input-description').val().trim()
    };

    if (!data.name) return Swal.fire('Error', 'El nombre es obligatorio', 'warning');

    let res;
    if (id) res = await _supabase.from('tournaments').update(data).eq('id', id);
    else res = await _supabase.from('tournaments').insert([data]);

    if (res.error) Swal.fire('Error', res.error.message, 'error');
    else {
        Swal.fire('Guardado', 'Torneo guardado correctamente', 'success');
        $('#tournament-modal').removeClass('active');
        if (id) manageTournament(id); else loadTournaments();
    }
}

async function manageTournament(id) {
    const { data: t } = await _supabase.from('tournaments').select('*').eq('id', id).single();
    if (!t) return;

    currentTournament = t;
    $('#mgmt-tournament-name').text(t.name);
    $('#mgmt-tournament-status-badge').html(`<span class="tournament-status status-${t.status}">${t.status.toUpperCase()}</span>`);
    $('#mgmt-registration-enabled').prop('checked', t.registration_enabled);

    // Generate public link
    const identifier = currentUser.is_store ? `store=${encodeURIComponent(currentUser.store_name)}` : `user=${encodeURIComponent(currentUser.username)}`;
    const publicUrl = `${window.location.origin}${window.location.pathname.replace('torneos.html', 'public.html')}?${identifier}&view=tournaments&tid=${t.id}`;
    $('#mgmt-public-link').val(publicUrl);
    $('#registration-link-container').toggle(t.registration_enabled);

    loadParticipants(id);
    loadRounds(id);

    $('#view-tournament-list').hide();
    $('#view-tournament-mgmt').show();
}

async function loadParticipants(tId) {
    const { data: participants } = await _supabase.from('tournament_participants').select('*').eq('tournament_id', tId).order('points', { ascending: false });
    currentParticipants = participants || [];
    $('#participant-count').text(currentParticipants.length);
    const $list = $('#participant-list');
    $list.empty();

    currentParticipants.forEach(p => {
        const $row = $(`
            <tr>
                <td>${p.name}</td>
                <td><a href="#" class="view-deck-list" data-list="${encodeURIComponent(p.deck_list || '')}">${p.deck_name || 'Sin Deck'}</a></td>
                <td>${p.player_id || '-'}</td>
                <td><strong>${p.points}</strong></td>
                <td>
                    <button class="btn btn-sm btn-secondary btn-edit-p" data-id="${p.id}"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger btn-delete-p" data-id="${p.id}"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `);
        $list.append($row);
    });

    $('.view-deck-list').click(function(e) {
        e.preventDefault();
        const list = decodeURIComponent($(this).data('list'));
        Swal.fire({
            title: 'Decklist',
            html: `
                <div class="deck-list-popup">
                    <pre id="deck-list-text">${list || 'Lista vacía'}</pre>
                </div>
                <button class="btn btn-sm" onclick="copyDeckList()" style="margin-top: 15px; width: 100%;">
                    <i class="fas fa-copy"></i> Copiar al Portapapeles
                </button>
            `,
            showConfirmButton: false,
            showCloseButton: true
        });
    });

    window.copyDeckList = function() {
        const text = document.getElementById('deck-list-text').innerText;
        navigator.clipboard.writeText(text);
        Swal.fire({ title: 'Copiado', icon: 'success', timer: 1000, showConfirmButton: false, toast: true, position: 'top-end' });
    };

    $(document).on('click', '.btn-edit-p', function() {
        const pId = $(this).data('id');
        const p = currentParticipants.find(part => part.id === pId);
        populateParticipantModal(p);
    });

    $(document).on('click', '.btn-delete-p', async function() {
        const pId = $(this).data('id');
        const { isConfirmed } = await Swal.fire({ title: '¿Eliminar?', text: 'Se quitará al jugador del torneo', icon: 'warning', showCancelButton: true });
        if (isConfirmed) {
            await _supabase.from('tournament_participants').delete().eq('id', pId);
            loadParticipants(tId);
        }
    });

    updateStandingsTable();
}

async function saveParticipant() {
    const id = $('#p-edit-id').val();
    const data = {
        tournament_id: currentTournament.id,
        name: $('#p-name').val().trim(),
        deck_name: $('#p-deck-name').val().trim(),
        player_id: $('#p-player-id').val().trim(),
        deck_list: $('#p-deck-list').val().trim()
    };

    if (!data.name) return Swal.fire('Error', 'El nombre es obligatorio', 'warning');

    let res;
    if (id) res = await _supabase.from('tournament_participants').update(data).eq('id', id);
    else res = await _supabase.from('tournament_participants').insert([data]);

    if (res.error) Swal.fire('Error', res.error.message, 'error');
    else {
        $('#participant-modal').removeClass('active');
        loadParticipants(currentTournament.id);
    }
}

async function searchUser() {
    const query = $('#p-user-search').val().trim();
    if (query.length < 3) return Swal.fire('Info', 'Escribe al menos 3 letras', 'info');

    const { data: users } = await _supabase.from('usuarios').select('id, username').ilike('username', `%${query}%`).limit(5);
    const $results = $('#user-search-results');
    $results.empty().show();

    if (!users || users.length === 0) {
        $results.append('<div style="padding: 10px; color: #666;">No se encontraron usuarios</div>');
    } else {
        users.forEach(u => {
            const $div = $(`<div style="padding: 10px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.05);">${u.username}</div>`);
            $div.click(() => {
                $('#p-name').val(u.username);
                $('#btn-load-customer-deck').data('user-id', u.id).show();
                $results.hide();
            });
            $results.append($div);
        });
    }
}

async function loadUserDecks(userId) {
    const { data: decks } = await _supabase.from('decks').select('id, name').eq('user_id', userId);
    const $container = $('#user-deck-list');
    $container.empty();

    if (!decks || decks.length === 0) {
        $container.append('<p style="color: #aaa;">No hay decks disponibles para este usuario.</p>');
    } else {
        decks.forEach(d => {
            const $btn = $(`<button class="btn btn-secondary" style="text-align: left;">${d.name}</button>`);
            $btn.click(() => fetchDeckDetails(d.id, d.name));
            $container.append($btn);
        });
    }
    $('#deck-select-modal').addClass('active');
}

async function fetchDeckDetails(deckId, deckName) {
    const { data: cards } = await _supabase.from('deck_cards').select('name, quantity').eq('deck_id', deckId);
    let listStr = "";
    if (cards) {
        cards.forEach(c => {
            listStr += `${c.quantity}x ${c.name}\n`;
        });
    }
    $('#p-deck-name').val(deckName);
    $('#p-deck-list').val(listStr);
    $('#deck-select-modal').removeClass('active');
}

async function updateRegistrationStatus() {
    const enabled = $(this).is(':checked');
    await _supabase.from('tournaments').update({ registration_enabled: enabled }).eq('id', currentTournament.id);
    $('#registration-link-container').toggle(enabled);
}

function copyPublicLink() {
    const input = document.getElementById('mgmt-public-link');
    input.select();
    navigator.clipboard.writeText(input.value);
    Swal.fire({ title: 'Copiado', icon: 'success', timer: 1000, showConfirmButton: false, toast: true, position: 'top-end' });
}

async function generateNextRound() {
    if (currentParticipants.length < 2) return Swal.fire('Error', 'Se necesitan al menos 2 participantes', 'warning');

    const { data: rounds } = await _supabase.from('tournament_matches').select('round').eq('tournament_id', currentTournament.id).order('round', { ascending: false }).limit(1);
    const nextRound = (rounds && rounds.length > 0) ? rounds[0].round + 1 : 1;

    // Pairing Logic (Simple Swiss: sorted by points)
    let sorted = [...currentParticipants].sort((a, b) => b.points - a.points);
    let matches = [];

    for (let i = 0; i < sorted.length; i += 2) {
        if (i + 1 < sorted.length) {
            matches.push({
                tournament_id: currentTournament.id,
                round: nextRound,
                player1_id: sorted[i].id,
                player2_id: sorted[i + 1].id
            });
        } else {
            // BYE
            matches.push({
                tournament_id: currentTournament.id,
                round: nextRound,
                player1_id: sorted[i].id,
                player2_id: null,
                result: 'p1_win'
            });
        }
    }

    const { error } = await _supabase.from('tournament_matches').insert(matches);
    if (error) Swal.fire('Error', error.message, 'error');
    else {
        if (currentTournament.status === 'planned') {
            await _supabase.from('tournaments').update({ status: 'active' }).eq('id', currentTournament.id);
            currentTournament.status = 'active';
            $('#mgmt-tournament-status-badge').html(`<span class="tournament-status status-active">ACTIVE</span>`);
        }
        loadRounds(currentTournament.id);
        Swal.fire('Ronda ' + nextRound, 'Emparejamientos generados', 'success');
    }
}

async function loadRounds(tId) {
    const { data: matches } = await _supabase.from('tournament_matches').select('*, p1:player1_id(name), p2:player2_id(name)').eq('tournament_id', tId).order('round', { ascending: false });
    const $container = $('#rounds-container');
    $container.empty();

    if (!matches || matches.length === 0) {
        $container.append('<p style="color: #aaa;">No hay rondas generadas.</p>');
        return;
    }

    const rounds = {};
    matches.forEach(m => {
        if (!rounds[m.round]) rounds[m.round] = [];
        rounds[m.round].push(m);
    });

    Object.keys(rounds).sort((a, b) => b - a).forEach(rNum => {
        const $rDiv = $(`<div style="margin-bottom: 30px;"><h3>Ronda ${rNum}</h3></div>`);
        rounds[rNum].forEach(m => {
            const p1Name = m.p1 ? m.p1.name : 'Unknown';
            const p2Name = m.p2 ? m.p2.name : 'BYE';
            const $mCard = $(`
                <div class="match-card">
                    <div style="flex: 1; text-align: right;"><strong>${p1Name}</strong></div>
                    <div style="margin: 0 20px;">VS</div>
                    <div style="flex: 1; text-align: left;"><strong>${p2Name}</strong></div>
                    <div style="margin-left: 20px;">
                        <select class="match-result-select" data-id="${m.id}" ${m.p2 ? '' : 'disabled'}>
                            <option value="pending" ${m.result === 'pending' ? 'selected' : ''}>Pendiente</option>
                            <option value="p1_win" ${m.result === 'p1_win' ? 'selected' : ''}>Gana P1</option>
                            <option value="p2_win" ${m.result === 'p2_win' ? 'selected' : ''}>Gana P2</option>
                            <option value="draw" ${m.result === 'draw' ? 'selected' : ''}>Empate</option>
                        </select>
                    </div>
                </div>
            `);
            $rDiv.append($mCard);
        });
        $container.append($rDiv);
    });

    $('.match-result-select').change(async function() {
        const mId = $(this).data('id');
        const res = $(this).val();
        await updateMatchResult(mId, res);
    });
}

async function updateMatchResult(matchId, result) {
    const { error } = await _supabase.from('tournament_matches').update({ result }).eq('id', matchId);
    if (!error) {
        recalculatePoints();
    }
}

async function recalculatePoints() {
    // 1. Reset points
    const pIds = currentParticipants.map(p => p.id);
    const participantPoints = {};
    pIds.forEach(id => participantPoints[id] = 0);

    // 2. Fetch all matches
    const { data: matches } = await _supabase.from('tournament_matches').select('*').eq('tournament_id', currentTournament.id);

    matches.forEach(m => {
        if (m.result === 'p1_win') {
            if (m.player1_id) participantPoints[m.player1_id] += 3;
        } else if (m.result === 'p2_win') {
            if (m.player2_id) participantPoints[m.player2_id] += 3;
        } else if (m.result === 'draw') {
            if (m.player1_id) participantPoints[m.player1_id] += 1;
            if (m.player2_id) participantPoints[m.player2_id] += 1;
        }
    });

    // 3. Update DB
    for (const pId in participantPoints) {
        await _supabase.from('tournament_participants').update({ points: participantPoints[pId] }).eq('id', pId);
    }
    loadParticipants(currentTournament.id);
}

function updateStandingsTable() {
    const $list = $('#standings-list');
    $list.empty();
    const sorted = [...currentParticipants].sort((a, b) => b.points - a.points);
    sorted.forEach((p, idx) => {
        const $row = $(`
            <tr class="${idx < 3 ? 'top-rank' : ''}">
                <td>${idx + 1}</td>
                <td>${p.name}</td>
                <td><strong>${p.points}</strong></td>
                <td>${p.tiebreak_score || '0.00'}</td>
            </tr>
        `);
        $list.append($row);
    });
}

function renderStandingsChart() {
    const canvas = document.getElementById('standings-canvas');
    if (!canvas) return;

    // Auto-resize canvas to match its displayed size
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    const sorted = [...currentParticipants].sort((a, b) => b.points - a.points).slice(0, 10);
    if (sorted.length === 0) {
        ctx.fillStyle = '#666';
        ctx.textAlign = 'center';
        ctx.fillText('Esperando participantes...', width / 2, height / 2);
        return;
    }

    ctx.clearRect(0, 0, width, height);

    const margin = { top: 40, right: 20, bottom: 60, left: 40 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const maxPoints = Math.max(...sorted.map(p => p.points), 1);
    const barGap = 15;
    const barWidth = (chartWidth / sorted.length) - barGap;

    // Draw grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
        const y = margin.top + (chartHeight / 5) * i;
        ctx.beginPath();
        ctx.moveTo(margin.left, y);
        ctx.lineTo(width - margin.right, y);
        ctx.stroke();
    }

    sorted.forEach((p, i) => {
        const x = margin.left + i * (barWidth + barGap);
        const bHeight = (p.points / maxPoints) * chartHeight;
        const y = height - margin.bottom - bHeight;

        // Gradient for bars
        const grad = ctx.createLinearGradient(x, y, x, height - margin.bottom);
        if (i === 0) {
            grad.addColorStop(0, '#f1c40f');
            grad.addColorStop(1, '#d4ac0d');
        } else if (i === 1) {
            grad.addColorStop(0, '#bdc3c7');
            grad.addColorStop(1, '#95a5a6');
        } else if (i === 2) {
            grad.addColorStop(0, '#e67e22');
            grad.addColorStop(1, '#d35400');
        } else {
            grad.addColorStop(0, '#3498db');
            grad.addColorStop(1, '#2980b9');
        }

        // Draw Bar with rounded corners
        ctx.fillStyle = grad;
        const radius = 8;
        ctx.beginPath();
        ctx.moveTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.lineTo(x + barWidth - radius, y);
        ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
        ctx.lineTo(x + barWidth, height - margin.bottom);
        ctx.lineTo(x, height - margin.bottom);
        ctx.closePath();
        ctx.fill();

        // Shadow
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 5;

        // Labels
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px Montserrat';
        ctx.textAlign = 'center';
        ctx.fillText(p.points, x + barWidth / 2, y - 10);

        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '10px Montserrat';
        ctx.save();
        ctx.translate(x + barWidth / 2, height - margin.bottom + 20);
        ctx.rotate(-Math.PI / 4);
        ctx.fillText(p.name.length > 10 ? p.name.substring(0, 8) + '..' : p.name, 0, 0);
        ctx.restore();
    });
}

async function finishTournament() {
    const { isConfirmed } = await Swal.fire({ title: '¿Finalizar Torneo?', text: 'No se podrán generar más rondas', icon: 'question', showCancelButton: true });
    if (isConfirmed) {
        await _supabase.from('tournaments').update({ status: 'finished' }).eq('id', currentTournament.id);
        currentTournament.status = 'finished';
        $('#mgmt-tournament-status-badge').html(`<span class="tournament-status status-finished">FINISHED</span>`);
        Swal.fire('Torneo Finalizado', 'Los resultados han sido guardados', 'success');
    }
}

async function deleteTournament(id) {
    const { isConfirmed } = await Swal.fire({ title: '¿Eliminar Torneo?', text: 'Se borrarán todos los datos asociados permanentemente', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ff4757' });
    if (isConfirmed) {
        await _supabase.from('tournaments').delete().eq('id', id);
        $('#view-tournament-mgmt').hide();
        $('#view-tournament-list').show();
        loadTournaments();
    }
}

function resetTournamentModal() {
    $('#edit-id').val('');
    $('#input-name').val('');
    $('#input-max').val(32);
    $('#input-description').val('');
    $('#modal-title').text('Nuevo Torneo');
}

function populateTournamentModal(t) {
    $('#edit-id').val(t.id);
    $('#input-name').val(t.name);
    $('#input-tcg').val(t.tcg);
    $('#input-type').val(t.tournament_type);
    $('#input-max').val(t.max_participants);
    $('#input-description').val(t.description);
    $('#modal-title').text('Editar Torneo');
}

function resetParticipantModal() {
    $('#p-edit-id').val('');
    $('#p-name').val('');
    $('#p-deck-name').val('');
    $('#p-player-id').val('');
    $('#p-deck-list').val('');
    $('#p-user-search').val('');
    $('#user-search-results').empty().hide();
    $('#btn-load-customer-deck').hide();
}

function populateParticipantModal(p) {
    $('#p-edit-id').val(p.id);
    $('#p-name').val(p.name);
    $('#p-deck-name').val(p.deck_name);
    $('#p-player-id').val(p.player_id);
    $('#p-deck-list').val(p.deck_list);
    $('#participant-modal').addClass('active');
}
