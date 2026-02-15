/**
 * K.I.T. Voice Tools
 * Text-to-Speech and Speech-to-Text for voice interaction
 */

import { exec, execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';

const KIT_DIR = path.join(os.homedir(), '.kit');
const VOICE_DIR = path.join(KIT_DIR, 'voice');
const isWindows = os.platform() === 'win32';
const isMac = os.platform() === 'darwin';

// Ensure voice directory exists
function ensureVoiceDir() {
  if (!fs.existsSync(VOICE_DIR)) {
    fs.mkdirSync(VOICE_DIR, { recursive: true });
  }
}

// ============================================================================
// Text-to-Speech (TTS)
// ============================================================================

interface TTSConfig {
  provider: 'system' | 'elevenlabs' | 'openai';
  voice?: string;
  speed?: number;
  apiKey?: string;
}

/**
 * Convert text to speech using system TTS
 */
async function systemTTS(text: string, outputPath?: string): Promise<string> {
  ensureVoiceDir();
  const outFile = outputPath || path.join(VOICE_DIR, `tts_${Date.now()}.wav`);
  
  return new Promise((resolve, reject) => {
    if (isWindows) {
      // Windows: Use PowerShell with SAPI
      const psScript = `
        Add-Type -AssemblyName System.Speech
        $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
        $synth.SetOutputToWaveFile("${outFile.replace(/\\/g, '\\\\')}")
        $synth.Speak("${text.replace(/"/g, '\\"').replace(/\n/g, ' ')}")
        $synth.Dispose()
      `;
      exec(`powershell -Command "${psScript.replace(/\n/g, '; ')}"`, (err) => {
        if (err) reject(err);
        else resolve(outFile);
      });
    } else if (isMac) {
      // macOS: Use 'say' command
      exec(`say -o "${outFile}" --data-format=LEF32@22050 "${text.replace(/"/g, '\\"')}"`, (err) => {
        if (err) reject(err);
        else resolve(outFile);
      });
    } else {
      // Linux: Use espeak or festival
      exec(`espeak "${text.replace(/"/g, '\\"')}" --stdout > "${outFile}"`, (err) => {
        if (err) {
          // Try festival as fallback
          exec(`echo "${text}" | text2wave -o "${outFile}"`, (err2) => {
            if (err2) reject(new Error('No TTS engine found. Install espeak or festival.'));
            else resolve(outFile);
          });
        } else {
          resolve(outFile);
        }
      });
    }
  });
}

/**
 * Convert text to speech using ElevenLabs API
 */
async function elevenLabsTTS(text: string, apiKey: string, voice: string = 'Rachel'): Promise<string> {
  ensureVoiceDir();
  const outFile = path.join(VOICE_DIR, `tts_${Date.now()}.mp3`);
  
  // ElevenLabs voice IDs
  const voiceIds: Record<string, string> = {
    'rachel': '21m00Tcm4TlvDq8ikWAM',
    'drew': '29vD33N1CtxCmqQRPOHJ',
    'clyde': '2EiwWnXFnvU5JabPnv8n',
    'paul': '5Q0t7uMcjvnagumLfvZi',
    'domi': 'AZnzlk1XvdvUeBnXmlld',
    'dave': 'CYw3kZ02Hs0563khs1Fj',
    'fin': 'D38z5RcWu1voky8WS1ja',
    'sarah': 'EXAVITQu4vr4xnSDxMaL',
    'antoni': 'ErXwobaYiN019PkySvjV',
    'thomas': 'GBv7mTt0atIp3Br8iCZE',
    'charlie': 'IKne3meq5aSn9XLyUdCD',
    'emily': 'LcfcDJNUP1GQjkzn1xUU',
    'elli': 'MF3mGyEYCl7XYWbV9V6O',
    'callum': 'N2lVS1w4EtoT3dr4eOWO',
    'patrick': 'ODq5zmih8GrVes37Dizd',
    'harry': 'SOYHLrjzK2X1ezoPC6cr',
    'liam': 'TX3LPaxmHKxFdv7VOQHJ',
    'dorothy': 'ThT5KcBeYPX3keUQqHPh',
    'josh': 'TxGEqnHWrfWFTfGW9XjX',
    'arnold': 'VR6AewLTigWG4xSOukaG',
    'charlotte': 'XB0fDUnXU5powFXDhCwa',
    'matilda': 'XrExE9yKIg1WjnnlVkGX',
    'matthew': 'Yko7PKs6WkBMFwXMVQXl',
    'james': 'ZQe5CZNOzWyzPSCn5a3c',
    'joseph': 'Zlb1dXrM653N07WRdFW3',
    'jeremy': 'bVMeCyTHy58xNoL34h3p',
    'michael': 'flq6f7yk4E4fJM5XTYuZ',
    'ethan': 'g5CIjZEefAph4nQFvHAz',
    'gigi': 'jBpfuIE2acCO8z3wKNLl',
    'freya': 'jsCqWAovK2LkecY7zXl4',
    'grace': 'oWAxZDx7w5VEj9dCyTzz',
    'daniel': 'onwK4e9ZLuTAKqWW03F9',
    'serena': 'pMsXgVXv3BLzUgSXRplE',
    'adam': 'pNInz6obpgDQGcFmaJgB',
    'nicole': 'piTKgcLEGmPE4e6mEKli',
    'jessie': 't0jbNlBVZ17f02VDIeMI',
    'ryan': 'wViXBPUzp2ZZixB1xQuM',
    'sam': 'yoZ06aMxZJJ28mfd3POQ',
    'glinda': 'z9fAnlkpzviPz146aGWa',
    'giovanni': 'zcAOhNBS3c14rBihAFp1',
    'mimi': 'zrHiDhphv9ZnVXBqCLjz',
  };
  
  const voiceId = voiceIds[voice.toLowerCase()] || voiceIds['rachel'];
  
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      text,
      model_id: 'eleven_monolingual_v1',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.5
      }
    });
    
    const options = {
      hostname: 'api.elevenlabs.io',
      path: `/v1/text-to-speech/${voiceId}`,
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey
      }
    };
    
    const req = https.request(options, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`ElevenLabs API error: ${res.statusCode}`));
        return;
      }
      
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        fs.writeFileSync(outFile, Buffer.concat(chunks));
        resolve(outFile);
      });
    });
    
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/**
 * Convert text to speech using OpenAI TTS
 */
