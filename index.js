const projects = [
  {
    title: 'synth',
    date: '2021-02-14',
    description: 'An attempt at making a synth using Python',
    location: 'GitHub',
    link: 'https://github.com/18alantom/synth',
  },
  {
    title: 'zettel.vim',
    date: '2021-09-19',
    description: 'A Vim plugin to hyperlink files',
    location: 'GitHub',
    link: 'https://github.com/18alantom/zettel.vim',
    pinned: true,
  },
  {
    title: 'Strawberry',
    date: '2023-03-27',
    description: 'Zero-dependency, build-free framework for the artisanal web',
    location: 'Strawberry',
    link: 'https://strawberry.quest/',
    pinned: true,
  },
  {
    title: 'asyncpy-server-benchmarks',
    date: '2023-11-24T13:52:50Z',
    description:
      'Synthetic benchmarks of Python WSGI and ASGI apps and servers',
    location: 'GitHub',
    link: 'https://github.com/18alantom/asyncpy-server-benchmarks',
  },
  {
    title: 'bm_exp',
    date: '2024-08-09T08:30:16Z',
    description:
      'An experiment in Go to see if multiple Frappe apps can be installed concurrently',
    location: 'GitHub',
    link: 'https://github.com/18alantom/bm_exp',
  },
  {
    title: 'Frappe Books',
    date: '2021-09-02T18:29:51Z',
    description:
      'Free Desktop book-keeping software for small-businesses and freelancers',
    location: 'Frappe [work]',
    link: 'https://frappe.io/books',
    pinned: true,
  },
  {
    title: 'concurrent_inference',
    date: '2021-01-13T07:28:55Z',
    description:
      'An example of how to use the multiprocessing package along with PyTorch',
    location: 'GitHub',
    link: 'https://github.com/18alantom/concurrent_inference',
  },
  {
    title: 'CoveragePathPlanning',
    date: '2020-07-19T18:52:03Z',
    description: 'Code pertaining to coverage path planning and area division',
    location: 'GitHub',
    link: 'https://github.com/18alantom/CoveragePathPlanning',
  },
  {
    title: 'fetzen',
    date: '2019-07-28T14:10:11Z',
    description: 'A workout tracking web app.',
    location: 'GitHub',
    link: 'https://github.com/18alantom/fetzen',
  },
  {
    title: 'fex',
    date: '2024-03-25T06:51:59Z',
    description:
      'A command-line file explorer in Zig that prioritizes quick navigation',
    location: 'GitHub',
    link: 'https://github.com/18alantom/fex',
    pinned: true,
  },
  {
    title: 'fitloop',
    date: '2020-05-06T00:14:49Z',
    description: '\u27b0 fitloop trains Pytorch models',
    location: 'GitHub',
    link: 'https://github.com/18alantom/fitloop',
  },
].map((p) => ({ ...p, type: 'project' }));

const albums = [
  {
    title: 'Mold',
    date: '2025-02-10',
    description: 'I wanted to test for mold, but I ran out of petri dishes',
    location: '/photos',
    link: '/photos.html?album=mold',
  },
  {
    title: 'Colaba',
    date: '2025-02-02',
    description: 'Black and white, or blue and orange shots from Colaba',
    location: '/photos',
    link: '/photos.html?album=colaba',
  },
  {
    title: 'Creature Portraits',
    date: '2025-01-22',
    description: 'Black and white portraits of creatures (non human)',
    location: '/photos',
    link: '/photos.html?album=creature_portraits',
  },
  {
    title: 'Untitled II',
    date: '2025-01-17',
    description: 'Two photos from a walk near my house',
    location: '/photos',
    link: '/photos.html?album=untitled_II',
  },
  {
    title: 'Near The Mangroves',
    date: '2024-12-31',
    description: 'High tide explains some of the strangeness',
    location: '/photos',
    link: '/photos.html?album=near_the_mangroves',
  },
  {
    title: 'Seawoods',
    date: '2024-12-28',
    description: 'Photos from walks around Seawoods',
    location: '/photos',
    link: '/photos.html?album=seawoods',
  },
  {
    title: 'Untitled I',
    date: '2024-11-23',
    description: 'Three photos from a walk near my house',
    location: '/photos',
    link: '/photos.html?album=untitled_I',
  },
  {
    title: 'Clouds',
    date: '2024-09-06',
    description:
      'Mostly monochromatic but differently done shots of clouds from a window seat',
    location: '/photos',
    link: '/photos.html?album=clouds',
  },
  {
    title: 'Ladakh',
    date: '2024-08-31',
    description: 'Photos from a miserably fantastic trip to Ladakh',
    location: '/photos',
    link: '/photos.html?album=ladakh',
  },
].map((p) => ({ ...p, type: 'album' }));

