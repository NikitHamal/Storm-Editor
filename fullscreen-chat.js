// Chat history and current chat state
let chatHistory = [];
let currentChatId = null;
const MAX_CONVERSATIONS = 10;

// DOM Elements
const chatMessagesContainer = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendButton = document.getElementById('send-button');
const newChatButton = document.getElementById('new-chat-btn');
const toggleHistoryButton = document.getElementById('toggle-history-btn');
const backToEditorButton = document.getElementById('back-to-editor-btn');
const chatSidebar = document.getElementById('chat-sidebar');
const closeSidebarButton = document.getElementById('close-sidebar-btn');
const chatHistoryList = document.getElementById('chat-history-list');

// Initialize the chat
document.addEventListener('DOMContentLoaded', () => {
    loadChatHistory();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Send message on button click
    sendButton.addEventListener('click', sendMessage);
    
    // Send message on Enter key (but allow Shift+Enter for new lines)
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Create new chat
    newChatButton.addEventListener('click', createNewChat);
    
    // Toggle chat history sidebar
    toggleHistoryButton.addEventListener('click', () => {
        chatSidebar.classList.toggle('visible');
    });
    
    // Close sidebar
    closeSidebarButton.addEventListener('click', () => {
        chatSidebar.classList.remove('visible');
    });
    
    // Back to editor
    backToEditorButton.addEventListener('click', () => {
        window.location.href = 'index.html';
    });
    
    // Handle mobile touch events for better mobile experience
    setupMobileEvents();
}

// Setup mobile-specific events
function setupMobileEvents() {
    // Add touch event handling for mobile swipe to show/hide sidebar
    let touchStartX = 0;
    let touchEndX = 0;
    
    document.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, false);
    
    document.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, false);
    
    function handleSwipe() {
        const swipeThreshold = 100;
        if (touchEndX - touchStartX > swipeThreshold) {
            // Swipe right - show sidebar
            chatSidebar.classList.add('visible');
        } else if (touchStartX - touchEndX > swipeThreshold) {
            // Swipe left - hide sidebar
            chatSidebar.classList.remove('visible');
        }
    }
    
    // Adjust textarea height on mobile
    chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = (chatInput.scrollHeight) + 'px';
    });
}

// Load chat history from localStorage
function loadChatHistory() {
    try {
        const savedChats = localStorage.getItem('stormEditorChatHistory');
        if (savedChats) {
            chatHistory = JSON.parse(savedChats);
            
            // Limit to MAX_CONVERSATIONS
            if (chatHistory.length > MAX_CONVERSATIONS) {
                chatHistory = chatHistory.slice(0, MAX_CONVERSATIONS);
                saveChatHistory();
            }
            
            renderChatHistory();
            
            // Load the most recent chat if available
            if (chatHistory.length > 0) {
                loadChat(chatHistory[0].id);
            } else {
                createNewChat();
            }
        } else {
            createNewChat();
        }
    } catch (error) {
        console.error('Error loading chat history:', error);
        createNewChat();
    }
}

// Save chat history to localStorage
function saveChatHistory() {
    try {
        localStorage.setItem('stormEditorChatHistory', JSON.stringify(chatHistory));
    } catch (error) {
        console.error('Error saving chat history:', error);
    }
}

// Render chat history in the sidebar
function renderChatHistory() {
    chatHistoryList.innerHTML = '';
    
    if (chatHistory.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-chat-history';
        emptyMessage.textContent = 'No chat history';
        chatHistoryList.appendChild(emptyMessage);
        return;
    }
    
    chatHistory.forEach(chat => {
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-history-item';
        if (chat.id === currentChatId) {
            chatItem.classList.add('active');
        }
        
        const chatTitle = document.createElement('div');
        chatTitle.className = 'chat-history-title';
        chatTitle.textContent = chat.title || 'Untitled Chat';
        
        const chatActions = document.createElement('div');
        chatActions.className = 'chat-history-actions';
        
        const deleteButton = document.createElement('button');
        deleteButton.className = 'chat-history-action delete-chat';
        deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
        deleteButton.title = 'Delete chat';
        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteChat(chat.id);
        });
        
        chatActions.appendChild(deleteButton);
        chatItem.appendChild(chatTitle);
        chatItem.appendChild(chatActions);
        
        chatItem.addEventListener('click', () => {
            loadChat(chat.id);
            chatSidebar.classList.remove('visible');
        });
        
        chatHistoryList.appendChild(chatItem);
    });
}

