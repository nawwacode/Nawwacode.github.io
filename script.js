// Mobile Instagram DM Chat Application - Firebase Integration
'use strict';

// ===== FIREBASE CONFIGURATION =====
const firebaseConfig = {
    apiKey: "AIzaSyAqs6FTsugd_RlI1v_SxhSQpVqtsGvaNk",
    authDomain: "simple-chat-d9676.firebaseapp.com",
    databaseURL: "https://simple-chat-d9676-default-rtdb.firebaseio.com",
    projectId: "simple-chat-d9676",
    storageBucket: "simple-chat-d9676.firebasestorage.app",
    messagingSenderId: "734779643316",
    appId: "1:734779643316:web:72de65927e62c418888ee1",
    measurementId: "G-23PFPZKSKD"
};

// ===== GLOBAL VARIABLES =====
let currentUsername = '';
let otherUser = 'المستخدم الآخر';
let db = null;
let messagesRef = null;
let chatId = null;
let isFirebaseConnected = false;

document.addEventListener('DOMContentLoaded', function() {
    // ===== DOM ELEMENTS =====
    const messagesContainer = document.getElementById('messagesContainer');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const otherUserName = document.getElementById('otherUserName');
    const userStatus = document.getElementById('userStatus');
    
    // ===== CONFIGURATION =====
    const MESSAGE_EXPIRY_HOURS = 24;
    const MESSAGE_EXPIRY_MS = MESSAGE_EXPIRY_HOURS * 60 * 60 * 1000;
    
    // ===== STATE MANAGEMENT =====
    let keyboardOpen = false;
    let scrollTimeout = null;
    
    // ===== INITIALIZATION =====
    async function init() {
        try {
            await loadUser();
            await initializeFirebase();
            setupEventListeners();
            setupKeyboardHandlers();
            checkConnectionStatus();
            scrollToBottom();
        } catch (error) {
            console.error('Initialization error:', error);
            showError('حدث خطأ في تهيئة التطبيق. يرجى تحديث الصفحة.');
        }
    }
    
    // ===== USER MANAGEMENT =====
    function loadUser() {
        return new Promise((resolve) => {
            const savedUsername = localStorage.getItem('chatUsername');
            
            if (savedUsername) {
                currentUsername = savedUsername;
                resolve();
            } else {
                const username = prompt('الرجاء إدخال اسمك:', '');
                if (username && username.trim()) {
                    currentUsername = username.trim();
                    localStorage.setItem('chatUsername', currentUsername);
                } else {
                    currentUsername = 'مستخدم';
                    localStorage.setItem('chatUsername', currentUsername);
                }
                resolve();
            }
            
            // Set chat ID (simple chat between two users)
            // In a real app, you'd have user authentication and chat selection
            chatId = 'simple_chat_demo';
        });
    }
    
    // ===== FIREBASE INITIALIZATION =====
    async function initializeFirebase() {
        return new Promise((resolve, reject) => {
            try {
                // Check if Firebase is already initialized
                if (firebase.apps.length === 0) {
                    // Initialize Firebase
                    firebase.initializeApp(firebaseConfig);
                    console.log('✅ Firebase initialized successfully');
                }
                
                db = firebase.database();
                
                // Test connection
                const connectedRef = db.ref('.info/connected');
                connectedRef.on('value', (snap) => {
                    isFirebaseConnected = snap.val() === true;
                    updateConnectionStatus();
                    
                    if (isFirebaseConnected) {
                        console.log('✅ Connected to Firebase');
                        setupDatabaseReferences();
                        resolve();
                    }
                });
                
                // Set timeout for connection
                setTimeout(() => {
                    if (!isFirebaseConnected) {
                        console.log('⚠️ Firebase connection timeout');
                        showWarning('الاتصال بطيء. التطبيق يعمل في وضع عدم الاتصال.');
                        setupOfflineMode();
                        resolve(); // Continue in offline mode
                    }
                }, 5000);
                
            } catch (error) {
                console.error('❌ Firebase initialization error:', error);
                showError('حدث خطأ في الاتصال بالخادم. التطبيق يعمل في وضع عدم الاتصال.');
                setupOfflineMode();
                resolve(); // Continue in offline mode
            }
        });
    }
    
    function setupDatabaseReferences() {
        if (!db) return;
        
        // Set up messages reference
        messagesRef = db.ref('chats/' + chatId + '/messages');
        
        // Listen for new messages
        setupMessageListener();
        
        // Load existing messages
        loadExistingMessages();
    }
    
    function setupOfflineMode() {
        console.log('📴 Running in offline mode');
        userStatus.textContent = 'وضع عدم الاتصال';
        userStatus.style.color = '#f44336';
        
        // Load messages from localStorage
        loadLocalMessages();
    }
    
    // ===== MESSAGE LISTENER =====
    function setupMessageListener() {
        if (!messagesRef) return;
        
        // Listen for new messages added
        messagesRef.orderByChild('timestamp').on('child_added', (snapshot) => {
            const message = snapshot.val();
            const messageId = snapshot.key;
            
            processIncomingMessage(message, messageId);
        });
    }
    
    function loadExistingMessages() {
        if (!messagesRef) return;
        
        // Load last 50 messages
        messagesRef.orderByChild('timestamp')
            .limitToLast(50)
            .once('value')
            .then((snapshot) => {
                snapshot.forEach((childSnapshot) => {
                    const message = childSnapshot.val();
                    const messageId = childSnapshot.key;
                    
                    processIncomingMessage(message, messageId, false);
                });
                
                scrollToBottom();
            })
            .catch((error) => {
                console.error('Error loading messages:', error);
            });
    }
    
    function processIncomingMessage(message, messageId, shouldScroll = true) {
        // Check if message is expired
        const messageAge = Date.now() - message.timestamp;
        if (messageAge > MESSAGE_EXPIRY_MS) {
            console.log('Message expired, ignoring:', messageId);
            return;
        }
        
        // Check if this message is already displayed
        if (isMessageDisplayed(messageId)) {
            return;
        }
        
        // Determine if message is sent by current user
        const isSent = message.sender === currentUsername;
        
        // Update other user's name if needed
        if (!isSent && message.sender !== otherUser) {
            otherUser = message.sender;
            otherUserName.textContent = otherUser;
        }
        
        // Render the message
        renderMessage(message, isSent, messageId);
        
        // Save to localStorage for offline access
        saveMessageToLocalStorage(message, messageId);
        
        // Scroll to bottom if needed
        if (shouldScroll && keyboardOpen) {
            setTimeout(scrollToBottom, 50);
        }
    }
    
    // ===== EVENT LISTENERS =====
    function setupEventListeners() {
        // Send message on button click
        sendButton.addEventListener('click', sendMessage);
        
        // Send message on Enter key
        messageInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        // Prevent zoom gestures
        document.addEventListener('gesturestart', function(e) {
            e.preventDefault();
        });
    }
    
    // ===== KEYBOARD HANDLING =====
    function setupKeyboardHandlers() {
        // Scroll to bottom when keyboard opens
        messageInput.addEventListener('focus', function() {
            keyboardOpen = true;
            setTimeout(scrollToBottom, 300);
        });
        
        messageInput.addEventListener('blur', function() {
            keyboardOpen = false;
        });
        
        // Handle window resize (keyboard show/hide)
        window.addEventListener('resize', function() {
            if (keyboardOpen) {
                setTimeout(scrollToBottom, 100);
            }
        });
    }
    
    // ===== MESSAGE HANDLING =====
    function sendMessage() {
        const messageText = messageInput.value.trim();
        
        if (!messageText) return;
        
        // Create message object
        const message = {
            text: messageText,
            sender: currentUsername,
            timestamp: Date.now()
        };
        
        // Clear input
        messageInput.value = '';
        
        // Keep keyboard open on iOS
        messageInput.focus();
        
        // Render message immediately (optimistic update)
        const tempMessageId = 'temp_' + Date.now();
        renderMessage(message, true, tempMessageId);
        
        // Scroll to show new message
        setTimeout(scrollToBottom, 50);
        
        // Send to Firebase
        sendMessageToFirebase(message, tempMessageId);
    }
    
    function sendMessageToFirebase(message, tempMessageId) {
        if (!messagesRef) {
            console.log('📴 Firebase not available, saving locally');
            saveMessageToLocalStorage(message, tempMessageId);
            return;
        }
        
        // Push message to Firebase
        messagesRef.push(message)
            .then((ref) => {
                console.log('✅ Message sent to Firebase with ID:', ref.key);
                
                // Replace temp message with real one
                if (tempMessageId) {
                    const tempElement = document.querySelector(`[data-message-id="${tempMessageId}"]`);
                    if (tempElement) {
                        tempElement.setAttribute('data-message-id', ref.key);
                    }
                }
            })
            .catch((error) => {
                console.error('❌ Error sending message:', error);
                
                // Save to local storage for retry
                saveFailedMessage(message, tempMessageId);
                
                // Show error message
                showError('فشل إرسال الرسالة. سيتم إعادة المحاولة تلقائياً.');
            });
    }
    
    // ===== LOCAL STORAGE FUNCTIONS =====
    function saveMessageToLocalStorage(message, messageId) {
        try {
            const messages = JSON.parse(localStorage.getItem('chatMessages') || '{}');
            messages[messageId] = message;
            localStorage.setItem('chatMessages', JSON.stringify(messages));
        } catch (error) {
            console.error('Error saving to localStorage:', error);
        }
    }
    
    function loadLocalMessages() {
        try {
            const messages = JSON.parse(localStorage.getItem('chatMessages') || '{}');
            
            Object.keys(messages).forEach(messageId => {
                const message = messages[messageId];
                const messageAge = Date.now() - message.timestamp;
                
                if (messageAge < MESSAGE_EXPIRY_MS) {
                    const isSent = message.sender === currentUsername;
                    if (!isMessageDisplayed(messageId)) {
                        renderMessage(message, isSent, messageId);
                    }
                }
            });
            
            scrollToBottom();
        } catch (error) {
            console.error('Error loading from localStorage:', error);
        }
    }
    
    function saveFailedMessage(message, tempMessageId) {
        try {
            const failedMessages = JSON.parse(localStorage.getItem('failedMessages') || '[]');
            failedMessages.push({
                message: message,
                tempId: tempMessageId,
                timestamp: Date.now(),
                retryCount: 0
            });
            localStorage.setItem('failedMessages', JSON.stringify(failedMessages));
            
            // Schedule retry
            setTimeout(retryFailedMessages, 5000);
        } catch (error) {
            console.error('Error saving failed message:', error);
        }
    }
    
    function retryFailedMessages() {
        if (!isFirebaseConnected) return;
        
        try {
            const failedMessages = JSON.parse(localStorage.getItem('failedMessages') || '[]');
            const remainingMessages = [];
            
            failedMessages.forEach((failed, index) => {
                if (failed.retryCount < 3) {
                    sendMessageToFirebase(failed.message, failed.tempId);
                    failed.retryCount++;
                    remainingMessages.push(failed);
                }
            });
            
            localStorage.setItem('failedMessages', JSON.stringify(remainingMessages));
        } catch (error) {
            console.error('Error retrying failed messages:', error);
        }
    }
    
    // ===== RENDER FUNCTIONS =====
    function renderMessage(messageData, isSent = false, messageId = '') {
        // Create message element
        const messageElement = document.createElement('div');
        messageElement.className = `message ${isSent ? 'sent' : 'received'}`;
        messageElement.setAttribute('data-timestamp', messageData.timestamp);
        if (messageId) {
            messageElement.setAttribute('data-message-id', messageId);
        }
        
        // Format time
        const timeString = formatTime(messageData.timestamp);
        
        // Add status indicator for sent messages
        const statusIndicator = isSent ? 
            `<span class="message-status">${messageId.startsWith('temp_') ? '⏳' : '✓'}</span>` : '';
        
        // Create message bubble HTML
        messageElement.innerHTML = `
            <div class="message-bubble">
                <p class="message-text">${escapeHtml(messageData.text)}</p>
                <span class="message-time">${timeString} ${statusIndicator}</span>
            </div>
        `;
        
        // Add to messages container
        messagesContainer.appendChild(messageElement);
        
        // Add date separator if needed
        addDateSeparator(messageData.timestamp);
    }
    
    // ===== UTILITY FUNCTIONS =====
    function formatTime(timestamp) {
        const date = new Date(timestamp);
        let hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'م' : 'ص';
        
        hours = hours % 12;
        hours = hours ? hours : 12;
        
        return `${hours}:${minutes} ${ampm}`;
    }
    
    function addDateSeparator(timestamp) {
        const messages = messagesContainer.querySelectorAll('.message');
        if (messages.length === 0) return;
        
        const lastMessage = messages[messages.length - 1];
        const lastDate = new Date(parseInt(lastMessage.getAttribute('data-timestamp')));
        const newDate = new Date(timestamp);
        
        if (lastDate.toDateString() !== newDate.toDateString()) {
            const separator = document.createElement('div');
            separator.className = 'date-separator';
            
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            
            let dateText;
            if (newDate.toDateString() === today.toDateString()) {
                dateText = 'اليوم';
            } else if (newDate.toDateString() === yesterday.toDateString()) {
                dateText = 'أمس';
            } else {
                dateText = newDate.toLocaleDateString('ar-EG', {
                    day: 'numeric',
                    month: 'long'
                });
            }
            
            separator.innerHTML = `<span>${dateText}</span>`;
            messagesContainer.appendChild(separator);
        }
    }
    
    function scrollToBottom() {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            try {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            } catch (error) {
                console.log('Scroll error:', error);
            }
        }, 50);
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    function isMessageDisplayed(messageId) {
        return document.querySelector(`[data-message-id="${messageId}"]`) !== null;
    }
    
    function updateConnectionStatus() {
        if (isFirebaseConnected) {
            userStatus.textContent = 'متصل';
            userStatus.style.color = '#4caf50';
        } else {
            userStatus.textContent = 'غير متصل';
            userStatus.style.color = '#f44336';
        }
    }
    
    function checkConnectionStatus() {
        if (db) {
            const connectedRef = db.ref('.info/connected');
            connectedRef.on('value', (snap) => {
                isFirebaseConnected = snap.val() === true;
                updateConnectionStatus();
                
                if (isFirebaseConnected) {
                    retryFailedMessages();
                }
            });
        }
    }
    
    function showError(message) {
        console.error('Error:', message);
        // يمكن إضافة نافذة تنبيه أو عنصر في UI
    }
    
    function showWarning(message) {
        console.warn('Warning:', message);
    }
    
    // ===== CLEANUP FUNCTIONS =====
    function cleanupExpiredMessages() {
        const now = Date.now();
        
        // Clean DOM
        const messages = messagesContainer.querySelectorAll('.message');
        messages.forEach(messageEl => {
            const timestamp = parseInt(messageEl.getAttribute('data-timestamp'));
            if (now - timestamp > MESSAGE_EXPIRY_MS) {
                messageEl.remove();
            }
        });
        
        // Clean localStorage
        try {
            const messages = JSON.parse(localStorage.getItem('chatMessages') || '{}');
            const filteredMessages = {};
            
            Object.keys(messages).forEach(messageId => {
                const message = messages[messageId];
                if (now - message.timestamp < MESSAGE_EXPIRY_MS) {
                    filteredMessages[messageId] = message;
                }
            });
            
            localStorage.setItem('chatMessages', JSON.stringify(filteredMessages));
        } catch (error) {
            console.error('Error cleaning localStorage:', error);
        }
    }
    
    // ===== INITIALIZE APP =====
    init();
    
    // Cleanup expired messages every hour
    setInterval(cleanupExpiredMessages, 60 * 60 * 1000);
    
    // Retry failed messages every 30 seconds if connected
    setInterval(() => {
        if (isFirebaseConnected) {
            retryFailedMessages();
        }
    }, 30000);
});