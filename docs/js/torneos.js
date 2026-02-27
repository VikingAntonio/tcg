let currentUser = null;
let currentTournament = null;
let currentParticipants = [];

$(document).ready(async function() {
    await checkSession();

    $('.mgmt-tab').click(function() {
        const target = $(this).data('target');
        $('.mgmt-tab').removeClass('active');
        $(this).addClass('active');
        $('.mgmt-section').removeClass('active');
        $(`#${target}`).addClass('active');
        if (target === 'tab-standings') renderStandingsChart();
    });

    $('#btn-back-to-list').click(() => {
        $('#view-mgmt').hide();
        $('#view-list').show();
        loadTournaments();
    });

    $('#btn-open-create-modal').click(() => {
        resetTournamentModal();
        $('#tournament-modal').addClass('active');
    });

    $('#btn-save-tournament').click(saveTournament);
    $('#btn-save-participant').click(saveParticipant);

    $('#btn-add-participant').click(() => {
        resetParticipantModal();
        $('#participant-modal').addClass('active');
    });

    $('#btn-load-my-decks').click(() => loadUserDecks(currentUser.id));
    $('#btn-generate-round').click(generateNextRound);
    $('#btn-finish-tournament').click(finishTournament);
    $('#mgmt-reg-enabled').change(updateRegistrationStatus);
    $('#btn-delete-tournament').click(() => deleteTournament(currentTournament.id));

    $(document).on('click', '.btn-manage-tournament', function() {
        manageTournament($(this).data('id'));
    });

    $(document).on('click', '.btn-view-deck', function() {
        const deck = $(this).data('deck');
        if (!deck) return Swal.fire('Info', 'Este jugador no proporcionó una decklist.', 'info');

        Swal.fire({
            title: 'Decklist',
            html: `<textarea readonly style="width: 100%; height: 300px; background: #222; color: #fff; padding: 10px; border: 1px solid #444; border-radius: 8px; font-family: monospace;">${deck}</textarea>`,
            confirmButtonText: 'Cerrar',
            footer: `<button class="btn btn-sm" onclick="downloadDecklist(\`${deck.replace(/`/g, '\\`').replace(/\n/g, '\\n')}\`)"><i class="fas fa-download"></i> Descargar .txt</button>`
        });
    });

    $(document).on('click', '.btn-del-p', async function() {
        const id = $(this).data('id');
        if ((await Swal.fire({ title: '¿Eliminar participante?', icon: 'warning', showCancelButton: true })).isConfirmed) {
            await _supabase.from('tournament_participants').delete().eq('id', id);
            loadParticipants(currentTournament.id);
        }
    });
});

window.downloadDecklist = function(content) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'decklist.txt';
    a.click();
    window.URL.revokeObjectURL(url);
};

async function checkSession() {
    const { data: { session } } = await _supabase.auth.getSession();
    if (session) {
        const { data: user } = await _supabase.from('usuarios').select('*').eq('id', session.user.id).single();
        if (user) {
            currentUser = user;
            $('#authenticated-content').show();
            loadTournaments();
        } else window.location.href = 'admin.html';
    } else window.location.href = 'admin.html';
}

async function loadTournaments() {
    const { data: items } = await _supabase.from('tournaments').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
    const $container = $('#tournament-container');
    $container.empty();

    if (!items || items.length === 0) {
        $container.html('<p>No hay torneos creados.</p>');
        return;
    }

    items.forEach(t => {
        $container.append(`
            <div class="tournament-card">
                <h3>${t.name}</h3>
                <div style="font-size: 12px; color: #aaa;"><i class="fas fa-calendar"></i> ${t.event_date ? new Date(t.event_date).toLocaleString() : 'Sin fecha'}</div>
                <div><span class="tournament-status status-${t.status}">${t.status}</span></div>
                <button class="btn btn-manage-tournament" data-id="${t.id}" style="margin-top:10px;">Gestionar</button>
            </div>
        `);
    });
}

