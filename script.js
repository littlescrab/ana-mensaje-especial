// App State
let currentSection = 'menu';
let timerInterval;
let isBreakTime = false;
let cycleCount = 0;
let timeRemaining = 0;
let isTimerRunning = false;
let targetCycles = 4;
let pomodoroCycle = 0;
let startTime = null;
let pausedTime = null;

// Ejemplo de configuración
const config = {
  focusDuration: 25, // minutos
  breakDuration: 5,  // minutos
  totalCycles: 4     // ciclos completos
};

// === THEME SYSTEM === //
let currentTheme = 'dark'; // 'light', 'darkblue', or 'dark'
const THEME_CONFIG = {
    storageKey: 'ana_app_theme',
    themes: {
        light: {
            name: 'Jardín de Gerberas',
            icon: '🌻'
        },
        darkblue: {
            name: 'Océano Nocturno',
            icon: '🌊'
        },
        dark: {
            name: 'Noche Romántica',
            icon: '🌙'
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

// Toggle theme function - Cycle through 3 themes
function toggleTheme() {
    const themes = ['light', 'darkblue', 'dark'];
    const currentIndex = themes.indexOf(currentTheme);
    const newIndex = (currentIndex + 1) % themes.length;
    const newTheme = themes[newIndex];
    
    setTheme(newTheme);
    
    const themeMessages = {
        light: '🌻 Jardín de Gerberas - Luz natural y flores para Ana',
        darkblue: '🌊 Océano Nocturno - Profundo como nuestro amor',
        dark: '🌙 Noche Romántica - Perfecto para momentos íntimos'
    };
    
    showNotification(themeMessages[newTheme], 'info');
}

// Update theme button
function updateThemeButton() {
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
        const themes = ['light', 'darkblue', 'dark'];
        const currentIndex = themes.indexOf(currentTheme);
        const nextIndex = (currentIndex + 1) % themes.length;
        const nextTheme = themes[nextIndex];
        const nextInfo = THEME_CONFIG.themes[nextTheme];
        
        // Update the spans inside the button to maintain the structure
        const iconSpan = themeBtn.querySelector('.theme-icon');
        const textSpan = themeBtn.querySelector('.theme-text');
        
        if (iconSpan && textSpan) {
            iconSpan.textContent = nextInfo.icon;
            textSpan.textContent = nextInfo.name;
        } else {
            // Fallback: recreate the structure if spans don't exist
            themeBtn.innerHTML = `
                <span class="theme-icon">${nextInfo.icon}</span>
                <span class="theme-text">${nextInfo.name}</span>
            `;
        }
        
        themeBtn.title = `Cambiar a ${nextInfo.name}`;
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

    // Initialize timer display and sounds
    initializePomodoroDisplay();
    initializePomodoroSounds();
    
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
            // Try to load with optimization from Firebase first, fallback to local
            if (window.db) {
                loadPhotosFromFirebaseOptimized();
            } else {
                loadExistingPhotos();
            }
        }
        
        // Load Pomodoro sessions when section is shown
        if (sectionName === 'pomodoro') {
            console.log('🍅 Cargando sesiones de Pomodoro...');
            // Load recent sessions from Firebase or localStorage
            loadRecentPomodoroSessions();
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

// === POMODORO SECTION - UNIFIED IMPLEMENTATION === //
// Global variables for Pomodoro
let pomodoroTimer = null;
let currentPomodoroPhase = 'focus'; // 'focus' or 'break'
let currentCycleNumber = 0;
let timeRemainingSeconds = 0;
let isPomodoroRunning = false;


// Available sound files (will be populated dynamically)
let concentrationSounds = [];
let breakSounds = [];

// Audio objects for continuous sounds
let currentAudio = null;
let isAudioPlaying = false;

// Initialize sound files on startup
function initializePomodoroSounds() {
    // Try to load available sound files
    discoverSoundFiles();
}

// Discover available sound files
async function discoverSoundFiles() {
    // Try to find concentration sounds - INCLUDING Pajaritos.mp3
    const concentrationTestFiles = [
        'Pajaritos.mp3',            // THE ACTUAL FILE THAT EXISTS!
        'concentracion-inicio.mp3',
        'focus-bell.mp3', 
        'start-work.mp3',
        'concentracion.mp3',
        'inicio-estudio.mp3'
    ];
    
    // Try to find break sounds - INCLUDING Pajaritos.mp3
    const breakTestFiles = [
        'Pajaritos.mp3',            // THE ACTUAL FILE THAT EXISTS!
        'descanso-suave.mp3',
        'break-chime.mp3',
        'relajacion.mp3', 
        'descanso.mp3',
        'hora-descanso.mp3'
    ];
    
    // Test concentration sounds
    for (const file of concentrationTestFiles) {
        if (await soundFileExists(`sounds/concentracion/${file}`)) {
            concentrationSounds.push(file);
            console.log('✅ Found concentration sound:', file);
        }
    }
    
    // Test break sounds
    for (const file of breakTestFiles) {
        if (await soundFileExists(`sounds/descanso/${file}`)) {
            breakSounds.push(file);
            console.log('✅ Found break sound:', file);
        }
    }
    
    console.log('🎵 Sonidos de concentración encontrados:', concentrationSounds);
    console.log('🔔 Sonidos de descanso encontrados:', breakSounds);
}

// Check if sound file exists
async function soundFileExists(url) {
    try {
        const response = await fetch(url, { method: 'HEAD' });
        return response.ok;
    } catch (error) {
        return false;
    }
}

// 🎵 NEW CONTINUOUS AUDIO SYSTEM FOR POMODORO PHASES

// Play phase-specific sound (notification only)
function playPhaseSound(phase) {
    const soundArray = phase === 'focus' ? concentrationSounds : breakSounds;
    
    if (soundArray.length > 0) {
        // Pick random sound if multiple available
        const randomSound = soundArray[Math.floor(Math.random() * soundArray.length)];
        const soundPath = `sounds/${phase === 'focus' ? 'concentracion' : 'descanso'}/${randomSound}`;
        
        console.log(`🎵 Reproduciendo sonido de notificación ${phase}:`, randomSound);
        
        const audio = new Audio(soundPath);
        audio.volume = 0.7; // Moderate volume for notifications
        audio.play().catch(error => {
            console.log('🔇 Error reproduciendo sonido específico:', error);
            // Fallback to default notification sound
            playNotificationSound();
        });
    } else {
        console.log(`🔔 No hay sonidos específicos para ${phase}, usando sonido por defecto`);
        // Fallback to default notification sound
        playNotificationSound();
    }
}

// 🔄 START CONTINUOUS AUDIO IN LOOP FOR PHASE
function startContinuousAudio(phase) {
    // Stop any current audio first
    stopContinuousAudio();
    
    const soundArray = phase === 'focus' ? concentrationSounds : breakSounds;
    
    if (soundArray.length > 0) {
        // Pick the Pajaritos.mp3 if available, or random sound
        let selectedSound = soundArray.find(sound => sound === 'Pajaritos.mp3');
        if (!selectedSound) {
            selectedSound = soundArray[Math.floor(Math.random() * soundArray.length)];
        }
        
        const soundPath = `sounds/${phase === 'focus' ? 'concentracion' : 'descanso'}/${selectedSound}`;
        
        console.log(`🔄 Iniciando audio continuo para ${phase}:`, selectedSound);
        
        // Create new audio object for continuous playback
        currentAudio = new Audio(soundPath);
        currentAudio.volume = 0.3; // Lower volume for background
        
        // Calculate session duration to stop audio at the right time
        const sessionDurationMs = calculateCurrentPhaseDuration() * 60 * 1000; // Convert to milliseconds
        
        // 🎵 LÓGICA INTELIGENTE DE AUDIO
        currentAudio.addEventListener('loadedmetadata', () => {
            const audioDurationMs = currentAudio.duration * 1000;
            console.log(`📊 Audio duration: ${currentAudio.duration}s, Session duration: ${sessionDurationMs/1000}s`);
            
            if (audioDurationMs <= sessionDurationMs) {
                // 🔁 AUDIO CORTO: Activar bucle automático
                currentAudio.loop = true;
                console.log(`🔁 Audio corto detectado (${currentAudio.duration}s) - Activando bucle`);
            } else {
                // ✂️ AUDIO LARGO: NO bucle, se cortará al final del tiempo
                currentAudio.loop = false;
                console.log(`✂️ Audio largo detectado (${currentAudio.duration}s) - Se cortará a los ${sessionDurationMs/1000}s`);
            }
        });
        
        // Start playing
        currentAudio.play().then(() => {
            isAudioPlaying = true;
            console.log(`🎵 Audio continuo iniciado para ${phase} - Duración sesión: ${sessionDurationMs/1000}s`);
            showNotification(`🎵 Audio relajante activado para ${phase === 'focus' ? 'concentración' : 'descanso'}`, 'info');
            
            // 🎯 PROGRAMAR PARADA DE AUDIO AL TERMINAR EL TIEMPO DE LA SESIÓN
            setTimeout(() => {
                if (currentAudio && isAudioPlaying) {
                    console.log('⏱️ Tiempo de sesión completado - Deteniendo audio');
                    fadeOutContinuousAudio(2000); // Fade out suave de 2 segundos
                }
            }, sessionDurationMs);
            
        }).catch(error => {
            console.log('🔇 Error iniciando audio continuo:', error);
            // Fallback to synthetic audio if file-based audio fails
            startSyntheticContinuousAudio(phase);
        });
    } else {
        console.log(`❌ No hay sonidos de archivo disponibles para ${phase}, usando sonidos sintéticos`);
        // Use synthetic audio as fallback
        startSyntheticContinuousAudio(phase);
    }
}

// 🛑 STOP CONTINUOUS AUDIO
function stopContinuousAudio() {
    if (currentAudio && isAudioPlaying) {
        console.log('🛑 Deteniendo audio continuo');
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
        isAudioPlaying = false;
    }
    
    // Also stop synthetic audio if it's playing
    stopSyntheticAudio();
}

// 🔊 FADE OUT AUDIO GRADUALLY
function fadeOutContinuousAudio(duration = 2000) {
    if (currentAudio && isAudioPlaying) {
        console.log('🔊 Fade out del audio continuo');
        const startVolume = currentAudio.volume;
        const fadeSteps = 20;
        const stepTime = duration / fadeSteps;
        const volumeStep = startVolume / fadeSteps;
        
        let currentStep = 0;
        const fadeInterval = setInterval(() => {
            currentStep++;
            if (currentAudio) {
                currentAudio.volume = Math.max(0, startVolume - (volumeStep * currentStep));
                
                if (currentStep >= fadeSteps || currentAudio.volume <= 0) {
                    clearInterval(fadeInterval);
                    stopContinuousAudio();
                }
            } else {
                clearInterval(fadeInterval);
            }
        }, stepTime);
    }
    
    // Also fade out synthetic audio if it's playing
    if (window.currentSyntheticAudio && window.currentSyntheticAudio.isPlaying) {
        fadeOutSyntheticAudio(duration);
    }
}

// === SYNTHETIC AUDIO SYSTEM FOR POMODORO === //
// Generate synthetic sounds using Web Audio API as fallback

// Global variables for synthetic audio
window.currentSyntheticAudio = null;

// 🎹 START SYNTHETIC CONTINUOUS AUDIO
function startSyntheticContinuousAudio(phase) {
    try {
        // Stop any existing synthetic audio
        stopSyntheticAudio();
        
        console.log(`🎹 Iniciando audio sintético continuo para ${phase}`);
        
        // Create audio context
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Define sound characteristics based on phase
        const soundConfig = phase === 'focus' ? {
            // Focus: Nature-inspired sounds (birds, water)
            type: 'nature',
            baseFreq: 220,     // A3 note
            harmonics: [1, 2, 3, 5],
            volume: 0.15,
            filterFreq: 800,
            description: 'Sonidos naturales para concentración'
        } : {
            // Break: Relaxing ambient sounds
            type: 'ambient',
            baseFreq: 110,     // A2 note (lower, more relaxing)
            harmonics: [1, 1.5, 2, 2.5],
            volume: 0.12,
            filterFreq: 400,
            description: 'Ambiente relajante para descanso'
        };
        
        // Create synthetic audio object
        window.currentSyntheticAudio = {
            context: audioContext,
            oscillators: [],
            filters: [],
            gainNodes: [],
            isPlaying: true,
            phase: phase,
            config: soundConfig
        };
        
        // Generate multiple oscillators for rich sound
        soundConfig.harmonics.forEach((harmonic, index) => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            const filter = audioContext.createBiquadFilter();
            
            // Configure oscillator
            oscillator.type = index === 0 ? 'sine' : 'triangle';
            oscillator.frequency.value = soundConfig.baseFreq * harmonic;
            
            // Configure filter for natural sound
            filter.type = 'lowpass';
            filter.frequency.value = soundConfig.filterFreq;
            filter.Q.value = 0.5;
            
            // Configure gain with subtle variations
            const baseVolume = soundConfig.volume / soundConfig.harmonics.length;
            const volumeVariation = baseVolume * (0.8 + Math.random() * 0.4);
            gainNode.gain.value = volumeVariation;
            
            // Connect audio nodes
            oscillator.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // Add subtle frequency modulation for natural feel
            const lfo = audioContext.createOscillator();
            const lfoGain = audioContext.createGain();
            lfo.type = 'sine';
            lfo.frequency.value = 0.2 + Math.random() * 0.3; // Slow modulation
            lfoGain.gain.value = 2 + Math.random() * 3; // Subtle frequency variation
            
            lfo.connect(lfoGain);
            lfoGain.connect(oscillator.frequency);
            
            // Start oscillators
            oscillator.start();
            lfo.start();
            
            // Store references
            window.currentSyntheticAudio.oscillators.push(oscillator, lfo);
            window.currentSyntheticAudio.gainNodes.push(gainNode, lfoGain);
            window.currentSyntheticAudio.filters.push(filter);
        });
        
        // Add subtle amplitude modulation for breathing effect
        const masterGain = audioContext.createGain();
        masterGain.gain.value = 1;
        
        // Create breathing effect (slow amplitude modulation)
        const breathingLFO = audioContext.createOscillator();
        const breathingGain = audioContext.createGain();
        breathingLFO.type = 'sine';
        breathingLFO.frequency.value = 0.15; // Very slow breathing rate
        breathingGain.gain.value = 0.1; // Subtle amplitude modulation
        
        breathingLFO.connect(breathingGain);
        breathingGain.connect(masterGain.gain);
        breathingLFO.start();
        
        window.currentSyntheticAudio.oscillators.push(breathingLFO);
        window.currentSyntheticAudio.gainNodes.push(masterGain, breathingGain);
        
        console.log(`🎵 Audio sintético iniciado: ${soundConfig.description}`);
        showNotification(`🎹 ${soundConfig.description} activado`, 'info');
        
    } catch (error) {
        console.error('🔇 Error creando audio sintético:', error);
        showNotification('⚠️ Error creando sonidos, continuando en silencio', 'warning');
    }
}

// 🛑 STOP SYNTHETIC AUDIO
function stopSyntheticAudio() {
    if (window.currentSyntheticAudio && window.currentSyntheticAudio.isPlaying) {
        console.log('🛑 Deteniendo audio sintético');
        
        try {
            // Stop all oscillators
            window.currentSyntheticAudio.oscillators.forEach(osc => {
                try {
                    osc.stop();
                } catch (e) {
                    // Oscillator might already be stopped
                }
            });
            
            // Close audio context
            if (window.currentSyntheticAudio.context) {
                window.currentSyntheticAudio.context.close();
            }
        } catch (error) {
            console.warn('Warning stopping synthetic audio:', error);
        }
        
        window.currentSyntheticAudio.isPlaying = false;
        window.currentSyntheticAudio = null;
    }
}

// 🔊 FADE OUT SYNTHETIC AUDIO
function fadeOutSyntheticAudio(duration = 2000) {
    if (window.currentSyntheticAudio && window.currentSyntheticAudio.isPlaying) {
        console.log('🔊 Fade out del audio sintético');
        
        const fadeSteps = 20;
        const stepTime = duration / fadeSteps;
        let currentStep = 0;
        
        const fadeInterval = setInterval(() => {
            currentStep++;
            
            if (window.currentSyntheticAudio && window.currentSyntheticAudio.gainNodes) {
                const fadeAmount = 1 - (currentStep / fadeSteps);
                
                // Fade all gain nodes
                window.currentSyntheticAudio.gainNodes.forEach(gainNode => {
                    try {
                        gainNode.gain.value *= fadeAmount;
                    } catch (e) {
                        // Gain node might be disconnected
                    }
                });
                
                if (currentStep >= fadeSteps) {
                    clearInterval(fadeInterval);
                    stopSyntheticAudio();
                }
            } else {
                clearInterval(fadeInterval);
            }
        }, stepTime);
    }
}






// Initialize Pomodoro timer display
function initializePomodoroDisplay() {
    const focusMinutes = parseInt(document.getElementById('focusTime').value) || 25;
    const totalCycles = parseInt(document.getElementById('totalCycles').value) || 4;
    
    timeRemainingSeconds = focusMinutes * 60;
    currentCycleNumber = 0;
    currentPomodoroPhase = 'focus';
    isPomodoroRunning = false;
    
    updatePomodoroDisplay();
}

// Update Pomodoro display
function updatePomodoroDisplay() {
    const minutes = Math.floor(timeRemainingSeconds / 60);
    const seconds = timeRemainingSeconds % 60;
    
    // Update timer display
    document.getElementById('timerDisplay').textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // Update mode display with icons
    const modeText = currentPomodoroPhase === 'focus' ? '📚 Concentración' : '☕ Descanso';
    document.getElementById('timerMode').textContent = modeText;
    
    // Update cycle counter
    const totalCycles = parseInt(document.getElementById('totalCycles').value) || 4;
    document.getElementById('currentCycle').textContent = currentCycleNumber;
    document.getElementById('targetCycles').textContent = totalCycles;
    
    // Update progress bar
    updatePomodoroProgressBar();
    
    // Update date
    const now = new Date();
    const dateOptions = { weekday: 'long', day: 'numeric', month: 'long' };
    document.getElementById('currentDate').textContent = now.toLocaleDateString('es-ES', dateOptions);
    
    // Update timer circle appearance
    const timerCircle = document.querySelector('.timer-circle');
    if (timerCircle) {
        timerCircle.className = 'timer-circle';
        if (isPomodoroRunning) {
            timerCircle.classList.add('active');
        }
        if (currentPomodoroPhase === 'break') {
            timerCircle.classList.add('break');
        }
    }
}

// Update progress bar for Pomodoro
function updatePomodoroProgressBar() {
    const totalCycles = parseInt(document.getElementById('totalCycles').value) || 4;
    const focusMinutes = parseInt(document.getElementById('focusTime').value) || 25;
    const breakMinutes = parseInt(document.getElementById('breakTime').value) || 5;
    
    // Calculate progress for current phase
    const totalPhaseTime = currentPomodoroPhase === 'focus' ? focusMinutes * 60 : breakMinutes * 60;
    const elapsedPhaseTime = totalPhaseTime - timeRemainingSeconds;
    const phaseProgress = Math.round((elapsedPhaseTime / totalPhaseTime) * 100);
    
    // Update progress bar
    const progressBar = document.querySelector('.productivity-indicator');
    const percentLabel = document.getElementById('progressPercent');
    
    if (progressBar) {
        progressBar.style.width = `${Math.max(0, Math.min(100, phaseProgress))}%`;
    }
    
    if (percentLabel) {
        percentLabel.textContent = `${Math.max(0, Math.min(100, phaseProgress))}%`;
    }
}

// Start Pomodoro timer
function startTimer() {
    if (isPomodoroRunning) return;
    
    // If timer is at 0, initialize with current phase time
    if (timeRemainingSeconds === 0) {
        const focusMinutes = parseInt(document.getElementById('focusTime').value) || 25;
        const breakMinutes = parseInt(document.getElementById('breakTime').value) || 5;
        timeRemainingSeconds = currentPomodoroPhase === 'focus' ? focusMinutes * 60 : breakMinutes * 60;
        
    }
    
    isPomodoroRunning = true;
    console.log(`🍅 Iniciando ${currentPomodoroPhase === 'focus' ? 'concentración' : 'descanso'} - ${timeRemainingSeconds} segundos`);
    
    // Play phase-specific notification sound
    playPhaseSound(currentPomodoroPhase);
    
    // 🔄 START CONTINUOUS AUDIO IN BACKGROUND
    setTimeout(() => {
        startContinuousAudio(currentPomodoroPhase);
    }, 1500); // Wait 1.5 seconds after notification sound
    
    pomodoroTimer = setInterval(() => {
        timeRemainingSeconds--;
        updatePomodoroDisplay();
        
        // Check if phase completed
        if (timeRemainingSeconds <= 0) {
            completeCurrentPhase();
        }
    }, 1000);
    
    updatePomodoroDisplay();
    showNotification(`🍅 ${currentPomodoroPhase === 'focus' ? 'Iniciando concentración' : 'Iniciando descanso'} - ¡Tú puedes!`, 'info');
}

// Pause Pomodoro timer
function pauseTimer() {
    if (!isPomodoroRunning) return;
    
    isPomodoroRunning = false;
    clearInterval(pomodoroTimer);
    
    // 🔊 FADE OUT CONTINUOUS AUDIO
    fadeOutContinuousAudio(1000); // 1 second fade out
    
    updatePomodoroDisplay();
    
    console.log('⏸️ Pomodoro pausado');
    showNotification('⏸️ Timer pausado', 'info');
}

// Reset Pomodoro timer
function resetTimer() {
    isPomodoroRunning = false;
    clearInterval(pomodoroTimer);
    
    // 🛑 STOP CONTINUOUS AUDIO
    stopContinuousAudio();
    
    currentCycleNumber = 0;
    currentPomodoroPhase = 'focus';
    
    const focusMinutes = parseInt(document.getElementById('focusTime').value) || 25;
    timeRemainingSeconds = focusMinutes * 60;
    
    updatePomodoroDisplay();
    
    console.log('🔄 Pomodoro reiniciado');
    showNotification('🔄 Timer reiniciado', 'info');
}

// Complete current phase and transition to next
function completeCurrentPhase() {
    clearInterval(pomodoroTimer);
    isPomodoroRunning = false;
    
    // 🔊 FADE OUT CURRENT AUDIO
    fadeOutContinuousAudio(1500); // 1.5 second fade out
    
    // Play phase-specific notification sound for next phase
    playPhaseSound(currentPomodoroPhase === 'focus' ? 'break' : 'focus');
    
    const totalCycles = parseInt(document.getElementById('totalCycles').value) || 4;
    
    if (currentPomodoroPhase === 'focus') {
        // Focus completed - increment cycle and start break
        currentCycleNumber++;
        
        if (currentCycleNumber >= totalCycles) {
            // All cycles completed!
            completeAllCycles();
            return;
        }
        
        // Start break
        currentPomodoroPhase = 'break';
        const breakMinutes = parseInt(document.getElementById('breakTime').value) || 5;
        timeRemainingSeconds = breakMinutes * 60;
        
        showNotification(`🎉 ¡Concentración ${currentCycleNumber} completada! Hora de descansar 🌿`, 'success');
        
        // Auto-start break
        setTimeout(() => {
            startTimer();
        }, 2000);
        
    } else {
        // Break completed - start next focus session
        currentPomodoroPhase = 'focus';
        const focusMinutes = parseInt(document.getElementById('focusTime').value) || 25;
        timeRemainingSeconds = focusMinutes * 60;
        
        showNotification(`💪 ¡Descanso terminado! Iniciando concentración ${currentCycleNumber + 1}`, 'info');
        
        // Auto-start next focus session
        setTimeout(() => {
            startTimer();
        }, 2000);
    }
    
    updatePomodoroDisplay();
}

// Complete all Pomodoro cycles
function completeAllCycles() {
    currentPomodoroPhase = 'focus';
    timeRemainingSeconds = 0;
    
    document.getElementById('timerMode').textContent = '🎉 ¡Sesión Completa!';
    document.getElementById('timerDisplay').textContent = '00:00';
    
    const progressBar = document.querySelector('.productivity-indicator');
    const percentLabel = document.getElementById('progressPercent');
    
    if (progressBar) progressBar.style.width = '100%';
    if (percentLabel) percentLabel.textContent = '100%';
    
    const totalCycles = parseInt(document.getElementById('totalCycles').value) || 4;
    
    // 🔥 GUARDAR SESIÓN COMPLETADA EN FIREBASE
    const sessionDescription = document.getElementById('sessionDescription').value.trim();
    saveCompletedPomodoroSession({
        focusTime: parseInt(document.getElementById('focusTime').value) || 25,
        breakTime: parseInt(document.getElementById('breakTime').value) || 5,
        totalCycles: totalCycles,
        description: sessionDescription || null,
        completedAt: new Date(),
        duration: calculateTotalSessionDuration()
    });
    
    showNotification(`🏆 ¡FELICITACIONES! Has completado todos los ${totalCycles} ciclos Pomodoro. ¡Descansa bien! 🌟`, 'success');
    
    console.log(`🏆 Sesión Pomodoro completa: ${totalCycles} ciclos`);
}

// Update timer settings
function updateTimerSettings() {
    if (!isPomodoroRunning) {
        resetTimer();
    }
}

// Play notification sound
function playNotificationSound() {
    try {
        const soundType = document.getElementById('notificationSound').value || 'bell';
        
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
    } catch (error) {
        console.log('🔇 Error playing notification sound:', error);
    }
}

// Test notification sound
function testNotificationSound() {
    playNotificationSound();
    showNotification('🔔 Sonido de prueba reproducido', 'info');
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
            // Increment and save yes counter
            const yesCount = incrementYesCounter();
            
            responseArea.className = 'response-area yes-response';
            responseArea.innerHTML = `
                <h3>¡Sí Acepto! 💕</h3>
                <p>¡Este es el momento más feliz de mi vida! 🌻💖</p>
                <div class="yes-counter-display">
                    <p class="yes-count-text">Has dicho "Sí" <span class="yes-count-number">${yesCount}</span> ${yesCount === 1 ? 'vez' : 'veces'} 💕</p>
                    <div class="yes-celebration">${generateYesCelebration(yesCount)}</div>
                </div>
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
            
            // Show special notifications for milestones
            showYesMilestoneNotification(yesCount);
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

// Create floating gerberas animation - 20 gerberas para Ana
function createFloatingGerberas() {
    const container = document.getElementById('gerberasContainer');
    if (!container) return;
    
    // Variedad de gerberas y flores para Ana 🌻
    const gerberas = [
        '🌻', '🌺', '🌼', '🌷', '🌸', '🌹', '💐', '🏵️',
        '🌻', '🌺', '🌼', '🌷', '🌸', '🌹', '💐', '🏵️',
        '🌻', '🌺', '🌼', '🌷' // Total 20 tipos
    ];
    
    // Configuración para diferentes tamaños y velocidades
    const gerberaConfigs = [
        { size: '2em', duration: 15, opacity: 0.4 },
        { size: '2.5em', duration: 18, opacity: 0.3 },
        { size: '1.8em', duration: 12, opacity: 0.5 },
        { size: '3em', duration: 22, opacity: 0.25 },
        { size: '2.2em', duration: 16, opacity: 0.35 }
    ];
    
    function addGerbera(index = null, isInitial = false) {
        const gerbera = document.createElement('div');
        gerbera.className = 'gerbera-float';
        
        // Usar índice específico o aleatorio
        const gerberaIndex = index !== null ? index : Math.floor(Math.random() * gerberas.length);
        gerbera.textContent = gerberas[gerberaIndex];
        
        // Configuración aleatoria
        const config = gerberaConfigs[Math.floor(Math.random() * gerberaConfigs.length)];
        
        // Posición horizontal aleatoria
        gerbera.style.left = Math.random() * 100 + 'vw';
        
        // Configurar tamaño, duración y opacidad
        gerbera.style.fontSize = config.size;
        gerbera.style.animationDuration = config.duration + 's';
        gerbera.style.opacity = config.opacity;
        
        // Delay aleatorio para variedad
        const delay = isInitial ? Math.random() * 5 : 0;
        gerbera.style.animationDelay = delay + 's';
        
        // Rotación aleatoria inicial
        gerbera.style.transform = `rotate(${Math.random() * 360}deg)`;
        
        // Variaciones en la animación
        const animationType = Math.random() > 0.5 ? 'floatGerbera' : 'floatGerberaAlt';
        gerbera.style.animationName = animationType;
        
        container.appendChild(gerbera);
        
        // Remove gerbera after animation
        setTimeout(() => {
            if (gerbera.parentNode) {
                gerbera.parentNode.removeChild(gerbera);
            }
        }, (config.duration + delay + 2) * 1000);
    }
    
    // Función para crear las 20 gerberas iniciales
    function createInitialGerberas() {
        for (let i = 0; i < 20; i++) {
            setTimeout(() => {
                addGerbera(i, true);
            }, i * 200); // Escalonar la aparición
        }
    }
    
    // Crear gerberas iniciales inmediatamente
    createInitialGerberas();
    
    // Continuar agregando gerberas de forma periódica
    setInterval(() => {
        addGerbera();
    }, 2000); // Cada 2 segundos
    
    // Recrear el conjunto completo cada 30 segundos
    setInterval(() => {
        createInitialGerberas();
    }, 30000);
    
    console.log('🌻 Sistema de 20 gerberas flotantes inicializado para Ana');
}

// Create enhanced gerbera explosion effect with more variety
function createGerberaExplosion() {
    const container = document.getElementById('gerberasContainer');
    if (!container) return;
    
    // Expanded variety of flowers and romantic symbols
    const flowers = [
        '🌻', '🌺', '🌼', '🌷', '🌸', '🌹', '💐', '🏵️',
        '🌻', '🌺', '🌼', '🌷', '🌸', '🌹', '💐', '🏵️', // Duplicates for higher probability
        '💖', '💕', '💝', '💗', '💘', '💓', '❤️', '💜',
        '⭐', '✨', '💫', '🌟', '✴️', '💦', '🎊', '🎉'
    ];
    
    // Create multiple waves of explosion
    const waves = 3;
    const particlesPerWave = 15;
    
    for (let wave = 0; wave < waves; wave++) {
        setTimeout(() => {
            for (let i = 0; i < particlesPerWave; i++) {
                const flower = document.createElement('div');
                flower.textContent = flowers[Math.floor(Math.random() * flowers.length)];
                flower.style.position = 'fixed';
                flower.style.left = '50%';
                flower.style.top = '50%';
                flower.style.pointerEvents = 'none';
                flower.style.zIndex = '1000';
                
                // Variable sizes for more visual interest
                const sizes = ['1.5em', '2em', '2.5em', '3em', '3.5em'];
                flower.style.fontSize = sizes[Math.floor(Math.random() * sizes.length)];
                
                // Enhanced explosion pattern with more randomness
                const baseAngle = (i / particlesPerWave) * 2 * Math.PI;
                const angleVariation = (Math.random() - 0.5) * 0.8; // Add some randomness
                const angle = baseAngle + angleVariation;
                
                // Variable distances for depth
                const minDistance = 150 + (wave * 50);
                const maxDistance = 400 + (wave * 100);
                const distance = Math.random() * (maxDistance - minDistance) + minDistance;
                
                const finalX = Math.cos(angle) * distance;
                const finalY = Math.sin(angle) * distance;
                
                // Add some vertical bias for more natural movement
                const verticalBias = (Math.random() - 0.5) * 100;
                
                flower.style.transform = `translate(-50%, -50%)`;
                container.appendChild(flower);
                
                // Enhanced animation with more natural physics
                setTimeout(() => {
                    const duration = 2 + Math.random() * 1.5; // Variable duration
                    const rotation = Math.random() * 1440 + 360; // More rotation
                    const scaleFactor = Math.random() * 0.5; // Variable scale
                    
                    flower.style.transition = `all ${duration}s cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
                    flower.style.transform = `translate(${finalX}px, ${finalY + verticalBias}px) rotate(${rotation}deg) scale(${scaleFactor})`;
                    flower.style.opacity = '0';
                    
                    // Add a subtle glow effect
                    flower.style.textShadow = '0 0 10px rgba(255, 192, 203, 0.8)';
                    
                }, 50 + i * 10); // Stagger the animations slightly
                
                // Remove after animation with variable cleanup time
                setTimeout(() => {
                    if (flower.parentNode) {
                        flower.parentNode.removeChild(flower);
                    }
                }, 4000 + (wave * 500));
            }
        }, wave * 300); // Delay between waves
    }
    
    // Add sparkle effect at the center
    createSparkleEffect();
}

