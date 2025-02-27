// Transcription storage and audio playback handler

// Store transcription data in localStorage
function saveTranscription(transcriptionData) {
    try {
        const transcriptions = loadTranscriptions();
        
        // Process transcription data to ensure it has the right format
        const processedData = processTranscriptionData(transcriptionData);
        
        transcriptions.unshift({
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            metadata: processedData.metadata,
            transcription: processedData.transcription,
            audioUrl: null // Will be set after audio is saved
        });
        
        // Keep only last 50 transcriptions
        if (transcriptions.length > 50) {
            transcriptions.pop();
        }
        
        localStorage.setItem('stormEditorTranscriptions', JSON.stringify(transcriptions));
        return transcriptions[0].id;
    } catch (error) {
        console.error('Error saving transcription:', error);
        return null;
    }
}

// Process transcription data to ensure it has the right format
function processTranscriptionData(data) {
    // Create a standardized structure
    const processed = {
        metadata: {
            audio_duration: 0,
            number_of_distinct_channels: 1,
            billing_time: 0,
            transcription_time: 0
        },
        transcription: {
            languages: [],
            utterances: [],
            full_transcript: ""
        }
    };
    
    // Handle null or undefined data
    if (!data) {
        console.error('Received null or undefined transcription data');
        return processed;
    }
    
    try {
        // Extract metadata
        if (data.metadata) {
            processed.metadata = { ...processed.metadata, ...data.metadata };
        }
        
        // Extract transcription data
        if (data.result && data.result.transcription) {
            // Newer API format
            const transcription = data.result.transcription;
            
            if (typeof transcription === 'string') {
                // Simple string transcription
                processed.transcription.full_transcript = transcription;
            } else {
                // Object with utterances and possibly full_transcript
                if (transcription.languages) {
                    processed.transcription.languages = transcription.languages;
                }
                
                if (transcription.utterances) {
                    processed.transcription.utterances = transcription.utterances.map(utterance => {
                        // Ensure each utterance has a words array if missing
                        if (!utterance.words) {
                            utterance.words = [];
                            
                            // If there's text but no words, create approximate word objects
                            if (utterance.text) {
                                const words = utterance.text.split(' ');
                                const startTime = utterance.start || 0;
                                const endTime = utterance.end || 0;
                                const duration = endTime - startTime;
                                const wordDuration = duration / words.length;
                                
                                utterance.words = words.map((word, index) => {
                                    return {
                                        word: word,
                                        start: startTime + (index * wordDuration),
                                        end: startTime + ((index + 1) * wordDuration),
                                        confidence: utterance.confidence || 0.5
                                    };
                                });
                            }
                        }
                        return utterance;
                    });
                }
                
                if (transcription.full_transcript) {
                    processed.transcription.full_transcript = transcription.full_transcript;
                } else if (transcription.utterances && transcription.utterances.length > 0) {
                    // Create full transcript from utterances
                    processed.transcription.full_transcript = transcription.utterances.map(u => u.text).join(' ');
                }
            }
        } else if (data.transcription) {
            // Older API format
            const transcription = data.transcription;
            
            if (typeof transcription === 'string') {
                processed.transcription.full_transcript = transcription;
            } else {
                if (transcription.languages) {
                    processed.transcription.languages = transcription.languages;
                }
                
                if (transcription.utterances) {
                    processed.transcription.utterances = transcription.utterances.map(utterance => {
                        // Ensure each utterance has a words array if missing
                        if (!utterance.words) {
                            utterance.words = [];
                            
                            // If there's text but no words, create approximate word objects
                            if (utterance.text) {
                                const words = utterance.text.split(' ');
                                const startTime = utterance.start || 0;
                                const endTime = utterance.end || 0;
                                const duration = endTime - startTime;
                                const wordDuration = duration / words.length;
                                
                                utterance.words = words.map((word, index) => {
                                    return {
                                        word: word,
                                        start: startTime + (index * wordDuration),
                                        end: startTime + ((index + 1) * wordDuration),
                                        confidence: utterance.confidence || 0.5
                                    };
                                });
                            }
                        }
                        return utterance;
                    });
                }
                
                if (transcription.full_transcript) {
                    processed.transcription.full_transcript = transcription.full_transcript;
                } else if (transcription.utterances && transcription.utterances.length > 0) {
                    processed.transcription.full_transcript = transcription.utterances.map(u => u.text).join(' ');
                }
            }
        } else if (data.result && typeof data.result === 'string') {
            // Simple string result
            processed.transcription.full_transcript = data.result;
        }
    } catch (error) {
        console.error('Error processing transcription data:', error);
    }
    
    return processed;
}

// Load transcriptions from localStorage
function loadTranscriptions() {
    try {
        const saved = localStorage.getItem('stormEditorTranscriptions');
        return saved ? JSON.parse(saved) : [];
    } catch (error) {
        console.error('Error loading transcriptions:', error);
        return [];
    }
}

// Save audio blob and update transcription record
async function saveAudioBlob(transcriptionId, audioBlob) {
    try {
        // Convert blob to base64
        const base64Audio = await blobToBase64(audioBlob);
        
        // Get transcriptions
        const transcriptions = loadTranscriptions();
        const transcription = transcriptions.find(t => t.id === transcriptionId);
        
        if (transcription) {
            // Store audio in localStorage
            localStorage.setItem(`audio_${transcriptionId}`, base64Audio);
            
            // Update transcription record with audio reference
            transcription.audioUrl = `audio_${transcriptionId}`;
            localStorage.setItem('stormEditorTranscriptions', JSON.stringify(transcriptions));
            
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error saving audio:', error);
        return false;
    }
}

// Load audio for a transcription
async function loadAudio(transcriptionId) {
    try {
        const base64Audio = localStorage.getItem(`audio_${transcriptionId}`);
        if (!base64Audio) return null;
        
        // Convert base64 back to blob
        const audioBlob = await base64ToBlob(base64Audio);
        return URL.createObjectURL(audioBlob);
    } catch (error) {
        console.error('Error loading audio:', error);
        return null;
    }
}

// Play audio for a transcription
async function playTranscriptionAudio(transcriptionId) {
    const audioUrl = await loadAudio(transcriptionId);
    if (!audioUrl) {
        console.error('Audio not found for transcription:', transcriptionId);
        return;
    }
    
    const audio = new Audio(audioUrl);
    audio.play();
}

// Helper: Convert Blob to base64
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// Helper: Convert base64 to Blob
async function base64ToBlob(base64) {
    const response = await fetch(base64);
    return response.blob();
}

// Delete a transcription and its audio
function deleteTranscription(transcriptionId) {
    try {
        // Remove audio
        localStorage.removeItem(`audio_${transcriptionId}`);
        
        // Remove from transcriptions list
        const transcriptions = loadTranscriptions();
        const filtered = transcriptions.filter(t => t.id !== transcriptionId);
        localStorage.setItem('stormEditorTranscriptions', JSON.stringify(filtered));
        
        return true;
    } catch (error) {
        console.error('Error deleting transcription:', error);
        return false;
    }
}

// Get a specific transcription by ID
function getTranscription(transcriptionId) {
    try {
        const transcriptions = loadTranscriptions();
        return transcriptions.find(t => t.id === transcriptionId) || null;
    } catch (error) {
        console.error('Error getting transcription:', error);
        return null;
    }
}

// Export functions
export {
    saveTranscription,
    loadTranscriptions,
    saveAudioBlob,
    loadAudio,
    playTranscriptionAudio,
    deleteTranscription,
    getTranscription
}; 