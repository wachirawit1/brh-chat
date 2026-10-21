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
  const appEl            = document.getElementById('app');
  const chatListEl       = document.getElementById('chat-list');
  const btnMobileBack    = document.getElementById('btn-mobile-back');
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
        window.location.replace('/login.html');
        return;
      }
      currentUser = data.user;
      document.body.classList.add('app-ready');
    } catch {
      window.location.replace('/login.html');
      return;
    }

    // Set user profile in sidebar
    setElementAvatar(myAvatar, currentUser.initials, currentUser.avatar_color);
    myName.textContent = currentUser.full_name;
    myDept.textContent = [currentUser.position, currentUser.department].filter(Boolean).join(' • ') || currentUser.department || '';

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

    // Set up event listeners immediately so UI buttons are responsive right away
    setupReportRequestListeners();
    setupListeners();

    // Load conversations
    await loadConversations();

    // Load staff list
    await loadStaff();

    // Load IT Board (to show badge count)
    await loadITBoard();

    // Load Report Requests Ledger
    await loadReportRequests();

    // Initialize quick templates from localStorage
    initQuickTemplates();
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
      updateChatUnreadPill();
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

    // Real-time Report Requests events
    socket.on('new_report_request', (newReq) => {
      const exists = reportRequests.some(r => r.id === newReq.id);
      if (!exists) {
        reportRequests.unshift(newReq);
      }
      renderReportLedger();
      if (currentUser && (currentUser.role === 'it' || currentUser.role === 'admin') && newReq.user_id !== currentUser.id) {
        showToast(`📊 คำขอรายงานใหม่: "${newReq.report_title}" จาก ${newReq.requester_name}`);
      }
    });

    socket.on('report_request_updated', (updatedReq) => {
      const idx = reportRequests.findIndex(r => r.id === updatedReq.id);
      if (idx !== -1) {
        reportRequests[idx] = updatedReq;
      } else {
        reportRequests.unshift(updatedReq);
      }
      renderReportLedger();
      if (selectedReportId === updatedReq.id) {
        selectReportRequest(updatedReq.id);
      }
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
             (c.department && c.department.toLowerCase().includes(lowerFilter)) ||
             (c.position && c.position.toLowerCase().includes(lowerFilter));
    });

    // 2. Matched staff who are not in conversations
    let matchedStaff = [];
    const activeUserIds = new Set(conversations.map(c => c.other_user_id));
    if (filter) {
      matchedStaff = allStaff.filter(s => {
        if (activeUserIds.has(s.id)) return false;
        return s.full_name.toLowerCase().includes(lowerFilter) ||
               (s.department && s.department.toLowerCase().includes(lowerFilter)) ||
               (s.position && s.position.toLowerCase().includes(lowerFilter));
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
      const convSubtitle = [conv.position, conv.department].filter(Boolean).join(' • ') || conv.department || '';

      item.innerHTML = `
        <div class="avatar">
          <div class="avatar-circle" style="background: ${getAvatarBg(conv.avatar_color)}">${conv.initials}</div>
          ${conv.is_online ? '<div class="online-dot"></div>' : ''}
        </div>
        <div class="chat-item-content">
          <div class="chat-item-top">
            <span class="chat-item-name">${conv.full_name} <span class="chat-item-dept">${convSubtitle}</span></span>
            <span class="chat-item-time">${timeStr}</span>
          </div>
          <div class="chat-item-preview">${preview}</div>
        </div>
        ${conv.unread_count > 0 ? `<div class="unread-badge">${conv.unread_count}</div>` : ''}
      `;

      const openConversation = () => selectChat(conv);
      item.setAttribute('role', 'button');
      item.tabIndex = 0;
      item.setAttribute('aria-label', `Open chat with ${conv.full_name}`);
      item.addEventListener('click', openConversation);
      item.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openConversation();
        }
      });
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

        const staffSubtitle = [staff.position, staff.department].filter(Boolean).join(' • ') || staff.department || '';

        item.innerHTML = `
          <div class="avatar">
            <div class="avatar-circle" style="background: ${getAvatarBg(staff.avatar_color || 'avatar-blue')}">${staff.initials || '??'}</div>
            ${staff.is_online ? '<div class="online-dot"></div>' : ''}
          </div>
          <div class="chat-item-content">
            <div class="chat-item-top" style="margin-bottom:0;">
              <span class="chat-item-name">${staff.full_name} <span class="chat-item-dept">${staffSubtitle}</span></span>
            </div>
            ${specsHtml}
            <div class="chat-item-preview" style="color:var(--primary-500); font-weight:500; font-size:11.5px; margin-top:2px;">คลิกเพื่อเริ่มแชท 1:1</div>
          </div>
        `;

        const startConversation = () => startNewChat(staff.id);
        item.setAttribute('role', 'button');
        item.tabIndex = 0;
        item.setAttribute('aria-label', `Start chat with ${staff.full_name}`);
        item.addEventListener('click', startConversation);
        item.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            startConversation();
          }
        });
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
      position: conv.position,
      initials: conv.initials,
      avatar_color: conv.avatar_color,
      is_online: conv.is_online
    };

    // Hide typing indicator from previous chat
    hideTyping();

    // Show chat view
    emptyState.style.display = 'none';
    chatView.style.display = 'flex';
    appEl.classList.add('mobile-chat-open');

    // Show Quick Templates if user is IT/Admin
    if (currentUser && (currentUser.role === 'it' || currentUser.role === 'admin')) {
      quickTemplates.style.display = 'flex';
    } else {
      quickTemplates.style.display = 'none';
    }

    // Update header
    setElementAvatar(headerAvatar, conv.initials, conv.avatar_color);
    headerNameText.textContent = conv.full_name;
    headerDept.textContent = [conv.position, conv.department].filter(Boolean).join(' • ') || conv.department || '';

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

  // Helper for file type info (Excel, PDF, Word, PowerPoint, ZIP, General)
  function getFileTypeInfo(ext) {
    ext = (ext || '').toLowerCase();
    if (['xlsx', 'xls', 'csv'].includes(ext)) {
      return {
        typeClass: 'is-excel',
        boxClass: 'excel',
        badgeClass: 'excel',
        badgeLetter: 'X',
        extLabel: ext.toUpperCase(),
        label: 'ตารางข้อมูล Excel • คลิกเพื่อดาวน์โหลด',
        iconSVG: `<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="9" x2="9" y2="21"></line><line x1="15" y1="9" x2="15" y2="21"></line>`
      };
    }
    if (ext === 'pdf') {
      return {
        typeClass: 'is-pdf',
        boxClass: 'pdf',
        badgeClass: 'pdf',
        badgeLetter: 'PDF',
        extLabel: 'PDF',
        label: 'เอกสาร PDF • คลิกเพื่อดาวน์โหลด',
        iconSVG: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line>`
      };
    }
    if (['docx', 'doc'].includes(ext)) {
      return {
        typeClass: 'is-word',
        boxClass: 'word',
        badgeClass: 'word',
        badgeLetter: 'W',
        extLabel: ext.toUpperCase(),
        label: 'เอกสาร Word • คลิกเพื่อดาวน์โหลด',
        iconSVG: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line>`
      };
    }
    if (['pptx', 'ppt'].includes(ext)) {
      return {
        typeClass: 'is-ppt',
        boxClass: 'ppt',
        badgeClass: 'ppt',
        badgeLetter: 'P',
        extLabel: ext.toUpperCase(),
        label: 'งานนำเสนอ PowerPoint • คลิกเพื่อดาวน์โหลด',
        iconSVG: `<rect x="3" y="3" width="18" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line>`
      };
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
      return {
        typeClass: 'is-zip',
        boxClass: 'zip',
        badgeClass: 'zip',
        badgeLetter: 'ZIP',
        extLabel: ext.toUpperCase(),
        label: 'ไฟล์บีบอัด Archive • คลิกเพื่อดาวน์โหลด',
        iconSVG: `<path d="M21 8v13H3V8"></path><path d="M1 3h22v5H1z"></path><path d="M10 12h4"></path>`
      };
    }
    return {
      typeClass: 'is-general',
      boxClass: 'general',
      badgeClass: 'general',
      badgeLetter: (ext.slice(0, 3) || 'DOC').toUpperCase(),
      extLabel: (ext || 'FILE').toUpperCase(),
      label: 'ไฟล์แนบ • คลิกเพื่อดาวน์โหลด',
      iconSVG: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line>`
    };
  }

  // Helper to render file attachments with filename card + optional text bubble below
  function buildFileMessageHTML(msg, timeStr, readCheck) {
    const pathExtMatch = (msg.media_path || '').match(/\.([a-z0-9]+)$/i);
    const capExtMatch = (msg.media_caption || '').match(/\.([a-z0-9]+)$/i);
    const ext = (capExtMatch ? capExtMatch[1] : (pathExtMatch ? pathExtMatch[1] : 'file')).toLowerCase();
    const info = getFileTypeInfo(ext);

    let fileName = msg.media_caption || '';
    let extraText = '';

    if (msg.message_text && msg.media_caption && msg.media_caption !== msg.message_text) {
      // Normal case: media_caption holds original filename, message_text holds typed message
      fileName = msg.media_caption;
      extraText = msg.message_text;
    } else if (msg.message_text && msg.media_caption === msg.message_text) {
      // Legacy fallback: if media_caption was overwritten by typed text (no file extension)
      if (!capExtMatch) {
        extraText = msg.message_text;
        fileName = `ไฟล์แนบ (${info.extLabel})`;
      } else {
        fileName = msg.media_caption;
      }
    } else if (!fileName) {
      fileName = `ไฟล์แนบ (${info.extLabel})`;
    }

    const subLabel = `<span class="file-ext-badge ${info.badgeClass}">${escapeHtml(info.extLabel)}</span><span>${info.label}</span>`;
    const downloadUrl = `/api/download?file=${encodeURIComponent(msg.media_path)}&name=${encodeURIComponent(fileName)}`;

    return `
      <a href="${downloadUrl}" download="${escapeHtml(fileName)}" class="msg-media-file ${info.typeClass}" title="คลิกเพื่อดาวน์โหลด ${escapeHtml(fileName)}">
        <div class="file-icon-box ${info.boxClass}">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            ${info.iconSVG}
          </svg>
          ${info.badgeLetter ? `<span class="file-badge-mark ${info.badgeClass}">${escapeHtml(info.badgeLetter)}</span>` : ''}
        </div>
        <div class="file-info">
          <span class="file-name">${escapeHtml(fileName)}</span>
          <span class="file-meta">${subLabel}</span>
        </div>
        <div class="file-dl-btn" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </div>
      </a>
      ${extraText ? `<div class="msg-bubble msg-file-caption-bubble">${escapeHtml(extraText)}</div>` : ''}
      <div class="msg-time">${timeStr} ${readCheck}</div>`;
  }

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
        bubbleContent = buildFileMessageHTML(msg, timeStr, readCheck);
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
      bubbleContent = buildFileMessageHTML(msg, timeStr, readCheck);
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

      const isDocFile = response.type === 'file';
      socket.emit('send_message', {
        conversation_id: activeConvId,
        text: caption || null,
        media_type: response.type,
        media_path: response.path,
        media_caption: isDocFile ? (response.originalName || caption) : (caption || response.originalName)
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

    const ext = (file.name || '').split('.').pop().toLowerCase();
    const info = getFileTypeInfo(ext);

    filePreviewVideo.className = 'file-preview-video'; // reset class
    filePreviewVideo.classList.add(`is-${info.badgeClass}-preview`);

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
      filePreviewVideoName.textContent = info.badgeLetter;
      
      const svg = filePreviewVideo.querySelector('svg');
      if (svg) {
        if (file.type.startsWith('video/')) {
          svg.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
          filePreviewVideoName.textContent = '';
        } else {
          svg.innerHTML = info.iconSVG;
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
    filePreviewVideo.className = 'file-preview-video';
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

    btnMobileBack?.addEventListener('click', () => {
      appEl.classList.remove('mobile-chat-open');
      messageInput.blur();
      closeGallery();
    });

    // Quick templates click
    quickTemplates?.addEventListener('click', (e) => {
      if (e.target.classList.contains('template-chip')) {
        messageInput.value = e.target.textContent;
        messageInput.focus();
      }
    });

    // Send button
    sendBtn?.addEventListener('click', sendMessage);

    // Enter key
    messageInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Typing detection
    messageInput?.addEventListener('input', () => {
      emitTypingStart();
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(emitTypingStop, 2000);
    });

    // Search
    searchInput?.addEventListener('input', (e) => {
      renderChatList(e.target.value);
    });

    // Paperclip
    attachBtn?.addEventListener('click', () => {
      if (!activeConvId) {
        showToast('กรุณาเลือกแชทก่อน');
        return;
      }
      fileInput.click();
    });

    fileInput?.addEventListener('change', handleFileSelect);
    filePreviewRemove?.addEventListener('click', clearFilePreview);

    // Logout
    logoutBtn?.addEventListener('click', async () => {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch {}
      window.location.href = '/login.html';
    });

    // Lightbox
    lightboxClose?.addEventListener('click', () => {
      lightbox.style.display = 'none';
    });
    lightbox?.addEventListener('click', (e) => {
      if (e.target === lightbox) lightbox.style.display = 'none';
    });

    // Sidebar Tabs
    tabChats?.addEventListener('click', () => switchTab('chats'));
    tabItboard?.addEventListener('click', () => switchTab('itboard'));

    // IT Board: Create Post
    btnCreatePost?.addEventListener('click', openCreatePostModal);

    // Modal
    modalClosePost?.addEventListener('click', closeCreatePostModal);
    btnCancelPost?.addEventListener('click', closeCreatePostModal);
    btnSubmitPost?.addEventListener('click', submitPost);

    // Close modal on overlay click
    modalCreatePost?.addEventListener('click', (e) => {
      if (e.target === modalCreatePost) closeCreatePostModal();
    });

    // Submit post with Enter in title
    postTitle?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitPost();
      }
    });

    // Gallery toggle
    btnGallery?.addEventListener('click', toggleGallery);
    btnCloseGallery?.addEventListener('click', closeGallery);
    setupGalleryTabListeners();

    // Custom templates modal toggle
    btnTemplateSettings?.addEventListener('click', () => {
      modalTemplates.style.display = 'flex';
      renderTemplates();
    });

    modalCloseTemplates?.addEventListener('click', () => {
      modalTemplates.style.display = 'none';
    });

    btnCloseTemplatesModal?.addEventListener('click', () => {
      modalTemplates.style.display = 'none';
    });

    modalTemplates?.addEventListener('click', (e) => {
      if (e.target === modalTemplates) modalTemplates.style.display = 'none';
    });

    // Add new custom template
    btnAddTemplate?.addEventListener('click', () => {
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

    newTemplateInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        btnAddTemplate.click();
      }
    });

    // Delete custom template (event delegation)
    templateListManage?.addEventListener('click', (e) => {
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
    modalProfileSettings?.addEventListener('click', (e) => {
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

  var DEFAULT_TEMPLATES = [
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

  var isGalleryOpen = false;

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
        itemEl.href = `/api/download?file=${encodeURIComponent(item.path)}&name=${encodeURIComponent(item.name)}`;
        itemEl.download = item.name;
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

  var currentSpecialtiesTags = [];

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
          <div class="recommended-staff-role">${[staff.position, staff.department].filter(Boolean).join(' • ') || staff.department || 'ฝ่าย IT'}</div>
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
                position: staff.position,
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
  var specialtyTagInput = document.getElementById('specialty-tag-input');
  var specialtyTagsList = document.getElementById('specialty-tags-list');
  var suggestedTagsBtns = document.querySelectorAll('.suggested-tag-btn');

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
  // REPORT REQUEST PORTAL & IT LOG SYSTEM (v2.3 Full-Page Views)
  // ============================================
  var reportRequests = [];
  var selectedReportId = null;
  var activeReportFilter = 'all';
  var activeWorkspace = 'reports';

  var navWorkspaceReports = document.getElementById('nav-workspace-reports');
  var navWorkspaceChat    = document.getElementById('nav-workspace-chat');
  var reportsWorkspace    = document.getElementById('reports-workspace');
  var chatWorkspace       = document.getElementById('chat-workspace');
  var reportsPendingPill  = document.getElementById('reports-pending-pill');
  var chatUnreadPill      = document.getElementById('chat-unread-pill');
  var btnBackToReports    = document.getElementById('btn-back-to-reports');

  // Full-Page List vs Full-Page Detail Views
  var reportsListView     = document.getElementById('reports-list-view');
  var reportDetailView    = document.getElementById('report-detail-view');
  var btnBackToList       = document.getElementById('btn-back-to-list');

  var reportLedgerTbody   = document.getElementById('report-ledger-tbody');
  var reportSearchInput   = document.getElementById('report-search-input');
  var btnExportLog        = document.getElementById('btn-export-log');
  var btnOpenReportModal  = document.getElementById('btn-open-report-modal');
  var btnEmptyNewReport   = document.getElementById('btn-empty-new-report');

  // Filter buttons & counts
  var filterBtns          = document.querySelectorAll('.ledger-filter-btn');
  var statCountAll        = document.getElementById('stat-count-all');
  var statCountPending    = document.getElementById('stat-count-pending');
  var statCountProgress   = document.getElementById('stat-count-progress');
  var statCountCompleted  = document.getElementById('stat-count-completed');
  var statCountMine       = document.getElementById('stat-count-mine');

  // Detail View DOM
  var inspId              = document.getElementById('insp-id');
  var inspUrgency         = document.getElementById('insp-urgency');
  var inspStatusBadge     = document.getElementById('insp-status-badge');
  var inspTitle           = document.getElementById('insp-title');
  var inspCreatedAt       = document.getElementById('insp-created-at');
  var inspHeroPct         = document.getElementById('insp-hero-pct');
  var inspHeroBar         = document.getElementById('insp-hero-bar');
  var btnInspChat         = document.getElementById('btn-insp-chat');
  var btnInspChatLabel    = document.getElementById('btn-insp-chat-label');
  var btnInspClaim        = document.getElementById('btn-insp-claim');

  var inspRequesterName   = document.getElementById('insp-requester-name');
  var inspRequesterPos    = document.getElementById('insp-requester-pos');
  var inspDept            = document.getElementById('insp-dept');
  var inspPhone           = document.getElementById('insp-phone');
  var inspFrequency       = document.getElementById('insp-frequency');
  var inspDueDate         = document.getElementById('insp-due-date');
  var inspPurposes        = document.getElementById('insp-purposes');
  var inspUrgentReasonRow = document.getElementById('insp-urgent-reason-row');
  var inspUrgentReason    = document.getElementById('insp-urgent-reason');
  var inspDetails         = document.getElementById('insp-details');
  var inspChannel         = document.getElementById('insp-channel');

  // IT Console Read-only & Form DOM
  var itConsoleReadonly   = document.getElementById('it-console-readonly');
  var roStatus            = document.getElementById('ro-status');
  var roOwner             = document.getElementById('ro-owner');
  var roStartDate         = document.getElementById('ro-start-date');
  var roCompletedDate     = document.getElementById('ro-completed-date');
  var roPct               = document.getElementById('ro-pct');
  var roNotes             = document.getElementById('ro-notes');

  var itConsoleForm       = document.getElementById('it-console-form');
  var itFieldStatus       = document.getElementById('it-field-status');
  var itFieldOwner        = document.getElementById('it-field-owner');
  var itFieldStart        = document.getElementById('it-field-start');
  var itFieldCompleted    = document.getElementById('it-field-completed');
  var itFieldPctRange     = document.getElementById('it-field-pct-range');
  var itFieldPct          = document.getElementById('it-field-pct');
  var itPctDisplay        = document.getElementById('it-pct-display');
  var itFieldNotes        = document.getElementById('it-field-notes');
  var btnCompleteItJob    = document.getElementById('btn-complete-it-job');

  // Report Request Modal DOM
  var modalReportRequest  = document.getElementById('modal-report-request');
  var modalCloseReport    = document.getElementById('modal-close-report');
  var btnCancelReport     = document.getElementById('btn-cancel-report');
  var formReportRequest   = document.getElementById('form-report-request');
  var reqNameInput        = document.getElementById('req-name');
  var reqNameSpinner      = document.getElementById('req-name-spinner');
  var reqNameSuggestions  = document.getElementById('req-name-suggestions');
  var btnUseMyInfo        = document.getElementById('btn-use-my-info');
  var reqPositionInput    = document.getElementById('req-position');
  var reqTitleInput       = document.getElementById('req-title');
  var reqDeptInput        = document.getElementById('req-dept');
  var reqPhoneInput       = document.getElementById('req-phone');
  var reqPurposeOtherChk  = document.getElementById('req-purpose-other-chk');
  var reqPurposeOtherText = document.getElementById('req-purpose-other-text');
  var reqFrequencySelect  = document.getElementById('req-frequency');
  var reqFrequencyOther   = document.getElementById('req-frequency-other');
  var reqDetailsInput     = document.getElementById('req-details');
  var reqChannelInput     = document.getElementById('req-channel');
  var reqDueDateInput     = document.getElementById('req-due-date');
  var reqUrgencySelect    = document.getElementById('req-urgency');
  var reqUrgentReasonInput= document.getElementById('req-urgent-reason');

  function switchWorkspace(ws) {
    activeWorkspace = ws;
    if (ws === 'reports') {
      navWorkspaceReports.classList.add('active');
      navWorkspaceChat.classList.remove('active');
      reportsWorkspace.style.display = 'flex';
      chatWorkspace.style.display = 'none';
      closeReportDetailPage();
      loadReportRequests();
    } else {
      navWorkspaceChat.classList.add('active');
      navWorkspaceReports.classList.remove('active');
      chatWorkspace.style.display = 'flex';
      reportsWorkspace.style.display = 'none';
      updateChatUnreadPill();
    }
  }

  function closeReportDetailPage() {
    selectedReportId = null;
    if (reportDetailView) reportDetailView.style.display = 'none';
    if (reportsListView) reportsListView.style.display = 'block';
    renderReportLedger();
  }

  function updateChatUnreadPill() {
    if (!chatUnreadPill) return;
    const totalUnread = conversations.reduce((sum, c) => sum + (parseInt(c.unread_count) || 0), 0);
    const pendingITPosts = (currentUser && (currentUser.role === 'it' || currentUser.role === 'admin'))
      ? itPosts.filter(p => p.status === 'pending').length
      : 0;
    const total = totalUnread + pendingITPosts;
    if (total > 0) {
      chatUnreadPill.textContent = total;
      chatUnreadPill.style.display = 'inline-block';
    } else {
      chatUnreadPill.style.display = 'none';
    }
  }

  let reportLoadError = false;

  async function loadReportRequests() {
    try {
      const res = await fetch('/api/report-requests');
      if (res.status === 401) {
        window.location.href = '/login.html';
        return;
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.requests) {
        reportLoadError = false;
        reportRequests = data.requests;
        renderReportLedger();
        if (selectedReportId) {
          const stillExists = reportRequests.some(r => r.id === selectedReportId);
          if (stillExists) {
            selectReportRequest(selectedReportId);
          } else {
            closeReportDetailPage();
          }
        }
      }
    } catch (err) {
      console.error('Load report requests error:', err);
      reportLoadError = true;
      renderReportLedger();
    }
    updateChatUnreadPill();
  }

  function normalizeReportStatus(status) {
    if (status === 'เสร็จ' || status === 'เสร็จสิ้น') return 'เสร็จ';
    if (status === 'กำลังดำเนินการ' || status === 'รอข้อมูลเพิ่มเติม') return 'กำลังดำเนินการ';
    return 'ยังไม่ดำเนินการ';
  }

  function getStatusMeta(status) {
    const norm = normalizeReportStatus(status);
    if (norm === 'เสร็จ') return { cls: 'completed', label: 'เสร็จ' };
    if (norm === 'กำลังดำเนินการ') return { cls: 'inprogress', label: 'กำลังดำเนินการ' };
    return { cls: 'pending', label: 'ยังไม่ดำเนินการ' };
  }

  function formatThaiDateShort(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const yearBE = d.getFullYear() + 543;
    return `${day}/${month}/${yearBE}`;
  }

  function formatThaiDateTimeParts(dateStr, fallbackTimeDateStr = null) {
    if (!dateStr) return { date: '-', time: '', full: '-' };
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { date: String(dateStr), time: '', full: String(dateStr) };
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const yearBE = d.getFullYear() + 543;
    const datePart = `${day}/${month}/${yearBE}`;

    let hours = d.getHours();
    let mins = d.getMinutes();
    let secs = d.getSeconds();
    const isMidnightDateOnly = (hours === 0 && mins === 0 && secs === 0);

    if (isMidnightDateOnly && fallbackTimeDateStr) {
      const fb = new Date(fallbackTimeDateStr);
      if (!isNaN(fb.getTime())) {
        hours = fb.getHours();
        mins = fb.getMinutes();
        secs = fb.getSeconds();
      }
    }

    const hasTime = !(hours === 0 && mins === 0 && secs === 0 && String(dateStr).trim().length <= 10);
    const timePart = hasTime
      ? `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')} น.`
      : '';
    return {
      date: datePart,
      time: timePart,
      full: timePart ? `${datePart} เวลา ${timePart}` : datePart
    };
  }

  function parsePurposesList(purposesRaw, purposeOther) {
    let arr = [];
    if (Array.isArray(purposesRaw)) {
      arr = [...purposesRaw];
    } else if (typeof purposesRaw === 'string' && purposesRaw.trim()) {
      try {
        const parsed = JSON.parse(purposesRaw);
        if (Array.isArray(parsed)) arr = parsed;
        else arr = [purposesRaw];
      } catch {
        arr = [purposesRaw];
      }
    }
    if (purposeOther && purposeOther.trim()) {
      arr.push(`อื่นๆ: ${purposeOther.trim()}`);
    }
    return arr;
  }

  function getFilteredReportRequests() {
    const q = (reportSearchInput ? reportSearchInput.value : '').trim().toLowerCase();

    return reportRequests.filter(r => {
      const normStatus = normalizeReportStatus(r.status);
      if (activeReportFilter === 'pending' && normStatus !== 'ยังไม่ดำเนินการ') return false;
      if (activeReportFilter === 'inprogress' && normStatus !== 'กำลังดำเนินการ') return false;
      if (activeReportFilter === 'completed' && normStatus !== 'เสร็จ') return false;
      if (activeReportFilter === 'mine' && currentUser) {
        const isMine = r.user_id === currentUser.id || r.owner_id === currentUser.id;
        if (!isMine) return false;
      }

      if (q) {
        const idCode = `rep-${String(r.id).padStart(4, '0')}`;
        const haystack = [
          idCode,
          r.report_title,
          r.requester_name,
          r.requester_position,
          r.department,
          r.phone,
          r.owner_name,
          r.details,
          r.delivery_channel,
          r.urgency,
          r.urgent_reason,
          normStatus
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }

  let isCompletedSectionExpanded = false;

  const sectionPagination = {
    pending: { page: 1, pageSize: null },
    inprogress: { page: 1, pageSize: null },
    completed: { page: 1, pageSize: null }
  };

  function resetSectionPaginationPages() {
    sectionPagination.pending.page = 1;
    sectionPagination.inprogress.page = 1;
    sectionPagination.completed.page = 1;
  }

  function getEffectivePageSize(sectionKey) {
    const customSize = sectionPagination[sectionKey]?.pageSize;
    if (customSize) return customSize;
    // In "all" view (3 sections stacked), default 5 items per section; in single-status tabs, default 10 items
    return activeReportFilter === 'all' ? 5 : 10;
  }

  function buildPageNumbersList(currentPage, totalPages) {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = [1];
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    if (start > 2) pages.push('...');
    for (let p = start; p <= end; p++) pages.push(p);
    if (end < totalPages - 1) pages.push('...');
    pages.push(totalPages);
    return pages;
  }

  function getUrgencyMeta(urgency) {
    const u = String(urgency || '').trim();
    if (u.includes('ด่วนมาก') || u.includes('3 วัน') || u.includes('ด่วนที่สุด')) {
      return { rank: 2, cls: 'very-urgent', label: 'ด่วนมาก ภายใน 3 วัน' };
    }
    if (u.includes('ด่วน')) {
      return { rank: 1, cls: 'urgent', label: 'ด่วน ภายใน 5 วัน' };
    }
    return { rank: 0, cls: '', label: 'ปกติ ภายใน 10 วัน' };
  }

  function sortReportGroupByPriority(items) {
    return [...items].sort((a, b) => {
      const aRank = getUrgencyMeta(a.urgency).rank;
      const bRank = getUrgencyMeta(b.urgency).rank;
      if (aRank !== bRank) return bRank - aRank;
      const aDue = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
      const bDue = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
      if (aDue !== bDue) return aDue - bDue;
      return b.id - a.id;
    });
  }

  async function quickClaimReportRequest(reqId, e) {
    if (e) e.stopPropagation();
    const btn = e && e.currentTarget ? e.currentTarget : null;
    if (btn) {
      if (btn.disabled) return;
      btn.disabled = true;
      btn.textContent = 'กำลังรับงาน...';
    }
    try {
      const res = await fetch(`/api/report-requests/${reqId}/claim`, { method: 'POST' });
      if (res.status === 401) {
        window.location.href = '/login.html';
        return;
      }
      const data = await res.json();
      if (data.success && data.request) {
        showToast(`✅ รับงาน #REP-${String(reqId).padStart(4, '0')} เรียบร้อยแล้ว`);
        const idx = reportRequests.findIndex(r => r.id === data.request.id);
        if (idx !== -1) reportRequests[idx] = data.request;
        renderReportLedger();
        await loadConversations();
      } else {
        showToast(data.error || 'ไม่สามารถรับงานได้');
        await loadReportRequests();
      }
    } catch (err) {
      showToast('เกิดข้อผิดพลาดในการรับงาน');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'รับงาน';
      }
    }
  }

  function buildReportGroupSection(groupConfig, items, isIT) {
    const card = document.createElement('div');
    card.className = `report-group-card ${groupConfig.cardClass}`;

    const urgentCount = items.filter(r => getUrgencyMeta(r.urgency).rank > 0).length;
    const isCollapsible = !!groupConfig.collapsible;
    const isExpanded = !isCollapsible || groupConfig.expanded;

    const header = document.createElement('div');
    header.className = 'report-group-header';
    header.innerHTML = `
      <div class="group-header-left">
        <div class="group-status-icon">${groupConfig.icon}</div>
        <div class="group-title-wrap">
          <div class="group-title">${groupConfig.title}</div>
          <div class="group-subtitle">${groupConfig.subtitle}</div>
        </div>
      </div>
      <div class="group-header-right">
        ${urgentCount > 0 && groupConfig.key !== 'completed' ? `<span class="group-urgent-pill">ด่วน ${urgentCount} รายการ</span>` : ''}
        <span class="group-count-pill">${items.length} รายการ</span>
        ${isCollapsible ? `
          <button type="button" class="btn-collapse-completed" aria-expanded="${isExpanded ? 'true' : 'false'}">
            <span>${isExpanded ? 'ซ่อนรายการที่เสร็จแล้ว ▲' : 'คลิกเพื่อดูรายการที่เสร็จแล้ว ▼'}</span>
          </button>
        ` : ''}
      </div>
    `;

    if (isCollapsible) {
      header.addEventListener('click', () => {
        isCompletedSectionExpanded = !isCompletedSectionExpanded;
        renderReportLedger();
      });
    }

    card.appendChild(header);

    if (!isExpanded) {
      return card;
    }

    const sortedItems = sortReportGroupByPriority(items);
    const secKey = groupConfig.key || 'pending';
    const pageSize = getEffectivePageSize(secKey);
    const totalItems = sortedItems.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    if (!sectionPagination[secKey]) {
      sectionPagination[secKey] = { page: 1, pageSize: null };
    }
    if (sectionPagination[secKey].page > totalPages) {
      sectionPagination[secKey].page = totalPages;
    }
    if (sectionPagination[secKey].page < 1) {
      sectionPagination[secKey].page = 1;
    }

    const currentPage = sectionPagination[secKey].page;
    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, totalItems);
    const pagedItems = sortedItems.slice(startIdx, endIdx);

    const tableWrap = document.createElement('div');
    tableWrap.className = 'report-table-scroll-wrap';

    const table = document.createElement('table');
    table.className = 'report-ledger-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th class="col-id">รหัสคำขอ</th>
          <th class="col-title">ชื่อรายงาน / หัวข้อคำขอข้อมูล</th>
          <th class="col-requester">ผู้ขอข้อมูล &amp; หน่วยงาน</th>
          <th class="col-created">วัน-เวลาที่ขอข้อมูล</th>
          <th class="col-due">กำหนดรับข้อมูล</th>
          <th class="col-status">สถานะความคืบหน้า</th>
          <th class="col-owner">ผู้รับผิดชอบ / เวลาเสร็จ</th>
          <th class="col-action"></th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');

    pagedItems.forEach(req => {
      const tr = document.createElement('tr');
      const normStatus = normalizeReportStatus(req.status);
      const urgMeta = getUrgencyMeta(req.urgency);
      const isUrgent = urgMeta.rank > 0;

      const rowStatusCls = normStatus === 'ยังไม่ดำเนินการ'
        ? `row-pending ${isUrgent ? 'row-urgent' : ''}`
        : (normStatus === 'กำลังดำเนินการ' ? 'row-inprogress' : 'row-completed');
      tr.className = rowStatusCls;

      const codeStr = `#REP-${String(req.id).padStart(4, '0')}`;
      const purposesArr = parsePurposesList(req.purposes, req.purpose_other);
      const purposePreview = purposesArr.length > 0 ? purposesArr.join(' • ') : req.frequency;
      const statusMeta = getStatusMeta(req.status);
      const pct = Math.max(0, Math.min(100, parseInt(req.percent_complete) || 0));

      const createdMeta = formatThaiDateTimeParts(req.created_at);
      const completedMeta = req.completed_date
        ? formatThaiDateTimeParts(req.completed_date, req.updated_at)
        : null;

      const cleanOwnerName = req.owner_name ? req.owner_name.replace(/\s*\(IT\)\s*/g, '') : '';
      const completedStampHtml = completedMeta
        ? `<div class="rep-completed-stamp">✓ เสร็จ: ${completedMeta.date}${completedMeta.time ? ` • ${completedMeta.time}` : ''}</div>`
        : '';
      const ownerHtml = cleanOwnerName
        ? `<div class="rep-owner-name">${escapeHtml(cleanOwnerName)}</div>
           ${completedStampHtml}`
        : `<span class="rep-owner-unassigned">รอศูนย์คอมฯ รับงาน</span>`;

      const showQuickClaim = isIT && normStatus === 'ยังไม่ดำเนินการ';

      const isProxy = Boolean(req.submitter_name && req.submitter_name.trim() !== (req.requester_name || '').trim());

      tr.innerHTML = `
        <td>
          <span class="rep-id-badge">${codeStr}</span>
          ${normStatus === 'ยังไม่ดำเนินการ' ? '<span class="rep-new-tag">ใหม่</span>' : ''}
        </td>
        <td>
          <div class="rep-title-link">${escapeHtml(req.report_title)}</div>
          <div class="rep-purpose-sub">${escapeHtml(purposePreview || '')}</div>
        </td>
        <td>
          <div class="rep-req-person">${escapeHtml(req.requester_name)}${isProxy ? ` <span class="proxy-badge" title="ยื่นคำขอแทนโดย ${escapeHtml(req.submitter_name)}">ยื่นแทน</span>` : ''}</div>
          <div class="rep-req-dept">${escapeHtml(req.department)} • โทร ${escapeHtml(req.phone)}</div>
        </td>
        <td>
          <div class="rep-created-date">${createdMeta.date}</div>
          ${createdMeta.time ? `<span class="rep-created-time">🕒 ${createdMeta.time}</span>` : ''}
        </td>
        <td>
          <div class="rep-due-date">${formatThaiDateShort(req.due_date)}</div>
          <span class="rep-urgency-tag ${urgMeta.cls}">${escapeHtml(urgMeta.label)}</span>
        </td>
        <td>
          <span class="status-pill ${statusMeta.cls}">${escapeHtml(statusMeta.label)}</span>
          <div class="cell-progress-wrap">
            <div class="cell-progress-track">
              <div class="cell-progress-fill ${pct === 100 ? 'done' : ''}" style="width:${pct}%"></div>
            </div>
            <span class="cell-progress-pct">${pct}%</span>
          </div>
        </td>
        <td>${ownerHtml}</td>
        <td style="text-align:right;">
          <div class="row-actions-group">
            ${showQuickClaim ? `<button type="button" class="btn-row-quick-claim" data-claim-id="${req.id}">รับงาน</button>` : ''}
            <span class="btn-row-view-detail">ดูรายละเอียด →</span>
          </div>
        </td>
      `;

      const claimBtn = tr.querySelector('.btn-row-quick-claim');
      if (claimBtn) {
        claimBtn.addEventListener('click', (e) => quickClaimReportRequest(req.id, e));
      }

      tr.tabIndex = 0;
      tr.setAttribute('role', 'button');
      tr.addEventListener('click', () => {
        selectReportRequest(req.id);
      });
      tr.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectReportRequest(req.id);
        }
      });

      tbody.appendChild(tr);
    });

    tableWrap.appendChild(table);
    card.appendChild(tableWrap);

    // Render Pagination Footer Bar
    const paginationBar = document.createElement('div');
    paginationBar.className = 'section-pagination-bar';

    const pageNumbers = buildPageNumbersList(currentPage, totalPages);
    const pageButtonsHtml = pageNumbers.map(p => {
      if (p === '...') {
        return `<span class="page-ellipsis">…</span>`;
      }
      return `<button type="button" class="page-num-btn ${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`;
    }).join('');

    paginationBar.innerHTML = `
      <div class="pagination-info-left">
        <span class="pagination-range-text">แสดง <strong class="tabular-num">${startIdx + 1}–${endIdx}</strong> จากทั้งหมด <strong class="tabular-num">${totalItems}</strong> รายการ</span>
        <label class="pagination-size-label">
          <span>แสดงหน้าละ</span>
          <select class="pagination-size-select" aria-label="จำนวนรายการต่อหน้า">
            <option value="5" ${pageSize === 5 ? 'selected' : ''}>5 รายการ</option>
            <option value="10" ${pageSize === 10 ? 'selected' : ''}>10 รายการ</option>
            <option value="20" ${pageSize === 20 ? 'selected' : ''}>20 รายการ</option>
            <option value="50" ${pageSize === 50 ? 'selected' : ''}>50 รายการ</option>
          </select>
        </label>
      </div>
      <div class="pagination-controls-right">
        <button type="button" class="page-nav-btn" data-nav="prev" ${currentPage <= 1 ? 'disabled' : ''}>‹ ก่อนหน้า</button>
        <div class="page-numbers-group">${pageButtonsHtml}</div>
        <button type="button" class="page-nav-btn" data-nav="next" ${currentPage >= totalPages ? 'disabled' : ''}>ถัดไป ›</button>
      </div>
    `;

    const sizeSelect = paginationBar.querySelector('.pagination-size-select');
    if (sizeSelect) {
      sizeSelect.addEventListener('change', (e) => {
        sectionPagination[secKey].pageSize = parseInt(e.target.value, 10) || 10;
        sectionPagination[secKey].page = 1;
        renderReportLedger();
      });
    }

    const prevBtn = paginationBar.querySelector('[data-nav="prev"]');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (sectionPagination[secKey].page > 1) {
          sectionPagination[secKey].page--;
          renderReportLedger();
        }
      });
    }

    const nextBtn = paginationBar.querySelector('[data-nav="next"]');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (sectionPagination[secKey].page < totalPages) {
          sectionPagination[secKey].page++;
          renderReportLedger();
        }
      });
    }

    paginationBar.querySelectorAll('.page-num-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetPage = parseInt(btn.dataset.page, 10);
        if (targetPage && targetPage !== sectionPagination[secKey].page) {
          sectionPagination[secKey].page = targetPage;
          renderReportLedger();
        }
      });
    });

    card.appendChild(paginationBar);
    return card;
  }

  function renderReportLedger() {
    if (!reportLedgerTbody) return;

    // Update counts for the 3 statuses
    const pendingCnt = reportRequests.filter(r => normalizeReportStatus(r.status) === 'ยังไม่ดำเนินการ').length;
    const progressCnt = reportRequests.filter(r => normalizeReportStatus(r.status) === 'กำลังดำเนินการ').length;
    const completedCnt = reportRequests.filter(r => normalizeReportStatus(r.status) === 'เสร็จ').length;
    const mineCnt = currentUser
      ? reportRequests.filter(r => r.user_id === currentUser.id || r.owner_id === currentUser.id).length
      : 0;

    if (statCountAll) statCountAll.textContent = reportRequests.length;
    if (statCountPending) statCountPending.textContent = pendingCnt;
    if (statCountProgress) statCountProgress.textContent = progressCnt;
    if (statCountCompleted) statCountCompleted.textContent = completedCnt;
    if (statCountMine) statCountMine.textContent = mineCnt;
    if (reportsPendingPill) {
      reportsPendingPill.textContent = pendingCnt + progressCnt;
    }

    const filtered = getFilteredReportRequests();
    reportLedgerTbody.innerHTML = '';

    if (filtered.length === 0) {
      const emptyBox = document.createElement('div');
      emptyBox.className = 'report-group-card report-empty-state';
      const hasSearchQuery = Boolean(reportSearchInput && reportSearchInput.value.trim());

      if (reportLoadError) {
        emptyBox.innerHTML = `
          <div class="report-empty-icon error">!</div>
          <h4 class="report-empty-title">ไม่สามารถโหลดข้อมูลรายการคำขอรายงานได้</h4>
          <p class="report-empty-desc">กรุณาตรวจสอบการเชื่อมต่อเครือข่าย แล้วกดลองใหม่อีกครั้ง</p>
          <div class="report-empty-actions">
            <button type="button" class="btn-empty-action primary" id="btn-retry-load-reports">ลองโหลดข้อมูลใหม่</button>
          </div>
        `;
        reportLedgerTbody.appendChild(emptyBox);
        const retryBtn = emptyBox.querySelector('#btn-retry-load-reports');
        if (retryBtn) retryBtn.addEventListener('click', () => loadReportRequests());
        return;
      }

      if (hasSearchQuery || activeReportFilter !== 'all') {
        emptyBox.innerHTML = `
          <div class="report-empty-icon">🔍</div>
          <h4 class="report-empty-title">ไม่พบรายการคำขอที่ตรงกับเงื่อนไขที่กรอง</h4>
          <p class="report-empty-desc">ลองเปลี่ยนคำค้นหา หรือกดล้างตัวกรองเพื่อดูรายการคำขอข้อมูลทั้งหมด</p>
          <div class="report-empty-actions">
            <button type="button" class="btn-empty-action" id="btn-clear-report-filter">แสดงรายการทั้งหมด</button>
            <button type="button" class="btn-empty-action primary" id="btn-empty-new-report">+ ขอข้อมูล / รายงานใหม่</button>
          </div>
        `;
        reportLedgerTbody.appendChild(emptyBox);
        const clearBtn = emptyBox.querySelector('#btn-clear-report-filter');
        if (clearBtn) {
          clearBtn.addEventListener('click', () => {
            if (reportSearchInput) reportSearchInput.value = '';
            activeReportFilter = 'all';
            resetAllSectionPages();
            document.querySelectorAll('.ledger-filter-btn').forEach(b => {
              b.classList.toggle('active', b.dataset.filter === 'all');
            });
            renderReportLedger();
          });
        }
        const newBtn = emptyBox.querySelector('#btn-empty-new-report');
        if (newBtn) newBtn.addEventListener('click', openReportModal);
        return;
      }

      emptyBox.innerHTML = `
        <div class="report-empty-icon">📋</div>
        <h4 class="report-empty-title">ยังไม่มีรายการคำขอข้อมูลรายงานในระบบ</h4>
        <p class="report-empty-desc">คุณสามารถยื่นคำขอข้อมูลหรือรายงานใหม่เพื่อให้เจ้าหน้าที่ศูนย์คอมพิวเตอร์ดำเนินการจัดทำได้ทันที</p>
        <div class="report-empty-actions">
          <button type="button" class="btn-empty-action primary" id="btn-empty-create-first">+ ขอข้อมูล / รายงานใหม่</button>
        </div>
      `;
      reportLedgerTbody.appendChild(emptyBox);
      const createFirstBtn = emptyBox.querySelector('#btn-empty-create-first');
      if (createFirstBtn) createFirstBtn.addEventListener('click', openReportModal);
      return;
    }

    const isIT = currentUser && (currentUser.role === 'it' || currentUser.role === 'admin');
    const hasSearchQuery = Boolean(reportSearchInput && reportSearchInput.value.trim());

    const pendingItems = filtered.filter(r => normalizeReportStatus(r.status) === 'ยังไม่ดำเนินการ');
    const progressItems = filtered.filter(r => normalizeReportStatus(r.status) === 'กำลังดำเนินการ');
    const completedItems = filtered.filter(r => normalizeReportStatus(r.status) === 'เสร็จ');

    const groupDefs = [
      {
        key: 'pending',
        items: pendingItems,
        cardClass: 'group-pending',
        icon: '!',
        title: 'คำขอใหม่ — ยังไม่ดำเนินการ',
        subtitle: 'รายการคำขอข้อมูลใหม่ที่รอเจ้าหน้าที่ตรวจสอบและรับงาน (เรียงงานด่วนและกำหนดส่งใกล้สุดขึ้นก่อน)',
        collapsible: false,
        expanded: true
      },
      {
        key: 'inprogress',
        items: progressItems,
        cardClass: 'group-inprogress',
        icon: '⏳',
        title: 'กำลังดำเนินการ',
        subtitle: 'รายการที่เจ้าหน้าที่รับงานแล้วและอยู่ระหว่างจัดทำข้อมูลรายงาน',
        collapsible: false,
        expanded: true
      },
      {
        key: 'completed',
        items: completedItems,
        cardClass: 'group-completed',
        icon: '✓',
        title: 'เสร็จ',
        subtitle: 'รายการที่จัดทำข้อมูลเสร็จเรียบร้อยแล้ว (พับเก็บไว้ด้านล่างเพื่อไม่ให้ปะปนกับงานค้าง)',
        collapsible: activeReportFilter === 'all' && !hasSearchQuery,
        expanded: activeReportFilter === 'completed' || hasSearchQuery || isCompletedSectionExpanded
      }
    ];

    groupDefs.forEach(g => {
      if (g.items.length > 0) {
        const sectionEl = buildReportGroupSection(g, g.items, isIT);
        reportLedgerTbody.appendChild(sectionEl);
      }
    });
  }

  function selectReportRequest(id) {
    selectedReportId = id;
    const req = reportRequests.find(r => r.id === id);

    if (!req) {
      closeReportDetailPage();
      return;
    }

    // Switch to Full-Page Detail View
    if (reportsListView) reportsListView.style.display = 'none';
    if (reportDetailView) {
      reportDetailView.style.display = 'block';
      reportDetailView.scrollTop = 0;
    }

    const codeStr = `#REP-${String(req.id).padStart(4, '0')}`;
    const urgMeta = getUrgencyMeta(req.urgency);
    const statusMeta = getStatusMeta(req.status);
    const normStatus = normalizeReportStatus(req.status);
    const isIT = currentUser && (currentUser.role === 'it' || currentUser.role === 'admin');
    const pctVal = Math.max(0, Math.min(100, parseInt(req.percent_complete) || 0));

    inspId.textContent = codeStr;
    inspUrgency.textContent = urgMeta.label;
    inspUrgency.className = 'sheet-urgency-badge ' + urgMeta.cls;

    inspStatusBadge.textContent = statusMeta.label;
    inspStatusBadge.className = 'sheet-status-badge status-pill ' + statusMeta.cls;

    inspTitle.textContent = req.report_title;
    inspCreatedAt.textContent = `ยื่นคำขอเมื่อ: ${formatThaiDateShort(req.created_at)} เวลา ${formatTime(req.created_at)}`;

    if (inspHeroPct) inspHeroPct.textContent = `${pctVal}%`;
    if (inspHeroBar) inspHeroBar.style.width = `${pctVal}%`;

    inspRequesterName.textContent = req.requester_name;
    const inspProxyInfo = document.getElementById('insp-proxy-info');
    if (inspProxyInfo) {
      if (req.submitter_name && req.submitter_name.trim() !== (req.requester_name || '').trim()) {
        inspProxyInfo.style.display = 'inline-block';
        inspProxyInfo.innerHTML = `ยื่นคำขอแทนโดย: <strong>${escapeHtml(req.submitter_name)}</strong>`;
      } else {
        inspProxyInfo.style.display = 'none';
        inspProxyInfo.innerHTML = '';
      }
    }
    inspRequesterPos.textContent = req.requester_position || '-';
    inspDept.textContent = req.department || '-';
    inspPhone.textContent = req.phone || '-';

    const freqStr = req.frequency_other
      ? `${req.frequency} - ${req.frequency_other}`
      : (req.frequency || '-');
    inspFrequency.textContent = freqStr;
    inspDueDate.textContent = formatThaiDateShort(req.due_date);

    // Purposes tags
    inspPurposes.innerHTML = '';
    const purposesArr = parsePurposesList(req.purposes, req.purpose_other);
    if (purposesArr.length === 0) {
      inspPurposes.textContent = '-';
    } else {
      purposesArr.forEach(p => {
        const tag = document.createElement('span');
        tag.className = 'purpose-tag';
        tag.textContent = p;
        inspPurposes.appendChild(tag);
      });
    }

    if (req.urgent_reason && req.urgent_reason.trim()) {
      inspUrgentReasonRow.style.display = 'flex';
      inspUrgentReason.textContent = req.urgent_reason;
    } else {
      inspUrgentReasonRow.style.display = 'none';
    }

    inspDetails.textContent = req.details || '-';
    inspChannel.textContent = (req.delivery_channel && req.delivery_channel.trim())
      ? req.delivery_channel
      : 'ไม่ได้ระบุช่องทางไว้ (สามารถติดต่อสอบถามหรือส่งไฟล์สำรองผ่านปุ่มแชทด้านบน)';

    const cleanOwnerName = req.owner_name ? req.owner_name.replace(/\s*\(IT\)\s*/g, '') : '';

    // Configure Edit button for requester (allowed when status is not 'เสร็จ')
    const btnInspEdit = document.getElementById('btn-insp-edit');
    const isRequesterOwner = Boolean(currentUser && req.user_id === currentUser.id);
    if (btnInspEdit) {
      if (isRequesterOwner && normStatus !== 'เสร็จ') {
        btnInspEdit.style.display = 'inline-flex';
        btnInspEdit.title = req.owner_id
          ? 'แก้ไขรายละเอียดที่ตกหล่น (ระบบจะส่งแชทแจ้งเตือนผู้รับผิดชอบให้อัตโนมัติ)'
          : 'แก้ไขข้อมูลคำขอรายงานนี้';
      } else {
        btnInspEdit.style.display = 'none';
      }
    }

    // Configure Chat & Claim buttons
    if (isIT) {
      btnInspChat.disabled = false;
      btnInspChat.classList.remove('is-locked');
      btnInspChat.title = 'คลิกเพื่อเปิดห้องแชทคุยกับผู้ขอรายงาน';
      btnInspChatLabel.textContent = `แชทคุยกับผู้ขอ: ${req.requester_name}`;
      btnInspChat.style.display = req.user_id !== currentUser.id ? 'inline-flex' : 'none';
      if (!req.owner_id || normStatus === 'ยังไม่ดำเนินการ') {
        btnInspClaim.style.display = 'inline-flex';
      } else {
        btnInspClaim.style.display = 'none';
      }
    } else {
      btnInspClaim.style.display = 'none';
      if (req.owner_id && req.owner_id !== currentUser.id) {
        btnInspChat.disabled = false;
        btnInspChat.classList.remove('is-locked');
        btnInspChat.title = 'คลิกเพื่อเปิดห้องแชทคุยกับเจ้าหน้าที่ผู้รับผิดชอบงานนี้ทันที';
        btnInspChatLabel.textContent = `แชทกับผู้รับผิดชอบ: ${cleanOwnerName}`;
        btnInspChat.style.display = 'inline-flex';
      } else if (req.owner_id === currentUser.id) {
        btnInspChat.style.display = 'none';
      } else {
        btnInspChat.disabled = true;
        btnInspChat.classList.add('is-locked');
        btnInspChat.title = 'เมื่อเจ้าหน้าที่ศูนย์คอมพิวเตอร์กดรับงานแล้ว ปุ่มนี้จะปลดล็อกให้ทักแชทคุยกับผู้รับผิดชอบได้ทันที';
        btnInspChatLabel.textContent = 'รอเจ้าหน้าที่รับงานเพื่อเปิดแชท';
        btnInspChat.style.display = 'inline-flex';
      }
    }

    // Populate IT Console (Editable for IT/Admin, Read-only for Staff)
    const completedMeta = req.completed_date
      ? formatThaiDateTimeParts(req.completed_date, req.updated_at)
      : null;
    const toLocalDateVal = (val) => {
      if (!val) return '';
      const d = new Date(val);
      if (isNaN(d.getTime())) return String(val).slice(0, 10);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    if (isIT) {
      itConsoleReadonly.style.display = 'none';
      itConsoleForm.style.display = 'flex';

      itFieldStatus.value = normStatus;
      itFieldOwner.value = cleanOwnerName || currentUser.full_name;
      itFieldStart.value = req.start_date ? toLocalDateVal(req.start_date) : toLocalDateVal(new Date());
      itFieldCompleted.value = req.completed_date ? toLocalDateVal(req.completed_date) : '';
      const compTimeHint = document.getElementById('it-completed-time-hint');
      if (compTimeHint) {
        if (completedMeta && completedMeta.time) {
          compTimeHint.textContent = `✓ เวลาที่เสร็จ: ${completedMeta.time}`;
          compTimeHint.style.display = 'block';
        } else {
          compTimeHint.style.display = 'none';
        }
      }
      itFieldPctRange.value = pctVal;
      itFieldPct.value = pctVal;
      itPctDisplay.textContent = pctVal;
      itFieldNotes.value = req.it_notes || '';
    } else {
      itConsoleForm.style.display = 'none';
      itConsoleReadonly.style.display = 'block';

      roStatus.textContent = normStatus;
      roOwner.textContent = cleanOwnerName || 'รอเจ้าหน้าที่ศูนย์คอมพิวเตอร์รับงาน';
      roStartDate.textContent = formatThaiDateShort(req.start_date);
      roCompletedDate.textContent = completedMeta ? completedMeta.full : '-';
      roPct.textContent = `${pctVal}%`;
      roNotes.textContent = req.it_notes || '-';
    }
  }

  let editingReportId = null;

  function syncReportFormConditionalFields() {
    const meetingChk = document.getElementById('req-purpose-meeting-chk');
    const showPurposeSub = Boolean((reqPurposeOtherChk && reqPurposeOtherChk.checked) || (meetingChk && meetingChk.checked));
    if (reqPurposeOtherText) {
      reqPurposeOtherText.style.display = showPurposeSub ? 'block' : 'none';
      if (meetingChk && meetingChk.checked && !(reqPurposeOtherChk && reqPurposeOtherChk.checked)) {
        reqPurposeOtherText.placeholder = 'ระบุวันที่ประชุม เช่น 28 ต.ค. 2569...';
      } else {
        reqPurposeOtherText.placeholder = 'ระบุวัตถุประสงค์เพิ่มเติม หรือวันที่ประชุม...';
      }
    }

    if (reqFrequencySelect && reqFrequencyOther) {
      const showFreqSub = reqFrequencySelect.value === 'อื่นๆ';
      reqFrequencyOther.style.display = showFreqSub ? 'block' : 'none';
    }

    const reqUrgentReqMark = document.getElementById('req-urgent-reason-req');
    const reqUrgentHint = document.getElementById('req-urgent-reason-hint');
    if (reqUrgencySelect && reqUrgentReasonInput) {
      const urgVal = reqUrgencySelect.value || '';
      const isUrgentSelected = urgVal.includes('ด่วน');
      reqUrgentReasonInput.required = isUrgentSelected;
      if (reqUrgentReqMark) {
        reqUrgentReqMark.style.display = isUrgentSelected ? 'inline' : 'none';
      }
      if (reqUrgentHint) {
        reqUrgentHint.textContent = isUrgentSelected
          ? 'จำเป็นต้องระบุเหตุผลเมื่อขอข้อมูลแบบด่วน/ด่วนมาก'
          : 'กรอกเมื่อเลือก ด่วน หรือ ด่วนมาก';
      }
    }
  }

  // ============================================
  // PM REQUESTER AUTOCOMPLETE
  // ============================================
  let pmSearchTimer = null;
  let pmSuggestions = [];
  let pmActiveIndex = -1;

  function hidePmSuggestions() {
    if (pmSearchTimer) {
      clearTimeout(pmSearchTimer);
      pmSearchTimer = null;
    }
    if (reqNameSuggestions) {
      reqNameSuggestions.style.display = 'none';
      reqNameSuggestions.innerHTML = '';
    }
    if (reqNameSpinner) {
      reqNameSpinner.style.display = 'none';
    }
    pmActiveIndex = -1;
  }

  function renderPmSuggestions(list) {
    if (!reqNameSuggestions) return;
    pmSuggestions = list || [];
    pmActiveIndex = -1;

    if (pmSuggestions.length === 0) {
      reqNameSuggestions.innerHTML = `
        <div class="autocomplete-empty">
          ไม่พบชื่อในระบบ PM (สามารถพิมพ์ระบุเองได้)
        </div>
      `;
      reqNameSuggestions.style.display = 'block';
      return;
    }

    reqNameSuggestions.innerHTML = pmSuggestions.map((item, idx) => {
      const subInfo = [item.position, item.display_department || item.sub_department || item.department].filter(Boolean).join(' • ');
      return `
        <div class="autocomplete-item" data-index="${idx}">
          <div class="autocomplete-item-name">
            <span>${escapeHtml(item.full_name)}</span>
            ${item.username ? `<span class="autocomplete-badge">${escapeHtml(item.username)}</span>` : ''}
          </div>
          ${subInfo ? `<div class="autocomplete-item-dept">${escapeHtml(subInfo)}</div>` : ''}
        </div>
      `;
    }).join('');

    reqNameSuggestions.querySelectorAll('.autocomplete-item').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(el.getAttribute('data-index'), 10);
        selectPmRequester(pmSuggestions[idx]);
      });
    });

    reqNameSuggestions.style.display = 'block';
  }

  function selectPmRequester(person) {
    if (!person) return;
    if (reqNameInput) reqNameInput.value = person.full_name || '';
    if (reqPositionInput) reqPositionInput.value = person.position || '';
    
    // Fill the specific sub-department / ward (dept_name) directly into the field instead
    const deptToFill = person.sub_department || person.dept_name || person.department || '';
    if (reqDeptInput) reqDeptInput.value = deptToFill;

    // Pulse animation on position & department inputs to indicate successful auto-fill
    [reqPositionInput, reqDeptInput].forEach(inputEl => {
      if (inputEl) {
        inputEl.classList.remove('field-autofilled');
        void inputEl.offsetWidth; // Force CSS reflow to re-trigger keyframe animation
        inputEl.classList.add('field-autofilled');
      }
    });

    hidePmSuggestions();
  }

  function setupPmRequesterAutocomplete() {
    if (!reqNameInput) return;

    reqNameInput.addEventListener('input', () => {
      const q = reqNameInput.value.trim();
      if (pmSearchTimer) clearTimeout(pmSearchTimer);

      if (q.length < 2) {
        hidePmSuggestions();
        return;
      }

      if (reqNameSpinner) reqNameSpinner.style.display = 'block';

      pmSearchTimer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/staff/pm-search?q=${encodeURIComponent(q)}`);
          const data = await res.json();
          if (reqNameSpinner) reqNameSpinner.style.display = 'none';
          if (reqNameInput && reqNameInput.value.trim() === q) {
            renderPmSuggestions(data.results || []);
          }
        } catch (err) {
          if (reqNameSpinner) reqNameSpinner.style.display = 'none';
          console.error('PM search fetch error:', err);
        }
      }, 250);
    });

    reqNameInput.addEventListener('keydown', (e) => {
      if (!reqNameSuggestions || reqNameSuggestions.style.display === 'none') return;
      const items = reqNameSuggestions.querySelectorAll('.autocomplete-item');
      if (items.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        pmActiveIndex = (pmActiveIndex + 1) % items.length;
        updateActiveSuggestion(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        pmActiveIndex = (pmActiveIndex - 1 + items.length) % items.length;
        updateActiveSuggestion(items);
      } else if (e.key === 'Enter') {
        if (pmActiveIndex >= 0 && pmActiveIndex < pmSuggestions.length) {
          e.preventDefault();
          selectPmRequester(pmSuggestions[pmActiveIndex]);
        }
      } else if (e.key === 'Escape') {
        hidePmSuggestions();
      }
    });

    function updateActiveSuggestion(items) {
      items.forEach((it, idx) => {
        if (idx === pmActiveIndex) {
          it.classList.add('active');
          it.scrollIntoView({ block: 'nearest' });
        } else {
          it.classList.remove('active');
        }
      });
    }

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (reqNameSuggestions && reqNameSuggestions.style.display !== 'none') {
        if (!reqNameSuggestions.contains(e.target) && e.target !== reqNameInput) {
          hidePmSuggestions();
        }
      }
    });

    // "Use My Info" Button
    if (btnUseMyInfo) {
      btnUseMyInfo.addEventListener('click', () => {
        if (!currentUser) return;
        reqNameInput.value = currentUser.full_name || '';
        if (reqPositionInput) reqPositionInput.value = currentUser.position || '';
        if (reqDeptInput) reqDeptInput.value = currentUser.dept_name || currentUser.sub_department || currentUser.department || '';

        [reqNameInput, reqPositionInput, reqDeptInput].forEach(el => {
          if (el) {
            el.classList.remove('field-autofilled');
            void el.offsetWidth;
            el.classList.add('field-autofilled');
          }
        });
        hidePmSuggestions();
      });
    }
  }

  function openReportModal() {
    if (!modalReportRequest) return;
    editingReportId = null;
    hidePmSuggestions();
    const modalTitleText = document.getElementById('modal-report-title-text');
    const submitLabel = document.getElementById('btn-submit-report-label');
    if (modalTitleText) modalTitleText.textContent = 'แบบฟอร์มขอข้อมูล / ขอรายงาน (ศูนย์คอมพิวเตอร์)';
    if (submitLabel) submitLabel.textContent = 'ส่งคำขอข้อมูลรายงาน';

    if (currentUser) {
      reqNameInput.value = currentUser.full_name || '';
      reqDeptInput.value = currentUser.dept_name || currentUser.sub_department || currentUser.department || '';
      if (reqPositionInput) reqPositionInput.value = currentUser.position || '';
    }
    reqTitleInput.value = '';
    reqDetailsInput.value = '';
    reqUrgentReasonInput.value = '';
    reqPurposeOtherText.value = '';
    reqFrequencyOther.value = '';
    if (reqChannelInput) reqChannelInput.value = '';
    document.querySelectorAll('input[name="req_purpose"]').forEach(chk => { chk.checked = false; });
    if (reqFrequencySelect) reqFrequencySelect.value = 'ใช้ครั้งเดียว';
    if (reqUrgencySelect) reqUrgencySelect.value = 'ปกติ ภายใน 10 วัน';
    document.querySelectorAll('#req-channel-chips .channel-chip').forEach(c => c.classList.remove('active'));

    // Default due date = +10 days
    const defaultDue = new Date();
    defaultDue.setDate(defaultDue.getDate() + 10);
    reqDueDateInput.value = defaultDue.toISOString().slice(0, 10);

    syncReportFormConditionalFields();

    modalReportRequest.style.display = 'flex';
    reqTitleInput.focus();
  }

  function openEditReportModal(req) {
    if (!modalReportRequest || !req) return;
    editingReportId = req.id;
    hidePmSuggestions();

    const codeStr = `#REP-${String(req.id).padStart(4, '0')}`;
    const modalTitleText = document.getElementById('modal-report-title-text');
    const submitLabel = document.getElementById('btn-submit-report-label');
    if (modalTitleText) modalTitleText.textContent = `แก้ไขคำขอข้อมูลรายงาน (${codeStr})`;
    if (submitLabel) submitLabel.textContent = 'บันทึกการแก้ไขคำขอ';

    reqNameInput.value = req.requester_name || '';
    reqPositionInput.value = req.requester_position || '';
    reqTitleInput.value = req.report_title || '';
    reqDeptInput.value = req.department || '';
    reqPhoneInput.value = req.phone || '';
    reqDetailsInput.value = req.details || '';
    if (reqChannelInput) reqChannelInput.value = req.delivery_channel || '';
    reqPurposeOtherText.value = req.purpose_other || '';
    reqFrequencyOther.value = req.frequency_other || '';
    reqUrgentReasonInput.value = req.urgent_reason || '';

    // Restore purposes checkboxes
    let rawPurposes = [];
    if (Array.isArray(req.purposes)) {
      rawPurposes = req.purposes;
    } else if (typeof req.purposes === 'string' && req.purposes.trim()) {
      try {
        const parsed = JSON.parse(req.purposes);
        if (Array.isArray(parsed)) rawPurposes = parsed;
      } catch (_) {
        rawPurposes = [req.purposes];
      }
    }
    document.querySelectorAll('input[name="req_purpose"]').forEach(chk => {
      chk.checked = rawPurposes.includes(chk.value);
    });

    if (reqFrequencySelect) reqFrequencySelect.value = req.frequency || 'ใช้ครั้งเดียว';
    if (reqUrgencySelect) reqUrgencySelect.value = req.urgency || 'ปกติ ภายใน 10 วัน';
    if (reqDueDateInput) {
      reqDueDateInput.value = req.due_date ? String(req.due_date).slice(0, 10) : '';
    }

    document.querySelectorAll('#req-channel-chips .channel-chip').forEach(c => c.classList.remove('active'));
    syncReportFormConditionalFields();

    modalReportRequest.style.display = 'flex';
    reqTitleInput.focus();
  }

  function closeReportModal() {
    editingReportId = null;
    hidePmSuggestions();
    if (modalReportRequest) modalReportRequest.style.display = 'none';
  }

  async function handleCreateReportRequest(e) {
    e.preventDefault();

    const urgVal = reqUrgencySelect ? reqUrgencySelect.value : '';
    if (urgVal.includes('ด่วน') && !reqUrgentReasonInput.value.trim()) {
      showToast('⚠️ กรุณาระบุเหตุผลในการขอด่วน');
      reqUrgentReasonInput.focus();
      return;
    }

    const isEditing = Boolean(editingReportId);
    const targetEditId = editingReportId;

    const submitBtn = document.getElementById('btn-submit-report');
    const submitLabel = document.getElementById('btn-submit-report-label');
    if (submitBtn) submitBtn.disabled = true;
    if (submitLabel) submitLabel.textContent = isEditing ? 'กำลังบันทึกการแก้ไข...' : 'กำลังส่งคำขอ...';

    const checkedPurposes = Array.from(document.querySelectorAll('input[name="req_purpose"]:checked')).map(el => el.value);

    const payload = {
      requester_name: reqNameInput.value.trim(),
      requester_position: reqPositionInput.value.trim(),
      report_title: reqTitleInput.value.trim(),
      department: reqDeptInput.value.trim(),
      phone: reqPhoneInput.value.trim(),
      purposes: checkedPurposes,
      purpose_other: reqPurposeOtherText.value.trim(),
      frequency: reqFrequencySelect.value,
      frequency_other: reqFrequencyOther.value.trim(),
      details: reqDetailsInput.value.trim(),
      delivery_channel: reqChannelInput.value.trim(),
      due_date: reqDueDateInput.value || null,
      urgency: reqUrgencySelect.value,
      urgent_reason: reqUrgentReasonInput.value.trim()
    };

    try {
      const url = isEditing
        ? `/api/report-requests/${targetEditId}/requester-edit`
        : '/api/report-requests';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success && data.request) {
        if (isEditing) {
          showToast(
            data.notified_owner
              ? '✅ บันทึกการแก้ไขคำขอ และส่งแชทแจ้งเตือนผู้รับผิดชอบเรียบร้อยแล้ว'
              : '✅ บันทึกการแก้ไขคำขอข้อมูลเรียบร้อยแล้ว'
          );
          const idx = reportRequests.findIndex(r => r.id === data.request.id);
          if (idx !== -1) reportRequests[idx] = data.request;
          if (data.notified_owner) {
            await loadConversations();
          }
        } else {
          showToast('✅ ส่งคำขอข้อมูลรายงานเรียบร้อยแล้ว');
          const exists = reportRequests.some(r => r.id === data.request.id);
          if (!exists) reportRequests.unshift(data.request);
        }
        closeReportModal();
        renderReportLedger();
        selectReportRequest(data.request.id);
      } else {
        showToast(data.error || 'ไม่สามารถบันทึกคำขอได้');
      }
    } catch (err) {
      showToast('เกิดข้อผิดพลาดในการบันทึกคำขอข้อมูล');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
      if (submitLabel) submitLabel.textContent = isEditing ? 'บันทึกการแก้ไขคำขอ' : 'ส่งคำขอข้อมูลรายงาน';
    }
  }

  async function handleClaimReportRequest() {
    if (!selectedReportId) return;
    if (btnInspClaim) {
      if (btnInspClaim.disabled) return;
      btnInspClaim.disabled = true;
      btnInspClaim.textContent = 'กำลังรับงาน...';
    }
    try {
      const res = await fetch(`/api/report-requests/${selectedReportId}/claim`, { method: 'POST' });
      const data = await res.json();
      if (data.success && data.request) {
        showToast('✅ รับงานขอรายงานเรียบร้อย! ระบบสร้างข้อความแจ้งผู้ขอในแชทแล้ว');
        const idx = reportRequests.findIndex(r => r.id === data.request.id);
        if (idx !== -1) reportRequests[idx] = data.request;
        renderReportLedger();
        selectReportRequest(data.request.id);
        await loadConversations();
      } else {
        showToast(data.error || 'ไม่สามารถรับงานได้');
      }
    } catch (err) {
      showToast('เกิดข้อผิดพลาดในการรับงาน');
    } finally {
      if (btnInspClaim) {
        btnInspClaim.disabled = false;
        btnInspClaim.textContent = 'รับงานนี้ & เปิดแชท';
      }
    }
  }

  async function saveITConsoleUpdate(forceComplete = false) {
    if (!selectedReportId) return;

    const activeBtn = forceComplete ? btnCompleteItJob : btnSaveItLog;
    const origText = activeBtn ? activeBtn.textContent : '';
    if (activeBtn) {
      if (activeBtn.disabled) return;
      activeBtn.disabled = true;
      activeBtn.textContent = 'กำลังบันทึก...';
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const statusVal = forceComplete ? 'เสร็จ' : itFieldStatus.value;
    const pctVal = forceComplete ? 100 : (parseInt(itFieldPct.value) || 0);
    const compDateVal = forceComplete ? (itFieldCompleted.value || todayStr) : (itFieldCompleted.value || null);

    const payload = {
      status: statusVal,
      owner_name: itFieldOwner.value.trim() || currentUser.full_name,
      start_date: itFieldStart.value || todayStr,
      completed_date: compDateVal,
      percent_complete: pctVal,
      it_notes: itFieldNotes.value.trim()
    };

    try {
      const res = await fetch(`/api/report-requests/${selectedReportId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success && data.request) {
        showToast(forceComplete ? '✅ บันทึกสถานะ เสร็จ 100% เรียบร้อยแล้ว!' : '✅ บันทึกสถานะงานเรียบร้อยแล้ว');
        const idx = reportRequests.findIndex(r => r.id === data.request.id);
        if (idx !== -1) reportRequests[idx] = data.request;
        renderReportLedger();
        selectReportRequest(data.request.id);
      } else {
        showToast(data.error || 'ไม่สามารถบันทึกสถานะได้');
      }
    } catch (err) {
      showToast('เกิดข้อผิดพลาดในการบันทึก Log');
    } finally {
      if (activeBtn) {
        activeBtn.disabled = false;
        activeBtn.textContent = origText;
      }
    }
  }

  function showChatReportContextBanner(req) {
    const banner = document.getElementById('chat-report-context-banner');
    if (!banner || !req) return;
    const codeStr = `#REP-${String(req.id).padStart(4, '0')}`;
    const ctxId = document.getElementById('chat-ctx-id');
    const ctxTitle = document.getElementById('chat-ctx-title');
    const ctxSub = document.getElementById('chat-ctx-sub');
    if (ctxId) ctxId.textContent = codeStr;
    if (ctxTitle) ctxTitle.textContent = req.report_title || '-';
    if (ctxSub) {
      const chText = (req.delivery_channel && req.delivery_channel.trim())
        ? req.delivery_channel
        : 'ไม่ได้ระบุช่องทางไว้ (ใช้แชทนี้เป็นช่องทางสำรอง)';
      ctxSub.textContent = `ช่องทางรับข้อมูล: ${chText} • กำหนดส่ง ${formatThaiDateShort(req.due_date)}`;
    }
    banner.dataset.reportId = String(req.id);
    banner.style.display = 'flex';
  }

  async function openContextualChatForSelectedReport() {
    const req = reportRequests.find(r => r.id === selectedReportId);
    if (!req) return;

    const isIT = currentUser && (currentUser.role === 'it' || currentUser.role === 'admin');
    const targetUserId = isIT ? req.user_id : req.owner_id;

    if (!targetUserId || targetUserId === currentUser.id) {
      showToast('⏳ กรุณารอเจ้าหน้าที่ศูนย์คอมพิวเตอร์กดรับงานก่อน จึงจะสามารถแชทกับผู้รับผิดชอบได้ครับ');
      return;
    }

    try {
      const res = await fetch('/api/conversations/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otherUserId: targetUserId })
      });
      const data = await res.json();
      if (data.conversation_id) {
        switchWorkspace('chat');
        switchTab('chats');
        await loadConversations();
        const conv = conversations.find(c => c.conversation_id === data.conversation_id);
        if (conv) {
          selectChat(conv);
          showChatReportContextBanner(req);
        }
      }
    } catch (err) {
      showToast('ไม่สามารถเปิดห้องแชทได้');
    }
  }

  function setupReportRequestListeners() {
    if (navWorkspaceReports) {
      navWorkspaceReports.addEventListener('click', () => switchWorkspace('reports'));
    }
    if (navWorkspaceChat) {
      navWorkspaceChat.addEventListener('click', () => switchWorkspace('chat'));
    }
    if (btnBackToReports) {
      btnBackToReports.addEventListener('click', () => switchWorkspace('reports'));
    }
    if (btnBackToList) {
      btnBackToList.addEventListener('click', closeReportDetailPage);
    }

    const btnToggleUsage = document.getElementById('btn-toggle-usage-steps');
    const usageStepsList = document.getElementById('portal-usage-steps');
    const toggleUsageLabel = document.getElementById('toggle-usage-label');
    if (btnToggleUsage && usageStepsList) {
      // Restore saved preference from localStorage
      try {
        if (localStorage.getItem('brh_usage_banner_collapsed') === '1') {
          usageStepsList.classList.add('collapsed');
          if (toggleUsageLabel) toggleUsageLabel.textContent = 'แสดงวิธีใช้งาน';
        }
      } catch (_) {}

      btnToggleUsage.addEventListener('click', () => {
        const isCollapsed = usageStepsList.classList.toggle('collapsed');
        if (toggleUsageLabel) {
          toggleUsageLabel.textContent = isCollapsed ? 'แสดงวิธีใช้งาน' : 'ซ่อนวิธีใช้งาน';
        }
        try {
          localStorage.setItem('brh_usage_banner_collapsed', isCollapsed ? '1' : '0');
        } catch (_) {}
      });
    }

    // Chat Report Context Banner actions
    const ctxBanner = document.getElementById('chat-report-context-banner');
    const btnCtxInsertRef = document.getElementById('btn-chat-ctx-insert-ref');
    const btnCtxViewSheet = document.getElementById('btn-chat-ctx-view-sheet');
    const btnCtxClose = document.getElementById('btn-chat-ctx-close');

    if (btnCtxInsertRef) {
      btnCtxInsertRef.addEventListener('click', () => {
        const repId = ctxBanner ? parseInt(ctxBanner.dataset.reportId, 10) : selectedReportId;
        const req = reportRequests.find(r => r.id === repId);
        if (req && messageInput) {
          const refPrefix = `[#REP-${String(req.id).padStart(4, '0')} ${req.report_title}] `;
          if (!messageInput.value.includes(`#REP-${String(req.id).padStart(4, '0')}`)) {
            messageInput.value = refPrefix + messageInput.value;
          }
          messageInput.focus();
        }
      });
    }

    if (btnCtxViewSheet) {
      btnCtxViewSheet.addEventListener('click', () => {
        const repId = ctxBanner ? parseInt(ctxBanner.dataset.reportId, 10) : selectedReportId;
        switchWorkspace('reports');
        if (repId) selectReportRequest(repId);
      });
    }

    if (btnCtxClose && ctxBanner) {
      btnCtxClose.addEventListener('click', () => {
        ctxBanner.style.display = 'none';
      });
    }

    // Progressive Disclosure & Channel Chips inside Report Request Form
    const meetingChk = document.getElementById('req-purpose-meeting-chk');
    if (reqPurposeOtherChk) {
      reqPurposeOtherChk.addEventListener('change', () => {
        syncReportFormConditionalFields();
        if (reqPurposeOtherChk.checked && reqPurposeOtherText) reqPurposeOtherText.focus();
      });
    }
    if (meetingChk) {
      meetingChk.addEventListener('change', () => {
        syncReportFormConditionalFields();
        if (meetingChk.checked && reqPurposeOtherText) reqPurposeOtherText.focus();
      });
    }
    if (reqFrequencySelect) {
      reqFrequencySelect.addEventListener('change', () => {
        syncReportFormConditionalFields();
        if (reqFrequencySelect.value === 'อื่นๆ' && reqFrequencyOther) reqFrequencyOther.focus();
      });
    }

    document.querySelectorAll('#req-channel-chips .channel-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#req-channel-chips .channel-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        if (!reqChannelInput) return;
        const exactVal = chip.dataset.channelValue;
        const prefixVal = chip.dataset.channelPrefix;
        const placeholderVal = chip.dataset.placeholder;
        if (placeholderVal) reqChannelInput.placeholder = placeholderVal;
        if (exactVal) {
          reqChannelInput.value = exactVal;
        } else if (prefixVal) {
          if (!reqChannelInput.value.startsWith(prefixVal)) {
            reqChannelInput.value = prefixVal;
          }
          reqChannelInput.focus();
        }
      });
    });

    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeReportFilter = btn.dataset.filter || 'all';
        resetSectionPaginationPages();
        renderReportLedger();
      });
    });

    if (reportSearchInput) {
      reportSearchInput.addEventListener('input', () => {
        resetSectionPaginationPages();
        renderReportLedger();
      });
    }

    if (btnOpenReportModal) {
      btnOpenReportModal.addEventListener('click', openReportModal);
    }
    if (btnEmptyNewReport) {
      btnEmptyNewReport.addEventListener('click', openReportModal);
    }
    if (modalCloseReport) {
      modalCloseReport.addEventListener('click', closeReportModal);
    }
    if (btnCancelReport) {
      btnCancelReport.addEventListener('click', closeReportModal);
    }
    if (formReportRequest) {
      formReportRequest.addEventListener('submit', handleCreateReportRequest);
    }

    setupPmRequesterAutocomplete();

    if (reqUrgencySelect && reqDueDateInput) {
      reqUrgencySelect.addEventListener('change', () => {
        const val = reqUrgencySelect.value;
        let addDays = 10;
        if (val.includes('3 วัน') || val.includes('ด่วนมาก')) addDays = 3;
        else if (val.includes('5 วัน') || val.includes('ด่วน')) addDays = 5;
        const d = new Date();
        d.setDate(d.getDate() + addDays);
        reqDueDateInput.value = d.toISOString().slice(0, 10);
        syncReportFormConditionalFields();
        if (addDays < 10 && reqUrgentReasonInput) {
          reqUrgentReasonInput.focus();
        }
      });
    }

    // Global Escape key handler for Report Modal & Detail View
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (modalReportRequest && modalReportRequest.style.display === 'flex') {
          closeReportModal();
        } else if (reportDetailView && reportDetailView.style.display === 'block') {
          closeReportDetailPage();
        }
      }
    });

    const btnInspEdit = document.getElementById('btn-insp-edit');
    if (btnInspEdit) {
      btnInspEdit.addEventListener('click', () => {
        const req = reportRequests.find(r => r.id === selectedReportId);
        if (req) openEditReportModal(req);
      });
    }
    if (btnInspClaim) {
      btnInspClaim.addEventListener('click', handleClaimReportRequest);
    }
    if (btnInspChat) {
      btnInspChat.addEventListener('click', openContextualChatForSelectedReport);
    }

    if (itFieldPctRange && itFieldPct) {
      itFieldPctRange.addEventListener('input', () => {
        itFieldPct.value = itFieldPctRange.value;
        itPctDisplay.textContent = itFieldPctRange.value;
      });
      itFieldPct.addEventListener('input', () => {
        const v = Math.max(0, Math.min(100, parseInt(itFieldPct.value) || 0));
        itFieldPctRange.value = v;
        itPctDisplay.textContent = v;
      });
    }

    if (itConsoleForm) {
      itConsoleForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveITConsoleUpdate(false);
      });
    }

    if (btnCompleteItJob) {
      btnCompleteItJob.addEventListener('click', () => {
        saveITConsoleUpdate(true);
      });
    }
  }

  // ============================================
  // START
  // ============================================
  init();

})();
