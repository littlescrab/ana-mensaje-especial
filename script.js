// App State
let currentSection = 'menu';
let timer = null;
let timeRemaining = 0;
let isTimerRunning = false;
let isBreakTime = false;
let pomodoroCycle = 0;

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
            console.log('Firebase Storage not ready, saving locally only');
            return photoData.data; // Return original data URL
        }
        
        // Convert data URL to blob
        const response = await fetch(photoData.data);
        const blob = await response.blob();
        
        // Create reference with unique name
        const photoRef = ref(storage, `photos/${photoData.id}_${photoData.name}`);
        
        // Upload the blob
        await uploadBytes(photoRef, blob);
        
        // Get download URL
        const downloadURL = await getDownloadURL(photoRef);
        console.log('Photo uploaded to Firebase');
        showNotification('✅ Foto subida a la nube ☁️', 'success');
        
        // Save photo metadata to Firestore
        const photosRef = collection(db, 'photos');
        await addDoc(photosRef, {
            id: photoData.id,
            name: photoData.name,
            url: downloadURL,
            timestamp: serverTimestamp()
        });
        
        return downloadURL;
    } catch (error) {
        console.error('Error uploading photo to Firebase:', error);
        showNotification('⚠️ Error subiendo foto, guardada localmente', 'warning');
        return photoData.data; // Fall back to local data
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
    initializeApp();
    
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
});

