// App State
let currentSection = 'menu';
let timerInterval;
let isBreakTime = false;
let cycleCount = 0;

// Ejemplo de configuración
const config = {
  focusDuration: 25, // minutos
  breakDuration: 5,  // minutos
  totalCycles: 4     // ciclos completos
};

// === THEME SYSTEM === //
let currentTheme = 'dark'; // 'dark' or 'light'
const THEME_CONFIG = {
    storageKey: 'ana_app_theme',
    themes: {
        dark: {
            name: 'Noche Romántica',
            icon: '🌙'
        },
        light: {
            name: 'Jardín de Flores', 
            icon: '🌸'
        }
    }
};

// Initialize theme on startup
function initializeTheme() {
    const savedTheme = localStorage.getItem(THEME_CONFIG.storageKey) || 'dark';
    setTheme(savedTheme);
}

// Set theme function
function setTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_CONFIG.storageKey, theme);
    updateThemeButton();
    console.log(`🎨 Tema cambiado a: ${theme}`);
}

// Toggle theme function
function toggleTheme() {
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    
    const themeMessages = {
        dark: '🌙 Cambiado a Noche Romántica - Perfecto para momentos íntimos 💕',
        light: '🌸 Cambiado a Jardín de Flores - Como un paseo entre gerberas 🌻'
    };
    
    showNotification(themeMessages[newTheme], 'info');
}

// Update theme button
function updateThemeButton() {
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
        const themeInfo = THEME_CONFIG.themes[currentTheme];
        const oppositeTheme = currentTheme === 'dark' ? 'light' : 'dark';
        const oppositeInfo = THEME_CONFIG.themes[oppositeTheme];
        themeBtn.innerHTML = `${oppositeInfo.icon} ${oppositeInfo.name}`;
        themeBtn.title = `Cambiar a tema ${oppositeInfo.name.toLowerCase()}`;
    }
}

// Firebase imports and setup
let db, storage;
let collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc, serverTimestamp;
let ref, uploadBytes, getDownloadURL;

// Initialize Firebase functions when available
function initializeFirebase() {
    if (window.db && window.storage) {
        db = window.db;
        storage = window.storage;
        
        // Import Firestore functions
        import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js').then(module => {
            ({ collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc, serverTimestamp } = module);
            console.log('✅ Firebase Firestore initialized');
        });
        
        // Import Storage functions  
        import('https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js').then(module => {
            ({ ref, uploadBytes, getDownloadURL } = module);
            console.log('✅ Firebase Storage initialized');
        });
        
        return true;
    }
    return false;
}

// Firebase Helper Functions
async function saveMessageToFirebase(message) {
    try {
        if (!collection || !addDoc || !db) {
            console.log('Firebase not ready, saving locally only');
            return;
        }
        
        const messagesRef = collection(db, 'messages');
        await addDoc(messagesRef, {
            ...message,
            timestamp: serverTimestamp()
        });
        console.log('Message saved to Firebase');
        showNotification('✅ Mensaje guardado en la nube ☁️', 'success');
        return true;
    } catch (error) {
        console.error('Error saving message to Firebase:', error);
        showNotification('⚠️ Error guardando en Firebase, guardado localmente', 'warning');
        return false;
    }
}

async function uploadPhotoToFirebase(photoData) {
    try {
        if (!ref || !uploadBytes || !getDownloadURL || !storage) {
            throw new Error('Firebase Storage not ready');
        }
        
        // Handle file directly (not data URL)
        const file = photoData.data;
        
        // Create reference with unique name
        const photoRef = ref(storage, `photos/${photoData.id}_${photoData.name}`);
        
        // Upload the file
        await uploadBytes(photoRef, file);
        
        // Get download URL
        const downloadURL = await getDownloadURL(photoRef);
        console.log('🌻 Foto subida a Firebase Storage:', photoData.name);
        
        // Save photo metadata to Firestore
        const photosRef = collection(db, 'photos');
        await addDoc(photosRef, {
            id: photoData.id,
            name: photoData.name,
            url: downloadURL,
            type: 'firebase',
            timestamp: serverTimestamp()
        });
        
        console.log('🌻 Metadatos guardados en Firestore');
        return downloadURL;
    } catch (error) {
        console.error('Error uploading photo to Firebase:', error);
        throw error; // Let the calling function handle the error
    }
}

function loadMessagesFromFirebase() {
    try {
        if (!collection || !onSnapshot || !db) {
            console.log('Firebase not ready, loading local messages only');
            return;
        }
        
        const messagesRef = collection(db, 'messages');
        onSnapshot(messagesRef, (snapshot) => {
            const firebaseMessages = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                firebaseMessages.push({
                    id: doc.id,
                    content: data.content,
                    date: data.timestamp ? data.timestamp.toDate().toLocaleString('es-ES') : data.date
                });
            });
            
            // Sort by timestamp (newest first)
            firebaseMessages.sort((a, b) => new Date(b.date) - new Date(a.date));
            
        // Display Firebase messages with sync indicators
            displayMessages(firebaseMessages, true); // true indicates Firebase source
        });
    } catch (error) {
        console.error('Error loading messages from Firebase:', error);
    }
}

function loadPhotosFromFirebase() {
    try {
        if (!collection || !onSnapshot || !db) {
            console.log('Firebase not ready, loading local photos only');
            return;
        }
        
        const photosRef = collection(db, 'photos');
        onSnapshot(photosRef, (snapshot) => {
            const firebasePhotos = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                firebasePhotos.push({
                    id: data.id,
                    data: data.url,
                    name: data.name,
                    type: 'firebase',
                    date: data.timestamp ? data.timestamp.toDate().toISOString() : new Date().toISOString()
                });
            });
            
            // Sort by timestamp (newest first)
            firebasePhotos.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            // Update photos display
            displayPhotos(firebasePhotos);
        });
    } catch (error) {
        console.error('Error loading photos from Firebase:', error);
    }
}

// Load existing comments from Firebase on startup
function migrateLocalCommentsToFirebase() {
    if (!window.db || !collection || !addDoc) {
        console.log('Firebase not available for comment migration');
        return;
    }
    
    console.log('🔄 Migrando comentarios locales a Firebase...');
    
    // Get all localStorage keys for photo comments
    const keys = Object.keys(localStorage).filter(key => key.startsWith('photo_comments_'));
    
    keys.forEach(async (key) => {
        try {
            const photoId = key.replace('photo_comments_', '');
            const comments = JSON.parse(localStorage.getItem(key) || '[]');
            
            if (comments.length > 0) {
                console.log(`📸 Migrando ${comments.length} comentarios para foto ${photoId}`);
                
                for (const comment of comments) {
                    // Check if comment already exists in Firebase
                    await saveCommentToFirebase(photoId, comment);
                }
            }
        } catch (error) {
            console.error('Error migrating comments:', error);
        }
    });
}

// Advanced Weekly Planner Class
class WeeklyPlanner {
    constructor() {
        this.activities = [];
        this.currentWeek = new Date();
        this.currentView = 'week'; // 'week' or 'list'
        this.categoryColors = {
            personal: '#d63384',
            study: '#4a7c59',
            work: '#8b4513',
            date: '#ff1493',
            fitness: '#ff8c00',
            social: '#8a2be2',
            other: '#696969'
        };
        
        this.initializeElements();
        this.setupEventListeners();
        this.loadActivities();
        this.updateWeekTitle();
        this.generateWeekView();
        this.updateStatistics();
    }
    
    initializeElements() {
        // Form elements
        this.userSelect = document.getElementById('userSelect');
        this.activityInput = document.getElementById('activityInput');
        this.activityDate = document.getElementById('activityDate');
        this.activityStartTime = document.getElementById('activityStartTime');
        this.activityEndTime = document.getElementById('activityEndTime');
        this.activityCategory = document.getElementById('activityCategory');
        this.activityDescription = document.getElementById('activityDescription');
        this.addButton = document.getElementById('addActivity');
        
        // Navigation elements
        this.prevWeekBtn = document.getElementById('prevWeek');
        this.nextWeekBtn = document.getElementById('nextWeek');
        this.todayBtn = document.getElementById('todayBtn');
        this.currentWeekTitle = document.getElementById('currentWeekTitle');
        
        // View elements
        this.weekViewBtn = document.getElementById('weekView');
        this.listViewBtn = document.getElementById('listView');
        this.weekViewContainer = document.getElementById('weekViewContainer');
        this.listViewContainer = document.getElementById('listViewContainer');
        
        // Calendar elements
        this.timeSlots = document.getElementById('timeSlots');
        this.daysContainer = document.getElementById('daysContainer');
        this.activitiesList = document.getElementById('activitiesList');
        
        // Filter elements
        this.filterUser = document.getElementById('filterUser');
        this.filterCategory = document.getElementById('filterCategory');
        this.filterTime = document.getElementById('filterTime');
        
        // Statistics elements
        this.totalActivitiesEl = document.getElementById('totalActivities');
        this.juanActivitiesEl = document.getElementById('juanActivities');
        this.anaActivitiesEl = document.getElementById('anaActivities');
        this.sharedActivitiesEl = document.getElementById('sharedActivities');
        
        // Set default values - Fix timezone issues
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        this.activityDate.value = `${year}-${month}-${day}`;
        
        // Set default times
        const now = new Date();
        const startTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
        const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour duration
        
        this.activityStartTime.value = startTime.toTimeString().slice(0, 5);
        this.activityEndTime.value = endTime.toTimeString().slice(0, 5);
    }
    