async function openaiTTS(text: string, apiKey: string, voice: string = 'alloy'): Promise<string> {
  ensureVoiceDir();
  const outFile = path.join(VOICE_DIR, `tts_${Date.now()}.mp3`);
  
  // OpenAI TTS voices: alloy, echo, fable, onyx, nova, shimmer
  const validVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
  const selectedVoice = validVoices.includes(voice.toLowerCase()) ? voice.toLowerCase() : 'alloy';
  
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: 'tts-1',
      input: text,
      voice: selectedVoice
    });
    
    const options = {
      hostname: 'api.openai.com',
      path: '/v1/audio/speech',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    };
    
    const req = https.request(options, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`OpenAI TTS API error: ${res.statusCode}`));
        return;
      }
      
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        fs.writeFileSync(outFile, Buffer.concat(chunks));
        resolve(outFile);
      });
    });
    
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/**
 * Main TTS function - auto-selects best available provider
 */
export async function textToSpeech(text: string, config?: TTSConfig): Promise<string> {
  const provider = config?.provider || 'system';
  
  try {
    switch (provider) {
      case 'elevenlabs':
        if (!config?.apiKey) throw new Error('ElevenLabs API key required');
        return await elevenLabsTTS(text, config.apiKey, config.voice);
      
      case 'openai':
        if (!config?.apiKey) throw new Error('OpenAI API key required');
        return await openaiTTS(text, config.apiKey, config.voice);
      
      case 'system':
      default:
        return await systemTTS(text);
    }
  } catch (error: any) {
    // Fallback to system TTS
    console.warn(`TTS provider ${provider} failed: ${error.message}. Falling back to system.`);
    return await systemTTS(text);
  }
}

/**
 * Speak text directly (plays audio)
 */
