// Import HuggingFace Inference
const { HfInference } = window;

// Initialize Monaco Editor
require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' } });

// API keys storage
const apiKeys = {
    gemini: '',
    openrouter: '',
};

// Supported languages for the editor
const supportedLanguages = [
    { id: 'html', name: 'HTML' },
    { id: 'css', name: 'CSS' },
    { id: 'javascript', name: 'JavaScript' },
    { id: 'typescript', name: 'TypeScript' },
    { id: 'json', name: 'JSON' },
    { id: 'python', name: 'Python' },
    { id: 'csharp', name: 'C#' },
    { id: 'java', name: 'Java' },
    { id: 'php', name: 'PHP' },
    { id: 'ruby', name: 'Ruby' },
    { id: 'markdown', name: 'Markdown' },
    { id: 'plaintext', name: 'Plain Text' }
];

// Current editor language
let currentEditorLanguage = 'html';

// File system storage
let fileSystem = {
    files: [],
    folders: []
};

// Open files/tabs management
let openFiles = [];
let activeFileId = null;

// Default file templates
const fileTemplates = {
    'html': '<!DOCTYPE html>\n<html>\n<head>\n    <title>New Page</title>\n</head>\n<body>\n    <h1>Hello World</h1>\n</body>\n</html>',
    'css': '/* Add your styles here */\nbody {\n    font-family: Arial, sans-serif;\n    margin: 0;\n    padding: 20px;\n}',
    'javascript': '// Add your JavaScript code here\nconsole.log("Hello World!");\n\nfunction greet(name) {\n    return `Hello, ${name}!`;\n}',
    'typescript': '// Add your TypeScript code here\ninterface Person {\n    name: string;\n    age: number;\n}\n\nfunction greet(person: Person): string {\n    return `Hello, ${person.name}!`;\n}',
    'python': '# Add your Python code here\ndef greet(name):\n    return f"Hello, {name}!"\n\nprint(greet("World"))',
    'json': '{\n    "name": "Project",\n    "version": "1.0.0",\n    "description": "A sample project"\n}',
    'plaintext': 'Add your text here...'
};

// Chat history management
let chatHistory = [];
let currentChatId = null;

// File system management

// Create a new file
function createFile(name, parentFolderId = null, content = '', language = 'plaintext') {
    if (!name) return null;
    
    const extension = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
    const languageId = getLanguageFromExtension(extension) || language;
    
    const newFile = {
        id: 'file_' + Date.now(),
        name: name,
        content: content || getTemplateForLanguage(languageId),
        language: languageId,
        parentFolderId: parentFolderId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    if (parentFolderId) {
        // Add to folder
        const folder = findFolderById(parentFolderId);
        if (folder) {
            if (!folder.files) folder.files = [];
            folder.files.push(newFile.id);
        }
    }
    
    // Add to files array
    fileSystem.files.push(newFile);
    
    saveFileSystem();
    renderFileTree();
    return newFile;
}

// Create a new folder
function createFolder(name, parentFolderId = null) {
    if (!name) return null;
    
    const newFolder = {
        id: 'folder_' + Date.now(),
        name: name,
        files: [],
        folders: [],
        parentFolderId: parentFolderId,
        createdAt: new Date().toISOString()
    };
    
    if (parentFolderId) {
        // Add to parent folder
        const folder = findFolderById(parentFolderId);
        if (folder) {
            if (!folder.folders) folder.folders = [];
            folder.folders.push(newFolder.id);
        }
    }
    
    // Add to folders array
    fileSystem.folders.push(newFolder);
    
    saveFileSystem();
    renderFileTree();
    return newFolder;
}

// Find file by ID
function findFileById(fileId) {
    return fileSystem.files.find(file => file.id === fileId);
}

// Find folder by ID
function findFolderById(folderId) {
    return fileSystem.folders.find(folder => folder.id === folderId);
}

// Delete file
function deleteFile(fileId) {
    const file = findFileById(fileId);
    if (!file) return false;
    
    // Remove from open files if open
    closeFile(fileId);
    
    // Remove from parent folder if in a folder
    if (file.parentFolderId) {
        const folder = findFolderById(file.parentFolderId);
        if (folder && folder.files) {
            folder.files = folder.files.filter(id => id !== fileId);
        }
    }
    
    // Remove from files array
    fileSystem.files = fileSystem.files.filter(f => f.id !== fileId);
    
    saveFileSystem();
    renderFileTree();
    return true;
}

// Delete folder and all contents
function deleteFolder(folderId) {
    const folder = findFolderById(folderId);
    if (!folder) return false;
    
    // Recursively delete all files and subfolders
    if (folder.files) {
        folder.files.forEach(fileId => {
            deleteFile(fileId);
        });
    }
    
    if (folder.folders) {
        folder.folders.forEach(subFolderId => {
            deleteFolder(subFolderId);
        });
    }
    
    // Remove from parent folder if in a folder
    if (folder.parentFolderId) {
        const parentFolder = findFolderById(folder.parentFolderId);
        if (parentFolder) {
            parentFolder.folders = parentFolder.folders.filter(id => id !== folderId);
        }
    }
    
    // Remove from folders array
    fileSystem.folders = fileSystem.folders.filter(f => f.id !== folderId);
    
    saveFileSystem();
    renderFileTree();
    return true;
}

// Rename file
function renameFile(fileId, newName) {
    const file = findFileById(fileId);
    if (!file) return false;
    
    file.name = newName;
    
    // Update extension and language if name changed
    const extension = newName.includes('.') ? newName.split('.').pop().toLowerCase() : '';
    const languageId = getLanguageFromExtension(extension);
    if (languageId) {
        file.language = languageId;
    }
    
    // Update open tab if file is open
    const openFileIndex = openFiles.findIndex(f => f.id === fileId);
    if (openFileIndex >= 0) {
        openFiles[openFileIndex].name = newName;
        renderTabs();
    }
    
    file.updatedAt = new Date().toISOString();
    saveFileSystem();
    renderFileTree();
    return true;
}

// Rename folder
function renameFolder(folderId, newName) {
    const folder = findFolderById(folderId);
    if (!folder) return false;
    
    folder.name = newName;
    saveFileSystem();
    renderFileTree();
    return true;
}

// Save file content
function saveFile(fileId, content) {
    const file = findFileById(fileId);
    if (!file) return false;
    
    file.content = content;
    file.updatedAt = new Date().toISOString();
    
    saveFileSystem();
    return true;
}

// Export file to user's computer
function exportFile(fileId) {
    const file = findFileById(fileId);
    if (!file) return false;
    
    const blob = new Blob([file.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
    return true;
}

// Import file from user's computer
async function importFile(file, parentFolderId = null) {
    try {
        const content = await file.text();
        const extension = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : '';
        const languageId = getLanguageFromExtension(extension) || 'plaintext';
        
        const newFile = createFile(file.name, parentFolderId, content, languageId);
        if (newFile) {
            openFile(newFile.id);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error importing file:', error);
        return false;
    }
}

// Open file in editor
function openFile(fileId) {
    const file = findFileById(fileId);
    if (!file) return false;
    
    // Check if file is already open
    const existingIndex = openFiles.findIndex(f => f.id === fileId);
    if (existingIndex >= 0) {
        activeFileId = fileId;
        renderTabs();
        loadFileContent(fileId);
        return true;
    }
    
    // Add to open files
    openFiles.push({
        id: file.id,
        name: file.name,
        language: file.language
    });
    
    activeFileId = fileId;
    renderTabs();
    loadFileContent(fileId);
    return true;
}

// Close file tab
function closeFile(fileId) {
    const index = openFiles.findIndex(f => f.id === fileId);
    if (index < 0) return false;
    
    openFiles.splice(index, 1);
    
    // If the active file was closed, activate the next available tab
    if (activeFileId === fileId) {
        if (openFiles.length > 0) {
            activeFileId = openFiles[Math.min(index, openFiles.length - 1)].id;
            loadFileContent(activeFileId);
        } else {
            activeFileId = null;
            // Clear editor if no files are open
            if (editor) {
                editor.setValue('');
            }
        }
    }
    
    renderTabs();
    return true;
}

// Load file content into editor
function loadFileContent(fileId) {
    const file = findFileById(fileId);
    if (!file || !editor) return false;
    
    // Change editor language
    changeEditorLanguage(file.language);
    
    // Set content
    editor.setValue(file.content);
    
    // Update active file UI
    document.querySelectorAll('.file-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.id === fileId) {
            item.classList.add('active');
        }
    });
    
    return true;
}

// Save active file content
function saveActiveFile() {
    if (!activeFileId || !editor) return false;
    
    const content = editor.getValue();
    return saveFile(activeFileId, content);
}

// Get language ID from file extension
function getLanguageFromExtension(extension) {
    if (!extension) return 'plaintext';
    
    const extensionMap = {
        'html': 'html',
        'htm': 'html',
        'css': 'css',
        'js': 'javascript',
        'ts': 'typescript',
        'json': 'json',
        'py': 'python',
        'cs': 'csharp',
        'java': 'java',
        'php': 'php',
        'rb': 'ruby',
        'md': 'markdown',
        'txt': 'plaintext'
    };
    
    return extensionMap[extension] || 'plaintext';
}

// Get template for a specific language
function getTemplateForLanguage(languageId) {
    return fileTemplates[languageId] || '';
}

// Save file system to localStorage
function saveFileSystem() {
    try {
        localStorage.setItem('stormEditorFileSystem', JSON.stringify(fileSystem));
    } catch (error) {
        console.error('Error saving file system:', error);
    }
}

// Load file system from localStorage
function loadFileSystem() {
    try {
        const savedData = localStorage.getItem('stormEditorFileSystem');
        if (savedData) {
            fileSystem = JSON.parse(savedData);
            renderFileTree();
        } else {
            // Create default files for first-time users
            createDefaultFiles();
        }
    } catch (error) {
        console.error('Error loading file system:', error);
        // Create default files if there was an error
        createDefaultFiles();
    }
}

// Create default files for first-time users
function createDefaultFiles() {
    createFile('index.html', null, fileTemplates.html, 'html');
    createFile('styles.css', null, fileTemplates.css, 'css');
    createFile('script.js', null, fileTemplates.javascript, 'javascript');
}

// Render file tree in the explorer
function renderFileTree() {
    const fileTree = document.getElementById('file-tree');
    if (!fileTree) return;
    
    fileTree.innerHTML = '';
    
    // Check if file system is empty
    if (fileSystem.files.length === 0 && fileSystem.folders.length === 0) {
        fileTree.innerHTML = '<div class="empty-explorer-message">No files yet. Create or upload a file to get started.</div>';
        return;
    }
    
    // Render root folders
    fileSystem.folders
        .filter(folder => !folder.parentFolderId)
        .forEach(folder => {
            fileTree.appendChild(createFolderElement(folder));
        });
    
    // Render root files
    fileSystem.files
        .filter(file => !file.parentFolderId)
        .forEach(file => {
            fileTree.appendChild(createFileElement(file));
        });
}

// Create folder element for the file tree
function createFolderElement(folder) {
    const folderElement = document.createElement('div');
    folderElement.className = 'folder-item';
    folderElement.dataset.id = folder.id;
    
    const folderIcon = document.createElement('span');
    folderIcon.className = 'folder-icon';
    
    const icon = document.createElement('i');
    icon.className = 'fas fa-folder';
    
    const name = document.createElement('span');
    name.className = 'folder-name';
    name.textContent = folder.name;
    
    const actions = document.createElement('div');
    actions.className = 'folder-actions';
    
    // Create New File button
    const newFileBtn = document.createElement('button');
    newFileBtn.className = 'folder-action-btn';
    newFileBtn.title = 'New File';
    newFileBtn.innerHTML = '<i class="fas fa-file-plus"></i>';
    newFileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        promptNewFile(folder.id);
    });
    
    // Create New Folder button
    const newFolderBtn = document.createElement('button');
    newFolderBtn.className = 'folder-action-btn';
    newFolderBtn.title = 'New Folder';
    newFolderBtn.innerHTML = '<i class="fas fa-folder-plus"></i>';
    newFolderBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        promptNewFolder(folder.id);
    });
    
    // Rename Folder button
    const renameBtn = document.createElement('button');
    renameBtn.className = 'folder-action-btn';
    renameBtn.title = 'Rename';
    renameBtn.innerHTML = '<i class="fas fa-edit"></i>';
    renameBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        promptRenameFolder(folder.id);
    });
    
    // Delete Folder button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'folder-action-btn';
    deleteBtn.title = 'Delete';
    deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        confirmDeleteFolder(folder.id);
    });
    
    actions.appendChild(newFileBtn);
    actions.appendChild(newFolderBtn);
    actions.appendChild(renameBtn);
    actions.appendChild(deleteBtn);
    
    folderElement.appendChild(folderIcon);
    folderElement.appendChild(icon);
    folderElement.appendChild(name);
    folderElement.appendChild(actions);
    
    // Create container for folder contents
    const contentsElement = document.createElement('div');
    contentsElement.className = 'folder-contents';
    
    // Add subfolders
    if (folder.folders && Array.isArray(folder.folders)) {
        folder.folders.forEach(subFolderId => {
            const subFolder = findFolderById(subFolderId);
            if (subFolder) {
                contentsElement.appendChild(createFolderElement(subFolder));
            }
        });
    }
    
    // Add files
    if (folder.files && Array.isArray(folder.files)) {
        folder.files.forEach(fileId => {
            const file = findFileById(fileId);
            if (file) {
                contentsElement.appendChild(createFileElement(file));
            }
        });
    }
    
    folderElement.appendChild(contentsElement);
    
    // Toggle folder expand/collapse
    folderElement.addEventListener('click', () => {
        folderElement.classList.toggle('expanded');
        if (folderElement.classList.contains('expanded')) {
            icon.className = 'fas fa-folder-open';
        } else {
            icon.className = 'fas fa-folder';
        }
    });
    
    return folderElement;
}

