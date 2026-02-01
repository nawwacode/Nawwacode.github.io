'use strict';

document.addEventListener('DOMContentLoaded', () => {

  /* ================= FIREBASE ================= */

  const firebaseConfig = {
    apiKey: "AIzaSyAqs6FTsugd_RLl1v_SxhSQuPvqtsGvaNk",
    authDomain: "simple-chat-d9676.firebaseapp.com",
    databaseURL: "https://simple-chat-d9676-default-rtdb.firebaseio.com",
    projectId: "simple-chat-d9676",
    storageBucket: "simple-chat-d9676.firebasestorage.app",
    messagingSenderId: "734779643316",
    appId: "1:734779643316:web:72de65927e62c418888ee1"
  };

  firebase.initializeApp(firebaseConfig);

  const db = firebase.database();
  const messagesRef = db.ref('messages');

  /* ================= DOM ================= */

  const messagesContainer = document.getElementById('messagesContainer');
  const messageInput = document.getElementById('messageInput');
  const sendButton = document.getElementById('sendButton');
  const otherUserName = document.getElementById('otherUserName');

  /* ================= CONFIG ================= */

  const MESSAGE_EXPIRY_MS = 24 * 60 * 60 * 1000;
  let currentUsername = '';
  let otherUser = 'المستخدم الآخر';
  let scrollTimeout = null;

  /* ================= INIT ================= */

  init();

  function init() {
    loadUser();
    setupEvents();
    listenForMessages();
    scrollToBottom();
  }

  /* ================= USER ================= */

  function loadUser() {
    const saved = localStorage.getItem('chatUsername');
    if (saved) {
      currentUsername = saved;
    } else {
      const name = prompt('اكتب اسمك:', '');
      currentUsername = name && name.trim() ? name.trim() : 'مستخدم';
      localStorage.setItem('chatUsername', currentUsername);
    }
  }

  /* ================= EVENTS ================= */

  function setupEvents() {
    sendButton.addEventListener('click', sendMessage);

    messageInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    messageInput.addEventListener('focus', () => {
      setTimeout(scrollToBottom, 150);
    });

    window.addEventListener('resize', () => {
      setTimeout(scrollToBottom, 150);
    });
  }

  /* ================= SEND ================= */

  function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;

    const message = {
      text,
      sender: currentUsername,
      timestamp: Date.now()
    };

    messageInput.value = '';
    messageInput.focus();

    // ❗ Firebase فقط هو اللي يرسم الرسالة
    messagesRef.push(message);
  }

  /* ================= RECEIVE ================= */

  function listenForMessages() {
    messagesRef.limitToLast(200).on('child_added', snapshot => {
      const message = snapshot.val();
      if (!message) return;

      // حذف الرسائل الأقدم من 24 ساعة
      if (Date.now() - message.timestamp > MESSAGE_EXPIRY_MS) return;

      const isMine = message.sender === currentUsername;
      renderMessage(message, isMine);
      scrollToBottom();
    });
  }

  /* ================= RENDER ================= */

  function renderMessage(message, isSent) {

    if (!isSent && message.sender !== otherUser) {
      otherUser = message.sender;
      if (otherUserName) otherUserName.textContent = otherUser;
    }

    const el = document.createElement('div');
    el.className = `message ${isSent ? 'sent' : 'received'}`;
    el.dataset.timestamp = message.timestamp;

    el.innerHTML = `
      <div class="message-bubble">
        <p class="message-text">${escapeHtml(message.text)}</p>
        <span class="message-time">${formatTime(message.timestamp)}</span>
      </div>
    `;

    messagesContainer.appendChild(el);
  }

  /* ================= HELPERS ================= */

  function scrollToBottom() {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 50);
  }

  function formatTime(ts) {
    const d = new Date(ts);
    let h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'م' : 'ص';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

});