document.addEventListener('DOMContentLoaded', () => {
  setClickCodeToCopy();
  setClickHeadingCopyAndSetIdLink();
});

// Click codeblock to copy.
function setClickCodeToCopy() {
  const key = 'data-copy';
  const success = 'Copied';
  for (const el of document.querySelectorAll('pre.sourceCode')) {
    el.setAttribute(key, 'Copy');

    el.addEventListener('click', () => {
      if (!navigator.clipboard) {
        return;
      }

      navigator.clipboard.writeText(el.innerText);
      const c = el.getAttribute(key);
      el.setAttribute(key, success);
      if (c !== success) {
        setTimeout(() => el.setAttribute('data-copy', c), 1000);
      }
    });
  }
}

// Click to copy and set id link.
function setClickHeadingCopyAndSetIdLink() {
  const hs = [
    [...document.getElementsByTagName('h1')],
    [...document.getElementsByTagName('h2')],
    [...document.getElementsByTagName('h3')],
  ].flat();
  for (const h of hs) {
    h.addEventListener('click', (event) => {
      const id = event.target.id;
      if (!id || !navigator.clipboard) {
        return;
      }

      const url = window.location.href.split[0];
      const targetUrl = [url, id].join('#');

      navigator.clipboard.writeText(targetUrl);
      window.location.href = targetUrl;
    });
  }
}