// Create file element for the file tree
function createFileElement(file) {
    const fileElement = document.createElement('div');
    fileElement.className = 'file-item';
    fileElement.dataset.id = file.id;
    
    if (file.id === activeFileId) {
        fileElement.classList.add('active');
    }
    
    // Choose icon based on file type
    const icon = document.createElement('i');
    const extension = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : '';
    
    if (['html', 'css', 'js', 'ts', 'py', 'java', 'php', 'cs', 'rb'].includes(extension)) {
        icon.className = 'fas fa-file-code';
    } else if (['md', 'txt', 'json'].includes(extension)) {
        icon.className = 'fas fa-file-alt';
    } else {
        icon.className = 'fas fa-file';
    }
    
    const name = document.createElement('span');
    name.className = 'file-name';
    name.textContent = file.name;
    
    const actions = document.createElement('div');
    actions.className = 'file-actions';
    
    // Rename File button
    const renameBtn = document.createElement('button');
    renameBtn.className = 'file-action-btn';
    renameBtn.title = 'Rename';
    renameBtn.innerHTML = '<i class="fas fa-edit"></i>';
    renameBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        promptRenameFile(file.id);
    });
    
    // Delete File button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'file-action-btn';
    deleteBtn.title = 'Delete';
    deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        confirmDeleteFile(file.id);
    });
    
    // Download File button
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'file-action-btn';
    downloadBtn.title = 'Download';
    downloadBtn.innerHTML = '<i class="fas fa-download"></i>';
    downloadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        exportFile(file.id);
    });
    
    actions.appendChild(renameBtn);
    actions.appendChild(deleteBtn);
    actions.appendChild(downloadBtn);
    
    fileElement.appendChild(icon);
    fileElement.appendChild(name);
    fileElement.appendChild(actions);
    
    // Open file on click
    fileElement.addEventListener('click', () => {
        openFile(file.id);
    });
    
    return fileElement;
}