    setupEventListeners() {
        // Form events
        this.addButton.addEventListener('click', () => this.addActivity());
        this.activityInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.addActivity();
            }
        });
        
        // Navigation events
        this.prevWeekBtn.addEventListener('click', () => this.changeWeek(-1));
        this.nextWeekBtn.addEventListener('click', () => this.changeWeek(1));
        this.todayBtn.addEventListener('click', () => this.goToCurrentWeek());
        
        // View switching events
        this.weekViewBtn.addEventListener('click', () => this.switchView('week'));
        this.listViewBtn.addEventListener('click', () => this.switchView('list'));
        
        // Filter events
        if (this.filterUser) {
            this.filterUser.addEventListener('change', () => this.updateListView());
        }
        if (this.filterCategory) {
            this.filterCategory.addEventListener('change', () => this.updateListView());
        }
        if (this.filterTime) {
            this.filterTime.addEventListener('change', () => this.updateListView());
        }
        
        // Auto-update end time when start time changes
        this.activityStartTime.addEventListener('change', () => {
            if (this.activityStartTime.value && !this.activityEndTime.value) {
                const startTime = new Date(`2000-01-01T${this.activityStartTime.value}:00`);
                const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
                this.activityEndTime.value = endTime.toTimeString().slice(0, 5);
            }
        });
    }
    
    async addActivity() {
        const user = this.userSelect.value;
        const title = this.activityInput.value.trim();
        const date = this.activityDate.value;
        const startTime = this.activityStartTime.value;
        const endTime = this.activityEndTime.value;
        const category = this.activityCategory.value;
        const description = this.activityDescription.value.trim();
        
        if (!title || !date || !startTime) {
            this.showNotification('Por favor completa el título, fecha y hora de inicio', 'warning');
            return;
        }
        
        // Validate time range
        if (endTime && startTime >= endTime) {
            this.showNotification('La hora de fin debe ser posterior a la hora de inicio', 'warning');
            return;
        }
        
        const activity = {
            id: Date.now() + Math.random(),
            user,
            title,
            description,
            date,
            startTime,
            endTime: endTime || startTime,
            category,
            timestamp: new Date().toISOString()
        };
        
        this.activities.push(activity);
        await this.saveActivities();
        this.updateCurrentView();
        this.updateStatistics();
        
        // Clear form
        this.clearForm();
        
        // Play sound and show notification
        this.playActivitySound('add');
        this.showNotification('✅ Actividad agregada al planner', 'success');
    }
    
    async deleteActivity(id) {
        this.activities = this.activities.filter(activity => activity.id !== id);
        await this.saveActivities();
        this.updateCurrentView();
        this.updateStatistics();
        
        this.playActivitySound('delete');
        this.showNotification('🗑️ Actividad eliminada', 'info');
    }
    
    changeWeek(direction) {
        // Get the current week's start date
        const currentStartOfWeek = new Date(this.currentWeek);
        currentStartOfWeek.setDate(currentStartOfWeek.getDate() - currentStartOfWeek.getDay());
        
        // Calculate the new week's start date
        const newDate = new Date(currentStartOfWeek);
        newDate.setDate(currentStartOfWeek.getDate() + (direction * 7));
        
        // Update the current week
        this.currentWeek = newDate;
        this.updateWeekTitle();
        this.generateWeekView();
    }
    
    goToCurrentWeek() {
        this.currentWeek = new Date();
        const startOfWeek = new Date(this.currentWeek);
        startOfWeek.setDate(this.currentWeek.getDate() - this.currentWeek.getDay());
        this.currentWeek = startOfWeek;
        this.updateWeekTitle();
        this.generateWeekView();
    }
    
    switchView(view) {
        this.currentView = view;
        
        // Update button states
        this.weekViewBtn.classList.toggle('active', view === 'week');
        this.listViewBtn.classList.toggle('active', view === 'list');
        
        // Update container visibility
        this.weekViewContainer.classList.toggle('active', view === 'week');
        this.listViewContainer.classList.toggle('active', view === 'list');
        
        this.updateCurrentView();
    }
    
    updateCurrentView() {
        if (this.currentView === 'week') {
            this.generateWeekView();
        } else {
            this.updateListView();
        }
    }
    
    updateWeekTitle() {
        const options = { day: 'numeric', month: 'long' };
        // Get start of week
        const startOfWeek = new Date(this.currentWeek);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        
        // Calculate end of week
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        
        const startStr = startOfWeek.toLocaleDateString('es-ES', options);
        const endStr = endOfWeek.toLocaleDateString('es-ES', options);
        const year = startOfWeek.getFullYear();
        
        this.currentWeekTitle.textContent = `Semana del ${startStr} al ${endStr} ${year}`;
    }
    
    generateWeekView() {
        this.generateTimeSlots();
        this.generateDayColumns();
    }
    
    generateTimeSlots() {
        let html = '';
        for (let hour = 6; hour <= 23; hour++) {
            const timeStr = `${hour.toString().padStart(2, '0')}:00`;
            html += `<div class="time-slot">${timeStr}</div>`;
        }
        this.timeSlots.innerHTML = html;
    }
    
    generateDayColumns() {
        const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const today = new Date();
        
        // Get start of week - Fix timezone issues
        const startOfWeek = new Date(this.currentWeek);
        startOfWeek.setHours(0, 0, 0, 0);
        const dayOfWeek = startOfWeek.getDay();
        startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);
        
        let html = '';
        
        for (let i = 0; i < 7; i++) {
            const currentDay = new Date(startOfWeek);
            currentDay.setDate(startOfWeek.getDate() + i);
            currentDay.setHours(0, 0, 0, 0);

            const isToday = currentDay.toDateString() === today.toDateString();

            // 🔧 FORMAT using YYYY-MM-DD format consistently
            const year = currentDay.getFullYear();
            const month = String(currentDay.getMonth() + 1).padStart(2, '0');
            const day = String(currentDay.getDate()).padStart(2, '0');
            const formattedDay = `${year}-${month}-${day}`;

            const dayActivities = this.activities.filter(activity => 
                activity.date === formattedDay
            );

            const options = { day: 'numeric', month: 'short' };
            const formattedDate = currentDay.toLocaleDateString('es-ES', options);

            html += `
                <div class="day-column">
                    <div class="day-header ${isToday ? 'today' : ''}">
                        <div>${days[currentDay.getDay()]}</div>
                        <div class="day-date">${formattedDate}</div>
                    </div>
                    <div class="day-activities">
                        ${this.generateHourSlots(dayActivities)}
                    </div>
                </div>
            `;
        }

        
        this.daysContainer.innerHTML = html;
    }
    
    generateHourSlots(dayActivities) {
        let html = '';
        
        for (let hour = 6; hour <= 23; hour++) {
            const hourStr = hour.toString().padStart(2, '0');
            const currentHourActivities = dayActivities.filter(activity => {
                const startHour = parseInt(activity.startTime.split(':')[0]);
                const endHour = activity.endTime ? parseInt(activity.endTime.split(':')[0]) : startHour;
                return startHour <= hour && hour <= endHour;
            });
            
            html += `<div class="day-hour-slot" data-hour="${hourStr}:00">`;
            
            currentHourActivities.forEach(activity => {
                const categoryClass = `category-${activity.category}`;
                const userClass = activity.user;
                const categoryIcon = this.getCategoryIcon(activity.category);
                
                html += `
                    <div class="activity-block ${userClass} ${categoryClass}" 
                         onclick="window.weeklyPlanner.showActivityDetails(${activity.id})">
                        <div class="activity-title">${activity.title}</div>
                        <div class="activity-time">${activity.startTime}${activity.endTime !== activity.startTime ? ' - ' + activity.endTime : ''}</div>
                        <div class="activity-category">${categoryIcon}</div>
                    </div>
                `;
            });
            
            html += '</div>';
        }
        
        return html;
    }
    
    updateListView() {
        const userFilter = this.filterUser?.value || 'all';
        const categoryFilter = this.filterCategory?.value || 'all';
        const timeFilter = this.filterTime?.value || 'all';
        
        let filteredActivities = [...this.activities];
        
        // Apply filters
        if (userFilter !== 'all') {
            filteredActivities = filteredActivities.filter(activity => activity.user === userFilter);
        }
        
        if (categoryFilter !== 'all') {
            filteredActivities = filteredActivities.filter(activity => activity.category === categoryFilter);
        }
        
        // Time filter - Fix timezone issues
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const today = `${year}-${month}-${day}`;
        
        const tomorrowDate = new Date(now);
        tomorrowDate.setDate(tomorrowDate.getDate() + 1);
        const tomorrowYear = tomorrowDate.getFullYear();
        const tomorrowMonth = String(tomorrowDate.getMonth() + 1).padStart(2, '0');
        const tomorrowDay = String(tomorrowDate.getDate()).padStart(2, '0');
        const tomorrow = `${tomorrowYear}-${tomorrowMonth}-${tomorrowDay}`;
        
        if (timeFilter === 'today') {
            filteredActivities = filteredActivities.filter(activity => activity.date === today);
        } else if (timeFilter === 'tomorrow') {
            filteredActivities = filteredActivities.filter(activity => activity.date === tomorrow);
        } else if (timeFilter === 'week') {
            const weekStart = new Date(this.currentWeek);
            weekStart.setHours(0, 0, 0, 0);
            const dayOfWeek = weekStart.getDay();
            weekStart.setDate(weekStart.getDate() - dayOfWeek);
            
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            
            filteredActivities = filteredActivities.filter(activity => {
                const activityDate = new Date(activity.date + 'T00:00:00');
                return activityDate >= weekStart && activityDate <= weekEnd;
            });
        } else if (timeFilter === 'upcoming') {
            const todayStart = new Date(now);
            todayStart.setHours(0, 0, 0, 0);
            filteredActivities = filteredActivities.filter(activity => {
                const activityDate = new Date(activity.date + 'T00:00:00');
                return activityDate >= todayStart;
            });
        }
        
        // Sort activities
        filteredActivities.sort((a, b) => {
            const dateA = new Date(`${a.date}T${a.startTime}`);
            const dateB = new Date(`${b.date}T${b.startTime}`);
            return dateA - dateB;
        });
        
        this.displayActivitiesList(filteredActivities);
    }
    
    displayActivitiesList(activities) {
        if (activities.length === 0) {
            this.activitiesList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📅</div>
                    <div class="empty-state-text">No hay actividades</div>
                    <div class="empty-state-subtext">Agrega nuevas actividades usando el formulario de arriba</div>
                </div>
            `;
            return;
        }
        
        const html = activities.map(activity => {
            // Parse date correctly without timezone issues
            const dateParts = activity.date.split('-');
            const year = parseInt(dateParts[0]);
            const month = parseInt(dateParts[1]) - 1; // Month is 0-indexed
            const day = parseInt(dateParts[2]);
            const activityDate = new Date(year, month, day);
            
            const formattedDate = activityDate.toLocaleDateString('es-ES', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric' 
            });
            
            const categoryIcon = this.getCategoryIcon(activity.category);
            const categoryClass = `category-${activity.category}`;
            
            return `
                <div class="activity-card ${activity.user} ${categoryClass}">
                    <div class="activity-info">
                        <div class="activity-title">${activity.title}</div>
                        <div class="activity-details">
                            <span>📅 ${formattedDate}</span>
                            <span>⏰ ${activity.startTime}${activity.endTime !== activity.startTime ? ' - ' + activity.endTime : ''}</span>
                        </div>
                        <div class="activity-meta">
                            <span class="activity-user ${activity.user}">${activity.user === 'juan' ? '👨 Juan' : '👩 Ana'}</span>
                            <span class="activity-category-badge">${categoryIcon} ${this.getCategoryName(activity.category)}</span>
                        </div>
                        ${activity.description ? `<div class="activity-description">${activity.description}</div>` : ''}
                    </div>
                    <div class="activity-actions">
                        <button class="edit-activity" onclick="window.weeklyPlanner.editActivity(${activity.id})">
                            ✏️
                        </button>
                        <button class="delete-activity" onclick="window.weeklyPlanner.deleteActivity(${activity.id})">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        
        this.activitiesList.innerHTML = html;
    }
    
    updateStatistics() {
        const total = this.activities.length;
        const juan = this.activities.filter(a => a.user === 'juan').length;
        const ana = this.activities.filter(a => a.user === 'ana').length;
        
        // Calculate shared activities (activities on the same day)
        const sharedDays = new Set();
        const juanDates = new Set(this.activities.filter(a => a.user === 'juan').map(a => a.date));
        const anaDates = new Set(this.activities.filter(a => a.user === 'ana').map(a => a.date));
        
        juanDates.forEach(date => {
            if (anaDates.has(date)) {
                sharedDays.add(date);
            }
        });
        
        this.totalActivitiesEl.textContent = total;
        this.juanActivitiesEl.textContent = juan;
        this.anaActivitiesEl.textContent = ana;
        this.sharedActivitiesEl.textContent = sharedDays.size;
    }
    
    getCategoryIcon(category) {
        const icons = {
            personal: '💕',
            study: '📚',
            work: '💼',
            date: '🌹',
            fitness: '💪',
            social: '👥',
            other: '🔸'
        };
        return icons[category] || icons.other;
    }
    
    getCategoryName(category) {
        const names = {
            personal: 'Personal',
            study: 'Estudio',
            work: 'Trabajo',
            date: 'Cita',
            fitness: 'Ejercicio',
            social: 'Social',
            other: 'Otro'
        };
        return names[category] || names.other;
    }
    
    clearForm() {
        this.activityInput.value = '';
        this.activityDescription.value = '';
        
        // Reset to current date and time - Fix timezone issues
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        this.activityDate.value = `${year}-${month}-${day}`;
        
        const startTime = new Date(now.getTime() + 60 * 60 * 1000);
        const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
        
        this.activityStartTime.value = startTime.toTimeString().slice(0, 5);
        this.activityEndTime.value = endTime.toTimeString().slice(0, 5);
    }
    
    playActivitySound(type) {
        try {
            const soundId = type === 'add' ? 'addActivitySound' : 'deleteActivitySound';
            const audio = document.getElementById(soundId);
            if (audio) {
                audio.currentTime = 0;
                audio.play().catch(e => console.log('Sound play failed:', e));
            } else {
                // Fallback: create beep sound
                this.createBeepSound(type === 'add' ? [800, 1000] : [400, 200]);
            }
        } catch (error) {
            console.log('Sound error:', error);
        }
    }
    
    createBeepSound(frequencies) {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            frequencies.forEach((freq, index) => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.setValueAtTime(freq, audioContext.currentTime + index * 0.1);
                gainNode.gain.setValueAtTime(0.1, audioContext.currentTime + index * 0.1);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + index * 0.1 + 0.1);
                
                oscillator.start(audioContext.currentTime + index * 0.1);
                oscillator.stop(audioContext.currentTime + index * 0.1 + 0.1);
            });
        } catch (error) {
            console.log('Beep sound error:', error);
        }
    }
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Trigger animation
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        // Remove notification
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
    
    showActivityDetails(id) {
        const activity = this.activities.find(a => a.id === id);
        if (!activity) return;
        
        // Parse date correctly without timezone issues
        const dateParts = activity.date.split('-');
        const year = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]) - 1; // Month is 0-indexed
        const day = parseInt(dateParts[2]);
        const activityDate = new Date(year, month, day);
        
        // For now, just show an alert with activity details
        const details = `
            📝 ${activity.title}
            👤 ${activity.user === 'juan' ? 'Juan' : 'Ana'}
            📅 ${activityDate.toLocaleDateString('es-ES')}
            ⏰ ${activity.startTime}${activity.endTime !== activity.startTime ? ' - ' + activity.endTime : ''}
            🏷️ ${this.getCategoryName(activity.category)}
            ${activity.description ? '\n📄 ' + activity.description : ''}
        `;
        
        alert(details);
    }
    
    editActivity(id) {
        const activity = this.activities.find(a => a.id === id);
        if (!activity) return;
        
        // Fill form with activity data
        this.userSelect.value = activity.user;
        this.activityInput.value = activity.title;
        this.activityDate.value = activity.date;
        this.activityStartTime.value = activity.startTime;
        this.activityEndTime.value = activity.endTime;
        this.activityCategory.value = activity.category;
        this.activityDescription.value = activity.description || '';
        
        // Remove the activity (it will be re-added when form is submitted)
        this.deleteActivity(id);
        
        // Scroll to form
        document.querySelector('.add-activity-form').scrollIntoView({ behavior: 'smooth' });
    }
    
    async saveActivities() {
        try {
            if (window.db && collection && addDoc) {
                const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
                await setDoc(doc(window.db, 'planner', 'activities'), {
                    activities: this.activities,
                    lastUpdated: new Date().toISOString()
                });
                console.log('✅ Actividades sincronizadas con Firebase');
            } else {
                localStorage.setItem('planner_activities', JSON.stringify(this.activities));
                console.log('📱 Actividades guardadas localmente');
            }
        } catch (error) {
            console.log('Guardando en localStorage como respaldo:', error);
            localStorage.setItem('planner_activities', JSON.stringify(this.activities));
        }
    }
    
    async loadActivities() {
        try {
            if (window.db && collection && onSnapshot) {
                const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
                const docSnap = await getDoc(doc(window.db, 'planner', 'activities'));
                
                if (docSnap.exists()) {
                    this.activities = docSnap.data().activities || [];
                    console.log('✅ Actividades cargadas desde Firebase');
                } else {
                    this.activities = [];
                }
            } else {
                const stored = localStorage.getItem('planner_activities');
                this.activities = stored ? JSON.parse(stored) : [];
                console.log('📱 Actividades cargadas desde localStorage');
            }
        } catch (error) {
            console.log('Cargando desde localStorage como respaldo:', error);
            const stored = localStorage.getItem('planner_activities');
            this.activities = stored ? JSON.parse(stored) : [];
        }
        
        this.updateCurrentView();
        this.updateStatistics();
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    // Initialize theme first
    initializeTheme();
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
        themeBtn.addEventListener('click', toggleTheme);
    }
    // Initialize app immediately (no password protection)
    initializeApp();
    initializeFirebaseAndData();
    
    // Setup theme toggle event listener
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
    
    console.log('🎉 Aplicación inicializada sin protección por contraseña');
});

