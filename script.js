document.addEventListener('DOMContentLoaded', () => {
    let soulData = null;
    let imageStore = {};
    let fileToProcess = null;
    let currentAction = null;
    let currentDayForPhotoUpload = null;
    let isDataDirty = false;
    let panZoomInstance = null;
    let selectedRelationshipId = null;

    const welcomeScreen = document.getElementById('welcome-screen');
    const mainApp = document.getElementById('main-app');
    const appContent = document.getElementById('app-content');
    const passwordModal = document.getElementById('password-modal');
    const birthdateModal = document.getElementById('birthdate-modal');
    const dayViewModal = document.getElementById('day-view-modal');
    const alertModal = document.getElementById('alert-modal');

    const relationshipTypes = {
        parent: { name: 'Родитель', color: '#1a936f' },
        partner: { name: 'Супруг(а)/Партнер', color: '#ff4d6d' },
        best_friend: { name: 'Лучший друг', color: '#ffc107' },
        sibling: { name: 'Брат/Сестра', color: '#007bff' },
        love_interest: { name: 'Любовный интерес', color: '#e85d04' },
        lover: { name: 'Любовник/Любовница', color: '#d00000' },
        friend: { name: 'Друг', color: '#fca311' },
        relative: { name: 'Родственник', color: '#87ceeb' },
        pet: { name: 'Питомец', color: '#8ac926' },
        mentor: { name: 'Наставник', color: '#6a0dad' },
        colleague: { name: 'Коллега', color: '#5e60ce' },
        acquaintance: { name: 'Знакомый', color: '#6c757d' }
    };

    function createNewSoul(birthDate) {
        return {
            persona: { birthDate: birthDate, questions: {} },
            timeline: {},
            relationships: [{ id: 'self', name: 'Я', proximity: 0, type: 'self', isAlive: true }]
        };
    }

    function switchView(viewName) {
        document.querySelectorAll('.nav-button').forEach(btn => btn.classList.toggle('active', btn.dataset.view === viewName));
        if (panZoomInstance) {
            panZoomInstance.destroy();
            panZoomInstance = null;
        }
        const viewRenderers = {
            today: renderToday,
            diary: renderDiary,
            chronicle: renderChronicle,
            relationships: renderRelationships,
            gallery: renderGallery,
            persona: renderPersona
        };
        if (viewRenderers[viewName]) {
            viewRenderers[viewName]();
        }
    }

    function renderToday() {
        const today = new Date().toISOString().split('T')[0];
        const entry = soulData.timeline[today];
        let content;
        if (entry && (entry.thoughts || entry.photos?.length > 0)) {
            content = `
                <h3>Запись на сегодня</h3>
                <p>${(entry.thoughts || "Нет мыслей...").substring(0, 200)}...</p>
                <button id="edit-today-btn" class="action-btn">Редактировать / Дополнить</button>
            `;
        } else {
            content = `
                <h3>Сегодня новый день</h3>
                <p>Еще нет ни одной мысли. Время это исправить.</p>
                <button id="edit-today-btn" class="action-btn">Начать запись</button>
            `;
        }
        appContent.innerHTML = `<div class="content-view today-view"><div class="today-view-card">${content}</div></div>`;
        document.getElementById('edit-today-btn').addEventListener('click', () => openDayView(today));
    }

    function renderDiary() {
        const sortedEntries = Object.entries(soulData.timeline)
            .filter(([date, entry]) => entry.thoughts)
            .sort((a, b) => new Date(b[0]) - new Date(a[0]));

        if (sortedEntries.length === 0) {
            appContent.innerHTML = `<div class="content-view today-view"><div class="today-view-card"><p>Мой дневник пока пуст.</p></div></div>`;
            return;
        }

        let feedHTML = '';
        let navHTML = '<h3>Навигация</h3><ul>';
        const years = {};

        for (const [date, entry] of sortedEntries) {
            const dateObj = new Date(date + 'T00:00:00');
            const year = dateObj.getFullYear();
            if (!years[year]) {
                years[year] = true;
                navHTML += `<li><a href="#year-${year}">${year}</a></li>`;
            }
        }
        navHTML += '</ul>';
        
        let currentYearForId = 0;
        for (const [date, entry] of sortedEntries) {
            const dateObj = new Date(date + 'T00:00:00');
            const year = dateObj.getFullYear();
            let idAttr = '';
            if (year !== currentYearForId) {
                currentYearForId = year;
                idAttr = `id="year-${year}"`;
            }
            feedHTML += `
                <div class="diary-entry-card" ${idAttr}>
                    <h3>${dateObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</h3>
                    <p>${entry.thoughts}</p>
                </div>
            `;
        }
        appContent.innerHTML = `<div class="content-view diary-view"><div class="diary-feed">${feedHTML}</div><nav class="diary-nav">${navHTML}</nav></div>`;
    }

    function renderChronicle() {
        const birthDate = new Date(soulData.persona.birthDate);
        const now = new Date();
        let age = now.getFullYear() - birthDate.getFullYear();
        if (now.getMonth() < birthDate.getMonth() || (now.getMonth() === birthDate.getMonth() && now.getDate() < birthDate.getDate())) age--;
        let yearButtons = '';
        for (let i = 0; i <= age; i++) {
            const year = birthDate.getFullYear() + i;
            yearButtons += `<button class="year-button" data-year="${year}">Год ${i} (${year})</button>`;
        }
        appContent.innerHTML = `<div class="content-view"><h2>Хроника Жизни</h2><div class="year-selector">${yearButtons}</div><div id="calendar-container"></div></div>`;
        document.querySelectorAll('.year-button').forEach(btn => btn.addEventListener('click', (e) => {
            document.querySelectorAll('.year-button').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            renderYearCalendar(parseInt(e.target.dataset.year, 10));
        }));
    }

    function renderYearCalendar(year) {
        const container = document.getElementById('calendar-container');
        let calendarHTML = '';
        const monthNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
        const dayNames = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
        const birthDateObj = new Date(soulData.persona.birthDate + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        for (let month = 0; month < 12; month++) {
            calendarHTML += `<div class="month-grid"><h3 class="month-title">${monthNames[month]} ${year}</h3><div class="day-names">${dayNames.map(d => `<div>${d}</div>`).join('')}</div><div class="calendar-grid">`;
            const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            for (let i = 0; i < firstDay; i++) calendarHTML += `<div class="calendar-day empty"></div>`;
            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const currentDate = new Date(dateStr + 'T00:00:00');
                const entry = soulData.timeline[dateStr];
                const hasEntry = entry && (entry.thoughts || Object.keys(entry.events).length > 0 || entry.photos?.length > 0);
                let dayClass = hasEntry ? 'has-entry' : '';
                if (currentDate < birthDateObj || currentDate > today) dayClass += ' unavailable';
                calendarHTML += `<div class="calendar-day ${dayClass}" data-date="${dateStr}">${day}</div>`;
            }
            calendarHTML += `</div></div>`;
        }
        container.innerHTML = calendarHTML;
        document.querySelectorAll('.calendar-day:not(.empty):not(.unavailable)').forEach(dayEl => dayEl.addEventListener('click', () => openDayView(dayEl.dataset.date)));
    }

    function renderRelationships() {
        const relationshipOptions = Object.entries(relationshipTypes).map(([key, { name }]) => `<option value="${key}">${name}</option>`).join('');
        const legendItems = Object.entries(relationshipTypes).map(([key, { name, color }]) => `<div class="legend-item"><div class="legend-color" style="background-color:${color}"></div>${name}</div>`).join('');
        appContent.innerHTML = `
            <div class="content-view relationships-view">
                <div class="graph-container">
                    <svg id="relationship-graph"></svg>
                </div>
                <div class="graph-controls">
                    <div class="control-card">
                        <h3 id="control-card-title">Добавить связь</h3>
                        <div class="form-group">
                            <label for="person-name">Имя</label>
                            <input type="text" id="person-name" placeholder="Мама, Berry...">
                        </div>
                        <div class="form-group">
                            <label for="proximity-slider">Близость: <span id="proximity-slider-value">0</span></label>
                            <input type="range" id="proximity-slider" min="-10" max="10" value="0">
                        </div>
                        <div class="form-group">
                            <label for="relationship-type">Тип отношений</label>
                            <select id="relationship-type">${relationshipOptions}</select>
                        </div>
                        <div class="form-group form-group-inline">
                             <input type="checkbox" id="is-alive-checkbox" checked>
                             <label for="is-alive-checkbox">Жив(а)</label>
                        </div>
                        <div class="action-buttons">
                            <button id="add-person-btn">Добавить</button>
                            <button id="update-person-btn" style="display:none;">Обновить</button>
                            <button id="delete-person-btn" style="display:none;">Удалить</button>
                        </div>
                    </div>
                    <div class="control-card legend"><h3>Легенда</h3>${legendItems}</div>
                </div>
            </div>`;
        drawRelationshipGraph();
        const proximitySlider = document.getElementById('proximity-slider');
        const proximityValue = document.getElementById('proximity-slider-value');
        proximitySlider.addEventListener('input', () => { proximityValue.textContent = proximitySlider.value; });
        document.getElementById('add-person-btn').addEventListener('click', () => updateRelationship('add'));
        document.getElementById('update-person-btn').addEventListener('click', () => updateRelationship('update'));
        document.getElementById('delete-person-btn').addEventListener('click', () => updateRelationship('delete'));
    }

    function drawRelationshipGraph() {
        const svg = document.getElementById('relationship-graph');
        if (!svg) return;
        if (panZoomInstance) panZoomInstance.destroy();
        svg.innerHTML = '';
        const { clientWidth: width, clientHeight: height } = svg;
        const centerX = width / 2;
        const centerY = height / 2;
        const selfNodeRadius = 30;
        const maxRadius = Math.min(width, height) / 2 - selfNodeRadius * 2;
        const colors = Object.fromEntries(Object.entries(relationshipTypes).map(([key, { color }]) => [key, color]));

        const nodes = soulData.relationships.map((rel, index, arr) => {
            if (rel.type === 'self') return { ...rel, x: centerX, y: centerY };
            const angle = (index / (arr.length - 1 || 1)) * 2 * Math.PI;
            const distance = maxRadius * (1 - (rel.proximity + 10) / 20.5) + selfNodeRadius + 20;
            return { ...rel, x: centerX + Math.cos(angle) * distance, y: centerY + Math.sin(angle) * distance };
        });

        nodes.forEach(node => {
            if (node.type !== 'self') {
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', centerX);
                line.setAttribute('y1', centerY);
                line.setAttribute('x2', node.x);
                line.setAttribute('y2', node.y);
                line.setAttribute('stroke', node.isAlive ? (colors[node.type] || '#ccc') : '#333');
                line.setAttribute('stroke-width', '2');
                svg.appendChild(line);
            }
        });

        nodes.forEach(node => {
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.style.cursor = 'pointer';
            g.setAttribute('transform', `translate(${node.x}, ${node.y})`);
            if (node.type !== 'self') {
                g.addEventListener('click', () => selectRelationship(node.id));
            }
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('r', node.type === 'self' ? selfNodeRadius : '25');
            circle.setAttribute('fill', 'white');
            circle.setAttribute('stroke', node.isAlive ? (colors[node.type] || '#ccc') : '#333');
            circle.setAttribute('stroke-width', '3');
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.textContent = node.name;
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('dy', '.3em');
            text.setAttribute('font-size', '12px');
            text.setAttribute('fill', '#333');
            g.appendChild(circle);
            g.appendChild(text);
            svg.appendChild(g);
        });
        panZoomInstance = svgPanZoom(svg, { zoomEnabled: true, controlIconsEnabled: false, fit: true, center: true });
    }

    function selectRelationship(id) {
        selectedRelationshipId = id;
        const rel = soulData.relationships.find(r => r.id === id);
        if (!rel) return;
        document.getElementById('control-card-title').textContent = 'Редактировать связь';
        document.getElementById('person-name').value = rel.name;
        document.getElementById('proximity-slider').value = rel.proximity;
        document.getElementById('proximity-slider-value').textContent = rel.proximity;
        document.getElementById('relationship-type').value = rel.type;
        document.getElementById('is-alive-checkbox').checked = rel.isAlive;
        document.getElementById('add-person-btn').style.display = 'none';
        document.getElementById('update-person-btn').style.display = 'block';
        document.getElementById('delete-person-btn').style.display = 'block';
    }

    function resetRelationshipForm() {
        selectedRelationshipId = null;
        document.getElementById('control-card-title').textContent = 'Добавить связь';
        document.getElementById('person-name').value = '';
        document.getElementById('proximity-slider').value = 0;
        document.getElementById('proximity-slider-value').textContent = 0;
        document.getElementById('is-alive-checkbox').checked = true;
        document.getElementById('add-person-btn').style.display = 'block';
        document.getElementById('update-person-btn').style.display = 'none';
        document.getElementById('delete-person-btn').style.display = 'none';
    }

    function updateRelationship(action) {
        const name = document.getElementById('person-name').value;
        const proximity = parseInt(document.getElementById('proximity-slider').value, 10);
        const type = document.getElementById('relationship-type').value;
        const isAlive = document.getElementById('is-alive-checkbox').checked;

        if (action === 'add' && name) {
            soulData.relationships.push({ id: Date.now(), name, proximity, type, isAlive });
        } else if (action === 'update' && selectedRelationshipId) {
            const relIndex = soulData.relationships.findIndex(r => r.id === selectedRelationshipId);
            if (relIndex > -1) soulData.relationships[relIndex] = { ...soulData.relationships[relIndex], name, proximity, type, isAlive };
        } else if (action === 'delete' && selectedRelationshipId) {
            if (confirm(`Вы уверены, что хотите удалить '${soulData.relationships.find(r => r.id === selectedRelationshipId).name}'?`)) {
                soulData.relationships = soulData.relationships.filter(r => r.id !== selectedRelationshipId);
            }
        }
        isDataDirty = true;
        drawRelationshipGraph();
        resetRelationshipForm();
    }

    function renderGallery() {
        let allPhotos = [];
        Object.entries(soulData.timeline).forEach(([date, entry]) => {
            if (entry.photos?.length > 0) {
                entry.photos.forEach(photo => allPhotos.push({ ...photo, date, thoughts: entry.thoughts || '' }));
            }
        });
        allPhotos.sort((a, b) => new Date(a.date) - new Date(b.date));
        if (allPhotos.length === 0) {
            appContent.innerHTML = `<div class="content-view today-view"><div class="today-view-card"><p>Моя галерея пока пуста.</p></div></div>`;
            return;
        }
        const galleryItemsHTML = allPhotos.map(photo => `
            <div class="gallery-item" data-date="${photo.date}">
                <img src="${imageStore[photo.id]}" alt="Воспоминание от ${photo.date}">
                <div class="caption">${new Date(photo.date + 'T00:00:00').toLocaleDateString('ru-RU')}</div>
                <p class="thoughts">${photo.thoughts.length > 150 ? photo.thoughts.substring(0, 150) + '...' : photo.thoughts}</p>
            </div>`).join('');
        appContent.innerHTML = `
            <div class="content-view gallery-view">
                <div class="gallery-container">${galleryItemsHTML}</div>
                <div class="gallery-controls">
                    <button id="gallery-play-btn" title="Воспроизвести"><svg viewBox="0 0 24 24"><path d="M8 5V19L19 12L8 5Z"></path></svg></button>
                    <input type="range" id="year-slider" min="0" max="${allPhotos.length - 1}" value="0">
                    <button id="gallery-stop-btn" title="Остановить и сбросить"><svg viewBox="0 0 24 24"><path d="M6 6H18V18H6V6Z"></path></svg></button>
                </div>
            </div>`;
        const slider = document.getElementById('year-slider');
        const galleryContainer = document.querySelector('.gallery-container');
        const items = document.querySelectorAll('.gallery-item');
        let playerInterval = null;

        const playBtn = document.getElementById('gallery-play-btn');
        const playIcon = `<svg viewBox="0 0 24 24"><path d="M8 5V19L19 12L8 5Z"></path></svg>`;
        const pauseIcon = `<svg viewBox="0 0 24 24"><path d="M6 19H10V5H6V19ZM14 5V19H18V5H14Z"></path></svg>`;

        playBtn.addEventListener('click', () => {
            if (playerInterval) {
                clearInterval(playerInterval);
                playerInterval = null;
                playBtn.innerHTML = playIcon;
            } else {
                playBtn.innerHTML = pauseIcon;
                playerInterval = setInterval(() => {
                    let nextValue = parseInt(slider.value) + 1;
                    if (nextValue >= items.length) {
                        clearInterval(playerInterval);
                        playerInterval = null;
                        playBtn.innerHTML = playIcon;
                        return;
                    }
                    slider.value = nextValue;
                    slider.dispatchEvent(new Event('input'));
                }, 2000);
            }
        });

        document.getElementById('gallery-stop-btn').addEventListener('click', () => {
            if (playerInterval) {
                clearInterval(playerInterval);
                playerInterval = null;
                playBtn.innerHTML = playIcon;
            }
            slider.value = 0;
            slider.dispatchEvent(new Event('input'));
        });

        slider.oninput = () => items[slider.value].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        galleryContainer.onscroll = () => {
            if (playerInterval) return;
            let minDistance = Infinity, closestIndex = 0;
            const containerCenter = galleryContainer.getBoundingClientRect().left + galleryContainer.offsetWidth / 2;
            items.forEach((item, index) => {
                const distance = Math.abs((item.getBoundingClientRect().left + item.offsetWidth / 2) - containerCenter);
                if (distance < minDistance) { minDistance = distance; closestIndex = index; }
            });
            slider.value = closestIndex;
        };
    }

    function renderPersona() {
        let categoriesHTML = '';
        for (const category in questions) {
            const questionsHTML = questions[category].map(q => `
                <div class="question-item">
                    <label>${q}</label>
                    <textarea data-question="${q}" placeholder="Мой ответ...">${soulData.persona.questions[q] || ''}</textarea>
                </div>`).join('');
            categoriesHTML += `
                <div class="question-category">
                    <h3 class="category-title">${category}</h3>
                    <div class="question-category-content">${questionsHTML}</div>
                </div>`;
        }
        appContent.innerHTML = `
            <div class="content-view persona-view">
                <div class="questions-container">${categoriesHTML}</div>
            </div>`;
        document.querySelectorAll('.category-title').forEach(title => {
            title.addEventListener('click', () => {
                title.classList.toggle('open');
                title.nextElementSibling.classList.toggle('open');
            });
        });
        document.querySelectorAll('.questions-container textarea').forEach(area => {
            area.addEventListener('input', (e) => {
                soulData.persona.questions[e.target.dataset.question] = e.target.value;
                isDataDirty = true;
            });
        });
    }

    function generateDayViewHTML(container, dateStr) {
        if (!soulData.timeline[dateStr]) soulData.timeline[dateStr] = { thoughts: '', events: {}, photos: [] };
        const entry = soulData.timeline[dateStr];
        currentDayForPhotoUpload = dateStr;
        
        const thoughtsTextarea = container.querySelector('#day-view-thoughts');
        thoughtsTextarea.value = entry.thoughts || '';
        thoughtsTextarea.oninput = (e) => { entry.thoughts = e.target.value; isDataDirty = true; };
        
        const eventsContainer = container.querySelector('#day-view-events');
        let eventsHTML = '';
        for (let h = 0; h < 24; h++) {
            const time = String(h).padStart(2, '0');
            eventsHTML += `<div class="event-slot"><span class="event-time">${time}:00</span><input type="text" class="event-input" data-hour="${time}" value="${entry.events[time] || ''}" placeholder="..."></div>`;
        }
        eventsContainer.innerHTML = eventsHTML;
        eventsContainer.querySelectorAll('.event-input').forEach(input => {
            input.oninput = (e) => {
                const hour = e.target.dataset.hour;
                if (e.target.value) entry.events[hour] = e.target.value; else delete entry.events[hour];
                isDataDirty = true;
            };
        });
        
        renderPhotoPreviews(container, dateStr);
        const photoInput = container.querySelector('#photo-upload-input');
        if(photoInput) photoInput.onchange = handlePhotoUpload;
    }

    function renderPhotoPreviews(container, dateStr) {
        const previewContainer = container.querySelector('#day-view-photos');
        if (!previewContainer) return;
        const entry = soulData.timeline[dateStr];
        if (!entry || !entry.photos) { previewContainer.innerHTML = ''; return; }
        previewContainer.innerHTML = entry.photos.map(photo => `<div class="photo-preview"><img src="${imageStore[photo.id]}" alt="${photo.name}"><button class="remove-photo-btn" data-photoid="${photo.id}">&times;</button></div>`).join('');
        previewContainer.querySelectorAll('.remove-photo-btn').forEach(btn => btn.onclick = () => removePhoto(dateStr, btn.dataset.photoid));
    }

    async function handlePhotoUpload(event) {
        isDataDirty = true;
        const dateStr = currentDayForPhotoUpload;
        const files = Array.from(event.target.files);
        for (const file of files) {
            const photoId = `img_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
            const base64 = await toBase64(file);
            imageStore[photoId] = base64;
            if (!soulData.timeline[dateStr].photos) soulData.timeline[dateStr].photos = [];
            soulData.timeline[dateStr].photos.push({ id: photoId, name: file.name });
        }
        const activeContainer = dayViewModal.classList.contains('active') ? dayViewModal.querySelector('.day-view-content') : document;
        renderPhotoPreviews(activeContainer, dateStr);
    }

    function removePhoto(dateStr, photoId) {
        isDataDirty = true;
        delete imageStore[photoId];
        const entry = soulData.timeline[dateStr];
        entry.photos = entry.photos.filter(p => p.id !== photoId);
        const activeContainer = dayViewModal.classList.contains('active') ? dayViewModal.querySelector('.day-view-content') : document;
        renderPhotoPreviews(activeContainer, dateStr);
    }

    function openDayView(dateStr) {
        const date = new Date(dateStr + 'T00:00:00');
        const today = new Date(); today.setHours(0,0,0,0);
        const thoughtsTitle = dayViewModal.querySelector('#day-view-thoughts-title');
        thoughtsTitle.textContent = (date.getTime() === today.getTime()) ? "Мои мысли дня" : "Мои воспоминания и мысли об этом дне";
        dayViewModal.querySelector('#day-view-date').textContent = date.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' });
        generateDayViewHTML(dayViewModal.querySelector('.day-view-content'), dateStr);
        dayViewModal.classList.add('active');
    }

    function closeDayView() { dayViewModal.classList.remove('active'); if (document.querySelector('.today-view')) renderToday(); }
    function toBase64(file) { return new Promise((resolve) => { const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = () => resolve(reader.result); }); }

    function askForBirthDate() {
        return new Promise(resolve => {
            birthdateModal.classList.add('active');
            const input = document.getElementById('birthdate-input');
            input.value = '2001-03-15';
            const submitHandler = () => { if (input.value) { birthdateModal.classList.remove('active'); cleanup(); resolve(input.value); } else { showAlert('Пожалуйста, выберите дату.'); } };
            const cancelHandler = () => { birthdateModal.classList.remove('active'); cleanup(); resolve(null); };
            const submitBtn = document.getElementById('birthdate-submit');
            const cancelBtn = document.getElementById('birthdate-cancel');
            const cleanup = () => { submitBtn.removeEventListener('click', submitHandler); cancelBtn.removeEventListener('click', cancelHandler); };
            submitBtn.addEventListener('click', submitHandler);
            cancelBtn.addEventListener('click', cancelHandler);
        });
    }
    
    function showAlert(message, title = 'Уведомление') {
        const alertModal = document.getElementById('alert-modal');
        document.getElementById('alert-title').textContent = title;
        document.getElementById('alert-message').textContent = message;
        alertModal.classList.add('active');
        const okBtn = document.getElementById('alert-ok');
        return new Promise(resolve => {
            const handler = () => {
                alertModal.classList.remove('active');
                okBtn.removeEventListener('click', handler);
                resolve();
            };
            okBtn.addEventListener('click', handler);
        });
    }

    function loadSoulIntoApp(loadedSoul, loadedImages) {
        soulData = loadedSoul;
        imageStore = loadedImages;
        welcomeScreen.classList.remove('active');
        mainApp.classList.add('active');
        switchView('today');
    }
    
    function showPasswordModal(action) {
        currentAction = action;
        const prompt = document.getElementById('modal-prompt');
        const fileNameInput = document.getElementById('file-name-input');
        const fileNameGroup = document.getElementById('file-name-group');
        const passwordInput = document.getElementById('password-input');

        if (action === 'save' || action === 'exit') {
            prompt.textContent = action === 'exit' ? 'Сохранить душу перед выходом?' : 'Сохранить душу в файл?';
            const date = new Date().toISOString().split('T')[0];
            const defaultName = fileToProcess?.name.replace('.personality', '') || `my_soul_${date}`;
            fileNameInput.value = defaultName;
            fileNameGroup.style.display = (action === 'exit' && fileToProcess?.handle) ? 'none' : 'block';
        } else {
            prompt.textContent = 'Введите мой ключ для дешифровки.';
            fileNameGroup.style.display = 'none';
        }
        passwordInput.value = '';
        passwordModal.classList.add('active');
        passwordInput.focus();
    }
    
    async function handlePasswordSubmit() {
        const password = document.getElementById('password-input').value;
        if (!password) { showAlert('Ключ не может быть пустым.'); return; }
        
        passwordModal.classList.remove('active');
        
        if (currentAction === 'exit' && fileToProcess?.handle) {
            await saveSoul(password, fileToProcess.handle);
            soulData = null; imageStore = {}; fileToProcess = null;
            mainApp.classList.remove('active');
            welcomeScreen.classList.add('active');
        } else if (currentAction === 'save' || currentAction === 'exit') {
            const filename = document.getElementById('file-name-input').value || 'soul';
            await saveSoul(password, filename);
            if(currentAction === 'exit') {
                soulData = null; imageStore = {}; fileToProcess = null;
                mainApp.classList.remove('active');
                welcomeScreen.classList.add('active');
            }
        } else if (currentAction === 'load' && fileToProcess) {
            await decryptAndLoadSoul(password, fileToProcess);
        }
    }

    function init() {
        document.getElementById('create-soul-btn').addEventListener('click', async () => { const birthDate = await askForBirthDate(); if (birthDate) { fileToProcess = null; const newSoul = createNewSoul(birthDate); loadSoulIntoApp(newSoul, {}); } });
        document.getElementById('load-soul-btn').addEventListener('click', async () => {
             if (window.showOpenFilePicker) {
                try {
                    const [fileHandle] = await window.showOpenFilePicker({ types: [{ description: 'Soul Files', accept: { 'application/octet-stream': ['.personality'] } }] });
                    const file = await fileHandle.getFile();
                    file.handle = fileHandle; 
                    fileToProcess = file;
                    showPasswordModal('load');
                } catch(e) { console.log("Выбор файла отменен"); }
            } else {
                const input = document.createElement('input'); input.type = 'file'; input.accept = '.personality';
                input.onchange = (e) => { const file = e.target.files[0]; if (file) { fileToProcess = file; showPasswordModal('load'); } };
                input.click();
            }
        });
        document.querySelectorAll('.nav-button').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));
        document.getElementById('save-soul-btn').addEventListener('click', () => showPasswordModal('save'));
        document.getElementById('exit-soul-btn').addEventListener('click', () => showPasswordModal('exit'));
        document.getElementById('day-view-close').addEventListener('click', closeDayView);
        document.getElementById('day-view-save-and-close').addEventListener('click', closeDayView);
        document.getElementById('password-cancel').addEventListener('click', () => { passwordModal.classList.remove('active'); });
        document.getElementById('password-submit').addEventListener('click', handlePasswordSubmit);
        document.getElementById('password-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') handlePasswordSubmit(); });
    }
    
    const canvas = document.getElementById('background-canvas'); const ctx = canvas.getContext('2d'); let particles = []; let animationFrameId;
    function setupCanvas() {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        particles = [];
        const numParticles = window.innerWidth < 768 ? 50 : 100;
        for (let i = 0; i < numParticles; i++) {
            particles.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, r: Math.random() * 1.5 + 0.5, dx: (Math.random() - 0.5) * 0.3, dy: (Math.random() - 0.5) * 0.3 });
        }
        animateParticles();
    }
    function animateParticles() {
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.x += p.dx; p.y += p.dy;
            if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
            if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 122, 255, 0.5)'; ctx.fill();
        });
        animationFrameId = requestAnimationFrame(animateParticles);
    }
    setupCanvas(); window.addEventListener('resize', setupCanvas);

    async function getKey(password, salt) { const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, ['deriveKey']); return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']); }
    async function encryptData(password, data) { const salt = crypto.getRandomValues(new Uint8Array(16)); const iv = crypto.getRandomValues(new Uint8Array(12)); const key = await getKey(password, salt); const encryptedContent = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data); const result = new Uint8Array(salt.length + iv.length + encryptedContent.byteLength); result.set(salt); result.set(iv, salt.length); result.set(new Uint8Array(encryptedContent), salt.length + iv.length); return result; }
    async function decryptData(password, data) { const salt = data.slice(0, 16); const iv = data.slice(16, 28); const encryptedContent = data.slice(28); try { const key = await getKey(password, salt); return await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encryptedContent); } catch (e) { console.error(e); return null; } }
    
    async function saveSoul(password, fileOrName) {
        const zip = new JSZip();
        zip.file('soul-data.json', JSON.stringify(soulData));
        const imgFolder = zip.folder('images');
        for (const [id, base64] of Object.entries(imageStore)) {
            imgFolder.file(`${id}.b64`, base64.split(',')[1], { base64: true });
        }
        const zipContent = await zip.generateAsync({ type: "arraybuffer" });
        const encryptedZip = await encryptData(password, zipContent);
        const blob = new Blob([encryptedZip], { type: 'application/octet-stream' });
        
        if (typeof fileOrName !== 'string') {
            try {
                const writable = await fileOrName.createWritable();
                await writable.write(blob);
                await writable.close();
                await showAlert('Изменения сохранены в открытый файл.');
            } catch(e) {
                console.error('Не удалось перезаписать файл, пробуем "Сохранить как"', e);
                saveAs(blob, `${fileOrName.name || 'soul'}.personality`);
            }
        } else if (window.showSaveFilePicker) {
            try {
                const handle = await window.showSaveFilePicker({ suggestedName: `${fileOrName}.personality`, types: [{ description: 'Soul Files', accept: { 'application/octet-stream': ['.personality'] } }] });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
            } catch(e) { console.log('Сохранение отменено'); }
        } else {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `${fileOrName}.personality`; a.click(); URL.revokeObjectURL(url);
        }
        isDataDirty = false;
    }
    
    async function decryptAndLoadSoul(password, file) {
        const reader = new FileReader();
        reader.onload = async event => {
            try {
                const decryptedZipData = await decryptData(password, new Uint8Array(event.target.result));
                if (!decryptedZipData) { await showAlert('Неверный ключ или файл поврежден.', 'Ошибка'); return; }
                const zip = await JSZip.loadAsync(decryptedZipData);
                const dataFile = zip.file('soul-data.json');
                if (!dataFile) throw new Error("Файл данных не найден.");
                const loadedSoulData = JSON.parse(new TextDecoder().decode(await dataFile.async("uint8array")));
                const loadedImageStore = {};
                const imgFolder = zip.folder('images');
                if (imgFolder) {
                    const imagePromises = [];
                    imgFolder.forEach((relativePath, file) => {
                        const processFile = async () => {
                            const id = relativePath.replace('.b64', '');
                            const base64 = await file.async('base64');
                            let mimeType = 'image/jpeg';
                            for (const entry of Object.values(loadedSoulData.timeline)) {
                                const photo = entry.photos?.find(p => p.id === id);
                                if (photo) {
                                    if (photo.name.toLowerCase().endsWith('.png')) mimeType = 'image/png';
                                    else if (photo.name.toLowerCase().endsWith('.gif')) mimeType = 'image/gif';
                                    break;
                                }
                            }
                            loadedImageStore[id] = `data:${mimeType};base64,${base64}`;
                        };
                        imagePromises.push(processFile());
                    });
                    await Promise.all(imagePromises);
                }
                loadSoulIntoApp(loadedSoulData, loadedImageStore);
                isDataDirty = false;
                await showAlert('Душа успешно загружена.');
            } catch (e) { console.error("Ошибка при загрузке:", e); await showAlert('Ошибка при загрузке. Файл поврежден или не является файлом души.', 'Ошибка'); }
        };
        reader.readAsArrayBuffer(file);
    }

    window.addEventListener('beforeunload', (event) => { if (isDataDirty) { event.preventDefault(); event.returnValue = ''; } });

    init();
});