// Render tabs for open files
function renderTabs() {
    const tabsContainer = document.getElementById('editor-tabs-container');
    if (!tabsContainer) return;
    
    tabsContainer.innerHTML = '';
    
    openFiles.forEach(file => {
        const tabElement = document.createElement('div');
        tabElement.className = 'editor-tab';
        tabElement.dataset.id = file.id;
        
        if (file.id === activeFileId) {
            tabElement.classList.add('active');
        }
        
        // Choose icon based on file type
        const extension = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : '';
        let iconClass = 'fas fa-file';
        
        if (['html', 'css', 'js', 'ts', 'py', 'java', 'php', 'cs', 'rb'].includes(extension)) {
            iconClass = 'fas fa-file-code';
        } else if (['md', 'txt', 'json'].includes(extension)) {
            iconClass = 'fas fa-file-alt';
        }
        
        tabElement.innerHTML = `
            <i class="${iconClass}"></i>
            <span class="tab-title">${file.name}</span>
            <button class="tab-close-btn" title="Close">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        // Handle tab click (activate)
        tabElement.addEventListener('click', (e) => {
            if (!e.target.closest('.tab-close-btn')) {
                activeFileId = file.id;
                renderTabs();
                loadFileContent(file.id);
            }
        });
        
        // Handle tab close button
        tabElement.querySelector('.tab-close-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            closeFile(file.id);
        });
        
        tabsContainer.appendChild(tabElement);
    });
}

// Prompt user to create new file
function promptNewFile(parentFolderId = null) {
    const fileName = prompt('Enter file name:');
    if (fileName) {
        const newFile = createFile(fileName, parentFolderId);
        if (newFile) {
            openFile(newFile.id);
        }
    }
}

// Prompt user to create new folder
function promptNewFolder(parentFolderId = null) {
    const folderName = prompt('Enter folder name:');
    if (folderName) {
        createFolder(folderName, parentFolderId);
    }
}

// Prompt user to rename file
function promptRenameFile(fileId) {
    const file = findFileById(fileId);
    if (!file) return;
    
    const newName = prompt('Enter new file name:', file.name);
    if (newName) {
        renameFile(fileId, newName);
    }
}

// Prompt user to rename folder
function promptRenameFolder(folderId) {
    const folder = findFolderById(folderId);
    if (!folder) return;
    
    const newName = prompt('Enter new folder name:', folder.name);
    if (newName) {
        renameFolder(folderId, newName);
    }
}

// Confirm file deletion
function confirmDeleteFile(fileId) {
    const file = findFileById(fileId);
    if (!file) return;
    
    if (confirm(`Are you sure you want to delete "${file.name}"?`)) {
        deleteFile(fileId);
    }
}

// Confirm folder deletion
function confirmDeleteFolder(folderId) {
    const folder = findFolderById(folderId);
    if (!folder) return;
    
    if (confirm(`Are you sure you want to delete "${folder.name}" and all its contents?`)) {
        deleteFolder(folderId);
    }
}

// Load chat history from localStorage
function loadChatHistory() {
    try {
        const savedChats = localStorage.getItem('stormEditorChatHistory');
        if (savedChats) {
            chatHistory = JSON.parse(savedChats);
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

// Render chat history in the sidebar
function renderChatHistory() {
    const chatHistoryContainer = document.getElementById('chat-history');
    if (!chatHistoryContainer) return;
    
    chatHistoryContainer.innerHTML = '';
    
    if (chatHistory.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-chat-history';
        emptyMessage.textContent = 'No chat history';
        chatHistoryContainer.appendChild(emptyMessage);
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
        });
        
        chatHistoryContainer.appendChild(chatItem);
    });
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
    }
    
    // Save chat history
    try {
        localStorage.setItem('stormEditorChatHistory', JSON.stringify(chatHistory));
    } catch (error) {
        console.error('Error saving chat history:', error);
    }
    
    // Update UI
    renderChatHistory();
    
    return true;
}

// Load a specific chat
function loadChat(chatId) {
    const chat = chatHistory.find(c => c.id === chatId);
    if (!chat) return false;
    
    currentChatId = chatId;
    
    // Clear chat messages
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) {
        chatMessages.innerHTML = '';
        
        // Add messages
        chat.messages.forEach(message => {
            appendMessage(message.content, message.sender, false);
        });
    }
    
    // Update UI
    renderChatHistory();
    
    return true;
}

// Delete a chat
function deleteChat(chatId) {
    if (!chatId) return false;
    
    // Confirm deletion
    if (!confirm('Are you sure you want to delete this chat?')) {
        return false;
    }
    
    // Remove from chat history
    chatHistory = chatHistory.filter(chat => chat.id !== chatId);
    
    // If the deleted chat was the current one, load another chat or create a new one
    if (chatId === currentChatId) {
        if (chatHistory.length > 0) {
            loadChat(chatHistory[0].id);
        } else {
            createNewChat();
        }
    }
    
    // Save chat history
    try {
        localStorage.setItem('stormEditorChatHistory', JSON.stringify(chatHistory));
    } catch (error) {
        console.error('Error saving chat history:', error);
    }
    
    // Update UI
    renderChatHistory();
    
    return true;
}

// Create a new chat
function createNewChat() {
    // Clear chat messages
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) {
        chatMessages.innerHTML = '';
    }
    
    // Create a new chat session
    const newChat = {
        id: 'chat_' + Date.now(),
        title: 'New Chat',
        created: new Date().toISOString(),
        messages: []
    };
    
    // Add to chat history
    chatHistory.unshift(newChat);
    currentChatId = newChat.id;
    
    // Save to localStorage
    try {
        localStorage.setItem('stormEditorChatHistory', JSON.stringify(chatHistory));
    } catch (error) {
        console.error('Error saving chat history:', error);
    }
    
    // Update UI
    renderChatHistory();
    
    return newChat;
}

// Save selected model to localStorage
function saveSelectedModel() {
    try {
        localStorage.setItem('stormEditorSelectedModel', modelSelector.value);
    } catch (error) {
        console.error('Error saving selected model:', error);
    }
}

// Load selected model from localStorage
function loadSelectedModel() {
    try {
        const savedModel = localStorage.getItem('stormEditorSelectedModel');
        if (savedModel && document.querySelector(`#model-selector option[value="${savedModel}"]`)) {
            modelSelector.value = savedModel;
        }
    } catch (error) {
        console.error('Error loading selected model:', error);
    }
}

// Load API keys from localStorage
function loadApiKeys() {
    try {
        const geminiKey = localStorage.getItem('apiKey_gemini');
        const openrouterKey = localStorage.getItem('apiKey_openrouter');
        const openrouterModel = localStorage.getItem('openrouterModel');
        
        if (geminiKey) {
            document.getElementById('gemini-key').value = geminiKey;
            apiKeys.gemini = geminiKey;
        }
        
        if (openrouterKey) {
            document.getElementById('openrouter-key').value = openrouterKey;
            apiKeys.openrouter = openrouterKey;
        }
        
        if (openrouterModel) {
            document.getElementById('openrouter-model').value = openrouterModel;
        }
        
        // Add event listeners for API key toggles
        const toggleBtns = document.querySelectorAll('.toggle-visibility-btn');
        toggleBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const inputId = btn.dataset.for;
                const input = document.getElementById(inputId);
                
                if (input.type === 'password') {
                    input.type = 'text';
                    btn.innerHTML = '<i class="fas fa-eye-slash"></i>';
                } else {
                    input.type = 'password';
                    btn.innerHTML = '<i class="fas fa-eye"></i>';
                }
            });
        });
        
        // Add event listener for saving API keys
        const saveKeysBtn = document.getElementById('save-api-keys');
        saveKeysBtn.addEventListener('click', saveApiKeys);
        
    } catch (error) {
        console.error('Error loading API keys:', error);
    }
}

// Save API keys to localStorage
function saveApiKeys() {
    try {
        const geminiKey = document.getElementById('gemini-key').value.trim();
        const openrouterKey = document.getElementById('openrouter-key').value.trim();
        const openrouterModel = document.getElementById('openrouter-model').value;
        
        if (geminiKey) {
            localStorage.setItem('apiKey_gemini', geminiKey);
            apiKeys.gemini = geminiKey;
        } else {
            localStorage.removeItem('apiKey_gemini');
            apiKeys.gemini = '';
        }
        
        if (openrouterKey) {
            localStorage.setItem('apiKey_openrouter', openrouterKey);
            apiKeys.openrouter = openrouterKey;
        } else {
            localStorage.removeItem('apiKey_openrouter');
            apiKeys.openrouter = '';
        }
        
        if (openrouterModel) {
            localStorage.setItem('openrouterModel', openrouterModel);
        }
        
        appendMessage('API keys saved successfully', 'system');
        updateModelSelector();
        
    } catch (error) {
        console.error('Error saving API keys:', error);
        appendMessage('Failed to save API keys', 'system');
    }
}

// Check if API key is available for the selected model
function checkApiKey(model) {
    const keyMapping = {
        'gemini': 'gemini',
        'openrouter': 'openrouter'
    };
    
    // Paxsenix models don't need API keys
    if (model.startsWith('paxsenix')) {
        return true;
    }
    
    const keyName = keyMapping[model];
    if (!keyName) return true; // If no mapping, assume no key needed
    
    if (!apiKeys[keyName]) {
        appendMessage(`Please set your ${model} API key in the settings panel.`, 'system');
        document.getElementById('settings-tab').click();
        return false;
    }
    
    return true;
}

let editor;
require(['vs/editor/editor.main'], function () {
    editor = monaco.editor.create(document.getElementById('monaco-editor'), {
        value: '// Start coding here...',
        language: 'javascript',
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: {
            enabled: true
        }
    });

    // Set up event listener for editor content changes
    editor.onDidChangeModelContent(() => {
        // If there's an active file, mark its content as changed
        if (activeFileId) {
            const tab = document.querySelector(`.editor-tab[data-id="${activeFileId}"]`);
            if (tab && !tab.classList.contains('unsaved')) {
                tab.classList.add('unsaved');
                const title = tab.querySelector('.tab-title');
                if (title && !title.textContent.endsWith('*')) {
                    title.textContent += '*';
                }
            }
        }
    });
});

// Chat functionality
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendButton = document.getElementById('send-button');
const modelSelector = document.getElementById('model-selector');

// Sidebar and Settings Controls
document.getElementById('toggle-sidebar').addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('hidden');
});

// Tab switching functionality
document.getElementById('chat-tab').addEventListener('click', () => {
    document.getElementById('chat-tab').classList.add('active');
    document.getElementById('settings-tab').classList.remove('active');
    document.getElementById('chat-panel').style.display = 'flex';
    document.getElementById('settings-panel').classList.add('hidden');
});

document.getElementById('settings-tab').addEventListener('click', () => {
    document.getElementById('settings-tab').classList.add('active');
    document.getElementById('chat-tab').classList.remove('active');
    document.getElementById('chat-panel').style.display = 'none';
    document.getElementById('settings-panel').classList.remove('hidden');
});

document.getElementById('toggle-settings').addEventListener('click', () => {
    // Switch to settings tab when settings button is clicked
    document.getElementById('settings-tab').click();
});

document.getElementById('sidebar-width').addEventListener('input', (e) => {
    const sidebar = document.getElementById('sidebar');
    sidebar.style.width = e.target.value + 'px';
});

// Create new chat button
document.getElementById('new-chat-btn').addEventListener('click', createNewChat);

// Password visibility toggle
document.querySelectorAll('.toggle-visibility-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const inputId = btn.getAttribute('data-for');
        const input = document.getElementById(inputId);
        
        if (input.type === 'password') {
            input.type = 'text';
            btn.querySelector('i').className = 'fas fa-eye-slash';
        } else {
            input.type = 'password';
            btn.querySelector('i').className = 'fas fa-eye';
        }
    });
});