// Create sparkle effect for the center of explosion
function createSparkleEffect() {
    const container = document.getElementById('gerberasContainer');
    if (!container) return;
    
    const sparkles = ['✨', '⭐', '💫', '🌟', '✴️'];
    
    for (let i = 0; i < 8; i++) {
        const sparkle = document.createElement('div');
        sparkle.textContent = sparkles[Math.floor(Math.random() * sparkles.length)];
        sparkle.style.position = 'fixed';
        sparkle.style.left = '50%';
        sparkle.style.top = '50%';
        sparkle.style.fontSize = '1.5em';
        sparkle.style.pointerEvents = 'none';
        sparkle.style.zIndex = '1001';
        sparkle.style.transform = 'translate(-50%, -50%)';
        sparkle.style.opacity = '0';
        
        container.appendChild(sparkle);
        
        // Sparkle animation
        setTimeout(() => {
            sparkle.style.transition = 'all 0.3s ease-out';
            sparkle.style.opacity = '1';
            sparkle.style.transform = 'translate(-50%, -50%) scale(1.5)';
            
            setTimeout(() => {
                sparkle.style.transition = 'all 0.5s ease-in';
                sparkle.style.opacity = '0';
                sparkle.style.transform = 'translate(-50%, -50%) scale(0.5)';
            }, 300);
        }, i * 100);
        
        setTimeout(() => {
            if (sparkle.parentNode) {
                sparkle.parentNode.removeChild(sparkle);
            }
        }, 1500);
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

// === FIREBASE POMODORO SESSIONS FUNCTIONS === //

// 🔥 GUARDAR SESIÓN COMPLETADA EN FIREBASE
async function saveCompletedPomodoroSession(sessionData) {
    try {
        if (!window.db || !collection || !addDoc) {
            console.log('⚠️ Firebase no disponible, guardando sesión localmente');
            saveSessionToLocalStorage(sessionData);
            return;
        }
        
        const sessionsRef = collection(window.db, 'pomodoro_sessions');
    const sessionDoc = {
        focusTime: sessionData.focusTime,
        breakTime: sessionData.breakTime,
        totalCycles: sessionData.totalCycles,
        description: sessionData.description || null,
        completedAt: sessionData.completedAt,
        duration: sessionData.duration,
        timestamp: serverTimestamp(),
        userId: 'ana_juan_sessions' // Para identificar nuestras sesiones
    };
        
        await addDoc(sessionsRef, sessionDoc);
        console.log('🏆 Sesión Pomodoro guardada en Firebase:', sessionData);
        showNotification('☁️ Sesión guardada en la nube exitosamente', 'success');
        
        // También guardar localmente como backup
        saveSessionToLocalStorage(sessionData);
        
        // Cargar sesiones actualizadas
        loadRecentPomodoroSessions();
        
    } catch (error) {
        console.error('Error guardando sesión en Firebase:', error);
        showNotification('⚠️ Error guardando en Firebase, usando almacenamiento local', 'warning');
        saveSessionToLocalStorage(sessionData);
    }
}

// Guardar sesión en localStorage como backup
function saveSessionToLocalStorage(sessionData) {
    try {
        const sessions = JSON.parse(localStorage.getItem('pomodoro_completed_sessions') || '[]');
        sessions.unshift(sessionData);
        
        // Mantener solo las últimas 50 sesiones localmente
        if (sessions.length > 50) {
            sessions.splice(50);
        }
        
        localStorage.setItem('pomodoro_completed_sessions', JSON.stringify(sessions));
        console.log('💾 Sesión guardada localmente:', sessionData);
    } catch (error) {
        console.error('Error guardando sesión localmente:', error);
    }
}

// 📊 CARGAR ÚLTIMAS 20 SESIONES COMPLETADAS
async function loadRecentPomodoroSessions() {
    try {
        if (!window.db || !collection || !onSnapshot) {
            console.log('⚠️ Firebase no disponible, cargando sesiones locales');
            loadSessionsFromLocalStorage();
            return;
        }
        
        const { query, where, orderBy, limit, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        // Usar getDocs en lugar de onSnapshot para evitar problemas de índices
        const sessionsRef = collection(window.db, 'pomodoro_sessions');
        const q = query(
            sessionsRef,
            where('userId', '==', 'ana_juan_sessions'),
            limit(20)
        );
        
        const querySnapshot = await getDocs(q);
        const sessions = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            sessions.push({
                id: doc.id,
                focusTime: data.focusTime,
                breakTime: data.breakTime,
                totalCycles: data.totalCycles,
                description: data.description || null,
                completedAt: data.completedAt ? (data.completedAt.toDate ? data.completedAt.toDate() : new Date(data.completedAt)) : new Date(),
                duration: data.duration,
                timestamp: data.timestamp ? (data.timestamp.toDate ? data.timestamp.toDate() : new Date(data.timestamp)) : new Date(),
                source: 'firebase'
            });
        });
        
        // Ordenar por timestamp en el cliente para evitar problemas de índice
        sessions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        console.log('📊 Sesiones cargadas desde Firebase:', sessions.length);
        displayRecentSessions(sessions);
        
    } catch (error) {
        console.error('Error cargando sesiones desde Firebase:', error);
        console.log('🔄 Intentando cargar desde localStorage como alternativa');
        loadSessionsFromLocalStorage();
    }
}

// Cargar sesiones desde localStorage
function loadSessionsFromLocalStorage() {
    try {
        const sessions = JSON.parse(localStorage.getItem('pomodoro_completed_sessions') || '[]');
        const recentSessions = sessions.slice(0, 20).map(session => ({
            ...session,
            source: 'local'
        }));
        
        console.log('📱 Sesiones cargadas desde localStorage:', recentSessions.length);
        displayRecentSessions(recentSessions);
    } catch (error) {
        console.error('Error cargando sesiones locales:', error);
        displayRecentSessions([]);
    }
}

// 🎨 MOSTRAR ÚLTIMAS SESIONES EN LA INTERFAZ
function displayRecentSessions(sessions) {
    const historyContainer = document.getElementById('completedSessions');
    if (!historyContainer) {
        console.log('⚠️ Contenedor de sesiones completadas no encontrado');
        return;
    }
    
    if (sessions.length === 0) {
        historyContainer.innerHTML = `
            <div class="history-empty">
                <div style="font-size: 1.5em; margin-bottom: 10px;">🏆</div>
                <p style="font-size: 0.9em; opacity: 0.7;">No hay sesiones completadas aún</p>
                <p style="font-size: 0.8em; opacity: 0.5;">¡Completa tu primera sesión Pomodoro!</p>
            </div>
        `;
        return;
    }
    
    const sessionsHTML = sessions.map((session, index) => {
        const isRecent = index < 3;
        const badgeClass = isRecent ? 'recent-session' : '';
        const completedDate = new Date(session.completedAt);
        const timeAgo = getTimeAgo(completedDate);
        const sourceIcon = session.source === 'firebase' ? '☁️' : '💾';
        
        return `
            <div class="session-item ${badgeClass}">
                <div class="session-main">
                    <div class="session-stats">
                        <span class="focus-time">📚 ${session.focusTime}m</span>
                        <span class="break-time">☕ ${session.breakTime}m</span>
                        <span class="cycles">🔄 ${session.totalCycles} ciclos</span>
                    </div>
                    ${session.description ? `<div class="session-description">📝 ${session.description}</div>` : ''}
                    <div class="session-info">
                        <div class="session-date">${timeAgo} ${sourceIcon}</div>
                        <div class="session-duration">⏱️ ${Math.round(session.duration / 60)} min total</div>
                    </div>
                </div>
                ${isRecent ? '<div class="recent-indicator">🔥</div>' : ''}
            </div>
        `;
    }).join('');
    
    historyContainer.innerHTML = `
        <div class="history-header">
            <h4>🏆 Últimas 20 Sesiones Completadas</h4>
            <button onclick="clearCompletedSessions()" class="clear-history-btn" title="Limpiar sesiones completadas">🗑️</button>
        </div>
        <div class="sessions-list">
            ${sessionsHTML}
        </div>
        <div class="session-summary">
            <p><strong>Total sesiones:</strong> ${sessions.length}</p>
            <p><strong>Tiempo total:</strong> ${Math.round(sessions.reduce((acc, s) => acc + (s.duration || 0), 0) / 3600)} horas</p>
        </div>
    `;
}

// Función auxiliar para calcular tiempo transcurrido
function getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 60) {
        return `Hace ${diffMins} min`;
    } else if (diffHours < 24) {
        return `Hace ${diffHours}h`;
    } else if (diffDays < 7) {
        return `Hace ${diffDays} días`;
    } else {
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
    }
}

