# The Nervous System Field Manual — Website

Landing page for *The Nervous System Field Manual: A Corpsman's Guide to the War Within* by Bobby L. Harris, published under the **Battlefield Essentials** brand.

Built with Node.js + Express + EJS. Vanilla CSS, no build step.

## Setup

```bash
npm install
npm start
```

Then open <http://localhost:3000>.

For live-reload during development:

```bash
npm run dev
```

## Structure

```
nsfm-website/
├── server.js              Express server
├── package.json
├── public/
│   ├── css/styles.css     All styling (brand tokens + layout)
│   ├── js/main.js         Mobile nav + scroll reveals
│   └── images/            Placeholder asset folder
└── views/
    ├── index.ejs          Landing page (all 11 sections)
    └── partials/
        ├── header.ejs      <head>, fonts, sticky nav
        └── footer.ejs      Footer + crisis line + scripts
```

## Sections

Hero · Authority Bar · The North Star · Letter from Bobby · Six Pillars ·
Seven Tools · Who This Is For · Deliverables · Pricing · Crisis Notice · Footer

## Notes

- Book cover and any imagery are styled placeholder `div` elements — drop real assets into `public/images/` and wire them up when available.
- Pricing is placeholder: **$27** digital / **$34** print.
- The Veterans Crisis Line (dial **988**, press **1**, or text **838255**) appears in both the crisis notice and the footer.

---

Battlefield Essentials — *Forged by Discipline.*