async function saveTournament() {
    const id = $('#edit-id').val();
    if (!id) {
        const { count } = await _supabase.from('tournaments').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id);
        if (count >= (currentUser.max_tournaments || 1)) return Swal.fire('Límite', 'Has alcanzado tu límite de torneos', 'warning');
    }

    const data = {
        user_id: currentUser.id,
        name: $('#input-name').val().trim(),
        tcg: $('#input-tcg').val(),
        event_date: $('#input-date').val(),
        max_participants: parseInt($('#input-max').val()),
        description: $('#input-desc').val()
    };

    let res = id ? await _supabase.from('tournaments').update(data).eq('id', id) : await _supabase.from('tournaments').insert([data]);
    if (res.error) Swal.fire('Error', res.error.message, 'error');
    else {
        $('#tournament-modal').removeClass('active');
        loadTournaments();
    }
}

async function manageTournament(id) {
    const { data: t } = await _supabase.from('tournaments').select('*').eq('id', id).single();
    currentTournament = t;
    $('#mgmt-name').text(t.name);
    $('#mgmt-status-badge').html(`<span class="tournament-status status-${t.status}">${t.status}</span>`);
    $('#mgmt-reg-enabled').prop('checked', t.registration_enabled);

    const identifier = currentUser.is_store ? `store=${encodeURIComponent(currentUser.store_name)}` : `user=${encodeURIComponent(currentUser.username)}`;
    $('#mgmt-link').val(`${window.location.origin}${window.location.pathname.replace('torneos.html', 'public.html')}?${identifier}&view=events&tid=${t.id}`);
    $('#link-container').toggle(t.registration_enabled);

    loadParticipants(id);
    loadRounds(id);
    $('#view-list').hide();
    $('#view-mgmt').show();
}

async function loadParticipants(tId) {
    const { data: ps } = await _supabase.from('tournament_participants').select('*').eq('tournament_id', tId).order('points', { ascending: false });
    currentParticipants = ps || [];
    $('#participant-count').text(currentParticipants.length);
    const $list = $('#participant-list');
    $list.empty();
    currentParticipants.forEach(p => {
        $list.append(`
            <tr>
                <td>${p.name}</td>
                <td>${p.deck_name || '-'}</td>
                <td>${p.player_id || '-'}</td>
                <td><strong>${p.points}</strong></td>
                <td>
                    <button class="btn btn-sm btn-secondary btn-view-deck" data-deck="${(p.deck_list || '').replace(/"/g, '&quot;')}"><i class="fas fa-eye"></i></button>
                    <button class="btn btn-sm btn-danger btn-del-p" data-id="${p.id}"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `);
    });
    updateStandingsTable();
}

async function saveParticipant() {
    const data = {
        tournament_id: currentTournament.id,
        name: $('#p-name').val().trim(),
        deck_name: $('#p-deck-name').val().trim(),
        player_id: $('#p-player-id').val().trim(),
        deck_list: $('#p-deck-list').val()
    };
    await _supabase.from('tournament_participants').insert([data]);
    $('#participant-modal').removeClass('active');
    loadParticipants(currentTournament.id);
}

async function generateNextRound() {
    if (currentParticipants.length < 2) return Swal.fire('Error', 'Mínimo 2 jugadores', 'info');
    const { data: rounds } = await _supabase.from('tournament_matches').select('round').eq('tournament_id', currentTournament.id).order('round', { ascending: false }).limit(1);
    const nextRound = (rounds && rounds.length > 0) ? rounds[0].round + 1 : 1;
    let sorted = [...currentParticipants].sort((a, b) => b.points - a.points);
    let matches = [];
    for (let i = 0; i < sorted.length; i += 2) {
        if (i + 1 < sorted.length) {
            matches.push({ tournament_id: currentTournament.id, round: nextRound, player1_id: sorted[i].id, player2_id: sorted[i + 1].id });
        } else {
            matches.push({ tournament_id: currentTournament.id, round: nextRound, player1_id: sorted[i].id, player2_id: null, result: 'p1_win' });
        }
    }
    await _supabase.from('tournament_matches').insert(matches);
    if (currentTournament.status === 'planned') await _supabase.from('tournaments').update({ status: 'active' }).eq('id', currentTournament.id);
    loadRounds(currentTournament.id);
}