function initializeApp() {
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
            console.log('📸 Cargando álbum de fotos...');
            // Only load if Firebase hasn't loaded photos yet
            if (!window.currentPhotos || window.currentPhotos.length === 0) {
                loadExistingPhotos();
            } else {
                // Re-setup event listeners if photos are already loaded
                console.log('📸 Fotos ya cargadas, configurando event listeners...');
                setupPhotoEventListeners();
            }
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
    
    // Get existing local photos
    const existingPhotos = [
        '6F0A4B53-C8E2-4094-8AC8-87A132F38940.JPG',
        '80E7C940-EBD9-4310-9F35-AADBACF39D31.JPG',
        'IMG_1655.jpg',
        'IMG_1703.jpg',
        'IMG_1718.jpg',
        'IMG_1817.jpg',
        'IMG_1839.jpg',
        'IMG_1843.jpg',
        'IMG_1899.jpg',
        'IMG_2124.jpg',
        'IMG_2125.jpg',
        'IMG_2132.jpg',
        'IMG_2360.jpg'
    ];
    
    // Combine local existing photos + Firebase photos
    const localPhotos = existingPhotos.map((name, index) => ({ 
        id: `existing_${index}`,
        name, 
        data: `images/${name}`, 
        type: 'existing',
        date: new Date().toISOString(),
        comments: JSON.parse(localStorage.getItem(`photo_comments_existing_${index}`) || '[]')
    }));
    
    const allPhotos = [...localPhotos, ...firebasePhotos];
    
    if (allPhotos.length === 0) {
        photoGrid.innerHTML = '<p style="color: #e8c5ca; text-align: center; font-style: italic; grid-column: 1 / -1; padding: 40px;">No hay fotos en el álbum. ¡Agrega algunas! 📸</p>';
        return;
    }
    
    // Store photos globally for viewer
    window.currentPhotos = allPhotos;
    console.log('📸 Fotos combinadas (locales + Firebase):', allPhotos.length);
    
    // Generate HTML with proper event handling
    photoGrid.innerHTML = allPhotos.map((photo, index) => {
        const src = photo.data;
        const isFirebase = photo.type === 'firebase';
        return `
            <div class="photo-item" data-photo-index="${index}" style="cursor: pointer;">
                <img src="${src}" alt="${photo.name}" onerror="console.error('Error loading image:', '${src}'); this.parentElement.style.display='none';" loading="lazy" style="width: 100%; height: 200px; object-fit: cover; cursor: pointer;">
                <div class="photo-overlay">
                    ${isFirebase ? '<span class="sync-indicator" style="position: absolute; top: 5px; right: 5px; background: rgba(76, 175, 80, 0.8); color: white; padding: 2px 6px; border-radius: 10px; font-size: 0.7em;">☁️</span>' : ''}
                    <button class="delete-photo" onclick="event.stopPropagation(); deletePhoto(${index}, '${photo.type}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    // Setup event listeners for all photos (Firebase + local)
    setupPhotoEventListeners();
}

// === ALBUM SECTION === //
function loadExistingPhotos() {
    // Load photos that are already in the directory
    const existingPhotos = [
        '6F0A4B53-C8E2-4094-8AC8-87A132F38940.JPG',
        '80E7C940-EBD9-4310-9F35-AADBACF39D31.JPG',
        'IMG_1655.jpg',
        'IMG_1703.jpg',
        'IMG_1718.jpg',
        'IMG_1817.jpg',
        'IMG_1839.jpg',
        'IMG_1843.jpg',
        'IMG_1899.jpg',
        'IMG_2124.jpg',
        'IMG_2125.jpg',
        'IMG_2132.jpg',
        'IMG_2360.jpg'
    ];

    const photoGrid = document.getElementById('photoGrid');
    
    // Load saved photos from localStorage
    const savedPhotos = JSON.parse(localStorage.getItem('albumPhotos') || '[]');
    
    // Combine existing and saved photos with proper structure
    const allPhotos = [
        ...existingPhotos.map((name, index) => ({ 
            id: `existing_${index}`,
            name, 
            data: `images/${name}`, 
            type: 'existing',
            date: new Date().toISOString(),
            comments: JSON.parse(localStorage.getItem(`photo_comments_existing_${index}`) || '[]')
        })),
        ...savedPhotos.map(photo => ({
            ...photo,
            comments: JSON.parse(localStorage.getItem(`photo_comments_${photo.id}`) || '[]')
        }))
    ];
    
    // Store photos globally for photo viewer
    window.currentPhotos = allPhotos;
    
    // Log for debugging
    console.log('Loaded photos:', allPhotos.length, allPhotos);
    
    if (allPhotos.length === 0) {
        photoGrid.innerHTML = '<p style="color: #e8c5ca; text-align: center; font-style: italic; grid-column: 1 / -1; padding: 40px;">No hay fotos en el álbum. ¡Agrega algunas! 📸</p>';
        return;
    }
    
    photoGrid.innerHTML = allPhotos.map((photo, index) => {
        const src = photo.data;
        return `
            <div class="photo-item" data-photo-index="${index}" style="cursor: pointer;">
                <img src="${src}" alt="Foto ${index + 1}" onerror="console.error('Error loading image:', '${src}'); this.parentElement.style.display='none';" loading="lazy" style="width: 100%; height: 200px; object-fit: cover; cursor: pointer;">
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
    
    showNotification('Subiendo fotos... ⏳');
    
    for (const file of files) {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = async function(e) {
                const photoData = {
                    id: Date.now() + Math.random(),
                    data: e.target.result,
                    name: file.name,
                    type: 'uploaded',
                    date: new Date().toISOString()
                };
                
                // Upload to Firebase first
                await uploadPhotoToFirebase(photoData);
                
                // Also save to localStorage as backup
                let savedPhotos = JSON.parse(localStorage.getItem('albumPhotos') || '[]');
                savedPhotos.push(photoData);
                localStorage.setItem('albumPhotos', JSON.stringify(savedPhotos));
            };
            reader.readAsDataURL(file);
        }
    }
    
    // Clear the input
    event.target.value = '';
    
    showNotification('Fotos agregadas al álbum! 📸 Sincronizado en la nube');
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
function updateTimerSettings() {
    if (!isTimerRunning) {
        updateTimerDisplay();
    }
}

function updateTimerDisplay() {
    const focusTime = parseInt(document.getElementById('focusTime').value);
    const breakTime = parseInt(document.getElementById('breakTime').value);
    
    if (timeRemaining === 0) {
        timeRemaining = isBreakTime ? breakTime * 60 : focusTime * 60;
    }
    
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    
    document.getElementById('timerDisplay').textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    document.getElementById('timerMode').textContent = isBreakTime ? 'Descanso' : 'Concentración';
    
    const timerCircle = document.querySelector('.timer-circle');
    timerCircle.className = 'timer-circle';
    if (isTimerRunning) {
        timerCircle.classList.add('active');
    }
    if (isBreakTime) {
        timerCircle.classList.add('break');
    }
}

function startTimer() {
    if (isTimerRunning) return;
    
    isTimerRunning = true;
    
    if (timeRemaining === 0) {
        const focusTime = parseInt(document.getElementById('focusTime').value);
        const breakTime = parseInt(document.getElementById('breakTime').value);
        timeRemaining = isBreakTime ? breakTime * 60 : focusTime * 60;
    }
    
    timer = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();
        
        if (timeRemaining <= 0) {
            clearInterval(timer);
            isTimerRunning = false;
            
            // Play notification sound
            playNotificationSound();
            
            // Switch between focus and break
            if (!isBreakTime) {
                pomodoroCycle++;
                isBreakTime = true;
                showNotification(`¡Excelente! Completaste ${pomodoroCycle} ciclo(s) de concentración. Tiempo de descanso! 🎉`);
            } else {
                isBreakTime = false;
                showNotification('¡Descanso terminado! Es hora de concentrarse de nuevo. 💪');
            }
            
            timeRemaining = 0;
            updateTimerDisplay();
        }
    }, 1000);
    
    updateTimerDisplay();
}

