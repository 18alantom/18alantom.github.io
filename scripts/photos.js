const docTitle = "Photo's From Alan's Space";
const isTouchSupported =
  /Android|iPhone|iPad|Opera Mini/i.test(navigator.userAgent) ||
  navigator.maxTouchPoints > 0;

// Globals to manage state
const touchStart = { x: 0, y: 0, time: 0, count: 0 }; // track gestures
const scrollTop = { body: 0, document: 0 }; // for restoring scroll position after fullview
let dispatchLocationChange = true; //  prevents event dispatch, prevents ∞ recursion

function init() {
  populateGallery();
  updateDialog();

  window.addEventListener('keydown', handleKeydown);
  document
    .getElementById('next-button')
    ?.addEventListener('click', () => changeImage(true));
  document
    .getElementById('prev-button')
    ?.addEventListener('click', () => changeImage(false));
  document
    .getElementById('close-button')
    ?.addEventListener('click', () => closeFullview());
  document
    .getElementById('info-button')
    ?.addEventListener('click', () => toggleInfo());

  registerLocationChangeDispatchers();
  window.addEventListener('locationchange', updateDialog);
  toggleInfo(false);
  setAllLinkDisplay();
  addGestureListeners();
  document
    .getElementById('help-button')
    .addEventListener('click', () => toggleHelp());
}

function toggleHelp(show) {
  toggleInfo(false);
  const id = isTouchSupported ? 'help-touch' : 'help-keyboard';
  const help = document.getElementById(id);

  show ??= help.dataset.visible === 'false';
  const fullview = getFullview();
  if (!fullview || !fullview.open) return;

  help.dataset.visible = show ? 'true' : 'false';

  if (show) {
    fullview.scrollTop = fullview.scrollHeight;
  } else {
    fullview.scrollTop = 0;
  }
}

function handleKeydown(e) {
  if ((e.shiftKey && e.key !== '?') || e.metaKey || e.altKey) {
    return;
  }

  switch (e.key) {
    case 'Escape':
    case 'q':
    case 'c':
      closeFullview();
      e.preventDefault();
      break;
    case 'ArrowLeft':
    case 'h':
      changeImage(false);
      break;
    case 'ArrowRight':
    case 'l':
      changeImage(true);
      break;
    case 'i':
      toggleInfo();
      break;
    case '?':
      toggleHelp();
      break;
  }
}

function registerLocationChangeDispatchers() {
  /**
   * history updation methods need to be overridden
   * cause there isn't another viable way to listen
   * to changes in location
   *
   * ref: https://stackoverflow.com/a/52809105/9681690
   */
  let oldPushState = history.pushState;
  history.pushState = function pushState() {
    let ret = oldPushState.apply(this, arguments);
    dispatchLocationChange && window.dispatchEvent(new Event('locationchange'));
    return ret;
  };

  let oldReplaceState = history.replaceState;
  history.replaceState = function replaceState() {
    let ret = oldReplaceState.apply(this, arguments);
    dispatchLocationChange && window.dispatchEvent(new Event('locationchange'));
    return ret;
  };

  window.addEventListener('popstate', () => {
    dispatchLocationChange && window.dispatchEvent(new Event('locationchange'));
  });
}

function populateGallery() {
  let idx = 0;
  const albumId = new URL(location).searchParams.get('album');

  for (const album of albums) {
    if (albumId && album.id !== albumId) continue;

    // convert image datetimeoriginal to Date, use first as album date
    const albumDatetime = new Date(album.datetime ?? -22118400000);

    const galleryDiv = document.createElement('div');
    galleryDiv.classList.add('gallery');

    const titleH1 = document.createElement('h1');
    titleH1.innerText = album.title;
    galleryDiv.appendChild(titleH1);

    const time = document.createElement('time');
    time.dateTime = albumDatetime.toISOString();
    time.innerText = formatAlbumDate(albumDatetime);

    titleH1.classList.add('gallery-title');
    titleH1.appendChild(time);

    document.body.appendChild(galleryDiv);

    for (const image of album.images) {
      const img = getImg(idx, album, image);
      galleryDiv.appendChild(img);
      idx += 1;
    }
  }
}

function setAllLinkDisplay() {
  const album = new URL(location).searchParams.get('album');
  const show = !!album;

  const allLink = document.getElementById('all-link');
  if (show) {
    allLink.style.display = '';
  } else {
    allLink.style.display = 'none';
  }
}

function getImg(idx, album, image) {
  const container = document.createElement('div');
  container.dataset.index = idx;
  container.classList.add('container');
  container.addEventListener('click', () => updateHistory(image.id));

  container.style.aspectRatio = 4 / 3;
  container.style.backgroundImage = `url('${image.preload}')`;

  const mainImg = document.createElement('img');
  mainImg.src = `photos/${image.small}`;
  mainImg.title = `${image.title} · ${formatDate(
    image.metadata.DateTimeOriginal
  )}`;
  mainImg.alt = image.title;
  mainImg.classList.add('thumbnail');
  mainImg.onload = () => mainImg.classList.add('loaded');
  container.append(mainImg);

  return container;
}

function getFullview() {
  const fullview = document.getElementById('fullview');
  if (!(fullview instanceof HTMLDialogElement))
    throw Error(`fullview is ${fullview}`);
  return fullview;
}

function updateHistory(image) {
  const url = new URL(location);
  const album = url.searchParams.get('album');

  if (!album || !image) {
    url.searchParams.delete('album');
    url.searchParams.delete('image');
  }

  if (album) {
    url.searchParams.set('album', album);
  }

  if (image) {
    url.searchParams.set('image', image);
  }

  history.pushState({}, '', url);
  setAllLinkDisplay();
}

function updateDialog() {
  const triggered = openFullview();
  if (triggered) return;
  closeFullview();
}

function openFullview() {
  const pic = getPicture();
  if (!pic) return false;

  document.title = pic.image.title;
  updateFullview(pic.image);
  updateInfo(pic.image, pic.album);
  const fullview = getFullview();

  if (document.getElementById('info')?.style.display === '') {
    fullview.scrollTop = fullview.scrollHeight; // scroll to bottom edge if info visible
  }

  // top 0 to prevent weird -ve top in fullview, restored on close
  scrollTop.body = document.body.scrollTop;
  scrollTop.document = document.documentElement.scrollTop;
  document.documentElement.style.scrollBehavior = 'auto';
  document.body.scrollTop = 0;
  document.documentElement.scrollTop = 0;
  document.body.style.overflow = 'hidden';

  fullview.show();
  return true;
}

function updateFullview(image) {
  // Set theme to dark if dark photo and light theme, else stay on pre-set theme
  const tags = image.metadata.Subject ?? '';
  const photoTheme = tags.includes('dark') ? 'dark' : 'light';
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const selectedTheme = localStorage.getItem('theme');
  if (currentTheme === 'light' && photoTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', photoTheme);
  } else if (
    selectedTheme === 'light' &&
    currentTheme === 'dark' &&
    photoTheme === 'light'
  ) {
    document.documentElement.setAttribute('data-theme', 'light');
  }

  // Set container dimensions
  const container = document.getElementById('fullview-image-container');
  const [w, h] = image.metadata.ImageSize.split('x').map((i) => Number(i));

  container.style.backgroundImage = `url('${image.preload}')`;

  const aspectRatio = w / h;
  container.style.aspectRatio = aspectRatio;

  //  Select min of (max width - clearance) OR (max height - clearance) as width
  const maxWidth = `calc(100vw - (2 * var(--lr-spacing)))`;
  let maxHeight = `calc((100vh - 3 * var(--lr-spacing) - var(--fs-base)) * ${aspectRatio})`;
  if (isTouchSupported && window.innerHeight < window.innerWidth) {
    // additional clearance for fixed info bar
    maxHeight = `calc((100vh - 8 * var(--lr-spacing) - var(--fs-base)) * ${aspectRatio})`;
  }
  const width = `min(${maxWidth}, ${maxHeight})`;
  container.parentElement.style.width = width;

  // Remove and set placeholder image for fullview
  document.getElementById('fullview-placeholder')?.remove();
  const placeholder = document.createElement('img');
  placeholder.id = 'fullview-placeholder';
  placeholder.src = `photos/${image.small}`;
  placeholder.title = 'Placeholder';
  placeholder.alt = image.title;
  container.append(placeholder);

  // Remove and set new fullview image
  document.getElementById('fullview-image')?.remove();
  const img = document.createElement('img');
  img.id = 'fullview-image';
  img.src = `photos/${image.big}`;
  img.title = `${image.title} · ${formatDate(image.metadata.DateTimeOriginal)}`;
  img.alt = image.title;
  img.onload = () => img.classList.add('loaded');
  container.append(img);

  setImageTitle(document.getElementById('fullview-title'), image);
}

function setImageTitle(element, image) {
  element.innerText = image.title;
  if (image.title.toLowerCase() === 'untitled') {
    element.classList.add('untitled');
  } else {
    element.classList.remove('untitled');
  }
}

function updateInfo(image, album) {
  setImageTitle(document.getElementById('info-title'), image);

  document.getElementById('info-album').innerText = album.title;
  document.getElementById('info-time').innerText = formatDate(
    image.metadata.DateTimeOriginal,
    true
  );

  document.getElementById('info-camera').innerText = getGearModel(image, false);
  document.getElementById('info-lens').innerText = getGearModel(image, true);

  document.getElementById('info-iso').innerText = 'ISO' + image.metadata.ISO;
  document.getElementById(
    'info-fstop'
  ).innerText = `ƒ/${image.metadata.FNumber}`;
  document.getElementById('info-shutter').innerText =
    image.metadata.ExposureTime + ' sec';
  document.getElementById('info-focal').innerText =
    image.metadata.FocalLength.split(' ').join('');
  // document.getElementById('info-program').innerText = image.metadata.ExposureProgram;
  document.getElementById('info-filename').innerText = image.big
    .split('/')
    .at(1);
  document.getElementById('info-mpix').innerText = `${(
    image.metadata.ImageSize.split('x').reduce((a, b) => a * b) / 1000000
  ).toFixed(2)} MP`;
  document.getElementById(
    'info-resolution'
  ).innerText = `${image.metadata.ImageSize}`;
  document.getElementById('info-size').innerText = getImageSize(image.size);
}

