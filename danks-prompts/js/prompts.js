/**
 * DANKS PROMPTS — placeholder content
 * Replace paths, text, and add/remove entries when you have real assets.
 *
 * Before/after placeholders: assets/placeholders/ba/*.png
 */

/** Donation wallet (Ethereum) */
export const DANKS_WALLET = "0xFd6F2f52D9fC66d242a4F6f0953Ae55b98eA321d";

export const PAGE_ASSETS = {
  /** Transparent header — replace assets/GloopHeader.png then bump headerVersion */
  headerImage: "assets/GloopHeader.png",
  headerVersion: 2,
  backgroundImage: "assets/placeholders/GloopBG.png",
};

/** Featured prompt shown above the vault grid */
const ANIME_FISHEYE_PROMPT_TEXT = `Create an ultra-detailed anime illustration using the UPLOADED CHARACTER as the subject.

IMPORTANT:
• Do NOT copy the uploaded artwork directly.
• Reinterpret the uploaded character into a highly polished anime style while preserving ALL defining traits:
  - Face/head shape
  - Colors
  - Clothing
  - Accessories
  - Symbols, hats, masks, horns, markings
  - Eye design and expressions
  - Any unique character elements

STYLE:
• Modern cinematic anime illustration.
• Clean, bold linework with highly refined edges.
• Rich cel-shading mixed with soft painterly rendering.
• Vibrant colors with high contrast.
• Slightly exaggerated proportions for a stylized anime look.
• Professional key art quality.

COMPOSITION:
• Square composition (1:1).
• Extreme low-angle worm's-eye perspective.
• Camera positioned directly on the ground.
• Character crouching over the camera.
• One fist extended toward the lens in an aggressive foreshortened pose.
• Fist should dominate the foreground and appear massive.
• Feet positioned near the bottom corners of the frame.
• Character looking directly down toward the camera.

LENS:
• Ultra-wide 10mm fisheye lens effect.
• Strong perspective distortion.
• Buildings and power lines bending toward the edges of the frame.
• Dramatic sense of scale.

ENVIRONMENT:
• Busy Japanese city street.
• Narrow alley lined with shops and signs.
• Utility poles and power lines overhead.
• Bright blue sky with soft white clouds.
• Small pedestrians in the distance for scale.

LIGHTING:
• Midday sunlight.
• Bright, crisp shadows.
• Warm sunlight bouncing from the street.
• Subtle rim lighting around the character.

CLOTHING:
• Modern streetwear adapted from the uploaded character.
• Loose cargo pants or baggy pants.
• Skate-style sneakers inspired by early Nike SB Janoski silhouettes.
• Clothing should naturally match the character's color palette.

DETAILS:
• Keep the uploaded character's personality and identity completely recognizable.
• Preserve all signature traits.
• Make the character feel gigantic and imposing due to the camera angle.
• Add subtle environmental reflections and atmospheric depth.

FINAL RESULT:
A cinematic, highly detailed anime poster of the uploaded character towering above the viewer in a dramatic fisheye street scene, with bold linework, dynamic perspective, and professional anime key-art rendering.`;

export const FEATURED_PROMPT = {
  id: "anime-fisheye-street",
  title: "Anime Fisheye Street",
  category: "Featured",
  description:
    "Reinterpret your character as cinematic anime key art — dramatic worm's-eye fisheye on a Japanese city street.",
  beforeImage: "assets/DankSamuraiBefore.png",
  afterImage: "assets/AfterAnimePrompt.png",
  promptText: ANIME_FISHEYE_PROMPT_TEXT,
};