function initializeFirebaseAndData() {
    // Try to initialize Firebase, then load data
    setTimeout(() => {
        if (initializeFirebase()) {
            // Wait a bit more for Firebase imports to complete
            setTimeout(() => {
                loadMessagesFromFirebase();
                loadPhotosFromFirebase();
                
                // Initialize planner after Firebase is ready
                window.weeklyPlanner = new WeeklyPlanner();
            }, 1000);
        } else {
            // Fall back to local storage
            console.log('📱 Inicializando almacenamiento local...');
            loadSavedMessages();
            // Note: loadExistingPhotos() will be called when album section is opened
            
            // Initialize planner with local storage
            window.weeklyPlanner = new WeeklyPlanner();
        }
    }, 500);
}

function initializeApp() {
    // Show main app immediately
    document.getElementById('mainApp').classList.remove('hidden');
    
    // Menu navigation
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', function() {
            const section = this.getAttribute('data-section');
            showSection(section);
        });
    });

    // Back buttons
    const backButtons = document.querySelectorAll('.back-btn');
    backButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            showSection('menu');
        });
    });

    // Proposal section events
    const saveBtn = document.getElementById('saveMessage');
    const clearBtn = document.getElementById('clearMessage');
    if (saveBtn) saveBtn.addEventListener('click', saveMessage);
    if (clearBtn) clearBtn.addEventListener('click', clearMessage);

    // Album section events
    document.getElementById('photoInput').addEventListener('change', handlePhotoUpload);

    // Planner section events will be handled by the WeeklyPlanner class

    // Pomodoro section events
    document.getElementById('startTimer').addEventListener('click', startTimer);
    document.getElementById('pauseTimer').addEventListener('click', pauseTimer);
    document.getElementById('resetTimer').addEventListener('click', resetTimer);
    document.getElementById('testSound').addEventListener('click', testNotificationSound);
    document.getElementById('focusTime').addEventListener('change', updateTimerSettings);
    document.getElementById('breakTime').addEventListener('change', updateTimerSettings);

    // Initialize timer display
    updateTimerDisplay();
    
    // Load special message and start gerberas animation
    setTimeout(() => {
        loadSpecialMessage();
    }, 100);
    createFloatingGerberas();
}

