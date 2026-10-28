(() => {
  'use strict';

  // Replace src with a public MP4 URL (for example, S3 + CloudFront) when ready.
  // Keep credentials out of this file. Use '' for src and null for an unknown duration.
  // thumbnailUrl accepts an image URL; an empty value uses an illustrated placeholder.
  // Edit the title, level, category, description, and durationSeconds for each real lesson.
  const videos = [
    { id:'n5-greetings', title:'Everyday greetings', level:'N5', category:'N5', durationSeconds:null, src:'', thumbnailUrl:'', kana:'あ', description:'A planned introduction to greetings you can use in everyday life.' },
    { id:'n5-introduction', title:'Your first self-introduction', level:'N5', category:'N5', durationSeconds:null, src:'', thumbnailUrl:'', kana:'は', description:'A planned lesson on introducing yourself in simple Japanese.' },
    { id:'n4-daily', title:'Talking about your day', level:'N4', category:'N4', durationSeconds:null, src:'', thumbnailUrl:'', kana:'日', description:'A planned lesson on describing routines and everyday experiences.' },
    { id:'n4-plans', title:'Making plans together', level:'N4', category:'N4', durationSeconds:null, src:'', thumbnailUrl:'', kana:'話', description:'A planned lesson on invitations and making plans with friends.' },
    { id:'n3-opinions', title:'Sharing your thoughts', level:'N3', category:'N3', durationSeconds:null, src:'', thumbnailUrl:'', kana:'思', description:'A planned lesson on expressing opinions and explaining your reasons.' },
    { id:'culture-everyday', title:'Everyday manners in Japan', level:null, category:'Japanese Culture', durationSeconds:null, src:'', thumbnailUrl:'', kana:'和', description:'A planned introduction to thoughtful everyday habits and manners in Japan.' }
  ];

  const grid = document.getElementById('videoGrid');
  const filters = [...document.querySelectorAll('[data-filter]')];
  const count = document.getElementById('resultCount');
  const empty = document.getElementById('emptyState');
  const player = document.getElementById('videoPlayer');
  const title = document.getElementById('playerTitle');
  const status = document.getElementById('playerStatus');
  const placeholder = document.getElementById('playerPlaceholder');
  let selectedId = null;
  let activeFilter = 'All';
  let selectionVersion = 0;

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const mediaUrl = value => {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      const url = new URL(value.trim(), document.baseURI);
      const relativeFile = location.protocol === 'file:' && !/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value.trim());
      return !url.username && !url.password && (['https:','http:'].includes(url.protocol) || (url.protocol === 'file:' && relativeFile)) ? url.href : '';
    } catch (_) { return ''; }
  };
  const duration = seconds => {
    if (!Number.isFinite(seconds) || seconds <= 0) return 'Not set';
    const total = Math.floor(seconds);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2,'0')}`;
  };
  const setStatus = (message, error = false) => {
    status.textContent = message;
    status.classList.toggle('error', error);
  };
  const previewArt = item => {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox','0 0 400 225');
    svg.setAttribute('aria-hidden','true');
    const colors = item.category === 'Japanese Culture' ? ['#ecedf9','#d9def3','#7c8ab9'] : ['#e6f1ff','#cddff7','#608dc2'];
    const shape = (tag, attributes) => {
      const node = document.createElementNS(svgNS, tag);
      for (const [key,value] of Object.entries(attributes)) node.setAttribute(key,value);
      svg.append(node);
      return node;
    };
    shape('rect',{width:400,height:225,fill:colors[0]});
    shape('circle',{cx:355,cy:15,r:130,fill:colors[1],opacity:'.6'});
    shape('circle',{cx:30,cy:235,r:105,fill:colors[1],opacity:'.5'});
    const kana = shape('text',{x:200,y:132,'text-anchor':'middle',fill:colors[2],'font-size':85,'font-weight':850});
    kana.textContent = item.kana;
    return svg;
  };
  const selectVideo = item => {
    const version = ++selectionVersion;
    player.pause();
    player.removeAttribute('src');
    player.removeAttribute('poster');
    player.load();
    selectedId = item.id;
    title.textContent = item.title;
    document.getElementById('playerDescription').textContent = item.description;
    document.getElementById('playerLevel').textContent = item.level || 'All levels';
    document.getElementById('playerCategory').textContent = item.category;
    document.getElementById('playerDuration').textContent = duration(item.durationSeconds);
    document.getElementById('playerMeta').hidden = false;
    const url = mediaUrl(item.src);
    player.hidden = !url;
    placeholder.hidden = Boolean(url);
    if (!url) {
      document.getElementById('placeholderMessage').textContent = 'Video not uploaded yet';
      document.getElementById('placeholderDetail').textContent = 'This is a preview topic. Playback is not available.';
      setStatus(item.src ? 'The video URL is not valid. Playback is unavailable.' : 'Preview topic · No video has been registered.', Boolean(item.src));
    } else {
      const poster = mediaUrl(item.thumbnailUrl);
      if (poster) player.poster = poster;
      player.src = url;
      player.load();
      setStatus('Loading video…');
      const request = player.play();
      request?.catch(() => {
        if (selectionVersion === version && !player.error) setStatus('Use the player controls to start the video.');
      });
    }
    grid.querySelectorAll('.video-card').forEach(card => {
      const selected = card.dataset.videoId === selectedId;
      card.classList.toggle('selected', selected);
      card.querySelector('button').setAttribute('aria-pressed', String(selected));
    });
    title.focus({preventScroll:true});
    document.getElementById('watch').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'start'});
  };
  const render = () => {
    const items = videos.filter(item => activeFilter === 'All' || item.category === activeFilter);
    grid.replaceChildren();
    for (const item of items) {
      const ready = Boolean(mediaUrl(item.src));
      const card = element('article','video-card');
      card.dataset.videoId = item.id;
      card.classList.toggle('selected', item.id === selectedId);
      const thumbnail = element('div','thumbnail');
      const poster = mediaUrl(item.thumbnailUrl);
      if (poster) {
        const img = element('img');
        img.src = poster; img.alt = ''; img.loading = 'lazy';
        img.addEventListener('error', () => img.replaceWith(previewArt(item)), {once:true});
        thumbnail.append(img);
      } else thumbnail.append(previewArt(item));
      thumbnail.append(element('span','thumbnail-label',ready ? 'Video registered' : 'Preview · Video not uploaded'));
      const body = element('div','card-body');
      body.append(element('p','card-kicker',ready ? 'Learning video' : 'Planned lesson topic'));
      const heading = element('h3','',item.title);
      heading.id = `title-${item.id}`;
      const meta = element('div','card-meta');
      meta.append(element('span','meta-pill',`JLPT: ${item.level || 'All levels'}`),element('span','meta-pill',`Category: ${item.category}`));
      const action = element('button','card-button');
      action.type = 'button';
      action.setAttribute('aria-label',`${ready ? 'Play video' : 'View preview details'}: ${item.title}`);
      action.setAttribute('aria-pressed',String(item.id === selectedId));
      action.append(element('span','',ready ? 'Play video' : 'View preview details'),element('span','','↑'));
      action.lastChild.setAttribute('aria-hidden','true');
      action.addEventListener('click', () => selectVideo(item));
      body.append(heading,meta,element('p','card-duration',`Duration: ${duration(item.durationSeconds)}`),action);
      card.setAttribute('aria-labelledby',heading.id);
      card.append(thumbnail,body);
      grid.append(card);
    }
    empty.hidden = items.length > 0;
    const available = items.filter(item => mediaUrl(item.src)).length;
    count.textContent = `${items.length} ${items.length === 1 ? 'topic' : 'topics'} · ${available} videos registered`;
  };
  for (const filter of filters) filter.addEventListener('click', () => {
    activeFilter = filter.dataset.filter;
    filters.forEach(button => {
      const active = button === filter;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed',String(active));
    });
    render();
  });
  player.addEventListener('loadedmetadata', () => {
    if (!player.getAttribute('src')) return;
    if (Number.isFinite(player.duration) && player.duration > 0) document.getElementById('playerDuration').textContent = duration(player.duration);
    if (player.paused) setStatus('Video ready. Use the player controls to start.');
  });
  player.addEventListener('playing', () => {
    if (player.getAttribute('src')) setStatus('Playing · Use the player controls to pause or adjust the volume.');
  });
  player.addEventListener('pause', () => {
    if (player.getAttribute('src') && player.readyState >= 2 && !player.ended) setStatus('Paused. Use the player controls to continue.');
  });
  player.addEventListener('ended', () => {
    if (player.getAttribute('src')) setStatus('Lesson finished. You can replay it or choose another topic.');
  });
  player.addEventListener('error', () => {
    if (player.getAttribute('src')) setStatus('This video could not be loaded. The URL may be unavailable, expired, or in an unsupported format.', true);
  });
  const registered = videos.filter(item => mediaUrl(item.src)).length;
  document.getElementById('libraryNotice').textContent = registered
    ? `${registered} ${registered === 1 ? 'video is' : 'videos are'} registered. Topics marked “Preview” do not have a video yet.`
    : 'Preview library: the topics below are planned lessons. Videos have not been uploaded yet.';
  render();
})();
