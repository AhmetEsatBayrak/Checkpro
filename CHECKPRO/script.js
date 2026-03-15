// --- VERİTABANI VE GLOBAL DEĞİŞKENLER ---
let db = JSON.parse(localStorage.getItem('checkpro_db')) || {
    lists: [], 
    trash: [], 
    theme: 'theme-dark',
    soundEnabled: true,
    activeSounds: {
        task: "https://assets.mixkit.co/active_storage/sfx/1114/1114-preview.mp3",
        delete: "https://assets.mixkit.co/active_storage/sfx/1105/1105-preview.mp3",
        finish: "https://assets.mixkit.co/active_storage/sfx/2020/2020-preview.mp3"
    }
};

let activeId = null;
let activeNoteIndex = 0;
let lastDeletedItem = null; 
let undoType = null; 
let undoTimeout = null;

const save = () => localStorage.setItem('checkpro_db', JSON.stringify(db));

// --- SES SİSTEMİ ---
const playSound = (type) => { 
    if(db.soundEnabled && db.activeSounds[type]) {
        const audio = new Audio(db.activeSounds[type]);
        audio.volume = 0.4;
        audio.play().catch(() => console.warn("Ses dosyası çalınamadı."));
    }
};

function uploadSound(type, input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        db.activeSounds[type] = e.target.result;
        save();
        alert(type.toUpperCase() + " sesi güncellendi!");
    };
    reader.readAsDataURL(file);
}

function toggleSoundMaster(enabled) {
    db.soundEnabled = enabled;
    const controls = document.getElementById('soundControls');
    if (enabled) controls.classList.remove('opacity-50', 'pointer-events-none');
    else controls.classList.add('opacity-50', 'pointer-events-none');
    save();
}

function syncSettingsUI() {
    document.getElementById('soundToggle').checked = db.soundEnabled;
    toggleSoundMaster(db.soundEnabled);
}

// --- GERİ ALMA SİSTEMİ ---
function showUndoToast(item, type, message) {
    lastDeletedItem = item; undoType = type;
    const toast = document.getElementById('undoToast');
    document.getElementById('undoMessage').innerText = message;
    clearTimeout(undoTimeout);
    toast.classList.remove('translate-y-20', 'opacity-0', 'undo-active');
    void toast.offsetWidth;
    toast.classList.add('translate-y-0', 'opacity-100', 'pointer-events-auto', 'undo-active');
    undoTimeout = setTimeout(() => hideUndoToast(), 5000);
}

function hideUndoToast() {
    const toast = document.getElementById('undoToast');
    toast.classList.add('translate-y-20', 'opacity-0');
    toast.classList.remove('translate-y-0', 'opacity-100', 'pointer-events-auto', 'undo-active');
}

function undoDelete() {
    if (!lastDeletedItem || !activeId) return;
    const list = db.lists.find(l => l.id === activeId);
    if (undoType === 'task') list.tasks.unshift(lastDeletedItem);
    else if (undoType === 'row') list.table.push(lastDeletedItem);
    else if (undoType === 'gallery') list.gallery.push(lastDeletedItem);
    hideUndoToast(); render();
}

