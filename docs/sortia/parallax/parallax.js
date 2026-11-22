(() => {
  const data = window.SORTIA_PARALLAX;
  const viewport = document.querySelector(".viewport");
  const world = document.querySelector(".world");
  const heading = document.querySelector("h1");
  const copy = document.querySelector(".copy");
  const back = document.querySelector(".back");
  const next = document.querySelector(".next");
  const count = document.querySelector(".count");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const scenes = [
    ["The Broken Seal", "A broken bronze seal, a displaced stone lid, and a stairway into the mountain."],
    ["The Hollow Host", "The goblins hold the bridge while the others take the wolves upstream."],
    ["The Last Crossing", "The watch answers a wounded traveler’s lantern and sends two guards to help."],
    ["The False Signal", "From the ditch, a goblin answers the watch with the same signal."],
    ["Sister Ama", "You wake in Oakvale. Sister Ama asks your name before the story leads to Choose Your Path."]
  ];
  const layers = data.layers.map(item => {
    const layer = document.createElement("div");
    layer.className = "layer";
    layer.dataset.layer = item.id;
    Object.assign(layer.style, {
      left: item.x + "px", top: item.y + "px",
      width: item.width + "px", height: item.height + "px", zIndex: item.z
    });
    const img = document.createElement("img");
    img.src = item.file;
    img.alt = "";
    img.draggable = false;
    layer.append(img);
    world.append(layer);
    return {node: layer, depth: item.depth};
  });
  let step = 0;
  let scale = 1;
  let camera = 0;
  let animation;
  let pointer;
  let dragging = false;

  function endpoint(index) {
    const room = viewport.clientWidth / scale;
    const middle = data.cameraCenters[index] * data.canvas.width;
    return Math.max(0, Math.min(data.canvas.width - room, middle - room / 2));
  }
  function draw(value) {
    camera = value;
    world.style.transform = "scale(" + scale + ") translate3d(" + (-camera) + "px,0,0)";
  }
  function centerLayers() {
    layers.forEach(layer => { layer.node.style.translate = "0px 0px"; });
  }
  function captions() {
    heading.textContent = scenes[step][0];
    copy.textContent = scenes[step][1];
    back.disabled = step === 0;
    next.disabled = step === scenes.length - 1;
    count.textContent = (step + 1) + " / " + scenes.length;
  }
  function move(index) {
    const target = Math.max(0, Math.min(scenes.length - 1, index));
    step = target;
    captions();
    centerLayers();
    if (animation) animation.cancel();
    const destination = endpoint(step);
    if (reduced.matches) {
      draw(destination);
      return;
    }
    const from = camera;
    const probe = {value: from};
    const start = performance.now();
    let cancelled = false;
    animation = {cancel() { cancelled = true; }};
    function tick(now) {
      if (cancelled) return;
      const progress = Math.min(1, (now - start) / 650);
      const ease = 1 - Math.pow(1 - progress, 3);
      probe.value = from + (destination - from) * ease;
      draw(probe.value);
      if (progress < 1) requestAnimationFrame(tick);
      else animation = undefined;
    }
    requestAnimationFrame(tick);
  }
  function resize() {
    if (animation) animation.cancel();
    scale = Math.max(viewport.clientHeight / data.canvas.height, viewport.clientWidth / data.canvas.width);
    draw(endpoint(step));
    centerLayers();
  }
  function finish(event, cancelled = false) {
    if (!pointer || event.pointerId !== pointer.id) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    pointer = undefined;
    dragging = false;
    viewport.classList.remove("is-dragging");
    centerLayers();
    if (!cancelled && Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) move(step + (dx < 0 ? 1 : -1));
    else move(step);
  }
  viewport.addEventListener("pointerdown", event => {
    if (!event.isPrimary || event.button !== 0) return;
    if (animation) animation.cancel();
    pointer = {id:event.pointerId,x:event.clientX,y:event.clientY,base:camera};
    dragging = true;
    viewport.classList.add("is-dragging");
    viewport.setPointerCapture(event.pointerId);
  });
  viewport.addEventListener("pointermove", event => {
    if (pointer && event.pointerId === pointer.id) {
      const dx = event.clientX - pointer.x;
      const max = data.canvas.width - viewport.clientWidth / scale;
      draw(Math.max(0,Math.min(max,pointer.base - dx / scale)));
      if (!reduced.matches) {
        const amount = Math.max(-1, Math.min(1, dx / viewport.clientWidth));
        layers.forEach(layer => {
          layer.node.style.translate = (amount * layer.depth) + "px 0px";
        });
      }
      return;
    }
    if (reduced.matches || event.pointerType === "touch" || dragging) return;
    const rect = viewport.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * 2 - 1;
    const y = (event.clientY - rect.top) / rect.height * 2 - 1;
    layers.forEach(layer => {
      layer.node.style.translate = (x * layer.depth) + "px " + (y * layer.depth * .45) + "px";
    });
  });
  viewport.addEventListener("pointerup", event => finish(event));
  viewport.addEventListener("pointercancel", event => finish(event,true));
  viewport.addEventListener("pointerleave", () => { if (!dragging) centerLayers(); });
  viewport.addEventListener("keydown", event => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      move(step + (event.key === "ArrowRight" ? 1 : -1));
    }
  });
  back.addEventListener("click", () => move(step - 1));
  next.addEventListener("click", () => move(step + 1));
  reduced.addEventListener("change", resize);
  new ResizeObserver(resize).observe(viewport);
  captions();
  resize();
})();
