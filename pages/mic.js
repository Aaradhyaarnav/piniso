(async () => {
  const s = await PStore.settings();
  PU.applyTheme(s);
  const pet = PinisoPet.create(document.getElementById('pet'), Object.assign(PU.petCfg(s), { size: 140, hat: 'headphones' }));
  pet.setMood('listening');
  const msg = document.getElementById('msg'), go = document.getElementById('go');
  const ask = async () => {
    try {
      const st = await navigator.mediaDevices.getUserMedia({ audio: true });
      st.getTracks().forEach((t) => t.stop());
      pet.setMood('celebrate'); pet.react('bigjump');
      msg.textContent = 'Done! Go back to your lecture and press Talk again. This tab will close by itself.';
      go.hidden = true;
      setTimeout(() => window.close(), 2600);
    } catch (e) {
      pet.setMood('sad');
      msg.textContent = 'The microphone was blocked. Click the 🔒 / camera icon in the address bar → allow Microphone, then press the button again.';
    }
  };
  go.onclick = ask;
  ask();
})();
