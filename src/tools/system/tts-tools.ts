/**
 * K.I.T. TTS (Text-to-Speech) Tools
 * 
 * Convert text to speech using various providers:
 * - ElevenLabs (premium quality)
 * - OpenAI TTS (good quality)
 * - Local (say on macOS, espeak on Linux)
 */

import { ToolDefinition, ToolHandler, ToolContext } from './tool-registry';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';

const execAsync = promisify(exec);

// ============================================================================
// Types
// ============================================================================

export type TTSProvider = 'elevenlabs' | 'openai' | 'local' | 'auto';

export interface TTSConfig {
  provider: TTSProvider;
  elevenLabsApiKey?: string;
  elevenLabsVoiceId?: string;
  openaiApiKey?: string;
  openaiVoice?: string;
  outputDir?: string;
}

export interface TTSResult {
  success: boolean;
  provider?: string;
  audioPath?: string;
  durationMs?: number;
  error?: string;
}

// ============================================================================
// ElevenLabs TTS
// ============================================================================

const ELEVENLABS_VOICES: Record<string, string> = {
  'rachel': '21m00Tcm4TlvDq8ikWAM',      // Female, American
  'drew': '29vD33N1CtxCmqQRPOHJ',        // Male, American
  'clyde': '2EiwWnXFnvU5JabPnv8n',       // Male, American, war veteran
  'paul': '5Q0t7uMcjvnagumLfvZi',        // Male, American, news anchor
  'domi': 'AZnzlk1XvdvUeBnXmlld',        // Female, American
  'dave': 'CYw3kZ02Hs0563khs1Fj',        // Male, British-American
  'fin': 'D38z5RcWu1voky8WS1ja',         // Male, Irish
  'sarah': 'EXAVITQu4vr4xnSDxMaL',       // Female, American (soft)
  'antoni': 'ErXwobaYiN019PkySvjV',      // Male, American (well-rounded)
  'thomas': 'GBv7mTt0atIp3Br8iCZE',      // Male, American (calm)
  'charlie': 'IKne3meq5aSn9XLyUdCD',     // Male, Australian
  'emily': 'LcfcDJNUP1GQjkzn1xUU',       // Female, American
  'elli': 'MF3mGyEYCl7XYWbV9V6O',        // Female, American (young)
  'callum': 'N2lVS1w4EtoT3dr4eOWO',      // Male, American (Transatlantic)
  'patrick': 'ODq5zmih8GrVes37Dizd',     // Male, American (casual)
  'harry': 'SOYHLrjzK2X1ezoPC6cr',       // Male, American (anxious)
  'liam': 'TX3LPaxmHKxFdv7VOQHJ',        // Male, American (articulate)
  'dorothy': 'ThT5KcBeYPX3keUQqHPh',     // Female, British (pleasant)
  'josh': 'TxGEqnHWrfWFTfGW9XjX',        // Male, American (deep)
  'arnold': 'VR6AewLTigWG4xSOukaG',      // Male, American (crisp)
  'charlotte': 'XB0fDUnXU5powFXDhCwa',   // Female, English-Swedish
  'matilda': 'XrExE9yKIg1WjnnlVkGX',     // Female, American (warm)
  'matthew': 'Yko7PKs6WkxO6Rs1bnN7',     // Male, British (audiobook)
  'james': 'ZQe5CZNOzWyzPSCn5a3c',       // Male, Australian (calm)
  'joseph': 'Zlb1dXrM653N07WRdFW3',      // Male, British (narrative)
  'jeremy': 'bVMeCyTHy58xNoL34h3p',      // Male, American-Irish
  'michael': 'flq6f7yk4E4fJM5XTYuZ',     // Male, American (elder)
  'ethan': 'g5CIjZEefAph4nQFvHAz',       // Male, American (narrator)
  'gigi': 'jBpfuIE2acCO8z3wKNLl',        // Female, American (childish)
  'freya': 'jsCqWAovK2LkecY7zXl4',       // Female, American (expressive)
  'grace': 'oWAxZDx7w5VEj9dCyTzz',       // Female, American-Southern
  'daniel': 'onwK4e9ZLuTAKqWW03F9',      // Male, British (deep)
  'serena': 'pFZP5JQG7iQjIQuC4Bku',      // Female, American (pleasant)
  'adam': 'pNInz6obpgDQGcFmaJgB',        // Male, American (deep)
  'nicole': 'piTKgcLEGmPE4e6mEKli',      // Female, American (whisper)
  'jessie': 't0jbNlBVZ17f02VDIeMI',      // Male, American (raspy)
  'ryan': 'wViXBPUzp2ZZixB1xQuM',        // Male, American (soldier)
  'sam': 'yoZ06aMxZJJ28mfd3POQ',         // Male, American (raspy)
  'glinda': 'z9fAnlkpzviPz146aGWa',      // Female, American (witch)
  'giovanni': 'zcAOhNBS3c14rBihAFp1',    // Male, English-Italian
  'mimi': 'zrHiDhphv9ZnVXBqCLjz',        // Female, English-Swedish (childish)
};