export const VAULT_PROMPTS = [
  {
    id: "water-reflection-duality",
    title: "Water Reflection Duality",
    category: "Scene",
    description:
      "Two characters divided by water — one above, one reflected below. Manga-cover mood, identity and inner conflict.",
    beforeImage: "assets/DankSamuraiBefore.png",
    afterImage: "assets/DankSamuraiReflectionAfter.png",
    promptText: `Use the uploaded images as character references.

The FIRST uploaded character becomes the character above the water.

The SECOND uploaded character becomes the reflection character below the water.

Preserve all character traits exactly:

head shape
eyes
facial features
clothing
colors
accessories
symbols
proportions
expression

IMPORTANT:

Do NOT create a realistic image.

Do NOT create a 3D render.

Do NOT create a cinematic movie poster.

Do NOT create photorealism.

Create the image in the style of a modern Japanese anime illustration.

Match the composition style of contemporary manga cover art and Japanese character posters.

Scene:

The top character sits above the water in a contemplative pose.

One hand reaches toward the water surface.

The reflection below is a completely different character created from the second uploaded reference.

The reflection occupies most of the lower half of the image.

The water acts as a symbolic divide between the two characters.

Composition:

tall vertical poster format
centered character
large negative space
simple background
reflection perfectly aligned beneath the top character
dramatic symmetry

Art Style:

anime illustration
painterly shading
clean linework
stylized anatomy
graphic composition
subtle smoke effects
contemporary Japanese illustration
manga cover aesthetic
character-focused artwork
minimal environmental details
soft gradients
emotional visual storytelling

Background:

Deep burgundy to black gradient.

Subtle circular water ripples.

Thin smoke trails drifting upward.

Mood:

Melancholic.

Introspective.

Psychological.

Dreamlike.

The image should feel like a manga volume cover exploring duality, identity, or inner conflict.`,
  },
  {
    id: "peaceful-night-camp",
    title: "Peaceful Night Camp",
    category: "Scene",
    description:
      "A cozy nighttime moment from your character's world — dreamy storybook lighting, uplifting quote, and a hidden GORGEZ Easter egg.",
    beforeImage: "assets/DankSamuraiBefore.png",
    afterImage: "assets/DankSamuraiCampingAfter.png",
    promptText: `Transform the uploaded character into a peaceful, emotional nighttime illustration while preserving all original character traits exactly (face, colors, clothing, accessories, symbols, proportions, and identity).

Create a unique scene inspired by the character's design, colors, personality, and overall vibe. The environment, lighting, mood, and composition should feel like a natural extension of the character's world and should be different each time.

Include a short handwritten positive quote generated specifically for the scene. The quote should be simple, uplifting, and emotionally fitting, such as encouragement, hope, perseverance, peace, friendship, or self-belief. Generate a different quote every time.

Hide a subtle "GORGEZ" Easter egg somewhere in the artwork that is small, clever, and easy to miss on first viewing.

Dreamy storybook atmosphere, painterly lighting, cinematic composition, soft glow, rich shadows, floating particles, highly detailed digital painting, cozy emotional vibe.

No character redesigns. No altered traits. No extra limbs. The final image should feel like a comforting moment captured from the character's own universe.`,
  },
  {
    id: "gloop-beast-mode",
    title: "Gloop Beast Mode",
    category: "Character",
    description: "Unleash a wild gloop beast version of your character.",
    beforeImage: "assets/placeholders/ba/gloop-beast-before.png",
    afterImage: "assets/placeholders/ba/gloop-beast-after.png",
    promptText:
      "[PLACEHOLDER] Reimagine the character as a powerful gloop beast with exaggerated muscles, slime fur, glowing veins, and fierce expression. Moody atmosphere, neon rim light.",
  },
  {
    id: "cyber-toon-upgrade",
    title: "Cyber Toon Upgrade",
    category: "Style",
    description: "Cartoon meets cyberpunk — bold outlines and holographic flair.",
    beforeImage: "assets/placeholders/ba/cyber-toon-before.png",
    afterImage: "assets/placeholders/ba/cyber-toon-after.png",
    promptText:
      "[PLACEHOLDER] Upgrade to a cyber-toon style: thick ink outlines, holographic UI accents, saturated colors, retro-future city bokeh background.",
  },
  {
    id: "dreamy-background-blast",
    title: "Dreamy Background Blast",
    category: "Background",
    description: "Swap boring backgrounds for dreamy gloop skies.",
    beforeImage: "assets/placeholders/ba/dreamy-bg-before.png",
    afterImage: "assets/placeholders/ba/dreamy-bg-after.png",
    promptText:
      "[PLACEHOLDER] Replace background with a dreamy gloop sky: floating bubbles, soft gradients, aurora slime clouds, keep subject sharp in foreground.",
  },
  {
    id: "nft-glow-up",
    title: "NFT Glow-Up",
    category: "NFT",
    description: "Give your PFP a premium collector-grade glow-up.",
    beforeImage: "assets/placeholders/ba/nft-glow-before.png",
    afterImage: "assets/placeholders/ba/nft-glow-after.png",
    promptText:
      "[PLACEHOLDER] Premium NFT glow-up: enhanced lighting, sharper details, subtle animated-feel highlights, collector card framing, no identity change.",
  },
  {
    id: "action-scene-builder",
    title: "Action Scene Builder",
    category: "Scene",
    description: "Drop your character into a high-energy action moment.",
    beforeImage: "assets/placeholders/ba/action-scene-before.png",
    afterImage: "assets/placeholders/ba/action-scene-after.png",
    promptText:
      "[PLACEHOLDER] Place character in dynamic action scene: motion blur accents, debris, dramatic angle, cinematic color grade, gloop energy effects.",
  },
  {
    id: "retro-arcade-remix",
    title: "Retro Arcade Remix",
    category: "Retro",
    description: "Pixel-arcade vibes with a modern gloop twist.",
    beforeImage: "assets/placeholders/ba/retro-arcade-before.png",
    afterImage: "assets/placeholders/ba/retro-arcade-after.png",
    promptText:
      "[PLACEHOLDER] Retro arcade remix: 16-bit pixel art style with modern neon gloop overlays, arcade cabinet glow, scanline texture, vibrant palette.",
  },
];

export const COMMUNITY_CREATIONS = [
  {
    id: "cc-1",
    image: "assets/placeholders/ba/gloop-beast-after.png",
    creator: "@creator",
    promptUsed: "Gloop Beast Mode",
  },
  {
    id: "cc-2",
    image: "assets/placeholders/ba/cyber-toon-after.png",
    creator: "@gloopfan",
    promptUsed: "Cyber Toon Upgrade",
  },
  {
    id: "cc-3",
    image: "assets/placeholders/ba/nft-glow-after.png",
    creator: "@nftartist",
    promptUsed: "NFT Glow-Up",
  },
  {
    id: "cc-4",
    image: "assets/placeholders/ba/dreamy-bg-after.png",
    creator: "@slimedrop",
    promptUsed: "Dreamy Background Blast",
  },
];

export function getAllPrompts() {
  return [FEATURED_PROMPT, ...VAULT_PROMPTS];
}
