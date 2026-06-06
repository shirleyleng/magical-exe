# MAGICAL.EXE — Mascot Library

The mascot is a fusion of the player's 3 favorite animals, delivered by the helper character.
**Art is curated (from this file), not freely AI-generated** — freeform ASCII is unreliable.
The AI assigns one of these bases (by best fit to the animals), picks/sets a name, and writes
the personality/voice. Each base has a **small** (inline, day-to-day) and **large** (story
scenes) version.

## IMPORTANT: font safety

These use some Unicode beyond pure ASCII (`⩊ ૮ ა ∿ ✦ ♡` etc.). They render beautifully in some
monospace fonts and as boxes in others. **Lock your game font first, then verify each base in
that exact font.** Recommended fonts that handle most of these: JetBrains Mono, IBM Plex Mono.
If a character breaks, swap to the ASCII-only fallback set at the bottom. Store the chosen base
as `artKeySmall` / `artKeyLarge` in mascot state.

---

## Style 1 — "blob" (round, big-eyed, softest)

Best fit: round/soft animals (rabbit, hamster, seal, cat, frog, chick).

`artKeySmall: "blob_small"`
```
 ( ◜ ⩊ ◝ )
૮  -   - ა
```

`artKeyLarge: "blob_large"`
```
       ｡ ☆ ∿ ☆ ｡
     ✦              ✦
         ( ◜ ⩊ ◝ )
        ૮ -⠀  ⠀ - ა
     ✦   \   ♡   /   ✦
       ｡ ⋆  ✧  ⋆ ｡
```

---

## Style 2 — "catflick" (sitting, tail-flick, classic kawaii)

Best fit: cats, foxes, weasels, anything with a tail/ears.

`artKeySmall: "catflick_small"`
```
   ╱|、
  (˚ˎ 。7
   |、˜〵
  じしˍ,)ノ
```

`artKeyLarge: "catflick_large"`
```
          ⋆ ˚｡⋆
     .  ✦   ✧   ✦  .
        ╱|、     ⟡
       (˚ˎ 。7   ✧
        |、˜〵
    ⋆   じしˍ,)ノ   ⋆
      ✧  ｡ ⋆ ˚  ✦
```

---

## Style 3 — "peek" (peeking, paws up, big shiny eyes)

Best fit: shy/curious critters (mouse, owl, otter, raccoon, deer).

`artKeySmall: "peek_small"`
```
   ∿∿
 ( • ⩊ • )
  づ   ♡
```

`artKeyLarge: "peek_large"`
```
        ⋆ ✦ ｡ ✦ ⋆
      ✧    ∿∿    ✧
        ( • ⩊ • )
       /づ⠀ ⠀ ♡ づ\
      ✧  ｡ ⋆ ✧ ｡  ✧
```

---

## Style 4 — "bean" (tiny upright sprout-bean, very smol)

Best fit: small/cute anything (chick, hamster, frog, bunny) — the "tiny content" niche.

`artKeySmall: "bean_small"`
```
 (˶ᵔ ᵕ ᵔ˶)
```

`artKeyLarge: "bean_large"`
```
      ⋆ ｡ ✦ ｡ ⋆
    ✧ (˶ᵔ ᵕ ᵔ˶) ✧
     ｡  ⸜(   )⸝  ｡
      ⋆ ✦  ✧  ⋆
```

---

## Style 5 — "wing" (winged sprite — moth/bird/dragonfly blends)

Best fit: winged animals as the dominant trait (moth, butterfly, bird, dragonfly).

`artKeySmall: "wing_small"`
```
 ▷( • ω • )◁
```

`artKeyLarge: "wing_large"`
```
      ✦  ｡ ⋆ ｡  ✦
    ⟢ ▷( • ω • )◁ ⟣
      ✧ ｡  ⸜⸝  ｡ ✧
       ⋆  ✦  ⋆
```

---

## Style 6 — "loaf" (cat/seal/hamster "loaf" pose, content)

Best fit: round loafing animals (cat, seal, hamster, hedgehog).

`artKeySmall: "loaf_small"`
```
 ( ｡• ω •｡ )
  ▔▔▔▔▔
```

`artKeyLarge: "loaf_large"`
```
      ｡ ⋆ ✧ ⋆ ｡
    ✦  ( ｡• ω •｡ )  ✦
        ▔▔▔▔▔▔▔
      ⋆ ｡  ♡  ｡ ⋆
```

