const docTitle = "Photo's From Alan's Space";
const touchStart = { x: 0, y: 0 };

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

  // document.getElementById('fullview').addEventListener('touchstart', (e) => {
  //   const x = e.touches.item(0).pageX;
  //   if (!x || e.target instanceof HTMLButtonElement) return;
  //   changeImage(x > screen.availWidth / 2);
  // });

  registerLocationchangeDispatchers();
  window.addEventListener('locationchange', updateDialog);
  hideInfo();
  setAllLinkDisplay();
  addGestureListeners();
}

function handleKeydown(e) {
  if (e.shiftKey || e.metaKey || e.altKey) {
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
  }
}

function registerLocationchangeDispatchers() {
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
    fullview.scrollTop = fullview.scrollHeight;
  }

  fullview.style.top = `${(document.getElementById('fullview').style.top =
    document.documentElement.scrollTop || document.body.scrollTop)}px`;
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
  const container = document.getElementById('fullview-container');
  const [w, h] = image.metadata.ImageSize.split('x').map((i) => Number(i));

  container.style.backgroundImage = `url('${image.preload}')`;

  const aspectRatio = w / h;
  container.style.aspectRatio = aspectRatio;

  //  Select min of (max width - clearance) OR (max height - clearance) as width
  const maxWidth = `calc(100vw - (2 * var(--lr-spacing)))`;
  const maxHeight = `calc((100vh - 3 * var(--lr-spacing) - var(--fs-base)) * ${aspectRatio})`;
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

  document.getElementById('fullview-title').innerText = image.title;
}

function updateInfo(image, album) {
  document.getElementById('info-album').innerText = album.title;
  document.getElementById('info-title').innerText = image.title;

  document.getElementById('info-time').innerText = formatDate(
    image.metadata.DateTimeOriginal,
    true
  );

  document.getElementById('info-title').innerText = image.title;
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

  document.body.style.overflow = '';
  const fullview = getFullview();
  if (fullview.open) fullview.close();
  document.title = docTitle;
  hideInfo();
  setTheme(); // from theme.js
}

function toggleInfo() {
  if (document.getElementById('info').style.display === 'none') {
    showInfo();
  } else {
    hideInfo();
  }
}

function showInfo() {
  const fullview = getFullview();
  const infoDiv = document.getElementById('info');
  const titleH1 = document.getElementById('fullview-title');

  titleH1.style.display = 'none';
  infoDiv.style.display = '';
  fullview.scrollTop = fullview.scrollHeight;
}

function hideInfo() {
  const fullview = getFullview();
  const infoDiv = document.getElementById('info');
  const titleH1 = document.getElementById('fullview-title');

  titleH1.style.display = '';
  infoDiv.style.display = 'none';
  fullview.scrollTop = 0;
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
  const isTouchSupported =
    /Android|iPhone|iPad|Opera Mini/i.test(navigator.userAgent) ||
    navigator.maxTouchPoints > 0;

  if (!isTouchSupported) return;

  document.addEventListener(
    'touchstart',
    (e) => {
      touchStart.x = e.touches[0].clientX;
      touchStart.y = e.touches[0].clientY;
    },
    false
  );

  document.addEventListener('touchend', handleTouchEnd, false);
}

function handleTouchEnd(e) {
  if (!getFullview().open) return;

  const swipeThreshold = 50;
  const swipeDistanceX = e.changedTouches[0].clientX - touchStart.x;
  const swipeDistanceY = e.changedTouches[0].clientY - touchStart.y;

  if (
    Math.abs(swipeDistanceX) < swipeThreshold &&
    Math.abs(swipeDistanceY) < swipeThreshold
  )
    return;

  const isHorizontal = Math.abs(swipeDistanceX) > Math.abs(swipeDistanceY);
  if (isHorizontal && swipeDistanceX < 0) {
    changeImage(true);
  } else if (isHorizontal && swipeDistanceX > 0) {
    changeImage(false);
  } else if (!isHorizontal && swipeDistanceY < 0) {
    showInfo();
  } else {
    hideInfo();
  }
}