function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.add('hidden');
    });

    // Hide menu
    if (sectionName !== 'menu') {
        document.querySelector('.menu').style.display = 'none';
        document.querySelector('.header').style.display = 'none';
        document.getElementById(sectionName).classList.remove('hidden');
        
        // Initialize planner when section is shown
        if (sectionName === 'planner' && window.weeklyPlanner) {
            window.weeklyPlanner.updateCurrentView();
            window.weeklyPlanner.updateStatistics();
        }
        
        // Load photos when album section is shown
        if (sectionName === 'album') {
            console.log('🌻 Cargando álbum de fotos...');
            // Always load to ensure proper initialization
            loadExistingPhotos();
        }
    } else {
        document.querySelector('.menu').style.display = 'grid';
        document.querySelector('.header').style.display = 'block';
    }

    currentSection = sectionName;
}

// === PROPOSAL SECTION === //
async function saveMessage() {
    const messageText = document.getElementById('specialMessage').value.trim();
    
    if (messageText === '') {
        alert('Por favor, escribe un mensaje antes de guardarlo.');
        return;
    }

    const message = {
        id: Date.now(),
        content: messageText,
        date: new Date().toLocaleString('es-ES')
    };

    // Save to Firebase first
    await saveMessageToFirebase(message);
    
    // Also save to localStorage as backup
    let savedMessages = JSON.parse(localStorage.getItem('specialMessages') || '[]');
    savedMessages.unshift(message);
    localStorage.setItem('specialMessages', JSON.stringify(savedMessages));
    
    // Clear the textarea
    document.getElementById('specialMessage').value = '';
    
    // Show success message
    showNotification('Mensaje guardado con éxito! ❤️ Sincronizado en la nube');
}

function clearMessage() {
    document.getElementById('specialMessage').value = '';
}

function loadSavedMessages() {
    const savedMessages = JSON.parse(localStorage.getItem('specialMessages') || '[]');
    const messagesList = document.getElementById('messagesList');
    
    if (savedMessages.length === 0) {
        messagesList.innerHTML = '<p style="color: #888; text-align: center; font-style: italic;">Aún no hay mensajes guardados.</p>';
        return;
    }
    
    messagesList.innerHTML = savedMessages.map(message => `
        <div class="saved-message">
            <div class="date">${message.date}</div>
            <div class="content">${message.content}</div>
            <button onclick="deleteMessage(${message.id})" style="background: #f44336; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; margin-top: 10px; font-size: 0.8em;">
                <i class="fas fa-trash"></i> Eliminar
            </button>
        </div>
    `).join('');
}

function deleteMessage(messageId) {
    if (confirm('¿Estás seguro de que quieres eliminar este mensaje?')) {
        let savedMessages = JSON.parse(localStorage.getItem('specialMessages') || '[]');
        savedMessages = savedMessages.filter(msg => msg.id !== messageId);
        localStorage.setItem('specialMessages', JSON.stringify(savedMessages));
        loadSavedMessages();
        showNotification('Mensaje eliminado.');
    }
}

// Display functions for Firebase data
function displayMessages(messages) {
    const messagesList = document.getElementById('messagesList');
    
    if (messages.length === 0) {
        messagesList.innerHTML = '<p style="color: #888; text-align: center; font-style: italic;">Aún no hay mensajes guardados.</p>';
        return;
    }
    
    messagesList.innerHTML = messages.map(message => `
        <div class="saved-message">
            <div class="date">${message.date}</div>
            <div class="content">${message.content}</div>
            <span class="sync-indicator" style="font-size: 0.8em; color: #4CAF50; margin-top: 5px; display: inline-block;">☁️ Sincronizado</span>
        </div>
    `).join('');
}

