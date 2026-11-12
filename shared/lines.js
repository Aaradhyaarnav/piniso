/* Piniso — local one-liners (no AI needed). {away} = time away, {name} = pet name, {n} = number. */
(() => {
  if (globalThis.PLines) return;

  const L = {
    hinglish: {
      start: [
        'Hi! Main {name} 👀 Chal saath mein padhte hain. Notes main bana dunga!',
        'Lecture shuru? Main pencil leke ready hu ✏️',
        'Aaj ka mission: samjho, likho, yaad karo. Baaki main dekh lunga 😎',
        'Bhai focus mode ON. Main tere saath baitha hu, bhagna mat 😤',
        'Chalo, chai ☕ side mein rakho aur brain ON karo!'
      ],
      startCaptions: ['Captions mil gaye ✅ Ab main teacher ki har baat sun raha hu.', 'Teacher ki awaaz pakad li 🎧 Notes ready ho rahe hain.'],
      noCaptions: [
        'Is video ke captions nahi mile 😶 Toolbar mein mera icon dabao → "Listen" ON karo.',
        'Main sun nahi pa raha 🙉 Alt+Shift+L dabao, main audio se samjh lunga.'
      ],
      noKey: ['Mera dimaag (API key) abhi missing hai 🧠❌ Settings mein free Groq key daal do, 1 min ka kaam hai.'],
      poke: [
        'Oye! Main padh raha hu 😤', 'Hehe gudgudi hoti hai 🙈', 'Mujhe nahi, video ko dekho 👉📺',
        'Haan bolo? Doubt hai kya? 💬', 'Pencil gir jayegi yaar ✏️', 'Main cute hu, pata hai. Ab padho 😌',
        'Double-click karo toh notes khulenge 📝', 'Poke karne ke 0 marks milte hain exam mein 😂'
      ],
      pokeSpam: ['BAS! 😵 Itna poke karoge toh main bhi reels dekhne lagunga', 'Chakkar aa gaya 😵‍💫 Padhai pe dhyan do!', 'Bhai main stress ball nahi hu 😭'],
      tabReturn: [
        'Kaha gaye the? {away} gayab! Insta pe toh nahi the na? 👀',
        'Welcome back! {away} ka break... topper log itna break nahi lete 😏',
        'Aa gaye? Main yahi tha, wait kar raha tha 🥲 ({away})',
        '{away} ke baad wapsi! Chalo ab continue karte hain 💪'
      ],
      tabReturnPaused: ['Tum gaye toh maine video rok diya ⏸ ({away}). Resume karein?', 'Video paused tha jab tum gayab the ({away}). Chalo wapas!'],
      sleep: ['Zzz... koi padh hi nahi raha toh main so jata hu 😴', 'Video ruki hai, main 2 min ka power nap le raha hu 💤'],
      wake: ['Huh?! Main jag gaya 😳 Chalo padhte hain!', 'Uth gaya! Kya miss kiya? 🥱'],
      important: [
        'Teacher ne bola IMPORTANT ⭐ Maine star laga diya!',
        'Ye exam mein aayega 🚨 Note kar liya!',
        'Alert! Ye wali line yaad rakhni hai ⭐',
        'Topper detector ON 🔥 Ye point important hai!'
      ],
      quizIntro: ['Pop quiz time! 😈 Sirf {n} sawaal, dar mat.', 'Chalo check karte hain dimaag mein kuch gaya ya nahi 🧠', 'Quiz aa gaya! Skip bhi kar sakte ho, par mat karna 😏'],
      quizCorrect: ['Sahi jawab! 🎉 Topper vibes', 'Ekdum sahi! Brain = 🔥', 'Wah! Tum toh scene ho 😎', 'Correct! +10 XP le lo 💰'],
      quizWrong: ['Arre nahi 😅 Koi baat nahi, yahi toh seekhna hai', 'Galat, par close tha 🤏 Explanation padh lo', 'Oops! Isko maine revision cards mein daal diya 🃏'],
      quizDoneGood: ['Quiz khatam! Score dekh ke main proud hu 🥹', 'Itne ache marks? Mummy ko batana padega 😤🎉'],
      quizDoneBad: ['Thoda weak raha, par tension nahi. Revision cards ready hain 💪', 'Ye topic phir se dekh lena, main yaad dila dunga 📌'],
      quizSkip: ['Theek hai, baad mein karenge 😌', 'Skip kar diya... main yaad rakhunga 👀'],
      breakTime: ['{n} min ho gaye padhte padhte! 5 min break? Paani pee lo 💧', 'Dimaag garam ho gaya hoga 🥵 Chhota break le lo!'],
      breakDone: ['Break khatam! Wapas padhai pe 📚', 'Recharge ho gaye? Chalo shuru! ⚡'],
      night: ['Raat ke {n} baj rahe hain 🌙 Padhai badiya, par neend bhi zaroori hai!', 'Night owl mode 🦉 Thoda aur, phir so jana.'],
      morning: ['Subah subah padhai? Tum legend ho 🌅', 'Early bird! Brain abhi fresh hai, best time 🐣'],
      videoEnd: ['Video khatam! 🎬 Report card banau?', 'Lecture done ✅ Chalo dekhte hain kitna seekha!'],
      levelUp: ['LEVEL UP! 🆙 Ab tum "{title}" ho!', 'Level {n}! Main bhi proud hu 🥹✨'],
      saved: ['Notes mein save kar diya ✍️', 'Likh liya! 📝'],
      snap: ['Board ki photo le raha hu 📸', 'Ruko, board padh raha hu 🔍'],
      shorts: ['SHORTS?! 😤 Padhai ka time hai yaar!', 'Ye reels/shorts tumhe topper nahi banayengi 🙅', 'Ek short = 10 min gaya. Chalo wapas lecture pe 📚'],
      rateLimit: ['Mera free dimaag thoda thak gaya 🥲 1 min mein phir try karunga.'],
      aiError: ['Kuch gadbad hui 😵 Main dobara try karunga.'],
      listening: ['Ab main audio se sun raha hu 🎧', 'Kaan khade! 👂 Teacher ko sun raha hu.'],
      thinking: ['Soch raha hu... 🤔', 'Dimaag ki chakki chal rahi hai ⚙️', 'Ek sec, notes padh raha hu 📖'],
      streak: ['{n} din ki streak 🔥 Todna mat!'],
      focusPraise: ['{n} min bina tab badle! Tum focus ke baadshah ho 👑', 'Zero distractions! Main impressed hu 😳']
    },
    english: {
      start: [
        "Hi! I'm {name} 👀 Let's study together. I'll take the notes!",
        'Lecture time? Pencil ready ✏️',
        "Today's mission: understand, write, remember. I've got your back 😎",
        "Focus mode ON. I'm sitting right here, no running away 😤"
      ],
      startCaptions: ["Found the captions ✅ I'm listening to every word.", "Got the teacher's voice 🎧 Notes are loading."],
      noCaptions: ["No captions on this one 😶 Click my toolbar icon → turn on \"Listen\".", "I can't hear this 🙉 Press Alt+Shift+L and I'll listen to the audio."],
      noKey: ['My brain (API key) is missing 🧠❌ Add a free Groq key in settings. Takes 1 minute.'],
      poke: ["Hey! I'm studying 😤", 'Hehe that tickles 🙈', 'Not me, look at the video 👉📺', 'Yes? Got a doubt? 💬', "Careful, I'll drop my pencil ✏️", 'Poking me gives zero marks in the exam 😂'],
      pokeSpam: ['STOP 😵 Keep poking and I start watching reels too', "I'm dizzy 😵‍💫 Back to studying!", "I'm not a stress ball 😭"],
      tabReturn: ['Where were you? Gone for {away}! Not Instagram, right? 👀', 'Welcome back! A {away} break... toppers don\'t do that 😏', 'You\'re back! I waited {away} 🥲'],
      tabReturnPaused: ['I paused the video while you were away ⏸ ({away}). Resume?'],
      sleep: ["Zzz... nobody's studying so I'm napping 😴", 'Video paused, taking a power nap 💤'],
      wake: ["Huh?! I'm up 😳 Let's go!", 'Awake! What did I miss? 🥱'],
      important: ['Teacher said IMPORTANT ⭐ Starred it!', 'This will be in the exam 🚨 Noted!', 'Alert! Remember this line ⭐'],
      quizIntro: ["Pop quiz! 😈 Only {n} questions.", "Let's check if it went into the brain 🧠", "Quiz time! You can skip... but don't 😏"],
      quizCorrect: ['Correct! 🎉 Topper vibes', 'Spot on! Brain = 🔥', 'Nailed it 😎', 'Right! +10 XP 💰'],
      quizWrong: ["Not quite 😅 That's how we learn", 'Close! Read the explanation 🤏', 'Oops! Added it to your revision cards 🃏'],
      quizDoneGood: ["Quiz done! I'm so proud 🥹", 'Those marks?! Legendary 😤🎉'],
      quizDoneBad: ["A bit weak, no stress. Revision cards are ready 💪", "Re-watch this part, I'll remind you 📌"],
      quizSkip: ['Okay, later then 😌', "Skipped... I'll remember 👀"],
      breakTime: ['{n} minutes of study! Take 5? Drink some water 💧', 'Brain must be hot 🥵 Quick break!'],
      breakDone: ['Break over! Back to it 📚', 'Recharged? Let\'s go ⚡'],
      night: ["It's {n} o'clock at night 🌙 Great work, but sleep matters too!", 'Night owl mode 🦉 A bit more, then sleep.'],
      morning: ['Studying this early? Legend 🌅', 'Early bird! Fresh brain, best time 🐣'],
      videoEnd: ['Video finished! 🎬 Want your report card?', "Lecture done ✅ Let's see what you learned!"],
      levelUp: ['LEVEL UP! 🆙 You are now "{title}"!', 'Level {n}! So proud 🥹✨'],
      saved: ['Saved to notes ✍️', 'Written down! 📝'],
      snap: ['Taking a photo of the board 📸', 'Wait, reading the board 🔍'],
      shorts: ["SHORTS?! 😤 It's study time!", "Shorts won't make you a topper 🙅", 'One short = 10 minutes gone. Back to the lecture 📚'],
      rateLimit: ['My free brain is a little tired 🥲 Trying again in a minute.'],
      aiError: ["Something went wrong 😵 I'll try again."],
      listening: ["Listening to the audio now 🎧", 'Ears up! 👂'],
      thinking: ['Thinking... 🤔', 'Brain gears turning ⚙️', 'One sec, reading my notes 📖'],
      streak: ['{n} day streak 🔥 Don\'t break it!'],
      focusPraise: ['{n} minutes without switching tabs! Focus king 👑', 'Zero distractions! Impressed 😳']
    },
    hindi: {
      start: ['नमस्ते! मैं {name} हूँ 👀 चलो साथ में पढ़ते हैं, नोट्स मैं बनाऊँगा!', 'लेक्चर शुरू? पेंसिल तैयार ✏️'],
      startCaptions: ['कैप्शन मिल गए ✅ अब मैं हर बात सुन रहा हूँ।'],
      noCaptions: ['इस वीडियो के कैप्शन नहीं मिले 😶 टूलबार में मेरा आइकन दबाओ → "Listen" चालू करो।'],
      noKey: ['मेरा दिमाग़ (API key) नहीं है 🧠❌ सेटिंग्स में फ्री Groq key डाल दो।'],
      poke: ['अरे! मैं पढ़ रहा हूँ 😤', 'हीही गुदगुदी होती है 🙈', 'मुझे नहीं, वीडियो को देखो 👉📺', 'हाँ बोलो? कोई डाउट है? 💬'],
      pokeSpam: ['बस! 😵 चक्कर आ गया!', 'मैं स्ट्रेस बॉल नहीं हूँ 😭'],
      tabReturn: ['कहाँ गए थे? {away} गायब! 👀', 'वापस आ गए! {away} का ब्रेक हुआ 😏'],
      tabReturnPaused: ['तुम गए तो मैंने वीडियो रोक दिया ⏸ ({away})। चलाएँ?'],
      sleep: ['कोई पढ़ ही नहीं रहा, मैं सो जाता हूँ 😴'],
      wake: ['अरे! मैं जाग गया 😳 चलो पढ़ते हैं!'],
      important: ['टीचर ने कहा ज़रूरी है ⭐ मैंने स्टार लगा दिया!', 'ये परीक्षा में आएगा 🚨 नोट कर लिया!'],
      quizIntro: ['पॉप क्विज़! 😈 बस {n} सवाल।'],
      quizCorrect: ['सही जवाब! 🎉', 'बिल्कुल सही! 🔥'],
      quizWrong: ['गलत 😅 कोई बात नहीं, यही तो सीखना है', 'इसे रिवीजन कार्ड में डाल दिया 🃏'],
      quizDoneGood: ['क्विज़ ख़त्म! मुझे तुम पर गर्व है 🥹'],
      quizDoneBad: ['थोड़ा कमज़ोर रहा, चिंता मत करो 💪'],
      quizSkip: ['ठीक है, बाद में करेंगे 😌'],
      breakTime: ['{n} मिनट हो गए! 5 मिनट का ब्रेक? पानी पी लो 💧'],
      breakDone: ['ब्रेक ख़त्म! वापस पढ़ाई 📚'],
      night: ['रात के {n} बज रहे हैं 🌙 नींद भी ज़रूरी है!'],
      morning: ['सुबह-सुबह पढ़ाई? शानदार 🌅'],
      videoEnd: ['वीडियो ख़त्म! 🎬 रिपोर्ट कार्ड बनाऊँ?'],
      levelUp: ['लेवल अप! 🆙 अब तुम "{title}" हो!'],
      saved: ['नोट्स में सेव कर दिया ✍️'],
      snap: ['बोर्ड की फ़ोटो ले रहा हूँ 📸'],
      shorts: ['शॉर्ट्स?! 😤 पढ़ाई का समय है!'],
      rateLimit: ['मेरा फ्री दिमाग़ थक गया 🥲 1 मिनट में फिर कोशिश करूँगा।'],
      aiError: ['कुछ गड़बड़ हुई 😵'],
      listening: ['अब मैं ऑडियो सुन रहा हूँ 🎧'],
      thinking: ['सोच रहा हूँ... 🤔'],
      streak: ['{n} दिन की स्ट्रीक 🔥'],
      focusPraise: ['{n} मिनट बिना टैब बदले! 👑']
    }
  };

  const recent = {};
  function pick(lang, key, vars = {}) {
    const bank = L[lang] || L.hinglish;
    const arr = bank[key] || L.english[key] || L.hinglish[key] || [''];
    // avoid repeating the same line twice in a row
    let i = Math.floor(Math.random() * arr.length);
    if (arr.length > 1 && recent[lang + key] === i) i = (i + 1) % arr.length;
    recent[lang + key] = i;
    return arr[i].replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ''));
  }

  globalThis.PLines = { pick, banks: L, langFor: (s) => (s === 'auto' ? 'hinglish' : (L[s] ? s : 'english')) };
})();
