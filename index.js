const posts = [
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
    external: 'Frappe Books Tech Blog',
    link: 'https://tech.frappebooks.com/complete_rewrite',
  },
  {
    title: 'Enabling Translations',
    date: '2022-02-17',
    description:
      "Not everyone knows English, and it is generally the least favorite language of polyglots (don't quote me on this). Suffice to say translations are important.",
    external: 'Frappe Books Tech Blog',
    link: 'https://tech.frappebooks.com/enabling_translations',
  },
  {
    title: 'Refactoring Charts',
    date: '2022-02-08',
    description:
      'I had to rewrite the charts in Frappe Books. This seemed like the only option. Well almost.',
    external: 'Frappe Books Tech Blog',
    link: 'https://tech.frappebooks.com/refactoring_charts',
  },
  {
    title: 'Mumbai University, Everyone Cheated',
    description:
      'The plot in the banner image of this post shows two histograms. These histograms substantiate the claim in the title.',
    date: '2021-06-21',
    external: 'Medium',
    link: 'https://18alan.medium.com/mumbai-university-everyone-cheated-83320b8c351a',
  },
  {
    title: 'Making A Synth With Python — Controllers',
    description:
      'Part of a series of posts on making a synthesizer using Python. This one covers controllers.',
    date: '2021-03-02',
    external: 'Medium',
    link: 'https://python.plainenglish.io/build-your-own-python-synthesizer-part-3-162796b7d351',
  },
  {
    title: 'Making A Synth With Python — Modulators',
    description:
      'Part of a series of posts on making a synthesizer using Python. This one covers modulators.',
    date: '2021-02-22',
    external: 'Medium',
    link: 'https://python.plainenglish.io/build-your-own-python-synthesizer-part-2-66396f6dad81',
  },
  {
    title: 'Making A Synth With Python — Oscillators',
    description:
      'Part of a series of posts on making a synthesizer using Python. This one covers oscillators.',
    date: '2021-02-17',
    external: 'Medium',
    link: 'https://python.plainenglish.io/making-a-synth-with-python-oscillators-2cb8e68e9c3b',
  },
].sort((a, b) => new Date(b.date).valueOf() - new Date(a.date).valueOf());

function getSlugFromTitle(title) {
  // 'Post Zero, Why?' -> 'post-zero-why'
  return title
    .toLowerCase()
    .replace('-', '')
    .replace(/\s+/g, '-')
    .replace(/[^-a-z]+/g, '');
}

function formatDate(date) {
  // '1995-01-21' -> 'Jan 21 1995'
  return new Date(date).toDateString().split(' ').slice(1).join(' ');
}

function replaceSlot(element, name, value) {
  if (!(element instanceof HTMLElement)) {
    return;
  }

  let query = `slot`;
  if (name) {
    query = `slot[name="${name}"]`;
  }

  const slot = element.querySelector(query);
  const parentElement = slot?.parentElement;
  if (!slot || !parentElement) {
    return;
  }

  parentElement.innerHTML = value;
}

function getTemplatedElement(templateId, slotContent) {
  const template = document.getElementById(templateId);
  if (!(template instanceof HTMLTemplateElement)) {
    return null;
  }

  const element = template.content.cloneNode(true)?.children?.[0];
  if (!(element instanceof HTMLElement)) {
    return null;
  }

  for (const [name, value] of Object.entries(slotContent)) {
    replaceSlot(element, name, value);
  }

  return element;
}

function fixRelative(link) {
  if (!link.startsWith('/')) {
    return link;
  }

  if (window.location.pathname) {
    return window.location.pathname + link.slice(1);
  }

  return link;
}

/*
 * Populates the section#posts element above with
 * a list of posts.
 */
const postsSection = document.getElementById('posts');
for (const post of posts) {
  const slug = getSlugFromTitle(post.title);
  const link = post.link ?? `posts/${slug}.html`;

  const date = formatDate(post.date);

  const slotContent = {
    title: post.title,
    date,
    description: post.description,
    location: '<code>/posts</code>',
  };

  if (post.external) {
    slotContent.location = post.external;
  }

  const element = getTemplatedElement('post', slotContent);
  if (!(element instanceof HTMLAnchorElement)) {
    continue;
  }

  element.href = fixRelative(link);
  if (post.external) {
    element.target = '_blank';
    element.relList = ['noreferrer', 'noopener'];
  }

  postsSection.append(element);
}