async function loadRounds(tId) {
    const { data: ms } = await _supabase.from('tournament_matches').select('*, p1:player1_id(name), p2:player2_id(name)').eq('tournament_id', tId).order('round', { ascending: false });
    const $container = $('#rounds-container');
    $container.empty();
    const rounds = {};
    ms?.forEach(m => { if(!rounds[m.round]) rounds[m.round] = []; rounds[m.round].push(m); });
    Object.keys(rounds).sort((a,b)=>b-a).forEach(r => {
        const $rDiv = $(`<div><h3>Ronda ${r}</h3></div>`);
        rounds[r].forEach(m => {
            $rDiv.append(`
                <div class="match-card">
                    <span>${m.p1?.name || 'BYE'} VS ${m.p2?.name || 'BYE'}</span>
                    <select class="res-sel" data-id="${m.id}">
                        <option value="pending" ${m.result==='pending'?'selected':''}>Pendiente</option>
                        <option value="p1_win" ${m.result==='p1_win'?'selected':''}>Gana P1</option>
                        <option value="p2_win" ${m.result==='p2_win'?'selected':''}>Gana P2</option>
                        <option value="draw" ${m.result==='draw'?'selected':''}>Empate</option>
                    </select>
                </div>
            `);
        });
        $container.append($rDiv);
    });
    $('.res-sel').change(async function() {
        await _supabase.from('tournament_matches').update({ result: $(this).val() }).eq('id', $(this).data('id'));
        recalculatePoints();
    });
}

async function recalculatePoints() {
    const points = {};
    currentParticipants.forEach(p => points[p.id] = 0);
    const { data: ms } = await _supabase.from('tournament_matches').select('*').eq('tournament_id', currentTournament.id);
    ms?.forEach(m => {
        if(m.result === 'p1_win' && m.player1_id) points[m.player1_id] += 3;
        if(m.result === 'p2_win' && m.player2_id) points[m.player2_id] += 3;
        if(m.result === 'draw') { if(m.player1_id) points[m.player1_id] += 1; if(m.player2_id) points[m.player2_id] += 1; }
    });
    for(const id in points) await _supabase.from('tournament_participants').update({ points: points[id] }).eq('id', id);
    loadParticipants(currentTournament.id);
}

function updateStandingsTable() {
    const $list = $('#standings-list'); $list.empty();
    [...currentParticipants].sort((a,b)=>b.points - a.points).forEach((p, i) => {
        $list.append(`<tr><td>${i+1}</td><td>${p.name}</td><td>${p.points}</td></tr>`);
    });
}

function renderStandingsChart() {
    const canvas = document.getElementById('standings-canvas');
    const ctx = canvas.getContext('2d');
    const sorted = [...currentParticipants].sort((a,b)=>b.points-a.points).slice(0, 5);
    ctx.clearRect(0,0, canvas.width, canvas.height);
    sorted.forEach((p, i) => {
        ctx.fillStyle = i === 0 ? '#f1c40f' : '#3498db';
        ctx.fillRect(50 + i*60, 250 - p.points*10, 40, p.points*10);
        ctx.fillStyle = 'white';
        ctx.fillText(p.name.substring(0, 5), 50 + i*60, 270);
    });
}

async function updateRegistrationStatus() {
    await _supabase.from('tournaments').update({ registration_enabled: $(this).is(':checked') }).eq('id', currentTournament.id);
}

async function finishTournament() {
    await _supabase.from('tournaments').update({ status: 'finished' }).eq('id', currentTournament.id);
    loadTournaments();
}

async function deleteTournament(id) {
    if ((await Swal.fire({ title: '¿Eliminar?', icon: 'warning', showCancelButton: true })).isConfirmed) {
        await _supabase.from('tournaments').delete().eq('id', id);
        $('#btn-back-to-list').click();
    }
}

async function loadUserDecks(uId) {
    const { data: decks } = await _supabase.from('decks').select('id, name').eq('user_id', uId);
    const $cont = $('#user-deck-list'); $cont.empty();
    decks?.forEach(d => {
        const $b = $(`<button class="btn btn-secondary">${d.name}</button>`);
        $b.click(async () => {
            const { data: cs } = await _supabase.from('deck_cards').select('name, quantity').eq('deck_id', d.id);
            $('#p-deck-name').val(d.name);
            $('#p-deck-list').val(cs.map(c => `${c.quantity}x ${c.name}`).join('\n'));
            $('#deck-select-modal').removeClass('active');
        });
        $cont.append($b);
    });
    $('#deck-select-modal').addClass('active');
}

function resetTournamentModal() { $('#edit-id').val(''); $('#input-name').val(''); }
function resetParticipantModal() { $('#p-edit-id').val(''); $('#p-name').val(''); }
