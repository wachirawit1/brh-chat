// ============================================
// BRH Chat — Real-time Chat Application
// Frontend Logic with Socket.io + IT Board
// ============================================

(function () {
  'use strict';

  // ----- Avatar Color Helpers (Supports CSS classes and Hex/RGB/HSL codes) -----
  function getAvatarBg(color) {
    if (!color) return 'linear-gradient(135deg, #3b82f6, #2563eb)';
    if (color.startsWith('#') || color.startsWith('rgb') || color.startsWith('hsl') || color.startsWith('linear-gradient')) {
      return color;
    }
    const AVATAR_COLORS = {
      'avatar-blue': 'linear-gradient(135deg, #3b82f6, #2563eb)',
      'avatar-teal': 'linear-gradient(135deg, #14b8a6, #0d9488)',
      'avatar-violet': 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
      'avatar-rose': 'linear-gradient(135deg, #f43f5e, #e11d48)',
      'avatar-amber': 'linear-gradient(135deg, #f59e0b, #d97706)',
      'avatar-emerald': 'linear-gradient(135deg, #10b981, #059669)',
      'avatar-sky': 'linear-gradient(135deg, #0ea5e9, #0284c7)',
      'avatar-pink': 'linear-gradient(135deg, #ec4899, #db2777)'
    };
    return AVATAR_COLORS[color] || color;
  }

  function setElementAvatar(element, initials, avatarColor) {
    element.textContent = initials;
    element.className = 'avatar-circle';
    element.style.background = getAvatarBg(avatarColor);
  }

  // ----- State -----
  let currentUser = null;        // Logged-in user info (includes .role)
  let conversations = [];        // Conversations list from API
  let allStaff = [];             // Staff list from API for starting new chats
  let activeConvId = null;       // Currently selected conversation ID
  let activeOtherUser = null;    // The other user in active conversation
  let pendingFile = null;        // File waiting to be sent
  let typingTimeout = null;      // Typing debounce timer
  let socket = null;             // Socket.io connection
  let activeTab = 'chats';       // Current sidebar tab: 'chats' or 'itboard'
  let itPosts = [];              // IT Board posts
  let mediaRecorder = null;      // MediaRecorder instance
  let audioChunks = [];          // Chunks of audio data
  let recordingInterval = null;  // Interval for recording timer
  let recordingStartTime = 0;    // Start time of recording
  let isRecordingCanceled = false; // Flag to check if recording was canceled

  // ----- DOM Refs -----
  const chatListEl       = document.getElementById('chat-list');
  const messagesAreaEl   = document.getElementById('messages-area');
  const searchInput      = document.getElementById('search-input');
  const searchContainer  = document.getElementById('search-container');
  const quickTemplates   = document.getElementById('quick-templates');
  const messageInput     = document.getElementById('message-input');
  const sendBtn          = document.getElementById('btn-send');
  const recordBtn        = document.getElementById('btn-record');
  const recordingOverlay = document.getElementById('recording-overlay');
  const recordingTimeEl  = document.getElementById('recording-time');
  const cancelRecordBtn  = document.getElementById('btn-cancel-record');
  const inputWrapper     = document.getElementById('input-wrapper');
  const attachBtn        = document.getElementById('btn-attach');
  const fileInput        = document.getElementById('file-input');
  const headerAvatar     = document.getElementById('header-avatar');
  const headerNameText   = document.getElementById('header-name-text');
  const headerDept       = document.getElementById('header-dept');
  const headerOnlineDot  = document.getElementById('header-online-dot');
  const headerStatus     = document.getElementById('header-status');
  const btnSearchMsg     = document.getElementById('btn-search-msg');
  const msgSearchBar     = document.getElementById('msg-search-bar');
  const msgSearchInput   = document.getElementById('msg-search-input');
  const btnCloseMsgSearch= document.getElementById('btn-close-msg-search');
  const typingIndicator  = document.getElementById('typing-indicator');
  const typingNameEl     = document.getElementById('typing-name');
  const myAvatar         = document.getElementById('my-avatar');
  const myName           = document.getElementById('my-name');
  const myDept           = document.getElementById('my-dept');
  const logoutBtn        = document.getElementById('btn-logout');
  const emptyState       = document.getElementById('empty-state');
  const chatView         = document.getElementById('chat-view');
  const filePreview      = document.getElementById('file-preview');
  const filePreviewImg   = document.getElementById('file-preview-img');
  const filePreviewVideo = document.getElementById('file-preview-video');
  const filePreviewVideoName = document.getElementById('file-preview-video-name');
  const filePreviewName  = document.getElementById('file-preview-name');
  const filePreviewSize  = document.getElementById('file-preview-size');
  const filePreviewRemove = document.getElementById('file-preview-remove');
  const uploadProgress   = document.getElementById('upload-progress');
  const uploadProgressBar = document.getElementById('upload-progress-bar');
  const lightbox         = document.getElementById('lightbox');
  const lightboxImg      = document.getElementById('lightbox-img');
  const lightboxClose    = document.getElementById('lightbox-close');

  // Tab elements
  const tabChats         = document.getElementById('tab-chats');
  const tabItboard       = document.getElementById('tab-itboard');
  const tabItboardLabel  = document.getElementById('tab-itboard-label');
  const itboardBadge     = document.getElementById('itboard-badge');
  const itboardPanel     = document.getElementById('itboard-panel');
  const itboardList      = document.getElementById('itboard-list');
  const btnCreatePost    = document.getElementById('btn-create-post');
  const itboardCreate    = document.getElementById('itboard-create');

  // Gallery DOM Refs
  const btnGallery           = document.getElementById('btn-gallery');
  const chatGallerySidebar   = document.getElementById('chat-gallery-sidebar');
  const btnCloseGallery      = document.getElementById('btn-close-gallery');
  const galleryGridMedia     = document.getElementById('gallery-grid-media');
  const galleryEmptyMedia    = document.getElementById('gallery-empty-media');
  const galleryListDocs      = document.getElementById('gallery-list-docs');
  const galleryEmptyDocs     = document.getElementById('gallery-empty-docs');

  // Custom Quick Templates DOM Refs
  const quickTemplatesChips  = document.getElementById('quick-templates-chips');
  const btnTemplateSettings  = document.getElementById('btn-template-settings');
  const modalTemplates       = document.getElementById('modal-templates');
  const modalCloseTemplates  = document.getElementById('modal-close-templates');
  const btnCloseTemplatesModal = document.getElementById('btn-close-templates-modal');
  const newTemplateInput     = document.getElementById('new-template-input');
  const btnAddTemplate       = document.getElementById('btn-add-template');
  const templateListManage   = document.getElementById('template-list-manage');

  // Modal elements
  const modalCreatePost  = document.getElementById('modal-create-post');
  const modalClosePost   = document.getElementById('modal-close-post');
  const btnCancelPost    = document.getElementById('btn-cancel-post');
  const btnSubmitPost    = document.getElementById('btn-submit-post');
  const postTitle        = document.getElementById('post-title');
  const postDescription  = document.getElementById('post-description');

  // IT Profile Settings & Recommendation DOM elements
  const btnProfileSettings = document.getElementById('btn-profile-settings');
  const modalProfileSettings = document.getElementById('modal-profile-settings');
  const modalCloseProfileSettings = document.getElementById('modal-close-profile-settings');
  const btnCancelProfileSettings = document.getElementById('btn-cancel-profile-settings');
  const btnSaveProfileSettings = document.getElementById('btn-save-profile-settings');
  const recommendationArea = document.getElementById('recommendation-area');
  const recommendedStaffList = document.getElementById('recommended-staff-list');

  // ============================================
  // INITIALIZATION
  // ============================================

  async function init() {
    // Check auth
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (!data.user) {
        window.location.href = '/login.html';
        return;
      }
      currentUser = data.user;
    } catch {
      window.location.href = '/login.html';
      return;
    }

    // Set user profile in sidebar
    setElementAvatar(myAvatar, currentUser.initials, currentUser.avatar_color);
    myName.textContent = currentUser.full_name;
    myDept.textContent = currentUser.department;

    // Set IT Board tab label based on role
    if (currentUser.role === 'it' || currentUser.role === 'admin') {
      tabItboardLabel.textContent = 'รับงาน IT';
      if (btnProfileSettings) btnProfileSettings.style.display = 'flex';
    } else {
      tabItboardLabel.textContent = 'แจ้งปัญหา IT';
      if (btnProfileSettings) btnProfileSettings.style.display = 'none';
    }

    // Connect Socket.io
    initSocket();

    // Load conversations
    await loadConversations();

    // Load staff list
    await loadStaff();

    // Load IT Board (to show badge count)
    await loadITBoard();

    // Initialize quick templates from localStorage
    initQuickTemplates();

    // Set up event listeners
    setupListeners();
  }

  // ============================================
  // SOCKET.IO
  // ============================================

  function initSocket() {
    socket = io();

    socket.on('connect', () => {
      console.log('🟢 Socket connected');
    });

    // New message received from another user
    socket.on('new_message', (msg) => {
      handleIncomingMessage(msg);
    });

    // Confirmation that our message was sent
    socket.on('message_sent', (msg) => {
      handleOwnMessage(msg);
    });

    // Typing events
    socket.on('typing_start', (data) => {
      if (data.conversation_id === activeConvId) {
        showTyping(data.user_name);
      }
    });

    socket.on('typing_stop', (data) => {
      if (data.conversation_id === activeConvId) {
        hideTyping();
      }
    });

    // Online/offline status
    socket.on('user_online', (data) => {
      updateOnlineStatus(data.userId, true);
    });

    socket.on('user_offline', (data) => {
      updateOnlineStatus(data.userId, false);
    });

    // Messages read by other user
    socket.on('messages_read', (data) => {
      if (data.conversation_id === activeConvId) {
        document.querySelectorAll('.msg-read-check.unread').forEach(el => {
          el.classList.remove('unread');
          el.textContent = '\u2713\u2713';
        });
      }
    });

    socket.on('message_error', (data) => {
      showToast(data.error || 'ไม่สามารถส่งข้อความได้');
    });

    // IT Board socket events
    socket.on('new_it_post', (post) => {
      if (currentUser.role === 'it' || currentUser.role === 'admin') {
        // Add to local posts and re-render if on IT Board tab
        itPosts.unshift(post);
        if (activeTab === 'itboard') {
          renderITBoard();
        }
        updateITBadge();
        showToast(`📥 แจ้งปัญหาใหม่: "${post.title}" จาก ${post.user_name}`);
      }
    });

    socket.on('it_post_accepted', (data) => {
      // Remove from pending list
      itPosts = itPosts.filter(p => p.id !== data.post_id);
      if (activeTab === 'itboard') {
        renderITBoard();
      }
      updateITBadge();
      // Reload conversations to show new chat
      loadConversations();
    });

    socket.on('post_accepted_notify', (data) => {
      showToast(`✅ เจ้าหน้าที่ ${data.accepted_by} รับเรื่อง "${data.post_title}" ของคุณแล้ว`);
      // Reload conversations and IT posts
      loadConversations();
      if (activeTab === 'itboard') {
        loadITBoard();
      }
    });

    socket.on('it_post_resolved', (data) => {
      if (activeTab === 'itboard') {
        loadITBoard();
      }
    });
  }

  // ============================================
  // LOAD DATA FROM API
  // ============================================

  async function loadConversations() {
    try {
      const res = await fetch('/api/conversations');
      const data = await res.json();
      conversations = data.conversations || [];
      renderChatList(searchInput ? searchInput.value : '');
    } catch (err) {
      console.error('Load conversations error:', err);
    }
  }

  async function loadStaff() {
    try {
      const res = await fetch('/api/staff');
      const data = await res.json();
      allStaff = data.staff || [];
      renderChatList(searchInput ? searchInput.value : '');
    } catch (err) {
      console.error('Load staff error:', err);
    }
  }

  async function loadMessages(conversationId) {
    try {
      const res = await fetch(`/api/messages/${conversationId}`);
      const data = await res.json();
      renderMessages(data.messages || []);

      // Mark as read via socket
      socket.emit('mark_read', { conversation_id: conversationId });

      // Update unread count in local state
      const conv = conversations.find(c => c.conversation_id === conversationId);
      if (conv) {
        conv.unread_count = 0;
        renderChatList();
      }
    } catch (err) {
      console.error('Load messages error:', err);
    }
  }

  function setupAudioRecordingListeners() {
    let isRecording = false;

    recordBtn.addEventListener('click', async () => {
      console.log('Record button clicked. Current isRecording state:', isRecording);
      if (!activeConvId) {
        showToast('กรุณาเลือกแชทก่อนอัดเสียง');
        return;
      }

      if (isRecording) {
        console.log('Stopping recording...');
        stopRecording();
      } else {
        console.log('Starting recording...');
        startRecording();
      }
    });

    cancelRecordBtn.addEventListener('click', () => {
      console.log('Cancel recording clicked.');
      if (isRecording) {
        isRecordingCanceled = true;
        stopRecording();
        showToast('ยกเลิกการอัดเสียง');
      }
    });

    async function startRecording() {
      try {
        console.log('Requesting microphone permissions...');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('Microphone access granted.');
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        isRecordingCanceled = false;

        mediaRecorder.addEventListener('dataavailable', event => {
          console.log('Audio data chunk available, size:', event.data.size);
          if (event.data.size > 0) {
            audioChunks.push(event.data);
          }
        });

        mediaRecorder.addEventListener('stop', () => {
          console.log('MediaRecorder stopped. isRecordingCanceled:', isRecordingCanceled, 'Chunks:', audioChunks.length);
          clearInterval(recordingInterval);
          recordBtn.classList.remove('recording');
          recordingOverlay.style.display = 'none';
          inputWrapper.style.display = 'block';
          recordBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>';
          isRecording = false;

          // Stop all audio tracks
          try {
            stream.getTracks().forEach(track => {
              console.log('Stopping track:', track.label);
              track.stop();
            });
          } catch (trackErr) {
            console.error('Error stopping stream tracks:', trackErr);
          }

          if (!isRecordingCanceled && audioChunks.length > 0) {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            sendAudioMessage(audioBlob);
          }
        });

        mediaRecorder.start();
        isRecording = true;
        console.log('MediaRecorder started successfully. State:', mediaRecorder.state);

        // UI changes
        recordBtn.classList.add('recording');
        recordBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="2" ry="2"></rect></svg>'; // Stop icon
        inputWrapper.style.display = 'none';
        recordingOverlay.style.display = 'flex';
        recordingTimeEl.textContent = '0:00';
        
        recordingStartTime = Date.now();
        recordingInterval = setInterval(() => {
          const seconds = Math.floor((Date.now() - recordingStartTime) / 1000);
          const m = Math.floor(seconds / 60);
          const s = seconds % 60;
          recordingTimeEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
        }, 1000);

      } catch (err) {
        console.error('Error accessing microphone:', err);
        showToast('ไม่สามารถเข้าถึงไมโครโฟนได้ (ต้องรันผ่าน HTTPS หรือ localhost)');
      }
    }

    function stopRecording() {
      try {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
          console.log('Calling mediaRecorder.stop(), current state:', mediaRecorder.state);
          mediaRecorder.stop();
        } else {
          console.warn('Cannot stop. mediaRecorder is null or inactive:', mediaRecorder ? mediaRecorder.state : 'null');
        }
      } catch (stopErr) {
        console.error('Error calling mediaRecorder.stop():', stopErr);
      }
    }

    async function sendAudioMessage(audioBlob) {
      const formData = new FormData();
      formData.append('file', audioBlob, `voice_message_${Date.now()}.webm`);

      uploadProgress.style.display = 'block';
      uploadProgressBar.style.width = '0%';
      console.log('Uploading audio message blob...');

      try {
        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
          body: formData
        });

        const data = await response.json();
        uploadProgress.style.display = 'none';
        console.log('Upload response data:', data);

        if (response.ok && data.success) {
          console.log('Audio upload success. Emitting send_message via socket...');
          socket.emit('send_message', {
            conversation_id: activeConvId,
            message_text: '',
            media_path: data.path,
            media_type: 'audio',
            media_caption: 'ข้อความเสียง'
          });
        } else {
          console.error('Upload failed on server:', data.error);
          showToast(data.error || 'Upload failed');
        }
      } catch (err) {
        console.error('Upload error:', err);
        uploadProgress.style.display = 'none';
        showToast('เกิดข้อผิดพลาดในการอัปโหลดไฟล์เสียง');
      }
    }
  }

  // ============================================
  // SIDEBAR TABS
  // ============================================

  function switchTab(tab) {
    activeTab = tab;

    // Update tab UI
    document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
    if (tab === 'chats') {
      tabChats.classList.add('active');
      chatListEl.style.display = '';
      searchContainer.style.display = '';
      itboardPanel.style.display = 'none';
    } else {
      tabItboard.classList.add('active');
      chatListEl.style.display = 'none';
      searchContainer.style.display = 'none';
      itboardPanel.style.display = 'flex';
      loadITBoard();
    }
  }

  // ============================================
  // IT BOARD
  // ============================================

  async function loadITBoard() {
    const isIT = currentUser.role === 'it' || currentUser.role === 'admin';

    try {
      if (isIT) {
        // IT staff: show pending posts (queue) + my jobs
        const [pendingRes, jobsRes] = await Promise.all([
          fetch('/api/it-posts/pending'),
          fetch('/api/it-posts/my-jobs')
        ]);
        const pendingData = await pendingRes.json();
        const jobsData = await jobsRes.json();

        itPosts = pendingData.posts || [];
        const myJobs = jobsData.posts || [];

        renderITBoardForIT(itPosts, myJobs);
      } else {
        // Staff: show create button + my posts
        const res = await fetch('/api/it-posts/mine');
        const data = await res.json();
        itPosts = data.posts || [];
        renderITBoardForStaff(itPosts);
      }
    } catch (err) {
      console.error('Load IT Board error:', err);
    }
  }

  function renderITBoardForIT(pendingPosts, myJobs) {
    itboardCreate.style.display = 'none'; // IT staff don't create posts
    itboardList.innerHTML = '';

    // Section: Pending Posts (Queue)
    if (pendingPosts.length > 0) {
      const header = document.createElement('div');
      header.className = 'itboard-section-header';
      header.innerHTML = `<span class="itboard-section-icon pending">📥</span> งานรอรับ <span class="itboard-count">${pendingPosts.length}</span>`;
      itboardList.appendChild(header);

      pendingPosts.forEach(post => {
        const card = createPostCard(post, 'pending');
        itboardList.appendChild(card);
      });
    }

    // Section: My Active Jobs
    const activeJobs = myJobs.filter(j => j.status === 'accepted');
    if (activeJobs.length > 0) {
      const header2 = document.createElement('div');
      header2.className = 'itboard-section-header';
      header2.innerHTML = `<span class="itboard-section-icon active">🔧</span> งานของฉัน <span class="itboard-count">${activeJobs.length}</span>`;
      itboardList.appendChild(header2);

      activeJobs.forEach(post => {
        const card = createPostCard(post, 'my-job');
        itboardList.appendChild(card);
      });
    }

    if (pendingPosts.length === 0 && activeJobs.length === 0) {
      itboardList.innerHTML = '<div class="itboard-empty"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><p>ไม่มีงานค้างอยู่</p></div>';
    }

    updateITBadge();
  }

  function renderITBoardForStaff(myPosts) {
    itboardCreate.style.display = 'flex';
    itboardList.innerHTML = '';

    if (myPosts.length === 0) {
      itboardList.innerHTML = '<div class="itboard-empty"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg><p>คุณยังไม่เคยแจ้งปัญหา</p><span>กดปุ่ม "แจ้งปัญหา IT" เพื่อส่งเรื่องให้ฝ่ายไอที</span></div>';
      return;
    }

    const header = document.createElement('div');
    header.className = 'itboard-section-header';
    header.innerHTML = `<span class="itboard-section-icon">📋</span> รายการแจ้งปัญหาของฉัน`;
    itboardList.appendChild(header);

    myPosts.forEach(post => {
      const card = createPostCard(post, 'mine');
      itboardList.appendChild(card);
    });
  }

  function renderITBoard() {
    // Quick re-render for pending posts (IT view)
    if (currentUser.role === 'it' || currentUser.role === 'admin') {
      renderITBoardForIT(itPosts, []);
    }
  }

  function createPostCard(post, type) {
    const card = document.createElement('div');
    card.className = 'itboard-card ' + post.status;

    const timeStr = formatTime(post.created_at);

    // Status badge
    const statusMap = {
      pending: { label: 'รอรับ', class: 'status-pending' },
      accepted: { label: 'กำลังดำเนินการ', class: 'status-accepted' },
      resolved: { label: 'เสร็จสิ้น', class: 'status-resolved' }
    };
    const status = statusMap[post.status] || statusMap.pending;

    // Avatar (poster or requester depending on view)
    const initials = post.user_initials || (post.accepted_by_initials || '??');
    const avatarColor = post.user_avatar_color || (post.accepted_by_color || '#4e73df');
    const userName = post.user_name || '???';
    const userDept = post.user_dept || '';

    let actionsHTML = '';

    if (type === 'pending') {
      // IT staff can accept
      actionsHTML = `<button class="btn-accept-post" data-post-id="${post.id}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        รับงาน
      </button>`;
    } else if (type === 'my-job' && post.status === 'accepted') {
      actionsHTML = `<div class="card-actions-row">
        <button class="btn-chat-post" data-conv-id="${post.conversation_id}">💬 แชท</button>
        <button class="btn-resolve-post" data-post-id="${post.id}">✅ เสร็จสิ้น</button>
      </div>`;
    } else if (type === 'mine' && post.status === 'accepted' && post.conversation_id) {
      actionsHTML = `<div class="card-accepted-info">
        <div class="avatar-mini"><div class="avatar-circle-mini" style="background:${getAvatarBg(post.accepted_by_color || '#4e73df')}">${post.accepted_by_initials || '??'}</div></div>
        <span>${post.accepted_by_name || 'IT'} กำลังดูแล</span>
      </div>
      <button class="btn-chat-post" data-conv-id="${post.conversation_id}">💬 เปิดแชท</button>`;
    }

    card.innerHTML = `
      <div class="itboard-card-top">
        <div class="avatar-mini"><div class="avatar-circle-mini" style="background:${getAvatarBg(avatarColor)}">${initials}</div></div>
        <div class="itboard-card-meta">
          <span class="itboard-card-user">${userName}</span>
          <span class="itboard-card-dept">${userDept}</span>
        </div>
        <span class="itboard-status ${status.class}">${status.label}</span>
      </div>
      <div class="itboard-card-body">
        <h4>${escapeHtml(post.title)}</h4>
        ${post.description ? `<p>${escapeHtml(post.description)}</p>` : ''}
        ${post.media_path ? `<div class="itboard-card-media"><img src="${post.media_path}" alt="แนบรูป" /></div>` : ''}
      </div>
      <div class="itboard-card-footer">
        <span class="itboard-card-time">${timeStr}</span>
        ${actionsHTML}
      </div>
    `;

    // Attach event handlers
    const acceptBtn = card.querySelector('.btn-accept-post');
    if (acceptBtn) {
      acceptBtn.addEventListener('click', () => acceptPost(post.id));
    }

    const chatBtn = card.querySelector('.btn-chat-post');
    if (chatBtn) {
      chatBtn.addEventListener('click', () => {
        const convId = parseInt(chatBtn.dataset.convId);
        switchTab('chats');
        // Find conversation and select it
        loadConversations().then(() => {
          const conv = conversations.find(c => c.conversation_id === convId);
          if (conv) selectChat(conv);
        });
      });
    }

    const resolveBtn = card.querySelector('.btn-resolve-post');
    if (resolveBtn) {
      resolveBtn.addEventListener('click', () => resolvePost(post.id));
    }

    return card;
  }

  async function acceptPost(postId) {
    try {
      const res = await fetch(`/api/it-posts/${postId}/accept`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('✅ รับงานเรียบร้อย! เปิดแชทกับผู้แจ้งปัญหาแล้ว');
        await loadITBoard();
        await loadConversations();
        // Auto-switch to chat
        const conv = conversations.find(c => c.conversation_id === data.conversation_id);
        if (conv) {
          switchTab('chats');
          selectChat(conv);
        }
      } else {
        showToast(data.error || 'ไม่สามารถรับงานได้');
      }
    } catch (err) {
      showToast('เกิดข้อผิดพลาดในการรับงาน');
    }
  }

  async function resolvePost(postId) {
    try {
      const res = await fetch(`/api/it-posts/${postId}/resolve`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('✅ ปิดงานเรียบร้อย');
        loadITBoard();
      } else {
        showToast(data.error || 'ไม่สามารถปิดงานได้');
      }
    } catch (err) {
      showToast('เกิดข้อผิดพลาดในการปิดงาน');
    }
  }

  function updateITBadge() {
    if (currentUser.role === 'it' || currentUser.role === 'admin') {
      const pendingCount = itPosts.filter(p => p.status === 'pending').length;
      if (pendingCount > 0) {
        itboardBadge.textContent = pendingCount;
        itboardBadge.style.display = 'inline-flex';
      } else {
        itboardBadge.style.display = 'none';
      }
    }
  }

  // ============================================
  // RENDER CHAT LIST
  // ============================================

  function renderChatList(filter = '') {
    chatListEl.innerHTML = '';
    const lowerFilter = filter.toLowerCase();

    // 1. Matched current active conversations
    const matchedConversations = conversations.filter(c => {
      if (!filter) return true;
      return c.full_name.toLowerCase().includes(lowerFilter) ||
             c.department.toLowerCase().includes(lowerFilter);
    });

    // 2. Matched staff who are not in conversations
    let matchedStaff = [];
    const activeUserIds = new Set(conversations.map(c => c.other_user_id));
    if (filter) {
      matchedStaff = allStaff.filter(s => {
        if (activeUserIds.has(s.id)) return false;
        return s.full_name.toLowerCase().includes(lowerFilter) ||
               s.department.toLowerCase().includes(lowerFilter);
      });
    } else {
      matchedStaff = allStaff.filter(s => {
        if (activeUserIds.has(s.id)) return false;
        if (currentUser && currentUser.role === 'staff') {
          return true; // Show all IT staff
        } else {
          return s.is_online; // Show only online staff for IT/Admin to prevent clutter
        }
      });
    }

    if (matchedConversations.length === 0 && matchedStaff.length === 0) {
      chatListEl.innerHTML = '<div style="text-align:center;padding:40px 16px;color:#94a3b8;font-size:13px;">ไม่พบรายการแชทหรือบุคลากร</div>';
      return;
    }

    // Render current active conversations
    if (filter && matchedConversations.length > 0) {
      const secHeader = document.createElement('div');
      secHeader.className = 'chat-list-section-header';
      secHeader.textContent = 'แชทปัจจุบัน';
      chatListEl.appendChild(secHeader);
    }

    matchedConversations.forEach(conv => {
      const item = document.createElement('div');
      item.className = 'chat-item' + (conv.conversation_id === activeConvId ? ' active' : '');
      item.dataset.convId = conv.conversation_id;

      // Format last message preview
      let preview = conv.last_message_text || '';
      if (conv.last_media_type === 'image') preview = '📷 รูปภาพ';
      if (conv.last_media_type === 'video') preview = '🎬 วิดีโอ';
      if (conv.last_media_type === 'file') preview = '📄 ไฟล์แนบ';
      if (conv.last_media_type === 'audio') preview = '🎙️ ข้อความเสียง';

      const isSentByMe = conv.last_message_sender_id === currentUser.id;
      if (isSentByMe) {
        preview = 'คุณ: ' + preview;
      }

      if (preview.length > 40) preview = preview.substring(0, 40) + '...';

      // Format time
      const timeStr = formatTime(conv.last_message_at);

      item.innerHTML = `
        <div class="avatar">
          <div class="avatar-circle" style="background: ${getAvatarBg(conv.avatar_color)}">${conv.initials}</div>
          ${conv.is_online ? '<div class="online-dot"></div>' : ''}
        </div>
        <div class="chat-item-content">
          <div class="chat-item-top">
            <span class="chat-item-name">${conv.full_name} <span class="chat-item-dept">${conv.department}</span></span>
            <span class="chat-item-time">${timeStr}</span>
          </div>
          <div class="chat-item-preview">${preview}</div>
        </div>
        ${conv.unread_count > 0 ? `<div class="unread-badge">${conv.unread_count}</div>` : ''}
      `;

      item.addEventListener('click', () => selectChat(conv));
      chatListEl.appendChild(item);
    });

    // Render other staff members
    if (matchedStaff.length > 0) {
      const secHeader = document.createElement('div');
      secHeader.className = 'chat-list-section-header';
      secHeader.textContent = currentUser.role === 'staff' ? 'เจ้าหน้าที่ IT' : 'บุคลากรอื่นๆ';
      chatListEl.appendChild(secHeader);

      matchedStaff.forEach(staff => {
        const item = document.createElement('div');
        item.className = 'chat-item';

        let specsHtml = '';
        if ((staff.role === 'it' || staff.role === 'admin') && staff.specialties) {
          const specs = staff.specialties.split(',').filter(s => s.trim());
          if (specs.length > 0) {
            specsHtml = '<div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:4px;">' + 
              specs.map(s => `<span style="font-size:9.5px; background:var(--primary-100); color:var(--primary-700); padding:2px 4px; border-radius:4px; line-height:1;">${escapeHtml(s.trim())}</span>`).join('') +
              '</div>';
          }
        }

        item.innerHTML = `
          <div class="avatar">
            <div class="avatar-circle" style="background: ${getAvatarBg(staff.avatar_color || 'avatar-blue')}">${staff.initials || '??'}</div>
            ${staff.is_online ? '<div class="online-dot"></div>' : ''}
          </div>
          <div class="chat-item-content">
            <div class="chat-item-top" style="margin-bottom:0;">
              <span class="chat-item-name">${staff.full_name} <span class="chat-item-dept">${staff.department}</span></span>
            </div>
            ${specsHtml}
            <div class="chat-item-preview" style="color:var(--primary-500); font-weight:500; font-size:11.5px; margin-top:2px;">คลิกเพื่อเริ่มแชท 1:1</div>
          </div>
        `;

        item.addEventListener('click', () => startNewChat(staff.id));
        chatListEl.appendChild(item);
      });
    }
  }

  async function startNewChat(otherUserId) {
    try {
      const res = await fetch('/api/conversations/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otherUserId })
      });
      const data = await res.json();
      if (data.conversation_id) {
        // Clear search input
        searchInput.value = '';
        // Reload conversations to update state
        await loadConversations();
        // Find the conversation we just started and select it
        const conv = conversations.find(c => c.conversation_id === data.conversation_id);
        if (conv) {
          selectChat(conv);
        }
      } else {
        showToast(data.error || 'ไม่สามารถสร้างแชทได้');
      }
    } catch (err) {
      showToast('เกิดข้อผิดพลาดในการเริ่มต้นแชท');
    }
  }

  // ============================================
  // SELECT CHAT
  // ============================================

  function selectChat(conv) {
    activeConvId = conv.conversation_id;
    activeOtherUser = {
      id: conv.other_user_id,
      full_name: conv.full_name,
      department: conv.department,
      initials: conv.initials,
      avatar_color: conv.avatar_color,
      is_online: conv.is_online
    };

    // Hide typing indicator from previous chat
    hideTyping();

    // Show chat view
    emptyState.style.display = 'none';
    chatView.style.display = 'flex';

    // Show Quick Templates if user is IT/Admin
    if (currentUser && (currentUser.role === 'it' || currentUser.role === 'admin')) {
      quickTemplates.style.display = 'flex';
    } else {
      quickTemplates.style.display = 'none';
    }

    // Update header
    setElementAvatar(headerAvatar, conv.initials, conv.avatar_color);
    headerNameText.textContent = conv.full_name;
    headerDept.textContent = conv.department;

    if (conv.is_online) {
      headerOnlineDot.style.display = 'block';
      headerStatus.textContent = 'ออนไลน์';
      headerStatus.className = 'status-text online';
    } else {
      headerOnlineDot.style.display = 'none';
      headerStatus.textContent = 'ออฟไลน์';
      headerStatus.className = 'status-text offline';
    }

    // Clear pending file
    clearFilePreview();

    // Update active state in list
    renderChatList(searchInput.value);

    // Clear gallery panels if open to prevent showing previous conversation's media
    if (typeof isGalleryOpen !== 'undefined' && isGalleryOpen) {
      galleryGridMedia.innerHTML = '';
      galleryListDocs.innerHTML = '';
    }

    // Load messages
    loadMessages(activeConvId);

    // Focus input
    messageInput.focus();
  }

  // ============================================
  // RENDER MESSAGES
  // ============================================

  function renderMessages(messages) {
    messagesAreaEl.innerHTML = '';
    let lastDate = '';

    messages.forEach((msg, idx) => {
      // Date divider
      const msgDate = new Date(msg.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
      if (msgDate !== lastDate) {
        lastDate = msgDate;
        const today = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
        const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
        let label = msgDate;
        if (msgDate === today) label = 'วันนี้';
        else if (msgDate === yesterday) label = 'เมื่อวาน';

        const divider = document.createElement('div');
        divider.className = 'date-divider';
        divider.innerHTML = `<span>${label}</span>`;
        messagesAreaEl.appendChild(divider);
      }

      // Message row
      const isMine = msg.sender_id === currentUser.id;
      const row = document.createElement('div');
      row.className = 'message-row ' + (isMine ? 'sent' : 'received');
      row.style.animationDelay = `${Math.min(idx * 0.03, 0.5)}s`;

      let avatarHTML = '';
      if (!isMine) {
        avatarHTML = `
          <div class="msg-avatar">
            <div class="avatar-circle" style="background: ${getAvatarBg(msg.sender_color)}">${msg.sender_initials}</div>
          </div>`;
      }

      const timeStr = new Date(msg.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
      const readCheck = isMine ? `<span class="msg-read-check ${msg.is_read ? '' : 'unread'}">${msg.is_read ? '\u2713\u2713' : '\u2713'}</span>` : '';
      let bubbleContent = '';

      if (msg.media_type === 'image') {
        bubbleContent = `
          <div class="msg-media clickable-image" data-src="${msg.media_path}">
            <img src="${msg.media_path}" alt="${msg.media_caption || 'Attached image'}" loading="lazy" />
          </div>
          ${msg.media_caption ? `<div class="msg-media-caption">${msg.media_caption}</div>` : ''}
          <div class="msg-time">${timeStr} ${readCheck}</div>`;
      } else if (msg.media_type === 'video') {
        const isImagePath = msg.media_path.match(/\.(png|jpg|jpeg|webp|gif)$/i);
        if (isImagePath) {
          bubbleContent = `
            <div class="msg-media video-thumb">
              <img src="${msg.media_path}" alt="${msg.media_caption || 'Video'}" loading="lazy" />
              <div class="play-overlay"></div>
            </div>
            ${msg.media_caption ? `<div class="msg-media-caption">${msg.media_caption}</div>` : ''}
            <div class="msg-time">${timeStr} ${readCheck}</div>`;
        } else {
          bubbleContent = `
            <div class="msg-media">
              <video src="${msg.media_path}" controls preload="metadata" style="width:100%; max-height:240px; display:block; border-radius:8px;"></video>
            </div>
            ${msg.media_caption ? `<div class="msg-media-caption">${msg.media_caption}</div>` : ''}
            <div class="msg-time">${timeStr} ${readCheck}</div>`;
        }
      } else if (msg.media_type === 'audio') {
        bubbleContent = `
          <div class="msg-media">
            <audio src="${msg.media_path}" controls style="width: 250px; display:block; border-radius:8px;"></audio>
          </div>
          ${msg.media_caption ? `<div class="msg-media-caption">${msg.media_caption}</div>` : ''}
          <div class="msg-time">${timeStr} ${readCheck}</div>`;
      } else if (msg.media_type === 'file') {
        bubbleContent = `
          <a href="${msg.media_path}" download target="_blank" class="msg-media-file" style="display:flex;align-items:center;gap:10px;padding:12px;background:rgba(0,0,0,0.05);border-radius:8px;text-decoration:none;color:inherit;margin-bottom:4px;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--primary-500);">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <div class="file-info" style="font-size:13px;font-weight:500;">
              <span class="file-name">${escapeHtml(msg.media_caption || 'ไฟล์แนบ')}</span>
            </div>
          </a>
          <div class="msg-time">${timeStr} ${readCheck}</div>`;
      } else {
        bubbleContent = `
          <div class="msg-bubble">${escapeHtml(msg.message_text || '')}</div>
          <div class="msg-time">${timeStr} ${readCheck}</div>`;
      }

      row.innerHTML = avatarHTML + `<div class="msg-content-wrap">${bubbleContent}</div>`;
      messagesAreaEl.appendChild(row);
    });

    // Scroll to bottom
    requestAnimationFrame(() => {
      messagesAreaEl.scrollTop = messagesAreaEl.scrollHeight;
    });

    // Attach click handlers for images
    messagesAreaEl.querySelectorAll('.clickable-image').forEach(el => {
      el.addEventListener('click', () => {
        lightboxImg.src = el.dataset.src;
        lightbox.style.display = 'flex';
      });
    });

    // Update gallery if open
    if (typeof isGalleryOpen !== 'undefined' && isGalleryOpen) {
      renderGallery();
    }
  }

  // Append a single message without re-rendering everything
  function appendMessage(msg) {
    const isMine = msg.sender_id === currentUser.id;
    const row = document.createElement('div');
    row.className = 'message-row ' + (isMine ? 'sent' : 'received');

    let avatarHTML = '';
    if (!isMine) {
      avatarHTML = `
        <div class="msg-avatar">
          <div class="avatar-circle" style="background: ${getAvatarBg(msg.sender_color)}">${msg.sender_initials}</div>
        </div>`;
    }

    const timeStr = new Date(msg.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    const readCheck = isMine ? `<span class="msg-read-check ${msg.is_read ? '' : 'unread'}">${msg.is_read ? '\u2713\u2713' : '\u2713'}</span>` : '';
    let bubbleContent = '';

    if (msg.media_type === 'image') {
      bubbleContent = `
        <div class="msg-media clickable-image" data-src="${msg.media_path}">
          <img src="${msg.media_path}" alt="Attached image" loading="lazy" />
        </div>
        ${msg.media_caption ? `<div class="msg-media-caption">${msg.media_caption}</div>` : ''}
        <div class="msg-time">${timeStr} ${readCheck}</div>`;
    } else if (msg.media_type === 'video') {
      const isImagePath = msg.media_path.match(/\.(png|jpg|jpeg|webp|gif)$/i);
      if (isImagePath) {
        bubbleContent = `
          <div class="msg-media video-thumb">
            <img src="${msg.media_path}" alt="Video" loading="lazy" />
            <div class="play-overlay"></div>
          </div>
          ${msg.media_caption ? `<div class="msg-media-caption">${msg.media_caption}</div>` : ''}
          <div class="msg-time">${timeStr} ${readCheck}</div>`;
      } else {
        bubbleContent = `
          <div class="msg-media">
            <video src="${msg.media_path}" controls preload="metadata" style="width:100%; max-height:240px; display:block; border-radius:8px;"></video>
          </div>
          ${msg.media_caption ? `<div class="msg-media-caption">${msg.media_caption}</div>` : ''}
          <div class="msg-time">${timeStr} ${readCheck}</div>`;
      }
    } else if (msg.media_type === 'audio') {
      bubbleContent = `
        <div class="msg-media">
          <audio src="${msg.media_path}" controls style="width: 250px; display:block; border-radius:8px;"></audio>
        </div>
        ${msg.media_caption ? `<div class="msg-media-caption">${msg.media_caption}</div>` : ''}
        <div class="msg-time">${timeStr} ${readCheck}</div>`;
    } else if (msg.media_type === 'file') {
      bubbleContent = `
        <a href="${msg.media_path}" download target="_blank" class="msg-media-file" style="display:flex;align-items:center;gap:10px;padding:12px;background:rgba(0,0,0,0.05);border-radius:8px;text-decoration:none;color:inherit;margin-bottom:4px;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--primary-500);">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          <div class="file-info" style="font-size:13px;font-weight:500;">
            <span class="file-name">${escapeHtml(msg.media_caption || 'ไฟล์แนบ')}</span>
          </div>
        </a>
        <div class="msg-time">${timeStr} ${readCheck}</div>`;
    } else {
      bubbleContent = `
        <div class="msg-bubble">${escapeHtml(msg.message_text || '')}</div>
        <div class="msg-time">${timeStr} ${readCheck}</div>`;
    }

    row.innerHTML = avatarHTML + `<div class="msg-content-wrap">${bubbleContent}</div>`;
    messagesAreaEl.appendChild(row);

    // Click handler for image
    const imgEl = row.querySelector('.clickable-image');
    if (imgEl) {
      imgEl.addEventListener('click', () => {
        lightboxImg.src = imgEl.dataset.src;
        lightbox.style.display = 'flex';
      });
    }

    // Scroll to bottom
    requestAnimationFrame(() => {
      messagesAreaEl.scrollTop = messagesAreaEl.scrollHeight;
    });

    // Update gallery if open
    if (typeof isGalleryOpen !== 'undefined' && isGalleryOpen) {
      renderGallery();
    }
  }

  // ============================================
  // HANDLE INCOMING / OWN MESSAGES
  // ============================================

  function handleIncomingMessage(msg) {
    updateConversationPreview(msg);
    if (msg.conversation_id === activeConvId) {
      appendMessage(msg);
      hideTyping();
      if (document.hidden) playNotificationSound();
      socket.emit('mark_read', { conversation_id: activeConvId });
    } else {
      playNotificationSound();
    }
  }

  function playNotificationSound() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch(e) {
      // Ignore audio errors (e.g. user hasn't interacted yet)
    }
  }

  function handleOwnMessage(msg) {
    updateConversationPreview(msg);
    if (msg.conversation_id === activeConvId) {
      appendMessage(msg);
    }
  }

  function updateConversationPreview(msg) {
    const conv = conversations.find(c => c.conversation_id === msg.conversation_id);
    if (conv) {
      conv.last_message_text = msg.message_text;
      conv.last_media_type = msg.media_type;
      conv.last_message_at = msg.created_at;
      conv.last_message_sender_id = msg.sender_id;

      if (msg.sender_id !== currentUser.id && msg.conversation_id !== activeConvId) {
        conv.unread_count = (conv.unread_count || 0) + 1;
      }

      const idx = conversations.indexOf(conv);
      if (idx > 0) {
        conversations.splice(idx, 1);
        conversations.unshift(conv);
      }

      renderChatList(searchInput.value);
    } else {
      loadConversations();
    }
  }

  // ============================================
  // SEND MESSAGE
  // ============================================

  async function sendMessage() {
    const text = messageInput.value.trim();

    if (pendingFile) {
      await uploadAndSendFile(text);
      return;
    }

    if (!text || !activeConvId) return;

    socket.emit('send_message', {
      conversation_id: activeConvId,
      text: text,
      media_type: 'none'
    });

    messageInput.value = '';
    emitTypingStop();
  }

  async function uploadAndSendFile(caption) {
    if (!pendingFile || !activeConvId) return;

    const formData = new FormData();
    formData.append('file', pendingFile);

    uploadProgress.style.display = 'block';
    uploadProgressBar.style.width = '0%';

    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload', true);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          uploadProgressBar.style.width = pct + '%';
        }
      };

      const response = await new Promise((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status === 200) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.error || 'Upload failed'));
          }
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(formData);
      });

      socket.emit('send_message', {
        conversation_id: activeConvId,
        text: caption || null,
        media_type: response.type,
        media_path: response.path,
        media_caption: caption || response.originalName
      });

      messageInput.value = '';
      clearFilePreview();

    } catch (err) {
      showToast(err.message || 'อัพโหลดไฟล์ไม่สำเร็จ');
      uploadProgress.style.display = 'none';
    }
  }

  // ============================================
  // FILE HANDLING
  // ============================================

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    const maxMB = 25;
    if (file.size > maxMB * 1024 * 1024) {
      showToast(`ไฟล์มีขนาดเกิน ${maxMB} MB`);
      fileInput.value = '';
      return;
    }

    pendingFile = file;
    showFilePreview(file);
  }

  function showFilePreview(file) {
    filePreviewName.textContent = file.name;
    filePreviewSize.textContent = formatFileSize(file.size);
    filePreview.style.display = 'block';
    uploadProgress.style.display = 'none';

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        filePreviewImg.src = e.target.result;
        filePreviewImg.style.display = 'block';
        filePreviewVideo.style.display = 'none';
      };
      reader.readAsDataURL(file);
    } else {
      filePreviewImg.style.display = 'none';
      filePreviewVideo.style.display = 'flex';
      filePreviewVideoName.textContent = ''; // Fixed: don't show filename inside the small icon
      
      const svg = filePreviewVideo.querySelector('svg');
      if (svg) {
        if (file.type.startsWith('video/')) {
          svg.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
        } else {
          // Document / Excel icon
          svg.innerHTML = '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>';
        }
      }
    }
  }

  function clearFilePreview() {
    pendingFile = null;
    fileInput.value = '';
    filePreview.style.display = 'none';
    filePreviewImg.style.display = 'none';
    filePreviewVideo.style.display = 'none';
    uploadProgress.style.display = 'none';
  }

  // ============================================
  // TYPING INDICATOR
  // ============================================

  function emitTypingStart() {
    if (!activeConvId || !activeOtherUser) return;
    socket.emit('typing_start', {
      conversation_id: activeConvId,
      to_user_id: activeOtherUser.id
    });
  }

  function emitTypingStop() {
    if (!activeConvId || !activeOtherUser) return;
    socket.emit('typing_stop', {
      conversation_id: activeConvId,
      to_user_id: activeOtherUser.id
    });
  }

  function showTyping(name) {
    typingNameEl.textContent = `${name} กำลังพิมพ์...`;
    typingIndicator.style.display = 'flex';
  }

  function hideTyping() {
    typingIndicator.style.display = 'none';
  }

  // ============================================
  // ONLINE STATUS
  // ============================================

  function updateOnlineStatus(userId, isOnline) {
    conversations.forEach(conv => {
      if (conv.other_user_id === userId) {
        conv.is_online = isOnline ? 1 : 0;
      }
    });
    renderChatList(searchInput.value);

    if (activeOtherUser && activeOtherUser.id === userId) {
      activeOtherUser.is_online = isOnline;
      if (isOnline) {
        headerOnlineDot.style.display = 'block';
        headerStatus.textContent = 'ออนไลน์';
        headerStatus.className = 'status-text online';
      } else {
        headerOnlineDot.style.display = 'none';
        headerStatus.textContent = 'ออฟไลน์';
        headerStatus.className = 'status-text offline';
      }
    }
  }

  // ============================================
  // CREATE IT POST MODAL
  // ============================================

  function openCreatePostModal() {
    postTitle.value = '';
    postDescription.value = '';
    modalCreatePost.style.display = 'flex';
    postTitle.focus();
  }

  function closeCreatePostModal() {
    modalCreatePost.style.display = 'none';
  }

  async function submitPost() {
    const title = postTitle.value.trim();
    const description = postDescription.value.trim();

    if (!title) {
      showToast('กรุณาระบุหัวข้อปัญหา');
      postTitle.focus();
      return;
    }

    btnSubmitPost.disabled = true;
    btnSubmitPost.textContent = 'กำลังส่ง...';

    try {
      const res = await fetch('/api/it-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description })
      });
      const data = await res.json();

      if (data.success) {
        showToast('✅ ส่งแจ้งปัญหาเรียบร้อยแล้ว รอเจ้าหน้าที่ IT รับเรื่อง');
        closeCreatePostModal();
        loadITBoard();
      } else {
        showToast(data.error || 'ไม่สามารถส่งแจ้งปัญหาได้');
      }
    } catch (err) {
      showToast('เกิดข้อผิดพลาด');
    } finally {
      btnSubmitPost.disabled = false;
      btnSubmitPost.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
        ส่งแจ้งปัญหา`;
    }
  }

  // ============================================
  // EVENT LISTENERS
  // ============================================

  function setupListeners() {
    setupAudioRecordingListeners();
    setupMessageSearchListeners();

    // Quick templates click
    quickTemplates.addEventListener('click', (e) => {
      if (e.target.classList.contains('template-chip')) {
        messageInput.value = e.target.textContent;
        messageInput.focus();
      }
    });

    // Send button
    sendBtn.addEventListener('click', sendMessage);

    // Enter key
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Typing detection
    messageInput.addEventListener('input', () => {
      emitTypingStart();
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(emitTypingStop, 2000);
    });

    // Search
    searchInput.addEventListener('input', (e) => {
      renderChatList(e.target.value);
    });

    // Paperclip
    attachBtn.addEventListener('click', () => {
      if (!activeConvId) {
        showToast('กรุณาเลือกแชทก่อน');
        return;
      }
      fileInput.click();
    });

    fileInput.addEventListener('change', handleFileSelect);
    filePreviewRemove.addEventListener('click', clearFilePreview);

    // Logout
    logoutBtn.addEventListener('click', async () => {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch {}
      window.location.href = '/login.html';
    });

    // Lightbox
    lightboxClose.addEventListener('click', () => {
      lightbox.style.display = 'none';
    });
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) lightbox.style.display = 'none';
    });

    // Sidebar Tabs
    tabChats.addEventListener('click', () => switchTab('chats'));
    tabItboard.addEventListener('click', () => switchTab('itboard'));

    // IT Board: Create Post
    btnCreatePost.addEventListener('click', openCreatePostModal);

    // Modal
    modalClosePost.addEventListener('click', closeCreatePostModal);
    btnCancelPost.addEventListener('click', closeCreatePostModal);
    btnSubmitPost.addEventListener('click', submitPost);

    // Close modal on overlay click
    modalCreatePost.addEventListener('click', (e) => {
      if (e.target === modalCreatePost) closeCreatePostModal();
    });

    // Submit post with Enter in title
    postTitle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitPost();
      }
    });

    // Gallery toggle
    btnGallery.addEventListener('click', toggleGallery);
    btnCloseGallery.addEventListener('click', closeGallery);
    setupGalleryTabListeners();

    // Custom templates modal toggle
    btnTemplateSettings.addEventListener('click', () => {
      modalTemplates.style.display = 'flex';
      renderTemplates();
    });

    modalCloseTemplates.addEventListener('click', () => {
      modalTemplates.style.display = 'none';
    });

    btnCloseTemplatesModal.addEventListener('click', () => {
      modalTemplates.style.display = 'none';
    });

    modalTemplates.addEventListener('click', (e) => {
      if (e.target === modalTemplates) modalTemplates.style.display = 'none';
    });

    // Add new custom template
    btnAddTemplate.addEventListener('click', () => {
      const text = newTemplateInput.value.trim();
      if (!text) return;
      
      const templates = getTemplates();
      if (templates.includes(text)) {
        showToast('มีข้อความนี้อยู่แล้ว');
        return;
      }
      templates.push(text);
      saveTemplates(templates);
      newTemplateInput.value = '';
    });

    newTemplateInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        btnAddTemplate.click();
      }
    });

    // Delete custom template (event delegation)
    templateListManage.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-delete-template')) {
        const idx = parseInt(e.target.dataset.index);
        const templates = getTemplates();
        templates.splice(idx, 1);
        saveTemplates(templates);
      }
    });

    // Profile Settings listeners
    if (btnProfileSettings) {
      btnProfileSettings.addEventListener('click', openProfileSettingsModal);
    }
    if (modalCloseProfileSettings) {
      modalCloseProfileSettings.addEventListener('click', closeProfileSettingsModal);
    }
    if (btnCancelProfileSettings) {
      btnCancelProfileSettings.addEventListener('click', closeProfileSettingsModal);
    }
    if (btnSaveProfileSettings) {
      btnSaveProfileSettings.addEventListener('click', saveProfileSettings);
    }
    modalProfileSettings.addEventListener('click', (e) => {
      if (e.target === modalProfileSettings) closeProfileSettingsModal();
    });

    // Real-time IT recommendations based on post content keywords
    if (postTitle && postDescription) {
      postTitle.addEventListener('input', updateRecommendations);
      postDescription.addEventListener('input', updateRecommendations);
    }
  }

  function setupMessageSearchListeners() {
    let searchHighlightIndex = 0;
    let searchMatches = [];

    btnSearchMsg.addEventListener('click', () => {
      if (msgSearchBar.style.display === 'none') {
        msgSearchBar.style.display = 'flex';
        msgSearchInput.focus();
      } else {
        closeSearch();
      }
    });

    btnCloseMsgSearch.addEventListener('click', closeSearch);

    msgSearchInput.addEventListener('input', (e) => {
      const keyword = e.target.value.trim().toLowerCase();
      clearHighlights();
      
      if (!keyword) return;

      const messages = messagesAreaEl.querySelectorAll('.message-row');
      searchMatches = [];

      messages.forEach(msg => {
        const bubbleEl = msg.querySelector('.msg-bubble');
        const mediaEl = msg.querySelector('.msg-media');
        const fileEl = msg.querySelector('.msg-media-file');
        const captionEl = msg.querySelector('.msg-media-caption');
        
        let matched = false;
        let targetEl = null;

        if (bubbleEl && bubbleEl.textContent.toLowerCase().includes(keyword)) {
          matched = true;
          targetEl = bubbleEl;
        } else if (captionEl && captionEl.textContent.toLowerCase().includes(keyword)) {
          matched = true;
          targetEl = captionEl;
        } else if (fileEl && fileEl.textContent.toLowerCase().includes(keyword)) {
          matched = true;
          targetEl = fileEl;
        } else if (mediaEl && mediaEl.textContent.toLowerCase().includes(keyword)) {
          matched = true;
          targetEl = mediaEl;
        }

        if (matched && targetEl) {
          targetEl.classList.add('highlighted-msg');
          searchMatches.push(msg); // Store the row element for scrolling
        }
      });

      if (searchMatches.length > 0) {
        searchHighlightIndex = searchMatches.length - 1;
        // Scroll to newest match (which is at the bottom)
        searchMatches[searchHighlightIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    msgSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && searchMatches.length > 0) {
        searchHighlightIndex--;
        if (searchHighlightIndex < 0) searchHighlightIndex = searchMatches.length - 1;
        searchMatches[searchHighlightIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (e.key === 'Escape') {
        closeSearch();
      }
    });

    function closeSearch() {
      msgSearchBar.style.display = 'none';
      msgSearchInput.value = '';
      clearHighlights();
    }

    function clearHighlights() {
      const highlighted = messagesAreaEl.querySelectorAll('.highlighted-msg');
      highlighted.forEach(el => el.classList.remove('highlighted-msg'));
      searchMatches = [];
      searchHighlightIndex = 0;
    }
  }

  // ============================================
  // UTILITIES
  // ============================================

  function formatTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;

    if (diff < 86400000 && d.getDate() === now.getDate()) {
      return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    } else if (diff < 172800000) {
      return 'เมื่อวาน';
    } else {
      return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
    }
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function showToast(message) {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
      <span>${message}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 4000);
  }

  // ============================================
  // CUSTOM QUICK TEMPLATES LOGIC
  // ============================================

  const DEFAULT_TEMPLATES = [
    'รับเรื่องเรียบร้อย กำลังไปดูให้ครับ',
    'ช่วยรีสตาร์ทเครื่องคอมพิวเตอร์ 1 รอบครับ',
    'กำลังรีโมทเข้าไปตรวจสอบครับ',
    'ดำเนินการแก้ไขเรียบร้อยแล้วครับ'
  ];

  function initQuickTemplates() {
    const storageKey = `quick_templates_${currentUser.username}`;
    let templates = localStorage.getItem(storageKey);
    if (!templates) {
      localStorage.setItem(storageKey, JSON.stringify(DEFAULT_TEMPLATES));
    }
    renderTemplates();
  }

  function getTemplates() {
    const storageKey = `quick_templates_${currentUser.username}`;
    return JSON.parse(localStorage.getItem(storageKey)) || DEFAULT_TEMPLATES;
  }

  function saveTemplates(templates) {
    const storageKey = `quick_templates_${currentUser.username}`;
    localStorage.setItem(storageKey, JSON.stringify(templates));
    renderTemplates();
  }

  function renderTemplates() {
    const templates = getTemplates();
    
    // Render chips in input bar
    quickTemplatesChips.innerHTML = '';
    templates.forEach(tpl => {
      const btn = document.createElement('button');
      btn.className = 'template-chip';
      btn.textContent = tpl;
      quickTemplatesChips.appendChild(btn);
    });

    // Render list in settings modal
    templateListManage.innerHTML = '';
    if (templates.length === 0) {
      templateListManage.innerHTML = '<div style="text-align:center; color:var(--gray-400); font-size:12.5px; padding:15px 0;">ไม่มีข้อความตอบด่วนที่กำหนดเอง</div>';
      return;
    }

    templates.forEach((tpl, idx) => {
      const item = document.createElement('div');
      item.className = 'template-manage-item';
      item.innerHTML = `
        <span class="template-manage-text" title="${escapeHtml(tpl)}">${escapeHtml(tpl)}</span>
        <button class="btn-delete-template" data-index="${idx}">ลบ</button>
      `;
      templateListManage.appendChild(item);
    });
  }

  // ============================================
  // MEDIA & FILES GALLERY LOGIC
  // ============================================

  let isGalleryOpen = false;

  function toggleGallery() {
    if (chatGallerySidebar.style.display === 'none') {
      chatGallerySidebar.style.display = 'flex';
      btnGallery.classList.add('active');
      isGalleryOpen = true;
      renderGallery();
    } else {
      closeGallery();
    }
  }

  function closeGallery() {
    chatGallerySidebar.style.display = 'none';
    btnGallery.classList.remove('active');
    isGalleryOpen = false;
  }

  function setupGalleryTabListeners() {
    const tabs = chatGallerySidebar.querySelectorAll('.gallery-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const targetTab = tab.dataset.tab;
        const panels = chatGallerySidebar.querySelectorAll('.gallery-panel');
        panels.forEach(panel => {
          panel.classList.remove('active');
          if (panel.id === `gallery-panel-${targetTab}`) {
            panel.classList.add('active');
          }
        });
      });
    });
  }

  function renderGallery() {
    if (!activeConvId || !isGalleryOpen) return;

    const mediaList = [];
    const docList = [];

    // Query images and videos from DOM
    const mediaEls = messagesAreaEl.querySelectorAll('.msg-media img, .msg-media video');
    mediaEls.forEach(el => {
      const src = el.getAttribute('src');
      if (!src) return;

      const isVideo = el.tagName.toLowerCase() === 'video';
      const caption = el.getAttribute('alt') || (isVideo ? 'วิดีโอ' : 'รูปภาพ');
      
      if (!mediaList.some(item => item.path === src)) {
        mediaList.push({
          path: src,
          isVideo: isVideo,
          caption: caption
        });
      }
    });

    // Check clickable-image elements
    const imgEls = messagesAreaEl.querySelectorAll('.clickable-image');
    imgEls.forEach(el => {
      const src = el.dataset.src;
      if (!src) return;
      if (!mediaList.some(item => item.path === src)) {
        const img = el.querySelector('img');
        const caption = img ? img.getAttribute('alt') : 'รูปภาพ';
        mediaList.push({
          path: src,
          isVideo: false,
          caption: caption
        });
      }
    });

    // Query files (documents)
    const fileEls = messagesAreaEl.querySelectorAll('.msg-media-file');
    fileEls.forEach(el => {
      const path = el.getAttribute('href');
      if (!path) return;

      const nameEl = el.querySelector('.file-name');
      const name = nameEl ? nameEl.textContent : 'ไฟล์แนบ';
      
      if (!docList.some(item => item.path === path)) {
        docList.push({
          path: path,
          name: name
        });
      }
    });

    // Render Media Grid (Images / Videos)
    galleryGridMedia.innerHTML = '';
    if (mediaList.length === 0) {
      galleryEmptyMedia.style.display = 'block';
      galleryGridMedia.style.display = 'none';
    } else {
      galleryEmptyMedia.style.display = 'none';
      galleryGridMedia.style.display = 'grid';

      mediaList.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'gallery-item' + (item.isVideo ? ' video-type' : '');
        itemEl.title = item.caption;
        
        if (item.isVideo) {
          itemEl.innerHTML = `
            <video src="${item.path}" style="width:100%; height:100%; object-fit:cover;" muted preload="metadata"></video>
          `;
          itemEl.addEventListener('click', () => {
            const tempVid = document.createElement('video');
            tempVid.src = item.path;
            tempVid.controls = true;
            if (tempVid.requestFullscreen) {
              tempVid.requestFullscreen();
              tempVid.play();
            }
          });
        } else {
          itemEl.innerHTML = `<img src="${item.path}" alt="${escapeHtml(item.caption)}" loading="lazy" />`;
          itemEl.addEventListener('click', () => {
            lightboxImg.src = item.path;
            lightbox.style.display = 'flex';
          });
        }
        galleryGridMedia.appendChild(itemEl);
      });
    }

    // Render Documents List
    galleryListDocs.innerHTML = '';
    if (docList.length === 0) {
      galleryEmptyDocs.style.display = 'block';
      galleryListDocs.style.display = 'none';
    } else {
      galleryEmptyDocs.style.display = 'none';
      galleryListDocs.style.display = 'flex';

      docList.forEach(item => {
        const itemEl = document.createElement('a');
        itemEl.className = 'gallery-doc-item';
        itemEl.href = item.path;
        itemEl.download = '';
        itemEl.target = '_blank';
        itemEl.innerHTML = `
          <div class="gallery-doc-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </div>
          <div class="gallery-doc-info">
            <span class="gallery-doc-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
            <span class="gallery-doc-size">กดเพื่อดาวน์โหลด</span>
          </div>
        `;
        galleryListDocs.appendChild(itemEl);
      });
    }
  }

  // ============================================
  // IT SPECIALIST RECOMMENDATIONS & PROFILE SETTINGS
  // ============================================

  let currentSpecialtiesTags = [];

  function updateRecommendations() {
    const titleVal = postTitle.value.toLowerCase();
    const descVal = postDescription.value.toLowerCase();
    const combinedText = titleVal + " " + descVal;

    if (!combinedText.trim()) {
      recommendationArea.style.display = 'none';
      return;
    }

    // Extract all unique specialties tags from all IT/Admin staff
    const allUniqueTags = new Set();
    allStaff.forEach(staff => {
      if ((staff.role === 'it' || staff.role === 'admin') && staff.specialties) {
        staff.specialties.split(',').forEach(tag => allUniqueTags.add(tag.trim().toLowerCase()));
      }
    });

    // Find tags that are mentioned in the problem description
    const matchedTags = Array.from(allUniqueTags).filter(tag => combinedText.includes(tag) && tag.length > 0);

    if (matchedTags.length === 0) {
      recommendationArea.style.display = 'none';
      return;
    }

    // Filter staff who are IT and have at least one matched tag
    const recommendedStaff = allStaff.filter(staff => {
      if (staff.role !== 'it' && staff.role !== 'admin') return false;
      if (!staff.specialties) return false;
      const specs = staff.specialties.split(',').map(s => s.trim().toLowerCase());
      return matchedTags.some(tag => specs.includes(tag));
    });

    if (recommendedStaff.length === 0) {
      recommendationArea.style.display = 'none';
      return;
    }

    // Sort by online status first (1 = online, 0 = offline)
    recommendedStaff.sort((a, b) => b.is_online - a.is_online);

    // Render cards
    recommendedStaffList.innerHTML = '';
    recommendedStaff.forEach(staff => {
      const card = document.createElement('div');
      card.className = 'recommended-staff-card';
      
      const avatarHTML = `<div class="avatar" style="position:relative;">
        <div class="avatar-circle avatar-blue" style="width:36px; height:36px; font-size:12px; background:${getAvatarBg(staff.avatar_color)}">${staff.initials}</div>
        ${staff.is_online ? '<div class="online-dot" style="position:absolute; bottom:0; right:0; width:10px; height:10px; border:2px solid #fff; background:#10b981; border-radius:50%;"></div>' : ''}
      </div>`;

      // Render tags for matched specialties (only highlight the matched ones)
      const staffSpecs = staff.specialties.split(',').map(s => s.trim()).filter(s => s);
      const tagsHTML = staffSpecs.map(s => {
        const isMatched = matchedTags.includes(s.toLowerCase());
        const bgColor = isMatched ? 'var(--emerald-100)' : 'var(--gray-100)';
        const textColor = isMatched ? 'var(--emerald-800)' : 'var(--gray-700)';
        return `<span class="specialty-tag" style="background:${bgColor}; color:${textColor};">${escapeHtml(s)}</span>`;
      }).join('');

      card.innerHTML = `
        ${avatarHTML}
        <div class="recommended-staff-details">
          <div class="recommended-staff-name">
            ${staff.full_name}
            ${staff.is_online ? '<span style="color:#10b981; font-size:11px; font-weight:normal;">(ออนไลน์)</span>' : '<span style="color:#9ca3af; font-size:11px; font-weight:normal;">(ออฟไลน์)</span>'}
          </div>
          <div class="recommended-staff-role">${staff.department || 'ฝ่าย IT'}</div>
          <div class="recommended-staff-specialties">${tagsHTML}</div>
        </div>
        <button class="btn-recommended-chat" data-user-id="${staff.id}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          ทักแชทด่วน
        </button>
      `;

      // Chat button handler
      const chatBtn = card.querySelector('.btn-recommended-chat');
      chatBtn.addEventListener('click', async () => {
        closeCreatePostModal();
        try {
          const res = await fetch('/api/conversations/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ otherUserId: staff.id })
          });
          const data = await res.json();
          if (data.conversation_id) {
            switchTab('chats');
            await loadConversations();
            const conv = conversations.find(c => c.conversation_id === data.conversation_id);
            if (conv) {
              selectChat(conv);
            } else {
              selectChat({
                conversation_id: data.conversation_id,
                other_user_id: staff.id,
                full_name: staff.full_name,
                department: staff.department,
                initials: staff.initials,
                avatar_color: staff.avatar_color,
                is_online: staff.is_online
              });
            }
          }
        } catch (err) {
          showToast('ไม่สามารถเปิดห้องแชทได้');
        }
      });

      recommendedStaffList.appendChild(card);
    });

    recommendationArea.style.display = 'block';
  }

  // Tags UI Logic
  const specialtyTagInput = document.getElementById('specialty-tag-input');
  const specialtyTagsList = document.getElementById('specialty-tags-list');
  const suggestedTagsBtns = document.querySelectorAll('.suggested-tag-btn');

  function renderSpecialtyTags() {
    specialtyTagsList.innerHTML = '';
    currentSpecialtiesTags.forEach((tag, idx) => {
      const item = document.createElement('div');
      item.className = 'spec-tag-item';
      item.innerHTML = `
        ${escapeHtml(tag)}
        <button data-index="${idx}" title="ลบ">✕</button>
      `;
      specialtyTagsList.appendChild(item);
    });
  }

  function addSpecialtyTag(tag) {
    const trimmed = tag.trim();
    if (!trimmed) return;
    // Check duplicates (case-insensitive)
    const exists = currentSpecialtiesTags.some(t => t.toLowerCase() === trimmed.toLowerCase());
    if (!exists) {
      currentSpecialtiesTags.push(trimmed);
      renderSpecialtyTags();
    } else {
      showToast('ระบุความเชี่ยวชาญนี้ไปแล้ว');
    }
  }

  if (specialtyTagInput) {
    specialtyTagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addSpecialtyTag(e.target.value);
        e.target.value = '';
      }
    });
  }

  if (specialtyTagsList) {
    specialtyTagsList.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON') {
        const idx = parseInt(e.target.dataset.index);
        currentSpecialtiesTags.splice(idx, 1);
        renderSpecialtyTags();
      }
    });
  }

  suggestedTagsBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      addSpecialtyTag(btn.textContent);
    });
  });

  function openProfileSettingsModal() {
    currentSpecialtiesTags = currentUser.specialties ? currentUser.specialties.split(',').filter(s => s.trim()) : [];
    renderSpecialtyTags();
    if (specialtyTagInput) specialtyTagInput.value = '';
    modalProfileSettings.style.display = 'flex';
  }

  function closeProfileSettingsModal() {
    modalProfileSettings.style.display = 'none';
  }

  async function saveProfileSettings() {
    btnSaveProfileSettings.disabled = true;
    btnSaveProfileSettings.textContent = 'กำลังบันทึก...';

    try {
      const specialtiesStr = currentSpecialtiesTags.join(',');
      const res = await fetch('/api/users/specialties', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specialties: specialtiesStr || null })
      });
      const data = await res.json();
      if (data.success) {
        currentUser.specialties = data.specialties;
        showToast('✅ บันทึกข้อมูลความเชี่ยวชาญเรียบร้อยแล้ว');
        closeProfileSettingsModal();
        await loadStaff(); // Reload staff list to apply changes
      } else {
        showToast(data.error || 'ไม่สามารถบันทึกได้');
      }
    } catch (err) {
      showToast('เกิดข้อผิดพลาด');
    } finally {
      btnSaveProfileSettings.disabled = false;
      btnSaveProfileSettings.textContent = 'บันทึกการตั้งค่า';
    }
  }

  // ============================================
  // START
  // ============================================
  init();

})();