// Función para calcular duración total de la sesión
function calculateTotalSessionDuration() {
    const focusTime = parseInt(document.getElementById('focusTime').value) || 25;
    const breakTime = parseInt(document.getElementById('breakTime').value) || 5;
    const totalCycles = parseInt(document.getElementById('totalCycles').value) || 4;
    
    // Tiempo total = (tiempo_concentración * ciclos) + (tiempo_descanso * (ciclos - 1))
    // Ejemplo: 2 ciclos = concentración + descanso + concentración = 2 concentraciones + 1 descanso
    const totalMinutes = (focusTime * totalCycles) + (breakTime * (totalCycles - 1));
    return totalMinutes * 60; // Retornar en segundos
}

// Función para calcular duración de la fase actual
function calculateCurrentPhaseDuration() {
    const focusMinutes = parseInt(document.getElementById('focusTime').value) || 25;
    const breakMinutes = parseInt(document.getElementById('breakTime').value) || 5;
    
    return currentPomodoroPhase === 'focus' ? focusMinutes : breakMinutes;
}

// Limpiar sesiones completadas
window.clearCompletedSessions = function() {
    if (confirm('¿Estás seguro de que quieres eliminar todas las sesiones completadas?')) {
        localStorage.removeItem('pomodoro_completed_sessions');
        displayRecentSessions([]);
        showNotification('🗑️ Sesiones completadas eliminadas', 'info');
    }
};

