/**
 * Little Ollie Club — content data (edit here to add real items later)
 */
window.LoClubContent = {
  rooms: [
    {
      id: "library",
      icon: "📚",
      title: "Library",
      description: "Discover Little Ollie stories and explore a growing collection of books.",
      cta: "Visit the Library",
      href: "#club-library",
      tone: "sky",
    },
    {
      id: "activities",
      icon: "🎨",
      title: "Activity Corner",
      description: "Enjoy colouring pages, creative challenges, puzzles and printable activities.",
      cta: "Explore Activities",
      href: "#club-activities",
      tone: "sun",
    },
    {
      id: "games",
      icon: "🎮",
      title: "Games Room",
      description: "Play simple games designed to make learning, creativity and practice more enjoyable.",
      cta: "Discover Games",
      href: "#club-games",
      tone: "mint",
    },
    {
      id: "news",
      icon: "📣",
      title: "Clubhouse News",
      description: "See what is being created behind the scenes and discover what is coming next.",
      cta: "See Club News",
      href: "#club-news",
      tone: "lavender",
    },
  ],

  bookTags: ["Rhyming Story", "Creativity", "Courage", "Family Reading"],

  /** Reusable library spotlight entries — duplicate this shape for each new book */
  librarySpotlights: [
    {
      slug: "the-spark-inside",
      title: "Little Ollie: The Spark Inside",
      thumbLabel: "Spark Inside",
      eyebrow: "Ready to read in the Club library",
      descriptionLead:
        "Believe in the little spark inside you.",
      description:
        "Little Ollie and the Spark Inside is a rhyming picture book about curiosity, courage, creativity and finding the special spark that makes you, you.",
      about:
        "Follow Little Ollie as he discovers that the little spark inside him can grow into something wonderful. Through playful rhyme and warm illustrations, this story encourages children to explore, imagine and believe in themselves.",
      aboutExtended:
        "Perfect for bedtime reading, classroom story time, or quiet moments together at home. Little Ollie gently explores themes of creativity, resilience and self-belief in a way young children can understand and enjoy.\n\nParents and carers will love the positive message. Children will love the colourful world, friendly characters and the idea that everyone carries a spark worth celebrating.",
      cover: "../webpageassets/BookCover.jpg",
      readerUrl: "library/the-spark-inside/",
      status: "Available Now",
      statusType: "available",
      tags: ["Rhyming Story", "Creativity", "Courage", "Family Reading"],
      amazonUrl:
        "https://www.amazon.com.au/Little-Ollie-Spark-Inside-Creativity/dp/B0H7MPSM1N",
    },
  ],

  featuredBook: {
    slug: "the-spark-inside",
    title: "Little Ollie: The Spark Inside",
    description:
      "A rhyming picture book about curiosity, courage, creativity and believing in the little spark inside you.",
    cover: "../webpageassets/BookCover.jpg",
    readerUrl: "library/the-spark-inside/",
    status: "Available Now",
    amazonUrl:
      "https://www.amazon.com.au/Little-Ollie-Spark-Inside-Creativity/dp/B0H7MPSM1N",
  },

  futureBooks: [
    {
      slug: "future-adventure-1",
      title: "A New Adventure Is Coming",
      status: "Coming Soon",
      statusType: "soon",
      tone: "peach",
      description: "A brand-new Little Ollie story is being written for the Club library.",
    },
    {
      slug: "future-adventure-2",
      title: "A New Adventure Is Coming",
      status: "In Development",
      statusType: "soon",
      tone: "aqua",
      description: "Another Little Ollie tale is taking shape behind the scenes.",
    },
    {
      slug: "future-adventure-3",
      title: "A New Adventure Is Coming",
      status: "Future Story",
      statusType: "soon",
      tone: "rose",
      description: "More stories, adventures and positive lessons are on the way.",
    },
    {
      slug: "future-adventure-4",
      title: "A New Adventure Is Coming",
      status: "Coming Soon",
      statusType: "soon",
      tone: "leaf",
      description: "Keep an eye on the shelf. Something new will land here soon.",
    },
    {
      slug: "future-adventure-5",
      title: "A New Adventure Is Coming",
      status: "Future Story",
      statusType: "soon",
      tone: "sand",
      description: "Another heartwarming Little Ollie story is on its way to the shelf.",
    },
  ],

  activities: [
    {
      icon: "🖍️",
      title: "Colour With Little Ollie",
      description: "Printable colouring pages featuring Little Ollie and friends.",
      status: "Coming Soon",
    },
    {
      icon: "✨",
      title: "Draw Your Spark",
      description: "Create a picture showing what your own special spark might look like.",
      status: "Coming Soon",
    },
    {
      icon: "🔤",
      title: "Little Ollie Word Search",
      description: "Find words connected to kindness, courage, creativity and friendship.",
      status: "Coming Soon",
    },
    {
      icon: "🧑‍🎨",
      title: "Create Your Own Character",
      description: "Use your imagination to design a brand-new character for the Little Ollie World.",
      status: "Coming Soon",
    },
    {
      icon: "🌀",
      title: "Maze Adventure",
      description: "Help Little Ollie find his way through a fun and family-friendly maze.",
      status: "Coming Soon",
    },
    {
      icon: "🏅",
      title: "My Achievement Certificate",
      description: "A printable certificate for reading, creating, learning or trying something new.",
      status: "Coming Soon",
    },
  ],

  games: [
    {
      icon: "⌨️",
      title: "Little Ollie Typing Adventure",
      description: "Practise typing while helping Little Ollie complete fun challenges and adventures.",
      status: "In Development",
      featured: true,
    },
    {
      icon: "🧩",
      title: "Memory Match",
      description: "Match Little Ollie characters, objects and symbols while building concentration.",
      status: "Coming Soon",
    },
    {
      icon: "📝",
      title: "Word Builder",
      description: "Build words, practise spelling and unlock cheerful Little Ollie rewards.",
      status: "Coming Soon",
    },
    {
      icon: "📖",
      title: "Story Creator",
      description: "Choose characters, places and ideas to create your own Little Ollie-style adventure.",
      status: "Future Idea",
    },
    {
      icon: "💛",
      title: "Kindness Challenge",
      description: "Complete small real-world challenges based on kindness, courage and helping others.",
      status: "Coming Soon",
    },
    {
      icon: "🧠",
      title: "Puzzle Corner",
      description: "Solve child-friendly puzzles, patterns and creative thinking challenges.",
      status: "Coming Soon",
    },
  ],

  updates: [
    {
      tag: "Latest Update",
      title: "Building the Little Ollie Club",
      copy: "We are creating a new digital home for stories, activities, games and family-friendly adventures.",
    },
    {
      tag: "What We Are Building",
      title: "New Stories Are Growing",
      copy: "More Little Ollie books and characters are being planned as the world continues to expand.",
    },
    {
      tag: "Behind the Scenes",
      title: "Little Ollie Labs",
      copy: "We are experimenting with games, creative tools and learning experiences for children and communities.",
    },
    {
      tag: "From Dad and Ollie",
      title: "Created by a Real Family",
      copy: "Little Ollie World began as a father-and-son journey and is continuing to grow with the whole family.",
    },
  ],

  trustCards: [
    {
      icon: "🌟",
      title: "Positive Experiences",
      copy: "Content designed around kindness, courage, creativity, friendship and believing in yourself.",
    },
    {
      icon: "🏡",
      title: "Parent-Friendly",
      copy: "Clear language, simple navigation and no confusing technology required for family members.",
    },
    {
      icon: "💙",
      title: "Built With Care",
      copy: "Created thoughtfully as part of a long-term family brand, not a short-term trend.",
    },
    {
      icon: "🌱",
      title: "Growing Over Time",
      copy: "New books, activities and games can be added as Little Ollie World continues to develop.",
    },
  ],
};