// prettier-ignore
const albums = [{"id": "untitled_I", "title": "Untitled I", "images": [{"id": "DSC_0003", "title": "Strange Alley", "big": "untitled_I/DSC_0003_big.avif", "small": "untitled_I/DSC_0003_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAGQAAAgMBAAAAAAAAAAAAAAAAAAUBAwQG/8QAHRAAAgIDAAMAAAAAAAAAAAAAAAIBAwURIQQiMf/EABUBAQEAAAAAAAAAAAAAAAAAAAAC/8QAFhEBAQEAAAAAAAAAAAAAAAAAABEB/9oADAMBAAIRAxEAPwDmMXbNVysNc35620Qqzqdd6J49U4ZrnZvpNJdqsCACn//Z", "metadata": {"Artist": "Alan Tom", "Title": "Strange Alley", "DateTimeOriginal": "2024-11-23 18:05:25", "ExposureTime": "1/50", "FNumber": "3.5", "ISO": "800", "FocalLength": "18.0 mm", "ExposureProgram": "Shutter speed priority AE", "Make": "Nikon", "Model": "D5300", "LensMake": "Nikon", "LensModel": "AF-P DX Nikkor 18-55mm f/3.5-5.6G", "ImageSize": "3840x2563", "Subject": "dark, select"}, "created": "2024-12-06T22:14:58.564483"}, {"id": "DSC_0009", "title": "Concrete", "big": "untitled_I/DSC_0009_big.avif", "small": "untitled_I/DSC_0009_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAALABQDASIAAhEBAxEB/8QAFwABAQEBAAAAAAAAAAAAAAAAAAECBv/EABgQAQEBAQEAAAAAAAAAAAAAAAABEQIx/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AOKS3Bnr0DaIA//Z", "metadata": {"Artist": "Alan Tom", "Title": "Concrete", "DateTimeOriginal": "2024-11-23 18:13:54", "ExposureTime": "1/13", "FNumber": "5.3", "ISO": "400", "FocalLength": "48.0 mm", "ExposureProgram": "Shutter speed priority AE", "Make": "Nikon", "Model": "D5300", "LensMake": "Nikon", "LensModel": "AF-P DX Nikkor 18-55mm f/3.5-5.6G", "ImageSize": "3840x2160", "Subject": "dark, select"}, "created": "2024-12-06T22:15:00.260459"}, {"id": "DSC_0020", "title": "Seven Nine Eleven", "big": "untitled_I/DSC_0020_big.avif", "small": "untitled_I/DSC_0020_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAFwABAQEBAAAAAAAAAAAAAAAAAAMEBv/EABoQAAMAAwEAAAAAAAAAAAAAAAABAgQSQVH/xAAVAQEBAAAAAAAAAAAAAAAAAAAAAf/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AOGitaT8L5VutTOXyElEvoRAABX/2Q==", "metadata": {"Artist": "Alan Tom", "Title": "Seven Nine Eleven", "DateTimeOriginal": "2024-11-23 18:23:05", "ExposureTime": "1/60", "FNumber": "5.6", "ISO": "640", "FocalLength": "55.0 mm", "ExposureProgram": "Shutter speed priority AE", "Make": "Nikon", "Model": "D5300", "LensMake": "Nikon", "LensModel": "AF-P DX Nikkor 18-55mm f/3.5-5.6G", "ImageSize": "3840x2563", "Subject": "dark, select"}, "created": "2024-12-06T22:14:59.199719"}], "datetime": "2024-11-23T18:05:25", "created": "2024-12-06T22:15:01.271992"}, {"id": "clouds", "title": "Clouds", "images": [{"id": "DSCF0812", "title": "Viewport, Wing On A Cloud", "big": "clouds/DSCF0812_big.avif", "small": "clouds/DSCF0812_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAUAA8DASIAAhEBAxEB/8QAFwABAQEBAAAAAAAAAAAAAAAAAAQDBv/EACAQAAEDBAIDAAAAAAAAAAAAAAIAAQMEBREhEyIxUXH/xAAVAQEBAAAAAAAAAAAAAAAAAAACA//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJ7HBG4dlld6UeXrhTW6vGJm3pK25AZP6+q4ufjJ2fGUMnz5RFM3/9k=", "metadata": {"Artist": "Alan Tom", "Title": "Viewport, Wing On A Cloud", "DateTimeOriginal": "2024-09-06 16:33:39.000", "ExposureTime": "1/250", "FNumber": "22.0", "ISO": "200", "FocalLength": "15.0 mm", "ExposureProgram": "Shutter speed priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "2880x3840", "Subject": "select"}, "created": "2024-12-10T22:27:15.913667"}, {"id": "DSCF0822", "title": "Clouds I, River", "big": "clouds/DSCF0822_big.avif", "small": "clouds/DSCF0822_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAGgAAAQUBAAAAAAAAAAAAAAAAAAECAwQFBv/EACAQAAICAQMFAAAAAAAAAAAAAAECABEFAwQSITFCUXH/xAAVAQEBAAAAAAAAAAAAAAAAAAAAAf/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AGaWUTysGR7nK0DxND3OfZ2Y2T1iFmPdifplF58grsSysTCZRYk3ZEIH/9k=", "metadata": {"Artist": "Alan Tom", "Title": "Clouds I, River", "DateTimeOriginal": "2024-09-06 16:40:01.000", "ExposureTime": "1/450", "FNumber": "13.0", "ISO": "200", "FocalLength": "45.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "3840x2562", "Subject": "select"}, "created": "2024-12-10T22:27:21.608440"}, {"id": "DSCF0833", "title": "Clouds II, Cotton", "big": "clouds/DSCF0833_big.avif", "small": "clouds/DSCF0833_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAFwAAAwEAAAAAAAAAAAAAAAAAAAMFBP/EABwQAAICAgMAAAAAAAAAAAAAAAECAAMRUQUyYf/EABUBAQEAAAAAAAAAAAAAAAAAAAAB/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8An1XARzXKV9k7jkDMc7lK2lSupRja0Z7AQinpQscwhH//2Q==", "metadata": {"Artist": "Alan Tom", "Title": "Clouds II, Cotton", "DateTimeOriginal": "2024-09-06 16:48:54.000", "ExposureTime": "1/1400", "FNumber": "13.0", "ISO": "200", "FocalLength": "45.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "3840x2562", "Subject": "select"}, "created": "2024-12-10T22:27:20.038401"}, {"id": "DSCF0834", "title": "Clouds III, Streaks", "big": "clouds/DSCF0834_big.avif", "small": "clouds/DSCF0834_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAGQAAAgMBAAAAAAAAAAAAAAAAAAMBAgQF/8QAHRAAAgMAAgMAAAAAAAAAAAAAAQIAAxEhMUFRgf/EABYBAQEBAAAAAAAAAAAAAAAAAAEAA//EABURAQEAAAAAAAAAAAAAAAAAAAAR/9oADAMBAAIRAxEAPwDnmuoeBFMqfIkOzDdlLLCNHqa0RLIu8dQmU2MT3CFT/9k=", "metadata": {"Artist": "Alan Tom", "Title": "Clouds III, Streaks", "DateTimeOriginal": "2024-09-06 16:50:52.000", "ExposureTime": "1/1400", "FNumber": "13.0", "ISO": "200", "FocalLength": "45.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "3840x2562", "Subject": "select"}, "created": "2024-12-10T22:27:20.488772"}, {"id": "DSCF0838", "title": "Clouds IV, Figures", "big": "clouds/DSCF0838_big.avif", "small": "clouds/DSCF0838_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAFwAAAwEAAAAAAAAAAAAAAAAAAAMEBf/EAB8QAAIBBAIDAAAAAAAAAAAAAAABAgMEESESURQxof/EABcBAAMBAAAAAAAAAAAAAAAAAAABAgP/xAAVEQEBAAAAAAAAAAAAAAAAAAAAEf/aAAwDAQACEQMRAD8AwqdpHRbSs4ccv4T203LBftJb9mqCvDh2wGZfbAKcf//Z", "metadata": {"Artist": "Alan Tom", "Title": "Clouds IV, Figures", "DateTimeOriginal": "2024-09-06 16:52:29.000", "ExposureTime": "1/1500", "FNumber": "13.0", "ISO": "200", "FocalLength": "44.5 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "3840x2562", "Subject": "select"}, "created": "2024-12-10T22:27:16.436812"}, {"id": "DSCF0845", "title": "Clouds V, Wispy And A Reflective Road", "big": "clouds/DSCF0845_big.avif", "small": "clouds/DSCF0845_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAFwAAAwEAAAAAAAAAAAAAAAAAAAUGBP/EAB8QAAIBBAIDAAAAAAAAAAAAAAECAAMEBSERMRIiUf/EABYBAQEBAAAAAAAAAAAAAAAAAAACA//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJu3uAG1G9DIOiDYKj7JZXK9GaUrv1zNEqNso5Pr4AQiEVWIhA//2Q==", "metadata": {"Artist": "Alan Tom", "Title": "Clouds V, Wispy And A Reflective Road", "DateTimeOriginal": "2024-09-06 17:16:02.000", "ExposureTime": "1/1250", "FNumber": "8.0", "ISO": "200", "FocalLength": "45.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "3707x2473", "Subject": "dark, select"}, "created": "2024-12-10T22:27:18.874440"}, {"id": "DSCF0849", "title": "Clouds VI, Beams And Shadows", "big": "clouds/DSCF0849_big.avif", "small": "clouds/DSCF0849_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAFwABAQEBAAAAAAAAAAAAAAAABAABBf/EABoQAAIDAQEAAAAAAAAAAAAAAAABAgQRAxP/xAAVAQEBAAAAAAAAAAAAAAAAAAABAv/EABURAQEAAAAAAAAAAAAAAAAAAAAB/9oADAMBAAIRAxEAPwATtPzbWnKsXOim9EgbSTlIqCsd96QGSyTIUv/Z", "metadata": {"Artist": "Alan Tom", "Title": "Clouds VI, Beams And Shadows", "DateTimeOriginal": "2024-09-06 18:17:52.000", "ExposureTime": "1/1400", "FNumber": "11.0", "ISO": "200", "FocalLength": "34.3 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "3840x2561", "Subject": "dark, select"}, "created": "2024-12-10T22:27:17.521690"}], "datetime": "2024-09-06T16:33:39", "created": "2024-12-10T22:27:22.013236"}, {"id": "ladakh", "title": "Ladakh", "images": [{"id": "DSCF0113", "title": "Red Parapet", "big": "ladakh/DSCF0113_big.avif", "small": "ladakh/DSCF0113_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAwQA/8QAHRAAAgMAAgMAAAAAAAAAAAAAAQIAAwQREiExsf/EABUBAQEAAAAAAAAAAAAAAAAAAAID/8QAFxEBAQEBAAAAAAAAAAAAAAAAAQACEf/aAAwDAQACEQMRAD8AnsygISsOvKbG4EvwDvWSxMrWtU9SjtYGAgqyKlYB+TRHJ7HzNB2fL//Z", "metadata": {"Artist": "Alan Tom", "Title": "Red Parapet", "DateTimeOriginal": "2024-08-31 11:10:40.000", "ExposureTime": "1/1250", "FNumber": "5.0", "ISO": "200", "FocalLength": "15.2 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "3840x2561", "Subject": "select"}, "created": "2024-12-10T22:25:58.213004"}, {"id": "DSCF0187", "title": "Monastery I, Near The Palace", "big": "ladakh/DSCF0187_big.avif", "small": "ladakh/DSCF0187_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAIABQDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUE/8QAHhAAAgEDBQAAAAAAAAAAAAAAAAIBAwQRBRIhMaH/xAAWAQEBAQAAAAAAAAAAAAAAAAADAAL/xAAYEQADAQEAAAAAAAAAAAAAAAAAAQIREv/aAAwDAQACEQMRAD8AmTbq05Xo121vuwiyAIrYXEop0tPpSkc+AA1rLEf/2Q==", "metadata": {"Artist": "Alan Tom", "Title": "Monastery I, Near The Palace", "DateTimeOriginal": "2024-08-31 13:07:25.000", "ExposureTime": "1/480", "FNumber": "11.0", "ISO": "320", "FocalLength": "45.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "3840x1606", "Subject": "select"}, "created": "2024-12-10T22:25:39.501605"}, {"id": "DSCF0219", "title": "Yellow Jacket I, Butter Tea", "big": "ladakh/DSCF0219_big.avif", "small": "ladakh/DSCF0219_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAGAAAAwEBAAAAAAAAAAAAAAAAAAMFBAb/xAAgEAABBAIBBQAAAAAAAAAAAAABAAIDERIhMQQTMoGR/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAL/xAAWEQEBAQAAAAAAAAAAAAAAAAAAERL/2gAMAwEAAhEDEQA/AEzW2JzGDVKG2F7ZwS3V8hdHeU+JAITO2yqxHxTkqRFMY2BuN+0LZP08Yk8edoSQf//Z", "metadata": {"Artist": "Alan Tom", "Title": "Yellow Jacket I, Butter Tea", "DateTimeOriginal": "2024-08-31 18:32:04.000", "ExposureTime": "1/40", "FNumber": "4.4", "ISO": "800", "FocalLength": "26.4 mm", "ExposureProgram": "Shutter speed priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "3840x2562", "Subject": "select"}, "created": "2024-12-10T22:25:38.496402"}, {"id": "DSCF0282", "title": "Monastery II, Near The Statue", "big": "ladakh/DSCF0282_big.avif", "small": "ladakh/DSCF0282_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAALABQDASIAAhEBAxEB/8QAGAAAAwEBAAAAAAAAAAAAAAAAAAMEAgX/xAAcEAACAgMBAQAAAAAAAAAAAAAAAQIREiExBEH/xAAVAQEBAAAAAAAAAAAAAAAAAAAAAf/EABURAQEAAAAAAAAAAAAAAAAAAAAB/9oADAMBAAIRAxEAPwCfzTSVSKMlWmc/nB8W6T+0WBksU9rYGqT6gKP/2Q==", "metadata": {"Artist": "Alan Tom", "Title": "Monastery II, Near The Statue", "DateTimeOriginal": "2024-09-01 17:25:21.000", "ExposureTime": "1/140", "FNumber": "9.0", "ISO": "400", "FocalLength": "43.2 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "3840x2160", "Subject": "select"}, "created": "2024-12-10T22:25:50.396008"}, {"id": "DSCF0288", "title": "Landscape I, Sunlit Mountain Face", "big": "ladakh/DSCF0288_big.avif", "small": "ladakh/DSCF0288_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAALABQDASIAAhEBAxEB/8QAGAAAAgMAAAAAAAAAAAAAAAAAAAUBAwT/xAAeEAACAgICAwAAAAAAAAAAAAAAAQIRAwUEEjJBYf/EABUBAQEAAAAAAAAAAAAAAAAAAAAB/8QAFREBAQAAAAAAAAAAAAAAAAAAABH/2gAMAwEAAhEDEQA/ALpbnF1qxdytq7uDpfBLFtNU2icnkWpG5bXN7mwFwCkf/9k=", "metadata": {"Artist": "Alan Tom", "Title": "Landscape I, Sunlit Mountain Face", "DateTimeOriginal": "2024-09-01 17:32:16.000", "ExposureTime": "1/280", "FNumber": "10.0", "ISO": "400", "FocalLength": "31.4 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "3840x2160", "Subject": "select"}, "created": "2024-12-10T22:26:01.022638"}, {"id": "DSCF0306", "title": "Landscape II, Small Buildings", "big": "ladakh/DSCF0306_big.avif", "small": "ladakh/DSCF0306_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAFwABAQEBAAAAAAAAAAAAAAAABQACBP/EAB8QAQACAgAHAAAAAAAAAAAAAAEAAgMREyEyQVFhsf/EABQBAQAAAAAAAAAAAAAAAAAAAAH/xAAVEQEBAAAAAAAAAAAAAAAAAAAAEf/aAAwDAQACEQMRAD8AOxoJpnTTK1PJCqXsd9zVs1g5fYUwk51erUoTxr+pRoj/2Q==", "metadata": {"Artist": "Alan Tom", "Title": "Landscape II, Small Buildings", "DateTimeOriginal": "2024-09-01 17:49:54.000", "ExposureTime": "1/150", "FNumber": "8.0", "ISO": "500", "FocalLength": "45.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "3840x2562", "Subject": "select"}, "created": "2024-12-10T22:25:57.049287"}, {"id": "DSCF0330", "title": "Yellow Jacket II, Near The Dunes", "big": "ladakh/DSCF0330_big.avif", "small": "ladakh/DSCF0330_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAIABQDASIAAhEBAxEB/8QAFwABAAMAAAAAAAAAAAAAAAAAAAMEBf/EABwQAQEAAAcAAAAAAAAAAAAAAAABAgQSEzFRYf/EABUBAQEAAAAAAAAAAAAAAAAAAAAB/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AwctcUl6Wt26fQUR8gA//2Q==", "metadata": {"Artist": "Alan Tom", "Title": "Yellow Jacket II, Near The Dunes", "DateTimeOriginal": "2024-09-01 18:48:23.000", "ExposureTime": "1/100", "FNumber": "5.6", "ISO": "1250", "FocalLength": "45.0 mm", "ExposureProgram": "Shutter speed priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "3840x1607", "Subject": "dark, select"}, "created": "2024-12-10T22:25:48.245480"}, {"id": "DSCF0399", "title": "The Lizard", "big": "ladakh/DSCF0399_big.avif", "small": "ladakh/DSCF0399_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAIABQDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAT/xAAcEAACAgIDAAAAAAAAAAAAAAAAAQIRAwQiUZH/xAAWAQEBAQAAAAAAAAAAAAAAAAAAAQL/xAAVEQEBAAAAAAAAAAAAAAAAAAAAEf/aAAwDAQACEQMRAD8AR1qfEq1p06yJJIA1RS54e14AAj//2Q==", "metadata": {"Artist": "Alan Tom", "Title": "The Lizard", "DateTimeOriginal": "2024-09-02 10:49:52.000", "ExposureTime": "1/550", "FNumber": "5.6", "ISO": "200", "FocalLength": "45.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "3840x1607", "Subject": "select"}, "created": "2024-12-10T22:26:04.392354"}, {"id": "DSCF0442", "title": "Blue Doors", "big": "ladakh/DSCF0442_big.avif", "small": "ladakh/DSCF0442_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAFwABAQEBAAAAAAAAAAAAAAAAAwAEBf/EAB4QAAICAgIDAAAAAAAAAAAAAAERAAIDIQQSEyIx/8QAFQEBAQAAAAAAAAAAAAAAAAAAAQL/xAAWEQEBAQAAAAAAAAAAAAAAAAAAEQH/2gAMAwEAAhEDEQA/AC4mE+JkIx64rFhlR+NTtjBa1GGFBAysidrl5sFe/sHr7Ka7UqTsOUIa/9k=", "metadata": {"Artist": "Alan Tom", "Title": "Blue Doors", "DateTimeOriginal": "2024-09-02 14:05:35.000", "ExposureTime": "1/450", "FNumber": "4.4", "ISO": "200", "FocalLength": "23.5 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "3840x2562", "Subject": "select"}, "created": "2024-12-10T22:25:47.905577"}, {"id": "DSCF0485", "title": "Cow At A Police Check Post", "big": "ladakh/DSCF0485_big.avif", "small": "ladakh/DSCF0485_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAIABQDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAME/8QAGxAAAgMAAwAAAAAAAAAAAAAAAAECAxEEEiH/xAAUAQEAAAAAAAAAAAAAAAAAAAAB/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8Ay8WmUt3xFrKekdTAAoJ6ABD/2Q==", "metadata": {"Artist": "Alan Tom", "Title": "Cow At A Police Check Post", "DateTimeOriginal": "2024-09-03 12:25:26.000", "ExposureTime": "1/300", "FNumber": "10.0", "ISO": "200", "FocalLength": "17.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "3840x1606", "Subject": "select"}, "created": "2024-12-10T22:25:49.919892"}, {"id": "DSCF0493", "title": "The Fox", "big": "ladakh/DSCF0493_big.avif", "small": "ladakh/DSCF0493_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAIABQDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAP/xAAaEAEBAAMBAQAAAAAAAAAAAAABAAIDMSEi/8QAFgEBAQEAAAAAAAAAAAAAAAAAAgAB/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8Ama0x77EA+pIEhkal7JLE/9k=", "metadata": {"Artist": "Alan Tom", "Title": "The Fox", "DateTimeOriginal": "2024-09-03 12:52:06.000", "ExposureTime": "1/680", "FNumber": "5.6", "ISO": "200", "FocalLength": "45.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "3840x1606", "Subject": "select"}, "created": "2024-12-10T22:25:54.004509"}, {"id": "DSCF0521", "title": "Landscape III, Sheep", "big": "ladakh/DSCF0521_big.avif", "small": "ladakh/DSCF0521_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAIABQDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAIB/8QAGxABAQACAwEAAAAAAAAAAAAAAQAEMQIDESH/xAAXAQADAQAAAAAAAAAAAAAAAAAAAQID/8QAFxEBAQEBAAAAAAAAAAAAAAAAAAEREv/aAAwDAQACEQMRAD8As7zifG0zPHclntWsz00ySOqWR//Z", "metadata": {"Artist": "Alan Tom", "Title": "Landscape III, Sheep", "DateTimeOriginal": "2024-09-03 14:40:49.000", "ExposureTime": "1/1100", "FNumber": "4.5", "ISO": "200", "FocalLength": "15.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "3840x1606", "Subject": "select"}, "created": "2024-12-10T22:25:43.012684"}, {"id": "DSCF0535", "title": "The Marmot", "big": "ladakh/DSCF0535_big.avif", "small": "ladakh/DSCF0535_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAGAAAAgMAAAAAAAAAAAAAAAAAAAQBAgP/xAAdEAACAgEFAAAAAAAAAAAAAAAAAQIRMQMEEhNR/8QAFgEBAQEAAAAAAAAAAAAAAAAAAgME/8QAFxEBAAMAAAAAAAAAAAAAAAAAAAEREv/aAAwDAQACEQMRAD8AwjuW3Rfk1gVbpWStWTeTLqVaNqMmrsBbsl6AtwNP/9k=", "metadata": {"Artist": "Alan Tom", "Title": "The Marmot", "DateTimeOriginal": "2024-09-03 14:56:21.000", "ExposureTime": "1/500", "FNumber": "5.6", "ISO": "200", "FocalLength": "45.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "3840x2562", "Subject": "select"}, "created": "2024-12-10T22:25:44.033894"}, {"id": "DSCF0572", "title": "Evening Lake", "big": "ladakh/DSCF0572_big.avif", "small": "ladakh/DSCF0572_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAIABQDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUG/8QAGxAAAgIDAQAAAAAAAAAAAAAAAAECAwQFIRH/xAAVAQEBAAAAAAAAAAAAAAAAAAABAv/EABYRAQEBAAAAAAAAAAAAAAAAAAABEf/aAAwDAQACEQMRAD8AzmHu76pJSbcStLbxsx34l0AqUpFuYnN8AA7U4//Z", "metadata": {"Artist": "Alan Tom", "Title": "Evening Lake", "DateTimeOriginal": "2024-09-03 18:53:23.000", "ExposureTime": "1/60", "FNumber": "3.5", "ISO": "640", "FocalLength": "15.0 mm", "ExposureProgram": "Shutter speed priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "3840x1606", "Subject": "dark, select"}, "created": "2024-12-10T22:26:06.181803"}, {"id": "DSCF0605", "title": "Landscape IV, Three Cows", "big": "ladakh/DSCF0605_big.avif", "small": "ladakh/DSCF0605_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAIABQDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAMC/8QAGhAAAgMBAQAAAAAAAAAAAAAAAAECBBEDEv/EABUBAQEAAAAAAAAAAAAAAAAAAAEC/8QAFxEBAQEBAAAAAAAAAAAAAAAAAQACEf/aAAwDAQACEQMRAD8AvC7HmsRiV+evymAU6aTJRdqbegAOs8v/2Q==", "metadata": {"Artist": "Alan Tom", "Title": "Landscape IV, Three Cows", "DateTimeOriginal": "2024-09-04 14:32:44.000", "ExposureTime": "1/550", "FNumber": "11.0", "ISO": "400", "FocalLength": "15.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "3840x1606", "Subject": "select"}, "created": "2024-12-10T22:26:04.780035"}, {"id": "DSCF0610", "title": "Yellow Jacket III, Near The Observatory", "big": "ladakh/DSCF0610_big.avif", "small": "ladakh/DSCF0610_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAIABQDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAT/xAAbEAADAAIDAAAAAAAAAAAAAAAAAQIEERIUUf/EABUBAQEAAAAAAAAAAAAAAAAAAAEC/8QAGBEAAwEBAAAAAAAAAAAAAAAAAAESAhP/2gAMAwEAAhEDEQA/AJlmwvR3Yae0AXbJ55JrzI5AALYxk//Z", "metadata": {"Artist": "Alan Tom", "Title": "Yellow Jacket III, Near The Observatory", "DateTimeOriginal": "2024-09-04 16:04:18.000", "ExposureTime": "1/900", "FNumber": "11.0", "ISO": "400", "FocalLength": "35.3 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "3840x1606", "Subject": "select"}, "created": "2024-12-10T22:26:06.589534"}, {"id": "DSCF0615", "title": "Telescope I", "big": "ladakh/DSCF0615_big.avif", "small": "ladakh/DSCF0615_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAwAE/8QAHRABAAIDAAMBAAAAAAAAAAAAAQACAwQREiExMv/EABcBAAMBAAAAAAAAAAAAAAAAAAABAgP/xAAWEQEBAQAAAAAAAAAAAAAAAAAAEwH/2gAMAwEAAhEDEQA/AEz6NaCj6g0w0sIPUhZNjJ4PbMGmW9e8ZpTUTxqdc7+pTK5rr9ZQqUn/2Q==", "metadata": {"Artist": "Alan Tom", "Title": "Telescope I", "DateTimeOriginal": "2024-09-04 16:13:17.000", "ExposureTime": "1/3500", "FNumber": "4.4", "ISO": "400", "FocalLength": "24.9 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "3840x2562", "Subject": "select"}, "created": "2024-12-10T22:26:02.887818"}, {"id": "DSCF0619", "title": "Telescope II", "big": "ladakh/DSCF0619_big.avif", "small": "ladakh/DSCF0619_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAIABQDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAEE/8QAHhAAAgIBBQEAAAAAAAAAAAAAAAIBAxEEEiFBUaH/xAAVAQEBAAAAAAAAAAAAAAAAAAAAAf/EABYRAAMAAAAAAAAAAAAAAAAAAAABEv/aAAwDAQACEQMRAD8AQieEaxE46AFMkoxWaqjfOY+ZAApllH//2Q==", "metadata": {"Artist": "Alan Tom", "Title": "Telescope II", "DateTimeOriginal": "2024-09-04 16:17:22.000", "ExposureTime": "1/1100", "FNumber": "11.0", "ISO": "400", "FocalLength": "21.5 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "3840x1606", "Subject": "select"}, "created": "2024-12-10T22:25:41.267817"}, {"id": "DSCF0666", "title": "Sandwich Before School", "big": "ladakh/DSCF0666_big.avif", "small": "ladakh/DSCF0666_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAANABQDASIAAhEBAxEB/8QAFwAAAwEAAAAAAAAAAAAAAAAAAAMFBv/EAB4QAAEFAAIDAAAAAAAAAAAAAAEAAgMEEQUSITGB/8QAFQEBAQAAAAAAAAAAAAAAAAAAAQL/xAAXEQEBAQEAAAAAAAAAAAAAAAAAARES/9oADAMBAAIRAxEAPwCNDy7jUEJb6GalQSxtm1wB1OpVIn19cNKm2T0kIaMRYY0UctVzAT0+4hZ6OR/Tw7EKeVa//9k=", "metadata": {"Artist": "Alan Tom", "Title": "Sandwich Before School", "DateTimeOriginal": "2024-09-05 08:58:40.000", "ExposureTime": "1/100", "FNumber": "4.9", "ISO": "800", "FocalLength": "32.3 mm", "ExposureProgram": "Shutter speed priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "3840x2562", "Subject": "select"}, "created": "2024-12-10T22:25:59.346355"}, {"id": "DSCF0685", "title": "Landscape V, Utility Poles", "big": "ladakh/DSCF0685_big.avif", "small": "ladakh/DSCF0685_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAIABQDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAP/xAAcEAACAgIDAAAAAAAAAAAAAAAAAgEDBBIhMVH/xAAWAQEBAQAAAAAAAAAAAAAAAAADAQL/xAAYEQADAQEAAAAAAAAAAAAAAAAAAlESE//aAAwDAQACEQMRAD8AgtdE+FIXHWOoAE2wXJYSZ6duFABNtTXNYf/Z", "metadata": {"Artist": "Alan Tom", "Title": "Landscape V, Utility Poles", "DateTimeOriginal": "2024-09-05 10:14:40.000", "ExposureTime": "1/340", "FNumber": "13.0", "ISO": "200", "FocalLength": "33.3 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "3840x1606", "Subject": "select"}, "created": "2024-12-10T22:25:52.342011"}, {"id": "DSCF0688", "title": "The Transport", "big": "ladakh/DSCF0688_big.avif", "small": "ladakh/DSCF0688_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAHABQDASIAAhEBAxEB/8QAFwABAAMAAAAAAAAAAAAAAAAAAAMEBf/EAB4QAAIBAwUAAAAAAAAAAAAAAAABAgMRIQQSEzGR/8QAFgEBAQEAAAAAAAAAAAAAAAAAAgED/8QAFxEAAwEAAAAAAAAAAAAAAAAAAAECEv/aAAwDAQACEQMRAD8Az9NQptXllllQhFYuAPbM1EkE+Hd2/AAXbDiT/9k=", "metadata": {"Artist": "Alan Tom", "Title": "The Transport", "DateTimeOriginal": "2024-09-05 10:15:42.000", "ExposureTime": "1/210", "FNumber": "13.0", "ISO": "200", "FocalLength": "15.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "3840x1417", "Subject": "select"}, "created": "2024-12-10T22:25:54.263865"}, {"id": "DSCF0690", "title": "The Smoker", "big": "ladakh/DSCF0690_big.avif", "small": "ladakh/DSCF0690_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAIABQDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAEE/8QAHBAAAgICAwAAAAAAAAAAAAAAAAECBAMhETJh/8QAFQEBAQAAAAAAAAAAAAAAAAAAAQD/xAAWEQADAAAAAAAAAAAAAAAAAAAAARL/2gAMAwEAAhEDEQA/AJC8kkklr0ZLUckdpcgFTCUZ3Zin1AA0whH/2Q==", "metadata": {"Artist": "Alan Tom", "Title": "The Smoker", "DateTimeOriginal": "2024-09-05 10:16:19.000", "ExposureTime": "1/210", "FNumber": "13.0", "ISO": "200", "FocalLength": "45.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "3840x1607", "Subject": "select"}, "created": "2024-12-10T22:25:51.574583"}, {"id": "DSCF0694", "title": "Dunes I, The Trucks", "big": "ladakh/DSCF0694_big.avif", "small": "ladakh/DSCF0694_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAIABQDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAMC/8QAHRAAAgIBBQAAAAAAAAAAAAAAAAEEEQIDFCFiof/EABYBAQEBAAAAAAAAAAAAAAAAAAACA//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/ALaElpXXBve9QDNaWUtW7fgAA//Z", "metadata": {"Artist": "Alan Tom", "Title": "Dunes I, The Trucks", "DateTimeOriginal": "2024-09-05 10:36:29.000", "ExposureTime": "1/1400", "FNumber": "5.6", "ISO": "200", "FocalLength": "44.5 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "3840x1607", "Subject": "select"}, "created": "2024-12-10T22:25:45.237598"}, {"id": "DSCF0695", "title": "Dunes II, The Horses", "big": "ladakh/DSCF0695_big.avif", "small": "ladakh/DSCF0695_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAIABQDASIAAhEBAxEB/8QAFwABAAMAAAAAAAAAAAAAAAAAAAIDBP/EABkQAQEBAAMAAAAAAAAAAAAAAAABBAIDQf/EABcBAAMBAAAAAAAAAAAAAAAAAAACAwT/xAAVEQEBAAAAAAAAAAAAAAAAAAAAAf/aAAwDAQACEQMRAD8A0de+L5tlBnlqiF1cfADB/9k=", "metadata": {"Artist": "Alan Tom", "Title": "Dunes II, The Horses", "DateTimeOriginal": "2024-09-05 10:36:58.000", "ExposureTime": "1/1250", "FNumber": "5.6", "ISO": "200", "FocalLength": "44.5 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "3840x1606", "Subject": "select"}, "created": "2024-12-10T22:25:42.677236"}, {"id": "DSCF0696", "title": "The Tent", "big": "ladakh/DSCF0696_big.avif", "small": "ladakh/DSCF0696_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAIABQDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAL/xAAdEAACAQQDAAAAAAAAAAAAAAAAAQIDERITIVGh/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAH/xAAVEQEBAAAAAAAAAAAAAAAAAAAAEf/aAAwDAQACEQMRAD8AhVJrhMvbNJXj4ARVZvoACj//2Q==", "metadata": {"Artist": "Alan Tom", "Title": "The Tent", "DateTimeOriginal": "2024-09-05 10:38:07.000", "ExposureTime": "1/1700", "FNumber": "5.6", "ISO": "200", "FocalLength": "44.5 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "3840x1606", "Subject": "select"}, "created": "2024-12-10T22:25:46.135206"}, {"id": "DSCF0702", "title": "Men And Horses", "big": "ladakh/DSCF0702_big.avif", "small": "ladakh/DSCF0702_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAIABQDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAP/xAAbEAADAAIDAAAAAAAAAAAAAAAAAQIRIQMSMf/EABYBAQEBAAAAAAAAAAAAAAAAAAIAAf/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AIxUvSWB1ewAmk+O8+AAmP/Z", "metadata": {"Artist": "Alan Tom", "Title": "Men And Horses", "DateTimeOriginal": "2024-09-05 11:03:38.000", "ExposureTime": "1/340", "FNumber": "13.0", "ISO": "200", "FocalLength": "45.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "3840x1607", "Subject": "select"}, "created": "2024-12-10T22:25:55.732926"}, {"id": "DSCF0705", "title": "Man Following A Foal", "big": "ladakh/DSCF0705_big.avif", "small": "ladakh/DSCF0705_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAIABQDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAID/8QAHBAAAgIDAQEAAAAAAAAAAAAAAAECAwQRkSEx/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAH/xAAVEQEBAAAAAAAAAAAAAAAAAAAAEf/aAAwDAQACEQMRAD8AzrxnH1PrLU7K/kgCCllWpa2uAAtH/9k=", "metadata": {"Artist": "Alan Tom", "Title": "Man Following A Foal", "DateTimeOriginal": "2024-09-05 11:05:44.000", "ExposureTime": "1/480", "FNumber": "13.0", "ISO": "200", "FocalLength": "45.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "3840x1606", "Subject": "select"}, "created": "2024-12-10T22:25:59.006891"}, {"id": "DSCF0774", "title": "Landscape VI, Where The Green Begins", "big": "ladakh/DSCF0774_big.avif", "small": "ladakh/DSCF0774_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAPABQDASIAAhEBAxEB/8QAGQAAAgMBAAAAAAAAAAAAAAAAAAYCAwQF/8QAHxAAAQQCAgMAAAAAAAAAAAAAAQACAwQREgUxIVGR/8QAFQEBAQAAAAAAAAAAAAAAAAAAAwL/xAAZEQEBAAMBAAAAAAAAAAAAAAABAAMREiH/2gAMAwEAAhEDEQA/AK5KDu1orSurjBcFGxfa1vgdrlSzukcTkpnKvkBiB2TCOUiAxshLWx9n6hR1Jzf/2Q==", "metadata": {"Artist": "Alan Tom", "Title": "Landscape VI, Where The Green Begins", "DateTimeOriginal": "2024-09-05 16:26:13.000", "ExposureTime": "1/550", "FNumber": "11.0", "ISO": "400", "FocalLength": "15.0 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "3840x2880", "Subject": "select"}, "created": "2024-12-10T22:26:02.374775"}, {"id": "DSCF0779", "title": "Monastery III, Near The City", "big": "ladakh/DSCF0779_big.avif", "small": "ladakh/DSCF0779_small.avif", "preload": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAIABQDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAMC/8QAHRAAAgIBBQAAAAAAAAAAAAAAAAEDESECBRJRkf/EABUBAQEAAAAAAAAAAAAAAAAAAAEC/8QAFhEAAwAAAAAAAAAAAAAAAAAAAAES/9oADAMBAAIRAxEAPwCc+4LU6Sog5Ky8WAVTJlGuSffoAGmEo//Z", "metadata": {"Artist": "Alan Tom", "Title": "Monastery III, Near The City", "DateTimeOriginal": "2024-09-05 17:00:09.000", "ExposureTime": "1/450", "FNumber": "10.0", "ISO": "400", "FocalLength": "28.8 mm", "ExposureProgram": "Aperture-priority AE", "Make": "Fujifilm", "Model": "X-T200", "LensMake": "Fujifilm", "LensModel": "XC15-45mmF3.5-5.6 OIS PZ", "ImageSize": "3840x1606", "Subject": "select"}, "created": "2024-12-10T22:25:40.901422"}], "datetime": "2024-08-31T11:10:40", "created": "2024-12-10T22:26:06.839275"}];

init();

console.log(
  '%cHello, if you notice weird UX issues do let me know! – Alan',
  'font-size: 2rem'
);
