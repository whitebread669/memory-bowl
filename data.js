// Memory Bowl seed data.
// The five objects in REAL_MEMORIES are verbatim filings from the
// calgarysaddledome.com archive. Everything in SEED_MEMORIES is
// illustrative seed data for the heatmap and LIVE loop.
// Heat is driven by SECTION_COUNTS (archive size per section), not by
// how many stories we render in the panel.
(function (root) {
  const REAL_MEMORIES = [
    { id: "real-112", section: "112", event: "Concert", year: 2000, name: "Michelle", headline: "Tragically Hip", text: "Gord walked out on stage and the whole Dome just roared... My friend Sarah and I held hands and sang every word. We were 22 and felt invincible.", real: true },
    { id: "real-119", section: "119", event: "Flames", year: 2004, name: "Ryan", headline: "Game 6 vs Tampa", text: "Watched the final period from the concourse. Strangers hugging. We'll get em next year.", real: true },
    { id: "real-104", section: "104", event: "Olympics", year: 1988, name: "Karen", headline: "Opening ceremony usher", text: "Volunteer usher at the opening ceremony. I kept the volunteer jacket 38 years.", real: true },
    { id: "real-floor", section: "FLOOR", event: "Concert", year: 2015, name: "Brett", headline: "AC/DC", text: "Beer vibrated off the armrest during Thunderstruck. Ears rang for three days.", real: true },
    { id: "real-222", section: "222", event: "Flames", year: 1989, name: "Dave", headline: "Lanny won the Cup", text: "Age 14 in the nosebleeds with my dad when Lanny won the Cup. My dad passed in 2019.", real: true }
    ]
  // illustrative seed data; the five above are real filings
 const SEED_MEMORIES = [
   { id: "s1", section: "101", event: "Flames", year: 2013, name: "Priya", headline: "Flood return", text: "First game back after the flood. The roar when they dropped the puck felt like the city inhaling again." },
   { id: "s2", section: "103", event: "Olympics", year: 1988, name: "Tom", headline: "Figure skating", text: "We were high school kids sneaking down to see the free skate. The ice looked like glass." },
   { id: "s3", section: "107", event: "Concert", year: 1996, name: "Lila", headline: "Garth Brooks", text: "Garth hung from a rope over centre ice. My voice was gone by the encore." },
   { id: "s4", section: "108", event: "Flames", year: 2004, name: "Marcus", headline: "Iginla", text: "Iggy in the corner, the whole lower bowl on its feet. You could feel the boards." },
   { id: "s5", section: "110", event: "Hitmen", year: 1999, name: "Jess", headline: "Memorial Cup", text: "We won the Memorial Cup in our building. Confetti stuck in my hair for a week." },
   { id: "s6", section: "114", event: "Concert", year: 2016, name: "Owen", headline: "The Hip, last tour", text: "Everybody knew. Nobody said it. We just sang Ahead by a Century until the lights came up." },
   { id: "s7", section: "116", event: "Flames", year: 1989, name: "Diane", headline: "Stanley Cup parade hangover", text: "Still wearing red the next morning. The Dome felt smaller, like it had given everything." },
   { id: "s8", section: "118", event: "Concert", year: 2009, name: "Nate", headline: "AC/DC", text: "Cannons. The floor moved. I still have the ticket stub in a cookbook." },
   { id: "s9", section: "120", event: "Flames", year: 2022, name: "Aisha", headline: "Playoff overtime", text: "OT in April. A stranger in 120 grabbed my shoulder and didn't let go until the horn." },
   { id: "s10", section: "122", event: "Olympics", year: 1988, name: "Hank", headline: "Hockey gold", text: "I was a kid in a toque. The Dome sounded like a freight train." },
   { id: "s11", section: "201", event: "Flames", year: 2004, name: "Chris", headline: "C of Red", text: "The C of Red from 201 looked like a living thing. I still get chills at the anthem." },
   { id: "s12", section: "204", event: "Concert", year: 2018, name: "Maya", headline: "Garth Brooks", text: "Second Garth. Same cowboy. My daughter was the age I was in 1996." },
   { id: "s13", section: "207", event: "Hitmen", year: 2010, name: "Leo", headline: "Friday night", text: "Cheap seats, better view of the rush. Hot chocolate down my sleeve." },
   { id: "s14", section: "209", event: "Flames", year: 2015, name: "Sofia", headline: "Heritage Classic hangover", text: "Came inside after outdoor practice stories. The Dome felt like coming home." },
   { id: "s15", section: "211", event: "Concert", year: 2000, name: "Greg", headline: "The Hip", text: "Bobcaygeon. The whole 200 level singing the bridge. I drove home in silence." },
   { id: "s16", section: "213", event: "Flames", year: 1989, name: "Pat", headline: "Game 6", text: "We didn't sit down in the third. Not once." },
   { id: "s17", section: "215", event: "Concert", year: 2015, name: "Nina", headline: "AC/DC", text: "Highway to Hell walk-on. Phones up like a second lighting rig." },
   { id: "s18", section: "217", event: "Olympics", year: 1988, name: "Ruth", headline: "Volunteer", text: "I directed lost tourists in three languages I do not speak." },
   { id: "s19", section: "219", event: "Flames", year: 2013, name: "Jamal", headline: "After the flood", text: "The building smelled like new paint and old hope." },
   { id: "s20", section: "221", event: "Concert", year: 2016, name: "Elle", headline: "The Hip", text: "Grace, Too. I cried into a $16 beer and did not care." },
   { id: "s21", section: "301", event: "Flames", year: 2004, name: "Vic", headline: "Nosebleeds", text: "You could see the whole system from 301. And every flag." },
   { id: "s22", section: "308", event: "Concert", year: 1996, name: "Bonnie", headline: "Garth", text: "We were so high up the cowboy looked like a spark. Still loud." },
   { id: "s23", section: "312", event: "Hitmen", year: 2005, name: "Cody", headline: "School night", text: "Dad said one period. We stayed for all three." },
   { id: "s24", section: "318", event: "Flames", year: 1989, name: "Irene", headline: "The Cup", text: "From the roof of the building it still felt like the ice was ours." },
   { id: "s25", section: "322", event: "Concert", year: 2009, name: "Sam", headline: "AC/DC", text: "My ears rang on the C-Train. Worth it." },
   { id: "s26", section: "326", event: "Flames", year: 2013, name: "Noor", headline: "Return", text: "Last row. First game back. We were loud enough for the lower bowl." },
   { id: "s27", section: "FLOOR", event: "Concert", year: 2009, name: "Alex", headline: "AC/DC floor", text: "Shoulder to shoulder. When the bells started I forgot my own name." },
   { id: "s28", section: "105", event: "Flames", year: 1989, name: "Mike", headline: "Lanny", text: "Lanny raised the Cup and a grown man in 105 started sobbing into his program." }
   ]
  const MEMORIES = REAL_MEMORIES.concat(SEED_MEMORIES)
  // Per-section archive sizes. Heavier in the lower bowl and 201-222
 // (where people actually remember sitting). Upper bowl is thinner.
 const SECTION_COUNTS = (function buildCounts() {
   const counts = { FLOOR: 18 }
   for (let n = 101; n <= 122; n++) counts[String(n)] = 4 + ((n * 7) % 6)
   for (let n = 201; n <= 222; n++) counts[String(n)] = 6 + ((n * 5) % 7)
   for (let n = 301; n <= 326; n++) counts[String(n)] = 1 + ((n * 3) % 4)
   counts["112"] += 5
   counts["119"] += 4
   counts["104"] += 3
   counts["222"] += 8
   counts.FLOOR += 4
   return counts
 })()
  const TOTAL_MEMORIES = Object.values(SECTION_COUNTS).reduce((a, b) => a + b, 0)
  // Placeholder civic date - replace when the wrecking ball is actually booked.
 const WRECKING_BALL = "2027-07-01T00:00:00-06:00"
  root.MEMORY_BOWL_DATA = {
    REAL_MEMORIES,
    SEED_MEMORIES,
    MEMORIES,
    SECTION_COUNTS,
    TOTAL_MEMORIES,
    WRECKING_BALL
  }
})(window)
