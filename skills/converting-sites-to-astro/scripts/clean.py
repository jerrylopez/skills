# Strip crawled HTML down to readable structure for reading page content and DOM.
# usage: uv run --with beautifulsoup4 --with lxml python clean.py <origin>
# Reads $WORK/raw/*.html, writes $WORK/clean/*.html: body only, no scripts/styles/comments,
# SVG path data and responsive image attributes removed, origin stripped from URLs.
import os, re, sys
from bs4 import BeautifulSoup, Comment

origin = sys.argv[1].rstrip('/')
work = os.environ.get('WORK', '/tmp/site')
src, out = f'{work}/raw', f'{work}/clean'
os.makedirs(out, exist_ok=True)
host = re.escape(re.sub(r'^https?://(www\.)?', '', origin))
for f in sorted(os.listdir(src)):
    soup = BeautifulSoup(open(os.path.join(src, f), encoding='utf-8', errors='replace').read(), 'lxml')
    body = soup.body
    if body is None:
        continue
    for t in body.find_all(['script', 'noscript', 'style']):
        t.decompose()
    for c in body.find_all(string=lambda s: isinstance(s, Comment)):
        c.extract()
    for svg in body.find_all('svg'):
        for p in svg.find_all(True):
            p.attrs = {k: v for k, v in p.attrs.items() if k not in ('d', 'points')}
    for img in body.find_all('img'):
        for a in ('srcset', 'sizes', 'decoding', 'loading', 'fetchpriority'):
            img.attrs.pop(a, None)
    html = re.sub(rf'https?://(www\.)?{host}', '', body.prettify())
    open(os.path.join(out, f), 'w', encoding='utf-8').write(html)
    print(f, len(html))