// --- ANA RENDER ---
function render() {
    save();
    document.getElementById('mainBody').className = 'flex flex-col md:flex-row h-screen ' + db.theme;
    document.getElementById('trashCount').innerText = db.trash.length;
    
    const sidebar = document.getElementById('sidebarList');
    sidebar.innerHTML = '';
    db.lists.forEach(l => {
        sidebar.innerHTML += `<div onclick="selectList(${l.id})" class="sidebar-item flex justify-between items-center p-4 rounded-xl cursor-pointer mb-1 transition-all ${activeId === l.id ? 'active' : 'hover:bg-white/5 opacity-60'}">
            <span class="text-sm font-black truncate uppercase tracking-tighter">${l.title}</span>
            <span class="text-[9px] opacity-30">${l.tasks ? l.tasks.length : 0}</span>
        </div>`;
    });

    if (activeId) {
        const list = db.lists.find(l => l.id === activeId);
        if(!list) return;
        document.getElementById('currentListTitle').innerText = list.title;
        const comp = list.tasks.filter(t => t.completed).length;
        const per = list.tasks.length ? Math.round((comp / list.tasks.length) * 100) : 0;
        document.getElementById('progressBar').style.width = per + '%';
        document.getElementById('progressText').innerText = per + '% TAMAMLANDI';

        const taskContainer = document.getElementById('taskList');
        taskContainer.innerHTML = '';
        list.tasks.forEach(t => {
            taskContainer.innerHTML += `<div data-id="${t.id}" class="todo-item flex items-center justify-between p-4 rounded-2xl glass border-white/5 group">
                <div class="flex items-center gap-3 flex-1">
                    <i class="fas fa-grip-vertical drag-handle opacity-10 text-xs"></i>
                    <div class="cursor-pointer flex items-center gap-4 flex-1" onclick="toggleTask(${t.id})">
                        <div class="w-5 h-5 rounded-lg border-2 border-indigo-500 flex items-center justify-center ${t.completed ? 'bg-indigo-500 border-indigo-500' : ''}">
                            ${t.completed ? '<i class="fas fa-check text-[8px] text-white"></i>' : ''}
                        </div>
                        <span class="text-sm font-bold ${t.completed ? 'line-through opacity-20' : ''}">${t.text}</span>
                    </div>
                </div>
                <button onclick="deleteTaskItem(${t.id})" class="opacity-0 group-hover:opacity-100 text-red-500 transition-all px-2"><i class="fas fa-times"></i></button>
            </div>`;
        });

        const tableBody = document.getElementById('tableBody');
        tableBody.innerHTML = '';
        list.table.forEach((row, i) => {
            tableBody.innerHTML += `<tr class="border-b border-white/5 group" data-index="${i}">
                <td class="w-8 text-center"><i class="fas fa-grip-vertical opacity-5 drag-handle-row text-[10px]"></i></td>
                <td><input oninput="updateTable(${i},'c1',this.value)" value="${row.c1}" class="w-full bg-transparent p-3 outline-none" placeholder="..."></td>
                <td><input oninput="updateTable(${i},'c2',this.value)" value="${row.c2}" class="w-full bg-transparent p-3 outline-none" placeholder="..."></td>
                <td class="text-center w-10"><button onclick="deleteRow(${i})" class="opacity-0 group-hover:opacity-100 text-red-500 p-2">×</button></td>
            </tr>`;
        });

        const galleryGrid = document.getElementById('galleryGrid');
        galleryGrid.innerHTML = '';
        if(!list.gallery) list.gallery = [];
        list.gallery.forEach((imgSrc, i) => {
            galleryGrid.innerHTML += `<div class="gallery-item group">
                <button onclick="event.stopPropagation(); deleteGalleryItem(${i})" class="gallery-delete-btn"><i class="fas fa-trash-alt"></i></button>
                <img src="${imgSrc}" onclick="openLightbox('${imgSrc}')" loading="lazy">
            </div>`;
        });
        renderNotes();
    }
}

// --- LİSTE İŞLEMLERİ ---
function selectList(id) { 
    activeId = id; activeNoteIndex = 0; 
    document.getElementById('noListSelected').classList.add('hidden'); 
    document.getElementById('trashContent').classList.add('hidden'); 
    document.getElementById('mainContent').classList.remove('hidden'); 
    render(); 
}

document.getElementById('newListInput').addEventListener('keypress', e => {
    if(e.key === 'Enter') {
        const title = e.target.value.trim();
        if(!title) return;
        const newList = { id: Date.now(), title, tasks: [], table: [{c1:'', c2:''}], gallery: [], notes: [] };
        db.lists.push(newList); e.target.value = ''; selectList(newList.id);
    }
});

