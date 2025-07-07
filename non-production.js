/**
 * NeoChat SDK v1.0.0
 * This script adds a chatbot widget to your website.
 * Auto-generated for Project: 6834174c6868d0b9c7709b19
 *
 * CROSS-ORIGIN INTEGRATION SUPPORT:
 * This SDK is designed to work from any website or origin.
 * The server has CORS configured to accept requests from all domains.
 *
 * FLOW BUILDER SUPPORT:
 * This SDK includes enhanced support for Flow Builder features:
 * - Intermediate messages during multi-step processes
 * - Input collection with validation
 * - Real-time typing indicators
 * - Custom event callbacks for advanced integrations
 *
 * If you encounter CORS issues:
 * 1. Test CORS connectivity: https://api.neochat.io/api/chatbot/sdk/cors-test
 * 2. Ensure the API_BASE_URL is correctly configured
 * 3. For local testing, serve files from a web server instead of using file:// URLs
 */

(function() {
  // Create a namespace for our SDK
  window.NeoChat = window.NeoChat || {};
  
  // Configuration values
  const config = {
    apiBaseUrl: 'https://api.neochat.io' || window.location.origin,
    chatbotName: 'Mika',
    initialMessage: 'Apa kabar. Ada yang saya bisa bantu?',
    rateLimitMessage: 'Message rate limit exceeded. Please wait before sending more messages.',
    theme: {
      primaryColor: '#3b82f6',
      secondaryColor: '#F3F4F6',
      backgroundColor: '#FFFFFF',
      textColor: '#1F2937',
      borderColor: '#E5E7EB',
      buttonColor: '#3B82F6',
      buttonTextColor: '#FFFFFF',
      fontFamily: 'Inter, sans-serif',
      fontSize: '14px'
    },
    customCss: ``
  };
  
  // User data
  let userData = {
    id: null,
    name: null,
    email: null,
    metadata: {}
  };
  
  // Session data
  let sessionData = {
    sessionId: null,
    messages: [],
    hasCustomGreeting: false
  };
  
  // Widget DOM elements
  let widgetContainer = null;
  let widgetButton = null;
  let chatContainer = null;
  let chatMessages = null;
  let messageInput = null;
  let typingIndicator = null;
  
  // Widget state
  let isWidgetOpen = false;
  let isInitialized = false;
  let isSessionInitialized = false;
  let userInitOptions = {};
  let typingTimeout = null;
  let initTimeout = null;
  let originalHeight = 500; // Store original height
  let isKeyboardOpen = false;
  let isEmbeddedMode = false; // New: track if in embedded mode
  // Flow Builder specific state
  let isWaitingForInput = false;
  let currentInputStep = null;
  let lastCollectInputMessage = null;
  
  // Add keyboard event listeners
  function setupKeyboardHandling() {
    // Handle visual viewport changes (modern browsers)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportResize);
      window.visualViewport.addEventListener('scroll', handleViewportScroll);
    }

    // Fallback for older browsers and iOS
    window.addEventListener('resize', handleWindowResize);
    
    // Add focus/blur events for input field
    messageInput.addEventListener('focus', () => {
      if (isMobileDevice()) {
        // Force a small delay to ensure keyboard is fully open
        setTimeout(() => {
          const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
          const windowHeight = window.innerHeight;
          
          // Check if keyboard is likely open
          if (viewportHeight < windowHeight * 0.8) {
            handleKeyboardOpen();
            
            // Force input into view on iOS with multiple attempts
            setTimeout(() => {
              messageInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
              
              // Second attempt after a delay
              setTimeout(() => {
                messageInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // Final attempt with requestAnimationFrame
                requestAnimationFrame(() => {
                  messageInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                });
              }, 200);
            }, 100);
          }
        }, 100);
      }
    });
    
    messageInput.addEventListener('blur', () => {
      if (isMobileDevice()) {
        // Add delay to ensure keyboard is fully closed
        setTimeout(() => {
          handleKeyboardClose();
        }, 100);
      }
    });

    // Additional Safari-specific handling
    if (/^((?!chrome|android).)*safari/i.test(navigator.userAgent)) {
      // Handle orientation change
      window.addEventListener('orientationchange', () => {
        setTimeout(() => {
          if (isKeyboardOpen) {
            handleKeyboardOpen();
          } else {
            handleKeyboardClose();
          }
        }, 300);
      });

      // Handle scroll events
      window.addEventListener('scroll', () => {
        if (isKeyboardOpen) {
          requestAnimationFrame(() => {
            messageInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
          });
        }
      });

      // Add viewport height monitoring
      let lastViewportHeight = window.innerHeight;
      setInterval(() => {
        const currentViewportHeight = window.innerHeight;
        if (Math.abs(currentViewportHeight - lastViewportHeight) > 50) {
          lastViewportHeight = currentViewportHeight;
          if (isWidgetOpen) {
            handleViewportResize();
          }
        }
      }, 100);
    }
  }

  function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
      || window.innerWidth <= 768;
  }

  function handleKeyboardOpen() {
    if (!chatContainer || !isWidgetOpen) return;
    
    console.log('[NeoChat] Handling keyboard open');
    
    isKeyboardOpen = true;
    chatContainer.classList.add('keyboard-open');
    
    // Get viewport dimensions
    const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const windowHeight = window.innerHeight;
    
    // Calculate safe height (viewport height minus padding)
    const safePadding = 20;
    const safeHeight = viewportHeight - safePadding;
    
    console.log('[NeoChat] Viewport height:', viewportHeight);
    console.log('[NeoChat] Window height:', windowHeight);
    console.log('[NeoChat] Safe height:', safeHeight);
    
    // Apply styles with !important for Safari
    Object.assign(chatContainer.style, {
      position: 'fixed',
      top: '10px',
      bottom: 'auto',
      height: `${safeHeight}px`,
      maxHeight: `${safeHeight}px`,
      transform: 'translateZ(0)',
      zIndex: '999999',
      width: 'calc(100vw - 40px)',
      maxWidth: `${userInitOptions.width}px`
    });
    
    // Hide widget button
    widgetButton.style.display = 'none';
    
    // Force scroll to bottom after a delay
    setTimeout(scrollToBottom, 300);
  }

  function handleKeyboardClose() {
    if (!chatContainer || !isWidgetOpen) return;
    
    console.log('[NeoChat] Handling keyboard close');
    
    isKeyboardOpen = false;
    chatContainer.classList.remove('keyboard-open');
    
    // Reset styles
    Object.assign(chatContainer.style, {
      position: 'absolute',
      top: 'auto',
      bottom: '80px',
      height: `${originalHeight}px`,
      maxHeight: 'none',
      transform: 'none',
      zIndex: '9999',
      width: `${userInitOptions.width}px`
    });
    
    // Show widget button
    widgetButton.style.display = 'flex';
    
    // Force scroll to bottom after a delay
    setTimeout(scrollToBottom, 300);
  }

  function handleViewportResize() {
    if (!chatContainer || !isWidgetOpen) return;
    
    const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const windowHeight = window.innerHeight;
    
    // If viewport height is significantly less than window height, keyboard is likely open
    if (viewportHeight < windowHeight * 0.8) {
      handleKeyboardOpen();
    } else {
      handleKeyboardClose();
    }
  }

  function handleViewportScroll() {
    if (!chatContainer || !isWidgetOpen || !isKeyboardOpen) return;
    
    // Keep the chat container fixed at the top when keyboard is open
    chatContainer.style.position = 'fixed';
    chatContainer.style.top = '10px';
    
    // Force scroll to bottom
    setTimeout(scrollToBottom, 100);
  }

  function handleWindowResize() {
    if (!chatContainer || !isWidgetOpen) return;
    
    // Only handle if visualViewport is not available
    if (!window.visualViewport) {
      const windowHeight = window.innerHeight;
      const windowWidth = window.innerWidth;
      
      // If on mobile and window height is significantly reduced
      if (isMobileDevice() && windowHeight < window.screen.height * 0.8) {
        handleKeyboardOpen();
      } else {
        handleKeyboardClose();
      }
    }
  }
  
  /**
   * Initialize the chatbot widget
   * @param {Object} options - Initialization options
   */
  NeoChat.init = function(options) {
    if (isInitialized) {
      console.warn('NeoChat is already initialized');
      return;
    }
    
    // Merge options with defaults
    userInitOptions = Object.assign({
      projectId: null,
      container: 'body',
      position: 'bottom-right',
      theme: 'light',
      height: 500,
      width: 350,
      mode: 'widget', // 'widget' or 'embedded'
      user: null, // Allow user data to be passed directly in init
      initDelay: 500, // Small delay to allow for setUser to be called right after init
      // Flow Builder callbacks
      onIntermediateMessage: null, // Callback function for intermediate messages
      onCollectInput: null, // Callback when Flow Builder requests user input
      onTyping: null, // Callback for typing indicators
      onInputReceived: null, // Callback when user provides input for Flow Builder
      onMessage: null, // Callback for all messages
      onOpen: null, // Callback when widget opens
      onClose: null // Callback when widget closes
    }, options);

    //Project ID Validation
    if (!userInitOptions.projectId) {
      console.error('NeoChat: projectId is required in init options');
      return;
    }
    
    // Set embedded mode flag
    isEmbeddedMode = userInitOptions.mode === 'embedded';

    // Store original height
    originalHeight = userInitOptions.height;
    
    // If user data is provided in init options, set it immediately
    if (userInitOptions.user) {
      NeoChat.setUser(userInitOptions.user);
    }
    
    // Create the widget
    createWidget();
    
    // Setup keyboard handling
    setupKeyboardHandling();
    
    // Setup event listeners for intermediate messages and typing indicators
    setupEventListeners();
    
    isInitialized = true;
    console.log('NeoChat SDK initialized with project ID:', userInitOptions.projectId);
    
    // Wait a short time before initializing the session, allowing for setUser to be called
    initTimeout = setTimeout(() => {
      if (!isSessionInitialized) {
        console.log('Initializing chat session after delay');
        initChatSession();
      }
    }, userInitOptions.initDelay);
  };
  
  /**
   * Check if the Flow Builder is currently waiting for user input
   * @returns {boolean} True if waiting for input, false otherwise
   */
  NeoChat.isWaitingForInput = function() {
    return isWaitingForInput;
  };
  
  /**
   * Get current input step information (if any)
   * @returns {Object|null} Current input step information or null
   */
  NeoChat.getCurrentInputStep = function() {
    return currentInputStep;
  };
  
  /**
   * Get the current Flow Builder state
   * @returns {Object} Object containing Flow Builder state information
   */
  NeoChat.getFlowBuilderState = function() {
    return {
      isWaitingForInput: isWaitingForInput,
      currentInputStep: currentInputStep,
      lastCollectInputMessage: lastCollectInputMessage
    };
  };
  
  /**
   * Programmatically send a message (useful for embedded mode)
   * @param {string} message - The message to send
   */
  NeoChat.sendMessage = function(message) {
    if (!isInitialized) {
      console.warn('NeoChat is not initialized yet');
      return;
    }
    
    if (!message || typeof message !== 'string' || !message.trim()) {
      console.warn('Message must be a non-empty string');
      return;
    }
    
    sendMessage(message.trim());
  };
  
  /**
   * Check if the widget is currently open (always true in embedded mode)
   * @returns {boolean} True if widget is open
   */
  NeoChat.isOpen = function() {
    return isWidgetOpen;
  };
  
  /**
   * Open the widget (no effect in embedded mode)
   */
  NeoChat.open = function() {
    if (isEmbeddedMode) {
      return; // Always open in embedded mode
    }
    
    if (!isWidgetOpen) {
      toggleWidget();
    }
  };
  
  /**
   * Close the widget (no effect in embedded mode)
   */
  NeoChat.close = function() {
    if (isEmbeddedMode) {
      return; // Cannot close in embedded mode
    }
    
    if (isWidgetOpen) {
      toggleWidget();
    }
  };
  
  /**
   * Set user information
   * @param {Object} user - User information
   */
  NeoChat.setUser = function(user) {
    userData = Object.assign({}, userData, user);
    console.log('User information set:', userData);
    
    // If we haven't initialized the session yet, do it now
    if (isInitialized && !isSessionInitialized) {
      // Clear any pending initialization timeout
      if (initTimeout) {
        clearTimeout(initTimeout);
        initTimeout = null;
      }
      console.log('Initializing chat session after setUser');
      initChatSession();
    }
    // If we already have a session and there's a new name set,
    // we can update the greeting to personalize it
    else if (isSessionInitialized && userData.name && !sessionData.hasCustomGreeting) {
      customizeGreeting();
    }
  };
  
  /**
   * Create a personalized greeting based on user's name
   */
  function customizeGreeting() {
    if (!userData.name) return;
    
    // Don't add another greeting if we already have messages with a greeting
    if (sessionData.messages.length > 0 && sessionData.hasCustomGreeting) return;
    
    let greeting = config.initialMessage || 'Hi there! How can I help you today?';
    
    // Check if any existing messages contain the initial greeting
    let hasInitialGreeting = false;
    for (const msg of sessionData.messages) {
      if (msg.role === 'assistant' && msg.content.includes(greeting)) {
        hasInitialGreeting = true;
        break;
      }
    }
    
    // If we already have the initial greeting in messages, but without the name,
    // we should remove that message before adding the personalized one
    if (hasInitialGreeting && sessionData.messages.length > 0) {
      // Find and remove the initial greeting message from the UI
      const messages = chatMessages.querySelectorAll('.neochat-bot-message');
      for (const msg of messages) {
        if (msg.textContent.includes(greeting)) {
          msg.remove();
          break;
        }
      }
      
      // Also remove it from the sessionData
      sessionData.messages = sessionData.messages.filter(msg => 
        !(msg.role === 'assistant' && msg.content.includes(greeting))
      );
    }
    
    // Create personalized greeting
    if (!greeting.includes(userData.name)) {
      if (greeting.startsWith('Hi') || greeting.startsWith('Hello')) {
        greeting = greeting.replace(/^(Hi|Hello)/, `$1 ${userData.name},`);
      } else {
        greeting = `Hi ${userData.name}! ${greeting}`;
      }
      
      // Add a customized greeting message
      addMessageToChat(greeting, 'assistant');
      sessionData.hasCustomGreeting = true;
    }
  }
  
  /**
   * Create the widget DOM elements
   */
  function createWidget() {
    if (isEmbeddedMode) {
      return createEmbeddedWidget();
    }
    
    // Create container
    widgetContainer = document.createElement('div');
    widgetContainer.className = 'neochat-widget-container';
    
    // Create toggle button
    widgetButton = document.createElement('div');
    widgetButton.className = 'neochat-widget-button';
    widgetButton.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
    widgetButton.addEventListener('click', toggleWidget);
    
    // Create chat container
    chatContainer = document.createElement('div');
    chatContainer.className = 'neochat-chat-container';
    
    // Create chat header
    const chatHeader = document.createElement('div');
    chatHeader.className = 'neochat-chat-header';
    
    const chatTitle = document.createElement('div');
    chatTitle.className = 'neochat-chat-title';
    chatTitle.textContent = config.chatbotName;
    
    const closeButton = document.createElement('div');
    closeButton.className = 'neochat-close-button';
    closeButton.innerHTML = '&times;';
    closeButton.addEventListener('click', toggleWidget);
    
    chatHeader.appendChild(chatTitle);
    chatHeader.appendChild(closeButton);
    
    // Create chat body
    const chatBody = document.createElement('div');
    chatBody.className = 'neochat-chat-body';
    
    chatMessages = document.createElement('div');
    chatMessages.className = 'neochat-chat-messages';
    
    // Create typing indicator
    typingIndicator = document.createElement('div');
    typingIndicator.className = 'neochat-typing-indicator';
    typingIndicator.innerHTML = `
      <div class="neochat-message neochat-bot-message neochat-typing">
        <div class="neochat-typing-content">
          <span class="neochat-typing-dot"></span>
          <span class="neochat-typing-dot"></span>
          <span class="neochat-typing-dot"></span>
        </div>
      </div>
    `;
    typingIndicator.style.display = 'none';
    
    chatBody.appendChild(chatMessages);
    chatBody.appendChild(typingIndicator);
    
    // Create chat footer
    const chatFooter = document.createElement('div');
    chatFooter.className = 'neochat-chat-footer';
    
    messageInput = document.createElement('input');
    messageInput.type = 'text';
    messageInput.className = 'neochat-message-input';
    messageInput.placeholder = 'Type your message...';
    messageInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        sendMessage(messageInput.value);
      }
    });
    
    const sendButton = document.createElement('button');
    sendButton.className = 'neochat-send-button';
    sendButton.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"></path><path d="M22 2l-7 20-4-9-9-4 20-7z"></path></svg>';
    sendButton.addEventListener('click', function() {
      sendMessage(messageInput.value);
    });
    
    chatFooter.appendChild(messageInput);
    chatFooter.appendChild(sendButton);
    
    // Assemble the chat container
    chatContainer.appendChild(chatHeader);
    chatContainer.appendChild(chatBody);
    chatContainer.appendChild(chatFooter);
    
    // Add the elements to the DOM
    widgetContainer.appendChild(chatContainer);
    widgetContainer.appendChild(widgetButton);
    
    // Add to the container specified in options or default to body
    const targetContainer = document.querySelector(userInitOptions.container) || document.body;
    targetContainer.appendChild(widgetContainer);
    
    // Apply styles
    applyStyles();
    
    // Note: We no longer automatically call initChatSession here.
    // It will be called after a delay or right after setUser
  }
  
  /**
   * Create the embedded widget (no headers, minimal styling)
   */
  function createEmbeddedWidget() {
    // Find the target container
    const targetContainer = document.querySelector(userInitOptions.container);
    if (!targetContainer) {
      console.error('NeoChat: Target container not found:', userInitOptions.container);
      return;
    }
    
    // Create main chat container (no widget button or header)
    chatContainer = document.createElement('div');
    chatContainer.className = 'neochat-embedded-container';
    
    // Create chat body
    const chatBody = document.createElement('div');
    chatBody.className = 'neochat-chat-body';
    
    chatMessages = document.createElement('div');
    chatMessages.className = 'neochat-chat-messages';
    
    // Create typing indicator
    typingIndicator = document.createElement('div');
    typingIndicator.className = 'neochat-typing-indicator';
    typingIndicator.innerHTML = `
      <div class="neochat-message neochat-bot-message neochat-typing">
        <div class="neochat-typing-content">
          <span class="neochat-typing-dot"></span>
          <span class="neochat-typing-dot"></span>
          <span class="neochat-typing-dot"></span>
        </div>
      </div>
    `;
    typingIndicator.style.display = 'none';
    
    chatBody.appendChild(chatMessages);
    chatBody.appendChild(typingIndicator);
    
    // Create chat footer (input area)
    const chatFooter = document.createElement('div');
    chatFooter.className = 'neochat-chat-footer';
    
    messageInput = document.createElement('input');
    messageInput.type = 'text';
    messageInput.className = 'neochat-message-input';
    messageInput.placeholder = 'Type your message...';
    messageInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        sendMessage(messageInput.value);
      }
    });
    
    const sendButton = document.createElement('button');
    sendButton.className = 'neochat-send-button';
    sendButton.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"></path><path d="M22 2l-7 20-4-9-9-4 20-7z"></path></svg>';
    sendButton.addEventListener('click', function() {
      sendMessage(messageInput.value);
    });
    
    chatFooter.appendChild(messageInput);
    chatFooter.appendChild(sendButton);
    
    // Assemble the chat container
    chatContainer.appendChild(chatBody);
    chatContainer.appendChild(chatFooter);
    
    // Add to the target container
    targetContainer.appendChild(chatContainer);
    
    // In embedded mode, the chat is always "open"
    isWidgetOpen = true;
    
    // Apply embedded styles
    applyEmbeddedStyles();
    
    // Setup resize observer for dynamic container changes
    setupEmbeddedResizeObserver();
    
    // Auto-scroll to bottom when in embedded mode
    scrollToBottom();
  }
  
  /**
   * Apply styles to the widget
   */
  function applyStyles() {
    if (isEmbeddedMode) {
      return; // Embedded styles are handled separately
    }
    
    // Create style element
    const style = document.createElement('style');
    style.type = 'text/css';
    
    // Define the CSS
    const css = `
      .neochat-widget-container {
        position: fixed;
        z-index: 9999;
        ${userInitOptions.position === 'bottom-left' ? 'left: 20px;' : 'right: 20px;'}
        bottom: 20px;
        font-family: ${config.theme.fontFamily};
        font-size: ${config.theme.fontSize};
        color: ${config.theme.textColor};
      }
      
      .neochat-widget-button {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background-color: ${config.theme.buttonColor};
        color: ${config.theme.buttonTextColor};
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        transition: all 0.3s ease;
      }
      
      .neochat-widget-button:hover {
        box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
        transform: translateY(-2px);
      }
      
      .neochat-chat-container {
        position: absolute;
        bottom: 80px;
        ${userInitOptions.position === 'bottom-left' ? 'left: 0;' : 'right: 0;'}
        width: ${userInitOptions.width}px;
        height: ${userInitOptions.height}px;
        background-color: ${config.theme.backgroundColor};
        border-radius: 10px;
        overflow: hidden;
        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.15);
        display: flex;
        flex-direction: column;
        display: none;
        transition: all 0.3s ease;
      }
      
      .neochat-chat-header {
        background-color: ${config.theme.primaryColor};
        color: ${config.theme.buttonTextColor};
        padding: 15px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .neochat-chat-title {
        font-weight: bold;
      }
      
      .neochat-close-button {
        font-size: 24px;
        cursor: pointer;
      }
      
      .neochat-chat-body {
        flex: 1;
        overflow-y: auto;
        padding: 15px;
        -webkit-overflow-scrolling: touch; /* Enable smooth scrolling on iOS */
      }
      
      .neochat-chat-messages {
        display: flex;
        flex-direction: column;
      }
      
      .neochat-message {
        max-width: 80%;
        padding: 10px 15px;
        border-radius: 18px;
        margin-bottom: 10px;
        word-break: break-word;
      }
      
      .neochat-bot-message {
        align-self: flex-start;
        background-color: ${config.theme.secondaryColor};
        color: ${config.theme.textColor};
        border-bottom-left-radius: 5px;
      }
      
      .neochat-user-message {
        align-self: flex-end;
        background-color: ${config.theme.primaryColor};
        color: ${config.theme.buttonTextColor};
        border-bottom-right-radius: 5px;
      }
      
      .neochat-chat-footer {
        border-top: 1px solid ${config.theme.borderColor};
        padding: 10px 15px;
        display: flex;
      }
      
      .neochat-message-input {
        flex: 1;
        border: 1px solid ${config.theme.borderColor};
        border-radius: 20px;
        padding: 8px 15px;
        margin-right: 10px;
        outline: none;
        font-family: inherit;
        font-size: inherit;
      }
      
      .neochat-send-button {
        background-color: ${config.theme.buttonColor};
        color: ${config.theme.buttonTextColor};
        border: none;
        border-radius: 50%;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }
      
      /* Typing indicator styles */
      @keyframes typingAnimation {
        0% { opacity: 0.3; transform: translateY(0px); }
        50% { opacity: 1; transform: translateY(-2px); }
        100% { opacity: 0.3; transform: translateY(0px); }
      }
      
      .neochat-typing {
        max-width: 60px;
      }
      
      .neochat-typing-content {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 24px;
        min-width: 40px;
      }
      
      .neochat-typing-dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        margin: 0 2px;
        background-color: ${config.theme.textColor};
        border-radius: 50%;
        animation: typingAnimation 1s infinite ease-in-out;
      }
      
      .neochat-typing-dot:nth-child(2) {
        animation-delay: 0.2s;
      }
      
      .neochat-typing-dot:nth-child(3) {
        animation-delay: 0.4s;
      }
      
      /* Message formatting styles */
      .neochat-message p {
        margin: 0 0 10px 0;
      }
      
      .neochat-message p:last-child {
        margin-bottom: 0;
      }
      
      .neochat-message strong, .neochat-message b {
        font-weight: bold;
      }
      
      .neochat-message em, .neochat-message i {
        font-style: italic;
      }
      
      .neochat-message u {
        text-decoration: underline;
      }
      
      .neochat-message a {
        color: inherit;
        text-decoration: underline;
      }
      
      .neochat-message ul, .neochat-message ol {
        margin: 8px 0;
        padding-left: 20px;
      }
      
      .neochat-message code {
        font-family: monospace;
        background-color: rgba(0, 0, 0, 0.06);
        padding: 2px 4px;
        border-radius: 3px;
      }
      
      ${config.customCss}

      @media (max-width: 768px) {
        .neochat-chat-container {
          width: calc(100vw - 40px);
          max-width: ${userInitOptions.width}px;
          transition: all 0.3s ease;
          will-change: transform, height, position, top, bottom;
          -webkit-overflow-scrolling: touch;
        }
        
        .neochat-chat-container.keyboard-open {
          position: fixed !important;
          top: 10px !important;
          bottom: auto !important;
          transform: translateZ(0) !important;
          z-index: 999999 !important;
        }

        .neochat-chat-body {
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-y: contain;
          overflow-y: auto;
          flex: 1;
          max-height: calc(100% - 110px); /* Account for header and footer */
        }

        .neochat-chat-footer {
          position: relative;
          z-index: 2;
          background: ${config.theme.backgroundColor};
        }

        .neochat-message-input {
          font-size: 16px; /* Prevent iOS zoom */
          padding: 12px 15px; /* Larger touch target */
          -webkit-appearance: none; /* Prevent iOS styling */
          border-radius: 20px;
        }

        .neochat-send-button {
          width: 44px; /* Larger touch target */
          height: 44px;
          -webkit-appearance: none; /* Prevent iOS styling */
        }
      }
    `;
    
    // Set the CSS content
    style.appendChild(document.createTextNode(css));
    
    // Add to the document head
    document.head.appendChild(style);
  }
  
  /**
   * Apply minimal styles for embedded mode with Flutter WebView compatibility
   */
  function applyEmbeddedStyles() {
    // Create style element
    const style = document.createElement('style');
    style.type = 'text/css';
    
    // Define robust CSS for embedded mode that works well with Flutter WebViews
    const css = `
      .neochat-embedded-container {
        /* Use multiple sizing strategies for maximum compatibility */
        width: 100% !important;
        height: 100% !important;
        min-width: 100% !important;
        min-height: 100vh !important; /* Fallback for when parent height is not defined */
        max-width: 100% !important;
        max-height: 100% !important;
        
        /* Ensure proper box model */
        box-sizing: border-box !important;
        
        /* Flexbox layout */
        display: flex !important;
        flex-direction: column !important;
        
        /* Reset all spacing */
        padding: 0 !important;
        margin: 0 !important;
        border: none !important;
        
        /* Visual properties */
        font-family: ${config.theme.fontFamily};
        font-size: ${config.theme.fontSize};
        color: ${config.theme.textColor};
        background-color: transparent !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        
        /* Prevent overflow issues */
        overflow: hidden !important;
        
        /* Ensure container takes full space */
        position: relative !important;
        
        /* Force layout recalculation - helps with Flutter WebView */
        contain: layout style paint !important;
      }
      
      .neochat-embedded-container .neochat-chat-body {
        /* Take all available space except footer */
        flex: 1 1 auto !important;
        min-height: 0 !important; /* Important for flexbox children */
        
        /* Scrolling */
        overflow-y: auto !important;
        overflow-x: hidden !important;
        -webkit-overflow-scrolling: touch !important;
        
        /* Reset spacing */
        padding: 0 !important;
        margin: 0 !important;
        
        /* Visual */
        background-color: transparent !important;
        
        /* Ensure proper box model */
        box-sizing: border-box !important;
        
        /* Flex container for messages */
        display: flex !important;
        flex-direction: column !important;
      }
      
      .neochat-embedded-container .neochat-chat-messages {
        /* Flex grow to fill body */
        flex: 1 1 auto !important;
        
        /* Layout */
        display: flex !important;
        flex-direction: column !important;
        justify-content: flex-end !important; /* Align messages to bottom */
        
        /* Spacing */
        padding: 10px !important;
        margin: 0 !important;
        
        /* Ensure minimum height but allow growth */
        min-height: fit-content !important;
        
        /* Visual */
        background-color: transparent !important;
        
        /* Box model */
        box-sizing: border-box !important;
        
        /* Prevent horizontal overflow */
        width: 100% !important;
        overflow-x: hidden !important;
      }
      
      .neochat-embedded-container .neochat-message {
        max-width: 80% !important;
        padding: 10px 15px !important;
        border-radius: 18px !important;
        margin-bottom: 10px !important;
        word-break: break-word !important;
        box-sizing: border-box !important;
        flex-shrink: 0 !important; /* Prevent messages from shrinking */
      }
      
      .neochat-embedded-container .neochat-bot-message {
        align-self: flex-start !important;
        background-color: ${config.theme.secondaryColor} !important;
        color: ${config.theme.textColor} !important;
        border-bottom-left-radius: 5px !important;
      }
      
      .neochat-embedded-container .neochat-user-message {
        align-self: flex-end !important;
        background-color: ${config.theme.primaryColor} !important;
        color: ${config.theme.buttonTextColor} !important;
        border-bottom-right-radius: 5px !important;
      }
      
      .neochat-embedded-container .neochat-chat-footer {
        /* Fixed height footer */
        flex: 0 0 auto !important;
        min-height: 60px !important;
        max-height: 80px !important;
        
        /* Layout */
        display: flex !important;
        align-items: center !important;
        
        /* Spacing */
        padding: 10px !important;
        margin: 0 !important;
        
        /* Visual */
        border-top: 1px solid ${config.theme.borderColor} !important;
        background-color: transparent !important;
        
        /* Box model */
        box-sizing: border-box !important;
        
        /* Ensure full width */
        width: 100% !important;
        
        /* Prevent shrinking */
        flex-shrink: 0 !important;
      }
      
      .neochat-embedded-container .neochat-message-input {
        /* Take available space */
        flex: 1 1 auto !important;
        min-width: 0 !important; /* Allow shrinking if needed */
        
        /* Styling */
        border: 1px solid ${config.theme.borderColor} !important;
        border-radius: 20px !important;
        padding: 8px 15px !important;
        margin-right: 10px !important;
        outline: none !important;
        
        /* Typography */
        font-family: inherit !important;
        font-size: inherit !important;
        
        /* Colors */
        background-color: ${config.theme.backgroundColor} !important;
        color: ${config.theme.textColor} !important;
        
        /* Box model */
        box-sizing: border-box !important;
        
        /* Ensure proper height */
        height: 40px !important;
        max-height: 40px !important;
      }
      
      .neochat-embedded-container .neochat-send-button {
        /* Fixed size */
        flex: 0 0 auto !important;
        width: 40px !important;
        height: 40px !important;
        min-width: 40px !important;
        min-height: 40px !important;
        
        /* Layout */
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        
        /* Styling */
        background-color: ${config.theme.buttonColor} !important;
        color: ${config.theme.buttonTextColor} !important;
        border: none !important;
        border-radius: 50% !important;
        cursor: pointer !important;
        
        /* Box model */
        box-sizing: border-box !important;
        
        /* Prevent shrinking */
        flex-shrink: 0 !important;
      }
      
      .neochat-embedded-container .neochat-send-button:hover {
        opacity: 0.9 !important;
      }
      
      /* Typing indicator styles for embedded mode */
      .neochat-embedded-container .neochat-typing {
        max-width: 60px !important;
        flex-shrink: 0 !important;
      }
      
      .neochat-embedded-container .neochat-typing-content {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        min-height: 24px !important;
        min-width: 40px !important;
      }
      
      .neochat-embedded-container .neochat-typing-dot {
        display: inline-block !important;
        width: 8px !important;
        height: 8px !important;
        margin: 0 2px !important;
        background-color: ${config.theme.textColor} !important;
        border-radius: 50% !important;
        animation: typingAnimation 1s infinite ease-in-out !important;
        flex-shrink: 0 !important;
      }
      
      .neochat-embedded-container .neochat-typing-dot:nth-child(2) {
        animation-delay: 0.2s !important;
      }
      
      .neochat-embedded-container .neochat-typing-dot:nth-child(3) {
        animation-delay: 0.4s !important;
      }
      
      /* Message formatting styles for embedded mode */
      .neochat-embedded-container .neochat-message p {
        margin: 0 0 10px 0 !important;
      }
      
      .neochat-embedded-container .neochat-message p:last-child {
        margin-bottom: 0 !important;
      }
      
      .neochat-embedded-container .neochat-message strong, 
      .neochat-embedded-container .neochat-message b {
        font-weight: bold !important;
      }
      
      .neochat-embedded-container .neochat-message em, 
      .neochat-embedded-container .neochat-message i {
        font-style: italic !important;
      }
      
      .neochat-embedded-container .neochat-message u {
        text-decoration: underline !important;
      }
      
      .neochat-embedded-container .neochat-message a {
        color: inherit !important;
        text-decoration: underline !important;
      }
      
      .neochat-embedded-container .neochat-message ul, 
      .neochat-embedded-container .neochat-message ol {
        margin: 8px 0 !important;
        padding-left: 20px !important;
      }
      
      .neochat-embedded-container .neochat-message code {
        font-family: monospace !important;
        background-color: rgba(0, 0, 0, 0.06) !important;
        padding: 2px 4px !important;
        border-radius: 3px !important;
      }
      
      /* Custom CSS for embedded mode */
      ${config.customCss}
      
      /* Flutter WebView specific fixes */
      @media screen {
        .neochat-embedded-container {
          /* Ensure container expands to fill Flutter WebView */
          min-height: 100vh !important;
          min-width: 100vw !important;
        }
      }
      
      /* Responsive design for embedded mode */
      @media (max-width: 768px) {
        .neochat-embedded-container .neochat-message-input {
          font-size: 16px !important; /* Prevent iOS zoom */
          padding: 12px 15px !important; /* Larger touch target */
          height: 44px !important; /* Larger touch target */
          max-height: 44px !important;
        }
        
        .neochat-embedded-container .neochat-send-button {
          width: 44px !important; /* Larger touch target */
          height: 44px !important;
          min-width: 44px !important;
          min-height: 44px !important;
        }
        
        .neochat-embedded-container .neochat-chat-footer {
          min-height: 70px !important; /* Accommodate larger touch targets */
        }
      }
    `;
    
    // Set the CSS content
    style.appendChild(document.createTextNode(css));
    
    // Add to the document head
    document.head.appendChild(style);
  }
  
  /**
   * Setup resize observer for embedded mode to handle dynamic container changes
   */
  function setupEmbeddedResizeObserver() {
    if (!isEmbeddedMode || !chatContainer) return;
    
    // Use ResizeObserver if available (modern browsers)
    if (typeof ResizeObserver !== 'undefined') {
      const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
          console.log('[NeoChat Embedded] Container resized:', {
            width: entry.contentRect.width,
            height: entry.contentRect.height
          });
          
          // Force layout recalculation
          if (chatMessages) {
            chatMessages.style.height = 'auto';
            setTimeout(() => {
              scrollToBottom();
            }, 50);
          }
        }
      });
      
      resizeObserver.observe(chatContainer);
    }
    
    // Fallback: Listen for window resize events
    window.addEventListener('resize', () => {
      if (isEmbeddedMode && chatContainer) {
        setTimeout(() => {
          scrollToBottom();
        }, 100);
      }
    });
  }
  
  /**
   * Initialize the chat session
   */
  function initChatSession() {
    if (isSessionInitialized) {
      console.warn('Chat session already initialized');
      return;
    }
    
    console.log("Initializing chat session with user data:", userData);
    showTypingIndicator();

    // Add diagnostic information
    console.log("SDK Config:", config);
    console.log("API Base URL:", config.apiBaseUrl);
    console.log("Project ID:", userInitOptions.projectId);
    console.log("Current Origin:", window.location.origin);
    
    // If running from a local file (file://), we need special handling
    const isLocalFile = window.location.protocol === 'file:';
    if (isLocalFile) {
      console.log("Running from local file system (file://). This may cause CORS issues.");
    }

    // Add before fetch calls in sdk-template.js
    console.log('Sending message with JWT:', userData.metadata?.token);

    fetch(`${config.apiBaseUrl}/api/chatbot/sdk/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        projectId: userInitOptions.projectId,
        userId: userData.id,
        userName: userData.name,
        userEmail: userData.email,
        user: {
          metadata: userData.metadata || {}
        },
        jwt: userData.metadata?.token || null,
        city: userData.metadata?.city || null,
        country: userData.metadata?.country || null
      }),
      mode: 'cors', // Explicitly set CORS mode
      credentials: 'omit' // Don't send credentials for cross-origin requests
    })
    .then(response => {
      if (!response.ok) {
        console.error('Failed to initialize chat session. Status:', response.status);
        console.error('Status Text:', response.statusText);
        
        // Additional logging for 500 errors
        if (response.status === 500) {
          console.error('Server returned a 500 error. This may indicate a server-side problem.');
          console.error('Check server logs for details.');
        }
        
        hideTypingIndicator();
        throw new Error(`Failed to initialize chat session: ${response.status} ${response.statusText}`);
      }
      return response.json();
    })
    .then(data => {
      console.log('Chat session initialized:', data);
      sessionData.sessionId = data.sessionId;
      isSessionInitialized = true;

      hideTypingIndicator();
      
      // Display initial message
      if (data.messages && data.messages.length > 0) {
        sessionData.messages = data.messages;
        
        // Add messages to the chat
        data.messages.forEach(message => {
          addMessageToChat(message.content, message.role);
        });
      }
    })
    .catch(error => {
      console.error('Error initializing chat session:', error);
      
      // Handle specific errors with clearer messaging
      if (error.message && (error.message.includes('Failed to fetch') || 
                          error.message.includes('NetworkError') || 
                          error.message.includes('Network request failed') ||
                          error.message.includes('CORS'))) {
        console.error('This appears to be a CORS or network error. Check server settings and make sure that:');
        console.error('1. The API server allows requests from this domain');
        console.error('2. The API base URL is correctly configured: ' + config.apiBaseUrl);
        console.error('3. The server has proper CORS headers in the response');
        console.error('4. If using file:// protocol, try hosting on a local server instead');
        
        // If running locally from file://, suggest a solution
        if (isLocalFile) {
          addMessageToChat('Error: Cannot connect to the server when running from a local file (file://). Please host this page on a web server to use the chatbot.', 'assistant');
        } else {
          // Add a more helpful message to the chat
          addMessageToChat('Sorry, I encountered a connection issue (CORS error). Please check the console for details or contact support.', 'assistant');
        }
      } else if (error.message && error.message.includes('500')) {
        console.error('Server returned a 500 error. This indicates a server-side problem.');
        addMessageToChat('Sorry, the server encountered an error. Please try again later or contact support.', 'assistant');
      } else {
        addMessageToChat('Sorry, I had trouble connecting. Please try again later.', 'assistant');
      }
      
      hideTypingIndicator();
    });
  }
  
  /**
   * Toggle the widget open/closed
   */
  function toggleWidget() {
    if (isEmbeddedMode) {
      // In embedded mode, the chat is always open
      return;
    }
    
    isWidgetOpen = !isWidgetOpen;
    
    if (isWidgetOpen) {
      chatContainer.style.display = 'flex';
      messageInput.focus();
      // Auto-scroll to bottom when opening the chat
      scrollToBottom();
      
      // Call the onOpen callback if provided
      if (typeof userInitOptions.onOpen === 'function') {
        userInitOptions.onOpen();
      }
    } else {
      chatContainer.style.display = 'none';
      
      // Call the onClose callback if provided
      if (typeof userInitOptions.onClose === 'function') {
        userInitOptions.onClose();
      }
    }
  }
  
  /**
   * Scroll the chat messages to the bottom
   */
  function scrollToBottom() {
    if (!chatMessages) return;

    // Try different approaches to scrolling
    try {
      // First approach: direct scrollTop setting
      chatMessages.scrollTop = chatMessages.scrollHeight;
      
      // Second approach with requestAnimationFrame for better timing
      requestAnimationFrame(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Third approach with setTimeout as fallback
        setTimeout(() => {
          chatMessages.scrollTop = chatMessages.scrollHeight;

          console.log('Chat Message: ', chatMessages);
          console.log('scroll Height: ', chatMessages.scrollHeight);
          console.log('scroll Top: ', chatMessages.scrollTop);
          
          // Final attempt with scrollIntoView on the last child
          const lastMessage = chatMessages.lastElementChild;
          if (lastMessage) {
            lastMessage.scrollIntoView({ behavior: 'smooth', block: 'end' });
          }
        }, 100);
      });
    } catch (e) {
      console.error('Error scrolling to bottom:', e);
    }
  }

  function scrollToBottomTypingIndicator(){
    if (!chatMessages) return;

    // Try different approaches to scrolling
    try {
      // First approach: direct scrollTop setting
      chatMessages.scrollTop = chatMessages.scrollHeight;
      
      // Second approach with requestAnimationFrame for better timing
      requestAnimationFrame(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Third approach with setTimeout as fallback
        setTimeout(() => {

          
          if (typingIndicator) {
            typingIndicator.scrollIntoView({ behavior: 'smooth', block: 'end' });
          }
        }, 100);
      });
    } catch (e) {
      console.error('Error scrolling to bottom:', e);
    }
  }
  
  /**
   * Show the typing indicator
   */
  function showTypingIndicator() {
    if (typingIndicator) {
      // Set display to block
      typingIndicator.style.display = 'block';
      
      // First scroll attempt immediately after showing the indicator
      scrollToBottomTypingIndicator();
      
      // Second scroll attempt after a slight delay to ensure DOM update
      setTimeout(() => {
        scrollToBottomTypingIndicator();
        
        // Third attempt with requestAnimationFrame
        requestAnimationFrame(() => {
          scrollToBottomTypingIndicator();
        });
      }, 50);
    }
  }
  
  /**
   * Hide the typing indicator
   */
  function hideTypingIndicator() {
    if (typingIndicator) {
      typingIndicator.style.display = 'none';
    }
  }
  
  /**
   * Parse simple markdown in text
   * @param {string} text - Raw text with markdown
   * @returns {string} - HTML formatted text
   */
  function parseMarkdown(text) {
    if (!text) return '';

    let formatted = text;

    // Handle markdown images first to avoid interfering with links
    formatted = formatted.replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      (_, alt, url) => {
        const escapedUrl = url.replace(/"/g, '&quot;'); // escape double quotes in URL
        return `<img src="${escapedUrl}" alt="${alt}" style="max-width: 100%; height: auto;" />`;
      }
    );

    // Handle links
    formatted = formatted.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    // Handle code
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Handle bold
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/__(.*?)__/g, '<strong>$1</strong>');

    // Handle italic (after bold to avoid nested conflicts)
    formatted = formatted.replace(/(?<!\*)\*(?!\*)(.*?)\*(?<!\*)/g, '<em>$1</em>');
    formatted = formatted.replace(/(?<!_)_(?!_)(.*?)_(?<!_)/g, '<em>$1</em>');

    // Handle new lines
    formatted = formatted.replace(/\n/g, '<br>');

    // Handle plain image URLs not already inside <img>
    formatted = formatted.replace(
      /(?<!["'])\b(https?:\/\/[^\s<>"']+\.(?:png|jpe?g|gif|webp|svg|bmp|ico)(\?[^\s<>"']*)?)/gi,
      (match) => {
        return `<img src="${match}" alt="Image" style="max-width: 100%; height: auto;" />`;
      }
    );

    return formatted;
  }
  
  /**
   * Set up event listeners for SSE events
   */
  function setupEventListeners() {
    // Create custom event listeners for intermediate messages and typing indicators
    window.addEventListener('neochat:intermediate', function(event) {
      console.log('Received intermediate message event:', event.detail);
      
      if (event.detail && event.detail.message) {
        // Add the intermediate message to the UI
        addMessageToChat(
          event.detail.message.content,
          event.detail.message.role || 'assistant',
          true // Mark as intermediate
        );
        
        // Call the onIntermediateMessage callback if provided
        if (typeof userInitOptions.onIntermediateMessage === 'function') {
          userInitOptions.onIntermediateMessage(event.detail.message);
        }
      }
    });
    
    window.addEventListener('neochat:typing', function(event) {
      console.log('Received typing indicator event');
      showTypingIndicator();
      
      // Call the onTyping callback if provided
      if (typeof userInitOptions.onTyping === 'function') {
        userInitOptions.onTyping(event.detail);
      }
    });
    
    window.addEventListener('neochat:collect_input', function(event) {
      console.log('Received collect_input event:', event.detail);
      
      // Call the onCollectInput callback if provided
      if (typeof userInitOptions.onCollectInput === 'function') {
        userInitOptions.onCollectInput(event.detail);
      }
    });
    
    window.addEventListener('neochat:input_received', function(event) {
      console.log('User input received for Flow Builder:', event.detail);
      
      // Call the onInputReceived callback if provided
      if (typeof userInitOptions.onInputReceived === 'function') {
        userInitOptions.onInputReceived(event.detail);
      }
    });
    
    window.addEventListener('neochat:message', function(event) {
      console.log('Message event:', event.detail);
      
      // Call the onMessage callback if provided
      if (typeof userInitOptions.onMessage === 'function') {
        userInitOptions.onMessage(event.detail);
      }
    });
  }
  
  /**
   * Send a message to the backend
   * @param {string} text - Message text
   */
  function sendMessage(text) {
    if (!text.trim()) return;
    
    // Clear input
    messageInput.value = '';
    
    // Add Flow Builder input validation for collect_input steps
    if (isWaitingForInput && currentInputStep) {
      // Add visual feedback that input was received
      if (messageInput) {
        messageInput.placeholder = 'Processing your input...';
      }
      
      // Dispatch input received event
      const inputReceivedEvent = new CustomEvent('neochat:input_received', {
        detail: {
          input: text,
          stepInfo: currentInputStep,
          timestamp: new Date()
        }
      });
      window.dispatchEvent(inputReceivedEvent);
    }
    
    // Add message to chat
    addMessageToChat(text, 'user');
    
    console.log('Sending message to backend:', text);
    console.log('Using API URL:', `${config.apiBaseUrl}/api/chatbot/sdk/message`);
    console.log('Session ID:', sessionData.sessionId);
    
    // Set a timeout to show typing indicator after 3 seconds
    typingTimeout = setTimeout(() => {
      showTypingIndicator();
    }, 3000);
    
    // Create a new EventSource for SSE
    let eventSource = null;
    
    try {
      // Check if browser supports EventSource and if we're not on a file:// protocol
      // The file:// protocol limitation is causing issues with CORS and EventSource
      if (typeof EventSource !== 'undefined' && window.location.protocol !== 'file:') {
        // First try with POST via regular fetch, but add a header to request streaming
        console.log('Using fetch with streaming header for SSE');
        
        // Get city and country parameters for the URL if they exist
        const cityParam = userData.metadata?.city ? `&city=${encodeURIComponent(userData.metadata.city)}` : '';
        const countryParam = userData.metadata?.country ? `&country=${encodeURIComponent(userData.metadata.country)}` : '';
        
        fetch(`${config.apiBaseUrl}/api/chatbot/sdk/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream'
          },
          body: JSON.stringify({
            projectId: userInitOptions.projectId,
            sessionId: sessionData.sessionId,
            message: text,
            stream: true,
            jwt: userData.metadata?.token || null, // Add JWT token from user metadata
            user: {
              metadata: userData.metadata || {} // Include full user metadata as fallback
            },
            city: userData.metadata?.city || null,
            country: userData.metadata?.country || null
          })
        })
        .then(response => {
          // Check if the response supports streaming
          if (response.headers.get('Content-Type')?.includes('text/event-stream')) {
            // Process as SSE stream
            console.log('Server supports SSE, processing stream');
            
            const reader = response.body.getReader();
            let decoder = new TextDecoder();
            let buffer = '';
            
            // Process the stream
            function processStream() {
              reader.read().then(({ done, value }) => {
                if (done) {
                  console.log('Stream complete');
                  return;
                }
                
                // Decode the chunk and add to buffer
                buffer += decoder.decode(value, { stream: true });
                
                // Process events in buffer
                let eventEnd = buffer.indexOf('\n\n');
                while (eventEnd !== -1) {
                  const eventData = buffer.substring(0, eventEnd);
                  buffer = buffer.substring(eventEnd + 2);
                  
                  // Process the event
                  if (eventData.includes('event: typing')) {
                    console.log('Received typing event via stream');
                    showTypingIndicator();
                    
                    // Dispatch custom event
                    const typingEvent = new CustomEvent('neochat:typing', {
                      detail: { status: 'typing' }
                    });
                    window.dispatchEvent(typingEvent);
                  } 
                  else if (eventData.includes('event: intermediate')) {
                    try {
                      // Extract the data part
                      const dataStr = eventData.split('data: ')[1];
                      if (dataStr) {
                        console.log('Received intermediate message via stream:', dataStr);
                        const data = JSON.parse(dataStr);
                        
                        if (data.status === 'success' && data.message) {
                          // Add intermediate message to chat
                          addMessageToChat(data.message.content, data.message.role || 'assistant', true);
                          
                          // Dispatch custom event for intermediate message
                          const intermediateEvent = new CustomEvent('neochat:intermediate', {
                            detail: data
                          });
                          window.dispatchEvent(intermediateEvent);
                          
                          // Call the onIntermediateMessage callback if provided
                          if (typeof userInitOptions.onIntermediateMessage === 'function') {
                            userInitOptions.onIntermediateMessage(data.message);
                          }
                        }
                      }
                    } catch (error) {
                      console.error('Error processing intermediate message from stream:', error);
                    }
                  }
                  else if (eventData.includes('event: collect_input')) {
                    try {
                      // Extract the data part
                      const dataStr = eventData.split('data: ')[1];
                      if (dataStr) {
                        console.log('Received collect_input step via stream:', dataStr);
                        const data = JSON.parse(dataStr);
                        
                        if (data.status === 'success' && data.message) {
                          // Set Flow Builder input state
                          isWaitingForInput = true;
                          currentInputStep = data.stepInfo || null;
                          lastCollectInputMessage = data.message.content;
                          
                          // Add message to chat
                          addMessageToChat(data.message.content, data.message.role || 'assistant');
                          
                          // Add visual indicator for input required
                          if (messageInput) {
                            messageInput.placeholder = data.inputPlaceholder || 'Please provide your input...';
                            messageInput.focus();
                          }
                          
                          // Dispatch custom event
                          const collectInputEvent = new CustomEvent('neochat:collect_input', {
                            detail: data
                          });
                          window.dispatchEvent(collectInputEvent);
                          
                          // Call callback if provided
                          if (typeof userInitOptions.onCollectInput === 'function') {
                            userInitOptions.onCollectInput(data);
                          }
                        }
                      }
                    } catch (error) {
                      console.error('Error processing collect_input event from stream:', error);
                    }
                  }
                  else if (eventData.includes('event: message')) {
                    try {
                      // Extract the data part
                      const dataStr = eventData.split('data: ')[1];
                      if (dataStr) {
                        console.log('Received final message via stream:', dataStr);
                        const data = JSON.parse(dataStr);
                        
                        // Clear typing indicator timeout and hide it
                        if (typingTimeout) {
                          clearTimeout(typingTimeout);
                          typingTimeout = null;
                        }
                        hideTypingIndicator();
                        
                        if (data.status === 'success' && data.message) {
                          // Reset Flow Builder input state if this was the final message
                          if (isWaitingForInput) {
                            isWaitingForInput = false;
                            currentInputStep = null;
                            lastCollectInputMessage = null;
                            if (messageInput) {
                              messageInput.placeholder = 'Type your message...';
                            }
                          }
                          
                          // Add the final message to chat
                          addMessageToChat(data.message.content, data.message.role || 'assistant');
                        }
                      }
                    } catch (error) {
                      console.error('Error processing final message from stream:', error);
                    }
                  }
                  
                  eventEnd = buffer.indexOf('\n\n');
                }
                
                // Continue processing the stream
                processStream();
              }).catch(error => {
                console.error('Error reading stream:', error);
                // Fall back to regular fetch
                fallbackFetch(text);
              });
            }
            
            // Start processing the stream
            processStream();
          } else {
            // Not an SSE response, process as regular JSON
            console.log('Server does not support SSE, falling back to regular fetch');
            response.json().then(data => {
              // Process the response as a regular JSON response
              // Clear typing indicator timeout and hide it
              if (typingTimeout) {
                clearTimeout(typingTimeout);
                typingTimeout = null;
              }
              hideTypingIndicator();
              
              console.log('Response received - full data:', JSON.stringify(data));
              
              // Try different possible response formats
              if (data && data.data && data.data.message && data.data.message.content) {
                console.log('Using format: data.data.message.content');
                addMessageToChat(data.data.message.content, data.data.message.role || 'assistant');
              } 
              else if (data && data.message && typeof data.message === 'string') {
                console.log('Using format: data.message (string)');
                addMessageToChat(data.message, 'assistant');
              }
              else if (data && data.data && typeof data.data.message === 'string') {
                console.log('Using format: data.data.message (string)');
                addMessageToChat(data.data.message, 'assistant');
              }
              else if (data && data.status === 'success' && data.data) {
                // Try to find any message content in the data object
                console.log('Searching for message in data structure');
                
                if (data.data.content) {
                  console.log('Found data.data.content');
                  addMessageToChat(data.data.content, 'assistant');
                } 
                else if (Array.isArray(data.data) && data.data.length > 0 && data.data[0].content) {
                  console.log('Found data.data[0].content');
                  addMessageToChat(data.data[0].content, 'assistant');
                }
                else if (data.data.response) {
                  console.log('Found data.data.response');
                  addMessageToChat(data.data.response, 'assistant');
                }
                else {
                  console.error('Could not find message content in response');
                }
              }
            }).catch(error => {
              console.error('Error parsing JSON response:', error);
              fallbackFetch(text);
            });
          }
        })
        .catch(error => {
          console.error('Error with fetch for SSE:', error);
          fallbackFetch(text);
        });
        
        // Skip the regular fallbackFetch as we'll only call it if needed
        return;
      } else {
        // EventSource not supported or file:// protocol, use regular fetch
        if (window.location.protocol === 'file:') {
          console.log('file:// protocol detected, using regular fetch instead of SSE');
        } else {
          console.log('EventSource not supported, using regular fetch');
        }
        fallbackFetch(text);
      }
    } catch (error) {
      console.error('Error in sendMessage:', error);
      fallbackFetch(text);
    }
  }
  
  /**
   * Fallback to regular fetch for browsers that don't support SSE
   * @param {string} text - Message text
   */
  function fallbackFetch(text) {
    // Send to backend using traditional fetch
    fetch(`${config.apiBaseUrl}/api/chatbot/sdk/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify({
        projectId: userInitOptions.projectId,
        sessionId: sessionData.sessionId,
        message: text,
        stream: true,
        jwt: userData.metadata?.token || null, // Add JWT token from user metadata
        user: {
          metadata: userData.metadata || {} // Include full user metadata as fallback
        },
        city: userData.metadata?.city || null,
        country: userData.metadata?.country || null
      })
    })
    .then(response => {
      console.log('Message response status:', response.status);
      if (!response.ok) {
        // Handle rate limiting error specifically
        if (response.status === 429) {
          return response.json().then(data => {
            throw new Error(data.message || config.rateLimitMessage);
          });
        }
        throw new Error('Failed to send message. Status: ' + response.status);
      }
      
      // Check if this is an SSE response
      const contentType = response.headers.get('Content-Type');
      if (contentType && contentType.includes('text/event-stream')) {
        console.log('Detected SSE response, processing as stream');
        
        // Process the stream
        const reader = response.body.getReader();
        let decoder = new TextDecoder();
        let buffer = '';
        let finalMessage = null;
        
        // Process chunks
        function processChunks() {
          return reader.read().then(({ done, value }) => {
            if (done) {
              console.log('Stream complete');
              
              // If we never got a final message but have an intermediate one, use that
              if (!finalMessage && buffer.includes('event: intermediate')) {
                try {
                  const parts = buffer.split('event: intermediate\ndata: ');
                  if (parts.length > 1) {
                    const jsonStr = parts[1].split('\n\n')[0];
                    const data = JSON.parse(jsonStr);
                    if (data.message && data.message.content) {
                      addMessageToChat(data.message.content, data.message.role || 'assistant');
                    }
                  }
                } catch (e) {
                  console.error('Error parsing remaining buffer:', e);
                }
              }
              
              // Hide typing indicator when done
              if (typingTimeout) {
                clearTimeout(typingTimeout);
                typingTimeout = null;
              }
              hideTypingIndicator();
              
              return;
            }
            
            // Add to buffer and process
            buffer += decoder.decode(value, { stream: true });
            
            // Process events in buffer
            let eventEnd = buffer.indexOf('\n\n');
            while (eventEnd !== -1) {
              const eventData = buffer.substring(0, eventEnd);
              buffer = buffer.substring(eventEnd + 2);
              
              // Process the event
              if (eventData.includes('event: typing')) {
                console.log('Received typing event');
                showTypingIndicator();
              } 
              else if (eventData.includes('event: intermediate')) {
                try {
                  // Extract the data part
                  const dataStr = eventData.split('data: ')[1];
                  if (dataStr) {
                    console.log('Received intermediate message:', dataStr);
                    const data = JSON.parse(dataStr);
                    
                    if (data.status === 'success' && data.message) {
                      // Add intermediate message to chat
                      addMessageToChat(data.message.content, data.message.role || 'assistant', true);
                    }
                  }
                } catch (error) {
                  console.error('Error processing intermediate message:', error);
                }
              }
              else if (eventData.includes('event: message')) {
                try {
                  // Extract the data part
                  const dataStr = eventData.split('data: ')[1];
                  if (dataStr) {
                    console.log('Received final message:', dataStr);
                    const data = JSON.parse(dataStr);
                    
                    // Store this for when the stream ends
                    finalMessage = data;
                    
                    if (data.status === 'success' && data.message) {
                      // Hide typing indicator
                      if (typingTimeout) {
                        clearTimeout(typingTimeout);
                        typingTimeout = null;
                      }
                      hideTypingIndicator();
                      
                      // Add the final message to chat
                      addMessageToChat(data.message.content, data.message.role || 'assistant');
                    }
                  }
                } catch (error) {
                  console.error('Error processing final message:', error);
                }
              }
              
              eventEnd = buffer.indexOf('\n\n');
            }
            
            // Continue processing the stream
            return processChunks();
          }).catch(error => {
            console.error('Error reading stream:', error);
            // Hide typing indicator
            if (typingTimeout) {
              clearTimeout(typingTimeout);
              typingTimeout = null;
            }
            hideTypingIndicator();
            
            addMessageToChat('Sorry, I encountered an error processing your message. Please try again.', 'assistant');
          });
        }
        
        // Start processing the stream
        return processChunks();
      }
      
      // If not an SSE response, try to handle as JSON
      return response.text().then(text => {
        // Try to parse as JSON first
        try {
          return JSON.parse(text);
        } catch (e) {
          console.log('Response is not JSON, checking for SSE format');
          
          // Check if this looks like SSE data
          if (text.includes('event:') && text.includes('data:')) {
            // Process as SSE text
            console.log('Detected SSE text format');
            
            let finalMessage = null;
            let intermediateMessage = null;
            
            // Split by double newlines to get events
            const events = text.split('\n\n');
            for (const event of events) {
              if (!event.trim()) continue;
              
              if (event.includes('event: typing')) {
                showTypingIndicator();
              } 
              else if (event.includes('event: intermediate')) {
                try {
                  const dataStr = event.split('data: ')[1];
                  if (dataStr) {
                    const data = JSON.parse(dataStr);
                    if (data.status === 'success' && data.message) {
                      intermediateMessage = data.message;
                      // Don't add it to UI yet, wait for final message
                    }
                  }
                } catch (e) {
                  console.error('Error parsing intermediate event:', e);
                }
              }
              else if (event.includes('event: message')) {
                try {
                  const dataStr = event.split('data: ')[1];
                  if (dataStr) {
                    const data = JSON.parse(dataStr);
                    if (data.status === 'success' && data.message) {
                      finalMessage = data.message;
                    }
                  }
                } catch (e) {
                  console.error('Error parsing message event:', e);
                }
              }
            }
            
            // Hide typing indicator
            if (typingTimeout) {
              clearTimeout(typingTimeout);
              typingTimeout = null;
            }
            hideTypingIndicator();
            
            // Use final message if we have it, otherwise use intermediate
            if (finalMessage) {
              addMessageToChat(finalMessage.content, finalMessage.role || 'assistant');
              return { status: 'success', message: finalMessage };
            } else if (intermediateMessage) {
              addMessageToChat(intermediateMessage.content, intermediateMessage.role || 'assistant');
              return { status: 'success', message: intermediateMessage };
            } else {
              throw new Error('No valid message found in response');
            }
          }
          
          // If we get here, we couldn't parse the response
          console.error('Failed to parse response:', text);
          throw new Error('Invalid response format');
        }
      });
    })
    .then(data => {
      // We already processed SSE responses above,
      // this block handles regular JSON responses only
      if (data && data.status === 'success' && data.message && !data.message.processed) {
      // Clear typing indicator timeout and hide it
      if (typingTimeout) {
        clearTimeout(typingTimeout);
        typingTimeout = null;
      }
      hideTypingIndicator();
      
        // Mark as processed to avoid duplicate messages
        data.message.processed = true;
        
        console.log('Processing JSON response:', data);
      
      // Try different possible response formats
        if (data.message.content) {
          console.log('Using format: data.message.content');
          addMessageToChat(data.message.content, data.message.role || 'assistant');
      } 
        else if (typeof data.message === 'string') {
        console.log('Using format: data.message (string)');
        addMessageToChat(data.message, 'assistant');
      }
        else if (data.data && data.data.message && data.data.message.content) {
          console.log('Using format: data.data.message.content');
          addMessageToChat(data.data.message.content, data.data.message.role || 'assistant');
        } 
        else if (data.data && typeof data.data.message === 'string') {
        console.log('Using format: data.data.message (string)');
        addMessageToChat(data.data.message, 'assistant');
      }
        else if (data.data) {
        // Try to find any message content in the data object
        console.log('Searching for message in data structure');
        
        if (data.data.content) {
          console.log('Found data.data.content');
          addMessageToChat(data.data.content, 'assistant');
        } 
        else if (Array.isArray(data.data) && data.data.length > 0 && data.data[0].content) {
          console.log('Found data.data[0].content');
          addMessageToChat(data.data[0].content, 'assistant');
        }
        else if (data.data.response) {
          console.log('Found data.data.response');
          addMessageToChat(data.data.response, 'assistant');
        }
        else {
          console.error('Could not find message content in response');
        }
      }
      }
    })
    .catch(error => {
      // Clear typing indicator timeout and hide it
      if (typingTimeout) {
        clearTimeout(typingTimeout);
        typingTimeout = null;
      }
      hideTypingIndicator();
      
      console.error('Error sending message:', error);
      
      // Check if the error is a rate limiting error
      if (error.message && error.message.includes('rate limit')) {
        // Use the error message from the server or fallback to our default
        addMessageToChat(error.message || config.rateLimitMessage, 'assistant');
      } else {
        addMessageToChat('Sorry, I had trouble processing your message. Please try again.', 'assistant');
      }
    });
  }
  
  /**
   * Add a message to the chat UI
   * @param {string} text - Message text
   * @param {string} role - Message role (user/assistant)
   * @param {boolean} isIntermediate - Whether this is an intermediate message
   */
  function addMessageToChat(text, role, isIntermediate = false) {
    // Check if this is an intermediate message and we already have one
    if (isIntermediate) {
      // Look for existing intermediate message to update
      const existingMessages = chatMessages.querySelectorAll('.neochat-bot-message.neochat-intermediate');
      if (existingMessages.length > 0) {
        // Update the existing intermediate message instead of adding a new one
        existingMessages[0].innerHTML = parseMarkdown(text);
        scrollToBottom();
        
        // Update in session data
        const intermediateIndex = sessionData.messages.findIndex(m => m.isIntermediate);
        if (intermediateIndex >= 0) {
          sessionData.messages[intermediateIndex].content = text;
          sessionData.messages[intermediateIndex].timestamp = new Date();
        } else {
          // Add to session data if not found
          sessionData.messages.push({
            role,
            content: text,
            timestamp: new Date(),
            isIntermediate: true
          });
        }
        return;
      }
    }
    
    // Create new message element
    const message = document.createElement('div');
    message.className = `neochat-message ${role === 'user' ? 'neochat-user-message' : 'neochat-bot-message'}`;
    
    // Add intermediate class if applicable
    if (isIntermediate) {
      message.classList.add('neochat-intermediate');
      // Add subtle styling for intermediate messages
      message.style.opacity = '0.9';
      message.style.fontStyle = 'italic';
    }
    
    // Use formatted text instead of plain text
    message.innerHTML = parseMarkdown(text);
    
    chatMessages.appendChild(message);

    // Auto-scroll to bottom
    scrollToBottom();
    
    // Add to session data
    const messageData = {
      role,
      content: text,
      timestamp: new Date(),
      isIntermediate: isIntermediate
    };
    sessionData.messages.push(messageData);
    
    // Dispatch message event for custom callbacks
    const messageEvent = new CustomEvent('neochat:message', {
      detail: messageData
    });
    window.dispatchEvent(messageEvent);
  }
})(); 