// Load a specific chat
function loadChat(chatId) {
    const chat = chatHistory.find(c => c.id === chatId);
    if (!chat) return;
    
    currentChatId = chatId;
    chatMessagesContainer.innerHTML = '';
    
    // Display all messages in the chat
    chat.messages.forEach(message => {
        appendMessage(message.content, message.sender, false);
    });
    
    // Scroll to the bottom of the chat
    scrollToBottom();
    
    // Update active state in chat history
    renderChatHistory();
}

// Delete a chat
function deleteChat(chatId) {
    const confirmDelete = confirm('Are you sure you want to delete this chat?');
    if (!confirmDelete) return;
    
    const chatIndex = chatHistory.findIndex(c => c.id === chatId);
    if (chatIndex === -1) return;
    
    chatHistory.splice(chatIndex, 1);
    saveChatHistory();
    
    // If the current chat was deleted, load another chat or create a new one
    if (currentChatId === chatId) {
        if (chatHistory.length > 0) {
            loadChat(chatHistory[0].id);
        } else {
            createNewChat();
        }
    } else {
        renderChatHistory();
    }
}

// Create a new chat
function createNewChat() {
    const newChat = {
        id: Date.now().toString(),
        title: 'New Chat',
        messages: [],
        createdAt: new Date().toISOString()
    };
    
    // Add welcome message
    newChat.messages.push({
        id: Date.now().toString() + '-welcome',
        content: 'Hello! I\'m your AI assistant. How can I help you today?',
        sender: 'ai',
        timestamp: new Date().toISOString()
    });
    
    // Add the new chat to the beginning of the history
    chatHistory.unshift(newChat);
    
    // Limit to MAX_CONVERSATIONS
    if (chatHistory.length > MAX_CONVERSATIONS) {
        chatHistory = chatHistory.slice(0, MAX_CONVERSATIONS);
    }
    
    saveChatHistory();
    loadChat(newChat.id);
    
    // Close sidebar if open
    chatSidebar.classList.remove('visible');
}

// Add a message to the current chat
function addMessageToCurrentChat(content, sender) {
    if (!currentChatId) return false;
    
    const chat = chatHistory.find(c => c.id === currentChatId);
    if (!chat) return false;
    
    chat.messages.push({
        id: Date.now().toString(),
        content,
        sender,
        timestamp: new Date().toISOString()
    });
    
    // Update chat title based on the first user message
    if (sender === 'user' && chat.messages.filter(m => m.sender === 'user').length === 1) {
        // Use the first 30 characters of the first user message as the title
        chat.title = content.substring(0, 30) + (content.length > 30 ? '...' : '');
        renderChatHistory();
    }
    
    // Save chat history
    saveChatHistory();
    
    return true;
}

// Send a message
async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;
    
    // Clear input
    chatInput.value = '';
    chatInput.style.height = 'auto';
    
    // Add user message to UI
    appendMessage(message, 'user');
    
    // Add user message to chat history
    addMessageToCurrentChat(message, 'user');
    
    // Show thinking indicator
    showThinking();
    
    try {
        // Get AI response
        const response = await getAIResponse(message);
        
        // Remove thinking indicator
        removeThinking();
        
        // Add AI response to UI
        appendMessage(response, 'ai');
        
        // Add AI response to chat history
        addMessageToCurrentChat(response, 'ai');
    } catch (error) {
        console.error('Error getting AI response:', error);
        
        // Remove thinking indicator
        removeThinking();
        
        // Show error message
        appendMessage('Sorry, I encountered an error. Please try again.', 'system');
    }
}

// Show thinking indicator
function showThinking() {
    const thinkingElement = document.createElement('div');
    thinkingElement.className = 'chat-message ai-message thinking';
    thinkingElement.innerHTML = `
        <div class="thinking-dots">
            <span class="thinking-dot"></span>
            <span class="thinking-dot"></span>
            <span class="thinking-dot"></span>
        </div>
    `;
    chatMessagesContainer.appendChild(thinkingElement);
    scrollToBottom();
}

