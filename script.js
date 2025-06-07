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
            }, 1000);
        } else {
            // Fall back to local storage
            loadExistingPhotos();
            loadSavedMessages();
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
    document.getElementById('saveMessage').addEventListener('click', saveMessage);
    document.getElementById('clearMessage').addEventListener('click', clearMessage);

    // Album section events
    document.getElementById('photoInput').addEventListener('change', handlePhotoUpload);

    // Pomodoro section events
    document.getElementById('startTimer').addEventListener('click', startTimer);
    document.getElementById('pauseTimer').addEventListener('click', pauseTimer);
    document.getElementById('resetTimer').addEventListener('click', resetTimer);
    document.getElementById('testSound').addEventListener('click', testNotificationSound);
    document.getElementById('focusTime').addEventListener('change', updateTimerSettings);
    document.getElementById('breakTime').addEventListener('change', updateTimerSettings);

    // Initialize timer display
    updateTimerDisplay();
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

function displayPhotos(photos) {
    const photoGrid = document.getElementById('photoGrid');
    
    if (photos.length === 0) {
        photoGrid.innerHTML = '<p style="color: #888; text-align: center; font-style: italic; grid-column: 1 / -1;">No hay fotos en el álbum. ¡Agrega algunas!</p>';
        return;
    }
    
    photoGrid.innerHTML = photos.map((photo, index) => {
        const src = photo.data;
        return `
            <div class="photo-item">
                <img src="${src}" alt="${photo.name}" onerror="this.style.display='none'">
                <div class="photo-overlay">
                    <span class="sync-indicator" style="position: absolute; top: 5px; right: 5px; background: rgba(76, 175, 80, 0.8); color: white; padding: 2px 6px; border-radius: 10px; font-size: 0.7em;">☁️</span>
                </div>
            </div>
        `;
    }).join('');
}

// === ALBUM SECTION === //
function loadExistingPhotos() {
    // Load photos that are already in the directory
    const existingPhotos = [
        '6F0A4B53-C8E2-4094-8AC8-87A132F38940.JPG',
        '80E7C940-EBD9-4310-9F35-AADBACF39D31.JPG',
    ];

    const photoGrid = document.getElementById('photoGrid');
    
    // Load saved photos from localStorage
    const savedPhotos = JSON.parse(localStorage.getItem('albumPhotos') || '[]');
    
    // Combine existing and saved photos
    const allPhotos = [...existingPhotos.map(name => ({ name, type: 'existing' })), ...savedPhotos];
    
    if (allPhotos.length === 0) {
        photoGrid.innerHTML = '<p style="color: #888; text-align: center; font-style: italic; grid-column: 1 / -1;">No hay fotos en el álbum. ¡Agrega algunas!</p>';
        return;
    }
    
    photoGrid.innerHTML = allPhotos.map((photo, index) => {
        const src = photo.type === 'existing' ? photo.name : photo.data;
        return `
            <div class="photo-item">
                <img src="${src}" alt="Foto ${index + 1}" onerror="this.style.display='none'">
                <div class="photo-overlay">
                    <button class="delete-photo" onclick="deletePhoto(${index}, '${photo.type}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
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
function showNotification(message) {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 15px 25px;
        border-radius: 10px;
        z-index: 1000;
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease;
        max-width: 300px;
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

// === KEYBOARD SHORTCUTS === //
document.addEventListener('keydown', function(e) {
    // ESC to go back to menu
    if (e.key === 'Escape' && currentSection !== 'menu') {
        showSection('menu');
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