// Save API keys button
document.getElementById('save-api-keys').addEventListener('click', saveApiKeys);

// Add model selector change event to save selected model
modelSelector.addEventListener('change', saveSelectedModel);

// Gemini conversation history
const geminiConversationHistory = [];
const MAX_GEMINI_CONVERSATION_HISTORY = 20;

// Model-specific API calls
async function sendMessageGemini(userMessage, editorContent) {
    if (!checkApiKey('gemini')) {
        throw new Error('Gemini API key not set');
    }

    // Manage conversation history
    const userMessagePayload = {
        role: 'user',
        parts: [{
            text: `Current code in editor:
\`\`\`
${editorContent}
\`\`\`

User question: ${userMessage}`
        }]
    };
    
    // Add context from previous messages if available
    let contents = [];
    
    // First add system message
    contents.push({
        role: 'system',
        parts: [{
            text: 'You are a helpful AI coding assistant. Provide clear, concise help with code issues and programming questions.'
        }]
    });
    
    // Then add conversation history
    if (geminiConversationHistory.length > 0) {
        contents = contents.concat(geminiConversationHistory);
    }
    
    // Finally add the current user message
    contents.push(userMessagePayload);
    
    // Keep history within limits
    if (contents.length > MAX_GEMINI_CONVERSATION_HISTORY) {
        // Keep system message (index 0) and remove older messages
        contents = [
            contents[0], 
            ...contents.slice(contents.length - MAX_GEMINI_CONVERSATION_HISTORY + 1)
        ];
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${apiKeys.gemini}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ contents })
    });

    if (!response.ok) {
        throw new Error(`Gemini API request failed with status ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.candidates[0].content.parts[0].text;
    
    // Add user message and AI response to conversation history
    geminiConversationHistory.push(userMessagePayload);
    geminiConversationHistory.push({
        role: 'model',
        parts: [{ text: aiResponse }]
    });
    
    // Truncate history if it exceeds max length
    while (geminiConversationHistory.length > MAX_GEMINI_CONVERSATION_HISTORY) {
        geminiConversationHistory.shift();
    }
    
    return aiResponse;
}

// OpenRouter API integration
async function sendMessageOpenRouter(userMessage, editorContent) {
    if (!checkApiKey('openrouter')) {
        throw new Error('OpenRouter API key not set');
    }

    try {
        console.log('Preparing request to OpenRouter API...');
        
        const selectedModel = document.getElementById('openrouter-model').value;

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKeys.openrouter}`,
            'HTTP-Referer': window.location.href, // Required by OpenRouter
            'X-Title': 'Storm Editor'
        };
        console.log('Request headers:', { ...headers, Authorization: '[REDACTED]' });

        const requestBody = {
            model: selectedModel,
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert coding assistant. Help users write, understand, and debug code with clear explanations and best practices.'
                },
                {
                    role: 'user',
                    content: `Current code in editor:
\`\`\`
${editorContent}
\`\`\`

User question: ${userMessage}`
                }
            ],
            temperature: 0.3
        };

        console.log('Request body:', JSON.stringify(requestBody, null, 2));

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody)
        });

        console.log('Response status:', response.status);
        const responseText = await response.text();
        console.log('Raw response text:', responseText);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}, response: ${responseText}`);
        }

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Failed to parse JSON response:', parseError);
            console.error('Unparseable response text:', responseText);
            throw new Error('Could not parse API response');
        }

        console.log('Parsed response data:', JSON.stringify(data, null, 2));

        // Extract response content
        if (data.choices && data.choices[0] && data.choices[0].message) {
            return data.choices[0].message.content;
        } else {
            throw new Error('Unexpected response format from OpenRouter API');
        }
    } catch (error) {
        console.error('Full error details:', error);
        throw error;
    }
}

// Paxsenix Claude Sonnet conversation history
const paxsenixClaudeConversationHistory = [];
const MAX_PAXSENIX_CLAUDE_CONVERSATION_HISTORY = 10;

async function sendMessagePaxsenixClaude(userMessage, editorContent) {
    try {
        console.log('Preparing request to Paxsenix Claude Sonnet API...');
        
        // Manage conversation history
        const messagePayload = {
            role: 'user',
            content: `Current code in editor:
\`\`\`
${editorContent}
\`\`\`

User question: ${userMessage}`
        };
        
        paxsenixClaudeConversationHistory.push(messagePayload);
        
        // Truncate conversation history if it exceeds max length
        if (paxsenixClaudeConversationHistory.length > MAX_PAXSENIX_CLAUDE_CONVERSATION_HISTORY) {
            paxsenixClaudeConversationHistory.shift();
        }

        const headers = {
            'Content-Type': 'application/json'
        };

        const requestBody = {
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert coding assistant. Help users write, understand, and debug code with clear explanations and best practices.'
                },
                ...paxsenixClaudeConversationHistory
            ],
            stream: false // Explicitly request non-streaming response
        };

        console.log('Request body:', JSON.stringify(requestBody, null, 2));

        const response = await fetch('https://api.paxsenix.biz.id/ai/claudeSonnet', {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody)
        });

        console.log('Response status:', response.status);
        const responseText = await response.text();
        console.log('Raw response text length:', responseText.length);
        console.log('Raw response text preview:', responseText.substring(0, 500) + '...');

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}, response: ${responseText}`);
        }

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Failed to parse JSON response:', parseError);
            console.error('Unparseable response text:', responseText);
            throw new Error('Could not parse API response');
        }

        console.log('Parsed response data preview:', JSON.stringify(data).substring(0, 500) + '...');

        // Try to get full response using text response if JSON is truncated
        const jsonString = JSON.stringify(data);
        if (jsonString.endsWith('}') && !responseText.endsWith('}')) {
            console.warn('JSON response appears to be truncated. Attempting to parse full response directly...');
            // Try to extract the full message using regex
            const messageMatch = responseText.match(/"message"\s*:\s*"((?:\\"|[^"])*?)(?:"|\\\\")(,|\}|$)/);
            if (messageMatch && messageMatch[1]) {
                let extractedMessage = messageMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                console.log('Extracted message from raw response');
                
                // Add AI response to conversation history
                paxsenixClaudeConversationHistory.push({
                    role: 'assistant',
                    content: extractedMessage
                });
                
                return extractedMessage;
            }
        }

        // Flexible response parsing
        let aiResponse;
        if (data.content) {
            // Direct content
            aiResponse = data.content;
        } else if (data.choices && data.choices[0] && data.choices[0].message) {
            // OpenAI-like format
            aiResponse = data.choices[0].message.content;
        } else if (data.message) {
            // Alternative format
            aiResponse = data.message;
        } else {
            // If all parsing fails, try using a different approach - fetch the API again with streaming
            console.warn('Standard response parsing failed. Trying alternative approach with API directly...');
            
            // Use direct approach with URL parameter
            const directResponse = await fetch('https://api.paxsenix.biz.id/ai/claudeSonnet?full=true', {
                method: 'POST',
                headers,
                body: JSON.stringify(requestBody)
            });
            
            if (!directResponse.ok) {
                throw new Error(`HTTP error in fallback request! status: ${directResponse.status}`);
            }
            
            const directResponseText = await directResponse.text();
            
            try {
                const directData = JSON.parse(directResponseText);
                if (directData.message) {
                    aiResponse = directData.message;
                } else if (directData.content) {
                    aiResponse = directData.content;
                } else {
                    throw new Error('Could not find message content in fallback response');
                }
            } catch (fallbackError) {
                console.error('Fallback parsing failed:', fallbackError);
                throw new Error('Invalid response format from Paxsenix Claude Sonnet API - response may be truncated');
            }
        }

        // Check if response might be truncated
        if (aiResponse && aiResponse.includes('```') && !aiResponse.split('```').length % 2 === 1) {
            console.warn('Response appears to contain unclosed code blocks, which may indicate truncation');
            aiResponse += "\n\n[Note: The response appears to be truncated. You may want to try asking for a shorter response or breaking your request into smaller parts.]";
        }

        // Add AI response to conversation history
        paxsenixClaudeConversationHistory.push({
            role: 'assistant',
            content: aiResponse
        });

        return aiResponse;
    } catch (error) {
        console.error('Full error details:', error);
        throw error;
    }
}

// Paxsenix GPT-4O conversation history
const paxsenixGPT4OConversationHistory = [];
const MAX_PAXSENIX_GPT4O_CONVERSATION_HISTORY = 10;

async function sendMessagePaxsenixGPT4O(userMessage, editorContent) {
    try {
        console.log('Preparing request to Paxsenix GPT-4O API...');
        
        // Manage conversation history
        const messagePayload = {
            role: 'user',
            content: `Current code in editor:
