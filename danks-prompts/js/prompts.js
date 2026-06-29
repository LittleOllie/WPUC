/**
 * DANKS PROMPTS — placeholder content
 * Replace paths, text, and add/remove entries here when you have real assets.
 */

/** Donation wallet (Ethereum) */
export const DANKS_WALLET = "0x383163566df884ba3ab68d6cb7d4ee30f80a05c8";

/**
 * REPLACE LATER: hero title/header image
 * Set `headerImage` to your real title art path, e.g. "assets/danks-prompts-title.png"
 */
export const PAGE_ASSETS = {
  headerImage: "assets/GloopHeader.png",
  backgroundImage: "assets/placeholders/GloopBG.png",
};

/** Featured prompt shown above the vault grid */
export const FEATURED_PROMPT = {
  id: "featured-gloop-lab-special",
  title: "Gloop Lab Special",
  category: "Featured",
  description:
    "Danks' signature gloop transformation — turn any character into a neon slime masterpiece.",
  // REPLACE LATER: swap for real before/after image paths
  beforeImage: "assets/placeholders/before.svg",
  afterImage: "assets/placeholders/after.svg",
  // REPLACE LATER: paste the real prompt text
  promptText:
    "[PLACEHOLDER] Transform the subject into a hyper-detailed gloop creature with neon slime textures, dripping highlights, and a dark lab background. Keep the original pose and silhouette recognizable. Cinematic lighting, wet surface reflections, vibrant green and cyan accents, 8k detail.",
};

/**
 * Prompt vault — edit this array to add real prompts.
 * Each entry needs: id, title, category, description, beforeImage, afterImage, promptText
 */
export const VAULT_PROMPTS = [
  {
    id: "gloop-beast-mode",
    title: "Gloop Beast Mode",
    category: "Character",
    description: "Unleash a wild gloop beast version of your character.",
    beforeImage: "assets/placeholders/before.svg",
    afterImage: "assets/placeholders/after.svg",
    promptText:
      "[PLACEHOLDER] Reimagine the character as a powerful gloop beast with exaggerated muscles, slime fur, glowing veins, and fierce expression. Moody atmosphere, neon rim light.",
  },
  {
    id: "cyber-toon-upgrade",
    title: "Cyber Toon Upgrade",
    category: "Style",
    description: "Cartoon meets cyberpunk — bold outlines and holographic flair.",
    beforeImage: "assets/placeholders/before.svg",
    afterImage: "assets/placeholders/after.svg",
    promptText:
      "[PLACEHOLDER] Upgrade to a cyber-toon style: thick ink outlines, holographic UI accents, saturated colors, retro-future city bokeh background.",
  },
  {
    id: "dreamy-background-blast",
    title: "Dreamy Background Blast",
    category: "Background",
    description: "Swap boring backgrounds for dreamy gloop skies.",
    beforeImage: "assets/placeholders/before.svg",
    afterImage: "assets/placeholders/after.svg",
    promptText:
      "[PLACEHOLDER] Replace background with a dreamy gloop sky: floating bubbles, soft gradients, aurora slime clouds, keep subject sharp in foreground.",
  },
  {
    id: "nft-glow-up",
    title: "NFT Glow-Up",
    category: "NFT",
    description: "Give your PFP a premium collector-grade glow-up.",
    beforeImage: "assets/placeholders/before.svg",
    afterImage: "assets/placeholders/after.svg",
    promptText:
      "[PLACEHOLDER] Premium NFT glow-up: enhanced lighting, sharper details, subtle animated-feel highlights, collector card framing, no identity change.",
  },
  {
    id: "action-scene-builder",
    title: "Action Scene Builder",
    category: "Scene",
    description: "Drop your character into a high-energy action moment.",
    beforeImage: "assets/placeholders/before.svg",
    afterImage: "assets/placeholders/after.svg",
    promptText:
      "[PLACEHOLDER] Place character in dynamic action scene: motion blur accents, debris, dramatic angle, cinematic color grade, gloop energy effects.",
  },
  {
    id: "retro-arcade-remix",
    title: "Retro Arcade Remix",
    category: "Retro",
    description: "Pixel-arcade vibes with a modern gloop twist.",
    beforeImage: "assets/placeholders/before.svg",
    afterImage: "assets/placeholders/after.svg",
    promptText:
      "[PLACEHOLDER] Retro arcade remix: 16-bit pixel art style with modern neon gloop overlays, arcade cabinet glow, scanline texture, vibrant palette.",
  },
];

/**
 * Community creations gallery — replace with real examples later.
 * Each: image, creator, promptUsed
 */
export const COMMUNITY_CREATIONS = [
  {
    id: "cc-1",
    image: "assets/placeholders/after.svg",
    creator: "@creator",
    promptUsed: "Gloop Beast Mode",
  },
  {
    id: "cc-2",
    image: "assets/placeholders/after.svg",
    creator: "@gloopfan",
    promptUsed: "Cyber Toon Upgrade",
  },
  {
    id: "cc-3",
    image: "assets/placeholders/after.svg",
    creator: "@nftartist",
    promptUsed: "NFT Glow-Up",
  },
  {
    id: "cc-4",
    image: "assets/placeholders/after.svg",
    creator: "@slimedrop",
    promptUsed: "Dreamy Background Blast",
  },
];

/** All browsable prompts (featured + vault) for random picker */
export function getAllPrompts() {
  return [FEATURED_PROMPT, ...VAULT_PROMPTS];
}
