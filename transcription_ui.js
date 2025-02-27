import {
    saveTranscription,
    loadTranscriptions,
    saveAudioBlob,
    playTranscriptionAudio,
    deleteTranscription,
    getTranscription,
    loadAudio
} from './transcription_storage.js';

// Create and append transcription UI elements
function createTranscriptionUI() {
    const container = document.createElement('div');
    container.className = 'transcription-history';
    container.innerHTML = `
        <style>
            .transcription-history {
                margin-top: 20px;
                padding: 20px;
                background: var(--light-gray);
                border-radius: var(--radius);
            }
            
            .transcription-item {
                background: white;
                padding: 15px;
                margin-bottom: 15px;
                border-radius: var(--radius);
                box-shadow: var(--shadow-sm);
            }
            
            .transcription-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
            }
            
            .transcription-controls {
                display: flex;
                gap: 10px;
            }
            
            .transcription-metadata {
                font-size: 0.9em;
                color: var(--dark-gray);
                margin-bottom: 10px;
            }
            
            .transcription-text {
                white-space: pre-wrap;
                line-height: 1.5;
            }
            
            .control-button {
                padding: 5px 10px;
                border: none;
                border-radius: var(--radius);
                cursor: pointer;
                font-size: 0.9em;
                transition: var(--transition);
            }
            
            .play-button {
                background: var(--primary-color);
                color: white;
            }
            
            .delete-button {
                background: var(--accent-color);
                color: white;
            }
            
            .control-button:hover {
                opacity: 0.9;
                transform: translateY(-1px);
            }
            
            .audio-player {
                width: 100%;
                margin-top: 10px;
                margin-bottom: 15px;
            }
            
            .word {
                display: inline;
                padding: 2px 0;
                border-radius: 2px;
                transition: background-color 0.2s;
            }
            
            .word.active {
                background-color: rgba(99, 102, 241, 0.2);
            }
            
            .word-container {
                margin-top: 15px;
                line-height: 1.8;
            }
        </style>
        <h2>Transcription History</h2>
        <div class="transcription-list"></div>
    `;
    
    document.querySelector('.container').appendChild(container);
    return container;
}

// Render a single transcription item
async function renderTranscriptionItem(transcription) {
    const item = document.createElement('div');
    item.className = 'transcription-item';
    item.dataset.id = transcription.id;
    
    const date = new Date(transcription.timestamp);
    const formattedDate = date.toLocaleString();
    
    // Create header with metadata and controls
    const header = document.createElement('div');
    header.className = 'transcription-header';
    
    // Safely get audio duration with fallback
    const audioDuration = transcription.metadata && transcription.metadata.audio_duration 
        ? transcription.metadata.audio_duration.toFixed(2) 
        : '0.00';
    
    header.innerHTML = `
        <div class="transcription-metadata">
            ${formattedDate} | Duration: ${audioDuration}s
        </div>
        <div class="transcription-controls">
            <button class="control-button play-button" data-id="${transcription.id}">
                Play Audio
            </button>
            <button class="control-button delete-button" data-id="${transcription.id}">
                Delete
            </button>
        </div>
    `;
    
    // Create audio player (initially hidden)
    const audioPlayer = document.createElement('audio');
    audioPlayer.className = 'audio-player';
    audioPlayer.controls = true;
    audioPlayer.style.display = 'none';
    
    // Load audio URL
    const audioUrl = await loadAudio(transcription.id);
    if (audioUrl) {
        audioPlayer.src = audioUrl;
    }
    
    // Create word-by-word display container
    const wordContainer = document.createElement('div');
    wordContainer.className = 'word-container';
    wordContainer.style.display = 'none';
    
    // Create words with timing data
    let hasWordTimestamps = false;
    if (transcription.transcription && transcription.transcription.utterances) {
        transcription.transcription.utterances.forEach(utterance => {
            if (utterance.words && utterance.words.length > 0) {
                hasWordTimestamps = true;
                utterance.words.forEach(word => {
                    const wordSpan = document.createElement('span');
                    wordSpan.className = 'word';
                    wordSpan.textContent = word.word + ' ';
                    wordSpan.dataset.start = word.start;
                    wordSpan.dataset.end = word.end;
                    wordContainer.appendChild(wordSpan);
                });
            }
        });
    }
    
    // If no word timestamps, create a fallback display
    if (!hasWordTimestamps && transcription.transcription && transcription.transcription.full_transcript) {
        const words = transcription.transcription.full_transcript.split(' ');
        const audioDuration = transcription.metadata && transcription.metadata.audio_duration 
            ? transcription.metadata.audio_duration 
            : 0;
        
        // Create approximate timestamps
        words.forEach((word, index) => {
            const wordSpan = document.createElement('span');
            wordSpan.className = 'word';
            wordSpan.textContent = word + ' ';
            
            // Create approximate timestamps based on word position
            const approximateStart = (audioDuration / words.length) * index;
            const approximateEnd = (audioDuration / words.length) * (index + 1);
            
            wordSpan.dataset.start = approximateStart.toFixed(2);
            wordSpan.dataset.end = approximateEnd.toFixed(2);
            wordContainer.appendChild(wordSpan);
        });
    }
    
    // Create full transcript display
    const fullTranscript = document.createElement('div');
    fullTranscript.className = 'transcription-text';
    fullTranscript.textContent = transcription.transcription && transcription.transcription.full_transcript 
        ? transcription.transcription.full_transcript 
        : 'No transcript available';
    
    // Add event listeners
    const playButton = header.querySelector('.play-button');
    playButton.addEventListener('click', () => {
        // Toggle audio player visibility
        if (audioPlayer.style.display === 'none') {
            audioPlayer.style.display = 'block';
            wordContainer.style.display = 'block';
            fullTranscript.style.display = 'none';
            playButton.textContent = 'Hide Player';
            
            // Set up word highlighting
            setupWordHighlighting(audioPlayer, wordContainer);
        } else {
            audioPlayer.style.display = 'none';
            wordContainer.style.display = 'none';
            fullTranscript.style.display = 'block';
            playButton.textContent = 'Play Audio';
            audioPlayer.pause();
        }
    });
    
    const deleteButton = header.querySelector('.delete-button');
    deleteButton.addEventListener('click', async () => {
        if (await deleteTranscription(transcription.id)) {
            renderTranscriptionList();
        }
    });
    
    // Assemble the item
    item.appendChild(header);
    item.appendChild(audioPlayer);
    item.appendChild(wordContainer);
    item.appendChild(fullTranscript);
    
    return item;
}