function pauseTimer() {
    if (!isTimerRunning) return;
    
    isTimerRunning = false;
    clearInterval(timer);
    updateTimerDisplay();
}

function resetTimer() {
    isTimerRunning = false;
    clearInterval(timer);
    timeRemaining = 0;
    isBreakTime = false;
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
    
    function addGerbera() {
        const gerbera = document.createElement('div');
        gerbera.className = 'gerbera-float';
        gerbera.textContent = gerberas[Math.floor(Math.random() * gerberas.length)];
        gerbera.style.left = Math.random() * 100 + 'vw';
        gerbera.style.animationDuration = (Math.random() * 10 + 10) + 's';
        gerbera.style.opacity = Math.random() * 0.3 + 0.1;
        
        container.appendChild(gerbera);
        
        // Remove gerbera after animation
        setTimeout(() => {
            if (gerbera.parentNode) {
                gerbera.parentNode.removeChild(gerbera);
            }
        }, 20000);
    }
    
    // Add gerberas periodically
    setInterval(addGerbera, 3000);
    // Add initial gerberas
    for (let i = 0; i < 3; i++) {
        setTimeout(addGerbera, i * 1000);
    }
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
    
    // Load comments
    loadPhotoComments(photo.id || `existing_${index}`);
    
    
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
    // Try to load from Firebase first
    if (window.db && collection && onSnapshot) {
        loadCommentsFromFirebase(photoId);
    } else {
        // Fallback to localStorage
        const comments = JSON.parse(localStorage.getItem(`photo_comments_${photoId}`) || '[]');
        displayComments(comments);
    }
}

function loadCommentsFromFirebase(photoId) {
    try {
        const commentsRef = collection(window.db, 'photo_comments');
        const { query, where, orderBy, onSnapshot: fbOnSnapshot } = window;
        
        // Import query functions
        import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js').then(module => {
            const { query: fbQuery, where: fbWhere, orderBy: fbOrderBy, onSnapshot: fbOnSnapshot } = module;
            
            // Create query for this specific photo
            const q = fbQuery(
                commentsRef,
                fbWhere('photoId', '==', photoId),
                fbOrderBy('timestamp', 'asc')
            );
            
            // Listen for real-time updates
            fbOnSnapshot(q, (snapshot) => {
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
            });
        });
    } catch (error) {
        console.error('Error loading comments from Firebase:', error);
        // Fallback to localStorage
        const comments = JSON.parse(localStorage.getItem(`photo_comments_${photoId}`) || '[]');
        displayComments(comments);
    }
}

function displayComments(comments) {
    const commentsList = document.getElementById('commentsList');
    
    if (comments.length === 0) {
        commentsList.innerHTML = '<div class="no-comments">💭 No hay comentarios aún. ¡Sé el primero en comentar!</div>';
        return;
    }
    
    commentsList.innerHTML = comments.map((comment, index) => `
        <div class="comment-item ${comment.user} fade-cycle">
            <div class="comment-header">
                <span class="comment-user ${comment.user}">${comment.user === 'juan' ? '👨 Juan' : '👩 Ana'}</span>
                <span class="comment-date">${new Date(comment.date).toLocaleDateString('es-ES')}</span>
            </div>
            <div class="comment-text">${comment.text}</div>
        </div>
    `).join('');
    
    // Start fade cycle for existing comments
    setTimeout(() => {
        const commentItems = document.querySelectorAll('.comment-item');
        commentItems.forEach((item, index) => {
            setTimeout(() => {
                startCommentFadeCycle(item);
            }, index * 500); // Stagger the start of animations
        });
    }, 1000);
    
    // Scroll to bottom
    commentsList.scrollTop = commentsList.scrollHeight;
}