function editListTitle() {
    const h2 = document.getElementById('currentListTitle'), inp = document.getElementById('editTitleInput'), cont = document.getElementById('titleContainer');
    cont.classList.add('hidden'); inp.classList.remove('hidden'); inp.value = h2.innerText; inp.focus();
    inp.onblur = () => { if(inp.value.trim()) db.lists.find(l => l.id === activeId).title = inp.value; inp.classList.add('hidden'); cont.classList.remove('hidden'); render(); };
}

function deleteList() {
    const idx = db.lists.findIndex(l => l.id === activeId);
    db.trash.push(db.lists.splice(idx, 1)[0]); 
    activeId = null;
    document.getElementById('mainContent').classList.add('hidden'); 
    document.getElementById('noListSelected').classList.remove('hidden');
    playSound('delete'); render();
}

function cloneList() {
    const original = db.lists.find(l => l.id === activeId);
    const clone = JSON.parse(JSON.stringify(original)); 
    clone.id = Date.now(); db.lists.push(clone); selectList(clone.id);
}

// --- GÖREV VE TABLO ---
function addTask() { 
    const input = document.getElementById('taskInput'); 
    if(!input.value.trim()) return; 
    db.lists.find(l => l.id === activeId).tasks.unshift({id: Date.now(), text: input.value, completed: false}); 
    input.value = ''; render(); 
}

function toggleTask(tid) { 
    const list = db.lists.find(l => l.id === activeId); 
    const task = list.tasks.find(t => t.id === tid); 
    task.completed = !task.completed; 
    if(task.completed) playSound('task'); 
    if(list.tasks.length > 0 && list.tasks.every(t => t.completed)) playSound('finish'); 
    render(); 
}

function deleteTaskItem(tid) { 
    const list = db.lists.find(l => l.id === activeId); 
    const task = list.tasks.find(t => t.id === tid); 
    list.tasks = list.tasks.filter(t => t.id !== tid); 
    showUndoToast(task, 'task', 'Görev Silindi'); playSound('delete'); render(); 
}

function addRow() { db.lists.find(l => l.id === activeId).table.push({c1:'', c2:''}); render(); }
function deleteRow(i) { 
    const list = db.lists.find(l => l.id === activeId); 
    const row = list.table[i]; list.table.splice(i, 1); 
    showUndoToast(row, 'row', 'Satır Silindi'); playSound('delete'); render(); 
}
function updateTable(i,c,v) { db.lists.find(l => l.id === activeId).table[i][c] = v; save(); }

// --- GALERİ VE NOTLAR ---
function handleGalleryUpload(input) {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => { db.lists.find(l => l.id === activeId).gallery.push(e.target.result); render(); };
    reader.readAsDataURL(file);
}

function deleteGalleryItem(i) {
    const list = db.lists.find(l => l.id === activeId);
    const item = list.gallery[i]; list.gallery.splice(i, 1);
    showUndoToast(item, 'gallery', 'Görsel Silindi'); playSound('delete'); render();
}

function openLightbox(src) { document.getElementById('lightboxImg').src = src; document.getElementById('lightbox').classList.remove('hidden'); }
function closeLightbox() { document.getElementById('lightbox').classList.add('hidden'); }

function renderNotes() {
    const list = db.lists.find(l => l.id === activeId);
    if (!list.notes) list.notes = [];
    const tabs = document.getElementById('noteTabs'), container = document.getElementById('activeNoteContainer'), msg = document.getElementById('noNotesMessage');
    tabs.innerHTML = '';
    if (list.notes.length === 0) { container.classList.add('hidden'); msg.classList.remove('hidden'); return; }
    msg.classList.add('hidden'); container.classList.remove('hidden');
    list.notes.forEach((note, i) => {
        const tab = document.createElement('div');
        tab.className = `note-tab ${activeNoteIndex === i ? 'active' : ''}`;
        tab.innerText = note.title || `Not ${i + 1}`;
        tab.onclick = () => { activeNoteIndex = i; renderNotes(); };
        tabs.appendChild(tab);
    });
    const activeNote = list.notes[activeNoteIndex];
    if (activeNote) { document.getElementById('noteTitleInput').value = activeNote.title; document.getElementById('listNotes').value = activeNote.content; }
}

