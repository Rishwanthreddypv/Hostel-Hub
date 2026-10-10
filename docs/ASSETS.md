# Assets

The hostel names, property descriptions, addresses and ownership verification in the seed are fictional examples. Photographs are illustrative and do not document these properties. The banner identifies the site as a college-project demo.

## Photography

Downloaded from Unsplash's image CDN using `scripts/download-images.py`; URLs and photo IDs are recorded there. [Unsplash license](https://unsplash.com/license).

| Local file | Source photo ID |
| --- | --- |
| hero.jpg | photo-1600210492486-724fe5c67fb0 |
| room-1.jpg | photo-1522708323590-d24dbb6b0267 |
| room-2.jpg | photo-1611892440504-42a792e24d32 |
| room-3.jpg | photo-1555854877-bab0e564b8d5 |
| room-4.jpg | photo-1540518614846-7eded433c457 |
| room-5.jpg | photo-1566665797739-1674de7a421a |
| room-6.jpg | photo-1560448204-e02f11c3d0e2 |
| room-7.jpg | photo-1505693416388-ac5ce068fe85 |
| lounge.jpg | photo-1600607687939-ce8a6c25118c |

## Type and icons

DM Sans and Manrope variable fonts are bundled from the Google Fonts repository, with their SIL Open Font License files in `public/fonts/`. Lucide icons are supplied by the `lucide-react` package. No external font request is needed at runtime.

## Maps

Leaflet renders OpenStreetMap standard tiles with visible attribution. Tile access requires an internet connection; local listing data and the rest of the app do not depend on tiles loading. Review the map provider's usage policy before any high-traffic deployment.
