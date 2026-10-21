import { useState, useEffect, useRef, useCallback } from 'react';

// Declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export interface UseVoiceCommandOptions {
  language?: string; // 'bn-BD' | 'en-US'
  onCommand?: (command: string) => void;
  autoStopAfterCommand?: boolean;
}

export function useVoiceCommand({
  language = 'bn-BD',
  onCommand,
  autoStopAfterCommand = true
}: UseVoiceCommandOptions = {}) {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  const recognitionRef = useRef<any>(null);
  const isSpeakingRef = useRef<boolean>(false);

  useEffect(() => {
    const SpeechRecognition =
      typeof window !== 'undefined'
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;

    if (SpeechRecognition) {
      setIsSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognitionRef.current = recognition;
    } else {
      setIsSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // ignore
        }
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const startListening = useCallback(
    (langOverride?: string) => {
      const recognition = recognitionRef.current;
      if (!recognition) {
        setError('আপনার ব্রাউজারে স্পিচ রিকগনিশন সাপোর্ট নেই (Speech Recognition not supported in this browser)');
        return;
      }

      // Stop any active speech synthesis
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      }

      setError(null);
      setTranscript('');
      setInterimTranscript('');

      recognition.lang = langOverride || language || 'bn-BD';

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      recognition.onresult = (event: any) => {
        let currentInterim = '';
        let finalTrans = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            finalTrans += item[0].transcript;
          } else {
            currentInterim += item[0].transcript;
          }
        }

        if (finalTrans) {
          const cleanFinal = finalTrans.trim();
          setTranscript(cleanFinal);
          setInterimTranscript('');
          if (onCommand && cleanFinal) {
            onCommand(cleanFinal);
          }
          if (autoStopAfterCommand) {
            try {
              recognition.stop();
            } catch (e) {
              // ignore
            }
          }
        } else {
          setInterimTranscript(currentInterim);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Voice command recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setError('মাইক্রোফোন ব্যবহারের অনুমতি প্রয়োজন (Microphone permission was denied).');
        } else if (event.error === 'no-speech') {
          setError('কোনো আওয়াজ শোনা যায়নি। আবার চেষ্টা করুন (No voice detected).');
        } else {
          setError(`ভয়েস রিকগনিশনে সমস্যা হয়েছে: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      try {
        recognition.start();
      } catch (err: any) {
        // If already started, restart
        try {
          recognition.stop();
          setTimeout(() => {
            try {
              recognition.start();
            } catch (e) {
              // ignore
            }
          }, 150);
        } catch (e) {
          setError('মাইক্রোফোন চালু করতে সমস্যা হয়েছে।');
          setIsListening(false);
        }
      }
    },
    [language, onCommand, autoStopAfterCommand]
  );

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
    }
    setIsListening(false);
  }, []);

  // Text-To-Speech function so the Master Principal AI can speak back
  const speak = useCallback((text: string, langOverride?: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    if (!text) return;

    // Remove markdown symbols (asterisks, hashtags, backticks) before speaking
    const cleanText = text
      .replace(/[*#`_~]/g, '')
      .replace(/\[.*?\]\(.*?\)/g, '')
      .slice(0, 400); // Speak first couple sentences for brevity

    const utterance = new SpeechSynthesisUtterance(cleanText);
    const targetLang = langOverride || (/[ঀ-৿]/.test(text) ? 'bn-BD' : 'en-US');
    utterance.lang = targetLang;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      setIsSpeaking(true);
      isSpeakingRef.current = true;
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      isSpeakingRef.current = false;
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      isSpeakingRef.current = false;
    };

    try {
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
      setIsSpeaking(false);
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    error,
    isSpeaking,
    startListening,
    stopListening,
    speak,
    stopSpeaking
  };
}