function displayPhotos(firebasePhotos) {
    const photoGrid = document.getElementById('photoGrid');
    
    // Only use Firebase photos now (no more local photos)
    const allPhotos = firebasePhotos;
    
    if (allPhotos.length === 0) {
        // The CSS will handle the empty state with gerberas message
        photoGrid.innerHTML = '';
        return;
    }
    
    // Store photos globally for viewer
    window.currentPhotos = allPhotos;
    console.log('🌻 Fotos cargadas desde Firebase:', allPhotos.length);
    
    // Generate HTML with proper event handling
    photoGrid.innerHTML = allPhotos.map((photo, index) => {
        const src = photo.data;
        return `
            <div class="photo-item" data-photo-index="${index}" style="cursor: pointer;">
                <img src="${src}" alt="${photo.name}" onerror="console.error('Error loading image:', '${src}'); this.parentElement.style.display='none';" loading="lazy" style="width: 100%; height: 200px; object-fit: cover; cursor: pointer;">
                <div class="photo-overlay">
                    <span class="sync-indicator" style="position: absolute; top: 5px; right: 5px; background: rgba(76, 175, 80, 0.8); color: white; padding: 2px 6px; border-radius: 10px; font-size: 0.7em;">☁️</span>
                    <button class="delete-photo" onclick="event.stopPropagation(); deletePhoto(${index}, '${photo.type}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    // Setup event listeners for all photos
    setupPhotoEventListeners();
}

// === ALBUM SECTION === //
function loadExistingPhotos() {
    // Album starts empty now - only show photos from Firebase or uploaded by user
    const photoGrid = document.getElementById('photoGrid');
    
    // Load saved photos from localStorage as fallback
    const savedPhotos = JSON.parse(localStorage.getItem('albumPhotos') || '[]');
    
    // Store photos globally for photo viewer
    window.currentPhotos = savedPhotos;
    
    console.log('🌻 Álbum inicializado vacío - listo para agregar fotos');
    
    if (savedPhotos.length === 0) {
        // The CSS will handle the empty state with gerberas message
        photoGrid.innerHTML = '';
        return;
    }
    
    photoGrid.innerHTML = savedPhotos.map((photo, index) => {
        const src = photo.data;
        return `
            <div class="photo-item" data-photo-index="${index}" style="cursor: pointer;">
                <img src="${src}" alt="${photo.name}" onerror="console.error('Error loading image:', '${src}'); this.parentElement.style.display='none';" loading="lazy" style="width: 100%; height: 200px; object-fit: cover; cursor: pointer;">
                <div class="photo-overlay">
                    <button class="delete-photo" onclick="event.stopPropagation(); deletePhoto(${index}, '${photo.type}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    // Setup event listeners
    setupPhotoEventListeners();
}

// Unified function to setup photo event listeners
function setupPhotoEventListeners() {
    setTimeout(() => {
        const photoGrid = document.getElementById('photoGrid');
        const photoItems = photoGrid.querySelectorAll('.photo-item');
        
        console.log('🔗 Configurando event listeners para', photoItems.length, 'fotos');
        
        photoItems.forEach((item, index) => {
            // Remove any existing listeners by cloning
            const newItem = item.cloneNode(true);
            item.parentNode.replaceChild(newItem, item);
            
            // Add click listener to the container
            newItem.addEventListener('click', (e) => {
                if (!e.target.closest('.delete-photo')) {
                    console.log('🖱️ Clic en foto índice:', index);
                    e.preventDefault();
                    e.stopPropagation();
                    window.openPhotoViewer(index);
                }
            });
            
            // Also add to the image directly
            const img = newItem.querySelector('img');
            if (img) {
                img.addEventListener('click', (e) => {
                    if (!e.target.closest('.delete-photo')) {
                        console.log('🖼️ Clic directo en imagen:', index);
                        e.preventDefault();
                        e.stopPropagation();
                        window.openPhotoViewer(index);
                    }
                });
            }
        });
    }, 300); // Increased timeout to ensure DOM is ready
}

async function handlePhotoUpload(event) {
    const files = event.target.files;
    
    if (files.length === 0) return;
    
    showNotification('🌻 Subiendo fotos a la nube... ⏳', 'info');
    
    let uploadedCount = 0;
    let totalFiles = files.length;
    
    for (const file of files) {
        if (file.type.startsWith('image/')) {
            try {
                const photoData = {
                    id: Date.now() + Math.random(),
                    data: null, // Will be set to Firebase URL
                    name: file.name,
                    type: 'firebase',
                    date: new Date().toISOString()
                };
                
                // Upload directly to Firebase Storage and Firestore
                const downloadURL = await uploadPhotoToFirebase({
                    ...photoData,
                    data: file // Send the file directly instead of data URL
                });
                
                uploadedCount++;
                showNotification(`🌻 ${uploadedCount}/${totalFiles} fotos subidas`, 'success');
                
            } catch (error) {
                console.error('Error uploading photo:', error);
                showNotification(`❌ Error subiendo ${file.name}`, 'error');
            }
        }
    }
    
    // Clear the input
    event.target.value = '';
    
    if (uploadedCount > 0) {
        showNotification(`🎉 ¡${uploadedCount} fotos agregadas al álbum! ☁️`, 'success');
    }
}

function deletePhoto(index, type) {
    if (confirm('¿Estás seguro de que quieres eliminar esta foto?')) {
        if (type === 'uploaded') {
            let savedPhotos = JSON.parse(localStorage.getItem('albumPhotos') || '[]');
            // Calculate the correct index for uploaded photos
            const existingPhotosCount = 2; // Number of existing photos
            const uploadedIndex = index - existingPhotosCount;
            if (uploadedIndex >= 0) {
                savedPhotos.splice(uploadedIndex, 1);
                localStorage.setItem('albumPhotos', JSON.stringify(savedPhotos));
            }
        }
        // Note: We can't actually delete existing files, so we just reload
        loadExistingPhotos();
        showNotification('Foto eliminada del álbum.');
    }
}

// === POMODORO SECTION === //
function startPomodoro() {
    const focusTime = parseInt(document.getElementById('focusTime').value) * 60;
    const breakTime = parseInt(document.getElementById('breakTime').value) * 60;
    const totalCycles = parseInt(document.getElementById('totalCycles').value);
    const timerDisplay = document.getElementById('timerDisplay');
    const timerMode = document.getElementById('timerMode');
    const currentCycle = document.getElementById('currentCycle');
    const targetCycles = document.getElementById('targetCycles');
    const progressBar = document.querySelector('.productivity-indicator');
    const soundSelect = document.getElementById('notificationSound');
    const currentDate = document.getElementById('currentDate');
  
    let remainingTime = focusTime;
  
    cycleCount = 0;
    currentCycle.textContent = cycleCount;
    targetCycles.textContent = totalCycles;
    isBreakTime = false; // 🟢 Asegura que inicie en concentración
  
    updateDisplay();
    updateProgressBar();
  
    function playSound() {
      const selectedSound = soundSelect.value;
      const audio = new Audio(`sounds/${selectedSound}.mp3`);
      audio.play().catch(err => console.warn("🔇 Sonido bloqueado por navegador: ", err));
    }
  
    function showNotification(message) {
      const notification = document.createElement("div");
      notification.className = "status-text connected";
      notification.textContent = message;
      document.body.appendChild(notification);
      setTimeout(() => {
        notification.remove();
      }, 3000);
    }
  
    function updateDisplay() {
      const minutes = Math.floor(remainingTime / 60);
      const seconds = remainingTime % 60;
      timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      timerMode.textContent = isBreakTime ? '☕ Descanso' : '📚 Concentración';
      const now = new Date();
      currentDate.textContent = now.toLocaleString('es-PE');
    }
  
    function updateProgressBar() {
        const progress = ((cycleCount + (isBreakTime ? 0.5 : 0)) / totalCycles) * 100;
        progressBar.style.width = `${progress}%`;
        progressBar.dataset.progress = `${Math.round(progress)}%`;
        const percentLabel = document.getElementById('progressPercent');
        if (percentLabel) {
            percentLabel.textContent = `${Math.round(progress)}%`;
        }
    }
  
    function switchMode() {
      isBreakTime = !isBreakTime;
      remainingTime = isBreakTime ? breakTime : focusTime;
      updateDisplay();
      updateProgressBar();
      playSound();
      showNotification(isBreakTime ? "🌿 Hora de un merecido descanso" : "🔥 A concentrarse con todo, tú puedes");
    }
  
    function startCycle(first = false) {
      if (!first) switchMode();
  
      timerInterval = setInterval(() => {
        remainingTime--;
        updateDisplay();
  
        const phaseDuration = isBreakTime ? breakTime : focusTime;
        const totalElapsedSeconds = (phaseDuration - remainingTime);
        const progressInPhase = (totalElapsedSeconds / phaseDuration) * 100;
        progressBar.style.width = `${progressInPhase}%`;
        progressBar.dataset.progress = `${Math.round(progressInPhase)}%`;
  
        if (remainingTime <= 0) {
          clearInterval(timerInterval);
          if (!isBreakTime) {
            cycleCount++;
            currentCycle.textContent = cycleCount;
          }
          if (cycleCount < totalCycles) {
            setTimeout(startCycle, 500);
          } else {
            timerMode.textContent = '🎉 Sesión Completa';
            timerDisplay.textContent = '00:00';
            progressBar.style.width = '100%';
            progressBar.dataset.progress = '100%';
            showNotification("🎯 ¡Todos los ciclos completados con éxito!");
            playSound();
          }
        }
      }, 1000);
    }
  
    startCycle(true); // ✅ Inicia directamente en concentración
  }
  
  document.getElementById('startTimer').addEventListener('click', startPomodoro);
  document.getElementById('pauseTimer').addEventListener('click', () => clearInterval(timerInterval));
  document.getElementById('resetTimer').addEventListener('click', () => location.reload());

//MODIFICACION CHATGPT  

function updateTimerSettings() {
    if (!isTimerRunning) {
        targetCycles = parseInt(document.getElementById('totalCycles').value) || targetCycles;
        pomodoroCycle = 0;
        document.getElementById('targetCycles').textContent = targetCycles;
        document.getElementById('currentCycle').textContent = `${pomodoroCycle}/${targetCycles}`;
        resetTimer();
        updateTimerDisplay();
    }
}

function updateTimerDisplay() {
    const focusTimeInMinutes = parseInt(document.getElementById('focusTime').value);
    const breakTimeInMinutes = parseInt(document.getElementById('breakTime').value);
    const focusTimeInSeconds = focusTimeInMinutes * 60;
    const breakTimeInSeconds = breakTimeInMinutes * 60;
    const totalTimeInSeconds = focusTimeInSeconds + breakTimeInSeconds;
    
    if (timeRemaining === 0) {
        timeRemaining = isBreakTime ? breakTimeInSeconds : focusTimeInSeconds;
    }
    
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    
    document.getElementById('timerDisplay').textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    document.getElementById('timerMode').textContent = isBreakTime ? 'Descanso' : 'Concentración';
    
    // Actualizar barra de progreso de productividad
    
    const productivityBar = document.querySelector('.productivity-indicator');
    const progressText = document.querySelector('.productivity-indicator-text');
    
    if (isBreakTime) {
        const focusProgress = '100%';
        const breakProgress = `${((breakTimeInSeconds - timeRemaining) / breakTimeInSeconds) * 100}%`;
        productivityBar.style.setProperty('--focus-progress', focusProgress);
        productivityBar.style.setProperty('--break-progress', breakProgress);
        progressText.textContent = `Descanso: ${Math.round((timeRemaining / breakTimeInSeconds) * 100)}%`;
    } else {
        const focusProgress = `${((focusTimeInSeconds - timeRemaining) / focusTimeInSeconds) * 100}%`;
        const breakProgress = '0%';
        productivityBar.style.setProperty('--focus-progress', focusProgress);
        productivityBar.style.setProperty('--break-progress', breakProgress);
        progressText.textContent = `Concentración: ${Math.round((timeRemaining / focusTimeInSeconds) * 100)}%`;
    }
    
    document.getElementById('currentCycle').textContent = `${pomodoroCycle}/${targetCycles}`;

    // Actualizar fecha
    const now = new Date();
    const dateOptions = { weekday: 'long', day: 'numeric', month: 'long' };
    document.getElementById('currentDate').textContent = now.toLocaleDateString('es-ES', dateOptions);
    
    const timerCircle = document.querySelector('.timer-circle');
    timerCircle.className = 'timer-circle';
    if (isTimerRunning) {
        timerCircle.classList.add('active');
    }
    if (isBreakTime) {
        timerCircle.classList.add('break');
    }
}

function startNextPhase() {
    clearInterval(timer);
    isTimerRunning = false;
    startTime = null;
    pausedTime = null;
    
    // Play notification sound
    playNotificationSound();
    
    if (!isBreakTime) {
        // Cambiar a tiempo de descanso
        isBreakTime = true;
        showNotification('¡Tiempo de concentración completado! Ahora toca descansar. 🎉');
        timeRemaining = parseInt(document.getElementById('breakTime').value) * 60;
        startTimer();
    } else {
        // Cambiar a tiempo de concentración
        isBreakTime = false;
        pomodoroCycle++;
        
        if (pomodoroCycle >= targetCycles) {
            showNotification(`🎉 ¡Felicitaciones! Has completado todos tus ${targetCycles} ciclos de estudio. ¡Tómate un buen descanso! 🌟`);
            resetTimer();
            return;
        }
        
        showNotification(`¡Excelente! Has completado ${pomodoroCycle} de ${targetCycles} ciclos. ¡Sigamos adelante! 💪`);
        document.getElementById('currentCycle').textContent = `${pomodoroCycle}/${targetCycles}`;
        timeRemaining = parseInt(document.getElementById('focusTime').value) * 60;
        startTimer();
    }
}

function startTimer() {
    if (isTimerRunning) return;
    
    const focusTimeInMinutes = parseInt(document.getElementById('focusTime').value);
    const breakTimeInMinutes = parseInt(document.getElementById('breakTime').value);
    const totalSeconds = isBreakTime ? breakTimeInMinutes * 60 : focusTimeInMinutes * 60;
    
    if (timeRemaining === 0 || timeRemaining === undefined) {
        timeRemaining = totalSeconds;
    }

    isTimerRunning = true;
    startTime = Date.now() - ((totalSeconds - timeRemaining) * 1000);
    
    timer = setInterval(() => {
        const currentTime = Date.now();
        const elapsedSeconds = Math.floor((currentTime - startTime) / 1000);
        timeRemaining = Math.max(0, totalSeconds - elapsedSeconds);
        updateTimerDisplay();
        
        if (timeRemaining <= 0) {
            clearInterval(timer);
            startNextPhase();
        }
    }, 100);
    
    updateTimerDisplay();
}

function pauseTimer() {
    if (!isTimerRunning) return;
    
    isTimerRunning = false;
    clearInterval(timer);
    pausedTime = timeRemaining;
    startTime = null;
    updateTimerDisplay();
}

function resetTimer() {
    isTimerRunning = false;
    pomodoroCycle = 0;
    document.getElementById('currentCycle').textContent = `0/${targetCycles}`;
    clearInterval(timer);
    timeRemaining = 0;
    isBreakTime = false;
    startTime = null;
    pausedTime = null;
    updateTimerDisplay();
}

function playNotificationSound() {
    const soundType = document.getElementById('notificationSound').value;
    
    // Create audio context for different sounds
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Different sound frequencies based on selection
    const frequencies = {
        bell: [800, 600, 400],
        chime: [523, 659, 784],
        soft: [440, 554, 659],
        nature: [220, 277, 330]
    };
    
    const freqs = frequencies[soundType] || frequencies.bell;
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    
    freqs.forEach((freq, index) => {
        setTimeout(() => {
            oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
        }, index * 200);
    });
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.8);
}

function testNotificationSound() {
    playNotificationSound();
}

// === UTILITY FUNCTIONS === //
function showNotification(message, type = 'success') {
    // Create notification element
    const notification = document.createElement('div');
    
    // Set background color based on type
    const colors = {
        success: '#4CAF50',
        error: '#f44336',
        warning: '#ff9800',
        info: '#2196F3'
    };
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colors[type] || colors.success};
        color: white;
        padding: 15px 25px;
        border-radius: 10px;
        z-index: 1000;
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease;
        max-width: 350px;
        font-weight: 500;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Add slide-in animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => {
            document.body.removeChild(notification);
            document.head.removeChild(style);
        }, 300);
    }, 3000);
}