export async function speak(text: string, config?: TTSConfig): Promise<void> {
  // For short responses, use direct system speech
  if (!config?.provider || config.provider === 'system') {
    return new Promise((resolve, reject) => {
      if (isWindows) {
        const psScript = `Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak("${text.replace(/"/g, '\\"').replace(/\n/g, ' ')}")`;
        exec(`powershell -Command "${psScript}"`, (err) => {
          if (err) reject(err);
          else resolve();
        });
      } else if (isMac) {
        exec(`say "${text.replace(/"/g, '\\"')}"`, (err) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        exec(`espeak "${text.replace(/"/g, '\\"')}"`, (err) => {
          if (err) reject(err);
          else resolve();
        });
      }
    });
  }
  
  // For other providers, generate file and play
  const audioFile = await textToSpeech(text, config);
  await playAudio(audioFile);
}

/**
 * Play audio file
 */
export async function playAudio(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isWindows) {
      exec(`powershell -Command "(New-Object Media.SoundPlayer '${filePath}').PlaySync()"`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    } else if (isMac) {
      exec(`afplay "${filePath}"`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    } else {
      exec(`aplay "${filePath}" || paplay "${filePath}" || mpv "${filePath}"`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    }
  });
}

// ============================================================================
// Speech-to-Text (STT)
// ============================================================================

interface STTConfig {
  provider: 'system' | 'openai' | 'whisper';
  apiKey?: string;
  language?: string;
}

/**
 * Transcribe audio file using OpenAI Whisper API
 */
async function openaiSTT(audioPath: string, apiKey: string, language?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', fs.createReadStream(audioPath));
    form.append('model', 'whisper-1');
    if (language) form.append('language', language);
    
    const options = {
      hostname: 'api.openai.com',
      path: '/v1/audio/transcriptions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        ...form.getHeaders()
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.text || '');
        } catch {
          reject(new Error('Failed to parse Whisper response'));
        }
      });
    });
    
    req.on('error', reject);
    form.pipe(req);
  });
}

/**
 * Record audio from microphone
 */