// Remove thinking indicator
function removeThinking() {
    const thinkingElement = document.querySelector('.thinking');
    if (thinkingElement) {
        thinkingElement.remove();
    }
}

// Append a message to the chat UI
function appendMessage(content, sender, saveToHistory = true) {
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${sender}-message`;
    
    // Process content for markdown and code blocks
    const processedContent = processContent(content);
    
    messageElement.innerHTML = processedContent;
    chatMessagesContainer.appendChild(messageElement);
    
    // Add syntax highlighting to code blocks
    highlightCodeBlocks();
    
    // Scroll to the bottom
    scrollToBottom();
}

// Process content for markdown and code blocks
function processContent(content) {
    // Escape HTML to prevent XSS
    let processedContent = escapeHtml(content);
    
    // Process code blocks
    processedContent = processCodeBlocks(processedContent);
    
    // Process markdown
    processedContent = processMarkdown(processedContent);
    
    return processedContent;
}

// Process code blocks in the message
function processCodeBlocks(text) {
    // Replace ```language\ncode\n``` with code blocks
    return text.replace(/```([a-zA-Z]*)\n([\s\S]*?)\n```/g, (match, language, code) => {
        return `
            <div class="code-block">
                <div class="code-header">
                    <span class="code-language">${language || 'plaintext'}</span>
                    <div class="code-actions">
                        <button class="code-action-btn copy-btn" title="Copy code">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>
                <pre><code class="language-${language || 'plaintext'}">${escapeHtml(code)}</code></pre>
            </div>
        `;
    });
}

// Process markdown in the message
function processMarkdown(text) {
    // Bold: **text** or __text__
    text = text.replace(/(\*\*|__)(.*?)\1/g, '<strong>$2</strong>');
    
    // Italic: *text* or _text_
    text = text.replace(/(\*|_)(.*?)\1/g, '<em>$2</em>');
    
    // Links: [text](url)
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    
    // Lists: - item or * item
    text = text.replace(/^([\s]*)[-*]\s+(.*?)$/gm, '$1<li>$2</li>');
    text = text.replace(/(<li>.*?<\/li>)/gs, '<ul>$1</ul>');
    
    // Paragraphs: separate by new lines
    text = text.replace(/\n\n/g, '</p><p>');
    text = `<p>${text}</p>`;
    
    // Fix nested paragraphs in lists
    text = text.replace(/<li><p>(.*?)<\/p><\/li>/g, '<li>$1</li>');
    
    return text;
}

// Highlight code blocks
function highlightCodeBlocks() {
    document.querySelectorAll('.code-block pre code').forEach(block => {
        // Add copy functionality to code blocks
        const copyButton = block.parentElement.parentElement.querySelector('.copy-btn');
        if (copyButton) {
            copyButton.addEventListener('click', () => {
                const code = block.textContent;
                navigator.clipboard.writeText(code).then(() => {
                    copyButton.innerHTML = '<i class="fas fa-check"></i>';
                    setTimeout(() => {
                        copyButton.innerHTML = '<i class="fas fa-copy"></i>';
                    }, 2000);
                });
            });
        }
    });
}

// Escape HTML to prevent XSS
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Scroll to the bottom of the chat
function scrollToBottom() {
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

// Get AI response (mock implementation - replace with actual API call)
async function getAIResponse(message) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // For demo purposes, return a mock response
    const responses = [
        "I'm here to help! What would you like to know?",
        "That's an interesting question. Let me think about it...",
        "Here's what I found about that topic:\n\n```javascript\nconst example = () => {\n  console.log('This is a code example');\n};\n```",
        "I understand your question. Let me explain in more detail.",
        "That's a great point! I'd like to add that there are multiple approaches to solving this problem.",
        "I'm not sure I understand. Could you please provide more details?",
        "Based on what you've told me, I recommend the following steps:\n\n1. First, analyze the problem\n2. Then, break it down into smaller parts\n3. Finally, implement a solution",
        "Let me show you an example:\n\n```python\ndef example():\n    print('Hello, world!')\n```",
        "I'm sorry, but I don't have enough information to answer that question accurately.",
        "That's correct! You've got a good understanding of the concept."
    ];
    
    // Return a random response
    return responses[Math.floor(Math.random() * responses.length)];
} 