// === OPTIMIZACIÓN DE CARGA DE FOTOS === //

// 🚀 OPTIMIZED PHOTO LOADING WITH PROGRESSIVE LOADING
async function loadPhotosFromFirebaseOptimized() {
    try {
        if (!collection || !onSnapshot || !db) {
            console.log('Firebase not ready, loading local photos only');
            return;
        }
        
        console.log('🚀 Iniciando carga optimizada de fotos desde Firebase...');
        
        // Mostrar loading indicator
        const photoGrid = document.getElementById('photoGrid');
        photoGrid.innerHTML = `
            <div class="loading-photos">
                <div class="loading-spinner">⏳</div>
                <p>Cargando fotos desde la nube...</p>
            </div>
        `;
        
        // Usar paginación para cargar fotos en lotes
        const { query, orderBy, limit } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        const photosRef = collection(db, 'photos');
        const q = query(
            photosRef,
            orderBy('timestamp', 'desc'),
            limit(10) // Cargar primeras 10 fotos
        );
        
        onSnapshot(q, (snapshot) => {
            const photos = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                photos.push({
                    id: data.id,
                    data: data.url,
                    name: data.name,
                    type: 'firebase',
                    date: data.timestamp ? data.timestamp.toDate().toISOString() : new Date().toISOString()
                });
            });
            
            console.log('📸 Primeras fotos cargadas:', photos.length);
            
            // Renderizar fotos con lazy loading
            renderPhotosWithLazyLoading(photos);
            
            // Cargar más fotos si es necesario
            loadRemainingPhotos(photos.length);
        });
        
    } catch (error) {
        console.error('Error loading photos from Firebase:', error);
        loadExistingPhotos(); // Fallback
    }
}

