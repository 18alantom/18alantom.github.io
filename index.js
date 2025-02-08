const posts = [
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
  },
  {
    title: 'Mumbai University, Everyone Cheated',
    description:
      'The plot in the banner image of this post shows two histograms. These histograms substantiate the claim in the title.',
    date: '2021-06-21',
    location: 'Medium',
    link: 'https://18alan.medium.com/mumbai-university-everyone-cheated-83320b8c351a',
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
  },
  {
    title: 'Making A Synth With Python — Oscillators',
    description:
      'Part of a series of posts on making a synthesizer using Python. This one covers oscillators.',
    date: '2021-02-17',
    location: 'Medium',
    link: 'https://python.plainenglish.io/making-a-synth-with-python-oscillators-2cb8e68e9c3b',
  },
]
  .sort((a, b) => new Date(b.date).valueOf() - new Date(a.date).valueOf())
  .map((p) => formatPost(p));

function formatPost(post) {
  post.isExternal =
    post.location !== undefined && !post.location?.startsWith('/');

  post.date = formatDate(post.date);
  post.description = post.description ?? '';
  post.location ??= '/posts';

  if (post.location.startsWith('/')) {
    post.location = `<code>${post.location}</code>`;
  }

  if (!post.link) {
    // 'Post Zero, Why?' -> 'post-zero-why'
    const slug = post.title
      .toLowerCase()
      .replace('-', '')
      .replace(/\s+/g, '-')
      .replace(/[^-a-z]+/g, '');

    post.link = `posts/${slug}.html`;
  }

  if (post.link.startsWith('/') && window.location.pathname) {
    post.link = window.location.pathname + post.link.slice(1);
  }

  return post;
}

function formatDate(date) {
  // '1995-01-21' -> 'Jan 21, 1995'
  let [month, day, year] = new Date(date).toDateString().split(' ').slice(1);
  if (day.startsWith('0')) day = day.slice(1);

  return `${month} ${day}, ${year}`;
}

function populatePosts(showExternal) {
  const postsSection = document.getElementById('posts');
  const domParser = new DOMParser();

  postsSection.innerHTML = '';
  for (const post of posts) {
    if (!showExternal && post.isExternal) {
      continue;
    }

    const post_str = `
      <a href="${post.link}">
        <h2 class="title">${post.title}</h2>
        <div class="date-location">
          <time>${post.date}</time> · <p>${post.location}</p>
        </div>
        <p class="description">${post.description}</p>
      </a>
    `.trim();

    const element = domParser.parseFromString(post_str, 'text/html').body
      .children[0];

    if (post.isExternal) {
      element.target = '_blank';
      element.relList = ['noreferrer', 'noopener'];
    }
    postsSection.append(element);
  }
}

let showExternal = JSON.parse(localStorage.getItem('showExternal') ?? 'false');
populatePosts(showExternal);

document.getElementById('external-button').addEventListener('click', () => {
  showExternal = !showExternal;
  populatePosts(showExternal);
  localStorage.setItem('showExternal', showExternal);
});