// === GERBERAS ANIMATION === //
// Load special message from txt file
async function loadSpecialMessage() {
    try {
        const response = await fetch('./mensaje-para-ana.txt');
        if (response.ok) {
            const messageText = await response.text();
            // Replace the letter content with the loaded message
            const letterContent = document.querySelector('.letter-content');
            if (letterContent && messageText.trim()) {
                // Clean the text and split into paragraphs
                const cleanText = messageText.replace(/\r/g, '').trim();
                const paragraphs = cleanText.split('\n\n').filter(p => p.trim());
                
                if (paragraphs.length > 0) {
                    let formattedMessage = '';
                    
                    paragraphs.forEach((paragraph, index) => {
                        const cleanParagraph = paragraph.trim();
                        if (cleanParagraph.includes('Quieres ser mi novia') || cleanParagraph.includes('¿Quieres ser mi novia?')) {
                            formattedMessage += `
                                <div class="big-question">
                                    <h2 class="question-text">¿${cleanParagraph.replace('Quieres', '')}?</h2>
                                    <div class="question-buttons">
                                        <button id="yesButton" class="answer-btn yes-btn">💕 ¡SÍ! 💕</button>
                                        <button id="noButton" class="answer-btn no-btn">💔 No...</button>
                                    </div>
                                </div>
                            `;
                        } else if (cleanParagraph.includes('Con todo mi amor') || cleanParagraph.includes('Tu Juan')) {
                            formattedMessage += `
                                <p class="letter-paragraph signature">
                                    ${cleanParagraph.replace('Tu Juan', '<br><span class="signature-name">Tu Juan 💝</span>')}
                                </p>
                            `;
                        } else {
                            const highlightedText = cleanParagraph.replace(/Ana/g, '<span class="highlight">Ana</span>')
                                                            .replace(/gerberas/g, '<span class="highlight">🌻 gerberas 🌻</span>');
                            formattedMessage += `<p class="letter-paragraph">${highlightedText}</p>`;
                        }
                    });
                    
                    letterContent.innerHTML = formattedMessage;
                    console.log('✅ Mensaje especial cargado desde archivo');
                    
                    // Re-attach event listeners for answer buttons
                    setupProposalEventListeners();
                    return;
                }
            }
        }
    } catch (error) {
        console.log('ℹ️ No se pudo cargar el mensaje especial desde archivo:', error);
    }
    
    // Fallback: keep the default message and setup event listeners
    console.log('📝 Usando mensaje predeterminado');
    setupProposalEventListeners();
}

// Setup proposal event listeners
function setupProposalEventListeners() {
    const yesButton = document.getElementById('yesButton');
    const noButton = document.getElementById('noButton');
    const responseArea = document.getElementById('responseArea');
    
    if (yesButton) {
        yesButton.addEventListener('click', function() {
            responseArea.className = 'response-area yes-response';
            responseArea.innerHTML = `
                <h3>¡Sí Acepto! 💕</h3>
                <p>¡Este es el momento más feliz de mi vida! 🌻💖</p>
                <div class="hearts-animation">
                    <span class="heart">💖</span>
                    <span class="heart">🌻</span>
                    <span class="heart">💕</span>
                    <span class="heart">🌺</span>
                    <span class="heart">💝</span>
                </div>
            `;
            responseArea.classList.remove('hidden');
            createGerberaExplosion();
        });
    }
    
    if (noButton) {
        noButton.addEventListener('click', function() {
            responseArea.className = 'response-area no-response';
            responseArea.innerHTML = `
                <h3>Entiendo... 💙</h3>
                <p>Respeto tu decisión y siempre seré tu amigo.</p>
            `;
            responseArea.classList.remove('hidden');
        });
    }
}

// Create floating gerberas animation
function createFloatingGerberas() {
    const container = document.getElementById('gerberasContainer');
    if (!container) return;

    const gerberas = ['🌻', '🌺', '🌼', '🌷', '🌸'];
    const totalGerberas = 25;
    const activeGerberas = [];

    class Gerbera {
        constructor() {
            this.el = document.createElement('div');
            this.el.className = 'gerbera-float';
            this.el.textContent = gerberas[Math.floor(Math.random() * gerberas.length)];
            container.appendChild(this.el);

            this.size = 48 + Math.random() * 24; // Tamaño base
            this.x = Math.random() * (window.innerWidth - this.size);
            this.y = Math.random() * (window.innerHeight - this.size);
            this.vx = (Math.random() - 0.5) * 1.2; // velocidad X
            this.vy = (Math.random() - 0.5) * 1.2; // velocidad Y
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;

            // Rebote horizontal
            if (this.x <= 0 || this.x >= window.innerWidth - this.size) {
                this.vx *= -1;
            }

            // Rebote vertical
            if (this.y <= 0 || this.y >= window.innerHeight - this.size) {
                this.vy *= -1;
            }

            this.el.style.transform = `translate(${this.x}px, ${this.y}px)`;
        }

        destroy() {
            this.el.remove();
        }
    }

    // Crear las 25 gerberas iniciales
    for (let i = 0; i < totalGerberas; i++) {
        activeGerberas.push(new Gerbera());
    }

    // Animación global
    function animateAll() {
        activeGerberas.forEach(g => g.update());
        requestAnimationFrame(animateAll);
    }

    animateAll();
}




// Create gerbera explosion effect
function createGerberaExplosion() {
    const container = document.getElementById('gerberasContainer');
    if (!container) return;
    
    const gerberas = ['🌻', '🌺', '🌼', '🌷', '🌸', '💖', '💕', '💝'];
    
    for (let i = 0; i < 20; i++) {
        const gerbera = document.createElement('div');
        gerbera.textContent = gerberas[Math.floor(Math.random() * gerberas.length)];
        gerbera.style.position = 'fixed';
        gerbera.style.left = '50%';
        gerbera.style.top = '50%';
        gerbera.style.fontSize = '2em';
        gerbera.style.pointerEvents = 'none';
        gerbera.style.zIndex = '1000';
        
        const angle = (i / 20) * 2 * Math.PI;
        const distance = Math.random() * 300 + 100;
        const finalX = Math.cos(angle) * distance;
        const finalY = Math.sin(angle) * distance;
        
        gerbera.style.transform = `translate(-50%, -50%)`;
        container.appendChild(gerbera);
        
        // Animate explosion
        setTimeout(() => {
            gerbera.style.transition = 'all 2s ease-out';
            gerbera.style.transform = `translate(${finalX}px, ${finalY}px) rotate(${Math.random() * 720}deg) scale(0)`;
            gerbera.style.opacity = '0';
        }, 50);
        
        // Remove after animation
        setTimeout(() => {
            if (gerbera.parentNode) {
                gerbera.parentNode.removeChild(gerbera);
            }
        }, 2500);
    }
}