export async function recordAudio(duration: number = 5, outputPath?: string): Promise<string> {
  ensureVoiceDir();
  const outFile = outputPath || path.join(VOICE_DIR, `recording_${Date.now()}.wav`);
  
  return new Promise((resolve, reject) => {
    if (isWindows) {
      // Windows: Use PowerShell with NAudio or ffmpeg
      const ffmpegCheck = execSync('where ffmpeg', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
      if (ffmpegCheck) {
        exec(`ffmpeg -f dshow -i audio="Microphone" -t ${duration} -y "${outFile}"`, (err) => {
          if (err) reject(err);
          else resolve(outFile);
        });
      } else {
        reject(new Error('ffmpeg not found. Install ffmpeg for audio recording.'));
      }
    } else if (isMac) {
      exec(`ffmpeg -f avfoundation -i ":0" -t ${duration} -y "${outFile}"`, (err) => {
        if (err) {
          // Fallback to sox
          exec(`rec -c 1 -r 16000 "${outFile}" trim 0 ${duration}`, (err2) => {
            if (err2) reject(err2);
            else resolve(outFile);
          });
        } else {
          resolve(outFile);
        }
      });
    } else {
      // Linux: Use arecord or ffmpeg
      exec(`arecord -d ${duration} -f cd "${outFile}" || ffmpeg -f alsa -i default -t ${duration} -y "${outFile}"`, (err) => {
        if (err) reject(err);
        else resolve(outFile);
      });
    }
  });
}

/**
 * Main STT function - transcribe audio to text
 */
export async function speechToText(audioPath: string, config?: STTConfig): Promise<string> {
  const provider = config?.provider || 'openai';
  
  if (provider === 'openai' || provider === 'whisper') {
    if (!config?.apiKey) {
      throw new Error('OpenAI API key required for speech-to-text');
    }
    return await openaiSTT(audioPath, config.apiKey, config.language);
  }
  
  throw new Error('System STT not implemented. Use OpenAI Whisper.');
}

/**
 * Listen for voice command (record + transcribe)
 */
export async function listenForCommand(duration: number = 5, apiKey?: string): Promise<string> {
  console.log('🎤 Listening...');
  const audioFile = await recordAudio(duration);
  console.log('📝 Transcribing...');
  
  if (!apiKey) {
    throw new Error('OpenAI API key required for voice commands');
  }
  
  const text = await speechToText(audioFile, { provider: 'openai', apiKey });
  
  // Clean up recording
  try {
    fs.unlinkSync(audioFile);
  } catch {}
  
  return text;
}

// ============================================================================
// Tool Definitions
// ============================================================================

export const voiceTools = [
  {
    name: 'voice_speak',
    description: 'Convert text to speech and play it. Use when user wants to hear something spoken aloud.',
    parameters: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Text to speak'
        },
        voice: {
          type: 'string',
          description: 'Voice to use (for ElevenLabs/OpenAI). Examples: alloy, nova, rachel',
          default: 'alloy'
        }
      },
      required: ['text']
    },
    handler: async (params: any, context: any) => {
      try {
        // Check for API keys in config
        const configPath = path.join(os.homedir(), '.kit', 'config.json');
        let apiKey: string | undefined;
        let provider: 'system' | 'openai' | 'elevenlabs' = 'system';
        
        if (fs.existsSync(configPath)) {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          if (config.elevenlabs?.apiKey) {
            apiKey = config.elevenlabs.apiKey;
            provider = 'elevenlabs';
          } else if (config.openai?.apiKey) {
            apiKey = config.openai.apiKey;
            provider = 'openai';
          }
        }
        
        await speak(params.text, { provider, apiKey, voice: params.voice });
        return `🔊 Spoke: "${params.text.substring(0, 50)}${params.text.length > 50 ? '...' : ''}"`;
      } catch (error: any) {
        return `❌ Voice error: ${error.message}`;
      }
    }
  },
  {
    name: 'voice_tts_file',
    description: 'Convert text to speech and save as audio file.',
    parameters: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Text to convert'
        },
        filename: {
          type: 'string',
          description: 'Output filename (optional)'
        },
        voice: {
          type: 'string',
          description: 'Voice to use',
          default: 'alloy'
        }
      },
      required: ['text']
    },
    handler: async (params: any) => {
      try {
        const configPath = path.join(os.homedir(), '.kit', 'config.json');
        let apiKey: string | undefined;
        let provider: 'system' | 'openai' | 'elevenlabs' = 'system';
        
        if (fs.existsSync(configPath)) {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          if (config.elevenlabs?.apiKey) {
            apiKey = config.elevenlabs.apiKey;
            provider = 'elevenlabs';
          } else if (config.openai?.apiKey) {
            apiKey = config.openai.apiKey;
            provider = 'openai';
          }
        }
        
        const outputPath = params.filename 
          ? path.join(VOICE_DIR, params.filename)
          : undefined;
        
        const file = await textToSpeech(params.text, { provider, apiKey, voice: params.voice });
        return `🎵 Audio saved: ${file}`;
      } catch (error: any) {
        return `❌ TTS error: ${error.message}`;
      }
    }
  },
  {
    name: 'voice_listen',
    description: 'Listen for voice input and transcribe it to text. Use when user wants to speak instead of type.',
    parameters: {
      type: 'object',
      properties: {
        duration: {
          type: 'number',
          description: 'Recording duration in seconds',
          default: 5
        }
      }
    },
    handler: async (params: any) => {
      try {
        const configPath = path.join(os.homedir(), '.kit', 'config.json');
        let apiKey: string | undefined;
        
        if (fs.existsSync(configPath)) {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          apiKey = config.openai?.apiKey;
        }
        
        if (!apiKey) {
          return '❌ OpenAI API key required for voice recognition. Add it to ~/.kit/config.json';
        }
        
        const text = await listenForCommand(params.duration || 5, apiKey);
        return `🎤 You said: "${text}"`;
      } catch (error: any) {
        return `❌ Listen error: ${error.message}`;
      }
    }
  },
  {
    name: 'voice_transcribe',
    description: 'Transcribe an audio file to text.',
    parameters: {
      type: 'object',
      properties: {
        audioPath: {
          type: 'string',
          description: 'Path to audio file'
        },
        language: {
          type: 'string',
          description: 'Language code (e.g., en, de, fr)',
          default: 'en'
        }
      },
      required: ['audioPath']
    },
    handler: async (params: any) => {
      try {
        const configPath = path.join(os.homedir(), '.kit', 'config.json');
        let apiKey: string | undefined;
        
        if (fs.existsSync(configPath)) {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          apiKey = config.openai?.apiKey;
        }
        
        if (!apiKey) {
          return '❌ OpenAI API key required for transcription.';
        }
        
        const text = await speechToText(params.audioPath, {
          provider: 'openai',
          apiKey,
          language: params.language
        });
        return `📝 Transcription: "${text}"`;
      } catch (error: any) {
        return `❌ Transcription error: ${error.message}`;
      }
    }
  }
];

export default voiceTools;