function addNewNote() {
    const list = db.lists.find(l => l.id === activeId);
    if (!list.notes) list.notes = [];
    list.notes.push({ title: 'Yeni Sayfa', content: '' });
    activeNoteIndex = list.notes.length - 1; save(); renderNotes();
}

function updateNoteTitle(v) {
    const list = db.lists.find(l => l.id === activeId);
    if (list.notes[activeNoteIndex]) { list.notes[activeNoteIndex].title = v; save(); renderNotes(); }
}

function updateNoteContent(v) {
    const list = db.lists.find(l => l.id === activeId);
    if (list.notes[activeNoteIndex]) { list.notes[activeNoteIndex].content = v; save(); }
}

function deleteCurrentNote() {
    if(!confirm("Bu sayfayı silmek istediğine emin misin?")) return;
    const list = db.lists.find(l => l.id === activeId);
    list.notes.splice(activeNoteIndex, 1);
    activeNoteIndex = 0; save(); renderNotes();
}

// --- ÇÖP KUTUSU (GERİ YÜKLE + KALICI SİL) ---
function toggleTrash() { 
    activeId = null; document.getElementById('mainContent').classList.add('hidden'); 
    document.getElementById('noListSelected').classList.add('hidden'); 
    document.getElementById('trashContent').classList.remove('hidden'); renderTrash(); 
}

function renderTrash() {
    const container = document.getElementById('trashList');
    container.innerHTML = db.trash.length === 0 ? '<p class="opacity-10 text-center py-10">Çöp kutusu boş</p>' : '';
    db.trash.forEach((l, idx) => {
        container.innerHTML += `<div class="glass p-4 rounded-2xl flex justify-between items-center">
            <span class="text-sm font-bold opacity-50 uppercase">${l.title}</span>
            <div class="flex gap-4">
                <button onclick="restoreList(${l.id})" class="text-[10px] font-black text-green-500 uppercase">Geri Yükle</button>
                <button onclick="permanentDelete(${idx})" class="text-[10px] font-black text-red-500 uppercase">Kalıcı Sil</button>
            </div>
        </div>`;
    });
}

function restoreList(id) { 
    db.lists.push(db.trash.find(l => l.id === id)); 
    db.trash = db.trash.filter(l => l.id !== id); render(); toggleTrash(); 
}

function permanentDelete(idx) {
    if(confirm("Bu liste ve içindeki tüm veriler (tablo, notlar, galeri) KALICI olarak silinecek. Emin misin?")) {
        db.trash.splice(idx, 1);
        save(); renderTrash(); render();
    }
}

function closeTrash() { document.getElementById('trashContent').classList.add('hidden'); document.getElementById('noListSelected').classList.remove('hidden'); }
function openSettings() { syncSettingsUI(); document.getElementById('settingsModal').classList.remove('hidden'); }
function closeSettings() { document.getElementById('settingsModal').classList.add('hidden'); }
function setTheme(t) { db.theme = t; render(); }
function resetApp() { if(confirm("Tüm veriler silinecek!")) { localStorage.clear(); location.reload(); } }

// --- SORTABLE ---
Sortable.create(document.getElementById('taskList'), {
    animation: 200, handle: '.drag-handle',
    onEnd: () => {
        const list = db.lists.find(l => l.id === activeId);
        const newOrder = [];
        document.querySelectorAll('.todo-item').forEach(el => newOrder.push(list.tasks.find(t => t.id == el.dataset.id)));
        list.tasks = newOrder; save();
    }
});

Sortable.create(document.getElementById('tableBody'), {
    animation: 200, handle: '.drag-handle-row',
    onEnd: () => {
        const list = db.lists.find(l => l.id === activeId);
        const newTable = [];
        document.querySelectorAll('#tableBody tr').forEach(tr => newTable.push(list.table[tr.dataset.index]));
        list.table = newTable; save(); render(); 
    }
});

syncSettingsUI();
render();