// === PHOTO VIEWER FUNCTIONALITY === //
let currentPhotoIndex = 0;
let currentZoom = 1;
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let imagePos = { x: 0, y: 0 };

window.openPhotoViewer = function(index) {
    console.log('Opening photo viewer for index:', index);
    console.log('Available photos:', window.currentPhotos);
    
    if (!window.currentPhotos || window.currentPhotos.length === 0) {
        console.error('No photos available!');
        return;
    }
    
    currentPhotoIndex = index;
    const modal = document.getElementById('photoViewerModal');
    const photo = window.currentPhotos[index];
    
    if (!photo) {
        console.error('No photo found at index:', index);
        return;
    }
    
    console.log('Photo data:', photo);
    
    // Set image
    const img = document.getElementById('photoViewerImage');
    img.src = photo.data;
    
    // Set photo info
    document.getElementById('photoViewerTitle').textContent = photo.name || `Foto ${index + 1}`;
    const date = photo.date ? new Date(photo.date).toLocaleDateString('es-ES') : 'Fecha desconocida';
    document.getElementById('photoViewerDate').textContent = date;
    
    // Generate consistent photo ID
    const photoId = generatePhotoId(photo, index);
    console.log('🆔 Generated photo ID for comments:', photoId);
    
    // Store current photo ID globally for comments
    window.currentPhotoId = photoId;
    
    // Load comments for this specific photo
    loadPhotoComments(photoId);
    
    
    // Show modal
    modal.classList.add('active');
    
    // Reset zoom and position
    resetZoom();
    
    
    // Update navigation buttons
    updateNavigationButtons();
    
    // Setup image dragging
    setupImageDragging();
}

window.closePhotoViewer = function() {
    const modal = document.getElementById('photoViewerModal');
    modal.classList.remove('active');
    currentZoom = 1;
    imagePos = { x: 0, y: 0 };
}

window.navigatePhoto = function(direction) {
    const newIndex = currentPhotoIndex + direction;
    
    if (newIndex >= 0 && newIndex < window.currentPhotos.length) {
        window.openPhotoViewer(newIndex);
    }
}

function updateNavigationButtons() {
    const prevBtn = document.getElementById('prevPhotoBtn');
    const nextBtn = document.getElementById('nextPhotoBtn');
    
    prevBtn.disabled = currentPhotoIndex === 0;
    nextBtn.disabled = currentPhotoIndex === window.currentPhotos.length - 1;
}

window.zoomPhoto = function(delta) {
    const prevZoom = currentZoom;
    currentZoom += delta;
    currentZoom = Math.max(0.5, Math.min(5, currentZoom)); // Increase max zoom to 5x
    
    const img = document.getElementById('photoViewerImage');
    
    // Smooth zoom transition with easing
    img.style.transition = 'transform 0.2s ease-out';
    img.style.transform = `translate(${imagePos.x}px, ${imagePos.y}px) scale(${currentZoom})`;
    
    // Reset transition after animation
    setTimeout(() => {
        img.style.transition = 'none';
    }, 200);
    
    // Update cursor based on zoom level
    if (currentZoom > 1) {
        img.style.cursor = 'grab';
        img.classList.add('zoomed');
    } else {
        img.style.cursor = 'zoom-in';
        img.classList.remove('zoomed');
    }
    
    // Update zoom indicator
    updateZoomIndicator();
}

window.resetZoom = function() {
    currentZoom = 1;
    imagePos = { x: 0, y: 0 };
    
    const img = document.getElementById('photoViewerImage');
    img.style.transition = 'transform 0.3s ease';
    img.style.transform = 'translate(0px, 0px) scale(1)';
    img.style.cursor = 'zoom-in';
    img.classList.remove('zoomed');
    
    // Reset transition after animation
    setTimeout(() => {
        img.style.transition = 'none';
    }, 300);
    
    // Update zoom indicator
    updateZoomIndicator();
}

function setupImageDragging() {
    const img = document.getElementById('photoViewerImage');
    
    img.addEventListener('mousedown', (e) => {
        if (currentZoom > 1) {
            isDragging = true;
            dragStart.x = e.clientX - imagePos.x;
            dragStart.y = e.clientY - imagePos.y;
            img.style.cursor = 'grabbing';
        }
    });
    
    document.addEventListener('mousemove', (e) => {
        if (isDragging && currentZoom > 1) {
            imagePos.x = e.clientX - dragStart.x;
            imagePos.y = e.clientY - dragStart.y;
            
            img.style.transform = `translate(${imagePos.x}px, ${imagePos.y}px) scale(${currentZoom})`;
        }
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
        img.style.cursor = 'grab';
    });
    
    // Add wheel zoom functionality
    const imageContainer = document.querySelector('.photo-viewer-image-container');
    imageContainer.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomDelta = e.deltaY > 0 ? -0.2 : 0.2;
        window.zoomPhoto(zoomDelta);
    });
}

// === PHOTO COMMENTS FUNCTIONALITY === //
function loadPhotoComments(photoId) {
    console.log('🔍 Cargando comentarios para foto:', photoId);
    
    if (!photoId) {
        console.error('❌ PhotoId no válido:', photoId);
        displayComments([]);
        return;
    }
    
    // Try to load from Firebase first, fallback to localStorage
    if (window.db) {
        loadCommentsFromFirebase(photoId);
    } else {
        loadCommentsFromLocalStorage(photoId);
    }
}

function loadCommentsFromFirebase(photoId) {
    try {
        console.log('📸 Intentando cargar comentarios para foto:', photoId);
        
        if (!window.db) {
            console.log('⚠️ Firebase no disponible, usando localStorage');
            loadCommentsFromLocalStorage(photoId);
            return;
        }
        
        // Import Firebase functions dynamically
        import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js').then(module => {
            const { collection, query, where, orderBy, onSnapshot, getDocs } = module;
            
            // Create query for this specific photo
            const commentsRef = collection(window.db, 'photo_comments');
            const q = query(
                commentsRef,
                where('photoId', '==', photoId),
                orderBy('timestamp', 'asc')
            );
            
            // Listen for real-time updates
            onSnapshot(q, (snapshot) => {
                const firebaseComments = [];
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    firebaseComments.push({
                        id: data.id || doc.id,
                        user: data.user,
                        text: data.text,
                        date: data.timestamp ? data.timestamp.toDate().toISOString() : data.date
                    });
                });
                
                console.log(`📸 Comentarios cargados desde Firebase para foto ${photoId}:`, firebaseComments.length);
                
                // Also save to localStorage as backup
                localStorage.setItem(`photo_comments_${photoId}`, JSON.stringify(firebaseComments));
                
                // Display comments
                displayComments(firebaseComments);
            }, (error) => {
                console.error('Error en onSnapshot:', error);
                loadCommentsFromLocalStorage(photoId);
            });
        }).catch(error => {
            console.error('Error importing Firebase modules:', error);
            loadCommentsFromLocalStorage(photoId);
        });
    } catch (error) {
        console.error('Error loading comments from Firebase:', error);
        loadCommentsFromLocalStorage(photoId);
    }
}

function loadCommentsFromLocalStorage(photoId) {
    console.log('📂 Cargando comentarios desde localStorage para foto:', photoId);
    const comments = JSON.parse(localStorage.getItem(`photo_comments_${photoId}`) || '[]');
    console.log('📂 Found', comments.length, 'comentarios en localStorage');
    displayComments(comments);
}