---

## Celebration pose — "star" (shared, ALL mascots)

NOT a separate mascot. This is a **shared celebratory variant** every mascot can switch to for
happy beats: tier-ups, boss wins, quest completions, the awakening reveal. Store the mascot's
normal `artKey*` as usual; when a celebration moment fires, render the star pose instead for that
beat, then return to the normal pose.

`artKeySmall: "star_small"`
```
 \( ˆoˆ )/
```

`artKeyLarge: "star_large"`
```
       ✦ ｡ ☆ ｡ ✦
     ✧  \( ˆoˆ )/  ✧
      ｡ ⋆  / \  ⋆ ｡
        ☆ ✦ ✧ ☆
```

---

## Distinguishing features (signal the animal blend)

Keep the cute base; add 1–2 accents to hint the fused animals. Swap into the base where marked:
- **Ears (cat/fox/rabbit):** `^^` or `ㅅ` above the face, or the `╱|、` tuft.
- **Wings (moth/dragonfly/bird):** flank with `▷ ◁` or `⟡` near the body.
- **Antennae (moth/bug):** `˒˒` or `ʕ` above the head.
- **Aquatic (koi/seal/otter):** `~~~~` waterline under the body, `∿` accents.
- **Beak/owl:** center the face on a small `v` (`( • v • )`).
Use sparingly — over-decorating breaks the cuteness.

---

## Mascot name list (random pick, or AI chooses to fit the animals)

Mystical / cosmos register only. **No real-earth-object names** (no Pebble, Maple, Biscuit,
etc.) — names should feel otherworldly, celestial, or made-up-cute, never mundane.

Soft / cute:
Pip, Vell, Sora, Nim, Luru, Bibi, Pippin, Yumo, Reki, Wisp,
Pero, Suki, Fae, Bubu, Pim, Roro, Pippet, Fizz, Tibbs, Yune

Cosmos / celestial:
Nova, Stella, Comet, Aster, Vesper, Halo, Astra, Auri, Celes, Soleil,
Lumi, Glim, Twinkle, Shimmer, Sprite, Mira, Vega, Lyra, Caelum, Orin

Mystical / arcane:
Tindra, Wisp, Runa, Faye, Zephyr, Nyx, Sable*, Eir, Sol, Vesta,
Selene, Ondine, Sylph, Anthe, Eos, Iri, Quill, Sprig, Faun, Lune

> `Nyx` and other slightly-shadowed names are intentionally allowed — they subtly hint that a
> corruption route exists. Keep these rare among the suggestions, not the default.
> *`Sable` is reserved as the default RIVAL name in DESIGN.md — don't auto-assign it to a mascot.

The AI may also generate a name in this register if asked; keep it 1–2 short syllables, soft or
celestial in feel, no mundane earth-object names, no harsh/edgy names (this is the cozy helper).

---

## Fusion rules (how the AI assigns a mascot)

Given the player's 3 animals:
1. Pick the **base style** whose "best fit" matches the dominant animal silhouette:
   round/soft -> blob; tailed/eared -> catflick; shy/curious -> peek; tiny/content -> bean;
   winged -> wing; round-loafing -> loaf.
2. Add **1–2 distinguishing features** from the list above representing the other two animals.
3. Set a **name** (from the mystical/cosmos list or AI-generated to fit).
4. Write a **voice/personality** blending the animals' vibes (e.g. cat+owl+fox -> "curious,
   a little smug, secretly tender"). Store as `mascot.voice`; PROMPTS.md > D uses it.
5. Store `artKeySmall` / `artKeyLarge` so render is deterministic afterward (no re-rolling art
   every turn).
6. The **star celebration pose is shared** — don't store it per mascot. On a celebratory beat
   (tier-up, boss win, quest complete, awakening reveal), temporarily render `star_small` /
   `star_large` instead of the mascot's normal pose, then revert.

---

## ASCII-only fallback set (if Unicode breaks in your font)

Pure-ASCII versions, guaranteed to render anywhere:

`blob_small_ascii`
```
 (o w o)
 ( -  - )
```

`catflick_small_ascii`
```
  /\_/\
 ( o.o )
  > ^ <
```

`peek_small_ascii`
```
  ,,,,
 ( o_o )
  c[ ]
```

`blob_large_ascii`
```
    .  *  .  *  .
       (o w o)
      ( -   - )
    *   \  v  /   *
      .  *  .  *
```