\`\`\`
${editorContent}
\`\`\`

User question: ${userMessage}`
        };
        
        paxsenixGPT4OConversationHistory.push(messagePayload);
        
        // Truncate conversation history if it exceeds max length
        if (paxsenixGPT4OConversationHistory.length > MAX_PAXSENIX_GPT4O_CONVERSATION_HISTORY) {
            paxsenixGPT4OConversationHistory.shift();
        }

        const headers = {
            'Content-Type': 'application/json'
        };

        const requestBody = {
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert coding assistant. Help users write, understand, and debug code with clear explanations and best practices.'
                },
                ...paxsenixGPT4OConversationHistory
            ],
            stream: false // Explicitly request non-streaming response
        };

        console.log('Request body:', JSON.stringify(requestBody, null, 2));

        const response = await fetch('https://api.paxsenix.biz.id/ai/gpt4o', {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody)
        });

        console.log('Response status:', response.status);
        const responseText = await response.text();
        console.log('Raw response text length:', responseText.length);
        console.log('Raw response text preview:', responseText.substring(0, 500) + '...');

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}, response: ${responseText}`);
        }

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Failed to parse JSON response:', parseError);
            console.error('Unparseable response text:', responseText);
            throw new Error('Could not parse API response');
        }

        console.log('Parsed response data preview:', JSON.stringify(data).substring(0, 500) + '...');

        // Try to get full response using text response if JSON is truncated
        const jsonString = JSON.stringify(data);
        if (jsonString.endsWith('}') && !responseText.endsWith('}')) {
            console.warn('JSON response appears to be truncated. Attempting to parse full response directly...');
            // Try to extract the full message using regex
            const messageMatch = responseText.match(/"message"\s*:\s*"((?:\\"|[^"])*?)(?:"|\\\\")(,|\}|$)/);
            if (messageMatch && messageMatch[1]) {
                let extractedMessage = messageMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                console.log('Extracted message from raw response');
                
                // Add AI response to conversation history
                paxsenixGPT4OConversationHistory.push({
                    role: 'assistant',
                    content: extractedMessage
                });
                
                return extractedMessage;
            }
        }

        // Flexible response parsing
        let aiResponse;
        if (data.content) {
            aiResponse = data.content;
        } else if (data.choices && data.choices[0] && data.choices[0].message) {
            aiResponse = data.choices[0].message.content;
        } else if (data.message) {
            aiResponse = data.message;
        } else {
            // If all parsing fails, try using a different approach - fetch the API again with streaming
            console.warn('Standard response parsing failed. Trying alternative approach with API directly...');
            
            // Use direct approach with URL parameter
            const directResponse = await fetch('https://api.paxsenix.biz.id/ai/gpt4o?full=true', {
                method: 'POST',
                headers,
                body: JSON.stringify(requestBody)
            });
            
            if (!directResponse.ok) {
                throw new Error(`HTTP error in fallback request! status: ${directResponse.status}`);
            }
            
            const directResponseText = await directResponse.text();
            
            try {
                const directData = JSON.parse(directResponseText);
                if (directData.message) {
                    aiResponse = directData.message;
                } else if (directData.content) {
                    aiResponse = directData.content;
                } else {
                    throw new Error('Could not find message content in fallback response');
                }
            } catch (fallbackError) {
                console.error('Fallback parsing failed:', fallbackError);
                throw new Error('Invalid response format from Paxsenix GPT-4O API - response may be truncated');
            }
        }

        // Check if response might be truncated
        if (aiResponse && aiResponse.includes('```') && !aiResponse.split('```').length % 2 === 1) {
            console.warn('Response appears to contain unclosed code blocks, which may indicate truncation');
            aiResponse += "\n\n[Note: The response appears to be truncated. You may want to try asking for a shorter response or breaking your request into smaller parts.]";
        }

        // Add AI response to conversation history
        paxsenixGPT4OConversationHistory.push({
            role: 'assistant',
            content: aiResponse
        });

        return aiResponse;
    } catch (error) {
        console.error('Full error details:', error);
        throw error;
    }
}

// Implement sendMessagePhi function
async function sendMessagePhi(userMessage, editorContent) {
    try {
        console.log('Preparing request to Paxsenix Phi API...');
        
        const headers = {
            'Content-Type': 'application/json'
        };

        const requestBody = {
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert coding assistant. Help users write, understand, and debug code with clear explanations and best practices.'
                },
                {
                    role: 'user',
                    content: `Current code in editor:
