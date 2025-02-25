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
    if (!folder) return false;
    
    if (confirm(`Are you sure you want to delete "${folder.name}" and all its contents?`)) {
        deleteFolder(folderId);
    }
}

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