async function elevenLabsSpeak(
  text: string,
  apiKey: string,
  voiceIdOrName: string = 'adam',
  outputPath: string
): Promise<TTSResult> {
  // Resolve voice name to ID if needed
  const voiceId = ELEVENLABS_VOICES[voiceIdOrName.toLowerCase()] || voiceIdOrName;

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(outputPath, buffer);

    return {
      success: true,
      provider: 'elevenlabs',
      audioPath: outputPath,
    };
  } catch (error) {
    return {
      success: false,
      provider: 'elevenlabs',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// OpenAI TTS
// ============================================================================

const OPENAI_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] as const;
type OpenAIVoice = typeof OPENAI_VOICES[number];

async function openaiSpeak(
  text: string,
  apiKey: string,
  voice: OpenAIVoice = 'onyx',
  outputPath: string
): Promise<TTSResult> {
  const url = 'https://api.openai.com/v1/audio/speech';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice,
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI TTS API error: ${response.status} - ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(outputPath, buffer);

    return {
      success: true,
      provider: 'openai',
      audioPath: outputPath,
    };
  } catch (error) {
    return {
      success: false,
      provider: 'openai',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// Local TTS
// ============================================================================

async function localSpeak(text: string, outputPath: string): Promise<TTSResult> {
  const platform = os.platform();

  try {
    if (platform === 'darwin') {
      // macOS: use 'say' command
      const aiffPath = outputPath.replace(/\.mp3$/, '.aiff');
      await execAsync(`say -o "${aiffPath}" "${text.replace(/"/g, '\\"')}"`);

      // Convert to mp3 if ffmpeg is available
      try {
        await execAsync(`ffmpeg -i "${aiffPath}" -acodec libmp3lame "${outputPath}" -y`);
        await fs.unlink(aiffPath);
      } catch {
        // If ffmpeg not available, rename aiff to output
        await fs.rename(aiffPath, outputPath.replace(/\.mp3$/, '.aiff'));
        return {
          success: true,
          provider: 'local (say)',
          audioPath: outputPath.replace(/\.mp3$/, '.aiff'),
        };
      }
    } else if (platform === 'linux') {
      // Linux: use 'espeak' or 'espeak-ng'
      try {
        await execAsync(`espeak-ng "${text.replace(/"/g, '\\"')}" --stdout > "${outputPath.replace(/\.mp3$/, '.wav')}"`);
      } catch {
        await execAsync(`espeak "${text.replace(/"/g, '\\"')}" --stdout > "${outputPath.replace(/\.mp3$/, '.wav')}"`);
      }

      // Convert to mp3 if ffmpeg is available
      try {
        const wavPath = outputPath.replace(/\.mp3$/, '.wav');
        await execAsync(`ffmpeg -i "${wavPath}" -acodec libmp3lame "${outputPath}" -y`);
        await fs.unlink(wavPath);
      } catch {
        return {
          success: true,
          provider: 'local (espeak)',
          audioPath: outputPath.replace(/\.mp3$/, '.wav'),
        };
      }
    } else if (platform === 'win32') {
      // Windows: use PowerShell SAPI
      const psScript = `
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SetOutputToWaveFile("${outputPath.replace(/\.mp3$/, '.wav').replace(/\\/g, '\\\\')}")
$synth.Speak("${text.replace(/"/g, '`"')}")
$synth.Dispose()
`;
      await execAsync(`powershell -Command "${psScript.replace(/\n/g, '; ')}"`);

      // Convert to mp3 if ffmpeg is available
      try {
        const wavPath = outputPath.replace(/\.mp3$/, '.wav');
        await execAsync(`ffmpeg -i "${wavPath}" -acodec libmp3lame "${outputPath}" -y`);
        await fs.unlink(wavPath);
      } catch {
        return {
          success: true,
          provider: 'local (SAPI)',
          audioPath: outputPath.replace(/\.mp3$/, '.wav'),
        };
      }
    } else {
      return {
        success: false,
        provider: 'local',
        error: `Unsupported platform: ${platform}`,
      };
    }

    return {
      success: true,
      provider: 'local',
      audioPath: outputPath,
    };
  } catch (error) {
    return {
      success: false,
      provider: 'local',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// tts_speak Tool
// ============================================================================

export const ttsSpeakToolDefinition: ToolDefinition = {
  name: 'tts_speak',
  description: `Convert text to speech audio file.

Providers:
- elevenlabs: Premium quality voices (requires ELEVENLABS_API_KEY)
- openai: Good quality voices (requires OPENAI_API_KEY)
- local: Uses system TTS (say on macOS, espeak on Linux, SAPI on Windows)
- auto: Tries elevenlabs → openai → local in order

Returns the path to the generated audio file.`,
  parameters: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'The text to convert to speech',
      },
      provider: {
        type: 'string',
        enum: ['elevenlabs', 'openai', 'local', 'auto'],
        description: 'TTS provider to use. Default: auto',
      },
      voice: {
        type: 'string',
        description: `Voice to use. 
For ElevenLabs: voice name (adam, rachel, etc.) or voice ID
For OpenAI: alloy, echo, fable, onyx, nova, shimmer
For local: system default`,
      },
      filename: {
        type: 'string',
        description: 'Output filename (without extension). Default: auto-generated',
      },
    },
    required: ['text'],
  },
};

export const ttsSpeakToolHandler: ToolHandler = async (
  args: Record<string, unknown>,
  context: ToolContext
): Promise<unknown> => {
  const text = args.text as string;
  let provider = (args.provider as TTSProvider) || 'auto';
  const voice = args.voice as string | undefined;
  const filename = args.filename as string;

  if (!text || text.trim().length === 0) {
    return {
      success: false,
      error: 'Text is required',
    };
  }

  // Ensure output directory exists
  const outputDir = path.join(context.configDir, 'audio');
  await fs.mkdir(outputDir, { recursive: true });

  // Generate output filename
  const outputFilename = filename || `tts_${Date.now()}`;
  const outputPath = path.join(outputDir, `${outputFilename}.mp3`);

  // Get API keys from environment
  const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  // Auto-select provider based on available keys
  if (provider === 'auto') {
    if (elevenLabsKey) {
      provider = 'elevenlabs';
    } else if (openaiKey) {
      provider = 'openai';
    } else {
      provider = 'local';
    }
  }

  let result: TTSResult;

  switch (provider) {
    case 'elevenlabs':
      if (!elevenLabsKey) {
        return {
          success: false,
          error: 'ELEVENLABS_API_KEY not configured. Set it in .env or use a different provider.',
        };
      }
      result = await elevenLabsSpeak(text, elevenLabsKey, voice || 'adam', outputPath);
      break;

    case 'openai':
      if (!openaiKey) {
        return {
          success: false,
          error: 'OPENAI_API_KEY not configured. Set it in .env or use a different provider.',
        };
      }
      const openaiVoice = (voice && OPENAI_VOICES.includes(voice as OpenAIVoice))
        ? voice as OpenAIVoice
        : 'onyx';
      result = await openaiSpeak(text, openaiKey, openaiVoice, outputPath);
      break;

    case 'local':
      result = await localSpeak(text, outputPath);
      break;

    default:
      return {
        success: false,
        error: `Unknown provider: ${provider}`,
      };
  }

  if (result.success && result.audioPath) {
    // Get file stats
    try {
      const stats = await fs.stat(result.audioPath);
      return {
        ...result,
        fileSize: stats.size,
        textLength: text.length,
      };
    } catch {
      return result;
    }
  }

  return result;
};

// ============================================================================
// tts_voices Tool - List available voices
// ============================================================================

export const ttsVoicesToolDefinition: ToolDefinition = {
  name: 'tts_voices',
  description: 'List available TTS voices for each provider.',
  parameters: {
    type: 'object',
    properties: {
      provider: {
        type: 'string',
        enum: ['elevenlabs', 'openai', 'all'],
        description: 'Provider to list voices for. Default: all',
      },
    },
    required: [],
  },
};

export const ttsVoicesToolHandler: ToolHandler = async (
  args: Record<string, unknown>,
  _context: ToolContext
): Promise<unknown> => {
  const provider = args.provider as string || 'all';

  const voices: Record<string, unknown> = {};

  if (provider === 'all' || provider === 'elevenlabs') {
    voices.elevenlabs = {
      available: !!process.env.ELEVENLABS_API_KEY,
      voices: Object.keys(ELEVENLABS_VOICES),
      description: 'Premium quality voices with natural intonation',
    };
  }

  if (provider === 'all' || provider === 'openai') {
    voices.openai = {
      available: !!process.env.OPENAI_API_KEY,
      voices: [...OPENAI_VOICES],
      description: 'Good quality voices: alloy (neutral), echo (male), fable (British), onyx (male deep), nova (female), shimmer (female)',
    };
  }

  if (provider === 'all') {
    voices.local = {
      available: true,
      description: 'System TTS: say (macOS), espeak (Linux), SAPI (Windows)',
    };
  }

  return {
    success: true,
    providers: voices,
  };
};

// ============================================================================
// tts_play Tool - Play audio file (optional)
// ============================================================================

export const ttsPlayToolDefinition: ToolDefinition = {
  name: 'tts_play',
  description: 'Play an audio file using the system audio player.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the audio file to play',
      },
    },
    required: ['path'],
  },
};

export const ttsPlayToolHandler: ToolHandler = async (
  args: Record<string, unknown>,
  _context: ToolContext
): Promise<unknown> => {
  const audioPath = args.path as string;

  if (!audioPath) {
    return {
      success: false,
      error: 'Audio path is required',
    };
  }

  // Check if file exists
  try {
    await fs.access(audioPath);
  } catch {
    return {
      success: false,
      error: `Audio file not found: ${audioPath}`,
    };
  }

  const platform = os.platform();

  try {
    if (platform === 'darwin') {
      await execAsync(`afplay "${audioPath}"`);
    } else if (platform === 'linux') {
      // Try various players
      try {
        await execAsync(`aplay "${audioPath}"`);
      } catch {
        try {
          await execAsync(`paplay "${audioPath}"`);
        } catch {
          await execAsync(`mpv "${audioPath}"`);
        }
      }
    } else if (platform === 'win32') {
      // Use PowerShell to play audio
      await execAsync(`powershell -c "(New-Object Media.SoundPlayer '${audioPath}').PlaySync()"`);
    } else {
      return {
        success: false,
        error: `Unsupported platform for playback: ${platform}`,
      };
    }

    return {
      success: true,
      played: audioPath,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};