const posts = [
  {
    title: 'CODE_READABILITY.md',
    date: '2024-07-05',
    description:
      "A document on code quality and readability inspired by the frustrating code I've encountered recently",
    location: 'GitHub Gist',
    link: 'https://gist.github.com/18alantom/d9f0565c0f42d6a71311d4a3093a1331',
  },
  {
    title:
      'Building a Frontend Framework; Reactivity and Composability With Zero Dependencies',
    date: '2023-05-13',
    description:
      'Or how hard is it to build a frontend framework with only Web APIs and no dependencies?',
    link: '/posts/how-hard-is-it-to-build-a-frontend-framework.html',
    pinned: true,
  },
  {
    title: 'Misanthropy Thwarted',
    date: '2022-01-22',
    description: 'A serendipitous reminder to douse the cynic.',
  },
  {
    title: 'AGI in T Minus Ten Years',
    date: '2021-11-27',
    description: 'What I think about AGI arriving soon and you should too.',
  },
  {
    title: 'What The Fuck Is Biting Me?',
    date: '2021-02-06',
    description:
      'Eleven something AM, woke up feeling like shit. My mental state mourning the cessation of an another failed attempt at good sleep.',
  },
  {
    title: 'Post Zero, Why?',
    date: '2021-06-25',
    description: 'Finally, a digital domicile just for me.',
  },
  {
    title: 'First Attempt at a Complete Rewrite',
    date: '2022-03-08',
    description:
      "Doing a complete rewrite of Frappe Books has been on my mind for around a month, so I thought I'd give it a shot.",
    location: 'Frappe Books Tech Blog',
    link: '/frappebooks_tech/complete_rewrite',
  },
  {
    title: 'Enabling Translations',
    date: '2022-02-17',
    description:
      "Not everyone knows English, and it is generally the least favorite language of polyglots (don't quote me on this). Suffice to say translations are important.",
    location: 'Frappe Books Tech Blog',
    link: '/frappebooks_tech/enabling_translations',
  },
  {
    title: 'Refactoring Charts',
    date: '2022-02-08',
    description:
      'I had to rewrite the charts in Frappe Books. This seemed like the only option. Well almost.',
    location: 'Frappe Books Tech Blog',
    link: '/frappebooks_tech/refactoring_charts',
    pinned: true,
  },
  {
    title: 'Mumbai University, Everyone Cheated',
    description:
      'The plot in the banner image of this post shows two histograms. These histograms substantiate the claim in the title.',
    date: '2021-06-21',
    location: 'Medium',
    link: 'https://18alan.medium.com/mumbai-university-everyone-cheated-83320b8c351a',
    pinned: true,
  },
  {
    title: 'Making A Synth With Python — Controllers',
    description:
      'Part of a series of posts on making a synthesizer using Python. This one covers controllers.',
    date: '2021-03-02',
    location: 'Medium',
    link: 'https://python.plainenglish.io/build-your-own-python-synthesizer-part-3-162796b7d351',
  },
  {
    title: 'Making A Synth With Python — Modulators',
    description:
      'Part of a series of posts on making a synthesizer using Python. This one covers modulators.',
    date: '2021-02-22',
    location: 'Medium',
    link: 'https://python.plainenglish.io/build-your-own-python-synthesizer-part-2-66396f6dad81',
    pinned: true,
  },
  {
    title: 'Making A Synth With Python — Oscillators',
    description:
      'Part of a series of posts on making a synthesizer using Python. This one covers oscillators.',
    date: '2021-02-17',
    location: 'Medium',
    link: 'https://python.plainenglish.io/making-a-synth-with-python-oscillators-2cb8e68e9c3b',
  },
].map((p) => ({ ...p, type: 'post' }));

const index = [...posts, ...albums, ...projects]
  .sort((a, b) => new Date(b.date).valueOf() - new Date(a.date).valueOf())
  .sort((a, b) => Number(b.pinned ?? false) - Number(a.pinned ?? false))
  .map((p) => formatPost(p));

function formatPost(item) {
  item.date = formatDate(item.date);
  item.description = item.description ?? '';
  item.location ??= '/posts';

  if (!item.link) {
    // 'Post Zero, Why?' -> 'post-zero-why'
    const slug = item.title
      .toLowerCase()
      .replace('-', '')
      .replace(/\s+/g, '-')
      .replace(/[^-a-z]+/g, '');

    item.link = `posts/${slug}.html`;
  }

  if (item.link.startsWith('/') && window.location.pathname) {
    item.link = window.location.pathname + item.link.slice(1);
  }

  item.isExternal = item.link?.startsWith('http') ?? false;
  return item;
}

function formatDate(date) {
  // '1995-01-21' -> 'Jan 21, 1995'
  let [month, day, year] = new Date(date).toDateString().split(' ').slice(1);
  if (day.startsWith('0')) day = day.slice(1);

  return `${month} ${day}, ${year}`;
}

function populatePosts(filter) {
  const postsSection = document.getElementById('posts');
  const domParser = new DOMParser();

  postsSection.innerHTML = '';
  for (const item of index) {
    if (item.type !== filter) continue;

    const post_str = `
      <a href="${item.link}">
        <h2 class="title">${item.title}</h2>
        <div class="date-location">
          <time>${item.date}</time> · <p>${item.location}</p>
        </div>
        <p class="description">${item.description}</p>
      </a>
    `.trim();

    const element = domParser.parseFromString(post_str, 'text/html').body
      .children[0];

    if (item.pinned) {
      element.classList.add('pinned');
    }

    if (item.isExternal) {
      element.target = '_blank';
      element.relList = ['noreferrer', 'noopener'];
    }
    postsSection.append(element);
  }
}

function init() {
  const params = new URLSearchParams(window.location.search);
  let filter = params.get('filter') ?? 'post'; // "post" | "album" | "project"

  function updateFilter() {
    if (!['post', 'album', 'project'].includes(filter)) filter = 'post';
    params.set('filter', filter);
    if (filter === 'post') params.delete('filter');

    let url = window.location.pathname;
    if (url.endsWith('/') && params.toString()) url = url.slice(0, -1);
    if (params.toString()) url += '?' + params;

    window.history.replaceState({}, '', url);
  }

  updateFilter();
  populatePosts(filter);

  const buttons = [...document.querySelectorAll('[data-filter]')].filter(
    (b) => b instanceof HTMLButtonElement
  );

  function setStyle() {
    buttons.forEach((b) => (b.dataset.toggled = b.dataset.filter === filter));
  }

  setStyle();
  buttons.forEach((b) =>
    b.addEventListener('click', (e) => {
      filter = b.dataset.filter;
      setStyle();
      populatePosts(filter);
      updateFilter();
    })
  );
}

init();
