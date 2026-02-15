// script.js — Chatbot, Voice input/output, formatting and auto-translation
document.addEventListener('DOMContentLoaded', () => {
  const ChatForm = document.getElementById('chat-form-ai');
  const ChatBox = document.getElementById('chat-box-ai');
  const UserInput = document.getElementById('user-input-ai');
  const VoiceInputBtn = document.getElementById('voice-input-btn');

  let conversationHistory = [];
  let isProcessing = false;
  let isListening = false;
  let lastTranscript = '';

  // Speech Recognition setup
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = SpeechRecognition ? new SpeechRecognition() : null;
  if (recognition) {
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
  }

  // --- Formatting bot messages into blocks (paragraphs & lists) ---
  function formatBotMessageToBlocks(text) {
    if (!text) return [];
    let cleaned = text.replace(/\*\*(.*?)\*\*/g, '$1').trim();
    // Normalize bullet markers and collapse repeated spaces
    cleaned = cleaned.replace(/^[\s\u2022*-]+/gm, match => match.replace(/[\u2022*-]/g, '*'));
    cleaned = cleaned.replace(/\s{2,}/g, ' ');
    const lines = cleaned.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

    const blocks = [];
    let currentList = null;
    lines.forEach(line => {
      const listMatch = line.match(/^(?:\*|\-|\u2022)\s*(.+)$/);
      if (listMatch) {
        const item = listMatch[1].trim();
        if (!currentList) currentList = [];
        currentList.push(item);
      } else {
        if (currentList) { blocks.push({ type: 'list', items: currentList }); currentList = null; }
        blocks.push({ type: 'para', text: line });
      }
    });
    if (currentList) blocks.push({ type: 'list', items: currentList });
    return blocks;
  }

  // --- TTS helpers: pick female-like voice and clean text ---
  function pickFemaleVoice() {
    const voices = window.speechSynthesis.getVoices() || [];
    const preferred = [
      'Google UK English Female','Google US English','Samantha','Victoria','Ivy','Karen',
      'en-US-Wavenet-F','en-GB-Wavenet-F'
    ];
    let v = voices.find(voice => preferred.some(p => voice.name && voice.name.includes(p)));
    if (!v) v = voices.find(voice => /female|woman/i.test(voice.name || ''));
    if (!v) v = voices.find(voice => voice.lang && voice.lang.startsWith('en'));
    return v || voices[0] || null;
  }
  function cleanTextForSpeech(text) {
    if (!text) return '';
    // remove common emoji ranges and simple emoticons
    text = text.replace(/[\u{1F300}-\u{1FAFF}\u{1F600}-\u{1F64F}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}]/gu, '');
    text = text.replace(/[:;=8][\-^]?[)D\]]/g, '');
    return text.replace(/\s{2,}/g, ' ').trim();
  }
  let cachedFemaleVoice = null;
  function speakText(text) {
    if (!('speechSynthesis' in window)) return;
    const cleaned = cleanTextForSpeech(text);
    if (!cleaned) return;
    const trySpeak = () => {
      if (!cachedFemaleVoice) cachedFemaleVoice = pickFemaleVoice();
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(cleaned);
      if (cachedFemaleVoice) u.voice = cachedFemaleVoice;
      u.lang = cachedFemaleVoice?.lang || 'en-US';
      u.rate = 0.95;
      u.pitch = 1.05;
      u.volume = 1;
      window.speechSynthesis.speak(u);
    };
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.addEventListener('voiceschanged', function _onv() {
        window.speechSynthesis.removeEventListener('voiceschanged', _onv);
        cachedFemaleVoice = pickFemaleVoice();
        trySpeak();
      });
    } else trySpeak();
  }

  // --- DOM: add message (returns content element) ---
  function addMessage(text, sender, includeAudio = false) {
    if (!ChatBox) return null;
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('flex', sender === 'user' ? 'justify-end' : 'justify-start', 'mb-3');
    const messageContent = document.createElement('div');
    messageContent.classList.add('p-4', 'rounded-lg', 'max-w-md', 'text-sm', 'shadow-sm');

    if (sender === 'user') messageContent.classList.add('bg-blue-500','text-white','rounded-br-none');
    else messageContent.classList.add('bg-green-100','text-gray-800','rounded-bl-none','border','border-green-300');

    const blocks = sender === 'bot' ? formatBotMessageToBlocks(text) : [{ type:'para', text: text || '' }];
    const textContent = document.createElement('div');
    textContent.classList.add('text-sm','leading-relaxed');

    blocks.forEach(block => {
      if (block.type === 'para') {
        const p = document.createElement('p');
        p.classList.add('m-0','mb-2');
        p.textContent = block.text;
        textContent.appendChild(p);
      } else if (block.type === 'list') {
        const ul = document.createElement('ul');
        ul.classList.add('pl-4','list-disc','mb-2','space-y-1');
        block.items.forEach(item => {
          const li = document.createElement('li');
          li.classList.add('text-sm');
          li.textContent = item;
          ul.appendChild(li);
        });
        textContent.appendChild(ul);
      }
    });

    messageContent.appendChild(textContent);

    // voice button (manual) for bot
    if (sender === 'bot' && includeAudio) {
      const voiceBtn = document.createElement('button');
      voiceBtn.type = 'button';
      voiceBtn.classList.add('mt-2','w-full','bg-blue-500','hover:bg-blue-600','text-white','px-3','py-2','rounded','text-xs','font-medium','transition','flex','items-center','justify-center','space-x-2');
      voiceBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i><span>Dengar</span>';
      voiceBtn.addEventListener('click', () => speakText(text));
      messageContent.appendChild(voiceBtn);
    }

    const timestamp = document.createElement('span');
    timestamp.classList.add('text-xs','text-gray-500','mt-2','block','opacity-75');
    const now = new Date();
    timestamp.textContent = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
    messageContent.appendChild(timestamp);

    messageDiv.appendChild(messageContent);
    ChatBox.appendChild(messageDiv);
    ChatBox.scrollTop = ChatBox.scrollHeight;

    return messageContent;
  }

  // --- send message, receive bot reply, auto-TTS, request translation and append it ---
  async function sendMessage(text) {
    if (!text || isProcessing) return;
    isProcessing = true;
    addMessage(text, 'user');
    conversationHistory.push({ role: 'user', text });

    const typingDiv = document.createElement('div');
    typingDiv.classList.add('flex','justify-start','mb-3');
    const typingContent = document.createElement('div');
    typingContent.classList.add('p-4','rounded-lg','bg-green-100','text-gray-800','rounded-bl-none','shadow-sm','text-sm','border','border-green-300');
    typingContent.innerHTML = '<span class="animate-pulse">Tutor AI sedang mengetik...</span>';
    typingDiv.appendChild(typingContent);
    typingDiv.id = 'typing-indicator';
    ChatBox.appendChild(typingDiv);
    ChatBox.scrollTop = ChatBox.scrollHeight;

    try {
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation: conversationHistory })
      });
      const ti = document.getElementById('typing-indicator'); if (ti) ti.remove();
      if (!resp.ok) throw new Error('Network response not ok');
      const data = await resp.json();
      const botReply = data.result || '';

      const botContentEl = addMessage(botReply, 'bot', true);
      speakText(botReply);
      conversationHistory.push({ role: 'model', text: botReply });

      // request translation (ask model to translate into Indonesian only)
      const translateResp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation: [{ role: 'user', text: 'Translate the following English text into Indonesian only:\n\n' + botReply }] })
      });
      if (translateResp.ok) {
        const tdata = await translateResp.json();
        const translation = tdata.result || '';
        if (translation.trim()) {
          const trDiv = document.createElement('div');
          trDiv.classList.add('bot-translation');
          const label = document.createElement('div');
          label.classList.add('text-xs','text-green-600','font-medium','mb-1');
          label.textContent = 'Terjemahan (Indonesia)';
          trDiv.appendChild(label);
          const p = document.createElement('p');
          p.classList.add('m-0','text-sm','leading-relaxed');
          p.textContent = translation.trim();
          trDiv.appendChild(p);
          botContentEl.appendChild(trDiv);
          ChatBox.scrollTop = ChatBox.scrollHeight;
        }
      }
    } catch (err) {
      console.error(err);
      const ti = document.getElementById('typing-indicator'); if (ti) ti.remove();
      addMessage('Maaf, terjadi kesalahan. Coba lagi nanti.', 'bot', false);
    } finally {
      isProcessing = false;
    }
  }

  // Wire up text form submit
  if (ChatForm) {
    ChatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const txt = UserInput.value.trim();
      if (!txt) return;
      UserInput.value = '';
      sendMessage(txt);
    });
  }

  // Voice input: auto-send when recognition stops
  if (recognition && VoiceInputBtn) {
    recognition.onstart = () => {
      isListening = true;
      VoiceInputBtn.classList.add('bg-red-600','animate-pulse');
      VoiceInputBtn.classList.remove('bg-green-500','hover:bg-green-600');
      VoiceInputBtn.innerHTML = '<i class="fa-solid fa-microphone-lines"></i>';
    };
    recognition.onend = () => {
      isListening = false;
      VoiceInputBtn.classList.remove('bg-red-600','animate-pulse');
      VoiceInputBtn.classList.add('bg-green-500','hover:bg-green-600');
      VoiceInputBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
      const t = lastTranscript.trim();
      if (t) { lastTranscript = ''; UserInput.value = ''; sendMessage(t); }
    };
    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) transcript += event.results[i][0].transcript;
      lastTranscript = transcript;
      UserInput.value = transcript;
    };
    recognition.onerror = (e) => { console.error('Speech recognition error:', e.error || e); };

    VoiceInputBtn.addEventListener('click', () => {
      if (isListening) recognition.stop();
      else { lastTranscript = ''; UserInput.value = ''; recognition.start(); }
    });
  }

  // Smooth scrolling unchanged
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      document.querySelector(this.getAttribute('href')).scrollIntoView({ behavior: 'smooth' });
    });
  });
});