// Set up word highlighting during audio playback
function setupWordHighlighting(audioPlayer, wordContainer) {
    const words = wordContainer.querySelectorAll('.word');
    
    // If no words with timestamps, don't set up highlighting
    if (!words || words.length === 0) return;
    
    // Clear any existing active words
    words.forEach(word => word.classList.remove('active'));
    
    // Update active word based on current time
    function updateActiveWord() {
        const currentTime = audioPlayer.currentTime;
        let activeWordFound = false;
        
        words.forEach(word => {
            try {
                const start = parseFloat(word.dataset.start) || 0;
                const end = parseFloat(word.dataset.end) || 0;
                
                if (currentTime >= start && currentTime <= end) {
                    word.classList.add('active');
                    activeWordFound = true;
                    
                    // Scroll word into view if needed
                    const rect = word.getBoundingClientRect();
                    const containerRect = wordContainer.getBoundingClientRect();
                    
                    if (rect.bottom > containerRect.bottom || rect.top < containerRect.top) {
                        word.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                } else {
                    word.classList.remove('active');
                }
            } catch (error) {
                console.error('Error highlighting word:', error);
                word.classList.remove('active');
            }
        });
        
        // If no active word was found, try to find the closest one
        if (!activeWordFound && words.length > 0) {
            let closestWord = null;
            let minDistance = Infinity;
            
            words.forEach(word => {
                try {
                    const start = parseFloat(word.dataset.start) || 0;
                    const distance = Math.abs(currentTime - start);
                    
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestWord = word;
                    }
                } catch (error) {
                    // Skip this word if there's an error
                }
            });
            
            if (closestWord && minDistance < 2) { // Only highlight if within 2 seconds
                closestWord.classList.add('active');
            }
        }
    }
    
    // Set up event listeners for audio player
    audioPlayer.addEventListener('timeupdate', updateActiveWord);
    audioPlayer.addEventListener('play', updateActiveWord);
}

// Render the full transcription list
function renderTranscriptionList() {
    const transcriptions = loadTranscriptions();
    const listContainer = document.querySelector('.transcription-list');
    
    if (!listContainer) return;
    
    listContainer.innerHTML = '';
    
    if (transcriptions.length === 0) {
        listContainer.innerHTML = '<p>No transcriptions yet</p>';
        return;
    }
    
    // Render each transcription item
    transcriptions.forEach(async (transcription) => {
        const item = await renderTranscriptionItem(transcription);
        listContainer.appendChild(item);
    });
}

// Save new transcription with audio
async function saveNewTranscription(transcriptionData, audioBlob) {
    const transcriptionId = saveTranscription(transcriptionData);
    
    if (transcriptionId && audioBlob) {
        await saveAudioBlob(transcriptionId, audioBlob);
    }
    
    renderTranscriptionList();
    return transcriptionId;
}

// Initialize transcription UI
function initTranscriptionUI() {
    createTranscriptionUI();
    renderTranscriptionList();
}

// Export functions
export {
    initTranscriptionUI,
    saveNewTranscription,
    renderTranscriptionList
}; 