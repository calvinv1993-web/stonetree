const artMode = new URLSearchParams(location.search).get("art") === "sketch" ? "sketch" : "color";
const illustration = (name) => `assets/${artMode}/${name}.webp`;

const cards = [
  ["The Broken Seal", "Long ago, something beneath the northern mountain made the creatures above obey its commands. The people of the north sealed the stairway so no creature would hear those commands again. Then the river flooded. When the water receded, the seal lay broken.", illustration("the-broken-seal"), "50%"],
  ["The Hollow Host", "Three nights later, a miller saw goblins and wolves coming down the road together. He’d seen them fight over the same prey. When he barred the bridge, two goblins stayed at the gate while the rest took the wolves upstream. As more villages fell, people fled south.", illustration("the-hollow-host"), "51%"],
  ["The Last Crossing", "You followed the survivors to Oakvale. Its gate still opened to refugees, and ships waited in the harbor. Just before the bridge, a watchman raised his lantern once. A wounded man by the road lifted his twice. Two guards came across to help him.", illustration("the-last-crossing"), "54%"],
  ["The False Signal", "After the guards brought the man inside, the lantern above the gate went up again. From the ditch came the same reply. Two lifts. This time, the light fell on a goblin’s hand. A wolf waited behind him. You ran. Halfway across the bridge, your legs gave way.", illustration("the-false-signal"), "46%"],
];
const amaArt = illustration("sister-ama");
const story = document.querySelector(".story");
const handoff = document.querySelector(".handoff");
const title = story.querySelector("h1");
const copy = story.querySelector(".copy");
const art = story.querySelector(".art");
const footer = story.querySelector(".footer");
const previous = story.querySelector(".return");
const next = footer.querySelector(".forward");
const nextLabel = next.querySelector(".next-label");
const progress = story.querySelector(".progress");
const skip = story.querySelector(".skip");
const form = story.querySelector("form");
const input = form.querySelector("input");
const restart = handoff.querySelector(".restart");
const dots = [...progress.children];
let step = 0;
let playerName = "";
let touchStart;
const nameStep = cards.length;
const dialogueStep = nameStep + 1;
const alarmStep = dialogueStep + 1;
const lastStep = alarmStep + 1;

function show(index, moveFocus = true) {
  step = index;
  story.hidden = step > lastStep;
  handoff.hidden = !story.hidden;
  if (story.hidden) {
    if (moveFocus) restart.focus({preventScroll:true});
    window.scrollTo(0, 0);
    return;
  }
  const card = cards[step];
  const isName = step === nameStep;
  story.dataset.screen = card ? "story" : "ama";
  story.style.setProperty("--framing", card ? card[3] : "54%");
  const src = card ? card[2] : amaArt;
  if (art.getAttribute("src") !== src) {
    art.src = src;
    art.classList.remove("enter");
    requestAnimationFrame(() => art.classList.add("enter"));
  }
  title.textContent = card ? card[0] : "Sister Ama";
  if (card) copy.textContent = card[1];
  else if (isName) copy.textContent = "“You’re awake. The watch brought you in last night. I’m Sister Ama. What should I call you?”";
  else if (step === dialogueStep) copy.textContent = "“" + playerName + ", the guards who carried you in saw the signal again. Last night they turned back to help you. Now they’ve gone to look for whoever’s still out there.”";
  else if (step === alarmStep) copy.textContent = "You tell Ama a goblin was holding the lantern.\n\n“They’re already across the bridge.” She turns to a temple attendant. “Run to the gate. Tell the watch it’s a trap.”";
  else copy.textContent = "“Oakvale’s watch trains three kinds of defenders. Bastions hold the crossings so people can reach safety. Hawks scout the roads and fight with the bow. Embers use magic against threats that steel can’t stop.\n\n“If you want to help Oakvale, the watch can train you. Which path will you take?”";
  form.hidden = !isName;
  footer.hidden = isName;
  skip.hidden = !card;
  progress.hidden = !card;
  previous.hidden = !card;
  previous.disabled = step === 0;
  nextLabel.textContent = step === lastStep ? "Choose Your Path" : "Continue";
  dots.forEach((dot, i) => {
    if (card && step === i) dot.setAttribute("aria-current", "step");
    else dot.removeAttribute("aria-current");
  });
  if (moveFocus) title.focus({preventScroll:true});
  window.scrollTo(0, 0);
}

function changeCard(offset) {
  const target = step + offset;
  if (step < nameStep && target >= 0 && target <= nameStep) show(target);
}

skip.addEventListener("click", () => show(nameStep));
previous.addEventListener("click", () => changeCard(-1));
next.addEventListener("click", () => show(step + 1));
restart.addEventListener("click", () => show(lastStep));
input.addEventListener("input", () => input.setCustomValidity(""));
form.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = input.value.trim();
  if (!name) {
    input.setCustomValidity("Enter a character name.");
    input.reportValidity();
    return;
  }
  playerName = name;
  show(dialogueStep);
});
story.addEventListener("touchstart", (event) => {
  touchStart = step < nameStep && event.changedTouches.length === 1
    ? [event.changedTouches[0].clientX, event.changedTouches[0].clientY]
    : undefined;
}, {passive:true});
story.addEventListener("touchend", (event) => {
  if (!touchStart) return;
  const finger = event.changedTouches[0];
  const dx = finger.clientX - touchStart[0];
  const dy = finger.clientY - touchStart[1];
  touchStart = undefined;
  if (Math.abs(dx) >= 55 && Math.abs(dx) > Math.abs(dy) * 1.5) changeCard(dx < 0 ? 1 : -1);
}, {passive:true});
story.addEventListener("touchcancel", () => { touchStart = undefined; }, {passive:true});
document.addEventListener("keydown", (event) => {
  if (step >= nameStep || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    changeCard(event.key === "ArrowLeft" ? -1 : 1);
  }
});
show(0, false);