// Generate consistent photo ID based on photo properties
function generatePhotoId(photo, index) {
    // Strategy 1: Use photo name if available (most reliable)
    if (photo.name && photo.name.trim()) {
        return photo.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    }
    
    // Strategy 2: Use data hash for uploaded photos
    if (photo.data && photo.data.length > 100) {
        // Create a simple hash from the base64 data
        const dataStr = photo.data.substring(50, 100); // Take middle section
        let hash = 0;
        for (let i = 0; i < dataStr.length; i++) {
            const char = dataStr.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return `photo_hash_${Math.abs(hash)}`;
    }
    
    // Strategy 3: Use timestamp if available
    if (photo.date) {
        const timestamp = new Date(photo.date).getTime();
        return `photo_date_${timestamp}`;
    }
    
    // Strategy 4: Use file size as additional identifier
    if (photo.data) {
        const size = photo.data.length;
        return `photo_size_${size}_${index}`;
    }
    
    // Fallback: Use index with current date for uniqueness
    return `photo_index_${index}_${Date.now()}`;
}

function displayComments(comments) {
    const commentsList = document.getElementById('commentsList');
    
    if (!commentsList) {
        console.error('❌ Comments list element not found!');
        return;
    }
    
    console.log('🎨 Displaying', comments.length, 'comments for photo:', window.currentPhotoId);
    
    if (comments.length === 0) {
        commentsList.innerHTML = `
            <div class="no-comments">
                <div style="font-size: 2em; margin-bottom: 10px;">🌻</div>
                <p>¡Sé el primero en comentar esta hermosa foto!</p>
                <p style="font-size: 0.9em; opacity: 0.8; margin-top: 5px;">Comparte lo que piensas sobre este momento especial 💕</p>
            </div>
        `;
        return;
    }
    
    commentsList.innerHTML = comments.map((comment, index) => {
        const userClass = comment.user === 'juan' ? 'juan' : '';
        const userIcon = comment.user === 'juan' ? '👨' : '👩';
        const userName = comment.user === 'juan' ? 'Juan' : 'Ana';
        const date = new Date(comment.date).toLocaleString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Add animation for new comments
        const isNew = index === comments.length - 1;
        const animationClass = isNew ? 'new-comment' : 'fade-cycle';
        
        return `
            <div class="comment-item ${userClass} ${animationClass}" data-comment-id="${comment.id}">
                <div class="comment-header">
                    <span class="comment-user ${userClass}">${userIcon} ${userName}</span>
                    <span class="comment-date">${date}</span>
                </div>
                <div class="comment-text">${escapeHtml(comment.text)}</div>
            </div>
        `;
    }).join('');
    
    // Auto-scroll to show latest comment
    setTimeout(() => {
        commentsList.scrollTop = commentsList.scrollHeight;
    }, 100);
    
    // Start fade animations for older comments
    setTimeout(() => {
        const oldComments = commentsList.querySelectorAll('.fade-cycle');
        oldComments.forEach((item, index) => {
            setTimeout(() => {
                if (typeof startCommentFadeCycle === 'function') {
                    startCommentFadeCycle(item);
                }
            }, index * 500);
        });
    }, 1000);
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.addComment = async function() {
    // Check if we have a current photo
    if (!window.currentPhotoId) {
        showNotification('❌ No hay foto seleccionada para comentar', 'error');
        return;
    }
    
    const user = document.getElementById('commentUser').value;
    const text = document.getElementById('commentText').value.trim();
    
    if (!text) {
        showNotification('📝 Por favor escribe un comentario', 'warning');
        return;
    }
    
    const comment = {
        id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user,
        text,
        date: new Date().toISOString(),
        photoId: window.currentPhotoId
    };
    
    console.log('💬 Adding comment to photo:', window.currentPhotoId, comment);
    
    // Save to localStorage immediately for instant feedback
    const comments = JSON.parse(localStorage.getItem(`photo_comments_${window.currentPhotoId}`) || '[]');
    comments.push(comment);
    localStorage.setItem(`photo_comments_${window.currentPhotoId}`, JSON.stringify(comments));
    
    // Update display immediately
    displayComments(comments);
    
    // Try to save to Firebase in background
    try {
        await saveCommentToFirebase(window.currentPhotoId, comment);
        console.log('👍 Comment saved to Firebase');
    } catch (error) {
        console.warn('⚠️ Failed to save to Firebase, using localStorage only:', error);
        showNotification('⚠️ Comentario guardado localmente', 'warning');
    }
    
    // Clear form
    document.getElementById('commentText').value = '';
    
    // Show success message
    showNotification('💕 Comentario agregado con amor', 'success');
}

async function saveCommentToFirebase(photoId, comment) {
    try {
        if (!window.db) {
            console.log('⚠️ Firebase no disponible para guardar comentario');
            return false;
        }
        
        // Import Firebase functions dynamically
        const { collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        const commentData = {
            photoId,
            id: comment.id,
            user: comment.user,
            text: comment.text,
            date: comment.date,
            timestamp: serverTimestamp()
        };
        
        await addDoc(collection(window.db, 'photo_comments'), commentData);
        console.log('💬 Comentario guardado en Firebase para foto:', photoId);
        showNotification('☁️ Comentario sincronizado en la nube', 'success');
        return true;
    } catch (error) {
        console.error('Error saving comment to Firebase:', error);
        showNotification('⚠️ Error sincronizando comentario, guardado localmente', 'warning');
        return false;
    }
}

// Function to start fade cycle animation for comments
function startCommentFadeCycle(element) {
    let cycleCount = 0;
    const maxCycles = 3; // Number of fade cycles
    
    function performFadeCycle() {
        if (cycleCount >= maxCycles) {
            // End with a subtle glow
            element.style.boxShadow = '0 0 10px rgba(214, 51, 132, 0.3)';
            setTimeout(() => {
                element.style.boxShadow = '';
            }, 2000);
            return;
        }
        
        // Fade out
        element.style.transition = 'opacity 0.8s ease-in-out';
        element.style.opacity = '0.3';
        
        setTimeout(() => {
            // Fade in
            element.style.opacity = '1';
            cycleCount++;
            
            // Schedule next cycle
            setTimeout(performFadeCycle, 2000);
        }, 800);
    }
    
    // Start the first cycle after a delay
    setTimeout(performFadeCycle, 1000);
}

// Function to update zoom indicator
function updateZoomIndicator() {
    const indicator = document.getElementById('zoomIndicator');
    if (indicator) {
        indicator.textContent = `${currentZoom.toFixed(1)}x`;
        
        // Show indicator when zoom changes
        indicator.classList.add('visible');
        
        // Hide after 2 seconds
        setTimeout(() => {
            indicator.classList.remove('visible');
        }, 2000);
    }
}

// === FIREBASE CLEANUP FUNCTIONS === //
// Note: Firebase cleanup functions simplified for clean album approach

// Function to migrate comments for a specific photo
async function migrateCommentsForPhoto(photoId) {
    try {
        const comments = JSON.parse(localStorage.getItem(`photo_comments_${photoId}`) || '[]');
        
        if (comments.length > 0) {
            console.log(`📝 Migrando ${comments.length} comentarios para foto ${photoId}`);
            
            for (const comment of comments) {
                await saveCommentToFirebase(photoId, comment);
            }
        }
    } catch (error) {
        console.error(`Error migrating comments for ${photoId}:`, error);
    }
}

// === TEST FUNCTIONS FOR COMMENTS === //
// Function to create test comments for development
window.createTestComments = function() {
    if (!window.currentPhotoId) {
        console.log('⚠️ No hay foto seleccionada. Abre una foto primero.');
        showNotification('⚠️ Abre una foto primero para probar comentarios', 'warning');
        return;
    }
    
    const testComments = [
        {
            id: `test_comment_1_${Date.now()}`,
            user: 'juan',
            text: '¡Qué hermosa foto! Me encanta este momento 💕',
            date: new Date(Date.now() - 60000).toISOString(),
            photoId: window.currentPhotoId
        },
        {
            id: `test_comment_2_${Date.now()}`,
            user: 'ana',
            text: 'Este es uno de mis momentos favoritos 🌻✨',
            date: new Date(Date.now() - 30000).toISOString(),
            photoId: window.currentPhotoId
        },
        {
            id: `test_comment_3_${Date.now()}`,
            user: 'juan',
            text: 'Siempre serás mi gerbera favorita 🌻💖',
            date: new Date().toISOString(),
            photoId: window.currentPhotoId
        }
    ];
    
    // Save test comments to localStorage
    const existingComments = JSON.parse(localStorage.getItem(`photo_comments_${window.currentPhotoId}`) || '[]');
    const allComments = [...existingComments, ...testComments];
    localStorage.setItem(`photo_comments_${window.currentPhotoId}`, JSON.stringify(allComments));
    
    // Display updated comments
    displayComments(allComments);
    
    console.log('✅ Comentarios de prueba creados para foto:', window.currentPhotoId);
    showNotification('✅ Comentarios de prueba agregados', 'success');
}

// Function to clear all comments for current photo
window.clearPhotoComments = function() {
    if (!window.currentPhotoId) {
        console.log('⚠️ No hay foto seleccionada.');
        return;
    }
    
    if (confirm('¿Estás seguro de que quieres eliminar todos los comentarios de esta foto?')) {
        localStorage.removeItem(`photo_comments_${window.currentPhotoId}`);
        displayComments([]);
        console.log('🗑️ Comentarios eliminados para foto:', window.currentPhotoId);
        showNotification('🗑️ Comentarios eliminados', 'info');
    }
}

// Function to list all photos with comments
window.listPhotosWithComments = function() {
    const keys = Object.keys(localStorage).filter(key => key.startsWith('photo_comments_'));
    
    console.log('📋 Fotos con comentarios:');
    keys.forEach(key => {
        const photoId = key.replace('photo_comments_', '');
        const comments = JSON.parse(localStorage.getItem(key) || '[]');
        console.log(`  📸 ${photoId}: ${comments.length} comentarios`);
    });
    
    if (keys.length === 0) {
        console.log('  No hay fotos con comentarios aún.');
    }
    
    return keys.length;
}

// === KEYBOARD SHORTCUTS === //
document.addEventListener('keydown', function(e) {
    // ESC to go back to menu or close photo viewer
    if (e.key === 'Escape') {
        const photoModal = document.getElementById('photoViewerModal');
        if (photoModal.classList.contains('active')) {
            closePhotoViewer();
        } else if (currentSection !== 'menu') {
            showSection('menu');
        }
    }
    
    // Arrow keys for photo navigation
    if (document.getElementById('photoViewerModal').classList.contains('active')) {
        if (e.key === 'ArrowLeft') {
            navigatePhoto(-1);
        } else if (e.key === 'ArrowRight') {
            navigatePhoto(1);
        }
    }
    
    // Ctrl+S to save message (in proposal section)
    if (e.ctrlKey && e.key === 's' && currentSection === 'proposal') {
        e.preventDefault();
        saveMessage();
    }
    
    // Space to start/pause timer (in pomodoro section)
    if (e.key === ' ' && currentSection === 'pomodoro') {
        e.preventDefault();
        if (isTimerRunning) {
            pauseTimer();
        } else {
            startTimer();
        }
    }
});


// REMOVED: All password-related functions have been eliminated
// The app now starts directly without authentication

// Show welcome message (replaced password system)
function showWelcomeMessage() {
    showNotification('¡Bienvenida Ana! 🌻💕 Sin contraseñas, solo amor.', 'success');
}