\`\`\`
${editorContent}
\`\`\`

User question: ${userMessage}`
                }
            ],
            stream: false
        };

        console.log('Request body:', JSON.stringify(requestBody, null, 2));

        const response = await fetch('https://api.paxsenix.biz.id/ai/phi', {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody)
        });

        console.log('Response status:', response.status);
        const responseText = await response.text();
        console.log('Raw response text length:', responseText.length);
        console.log('Raw response text preview:', responseText.substring(0, 500) + '...');

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}, response: ${responseText}`);
        }

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Failed to parse JSON response:', parseError);
            console.error('Unparseable response text:', responseText);
            throw new Error('Could not parse API response');
        }

        console.log('Parsed response data preview:', JSON.stringify(data).substring(0, 500) + '...');

        // Try to get full response using text response if JSON is truncated
        const jsonString = JSON.stringify(data);
        if (jsonString.endsWith('}') && !responseText.endsWith('}')) {
            console.warn('JSON response appears to be truncated. Attempting to parse full response directly...');
            // Try to extract the full message using regex
            const messageMatch = responseText.match(/"(content|message)"\s*:\s*"((?:\\"|[^"])*?)(?:"|\\\\")(,|\}|$)/);
            if (messageMatch && messageMatch[2]) {
                let extractedMessage = messageMatch[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                console.log('Extracted message from raw response');
                return extractedMessage;
            }
        }

        // Flexible response parsing
        let aiResponse;
        if (data.content) {
            aiResponse = data.content;
        } else if (data.choices && data.choices[0] && data.choices[0].message) {
            aiResponse = data.choices[0].message.content;
        } else if (data.message) {
            aiResponse = data.message;
        } else {
            // If all parsing fails, try using a different approach - fetch the API again with streaming
            console.warn('Standard response parsing failed. Trying alternative approach with API directly...');
            
            // Use direct approach with URL parameter
            const directResponse = await fetch('https://api.paxsenix.biz.id/ai/phi?full=true', {
                method: 'POST',
                headers,
                body: JSON.stringify(requestBody)
            });
            
            if (!directResponse.ok) {
                throw new Error(`HTTP error in fallback request! status: ${directResponse.status}`);
            }
            
            const directResponseText = await directResponse.text();
            
            try {
                const directData = JSON.parse(directResponseText);
                if (directData.message) {
                    aiResponse = directData.message;
                } else if (directData.content) {
                    aiResponse = directData.content;
                } else {
                    throw new Error('Could not find message content in fallback response');
                }
            } catch (fallbackError) {
                console.error('Fallback parsing failed:', fallbackError);
                throw new Error('Invalid response format from Paxsenix Phi API - response may be truncated');
            }
        }

        // Check if response might be truncated
        if (aiResponse && aiResponse.includes('```') && !aiResponse.split('```').length % 2 === 1) {
            console.warn('Response appears to contain unclosed code blocks, which may indicate truncation');
            aiResponse += "\n\n[Note: The response appears to be truncated. You may want to try asking for a shorter response or breaking your request into smaller parts.]";
        }

        return aiResponse;
                } catch (error) {
        console.error('Full error details:', error);
        throw error;
    }
}

// Flux image generation function
async function generateImageWithFlux(prompt, options = {}) {
    try {
        console.log('Preparing request to Paxsenix Flux Image Generation API...');

        const headers = {
            'Content-Type': 'application/json'
        };

        const requestBody = {
            prompt: prompt,
            model: options.model || 'flux-diffusion-v1',
            width: options.width || 1024,
            height: options.height || 1024,
            num_images: options.num_images || 1,
            steps: options.steps || 50,
            cfg_scale: options.cfg_scale || 7.5,
            negative_prompt: options.negative_prompt || 'low quality, blurry, ugly'
        };

        console.log('Flux Image Generation Request Body:', JSON.stringify(requestBody, null, 2));

        const response = await fetch('https://api.paxsenix.biz.id/ai/flux', {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody)
        });

        console.log('Response status:', response.status);
        const responseText = await response.text();
        console.log('Raw response text length:', responseText.length);
        console.log('Raw response text preview:', responseText.substring(0, 500) + '...');

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}, response: ${responseText}`);
        }

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Failed to parse JSON response:', parseError);
            console.error('Unparseable response text preview:', responseText.substring(0, 1000));
            
            // Try to extract image URLs with regex if JSON parsing fails
            const urlRegex = /"(?:images|urls)":\s*\[\s*"(https:\/\/[^"]+)"/;
            const match = responseText.match(urlRegex);
            
            if (match && match[1]) {
                console.log('Extracted image URL from raw response using regex');
                const extractedUrl = match[1];
                return `### Generated Image\n\n![Generated Image](${extractedUrl})\n\n*Image generated based on prompt: "${prompt}"*`;
            }
            
            throw new Error('Could not parse API response and failed to extract image URLs');
        }

        console.log('Parsed response data preview:', JSON.stringify(data).substring(0, 500) + '...');

        // Flexible image URL extraction
        let imageUrls = [];
        
        // Try all known response formats
        if (Array.isArray(data.images)) {
            imageUrls = data.images;
        } else if (data.data && Array.isArray(data.data.images)) {
            imageUrls = data.data.images;
        } else if (data.urls && Array.isArray(data.urls)) {
            imageUrls = data.urls;
        } else if (typeof data.image === 'string') {
            // Single image URL
            imageUrls = [data.image];
        } else {
            // If we can't find image URLs in expected places, try a more brute-force approach
            const dataStr = JSON.stringify(data);
            const urlMatches = dataStr.match(/"https:\/\/[^"]+\.(jpg|jpeg|png|webp)"/g);
            
            if (urlMatches && urlMatches.length > 0) {
                imageUrls = urlMatches.map(url => url.replace(/"/g, ''));
                console.log('Extracted image URLs using regex from JSON string');
            } else {
                // As a last resort, try the raw response text
                const rawUrlMatches = responseText.match(/"https:\/\/[^"]+\.(jpg|jpeg|png|webp)"/g);
                
                if (rawUrlMatches && rawUrlMatches.length > 0) {
                    imageUrls = rawUrlMatches.map(url => url.replace(/"/g, ''));
                    console.log('Extracted image URLs using regex from raw response text');
                } else {
                    console.error('Unexpected response format. Full response:', JSON.stringify(data).substring(0, 1000));
                    throw new Error('Invalid response format from Paxsenix Flux API - could not locate image URLs');
                }
            }
        }
        
        if (imageUrls.length === 0) {
            throw new Error('No image URLs found in the response');
        }

        // Format response for chat display
        const imageHtml = imageUrls.map(url => `![Generated Image](${url})`).join('\n\n');
        return `### Generated Image(s)\n\n${imageHtml}\n\n*Images generated based on prompt: "${prompt}"*`;
    } catch (error) {
        console.error('Flux Image Generation Error:', error);
        throw error;
    }
}

async function sendMessageToAI(message) {
    const selectedModel = modelSelector.value;
    const editorContent = editor.getValue();
    let response;

    try {
    switch (selectedModel) {
        case 'gemini':
                response = await sendMessageGemini(message, editorContent);
            break;
            case 'openrouter':
                response = await sendMessageOpenRouter(message, editorContent);
            break;
        case 'phi':
                // Return a helpful error message since this model is no longer available
                throw new Error('The Phi model is no longer available. Please select a different model.');
            break;
        case 'paxsenixFluxPro':
            response = await generateImageWithFlux(message);
            break;
        case 'paxsenixClaude':
                response = await sendMessagePaxsenixClaude(message, editorContent);
            break;
        case 'paxsenixGPT4O':
                response = await sendMessagePaxsenixGPT4O(message, editorContent);
            break;
        default:
                throw new Error(`Model ${selectedModel} is not supported. Please select a different model.`);
    }
    return response;
    } catch (error) {
        console.error(`Error with ${selectedModel} API:`, error);
        
        // Check if it's a 404 Not Found error
        if (error.message && error.message.includes('404')) {
            throw new Error(`The ${selectedModel} API endpoint is not available. Please select a different model.`);
        }
        
        throw new Error(`${selectedModel} API error: ${error.message}`);
    }
}

function showThinking() {
    const thinkingDiv = document.createElement('div');
    thinkingDiv.className = 'thinking';
    thinkingDiv.textContent = 'AI is thinking...';
    chatMessages.appendChild(thinkingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return thinkingDiv;
}

function appendMessage(message, sender, saveToHistory = true) {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;
    
    const messageElement = document.createElement('div');
    
    if (sender === 'system') {
        messageElement.className = 'system-message';
        messageElement.textContent = message;
    } else {
        messageElement.className = `chat-message ${sender}-message`;
        
        // Process markdown-like syntax
        let processedContent = message;
        
        // Process code blocks
        processedContent = processCodeBlocks(processedContent);
        
        // Convert links
        processedContent = processedContent.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
        
        // Convert ** to bold
        processedContent = processedContent.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        
        // Convert * to italics
        processedContent = processedContent.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        
        // Convert line breaks to paragraphs
        processedContent = processedContent.split('\n\n').map(p => `<p>${p}</p>`).join('');
        
        // Replace single newlines with line breaks
        processedContent = processedContent.replace(/\n/g, '<br>');
        
        messageElement.innerHTML = processedContent;
    }
    
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Save to chat history if needed
    if (saveToHistory && sender !== 'system') {
        addMessageToCurrentChat(message, sender);
    }
}

async function sendMessage() {
    const chatInput = document.getElementById('chat-input');
    const message = chatInput.value.trim();
    
    if (!message) return;

    // Clear input
    chatInput.value = '';

    // Show user message
    appendMessage(message, 'user');

    // Show AI is thinking message
    showThinking();
    
    try {
        // Call the AI model with the message
        const aiResponse = await sendMessageToAI(message);
        
        // Remove thinking indicator
        const messagesContainer = document.getElementById('chat-messages');
        if (messagesContainer && messagesContainer.lastChild) {
            messagesContainer.removeChild(messagesContainer.lastChild);
        }
        
        // Show AI response
        appendMessage(aiResponse, 'ai');
    } catch (error) {
        // Remove thinking indicator
        const messagesContainer = document.getElementById('chat-messages');
        if (messagesContainer && messagesContainer.lastChild) {
            messagesContainer.removeChild(messagesContainer.lastChild);
        }
        
        // Show error message
        appendMessage(`Error: ${error.message}`, 'error');
        console.error('Error sending message to AI:', error);
    }
}

// Initialize event listeners for chat
document.addEventListener('DOMContentLoaded', () => {
    const sendButton = document.getElementById('send-button');
    const chatInput = document.getElementById('chat-input');
    
    if (sendButton && chatInput) {
        // Send message on button click
        sendButton.addEventListener('click', sendMessage);
        
        // Send message on Enter (but not with Shift+Enter)
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        // Auto resize textarea as user types
        chatInput.addEventListener('input', () => {
            chatInput.style.height = 'auto';
            chatInput.style.height = (chatInput.scrollHeight) + 'px';
        });
    }
});

// Helper function to escape HTML special characters
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Event listeners
sendButton.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Load saved API keys and chat history on startup
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Monaco Editor
    require(['vs/editor/editor.main'], function () {
        try {
            // Get original container
            const originalContainer = document.getElementById('monaco-editor');
            if (!originalContainer) {
                console.error('Monaco editor container not found');
                return;
            }
            
            // Dispose of any existing editor instance before creating a new one
            if (window.editor) {
                window.editor.dispose();
            }
            
            // Completely replace the container to avoid context attribute conflicts
            const parentElement = originalContainer.parentElement;
            const newContainer = document.createElement('div');
            newContainer.id = 'monaco-editor';
            
            // Remove the old container and add the new one
            parentElement.removeChild(originalContainer);
            parentElement.appendChild(newContainer);
            
            // Create editor with options to avoid context key issues
            editor = monaco.editor.create(newContainer, {
                value: '',
                language: currentEditorLanguage,
                theme: 'vs-dark',
                automaticLayout: true,
                minimap: {
                    enabled: true
                },
                ariaLabel: 'Code Editor',
                // Add options to help prevent context attribute issues
                overviewRulerLanes: 0,
                overviewRulerBorder: false,
                contextmenu: false,
                // Add additional options to prevent context conflicts
                renderWhitespace: 'none',
                renderControlCharacters: false,
                renderIndentGuides: false,
                renderValidationDecorations: 'editable',
                renderLineHighlight: 'none'
            });
            
            // Store editor instance globally for proper disposal later
            window.editor = editor;
            
            // Set up event listener for editor content changes
            editor.onDidChangeModelContent(() => {
                // If there's an active file, mark its content as changed
                if (activeFileId) {
                    const tab = document.querySelector(`.editor-tab[data-id="${activeFileId}"]`);
                    if (tab && !tab.classList.contains('unsaved')) {
                        tab.classList.add('unsaved');
                        const title = tab.querySelector('.tab-title');
                        if (title && !title.textContent.endsWith('*')) {
                            title.textContent += '*';
                        }
                    }
                }
            });
            
            // Filter out canceled operation errors from console
            const originalConsoleError = console.error;
            console.error = function(...args) {
                // Filter context key errors more aggressively
                if (args[0] && typeof args[0] === 'string' && 
                    (args[0].includes('Canceled') || 
                     args[0].includes('context attribute') ||
                     args[0].includes('contextKeyService'))) {
                    return; // Silently ignore Monaco errors
                }
                originalConsoleError.apply(console, args);
            };
            
            console.log('Monaco editor initialized successfully');
            
            // Populate language selector
            populateLanguageSelector();
            
            // Initialize file system
            loadFileSystem();
            
            // Setup event listeners for file management
            setupFileManagementListeners();
            
        } catch (error) {
            console.error('Error initializing Monaco editor:', error);
        }
    });
    
    loadApiKeys();
    loadChatHistory();
    updateModelSelector();
    loadSelectedModel(); // Load the previously selected model
    
    // Check if currently selected model is still valid
    const currentModel = modelSelector.value;
    const validModelValues = Array.from(modelSelector.options).map(opt => opt.value);
    
    if (!validModelValues.includes(currentModel)) {
        // If current model is invalid (like phi), switch to a default
        modelSelector.value = 'gemini';
        saveSelectedModel();
    }
});

// Setup file management listeners
function setupFileManagementListeners() {
    // New file button
    document.getElementById('new-file-btn').addEventListener('click', () => {
        promptNewFile();
    });
    
    // New folder button
    document.getElementById('new-folder-btn').addEventListener('click', () => {
        promptNewFolder();
    });
    
    // Add tab button
    document.getElementById('add-tab-btn').addEventListener('click', () => {
        promptNewFile();
    });
    
    // Save file button
    document.getElementById('save-file').addEventListener('click', () => {
        if (saveActiveFile()) {
            appendMessage('File saved successfully', 'system');
            
            // Update tab to remove unsaved indicator
            const tab = document.querySelector(`.editor-tab[data-id="${activeFileId}"]`);
            if (tab) {
                tab.classList.remove('unsaved');
                const title = tab.querySelector('.tab-title');
                if (title && title.textContent.endsWith('*')) {
                    title.textContent = title.textContent.slice(0, -1);
                }
            }
        } else {
            if (!activeFileId) {
                appendMessage('No file is open to save', 'system');
            } else {
                appendMessage('Failed to save file', 'system');
            }
        }
    });
    
    // Upload file button
    document.getElementById('upload-file-btn').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        
        input.addEventListener('change', async (e) => {
            const files = e.target.files;
            if (files.length > 0) {
                for (let i = 0; i < files.length; i++) {
                    await importFile(files[i]);
                }
                appendMessage(`Imported ${files.length} file(s) successfully`, 'system');
            }
        });
        
        input.click();
    });
    
    // Listen for keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl+S or Cmd+S to save
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            
            if (saveActiveFile()) {
                appendMessage('File saved successfully', 'system');
                
                // Update tab to remove unsaved indicator
                const tab = document.querySelector(`.editor-tab[data-id="${activeFileId}"]`);
                if (tab) {
                    tab.classList.remove('unsaved');
                    const title = tab.querySelector('.tab-title');
                    if (title && title.textContent.endsWith('*')) {
                        title.textContent = title.textContent.slice(0, -1);
                    }
                }
            }
        }
    });
}

