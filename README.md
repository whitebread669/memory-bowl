# The Memory Bowl

Sit anywhere. Find a memory there.

The Cursor Calgary prompt asked to choose a boring, everyday application format and reinvent it with a dramatically more engaging visual design, user experience, or functionality. The boring format is the venue seating map. On the official Saddledome site that map is a static JPG; on my own civic archive it was anonymous dots on ellipse rings. Neither reads as a building, and neither shows that the seats are full of other people's nights. The Memory Bowl turns the same seating plan into a living memory heatmap for a building that already has a demolition date.

I run calgarysaddledome.com, the civic memory archive for the soon-to-be-demolished Saddledome. People file 43 years of concerts, Flames nights, and the 1988 Olympics to the sections they sat in. This page is the map those filings deserved: labeled wedges that glow with how many memories they hold, a wrecking-ball countdown in the header, and cards that rise out of the seats as if they were just filed.

## What it does

- A parametric SVG bowl (FLOOR, lower 101-122, loge 201-222, upper 301-326) with section numbers on the wedges so it reads as a building, not a scatter plot.
- - Heat per section from archive counts (449 in the bowl). GAME NIGHT paints crimson; CONCERT paints gold.
  - - Hover a section for an ink-on-gold tooltip; click to open a filed-archive panel of stories from that seat.
    - - Five real filings live in the HTML even with JavaScript off: Dave in SEC 222, Michelle in 112, Ryan in 119, Karen in 104, Brett on the FLOOR.
      - - LIVE mode lifts at most two archive cards out of their home sections, drifting up and fading over about 7 seconds. Front-end timer only; no network.
        - - File-yours links out to calgarysaddledome.com/memories/new?section=N.
         
          - ## What's under the hood
         
          - - generateBowlSections() in app.js draws every wedge from two concentric ellipses (x = cx + rx*cos(theta), y = cy + ry*sin(theta)), so the bowl is a building of labeled sections rather than a hand-traced path or a ring of dots.
            - - Heat interpolates ink to crimson (game) or gold (concert) by SECTION_COUNTS[id] / max, then the hottest four sections get a stacked SVG feGaussianBlur halo (tight core plus wide glow) and a 5s breath; everything else stays still.
              - - Rising cards: riseMemory() parks a filed-card at the section's SVG centroid via getScreenCTM(), then CSS @keyframes rise drifts it up 120-160px over about 7s with a slight horizontal drift, never more than two airborne.
               
                - ## Tech stack
               
                - Vanilla HTML, CSS, and JavaScript. Zero dependencies, no framework, no build step.
               
                - ## How to run
               
                - Open index.html in a browser, or from this folder run: python3 -m http.server 4174 and visit http://127.0.0.1:4174/
               
                - ## Submission description
               
                - The boring format is the venue seating map: on the official Saddledome site a static JPG, and on my own archive site a field of anonymous dots - neither of which lets you sit in the building. I run the civic memory archive for the soon-to-be-demolished Saddledome, where people file 43 years of nights to the seats that held them. The Memory Bowl is that map reinvented: labeled section wedges glow with how many memories they hold, filed cards rise out of the seats, and a wrecking-ball countdown runs while you sit anywhere and find a memory there.
               
                - Educational civic demo. Not affiliated with the Scotiabank Saddledome.