function getImageSize(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(2)} MB`;
  return `${(size / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function getGearModel(image, isLens) {
  let model = isLens ? image.metadata.LensModel : image.metadata.Model;
  let make = isLens ? image.metadata.LensMake : image.metadata.Make;
  return [make, model].join(' ');
}

function getPicture(getPrev, getNext) {
  const albumId = new URL(location).searchParams.get('album');
  const imageId = new URL(location).searchParams.get('image');

  if (!imageId) return null;

  for (const a in albums) {
    let album = albums[a];
    if (albumId && album.id !== albumId) continue;

    for (const i in album.images) {
      const image = album.images[i];
      if (image.id !== imageId) continue;

      if (getPrev) {
        let image = album.images[Number(i) - 1];
        if (image) return { album, image };

        album = albums[Number(a) - 1];
        if (!album) return null;

        image = album.images.at(-1);
        if (!image) return null;

        return { album, image };
      }

      if (getNext) {
        let image = album.images[Number(i) + 1];
        if (image) return { album, image };

        album = albums[Number(a) + 1];
        if (!album) return null;

        image = album.images[0];
        if (!image) return null;
        return { album, image };
      }

      return { album, image };
    }
  }

  return null;
}

function changeImage(toNext) {
  if (!getFullview().open) return;
  const pic = getPicture(!toNext, toNext);
  if (!pic) return;

  updateHistory(pic.image.id);
}

function closeFullview() {
  if (new URL(location).searchParams.get('image')) {
    const album = new URL(location).searchParams.get('album');
    dispatchLocationChange = false;
    updateHistory(null);
    dispatchLocationChange = true;
  }

  // restore positions
  document.documentElement.scrollTop = scrollTop.document;
  document.body.scrollTop = scrollTop.body;
  document.body.style.overflow = '';
  document.documentElement.style.scrollBehavior = '';

  const fullview = getFullview();
  if (fullview.open) fullview.close();
  document.title = docTitle;
  toggleInfo(false);
  toggleHelp(false);
  setTheme(); // from theme.js
}

function toggleInfo(show) {
  show ??= document.getElementById('info').style.display === 'none';
  const fullview = getFullview();
  const infoDiv = document.getElementById('info');
  const titleH1 = document.getElementById('fullview-title');

  if (show) {
    toggleHelp(false);
    titleH1.style.display = 'none';
    infoDiv.style.display = '';
    fullview.scrollTop = fullview.scrollHeight;
  } else {
    titleH1.style.display = '';
    infoDiv.style.display = 'none';
    fullview.scrollTop = 0;
  }
}

function formatDate(date, mentionTime) {
  // '1995-01-21' -> '21 Jan, 1995' OR '21 Jan, 1995 20:24:11 +0530'
  const d = new Date(date);
  let [month, day, year] = d.toDateString().split(' ').slice(1);
  if (day.startsWith('0')) day = day.slice(1);

  const dateString = `${month} ${day}, ${year}`;
  if (!mentionTime) return dateString;

  const [time, zone] = d.toTimeString().split(' ').slice(0, 2);
  return `${dateString} ${time} ${zone.slice(3)}`;
}

function formatAlbumDate(date) {
  // '1995-01-21' -> 'Jan 1995'
  let [month, _, year] = new Date(date).toDateString().split(' ').slice(1);
  return `${month} ${year}`;
}

function addGestureListeners() {
  if (!isTouchSupported) return;

  document.addEventListener(
    'touchstart',
    (e) => {
      touchStart.x = e.touches[0].clientX;
      touchStart.y = e.touches[0].clientY;
      touchStart.time = new Date().valueOf();
      touchStart.count = e.touches.length;
    },
    false
  );

  document.addEventListener('touchend', handleTouchEnd, false);
}

function handleTouchEnd(e) {
  if (!getFullview().open) return;

  const swipeDistanceX = e.changedTouches[0].clientX - touchStart.x;
  const swipeDistanceY = e.changedTouches[0].clientY - touchStart.y;
  const duration = new Date().valueOf() - touchStart.time;

  const min = 50;
  const max = 200;
  if (
    (Math.abs(swipeDistanceX) < min && Math.abs(swipeDistanceY) < min) ||
    (Math.abs(swipeDistanceX) > max && Math.abs(swipeDistanceY) > max) ||
    (window.visualViewport?.scale ?? 1) > 1.5 ||
    touchStart.count !== 1 ||
    duration > 500
  )
    return;

  const isHorizontal = Math.abs(swipeDistanceX) > Math.abs(swipeDistanceY);
  if (isHorizontal && swipeDistanceX < 0) {
    changeImage(true);
  } else if (isHorizontal && swipeDistanceX > 0) {
    changeImage(false);
  } else if (!isHorizontal && swipeDistanceY < 0) {
    toggleInfo(true);
  } else {
    toggleInfo(false);
    toggleHelp(false);
  }
}

// ALBUMS_JSON_START
const albums = [{"id": "mold", "title": "Mold", "images": [{"id": "DSC01174", "title": "Untitled", "big": "mold/DSC01174_big.avif", "small": "mold/DSC01174_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAFwAAAwEAAAAAAAAAAAAAAAAAAAQFAf/EAB8QAAICAgEFAAAAAAAAAAAAAAABAhEDBHESMTJhgf/EABUBAQEAAAAAAAAAAAAAAAAAAAAB/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8Al6co9SvsUth45YbjXqiRqu1wPJVj+BSM4pzdoDZeT5AI/9k=", "metadata": {"Artist": "Alan Tom", "DateTimeOriginal": "2025-02-10 14:55:18", "ExposureTime": "1/125", "FNumber": "5.0", "ISO": "400", "FocalLength": "35.0 mm", "ExposureProgram": "Manual", "Make": "Sony", "Model": "ILCE-7CM2", "LensID": "E 28-75mm F2.8 A063", "LensModel": "E 28-75mm F2.8 A063", "ImageSize": "6780x4520", "Subject": "dark", "LensMake": "Tamron"}, "size": 533088, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSC01177", "title": "Untitled", "big": "mold/DSC01177_big.avif", "small": "mold/DSC01177_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAFwAAAwEAAAAAAAAAAAAAAAAAAAQFA//EACAQAAICAQMFAAAAAAAAAAAAAAECABEDBAVxEhMhMUH/xAAVAQEBAAAAAAAAAAAAAAAAAAAAAf/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJm34g1dX2P6pFXEKFG5L0TkDiO53btmzfMBE+4TJ8pViAB4hKP/2Q==", "metadata": {"Artist": "Alan Tom", "DateTimeOriginal": "2025-02-10 15:00:27", "ExposureTime": "1/100", "FNumber": "4.5", "ISO": "125", "FocalLength": "35.0 mm", "ExposureProgram": "Manual", "Make": "Sony", "Model": "ILCE-7CM2", "LensID": "E 28-75mm F2.8 A063", "LensModel": "E 28-75mm F2.8 A063", "ImageSize": "6780x4520", "Subject": "dark", "LensMake": "Tamron"}, "size": 462199, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSC01178", "title": "Untitled", "big": "mold/DSC01178_big.avif", "small": "mold/DSC01178_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAABQAE/8QAGhAAAgMBAQAAAAAAAAAAAAAAAQIAAxEEIf/EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwAjlsVrBGXCmk5mZogXCNeK3sy1BQfIB1vlhlM1tjCwgGUD/9k=", "metadata": {"Artist": "Alan Tom", "DateTimeOriginal": "2025-02-10 15:01:04", "ExposureTime": "1/100", "FNumber": "4.5", "ISO": "200", "FocalLength": "35.0 mm", "ExposureProgram": "Manual", "Make": "Sony", "Model": "ILCE-7CM2", "LensID": "E 28-75mm F2.8 A063", "LensModel": "E 28-75mm F2.8 A063", "ImageSize": "6780x4520", "Subject": "dark", "LensMake": "Tamron"}, "size": 531779, "created": "2025-03-01T19:16:45.645501"}], "datetime": "2025-02-10T14:55:18", "created": "2025-03-01T19:17:12.090889"}, {"id": "colaba", "title": "Colaba", "images": [{"id": "DSC01072", "title": "Three AC Units", "big": "colaba/DSC01072_big.avif", "small": "colaba/DSC01072_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/wAALCAAIABQBAREA/8QAFgAAAwAAAAAAAAAAAAAAAAAAAAEF/8QAGhAAAwEBAQEAAAAAAAAAAAAAAQIDAAQRIf/aAAgBAQAAPwCzHqs0yWH3MdNTMkqcTvZl9I3/2Q==", "metadata": {"Artist": "Alan Tom", "Title": "Three AC Units", "DateTimeOriginal": "2025-02-02 16:05:34", "ExposureTime": "1/4000", "FNumber": "2.8", "ISO": "400", "FocalLength": "49.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Sony", "Model": "ILCE-7CM2", "LensID": "E 28-75mm F2.8 A063", "LensModel": "E 28-75mm F2.8 A063", "ImageSize": "5388x2254", "Subject": "select", "LensMake": "Tamron"}, "size": 376548, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSC01077", "title": "Delivery", "big": "colaba/DSC01077_big.avif", "small": "colaba/DSC01077_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/wAALCAANABQBAREA/8QAFwABAAMAAAAAAAAAAAAAAAAABAEDBf/EAB8QAAEEAgIDAAAAAAAAAAAAAAEAAgQRAzESFCFCUv/aAAgBAQAAPwDaOJxPMFRb/bSvZILWgVpDEp4FUiyZ2RvgAIvczfS//9k=", "metadata": {"Artist": "Alan Tom", "Title": "Delivery", "DateTimeOriginal": "2025-02-02 16:07:39", "ExposureTime": "1/4000", "FNumber": "2.8", "ISO": "400", "FocalLength": "38.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Sony", "Model": "ILCE-7CM2", "LensID": "E 28-75mm F2.8 A063", "LensModel": "E 28-75mm F2.8 A063", "ImageSize": "6160x4106", "Subject": "select", "LensMake": "Tamron"}, "size": 951711, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSC01084", "title": "Birds", "big": "colaba/DSC01084_big.avif", "small": "colaba/DSC01084_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAGAAAAwEBAAAAAAAAAAAAAAAAAAUGAgT/xAAeEAABBAIDAQAAAAAAAAAAAAAAAQIDEQQhBRIxQf/EABUBAQEAAAAAAAAAAAAAAAAAAAEC/8QAFhEBAQEAAAAAAAAAAAAAAAAAABES/9oADAMBAAIRAxEAPwCnxUb7fh1xq190t0S02bJFHbPuhlwOQ+VFV27DVTmHXRANAIf/2Q==", "metadata": {"Artist": "Alan Tom", "Title": "Birds", "DateTimeOriginal": "2025-02-02 16:13:17", "ExposureTime": "1/4000", "FNumber": "2.8", "ISO": "100", "FocalLength": "75.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Sony", "Model": "ILCE-7CM2", "LensID": "E 28-75mm F2.8 A063", "LensModel": "E 28-75mm F2.8 A063", "ImageSize": "5624x3749", "Subject": "select", "LensMake": "Tamron"}, "size": 79152, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSC01088", "title": "Weathercock", "big": "colaba/DSC01088_big.avif", "small": "colaba/DSC01088_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAFwAAAwEAAAAAAAAAAAAAAAAAAAMEAf/EAB0QAAICAQUAAAAAAAAAAAAAAAABAiEDBBESIzH/xAAXAQADAQAAAAAAAAAAAAAAAAABAgME/8QAFxEAAwEAAAAAAAAAAAAAAAAAAAIRIv/aAAwDAQACEQMRAD8AbjSVvwojFNUybI+MB+mfWijPGhmRM02UFvYDQGoIf//Z", "metadata": {"Artist": "Alan Tom", "Title": "Weathercock", "DateTimeOriginal": "2025-02-02 16:15:14", "ExposureTime": "1/3200", "FNumber": "2.8", "ISO": "100", "FocalLength": "75.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Sony", "Model": "ILCE-7CM2", "LensID": "E 28-75mm F2.8 A063", "LensModel": "E 28-75mm F2.8 A063", "ImageSize": "6312x4207", "Subject": "select", "LensMake": "Tamron"}, "size": 77308, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSC01103", "title": "Crow on a Lamp", "big": "colaba/DSC01103_big.avif", "small": "colaba/DSC01103_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/wAALCAANABQBAREA/8QAFgABAQEAAAAAAAAAAAAAAAAABAYF/8QAHhAAAgICAgMAAAAAAAAAAAAAAQIAAwQRBSESMWH/2gAIAQEAAD8AdlctTVaE3sfDEK9eRXtTuDehgxAHUjHvdm8ye5u8Bl2FwhOwevcoZ//Z", "metadata": {"Artist": "Alan Tom", "Title": "Crow on a Lamp", "DateTimeOriginal": "2025-02-02 17:20:22", "ExposureTime": "1/4000", "FNumber": "2.8", "ISO": "100", "FocalLength": "75.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Sony", "Model": "ILCE-7CM2", "LensID": "E 28-75mm F2.8 A063", "LensModel": "E 28-75mm F2.8 A063", "ImageSize": "5256x3504", "Subject": "dark, select", "LensMake": "Tamron"}, "size": 46202, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSC01110", "title": "Man Checking Phone", "big": "colaba/DSC01110_big.avif", "small": "colaba/DSC01110_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/wAALCAALABQBAREA/8QAFgABAQEAAAAAAAAAAAAAAAAAAgQB/8QAGBAAAwEBAAAAAAAAAAAAAAAAAAECESH/2gAIAQEAAD8AmVI0SawmkWjnqP/Z", "metadata": {"Artist": "Alan Tom", "Title": "Man Checking Phone", "DateTimeOriginal": "2025-02-02 17:31:25", "ExposureTime": "1/800", "FNumber": "2.8", "ISO": "100", "FocalLength": "75.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Sony", "Model": "ILCE-7CM2", "LensID": "E 28-75mm F2.8 A063", "LensModel": "E 28-75mm F2.8 A063", "ImageSize": "2670x1512", "Subject": "dark, select", "LensMake": "Tamron"}, "size": 269766, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSC01111", "title": "Boats by the Gate", "big": "colaba/DSC01111_big.avif", "small": "colaba/DSC01111_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAIABQDASIAAhEBAxEB/8QAFwABAAMAAAAAAAAAAAAAAAAAAAMEBf/EABsQAAICAwEAAAAAAAAAAAAAAAABAhEDBbGR/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJsG1inG3T4aOHcQq21wACxHbRkrSXoAA//Z", "metadata": {"Artist": "Alan Tom", "Title": "Boats by the Gate", "DateTimeOriginal": "2025-02-02 17:33:08", "ExposureTime": "1/400", "FNumber": "7.1", "ISO": "100", "FocalLength": "75.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Sony", "Model": "ILCE-7CM2", "LensID": "E 28-75mm F2.8 A063", "LensModel": "E 28-75mm F2.8 A063", "ImageSize": "6994x2926", "Subject": "dark, select", "LensMake": "Tamron"}, "size": 299974, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSC01115", "title": "The Taj Mahal Palace", "big": "colaba/DSC01115_big.avif", "small": "colaba/DSC01115_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/wAALCAANABQBAREA/8QAFgABAQEAAAAAAAAAAAAAAAAABQEE/8QAIRAAAgEDBAMBAAAAAAAAAAAAAQIAAwQRBRIhkTEyUnH/2gAIAQEAAD8AWuqlCghJYZ/YFcahbsGXco5z5hr1aLMTuHcPuNRuK/s5AmXc30e5VdlGAeJ//9k=", "metadata": {"Artist": "Alan Tom", "Title": "The Taj Mahal Palace", "DateTimeOriginal": "2025-02-02 17:34:07", "ExposureTime": "1/400", "FNumber": "7.1", "ISO": "100", "FocalLength": "33.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Sony", "Model": "ILCE-7CM2", "LensID": "E 28-75mm F2.8 A063", "LensModel": "E 28-75mm F2.8 A063", "ImageSize": "6503x4335", "Subject": "dark, select", "LensMake": "Tamron"}, "size": 80726, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSC01126", "title": "Two Birds", "big": "colaba/DSC01126_big.avif", "small": "colaba/DSC01126_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAFwABAQEBAAAAAAAAAAAAAAAABQABA//EACEQAAEDAwQDAAAAAAAAAAAAAAIAAQMREiEEExRBMVFx/8QAFQEBAQAAAAAAAAAAAAAAAAAAAwL/xAAYEQADAQEAAAAAAAAAAAAAAAAAAhETA//aAAwDAQACEQMRAD8AREa5fwtuEcLlq5SiiuGnpHcg6vdlWzwBOdFN8W7UiXlN+6fFI9GFzU//2Q==", "metadata": {"Artist": "Alan Tom", "Title": "Two Birds", "DateTimeOriginal": "2025-02-02 17:57:02", "ExposureTime": "1/640", "FNumber": "2.8", "ISO": "100", "FocalLength": "55.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Sony", "Model": "ILCE-7CM2", "LensID": "E 28-75mm F2.8 A063", "LensModel": "E 28-75mm F2.8 A063", "ImageSize": "4394x2929", "Subject": "select", "LensMake": "Tamron"}, "size": 75876, "created": "2025-03-01T19:16:45.645501"}], "datetime": "2025-02-02T16:05:34", "created": "2025-03-01T19:17:12.090889"}, {"id": "creature_portraits", "title": "Creature Portraits", "images": [{"id": "DSC00869", "title": "Portrait of a Pigeon", "big": "creature_portraits/DSC00869_big.avif", "small": "creature_portraits/DSC00869_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/wAALCAANABQBAREA/8QAFwAAAwEAAAAAAAAAAAAAAAAAAQMEBf/EABwQAAICAgMAAAAAAAAAAAAAAAECAAMEEQUhMf/aAAgBAQAAPwDB465UU7ismxbbToyYoNyZbWAIBhWxh37CbWn/2Q==", "metadata": {"Artist": "Alan Tom", "Title": "Portrait of a Pigeon", "DateTimeOriginal": "2025-01-22 00:39:08", "ExposureTime": "1", "FNumber": "2.8", "ISO": "51200", "FocalLength": "45.0 mm", "ExposureProgram": "Manual", "Make": "Sony", "Model": "ILCE-7CM2", "LensID": "E 28-75mm F2.8 A063", "LensModel": "E 28-75mm F2.8 A063", "ImageSize": "7015x4676", "Subject": "dark, select", "LensMake": "Tamron"}, "size": 2851157, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSC0[0999-1019]", "title": "Portrait of a Fly", "big": "creature_portraits/DSC0[0999-1019]_big.avif", "small": "creature_portraits/DSC0[0999-1019]_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/wAALCAANABQBAREA/8QAFgABAQEAAAAAAAAAAAAAAAAABAMC/8QAHRAAAQQCAwAAAAAAAAAAAAAAAQACAxESQRMhMf/aAAgBAQAAPwBnjbC3A/M0VR2N6UIxfWkqONrGEhDlceQr/9k=", "metadata": {"Artist": "Alan Tom", "Title": "Portrait of a Fly", "DateTimeOriginal": "2025-02-01 09:58:16", "ExposureTime": "1/60", "FNumber": "2.8", "ISO": "200", "FocalLength": "31.0 mm", "ExposureProgram": "Manual", "Make": "Sony", "Model": "ILCE-7CM2", "LensID": "E 28-75mm F2.8 A063", "LensModel": "E 28-75mm F2.8 A063", "ImageSize": "4152x2766", "Subject": "dark, select", "LensMake": "Tamron"}, "size": 142758, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSC01082", "title": "Portrait of a Cat", "big": "creature_portraits/DSC01082_big.avif", "small": "creature_portraits/DSC01082_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAFwABAQEBAAAAAAAAAAAAAAAAAAYBA//EACAQAAICAAcBAQAAAAAAAAAAAAECAAMEBhEhMUFhBRL/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8A18xMzBe/DOqZgY2AuNh7I+uwluNCN4txNgbmBWYj7ym0n9abdxI03OTqTED/2Q==", "metadata": {"Artist": "Alan Tom", "Title": "Portrait of a Cat", "DateTimeOriginal": "2025-02-02 16:12:01", "ExposureTime": "1/200", "FNumber": "2.8", "ISO": "100", "FocalLength": "75.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Sony", "Model": "ILCE-7CM2", "LensID": "E 28-75mm F2.8 A063", "LensModel": "E 28-75mm F2.8 A063", "ImageSize": "6162x4108", "Subject": "dark, select", "LensMake": "Tamron"}, "size": 116939, "created": "2025-03-01T19:16:45.645501"}], "datetime": "2025-01-22T00:39:08", "created": "2025-03-01T19:17:12.090889"}, {"id": "untitled_II", "title": "Untitled II", "images": [{"id": "DSC00708", "title": "Untitled", "big": "untitled_II/DSC00708_big.avif", "small": "untitled_II/DSC00708_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAHABQDASIAAhEBAxEB/8QAFwABAAMAAAAAAAAAAAAAAAAAAAIDBf/EABcQAQEBAQAAAAAAAAAAAAAAAAACEQH/xAAWAQEBAQAAAAAAAAAAAAAAAAAAAQL/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwDA7GVidRnN4DArAUf/2Q==", "metadata": {"Artist": "Alan Tom", "DateTimeOriginal": "2025-01-17 18:41:39.452", "ExposureTime": "0.6", "FNumber": "2.8", "ISO": "125", "FocalLength": "75.0 mm", "ExposureProgram": "Manual", "Make": "Sony", "Model": "ILCE-7CM2", "LensID": "Tamron 28-75mm F2.8 Di III VXD G2", "LensModel": "E 28-75mm F2.8 A063", "ImageSize": "5641x1851", "Subject": "dark, select", "LensMake": "Tamron"}, "size": 130271, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSC00768", "title": "Evening Walk", "big": "untitled_II/DSC00768_big.avif", "small": "untitled_II/DSC00768_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAALABQDASIAAhEBAxEB/8QAFwAAAwEAAAAAAAAAAAAAAAAAAAQFBv/EABwQAAICAwEBAAAAAAAAAAAAAAABAgMEETESof/EABQBAQAAAAAAAAAAAAAAAAAAAAH/xAAWEQEBAQAAAAAAAAAAAAAAAAAAARH/2gAMAwEAAhEDEQA/AGr8epx4jPZ2B7lJou2N+eiQCM3LDti9a+AW2k+pAB1//9k=", "metadata": {"Artist": "Alan Tom", "Title": "Evening Walk", "DateTimeOriginal": "2025-01-17 19:03:16.983", "ExposureTime": "1/6", "FNumber": "2.8", "ISO": "800", "FocalLength": "51.0 mm", "ExposureProgram": "Manual", "Make": "Sony", "Model": "ILCE-7CM2", "LensID": "Tamron 28-75mm F2.8 Di III VXD G2", "LensModel": "E 28-75mm F2.8 A063", "ImageSize": "5493x3089", "Subject": "dark, select", "LensMake": "Tamron"}, "size": 469350, "created": "2025-03-01T19:16:45.645501"}], "datetime": "2025-01-17T18:41:39.452000", "created": "2025-03-01T19:17:12.090889"}, {"id": "near_the_mangroves", "title": "Near The Mangroves", "images": [{"id": "DSC00301", "title": "Grounded Boat", "big": "near_the_mangroves/DSC00301_big.avif", "small": "near_the_mangroves/DSC00301_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAALABQDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAABQAE/8QAHxAAAQIGAwAAAAAAAAAAAAAAAAQFAQIDERMhFDFh/8QAFgEBAQEAAAAAAAAAAAAAAAAAAAEC/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AIVLc0OzS2OfGvcIIjRNU5xq15pteaIMID//Z", "metadata": {"Artist": "Alan Tom", "Title": "Grounded Boat", "DateTimeOriginal": "2024-12-31 17:36:53", "ExposureTime": "1/60", "FNumber": "2.8", "ISO": "100", "FocalLength": "58.0 mm", "ExposureProgram": "Manual", "Make": "Sony", "Model": "ILCE-7CM2", "LensID": "E 28-75mm F2.8 A063", "LensModel": "E 28-75mm F2.8 A063", "ImageSize": "6839x3846", "Subject": "dark, select", "LensMake": "Tamron"}, "size": 532290, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSC00317", "title": "Mattress on a Bough", "big": "near_the_mangroves/DSC00317_big.avif", "small": "near_the_mangroves/DSC00317_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAALABQDASIAAhEBAxEB/8QAGAAAAgMAAAAAAAAAAAAAAAAAAAQBAgP/xAAcEAEAAgIDAQAAAAAAAAAAAAABAAIDEQQFITH/xAAWAQEBAQAAAAAAAAAAAAAAAAABAAL/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCle2vY3f7FeR2V1bDomXFqWqr7IzUqDoIEhlyOW7ZhDKBdA1CTL//Z", "metadata": {"Artist": "Alan Tom", "Title": "Mattress on a Bough", "DateTimeOriginal": "2024-12-31 17:52:19.180", "ExposureTime": "1/60", "FNumber": "4.0", "ISO": "200", "FocalLength": "75.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Sony", "Model": "ILCE-7CM2", "LensID": "Tamron 28-75mm F2.8 Di III VXD G2", "LensModel": "E 28-75mm F2.8 A063", "ImageSize": "7031x3954", "Subject": "dark, select", "LensMake": "Tamron"}, "size": 976818, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSC00328", "title": "Leaving the Tree", "big": "near_the_mangroves/DSC00328_big.avif", "small": "near_the_mangroves/DSC00328_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAGAAAAwEBAAAAAAAAAAAAAAAAAAMEAgX/xAAdEAACAwACAwAAAAAAAAAAAAABAgADEQQSQWGR/8QAFgEBAQEAAAAAAAAAAAAAAAAAAQAC/8QAFhEBAQEAAAAAAAAAAAAAAAAAABIR/9oADAMBAAIRAxEAPwDbWKo0xL3q2Z59yHkXMRvwRCWt2AJ0GZ0y6XaEmFjAYDCNKX//2Q==", "metadata": {"Artist": "Alan Tom", "Title": "Leaving the Tree", "DateTimeOriginal": "2024-12-31 18:00:15.607", "ExposureTime": "1/640", "FNumber": "9.0", "ISO": "800", "FocalLength": "75.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Sony", "Model": "ILCE-7CM2", "LensID": "Tamron 28-75mm F2.8 Di III VXD G2", "LensModel": "E 28-75mm F2.8 A063", "ImageSize": "6515x4343", "Subject": "dark, select", "LensMake": "Tamron"}, "size": 453848, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSC00344", "title": "Untitled", "big": "near_the_mangroves/DSC00344_big.avif", "small": "near_the_mangroves/DSC00344_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAFwAAAwEAAAAAAAAAAAAAAAAAAAMEBf/EABwQAAIDAAMBAAAAAAAAAAAAAAABAgMRISMxUf/EABYBAQEBAAAAAAAAAAAAAAAAAAMAAv/EABYRAQEBAAAAAAAAAAAAAAAAAAABEf/aAAwDAQACEQMRAD8AdCpKPCTJr6sT+FiliwRe+s1FZMZ79AAEA//Z", "metadata": {"Artist": "Alan Tom", "DateTimeOriginal": "2024-12-31 18:24:11", "ExposureTime": "1/125", "FNumber": "2.8", "ISO": "800", "FocalLength": "75.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Sony", "Model": "ILCE-7CM2", "LensID": "E 28-75mm F2.8 A063", "LensModel": "E 28-75mm F2.8 A063", "ImageSize": "6562x4374", "Subject": "select", "LensMake": "Tamron"}, "size": 33014, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSC00350", "title": "Branch Silhouette", "big": "near_the_mangroves/DSC00350_big.avif", "small": "near_the_mangroves/DSC00350_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAALABQDASIAAhEBAxEB/8QAGAAAAgMAAAAAAAAAAAAAAAAAAAUBAgb/xAAgEAACAQQBBQAAAAAAAAAAAAAAAQMCBBFREiExQZGx/8QAFQEBAQAAAAAAAAAAAAAAAAAAAQL/xAAVEQEBAAAAAAAAAAAAAAAAAAAAEf/aAAwDAQACEQMRAD8ATRXcWEvBeW4idPdGfy9snlVt+wXTGS4pdXT6Aty9sBqX/9k=", "metadata": {"Artist": "Alan Tom", "Title": "Branch Silhouette", "DateTimeOriginal": "2024-12-31 18:32:19", "ExposureTime": "1/30", "FNumber": "4.0", "ISO": "800", "FocalLength": "28.0 mm", "ExposureProgram": "Manual", "Make": "Sony", "Model": "ILCE-7CM2", "LensID": "E 28-75mm F2.8 A063", "LensModel": "E 28-75mm F2.8 A063", "ImageSize": "6846x3850", "Subject": "dark, select", "LensMake": "Tamron"}, "size": 71156, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSC00406", "title": "Untitled", "big": "near_the_mangroves/DSC00406_big.avif", "small": "near_the_mangroves/DSC00406_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAFwAAAwEAAAAAAAAAAAAAAAAAAAIDBv/EABoQAQADAAMAAAAAAAAAAAAAAAABAhEDEjH/xAAVAQEBAAAAAAAAAAAAAAAAAAAAAf/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AMTWvY1qZA4/VJjYxBAGwKP/2Q==", "metadata": {"Artist": "Alan Tom", "DateTimeOriginal": "2024-12-31 23:17:49", "ExposureTime": "1/30", "FNumber": "2.8", "ISO": "800", "FocalLength": "49.0 mm", "ExposureProgram": "Manual", "Make": "Sony", "Model": "ILCE-7CM2", "LensID": "E 28-75mm F2.8 A063", "LensModel": "E 28-75mm F2.8 A063", "ImageSize": "6081x4054", "Subject": "dark, select", "LensMake": "Tamron"}, "size": 1362242, "created": "2025-03-01T19:16:45.645501"}], "datetime": "2024-12-31T17:36:53", "created": "2025-03-01T19:17:12.090889"}, {"id": "seawoods", "title": "Seawoods", "images": [{"id": "DSC00177", "title": "Seawoods Station", "big": "seawoods/DSC00177_big.avif", "small": "seawoods/DSC00177_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/wAALCAALABQBAREA/8QAFwABAAMAAAAAAAAAAAAAAAAAAwEFBv/EABsQAAIDAQEBAAAAAAAAAAAAAAECAAMRBCIx/9oACAEBAAA/AM1wVV2DGiX8dYBIMr2qwnDIqdlPk5Fe1yp1jAZjv2f/2Q==", "metadata": {"Artist": "Alan Tom", "Title": "Seawoods Station", "DateTimeOriginal": "2024-12-28 18:30:22", "ExposureTime": "1/5", "FNumber": "2.8", "ISO": "800", "FocalLength": "75.0 mm", "ExposureProgram": "Manual", "Make": "Sony", "Model": "ILCE-7CM2", "LensID": "E 28-75mm F2.8 A063", "LensModel": "E 28-75mm F2.8 A063", "ImageSize": "6404x3602", "Subject": "dark, select", "LensMake": "Tamron"}, "size": 152648, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSC00444", "title": "Untitled", "big": "seawoods/DSC00444_big.avif", "small": "seawoods/DSC00444_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAALABQDASIAAhEBAxEB/8QAGAAAAgMAAAAAAAAAAAAAAAAAAAQCBQb/xAAbEAEAAQUBAAAAAAAAAAAAAAAAAQIDBBExM//EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwDDGcKN3NljeB6AsZ6Ea+gH/9k=", "metadata": {"Artist": "Alan Tom", "DateTimeOriginal": "2025-01-03 19:39:51", "ExposureTime": "1/4", "FNumber": "2.8", "ISO": "800", "FocalLength": "28.0 mm", "ExposureProgram": "Shutter speed priority AE", "Make": "Sony", "Model": "ILCE-7CM2", "LensID": "E 28-75mm F2.8 A063", "LensModel": "E 28-75mm F2.8 A063", "ImageSize": "4291x2413", "Subject": "dark, select", "LensMake": "Tamron"}, "size": 103902, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSC00462", "title": "Untitled", "big": "seawoods/DSC00462_big.avif", "small": "seawoods/DSC00462_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAFwAAAwEAAAAAAAAAAAAAAAAAAAUGA//EAB8QAAEEAgIDAAAAAAAAAAAAAAIAAQMRBCEFEzFhkf/EABUBAQEAAAAAAAAAAAAAAAAAAAEA/8QAFxEBAQEBAAAAAAAAAAAAAAAAAAEREv/aAAwDAQACEQMRAD8AkcTFKY2ttJpLxFxW3lb4UQg2k3EW6q9ItMiLkxZANxr6hUpRA5PbbQrRy//Z", "metadata": {"Artist": "Alan Tom", "DateTimeOriginal": "2025-01-03 19:51:07", "ExposureTime": "0.3", "FNumber": "2.8", "ISO": "1250", "FocalLength": "58.0 mm", "ExposureProgram": "Shutter speed priority AE", "Make": "Sony", "Model": "ILCE-7CM2", "LensID": "E 28-75mm F2.8 A063", "LensModel": "E 28-75mm F2.8 A063", "ImageSize": "5520x3680", "Subject": "dark, select", "LensMake": "Tamron"}, "size": 307133, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSC00463", "title": "Untitled", "big": "seawoods/DSC00463_big.avif", "small": "seawoods/DSC00463_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAALABQDASIAAhEBAxEB/8QAGAAAAgMAAAAAAAAAAAAAAAAAAAUDBAb/xAAgEAEAAgIBBAMAAAAAAAAAAAABAAIDBBESEyExMlFx/8QAFgEBAQEAAAAAAAAAAAAAAAAAAAEC/8QAFREBAQAAAAAAAAAAAAAAAAAAABH/2gAMAwEAAhEDEQA/AM3q67fGq8EsU16WwWfaQzPRhSvj8kGneyoviZUuvja3Th9/UI67dF+JCKR//9k=", "metadata": {"Artist": "Alan Tom", "DateTimeOriginal": "2025-01-03 19:52:06", "ExposureTime": "0.3", "FNumber": "2.8", "ISO": "400", "FocalLength": "75.0 mm", "ExposureProgram": "Shutter speed priority AE", "Make": "Sony", "Model": "ILCE-7CM2", "LensID": "E 28-75mm F2.8 A063", "LensModel": "E 28-75mm F2.8 A063", "ImageSize": "6549x3683", "Subject": "dark, select", "LensMake": "Tamron"}, "size": 344586, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSC00498", "title": "Untitled", "big": "seawoods/DSC00498_big.avif", "small": "seawoods/DSC00498_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAGAAAAgMAAAAAAAAAAAAAAAAAAAMBBAb/xAAcEAACAgIDAAAAAAAAAAAAAAAAAQIRAxIhMUH/xAAWAQEBAQAAAAAAAAAAAAAAAAAAAgP/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwDJwhUSdXXQJ+Dlyi2arLHbsBgAf//Z", "metadata": {"Artist": "Alan Tom", "DateTimeOriginal": "2025-01-03 20:14:56", "ExposureTime": "1/5", "FNumber": "2.8", "ISO": "1600", "FocalLength": "75.0 mm", "ExposureProgram": "Shutter speed priority AE", "Make": "Sony", "Model": "ILCE-7CM2", "LensID": "E 28-75mm F2.8 A063", "LensModel": "E 28-75mm F2.8 A063", "ImageSize": "6847x4564", "Subject": "dark, select", "LensMake": "Tamron"}, "size": 246995, "created": "2025-03-01T19:16:45.645501"}], "datetime": "2024-12-28T18:30:22", "created": "2025-03-01T19:17:12.090889"}, {"id": "untitled_I", "title": "Untitled I", "images": [{"id": "DSC_0003", "title": "Strange Alley", "big": "untitled_I/DSC_0003_big.avif", "small": "untitled_I/DSC_0003_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAGQAAAgMBAAAAAAAAAAAAAAAAAAUBAwQG/8QAHRAAAgIDAAMAAAAAAAAAAAAAAAIBAwURIQQiMf/EABUBAQEAAAAAAAAAAAAAAAAAAAAC/8QAFhEBAQEAAAAAAAAAAAAAAAAAABEB/9oADAMBAAIRAxEAPwDmMXbNVysNc35620Qqzqdd6J49U4ZrnZvpNJdqsCACn//Z", "metadata": {"Artist": "Alan Tom", "Title": "Strange Alley", "DateTimeOriginal": "2024-11-23 18:05:25.500", "ExposureTime": "1/50", "FNumber": "3.5", "ISO": "800", "FocalLength": "18.0 mm", "ExposureProgram": "Shutter speed priority AE", "Make": "Nikon", "Model": "D5300", "LensID": "AF-P DX Nikkor 18-55mm f/3.5-5.6G", "ImageSize": "5569x3717", "Subject": "dark, select", "LensMake": "Nikon", "LensModel": "AF-P DX Nikkor 18-55mm f/3.5-5.6G"}, "size": 119091, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSC_0009", "title": "Concrete", "big": "untitled_I/DSC_0009_big.avif", "small": "untitled_I/DSC_0009_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAALABQDASIAAhEBAxEB/8QAFwABAQEBAAAAAAAAAAAAAAAAAAECBv/EABgQAQEBAQEAAAAAAAAAAAAAAAABEQIx/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AOKS3Bnr0DaIA//Z", "metadata": {"Artist": "Alan Tom", "Title": "Concrete", "DateTimeOriginal": "2024-11-23 18:13:54.400", "ExposureTime": "1/13", "FNumber": "5.3", "ISO": "400", "FocalLength": "48.0 mm", "ExposureProgram": "Shutter speed priority AE", "Make": "Nikon", "Model": "D5300", "LensID": "AF-P DX Nikkor 18-55mm f/3.5-5.6G", "ImageSize": "5412x3044", "Subject": "dark, select", "LensMake": "Nikon", "LensModel": "AF-P DX Nikkor 18-55mm f/3.5-5.6G"}, "size": 111672, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSC_0020", "title": "Seven Nine Eleven", "big": "untitled_I/DSC_0020_big.avif", "small": "untitled_I/DSC_0020_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAFwABAQEBAAAAAAAAAAAAAAAAAAMEBv/EABoQAAMAAwEAAAAAAAAAAAAAAAABAgQSQVH/xAAVAQEBAAAAAAAAAAAAAAAAAAAAAf/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AOGitaT8L5VutTOXyElEvoRAABX/2Q==", "metadata": {"Artist": "Alan Tom", "Title": "Seven Nine Eleven", "DateTimeOriginal": "2024-11-23 18:23:05.100", "ExposureTime": "1/60", "FNumber": "5.6", "ISO": "640", "FocalLength": "55.0 mm", "ExposureProgram": "Shutter speed priority AE", "Make": "Nikon", "Model": "D5300", "LensID": "AF-P DX Nikkor 18-55mm f/3.5-5.6G", "ImageSize": "5788x3863", "Subject": "dark, select", "LensMake": "Nikon", "LensModel": "AF-P DX Nikkor 18-55mm f/3.5-5.6G"}, "size": 90171, "created": "2025-03-01T19:16:45.645501"}], "datetime": "2024-11-23T18:05:25.500000", "created": "2025-03-01T19:17:12.090889"}, {"id": "clouds", "title": "Clouds", "images": [{"id": "DSCF0812", "title": "Viewport, Wing On A Cloud", "big": "clouds/DSCF0812_big.avif", "small": "clouds/DSCF0812_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAUAA8DASIAAhEBAxEB/8QAFwABAQEBAAAAAAAAAAAAAAAAAAQDBv/EACAQAAEDBAIDAAAAAAAAAAAAAAIAAQMEBREhEyIxUXH/xAAVAQEBAAAAAAAAAAAAAAAAAAACA//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJ7HBG4dlld6UeXrhTW6vGJm3pK25AZP6+q4ufjJ2fGUMnz5RFM3/9k=", "metadata": {"Artist": "Alan Tom", "Title": "Viewport, Wing On A Cloud", "DateTimeOriginal": "2024-09-06 16:33:39", "ExposureTime": "1/250", "FNumber": "22.0", "ISO": "200", "FocalLength": "15.0 mm", "ExposureProgram": "Shutter speed priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensID": "XC15-45mm F3.5-5.6 OIS PZ", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "3846x5128", "Subject": "dark, select"}, "size": 121788, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSCF0822", "title": "Clouds I, River", "big": "clouds/DSCF0822_big.avif", "small": "clouds/DSCF0822_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAGgAAAQUBAAAAAAAAAAAAAAAAAAECAwQFBv/EACAQAAICAQMFAAAAAAAAAAAAAAECABEFAwQSITFCUXH/xAAVAQEBAAAAAAAAAAAAAAAAAAAAAf/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AGaWUTysGR7nK0DxND3OfZ2Y2T1iFmPdifplF58grsSysTCZRYk3ZEIH/9k=", "metadata": {"Artist": "Alan Tom", "Title": "Clouds I, River", "DateTimeOriginal": "2024-09-06 16:40:01", "ExposureTime": "1/450", "FNumber": "13.0", "ISO": "200", "FocalLength": "45.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensID": "XC15-45mm F3.5-5.6 OIS PZ", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "6016x4014", "Subject": "dark, select"}, "size": 150817, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSCF0833", "title": "Clouds II, Cotton", "big": "clouds/DSCF0833_big.avif", "small": "clouds/DSCF0833_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAFwAAAwEAAAAAAAAAAAAAAAAAAAMFBP/EABwQAAICAgMAAAAAAAAAAAAAAAECAAMRUQUyYf/EABUBAQEAAAAAAAAAAAAAAAAAAAAB/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8An1XARzXKV9k7jkDMc7lK2lSupRja0Z7AQinpQscwhH//2Q==", "metadata": {"Artist": "Alan Tom", "Title": "Clouds II, Cotton", "DateTimeOriginal": "2024-09-06 16:48:54", "ExposureTime": "1/1400", "FNumber": "13.0", "ISO": "200", "FocalLength": "45.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensID": "XC15-45mm F3.5-5.6 OIS PZ", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "6016x4014", "Subject": "dark, select"}, "size": 326899, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSCF0834", "title": "Clouds III, Streaks", "big": "clouds/DSCF0834_big.avif", "small": "clouds/DSCF0834_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAGQAAAgMBAAAAAAAAAAAAAAAAAAMBAgQF/8QAHRAAAgMAAgMAAAAAAAAAAAAAAQIAAxEhMUFRgf/EABYBAQEBAAAAAAAAAAAAAAAAAAEAA//EABURAQEAAAAAAAAAAAAAAAAAAAAR/9oADAMBAAIRAxEAPwDnmuoeBFMqfIkOzDdlLLCNHqa0RLIu8dQmU2MT3CFT/9k=", "metadata": {"Artist": "Alan Tom", "Title": "Clouds III, Streaks", "DateTimeOriginal": "2024-09-06 16:50:52", "ExposureTime": "1/1400", "FNumber": "13.0", "ISO": "200", "FocalLength": "45.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensID": "XC15-45mm F3.5-5.6 OIS PZ", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "5559x3709", "Subject": "dark, select"}, "size": 548687, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSCF0838", "title": "Clouds IV, Figures", "big": "clouds/DSCF0838_big.avif", "small": "clouds/DSCF0838_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAFwAAAwEAAAAAAAAAAAAAAAAAAAMEBf/EAB8QAAIBBAIDAAAAAAAAAAAAAAABAgMEESESURQxof/EABcBAAMBAAAAAAAAAAAAAAAAAAABAgP/xAAVEQEBAAAAAAAAAAAAAAAAAAAAEf/aAAwDAQACEQMRAD8AwqdpHRbSs4ccv4T203LBftJb9mqCvDh2wGZfbAKcf//Z", "metadata": {"Artist": "Alan Tom", "Title": "Clouds IV, Figures", "DateTimeOriginal": "2024-09-06 16:52:29", "ExposureTime": "1/1500", "FNumber": "13.0", "ISO": "200", "FocalLength": "44.5 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensID": "XC15-45mm F3.5-5.6 OIS PZ", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "6016x4014", "Subject": "dark, select"}, "size": 2961440, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSCF0845", "title": "Clouds V, Wispy And A Reflective Road", "big": "clouds/DSCF0845_big.avif", "small": "clouds/DSCF0845_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAFwAAAwEAAAAAAAAAAAAAAAAAAAUGBP/EAB8QAAIBBAIDAAAAAAAAAAAAAAECAAMEBSERMRIiUf/EABYBAQEBAAAAAAAAAAAAAAAAAAACA//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJu3uAG1G9DIOiDYKj7JZXK9GaUrv1zNEqNso5Pr4AQiEVWIhA//2Q==", "metadata": {"Artist": "Alan Tom", "Title": "Clouds V, Wispy And A Reflective Road", "DateTimeOriginal": "2024-09-06 17:16:02", "ExposureTime": "1/1250", "FNumber": "8.0", "ISO": "200", "FocalLength": "45.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensID": "XC15-45mm F3.5-5.6 OIS PZ", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "3707x2473", "Subject": "dark, select"}, "size": 547589, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSCF0849", "title": "Clouds VI, Beams And Shadows", "big": "clouds/DSCF0849_big.avif", "small": "clouds/DSCF0849_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAFwABAQEBAAAAAAAAAAAAAAAABAABBf/EABoQAAIDAQEAAAAAAAAAAAAAAAABAgQRAxP/xAAVAQEBAAAAAAAAAAAAAAAAAAABAv/EABURAQEAAAAAAAAAAAAAAAAAAAAB/9oADAMBAAIRAxEAPwATtPzbWnKsXOim9EgbSTlIqCsd96QGSyTIUv/Z", "metadata": {"Artist": "Alan Tom", "Title": "Clouds VI, Beams And Shadows", "DateTimeOriginal": "2024-09-06 18:17:52", "ExposureTime": "1/1400", "FNumber": "11.0", "ISO": "200", "FocalLength": "34.3 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensID": "XC15-45mm F3.5-5.6 OIS PZ", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "3940x2628", "Subject": "dark, select"}, "size": 638838, "created": "2025-03-01T19:16:45.645501"}], "datetime": "2024-09-06T16:33:39", "created": "2025-03-01T19:17:12.090889"}, {"id": "ladakh", "title": "Ladakh", "images": [{"id": "DSCF0113", "title": "Red Parapet", "big": "ladakh/DSCF0113_big.avif", "small": "ladakh/DSCF0113_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAwQA/8QAHRAAAgMAAgMAAAAAAAAAAAAAAQIAAwQREiExsf/EABUBAQEAAAAAAAAAAAAAAAAAAAID/8QAFxEBAQEBAAAAAAAAAAAAAAAAAQACEf/aAAwDAQACEQMRAD8AnsygISsOvKbG4EvwDvWSxMrWtU9SjtYGAgqyKlYB+TRHJ7HzNB2fL//Z", "metadata": {"Artist": "Alan Tom", "Title": "Red Parapet", "DateTimeOriginal": "2024-08-31 11:10:40.000", "ExposureTime": "1/1250", "FNumber": "5.0", "ISO": "200", "FocalLength": "15.2 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensID": "XC15-45mm F3.5-5.6 OIS PZ", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "5325x3552", "Subject": "select"}, "size": 976323, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSCF0187", "title": "Monastery I, Near The Palace", "big": "ladakh/DSCF0187_big.avif", "small": "ladakh/DSCF0187_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAIABQDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUE/8QAHhAAAgEDBQAAAAAAAAAAAAAAAAIBAwQRBRIhMaH/xAAWAQEBAQAAAAAAAAAAAAAAAAADAAL/xAAYEQADAQEAAAAAAAAAAAAAAAAAAQIREv/aAAwDAQACEQMRAD8AmTbq05Xo121vuwiyAIrYXEop0tPpSkc+AA1rLEf/2Q==", "metadata": {"Artist": "Alan Tom", "Title": "Monastery I, Near The Palace", "DateTimeOriginal": "2024-08-31 13:07:25.000", "ExposureTime": "1/480", "FNumber": "11.0", "ISO": "320", "FocalLength": "45.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensID": "XC15-45mm F3.5-5.6 OIS PZ", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "5415x2265", "Subject": "select"}, "size": 342906, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSCF0219", "title": "Yellow Jacket I, Butter Tea", "big": "ladakh/DSCF0219_big.avif", "small": "ladakh/DSCF0219_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAGAAAAwEBAAAAAAAAAAAAAAAAAAMFBAb/xAAgEAABBAIBBQAAAAAAAAAAAAABAAIDERIhMQQTMoGR/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAL/xAAWEQEBAQAAAAAAAAAAAAAAAAAAERL/2gAMAwEAAhEDEQA/AEzW2JzGDVKG2F7ZwS3V8hdHeU+JAITO2yqxHxTkqRFMY2BuN+0LZP08Yk8edoSQf//Z", "metadata": {"Artist": "Alan Tom", "Title": "Yellow Jacket I, Butter Tea", "DateTimeOriginal": "2024-08-31 18:32:04.000", "ExposureTime": "1/40", "FNumber": "4.4", "ISO": "800", "FocalLength": "26.4 mm", "ExposureProgram": "Shutter speed priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensID": "XC15-45mm F3.5-5.6 OIS PZ", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "5955x3973", "Subject": "select"}, "size": 1629999, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSCF0282", "title": "Monastery II, Near The Statue", "big": "ladakh/DSCF0282_big.avif", "small": "ladakh/DSCF0282_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAALABQDASIAAhEBAxEB/8QAGAAAAwEBAAAAAAAAAAAAAAAAAAMEAgX/xAAcEAACAgMBAQAAAAAAAAAAAAAAAQIREiExBEH/xAAVAQEBAAAAAAAAAAAAAAAAAAAAAf/EABURAQEAAAAAAAAAAAAAAAAAAAAB/9oADAMBAAIRAxEAPwCfzTSVSKMlWmc/nB8W6T+0WBksU9rYGqT6gKP/2Q==", "metadata": {"Artist": "Alan Tom", "Title": "Monastery II, Near The Statue", "DateTimeOriginal": "2024-09-01 17:25:21.000", "ExposureTime": "1/140", "FNumber": "9.0", "ISO": "400", "FocalLength": "43.2 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensID": "XC15-45mm F3.5-5.6 OIS PZ", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "5919x3329", "Subject": "select"}, "size": 2978391, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSCF0288", "title": "Landscape I, Sunlit Mountain Face", "big": "ladakh/DSCF0288_big.avif", "small": "ladakh/DSCF0288_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAALABQDASIAAhEBAxEB/8QAGAAAAgMAAAAAAAAAAAAAAAAAAAUBAwT/xAAeEAACAgICAwAAAAAAAAAAAAAAAQIRAwUEEjJBYf/EABUBAQEAAAAAAAAAAAAAAAAAAAAB/8QAFREBAQAAAAAAAAAAAAAAAAAAABH/2gAMAwEAAhEDEQA/ALpbnF1qxdytq7uDpfBLFtNU2icnkWpG5bXN7mwFwCkf/9k=", "metadata": {"Artist": "Alan Tom", "Title": "Landscape I, Sunlit Mountain Face", "DateTimeOriginal": "2024-09-01 17:32:16.000", "ExposureTime": "1/280", "FNumber": "10.0", "ISO": "400", "FocalLength": "31.4 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensID": "XC15-45mm F3.5-5.6 OIS PZ", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "5804x3264", "Subject": "select"}, "size": 320582, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSCF0306", "title": "Landscape II, Small Buildings", "big": "ladakh/DSCF0306_big.avif", "small": "ladakh/DSCF0306_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAFwABAQEBAAAAAAAAAAAAAAAABQACBP/EAB8QAQACAgAHAAAAAAAAAAAAAAEAAgMREyEyQVFhsf/EABQBAQAAAAAAAAAAAAAAAAAAAAH/xAAVEQEBAAAAAAAAAAAAAAAAAAAAEf/aAAwDAQACEQMRAD8AOxoJpnTTK1PJCqXsd9zVs1g5fYUwk51erUoTxr+pRoj/2Q==", "metadata": {"Artist": "Alan Tom", "Title": "Landscape II, Small Buildings", "DateTimeOriginal": "2024-09-01 17:49:54.000", "ExposureTime": "1/150", "FNumber": "8.0", "ISO": "500", "FocalLength": "45.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensID": "XC15-45mm F3.5-5.6 OIS PZ", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "5107x3407", "Subject": "select"}, "size": 2766577, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSCF0330", "title": "Yellow Jacket II, Near The Dunes", "big": "ladakh/DSCF0330_big.avif", "small": "ladakh/DSCF0330_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAIABQDASIAAhEBAxEB/8QAFwABAAMAAAAAAAAAAAAAAAAAAAMEBf/EABwQAQEAAAcAAAAAAAAAAAAAAAABAgQSEzFRYf/EABUBAQEAAAAAAAAAAAAAAAAAAAAB/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AwctcUl6Wt26fQUR8gA//2Q==", "metadata": {"Artist": "Alan Tom", "Title": "Yellow Jacket II, Near The Dunes", "DateTimeOriginal": "2024-09-01 18:48:23.000", "ExposureTime": "1/100", "FNumber": "5.6", "ISO": "1250", "FocalLength": "45.0 mm", "ExposureProgram": "Shutter speed priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensID": "XC15-45mm F3.5-5.6 OIS PZ", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "5980x2502", "Subject": "dark, select"}, "size": 2919686, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSCF0399", "title": "The Lizard", "big": "ladakh/DSCF0399_big.avif", "small": "ladakh/DSCF0399_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAIABQDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAT/xAAcEAACAgIDAAAAAAAAAAAAAAAAAQIRAwQiUZH/xAAWAQEBAQAAAAAAAAAAAAAAAAAAAQL/xAAVEQEBAAAAAAAAAAAAAAAAAAAAEf/aAAwDAQACEQMRAD8AR1qfEq1p06yJJIA1RS54e14AAj//2Q==", "metadata": {"Artist": "Alan Tom", "Title": "The Lizard", "DateTimeOriginal": "2024-09-02 10:49:52.000", "ExposureTime": "1/550", "FNumber": "5.6", "ISO": "200", "FocalLength": "45.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensID": "XC15-45mm F3.5-5.6 OIS PZ", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "4429x1853", "Subject": "select"}, "size": 177893, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSCF0442", "title": "Blue Doors", "big": "ladakh/DSCF0442_big.avif", "small": "ladakh/DSCF0442_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAFwABAQEBAAAAAAAAAAAAAAAAAwAEBf/EAB4QAAICAgIDAAAAAAAAAAAAAAERAAIDIQQSEyIx/8QAFQEBAQAAAAAAAAAAAAAAAAAAAQL/xAAWEQEBAQAAAAAAAAAAAAAAAAAAEQH/2gAMAwEAAhEDEQA/AC4mE+JkIx64rFhlR+NTtjBa1GGFBAysidrl5sFe/sHr7Ka7UqTsOUIa/9k=", "metadata": {"Artist": "Alan Tom", "Title": "Blue Doors", "DateTimeOriginal": "2024-09-02 14:05:35.000", "ExposureTime": "1/450", "FNumber": "4.4", "ISO": "200", "FocalLength": "23.5 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensID": "XC15-45mm F3.5-5.6 OIS PZ", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "4896x3266", "Subject": "select"}, "size": 2287559, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSCF0485", "title": "Cow At A Police Check Post", "big": "ladakh/DSCF0485_big.avif", "small": "ladakh/DSCF0485_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAIABQDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAME/8QAGxAAAgMAAwAAAAAAAAAAAAAAAAECAxEEEiH/xAAUAQEAAAAAAAAAAAAAAAAAAAAB/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8Ay8WmUt3xFrKekdTAAoJ6ABD/2Q==", "metadata": {"Artist": "Alan Tom", "Title": "Cow At A Police Check Post", "DateTimeOriginal": "2024-09-03 12:25:26.000", "ExposureTime": "1/300", "FNumber": "10.0", "ISO": "200", "FocalLength": "17.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensID": "XC15-45mm F3.5-5.6 OIS PZ", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "5556x2324", "Subject": "select"}, "size": 1455943, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSCF0493", "title": "The Fox", "big": "ladakh/DSCF0493_big.avif", "small": "ladakh/DSCF0493_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAIABQDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAP/xAAaEAEBAAMBAQAAAAAAAAAAAAABAAIDMSEi/8QAFgEBAQEAAAAAAAAAAAAAAAAAAgAB/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8Ama0x77EA+pIEhkal7JLE/9k=", "metadata": {"Artist": "Alan Tom", "Title": "The Fox", "DateTimeOriginal": "2024-09-03 12:52:06.000", "ExposureTime": "1/680", "FNumber": "5.6", "ISO": "200", "FocalLength": "45.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensID": "XC15-45mm F3.5-5.6 OIS PZ", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "5828x2438", "Subject": "select"}, "size": 2617418, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSCF0521", "title": "Landscape III, Sheep", "big": "ladakh/DSCF0521_big.avif", "small": "ladakh/DSCF0521_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAIABQDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAIB/8QAGxABAQACAwEAAAAAAAAAAAAAAQAEMQIDESH/xAAXAQADAQAAAAAAAAAAAAAAAAAAAQID/8QAFxEBAQEBAAAAAAAAAAAAAAAAAAEREv/aAAwDAQACEQMRAD8As7zifG0zPHclntWsz00ySOqWR//Z", "metadata": {"Artist": "Alan Tom", "Title": "Landscape III, Sheep", "DateTimeOriginal": "2024-09-03 14:40:49.000", "ExposureTime": "1/1100", "FNumber": "4.5", "ISO": "200", "FocalLength": "15.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensID": "XC15-45mm F3.5-5.6 OIS PZ", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "5192x2172", "Subject": "select"}, "size": 1536737, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSCF0535", "title": "The Marmot", "big": "ladakh/DSCF0535_big.avif", "small": "ladakh/DSCF0535_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAGAAAAgMAAAAAAAAAAAAAAAAAAAQBAgP/xAAdEAACAgEFAAAAAAAAAAAAAAAAAQIRMQMEEhNR/8QAFgEBAQEAAAAAAAAAAAAAAAAAAgME/8QAFxEBAAMAAAAAAAAAAAAAAAAAAAEREv/aAAwDAQACEQMRAD8AwjuW3Rfk1gVbpWStWTeTLqVaNqMmrsBbsl6AtwNP/9k=", "metadata": {"Artist": "Alan Tom", "Title": "The Marmot", "DateTimeOriginal": "2024-09-03 14:56:21.000", "ExposureTime": "1/500", "FNumber": "5.6", "ISO": "200", "FocalLength": "45.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensID": "XC15-45mm F3.5-5.6 OIS PZ", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "4456x2973", "Subject": "select"}, "size": 1562975, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSCF0572", "title": "Evening Lake", "big": "ladakh/DSCF0572_big.avif", "small": "ladakh/DSCF0572_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAIABQDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUG/8QAGxAAAgIDAQAAAAAAAAAAAAAAAAECAwQFIRH/xAAVAQEBAAAAAAAAAAAAAAAAAAABAv/EABYRAQEBAAAAAAAAAAAAAAAAAAABEf/aAAwDAQACEQMRAD8AzmHu76pJSbcStLbxsx34l0AqUpFuYnN8AA7U4//Z", "metadata": {"Artist": "Alan Tom", "Title": "Evening Lake", "DateTimeOriginal": "2024-09-03 18:53:23.000", "ExposureTime": "1/60", "FNumber": "3.5", "ISO": "640", "FocalLength": "15.0 mm", "ExposureProgram": "Shutter speed priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensID": "XC15-45mm F3.5-5.6 OIS PZ", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "5811x2431", "Subject": "dark, select"}, "size": 152103, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSCF0605", "title": "Landscape IV, Three Cows", "big": "ladakh/DSCF0605_big.avif", "small": "ladakh/DSCF0605_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAIABQDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAME/8QAGxAAAwACAwAAAAAAAAAAAAAAAAECBBEFIYH/xAAWAQEBAQAAAAAAAAAAAAAAAAABAAL/xAAXEQEBAQEAAAAAAAAAAAAAAAABAAIR/9oADAMBAAIRAxEAPwDRGbMS0uvCdcjW3oAXTRkovMbe2wAZ6zwv/9k=", "metadata": {"Artist": "Alan Tom", "Title": "Landscape IV, Three Cows", "DateTimeOriginal": "2024-09-04 14:32:44.000", "ExposureTime": "1/550", "FNumber": "11.0", "ISO": "400", "FocalLength": "15.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensID": "XC15-45mm F3.5-5.6 OIS PZ", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "5919x2476", "Subject": "select"}, "size": 1214893, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSCF0610", "title": "Yellow Jacket III, Near The Observatory", "big": "ladakh/DSCF0610_big.avif", "small": "ladakh/DSCF0610_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAIABQDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAT/xAAbEAADAAIDAAAAAAAAAAAAAAAAAQIEERIUUf/EABUBAQEAAAAAAAAAAAAAAAAAAAEC/8QAGBEAAwEBAAAAAAAAAAAAAAAAAAESAhP/2gAMAwEAAhEDEQA/AJlmwvR3Yae0AXbJ55JrzI5AALYxk//Z", "metadata": {"Artist": "Alan Tom", "Title": "Yellow Jacket III, Near The Observatory", "DateTimeOriginal": "2024-09-04 16:04:18.000", "ExposureTime": "1/900", "FNumber": "11.0", "ISO": "400", "FocalLength": "35.3 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensID": "XC15-45mm F3.5-5.6 OIS PZ", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "5649x2363", "Subject": "select"}, "size": 1068132, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSCF0615", "title": "Telescope I", "big": "ladakh/DSCF0615_big.avif", "small": "ladakh/DSCF0615_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAwAE/8QAHRABAAIDAAMBAAAAAAAAAAAAAQACAwQREiExMv/EABcBAAMBAAAAAAAAAAAAAAAAAAABAgP/xAAWEQEBAQAAAAAAAAAAAAAAAAAAEwH/2gAMAwEAAhEDEQA/AEz6NaCj6g0w0sIPUhZNjJ4PbMGmW9e8ZpTUTxqdc7+pTK5rr9ZQqUn/2Q==", "metadata": {"Artist": "Alan Tom", "Title": "Telescope I", "DateTimeOriginal": "2024-09-04 16:13:17.000", "ExposureTime": "1/3500", "FNumber": "4.4", "ISO": "400", "FocalLength": "24.9 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensID": "XC15-45mm F3.5-5.6 OIS PZ", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "5691x3797", "Subject": "select"}, "size": 1250274, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSCF0619", "title": "Telescope II", "big": "ladakh/DSCF0619_big.avif", "small": "ladakh/DSCF0619_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAIABQDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAEE/8QAHhAAAgIBBQEAAAAAAAAAAAAAAAIBAxEEEiFBUaH/xAAVAQEBAAAAAAAAAAAAAAAAAAAAAf/EABYRAAMAAAAAAAAAAAAAAAAAAAABEv/aAAwDAQACEQMRAD8AQieEaxE46AFMkoxWaqjfOY+ZAApllH//2Q==", "metadata": {"Artist": "Alan Tom", "Title": "Telescope II", "DateTimeOriginal": "2024-09-04 16:17:22.000", "ExposureTime": "1/1100", "FNumber": "11.0", "ISO": "400", "FocalLength": "21.5 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensID": "XC15-45mm F3.5-5.6 OIS PZ", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "5850x2447", "Subject": "select"}, "size": 1137882, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSCF0666", "title": "Sandwich Before School", "big": "ladakh/DSCF0666_big.avif", "small": "ladakh/DSCF0666_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAFwAAAwEAAAAAAAAAAAAAAAAAAAMFBv/EAB4QAAEFAAIDAAAAAAAAAAAAAAEAAgMEEQUSITGB/8QAFQEBAQAAAAAAAAAAAAAAAAAAAQL/xAAXEQEBAQEAAAAAAAAAAAAAAAAAARES/9oADAMBAAIRAxEAPwCNDy7jUEJb6GalQSxtm1wB1OpVIn19cNKm2T0kIaMRYY0UctVzAT0+4hZ6OR/Tw7EKeVa//9k=", "metadata": {"Artist": "Alan Tom", "Title": "Sandwich Before School", "DateTimeOriginal": "2024-09-05 08:58:40.000", "ExposureTime": "1/100", "FNumber": "4.9", "ISO": "800", "FocalLength": "32.3 mm", "ExposureProgram": "Shutter speed priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensID": "XC15-45mm F3.5-5.6 OIS PZ", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "5079x3388", "Subject": "select"}, "size": 758095, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSCF0685", "title": "Landscape V, Utility Poles", "big": "ladakh/DSCF0685_big.avif", "small": "ladakh/DSCF0685_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAIABQDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAP/xAAcEAACAgIDAAAAAAAAAAAAAAAAAgEDBBIhMVH/xAAWAQEBAQAAAAAAAAAAAAAAAAADAQL/xAAYEQADAQEAAAAAAAAAAAAAAAAAAlESE//aAAwDAQACEQMRAD8AgtdE+FIXHWOoAE2wXJYSZ6duFABNtTXNYf/Z", "metadata": {"Artist": "Alan Tom", "Title": "Landscape V, Utility Poles", "DateTimeOriginal": "2024-09-05 10:14:40.000", "ExposureTime": "1/340", "FNumber": "13.0", "ISO": "200", "FocalLength": "33.3 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensID": "XC15-45mm F3.5-5.6 OIS PZ", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "5018x2099", "Subject": "select"}, "size": 179175, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSCF0688", "title": "The Transport", "big": "ladakh/DSCF0688_big.avif", "small": "ladakh/DSCF0688_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAHABQDASIAAhEBAxEB/8QAFwABAAMAAAAAAAAAAAAAAAAAAAMEBf/EAB4QAAIBAwUAAAAAAAAAAAAAAAABAgMRIQQSEzGR/8QAFgEBAQEAAAAAAAAAAAAAAAAAAgED/8QAFxEAAwEAAAAAAAAAAAAAAAAAAAECEv/aAAwDAQACEQMRAD8Az9NQptXllllQhFYuAPbM1EkE+Hd2/AAXbDiT/9k=", "metadata": {"Artist": "Alan Tom", "Title": "The Transport", "DateTimeOriginal": "2024-09-05 10:15:42.000", "ExposureTime": "1/210", "FNumber": "13.0", "ISO": "200", "FocalLength": "15.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensID": "XC15-45mm F3.5-5.6 OIS PZ", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "5876x2169", "Subject": "select"}, "size": 286319, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSCF0690", "title": "The Smoker", "big": "ladakh/DSCF0690_big.avif", "small": "ladakh/DSCF0690_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAIABQDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAEE/8QAHBAAAgICAwAAAAAAAAAAAAAAAAECBAMhETJh/8QAFQEBAQAAAAAAAAAAAAAAAAAAAQD/xAAWEQADAAAAAAAAAAAAAAAAAAAAARL/2gAMAwEAAhEDEQA/AJC8kkklr0ZLUckdpcgFTCUZ3Zin1AA0whH/2Q==", "metadata": {"Artist": "Alan Tom", "Title": "The Smoker", "DateTimeOriginal": "2024-09-05 10:16:19.000", "ExposureTime": "1/210", "FNumber": "13.0", "ISO": "200", "FocalLength": "45.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensID": "XC15-45mm F3.5-5.6 OIS PZ", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "6016x2517", "Subject": "select"}, "size": 804574, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSCF0694", "title": "Dunes I, The Trucks", "big": "ladakh/DSCF0694_big.avif", "small": "ladakh/DSCF0694_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAIABQDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAMC/8QAHRAAAgIBBQAAAAAAAAAAAAAAAAEEEQIDFCFiof/EABYBAQEBAAAAAAAAAAAAAAAAAAACA//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/ALaElpXXBve9QDNaWUtW7fgAA//Z", "metadata": {"Artist": "Alan Tom", "Title": "Dunes I, The Trucks", "DateTimeOriginal": "2024-09-05 10:36:29.000", "ExposureTime": "1/1400", "FNumber": "5.6", "ISO": "200", "FocalLength": "44.5 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensID": "XC15-45mm F3.5-5.6 OIS PZ", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "6016x2517", "Subject": "select"}, "size": 1008952, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSCF0695", "title": "Dunes II, The Horses", "big": "ladakh/DSCF0695_big.avif", "small": "ladakh/DSCF0695_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAIABQDASIAAhEBAxEB/8QAFwABAAMAAAAAAAAAAAAAAAAAAAIDBP/EABkQAQEBAAMAAAAAAAAAAAAAAAABBAIDQf/EABcBAAMBAAAAAAAAAAAAAAAAAAACAwT/xAAVEQEBAAAAAAAAAAAAAAAAAAAAAf/aAAwDAQACEQMRAD8A0de+L5tlBnlqiF1cfADB/9k=", "metadata": {"Artist": "Alan Tom", "Title": "Dunes II, The Horses", "DateTimeOriginal": "2024-09-05 10:36:58.000", "ExposureTime": "1/1250", "FNumber": "5.6", "ISO": "200", "FocalLength": "44.5 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensID": "XC15-45mm F3.5-5.6 OIS PZ", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "5551x2322", "Subject": "select"}, "size": 619477, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSCF0696", "title": "The Tent", "big": "ladakh/DSCF0696_big.avif", "small": "ladakh/DSCF0696_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAIABQDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAL/xAAdEAACAQQDAAAAAAAAAAAAAAAAAQIDERITIVGh/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAH/xAAVEQEBAAAAAAAAAAAAAAAAAAAAEf/aAAwDAQACEQMRAD8AhVJrhMvbNJXj4ARVZvoACj//2Q==", "metadata": {"Artist": "Alan Tom", "Title": "The Tent", "DateTimeOriginal": "2024-09-05 10:38:07.000", "ExposureTime": "1/1700", "FNumber": "5.6", "ISO": "200", "FocalLength": "44.5 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensID": "XC15-45mm F3.5-5.6 OIS PZ", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "5436x2274", "Subject": "select"}, "size": 666223, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSCF0702", "title": "Men And Horses", "big": "ladakh/DSCF0702_big.avif", "small": "ladakh/DSCF0702_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAIABQDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAP/xAAbEAADAAIDAAAAAAAAAAAAAAAAAQIRIQMSMf/EABYBAQEBAAAAAAAAAAAAAAAAAAIAAf/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AIxUvSWB1ewAmk+O8+AAmP/Z", "metadata": {"Artist": "Alan Tom", "Title": "Men And Horses", "DateTimeOriginal": "2024-09-05 11:03:38.000", "ExposureTime": "1/340", "FNumber": "13.0", "ISO": "200", "FocalLength": "45.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensID": "XC15-45mm F3.5-5.6 OIS PZ", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "5954x2491", "Subject": "select"}, "size": 2460500, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSCF0705", "title": "Man Following A Foal", "big": "ladakh/DSCF0705_big.avif", "small": "ladakh/DSCF0705_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAIABQDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAID/8QAHBAAAgIDAQEAAAAAAAAAAAAAAAECAwQRkSEx/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAH/xAAVEQEBAAAAAAAAAAAAAAAAAAAAEf/aAAwDAQACEQMRAD8AzrxnH1PrLU7K/kgCCllWpa2uAAtH/9k=", "metadata": {"Artist": "Alan Tom", "Title": "Man Following A Foal", "DateTimeOriginal": "2024-09-05 11:05:44.000", "ExposureTime": "1/480", "FNumber": "13.0", "ISO": "200", "FocalLength": "45.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensID": "XC15-45mm F3.5-5.6 OIS PZ", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "4633x1938", "Subject": "select"}, "size": 682612, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSCF0774", "title": "Landscape VI, Where The Green Begins", "big": "ladakh/DSCF0774_big.avif", "small": "ladakh/DSCF0774_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAPABQDASIAAhEBAxEB/8QAGQAAAgMBAAAAAAAAAAAAAAAAAAYBAgMF/8QAIBAAAQQCAgMBAAAAAAAAAAAAAQADBBECIQVhEiJRkf/EABUBAQEAAAAAAAAAAAAAAAAAAAID/8QAGREAAwEBAQAAAAAAAAAAAAAAAAERAxIh/9oADAMBAAIRAxEAPwCHIJu6IW0d0xtE9bVZHI4i6GwuS5IydyJs7Sel8JrNJ1DEOUaA9sqPYQlryP0/qEehw//Z", "metadata": {"Artist": "Alan Tom", "Title": "Landscape VI, Where The Green Begins", "DateTimeOriginal": "2024-09-05 16:26:13.000", "ExposureTime": "1/550", "FNumber": "11.0", "ISO": "400", "FocalLength": "15.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensID": "XC15-45mm F3.5-5.6 OIS PZ", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "4975x3731", "Subject": "select"}, "size": 1702530, "created": "2025-03-01T19:16:45.645501"}, {"id": "DSCF0779", "title": "Monastery III, Near The City", "big": "ladakh/DSCF0779_big.avif", "small": "ladakh/DSCF0779_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAIABQDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAMC/8QAHhAAAQMEAwAAAAAAAAAAAAAAAAESIQIDBAURQWH/xAAVAQEBAAAAAAAAAAAAAAAAAAABAv/EABcRAAMBAAAAAAAAAAAAAAAAAAABEgL/2gAMAwEAAhEDEQA/AJ5GwcraYILd4lewCqYSjT/AANsmMn//2Q==", "metadata": {"Artist": "Alan Tom", "Title": "Monastery III, Near The City", "DateTimeOriginal": "2024-09-05 17:00:09.000", "ExposureTime": "1/450", "FNumber": "10.0", "ISO": "400", "FocalLength": "28.8 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensID": "XC15-45mm F3.5-5.6 OIS PZ", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "5763x2411", "Subject": "select"}, "size": 396100, "created": "2025-03-01T19:16:45.645501"}], "datetime": "2024-08-31T11:10:40", "created": "2025-03-01T19:17:12.090889"}];
// ALBUMS_JSON_END

init();

console.log(
  '%cHello, if you notice weird UX issues do let me know! – Alan',
  'font-size: 2rem'
);
