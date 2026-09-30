# Hero House · Wooster Website Concept

A hand-coded, static concept site for Hero House at 141 N. Bever St. in Wooster, Ohio. It is a prospecting preview, not an official business website.

## Features

- Mobile-first layout with sticky navigation and fixed mobile call/directions actions.
- Text-based searchable menu with category filters, sandwich-size pricing, and shareable query-string state.
- Print-friendly full menu.
- Local-time open/closed indicator for Eastern Time.
- Direct phone, Facebook, and Google Maps links.
- Accessible landmarks, skip link, visible focus, reduced-motion support, semantic menu content, and no-JavaScript fallback.
- Custom SVG illustrations and social card; no stock or AI-generated food photography.
- GitHub Pages deployment workflow in `.github/workflows/pages.yml`.

## Research notes and source of truth

Primary source: [Hero House on Facebook](https://www.facebook.com/p/Hero-House-61589136044433/).

- The page describes the new owners as keeping the same recipes and products.
- The page cover and current menu art say “Since 1975.” The shop’s 2025 local-news feature also describes its 1975 founding and history around cheesesteaks and meatball subs: [Yahoo / The Daily Record feature](https://www.yahoo.com/lifestyle/hero-house-hero-house-rides-090213672.html).
- A recent Facebook update says the shop is open Tuesday–Saturday, 11 a.m.–9 p.m. The Facebook menu image posted Aug. 3, 2026 lists an older Sunday schedule, so the concept uses the more recent schedule and flags hours for owner review.
- The Aug. 3, 2026 Facebook menu image lists 7½-, 10-, and 15-inch hero sizes, plus steak sandwiches, salads, sides, and drinks. The Facebook photo is labeled “AI content”; descriptions and prices here are included as a draft transcription and must be checked against the current in-store menu.
- The menu lists 141 N. Bever St., Wooster, OH 44691 and (330) 804-0180. Older directory listings show a different phone number; this concept uses the number on the current Facebook menu.
- Facebook comments ask for several older menu items. The concept only includes items visible on the Aug. 3 menu image and avoids claiming those requested items are currently available.
- The latest Facebook page provides a direct message/contact action, but no current checkout or verified online ordering provider. The site therefore offers call-to-order and directions, not a fake cart or checkout.

Before handing over the site, confirm the full menu, prices, current hours, and phone number with the owners. Replace the vector illustration with owner-approved food and storefront photography if available. The preview has `noindex, nofollow` and a visible concept label; remove those only after the owners approve an official launch. Then set an absolute canonical/OG image URL and add `Restaurant` structured data with the verified hours, address, and phone.

## Publish with GitHub Pages

The repository workflow deploys the site from its root on every push to `main`. The GitHub Pages project URL is:

```text
https://quickerflipperupper.github.io/hero-house-wooster/
```
