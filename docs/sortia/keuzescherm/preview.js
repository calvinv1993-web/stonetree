// Standalone demo data. The game should use its existing vocation definitions.
const screen = document.querySelector(".sv");
const cards = [...screen.querySelectorAll("[data-choice]")];
const portrait = screen.querySelector(".sv__portrait");
const choose = screen.querySelector(".sv__confirm button");
const dialog = screen.querySelector(".sv__dialog");
const confirm = dialog.querySelector('[value="confirm"]');
const status = screen.querySelector(".sv__status");

const vocations = {
  hawk: {
    name: "Hawk",
    role: "Ranged · Archer",
    description: "An archer who strikes from afar, with a falcon at their side.",
    strength: "Long-range shots, Power Shot and volleys.",
    weakness: "Vulnerable in melee.",
  },
  bastion: {
    name: "Bastion",
    role: "Melee · Defender",
    description: "A durable frontline fighter who protects allies and holds the line.",
    strength: "High survivability and strong melee.",
    weakness: "Slower movement and limited range.",
  },
  ember: {
    name: "Ember",
    role: "Magic · Spellcaster",
    description: "A spellcaster who burns whole packs with fire and energy.",
    strength: "The most damage and the most mana.",
    weakness: "Fragile and mana-dependent.",
  },
};

function previewVocation(id) {
  const vocation = vocations[id];
  screen.dataset.vocation = id;
  portrait.src = new URL(`assets/${id}-character.png`, document.baseURI).href;
  for (const card of cards) {
    card.setAttribute("aria-pressed", String(card.dataset.choice === id));
  }
  screen.querySelector(".sv__role").textContent = vocation.role;
  screen.querySelector(".sv__description").textContent = vocation.description;
  screen.querySelector('[data-stat="strength"]').textContent = vocation.strength;
  screen.querySelector('[data-stat="weakness"]').textContent = vocation.weakness;
  choose.textContent = `Choose ${vocation.name}`;
  status.textContent = "";
}

for (const card of cards) {
  card.addEventListener("click", () => previewVocation(card.dataset.choice));
}

choose.addEventListener("click", () => {
  const { name } = vocations[screen.dataset.vocation];
  dialog.returnValue = "";
  dialog.querySelector("h2").textContent = `Choose ${name}?`;
  confirm.textContent = `Confirm ${name}`;
  dialog.showModal();
});

dialog.addEventListener("close", () => {
  choose.focus();
  if (dialog.returnValue === "confirm") {
    const { name } = vocations[screen.dataset.vocation];
    status.textContent = `${name} confirmed in this preview.`;
  }
});