// Renderizar fotos con lazy loading
function renderPhotosWithLazyLoading(photos) {
    const photoGrid = document.getElementById('photoGrid');
    
    if (photos.length === 0) {
        photoGrid.innerHTML = '';
        return;
    }
    
    // Store photos globally for viewer
    window.currentPhotos = photos;
    
    // Generate HTML with intersection observer for lazy loading
    photoGrid.innerHTML = photos.map((photo, index) => {
        const src = photo.data;
        return `
            <div class="photo-item" data-photo-index="${index}" style="cursor: pointer;">
                <div class="photo-placeholder" data-src="${src}">
                    <div class="photo-loading">📷</div>
                </div>
                <div class="photo-overlay">
                    <span class="sync-indicator">☁️</span>
                    <button class="delete-photo" onclick="event.stopPropagation(); deletePhoto(${index}, '${photo.type}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    // Setup intersection observer for lazy loading
    setupLazyLoadingObserver();
    
    // Setup event listeners after a short delay
    setTimeout(() => {
        setupPhotoEventListeners();
    }, 100);
}

// Setup intersection observer for lazy loading
function setupLazyLoadingObserver() {
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const placeholder = entry.target;
                const src = placeholder.getAttribute('data-src');
                
                // Create and load the actual image
                const img = document.createElement('img');
                img.src = src;
                img.alt = 'Foto del álbum';
                img.style.cssText = 'width: 100%; height: 200px; object-fit: cover; cursor: pointer;';
                img.loading = 'lazy';
                
                // Replace placeholder with image when loaded
                img.onload = () => {
                    placeholder.innerHTML = '';
                    placeholder.appendChild(img);
                    placeholder.classList.add('loaded');
                };
                
                img.onerror = () => {
                    placeholder.innerHTML = `
                        <div class="photo-error">
                            <span>❌</span>
                            <p>Error cargando imagen</p>
                        </div>
                    `;
                };
                
                // Stop observing this element
                observer.unobserve(placeholder);
            }
        });
    }, {
        // Start loading when image is 50px away from viewport
        rootMargin: '50px'
    });
    
    // Observe all photo placeholders
    const placeholders = document.querySelectorAll('.photo-placeholder');
    placeholders.forEach(placeholder => {
        imageObserver.observe(placeholder);
    });
}

// Cargar fotos restantes en segundo plano
async function loadRemainingPhotos(currentCount) {
    try {
        if (currentCount >= 50) return; // Límite razonable
        
        const { query, orderBy, startAfter, limit, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        // Cargar más fotos en lotes de 10
        const photosRef = collection(db, 'photos');
        const q = query(
            photosRef,
            orderBy('timestamp', 'desc'),
            limit(40) // Cargar hasta 40 fotos más
        );
        
        const snapshot = await getDocs(q);
        const allPhotos = [];
        
        snapshot.forEach((doc) => {
            const data = doc.data();
            allPhotos.push({
                id: data.id,
                data: data.url,
                name: data.name,
                type: 'firebase',
                date: data.timestamp ? data.timestamp.toDate().toISOString() : new Date().toISOString()
            });
        });
        
        if (allPhotos.length > currentCount) {
            console.log('📷 Cargadas fotos adicionales:', allPhotos.length - currentCount);
            
            // Update global photos array
            window.currentPhotos = allPhotos;
            
            // Re-render with all photos
            renderPhotosWithLazyLoading(allPhotos);
        }
        
    } catch (error) {
        console.error('Error loading remaining photos:', error);
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


// === YES COUNTER FUNCTIONS === //
const YES_COUNTER_KEY = 'ana_yes_counter';

// Increment and return yes counter
function incrementYesCounter() {
    let count = parseInt(localStorage.getItem(YES_COUNTER_KEY)) || 0;
    count++;
    localStorage.setItem(YES_COUNTER_KEY, count.toString());
    console.log('💕 Contador de "Sí" incrementado a:', count);
    return count;
}

// Get current yes counter
function getYesCounter() {
    return parseInt(localStorage.getItem(YES_COUNTER_KEY)) || 0;
}

// Generate celebration based on count
function generateYesCelebration(count) {
    if (count === 1) {
        return '🎉 ¡Tu primera vez diciendo que sí! ¡Momento histórico! 🌻';
    } else if (count === 5) {
        return '✨ ¡5 veces! Definitivamente estás segura 💖';
    } else if (count === 10) {
        return '🎊 ¡10 VECES! ¡Ya no hay dudas, somos novios! 🌹💍';
    } else if (count === 25) {
        return '🏆 ¡25 VECES! Eres la novia más decidida del mundo 👑';
    } else if (count === 50) {
        return '🚀 ¡50 VECES! ¡Al infinito y más allá contigo! 🌌';
    } else if (count === 100) {
        return '💎 ¡100 VECES! Eres más preciosa que todos los diamantes 💎';
    } else if (count % 10 === 0) {
        return `🎯 ¡${count} veces! Cada "Sí" hace mi corazón más feliz 💝`;
    } else {
        return `💕 ${count} veces y contando... ¡Te amo cada vez más! 🌻`;
    }
}

// Show milestone notifications
function showYesMilestoneNotification(count) {
    const milestones = [1, 5, 10, 25, 50, 100];
    
    if (milestones.includes(count)) {
        setTimeout(() => {
            const messages = {
                1: '🎉 ¡PRIMERA VEZ! Este es el inicio de nuestra historia de amor',
                5: '⭐ ¡5 VECES! Ya puedo ver que realmente quieres ser mi novia',
                10: '💍 ¡10 VECES! Esto es oficial: ¡SOMOS NOVIOS!',
                25: '👑 ¡25 VECES! Eres la mujer más maravillosa del universo',
                50: '🚀 ¡50 VECES! Nuestro amor está llegando a las estrellas',
                100: '💎 ¡100 VECES! Eres mi tesoro más preciado'
            };
            
            showNotification(messages[count], 'success');
        }, 2000);
    }
}

// Reset yes counter (for testing)
window.resetYesCounter = function() {
    localStorage.removeItem(YES_COUNTER_KEY);
    console.log('🔄 Contador de "Sí" reiniciado');
    showNotification('🔄 Contador reiniciado - ¡Empezamos de nuevo!', 'info');
};

// Get current count (for testing)
window.getYesCount = function() {
    const count = getYesCounter();
    console.log('📊 Contador actual de "Sí":', count);
    showNotification(`📊 Has dicho "Sí" ${count} ${count === 1 ? 'vez' : 'veces'}`, 'info');
    return count;
};

// REMOVED: All password-related functions have been eliminated
// The app now starts directly without authentication

// Show welcome message (replaced password system)
function showWelcomeMessage() {
    showNotification('¡Bienvenida Ana! 🌻💕 Sin contraseñas, solo amor.', 'success');
}