window.addComment = async function() {
    const user = document.getElementById('commentUser').value;
    const text = document.getElementById('commentText').value.trim();
    
    if (!text) {
        showNotification('⚠️ Por favor escribe un comentario');
        return;
    }
    
    const photo = window.currentPhotos[currentPhotoIndex];
    const photoId = photo.id || `existing_${currentPhotoIndex}`;
    
    const comment = {
        id: Date.now() + Math.random(), // Make ID more unique
        user,
        text,
        date: new Date().toISOString()
    };
    
    // Try to save to Firebase first
    const savedToFirebase = await saveCommentToFirebase(photoId, comment);
    
    if (!savedToFirebase) {
        // If Firebase fails, save to localStorage as backup
        const comments = JSON.parse(localStorage.getItem(`photo_comments_${photoId}`) || '[]');
        comments.push(comment);
        localStorage.setItem(`photo_comments_${photoId}`, JSON.stringify(comments));
        
        // Update display manually when using localStorage
        displayComments(comments);
        
        // Add special animation for the new comment
        setTimeout(() => {
            const newCommentElement = document.querySelector('.comment-item:last-child');
            if (newCommentElement) {
                newCommentElement.classList.add('new-comment');
                setTimeout(() => {
                    startCommentFadeCycle(newCommentElement);
                }, 2000);
            }
        }, 100);
    }
    // Note: If Firebase succeeds, the onSnapshot listener will automatically update the display
    
    // Clear form
    document.getElementById('commentText').value = '';
    
    showNotification('💕 Comentario agregado');
}

async function saveCommentToFirebase(photoId, comment) {
    try {
        if (window.db && collection && addDoc && serverTimestamp) {
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
        }
        return false;
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
// Function to clear duplicate photos from Firebase
window.clearFirebasePhotos = async function() {
    // Show confirmation dialog
    const userConfirmed = confirm(
        '🧹 ¿Estás seguro de que quieres eliminar todas las fotos duplicadas de Firebase?\n\n' +
        '✅ Esto mantendrá solo las fotos locales\n' +
        '⚠️ Esta acción no se puede deshacer\n\n' +
        'Haz clic en OK para continuar.'
    );
    
    if (!userConfirmed) {
        return;
    }
    
    if (!window.db || !collection || !onSnapshot) {
        showNotification('❌ Firebase no está disponible', 'error');
        console.log('Firebase not available');
        return;
    }
    
    // Show loading notification
    showNotification('🔄 Limpiando duplicados de Firebase...', 'info');
    
    try {
        const { getDocs, deleteDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const photosRef = collection(window.db, 'photos');
        const snapshot = await getDocs(photosRef);
        
        let deletedCount = 0;
        const deletePromises = [];
        
        snapshot.forEach((document) => {
            deletePromises.push(deleteDoc(doc(window.db, 'photos', document.id)));
            deletedCount++;
        });
        
        await Promise.all(deletePromises);
        console.log(`🗑️ Eliminadas ${deletedCount} fotos de Firebase`);
        
        if (deletedCount > 0) {
            showNotification(`✅ ¡Listo! Eliminadas ${deletedCount} fotos duplicadas de Firebase`, 'success');
            
            // Reload the page to refresh the album
            setTimeout(() => {
                showNotification('🔄 Recargando álbum...', 'info');
                setTimeout(() => {
                    location.reload();
                }, 1000);
            }, 2000);
        } else {
            showNotification('ℹ️ No se encontraron fotos duplicadas en Firebase', 'info');
        }
        
    } catch (error) {
        console.error('Error cleaning Firebase photos:', error);
        showNotification('❌ Error limpiando Firebase: ' + error.message, 'error');
    }
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