// Populate language selector dropdown
function populateLanguageSelector() {
    const languageSelector = document.getElementById('editor-language-selector');
    if (!languageSelector) return;
    
    // Clear existing options
    languageSelector.innerHTML = '';
    
    // Add options for each supported language
    supportedLanguages.forEach(lang => {
        const option = document.createElement('option');
        option.value = lang.id;
        option.textContent = lang.name;
        languageSelector.appendChild(option);
    });
    
    // Set current language
    languageSelector.value = currentEditorLanguage;
    
    // Update language label
    updateLanguageLabel();
}

// Update the language label in the editor header
function updateLanguageLabel() {
    const languageLabel = document.querySelector('.editor-language');
    if (!languageLabel) return;
    
    const selectedLanguage = supportedLanguages.find(lang => lang.id === currentEditorLanguage);
    if (selectedLanguage) {
        languageLabel.textContent = selectedLanguage.name;
    }
}

// Change editor language
function changeEditorLanguage(languageId) {
    if (!languageId || !editor) return;
    
    // Update current language
    currentEditorLanguage = languageId;
    
    // Change Monaco editor model language
    const model = editor.getModel();
    if (model) {
        monaco.editor.setModelLanguage(model, languageId);
    }
    
    // Update UI
    updateLanguageLabel();
    
    // If there's an active file, update its language
    if (activeFileId) {
        const file = findFileById(activeFileId);
        if (file) {
            file.language = languageId;
            saveFileSystem();
        }
    }
}

// Preview HTML content
function previewHTML() {
    const content = editor.getValue();
    const previewWindow = window.open('', '_blank');
    
    if (!previewWindow) {
        appendMessage('Preview blocked by popup blocker. Please allow popups for this site.', 'system');
        return;
    }
    
    previewWindow.document.open();
    previewWindow.document.write(content);
    previewWindow.document.close();
}

// Event listeners
// ... existing code ...

// After adding other event listeners, add language and preview functionality
document.addEventListener('DOMContentLoaded', () => {
    // Language selector change event
    const languageSelector = document.getElementById('editor-language-selector');
    if (languageSelector) {
        languageSelector.addEventListener('change', (e) => {
            changeEditorLanguage(e.target.value);
        });
    }
    
    // Preview button click event
    const previewButton = document.getElementById('preview-code');
    if (previewButton) {
        previewButton.addEventListener('click', () => {
            if (currentEditorLanguage === 'html') {
                previewHTML();
        } else {
                appendMessage('Preview is only available for HTML content.', 'system');
            }
        });
    }
});

// Update model selector to include all available models
function updateModelSelector() {
    const modelSelector = document.getElementById('model-selector');
    
    // Clear existing options
    modelSelector.innerHTML = '';

    // Add model options
    const models = [
        { value: 'gemini', text: 'Gemini 2.0 Flash' },
        { value: 'openrouter', text: 'OpenRouter API' },
        { value: 'paxsenixFluxPro', text: 'Flux Pro (Image Generation)' },
        { value: 'paxsenixClaude', text: 'Claude 3.5 Sonnet' },
        { value: 'paxsenixGPT4O', text: 'GPT-4o' }
    ];

    models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.value;
        option.textContent = model.text;
        modelSelector.appendChild(option);
    });
}

