# FoodTruck Slot Game - Design Brainstorming

## Approach 1: Neo-Brutalist Street Food Aesthetic

<response>
<text>
**Design Movement**: Neo-Brutalism meets Street Culture

**Core Principles**:
- Raw, unapologetic geometry with thick borders and stark contrasts
- Asymmetric layouts that feel hand-placed rather than grid-aligned
- Bold, in-your-face typography that demands attention
- Monochromatic base with explosive accent colors for game events

**Color Philosophy**: 
Foundation of deep charcoal (#1a1a1a) and crisp white (#ffffff) creates maximum contrast. Accent explosions use saturated food colors—ketchup red (#ff3838), mustard yellow (#ffd700), pickle green (#00ff88)—that only appear during wins, orders, and special events. This restraint makes every color pop feel earned and exciting.

**Layout Paradigm**: 
Diagonal-cut sections and overlapping panels break the traditional centered slot layout. The game board sits slightly off-center, with UI controls scattered asymmetrically around it like food truck menu boards. Heavy black borders (8-12px) define zones with brutal clarity.

**Signature Elements**:
- Chunky, hand-drawn style borders around all game elements
- Halftone dot patterns as textures on backgrounds
- Torn paper edges for order tickets and win notifications

**Interaction Philosophy**: 
Interactions feel physical and immediate—buttons have exaggerated hover states with border shifts, symbols drop with bounce physics that feel weighty, cascades trigger screen shake effects. Every action has tactile feedback.

**Animation**:
Symbols fall with elastic easing and slight rotation. Winning combinations explode outward with particle bursts. Order tickets slide in from screen edges with spring physics. Free spin mode triggers a full-screen color inversion flash before starting.

**Typography System**:
- Display: Space Grotesk Bold (900) for headings and big numbers
- UI: IBM Plex Mono Medium (500) for controls and labels
- Body: Inter Regular (400) for small text
- All caps for emphasis, tight letter-spacing (-0.05em) for density
</text>
<probability>0.08</probability>
</response>

## Approach 2: Retro Diner Neon Glow

<response>
<text>
**Design Movement**: 1950s Americana with Cyberpunk Neon Overlay

**Core Principles**:
- Curved, organic shapes reminiscent of vintage diner signage
- Glowing neon effects on dark backgrounds
- Retro-futuristic color palette mixing pastels with electric brights
- Smooth, flowing animations that feel analog rather than digital

**Color Philosophy**:
Deep midnight blue (#0a0e27) base creates a nighttime street scene. Neon accents in hot pink (#ff006e), electric cyan (#00f5ff), and lime green (#ccff00) glow against the darkness. Warm amber (#ffb627) highlights active elements. The palette evokes both classic diner signs and modern cyberpunk aesthetics, creating nostalgic futurism.

**Layout Paradigm**:
Circular and curved elements dominate—the game board has rounded corners with glowing edges, UI buttons are pill-shaped, and decorative elements use arcs and waves. Layout follows a centered composition but with asymmetric decorative flourishes radiating outward like neon tube bending.

**Signature Elements**:
- CSS glow effects (box-shadow with multiple layers) on all interactive elements
- Scanline overlay texture across the entire viewport
- Animated neon flicker effects on win states
- Gradient borders that shift hue during gameplay

**Interaction Philosophy**:
Smooth, buttery animations create a dreamlike quality. Hovers trigger gentle glow intensification. Spins feel like pulling a vintage slot machine lever—deliberate and satisfying. Wins pulse with rhythmic neon breathing effects.

**Animation**:
Symbols descend with gentle sine-wave motion as if floating. Cascades trigger ripple effects that propagate outward. Order notifications materialize with a neon tube "drawing" animation. Free spins mode initiates with a full-screen neon sign flip effect.

**Typography System**:
- Display: Righteous (retro rounded sans) for main titles
- UI: Orbitron Medium for numbers and controls
- Body: Outfit Regular for descriptive text
- Neon text-shadow effects on headings: 0 0 10px color, 0 0 20px color, 0 0 30px color
</text>
<probability>0.07</probability>
</response>

## Approach 3: Minimalist Geometric Playground

<response>
<text>
**Design Movement**: Swiss Design meets Playful Modernism

**Core Principles**:
- Strict grid system with mathematical precision
- Limited color palette with strategic pops of vibrant hues
- Generous whitespace that breathes
- Geometric abstraction of food symbols into simple shapes

**Color Philosophy**:
Clean off-white (#fafaf9) background provides calm foundation. Primary palette uses desaturated earth tones—terracotta (#e07a5f), sage (#81b29a), ochre (#f2cc8f)—for sophistication. Accent color is a single vibrant coral (#ff6b6b) reserved exclusively for interactive states and wins. This restraint creates visual hierarchy through scarcity.

**Layout Paradigm**:
Strict 12-column grid with mathematical spacing (multiples of 8px). Game board centered but surrounded by asymmetric sidebar elements that align to grid. Negative space is intentional and abundant—elements never crowd. Layout feels spacious and considered.

**Signature Elements**:
- Thin hairline borders (1px) in muted grays
- Circular progress indicators for game states
- Geometric icon system where food items are abstracted to essential shapes
- Subtle gradient overlays (5-10% opacity) for depth

**Interaction Philosophy**:
Refined and understated. Micro-interactions are smooth but never flashy. Hover states shift opacity or add subtle shadows. The experience feels premium and controlled, like a luxury product interface.

**Animation**:
Symbols drop with cubic-bezier easing for smoothness. Cascades fade and scale simultaneously. Order tickets slide in with gentle deceleration. Free spins trigger a clean fade-to-white transition before revealing the bonus board. All animations run at 60fps with durations between 200-400ms.

**Typography System**:
- Display: Sora Bold (700) for headings
- UI: DM Sans Medium (500) for buttons and labels
- Body: Inter Regular (400) for text
- Generous line-height (1.6) and letter-spacing (0.02em) for readability
- Hierarchical scale: 48px / 32px / 24px / 16px / 14px
</text>
<probability>0.09</probability>
</response>

---

## Selected Approach

After evaluation, **Approach 1: Neo-Brutalist Street Food Aesthetic** will be implemented. This approach best captures the energetic, street-food vibe of a food truck while providing the bold visual impact needed for an engaging slot game experience.
