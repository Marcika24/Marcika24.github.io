// SoundCloud Widget API Player Integration (Javítva: 0-100 hangerőszkála és hivatalos SC.Widget hívások)
(function(){
  const playIcon='<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6,3 20,12 6,21"/></svg>';
  const pauseIcon='<svg viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="3" width="4" height="18"/><rect x="15" y="3" width="4" height="18"/></svg>';

  function fmt(t){
    if(!isFinite(t)) return '0:00';
    const m = Math.floor(t/60), s = Math.floor(t%60);
    return m + ':' + String(s).padStart(2,'0');
  }

  function initPlayer(scope){
    const iframe = scope.querySelector('.player-engine');
    const btn = scope.querySelector('.player-btn');
    const bar = scope.querySelector('.player-bar');
    const fill = scope.querySelector('.player-bar .fill');
    const knob = scope.querySelector('.player-bar .knob');
    const curEl = scope.querySelector('.cur');
    const durEl = scope.querySelector('.dur');
    const volSlider = scope.querySelector('.player-vol-slider');
    const volFill = scope.querySelector('.player-vol-slider .vol-fill');
    const volKnob = scope.querySelector('.player-vol-slider .vol-knob');
    const volPct = scope.querySelector('.player-vol-pct');
    const volIcon = scope.querySelector('.player-vol-icon');
    const prevBtn = scope.querySelector('.player-prev');
    const nextBtn = scope.querySelector('.player-next');
    const trackList = scope.querySelector('.player-list');
    const titleEl = scope.querySelector('.player-title');

    if(!iframe) return;

    // Hivatalos API widget hívás
    const widget = SC.Widget(iframe);
    let isPlaying = false;
    let volume = 0.7; // Belső logika alapján 0 és 1 közötti arányszám
    let duration = 0;
    let isSeeking = false;
    let isPlaylist = scope.getAttribute('data-type') === 'playlist';

    function setVolumeUI(v){
      volume = v;
      const pct = Math.round(v * 100);
      if(volFill) volFill.style.width = pct + '%';
      if(volKnob) volKnob.style.left = pct + '%';
      if(volPct) volPct.textContent = pct + '%';
      
      // SoundCloud API-nak kötelező 0 és 100 közötti értéket átadni
      widget.setVolume(v * 100);
    }

    if(volSlider){
      let volDragging = false;
      const setVol = (e)=>{
        const r = volSlider.getBoundingClientRect();
        const p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
        setVolumeUI(p);
      };
      volSlider.addEventListener('mousedown', (e)=>{
        volDragging = true;
        setVol(e);
        const onMove = (ev)=>{ if(volDragging) setVol(ev); };
        const onUp = ()=>{ volDragging = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    }

    let lastVol = 0.7;
    if(volIcon){
      volIcon.addEventListener('click', ()=>{
        if(volume > 0){ lastVol = volume; setVolumeUI(0); }
        else { setVolumeUI(lastVol || 0.7); }
      });
    }

    btn.addEventListener('click', ()=>{
      if(isPlaying){ widget.pause(); }
      else { widget.play(); }
    });

    if(bar){
      let seekDragging = false;
      const seekTo = (e)=>{
        const r = bar.getBoundingClientRect();
        const p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
        if(duration > 0){
          widget.seekTo(p * duration * 1000); // A SC ezredmásodpercet vár seek-hez
          fill.style.width = (p * 100) + '%';
          knob.style.left = (p * 100) + '%';
          if(curEl) curEl.textContent = fmt(p * duration);
        }
      };
      bar.addEventListener('mousedown', (e)=>{
        seekDragging = true;
        isSeeking = true;
        seekTo(e);
        const onMove = (ev)=>{ if(seekDragging) seekTo(ev); };
        const onUp = ()=>{ seekDragging = false; isSeeking = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    }

    if(prevBtn) prevBtn.addEventListener('click', ()=>{ widget.prev(); });
    if(nextBtn) nextBtn.addEventListener('click', ()=>{ widget.next(); });

    if(trackList){
      trackList.addEventListener('click', (e)=>{
        const track = e.target.closest('.player-track');
        if(track){
          const idx = parseInt(track.dataset.index);
          widget.skip(idx);
        }
      });
    }

    const updateActiveTrack = (index) => {
      if (!isPlaylist || !trackList) return;
      const tracks = trackList.querySelectorAll('.player-track');
      tracks.forEach(t => t.classList.remove('is-current'));
      if (tracks[index]) tracks[index].classList.add('is-current');
      
      widget.getSounds((sounds) => {
        if (sounds && sounds[index]) {
          if(titleEl) titleEl.textContent = sounds[index].title;
          duration = sounds[index].duration / 1000;
          if(durEl) durEl.textContent = fmt(duration);
        }
      });
    };

    // Hivatalos Események (Events) összekötése
    widget.bind(SC.Widget.Events.READY, function(){
      setVolumeUI(volume); // Alap hangerő beállítása az indulásnál
      
      widget.getDuration(function(d){
        duration = d / 1000;
        if(durEl) durEl.textContent = fmt(duration);
      });

      if(isPlaylist && trackList){
        widget.getSounds(function(sounds){
          if(sounds && sounds.length > 0){
            trackList.innerHTML = '';
            sounds.forEach((t, i) => {
              const li = document.createElement('li');
              li.className = 'player-track';
              li.dataset.index = i;
              const dur = t.duration ? fmt(t.duration / 1000) : '';
              li.innerHTML = '<div class="num">' + (i+1) + '</div><div class="tname">' + t.title + '</div><div class="tdur">' + dur + '</div>';
              trackList.appendChild(li);
            });
            updateActiveTrack(0);
          }
        });
      }
    });

    widget.bind(SC.Widget.Events.PLAY, function(){
      isPlaying = true;
      scope.classList.add('is-playing');
      btn.innerHTML = pauseIcon;
      if (isPlaylist) {
        widget.getCurrentSoundIndex((idx) => updateActiveTrack(idx));
      }
    });

    widget.bind(SC.Widget.Events.PAUSE, function(){
      isPlaying = false;
      scope.classList.remove('is-playing');
      btn.innerHTML = playIcon;
    });

    widget.bind(SC.Widget.Events.FINISH, function(){
      isPlaying = false;
      scope.classList.remove('is-playing');
      btn.innerHTML = playIcon;
      fill.style.width = '0%';
      knob.style.left = '0%';
    });

    widget.bind(SC.Widget.Events.PLAY_PROGRESS, function(e){
      if(isSeeking) return;
      if(duration > 0){
        const p = e.relativePosition; // Ez egyenesen 0.0 és 1.0 közötti érték az új API-ban
        fill.style.width = (p * 100) + '%';
        knob.style.left = (p * 100) + '%';
        if(curEl) curEl.textContent = fmt(e.currentPosition / 1000);
      }
    });

    document.addEventListener('keydown', (e)=>{
      if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if(e.code === 'Space'){
        // Ha nem akarjuk, hogy minden lejátszó egyszerre induljon el szóközre, akkor ezt esetleg finomítani érdemes
        // De az eredeti funkciót megtartva:
        e.preventDefault();
        if(isPlaying){ widget.pause(); }
        else { widget.play(); }
      }
    });
  }

  document.querySelectorAll('.player').forEach(scope => initPlayer(scope));
})();