// Preview the current code
function previewCode() {
    if (!editor) return;
    
    const content = editor.getValue();
    const language = currentEditorLanguage;
    
    // Handle different languages
    if (language === 'html') {
        // Preview HTML
        const previewWindow = window.open('', '_blank');
        if (!previewWindow) {
            appendMessage('Preview blocked by popup blocker. Please allow popups for this site.', 'system');
            return;
        }
        previewWindow.document.write(content);
        previewWindow.document.close();
    } 
    else if (language === 'markdown') {
        // Preview Markdown
        const previewWindow = window.open('', '_blank');
        if (!previewWindow) {
            appendMessage('Preview blocked by popup blocker. Please allow popups for this site.', 'system');
            return;
        }
        
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Markdown Preview</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; padding: 20px; max-width: 800px; margin: 0 auto; }
                    pre { background-color: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto; }
                    code { background-color: #f5f5f5; padding: 2px 4px; border-radius: 3px; font-family: monospace; }
                    blockquote { border-left: 4px solid #ddd; padding-left: 15px; color: #777; }
                    img { max-width: 100%; }
                    table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f5f5f5; }
                </style>
                <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
            </head>
            <body>
                <div id="content"></div>
                <script>
                    document.getElementById('content').innerHTML = marked.parse(\`${content.replace(/`/g, '\\`')}\`);
                </script>
            </body>
            </html>
        `;
        
        previewWindow.document.write(html);
        previewWindow.document.close();
    }
    else if (language === 'css') {
        // Preview CSS with sample HTML
        const previewWindow = window.open('', '_blank');
        if (!previewWindow) {
            appendMessage('Preview blocked by popup blocker. Please allow popups for this site.', 'system');
            return;
        }
        
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>CSS Preview</title>
                <style>
                    ${content}
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>CSS Preview</h1>
                    <p>This is a preview of your CSS styles applied to sample HTML elements.</p>
                    
                    <div class="section">
                        <h2>Typography</h2>
                        <h1>Heading 1</h1>
                        <h2>Heading 2</h2>
                        <h3>Heading 3</h3>
                        <p>This is a paragraph of text. <a href="#">This is a link</a>.</p>
                        <blockquote>This is a blockquote.</blockquote>
                    </div>
                    
                    <div class="section">
                        <h2>UI Elements</h2>
                        <button>Button</button>
                        <input type="text" placeholder="Text input">
                        <select>
                            <option>Select option 1</option>
                            <option>Select option 2</option>
                        </select>
                    </div>
                    
                    <div class="section">
                        <h2>Lists</h2>
                        <ul>
                            <li>Unordered list item 1</li>
                            <li>Unordered list item 2</li>
                            <li>Unordered list item 3</li>
                        </ul>
                        
                        <ol>
                            <li>Ordered list item 1</li>
                            <li>Ordered list item 2</li>
                            <li>Ordered list item 3</li>
                        </ol>
                    </div>
                </div>
            </body>
            </html>
        `;
        
        previewWindow.document.write(html);
        previewWindow.document.close();
    }
    else if (language === 'javascript' || language === 'typescript') {
        // Preview JavaScript/TypeScript with a console
        const previewWindow = window.open('', '_blank');
        if (!previewWindow) {
            appendMessage('Preview blocked by popup blocker. Please allow popups for this site.', 'system');
            return;
        }
        
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>JavaScript Preview</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; padding: 20px; max-width: 800px; margin: 0 auto; }
                    #console { background-color: #f5f5f5; border: 1px solid #ddd; padding: 10px; border-radius: 4px; height: 300px; overflow-y: auto; font-family: monospace; margin-top: 20px; }
                    pre { margin: 0; white-space: pre-wrap; }
                    .log { color: #333; }
                    .error { color: #d9534f; }
                    .warn { color: #f0ad4e; }
                    .info { color: #5bc0de; }
                    button { background-color: #0275d8; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; }
                    button:hover { background-color: #025aa5; }
                </style>
            </head>
            <body>
                <h1>JavaScript Preview</h1>
                <p>Click "Run Code" to execute your JavaScript code. Results will appear in the console below.</p>
                <button id="run-btn">Run Code</button>
                <div id="console"></div>
                
                <script>
                    // Store the code
                    const code = \`${content.replace(/`/g, '\\`')}\`;
                    
                    // Get elements
                    const consoleOutput = document.getElementById('console');
                    const runButton = document.getElementById('run-btn');
                    
                    // Override console methods
                    const originalConsole = {
                        log: console.log,
                        error: console.error,
                        warn: console.warn,
                        info: console.info
                    };
                    
                    function appendToConsole(type, args) {
                        const line = document.createElement('pre');
                        line.className = type;
                        line.textContent = Array.from(args).map(arg => 
                            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                        ).join(' ');
                        consoleOutput.appendChild(line);
                        consoleOutput.scrollTop = consoleOutput.scrollHeight;
                    }
                    
                    console.log = function() {
                        appendToConsole('log', arguments);
                        originalConsole.log.apply(console, arguments);
                    };
                    
                    console.error = function() {
                        appendToConsole('error', arguments);
                        originalConsole.error.apply(console, arguments);
                    };
                    
                    console.warn = function() {
                        appendToConsole('warn', arguments);
                        originalConsole.warn.apply(console, arguments);
                    };
                    
                    console.info = function() {
                        appendToConsole('info', arguments);
                        originalConsole.info.apply(console, arguments);
                    };
                    
                    // Run code function
                    runButton.addEventListener('click', function() {
                        // Clear console
                        consoleOutput.innerHTML = '';
                        
                        try {
                            // Execute the code
                            const executeFn = new Function(code);
                            executeFn();
                        } catch (error) {
                            console.error('Error:', error.message);
                        }
                    });
                    
                    // Auto-run on load
                    runButton.click();
                </script>
            </body>
            </html>
        `;
        
        previewWindow.document.write(html);
        previewWindow.document.close();
    }
    else {
        // For other languages, just show syntax-highlighted code
        const previewWindow = window.open('', '_blank');
        if (!previewWindow) {
            appendMessage('Preview blocked by popup blocker. Please allow popups for this site.', 'system');
            return;
        }
        
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Code Preview</title>
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/atom-one-dark.min.css">
                <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/highlight.min.js"></script>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; padding: 20px; max-width: 800px; margin: 0 auto; }
                    .code-container { background-color: #282c34; border-radius: 4px; overflow: hidden; }
                    .language-header { background-color: #21252b; color: #abb2bf; padding: 8px 16px; font-family: monospace; }
                </style>
            </head>
            <body>
                <h1>Code Preview</h1>
                <div class="language-header">${language}</div>
                <div class="code-container">
                    <pre><code class="language-${language}">${escapeHtml(content)}</code></pre>
                </div>
                
                <script>
                    document.addEventListener('DOMContentLoaded', function() {
                        document.querySelectorAll('pre code').forEach((block) => {
                            hljs.highlightBlock(block);
                        });
                    });
                </script>
            </body>
            </html>
        `;
        
        previewWindow.document.write(html);
        previewWindow.document.close();
    }
}

// Document initialization
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Monaco Editor
    require(['vs/editor/editor.main'], function () {
        try {
            // Get original container
            const originalContainer = document.getElementById('monaco-editor');
            if (!originalContainer) {
                console.error('Monaco editor container not found');
                return;
            }
            
            // Dispose of any existing editor instance before creating a new one
            if (window.editor) {
                window.editor.dispose();
            }
            
            // Completely replace the container to avoid context attribute conflicts
            const parentElement = originalContainer.parentElement;
            const newContainer = document.createElement('div');
            newContainer.id = 'monaco-editor';
            
            // Remove the old container and add the new one
            parentElement.removeChild(originalContainer);
            parentElement.appendChild(newContainer);
            
            // Create editor with options to avoid context key issues
            editor = monaco.editor.create(newContainer, {
                value: '',
                language: currentEditorLanguage,
                theme: 'vs-dark',
                automaticLayout: true,
                minimap: {
                    enabled: true
                },
                ariaLabel: 'Code Editor',
                // Add options to help prevent context attribute issues
                overviewRulerLanes: 0,
                overviewRulerBorder: false,
                contextmenu: false,
                // Add additional options to prevent context conflicts
                renderWhitespace: 'none',
                renderControlCharacters: false,
                renderIndentGuides: false,
                renderValidationDecorations: 'editable',
                renderLineHighlight: 'none'
            });
            
            // Store editor instance globally for proper disposal later
            window.editor = editor;
            
            // Set up event listener for editor content changes
            editor.onDidChangeModelContent(() => {
                // If there's an active file, mark its content as changed
                if (activeFileId) {
                    const tab = document.querySelector(`.editor-tab[data-id="${activeFileId}"]`);
                    if (tab && !tab.classList.contains('unsaved')) {
                        tab.classList.add('unsaved');
                        const title = tab.querySelector('.tab-title');
                        if (title && !title.textContent.endsWith('*')) {
                            title.textContent += '*';
                        }
                    }
                }
            });
            
            // Filter out canceled operation errors from console
            const originalConsoleError = console.error;
            console.error = function(...args) {
                // Filter context key errors more aggressively
                if (args[0] && typeof args[0] === 'string' && 
                    (args[0].includes('Canceled') || 
                     args[0].includes('context attribute') ||
                     args[0].includes('contextKeyService'))) {
                    return; // Silently ignore Monaco errors
                }
                originalConsoleError.apply(console, args);
            };
            
            console.log('Monaco editor initialized successfully');
            
    } catch (error) {
            console.error('Error initializing Monaco editor:', error);
        }
    });
    
    // Setup all functionality
    setupApplicationFeatures();
});

// Setup all application functionality
function setupApplicationFeatures() {
    // Load settings and configurations
    loadApiKeys();
    loadFileSystem();
    loadChatHistory();
    updateModelSelector();
    loadSelectedModel();
    
    // Populate the language selector
    setupLanguageSelector();
    
    // Setup events for file/folder management
    setupFileManagementListeners();
    
    // Set up language selector
    const languageSelector = document.getElementById('editor-language-selector');
    if (languageSelector) {
        languageSelector.addEventListener('change', (e) => {
            changeEditorLanguage(e.target.value);
        });
    }
    
    // Setup preview button
    const previewButton = document.getElementById('preview-code');
    if (previewButton) {
        previewButton.addEventListener('click', previewCode);
    }
}

// Setup language selector
function setupLanguageSelector() {
    const languageSelector = document.getElementById('editor-language-selector');
    if (!languageSelector) return;
    
    // Clear existing options
    languageSelector.innerHTML = '';
    
    // Add options for each supported language
    supportedLanguages.forEach(lang => {
        const option = document.createElement('option');
        option.value = lang.id;
        option.textContent = lang.name;
        languageSelector.appendChild(option);
    });
    
    // Set current language
    languageSelector.value = currentEditorLanguage;
    
    // Update language label
    updateLanguageLabel();
}

// Change editor language
function changeEditorLanguage(languageId) {
    if (!languageId || !editor) return;
    
    // Update current language
    currentEditorLanguage = languageId;
    
    // Change Monaco editor model language
    const model = editor.getModel();
    if (model) {
        monaco.editor.setModelLanguage(model, languageId);
    }
    
    // Update UI
    updateLanguageLabel();
    
    // If there's an active file, update its language
    if (activeFileId) {
        const file = findFileById(activeFileId);
        if (file) {
            file.language = languageId;
            saveFileSystem();
        }
    }
}

// Toggle sidebar visibility
document.addEventListener('DOMContentLoaded', () => {
    const toggleSidebarBtn = document.getElementById('toggle-sidebar');
    if (toggleSidebarBtn) {
        toggleSidebarBtn.addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
            if (sidebar) {
    sidebar.classList.toggle('hidden');
            }
        });
    }
    
    // Tab switching in sidebar
    const chatTab = document.getElementById('chat-tab');
    const settingsTab = document.getElementById('settings-tab');
    const chatPanel = document.getElementById('chat-panel');
    const settingsPanel = document.getElementById('settings-panel');

    if (chatTab && settingsTab && chatPanel && settingsPanel) {
        chatTab.addEventListener('click', () => {
            chatTab.classList.add('active');
            settingsTab.classList.remove('active');
            chatPanel.classList.remove('hidden');
            settingsPanel.classList.add('hidden');
        });
        
        settingsTab.addEventListener('click', () => {
            settingsTab.classList.add('active');
            chatTab.classList.remove('active');
            settingsPanel.classList.remove('hidden');
            chatPanel.classList.add('hidden');
        });
    }
});

// Process code blocks in messages
function processCodeBlocks(text) {
    // Match ```language\ncode``` blocks
    const codeBlockRegex = /```([\w-]*)\n([\s\S]*?)```/g;
    
    return text.replace(codeBlockRegex, (match, language, code) => {
        // Clean up the language identifier
        language = language.trim().toLowerCase();
        if (!language) {
            language = 'plaintext';
        }
        
        // Create the code block HTML
        return `
            <div class="code-block">
                <div class="code-header">
                    <span class="code-language">${language}</span>
                    <div class="code-actions">
                        <button class="code-action-btn copy-btn" onclick="copyCodeToClipboard(this)">
                            <i class="fas fa-copy"></i> Copy
                        </button>
                        ${language !== 'plaintext' ? `
                            <button class="code-action-btn implement-btn" onclick="implementCode(this)">
                                <i class="fas fa-code"></i> Implement
                            </button>
                        ` : ''}
                    </div>
                </div>
                <pre><code class="${language}">${escapeHtml(code)}</code></pre>
            </div>
        `;
    });
}

// Escape HTML entities
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Show "AI is thinking" indicator
function showThinking() {
    appendMessage('AI is thinking...', 'system', false);
}
